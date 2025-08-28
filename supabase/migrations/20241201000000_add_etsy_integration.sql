-- Add Etsy integration tables
-- This migration adds support for Etsy platform integration alongside existing Shopify

-- Etsy Customers Table
CREATE TABLE IF NOT EXISTS etsy_customers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  stripe_account_id UUID REFERENCES connect_customers(id),
  etsy_shop_id TEXT UNIQUE NOT NULL,
  etsy_shop_name TEXT NOT NULL,
  etsy_access_token TEXT NOT NULL,
  etsy_refresh_token TEXT NOT NULL,
  email TEXT NOT NULL,
  company_name TEXT NOT NULL,
  subscription_status TEXT DEFAULT 'inactive',
  subscription_id TEXT,
  plan_name TEXT DEFAULT 'Etsy Integration',
  plan_features JSONB DEFAULT '{}',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Etsy Products Table
CREATE TABLE IF NOT EXISTS etsy_products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  etsy_customer_id UUID REFERENCES etsy_customers(id) ON DELETE CASCADE,
  etsy_listing_id TEXT NOT NULL,
  etsy_shop_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  state TEXT DEFAULT 'active',
  quantity INTEGER DEFAULT 0,
  who_made TEXT,
  when_made TEXT,
  taxonomy_id INTEGER,
  taxonomy_path TEXT[],
  used_manufacturer BOOLEAN DEFAULT false,
  is_supply BOOLEAN DEFAULT false,
  is_customizable BOOLEAN DEFAULT false,
  is_digital BOOLEAN DEFAULT false,
  language TEXT DEFAULT 'en',
  has_variations BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(etsy_customer_id, etsy_listing_id)
);

-- Etsy Variations Table
CREATE TABLE IF NOT EXISTS etsy_variations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  etsy_product_id TEXT NOT NULL,
  etsy_property_id TEXT NOT NULL,
  etsy_value_id TEXT NOT NULL,
  name TEXT NOT NULL,
  value TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(etsy_property_id, etsy_value_id)
);

-- Etsy Inventory Levels Table
CREATE TABLE IF NOT EXISTS etsy_inventory_levels (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  etsy_product_id TEXT NOT NULL,
  etsy_listing_id TEXT NOT NULL,
  available INTEGER DEFAULT 0,
  reserved INTEGER DEFAULT 0,
  sold INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(etsy_product_id)
);

-- Etsy Webhooks Table
CREATE TABLE IF NOT EXISTS etsy_webhooks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  etsy_customer_id UUID REFERENCES etsy_customers(id) ON DELETE CASCADE,
  etsy_webhook_id TEXT NOT NULL,
  topic TEXT NOT NULL,
  address TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Etsy Orders Table
CREATE TABLE IF NOT EXISTS etsy_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  etsy_customer_id UUID REFERENCES etsy_customers(id) ON DELETE CASCADE,
  etsy_receipt_id TEXT NOT NULL,
  etsy_shop_id TEXT NOT NULL,
  status TEXT DEFAULT 'open',
  total_cost DECIMAL(10,2) DEFAULT 0,
  currency_code TEXT DEFAULT 'USD',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(etsy_receipt_id)
);

-- Etsy Order Items Table
CREATE TABLE IF NOT EXISTS etsy_order_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  etsy_order_id TEXT NOT NULL,
  etsy_listing_id TEXT NOT NULL,
  etsy_product_id TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  price DECIMAL(10,2) DEFAULT 0,
  currency_code TEXT DEFAULT 'USD',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(etsy_order_id, etsy_listing_id)
);

-- Product Mappings Table (for cross-platform product linking)
CREATE TABLE IF NOT EXISTS product_mappings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  stripe_customer_id UUID REFERENCES connect_customers(id) ON DELETE CASCADE,
  shopify_product_id TEXT,
  shopify_variant_id TEXT,
  shopify_location_id TEXT,
  etsy_listing_id TEXT,
  etsy_product_id TEXT,
  mapping_type TEXT DEFAULT 'manual', -- 'manual', 'sku', 'name'
  confidence_score DECIMAL(3,2) DEFAULT 0.5, -- How confident we are in the mapping
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(stripe_customer_id, shopify_variant_id, etsy_listing_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_etsy_customers_shop_id ON etsy_customers(etsy_shop_id);
CREATE INDEX IF NOT EXISTS idx_etsy_customers_stripe_account ON etsy_customers(stripe_account_id);
CREATE INDEX IF NOT EXISTS idx_etsy_products_customer ON etsy_products(etsy_customer_id);
CREATE INDEX IF NOT EXISTS idx_etsy_products_listing ON etsy_products(etsy_listing_id);
CREATE INDEX IF NOT EXISTS idx_etsy_inventory_product ON etsy_inventory_levels(etsy_product_id);
CREATE INDEX IF NOT EXISTS idx_etsy_orders_customer ON etsy_orders(etsy_customer_id);
CREATE INDEX IF NOT EXISTS idx_etsy_orders_receipt ON etsy_orders(etsy_receipt_id);
CREATE INDEX IF NOT EXISTS idx_product_mappings_customer ON product_mappings(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_product_mappings_shopify ON product_mappings(shopify_variant_id);
CREATE INDEX IF NOT EXISTS idx_product_mappings_etsy ON product_mappings(etsy_listing_id);

-- Add RLS policies for security
ALTER TABLE etsy_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE etsy_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE etsy_variations ENABLE ROW LEVEL SECURITY;
ALTER TABLE etsy_inventory_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE etsy_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE etsy_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE etsy_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_mappings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for etsy_customers
-- Note: Since we don't have user_id in connect_customers, we'll use a more permissive policy
-- You can tighten this later based on your authentication system
CREATE POLICY "Allow authenticated users to view Etsy customers" ON etsy_customers
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to insert Etsy customers" ON etsy_customers
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to update Etsy customers" ON etsy_customers
  FOR UPDATE USING (auth.role() = 'authenticated');

-- RLS Policies for etsy_products
CREATE POLICY "Allow authenticated users to view Etsy products" ON etsy_products
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to insert Etsy products" ON etsy_products
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to update Etsy products" ON etsy_products
  FOR UPDATE USING (auth.role() = 'authenticated');

-- RLS Policies for etsy_variations
CREATE POLICY "Allow authenticated users to view Etsy variations" ON etsy_variations
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to insert Etsy variations" ON etsy_variations
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to update Etsy variations" ON etsy_variations
  FOR UPDATE USING (auth.role() = 'authenticated');

-- RLS Policies for etsy_inventory_levels
CREATE POLICY "Allow authenticated users to view Etsy inventory levels" ON etsy_inventory_levels
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to insert Etsy inventory levels" ON etsy_inventory_levels
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to update Etsy inventory levels" ON etsy_inventory_levels
  FOR UPDATE USING (auth.role() = 'authenticated');

-- RLS Policies for etsy_webhooks
CREATE POLICY "Allow authenticated users to view Etsy webhooks" ON etsy_webhooks
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to insert Etsy webhooks" ON etsy_webhooks
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to update Etsy webhooks" ON etsy_webhooks
  FOR UPDATE USING (auth.role() = 'authenticated');

-- RLS Policies for etsy_orders
CREATE POLICY "Allow authenticated users to view Etsy orders" ON etsy_orders
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to insert Etsy orders" ON etsy_orders
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to update Etsy orders" ON etsy_orders
  FOR UPDATE USING (auth.role() = 'authenticated');

-- RLS Policies for etsy_order_items
CREATE POLICY "Allow authenticated users to view Etsy order items" ON etsy_order_items
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to insert Etsy order items" ON etsy_order_items
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to update Etsy order items" ON etsy_order_items
  FOR UPDATE USING (auth.role() = 'authenticated');

-- RLS Policies for product_mappings
CREATE POLICY "Allow authenticated users to view product mappings" ON product_mappings
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to insert product mappings" ON product_mappings
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to update product mappings" ON product_mappings
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Update existing Shopify customers table to include Etsy in plan_features
UPDATE shopify_customers 
SET plan_features = jsonb_set(
  plan_features, 
  '{platforms}', 
  '["stripe", "shopify"]'::jsonb
)
WHERE plan_features->'platforms' IS NULL;

-- Add triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_etsy_customers_updated_at BEFORE UPDATE ON etsy_customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_etsy_products_updated_at BEFORE UPDATE ON etsy_products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_etsy_inventory_levels_updated_at BEFORE UPDATE ON etsy_inventory_levels
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_etsy_orders_updated_at BEFORE UPDATE ON etsy_orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_product_mappings_updated_at BEFORE UPDATE ON product_mappings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
