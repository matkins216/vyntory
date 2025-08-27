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

      // Check if this account has a valid Stripe customer ID and subscription
      const customer = await this.getCustomerByStripeAccountId(stripeAccountId);
      
      if (!customer || !customer.stripe_customer_id?.startsWith('cus_')) {
        console.log('❌ No valid Stripe customer ID found for account:', stripeAccountId);
        return {
          isAuthorized: false,
          reason: 'No valid Stripe customer ID found'
        };
      }

      // Verify the subscription exists and is active in Stripe
      if (customer.subscription_id) {
        try {
          const subscription = await stripe.subscriptions.retrieve(customer.subscription_id);
          
          if (subscription.status === 'active' || subscription.status === 'trialing') {
            console.log('✅ Verified active subscription in Stripe:', subscription.id);
            return {
              isAuthorized: true,
              customer,
              reason: 'Active subscription verified in Stripe'
            };
          } else {
            // Update status to reflect actual Stripe status
            await this.updateSubscriptionStatus(customer.stripe_account_id, {
              subscription_status: subscription.status as ConnectCustomer['subscription_status']
            });
            
            return {
              isAuthorized: false,
              customer,
              reason: `Subscription status: ${subscription.status}`
            };
          }
        } catch (error) {
          console.error('❌ Error verifying subscription:', error);
          return {
            isAuthorized: false,
            customer,
            reason: 'Unable to verify subscription'
          };
        }
      }

      // No subscription ID found
      console.log('❌ No subscription ID found for customer');
      return {
        isAuthorized: false,
        customer,
        reason: 'No subscription ID found'
      };
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

}
