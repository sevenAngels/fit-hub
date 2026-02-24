import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getSubscriptionStatus,
  openSubscriptionCheckoutFallback,
  reportCheckoutReturn,
  type CheckoutFallbackLaunch,
  type CheckoutIntent,
  type CheckoutResult,
  type SubscriptionStatus
} from "@/features/subscription/service";

export const subscriptionQueryKeys = {
  all: ["subscription"] as const,
  status: () => [...subscriptionQueryKeys.all, "status"] as const
};

export function useSubscriptionStatus() {
  return useQuery<SubscriptionStatus, Error>({
    queryKey: subscriptionQueryKeys.status(),
    queryFn: getSubscriptionStatus,
    staleTime: 60 * 1000
  });
}

export function useOpenSubscriptionCheckoutMutation() {
  const queryClient = useQueryClient();

  return useMutation<CheckoutFallbackLaunch, Error, CheckoutIntent>({
    mutationFn: (intent) => openSubscriptionCheckoutFallback(intent),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: subscriptionQueryKeys.status() });
    }
  });
}

export function useCreateCheckoutSessionMutation() {
  return useOpenSubscriptionCheckoutMutation();
}

export function useReportCheckoutReturnMutation() {
  const queryClient = useQueryClient();

  return useMutation<CheckoutResult, Error, string>({
    mutationFn: (url) => reportCheckoutReturn(url),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: subscriptionQueryKeys.status() });
    }
  });
}
