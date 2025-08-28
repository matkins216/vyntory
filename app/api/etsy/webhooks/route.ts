import { NextRequest, NextResponse } from 'next/server';
import { EtsyService } from '@/lib/services/etsy-service';
import { createServerSupabaseClient } from '@/lib/supabase/client';
import { ShopifyService } from '@/lib/services/shopify-service';

// Define proper types for Etsy webhook data
interface EtsyWebhookData {
  event_type?: string;
  type?: string;
  receipt_id?: string;
  shop_id?: string;
  status?: string;
  transactions?: Array<{
    listing_id: string;
    quantity: number;
  }>;
  listing_id?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: EtsyWebhookData = await request.json();
    const headers = request.headers;
    
    // Etsy webhook verification (they use different verification than Shopify)
    const etsySignature = headers.get('x-etsy-signature');
    const etsyTimestamp = headers.get('x-etsy-timestamp');
    
    if (!etsySignature || !etsyTimestamp) {
      console.error('❌ Missing required Etsy webhook headers');
      return NextResponse.json({ error: 'Missing headers' }, { status: 400 });
    }

    // Verify Etsy webhook signature (implement based on Etsy's documentation)
    // For now, we'll proceed with basic validation
    
    console.log('🔔 Etsy webhook received:', {
      signature: etsySignature,
      timestamp: etsyTimestamp,
      bodyLength: JSON.stringify(body).length
    });

    const supabase = createServerSupabaseClient();
    
    // Process the webhook based on the event type
    try {
      const eventType = body.event_type || body.type;
      
      switch (eventType) {
        case 'receipt_created':
          await handleReceiptCreated(body, supabase);
          break;
          
        case 'receipt_updated':
          await handleReceiptUpdated(body, supabase);
          break;
          
        case 'listing_updated':
          await handleListingUpdated(body, supabase);
          break;
          
        case 'inventory_updated':
          await handleInventoryUpdated(body, supabase);
          break;
          
        default:
          console.log('⚠️ Unhandled Etsy webhook event type:', eventType);
      }

      console.log('✅ Etsy webhook processed successfully');
      return NextResponse.json({ success: true });

    } catch (error) {
      console.error('❌ Error processing Etsy webhook:', error);
      return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
    }

  } catch (error) {
    console.error('❌ Error in Etsy webhook:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Webhook handlers
async function handleReceiptCreated(data: EtsyWebhookData, supabase: ReturnType<typeof createServerSupabaseClient>) {
  console.log('🛒 Processing Etsy receipt created webhook:', data.receipt_id);
  
  try {
    // Get the Etsy customer record
    const { data: etsyCustomer, error: customerError } = await supabase
      .from('etsy_customers')
      .select('*')
      .eq('etsy_shop_id', data.shop_id)
      .eq('is_active', true)
      .single();

    if (customerError || !etsyCustomer) {
      console.error('❌ Etsy customer not found for shop:', data.shop_id);
      return;
    }

    const etsyService = new EtsyService(
      data.shop_id!, 
      etsyCustomer.etsy_access_token, 
      etsyCustomer.etsy_refresh_token
    );

    // Update inventory for each transaction
    if (data.transactions && data.transactions.length > 0) {
      for (const transaction of data.transactions) {
        await updateInventoryForEtsyOrder(
          etsyService, 
          transaction.listing_id, 
          transaction.quantity,
          'decrement'
        );
      }
    }

    // Sync the order to our database
    await etsyService.syncOrders(etsyCustomer.id);
    
  } catch (error) {
    console.error('❌ Error handling Etsy receipt created:', error);
  }
}

async function handleReceiptUpdated(data: EtsyWebhookData, supabase: ReturnType<typeof createServerSupabaseClient>) {
  console.log('📝 Processing Etsy receipt updated webhook:', data.receipt_id);
  
  try {
    // Get the Etsy customer record
    const { data: etsyCustomer, error: customerError } = await supabase
      .from('etsy_customers')
      .select('*')
      .eq('etsy_shop_id', data.shop_id)
      .eq('is_active', true)
      .single();

    if (customerError || !etsyCustomer) {
      console.error('❌ Etsy customer not found for shop:', data.shop_id);
      return;
    }

    const etsyService = new EtsyService(
      data.shop_id!, 
      etsyCustomer.etsy_access_token, 
      etsyCustomer.etsy_refresh_token
    );

    // Handle inventory changes based on receipt status
    if (data.status === 'cancelled' && data.transactions) {
      // Restore inventory for cancelled orders
      for (const transaction of data.transactions) {
        await updateInventoryForEtsyOrder(
          etsyService, 
          transaction.listing_id, 
          transaction.quantity,
          'increment'
        );
      }
    } else if (data.status === 'completed' && data.transactions) {
      // Ensure inventory is decremented for completed orders
      for (const transaction of data.transactions) {
        await updateInventoryForEtsyOrder(
          etsyService, 
          transaction.listing_id, 
          transaction.quantity,
          'decrement'
        );
      }
    }

    // Sync the updated order
    await etsyService.syncOrders(etsyCustomer.id);
    
  } catch (error) {
    console.error('❌ Error handling Etsy receipt updated:', error);
  }
}

async function handleListingUpdated(data: EtsyWebhookData, supabase: ReturnType<typeof createServerSupabaseClient>) {
  console.log('📦 Processing Etsy listing updated webhook:', data.listing_id);
  
  try {
    // Get the Etsy customer record
    const { data: etsyCustomer, error: customerError } = await supabase
      .from('etsy_customers')
      .select('*')
      .eq('etsy_shop_id', data.shop_id)
      .eq('is_active', true)
      .single();

    if (customerError || !etsyCustomer) {
      console.error('❌ Etsy customer not found for shop:', data.shop_id);
      return;
    }

    const etsyService = new EtsyService(
      data.shop_id!, 
      etsyCustomer.etsy_access_token, 
      etsyCustomer.etsy_refresh_token
    );

    // Sync the updated listing
    await etsyService.syncProducts(etsyCustomer.id);
    
  } catch (error) {
    console.error('❌ Error handling Etsy listing updated:', error);
  }
}

async function handleInventoryUpdated(data: EtsyWebhookData, supabase: ReturnType<typeof createServerSupabaseClient>) {
  console.log('📊 Processing Etsy inventory updated webhook:', data.listing_id);
  
  try {
    // Get the Etsy customer record
    const { data: etsyCustomer, error: customerError } = await supabase
      .from('etsy_customers')
      .select('*')
      .eq('etsy_shop_id', data.shop_id)
      .eq('is_active', true)
      .single();

    if (customerError || !etsyCustomer) {
      console.error('❌ Etsy customer not found for shop:', data.shop_id);
      return;
    }

    const etsyService = new EtsyService(
      data.shop_id!, 
      etsyCustomer.etsy_access_token, 
      etsyCustomer.etsy_refresh_token
    );

    // Sync inventory levels
    await etsyService.syncInventoryLevels(etsyCustomer.id);
    
  } catch (error) {
    console.error('❌ Error handling Etsy inventory updated:', error);
  }
}

// Helper function to update inventory across platforms
async function updateInventoryForEtsyOrder(
  etsyService: EtsyService, 
  listingId: string, 
  quantity: number, 
  operation: 'increment' | 'decrement'
) {
  try {
    // Get current inventory level
    const supabase = createServerSupabaseClient();
    const { data: inventoryLevels, error } = await supabase
      .from('etsy_inventory_levels')
      .select('*')
      .eq('etsy_listing_id', listingId)
      .limit(1);

    if (!error && inventoryLevels && inventoryLevels.length > 0) {
      const currentLevel = inventoryLevels[0];
      let newQuantity: number;
      
      if (operation === 'decrement') {
        newQuantity = Math.max(0, currentLevel.available - quantity);
      } else {
        newQuantity = currentLevel.available + quantity;
      }
      
      // Update inventory in Etsy
      await etsyService.updateInventoryLevel(listingId, newQuantity);
      
      console.log(`📦 Updated Etsy inventory for listing ${listingId}: ${currentLevel.available} → ${newQuantity} (${operation})`);
      
      // Check if we need to sync with Shopify (if same product exists)
      await syncInventoryWithShopify(listingId, newQuantity);
    }
  } catch (error) {
    console.error(`❌ Error updating inventory for Etsy listing ${listingId}:`, error);
  }
}

// Sync inventory changes with Shopify if the same product exists
async function syncInventoryWithShopify(etsyListingId: string, newQuantity: number) {
  try {
    const supabase = createServerSupabaseClient();
    
    // Look for matching products between Etsy and Shopify
    // This would require a mapping table or SKU matching logic
    const { data: productMapping, error } = await supabase
      .from('product_mappings') // You'll need to create this table
      .select('*')
      .eq('etsy_listing_id', etsyListingId)
      .single();

    if (error || !productMapping) {
      // No mapping found, skip Shopify sync
      return;
    }

    // Get Shopify customer
    const { data: shopifyCustomer, error: customerError } = await supabase
      .from('shopify_customers')
      .select('*')
      .eq('id', productMapping.shopify_customer_id)
      .eq('is_active', true)
      .single();

    if (customerError || !shopifyCustomer) {
      console.error('❌ Shopify customer not found for inventory sync');
      return;
    }

    const shopifyService = new ShopifyService(
      shopifyCustomer.shopify_shop_domain, 
      shopifyCustomer.shopify_access_token
    );

    // Update Shopify inventory
    await shopifyService.updateInventoryLevel(
      productMapping.shopify_variant_id,
      productMapping.shopify_location_id,
      newQuantity
    );

    console.log(`🔄 Synced inventory change to Shopify: variant ${productMapping.shopify_variant_id} → ${newQuantity}`);
    
  } catch (error) {
    console.error('❌ Error syncing inventory with Shopify:', error);
  }
}
