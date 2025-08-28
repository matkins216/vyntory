'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Package, AlertTriangle } from 'lucide-react';

interface ThresholdModalProps {
  isOpen: boolean;
  onClose: () => void;
  productId: string;
  productName: string;
  currentInventory: number;
  currentThreshold: number;
  onThresholdUpdate: (productId: string, threshold: number) => Promise<void>;
}

export function ThresholdModal({
  isOpen,
  onClose,
  productId,
  productName,
  currentInventory,
  currentThreshold,
  onThresholdUpdate
}: ThresholdModalProps) {
  const [threshold, setThreshold] = useState(currentThreshold);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setThreshold(currentThreshold);
  }, [currentThreshold]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (threshold < 0) {
      setError('Threshold must be 0 or greater');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await onThresholdUpdate(productId, threshold);
      onClose();
    } catch (err) {
      setError('Failed to update threshold');
    } finally {
      setIsLoading(false);
    }
  };

  const isLowStock = currentInventory <= threshold;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Manage Stock Threshold</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="product-name">Product</Label>
            <div className="text-sm text-muted-foreground mt-1">{productName}</div>
          </div>

          <div>
            <Label htmlFor="current-inventory">Current Inventory</Label>
            <div className="flex items-center space-x-2 mt-1">
              <Package className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-mono">{currentInventory} units</span>
              {isLowStock && (
                <Badge variant="destructive" className="ml-2">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Low Stock
                </Badge>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="threshold">Low Stock Threshold</Label>
            <div className="text-sm text-muted-foreground mb-2">
              Get notified when inventory falls below this number
            </div>
            <Input
              id="threshold"
              type="number"
              min="0"
              value={threshold}
              onChange={(e) => setThreshold(parseInt(e.target.value) || 0)}
              placeholder="Enter threshold value"
            />
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
              {error}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Updating...' : 'Update Threshold'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
