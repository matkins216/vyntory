import { NextRequest, NextResponse } from 'next/server';
import { ConnectCustomerService } from '@/lib/services/connect-customer';

export interface PayGateMiddlewareOptions {
  redirectTo?: string;
  requireActiveSubscription?: boolean;
  allowTrial?: boolean;
}

export async function checkPayGateAuthorization(
  request: NextRequest,
  stripeAccountId: string,
  options: PayGateMiddlewareOptions = {}
): Promise<{ isAuthorized: boolean; customer?: {}; redirectUrl?: string }> {
  const {
    redirectTo = '/dashboard/subscription',
    requireActiveSubscription = true,
    allowTrial = true
  } = options;

  try {
    const connectService = new ConnectCustomerService();
    const authResult = await connectService.checkPayGateAuthorization(stripeAccountId);

    if (!authResult.isAuthorized) {
      return {
        isAuthorized: false,
        customer: authResult.customer,
        redirectUrl: redirectTo
      };
    }

    // If we require an active subscription (not just trial), check further
    if (requireActiveSubscription && authResult.customer?.subscription_status === 'trialing') {
      if (!allowTrial) {
        return {
          isAuthorized: false,
          customer: authResult.customer,
          redirectUrl: redirectTo
        };
      }
    }

    return {
      isAuthorized: true,
      customer: authResult.customer
    };
  } catch (error) {
    console.error('Error checking pay gate authorization:', error);
    return {
      isAuthorized: false,
      redirectUrl: redirectTo
    };
  }
}

export function createPayGateMiddleware(options: PayGateMiddlewareOptions = {}) {
  return async function payGateMiddleware(
    request: NextRequest,
    stripeAccountId: string
  ): Promise<NextResponse | null> {
    const authResult = await checkPayGateAuthorization(request, stripeAccountId, options);

    if (!authResult.isAuthorized) {
      // Redirect to subscription page or show error
      if (options.redirectTo) {
        return NextResponse.redirect(new URL(options.redirectTo, request.url));
      } else {
        return NextResponse.json(
          { error: 'Unauthorized - Subscription required' },
          { status: 403 }
        );
      }
    }

    return null; // Continue with the request
  };
}

// Helper function to extract stripe account ID from request
export function extractStripeAccountId(request: NextRequest): string | null {
  // Try to get from headers first (for API routes)
  const accountHeader = request.headers.get('x-stripe-account-id');
  if (accountHeader) {
    return accountHeader;
  }

  // Try to get from query params
  const url = new URL(request.url);
  const accountParam = url.searchParams.get('account');
  if (accountParam) {
    return accountParam;
  }

  // Try to get from cookies (for authenticated sessions)
  const accountCookie = request.cookies.get('stripe_account_id')?.value;
  if (accountCookie) {
    return accountCookie;
  }

  return null;
}
