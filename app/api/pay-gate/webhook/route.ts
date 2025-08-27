import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { stripe } from '@/lib/stripe';
import { ConnectCustomerService } from '@/lib/services/connect-customer';
import type Stripe from 'stripe';
import { ConnectCustomer } from '@/lib/types/connect-customer';

export async function GET() {
  return NextResponse.json({
    message: 'Pay gate webhook endpoint is working',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    webhookSecret: process.env.STRIPE_PAY_GATE_WEBHOOK_SECRET ? 'Configured' : 'Missing'
  });
}

export async function POST(request: NextRequest) {
  try {
    console.log('=== PAY GATE WEBHOOK RECEIVED ===');
    console.log('Request method:', request.method);
    console.log('Request URL:', request.url);
    console.log('Request headers:', Object.fromEntries(request.headers.entries()));
    
    const body = await request.text();
    console.log('Request body length:', body.length);
    console.log('Request body preview:', body.substring(0, 500));
    
    const headersList = await headers();
    const signature = headersList.get('stripe-signature');
    console.log('Stripe signature header:', signature ? 'Present' : 'Missing');

    if (!signature) {
      console.error('❌ Missing Stripe signature');
      return NextResponse.json(
        { error: 'Missing Stripe signature' },
        { status: 400 }
      );
    }

    // Verify webhook signature
    let event: Stripe.Event;
    
    const webhookSecret = process.env.STRIPE_PAY_GATE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error('❌ Missing STRIPE_PAY_GATE_WEBHOOK_SECRET environment variable');
      return NextResponse.json(
        { error: 'Webhook secret not configured' },
        { status: 500 }
      );
    }
    
    console.log('🔐 Verifying webhook signature...');
    try {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        webhookSecret
      );
      console.log('✅ Webhook signature verified successfully');
    } catch (err) {
      console.error('❌ Webhook signature verification failed:', err);
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      );
    }

    console.log('📋 Processing pay gate webhook event:', event.type);
    console.log('Event ID:', event.id);
    console.log('Event livemode:', event.livemode);
    console.log('Event created:', new Date(event.created * 1000).toISOString());
    console.log('Event account:', event.account);
    console.log('Full event structure:', JSON.stringify(event, null, 2));

    const connectService = new ConnectCustomerService();

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        const subscriptionEvent = event.data.object as Stripe.Subscription;
        console.log('=== PROCESSING SUBSCRIPTION EVENT ===');
        console.log('Event type:', event.type);
        console.log('Subscription ID:', subscriptionEvent.id);
        console.log('Full subscription event:', JSON.stringify(subscriptionEvent, null, 2));
        
        // Extract customer and account information
        const customerId = subscriptionEvent.customer as string;
        const accountId = event.account; // Connected account ID
        
        console.log('Customer ID from subscription:', customerId);
        console.log('Account ID from event:', accountId);
        console.log('Event account field:', event.account);
        console.log('Event livemode:', event.livemode);
        
        if (!accountId) {
          console.error('❌ No connected account ID in webhook event');
          console.log('Available event fields:', Object.keys(event));
          break;
        }

        if (!customerId) {
          console.error('❌ No customer ID in subscription');
          break;
        }

        try {
          console.log('🔍 Retrieving customer details from Stripe...');
          // Get customer details from Stripe
          const customerResponse = await stripe.customers.retrieve(customerId, {
            stripeAccount: accountId
          });

          console.log('Customer response type:', typeof customerResponse);
          console.log('Customer response deleted:', customerResponse.deleted);
          console.log('Full customer response:', JSON.stringify(customerResponse, null, 2));

          // Handle different customer types
          let customerEmail: string | undefined;
          let customerName: string | undefined;

          if (customerResponse.deleted) {
            // Customer was deleted
            console.log('⚠️ Customer was deleted, using default values');
            customerEmail = undefined;
            customerName = undefined;
          } else {
            // Customer is active - properly typed
            customerEmail = customerResponse.email || undefined;
            customerName = customerResponse.name || undefined;
            console.log('✅ Customer is active');
            console.log('Customer email:', customerEmail);
            console.log('Customer name:', customerName);
          }

          console.log('🔍 Retrieving subscription details with expanded data...');
          // Get subscription details with expanded data
          const subscriptionResponse = await stripe.subscriptions.retrieve(subscriptionEvent.id, {
            expand: ['items.data.price.product']
          }, {
            stripeAccount: accountId
          });

          console.log('Subscription response type:', typeof subscriptionResponse);
          console.log('Subscription response keys:', Object.keys(subscriptionResponse));
          console.log('Full subscription response:', JSON.stringify(subscriptionResponse, null, 2));

          // Type assertion to resolve Response type mismatch
          const subscriptionDetails = subscriptionResponse as unknown as Stripe.Subscription;

          console.log('🔍 Determining plan name from subscription items...');
          // Determine plan name from the first item
          const firstItem = subscriptionDetails.items?.data?.[0];
          console.log('First subscription item:', firstItem);
          
          let planName = 'Unknown Plan';
          
          if (firstItem?.price?.product) {
            const product = firstItem.price.product;
            console.log('Product from subscription item:', product);
            console.log('Product type:', typeof product);
            
            if (typeof product === 'string') {
              // Product is just an ID, we need to fetch it to get the name
              console.log('🔍 Product is just an ID, fetching product details...');
              try {
                const productResponse = await stripe.products.retrieve(product, {
                  stripeAccount: accountId
                });
                planName = productResponse.name || 'Unknown Plan';
                console.log('✅ Retrieved product name:', planName);
              } catch (productError) {
                console.error('❌ Error fetching product details:', productError);
                planName = 'Unknown Plan';
              }
            } else {
              // Product is expanded object
              console.log('🔍 Product is expanded object, checking for name...');
              if ('name' in product && product.name) {
                planName = product.name || 'Unknown Plan';
                console.log('✅ Got plan name from expanded product:', planName);
              } else {
                console.log('⚠️ Product object has no name property');
                planName = 'Unknown Plan';
              }
            }
          } else {
            console.log('⚠️ No product found in subscription items');
          }

          console.log('📋 Final plan name determined:', planName);

          // Map Stripe subscription status to our expected format
          const mapSubscriptionStatus = (stripeStatus: string): ConnectCustomer['subscription_status'] => {
            switch (stripeStatus) {
              case 'active':
              case 'trialing':
              case 'past_due':
              case 'canceled':
              case 'incomplete':
              case 'incomplete_expired':
              case 'unpaid':
                return stripeStatus as ConnectCustomer['subscription_status'];
              default:
                console.warn(`⚠️ Unknown subscription status: ${stripeStatus}, defaulting to inactive`);
                return 'inactive';
            }
          };

          const subscriptionStatus = mapSubscriptionStatus(subscriptionDetails.status);
          console.log('📊 Mapped subscription status:', subscriptionStatus);

          // Validate subscription data
          console.log('🔍 Validating subscription period data...');
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if (!(subscriptionDetails as any).current_period_start || !(subscriptionDetails as any).current_period_end) {
            console.error('❌ Missing required subscription period data');
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            console.log('Current period start:', (subscriptionDetails as any).current_period_start);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            console.log('Current period end:', (subscriptionDetails as any).current_period_end);
            break;
          }

          console.log('✅ Subscription period data validated');

          // Prepare customer data for database
          const customerData = {
            stripe_account_id: accountId,
            stripe_customer_id: customerId,
            email: customerEmail,
            company_name: customerName,
            subscription_status: subscriptionStatus,
            subscription_id: subscriptionDetails.id,
            plan_name: planName,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            current_period_start: new Date((subscriptionDetails as any).current_period_start * 1000).toISOString(),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            current_period_end: new Date((subscriptionDetails as any).current_period_end * 1000).toISOString(),
            trial_end: subscriptionDetails.trial_end ? new Date(subscriptionDetails.trial_end * 1000).toISOString() : undefined,
            is_active: subscriptionDetails.status === 'active' || subscriptionDetails.status === 'trialing'
          };

          console.log('📝 Customer data prepared for database:', JSON.stringify(customerData, null, 2));

          // Create or update customer in our database
          console.log('💾 Saving customer to database...');
          await connectService.createOrUpdateCustomer(customerData);

          console.log(`✅ Successfully updated customer ${accountId} with subscription ${subscriptionDetails.id}`);
          console.log('=== END SUBSCRIPTION EVENT PROCESSING ===');
        } catch (error) {
          console.error('❌ Error processing subscription webhook:', error);
          // Continue processing other webhooks even if one fails
        }
        break;

      case 'customer.subscription.deleted':
        const deletedAccountId = event.account;
        
        if (!deletedAccountId) {
          console.error('No connected account ID in deleted subscription webhook event');
          break;
        }

        try {
          await connectService.updateSubscriptionStatus(deletedAccountId, {
            subscription_status: 'canceled'
          });
          console.log(`Marked subscription as canceled for account ${deletedAccountId}`);
        } catch (error) {
          console.error('Error processing subscription deletion:', error);
          // Continue processing other webhooks even if one fails
        }
        break;

      case 'invoice.payment_succeeded':
        const invoiceEvent = event.data.object as Stripe.Invoice;
        const invoiceAccountId = event.account;
        
        console.log('=== PROCESSING INVOICE PAYMENT SUCCEEDED ===');
        console.log('Event type:', event.type);
        console.log('Invoice ID:', invoiceEvent.id);
        console.log('Account ID from event:', invoiceAccountId);
        console.log('Full invoice event:', JSON.stringify(invoiceEvent, null, 2));
        
        if (!invoiceAccountId) {
          console.error('❌ No connected account ID in invoice webhook event');
          console.log('Available event fields:', Object.keys(event));
          break;
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (!(invoiceEvent as any).subscription) {
          console.error('❌ No subscription in invoice webhook event');
          console.log('Invoice fields:', Object.keys(invoiceEvent));
          break;
        }

        try {
          console.log('💳 Updating subscription status to active...');
          // Update subscription status to active
          await connectService.updateSubscriptionStatus(invoiceAccountId, {
            subscription_status: 'active'
          });
          console.log(`✅ Updated subscription status to active for account ${invoiceAccountId}`);
          console.log('=== END INVOICE PAYMENT SUCCEEDED ===');
        } catch (error) {
          console.error('❌ Error processing invoice payment:', error);
          // Continue processing other webhooks even if one fails
        }
        break;

      case 'invoice.payment_failed':
        const failedInvoiceEvent = event.data.object as Stripe.Invoice;
        const failedAccountId = event.account;
        
        console.log('=== PROCESSING INVOICE PAYMENT FAILED ===');
        console.log('Event type:', event.type);
        console.log('Invoice ID:', failedInvoiceEvent.id);
        console.log('Account ID from event:', failedAccountId);
        console.log('Full failed invoice event:', JSON.stringify(failedInvoiceEvent, null, 2));
        
        if (!failedAccountId) {
          console.error('❌ No connected account ID in failed invoice webhook event');
          console.log('Available event fields:', Object.keys(event));
          break;
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (!(failedInvoiceEvent as any).subscription) {
          console.error('❌ No subscription in failed invoice webhook event');
          console.log('Failed invoice fields:', Object.keys(failedInvoiceEvent));
          break;
        }

        try {
          console.log('💳 Updating subscription status to past_due...');
          // Update subscription status to past_due
          await connectService.updateSubscriptionStatus(failedAccountId, {
            subscription_status: 'past_due'
          });
          console.log(`✅ Updated subscription status to past_due for account ${failedAccountId}`);
          console.log('=== END INVOICE PAYMENT FAILED ===');
        } catch (error) {
          console.error('❌ Error processing failed invoice:', error);
          // Continue processing other webhooks even if one fails
        }
        break;

      default:
        console.log(`⚠️ Unhandled event type: ${event.type}`);
        console.log('Unhandled event data:', JSON.stringify(event.data, null, 2));
        console.log('Consider adding handler for this event type');
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Error processing pay gate webhook:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json(
      { error: 'Internal server error', details: errorMessage },
      { status: 500 }
    );
  }
}
