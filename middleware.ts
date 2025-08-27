import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createPayGateMiddleware } from '@/lib/middleware/pay-gate';

// Define protected routes that require subscription
const protectedRoutes = [
  '/dashboard',
  '/inventory',
  '/settings',
  '/api/inventory',
  '/api/products',
  '/api/stripe/webhook-test'
];

// Define public routes that don't need protection
const publicRoutes = [
  '/',
  '/login',
  '/signup',
  '/api/auth',
  '/api/pay-gate/check',
  '/api/pay-gate/webhook'
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Allow public routes to pass through
  if (publicRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }
  
  // Check if this is a protected route
  if (protectedRoutes.some(route => pathname.startsWith(route))) {
    return createPayGateMiddleware()(request);
  }
  
  // For any other routes, allow access (you can modify this behavior)
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
