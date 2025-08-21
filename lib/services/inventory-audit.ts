import { createServerSupabaseClient } from '@/lib/supabase/client';
import { InventoryAuditLog } from '@/lib/types/inventory';

export class InventoryAuditService {
  private supabase = createServerSupabaseClient();

  async createAuditLog(auditLog: Omit<InventoryAuditLog, 'id' | 'created_at'>): Promise<InventoryAuditLog> {
    const { data, error } = await this.supabase
      .from('inventory_audit_logs')
      .insert(auditLog)
      .select()
      .single();

    if (error) {
      console.error('Error creating audit log:', error);
      throw new Error(`Failed to create audit log: ${error.message}`);
    }

    return data;
  }

  async getAuditLogsByProduct(productId: string, stripeAccountId: string, limit = 100): Promise<InventoryAuditLog[]> {
    const { data, error } = await this.supabase
      .from('inventory_audit_logs')
      .select('*')
      .eq('product_id', productId)
      .eq('stripe_account_id', stripeAccountId)
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching audit logs:', error);
      throw new Error(`Failed to fetch audit logs: ${error.message}`);
    }

    return data || [];
  }

  async getAuditLogsByUser(userId: string, limit = 100): Promise<InventoryAuditLog[]> {
    const { data, error } = await this.supabase
      .from('inventory_audit_logs')
      .select('*')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching user audit logs:', error);
      throw new Error(`Failed to fetch user audit logs: ${error.message}`);
    }

    return data || [];
  }

  async getAuditLogsByAccount(stripeAccountId: string, limit = 100): Promise<InventoryAuditLog[]> {
    const { data, error } = await this.supabase
      .from('inventory_audit_logs')
      .select('*')
      .eq('stripe_account_id', stripeAccountId)
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching account audit logs:', error);
      throw new Error(`Failed to fetch account audit logs: ${error.message}`);
    }

    return data || [];
  }
}
