import { NextRequest, NextResponse } from 'next/server';
import { InventoryAuditService } from '@/lib/services/inventory-audit';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: productId } = await params;
    const { searchParams } = new URL(request.url);
    
    const stripeAccountId = searchParams.get('stripeAccountId');
    const limit = parseInt(searchParams.get('limit') || '100');
    
    if (!stripeAccountId) {
      return NextResponse.json(
        { error: 'stripeAccountId is required' },
        { status: 400 }
      );
    }

    const auditService = new InventoryAuditService();
    const auditLogs = await auditService.getAuditLogsByProduct(
      productId,
      stripeAccountId,
      limit
    );

    return NextResponse.json({ 
      success: true, 
      auditLogs,
      count: auditLogs.length
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch audit logs' },
      { status: 500 }
    );
  }
}
