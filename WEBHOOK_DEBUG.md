# Webhook Debugging Guide

## Issues Identified and Fixed

### 1. Missing Line Items Data
**Problem**: Stripe webhooks don't include `line_items` by default
**Solution**: Added `stripe.checkout.sessions.retrieve()` with expansion to get line items

### 2. Wrong Stripe Account Context
**Problem**: Webhook was trying to access products from main account instead of connected accounts
**Solution**: Added logic to extract connected account ID from webhook event

### 3. Missing Error Handling
**Problem**: No logging to debug webhook execution
**Solution**: Added comprehensive logging throughout the webhook handler

### 4. Connected Account Webhook Configuration
**Problem**: Webhooks need to be configured to listen to connected account events
**Solution**: Webhook now extracts account ID from event and operates in correct context

## How to Debug

### 1. Test Webhook Endpoint
```bash
# Test if webhook is accessible
curl http://localhost:3000/api/stripe/webhook
```

### 2. Check Environment Variables
Ensure these are set in `.env.local`:
```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### 3. Verify Stripe Webhook Configuration
1. Go to [Stripe Dashboard > Webhooks](https://dashboard.stripe.com/webhooks)
2. Check that your webhook endpoint is configured
3. Ensure `checkout.session.completed` event is selected
4. Verify the webhook secret matches your `.env.local`

### 4. Monitor Webhook Logs
The webhook now includes extensive logging. Check your console/terminal for:
- Webhook received events
- Account context information
- Session processing details
- Inventory update operations

### 5. Test with Stripe CLI
```bash
# Install Stripe CLI
stripe listen --forward-to localhost:3000/api/stripe/webhook

# In another terminal, trigger a test event
stripe trigger checkout.session.completed
```

## CRITICAL: Connected Account Webhook Setup

For webhooks to work with connected accounts, you need to configure them properly:

### Option 1: Stripe Connect Webhooks (Recommended - No Customer Setup Required)
1. In your **main account**, go to **Connect > Settings**
2. **Enable webhooks for connected accounts**
3. **Add your webhook endpoint**: `http://localhost:3000/api/stripe/webhook`
4. **Select ALL these events** for comprehensive coverage:
   - `checkout.session.completed` (ecommerce checkouts)
   - `invoice.payment_succeeded` (invoiced sales) ⭐ **RECOMMENDED**
   - `payment_intent.succeeded` (direct payments)
   - `charge.succeeded` (one-time charges)
   - `customer.subscription.created` (new subscriptions)
   - `customer.subscription.updated` (subscription changes)
   - `payment_link.created` (payment link creation)
   - `payment_link.updated` (payment link updates)
   - `payment_intent.payment_failed` (failed payments - no inventory change)
   - `invoice.payment_failed` (failed invoices - no inventory change)
   - `charge.failed` (failed charges - no inventory change)
5. This automatically routes events from all connected accounts to your webhook

### Option 2: Automatic Account Detection (No Customer Setup Required)
The webhook now automatically detects connected accounts using multiple methods:
1. **Webhook event account field** (if available)
2. **Payment intent transfer data** (most reliable)
3. **Product lookup across known accounts** (fallback)

To use this approach:
1. Set `DEFAULT_CONNECTED_ACCOUNT_ID` in your `.env.local` if you have a default account
2. The webhook will automatically find the correct account for each purchase
3. No customer configuration needed

### Option 3: Account-Specific Webhooks (Requires Customer Setup)
1. Go to your connected account dashboard
2. Navigate to Webhooks
3. Create a webhook endpoint pointing to your app
4. Select `checkout.session.completed` events
5. This ensures webhooks come from the connected account

## 🎯 **Comprehensive Purchase Coverage**

Your webhook now handles **ALL types of purchases**:

### **🛒 Ecommerce & Checkout**
- `checkout.session.completed` - Standard ecommerce checkouts

### **📄 Invoiced Sales**
- `invoice.payment_succeeded` - Complete line items with quantities ⭐ **BEST**

### **💳 Direct Payments**
- `payment_intent.succeeded` - Direct payment intents
- `charge.succeeded` - One-time charges

### **🔄 Subscriptions**
- `customer.subscription.created` - New subscriptions
- `customer.subscription.updated` - Subscription changes

### **❌ Failed Payments**
- `payment_intent.payment_failed` - No inventory change
- `invoice.payment_failed` - No inventory change
- `charge.failed` - No inventory change

## 📋 **Webhook Event Priority**

1. **`invoice.payment_succeeded`** - Best for inventory (complete line items + expanded data)
2. **`customer.subscription.created/updated`** - Best for recurring sales (expanded features)
3. **`payment_intent.succeeded`** - Good fallback (uses dedicated line items endpoint)
4. **`checkout.session.completed`** - Enhanced with dedicated line items endpoint
5. **`payment_link.created/updated`** - Payment link line items via dedicated endpoint
6. **`charge.succeeded`** - Good for direct charges (expanded product data)

## 🎯 **Why `invoice.payment_succeeded` is Better**

The `checkout.session.completed` webhook has limitations:
- ❌ Line items not included by default
- ❌ Quantity information may be missing
- ❌ Requires additional API calls to get complete data

The `invoice.payment_succeeded` webhook provides:
- ✅ Complete line item details
- ✅ Accurate quantity information
- ✅ Product IDs and pricing
- ✅ Connected account context
- ✅ More reliable inventory updates

## Common Issues

### Issue: "No connected account ID found in webhook event"
**Cause**: Webhook is not configured for connected accounts
**Solutions**:
1. Configure webhook in the connected account dashboard
2. Use Stripe Connect webhook settings
3. Check if webhook includes account information

### Issue: "Cannot determine connected account"
**Cause**: Multiple fallback methods failed to find account ID
**Solutions**:
1. Configure webhook in connected account
2. Check webhook event structure for account information
3. Verify Stripe Connect setup

### Issue: "Webhook signature verification failed"
**Cause**: Mismatched webhook secret
**Solutions**:
1. Verify `STRIPE_WEBHOOK_SECRET` in `.env.local`
2. Check webhook endpoint configuration in Stripe Dashboard
3. Ensure no extra whitespace in environment variable

### Issue: "Inventory not decrementing"
**Cause**: Webhook is not operating in the correct account context
**Solutions**:
1. Verify webhook is configured for connected account
2. Check console logs for account ID extraction
3. Test with webhook-test endpoint

## Testing Steps

1. **Start your development server**
   ```bash
   npm run dev
   ```

2. **Test webhook endpoint**
   ```bash
   curl http://localhost:3000/api/stripe/webhook
   ```

3. **Test inventory update** (using the test endpoint):
   ```bash
   curl -X POST http://localhost:3000/api/stripe/webhook-test \
     -H "Content-Type: application/json" \
     -d '{"productId":"prod_...","accountId":"acct_...","quantity":1}'
   ```

4. **Create a test checkout session** in the connected account

5. **Monitor console logs** for webhook execution

6. **Check product inventory** before and after checkout

## Expected Webhook Flow

1. `checkout.session.completed` event received from connected account
2. Webhook extracts `event.account` (connected account ID)
3. Session retrieved with expanded line items
4. Each product's inventory reduced by purchased quantity
5. Product metadata updated in connected account
6. Audit log created
7. Product disabled if inventory reaches 0

## Troubleshooting Commands

```bash
# Check if webhook is accessible
curl -X GET http://localhost:3000/api/stripe/webhook

# Test inventory update
curl -X POST http://localhost:3000/api/stripe/webhook-test \
  -H "Content-Type: application/json" \
  -d '{"productId":"prod_...","accountId":"acct_...","quantity":1}'

# Check environment variables
echo $STRIPE_WEBHOOK_SECRET

# Monitor webhook logs
tail -f your-app.log | grep webhook

# Test Stripe connection
node -e "const stripe = require('stripe')('sk_test_...'); stripe.products.list().then(console.log)"
```

## Webhook Configuration Checklist

- [ ] Webhook endpoint configured in Stripe Dashboard
- [ ] `checkout.session.completed` event selected
- [ ] Webhook secret copied to `.env.local`
- [ ] Webhook configured for connected account (if using account-specific webhooks)
- [ ] Webhook endpoint accessible from Stripe servers
- [ ] Console logging enabled to monitor webhook execution

## 🚨 **Troubleshooting: Live Session Retrieval Errors**

### Error: "No such checkout.session: cs_live_..."
This error occurs when the webhook receives a live Stripe event but can't retrieve the session details.

#### **Common Causes:**

1. **Account Context Mismatch**
   - The webhook is running in your main account
   - The session belongs to a connected account
   - Your main account doesn't have access to the connected account's sessions

2. **Webhook Configuration Issues**
   - Webhook is configured for main account only
   - Missing Stripe Connect webhook settings
   - Webhook not configured for connected accounts

3. **Session Access Permissions**
   - Session has expired (checkout sessions expire after 24 hours)
   - Session was deleted
   - Missing API permissions

#### **Solutions:**

1. **Configure Stripe Connect Webhooks (Recommended)**
   ```bash
   # In your main Stripe Dashboard:
   # 1. Go to Connect > Settings
   # 2. Enable "Webhooks for connected accounts"
   # 3. Add your webhook endpoint
   # 4. Select events: invoice.payment_succeeded, payment_intent.succeeded
   ```

2. **Use Invoice Webhooks Instead**
   - `invoice.payment_succeeded` includes complete line items
   - No need to retrieve checkout sessions
   - More reliable for inventory management

3. **Check Webhook Account Context**
   - Ensure webhook is configured for connected accounts
   - Verify `event.account` contains the connected account ID
   - Check webhook endpoint permissions

#### **Debugging Steps:**

1. **Check Webhook Event Structure:**
   ```bash
   # Look for these fields in webhook logs:
   - event.account (should contain connected account ID)
   - event.type (should be invoice.payment_succeeded)
   - event.data.object.lines.data (should contain line items)
   ```

2. **Test with Invoice Webhook:**
   ```bash
   # Configure webhook for invoice.payment_succeeded
   # This eliminates the session retrieval issue
   ```

3. **Verify Account Access:**
   ```bash
   # Check if your main account can access connected accounts
   # Test with a simple API call
   ```

## 🚀 **Stripe API Version 730 (2025-07-30.basil) Features**

Your webhook now uses the latest Stripe API version with enhanced features:

### **Enhanced Data Expansion**
- **`default_price`** - Get the product's default pricing
- **`metadata`** - Access all product metadata including inventory
- **`features`** - Product features and capabilities
- **`tax_code`** - Tax classification information
- **`recurring`** - Subscription pricing details
- **`currency_options`** - Multi-currency pricing options

### **Improved Session Retrieval**
- **Better line items expansion** for checkout sessions
- **Enhanced payment intent data** with transfer information
- **Setup intent support** for subscription flows

### **Advanced Account Detection**
- **Transfer data expansion** for connected accounts
- **Latest charge information** for payment tracking
- **Better error handling** for account context issues

## 🎯 **Dedicated Line Items Endpoints**

Your webhook now uses the proper Stripe API endpoints for accessing product quantities:

### **Checkout Sessions Line Items**
- **Endpoint**: `stripe.checkout.sessions.listLineItems(sessionId)`
- **Documentation**: [Checkout Sessions Line Items API](https://docs.stripe.com/api/checkout/sessions/line_items?api-version=2025-07-30.basil)
- **Benefits**: Direct access to line items with quantities, no expansion needed

### **Payment Links Line Items**
- **Endpoint**: `stripe.paymentLinks.listLineItems(paymentLinkId)`
- **Documentation**: [Payment Links Line Items API](https://docs.stripe.com/api/payment-link/retrieve-line-items?api-version=2025-07-30.basil)
- **Benefits**: Complete line item data for payment link purchases

### **Fallback Methods**
- **Expand method**: Used when dedicated endpoints fail
- **Session retrieval**: Backup for complex scenarios
- **Error handling**: Graceful degradation for edge cases
