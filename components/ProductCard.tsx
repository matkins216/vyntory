'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Package, DollarSign, Calendar, User, History, Settings, AlertTriangle } from 'lucide-react';
import { AuditLogDisplay } from './AuditLogDisplay';
import { ThresholdModal } from './ThresholdModal';

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
  threshold?: number;
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

interface ProductCardProps {
  product: Product;
  onInventoryUpdate: (product: Product) => void;
  onThresholdUpdate: (productId: string, threshold: number) => Promise<void>;
  stripeAccountId?: string;
}

export function ProductCard({ product, onInventoryUpdate, onThresholdUpdate, stripeAccountId }: ProductCardProps) {
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [showThresholdModal, setShowThresholdModal] = useState(false);

  const formatPrice = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  const getInventoryStatus = (quantity: number, threshold: number = 10) => {
    if (quantity <= 0) return { variant: 'destructive' as const, text: 'Out of Stock', icon: AlertTriangle };
    if (quantity <= threshold) return { variant: 'destructive' as const, text: 'Low Stock', icon: AlertTriangle };
    return { variant: 'default' as const, text: 'In Stock', icon: Package };
  };

  const inventoryStatus = getInventoryStatus(product.inventory.inventory, product.threshold);
  const isLowStock = product.inventory.inventory <= (product.threshold || 10);

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
          <div className="flex items-center space-x-2">
            <Badge variant={product.active ? 'default' : 'secondary'}>
              {product.active ? 'Active' : 'Inactive'}
            </Badge>
            {isLowStock && (
              <Badge variant="destructive">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Low Stock
              </Badge>
            )}
          </div>
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
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Inventory</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowThresholdModal(true)}
              className="h-6 px-2"
            >
              <Settings className="h-3 w-3" />
            </Button>
          </div>
          <div className="flex items-center justify-between">
            <Badge variant={inventoryStatus.variant}>
              <inventoryStatus.icon className="h-3 w-3 mr-1" />
              {inventoryStatus.text}
            </Badge>
            <span className="text-sm font-mono">
              {product.inventory.inventory} units
            </span>
          </div>
          {product.threshold !== undefined && (
            <div className="text-xs text-muted-foreground mt-1">
              Threshold: {product.threshold} units
            </div>
          )}
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
        <div className="mb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAuditLog(true)}
            className="w-full"
            disabled={!stripeAccountId}
          >
            <History className="h-4 w-4 mr-2" />
            View Recent Changes
          </Button>
        </div>

        {/* Audit Log Display */}
        {showAuditLog && stripeAccountId && (
          <AuditLogDisplay
            productId={product.id}
            stripeAccountId={stripeAccountId}
            isOpen={showAuditLog}
            onClose={() => setShowAuditLog(false)}
          />
        )}

        {/* Threshold Modal */}
        <ThresholdModal
          isOpen={showThresholdModal}
          onClose={() => setShowThresholdModal(false)}
          productId={product.id}
          productName={product.name}
          currentInventory={product.inventory.inventory}
          currentThreshold={product.threshold || 10}
          onThresholdUpdate={onThresholdUpdate}
        />

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
