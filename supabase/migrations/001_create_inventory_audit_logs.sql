-- Create inventory audit logs table
CREATE TABLE IF NOT EXISTS inventory_audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id TEXT NOT NULL,
  stripe_account_id TEXT NOT NULL,
  action TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  previous_quantity INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  reason TEXT,
  timestamp TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_inventory_audit_logs_product_id ON inventory_audit_logs(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_audit_logs_stripe_account_id ON inventory_audit_logs(stripe_account_id);
CREATE INDEX IF NOT EXISTS idx_inventory_audit_logs_user_id ON inventory_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_inventory_audit_logs_timestamp ON inventory_audit_logs(timestamp);

-- Create composite index for common queries
CREATE INDEX IF NOT EXISTS idx_inventory_audit_logs_product_account ON inventory_audit_logs(product_id, stripe_account_id);

-- Enable Row Level Security (RLS)
ALTER TABLE inventory_audit_logs ENABLE ROW LEVEL SECURITY;

-- Create policy to allow authenticated users to read their own audit logs
CREATE POLICY "Users can read their own audit logs" ON inventory_audit_logs
  FOR SELECT USING (auth.uid()::text = user_id);

-- Create policy to allow service role to insert audit logs
CREATE POLICY "Service role can insert audit logs" ON inventory_audit_logs
  FOR INSERT WITH CHECK (true);

-- Create policy to allow service role to read all audit logs
CREATE POLICY "Service role can read all audit logs" ON inventory_audit_logs
  FOR SELECT USING (true);
