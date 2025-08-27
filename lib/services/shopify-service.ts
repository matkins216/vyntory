import { createServerSupabaseClient } from '@/lib/supabase/client';
import { ShopifyCustomer, ShopifyProduct, ShopifyVariant, ShopifyInventoryLevel, ShopifyWebhook } from '@/lib/types/shopify-customer';

export class ShopifyService {
  private supabase = createServerSupabaseClient();
  private baseUrl: string;
  private accessToken: string;

  constructor(shopDomain: string, accessToken: string) {
    this.baseUrl = `https://${shopDomain}/admin/api/2024-01`;
    this.accessToken = accessToken;
  }

  // Shopify API client with proper headers
  private async shopifyRequest(endpoint: string, options: RequestInit = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'X-Shopify-Access-Token': this.accessToken,
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Shopify API error: ${response.status} ${errorText}`);
    }

    return response.json();
  }

  // Customer Management
  async createOrUpdateCustomer(customerData: Partial<ShopifyCustomer>): Promise<ShopifyCustomer> {
    const { data, error } = await this.supabase
      .from('shopify_customers')
      .upsert(customerData, {
        onConflict: 'shopify_shop_domain',
        ignoreDuplicates: false
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating/updating Shopify customer:', error);
      throw new Error(`Failed to create/update Shopify customer: ${error.message}`);
    }

    return data;
  }

  async getCustomerByShopDomain(shopDomain: string): Promise<ShopifyCustomer | null> {
    const { data, error } = await this.supabase
      .from('shopify_customers')
      .select('*')
      .eq('shopify_shop_domain', shopDomain)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      console.error('Error fetching Shopify customer:', error);
      throw new Error(`Failed to fetch Shopify customer: ${error.message}`);
    }

    return data;
  }

  // Product Management
  async syncProducts(customerId: string): Promise<ShopifyProduct[]> {
    console.log('🔄 Starting Shopify product sync...');
    
    try {
      // Fetch products from Shopify
      const response = await this.shopifyRequest('/products.json?limit=250');
      const products = response.products;
      
      console.log(`📦 Found ${products.length} products in Shopify`);
      
      const syncedProducts: ShopifyProduct[] = [];
      
      for (const product of products) {
        // Create or update product record
        const productData: Partial<ShopifyProduct> = {
          shopify_customer_id: customerId,
          shopify_product_id: product.id.toString(),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          shopify_variant_ids: product.variants.map((v: any) => v.id.toString()),
          name: product.title,
          description: product.body_html,
          handle: product.handle,
          product_type: product.product_type,
          vendor: product.vendor,
          tags: product.tags ? product.tags.split(',').map((t: string) => t.trim()) : [],
          status: product.status,
          published_at: product.published_at,
        };

        const { data: savedProduct, error } = await this.supabase
          .from('shopify_products')
          .upsert(productData, {
            onConflict: 'shopify_product_id',
            ignoreDuplicates: false
          })
          .select()
          .single();

        if (error) {
          console.error(`❌ Error saving product ${product.id}:`, error);
          continue;
        }

        syncedProducts.push(savedProduct);
        
        // Sync variants for this product
        await this.syncVariants(customerId, product.id.toString(), product.variants);
      }

      console.log(`✅ Successfully synced ${syncedProducts.length} products`);
      return syncedProducts;
      
    } catch (error) {
      console.error('❌ Error syncing Shopify products:', error);
      throw error;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async syncVariants(customerId: string, productId: string, variants: any[]): Promise<ShopifyVariant[]> {
    console.log(`🔄 Syncing ${variants.length} variants for product ${productId}`);
    
    const syncedVariants: ShopifyVariant[] = [];
    
    for (const variant of variants) {
      const variantData: Partial<ShopifyVariant> = {
        shopify_product_id: productId,
        shopify_variant_id: variant.id.toString(),
        title: variant.title,
        sku: variant.sku,
        barcode: variant.barcode,
        price: variant.price,
        compare_at_price: variant.compare_at_price,
        inventory_quantity: variant.inventory_quantity,
        inventory_item_id: variant.inventory_item_id.toString(),
        weight: variant.weight,
        weight_unit: variant.weight_unit,
        requires_shipping: variant.requires_shipping,
        taxable: variant.taxable,
      };

      const { data: savedVariant, error } = await this.supabase
        .from('shopify_variants')
        .upsert(variantData, {
          onConflict: 'shopify_variant_id',
          ignoreDuplicates: false
        })
        .select()
        .single();

      if (error) {
        console.error(`❌ Error saving variant ${variant.id}:`, error);
        continue;
      }

      syncedVariants.push(savedVariant);
    }

    console.log(`✅ Successfully synced ${syncedVariants.length} variants`);
    return syncedVariants;
  }

  // Inventory Management
  async syncInventoryLevels(customerId: string): Promise<ShopifyInventoryLevel[]> {
    console.log('🔄 Starting Shopify inventory sync...');
    
    try {
      // Get all inventory item IDs from variants
      const { data: variants, error: variantsError } = await this.supabase
        .from('shopify_variants')
        .select('inventory_item_id')
        .eq('shopify_customer_id', customerId);

      if (variantsError || !variants.length) {
        console.log('⚠️ No variants found for inventory sync');
        return [];
      }

      const inventoryItemIds = variants.map(v => v.inventory_item_id).join(',');
      
      // Fetch inventory levels from Shopify
      const response = await this.shopifyRequest(`/inventory_levels.json?inventory_item_ids=${inventoryItemIds}`);
      const inventoryLevels = response.inventory_levels;
      
      console.log(`📊 Found ${inventoryLevels.length} inventory levels in Shopify`);
      
      const syncedLevels: ShopifyInventoryLevel[] = [];
      
      for (const level of inventoryLevels) {
        const levelData: Partial<ShopifyInventoryLevel> = {
          shopify_variant_id: level.inventory_item_id.toString(), // We'll need to map this properly
          shopify_location_id: level.location_id.toString(),
          available: level.available,
          reserved: level.reserved || 0,
          incoming: level.incoming || 0,
        };

        const { data: savedLevel, error } = await this.supabase
          .from('shopify_inventory_levels')
          .upsert(levelData, {
            onConflict: 'shopify_variant_id,shopify_location_id',
            ignoreDuplicates: false
          })
          .select()
          .single();

        if (error) {
          console.error(`❌ Error saving inventory level:`, error);
          continue;
        }

        syncedLevels.push(savedLevel);
      }

      console.log(`✅ Successfully synced ${syncedLevels.length} inventory levels`);
      return syncedLevels;
      
    } catch (error) {
      console.error('❌ Error syncing Shopify inventory:', error);
      throw error;
    }
  }

  async updateInventoryLevel(variantId: string, locationId: string, quantity: number): Promise<void> {
    try {
      // Update inventory in Shopify
      const response = await this.shopifyRequest('/inventory_levels/set.json', {
        method: 'POST',
        body: JSON.stringify({
          location_id: locationId,
          inventory_item_id: variantId,
          available: quantity
        })
      });

      console.log('✅ Inventory updated in Shopify:', response);
      
      // Update local database
      await this.supabase
        .from('shopify_inventory_levels')
        .update({ 
          available: quantity,
          updated_at: new Date().toISOString()
        })
        .eq('shopify_variant_id', variantId)
        .eq('shopify_location_id', locationId);

    } catch (error) {
      console.error('❌ Error updating inventory level:', error);
      throw error;
    }
  }

  // Webhook Management
  async setupWebhooks(customerId: string, shopDomain: string): Promise<ShopifyWebhook[]> {
    console.log('🔗 Setting up Shopify webhooks...');
    
    const webhookTopics = [
      'orders/create',
      'orders/updated',
      'orders/cancelled',
      'inventory_levels/update',
      'products/update',
      'variants/update'
    ];

    const webhooks: ShopifyWebhook[] = [];
    
    for (const topic of webhookTopics) {
      try {
        // Create webhook in Shopify
        const response = await this.shopifyRequest('/webhooks.json', {
          method: 'POST',
          body: JSON.stringify({
            webhook: {
              topic,
              address: `https://${shopDomain}/api/shopify/webhooks`,
              format: 'json'
            }
          })
        });

        const webhook = response.webhook;
        
        // Save webhook to database
        const webhookData: Partial<ShopifyWebhook> = {
          shopify_customer_id: customerId,
          shopify_webhook_id: webhook.id.toString(),
          topic: webhook.topic,
          address: webhook.address,
          format: webhook.format,
          is_active: true,
        };

        const { data: savedWebhook, error } = await this.supabase
          .from('shopify_webhooks')
          .insert(webhookData)
          .select()
          .single();

        if (error) {
          console.error(`❌ Error saving webhook for topic ${topic}:`, error);
          continue;
        }

        webhooks.push(savedWebhook);
        console.log(`✅ Webhook created for topic: ${topic}`);
        
      } catch (error) {
        console.error(`❌ Error creating webhook for topic ${topic}:`, error);
      }
    }

    console.log(`✅ Successfully created ${webhooks.length} webhooks`);
    return webhooks;
  }

  // Utility Methods
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getShopInfo(): Promise<any> {
    try {
      const response = await this.shopifyRequest('/shop.json');
      return response.shop;
    } catch (error) {
      console.error('❌ Error fetching shop info:', error);
      throw error;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getLocations(): Promise<any[]> {
    try {
      const response = await this.shopifyRequest('/locations.json');
      return response.locations;
    } catch (error) {
      console.error('❌ Error fetching locations:', error);
      throw error;
    }
  }
}
