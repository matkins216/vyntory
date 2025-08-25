# Pay Gate System

A comprehensive pay gate system that checks if users are authorized based on their paid plan in the Connect customer database.

## 🏗️ **Architecture Overview**

The pay gate system consists of:

1. **Database Layer** - `connect_customers` table storing subscription data
2. **Service Layer** - `ConnectCustomerService` for business logic
3. **API Layer** - Endpoints for authorization checks
4. **Middleware** - Server-side authorization checks
5. **React Hooks** - Client-side authorization management
6. **React Components** - UI components for pay gates

## 🗄️ **Database Setup**

Run the migration to create the required table:

```bash
# Run the migration
supabase db push
```

This creates the `connect_customers` table with:
- Stripe account and customer IDs
- Subscription status and plan information
- Feature limits and trial information
- Automatic timestamp updates

## 🔧 **Environment Variables**

Add these to your `.env.local`:

```bash
# Pay Gate Webhook Secret (create in Stripe Dashboard)
STRIPE_PAY_GATE_WEBHOOK_SECRET=whsec_xxx

# Existing Stripe variables
STRIPE_SECRET_KEY=sk_xxx
STRIPE_PUBLISHABLE_KEY=pk_xxx
STRIPE_CLIENT_ID=ca_xxx
```

## 🚀 **Quick Start**

### 1. **Protect a Route with Pay Gate**

```tsx
import { PayGate } from '@/components/PayGate';

function ProtectedFeature({ stripeAccountId }: { stripeAccountId: string }) {
  return (
    <PayGate 
      stripeAccountId={stripeAccountId}
      requireActiveSubscription={true}
      allowTrial={true}
    >
      <div>This feature requires an active subscription</div>
    </PayGate>
  );
}
```

### 2. **Check Feature Access**

```tsx
import { FeatureGate } from '@/components/PayGate';

function AdvancedFeature({ stripeAccountId }: { stripeAccountId: string }) {
  return (
    <FeatureGate 
      stripeAccountId={stripeAccountId}
      feature="max_products"
    >
      <div>You can create up to {customer.plan_features.max_products} products</div>
    </FeatureGate>
  );
}
```

### 3. **Use React Hooks**

```tsx
import { usePayGate, useSubscriptionLimits } from '@/lib/hooks/usePayGate';

function MyComponent({ stripeAccountId }: { stripeAccountId: string }) {
  const { isAuthorized, isLoading, customer } = usePayGate({
    stripeAccountId,
    requireActiveSubscription: true
  });

  const { limits, isTrial, trialDaysLeft } = useSubscriptionLimits(stripeAccountId);

  if (isLoading) return <div>Loading...</div>;
  if (!isAuthorized) return <div>Subscription required</div>;

  return (
    <div>
      <h2>Welcome, {customer?.company_name}</h2>
      <p>Plan: {customer?.plan_name}</p>
      {isTrial && <p>Trial ends in {trialDaysLeft} days</p>}
    </div>
  );
}
```

## 🛡️ **Server-Side Protection**

### **API Route Protection**

```typescript
import { checkPayGateAuthorization } from '@/lib/middleware/pay-gate';

export async function GET(request: NextRequest) {
  const stripeAccountId = request.headers.get('x-stripe-account-id');
  
  if (!stripeAccountId) {
    return NextResponse.json({ error: 'Account ID required' }, { status: 400 });
  }

  const authResult = await checkPayGateAuthorization(request, stripeAccountId, {
    requireActiveSubscription: true,
    allowTrial: false
  });

  if (!authResult.isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  // Continue with protected logic
  return NextResponse.json({ data: 'Protected data' });
}
```

### **Middleware Function**

```typescript
import { createPayGateMiddleware } from '@/lib/middleware/pay-gate';

const payGateMiddleware = createPayGateMiddleware({
  redirectTo: '/dashboard/subscription',
  requireActiveSubscription: true,
  allowTrial: true
});

// Use in your route handlers
const redirect = await payGateMiddleware(request, stripeAccountId);
if (redirect) return redirect;
```

## 📡 **Webhook Setup**

### **1. Create Webhook in Stripe Dashboard**

Go to **Developers > Webhooks** and create a new endpoint:

- **URL**: `https://yourdomain.com/api/pay-gate/webhook`
- **Events**: 
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_succeeded`
  - `invoice.payment_failed`

### **2. Get Webhook Secret**

Copy the webhook signing secret and add it to your environment variables.

### **3. Test Webhook**

The webhook will automatically:
- Create/update customer records
- Sync subscription status
- Update trial information
- Handle payment failures

## 🎯 **Usage Examples**

### **Basic Pay Gate**

```tsx
<PayGate stripeAccountId={accountId}>
  <ExpensiveFeature />
</PayGate>
```

### **Feature-Specific Gate**

```tsx
<FeatureGate 
  stripeAccountId={accountId} 
  feature="max_products"
  fallback={<UpgradePrompt />}
>
  <ProductManager />
</FeatureGate>
```

### **Subscription Status Display**

```tsx
<SubscriptionStatus stripeAccountId={accountId} />
```

### **Custom Fallback**

```tsx
<PayGate 
  stripeAccountId={accountId}
  fallback={
    <div className="bg-red-100 p-4 rounded">
      <h3>Access Denied</h3>
      <p>Please upgrade your subscription to continue.</p>
    </div>
  }
>
  <PremiumFeature />
</PayGate>
```

## 🔍 **Monitoring & Debugging**

### **Check Authorization Status**

```typescript
// API endpoint: POST /api/pay-gate/check
const response = await fetch('/api/pay-gate/check', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-stripe-account-id': stripeAccountId
  },
  body: JSON.stringify({
    requireActiveSubscription: true,
    allowTrial: true
  })
});

const result = await response.json();
console.log('Authorization:', result.isAuthorized);
console.log('Reason:', result.reason);
```

### **Database Queries**

```sql
-- Check all active customers
SELECT * FROM connect_customers 
WHERE is_active = true 
AND subscription_status IN ('active', 'trialing');

-- Check subscription status
SELECT stripe_account_id, subscription_status, plan_name 
FROM connect_customers 
WHERE stripe_account_id = 'acct_xxx';
```

## 🚨 **Troubleshooting**

### **Common Issues**

1. **"Customer not found in database"**
   - Ensure webhook is properly configured
   - Check if customer was created during Stripe Connect onboarding

2. **"No Stripe account ID provided"**
   - Verify `x-stripe-account-id` header is set
   - Check if account ID is being passed correctly

3. **Webhook not syncing data**
   - Verify webhook secret is correct
   - Check webhook endpoint is accessible
   - Ensure proper events are selected

### **Debug Steps**

1. Check webhook logs in Stripe Dashboard
2. Verify database records exist
3. Test authorization endpoint directly
4. Check environment variables
5. Verify Stripe account permissions

## 🔄 **Integration with Existing Code**

The pay gate system integrates seamlessly with your existing Stripe Connect flow:

1. **During Connect onboarding** - Create customer record
2. **When subscription changes** - Webhook updates status
3. **In your components** - Use PayGate components
4. **In your API routes** - Use middleware functions

## 📚 **API Reference**

### **ConnectCustomerService**

- `createOrUpdateCustomer()` - Create or update customer record
- `checkPayGateAuthorization()` - Check if customer is authorized
- `updateSubscriptionStatus()` - Update subscription status
- `getActiveCustomers()` - Get all active customers

### **React Hooks**

- `usePayGate()` - Main authorization hook
- `useFeatureAccess()` - Check specific feature access
- `useSubscriptionLimits()` - Get subscription limits

### **Components**

- `PayGate` - Main pay gate component
- `FeatureGate` - Feature-specific gate
- `SubscriptionStatus` - Display subscription info

This pay gate system provides comprehensive subscription management and access control for your Stripe Connect application! 🎉
