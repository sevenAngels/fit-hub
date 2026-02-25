import * as SecureStore from "expo-secure-store";

const SECURE_STORE_PREFIX = "fit-hub-auth";

function withPrefix(key: string): string {
  const normalizedKey = key.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${SECURE_STORE_PREFIX}.${normalizedKey}`;
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
