import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/?error=${encodeURIComponent(error)}`
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/?error=no_code`
    );
  }

  try {
    // Exchange authorization code for access token
    const response = await stripe.oauth.token({
      grant_type: 'authorization_code',
      code,
    });

    // Store the connected account ID and access token
    // In a real app, you'd store this in a database
    const connectedAccountId = response.stripe_user_id;
    // const accessToken = response.access_token; // Will be used for future API calls

    // Redirect to dashboard with success
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/dashboard?account=${connectedAccountId}`
    );
  } catch (error) {
    console.error('Stripe OAuth error:', error);
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/?error=oauth_failed`
    );
  }
}
