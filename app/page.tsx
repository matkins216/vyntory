'use client';

import { Button } from '@/components/ui/button';
import Script from 'next/script';
import { useState } from 'react';

export default function Home() {
  const [shopDomain, setShopDomain] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);

  const handleShopifyConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopDomain) return;

    setIsConnecting(true);
    
    // Clean the shop domain (remove http/https, add .myshopify.com if needed)
    let cleanDomain = shopDomain.toLowerCase().trim();
    if (cleanDomain.startsWith('http://') || cleanDomain.startsWith('https://')) {
      cleanDomain = cleanDomain.replace(/^https?:\/\//, '');
    }
    if (!cleanDomain.endsWith('.myshopify.com')) {
      cleanDomain = `${cleanDomain}.myshopify.com`;
    }

    // Redirect to Shopify OAuth
    window.location.href = `/api/shopify/auth?shop=${encodeURIComponent(cleanDomain)}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <Script
        src="https://js.stripe.com/v3/pricing-table.js"
        strategy="beforeInteractive"
      />
      
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">Vyntory</h1>
            </div>
            <div className="flex items-center space-x-4">
              <Button variant="outline">Sign In</Button>
              <Button>Get Started</Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 text-center">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            Multi-Platform Inventory Management
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Sync your products and inventory across Stripe and Shopify automatically. 
            Manage everything from one dashboard.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="bg-blue-600 hover:bg-blue-700">
              Start with Stripe
            </Button>
            <Button
              onClick={() => setShopDomain('')}
              size="lg"
              variant="outline"
              className="border-green-600 text-green-600 hover:bg-green-600 hover:text-white"
            >
              Connect Shopify Store
            </Button>
          </div>
        </div>
      </section>

      {/* Shopify Connection Section */}
      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Connect Your Shopify Store
            </h2>
            <p className="text-lg text-gray-600 mb-8">
              Sync your products and inventory automatically with our powerful integration
            </p>
            
            <form onSubmit={handleShopifyConnect} className="max-w-md mx-auto">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={shopDomain}
                  onChange={(e) => setShopDomain(e.target.value)}
                  placeholder="your-store"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  disabled={isConnecting}
                />
                <span className="flex items-center px-3 py-2 text-gray-500 bg-gray-50 border border-l-0 border-gray-300 rounded-r-md">
                  .myshopify.com
                </span>
              </div>
              
              <Button
                type="submit"
                size="lg"
                variant="outline"
                className="w-full mt-4 border-green-600 text-green-600 hover:bg-green-600 hover:text-white"
                disabled={isConnecting || !shopDomain}
              >
                {isConnecting ? 'Connecting...' : 'Connect Shopify Store'}
              </Button>
            </form>
            
            <p className="text-sm text-gray-500 mt-4">
              Enter your shop name (e.g., "mystore" for mystore.myshopify.com)
            </p>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-lg text-gray-600">
              Choose the plan that fits your business needs
            </p>
          </div>
          
          <div 
            dangerouslySetInnerHTML={{
              __html: `<stripe-pricing-table pricing-table-id="prctbl_1S0n66BqHlHh50zYnSKUdUmQ" publishable-key="pk_live_51OE47TBqHlHh50zYanbqxXkLgAshhxY2n4mkYZ71EKhrq4EylXanvBv1f7sCNHpR655EHQG79qGISXRq367UbYJ40084gcgeCk"></stripe-pricing-table>`
            }}
          />
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Why Choose Vyntory?
            </h2>
            <p className="text-lg text-gray-600">
              Powerful features to streamline your inventory management
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Real-time Sync</h3>
              <p className="text-gray-600">Keep your inventory updated across all platforms automatically</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Multi-Platform</h3>
              <p className="text-gray-600">Manage Stripe and Shopify from one unified dashboard</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Analytics</h3>
              <p className="text-gray-600">Get insights into your inventory performance and trends</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h3 className="text-2xl font-bold mb-4">Vyntory</h3>
            <p className="text-gray-400 mb-6">
              Streamline your inventory management across multiple platforms
            </p>
            <div className="flex justify-center space-x-6">
              <a href="#" className="text-gray-400 hover:text-white">Privacy</a>
              <a href="#" className="text-gray-400 hover:text-white">Terms</a>
              <a href="#" className="text-gray-400 hover:text-white">Support</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
