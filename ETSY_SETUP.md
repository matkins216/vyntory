# Etsy Integration Setup Guide

## Overview
This guide will help you set up the Etsy integration alongside your existing Shopify and Stripe integrations for unified inventory management across multiple platforms.

## Prerequisites
- Existing Vyntory application with Shopify and Stripe integrations
- Etsy Developer account
- Supabase database access
- Environment variables configured

## Step 1: Etsy Developer Account Setup

### 1.1 Create an Etsy Developer Account
1. Go to [Etsy Developers](https://www.etsy.com/developers/)
2. Sign in with your Etsy account
3. Click "Create App" to register a new application

### 1.2 Configure Your Etsy App
1. **App Name**: Give your app a descriptive name (e.g., "Vyntory Inventory Manager")
2. **App Type**: Select "Public App" for production use
3. **App Description**: Describe your app's purpose
4. **App URL**: Set to your domain (e.g., `https://yourdomain.com`)
5. **Callback URL**: Set to `https://yourdomain.com/api/etsy/callback`

### 1.3 Configure App Permissions
Your app will need the following scopes:
- `listings_r` - Read shop listings
- `listings_w` - Write shop listings (for inventory updates)
- `transactions_r` - Read transaction data
- `transactions_w` - Write transaction data
- `shops_r` - Read shop information

### 1.4 Get API Credentials
After app creation, you'll receive:
- **API Key (Client ID)**
- **Shared Secret**
- **App ID**

## Step 2: Environment Variables

Add these variables to your `.env.local` file:

```bash
# Etsy Configuration
ETSY_CLIENT_ID=your_etsy_client_id
ETSY_CLIENT_SECRET=your_etsy_shared_secret
ETSY_API_KEY=your_etsy_api_key
ETSY_REDIRECT_URI=https://yourdomain.com/api/etsy/callback
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

## Step 3: Database Setup

### 3.1 Run the Migration
The Etsy integration requires new database tables. Run the migration:

```bash
# If using Supabase CLI
supabase db push

# Or manually run the SQL from:
# supabase/migrations/20241201000000_add_etsy_integration.sql
```

### 3.2 Verify Tables Created
The migration creates these tables:
- `etsy_customers` - Etsy shop connections
- `etsy_products` - Etsy listings
- `etsy_variations` - Product variations
- `etsy_inventory_levels` - Inventory tracking
- `etsy_webhooks` - Webhook configuration
- `etsy_orders` - Order data
- `etsy_order_items` - Order line items
- `product_mappings` - Cross-platform product linking

## Step 4: OAuth Flow Implementation

### 4.1 OAuth Initiation
The integration uses OAuth 2.0 with PKCE for secure authentication:

```typescript
// Frontend: Initiate OAuth
const response = await fetch('/api/etsy/auth', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ shopId: 'your_shop_id' })
});

const { oauthUrl } = await response.json();
window.location.href = oauthUrl;
```

### 4.2 OAuth Callback
The callback endpoint (`/api/etsy/callback`) handles:
- Authorization code exchange
- Access token retrieval
- Shop information fetching
- Customer record creation
- Initial data sync

## Step 5: Webhook Configuration

### 5.1 Etsy Webhook Limitations
**Important**: Etsy doesn't provide traditional webhooks like Shopify. Instead, we implement:

1. **Polling-based updates** - Regular API calls to check for changes
2. **Notification handling** - Process Etsy's notification system
3. **Manual sync triggers** - API endpoints for manual synchronization

### 5.2 Webhook Endpoints
The webhook handler (`/api/etsy/webhooks`) processes:
- `receipt_created` - New orders
- `receipt_updated` - Order status changes
- `listing_updated` - Product changes
- `inventory_updated` - Stock level changes

### 5.3 Alternative: Scheduled Sync
For real-time updates, implement a cron job:

```typescript
// Example: Sync every 15 minutes
export async function scheduledEtsySync() {
  const etsyService = new EtsyService(shopId, accessToken, refreshToken);
  await etsyService.syncOrders(customerId);
  await etsyService.syncInventoryLevels(customerId);
}
```

## Step 6: Testing the Integration

### 6.1 Test Etsy OAuth
1. Navigate to your dashboard
2. Click "Connect Etsy Shop"
3. Enter your Etsy shop ID
4. Complete the OAuth flow
5. Verify successful connection

### 6.2 Test Product Sync
1. After successful OAuth, products should automatically sync
2. Check the logs for sync progress
3. Verify products appear in your database

### 6.3 Test Inventory Updates
1. Update inventory in Etsy
2. Trigger manual sync or wait for scheduled sync
3. Verify inventory updates in your dashboard

## Step 7: Combined Inventory Management

### 7.1 Cross-Platform Sync
The `CombinedInventoryService` provides:
- Unified inventory view across platforms
- Automatic inventory synchronization
- Cross-platform product mapping
- Inventory summary and analytics

### 7.2 API Endpoints
- `GET /api/inventory/combined` - Get combined inventory
- `POST /api/inventory/combined` - Update inventory across platforms
- `PUT /api/inventory/combined` - Sync between platforms

### 7.3 Product Mapping
Link products across platforms using:
- SKU matching
- Product name matching
- Manual mapping interface

## Step 8: Production Deployment

### 8.1 Update App URLs
- Change all URLs from development to production domains
- Update webhook endpoints to use HTTPS
- Verify all environment variables are set

### 8.2 Security Considerations
- Implement proper OAuth state validation
- Use environment-specific API keys
- Monitor API rate limits (Etsy has strict limits)
- Implement proper error handling and logging

### 8.3 Rate Limiting
Etsy API has rate limits:
- **Standard**: 10 requests per second
- **Production**: 100 requests per second (requires approval)
- **Bulk operations**: Limited to specific endpoints

## Step 9: Monitoring and Maintenance

### 9.1 API Usage Monitoring
Track your Etsy API usage:
- Monitor rate limit headers
- Log API response times
- Track error rates and types

### 9.2 Data Synchronization
Regular maintenance tasks:
- Daily inventory sync
- Weekly product sync
- Monthly order data cleanup
- Token refresh monitoring

### 9.3 Error Handling
Common issues and solutions:
- **Token expiration**: Automatic refresh handling
- **API rate limits**: Implement exponential backoff
- **Network errors**: Retry logic with jitter
- **Data inconsistencies**: Validation and reconciliation

## Troubleshooting

### Common Issues

#### 1. OAuth Errors
- Verify client ID and secret are correct
- Check redirect URI matches exactly
- Ensure scopes are properly configured
- Verify PKCE implementation

#### 2. API Rate Limits
- Implement request queuing
- Use exponential backoff
- Monitor rate limit headers
- Consider upgrading to production API limits

#### 3. Data Sync Issues
- Check access token validity
- Verify shop ID is correct
- Monitor API response errors
- Check database connection and permissions

#### 4. Webhook Issues
- Etsy doesn't support traditional webhooks
- Implement polling-based updates
- Use scheduled sync jobs
- Monitor notification delivery

### Debug Mode
Enable detailed logging:

```bash
NODE_ENV=development
DEBUG=etsy:*
```

## Support and Resources

### Etsy Developer Resources
- [Etsy API Documentation](https://developers.etsy.com/documentation/)
- [API Reference](https://developers.etsy.com/documentation/reference)
- [OAuth Guide](https://developers.etsy.com/documentation/essentials/authentication/)
- [Rate Limiting](https://developers.etsy.com/documentation/essentials/rate-limiting/)

### Community Support
- Etsy Developer Forums
- Stack Overflow (etsy-api tag)
- GitHub Issues (for your project)

## Next Steps

After successful setup:
1. **Customize the dashboard** for multi-platform support
2. **Implement advanced product mapping** between platforms
3. **Add inventory forecasting** and analytics
4. **Consider additional platforms** (WooCommerce, Amazon, etc.)
5. **Implement automated inventory optimization**

## Security Notes

- Never expose API keys in client-side code
- Use environment variables for all sensitive data
- Implement proper OAuth state validation
- Monitor for suspicious API usage patterns
- Regularly rotate access tokens
- Implement proper user authentication and authorization

## Performance Optimization

- Cache frequently accessed data
- Implement batch operations where possible
- Use database indexes for common queries
- Monitor query performance
- Implement connection pooling
- Use background jobs for heavy operations
