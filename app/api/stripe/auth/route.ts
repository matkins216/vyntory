import { NextRequest, NextResponse } from 'next/server';
import { STRIPE_CLIENT_ID } from '@/lib/stripe';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const state = searchParams.get('state') || 'default';
  
  // For development, you'll need to use a proper HTTPS domain
  // Options:
  // 1. Use ngrok (https://ngrok.com/) to create a public HTTPS tunnel
  // 2. Use a service like Vercel for development
  // 3. Use Stripe's test mode with a different approach
  
  // For now, let's use a placeholder that you can update
  const redirectUri = process.env.NODE_ENV === 'production' 
    ? `${process.env.NEXTAUTH_URL}/api/stripe/callback`
    : 'https://your-ngrok-url.ngrok.io/api/stripe/callback'; // Replace with your ngrok URL
  
  // Generate OAuth URL with proper encoding
  const oauthUrl = new URL('https://connect.stripe.com/oauth/authorize');
  oauthUrl.searchParams.set('client_id', STRIPE_CLIENT_ID);
  oauthUrl.searchParams.set('response_type', 'code');
  oauthUrl.searchParams.set('scope', 'read_write');
  oauthUrl.searchParams.set('state', state);
  oauthUrl.searchParams.set('redirect_uri', redirectUri);

  return NextResponse.redirect(oauthUrl.toString());
}
