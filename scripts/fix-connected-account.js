// Script to fix connected account by creating a customer record
// Run this with: node scripts/fix-connected-account.js

const { createClient } = require('@supabase/supabase-js');
const Stripe = require('stripe');

// Replace with your actual values
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

// The connected account ID that's failing
const CONNECTED_ACCOUNT_ID = 'acct_1OfnixIVNNXZfeTW';

async function fixConnectedAccount() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !STRIPE_SECRET_KEY) {
    console.error('❌ Missing environment variables');
    console.log('Make sure NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and STRIPE_SECRET_KEY are set');
    return;
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const stripe = Stripe(STRIPE_SECRET_KEY);

  console.log('🔧 Starting to fix connected account:', CONNECTED_ACCOUNT_ID);

  try {
    // Step 1: Get the connected account details
    console.log('🔍 Retrieving connected account details...');
    const connectedAccount = await stripe.accounts.retrieve(CONNECTED_ACCOUNT_ID);
    
    console.log('✅ Connected account details:', {
      id: connectedAccount.id,
      email: connectedAccount.email,
      business_type: connectedAccount.business_type,
      country: connectedAccount.country
    });

    if (!connectedAccount.email) {
      console.error('❌ No email found in connected account');
      return;
    }

    // Step 2: Check if this email has a subscription in your main account
    console.log('🔍 Looking for customers with email:', connectedAccount.email);
    const { data: existingCustomers, error } = await supabase
      .from('connect_customers')
      .select('*')
      .eq('email', connectedAccount.email)
      .eq('is_active', true)
      .in('subscription_status', ['active', 'trialing'])
      .limit(1);

    if (error) {
      console.error('❌ Database error:', error);
      return;
    }

    if (existingCustomers && existingCustomers.length > 0) {
      console.log('✅ Found existing customer with subscription:', existingCustomers[0]);
      
      // Step 3: Create a new customer record for the connected account
      const newCustomerData = {
        stripe_account_id: CONNECTED_ACCOUNT_ID,
        stripe_customer_id: CONNECTED_ACCOUNT_ID, // Use account ID as customer ID for connected accounts
        email: connectedAccount.email,
        company_name: connectedAccount.business_profile?.name || 'Connected Account',
        subscription_status: 'active',
        subscription_id: existingCustomers[0].subscription_id,
        plan_name: existingCustomers[0].plan_name,
        plan_features: existingCustomers[0].plan_features,
        current_period_start: existingCustomers[0].current_period_start,
        current_period_end: existingCustomers[0].current_period_end,
        trial_end: existingCustomers[0].trial_end,
        is_active: true
      };

      console.log('📝 Creating new customer record for connected account...');
      const { data: newCustomer, error: createError } = await supabase
        .from('connect_customers')
        .upsert(newCustomerData, {
          onConflict: 'stripe_account_id',
          ignoreDuplicates: false
        })
        .select()
        .single();

      if (createError) {
        console.error('❌ Error creating customer record:', createError);
        return;
      }

      console.log('✅ Successfully created customer record:', newCustomer);
    } else {
      console.log('❌ No existing subscription found for email:', connectedAccount.email);
      
      // Step 4: Create a basic customer record (you might want to handle this differently)
      console.log('🔧 Creating basic customer record...');
      const basicCustomerData = {
        stripe_account_id: CONNECTED_ACCOUNT_ID,
        stripe_customer_id: CONNECTED_ACCOUNT_ID,
        email: connectedAccount.email,
        company_name: connectedAccount.business_profile?.name || 'Connected Account',
        subscription_status: 'active', // You might want to change this
        plan_name: 'Connected Account Plan',
        plan_features: {
          max_products: 100,
          max_inventory_updates: 1000,
          webhook_endpoints: 5,
          api_calls_per_month: 10000,
          support_level: 'basic'
        },
        is_active: true
      };

      const { data: basicCustomer, error: basicError } = await supabase
        .from('connect_customers')
        .upsert(basicCustomerData, {
          onConflict: 'stripe_account_id',
          ignoreDuplicates: false
        })
        .select()
        .single();

      if (basicError) {
        console.error('❌ Error creating basic customer record:', basicError);
        return;
      }

      console.log('✅ Successfully created basic customer record:', basicCustomer);
    }

    // Step 5: Verify the fix
    console.log('\n🔍 Verifying the fix...');
    const { data: verifyCustomer, error: verifyError } = await supabase
      .from('connect_customers')
      .select('*')
      .eq('stripe_account_id', CONNECTED_ACCOUNT_ID)
      .single();

    if (verifyError) {
      console.error('❌ Error verifying customer:', verifyError);
    } else {
      console.log('✅ Verification successful:', verifyCustomer);
      console.log('🎉 Connected account should now work!');
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

fixConnectedAccount();
