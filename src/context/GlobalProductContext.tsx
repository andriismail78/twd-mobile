import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

const STORAGE_KEY_STORE_PRODUCTS  = "@twd_products";
const STORAGE_KEY_GLOBAL_PRODUCTS = "@twd_global_products";

export const KOMISI_PER_PRODUK = 500;

export type Product = {
  id:        string;
  name:      string;
  sellPrice: number;
  buyPrice:  number;
  stock:     number;
  barcode?:  string;
  kategori:  string;
};

export type GlobalProduct = {
  id:           string;
  name:         string;
  sellPrice?:   number;
  buyPrice?:    number;
  stock?:       number;
  barcode?:     string;
  kategori:     string;
  ownerId?:     string;   // owner toko yang di-assign ke produk ini
  komisi?:      number;
  addedBy?:     string;   // ID marketing/sub-marketing yang menambah produk
  addedByName?: string;
};

type GlobalProductContextType = {
  products:               Product[];
  reload:                 () => Promise<void>;
  globalProducts:         GlobalProduct[];
  addGlobalProduct:       (p: Omit<GlobalProduct, "id">) => Promise<void>;
  updateGlobalProduct:    (id: string, updates: Partial<Omit<GlobalProduct, "id">>) => Promise<void>;
  deleteGlobalProduct:    (id: string) => Promise<void>;
  getKomisiProduk:        (userId: string) => number;
  getProductsByUser:      (userId: string) => GlobalProduct[];   // filter by ownerId
  getProductsAddedByUser: (userId: string) => GlobalProduct[];   // filter by addedBy
};

const GlobalProductContext = createContext<GlobalProductContextType>({
  products:               [],
  reload:                 async () => {},
  globalProducts:         [],
  addGlobalProduct:       async () => {},
  updateGlobalProduct:    async () => {},
  deleteGlobalProduct:    async () => {},
  getKomisiProduk:        () => KOMISI_PER_PRODUK,
  getProductsByUser:      () => [],
  getProductsAddedByUser: () => [],
});

export function GlobalProductProvider({ children }: { children: React.ReactNode }) {
  const [products,       setProducts]       = useState<Product[]>([]);
  const [globalProducts, setGlobalProducts] = useState<GlobalProduct[]>([]);

  // ─── Load store products ──────────────────────────────────────────────────
  const loadStoreProducts = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY_STORE_PRODUCTS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setProducts(parsed);
        } else if (parsed && typeof parsed === "object") {
          setProducts(Object.values(parsed));
        }
      }
    } catch { /* ignore */ }
  }, []);

  // ─── Load global products ─────────────────────────────────────────────────
  const loadGlobalProducts = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY_GLOBAL_PRODUCTS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setGlobalProducts(parsed);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    loadStoreProducts();
    loadGlobalProducts();
    const interval = setInterval(loadStoreProducts, 5_000);
    return () => clearInterval(interval);
  }, []);

  // ─── CRUD ─────────────────────────────────────────────────────────────────

  const addGlobalProduct = useCallback(async (p: Omit<GlobalProduct, "id">) => {
    const newProduct: GlobalProduct = { ...p, id: Date.now().toString() };
    setGlobalProducts(prev => {
      const updated = [...prev, newProduct];
      AsyncStorage.setItem(STORAGE_KEY_GLOBAL_PRODUCTS, JSON.stringify(updated));
      return updated;
    });
  }, []);

  /** Update field tertentu pada GlobalProduct (misal ownerId saat assign owner) */
  const updateGlobalProduct = useCallback(
    async (id: string, updates: Partial<Omit<GlobalProduct, "id">>) => {
      setGlobalProducts(prev => {
        const updated = prev.map(p =>
          p.id === id ? { ...p, ...updates } : p,
        );
        AsyncStorage.setItem(STORAGE_KEY_GLOBAL_PRODUCTS, JSON.stringify(updated));
        return updated;
      });
    },
    [],
  );

  const deleteGlobalProduct = useCallback(async (id: string) => {
    setGlobalProducts(prev => {
      const updated = prev.filter(p => p.id !== id);
      AsyncStorage.setItem(STORAGE_KEY_GLOBAL_PRODUCTS, JSON.stringify(updated));
      return updated;
    });
  }, []);

  // ─── Query helpers ────────────────────────────────────────────────────────

  /**
   * Hitung komisi produk untuk seorang marketing/sub-marketing.
   * Dihitung dari produk yang DIA TAMBAHKAN (addedBy === userId).
   */
  const getKomisiProduk = useCallback(
    (userId: string): number => {
      const count = globalProducts.filter(p => p.addedBy === userId).length;
      return count * KOMISI_PER_PRODUK;
    },
    [globalProducts],
  );

  /** Produk yang di-assign ke owner tertentu (ownerId === userId) */
  const getProductsByUser = useCallback(
    (userId: string): GlobalProduct[] => {
      return globalProducts.filter(p => p.ownerId === userId);
    },
    [globalProducts],
  );

  /** Produk yang DITAMBAHKAN oleh marketing/sub-marketing (addedBy === userId) */
  const getProductsAddedByUser = useCallback(
    (userId: string): GlobalProduct[] => {
      return globalProducts.filter(p => p.addedBy === userId);
    },
    [globalProducts],
  );

  // ─── Context value ────────────────────────────────────────────────────────
  const contextValue: GlobalProductContextType = {
    products,
    reload:                 loadStoreProducts,
    globalProducts,
    addGlobalProduct,
    updateGlobalProduct,
    deleteGlobalProduct,
    getKomisiProduk,
    getProductsByUser,
    getProductsAddedByUser,
  };

  return (
    <GlobalProductContext.Provider value={contextValue}>
      {children}
    </GlobalProductContext.Provider>
  );
}

export function useGlobalProducts() {
  return useContext(GlobalProductContext);
}