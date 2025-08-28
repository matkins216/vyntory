import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/client';
import { logger } from '@/lib/utils/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: productId } = await params;
    const supabase = createServerSupabaseClient();

    const { data: threshold, error } = await supabase
      .from('thresholds')
      .select('*')
      .eq('product_id', productId)
      .single();

    if (error && error.code !== 'PGRST116') {
      logger.error('Failed to fetch threshold', error, { productId });
      return NextResponse.json(
        { error: 'Failed to fetch threshold' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      threshold: threshold?.threshold || 10,
      id: threshold?.id 
    });
  } catch (error) {
    logger.error('Unexpected error fetching threshold', error as Error, { productId: (await params).id });
    return NextResponse.json(
      { error: 'Failed to fetch threshold' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: productId } = await params;
    const supabase = createServerSupabaseClient();
    const { threshold } = await request.json();

    if (typeof threshold !== 'number' || threshold < 0) {
      return NextResponse.json(
        { error: 'Invalid threshold value' },
        { status: 400 }
      );
    }

    // Check if threshold exists
    const { data: existingThreshold } = await supabase
      .from('thresholds')
      .select('id')
      .eq('product_id', productId)
      .single();

    let result;
    if (existingThreshold) {
      // Update existing threshold
      result = await supabase
        .from('thresholds')
        .update({ 
          threshold,
          updated_at: new Date().toISOString()
        })
        .eq('product_id', productId)
        .select()
        .single();
    } else {
      // Create new threshold
      result = await supabase
        .from('thresholds')
        .insert({
          product_id: productId,
          threshold,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
    }

    if (result.error) {
      logger.error('Failed to update threshold', result.error, { productId, threshold });
      return NextResponse.json(
        { error: 'Failed to update threshold' },
        { status: 500 }
      );
    }

    logger.info('Threshold updated successfully', { productId, threshold });
    return NextResponse.json({ 
      success: true,
      threshold: result.data.threshold 
    });
  } catch (error) {
    logger.error('Unexpected error updating threshold', error as Error, { productId: (await params).id });
    return NextResponse.json(
      { error: 'Failed to update threshold' },
      { status: 500 }
    );
  }
}
