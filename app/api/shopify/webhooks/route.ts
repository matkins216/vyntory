import { NextRequest, NextResponse } from 'next/server';
import { ShopifyService } from '@/lib/services/shopify-service';
import { createServerSupabaseClient } from '@/lib/supabase/client';

// const SHOPIFY_WEBHOOK_SECRET = process.env.SHOPIFY_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const headers = request.headers;
    
    // Verify webhook signature
    const hmacHeader = headers.get('x-shopify-hmac-sha256');
    const shopHeader = headers.get('x-shopify-shop-domain');
    const topicHeader = headers.get('x-shopify-topic');
    
    if (!hmacHeader || !shopHeader || !topicHeader) {
      console.error('❌ Missing required webhook headers');
      return NextResponse.json({ error: 'Missing headers' }, { status: 400 });
    }

    // Verify HMAC signature (you should implement proper HMAC verification)
    // For now, we'll trust the webhook and process it
    
    console.log('🔔 Shopify webhook received:', {
      topic: topicHeader,
      shop: shopHeader,
      bodyLength: body.length
    });

    const supabase = createServerSupabaseClient();
    
    // Get the Shopify customer record
    const { data: shopifyCustomer, error: customerError } = await supabase
      .from('shopify_customers')
      .select('*')
      .eq('shopify_shop_domain', shopHeader)
      .eq('is_active', true)
      .single();

    if (customerError || !shopifyCustomer) {
      console.error('❌ Shopify customer not found for shop:', shopHeader);
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const shopifyService = new ShopifyService(shopHeader, shopifyCustomer.shopify_access_token);
    const webhookData = JSON.parse(body);

    try {
      switch (topicHeader) {
        case 'orders/create':
          await handleOrderCreated(shopifyService, webhookData, shopifyCustomer.id);
          break;
          
        case 'orders/updated':
          await handleOrderUpdated(shopifyService, webhookData, shopifyCustomer.id);
          break;
          
        case 'orders/cancelled':
          await handleOrderCancelled(shopifyService, webhookData, shopifyCustomer.id);
          break;
          
        case 'inventory_levels/update':
          await handleInventoryUpdate(shopifyService, webhookData, shopifyCustomer.id);
          break;
          
        case 'products/update':
          await handleProductUpdate(shopifyService, webhookData, shopifyCustomer.id);
          break;
          
        case 'variants/update':
          await handleVariantUpdate(shopifyService, webhookData, shopifyCustomer.id);
          break;
          
        default:
          console.log('⚠️ Unhandled webhook topic:', topicHeader);
      }

      console.log('✅ Webhook processed successfully');
      return NextResponse.json({ success: true });

    } catch (error) {
      console.error('❌ Error processing webhook:', error);
      return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
    }

  } catch (error) {
    console.error('❌ Error in Shopify webhook:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Webhook handlers
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleOrderCreated(shopifyService: ShopifyService, data: any, _customerId: string) {
  console.log('🛒 Processing order created webhook:', data.id);
  
  const order = data;
  
  // Update inventory for each line item
  for (const item of order.line_items) {
    try {
      // Get current inventory level
      const { data: inventoryLevels, error } = await shopifyService.supabase
        .from('shopify_inventory_levels')
        .select('*')
        .eq('shopify_variant_id', item.variant_id.toString())
        .limit(1);

      if (!error && inventoryLevels && inventoryLevels.length > 0) {
        const currentLevel = inventoryLevels[0];
        const newQuantity = Math.max(0, currentLevel.available - item.quantity);
        
        // Update inventory in Shopify and local database
        await shopifyService.updateInventoryLevel(
          item.variant_id.toString(),
          currentLevel.shopify_location_id,
          newQuantity
        );
        
        console.log(`📦 Updated inventory for variant ${item.variant_id}: ${currentLevel.available} → ${newQuantity}`);
      }
    } catch (error) {
      console.error(`❌ Error updating inventory for variant ${item.variant_id}:`, error);
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleOrderUpdated(shopifyService: ShopifyService, data: any, _customerId: string) {
  console.log('📝 Processing order updated webhook:', data.id);
  // Similar logic to order created, but handle quantity changes
  await handleOrderCreated(shopifyService, data, customerId);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleOrderCancelled(shopifyService: ShopifyService, data: any, customerId: string) {
  console.log('❌ Processing order cancelled webhook:', data.id);
  
  const order = data;
  
  // Restore inventory for cancelled orders
  for (const item of order.line_items) {
    try {
      const { data: inventoryLevels, error } = await shopifyService.supabase
        .from('shopify_inventory_levels')
        .select('*')
        .eq('shopify_variant_id', item.variant_id.toString())
        .limit(1);

      if (!error && inventoryLevels && inventoryLevels.length > 0) {
        const currentLevel = inventoryLevels[0];
        const newQuantity = currentLevel.available + item.quantity;
        
        await shopifyService.updateInventoryLevel(
          item.variant_id.toString(),
          currentLevel.shopify_location_id,
          newQuantity
        );
        
        console.log(`📦 Restored inventory for variant ${item.variant_id}: ${currentLevel.available} → ${newQuantity}`);
      }
    } catch (error) {
      console.error(`❌ Error restoring inventory for variant ${item.variant_id}:`, error);
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleInventoryUpdate(shopifyService: ShopifyService, data: any, customerId: string) {
  console.log('📊 Processing inventory update webhook:', data.inventory_item_id);
  
  // Sync inventory levels from Shopify
  await shopifyService.syncInventoryLevels(customerId);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleProductUpdate(shopifyService: ShopifyService, data: any, customerId: string) {
  console.log('📦 Processing product update webhook:', data.id);
  
  // Sync updated product from Shopify
  await shopifyService.syncProducts(customerId);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleVariantUpdate(shopifyService: ShopifyService, data: any, customerId: string) {
  console.log('🔄 Processing variant update webhook:', data.id);
  
  // Sync updated variants from Shopify
  await shopifyService.syncProducts(customerId);
}
