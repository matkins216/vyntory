import { NextRequest, NextResponse } from 'next/server';
import { stripe, getInventoryFromMetadata } from '@/lib/stripe';
import { checkPayGateAuthorization } from '@/lib/middleware/pay-gate';

export async function GET(request: NextRequest) {
  try {
    console.log('=== PRODUCTS API CALLED ===');
    console.log('Request URL:', request.url);
    console.log('Request method:', request.method);
    console.log('Request headers:', Object.fromEntries(request.headers.entries()));
    
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('account');
    
    console.log('🔍 Extracted account ID from query params:', accountId);
    console.log('All query params:', Object.fromEntries(searchParams.entries()));
    
    if (!accountId) {
      console.log('❌ No account ID provided, returning 400 error');
      return NextResponse.json({ error: 'Account ID required' }, { status: 400 });
    }

    console.log('🔐 Starting pay gate authorization check...');
    // Check pay gate authorization
    const authResult = await checkPayGateAuthorization(accountId);
    console.log('🔐 Pay gate authorization result:', {
      isAuthorized: authResult.isAuthorized,
      reason: authResult.reason,
      customerId: authResult.customer?.id,
      customerEmail: authResult.customer?.email,
      subscriptionStatus: authResult.customer?.subscription_status
    });
    
    if (!authResult.isAuthorized) {
      console.log('❌ Authorization failed, returning 403 error');
      return NextResponse.json(
        { error: 'Subscription required', reason: authResult.reason },
        { status: 403 }
      );
    }

    console.log('✅ Authorization successful, proceeding to fetch products...');
    console.log('🔍 Fetching products from Stripe for account:', accountId);
    
    // Fetch products from the connected account
    const products = await stripe.products.list({
      limit: 100,
      active: true,
    }, {
      stripeAccount: accountId,
    });

    console.log(`📦 Found ${products.data.length} products from Stripe`);

    // Fetch prices for each product
    const productsWithPrices = await Promise.all(
      products.data.map(async (product) => {
        console.log(`🔍 Fetching prices for product: ${product.id} (${product.name})`);
        
        const prices = await stripe.prices.list({
          product: product.id,
          active: true,
        }, {
          stripeAccount: accountId,
        });

        const inventory = getInventoryFromMetadata(product.metadata);
        
        console.log(`💰 Found ${prices.data.length} prices for product ${product.id}`);
        
        return {
          id: product.id,
          name: product.name,
          description: product.description,
          images: product.images,
          active: product.active,
          metadata: product.metadata,
          inventory,
          prices: prices.data.map(price => ({
            id: price.id,
            currency: price.currency,
            unit_amount: price.unit_amount,
            recurring: price.recurring,
          })),
          created: product.created,
        };
      })
    );

    console.log(`✅ Successfully processed ${productsWithPrices.length} products with prices`);
    console.log('=== END PRODUCTS API ===');

    return NextResponse.json({ products: productsWithPrices });
  } catch (error) {
    console.error('❌ Error in products API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    );
  }
}
