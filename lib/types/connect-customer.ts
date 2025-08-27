export interface ConnectCustomer {
  id: string;
  stripe_account_id: string;
  stripe_customer_id?: string;
  email?: string;
  company_name?: string;
  subscription_status: 'active' | 'inactive' | 'past_due' | 'canceled' | 'trialing' | 'incomplete' | 'incomplete_expired' | 'unpaid';
  subscription_id?: string;
  plan_name: string;
  plan_features?: PlanFeatures;
  current_period_start?: string;
  current_period_end?: string;
  trial_end?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PlanFeatures {
  max_products?: number;
  max_inventory_updates?: number;
  webhook_endpoints?: number;
  api_calls_per_month?: number;
  support_level?: 'basic' | 'priority' | 'enterprise';
  custom_features?: string[];
  platforms?: ('stripe' | 'shopify')[];
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  price_id: string;
  features: PlanFeatures;
  is_active: boolean;
}

export interface PayGateCheckResult {
  isAuthorized: boolean;
  customer?: ConnectCustomer;
  plan?: SubscriptionPlan;
  reason?: string;
  trialDaysLeft?: number;
}
