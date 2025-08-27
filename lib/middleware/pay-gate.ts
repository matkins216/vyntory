import { NextRequest, NextResponse } from 'next/server';
import { ConnectCustomerService } from '@/lib/services/connect-customer';
import { ConnectCustomer } from '@/lib/types/connect-customer';

export interface PayGateAuthResult {
  isAuthorized: boolean;
  customer?: ConnectCustomer;
  reason?: string;
}

export async function checkPayGateAuthorization(
  stripeAccountId: string,
  requireActiveSubscription: boolean = true,
  allowTrial: boolean = true
): Promise<PayGateAuthResult> {
  if (!stripeAccountId) {
    return {
      isAuthorized: false,
      reason: 'No Stripe account ID provided'
    };
  }

  try {
    const connectService = new ConnectCustomerService();
    const customer = await connectService.getCustomerByStripeAccountId(stripeAccountId);

    if (!customer) {
      return {
        isAuthorized: false,
        reason: 'No subscription found for this account'
      };
    }

    // Check if subscription is active
    if (requireActiveSubscription) {
      const validStatuses = ['active', 'trialing'];
      if (!validStatuses.includes(customer.subscription_status)) {
        return {
          isAuthorized: false,
          reason: `Subscription is ${customer.subscription_status}. Active subscription required.`
        };
      }
    }

    // Check trial access
    if (!allowTrial && customer.subscription_status === 'trialing') {
      return {
        isAuthorized: false,
        reason: 'Trial access not allowed for this feature'
      };
    }

    return {
      isAuthorized: true,
      customer
    };
  } catch (error) {
    console.error('Error checking pay gate authorization:', error);
    return {
      isAuthorized: false,
      reason: 'Error checking authorization'
    };
  }
}

export function createPayGateMiddleware() {
  return async function payGateMiddleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    
    console.log('🔒 Pay gate middleware triggered for path:', pathname);
    
    // Extract Stripe account ID from headers or query params
    const stripeAccountId = extractStripeAccountId(request);
    console.log('🔍 Extracted Stripe account ID:', stripeAccountId);
    
    if (!stripeAccountId) {
      console.log('❌ No Stripe account ID found, redirecting to subscription page');
      // Redirect to subscription page if no account ID
      const subscriptionUrl = new URL('/subscription-required', request.url);
      subscriptionUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(subscriptionUrl);
    }

    console.log('🔐 Checking authorization for account:', stripeAccountId);
    // Check authorization using the enhanced service method
    const connectService = new ConnectCustomerService();
    const authResult = await connectService.checkPayGateAuthorization(stripeAccountId);
    
    console.log('🔐 Authorization result:', {
      isAuthorized: authResult.isAuthorized,
      reason: authResult.reason,
      customerId: authResult.customer?.id
    });
    
    if (!authResult.isAuthorized) {
      console.log('❌ Authorization failed, redirecting to subscription page');
      // Redirect to subscription page with reason
      const subscriptionUrl = new URL('/subscription-required', request.url);
      subscriptionUrl.searchParams.set('redirect', pathname);
      subscriptionUrl.searchParams.set('reason', authResult.reason || 'Subscription required');
      return NextResponse.redirect(subscriptionUrl);
    }

    console.log('✅ Authorization successful, allowing access');
    // User is authorized, continue to the requested page
    return NextResponse.next();
  };
}

export function extractStripeAccountId(request: NextRequest): string | null {
  // Try to get from headers first
  const headerAccountId = request.headers.get('x-stripe-account-id');
  if (headerAccountId) {
    console.log('🔍 Found account ID in header:', headerAccountId);
    return headerAccountId;
  }

  // Try to get from query params - check for 'account' first (what dashboard uses)
  const url = new URL(request.url);
  const accountParam = url.searchParams.get('account');
  if (accountParam) {
    console.log('🔍 Found account ID in query param "account":', accountParam);
    return accountParam;
  }

  // Try to get from query params - check for 'stripe_account_id' as fallback
  const queryAccountId = url.searchParams.get('stripe_account_id');
  if (queryAccountId) {
    console.log('🔍 Found account ID in query param "stripe_account_id":', queryAccountId);
    return queryAccountId;
  }

  // Try to get from cookies (if you store it there)
  const cookieAccountId = request.cookies.get('stripe_account_id')?.value;
  if (cookieAccountId) {
    console.log('🔍 Found account ID in cookie:', cookieAccountId);
    return cookieAccountId;
  }

  console.log('❌ No account ID found in any location');
  return null;
}
