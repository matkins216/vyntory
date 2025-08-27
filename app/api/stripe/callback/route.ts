import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { ConnectCustomerService } from '@/lib/services/connect-customer';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
    console.error('❌ Stripe Connect error:', error);
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/?error=${encodeURIComponent(error)}`
    );
  }

  if (!code) {
    console.error('❌ No authorization code received');
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/?error=no_code`
    );
  }

  try {
    console.log('🔐 Processing Stripe Connect authorization code...');
    
    // Exchange authorization code for access token
    const response = await stripe.oauth.token({
      grant_type: 'authorization_code',
      code,
    });

    console.log('✅ OAuth token exchange successful');
    
    // Store the connected account ID and access token
    const connectedAccountId = response.stripe_user_id;
    console.log('🔍 Connected account ID:', connectedAccountId);
    
    if (!connectedAccountId) {
      console.error('❌ No connected account ID received from Stripe');
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/?error=no_account_id`
      );
    }
    
    // const accessToken = response.access_token; // Will be used for future API calls

    try {
      // Get the connected account details to find the owner's email
      console.log('🔍 Retrieving connected account details...');
      const connectedAccount = await stripe.accounts.retrieve(connectedAccountId);
      
      console.log('✅ Connected account details:', {
        id: connectedAccount.id,
        email: connectedAccount.email,
        business_type: connectedAccount.business_type,
        business_profile: connectedAccount.business_profile
      });

      if (connectedAccount.email) {
        console.log('🔍 Owner email found:', connectedAccount.email);
        
        // Create or get customer record for this connected account
        const connectService = new ConnectCustomerService();
        
        try {
          console.log('🔧 Creating/getting customer record for connected account...');
          const customer = await connectService.getOrCreateMainAccountCustomer(connectedAccount.email);
          
          console.log('✅ Customer record created/retrieved:', {
            id: customer.id,
            email: customer.email,
            subscription_status: customer.subscription_status
          });
          
          // Now create a record specifically for this connected account
          console.log('🔧 Creating connected account customer record...');
          const connectedAccountCustomer = await connectService.createOrUpdateCustomer({
            stripe_account_id: connectedAccountId,
            stripe_customer_id: connectedAccountId,
            email: connectedAccount.email,
            company_name: connectedAccount.business_profile?.name || 'Connected Account',
            subscription_status: customer.subscription_status,
            subscription_id: customer.subscription_id,
            plan_name: customer.plan_name,
            plan_features: customer.plan_features,
            current_period_start: customer.current_period_start,
            current_period_end: customer.current_period_end,
            trial_end: customer.trial_end,
            is_active: customer.is_active
          });
          
          console.log('✅ Connected account customer record created:', {
            id: connectedAccountCustomer.id,
            stripe_account_id: connectedAccountCustomer.stripe_account_id,
            subscription_status: connectedAccountCustomer.subscription_status
          });
          
        } catch (customerError) {
          console.error('❌ Error creating customer record:', customerError);
          // Continue with redirect even if customer creation fails
        }
      } else {
        console.log('⚠️ No email found in connected account');
      }
      
    } catch (accountError) {
      console.error('❌ Error retrieving connected account details:', accountError);
      // Continue with redirect even if account retrieval fails
    }

    console.log('🔄 Redirecting to dashboard with account ID...');
    // Redirect to dashboard with success
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/dashboard?account=${connectedAccountId}`
    );
  } catch (error) {
    console.error('❌ Stripe OAuth error:', error);
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/?error=oauth_failed`
    );
  }
}
