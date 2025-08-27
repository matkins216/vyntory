export interface ShopifyCustomer {
  id: string;
  stripe_account_id?: string; // Link to existing Stripe customers if needed
  shopify_shop_domain: string;
  shopify_access_token: string;
  shopify_shop_id: string;
  email: string;
  company_name: string;
  subscription_status: 'active' | 'inactive' | 'past_due' | 'canceled' | 'trialing' | 'incomplete' | 'incomplete_expired' | 'unpaid';
  subscription_id?: string;
  plan_name: string;
  plan_features: {
    max_products: number;
    max_inventory_updates: number;
    webhook_endpoints: number;
    api_calls_per_month: number;
    support_level: 'basic' | 'premium' | 'enterprise';
    platforms: ('stripe' | 'shopify')[];
  };
  current_period_start?: string;
  current_period_end?: string;
  trial_end?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ShopifyProduct {
  id: string;
  shopify_customer_id: string;
  shopify_product_id: string;
  shopify_variant_ids: string[];
  name: string;
  description?: string;
  handle: string;
  product_type?: string;
  vendor?: string;
  tags?: string[];
  status: 'active' | 'archived' | 'draft';
  published_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ShopifyVariant {
  id: string;
  shopify_product_id: string;
  shopify_variant_id: string;
  title: string;
  sku?: string;
  barcode?: string;
  price: string;
  compare_at_price?: string;
  inventory_quantity: number;
  inventory_item_id: string;
  weight?: number;
  weight_unit?: string;
  requires_shipping: boolean;
  taxable: boolean;
  created_at: string;
  updated_at: string;
}

export interface ShopifyInventoryLevel {
  id: string;
  shopify_variant_id: string;
  shopify_location_id: string;
  available: number;
  reserved: number;
  incoming: number;
  updated_at: string;
}

export interface ShopifyWebhook {
  id: string;
  shopify_customer_id: string;
  shopify_webhook_id: string;
  topic: string;
  address: string;
  format: 'json' | 'xml';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
