import { NextRequest, NextResponse } from 'next/server';
import { stripe, getInventoryFromMetadata } from '@/lib/stripe';
import { ShopifyService } from '@/lib/services/shopify-service';
import { createServerSupabaseClient } from '@/lib/supabase/client';
import { checkPayGateAuthorization } from '@/lib/middleware/pay-gate';

export async function GET(request: NextRequest) {
  try {
    console.log('=== UNIFIED PRODUCTS API CALLED ===');
    console.log('Request URL:', request.url);
    console.log('Request method:', request.method);
    
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('account');
    const shopDomain = searchParams.get('shop');
    const platform = searchParams.get('platform') || 'stripe';
    
    console.log('🔍 Parameters:', { accountId, shopDomain, platform });
    
    if (!accountId && !shopDomain) {
      console.log('❌ No account ID or shop domain provided');
      return NextResponse.json({ error: 'Account ID or shop domain required' }, { status: 400 });
    }

    // Check authorization based on platform
    let authResult;
    if (platform === 'shopify' && shopDomain) {
      // For Shopify, check if the shop is authorized
      const supabase = createServerSupabaseClient();
      const { data: shopifyCustomer, error } = await supabase
        .from('shopify_customers')
        .select('*')
        .eq('shopify_shop_domain', shopDomain)
        .eq('is_active', true)
        .single();

      if (error || !shopifyCustomer) {
        console.log('❌ Shopify customer not found or not active');
        return NextResponse.json({ error: 'Shopify account not authorized' }, { status: 403 });
      }

      authResult = { isAuthorized: true, customer: shopifyCustomer };
    } else if (accountId) {
      // For Stripe, use existing authorization
      authResult = await checkPayGateAuthorization(accountId);
    } else {
      console.log('❌ Invalid platform or missing parameters');
      return NextResponse.json({ error: 'Invalid platform configuration' }, { status: 400 });
    }

    if (!authResult.isAuthorized) {
      console.log('❌ Authorization failed:', authResult.reason);
      return NextResponse.json(
        { error: 'Authorization failed', reason: authResult.reason },
        { status: 403 }
      );
    }

    console.log('✅ Authorization successful, fetching products...');
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let products: any[] = [];
    
    if (platform === 'shopify' && shopDomain) {
      // Fetch Shopify products
      console.log('🛍️ Fetching Shopify products...');
      const shopifyService = new ShopifyService(shopDomain, authResult.customer.shopify_access_token);
      const supabase = createServerSupabaseClient();
      
      try {
        // Sync products first to ensure we have the latest data
        await shopifyService.syncProducts(authResult.customer.id);
        
        // Get products from database
        const { data: shopifyProducts, error } = await supabase
          .from('shopify_products')
          .select(`
            *,
            variants:shopify_variants(*),
            inventory_levels:shopify_inventory_levels(*)
          `)
          .eq('shopify_customer_id', authResult.customer.id)
          .eq('status', 'active');

        if (error) {
          console.error('❌ Error fetching Shopify products:', error);
          throw error;
        }

        // Transform Shopify products to match Stripe format
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        products = shopifyProducts.map((product: any) => ({
          id: product.shopify_product_id,
          name: product.name,
          description: product.description,
          images: [], // Shopify products don't have images in this format
          active: product.status === 'active',
          metadata: {
            product_type: product.product_type,
            vendor: product.vendor,
            tags: product.tags,
            handle: product.handle
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          inventory: product.variants?.reduce((total: number, variant: any) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const inventoryLevel = product.inventory_levels?.find((level: any) => 
              level.shopify_variant_id === variant.shopify_variant_id
            );
            return total + (inventoryLevel?.available || 0);
          }, 0) || 0,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          prices: product.variants?.map((variant: any) => ({
            id: variant.shopify_variant_id,
            currency: 'USD', // Default currency
            unit_amount: Math.round(parseFloat(variant.price) * 100), // Convert to cents
            recurring: null,
            variant_title: variant.title,
            sku: variant.sku,
            inventory_quantity: variant.inventory_quantity
          })) || [],
          created: product.created_at,
          platform: 'shopify'
        }));

        console.log(`📦 Found ${products.length} Shopify products`);
        
      } catch (error) {
        console.error('❌ Error processing Shopify products:', error);
        throw error;
      }
      
    } else if (platform === 'stripe' && accountId) {
      // Fetch Stripe products
      console.log('💳 Fetching Stripe products...');
      
      const stripeProducts = await stripe.products.list({
        limit: 100,
        active: true,
      }, {
        stripeAccount: accountId,
      });

      console.log(`📦 Found ${stripeProducts.data.length} Stripe products`);

      // Fetch prices for each product
      products = await Promise.all(
        stripeProducts.data.map(async (product) => {
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
            platform: 'stripe'
          };
        })
      );
    }

    console.log(`✅ Successfully processed ${products.length} products from ${platform}`);
    console.log('=== END UNIFIED PRODUCTS API ===');

    return NextResponse.json({ 
      products,
      platform,
      total: products.length
    });

  } catch (error) {
    console.error('❌ Error in unified products API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, platform, accountId, shopDomain, productData } = body;
    
    console.log('=== UNIFIED PRODUCTS API - POST ===');
    console.log('Action:', action, 'Platform:', platform);
    
    if (!action || !platform) {
      return NextResponse.json({ error: 'Action and platform required' }, { status: 400 });
    }

    if (platform === 'shopify' && shopDomain) {
      // Handle Shopify product operations
      const supabase = createServerSupabaseClient();
      const { data: shopifyCustomer, error } = await supabase
        .from('shopify_customers')
        .select('*')
        .eq('shopify_shop_domain', shopDomain)
        .eq('is_active', true)
        .single();

      if (error || !shopifyCustomer) {
        return NextResponse.json({ error: 'Shopify account not authorized' }, { status: 403 });
      }

      const shopifyService = new ShopifyService(shopDomain, shopifyCustomer.shopify_access_token);
      
      switch (action) {
        case 'sync':
          await shopifyService.syncProducts(shopifyCustomer.id);
          await shopifyService.syncInventoryLevels(shopifyCustomer.id);
          return NextResponse.json({ success: true, message: 'Products synced successfully' });
          
        case 'update_inventory':
          const { variantId, locationId, quantity } = productData;
          await shopifyService.updateInventoryLevel(variantId, locationId, quantity);
          return NextResponse.json({ success: true, message: 'Inventory updated successfully' });
          
        default:
          return NextResponse.json({ error: 'Invalid action for Shopify' }, { status: 400 });
      }
      
    } else if (platform === 'stripe' && accountId) {
      // Handle Stripe product operations
      // Add Stripe-specific product operations here
      return NextResponse.json({ error: 'Stripe product operations not implemented yet' }, { status: 501 });
      
    } else {
      return NextResponse.json({ error: 'Invalid platform or missing parameters' }, { status: 400 });
    }

  } catch (error) {
    console.error('❌ Error in unified products POST:', error);
    return NextResponse.json(
      { error: 'Operation failed' },
      { status: 500 }
    );
  }
}
