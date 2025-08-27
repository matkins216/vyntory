import { createServerSupabaseClient } from '@/lib/supabase/client';
import { ConnectCustomer, PayGateCheckResult } from '@/lib/types/connect-customer';
import { stripe } from '@/lib/stripe';

export class ConnectCustomerService {
  private supabase = createServerSupabaseClient();

  async createOrUpdateCustomer(customerData: Partial<ConnectCustomer>): Promise<ConnectCustomer> {
    const { data, error } = await this.supabase
      .from('connect_customers')
      .upsert(customerData, {
        onConflict: 'stripe_account_id',
        ignoreDuplicates: false
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating/updating connect customer:', error);
      throw new Error(`Failed to create/update connect customer: ${error.message}`);
    }

    return data;
  }

  async getCustomerByStripeAccountId(stripeAccountId: string): Promise<ConnectCustomer | null> {
    const { data, error } = await this.supabase
      .from('connect_customers')
      .select('*')
      .eq('stripe_account_id', stripeAccountId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // No customer found
      }
      console.error('Error fetching connect customer:', error);
      throw new Error(`Failed to fetch connect customer: ${error.message}`);
    }

    return data;
  }

  async updateSubscriptionStatus(
    stripeAccountId: string,
    subscriptionData: {
      subscription_status: ConnectCustomer['subscription_status'];
      subscription_id?: string;
      current_period_start?: string;
      current_period_end?: string;
      trial_end?: string;
    }
  ): Promise<void> {
    const { error } = await this.supabase
      .from('connect_customers')
      .update({
        ...subscriptionData,
        updated_at: new Date().toISOString()
      })
      .eq('stripe_account_id', stripeAccountId);

    if (error) {
      console.error('Error updating subscription status:', error);
      throw new Error(`Failed to update subscription status: ${error.message}`);
    }
  }

  async checkPayGateAuthorization(stripeAccountId: string): Promise<PayGateCheckResult> {
    try {
      console.log('🔍 Checking pay gate authorization for account:', stripeAccountId);
      
      // First, try to get the connected account details to find the owner's email
      let connectedAccountEmail: string | null = null;
      
      try {
        console.log('🔍 Retrieving connected account details...');
        const connectedAccount = await stripe.accounts.retrieve(stripeAccountId);
        console.log('Connected account details:', {
          id: connectedAccount.id,
          email: connectedAccount.email,
          business_type: connectedAccount.business_type
        });
        
        if (connectedAccount.email) {
          connectedAccountEmail = connectedAccount.email;
          console.log('✅ Found connected account email:', connectedAccountEmail);
        } else {
          console.log('⚠️ No email found in connected account');
        }
      } catch (stripeError) {
        console.log('⚠️ Not a connected account or error retrieving:', stripeError);
        // This might be a regular Stripe account, not a connected account
      }

      // If we have an email (either from connected account or passed directly), check for subscription
      if (connectedAccountEmail) {
        console.log('🔍 Looking for subscription with email:', connectedAccountEmail);
        
        // Check if this email has an active subscription in our database
        const { data: customers, error } = await this.supabase
          .from('connect_customers')
          .select('*')
          .eq('email', connectedAccountEmail)
          .eq('is_active', true)
          .in('subscription_status', ['active', 'trialing'])
          .limit(1);
        
        if (error) {
          console.error('❌ Database error looking for customers:', error);
        } else if (customers && customers.length > 0) {
          const customer = customers[0];
          console.log('✅ Found customer in database:', {
            id: customer.id,
            email: customer.email,
            subscription_status: customer.subscription_status,
            subscription_id: customer.subscription_id
          });
          
          // CRITICAL: Verify the subscription actually exists and is active in Stripe
          if (customer.subscription_id) {
            console.log('🔍 Verifying subscription with Stripe...');
            try {
              const subscription = await stripe.subscriptions.retrieve(customer.subscription_id);
              console.log('✅ Stripe subscription details:', {
                id: subscription.id,
                status: subscription.status,
                customer: subscription.customer
              });
              
              if (subscription.status === 'active' || subscription.status === 'trialing') {
                console.log('✅ Stripe confirms subscription is active/trialing');
                return {
                  isAuthorized: true,
                  customer: customer,
                  reason: 'Authorized via verified Stripe subscription'
                };
              } else {
                console.log('❌ Stripe shows subscription status as:', subscription.status);
                // Update the database to reflect the actual status
                await this.updateSubscriptionStatus(customer.stripe_account_id, {
                  subscription_status: subscription.status as ConnectCustomer['subscription_status']
                });
                
                return {
                  isAuthorized: false,
                  customer: customer,
                  reason: `Subscription status: ${subscription.status}`
                };
              }
            } catch (stripeError) {
              console.error('❌ Error verifying subscription with Stripe:', stripeError);
              // If we can't verify with Stripe, deny access for security
              return {
                isAuthorized: false,
                customer: customer,
                reason: 'Unable to verify subscription with Stripe - access denied'
              };
            }
          } else {
            console.log('❌ No subscription ID in customer record');
            return {
              isAuthorized: false,
              customer: customer,
              reason: 'No subscription ID found'
            };
          }
        } else {
          console.log('❌ No active subscription found for email:', connectedAccountEmail);
        }
      }

      // NEW: Check if this stripeAccountId is actually a customer in your main Stripe account
      console.log('🔍 Checking if this is a customer in main Stripe account...');
      try {
        const mainAccountCustomer = await stripe.customers.retrieve(stripeAccountId);
        
        if (mainAccountCustomer && !mainAccountCustomer.deleted) {
          console.log('✅ Found customer in main Stripe account:', {
            id: mainAccountCustomer.id,
            email: mainAccountCustomer.email,
            name: mainAccountCustomer.name
          });
          
          // Check if this customer has any active subscriptions
          const subscriptions = await stripe.subscriptions.list({
            customer: stripeAccountId,
            status: 'active'
          });
          
          if (subscriptions.data.length > 0) {
            console.log('✅ Customer has active subscriptions in main account');
            
            // Create or update customer record in our database
            const customerData = {
              stripe_account_id: stripeAccountId,
              stripe_customer_id: stripeAccountId,
              email: mainAccountCustomer.email || undefined,
              company_name: mainAccountCustomer.name || undefined,
              subscription_status: 'active' as const,
              subscription_id: subscriptions.data[0].id,
              plan_name: 'Main Account Subscription',
              is_active: true
            };
            
            console.log('💾 Saving main account customer to database...');
            await this.createOrUpdateCustomer(customerData);
            
            return {
              isAuthorized: true,
              customer: customerData as ConnectCustomer,
              reason: 'Authorized via main Stripe account subscription'
            };
          } else {
            console.log('❌ Customer has no active subscriptions in main account');
          }
        }
      } catch (stripeError) {
        console.log('⚠️ Not a customer in main account or error retrieving:', stripeError);
      }

      // Fallback: Check if the stripeAccountId itself has a customer record in our database
      console.log('🔍 Checking database for account-specific customer...');
      const customer = await this.getCustomerByStripeAccountId(stripeAccountId);
      
      if (!customer) {
        console.log('❌ No customer found in database for account:', stripeAccountId);
        return {
          isAuthorized: false,
          reason: 'No subscription found for this account'
        };
      }

      console.log('✅ Found customer in database:', {
        id: customer.id,
        email: customer.email,
        subscription_status: customer.subscription_status,
        is_active: customer.is_active
      });

      // Check if customer is active
      if (!customer.is_active) {
        console.log('❌ Customer account is not active');
        return {
          isAuthorized: false,
          customer,
          reason: 'Customer account is not active'
        };
      }

      // Check subscription status
      if (customer.subscription_status === 'active' || customer.subscription_status === 'trialing') {
        console.log('✅ Customer has active/trialing subscription status');
        return {
          isAuthorized: true,
          customer,
          reason: 'Customer has active subscription'
        };
      } else {
        console.log('❌ Customer subscription status is:', customer.subscription_status);
        return {
          isAuthorized: false,
          customer,
          reason: `Subscription status: ${customer.subscription_status}`
        };
      }
    } catch (error) {
      console.error('❌ Error checking pay gate authorization:', error);
      return {
        isAuthorized: false,
        reason: `Error checking authorization: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  async getActiveCustomers(): Promise<ConnectCustomer[]> {
    const { data, error } = await this.supabase
      .from('connect_customers')
      .select('*')
      .eq('is_active', true)
      .in('subscription_status', ['active', 'trialing'])
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching active customers:', error);
      throw new Error(`Failed to fetch active customers: ${error.message}`);
    }

    return data || [];
  }

  async deactivateCustomer(stripeAccountId: string): Promise<void> {
    const { error } = await this.supabase
      .from('connect_customers')
      .update({
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('stripe_account_id', stripeAccountId);

    if (error) {
      console.error('Error deactivating customer:', error);
      throw new Error(`Failed to deactivate customer: ${error.message}`);
    }
  }

  async createMainAccountCustomer(email: string, planName: string = 'Free Plan'): Promise<ConnectCustomer> {
    console.log('🔧 Creating main account customer for email:', email);
    
    const customerData = {
      stripe_account_id: `main_${email.replace('@', '_').replace('.', '_')}`, // Generate a unique ID
      email: email,
      company_name: 'Main Account',
      subscription_status: 'active' as const,
      plan_name: planName,
      plan_features: {
        max_products: 100,
        max_inventory_updates: 1000,
        webhook_endpoints: 5,
        api_calls_per_month: 10000,
        support_level: 'basic' as const
      },
      is_active: true
    };

    console.log('📝 Customer data prepared:', customerData);
    
    try {
      const customer = await this.createOrUpdateCustomer(customerData);
      console.log('✅ Main account customer created/updated:', customer);
      return customer;
    } catch (error) {
      console.error('❌ Error creating main account customer:', error);
      throw error;
    }
  }

  async getOrCreateMainAccountCustomer(email: string): Promise<ConnectCustomer> {
    console.log('🔍 Looking for existing main account customer with email:', email);
    
    // First try to find by email
    const { data: existingCustomers, error } = await this.supabase
      .from('connect_customers')
      .select('*')
      .eq('email', email)
      .eq('is_active', true)
      .limit(1);
    
    if (error) {
      console.error('❌ Database error looking for existing customer:', error);
    } else if (existingCustomers && existingCustomers.length > 0) {
      console.log('✅ Found existing main account customer:', existingCustomers[0]);
      return existingCustomers[0];
    }
    
    // If not found, create one
    console.log('🔧 Creating new main account customer...');
    return await this.createMainAccountCustomer(email);
  }
}
