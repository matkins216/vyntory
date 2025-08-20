import { NextRequest, NextResponse } from 'next/server';
import { stripe, updateInventoryMetadata } from '@/lib/stripe';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { quantity, reason, userId, accountId } = body;
    
    console.log('Inventory update request:', {
      productId: id,
      quantity,
      reason,
      userId,
      accountId,
      body
    });
    
    if (typeof quantity !== 'number' || quantity < 0) {
      console.log('Invalid quantity:', quantity);
      return NextResponse.json(
        { error: 'Invalid quantity' },
        { status: 400 }
      );
    }

    if (!userId) {
      console.log('Missing userId');
      return NextResponse.json(
        { error: 'User ID required' },
        { status: 400 }
      );
    }

    if (!accountId) {
      console.log('Missing accountId');
      return NextResponse.json(
        { error: 'Account ID required' },
        { status: 400 }
      );
    }

    console.log('Retrieving product from Stripe:', id);
    
    // Get current product to check existing inventory
    const product = await stripe.products.retrieve(id, {
      stripeAccount: accountId,
    });

    console.log('Product retrieved:', product.id);

    const currentInventory = JSON.parse(product.metadata.inventory || '{"inventory": 0}');
    const previousQuantity = currentInventory.inventory;

    console.log('Current inventory:', currentInventory);

    // Update inventory using the connected account
    await updateInventoryMetadata(
      id,
      quantity,
      previousQuantity,
      userId,
      'manual_adjustment',
      reason || 'Manual inventory adjustment',
      undefined, // No access token needed since we're using stripeAccount
      accountId // Pass the stripeAccount for connected account operations
    );

    console.log('Inventory updated successfully');

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
