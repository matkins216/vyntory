import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { stripe } from '@/lib/stripe';
import { ConnectCustomerService } from '@/lib/services/connect-customer';
import type Stripe from 'stripe';
import { ConnectCustomer } from '@/lib/types/connect-customer';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const headersList = await headers();
    const signature = headersList.get('stripe-signature');

    if (!signature) {
      return NextResponse.json(
        { error: 'Missing Stripe signature' },
        { status: 400 }
      );
    }

    // Verify webhook signature
    let event: Stripe.Event;
    
    const webhookSecret = process.env.STRIPE_PAY_GATE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error('Missing STRIPE_PAY_GATE_WEBHOOK_SECRET environment variable');
      return NextResponse.json(
        { error: 'Webhook secret not configured' },
        { status: 500 }
      );
    }
    
    try {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        webhookSecret
      );
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      );
    }

    console.log('Processing pay gate webhook event:', event.type);

    const connectService = new ConnectCustomerService();

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        const subscriptionEvent = event.data.object as Stripe.Subscription;
        console.log('Processing subscription:', subscriptionEvent.id);
        
        // Extract customer and account information
        const customerId = subscriptionEvent.customer as string;
        const accountId = event.account; // Connected account ID
        
        if (!accountId) {
          console.error('No connected account ID in webhook event');
          break;
        }

        if (!customerId) {
          console.error('No customer ID in subscription');
          break;
        }

        try {
          // Get customer details from Stripe
          const customerResponse = await stripe.customers.retrieve(customerId, {
            stripeAccount: accountId
          });

          // Handle different customer types
          let customerEmail: string | undefined;
          let customerName: string | undefined;

          if (customerResponse.deleted) {
            // Customer was deleted
            console.log('Customer was deleted, using default values');
            customerEmail = undefined;
            customerName = undefined;
          } else {
            // Customer is active - properly typed
            customerEmail = customerResponse.email || undefined;
            customerName = customerResponse.name || undefined;
          }

          // Get subscription details with expanded data
          const subscriptionResponse = await stripe.subscriptions.retrieve(subscriptionEvent.id, {
            expand: ['items.data.price.product']
          }, {
            stripeAccount: accountId
          });

          // Type assertion to resolve Response type mismatch
          const subscriptionDetails = subscriptionResponse as unknown as Stripe.Subscription;

          // Determine plan name from the first item
          const firstItem = subscriptionDetails.items?.data?.[0];
          let planName = 'Unknown Plan';
          
          if (firstItem?.price?.product) {
            const product = firstItem.price.product;
            if (typeof product === 'string') {
              // Product is just an ID, we need to fetch it to get the name
              try {
                const productResponse = await stripe.products.retrieve(product, {
                  stripeAccount: accountId
                });
                planName = productResponse.name || 'Unknown Plan';
              } catch (productError) {
                console.error('Error fetching product details:', productError);
                planName = 'Unknown Plan';
              }
            } else {
              // Product is expanded object
              if ('name' in product && product.name) {
                planName = product.name || 'Unknown Plan';
              } else {
                planName = 'Unknown Plan';
              }
            }
          }

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
                console.warn(`Unknown subscription status: ${stripeStatus}, defaulting to inactive`);
                return 'inactive';
            }
          };

          // Validate subscription data
          if (!subscriptionDetails.current_period_start || !subscriptionDetails.current_period_end) {
            console.error('Missing required subscription period data');
            break;
          }

          // Create or update customer in our database
          await connectService.createOrUpdateCustomer({
            stripe_account_id: accountId,
            stripe_customer_id: customerId,
            email: customerEmail,
            company_name: customerName,
            subscription_status: mapSubscriptionStatus(subscriptionDetails.status),
            subscription_id: subscriptionDetails.id,
            plan_name: planName,
            current_period_start: new Date(subscriptionDetails.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscriptionDetails.current_period_end * 1000).toISOString(),
            trial_end: subscriptionDetails.trial_end ? new Date(subscriptionDetails.trial_end * 1000).toISOString() : undefined,
            is_active: subscriptionDetails.status === 'active' || subscriptionDetails.status === 'trialing'
          });

          console.log(`Updated customer ${accountId} with subscription ${subscriptionDetails.id}`);
        } catch (error) {
          console.error('Error processing subscription webhook:', error);
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
        
        if (!invoiceAccountId) {
          console.error('No connected account ID in invoice webhook event');
          break;
        }

        if (!invoiceEvent.subscription) {
          console.error('No subscription in invoice webhook event');
          break;
        }

        try {
          // Update subscription status to active
          await connectService.updateSubscriptionStatus(invoiceAccountId, {
            subscription_status: 'active'
          });
          console.log(`Updated subscription status to active for account ${invoiceAccountId}`);
        } catch (error) {
          console.error('Error processing invoice payment:', error);
          // Continue processing other webhooks even if one fails
        }
        break;

      case 'invoice.payment_failed':
        const failedInvoiceEvent = event.data.object as Stripe.Invoice;
        const failedAccountId = event.account;
        
        if (!failedAccountId) {
          console.error('No connected account ID in failed invoice webhook event');
          break;
        }

        if (!failedInvoiceEvent.subscription) {
          console.error('No subscription in failed invoice webhook event');
          break;
        }

        try {
          // Update subscription status to past_due
          await connectService.updateSubscriptionStatus(failedAccountId, {
            subscription_status: 'past_due'
          });
          console.log(`Updated subscription status to past_due for account ${failedAccountId}`);
        } catch (error) {
          console.error('Error processing failed invoice:', error);
          // Continue processing other webhooks even if one fails
        }
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
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
