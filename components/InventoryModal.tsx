'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Package, AlertTriangle, Info } from 'lucide-react';

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

interface InventoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
  onUpdate: (productId: string, newQuantity: number, reason: string) => void;
}

export function InventoryModal({ open, onOpenChange, product, onUpdate }: InventoryModalProps) {
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!product || !quantity.trim()) return;
    
    const newQuantity = parseInt(quantity);
    if (isNaN(newQuantity) || newQuantity < 0) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onUpdate(product.id, newQuantity, reason.trim() || 'Manual inventory adjustment');
      setQuantity('');
      setReason('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setQuantity('');
      setReason('');
    }
    onOpenChange(newOpen);
  };

  if (!product) return null;

  const currentInventory = product.inventory.inventory;
  const inventoryChange = quantity ? parseInt(quantity) - currentInventory : 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Package className="h-5 w-5" />
            <span>Update Inventory</span>
          </DialogTitle>
          <DialogDescription>
            Update the inventory for "{product.name}"
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex items-center space-x-3 p-3 bg-muted rounded-lg">
            {product.images[0] && (
              <img
                src={product.images[0]}
                alt={product.name}
                className="w-12 h-12 object-cover rounded"
              />
            )}
            <div className="flex-1">
              <h4 className="font-medium">{product.name}</h4>
              <p className="text-sm text-muted-foreground">
                Current inventory: <span className="font-mono">{currentInventory} units</span>
              </p>
            </div>
            <Badge variant={product.active ? 'default' : 'secondary'}>
              {product.active ? 'Active' : 'Inactive'}
            </Badge>
          </div>

          <Separator />

          <div className="space-y-4">
            <h4 className="font-medium text-sm">Update Inventory</h4>
            
            <div className="space-y-2">
              <Label htmlFor="quantity">New Quantity</Label>
              <Input
                id="quantity"
                type="number"
                min="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder={`Current: ${currentInventory}`}
                className="font-mono"
              />
            </div>

            {quantity && !isNaN(parseInt(quantity)) && (
              <div className="p-3 bg-muted rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <Info className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium">Change Summary</span>
                </div>
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span>Current:</span>
                    <span className="font-mono">{currentInventory}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>New:</span>
                    <span className="font-mono">{parseInt(quantity)}</span>
                  </div>
                  <div className="flex justify-between font-medium">
                    <span>Change:</span>
                    <span className={`font-mono ${inventoryChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {inventoryChange >= 0 ? '+' : ''}{inventoryChange}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="reason">Reason for Change (Optional)</Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g., Restock, Damaged goods, Manual adjustment"
                rows={3}
              />
            </div>
          </div>

          {quantity && parseInt(quantity) <= 0 && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <span className="text-sm font-medium text-yellow-800">
                  Warning: Setting inventory to 0 will disable this product for purchase
                </span>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!quantity.trim() || isNaN(parseInt(quantity)) || isSubmitting}
            >
              {isSubmitting ? 'Updating...' : 'Update Inventory'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
