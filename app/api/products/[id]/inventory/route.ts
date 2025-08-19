import { NextRequest, NextResponse } from 'next/server';
import { stripe, updateInventoryMetadata } from '@/lib/stripe';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { quantity, reason, userId, accountId } = await request.json();
    
    if (typeof quantity !== 'number' || quantity < 0) {
      return NextResponse.json(
        { error: 'Invalid quantity' },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID required' },
        { status: 400 }
      );
    }

    // Get current product to check existing inventory
    const product = await stripe.products.retrieve(params.id, {
      stripeAccount: accountId,
    });

    const currentInventory = JSON.parse(product.metadata.inventory || '{"inventory": 0}');
    const previousQuantity = currentInventory.inventory;

    // Update inventory
    await updateInventoryMetadata(
      params.id,
      quantity,
      previousQuantity,
      userId,
      'manual_adjustment',
      reason || 'Manual inventory adjustment'
    );

    return NextResponse.json({ 
      success: true, 
      newQuantity: quantity,
      previousQuantity 
    });
  } catch (error) {
    console.error('Error updating inventory:', error);
    return NextResponse.json(
      { error: 'Failed to update inventory' },
      { status: 500 }
    );
  }
}
