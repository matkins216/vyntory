# Vyntory - Stripe Inventory Management

A powerful, modern web application for managing Stripe product inventory with real-time tracking, comprehensive audit logs, and automatic product control.

## 🚀 Features

- **🔐 Stripe OAuth Integration** - Connect existing Stripe accounts securely
- **📦 Product Catalog Management** - View and organize all your Stripe products
- **📊 Real-time Inventory Tracking** - Monitor stock levels with live updates
- **🔄 Automatic Inventory Updates** - Webhook-driven inventory adjustments on purchases
- **📝 Comprehensive Audit Logs** - Track every inventory change with timestamps and reasons
- **⚡ Smart Product Control** - Products automatically disable when out of stock
- **📱 Mobile-First Design** - Responsive UI optimized for all devices
- **🎨 Modern UI/UX** - Built with shadcn/ui and Tailwind CSS

## 🛠️ Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **Styling**: Tailwind CSS 4, shadcn/ui components
- **Backend**: Next.js API routes
- **Payment**: Stripe API with OAuth integration
- **State Management**: React hooks with local state
- **Notifications**: Sonner toast notifications

## 📱 Responsive Design

The application is built with a mobile-first approach and includes breakpoints for:
- **Mobile**: 320px - 767px
- **Tablet**: 768px - 1023px  
- **Desktop**: 1024px+
- **Large Desktop**: 1280px+

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Stripe account with API access

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd vyntory
npm install
```

### 2. Environment Setup

Create a `.env.local` file in the root directory:

```env
# Stripe Configuration
STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
STRIPE_SECRET_KEY=sk_test_your_secret_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here

# App Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_nextauth_secret_here

# Stripe OAuth
STRIPE_CLIENT_ID=ca_your_client_id_here
```

### 3. Stripe Configuration

1. **Get API Keys**: Visit [Stripe Dashboard](https://dashboard.stripe.com/apikeys)
2. **Create OAuth App**: Go to [Stripe Connect](https://dashboard.stripe.com/connect/applications)
3. **Set Redirect URI**: Add `http://localhost:3000/api/stripe/callback` to your OAuth app
4. **Get Client ID**: Copy your Connect application's client ID

### 4. Webhook Setup

1. Go to [Stripe Webhooks](https://dashboard.stripe.com/webhooks)
2. Create endpoint: `http://localhost:3000/api/stripe/webhook`
3. Select events: `checkout.session.completed`, `payment_intent.succeeded`
4. Copy the webhook secret to your `.env.local`

### 5. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 🔧 API Endpoints

### Authentication
- `GET /api/stripe/auth` - Initiates Stripe OAuth flow
- `GET /api/stripe/callback` - Handles OAuth callback

### Products
- `GET /api/products?account={accountId}` - Fetch products with inventory
- `PATCH /api/products/{id}/inventory` - Update product inventory

### Webhooks
- `POST /api/stripe/webhook` - Handles Stripe webhook events

## 📊 Inventory Management

### Metadata Structure

Inventory data is stored in Stripe product metadata using this JSON structure:

```json
{
  "inventory": 100,
  "lastUpdated": "2024-01-15T10:30:00Z",
  "lastUpdatedBy": "user_123",
  "auditLog": [
    {
      "action": "manual_adjustment",
      "quantity": 100,
      "previousQuantity": 95,
      "timestamp": "2024-01-15T10:30:00Z",
      "userId": "user_123",
      "reason": "Restock"
    }
  ]
}
```

### Automatic Features

- **Zero Inventory**: Products automatically disable when inventory reaches 0
- **Restock**: Products re-enable when inventory is restored above 0
- **Purchase Tracking**: Inventory automatically decreases on successful purchases
- **Audit Logging**: Every change is logged with timestamp, user, and reason

## 🎨 UI Components

Built with shadcn/ui components:
- Cards, Buttons, Inputs, Labels
- Modals, Tabs, Badges
- Responsive grid layouts
- Toast notifications

## 📱 Mobile Optimization

- Touch-friendly interface
- Responsive grid layouts
- Optimized for small screens
- Tablet-specific breakpoints
- Desktop enhancements

## 🔒 Security Features

- Stripe OAuth for secure account connection
- Webhook signature verification
- No sensitive data stored locally
- Secure API endpoints

## 🚀 Deployment

### Vercel (Recommended)

1. Connect your GitHub repository
2. Set environment variables
3. Deploy with automatic builds

### Other Platforms

- Set `NEXTAUTH_URL` to your production domain
- Configure Stripe webhook endpoints
- Update OAuth redirect URIs

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:
- Check the [Stripe Documentation](https://stripe.com/docs)
- Review [Next.js Documentation](https://nextjs.org/docs)
- Open an issue in this repository

## 🔮 Future Enhancements

- User authentication and roles
- Advanced inventory analytics
- Bulk inventory operations
- Integration with other platforms
- Mobile app development
- Advanced reporting and exports

---

Built with ❤️ using Next.js, Stripe, and modern web technologies.
