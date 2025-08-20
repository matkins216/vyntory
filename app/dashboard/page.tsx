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
    auditLog: Array<{
      action: string;
      quantity: number;
      previousQuantity: number;
      timestamp: string;
      userId: string;
      reason?: string;
    }>;
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
  
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [inventoryModalOpen, setInventoryModalOpen] = useState(false);

  const fetchProducts = useCallback(async () => {
    try {
      const response = await fetch(`/api/products?account=${accountId}`);
      const data = await response.json();
      
      if (data.error) {
        toast.error('Failed to fetch products');
        return;
      }
      
      setProducts(data.products);
    } catch {
      toast.error('Failed to fetch products');
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    if (accountId) {
      fetchProducts();
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

  const getStats = () => {
    const totalProducts = products.length;
    const activeProducts = products.filter(p => p.active).length;
    const lowStock = products.filter(p => p.inventory.inventory > 0 && p.inventory.inventory <= 10).length;
    const outOfStock = products.filter(p => p.inventory.inventory <= 0).length;

    return { totalProducts, activeProducts, lowStock, outOfStock };
  };

  const stats = getStats();

  if (!accountId) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              No Stripe account connected. Please connect your Stripe account first.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Product Dashboard</h1>
        <p className="text-muted-foreground">
          Manage your Stripe products and inventory
        </p>
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
