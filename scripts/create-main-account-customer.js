// Script to create a main account customer record
// Run this with: node scripts/create-main-account-customer.js

const { createClient } = require('@supabase/supabase-js');

// Replace with your actual values
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Your main Stripe account details
const MAIN_ACCOUNT_DATA = {
  stripe_account_id: 'acct_your_main_account_id', // Replace with your main Stripe account ID
  email: 'matt.atkins@0/mo', // Your email
  company_name: 'Your Company Name',
  subscription_status: 'active',
  plan_name: 'Free Plan',
  plan_features: {
    max_products: 100,
    max_inventory_updates: 1000,
    webhook_endpoints: 5,
    api_calls_per_month: 10000,
    support_level: 'basic'
  },
  is_active: true
};

async function createMainAccountCustomer() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('Missing Supabase environment variables');
    return;
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  try {
    const { data, error } = await supabase
      .from('connect_customers')
      .upsert(MAIN_ACCOUNT_DATA, {
        onConflict: 'stripe_account_id',
        ignoreDuplicates: false
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating main account customer:', error);
      return;
    }

    console.log('✅ Main account customer created successfully:', data);
  } catch (error) {
    console.error('Error:', error);
  }
}

createMainAccountCustomer();
