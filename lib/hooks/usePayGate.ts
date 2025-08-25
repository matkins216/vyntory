import { useState, useEffect, useCallback } from 'react';
import { ConnectCustomer, PayGateCheckResult } from '@/lib/types/connect-customer';

interface UsePayGateOptions {
  stripeAccountId: string;
  autoCheck?: boolean;
  requireActiveSubscription?: boolean;
  allowTrial?: boolean;
}

interface UsePayGateReturn {
  isAuthorized: boolean;
  isLoading: boolean;
  customer?: ConnectCustomer;
  error?: string;
  checkAuthorization: () => Promise<void>;
  refreshAuthorization: () => Promise<void>;
}

export function usePayGate({
  stripeAccountId,
  autoCheck = true,
  requireActiveSubscription = true,
  allowTrial = true
}: UsePayGateOptions): UsePayGateReturn {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [customer, setCustomer] = useState<ConnectCustomer | undefined>();
  const [error, setError] = useState<string | undefined>();

  const checkAuthorization = useCallback(async () => {
    if (!stripeAccountId) {
      setError('No Stripe account ID provided');
      return;
    }

    setIsLoading(true);
    setError(undefined);

    try {
      const response = await fetch('/api/pay-gate/check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-stripe-account-id': stripeAccountId
        },
        body: JSON.stringify({
          requireActiveSubscription,
          allowTrial
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: PayGateCheckResult = await response.json();
      
      setIsAuthorized(result.isAuthorized);
      setCustomer(result.customer);
      
      if (!result.isAuthorized && result.reason) {
        setError(result.reason);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to check authorization';
      setError(errorMessage);
      setIsAuthorized(false);
    } finally {
      setIsLoading(false);
    }
  }, [stripeAccountId, requireActiveSubscription, allowTrial]);

  const refreshAuthorization = useCallback(async () => {
    await checkAuthorization();
  }, [checkAuthorization]);

  useEffect(() => {
    if (autoCheck && stripeAccountId) {
      checkAuthorization();
    }
  }, [autoCheck, stripeAccountId, checkAuthorization]);

  return {
    isAuthorized,
    isLoading,
    customer,
    error,
    checkAuthorization,
    refreshAuthorization
  };
}

// Hook for checking if user has access to specific features
export function useFeatureAccess(
  stripeAccountId: string,
  feature: keyof ConnectCustomer['plan_features']
) {
  const { isAuthorized, customer, isLoading } = usePayGate({
    stripeAccountId,
    autoCheck: true
  });

  const hasFeature = isAuthorized && customer?.plan_features?.[feature];

  return {
    hasFeature,
    isLoading,
    customer,
    featureValue: customer?.plan_features?.[feature]
  };
}

// Hook for checking subscription limits
export function useSubscriptionLimits(stripeAccountId: string) {
  const { customer, isLoading } = usePayGate({
    stripeAccountId,
    autoCheck: true
  });

  return {
    isLoading,
    customer,
    limits: customer?.plan_features || {},
    isTrial: customer?.subscription_status === 'trialing',
    trialDaysLeft: customer?.trial_end 
      ? Math.ceil((new Date(customer.trial_end).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
      : undefined
  };
}
