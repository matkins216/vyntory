import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { stripe } from '@/lib/stripe';
import { ConnectCustomerService } from '@/lib/services/connect-customer';
import type Stripe from 'stripe';

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
    try {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_PAY_GATE_WEBHOOK_SECRET || ''
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
        const subscription = event.data.object;
        console.log('Processing subscription:', subscription.id);
        
        // Extract customer and account information
        const customerId = subscription.customer as string;
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
          const customer = await stripe.customers.retrieve(customerId, {
            stripeAccount: accountId
          });

          // Get subscription details
          const subscriptionDetails = await stripe.subscriptions.retrieve(subscription.id, {
            expand: ['items.data.price.product']
          }, {
            stripeAccount: accountId
          });

          // Determine plan name from the first item
          const firstItem = subscriptionDetails.items?.data?.[0];
          let planName = 'Unknown Plan';
          
          if (firstItem?.price?.product) {
            const product = firstItem.price.product;
            if (typeof product === 'string') {
              // Product is just an ID, we need to fetch it to get the name
              try {
                const productDetails = await stripe.products.retrieve(product, {
                  stripeAccount: accountId
                });
                planName = productDetails.name || 'Unknown Plan';
              } catch (productError) {
                console.error('Error fetching product details:', productError);
                planName = 'Unknown Plan';
              }
            } else {
              // Product is expanded object
              if ('name' in product && product.name) {
                planName = product.name;
              } else {
                planName = 'Unknown Plan';
              }
            }
          }

          // Validate required subscription fields
          if (!subscription.current_period_start || !subscription.current_period_end) {
            console.error('Missing required subscription period data');
            break;
          }

          // Create or update customer in our database
          await connectService.createOrUpdateCustomer({
            stripe_account_id: accountId,
            stripe_customer_id: customerId,
            email: typeof customer === 'string' ? undefined : customer.email,
            company_name: typeof customer === 'string' ? undefined : customer.name,
            subscription_status: subscription.status,
            subscription_id: subscription.id,
            plan_name: planName,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : undefined,
            is_active: subscription.status === 'active' || subscription.status === 'trialing'
          });

          console.log(`Updated customer ${accountId} with subscription ${subscription.id}`);
        } catch (error) {
          console.error('Error processing subscription webhook:', error);
        }
        break;

      case 'customer.subscription.deleted':
        const deletedAccountId = event.account;
        
        if (deletedAccountId) {
          try {
            await connectService.updateSubscriptionStatus(deletedAccountId, {
              subscription_status: 'canceled'
            });
            console.log(`Marked subscription as canceled for account ${deletedAccountId}`);
          } catch (error) {
            console.error('Error processing subscription deletion:', error);
          }
        }
        break;

      case 'invoice.payment_succeeded':
        const invoice = event.data.object;
        const invoiceAccountId = event.account;
        
        if (!invoiceAccountId) {
          console.error('No connected account ID in invoice webhook event');
          break;
        }

        if (!invoice.subscription) {
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
        }
        break;

      case 'invoice.payment_failed':
        const failedInvoice = event.data.object;
        const failedAccountId = event.account;
        
        if (!failedAccountId) {
          console.error('No connected account ID in failed invoice webhook event');
          break;
        }

        if (!failedInvoice.subscription) {
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
        }
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Error processing pay gate webhook:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
