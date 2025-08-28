import { NextRequest, NextResponse } from 'next/server';
import { EtsyService } from '@/lib/services/etsy-service';
import { createServerSupabaseClient } from '@/lib/supabase/client';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const shopId = searchParams.get('shop_id');
    
    if (!code || !state || !shopId) {
      console.error('❌ Missing required OAuth parameters');
      return NextResponse.redirect(new URL('/dashboard?error=oauth_failed', request.url));
    }

    console.log('🔄 Processing Etsy OAuth callback:', { code, state, shopId });

    try {
      // Exchange authorization code for access token
      const tokenResponse = await fetch('https://api.etsy.com/v3/public/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: process.env.ETSY_CLIENT_ID!,
          redirect_uri: process.env.ETSY_REDIRECT_URI!,
          code,
          code_verifier: state, // Use state as code verifier for PKCE
        }),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error('❌ Failed to exchange Etsy authorization code:', errorText);
        return NextResponse.redirect(new URL('/dashboard?error=token_exchange_failed', request.url));
      }

      const tokenData = await tokenResponse.json();
      const { access_token, refresh_token } = tokenData;

      console.log('✅ Successfully obtained Etsy access token');

      // Get shop information
      const etsyService = new EtsyService(shopId, access_token, refresh_token);
      const shopInfo = await etsyService.getShopInfo();

      // Create or update customer record
      // For now, we'll create the Etsy customer without linking to a specific Stripe account
      // You can modify this later based on your authentication system
      const customerData = {
        etsy_shop_id: shopId,
        etsy_shop_name: shopInfo.shop_name || 'Unknown Shop',
        etsy_access_token: access_token,
        etsy_refresh_token: refresh_token,
        email: 'user@example.com', // You can update this based on your auth system
        company_name: shopInfo.shop_name || 'Unknown Company',
        subscription_status: 'active' as const,
        plan_name: 'Etsy Integration',
        plan_features: {
          max_products: 1000,
          max_inventory_updates: 10000,
          webhook_endpoints: 10,
          api_calls_per_month: 100000,
          support_level: 'basic' as const,
          platforms: ['stripe', 'etsy'] as ('stripe' | 'shopify' | 'etsy')[],
        },
        is_active: true,
      };

      const etsyCustomer = await etsyService.createOrUpdateCustomer(customerData);
      console.log('✅ Etsy customer created/updated:', etsyCustomer.id);

      // Set up webhooks
      const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/etsy/webhooks`;
      await etsyService.setupWebhooks(etsyCustomer.id, webhookUrl);
      console.log('✅ Etsy webhooks configured');

      // Initial sync of products and inventory
      console.log('🔄 Starting initial Etsy sync...');
      await etsyService.syncProducts(etsyCustomer.id);
      await etsyService.syncInventoryLevels(etsyCustomer.id);
      await etsyService.syncOrders(etsyCustomer.id);
      console.log('✅ Initial Etsy sync completed');

      // Redirect to dashboard with success message
      return NextResponse.redirect(new URL('/dashboard?success=etsy_connected', request.url));

    } catch (error) {
      console.error('❌ Error processing Etsy OAuth callback:', error);
      return NextResponse.redirect(new URL('/dashboard?error=oauth_processing_failed', request.url));
    }

  } catch (error) {
    console.error('❌ Error in Etsy OAuth callback:', error);
    return NextResponse.redirect(new URL('/dashboard?error=internal_error', request.url));
  }
}
