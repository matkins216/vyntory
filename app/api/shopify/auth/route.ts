import { NextRequest, NextResponse } from 'next/server';

const SHOPIFY_CLIENT_ID = process.env.SHOPIFY_CLIENT_ID!;
const SHOPIFY_SCOPES = 'read_products,write_products,read_inventory,write_inventory,read_orders,write_orders';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const shop = searchParams.get('shop');
    
    if (!shop) {
      return NextResponse.json({ error: 'Shop parameter is required' }, { status: 400 });
    }

    // Validate shop domain
    if (!shop.match(/^[a-z0-9][a-z0-9-]*[a-z0-9]\.myshopify\.com$/)) {
      return NextResponse.json({ error: 'Invalid shop domain' }, { status: 400 });
    }

    // Generate state parameter for security
    const generatedState = Math.random().toString(36).substring(7);
    
    // Store state in session/cookie for validation
    const response = NextResponse.redirect(
      `https://${shop}/admin/oauth/authorize?client_id=${SHOPIFY_CLIENT_ID}&scope=${SHOPIFY_SCOPES}&redirect_uri=${encodeURIComponent(process.env.SHOPIFY_REDIRECT_URI!)}&state=${generatedState}`
    );

    // Set state in cookie for validation
    response.cookies.set('shopify_oauth_state', generatedState, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 10 // 10 minutes
    });

    return response;
    
  } catch (error) {
    console.error('❌ Error in Shopify auth:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
