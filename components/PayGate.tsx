import React from 'react';
import { usePayGate, useFeatureAccess, useSubscriptionLimits } from '@/lib/hooks/usePayGate';

interface PayGateProps {
  stripeAccountId: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  requireActiveSubscription?: boolean;
  allowTrial?: boolean;
}

export function PayGate({
  stripeAccountId,
  children,
  fallback,
  requireActiveSubscription = true,
  allowTrial = true
}: PayGateProps) {
  const { isAuthorized, isLoading, error } = usePayGate({
    stripeAccountId,
    requireActiveSubscription,
    allowTrial
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Checking authorization...</span>
      </div>
    );
  }

  if (!isAuthorized) {
    if (fallback) {
      return <>{fallback}</>;
    }
    
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
        <div className="text-yellow-800">
          <h3 className="text-lg font-medium mb-2">Subscription Required</h3>
          <p className="text-sm mb-4">
            {error || 'You need an active subscription to access this feature.'}
          </p>
          <a
            href="/dashboard/subscription"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            View Subscription Options
          </a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

interface FeatureGateProps {
  stripeAccountId: string;
  feature: keyof NonNullable<import('@/lib/types/connect-customer').ConnectCustomer['plan_features']>;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function FeatureGate({ stripeAccountId, feature, children, fallback }: FeatureGateProps) {
  const { hasFeature, isLoading } = useFeatureAccess(stripeAccountId, feature);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!hasFeature) {
    if (fallback) {
      return <>{fallback}</>;
    }
    
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
        <p className="text-gray-600 text-sm">
          This feature is not available on your current plan.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}

interface SubscriptionStatusProps {
  stripeAccountId: string;
}

export function SubscriptionStatus({ stripeAccountId }: SubscriptionStatusProps) {
  const { customer, isLoading } = usePayGate({ stripeAccountId });
  const { limits, isTrial, trialDaysLeft } = useSubscriptionLimits(stripeAccountId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800 text-sm">No subscription found</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-medium text-gray-900">{customer.plan_name}</h3>
        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
          customer.subscription_status === 'active' 
            ? 'bg-green-100 text-green-800'
            : customer.subscription_status === 'trialing'
            ? 'bg-blue-100 text-blue-800'
            : 'bg-red-100 text-red-800'
        }`}>
          {customer.subscription_status}
        </span>
      </div>
      
      {isTrial && trialDaysLeft !== undefined && (
        <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-blue-800 text-sm">
            Trial ends in {trialDaysLeft} day{trialDaysLeft !== 1 ? 's' : ''}
          </p>
        </div>
      )}
      
      {limits && (
        <div className="space-y-2">
          {limits.max_products && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Max Products:</span>
              <span className="font-medium">{limits.max_products}</span>
            </div>
          )}
          {limits.max_inventory_updates && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Max Inventory Updates:</span>
              <span className="font-medium">{limits.max_inventory_updates}</span>
            </div>
          )}
          {limits.support_level && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Support Level:</span>
              <span className="font-medium capitalize">{limits.support_level}</span>
            </div>
          )}
        </div>
      )}
      
      <div className="mt-4 pt-3 border-t border-gray-200">
        <p className="text-xs text-gray-500">
          Next billing: {customer.current_period_end 
            ? new Date(customer.current_period_end).toLocaleDateString()
            : 'N/A'
          }
        </p>
      </div>
    </div>
  );
}
