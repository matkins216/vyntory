import { NextRequest } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/client';

export async function checkRateLimit(
  request: NextRequest,
  stripeAccountId: string,
  endpoint: string
) {
  const supabase = createServerSupabaseClient();
  const currentMonth = new Date().toISOString().slice(0, 7); // "2025-08"
  
  // Get current month's API usage
  const { data: usage, error } = await supabase
    .from('api_usage')
    .select('id, call_count')
    .eq('stripe_account_id', stripeAccountId)
    .eq('endpoint', endpoint)
    .eq('month_year', currentMonth)
    .single();
  
  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
    console.error('Error checking rate limit:', error);
    return { allowed: false, reason: 'Error checking rate limit' };
  }
  
  const currentUsage = usage?.call_count || 0;
  
  // Get customer's plan limits
  const { data: customer } = await supabase
    .from('connect_customers')
    .select('plan_features')
    .eq('stripe_account_id', stripeAccountId)
    .single();
  
  const maxCalls = customer?.plan_features?.api_calls_per_month || 1000;
  
  if (currentUsage >= maxCalls) {
    return { 
      allowed: false, 
      reason: `API call limit exceeded. Limit: ${maxCalls}, Used: ${currentUsage}` 
    };
  }
  
  // Increment usage count
  if (usage) {
    await supabase
      .from('api_usage')
      .update({ call_count: currentUsage + 1, updated_at: new Date().toISOString() })
      .eq('id', usage.id);
  } else {
    await supabase
      .from('api_usage')
      .insert({
        stripe_account_id: stripeAccountId,
        endpoint,
        month_year: currentMonth,
        call_count: 1
      });
  }
  
  return { allowed: true, remaining: maxCalls - currentUsage - 1 };
}
