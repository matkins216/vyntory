import { createServerSupabaseClient } from '@/lib/supabase/client';
import { ShopifyService } from './shopify-service';
import { EtsyService } from './etsy-service';

// Define proper types for inventory items
interface InventoryItem {
  platform: 'shopify' | 'etsy';
  product_id: string;
  variant_id: string | null;
  title: string;
  variant_title: string | null;
  sku: string | null;
  available: number;
  reserved: number;
  incoming: number;
  updated_at: string;
  location_id: string | null;
}

interface InventorySummary {
  total_products: number;
  total_available: number;
  total_reserved: number;
  total_incoming: number;
  by_platform: {
    shopify: {
      count: number;
      available: number;
    };
    etsy: {
      count: number;
      available: number;
    };
  };
  low_stock: number;
  out_of_stock: number;
}

export class CombinedInventoryService {
  private supabase = createServerSupabaseClient();

  // Get combined inventory across all platforms for a customer
  async getCombinedInventory(customerId: string): Promise<InventoryItem[]> {
    console.log('🔄 Getting combined inventory across platforms...');
    
    try {
      // Get Shopify inventory
      const { data: shopifyInventory } = await this.supabase
        .from('shopify_inventory_levels')
        .select(`
          *,
          shopify_variants!inner(
            title,
            sku,
            shopify_products!inner(
              name,
              shopify_product_id,
              shopify_customers!inner(id)
            )
          )
        `)
        .eq('shopify_variants.shopify_products.shopify_customers.id', customerId);

      // Get Etsy inventory
      const { data: etsyInventory } = await this.supabase
        .from('etsy_inventory_levels')
        .select(`
          *,
          etsy_products!inner(
            title,
            etsy_listing_id,
            etsy_customers!inner(id)
          )
        `)
        .eq('etsy_products.etsy_customers.id', customerId);

      // Combine and normalize inventory data
      const combinedInventory: InventoryItem[] = [
        ...(shopifyInventory || []).map(item => ({
          platform: 'shopify' as const,
          product_id: item.shopify_variants.shopify_products.shopify_product_id,
          variant_id: item.shopify_variant_id,
          title: item.shopify_variants.shopify_products.name,
          variant_title: item.shopify_variants.title,
          sku: item.shopify_variants.sku,
          available: item.available,
          reserved: item.reserved,
          incoming: item.incoming,
          updated_at: item.updated_at,
          location_id: item.shopify_location_id
        })),
        ...(etsyInventory || []).map(item => ({
          platform: 'etsy' as const,
          product_id: item.etsy_products.etsy_listing_id,
          variant_id: null,
          title: item.etsy_products.title,
          variant_title: null,
          sku: null,
          available: item.available,
          reserved: item.reserved,
          incoming: 0,
          updated_at: item.updated_at,
          location_id: null
        }))
      ];

      console.log(`✅ Combined inventory: ${combinedInventory.length} items`);
      return combinedInventory;
      
    } catch (error) {
      console.error('❌ Error getting combined inventory:', error);
      throw error;
    }
  }

  // Update inventory across all platforms for a specific product
  async updateInventoryAcrossPlatforms(
    customerId: string, 
    productIdentifier: string, 
    newQuantity: number,
    platform: 'shopify' | 'etsy' | 'both'
  ): Promise<void> {
    console.log(`🔄 Updating inventory across platforms: ${productIdentifier} → ${newQuantity}`);
    
    try {
      if (platform === 'shopify' || platform === 'both') {
        await this.updateShopifyInventory(customerId, productIdentifier, newQuantity);
      }
      
      if (platform === 'etsy' || platform === 'both') {
        await this.updateEtsyInventory(customerId, productIdentifier, newQuantity);
      }
      
      console.log('✅ Inventory updated across platforms');
      
    } catch (error) {
      console.error('❌ Error updating inventory across platforms:', error);
      throw error;
    }
  }

  // Update Shopify inventory
  private async updateShopifyInventory(customerId: string, productIdentifier: string, newQuantity: number): Promise<void> {
    try {
      // Get Shopify customer
      const { data: shopifyCustomer, error: customerError } = await this.supabase
        .from('shopify_customers')
        .select('*')
        .eq('id', customerId)
        .eq('is_active', true)
        .single();

      if (customerError || !shopifyCustomer) {
        console.log('⚠️ No Shopify customer found, skipping Shopify update');
        return;
      }

      const shopifyService = new ShopifyService(
        shopifyCustomer.shopify_shop_domain, 
        shopifyCustomer.shopify_access_token
      );

      // Find the product variant (could be by SKU, product ID, or variant ID)
      const { data: variant, error: variantError } = await this.supabase
        .from('shopify_variants')
        .select(`
          *,
          shopify_products!inner(
            shopify_customers!inner(id)
          )
        `)
        .eq('shopify_products.shopify_customers.id', customerId)
        .or(`sku.eq.${productIdentifier},shopify_variant_id.eq.${productIdentifier}`)
        .single();

      if (variantError || !variant) {
        console.log(`⚠️ No Shopify variant found for identifier: ${productIdentifier}`);
        return;
      }

      // Get inventory level for this variant
      const { data: inventoryLevel, error: inventoryError } = await this.supabase
        .from('shopify_inventory_levels')
        .select('*')
        .eq('shopify_variant_id', variant.shopify_variant_id)
        .limit(1)
        .single();

      if (inventoryError || !inventoryLevel) {
        console.log(`⚠️ No inventory level found for Shopify variant: ${variant.shopify_variant_id}`);
        return;
      }

      // Update inventory in Shopify
      await shopifyService.updateInventoryLevel(
        variant.shopify_variant_id,
        inventoryLevel.shopify_location_id,
        newQuantity
      );

      console.log(`✅ Shopify inventory updated: ${variant.shopify_variant_id} → ${newQuantity}`);
      
    } catch (error) {
      console.error('❌ Error updating Shopify inventory:', error);
      throw error;
    }
  }

  // Update Etsy inventory
  private async updateEtsyInventory(customerId: string, productIdentifier: string, newQuantity: number): Promise<void> {
    try {
      // Get Etsy customer
      const { data: etsyCustomer, error: customerError } = await this.supabase
        .from('etsy_customers')
        .select('*')
        .eq('id', customerId)
        .eq('is_active', true)
        .single();

      if (customerError || !etsyCustomer) {
        console.log('⚠️ No Etsy customer found, skipping Etsy update');
        return;
      }

      const etsyService = new EtsyService(
        etsyCustomer.etsy_shop_id, 
        etsyCustomer.etsy_access_token, 
        etsyCustomer.etsy_refresh_token
      );

      // Find the Etsy product (could be by listing ID or title)
      const { data: product, error: productError } = await this.supabase
        .from('etsy_products')
        .select('*')
        .eq('etsy_customer_id', customerId)
        .or(`etsy_listing_id.eq.${productIdentifier},title.eq.${productIdentifier}`)
        .single();

      if (productError || !product) {
        console.log(`⚠️ No Etsy product found for identifier: ${productIdentifier}`);
        return;
      }

      // Update inventory in Etsy
      await etsyService.updateInventoryLevel(product.etsy_listing_id, newQuantity);

      console.log(`✅ Etsy inventory updated: ${product.etsy_listing_id} → ${newQuantity}`);
      
    } catch (error) {
      console.error('❌ Error updating Etsy inventory:', error);
      throw error;
    }
  }

  // Sync inventory from one platform to another
  async syncInventoryBetweenPlatforms(
    customerId: string,
    sourcePlatform: 'shopify' | 'etsy',
    targetPlatform: 'shopify' | 'etsy'
  ): Promise<void> {
    console.log(`🔄 Syncing inventory from ${sourcePlatform} to ${targetPlatform}`);
    
    try {
      if (sourcePlatform === 'shopify' && targetPlatform === 'etsy') {
        await this.syncShopifyToEtsy(customerId);
      } else if (sourcePlatform === 'etsy' && targetPlatform === 'shopify') {
        await this.syncEtsyToShopify(customerId);
      } else {
        throw new Error('Invalid platform combination for sync');
      }
      
      console.log(`✅ Inventory synced from ${sourcePlatform} to ${targetPlatform}`);
      
    } catch (error) {
      console.error(`❌ Error syncing inventory from ${sourcePlatform} to ${targetPlatform}:`, error);
      throw error;
    }
  }

  // Sync Shopify inventory to Etsy
  private async syncShopifyToEtsy(customerId: string): Promise<void> {
    try {
      // Get Shopify inventory
      const { data: shopifyInventory } = await this.supabase
        .from('shopify_inventory_levels')
        .select(`
          *,
          shopify_variants!inner(
            sku,
            shopify_products!inner(
              name,
              shopify_customers!inner(id)
            )
          )
        `)
        .eq('shopify_variants.shopify_products.shopify_customers.id', customerId);

      // Get Etsy customer
      const { data: etsyCustomer, error: customerError } = await this.supabase
        .from('etsy_customers')
        .select('*')
        .eq('id', customerId)
        .eq('is_active', true)
        .single();

      if (customerError || !etsyCustomer) {
        console.log('⚠️ No Etsy customer found, skipping sync');
        return;
      }

      const etsyService = new EtsyService(
        etsyCustomer.etsy_shop_id, 
        etsyCustomer.etsy_access_token, 
        etsyCustomer.etsy_refresh_token
      );

      // For each Shopify product, try to find matching Etsy product by SKU or name
      for (const item of shopifyInventory || []) {
        const sku = item.shopify_variants.sku;
        const productName = item.shopify_variants.shopify_products.name;
        
        if (sku) {
          // Try to find Etsy product by SKU (if you have SKU mapping)
          const { data: etsyProduct } = await this.supabase
            .from('etsy_products')
            .select('*')
            .eq('etsy_customer_id', customerId)
            .eq('title', productName) // Fallback to name matching
            .single();

          if (etsyProduct) {
            await etsyService.updateInventoryLevel(etsyProduct.etsy_listing_id, item.available);
            console.log(`🔄 Synced ${productName}: Shopify ${item.available} → Etsy ${etsyProduct.etsy_listing_id}`);
          }
        }
      }
      
    } catch (error) {
      console.error('❌ Error syncing Shopify to Etsy:', error);
      throw error;
    }
  }

  // Sync Etsy inventory to Shopify
  private async syncEtsyToShopify(customerId: string): Promise<void> {
    try {
      // Get Etsy inventory
      const { data: etsyInventory } = await this.supabase
        .from('etsy_inventory_levels')
        .select(`
          *,
          etsy_products!inner(
            title,
            etsy_listing_id
          )
        `)
        .eq('etsy_products.etsy_customers.id', customerId);

      // Get Shopify customer
      const { data: shopifyCustomer, error: customerError } = await this.supabase
        .from('shopify_customers')
        .select('*')
        .eq('id', customerId)
        .eq('is_active', true)
        .single();

      if (customerError || !shopifyCustomer) {
        console.log('⚠️ No Shopify customer found, skipping sync');
        return;
      }

      const shopifyService = new ShopifyService(
        shopifyCustomer.shopify_shop_domain, 
        shopifyCustomer.shopify_access_token
      );

      // For each Etsy product, try to find matching Shopify product by name
      for (const item of etsyInventory || []) {
        const productName = item.etsy_products.title;
        
        // Try to find Shopify product by name
        const { data: shopifyProduct } = await this.supabase
          .from('shopify_products')
          .select(`
            *,
            shopify_variants!inner(
              shopify_variant_id,
              shopify_inventory_levels!inner(
                shopify_location_id
              )
            )
          `)
          .eq('shopify_customers.id', customerId)
          .eq('name', productName)
          .single();

        if (shopifyProduct && shopifyProduct.shopify_variants.length > 0) {
          const variant = shopifyProduct.shopify_variants[0];
          const locationId = variant.shopify_inventory_levels[0]?.shopify_location_id;
          
          if (locationId) {
            await shopifyService.updateInventoryLevel(
              variant.shopify_variant_id,
              locationId,
              item.available
            );
            console.log(`🔄 Synced ${productName}: Etsy ${item.available} → Shopify ${variant.shopify_variant_id}`);
          }
        }
      }
      
    } catch (error) {
      console.error('❌ Error syncing Etsy to Shopify:', error);
      throw error;
    }
  }

  // Get inventory summary across platforms
  async getInventorySummary(customerId: string): Promise<InventorySummary> {
    try {
      const combinedInventory = await this.getCombinedInventory(customerId);
      
      const summary: InventorySummary = {
        total_products: combinedInventory.length,
        total_available: combinedInventory.reduce((sum, item) => sum + item.available, 0),
        total_reserved: combinedInventory.reduce((sum, item) => sum + item.reserved, 0),
        total_incoming: combinedInventory.reduce((sum, item) => sum + item.incoming, 0),
        by_platform: {
          shopify: {
            count: combinedInventory.filter(item => item.platform === 'shopify').length,
            available: combinedInventory.filter(item => item.platform === 'shopify').reduce((sum, item) => sum + item.available, 0)
          },
          etsy: {
            count: combinedInventory.filter(item => item.platform === 'etsy').length,
            available: combinedInventory.filter(item => item.platform === 'etsy').reduce((sum, item) => sum + item.available, 0)
          }
        },
        low_stock: combinedInventory.filter(item => item.available <= 5).length,
        out_of_stock: combinedInventory.filter(item => item.available === 0).length
      };

      return summary;
      
    } catch (error) {
      console.error('❌ Error getting inventory summary:', error);
      throw error;
    }
  }
}
