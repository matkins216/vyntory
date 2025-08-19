'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Package, DollarSign, Calendar, User } from 'lucide-react';

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
    recurring?: any;
  }>;
  created: number;
}

interface ProductCardProps {
  product: Product;
  onInventoryUpdate: (product: Product) => void;
}

export function ProductCard({ product, onInventoryUpdate }: ProductCardProps) {
  const [showAuditLog, setShowAuditLog] = useState(false);

  const formatPrice = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  const getInventoryStatus = (quantity: number) => {
    if (quantity <= 0) return { variant: 'destructive' as const, text: 'Out of Stock' };
    if (quantity <= 10) return { variant: 'secondary' as const, text: 'Low Stock' };
    return { variant: 'default' as const, text: 'In Stock' };
  };

  const inventoryStatus = getInventoryStatus(product.inventory.inventory);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="font-semibold text-lg line-clamp-2 mb-2">{product.name}</h3>
            {product.description && (
              <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                {product.description}
              </p>
            )}
          </div>
          <Badge variant={product.active ? 'default' : 'secondary'}>
            {product.active ? 'Active' : 'Inactive'}
          </Badge>
        </div>
        
        {/* Product Image */}
        {product.images[0] && (
          <div className="relative w-full h-48 mb-3">
            <img
              src={product.images[0]}
              alt={product.name}
              className="w-full h-full object-cover rounded-lg"
            />
          </div>
        )}
      </CardHeader>

      <CardContent className="flex-1 flex flex-col">
        {/* Pricing */}
        {product.prices.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center space-x-2 mb-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Pricing</span>
            </div>
            <div className="space-y-1">
              {product.prices.map((price) => (
                <div key={price.id} className="flex justify-between text-sm">
                  <span>
                    {formatPrice(price.unit_amount, price.currency)}
                    {price.recurring && (
                      <span className="text-muted-foreground ml-1">
                        /{price.recurring.interval}
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <Separator className="my-3" />

        {/* Inventory Status */}
        <div className="mb-4">
          <div className="flex items-center space-x-2 mb-2">
            <Package className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Inventory</span>
          </div>
          <div className="flex items-center justify-between">
            <Badge variant={inventoryStatus.variant}>
              {inventoryStatus.text}
            </Badge>
            <span className="text-sm font-mono">
              {product.inventory.inventory} units
            </span>
          </div>
        </div>

        {/* Last Updated */}
        <div className="mb-4 text-sm text-muted-foreground">
          <div className="flex items-center space-x-2 mb-1">
            <Calendar className="h-3 w-3" />
            <span>Last updated: {new Date(product.inventory.lastUpdated).toLocaleDateString()}</span>
          </div>
          <div className="flex items-center space-x-2">
            <User className="h-3 w-3" />
            <span>By: {product.inventory.lastUpdatedBy}</span>
          </div>
        </div>

        {/* Audit Log Toggle */}
        {product.inventory.auditLog.length > 0 && (
          <div className="mb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAuditLog(!showAuditLog)}
              className="w-full"
            >
              {showAuditLog ? 'Hide' : 'Show'} Audit Log ({product.inventory.auditLog.length})
            </Button>
          </div>
        )}

        {/* Audit Log */}
        {showAuditLog && product.inventory.auditLog.length > 0 && (
          <div className="mb-4 p-3 bg-muted rounded-lg">
            <h4 className="text-sm font-medium mb-2">Recent Changes</h4>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {product.inventory.auditLog.slice(-5).reverse().map((log, index) => (
                <div key={index} className="text-xs">
                  <div className="flex justify-between">
                    <span className="font-medium">{log.action}</span>
                    <span className="text-muted-foreground">
                      {new Date(log.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="text-muted-foreground">
                    {log.previousQuantity} → {log.quantity}
                    {log.reason && ` (${log.reason})`}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="mt-auto pt-4">
          <Button
            onClick={() => onInventoryUpdate(product)}
            className="w-full"
            disabled={!product.active}
          >
            Update Inventory
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
