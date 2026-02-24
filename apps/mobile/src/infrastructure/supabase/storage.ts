import * as SecureStore from "expo-secure-store";

const SECURE_STORE_PREFIX = "fit-hub-auth";

function withPrefix(key: string): string {
  return `${SECURE_STORE_PREFIX}:${key}`;
}

export const secureStoreAuthStorage = {
  getItem: async (key: string): Promise<string | null> => {
    return SecureStore.getItemAsync(withPrefix(key));
  },
  setItem: async (key: string, value: string): Promise<void> => {
    await SecureStore.setItemAsync(withPrefix(key), value, {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY
    });
  },
  removeItem: async (key: string): Promise<void> => {
    await SecureStore.deleteItemAsync(withPrefix(key));
  }
};
