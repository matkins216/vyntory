# 🚀 Quick Setup Guide

## 1. Copy Environment File
```bash
cp .env.example .env.local
```

## 2. Get Your Stripe Keys
1. Go to [Stripe Dashboard](https://dashboard.stripe.com/apikeys)
2. Copy your **Publishable Key** (starts with `pk_test_`)
3. Copy your **Secret Key** (starts with `sk_test_`)

## 3. Create Stripe OAuth App
1. Go to [Stripe Connect](https://dashboard.stripe.com/connect/applications)
2. Click "Create application"
3. Set **Redirect URI** to: `http://localhost:3000/api/stripe/callback`
4. Copy your **Client ID** (starts with `ca_`)

## 4. Set Up Webhooks
1. Go to [Stripe Webhooks](https://dashboard.stripe.com/webhooks)
2. Click "Add endpoint"
3. Set **Endpoint URL** to: `http://localhost:3000/api/stripe/webhook`
4. Select events: `checkout.session.completed`, `payment_intent.succeeded`
5. Copy the **Webhook secret** (starts with `whsec_`)

## 5. Generate NextAuth Secret
```bash
openssl rand -base64 32
```

## 6. Update .env.local
Fill in all the values you copied above.

## 7. Start the App
```bash
npm run dev
```

## 8. Test OAuth
1. Open http://localhost:3000
2. Click "Connect Stripe Account"
3. Complete OAuth flow
4. You'll be redirected to your dashboard!

## 🔧 Troubleshooting

- **OAuth Error**: Check your redirect URI matches exactly
- **Webhook Error**: Verify webhook secret is correct
- **API Error**: Ensure your Stripe keys are valid
- **Port Issues**: Change port in .env.local if 3000 is busy

## 📱 Test Responsive Design
- Mobile: 320px - 767px
- Tablet: 768px - 1023px
- Desktop: 1024px+
