'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Package, Shield, Zap, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';
import Script from 'next/script';

function HomeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    // Check for OAuth errors
    const error = searchParams.get('error');
    if (error) {
      toast.error(`Connection failed: ${error}`);
    }

    // Check for successful connection
    const account = searchParams.get('account');
    if (account) {
      toast.success('Successfully connected to Stripe!');
      router.push(`/dashboard?account=${account}`);
    }
  }, [searchParams, router]);

  const handleConnectStripe = async () => {
    setIsConnecting(true);
    try {
      // Redirect to Stripe OAuth
      window.location.href = '/api/stripe/auth';
    } catch {
      toast.error('Failed to connect to Stripe');
      setIsConnecting(false);
    }
  };

  const features = [
    {
      icon: Package,
      title: 'Product Catalog Management',
      description: 'View and organize all your Stripe products in one centralized dashboard'
    },
    {
      icon: BarChart3,
      title: 'Real-time Inventory Tracking',
      description: 'Monitor stock levels with automatic updates and comprehensive audit logs'
    },
    {
      icon: Zap,
      title: 'Automatic Inventory Updates',
      description: 'Inventory automatically adjusts when customers make purchases via webhooks'
    },
    {
      icon: Shield,
      title: 'Smart Product Control',
      description: 'Products automatically disable when out of stock and re-enable when restocked'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <Package className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Vyntory</h1>
                <p className="text-sm text-gray-600">Stripe Inventory Management</p>
              </div>
            </div>
            <div className="flex space-x-4">
              <Button
                onClick={handleConnectStripe}
                disabled={isConnecting}
                size="lg"
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                {isConnecting ? 'Connecting...' : 'Connect Stripe Account'}
              </Button>
              <Button
                onClick={() => window.location.href = '/api/shopify/auth?shop=your-store.myshopify.com'}
                size="lg"
                variant="outline"
                className="border-green-600 text-green-600 hover:bg-green-600 hover:text-white"
              >
                Connect Shopify Store
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-5xl font-bold text-gray-900 mb-6">
            Manage Your Products
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
              Across All Platforms
            </span>
          </h2>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Connect your Stripe and Shopify accounts for unified inventory management. 
            Track stock levels, manage product availability, and maintain comprehensive audit logs—all in one place.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              onClick={handleConnectStripe}
              disabled={isConnecting}
              size="lg"
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-lg px-8 py-6"
            >
              {isConnecting ? 'Connecting...' : 'Get Started with Stripe'}
            </Button>
            <Button variant="outline" size="lg" className="text-lg px-8 py-6">
              Learn More
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h3 className="text-3xl font-bold text-gray-900 mb-4">
              Everything You Need to Manage Your Inventory
            </h3>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Our platform provides comprehensive tools to help you stay on top of your product catalog 
              and inventory management needs.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="text-center border-0 shadow-lg hover:shadow-xl transition-shadow">
                <CardContent className="pt-8">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <feature.icon className="w-8 h-8 text-blue-600" />
                  </div>
                  <h4 className="text-xl font-semibold text-gray-900 mb-3">{feature.title}</h4>
                  <p className="text-gray-600">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h3 className="text-3xl font-bold text-gray-900 mb-4">How It Works</h3>
            <p className="text-lg text-gray-600">
              Get started in just a few simple steps
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl font-bold text-white">1</span>
              </div>
              <h4 className="text-xl font-semibold text-gray-900 mb-3">Connect Your Stripe Account</h4>
              <p className="text-gray-600">
                Securely connect your existing Stripe account using OAuth. No need to create new accounts or transfer data.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl font-bold text-white">2</span>
              </div>
              <h4 className="text-xl font-semibold text-gray-900 mb-3">View Your Products</h4>
              <p className="text-gray-600">
                Instantly see all your Stripe products with current inventory levels, pricing, and status information.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl font-bold text-white">3</span>
              </div>
              <h4 className="text-xl font-semibold text-gray-900 mb-3">Manage Inventory</h4>
              <p className="text-gray-600">
                Update stock levels manually or let our webhooks automatically adjust inventory when sales occur.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h3 className="text-3xl font-bold text-gray-900 mb-4">Simple, Transparent Pricing</h3>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Choose the plan that fits your business needs. All plans include our core inventory management features.
            </p>
          </div>
          
          <div className="max-w-4xl mx-auto">
            <div 
              id="stripe-pricing-table"
              dangerouslySetInnerHTML={{
                __html: `<stripe-pricing-table 
                  pricing-table-id="prctbl_1S0n66BqHlHh50zYnSKUdUmQ"
                  publishable-key="pk_live_51OE47TBqHlHh50zYanbqxXkLgAshhxY2n4mkYZ71EKhrq4EylXanvBv1f7sCNHpR655EHQG79qGISXRq367UbYJ40084gcgeCk">
                </stripe-pricing-table>`
              }}
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="container mx-auto px-4 text-center">
          <div className="flex items-center justify-center space-x-3 mb-6">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
              <Package className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold">Vyntory</span>
          </div>
          <p className="text-gray-400 mb-6">
            Powerful inventory management for your Stripe products
          </p>
          <div className="flex items-center justify-center space-x-6 text-sm text-gray-400">
            <span>Built with Next.js & Stripe</span>
            <span>•</span>
            <span>Secure OAuth Integration</span>
            <span>•</span>
            <span>Real-time Updates</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function Home() {
  return (
    <>
      <Script 
        src="https://js.stripe.com/v3/pricing-table.js" 
        strategy="beforeInteractive"
      />
      <Suspense fallback={<div>Loading...</div>}>
        <HomeContent />
      </Suspense>
    </>
  );
}
