import { NextRequest, NextResponse } from 'next/server';
import { ConnectCustomerService } from '@/lib/services/connect-customer';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, testAccountId } = body;
    
    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    console.log('🧪 Testing pay gate with email:', email);
    
    const connectService = new ConnectCustomerService();
    
    // Create or get main account customer
    console.log('🔧 Creating/getting main account customer...');
    const mainCustomer = await connectService.getOrCreateMainAccountCustomer(email);
    console.log('✅ Main account customer:', mainCustomer);
    
    // Test authorization with a test account ID
    if (testAccountId) {
      console.log('🔍 Testing authorization with account ID:', testAccountId);
      const authResult = await connectService.checkPayGateAuthorization(testAccountId);
      console.log('🔐 Authorization result:', authResult);
      
      return NextResponse.json({
        mainCustomer,
        testAuthorization: authResult,
        message: 'Test completed successfully'
      });
    }
    
    return NextResponse.json({
      mainCustomer,
      message: 'Main account customer created/retrieved successfully'
    });
    
  } catch (error) {
    console.error('❌ Error in pay gate test:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Pay gate test endpoint',
    usage: 'POST with { email, testAccountId? } to test the pay gate'
  });
}
