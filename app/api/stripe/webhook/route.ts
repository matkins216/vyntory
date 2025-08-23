import { NextRequest, NextResponse } from 'next/server';
import { stripe, updateInventoryMetadata } from '@/lib/stripe';
import { headers } from 'next/headers';

// Test webhook handler for debugging
async function handleTestWebhook() {
  console.log('🧪 Processing test webhook...');
  
  // Check if we have real test data available
  const testProductId = process.env.TEST_PRODUCT_ID;
  const testAccountId = process.env.DEFAULT_CONNECTED_ACCOUNT_ID;
  
  if (!testProductId || !testAccountId) {
    console.log('🧪 No test data configured, using mock data');
    console.log('🧪 Set TEST_PRODUCT_ID and DEFAULT_CONNECTED_ACCOUNT_ID in .env.local for real testing');
  }
  
  // Simulate a checkout.session.completed event
  const mockEvent = {
    type: 'checkout.session.completed',
    id: 'evt_test_' + Date.now(),
    account: testAccountId || 'acct_test',
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: 'cs_test_' + Date.now(),
        mode: 'payment',
        line_items: {
          data: [
            {
              price: {
                product: testProductId || 'prod_test'
              },
              quantity: 1
            }
          ]
        }
      }
    }
  };
  
  console.log('🧪 Mock event created:', mockEvent);
  
  try {
    // Process the mock event
    const result = await processWebhookEvent(mockEvent);
    return NextResponse.json({ 
      success: true, 
      message: 'Test webhook processed successfully',
      result,
      note: testProductId && testAccountId ? 'Using real test data' : 'Using mock data'
    });
  } catch (error) {
    console.error('🧪 Test webhook failed:', error);
    return NextResponse.json({ 
      error: 'Test webhook failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      suggestion: testProductId && testAccountId ? 
        'Check if the test product and account exist and are accessible' : 
        'Set TEST_PRODUCT_ID and DEFAULT_CONNECTED_ACCOUNT_ID in .env.local'
    }, { status: 500 });
  }
}

// Extract webhook processing logic into a separate function
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processWebhookEvent(event: any) {
  console.log('=== PROCESSING WEBHOOK EVENT ===');
  console.log('Event type:', event.type);
  console.log('Event account:', event.account);
  
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object;
        console.log('Processing checkout.session.completed:', session.id);
        console.log('Event account (connected account ID):', event.account);
        console.log('Session mode:', session.mode);
        console.log('Session payment status:', session.payment_status);
        console.log('Session has line_items:', !!session.line_items?.data);
        console.log('Session line_items count:', session.line_items?.data?.length || 0);
        
        // Check if this is a payment session (not subscription)
        if (session.mode === 'payment') {
          console.log('Payment session detected, processing line items...');
          
          // For checkout sessions, we need to work with what's available in the webhook event
          // Trying to retrieve additional data often fails due to account context issues
          const expandedSession = session;
          
          if (!session.line_items?.data) {
            console.log('No line items in webhook event, retrieving using dedicated line items endpoint...');
            
            try {
              // Use the dedicated line items endpoint for better data access
              // Based on: https://docs.stripe.com/api/checkout/sessions/line_items?api-version=2025-07-30.basil
              console.log('Attempting to retrieve line items for session:', session.id);
              
              // Get the connected account ID first
              const connectedAccountId = event.account;
              if (!connectedAccountId) {
                console.error('No connected account ID found in webhook event');
                console.log('Webhook event structure:', JSON.stringify(event, null, 2));
                console.log('This webhook may not be configured for connected accounts');
                break;
              }
              
              console.log(`Retrieving line items for connected account: ${connectedAccountId}`);
              
              const lineItemsResponse = await stripe.checkout.sessions.listLineItems(session.id, {
                limit: 100 // Get all line items
              }, {
                stripeAccount: connectedAccountId // Important: Use the connected account context
              });
              
              console.log('Line items API response:', {
                hasData: !!lineItemsResponse.data,
                dataLength: lineItemsResponse.data?.length || 0,
                responseKeys: Object.keys(lineItemsResponse)
              });
              
              if (lineItemsResponse.data && lineItemsResponse.data.length > 0) {
                console.log(`Retrieved ${lineItemsResponse.data.length} line items using dedicated endpoint`);
                console.log('First line item structure:', JSON.stringify(lineItemsResponse.data[0], null, 2));
                
                // Transform the line items response to match our expected format
                expandedSession.line_items = {
                  data: lineItemsResponse.data.map(item => ({
                    price: {
                      product: item.price?.product || item.price?.id
                    },
                    quantity: item.quantity || 1,
                    description: item.description,
                    amount_total: item.amount_total,
                    amount_subtotal: item.amount_subtotal
                  }))
                };
                
                console.log('Transformed line items:', JSON.stringify(expandedSession.line_items.data, null, 2));
              } else {
                console.log('Line items endpoint returned no data');
                console.log('Session data available:', JSON.stringify(session, null, 2));
                
                // Check if we have basic session info we can work with
                if (session.amount_total && session.currency) {
                  console.log(`Session has total amount: ${session.amount_total} ${session.currency}`);
                  console.log('But no line items - webhook needs to be configured for line items expansion');
                  
                  // Skip processing since we can't determine what products were purchased
                  console.log('Skipping inventory update - insufficient product information');
                  break;
                }
              }
            } catch (lineItemsError) {
              console.error('Error calling line items endpoint:', lineItemsError);
              console.log('Session data available:', JSON.stringify(session, null, 2));
              
              // Check if we have basic session info we can work with
              if (session.amount_total && session.currency) {
                console.log(`Session has total amount: ${session.amount_total} ${session.currency}`);
                console.log('But no line items - webhook needs to be configured for line items expansion');
                
                // Skip processing since we can't determine what products were purchased
                console.log('Skipping inventory update - insufficient product information');
                break;
              }
            }
          }
          
          if (expandedSession.line_items?.data) {
            console.log(`Found ${expandedSession.line_items.data.length} line items in webhook event`);
            
            for (const item of expandedSession.line_items.data) {
              if (item.price?.product) {
                const productId = typeof item.price.product === 'string' 
                  ? item.price.product 
                  : item.price.product.id;
                
                const quantity = item.quantity || 1;
                
                console.log(`Processing product ${productId}, quantity: ${quantity}`);
                
                // For connected accounts, the webhook event should contain the account ID
                const connectedAccountId = event.account;
                
                if (!connectedAccountId) {
                  console.error('No connected account ID found in webhook event');
                  console.log('Webhook event structure:', JSON.stringify(event, null, 2));
                  console.log('This webhook may not be configured for connected accounts');
                  continue;
                }
                
                console.log(`Processing for connected account: ${connectedAccountId}`);
                
                try {
                  // Get current product from the connected account with expanded data
                  const product = await stripe.products.retrieve(productId, {
                    expand: ['default_price', 'tax_code']
                  }, {
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
            console.log('No line items found in webhook event');
            console.log('Available session data:', JSON.stringify(session, null, 2));
          }
        } else {
          console.log('Non-payment session, skipping inventory update');
        }
        break;

      case 'payment_link.created':
      case 'payment_link.updated':
        console.log(`Processing ${event.type}:`, event.data.object.id);
        
        // Handle payment link events
        const paymentLink = event.data.object;
        const paymentLinkAccountId = event.account;
        
        if (!paymentLinkAccountId) {
          console.error(`No connected account ID found in ${event.type} webhook`);
          break;
        }
        
        console.log(`Processing payment link for connected account: ${paymentLinkAccountId}`);
        
        // Use the dedicated line items endpoint for payment links
        // Based on: https://docs.stripe.com/api/payment-link/retrieve-line-items?api-version=2025-07-30.basil
        try {
          const lineItemsResponse = await stripe.paymentLinks.listLineItems(paymentLink.id, {
            limit: 100 // Get all line items
          });
          
          if (lineItemsResponse.data && lineItemsResponse.data.length > 0) {
            console.log(`Found ${lineItemsResponse.data.length} line items in payment link`);
            
            for (const item of lineItemsResponse.data) {
              if (item.price?.product) {
                const productId = typeof item.price.product === 'string' 
                  ? item.price.product 
                  : item.price.product.id;
                
                const quantity = item.quantity || 1;
                
                console.log(`Processing payment link product ${productId}, quantity: ${quantity}`);
                
                try {
                  // Get current product from the connected account with expanded data
                  const product = await stripe.products.retrieve(productId, {
                    expand: ['default_price', 'tax_code']
                  }, {
                    stripeAccount: paymentLinkAccountId
                  });
                  
                  console.log(`Retrieved product ${productId} from account ${paymentLinkAccountId}`);
                  
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
                    'payment_link',
                    `Payment link ${event.type} of ${quantity} units via ${paymentLink.id}`,
                    undefined, // No access token needed
                    paymentLinkAccountId // Use the connected account
                  );
                  
                  console.log(`Successfully updated inventory for product ${productId}`);
                  
                } catch (productError) {
                  console.error(`Error processing product ${productId}:`, productError);
                }
              }
            }
          } else {
            console.log('No line items found in payment link');
          }
        } catch (lineItemsError) {
          console.error('Error retrieving payment link line items:', lineItemsError);
        }
        break;

      case 'invoice.payment_succeeded':
        console.log('Processing invoice.payment_succeeded:', event.data.object.id);
        
        // This webhook includes complete line item details with quantities
        const invoice = event.data.object;
        const invoiceAccountId = event.account;
        
        if (!invoiceAccountId) {
          console.error('No connected account ID found in invoice webhook');
          break;
        }
        
        console.log(`Processing invoice for connected account: ${invoiceAccountId}`);
        
        if (invoice.lines?.data) {
          console.log(`Found ${invoice.lines.data.length} line items in invoice`);
          
          for (const line of invoice.lines.data) {
            if (line.price?.product) {
              const productId = typeof line.price.product === 'string' 
                ? line.price.product 
                : line.price.product.id;
              
              const quantity = line.quantity || 1;
              
              console.log(`Processing product ${productId}, quantity: ${quantity}`);
              
              try {
                // Get current product from the connected account with expanded data
                const product = await stripe.products.retrieve(productId, {
                  expand: ['default_price', 'tax_code']
                }, {
                  stripeAccount: invoiceAccountId
                });
                
                console.log(`Retrieved product ${productId} from account ${invoiceAccountId}`);
                
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
                  `Purchase of ${quantity} units via invoice ${invoice.id}`,
                  undefined, // No access token needed
                  invoiceAccountId // Use the connected account
                );
                
                console.log(`Successfully updated inventory for product ${productId}`);
                
              } catch (productError) {
                console.error(`Error processing product ${productId}:`, productError);
              }
            }
          }
        }
        break;

      case 'payment_intent.succeeded':
        console.log('Processing payment_intent.succeeded:', event.data.object.id);
        
        // This webhook can also provide line item details
        const paymentIntent = event.data.object;
        const paymentAccountId = event.account;
        
        if (!paymentAccountId) {
          console.error('No connected account ID found in payment intent webhook');
          break;
        }
        
        console.log(`Processing payment intent for connected account: ${paymentAccountId}`);
        
        // Try to get line items from the payment intent
        if (paymentIntent.metadata?.checkout_session_id) {
          console.log('Payment intent has checkout session ID, but retrieving session data may fail due to account context');
          console.log('Checkout session ID:', paymentIntent.metadata.checkout_session_id);
          
          // Note: We're not trying to retrieve the session here because it often fails
          // due to account context issues. Instead, we'll rely on the webhook event data.
          console.log('Skipping session retrieval to avoid account context errors');
          console.log('Payment intent data available:', JSON.stringify(paymentIntent, null, 2));
        } else {
          console.log('No checkout session ID found in payment intent metadata');
          console.log('Payment intent data available:', JSON.stringify(paymentIntent, null, 2));
        }
        break;

      case 'charge.succeeded':
        console.log('Processing charge.succeeded:', event.data.object.id);
        
        // Handle direct charges (like one-time payments)
        const charge = event.data.object;
        const chargeAccountId = event.account;
        
        if (!chargeAccountId) {
          console.error('No connected account ID found in charge webhook');
          break;
        }
        
        console.log(`Processing charge for connected account: ${chargeAccountId}`);
        
        // Try to get line items from charge metadata or description
        if (charge.metadata?.product_id) {
          const productId = charge.metadata.product_id;
          const quantity = parseInt(charge.metadata.quantity || '1');
          
          console.log(`Processing product ${productId}, quantity: ${quantity}`);
          
          try {
                // Get current product from the connected account with expanded data
                const product = await stripe.products.retrieve(productId, {
                  expand: ['default_price', 'tax_code']
                }, {
                  stripeAccount: chargeAccountId
                });
                
                console.log(`Retrieved product ${productId} from account ${chargeAccountId}`);
                
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
                  `Purchase of ${quantity} units via charge ${charge.id}`,
                  undefined, // No access token needed
                  chargeAccountId // Use the connected account
                );
                
                console.log(`Successfully updated inventory for product ${productId}`);
                
              } catch (productError) {
                console.error(`Error processing product ${productId}:`, productError);
              }
        } else {
          console.log('No product ID found in charge metadata');
        }
        break;

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        console.log(`Processing ${event.type}:`, event.data.object.id);
        
        // Handle subscription changes
        const subscription = event.data.object;
        const subscriptionAccountId = event.account;
        
        if (!subscriptionAccountId) {
          console.error(`No connected account ID found in ${event.type} webhook`);
          break;
        }
        
        console.log(`Processing subscription for connected account: ${subscriptionAccountId}`);
        
        // Get subscription items
        if (subscription.items?.data) {
          console.log(`Found ${subscription.items.data.length} subscription items`);
          
          for (const item of subscription.items.data) {
            if (item.price?.product) {
              const productId = typeof item.price.product === 'string' 
                ? item.price.product 
                : item.price.product.id;
              
              const quantity = item.quantity || 1;
              
              console.log(`Processing subscription product ${productId}, quantity: ${quantity}`);
              
              try {
                // Get current product from the connected account with expanded data
                const product = await stripe.products.retrieve(productId, {
                  expand: ['default_price', 'tax_code']
                }, {
                  stripeAccount: subscriptionAccountId
                });
                
                console.log(`Retrieved product ${productId} from account ${subscriptionAccountId}`);
                
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
                  'subscription',
                  `Subscription of ${quantity} units via ${event.type} ${subscription.id}`,
                  undefined, // No access token needed
                  subscriptionAccountId // Use the connected account
                );
                
                console.log(`Successfully updated inventory for product ${productId}`);
                
              } catch (productError) {
                console.error(`Error processing product ${productId}:`, productError);
              }
            }
          }
        }
        break;

      case 'customer.subscription.deleted':
        console.log('Processing customer.subscription.deleted:', event.data.object.id);
        // Don't update inventory for deleted subscriptions - they were already counted
        break;

      // Note: Stripe doesn't have order endpoints in current API
      // Orders are typically handled through invoices or checkout sessions

      case 'payment_intent.payment_failed':
        console.log('Processing payment_intent.payment_failed:', event.data.object.id);
        // Don't update inventory for failed payments
        break;

      case 'invoice.payment_failed':
        console.log('Processing invoice.payment_failed:', event.data.object.id);
        // Don't update inventory for failed payments
        break;

      case 'charge.failed':
        console.log('Processing charge.failed:', event.data.object.id);
        // Don't update inventory for failed payments
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
        console.log('Event data structure:', JSON.stringify(event.data.object, null, 2));
    }

    return { success: true, message: 'Event processed successfully' };
  } catch (error) {
    console.error('Webhook handler error:', error);
    throw error;
  }
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const testSessionId = url.searchParams.get('test_session');
  
  if (testSessionId) {
    console.log('🧪 Testing line items endpoint with session:', testSessionId);
    
    try {
      // Test the line items endpoint
      const lineItemsResponse = await stripe.checkout.sessions.listLineItems(testSessionId, {
        limit: 10
      });
      
      console.log('🧪 Line items test response:', {
        hasData: !!lineItemsResponse.data,
        dataLength: lineItemsResponse.data?.length || 0,
        responseKeys: Object.keys(lineItemsResponse),
        firstItem: lineItemsResponse.data?.[0] ? {
          id: lineItemsResponse.data[0].id,
          quantity: lineItemsResponse.data[0].quantity,
          price: lineItemsResponse.data[0].price,
          description: lineItemsResponse.data[0].description
        } : null
      });
      
      return NextResponse.json({ 
        message: 'Line items test completed',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
        testMode: 'Line items endpoint test',
        result: {
          hasData: !!lineItemsResponse.data,
          dataLength: lineItemsResponse.data?.length || 0,
          firstItem: lineItemsResponse.data?.[0] || null
        }
      });
    } catch (error) {
      console.error('🧪 Line items test failed:', error);
      return NextResponse.json({ 
        error: 'Line items test failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }
  }
  
  return NextResponse.json({ 
    message: 'Webhook endpoint is working',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    testMode: 'Add ?test=true to trigger test webhook processing',
    lineItemsTest: 'Add ?test_session=cs_xxx to test line items endpoint'
  });
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get('stripe-signature');

  // Check if this is a test request
  const url = new URL(request.url);
  const isTest = url.searchParams.get('test') === 'true';
  
  if (isTest) {
    console.log('🧪 TEST MODE: Simulating webhook event');
    return await handleTestWebhook();
  }

  console.log('=== WEBHOOK RECEIVED ===');
  console.log('Headers:', Object.fromEntries(headersList.entries()));
  console.log('Body length:', body.length);
  console.log('Signature present:', !!signature);

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
    console.log('✅ Webhook signature verified successfully');
  } catch (error) {
    console.error('❌ Webhook signature verification failed:', error);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  console.log('=== WEBHOOK EVENT DETAILS ===');
  console.log('Event type:', event.type);
  console.log('Event ID:', event.id);
  console.log('Event account:', event.account);
  console.log('Event created:', new Date(event.created * 1000).toISOString());
  
  // Log the webhook event structure to help debug account context
  if (event.account) {
    console.log('✅ Webhook is for connected account:', event.account);
  } else {
    console.log('⚠️ Webhook is for main account (no connected account ID)');
  }
  
  console.log('Full webhook event structure:', JSON.stringify(event, null, 2));

  try {
    // Process the webhook event
    const result = await processWebhookEvent(event);
    return NextResponse.json({ received: true, result });
  } catch (error) {
    console.error('Webhook handler error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}
