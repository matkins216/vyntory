import { NextRequest, NextResponse } from 'next/server';
import { ConnectCustomerService } from '@/lib/services/connect-customer';
import { extractStripeAccountId } from '@/lib/middleware/pay-gate';

export async function POST(request: NextRequest) {
  try {
    // Extract Stripe account ID from request
    const stripeAccountId = extractStripeAccountId(request);
    
    if (!stripeAccountId) {
      return NextResponse.json(
        { error: 'Stripe account ID is required' },
        { status: 400 }
      );
    }

    // Get request body for additional options
    const body = await request.json().catch(() => ({}));
    const { requireActiveSubscription = true, allowTrial = true } = body;

    // Check authorization
    const connectService = new ConnectCustomerService();
    const authResult = await connectService.checkPayGateAuthorization(stripeAccountId);

    // Apply additional filters if needed
    if (authResult.isAuthorized && requireActiveSubscription) {
      if (authResult.customer?.subscription_status === 'trialing' && !allowTrial) {
        authResult.isAuthorized = false;
        authResult.reason = 'Trial subscriptions not allowed for this feature';
      }
    }

    return NextResponse.json(authResult);
  } catch (error) {
    console.error('Error checking pay gate authorization:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        reason: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Extract Stripe account ID from request
    const stripeAccountId = extractStripeAccountId(request);
    
    if (!stripeAccountId) {
      return NextResponse.json(
        { error: 'Stripe account ID is required' },
        { status: 400 }
      );
    }

    // Get customer details
    const connectService = new ConnectCustomerService();
    const customer = await connectService.getCustomerByStripeAccountId(stripeAccountId);

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ customer });
  } catch (error) {
    console.error('Error fetching customer details:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        reason: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
