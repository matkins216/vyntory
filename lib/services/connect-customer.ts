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
        
        // First, check if this email has an active subscription in our database
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
            console.log('🔍 Customer has active status but no subscription ID, checking Stripe directly...');
            
            // Try to find active subscriptions in Stripe for this email
            try {
              const stripeCustomers = await stripe.customers.list({
                email: customer.email,
                limit: 100
              });
              
              if (stripeCustomers.data.length > 0) {
                console.log(`✅ Found ${stripeCustomers.data.length} Stripe customer(s) with email:`, customer.email);
                
                // Check each customer for active subscriptions
                for (const stripeCustomer of stripeCustomers.data) {
                  if (stripeCustomer.deleted) continue;
                  
                  console.log('🔍 Checking customer:', stripeCustomer.id, 'for active subscriptions...');
                  
                  // Search for subscriptions with valid statuses (not just 'active')
                  const subscriptions = await stripe.subscriptions.list({
                    customer: stripeCustomer.id,
                    status: 'all', // Changed from 'active' to 'all' to see all statuses
                    limit: 10
                  });
                  
                  console.log('🔍 All subscriptions found for customer:', {
                    customerId: stripeCustomer.id,
                    subscriptions: subscriptions.data.map(sub => ({
                      id: sub.id,
                      status: sub.status,
                      current_period_start: sub.current_period_start,
                      current_period_end: sub.current_period_end
                    }))
                  });
                  
                  // Check for valid subscription statuses
                  const validSubscriptions = subscriptions.data.filter(sub => 
                    ['active', 'trialing', 'past_due'].includes(sub.status)
                  );
                  
                  if (validSubscriptions.length > 0) {
                    const subscription = validSubscriptions[0];
                    console.log('✅ Found valid subscription for customer:', stripeCustomer.id, 'with status:', subscription.status);
                    
                    // Update the existing customer record with the subscription ID and correct status
                    await this.updateSubscriptionStatus(customer.stripe_account_id, {
                      subscription_status: subscription.status,
                      subscription_id: subscription.id
                    });
                    
                    console.log('💾 Updated customer record with subscription ID:', subscription.id, 'and status:', subscription.status);
                    
                    return {
                      isAuthorized: true,
                      customer: {
                        ...customer,
                        subscription_id: subscription.id,
                        subscription_status: subscription.status
                      },
                      reason: `Authorized via verified Stripe subscription (${subscription.status})`
                    };
                  }
                }
                
                console.log('❌ No active subscriptions found for any Stripe customers with this email');
              }
            } catch (stripeError) {
              console.error('❌ Error checking Stripe for subscription:', stripeError);
            }
            
            return {
              isAuthorized: false,
              customer: customer,
              reason: 'No subscription ID found and no active subscriptions in Stripe'
            };
          }
        } else {
          console.log('❌ No active subscription found in database for email:', connectedAccountEmail);
          
          // NEW: Check if this email matches any active subscription in Stripe directly
          console.log('🔍 Checking if email matches any active subscription in Stripe...');
          console.log('🔍 Looking for Stripe customers with email:', connectedAccountEmail);
          
          try {
            // Search for customers in Stripe with this email
            const stripeCustomers = await stripe.customers.list({
              email: connectedAccountEmail,
              limit: 100
            });
            
            console.log('🔍 Stripe customers search result:', {
              total: stripeCustomers.data.length,
              hasMore: stripeCustomers.has_more,
              email: connectedAccountEmail
            });
            
            if (stripeCustomers.data.length > 0) {
              console.log(`✅ Found ${stripeCustomers.data.length} Stripe customer(s) with email:`, connectedAccountEmail);
              
              // Check each customer for active subscriptions
              for (const stripeCustomer of stripeCustomers.data) {
                if (stripeCustomer.deleted) {
                  console.log('⚠️ Skipping deleted customer:', stripeCustomer.id);
                  continue;
                }
                
                console.log('🔍 Checking customer:', stripeCustomer.id, 'for active subscriptions...');
                console.log('🔍 Customer details:', {
                  id: stripeCustomer.id,
                  email: stripeCustomer.email,
                  name: stripeCustomer.name,
                  created: stripeCustomer.created
                });
                
                const subscriptions = await stripe.subscriptions.list({
                  customer: stripeCustomer.id,
                  status: 'active',
                  limit: 10
                });
                
                console.log('🔍 Subscriptions found for customer:', {
                  customerId: stripeCustomer.id,
                  subscriptionCount: subscriptions.data.length,
                  hasMore: subscriptions.has_more
                });
                
                if (subscriptions.data.length > 0) {
                  console.log('✅ Found active subscription for customer:', stripeCustomer.id);
                  console.log('🔍 Subscription details:', {
                    id: subscriptions.data[0].id,
                    status: subscriptions.data[0].status,
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    current_period_start: (subscriptions.data[0] as any).current_period_start,
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    current_period_end: (subscriptions.data[0] as any).current_period_end
                  });
                  
                  // Create or update customer record in our database
                  const customerData = {
                    stripe_account_id: stripeAccountId,
                    stripe_customer_id: stripeCustomer.id,
                    email: connectedAccountEmail,
                    company_name: stripeCustomer.name || 'Stripe Customer',
                    subscription_status: 'active' as const,
                    subscription_id: subscriptions.data[0].id,
                    plan_name: 'Active Stripe Subscription',
                    is_active: true
                  };
                  
                  console.log('💾 Creating/updating customer record for team member...');
                  console.log('💾 Customer data to save:', customerData);
                  
                  const newCustomer = await this.createOrUpdateCustomer(customerData);
                  
                  console.log('✅ Successfully created/updated customer record:', {
                    id: newCustomer.id,
                    stripe_account_id: newCustomer.stripe_account_id,
                    stripe_customer_id: newCustomer.stripe_customer_id
                  });
                  
                  return {
                    isAuthorized: true,
                    customer: newCustomer,
                    reason: 'Authorized via team member email with active Stripe subscription'
                  };
                } else {
                  console.log('❌ No active subscriptions found for customer:', stripeCustomer.id);
                }
              }
              
              console.log('❌ No active subscriptions found for any Stripe customers with this email');
            } else {
              console.log('❌ No Stripe customers found with email:', connectedAccountEmail);
            }
          } catch (stripeError) {
            console.error('❌ Error checking Stripe for team member subscription:', stripeError);
            console.error('❌ Error details:', {
              message: stripeError instanceof Error ? stripeError.message : 'Unknown error',
              stack: stripeError instanceof Error ? stripeError.stack : undefined
            });
          }
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
