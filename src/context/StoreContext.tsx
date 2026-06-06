import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";

const STORAGE_KEY_STORE = "@twd_store_info";

type StoreData = {
  storeKode:      string;
  storeName:      string;
  ownerName:      string;
  storeAddress:   string;
  storePhone:     string;
  storeLatitude:  number | null;
  storeLongitude: number | null;
  isStoreSetup:   boolean;
};

type StoreContextType = {
  // ── Field lama ──
  storeKode:      string | null;
  storeName:      string | null;
  ownerName:      string | null;
  isStoreSetup:   boolean;
  // ✅ 3 argumen terpisah sesuai panggilan di LoginScreen
  setupStore:     (storeKode: string, storeName: string, ownerName: string) => Promise<void>;
  resetStore:     () => Promise<void>;
  // ── Field baru ──
  storeAddress:   string | null;
  storePhone:     string | null;
  storeLatitude:  number | null;
  storeLongitude: number | null;
  updateStore:    (data: Partial<Omit<StoreData, "storeKode" | "isStoreSetup">>) => Promise<void>;
};

const StoreContext = createContext<StoreContextType>({
  storeKode:      null,
  storeName:      null,
  ownerName:      null,
  isStoreSetup:   false,
  setupStore:     async () => {},
  resetStore:     async () => {},
  storeAddress:   null,
  storePhone:     null,
  storeLatitude:  null,
  storeLongitude: null,
  updateStore:    async () => {},
});

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<Partial<StoreData>>({});

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY_STORE).then(raw => {
      if (raw) {
        try { setData(JSON.parse(raw)); } catch { /* ignore */ }
      }
    });
  }, []);

  const persist = async (updated: Partial<StoreData>) => {
    setData(updated);
    await AsyncStorage.setItem(STORAGE_KEY_STORE, JSON.stringify(updated));
  };

  // ✅ 3 argumen terpisah
  const setupStore = async (
    storeKode: string,
    storeName: string,
    ownerName: string,
  ) => {
    await persist({
      ...data,
      storeKode,
      storeName,
      ownerName,
      isStoreSetup: true,
    });
  };

  const resetStore = async () => {
    await AsyncStorage.removeItem(STORAGE_KEY_STORE);
    setData({});
  };

  const updateStore = async (
    input: Partial<Omit<StoreData, "storeKode" | "isStoreSetup">>,
  ) => {
    await persist({ ...data, ...input });
  };

  const contextValue: StoreContextType = {
    storeKode:      data.storeKode      ?? null,
    storeName:      data.storeName      ?? null,
    ownerName:      data.ownerName      ?? null,
    isStoreSetup:   data.isStoreSetup   ?? false,
    setupStore,
    resetStore,
    storeAddress:   data.storeAddress   ?? null,
    storePhone:     data.storePhone     ?? null,
    storeLatitude:  data.storeLatitude  ?? null,
    storeLongitude: data.storeLongitude ?? null,
    updateStore,
  };

  return (
    <StoreContext.Provider value={contextValue}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  return useContext(StoreContext);
}