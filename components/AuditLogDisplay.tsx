'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { History, User, Package, AlertTriangle } from 'lucide-react';

interface AuditLog {
  id: string;
  product_id: string;
  stripe_account_id: string;
  action: string;
  quantity: number;
  previous_quantity: number;
  user_id: string;
  reason?: string;
  timestamp: string;
  created_at: string;
}

interface AuditLogDisplayProps {
  productId: string;
  stripeAccountId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function AuditLogDisplay({ productId, stripeAccountId, isOpen, onClose }: AuditLogDisplayProps) {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAuditLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(
        `/api/products/${productId}/inventory/audit-logs?stripeAccountId=${stripeAccountId}&limit=5`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch audit logs');
      }
      
      const data = await response.json();
      
      if (data.success) {
        setAuditLogs(data.auditLogs);
      } else {
        setError(data.error || 'Failed to fetch audit logs');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [productId, stripeAccountId]);

  useEffect(() => {
    if (isOpen && productId && stripeAccountId) {
      fetchAuditLogs();
    }
  }, [isOpen, productId, stripeAccountId, fetchAuditLogs]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[80vh] overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="flex items-center space-x-2">
            <History className="h-5 w-5" />
            <span>Recent Inventory Changes (Last 5)</span>
          </CardTitle>
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {loading && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
              <p className="mt-2 text-sm text-muted-foreground">Loading audit logs...</p>
            </div>
          )}
          
          {error && (
            <div className="text-center py-8">
              <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={fetchAuditLogs}
                className="mt-2"
              >
                Retry
              </Button>
            </div>
          )}
          
          {!loading && !error && auditLogs.length === 0 && (
            <div className="text-center py-8">
              <Package className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No audit logs found</p>
            </div>
          )}
          
          {!loading && !error && auditLogs.length > 0 && (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {auditLogs.map((log) => (
                <div key={log.id} className="p-3 border rounded-lg">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline" className="text-xs">
                        {log.action}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(log.timestamp).toLocaleDateString()} {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2 text-sm">
                      <Package className="h-3 w-3 text-muted-foreground" />
                      <span className="font-medium">
                        {log.previous_quantity} → {log.quantity}
                      </span>
                    </div>
                    
                    {log.reason && (
                      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                        <span>Reason: {log.reason}</span>
                      </div>
                    )}
                    
                    <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                      <User className="h-3 w-3" />
                      <span>User: {log.user_id}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
