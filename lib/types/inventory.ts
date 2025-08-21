export interface InventoryAuditLog {
  id?: string;
  product_id: string;
  stripe_account_id: string;
  action: string;
  quantity: number;
  previous_quantity: number;
  user_id: string;
  reason?: string;
  timestamp: string;
  created_at?: string;
}

export interface InventoryMetadata {
  inventory: number;
  lastUpdated: string;
  lastUpdatedBy: string;
}

export interface InventoryUpdateRequest {
  quantity: number;
  reason?: string;
  userId: string;
  accountId: string;
}

export interface InventoryUpdateResponse {
  success: boolean;
  newQuantity: number;
  previousQuantity: number;
}
