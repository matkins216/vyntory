# Shopify Integration Setup Guide

## Overview
This guide will help you set up the Shopify integration alongside your existing Stripe integration for unified inventory management.

## Prerequisites
- Existing Vyntory application with Stripe integration
- Shopify Partner account
- Supabase database access

## Step 1: Shopify Partner Account Setup

### 1.1 Create a Shopify Partner Account
1. Go to [Shopify Partners](https://partners.shopify.com/)
2. Sign up for a free partner account
3. Complete the verification process

### 1.2 Create a Shopify App
1. In your partner dashboard, click "Apps" → "Create app"
2. Choose "Custom app" for development
3. Give your app a name (e.g., "Vyntory Inventory Manager")
4. Set the app URL to your domain
5. Add the following scopes:
   - `read_products`
   - `write_products`
   - `read_inventory`
   - `write_inventory`
   - `read_orders`
   - `write_orders`

### 1.3 Configure App URLs
- **App URL**: `https://yourdomain.com`
- **Allowed redirection URLs**: `https://yourdomain.com/api/shopify/callback`

## Step 2: Environment Variables

Add these variables to your `.env.local` file:

```bash
# Shopify Configuration
SHOPIFY_CLIENT_ID=your_shopify_client_id
SHOPIFY_CLIENT_SECRET=your_shopify_client_secret
SHOPIFY_REDIRECT_URI=https://yourdomain.com/api/shopify/callback
SHOPIFY_WEBHOOK_SECRET=your_webhook_secret
```

## Step 3: Database Schema

The integration requires these new tables in your Supabase database:

### 3.1 Shopify Customers Table
```sql
CREATE TABLE shopify_customers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  stripe_account_id UUID REFERENCES connect_customers(id),
  shopify_shop_domain TEXT UNIQUE NOT NULL,
  shopify_access_token TEXT NOT NULL,
  shopify_shop_id TEXT NOT NULL,
  email TEXT NOT NULL,
  company_name TEXT NOT NULL,
  subscription_status TEXT DEFAULT 'inactive',
  subscription_id TEXT,
  plan_name TEXT DEFAULT 'Shopify Integration',
  plan_features JSONB DEFAULT '{}',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3.2 Shopify Products Table
```sql
CREATE TABLE shopify_products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shopify_customer_id UUID REFERENCES shopify_customers(id) ON DELETE CASCADE,
  shopify_product_id TEXT NOT NULL,
  shopify_variant_ids TEXT[] NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  handle TEXT NOT NULL,
  product_type TEXT,
  vendor TEXT,
  tags TEXT[],
  status TEXT DEFAULT 'active',
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(shopify_customer_id, shopify_product_id)
);
```

### 3.3 Shopify Variants Table
```sql
CREATE TABLE shopify_variants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shopify_product_id TEXT NOT NULL,
  shopify_variant_id TEXT NOT NULL,
  title TEXT NOT NULL,
  sku TEXT,
  barcode TEXT,
  price TEXT NOT NULL,
  compare_at_price TEXT,
  inventory_quantity INTEGER DEFAULT 0,
  inventory_item_id TEXT NOT NULL,
  weight DECIMAL,
  weight_unit TEXT,
  requires_shipping BOOLEAN DEFAULT true,
  taxable BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(shopify_variant_id)
);
```

### 3.4 Shopify Inventory Levels Table
```sql
CREATE TABLE shopify_inventory_levels (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shopify_variant_id TEXT NOT NULL,
  shopify_location_id TEXT NOT NULL,
  available INTEGER DEFAULT 0,
  reserved INTEGER DEFAULT 0,
  incoming INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(shopify_variant_id, shopify_location_id)
);
```

### 3.5 Shopify Webhooks Table
```sql
CREATE TABLE shopify_webhooks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shopify_customer_id UUID REFERENCES shopify_customers(id) ON DELETE CASCADE,
  shopify_webhook_id TEXT NOT NULL,
  topic TEXT NOT NULL,
  address TEXT NOT NULL,
  format TEXT DEFAULT 'json',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Step 4: Testing the Integration

### 4.1 Test Shopify OAuth
1. Navigate to your home page
2. Click "Connect Shopify Store"
3. Enter a test shop domain (e.g., `test-store.myshopify.com`)
4. Complete the OAuth flow

### 4.2 Test Product Sync
1. After successful OAuth, products should automatically sync
2. Check the logs for sync progress
3. Verify products appear in your database

### 4.3 Test Webhooks
1. Create a test order in your Shopify store
2. Check the webhook logs
3. Verify inventory updates in real-time

## Step 5: Production Deployment

### 5.1 Update App URLs
- Change all URLs from development to production domains
- Update webhook endpoints to use HTTPS
- Verify all environment variables are set

### 5.2 Security Considerations
- Implement proper HMAC verification for webhooks
- Use environment-specific API keys
- Monitor API rate limits
- Implement proper error handling and logging

## Troubleshooting

### Common Issues

#### 1. OAuth Errors
- Verify client ID and secret are correct
- Check redirect URI matches exactly
- Ensure scopes are properly configured

#### 2. Webhook Failures
- Verify webhook endpoint is accessible
- Check webhook secret configuration
- Monitor webhook delivery status in Shopify

#### 3. Product Sync Issues
- Check API rate limits
- Verify access token permissions
- Monitor database connection

### Debug Mode
Enable detailed logging by setting:
```bash
NODE_ENV=development
```

## Support

For issues or questions:
1. Check the application logs
2. Verify Shopify Partner dashboard settings
3. Review database schema and permissions
4. Contact the development team

## Next Steps

After successful setup:
1. Customize the dashboard for multi-platform support
2. Implement inventory synchronization between platforms
3. Add advanced reporting and analytics
4. Consider additional platform integrations (WooCommerce, etc.)
