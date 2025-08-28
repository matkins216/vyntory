import { createServerSupabaseClient } from '@/lib/supabase/client';
import { EtsyCustomer, EtsyProduct, EtsyVariation, EtsyInventoryLevel, EtsyWebhook, EtsyOrder, EtsyOrderItem } from '@/lib/types/etsy-customer';

export class EtsyService {
  private supabase = createServerSupabaseClient();
  private baseUrl = 'https://openapi.etsy.com/v3';
  private accessToken: string;
  private refreshToken: string;
  private shopId: string;

  constructor(shopId: string, accessToken: string, refreshToken: string) {
    this.shopId = shopId;
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
  }

  // Etsy API client with proper headers
  private async etsyRequest(endpoint: string, options: RequestInit = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'x-api-key': process.env.ETSY_API_KEY!,
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Etsy API error: ${response.status} ${errorText}`);
    }

    return response.json();
  }

  // Refresh access token if needed
  private async refreshAccessToken(): Promise<void> {
    try {
      const response = await fetch('https://api.etsy.com/v3/public/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: process.env.ETSY_CLIENT_ID!,
          refresh_token: this.refreshToken,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to refresh Etsy access token');
      }

      const data = await response.json();
      this.accessToken = data.access_token;
      
      // Update the token in database
      await this.supabase
        .from('etsy_customers')
        .update({ etsy_access_token: this.accessToken })
        .eq('etsy_shop_id', this.shopId);
    } catch (error) {
      console.error('Error refreshing Etsy access token:', error);
      throw error;
    }
  }

  // Customer Management
  async createOrUpdateCustomer(customerData: Partial<EtsyCustomer>): Promise<EtsyCustomer> {
    const { data, error } = await this.supabase
      .from('etsy_customers')
      .upsert(customerData, {
        onConflict: 'etsy_shop_id',
        ignoreDuplicates: false
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating/updating Etsy customer:', error);
      throw new Error(`Failed to create/update Etsy customer: ${error.message}`);
    }

    return data;
  }

  async getCustomerByShopId(shopId: string): Promise<EtsyCustomer | null> {
    const { data, error } = await this.supabase
      .from('etsy_customers')
      .select('*')
      .eq('etsy_shop_id', shopId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      console.error('Error fetching Etsy customer:', error);
      throw new Error(`Failed to fetch Etsy customer: ${error.message}`);
    }

    return data;
  }

  // Product Management - Only fetch essential data
  async syncProducts(customerId: string): Promise<EtsyProduct[]> {
    console.log('🔄 Starting Etsy product sync...');
    
    try {
      // Fetch only essential listing data from Etsy
      const response = await this.etsyRequest(`/application/shops/${this.shopId}/listings/active?fields=listing_id,title,state,quantity,has_variations`);
      const listings = response.results;
      
      console.log(`📦 Found ${listings.length} active listings in Etsy`);
      
      const syncedProducts: EtsyProduct[] = [];
      
      for (const listing of listings) {
        // Create or update product record with only essential fields
        const productData: Partial<EtsyProduct> = {
          etsy_customer_id: customerId,
          etsy_listing_id: listing.listing_id.toString(),
          etsy_shop_id: this.shopId,
          title: listing.title,
          description: '', // Not needed for inventory management
          state: listing.state as 'active' | 'inactive' | 'sold_out' | 'draft' | 'expired',
          quantity: listing.quantity,
          has_variations: listing.has_variations || false,
        };

        const { data: savedProduct, error } = await this.supabase
          .from('etsy_products')
          .upsert(productData, {
            onConflict: 'etsy_listing_id',
            ignoreDuplicates: false
          })
          .select()
          .single();

        if (error) {
          console.error(`❌ Error saving Etsy product ${listing.listing_id}:`, error);
          continue;
        }

        syncedProducts.push(savedProduct);
      }

      console.log(`✅ Successfully synced ${syncedProducts.length} Etsy products`);
      return syncedProducts;
      
    } catch (error) {
      console.error('❌ Error syncing Etsy products:', error);
      throw error;
    }
  }

  // Inventory Management - Focus on quantity and availability
  async syncInventoryLevels(customerId: string): Promise<EtsyInventoryLevel[]> {
    console.log('🔄 Starting Etsy inventory sync...');
    
    try {
      // Get all products for this customer
      const { data: products, error: productsError } = await this.supabase
        .from('etsy_products')
        .select('etsy_listing_id')
        .eq('etsy_customer_id', customerId);

      if (productsError || !products.length) {
        console.log('⚠️ No Etsy products found for inventory sync');
        return [];
      }

      const syncedLevels: EtsyInventoryLevel[] = [];
      
      for (const product of products) {
        try {
          // Fetch only inventory data from Etsy
          const response = await this.etsyRequest(`/application/listings/${product.etsy_listing_id}/inventory?fields=products.offerings.quantity`);
          const inventory = response.results;
          
          if (inventory && inventory.products) {
            for (const invProduct of inventory.products) {
              const levelData: Partial<EtsyInventoryLevel> = {
                etsy_product_id: product.etsy_listing_id,
                etsy_listing_id: product.etsy_listing_id,
                available: invProduct.offerings[0]?.quantity || 0,
                reserved: 0, // Etsy doesn't have reserved concept
                sold: 0, // This would need to be calculated from orders
              };

              const { data: savedLevel, error } = await this.supabase
                .from('etsy_inventory_levels')
                .upsert(levelData, {
                  onConflict: 'etsy_product_id',
                  ignoreDuplicates: false
                })
                .select()
                .single();

              if (error) {
                console.error(`❌ Error saving Etsy inventory level:`, error);
                continue;
              }

              syncedLevels.push(savedLevel);
            }
          }
        } catch (error) {
          console.error(`❌ Error fetching inventory for listing ${product.etsy_listing_id}:`, error);
          continue;
        }
      }

      console.log(`✅ Successfully synced ${syncedLevels.length} Etsy inventory levels`);
      return syncedLevels;
      
    } catch (error) {
      console.error('❌ Error syncing Etsy inventory:', error);
      throw error;
    }
  }

  // Update inventory level - Core functionality
  async updateInventoryLevel(listingId: string, quantity: number): Promise<void> {
    try {
      // Update inventory in Etsy
      const response = await this.etsyRequest(`/application/listings/${listingId}/inventory`, {
        method: 'PUT',
        body: JSON.stringify({
          products: [{
            product_id: listingId,
            offerings: [{
              quantity: quantity,
              is_enabled: true
            }]
          }]
        })
      });

      console.log('✅ Etsy inventory updated:', response);
      
      // Update local database
      await this.supabase
        .from('etsy_inventory_levels')
        .update({ 
          available: quantity,
          updated_at: new Date().toISOString()
        })
        .eq('etsy_listing_id', listingId);

    } catch (error) {
      console.error('❌ Error updating Etsy inventory level:', error);
      throw error;
    }
  }

  // Order Management - Only fetch essential order data
  async syncOrders(customerId: string): Promise<EtsyOrder[]> {
    console.log('🔄 Starting Etsy order sync...');
    
    try {
      // Fetch only essential receipt data from Etsy
      const response = await this.etsyRequest(`/application/shops/${this.shopId}/receipts?fields=receipt_id,status,total_cost.amount,total_cost.currency_code`);
      const receipts = response.results;
      
      console.log(`📦 Found ${receipts.length} receipts in Etsy`);
      
      const syncedOrders: EtsyOrder[] = [];
      
      for (const receipt of receipts) {
        const orderData: Partial<EtsyOrder> = {
          etsy_customer_id: customerId,
          etsy_receipt_id: receipt.receipt_id.toString(),
          etsy_shop_id: this.shopId,
          status: receipt.status,
          total_cost: parseFloat(receipt.total_cost.amount),
          currency_code: receipt.total_cost.currency_code,
        };

        const { data: savedOrder, error } = await this.supabase
          .from('etsy_orders')
          .upsert(orderData, {
            onConflict: 'etsy_receipt_id',
            ignoreDuplicates: false
          })
          .select()
          .single();

        if (error) {
          console.error(`❌ Error saving Etsy order ${receipt.receipt_id}:`, error);
          continue;
        }

        syncedOrders.push(savedOrder);
      }

      console.log(`✅ Successfully synced ${syncedOrders.length} Etsy orders`);
      return syncedOrders;
      
    } catch (error) {
      console.error('❌ Error syncing Etsy orders:', error);
      throw error;
    }
  }

  // Webhook Management - Simplified
  async setupWebhooks(customerId: string, webhookUrl: string): Promise<EtsyWebhook[]> {
    console.log('🔗 Setting up Etsy webhooks...');
    
    // Note: Etsy doesn't have traditional webhooks like Shopify
    // We'll need to implement polling or use their notification system
    // For now, we'll create placeholder webhook records
    
    const webhookTopics = [
      'receipts/create',
      'receipts/update',
      'listings/update'
    ];

    const webhooks: EtsyWebhook[] = [];
    
    for (const topic of webhookTopics) {
      try {
        // Create webhook record in database
        const webhookData: Partial<EtsyWebhook> = {
          etsy_customer_id: customerId,
          etsy_webhook_id: `etsy_${topic}_${Date.now()}`, // Placeholder ID
          topic,
          address: webhookUrl,
          is_active: true,
        };

        const { data: savedWebhook, error } = await this.supabase
          .from('etsy_webhooks')
          .insert(webhookData)
          .select()
          .single();

        if (error) {
          console.error(`❌ Error saving webhook for topic ${topic}:`, error);
          continue;
        }

        webhooks.push(savedWebhook);
        console.log(`✅ Webhook record created for topic: ${topic}`);
        
      } catch (error) {
        console.error(`❌ Error creating webhook for topic ${topic}:`, error);
      }
    }

    console.log(`✅ Successfully created ${webhooks.length} webhook records`);
    return webhooks;
  }

  // Utility Methods - Only essential shop info
  async getShopInfo(): Promise<{ shop_name: string }> {
    try {
      const response = await this.etsyRequest(`/application/shops/${this.shopId}?fields=shop_name`);
      return response.results;
    } catch (error) {
      console.error('❌ Error fetching Etsy shop info:', error);
      throw error;
    }
  }
}
