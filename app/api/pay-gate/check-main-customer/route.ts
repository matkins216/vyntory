import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { customerId } = body;
    
    if (!customerId) {
      return NextResponse.json(
        { error: 'Customer ID is required' },
        { status: 400 }
      );
    }

    console.log('🔍 Checking if customer exists in main Stripe account:', customerId);
    
    try {
      // Check if this is a customer in the main Stripe account
      const customer = await stripe.customers.retrieve(customerId);
      
      if (customer.deleted) {
        return NextResponse.json({
          exists: false,
          message: 'Customer was deleted'
        });
      }
      
      console.log('✅ Found customer in main account:', {
        id: customer.id,
        email: customer.email,
        name: customer.name
      });
      
      // Check for active subscriptions
      const subscriptions = await stripe.subscriptions.list({
        customer: customerId,
        status: 'active'
      });
      
      console.log(`📊 Found ${subscriptions.data.length} active subscriptions`);
      
      return NextResponse.json({
        exists: true,
        customer: {
          id: customer.id,
          email: customer.email,
          name: customer.name
        },
        subscriptions: subscriptions.data.map(sub => ({
          id: sub.id,
          status: sub.status,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          current_period_start: (sub as any).current_period_start,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          current_period_end: (sub as any).current_period_end
        })),
        hasActiveSubscription: subscriptions.data.length > 0
      });
      
    } catch (stripeError) {
      console.log('❌ Not a customer in main account or error:', stripeError);
      return NextResponse.json({
        exists: false,
        message: 'Not a customer in main account',
        error: stripeError instanceof Error ? stripeError.message : 'Unknown error'
      });
    }
    
  } catch (error) {
    console.error('❌ Error checking main customer:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Check main customer endpoint',
    usage: 'POST with { customerId } to check if customer exists in main Stripe account'
  });
}
