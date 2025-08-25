-- Create connect_customers table for pay gate functionality
CREATE TABLE IF NOT EXISTS connect_customers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  stripe_account_id TEXT UNIQUE NOT NULL,
  stripe_customer_id TEXT,
  email TEXT,
  company_name TEXT,
  subscription_status TEXT NOT NULL DEFAULT 'inactive',
  subscription_id TEXT,
  plan_name TEXT NOT NULL,
  plan_features JSONB,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_connect_customers_stripe_account_id ON connect_customers(stripe_account_id);
CREATE INDEX IF NOT EXISTS idx_connect_customers_stripe_customer_id ON connect_customers(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_connect_customers_subscription_status ON connect_customers(subscription_status);
CREATE INDEX IF NOT EXISTS idx_connect_customers_is_active ON connect_customers(is_active);
CREATE INDEX IF NOT EXISTS idx_connect_customers_email ON connect_customers(email);

-- Create composite index for common queries
CREATE INDEX IF NOT EXISTS idx_connect_customers_account_status ON connect_customers(stripe_account_id, subscription_status);

-- Enable Row Level Security (RLS)
ALTER TABLE connect_customers ENABLE ROW LEVEL SECURITY;

-- Create policy to allow service role to manage all connect customers
CREATE POLICY "Service role can manage all connect customers" ON connect_customers
  FOR ALL USING (true);

-- Create policy to allow users to read their own customer data
CREATE POLICY "Users can read their own customer data" ON connect_customers
  FOR SELECT USING (auth.uid()::text = stripe_account_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_connect_customers_updated_at
  BEFORE UPDATE ON connect_customers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
