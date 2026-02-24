import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getUserProfile,
  pickAvatarImage,
  updateUserProfile,
  uploadProfileAvatar,
  type PickedAvatarImage,
  type UpdateProfileInput,
  type UserProfileData
} from "@/features/profile/service";

export const profileQueryKeys = {
  all: ["profile"] as const,
  detail: () => [...profileQueryKeys.all, "detail"] as const
};

export function useUserProfile() {
  return useQuery<UserProfileData, Error>({
    queryKey: profileQueryKeys.detail(),
    queryFn: getUserProfile,
    staleTime: 5 * 60 * 1000
  });
}

export function useUpdateProfileMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateProfileInput) => updateUserProfile(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: profileQueryKeys.detail() });
    }
  });
}

export function useUploadProfileAvatarMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (image: PickedAvatarImage) => uploadProfileAvatar(image),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: profileQueryKeys.detail() });
    }
  });
}

export { pickAvatarImage };
