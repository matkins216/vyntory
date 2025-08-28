import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export async function GET(request: NextRequest) {
  try {
    // Generate PKCE code verifier and challenge
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');

    // Store the code verifier in session or database for later use
    // For now, we'll pass it as state parameter (in production, use proper session management)
    
    // Construct Etsy OAuth URL
    const oauthUrl = new URL('https://www.etsy.com/oauth/connect');
    oauthUrl.searchParams.set('response_type', 'code');
    oauthUrl.searchParams.set('client_id', process.env.ETSY_CLIENT_ID!);
    oauthUrl.searchParams.set('redirect_uri', process.env.ETSY_REDIRECT_URI!);
    oauthUrl.searchParams.set('scope', 'listings_r listings_w transactions_r transactions_w shops_r');
    oauthUrl.searchParams.set('state', codeVerifier); // Use code verifier as state for PKCE
    oauthUrl.searchParams.set('code_challenge', codeChallenge);
    oauthUrl.searchParams.set('code_challenge_method', 'S256');

    console.log('🔄 Initiating Etsy OAuth flow');
    console.log('🔗 OAuth URL:', oauthUrl.toString());

    // Redirect directly to Etsy OAuth
    return NextResponse.redirect(oauthUrl.toString());

  } catch (error) {
    console.error('❌ Error initiating Etsy OAuth:', error);
    return NextResponse.json({ error: 'Failed to initiate OAuth' }, { status: 500 });
  }
}

// Keep POST method for API calls if needed
export async function POST(request: NextRequest) {
  try {
    const { shopId } = await request.json();
    
    if (!shopId) {
      return NextResponse.json({ error: 'Shop ID is required' }, { status: 400 });
    }

    // Generate PKCE code verifier and challenge
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');

    // Store the code verifier in session or database for later use
    // For now, we'll pass it as state parameter (in production, use proper session management)
    
    // Construct Etsy OAuth URL
    const oauthUrl = new URL('https://www.etsy.com/oauth/connect');
    oauthUrl.searchParams.set('response_type', 'code');
    oauthUrl.searchParams.set('client_id', process.env.ETSY_CLIENT_ID!);
    oauthUrl.searchParams.set('redirect_uri', process.env.ETSY_REDIRECT_URI!);
    oauthUrl.searchParams.set('scope', 'listings_r listings_w transactions_r transactions_w shops_r');
    oauthUrl.searchParams.set('state', codeVerifier); // Use code verifier as state for PKCE
    oauthUrl.searchParams.set('code_challenge', codeChallenge);
    oauthUrl.searchParams.set('code_challenge_method', 'S256');

    console.log('🔄 Initiating Etsy OAuth flow for shop:', shopId);
    console.log('🔗 OAuth URL:', oauthUrl.toString());

    return NextResponse.json({ 
      oauthUrl: oauthUrl.toString(),
      codeVerifier // In production, store this securely
    });

  } catch (error) {
    console.error('❌ Error initiating Etsy OAuth:', error);
    return NextResponse.json({ error: 'Failed to initiate OAuth' }, { status: 500 });
  }
}
