import { NextRequest, NextResponse } from 'next/server';
import { stripe, updateInventoryMetadata } from '@/lib/stripe';
import { headers } from 'next/headers';

export async function GET() {
  return NextResponse.json({ 
    message: 'Webhook endpoint is working',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get('stripe-signature');

  if (!signature) {
    console.error('Webhook: No signature provided');
    return NextResponse.json({ error: 'No signature' }, { status: 400 });
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (error) {
    console.error('Webhook signature verification failed:', error);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  console.log('Webhook received:', event.type, event.id);

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object;
        console.log('Processing checkout.session.completed:', session.id);
        
        // Check if this is a payment session (not subscription)
        if (session.mode === 'payment') {
          console.log('Payment session detected, processing line items...');
          
          // Retrieve the session with expanded line_items to get product details
          const expandedSession = await stripe.checkout.sessions.retrieve(
            session.id,
            {
              expand: ['line_items.data.price.product']
            }
          );
          
          if (expandedSession.line_items?.data) {
            console.log(`Found ${expandedSession.line_items.data.length} line items`);
            
            for (const item of expandedSession.line_items.data) {
              if (item.price?.product) {
                const productId = typeof item.price.product === 'string' 
                  ? item.price.product 
                  : item.price.product.id;
                
                const quantity = item.quantity || 1;
                
                console.log(`Processing product ${productId}, quantity: ${quantity}`);
                
                // Get the connected account ID from the session
                // For connected accounts, the session will have the account ID
                let connectedAccountId = (session as any).account;
                
                if (!connectedAccountId) {
                  console.error('No connected account ID found in session, trying to extract from metadata');
                  // Try to get account ID from metadata or other sources
                  const accountId = (session as any).metadata?.connected_account_id;
                  if (!accountId) {
                    // As a last resort, try to get the account from the product itself
                    console.log('Trying to determine account from product metadata...');
                    try {
                      const product = await stripe.products.retrieve(productId);
                      if (product.metadata?.stripe_account_id) {
                        connectedAccountId = product.metadata.stripe_account_id;
                        console.log(`Found account ID from product metadata: ${connectedAccountId}`);
                      } else {
                        console.error('Cannot determine connected account, skipping inventory update');
                        continue;
                      }
                    } catch (productError) {
                      console.error('Error retrieving product to find account ID:', productError);
                      continue;
                    }
                  } else {
                    connectedAccountId = accountId;
                  }
                }
                
                try {
                  // Get current product from the connected account
                  const product = await stripe.products.retrieve(productId, {
                    stripeAccount: connectedAccountId
                  });
                  
                  console.log(`Retrieved product ${productId} from account ${connectedAccountId}`);
                  
                  const currentInventory = JSON.parse(product.metadata.inventory || '{"inventory": 0}');
                  const previousQuantity = currentInventory.inventory;
                  const newQuantity = Math.max(0, previousQuantity - quantity);
                  
                  console.log(`Inventory update: ${previousQuantity} -> ${newQuantity} (reduced by ${quantity})`);
                  
                  // Update inventory in the connected account
                  await updateInventoryMetadata(
                    productId,
                    newQuantity,
                    previousQuantity,
                    'system',
                    'purchase',
                    `Purchase of ${quantity} units via checkout session ${session.id}`,
                    undefined, // No access token needed
                    connectedAccountId // Use the connected account
                  );
                  
                  console.log(`Successfully updated inventory for product ${productId}`);
                  
                } catch (productError) {
                  console.error(`Error processing product ${productId}:`, productError);
                }
              }
            }
          } else {
            console.log('No line items found in session');
          }
        } else {
          console.log('Non-payment session, skipping inventory update');
        }
        break;

      case 'payment_intent.succeeded':
        console.log('Payment intent succeeded:', event.data.object.id);
        // Handle successful payment if needed
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}
