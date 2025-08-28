import { createServerSupabaseClient } from '@/lib/supabase/client';
import { logger } from '@/lib/utils/logger';

export interface PlanEnforcementResult {
    allowed: boolean;
    reason?: string;
    remaining?: number;
    limit?: number;
}

export class PlanEnforcementService {
    private supabase = createServerSupabaseClient();

    /**
     * Check if user can create more products
     */
    async checkProductLimit(stripeAccountId: string): Promise<PlanEnforcementResult> {
        try {
            // Get current product count
            const { data: products, error: productError } = await this.supabase
                .from('stripe_products')
                .select('id')
                .eq('stripe_account_id', stripeAccountId);

            if (productError) {
                logger.error('Failed to check product count', productError, { stripeAccountId });
                return { allowed: false, reason: 'Database error checking product limit' };
            }

            const currentCount = products?.length || 0;

            // Get user's plan limits
            const { data: customer, error: customerError } = await this.supabase
                .from('connect_customers')
                .select('plan_features')
                .eq('stripe_account_id', stripeAccountId)
                .single();

            if (customerError || !customer) {
                logger.error('Failed to get customer plan features', customerError, { stripeAccountId });
                return { allowed: false, reason: 'Customer not found' };
            }

            const maxProducts = customer.plan_features?.max_products || 100;
            const allowed = currentCount < maxProducts;

            logger.info('Product limit check', {
                stripeAccountId,
                currentCount,
                maxProducts,
                allowed
            });

            return {
                allowed,
                reason: allowed ? undefined : `Product limit exceeded. Limit: ${maxProducts}, Current: ${currentCount}`,
                remaining: Math.max(0, maxProducts - currentCount),
                limit: maxProducts
            };
        } catch (error) {
            logger.error('Unexpected error checking product limit', error as Error, { stripeAccountId });
            return { allowed: false, reason: 'Unexpected error checking product limit' };
        }
    }

    /**
     * Check if user can make more API calls this month
     */
    async checkApiCallLimit(stripeAccountId: string, endpoint: string): Promise<PlanEnforcementResult> {
        try {
            const currentMonth = new Date().toISOString().slice(0, 7); // "2025-08"

            // Get current month's API usage
            const { data: usage, error: usageError } = await this.supabase
                .from('api_usage')
                .select('id, call_count')
                .eq('stripe_account_id', stripeAccountId)
                .eq('endpoint', endpoint)
                .eq('month_year', currentMonth)
                .single();

            if (usageError && usageError.code !== 'PGRST116') { // PGRST116 = no rows returned
                logger.error('Failed to check API usage', usageError, { stripeAccountId, endpoint });
                return { allowed: false, reason: 'Database error checking API limit' };
            }

            const currentUsage = usage?.call_count || 0;

            // Get user's plan limits
            const { data: customer, error: customerError } = await this.supabase
                .from('connect_customers')
                .select('plan_features')
                .eq('stripe_account_id', stripeAccountId)
                .single();

            if (customerError || !customer) {
                logger.error('Failed to get customer plan features', customerError, { stripeAccountId });
                return { allowed: false, reason: 'Customer not found' };
            }

            const maxCalls = customer.plan_features?.api_calls_per_month || 1000;
            const allowed = currentUsage < maxCalls;

            logger.info('API call limit check', {
                stripeAccountId,
                endpoint,
                currentUsage,
                maxCalls,
                allowed
            });

            if (allowed) {
                // Increment usage count
                if (usage) {
                    await this.supabase
                        .from('api_usage')
                        .update({
                            call_count: currentUsage + 1,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', usage.id);
                } else {
                    await this.supabase
                        .from('api_usage')
                        .insert({
                            stripe_account_id: stripeAccountId,
                            endpoint,
                            month_year: currentMonth,
                            call_count: 1
                        });
                }
            }

            return {
                allowed,
                reason: allowed ? undefined : `API call limit exceeded. Limit: ${maxCalls}, Used: ${currentUsage}`,
                remaining: Math.max(0, maxCalls - currentUsage - 1),
                limit: maxCalls
            };
        } catch (error) {
            logger.error('Unexpected error checking API call limit', error as Error, { stripeAccountId, endpoint });
            return { allowed: false, reason: 'Unexpected error checking API call limit' };
        }
    }

    /**
     * Check if user can make more inventory updates
     */
    async checkInventoryUpdateLimit(stripeAccountId: string): Promise<PlanEnforcementResult> {
        try {
            const currentMonth = new Date().toISOString().slice(0, 7);

            // Get current month's inventory update count
            const { data: updates, error: updateError } = await this.supabase
                .from('inventory_updates')
                .select('id')
                .eq('stripe_account_id', stripeAccountId)
                .gte('created_at', `${currentMonth}-01T00:00:00Z`)
                .lt('created_at', `${currentMonth}-32T00:00:00Z`);

            if (updateError) {
                logger.error('Failed to check inventory update count', updateError, { stripeAccountId });
                return { allowed: false, reason: 'Database error checking inventory update limit' };
            }

            const currentCount = updates?.length || 0;

            // Get user's plan limits
            const { data: customer, error: customerError } = await this.supabase
                .from('connect_customers')
                .select('plan_features')
                .eq('stripe_account_id', stripeAccountId)
                .single();

            if (customerError || !customer) {
                logger.error('Failed to get customer plan features', customerError, { stripeAccountId });
                return { allowed: false, reason: 'Customer not found' };
            }

            const maxUpdates = customer.plan_features?.max_inventory_updates || 1000;
            const allowed = currentCount < maxUpdates;

            logger.info('Inventory update limit check', {
                stripeAccountId,
                currentCount,
                maxUpdates,
                allowed
            });

            return {
                allowed,
                reason: allowed ? undefined : `Inventory update limit exceeded. Limit: ${maxUpdates}, Current: ${currentCount}`,
                remaining: Math.max(0, maxUpdates - currentCount),
                limit: maxUpdates
            };
        } catch (error) {
            logger.error('Unexpected error checking inventory update limit', error as Error, { stripeAccountId });
            return { allowed: false, reason: 'Unexpected error checking inventory update limit' };
        }
    }
}

export const planEnforcement = new PlanEnforcementService();