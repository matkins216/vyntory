import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { checkPayGateAuthorization } from '@/lib/middleware/pay-gate';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productId, accountId, quantity } = body;
    
    if (!productId || !accountId || !quantity) {
      return NextResponse.json({ 
        error: 'Missing required fields: productId, accountId, quantity' 
      }, { status: 400 });
    }

    // Check pay gate authorization
    const authResult = await checkPayGateAuthorization(accountId);
    if (!authResult.isAuthorized) {
      return NextResponse.json(
        { error: 'Subscription required', reason: authResult.reason },
        { status: 403 }
      );
    }
    
    console.log('Testing inventory update:', { productId, accountId, quantity });
    
    // Test retrieving product from connected account
    const product = await stripe.products.retrieve(productId, {
      stripeAccount: accountId
    });
    
    console.log('Product retrieved successfully:', {
      id: product.id,
      name: product.name,
      metadata: product.metadata
    });
    
    // Test parsing inventory metadata
    const currentInventory = JSON.parse(product.metadata.inventory || '{"inventory": 0}');
    const previousQuantity = currentInventory.inventory;
    const newQuantity = Math.max(0, previousQuantity - quantity);
    
    console.log('Inventory calculation:', {
      previous: previousQuantity,
      new: newQuantity,
      reduction: quantity
    });
    
    // Test updating inventory metadata
    const updatedMetadata = {
      ...product.metadata,
      inventory: JSON.stringify({
        inventory: newQuantity,
        lastUpdated: new Date().toISOString(),
        lastUpdatedBy: 'test'
      })
    };
    
    await stripe.products.update(productId, {
      metadata: updatedMetadata
    }, {
      stripeAccount: accountId
    });
    
    console.log('Inventory updated successfully');
    
    // Verify the update by retrieving the product again
    const updatedProduct = await stripe.products.retrieve(productId, {
      stripeAccount: accountId
    });
    
    const verifiedInventory = JSON.parse(updatedProduct.metadata.inventory || '{"inventory": 0}');
    
    return NextResponse.json({ 
      success: true,
      message: 'Test completed successfully',
      inventory: {
        previous: previousQuantity,
        new: newQuantity,
        reduction: quantity,
        verified: verifiedInventory.inventory
      },
      product: {
        id: product.id,
        name: product.name,
        metadata: updatedProduct.metadata
      }
    });
    
  } catch (error) {
    console.error('Test failed:', error);
    return NextResponse.json({ 
      error: 'Test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ 
    message: 'Webhook test endpoint',
    usage: 'POST with { productId, accountId, quantity } to test inventory update'
  });
}
