import { NextRequest, NextResponse } from 'next/server';
import { STRIPE_CLIENT_ID } from '@/lib/stripe';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const state = searchParams.get('state') || 'default';
  
  // Use the NEXTAUTH_URL environment variable which will be set to your Vercel domain
  const redirectUri = `${process.env.NEXTAUTH_URL}/api/stripe/callback`;
  
  // Generate OAuth URL with proper encoding
  const oauthUrl = new URL('https://connect.stripe.com/oauth/authorize');
  oauthUrl.searchParams.set('client_id', STRIPE_CLIENT_ID);
  oauthUrl.searchParams.set('response_type', 'code');
  oauthUrl.searchParams.set('scope', 'read_write');
  oauthUrl.searchParams.set('state', state);
  oauthUrl.searchParams.set('redirect_uri', redirectUri);

  return NextResponse.redirect(oauthUrl.toString());
}
