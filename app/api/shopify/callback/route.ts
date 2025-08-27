import { NextRequest, NextResponse } from 'next/server';
import { ShopifyService } from '@/lib/services/shopify-service';
import { ConnectCustomerService } from '@/lib/services/connect-customer';

const SHOPIFY_CLIENT_ID = process.env.SHOPIFY_CLIENT_ID!;
const SHOPIFY_CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET!;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const shop = searchParams.get('shop');
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    
    console.log('🔐 Shopify OAuth callback received:', { shop, code: !!code, state, error });

    if (error) {
      console.error('❌ Shopify OAuth error:', error);
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/?error=${encodeURIComponent(error)}`
      );
    }

    if (!shop || !code) {
      console.error('❌ Missing required parameters');
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/?error=missing_params`
      );
    }

    // Validate state parameter
    const storedState = request.cookies.get('shopify_oauth_state')?.value;
    if (state !== storedState) {
      console.error('❌ State parameter mismatch');
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/?error=invalid_state`
      );
    }

    try {
      // Exchange authorization code for access token
      console.log('🔄 Exchanging authorization code for access token...');
      
      const tokenResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: SHOPIFY_CLIENT_ID,
          client_secret: SHOPIFY_CLIENT_SECRET,
          code,
        }),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error('❌ Token exchange failed:', errorText);
        throw new Error(`Token exchange failed: ${tokenResponse.status}`);
      }

      const tokenData = await tokenResponse.json();
      const accessToken = tokenData.access_token;
      const shopId = tokenData.shop_id;

      console.log('✅ Access token received for shop:', shop);

      // Get shop information
      const shopifyService = new ShopifyService(shop, accessToken);
      const shopInfo = await shopifyService.getShopInfo();
      
      console.log('🏪 Shop info retrieved:', {
        name: shopInfo.name,
        email: shopInfo.email,
        domain: shopInfo.domain
      });

      // Check if this shop is already connected to a Stripe customer
      const connectService = new ConnectCustomerService();
      let stripeCustomer = null;
      
      if (shopInfo.email) {
        try {
          // Look for existing Stripe customer with this email
          const { data: customers, error } = await connectService.supabase
            .from('connect_customers')
            .select('*')
            .eq('email', shopInfo.email)
            .eq('is_active', true)
            .in('subscription_status', ['active', 'trialing'])
            .limit(1);

          if (!error && customers && customers.length > 0) {
            stripeCustomer = customers[0];
            console.log('✅ Found existing Stripe customer:', stripeCustomer.email);
          }
        } catch (error) {
          console.log('⚠️ Error looking for Stripe customer:', error);
        }
      }

      // Create or update Shopify customer record
      const customerData = {
        shopify_shop_domain: shop,
        shopify_access_token: accessToken,
        shopify_shop_id: shopId.toString(),
        email: shopInfo.email || shopInfo.domain,
        company_name: shopInfo.name || 'Shopify Store',
        subscription_status: stripeCustomer ? stripeCustomer.subscription_status : 'inactive',
        subscription_id: stripeCustomer?.subscription_id,
        plan_name: stripeCustomer ? stripeCustomer.plan_name : 'Shopify Integration',
        plan_features: stripeCustomer ? stripeCustomer.plan_features : {
          max_products: 100,
          max_inventory_updates: 1000,
          webhook_endpoints: 5,
          api_calls_per_month: 10000,
          support_level: 'basic',
          platforms: ['shopify']
        },
        is_active: true
      };

      console.log('💾 Creating/updating Shopify customer record...');
      const shopifyCustomer = await shopifyService.createOrUpdateCustomer(customerData);
      
      console.log('✅ Shopify customer record created:', shopifyCustomer.id);

      // Set up webhooks
      console.log('🔗 Setting up Shopify webhooks...');
      await shopifyService.setupWebhooks(shopifyCustomer.id, shop);

      // Initial product and inventory sync
      console.log('🔄 Starting initial product sync...');
      await shopifyService.syncProducts(shopifyCustomer.id);
      
      console.log('🔄 Starting initial inventory sync...');
      await shopifyService.syncInventoryLevels(shopifyCustomer.id);

      console.log('✅ Shopify integration completed successfully');
      
      // Clear the OAuth state cookie
      const response = NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/dashboard?shop=${shop}&platform=shopify`
      );
      
      response.cookies.delete('shopify_oauth_state');
      return response;

    } catch (error) {
      console.error('❌ Error during Shopify integration:', error);
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/?error=integration_failed`
      );
    }

  } catch (error) {
    console.error('❌ Error in Shopify callback:', error);
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/?error=callback_failed`
    );
  }
}
