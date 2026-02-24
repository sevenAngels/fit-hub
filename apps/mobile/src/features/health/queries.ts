import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getAndroidHealthConnectSnapshot,
  getIOSHealthPermissionSnapshot,
  openAndroidHealthConnectInstallProvider,
  openAndroidHealthConnectSettings,
  openIOSHealthSettings,
  requestAndroidHealthConnectPermission,
  requestIOSHealthPermission,
  type AndroidHealthConnectSnapshot,
  type IOSHealthPermissionSnapshot
} from "@/features/health/service";

export const healthQueryKeys = {
  all: ["health"] as const,
  iosPermission: () => [...healthQueryKeys.all, "ios", "permission"] as const,
  androidProvider: () => [...healthQueryKeys.all, "android", "provider"] as const
};

export function useIOSHealthPermissionSnapshotQuery(enabled = true) {
  return useQuery<IOSHealthPermissionSnapshot, Error>({
    queryKey: healthQueryKeys.iosPermission(),
    queryFn: getIOSHealthPermissionSnapshot,
    enabled,
    staleTime: 15 * 1000
  });
}

export function useAndroidHealthConnectSnapshotQuery(enabled = true) {
  return useQuery<AndroidHealthConnectSnapshot, Error>({
    queryKey: healthQueryKeys.androidProvider(),
    queryFn: getAndroidHealthConnectSnapshot,
    enabled,
    staleTime: 15 * 1000
  });
}

export function useRequestIOSHealthPermissionMutation() {
  const queryClient = useQueryClient();

  return useMutation<IOSHealthPermissionSnapshot, Error>({
    mutationFn: requestIOSHealthPermission,
    onSuccess: (snapshot) => {
      queryClient.setQueryData(healthQueryKeys.iosPermission(), snapshot);
    }
  });
}

export function useRequestAndroidHealthConnectPermissionMutation() {
  const queryClient = useQueryClient();

  return useMutation<AndroidHealthConnectSnapshot, Error>({
    mutationFn: requestAndroidHealthConnectPermission,
    onSuccess: (snapshot) => {
      queryClient.setQueryData(healthQueryKeys.androidProvider(), snapshot);
    }
  });
}

export function useOpenIOSHealthSettingsMutation() {
  return useMutation<void, Error>({
    mutationFn: openIOSHealthSettings
  });
}

export function useOpenAndroidHealthConnectSettingsMutation() {
  return useMutation<void, Error>({
    mutationFn: openAndroidHealthConnectSettings
  });
}

export function useOpenAndroidHealthConnectInstallProviderMutation() {
  return useMutation<void, Error>({
    mutationFn: openAndroidHealthConnectInstallProvider
  });
}
