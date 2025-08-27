import { NextRequest, NextResponse } from 'next/server';
import { stripe, getInventoryFromMetadata } from '@/lib/stripe';
import { checkPayGateAuthorization } from '@/lib/middleware/pay-gate';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('account');
    
    if (!accountId) {
      return NextResponse.json({ error: 'Account ID required' }, { status: 400 });
    }

    // Check pay gate authorization
    const authResult = await checkPayGateAuthorization(accountId);
    if (!authResult.isAuthorized) {
      return NextResponse.json(
        { error: 'Subscription required', reason: authResult.reason },
        { status: 403 }
      );
    }

    // Fetch products from the connected account
    const products = await stripe.products.list({
      limit: 100,
      active: true,
    }, {
      stripeAccount: accountId,
    });

    // Fetch prices for each product
    const productsWithPrices = await Promise.all(
      products.data.map(async (product) => {
        const prices = await stripe.prices.list({
          product: product.id,
          active: true,
        }, {
          stripeAccount: accountId,
        });

        const inventory = getInventoryFromMetadata(product.metadata);
        
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

    return NextResponse.json({ products: productsWithPrices });
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    );
  }
}
