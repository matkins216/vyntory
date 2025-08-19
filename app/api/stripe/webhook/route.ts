import { NextRequest, NextResponse } from 'next/server';
import { stripe, updateInventoryMetadata } from '@/lib/stripe';
import { headers } from 'next/headers';

export async function POST(request: NextRequest) {
  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get('stripe-signature');

  if (!signature) {
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

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object;
        
        // Handle successful checkout
        if (session.mode === 'payment' && session.line_items?.data) {
          for (const item of session.line_items.data) {
            if (item.price?.product) {
              const productId = typeof item.price.product === 'string' 
                ? item.price.product 
                : item.price.product.id;
              
              const quantity = item.quantity || 1;
              
              // Get current product to check inventory
              // For webhooks, we need to determine the connected account
              // This is a simplified approach - in production you might want to store account mapping
              const product = await stripe.products.retrieve(productId);
              const currentInventory = JSON.parse(product.metadata.inventory || '{"inventory": 0}');
              const newQuantity = Math.max(0, currentInventory.inventory - quantity);
              
              // Update inventory - webhook events come from the connected account
              // For now, we'll use the main account since webhook events are typically global
              // In production, you might want to implement account mapping logic
              
              await updateInventoryMetadata(
                productId,
                newQuantity,
                currentInventory.inventory,
                'system',
                'purchase',
                `Purchase of ${quantity} units`,
                undefined, // No access token
                undefined // Use main account for webhook events
              );
            }
          }
        }
        break;

      case 'payment_intent.succeeded':
        // Handle successful payment
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
