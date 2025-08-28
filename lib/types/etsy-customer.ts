export interface EtsyCustomer {
  id: string;
  etsy_shop_id: string;
  etsy_shop_name: string;
  etsy_access_token: string;
  etsy_refresh_token: string;
  email: string;
  company_name: string;
  subscription_status: 'active' | 'canceled' | 'incomplete' | 'incomplete_expired' | 'past_due' | 'paused' | 'trialing' | 'unpaid' | 'inactive';
  plan_name: string;
  plan_features: {
    max_products: number;
    max_inventory_updates: number;
    webhook_endpoints: number;
    api_calls_per_month: number;
    support_level: 'basic' | 'premium' | 'enterprise';
    platforms: ('stripe' | 'shopify' | 'etsy')[];
  };
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface EtsyProduct {
  id: string;
  etsy_customer_id: string;
  etsy_listing_id: string;
  etsy_shop_id: string;
  title: string;
  description: string;
  state: 'active' | 'inactive' | 'sold_out' | 'draft' | 'expired';
  quantity: number;
  has_variations: boolean;
  created_at: string;
  updated_at: string;
}

export interface EtsyVariation {
  id: string;
  etsy_product_id: string;
  etsy_property_id: string;
  etsy_value_id: string;
  name: string;
  value: string;
  created_at: string;
  updated_at: string;
}

export interface EtsyInventoryLevel {
  id: string;
  etsy_product_id: string;
  etsy_listing_id: string;
  available: number;
  reserved: number;
  sold: number;
  created_at: string;
  updated_at: string;
}

export interface EtsyWebhook {
  id: string;
  etsy_customer_id: string;
  etsy_webhook_id: string;
  topic: string;
  address: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface EtsyOrder {
  id: string;
  etsy_customer_id: string;
  etsy_receipt_id: string;
  etsy_shop_id: string;
  status: string;
  total_cost: number;
  currency_code: string;
  created_at: string;
  updated_at: string;
}

export interface EtsyOrderItem {
  id: string;
  etsy_order_id: string;
  etsy_listing_id: string;
  etsy_product_id: string;
  quantity: number;
  price: number;
  currency_code: string;
  created_at: string;
  updated_at: string;
}
