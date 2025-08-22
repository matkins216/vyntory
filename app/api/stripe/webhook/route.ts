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
        
        // Check if this is a payment session (not subscription)
        if (session.mode === 'payment') {
          console.log('Payment session detected, processing line items...');
          
          // Retrieve the session with expanded line_items to get product details
          let expandedSession = session;
          let canProcessSession = true;
          
          if (!session.line_items?.data) {
            console.log('No line items in session, retrieving expanded session...');
            try {
              // Check if this is a live or test session
              const isLiveSession = session.id.startsWith('cs_live_');
              console.log(`Session type: ${isLiveSession ? 'LIVE' : 'TEST'}`);
              
              expandedSession = await stripe.checkout.sessions.retrieve(
                session.id,
                {
                  expand: ['line_items.data.price.product']
                }
              );
              console.log('Retrieved expanded session with line items');
            } catch (retrieveError) {
              console.error('Error retrieving expanded session:', retrieveError);
              
              // Don't use test data for live sessions
              if (session.id.startsWith('cs_live_')) {
                console.error('Cannot retrieve live session, skipping inventory update');
                console.error('This usually means:');
                console.error('1. The session belongs to a different Stripe account');
                console.error('2. The webhook is not configured for the correct account');
                console.error('3. The session has expired or been deleted');
                console.error('4. Missing permissions to access the session');
                canProcessSession = false;
              } else {
                // Only use mock data for test sessions
                console.log('Using mock data for test session');
                expandedSession = {
                  line_items: {
                    data: [
                      {
                        price: {
                          product: process.env.TEST_PRODUCT_ID || 'prod_test'
                        },
                        quantity: 1
                      }
                    ]
                  }
                };
              }
            }
          }
          
          if (canProcessSession && expandedSession.line_items?.data) {
            console.log(`Found ${expandedSession.line_items.data.length} line items`);
            
            for (const item of expandedSession.line_items.data) {
              if (item.price?.product) {
                const productId = typeof item.price.product === 'string' 
                  ? item.price.product 
                  : item.price.product.id;
                
                const quantity = item.quantity || 1;
                
                console.log(`Processing product ${productId}, quantity: ${quantity}`);
                
                // For connected accounts, the webhook event should contain the account ID
                // This is the most reliable way to get the connected account
                let connectedAccountId = event.account;
                
                if (!connectedAccountId) {
                  console.log('No account ID in webhook event, trying to extract from session data...');
                  
                  // Try to get account ID from the checkout session
                  try {
                    // Get the full session details to find the connected account
                    const fullSession = await stripe.checkout.sessions.retrieve(session.id);
                    
                    // Check if this is a connected account session
                    if (fullSession.payment_intent) {
                      // Get the payment intent to find the connected account
                      const paymentIntent = await stripe.paymentIntents.retrieve(
                        fullSession.payment_intent as string
                      );
                      
                      if (paymentIntent.transfer_data?.destination) {
                        connectedAccountId = typeof paymentIntent.transfer_data.destination === 'string' 
                          ? paymentIntent.transfer_data.destination 
                          : paymentIntent.transfer_data.destination.id;
                        console.log(`Found connected account from payment intent: ${connectedAccountId}`);
                      }
                    }
                    
                    // If still no account ID, try to get it from the first product
                    if (!connectedAccountId && expandedSession.line_items?.data?.[0]?.price?.product) {
                      const firstProductId = typeof expandedSession.line_items.data[0].price.product === 'string' 
                        ? expandedSession.line_items.data[0].price.product 
                        : expandedSession.line_items.data[0].price.product.id;
                      
                      console.log(`Trying to determine account from first product: ${firstProductId}`);
                      
                      // Try to find which account this product belongs to
                      // We'll check a few common patterns
                      const possibleAccounts = [
                        // Check if we have any stored account mappings
                        process.env.DEFAULT_CONNECTED_ACCOUNT_ID,
                        // Add any other known account IDs here
                      ].filter(Boolean);
                      
                      for (const accountId of possibleAccounts) {
                        try {
                          const product = await stripe.products.retrieve(firstProductId, {
                            stripeAccount: accountId
                          });
                          if (product) {
                            connectedAccountId = accountId;
                            console.log(`Found connected account from product lookup: ${connectedAccountId}`);
                            break;
                          }
                        } catch {
                          // Product not found in this account, try next
                          continue;
                        }
                      }
                    }
                    
                  } catch (sessionError) {
                    console.error('Error retrieving session details:', sessionError);
                  }
                }
                
                if (!connectedAccountId) {
                  console.error('Could not determine connected account ID from any source');
                  console.log('Session ID:', session.id);
                  console.log('Webhook event structure:', JSON.stringify(event, null, 2));
                  continue;
                }
                
                console.log(`Processing for connected account: ${connectedAccountId}`);
                
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
                // Get current product from the connected account
                const product = await stripe.products.retrieve(productId, {
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
          try {
            const session = await stripe.checkout.sessions.retrieve(
              paymentIntent.metadata.checkout_session_id,
              {
                expand: ['line_items.data.price.product']
              }
            );
            
            if (session.line_items?.data) {
              console.log(`Found ${session.line_items.data.length} line items from session`);
              
              for (const item of session.line_items.data) {
                if (item.price?.product) {
                  const productId = typeof item.price.product === 'string' 
                    ? item.price.product 
                    : item.price.product.id;
                  
                  const quantity = item.quantity || 1;
                  
                  console.log(`Processing product ${productId}, quantity: ${quantity}`);
                  
                  try {
                    // Get current product from the connected account
                    const product = await stripe.products.retrieve(productId, {
                      stripeAccount: paymentAccountId
                    });
                    
                    console.log(`Retrieved product ${productId} from account ${paymentAccountId}`);
                    
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
                      `Purchase of ${quantity} units via payment intent ${paymentIntent.id}`,
                      undefined, // No access token needed
                      paymentAccountId // Use the connected account
                    );
                    
                    console.log(`Successfully updated inventory for product ${productId}`);
                    
                  } catch (productError) {
                    console.error(`Error processing product ${productId}:`, productError);
                  }
                }
              }
            }
          } catch (sessionError) {
            console.error('Error retrieving session from payment intent:', sessionError);
          }
        } else {
          console.log('No checkout session ID found in payment intent metadata');
        }
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return { success: true, message: 'Event processed successfully' };
  } catch (error) {
    console.error('Webhook handler error:', error);
    throw error;
  }
}

export async function GET() {
  return NextResponse.json({ 
    message: 'Webhook endpoint is working',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    testMode: 'Add ?test=true to trigger test webhook processing'
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
