import React, { createContext, useContext } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import Purchases from 'react-native-purchases';
import { useMutation, useQuery } from '@tanstack/react-query';

const REVENUECAT_TEST_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY;
const REVENUECAT_IOS_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
const REVENUECAT_ANDROID_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;

export const REVENUECAT_ENTITLEMENT_IDENTIFIER = 'premium';

function getRevenueCatApiKey() {
  if (!REVENUECAT_IOS_API_KEY && !REVENUECAT_ANDROID_API_KEY && !REVENUECAT_TEST_API_KEY) {
    throw new Error('RevenueCat public API keys are not configured.');
  }

  if (__DEV__ || Platform.OS === 'web' || Constants.executionEnvironment === 'storeClient') {
    return REVENUECAT_TEST_API_KEY ?? REVENUECAT_ANDROID_API_KEY ?? REVENUECAT_IOS_API_KEY;
  }

  if (Platform.OS === 'ios') return REVENUECAT_IOS_API_KEY;
  if (Platform.OS === 'android') return REVENUECAT_ANDROID_API_KEY;
  return REVENUECAT_TEST_API_KEY ?? REVENUECAT_ANDROID_API_KEY ?? REVENUECAT_IOS_API_KEY;
}

export function initializeRevenueCat() {
  if (Platform.OS === 'web') return;
  const apiKey = getRevenueCatApiKey();
  if (!apiKey) throw new Error('RevenueCat public API key not found.');
  Purchases.setLogLevel(Purchases.LOG_LEVEL.ERROR);
  Purchases.configure({ apiKey });
}

function useSubscriptionContext() {
  const customerInfoQuery = useQuery({
    queryKey: ['revenuecat', 'customer-info'],
    queryFn: () => Purchases.getCustomerInfo(),
    enabled: Platform.OS !== 'web',
    staleTime: 60 * 1000,
    retry: false,
  });

  const offeringsQuery = useQuery({
    queryKey: ['revenuecat', 'offerings'],
    queryFn: () => Purchases.getOfferings(),
    enabled: Platform.OS !== 'web',
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const purchaseMutation = useMutation({
    mutationFn: async (packageToPurchase: Parameters<typeof Purchases.purchasePackage>[0]) => {
      const { customerInfo } = await Purchases.purchasePackage(packageToPurchase);
      return customerInfo;
    },
    onSuccess: () => customerInfoQuery.refetch(),
  });

  const restoreMutation = useMutation({
    mutationFn: () => Purchases.restorePurchases(),
    onSuccess: () => customerInfoQuery.refetch(),
  });

  const isSubscribed =
    customerInfoQuery.data?.entitlements.active?.[REVENUECAT_ENTITLEMENT_IDENTIFIER] !== undefined;
  const currentOffering = offeringsQuery.data?.current;
  const packageToPurchase = currentOffering?.availablePackages[0];

  return {
    customerInfo: customerInfoQuery.data,
    currentOffering,
    packageToPurchase,
    isSubscribed,
    isLoading: customerInfoQuery.isLoading || offeringsQuery.isLoading,
    hasError: Boolean(customerInfoQuery.error || offeringsQuery.error),
    purchase: purchaseMutation.mutateAsync,
    restore: restoreMutation.mutateAsync,
    isPurchasing: purchaseMutation.isPending,
    isRestoring: restoreMutation.isPending,
  };
}

type SubscriptionContextValue = ReturnType<typeof useSubscriptionContext>;
const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const value = useSubscriptionContext();
  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (!context) throw new Error('useSubscription must be used within SubscriptionProvider');
  return context;
}