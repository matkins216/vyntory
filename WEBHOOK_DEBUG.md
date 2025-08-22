# Webhook Debugging Guide

## Issues Identified and Fixed

### 1. Missing Line Items Data
**Problem**: Stripe webhooks don't include `line_items` by default
**Solution**: Added `stripe.checkout.sessions.retrieve()` with expansion to get line items

### 2. Wrong Stripe Account Context
**Problem**: Webhook was trying to access products from main account instead of connected accounts
**Solution**: Added logic to extract connected account ID from session

### 3. Missing Error Handling
**Problem**: No logging to debug webhook execution
**Solution**: Added comprehensive logging throughout the webhook handler

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
- Session processing details
- Account ID extraction attempts
- Inventory update operations

### 5. Test with Stripe CLI
```bash
# Install Stripe CLI
stripe listen --forward-to localhost:3000/api/stripe/webhook

# In another terminal, trigger a test event
stripe trigger checkout.session.completed
```

## Common Issues

### Issue: "No connected account ID found"
**Cause**: Webhook can't determine which Stripe account the product belongs to
**Solutions**:
1. Check if products have `stripe_account_id` in metadata
2. Verify webhook is configured for the correct account
3. Ensure checkout sessions include account information

### Issue: "Cannot determine connected account"
**Cause**: Multiple fallback methods failed to find account ID
**Solutions**:
1. Add `stripe_account_id` to product metadata during creation
2. Check webhook event structure for account information
3. Verify Stripe Connect setup

### Issue: "Webhook signature verification failed"
**Cause**: Mismatched webhook secret
**Solutions**:
1. Verify `STRIPE_WEBHOOK_SECRET` in `.env.local`
2. Check webhook endpoint configuration in Stripe Dashboard
3. Ensure no extra whitespace in environment variable

## Testing Steps

1. **Start your development server**
   ```bash
   npm run dev
   ```

2. **Test webhook endpoint**
   ```bash
   curl http://localhost:3000/api/stripe/webhook
   ```

3. **Create a test checkout session** in Stripe Dashboard

4. **Monitor console logs** for webhook execution

5. **Check product inventory** before and after checkout

## Expected Webhook Flow

1. `checkout.session.completed` event received
2. Session retrieved with expanded line items
3. Connected account ID extracted
4. Each product's inventory reduced by purchased quantity
5. Product metadata updated
6. Audit log created
7. Product disabled if inventory reaches 0

## Troubleshooting Commands

```bash
# Check if webhook is accessible
curl -X GET http://localhost:3000/api/stripe/webhook

# Check environment variables
echo $STRIPE_WEBHOOK_SECRET

# Monitor webhook logs
tail -f your-app.log | grep webhook

# Test Stripe connection
node -e "const stripe = require('stripe')('sk_test_...'); stripe.products.list().then(console.log)"
```
