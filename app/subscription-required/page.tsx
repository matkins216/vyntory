'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';

function SubscriptionRequiredContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [redirectPath, setRedirectPath] = useState<string>('');
  const [reason, setReason] = useState<string>('');

  useEffect(() => {
    const redirect = searchParams.get('redirect');
    const reasonParam = searchParams.get('reason');
    
    if (redirect) {
      setRedirectPath(redirect);
    }
    
    if (reasonParam) {
      setReason(reasonParam);
    }
  }, [searchParams]);

  const handleSubscribe = () => {
    // Redirect to your Stripe checkout or subscription page
    // You'll need to implement this based on your Stripe setup
    router.push('/subscribe');
  };

  const handleGoHome = () => {
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 text-red-600">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            
            <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
              Subscription Required
            </h2>
            
            <p className="mt-2 text-sm text-gray-600">
              {reason || 'You need an active subscription to access this feature.'}
            </p>
            
            {redirectPath && (
              <p className="mt-2 text-sm text-gray-500">
                You were trying to access: <span className="font-mono text-gray-700">{redirectPath}</span>
              </p>
            )}
          </div>

          <div className="mt-8 space-y-4">
            <button
              onClick={handleSubscribe}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Subscribe Now
            </button>
            
            <button
              onClick={handleGoHome}
              className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Go Home
            </button>
          </div>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">Need help?</span>
              </div>
            </div>
            
            <div className="mt-6 text-center">
              <p className="text-xs text-gray-500">
                Contact support at{' '}
                <a href="mailto:support@example.com" className="text-blue-600 hover:text-blue-500">
                  support@example.com
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SubscriptionRequiredPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        </div>
      </div>
    }>
      <SubscriptionRequiredContent />
    </Suspense>
  );
}
