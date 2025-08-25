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
      // Get customer from database
      const customer = await this.getCustomerByStripeAccountId(stripeAccountId);
      
      if (!customer) {
        return {
          isAuthorized: false,
          reason: 'Customer not found in database'
        };
      }

      // Check if customer is active
      if (!customer.is_active) {
        return {
          isAuthorized: false,
          customer,
          reason: 'Customer account is not active'
        };
      }

      // Check subscription status
      if (customer.subscription_status === 'active' || customer.subscription_status === 'trialing') {
        // Check if subscription is still valid by verifying with Stripe
        if (customer.subscription_id) {
          try {
            const subscription = await stripe.subscriptions.retrieve(customer.subscription_id, {
              stripeAccount: stripeAccountId
            });

            if (subscription.status === 'active' || subscription.status === 'trialing') {
              // Calculate trial days left if applicable
              let trialDaysLeft: number | undefined;
              if (subscription.status === 'trialing' && subscription.trial_end) {
                const trialEnd = new Date(subscription.trial_end * 1000);
                const now = new Date();
                trialDaysLeft = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
              }

              return {
                isAuthorized: true,
                customer,
                trialDaysLeft
              };
            } else {
              // Update local status if Stripe shows different status
              await this.updateSubscriptionStatus(stripeAccountId, {
                subscription_status: subscription.status as ConnectCustomer['subscription_status']
              });

              return {
                isAuthorized: false,
                customer,
                reason: `Subscription status: ${subscription.status}`
              };
            }
          } catch (stripeError) {
            console.error('Error verifying subscription with Stripe:', stripeError);
            // Fall back to local status if Stripe call fails
            return {
              isAuthorized: customer.subscription_status === 'active' || customer.subscription_status === 'trialing',
              customer,
              reason: 'Unable to verify with Stripe, using local status'
            };
          }
        } else {
          // No subscription ID, check local status
          return {
            isAuthorized: customer.subscription_status === 'active' || customer.subscription_status === 'trialing',
            customer,
            reason: 'No subscription ID, using local status'
          };
        }
      } else {
        return {
          isAuthorized: false,
          customer,
          reason: `Subscription status: ${customer.subscription_status}`
        };
      }
    } catch (error) {
      console.error('Error checking pay gate authorization:', error);
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
