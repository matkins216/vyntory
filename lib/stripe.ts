import Stripe from 'stripe';
import { InventoryAuditService } from './services/inventory-audit';
import { InventoryMetadata } from './types/inventory';

// Main Stripe instance for OAuth operations
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-07-30.basil',
});

// Client-side Stripe instance
export const stripeClient = new Stripe(process.env.STRIPE_PUBLISHABLE_KEY!, {
  apiVersion: '2025-07-30.basil',
});

export const STRIPE_CLIENT_ID = process.env.STRIPE_CLIENT_ID!;

// Function to create Stripe instance for a connected account
export const createConnectedStripe = (accessToken: string) => {
  return new Stripe(accessToken, {
    apiVersion: '2025-07-30.basil',
  });
};

export const getInventoryFromMetadata = (metadata: Stripe.Metadata): InventoryMetadata => {
  try {
    if (metadata.inventory) {
      return JSON.parse(metadata.inventory);
    }
  } catch (error) {
    console.error('Error parsing inventory metadata:', error);
  }
  
  return {
    inventory: 0,
    lastUpdated: new Date().toISOString(),
    lastUpdatedBy: 'system'
  };
};

export const updateInventoryMetadata = async (
  productId: string,
  newQuantity: number,
  previousQuantity: number,
  userId: string,
  action: string,
  reason?: string,
  accessToken?: string,
  stripeAccount?: string
): Promise<void> => {
  // Always use the main Stripe instance with stripeAccount parameter for connected accounts
  // This ensures we're operating in the correct account context
  const stripeInstance = stripe;
  
  const product = await stripeInstance.products.retrieve(productId, {
    stripeAccount: stripeAccount
  });
  
  // Create audit log in Supabase
  const auditService = new InventoryAuditService();
  await auditService.createAuditLog({
    product_id: productId,
    stripe_account_id: stripeAccount || 'main',
    action,
    quantity: newQuantity,
    previous_quantity: previousQuantity,
    user_id: userId,
    reason,
    timestamp: new Date().toISOString()
  });

  // Update Stripe metadata with only essential information (no audit logs)
  const updatedMetadata: InventoryMetadata = {
    inventory: newQuantity,
    lastUpdated: new Date().toISOString(),
    lastUpdatedBy: userId
  };

  // Update product metadata
  await stripeInstance.products.update(productId, {
    metadata: {
      ...product.metadata,
      inventory: JSON.stringify(updatedMetadata)
    }
  }, {
    stripeAccount: stripeAccount
  });

  // If inventory reaches zero, disable the product
  if (newQuantity <= 0) {
    await stripeInstance.products.update(productId, {
      active: false
    }, {
      stripeAccount: stripeAccount
    });
  } else if (!product.active && newQuantity > 0) {
    // Re-enable product if inventory is restored
    await stripeInstance.products.update(productId, {
      active: true
    }, {
      stripeAccount: stripeAccount
    });
  }
};

// Helper function to get products from connected account
export const getConnectedAccountProducts = async (accessToken: string) => {
  const connectedStripe = createConnectedStripe(accessToken);
  
  const products = await connectedStripe.products.list({
    limit: 100,
    active: true,
  });

  // Fetch prices for each product
  const productsWithPrices = await Promise.all(
    products.data.map(async (product) => {
      const prices = await connectedStripe.prices.list({
        product: product.id,
        active: true,
      });

      const inventory = getInventoryFromMetadata(product.metadata);
      
      return {
        id: product.id,
        name: product.name,
        description: product.description,
        images: product.images,
        active: product.active,
        metadata: product.metadata,
        inventory,
        prices: prices.data.map(price => ({
          id: price.id,
          currency: price.currency,
          unit_amount: price.unit_amount,
          recurring: price.recurring,
        })),
        created: product.created,
      };
    })
  );

  return productsWithPrices;
};
