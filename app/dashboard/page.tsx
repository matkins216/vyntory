'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ProductCard } from '@/components/ProductCard';
import { InventoryModal } from '@/components/InventoryModal';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { Badge } from '@/components/ui/badge';
import { Package, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

interface Product {
  id: string;
  name: string;
  description: string;
  images: string[];
  active: boolean;
  inventory: {
    inventory: number;
    lastUpdated: string;
    lastUpdatedBy: string;
  };
  prices: Array<{
    id: string;
    currency: string;
    unit_amount: number;
    recurring?: {
      interval: string;
      interval_count?: number;
    };
  }>;
  created: number;
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const accountId = searchParams.get('account');
  const successMessage = searchParams.get('success');
  const errorMessage = searchParams.get('error');
  
  console.log('=== DASHBOARD COMPONENT RENDERED ===');
  console.log('🔍 Search params:', Object.fromEntries(searchParams.entries()));
  console.log('🔍 Account ID extracted:', accountId);
  console.log('🔍 Current URL:', window.location.href);
  
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [inventoryModalOpen, setInventoryModalOpen] = useState(false);

  // Handle success/error messages from OAuth flows
  useEffect(() => {
    if (successMessage) {
      switch (successMessage) {
        case 'etsy_connected':
          toast.success('🎉 Successfully connected to Etsy! Your shop is now syncing.');
          break;
        case 'shopify_connected':
          toast.success('🎉 Successfully connected to Shopify! Your store is now syncing.');
          break;
        case 'stripe_connected':
          toast.success('🎉 Successfully connected to Stripe! Your account is now active.');
          break;
        default:
          toast.success('✅ Operation completed successfully!');
      }
    }
    
    if (errorMessage) {
      switch (errorMessage) {
        case 'oauth_failed':
          toast.error('❌ Failed to connect. Please try again.');
          break;
        case 'token_exchange_failed':
          toast.error('❌ Authentication failed. Please try again.');
          break;
        case 'oauth_processing_failed':
          toast.error('❌ Connection processing failed. Please try again.');
          break;
        default:
          toast.error('❌ An error occurred. Please try again.');
      }
    }
  }, [successMessage, errorMessage]);

  const fetchProducts = useCallback(async () => {
    console.log('🔄 fetchProducts called with accountId:', accountId);
    
    if (!accountId) {
      console.log('❌ No accountId, skipping fetch');
      return;
    }
    
    const apiUrl = `/api/products?account=${accountId}`;
    console.log('🌐 Making API call to:', apiUrl);
    
    try {
      console.log('📡 Sending request to products API...');
      const response = await fetch(apiUrl);
      console.log('📡 Response received:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });
      
      const data = await response.json();
      console.log('📡 Response data:', data);
      
      if (data.error) {
        console.error('❌ API returned error:', data.error);
        toast.error('Failed to fetch products');
        return;
      }
      
      console.log(`✅ Successfully fetched ${data.products?.length || 0} products`);
      setProducts(data.products || []);
    } catch (error) {
      console.error('❌ Error in fetchProducts:', error);
      toast.error('Failed to fetch products');
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    console.log('🔧 useEffect triggered, accountId:', accountId);
    if (accountId) {
      console.log('✅ AccountId exists, calling fetchProducts');
      fetchProducts();
    } else {
      console.log('❌ No accountId, setting loading to false');
      setLoading(false);
    }
  }, [accountId, fetchProducts]);

  const handleInventoryUpdate = async (productId: string, newQuantity: number, reason: string) => {
    console.log('Dashboard: handleInventoryUpdate called with:', {
      productId,
      newQuantity,
      reason,
      accountId
    });
    
    try {
      const requestBody = {
        quantity: newQuantity,
        reason,
        userId: 'user_' + Date.now(), // In a real app, this would be the actual user ID
        accountId,
      };
      
      console.log('Dashboard: Sending request to:', `/api/products/${productId}/inventory`);
      console.log('Dashboard: Request body:', requestBody);
      
      const response = await fetch(`/api/products/${productId}/inventory`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      console.log('Dashboard: Response status:', response.status);
      
      const data = await response.json();
      console.log('Dashboard: Response data:', data);
      
      if (data.success) {
        toast.success('Inventory updated successfully');
        fetchProducts(); // Refresh products
        setInventoryModalOpen(false);
      } else {
        toast.error('Failed to update inventory');
      }
    } catch (error) {
      console.error('Dashboard: Error in handleInventoryUpdate:', error);
      toast.error('Failed to update inventory');
    }
  };

  const handleThresholdUpdate = async (productId: string, newThreshold: number) => {
    console.log('Dashboard: handleThresholdUpdate called with:', {
      productId,
      newThreshold,
      accountId
    });

    try {
      const requestBody = {
        threshold: newThreshold,
        userId: 'user_' + Date.now(), // In a real app, this would be the actual user ID
        accountId,
      };

      console.log('Dashboard: Sending request to:', `/api/products/${productId}/threshold`);
      console.log('Dashboard: Request body:', requestBody);

      const response = await fetch(`/api/products/${productId}/threshold`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      console.log('Dashboard: Response status:', response.status);

      const data = await response.json();
      console.log('Dashboard: Response data:', data);

      if (data.success) {
        toast.success('Threshold updated successfully');
        fetchProducts(); // Refresh products
        setInventoryModalOpen(false);
      } else {
        toast.error('Failed to update threshold');
      }
    } catch (error) {
      console.error('Dashboard: Error in handleThresholdUpdate:', error);
      toast.error('Failed to update threshold');
    }
  };

  const getStats = () => {
    const totalProducts = products.length;
    const activeProducts = products.filter(p => p.active).length;
    const lowStock = products.filter(p => p.inventory.inventory > 0 && p.inventory.inventory <= 10).length;
    const outOfStock = products.filter(p => p.inventory.inventory <= 0).length;

    return { totalProducts, activeProducts, lowStock, outOfStock };
  };

  const stats = getStats();

  if (!accountId) {
    console.log('❌ No accountId provided, showing no-account message');
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Dashboard</h1>
          <p className="text-gray-600 mb-4">
            No Stripe account ID provided. Please connect with Stripe first.
          </p>
          <Button onClick={() => window.location.href = '/api/stripe/auth'}>
            Connect with Stripe
          </Button>
        </div>
      </div>
    );
  }

  if (loading) {
    console.log('⏳ Dashboard is loading...');
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (products.length === 0) {
    console.log('📭 No products found, showing empty state');
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Dashboard</h1>
          <p className="text-gray-600 mb-4">
            No products found for account: {accountId}
          </p>
          <p className="text-sm text-gray-500">
            This could mean: no products exist, authorization failed, or account not found.
          </p>
        </div>
      </div>
    );
  }

  console.log('🎯 Rendering main dashboard content with products:', products.length);
  
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <div className="flex items-center space-x-4">
          <div className="text-sm text-gray-600">
            Account: <span className="font-mono bg-gray-100 px-2 py-1 rounded">{accountId}</span>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Products</p>
                <p className="text-2xl font-bold">{stats.totalProducts}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Products</p>
                <p className="text-2xl font-bold">{stats.activeProducts}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Low Stock</p>
                <p className="text-2xl font-bold">{stats.lowStock}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-4 w-4 text-red-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Out of Stock</p>
                <p className="text-2xl font-bold">{stats.outOfStock}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="products" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onInventoryUpdate={(product) => {
                  setSelectedProduct(product);
                  setInventoryModalOpen(true);
                }}
                onThresholdUpdate={handleThresholdUpdate}
                stripeAccountId={accountId}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="inventory" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Inventory Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {products.map((product) => (
                  <div key={product.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      {product.images[0] && (
                        <img
                          src={product.images[0]}
                          alt={product.name}
                          className="w-12 h-12 object-cover rounded"
                        />
                      )}
                      <div>
                        <p className="font-medium">{product.name}</p>
                        <p className="text-sm text-muted-foreground">
                          Last updated: {new Date(product.inventory.lastUpdated).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Badge variant={product.inventory.inventory > 0 ? "default" : "destructive"}>
                        {product.inventory.inventory} in stock
                      </Badge>
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedProduct(product);
                          setInventoryModalOpen(true);
                        }}
                      >
                        Update
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Inventory Modal */}
      <InventoryModal
        open={inventoryModalOpen}
        onOpenChange={setInventoryModalOpen}
        product={selectedProduct}
        onUpdate={handleInventoryUpdate}
      />
    </div>
  );
}

export default function Dashboard() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <DashboardContent />
    </Suspense>
  );
}
