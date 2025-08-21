# Supabase Integration Setup

This project now includes Supabase integration for storing inventory audit logs, keeping your Stripe metadata lean and focused on essential information.

## Environment Variables

Add the following environment variables to your `.env.local` file:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Database Setup

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Run the migration in `supabase/migrations/001_create_inventory_audit_logs.sql` in your Supabase SQL editor
3. The migration will create:
   - `inventory_audit_logs` table with proper indexes
   - Row Level Security (RLS) policies
   - Service role access for audit log operations

## What Changed

### Before
- Audit logs were stored in Stripe metadata
- Metadata could grow large over time
- Limited querying capabilities for audit data

### After
- Only essential inventory data stored in Stripe metadata:
  - Current inventory count
  - Last updated timestamp
  - Last updated by user ID
- Full audit logs stored in Supabase with:
  - Product ID and Stripe account ID
  - Action type and quantity changes
  - User ID and timestamps
  - Reason for changes
  - Proper indexing for fast queries

## API Endpoints

### Update Inventory
`PATCH /api/products/[id]/inventory`
- Updates inventory and creates audit log
- Stores minimal metadata in Stripe
- Stores full audit trail in Supabase

### Get Audit Logs
`GET /api/products/[id]/inventory/audit-logs?stripeAccountId=...&limit=100`
- Retrieves audit logs for a specific product
- Supports pagination with limit parameter
- Requires stripeAccountId for proper data isolation

## Benefits

1. **Lean Stripe Metadata**: Only essential inventory info stored
2. **Rich Audit Trail**: Full history with proper database structure
3. **Better Performance**: Fast queries with proper indexing
4. **Data Isolation**: Separate audit logs per Stripe account
5. **Scalability**: No metadata size limits from Stripe
6. **Analytics**: Easy to build reports and dashboards

## Usage Example

```typescript
import { InventoryAuditService } from '@/lib/services/inventory-audit';

const auditService = new InventoryAuditService();

// Get audit logs for a product
const logs = await auditService.getAuditLogsByProduct(
  'prod_123',
  'acct_456',
  50
);

// Get user's audit history
const userLogs = await auditService.getAuditLogsByUser('user_789', 100);
```
