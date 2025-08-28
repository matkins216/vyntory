import { NextResponse } from 'next/server';
import { CombinedInventoryService } from '@/lib/services/combined-inventory-service';
import { createServerSupabaseClient } from '@/lib/supabase/client';

export async function GET() {
  try {
    const supabase = createServerSupabaseClient();
    
    // For now, we'll use a simplified approach without user authentication
    // You can modify this later based on your authentication system
    
    // Get the first available customer ID (you can modify this based on your needs)
    const { data: customers, error: customerError } = await supabase
      .from('connect_customers')
      .select('id')
      .limit(1);

    if (customerError || !customers || customers.length === 0) {
      return NextResponse.json({ error: 'No customers found' }, { status: 404 });
    }

    const customerId = customers[0].id;
    const combinedService = new CombinedInventoryService();
    
    // Get combined inventory
    const inventory = await combinedService.getCombinedInventory(customerId);
    
    // Get inventory summary
    const summary = await combinedService.getInventorySummary(customerId);

    return NextResponse.json({
      inventory,
      summary,
      success: true
    });

  } catch (error) {
    console.error('❌ Error getting combined inventory:', error);
    return NextResponse.json({ error: 'Failed to get inventory' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { productIdentifier, newQuantity, platform } = await request.json();
    
    if (!productIdentifier || newQuantity === undefined || !platform) {
      return NextResponse.json({ 
        error: 'productIdentifier, newQuantity, and platform are required' 
      }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();
    
    // For now, we'll use a simplified approach without user authentication
    // You can modify this later based on your authentication system
    
    // Get the first available customer ID (you can modify this based on your needs)
    const { data: customers, error: customerError } = await supabase
      .from('connect_customers')
      .select('id')
      .limit(1);

    if (customerError || !customers || customers.length === 0) {
      return NextResponse.json({ error: 'No customers found' }, { status: 404 });
    }

    const customerId = customers[0].id;
    const combinedService = new CombinedInventoryService();
    
    // Update inventory across platforms
    await combinedService.updateInventoryAcrossPlatforms(
      customerId,
      productIdentifier,
      newQuantity,
      platform
    );

    return NextResponse.json({
      success: true,
      message: `Inventory updated to ${newQuantity} for ${productIdentifier} on ${platform}`
    });

  } catch (error) {
    console.error('❌ Error updating combined inventory:', error);
    return NextResponse.json({ error: 'Failed to update inventory' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { sourcePlatform, targetPlatform } = await request.json();
    
    if (!sourcePlatform || !targetPlatform) {
      return NextResponse.json({ 
        error: 'sourcePlatform and targetPlatform are required' 
      }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();
    
    // For now, we'll use a simplified approach without user authentication
    // You can modify this later based on your authentication system
    
    // Get the first available customer ID (you can modify this based on your needs)
    const { data: customers, error: customerError } = await supabase
      .from('connect_customers')
      .select('id')
      .limit(1);

    if (customerError || !customers || customers.length === 0) {
      return NextResponse.json({ error: 'No customers found' }, { status: 404 });
    }

    const customerId = customers[0].id;
    const combinedService = new CombinedInventoryService();
    
    // Sync inventory between platforms
    await combinedService.syncInventoryBetweenPlatforms(
      customerId,
      sourcePlatform,
      targetPlatform
    );

    return NextResponse.json({
      success: true,
      message: `Inventory synced from ${sourcePlatform} to ${targetPlatform}`
    });

  } catch (error) {
    console.error('❌ Error syncing inventory between platforms:', error);
    return NextResponse.json({ error: 'Failed to sync inventory' }, { status: 500 });
  }
}
