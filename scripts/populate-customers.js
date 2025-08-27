// Script to manually populate connect_customers table
// Run this with: node scripts/populate-customers.js

const { createClient } = require('@supabase/supabase-js');

// Replace with your actual values
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Test customer data
const TEST_CUSTOMERS = [
  {
    stripe_account_id: 'main_matt_atkins_0_mo',
    email: 'matt.atkins@0/mo',
    company_name: 'Matt Atkins',
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
  },
  {
    stripe_account_id: 'test_connected_account_1',
    email: 'matt.atkins@0/mo',
    company_name: 'Test Connected Account',
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
  }
];

async function populateCustomers() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('❌ Missing Supabase environment variables');
    console.log('Make sure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set');
    return;
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  console.log('🚀 Starting to populate connect_customers table...');

  for (const customerData of TEST_CUSTOMERS) {
    try {
      console.log(`📝 Creating customer: ${customerData.email}`);
      
      const { data, error } = await supabase
        .from('connect_customers')
        .upsert(customerData, {
          onConflict: 'stripe_account_id',
          ignoreDuplicates: false
        })
        .select()
        .single();

      if (error) {
        console.error(`❌ Error creating customer ${customerData.email}:`, error);
      } else {
        console.log(`✅ Successfully created customer:`, {
          id: data.id,
          email: data.email,
          stripe_account_id: data.stripe_account_id,
          subscription_status: data.subscription_status
        });
      }
    } catch (error) {
      console.error(`❌ Unexpected error creating customer ${customerData.email}:`, error);
    }
  }

  console.log('🎉 Finished populating customers table');
  
  // Now let's verify what's in the table
  console.log('\n🔍 Verifying table contents...');
  const { data: allCustomers, error: selectError } = await supabase
    .from('connect_customers')
    .select('*');

  if (selectError) {
    console.error('❌ Error reading customers:', selectError);
  } else {
    console.log(`✅ Found ${allCustomers.length} customers in table:`);
    allCustomers.forEach(customer => {
      console.log(`  - ${customer.email} (${customer.stripe_account_id}) - ${customer.subscription_status}`);
    });
  }
}

populateCustomers();
