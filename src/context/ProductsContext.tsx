import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

// ─── Storage Keys ─────────────────────────────────────────────────────────────

const STORAGE_KEY_PRODUCTS  = "@twd_products";
const STORAGE_KEY_TRANSAKSI = "@twd_transaksi";
const STORAGE_KEY_METODE    = "@twd_metode_valuasi";
const STOK_MENIPIS_DEFAULT  = 5;

// ─── Types ────────────────────────────────────────────────────────────────────

export type MetodeValuasi = "average" | "fifo" | "lifo";

export type KategoriProduk =
  | "Makanan" | "Minuman" | "Snack" | "Rokok"
  | "Sembako" | "Kebersihan" | "Lainnya";

export const KATEGORI_LIST: KategoriProduk[] = [
  "Makanan", "Minuman", "Snack", "Rokok", "Sembako", "Kebersihan", "Lainnya",
];

export type StokBatch = {
  batchId:  string;
  buyPrice: number;
  qty:      number;
  tanggal:  string;
};

export type Product = {
  id:        string;
  ownerId?:  string;
  name:      string;
  barcode:   string;
  sellPrice: number;
  buyPrice:  number;
  avgCost:   number;
  stock:     number;
  stockMin:  number;
  kategori:  KategoriProduk;
  satuan:    string;
  batches:   StokBatch[];
  createdAt: string;
  updatedAt: string;
};

export type TransaksiItem = {
  productId: string;
  name:      string;
  price:     number;
  hpp:       number;
  qty:       number;
};

export type Transaksi = {
  id:           string;
  ownerId?:     string;
  tanggal:      string;
  kasirId?:     string;
  kasirNama?:   string;
  items:        TransaksiItem[];
  subtotal:     number;
  diskon:       number;
  biayaLayanan: number;  // ← Rp 1.000 per transaksi
  total:        number;  // sudah termasuk biayaLayanan
  metodeBayar:  string;
  dibayar:      number;
  kembalian:    number;
  totalHPP:     number;
  labaKotor:    number;  // total - biayaLayanan - totalHPP
};

export type AddTransaksiPayload = {
  id:           string;
  ownerId?:     string;
  items:        { productId: string; name: string; price: number; qty: number }[];
  subtotal:     number;
  diskon:       number;
  biayaLayanan: number;  // ← wajib diisi dari KasirScreen
  total:        number;  // sudah termasuk biayaLayanan
  metodeBayar:  string;
  dibayar:      number;
  kembalian:    number;
  kasirId?:     string;
  kasirNama?:   string;
};

// ─── Context Type ─────────────────────────────────────────────────────────────

type ProductsContextType = {
  products:              Product[];
  transaksi:             Transaksi[];
  isLoading:             boolean;
  metodeValuasi:         MetodeValuasi | null;
  simpanMetode:          (metode: MetodeValuasi) => Promise<void>;
  addProduct:            (data: Omit<Product, "id"|"avgCost"|"batches"|"createdAt"|"updatedAt">) => Promise<void>;
  updateProduct:         (id: string, data: Partial<Omit<Product, "id"|"createdAt">>) => Promise<void>;
  deleteProduct:         (id: string) => Promise<void>;
  restockProduct:        (id: string, qty: number, buyPrice: number) => Promise<void>;
  addTransaksi:          (payload: AddTransaksiPayload) => Promise<void>;
  getLowStockProducts:   () => Product[];
  getOutOfStockProducts: () => Product[];
};

// ─── Context & Hook ───────────────────────────────────────────────────────────

const ProductsContext = createContext<ProductsContextType | undefined>(undefined);

export const useProducts = (): ProductsContextType => {
  const ctx = useContext(ProductsContext);
  if (!ctx) throw new Error("useProducts must be used within ProductsProvider");
  return ctx;
};

// ─── Hitung HPP berdasarkan metode valuasi ────────────────────────────────────

function hitungHPP(
  product: Product,
  qty:     number,
  metode:  MetodeValuasi,
): { hppPerUnit: number; updatedBatches: StokBatch[] } {
  if (metode === "average") {
    return { hppPerUnit: product.avgCost, updatedBatches: product.batches };
  }

  if (metode === "fifo") {
    const batches  = [...product.batches];
    let remaining  = qty;
    let totalCost  = 0;
    for (let i = 0; i < batches.length && remaining > 0; i++) {
      const take    = Math.min(batches[i].qty, remaining);
      totalCost    += take * batches[i].buyPrice;
      batches[i]    = { ...batches[i], qty: batches[i].qty - take };
      remaining    -= take;
    }
    return {
      hppPerUnit:     qty > 0 ? totalCost / qty : 0,
      updatedBatches: batches.filter(b => b.qty > 0),
    };
  }

  if (metode === "lifo") {
    const batches  = [...product.batches];
    let remaining  = qty;
    let totalCost  = 0;
    for (let i = batches.length - 1; i >= 0 && remaining > 0; i--) {
      const take    = Math.min(batches[i].qty, remaining);
      totalCost    += take * batches[i].buyPrice;
      batches[i]    = { ...batches[i], qty: batches[i].qty - take };
      remaining    -= take;
    }
    return {
      hppPerUnit:     qty > 0 ? totalCost / qty : 0,
      updatedBatches: batches.filter(b => b.qty > 0),
    };
  }

  return { hppPerUnit: product.buyPrice, updatedBatches: product.batches };
}

// ─── Hitung average cost baru setelah restock ─────────────────────────────────

function hitungAvgCostBaru(
  currentStock:   number,
  currentAvgCost: number,
  newQty:         number,
  newBuyPrice:    number,
): number {
  const totalQty = currentStock + newQty;
  if (totalQty === 0) return newBuyPrice;
  return (currentStock * currentAvgCost + newQty * newBuyPrice) / totalQty;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export const ProductsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [products,      setProducts]      = useState<Product[]>([]);
  const [transaksi,     setTransaksi]     = useState<Transaksi[]>([]);
  const [isLoading,     setIsLoading]     = useState(true);
  const [metodeValuasi, setMetodeValuasi] = useState<MetodeValuasi | null>(null);

  // ── Load dari AsyncStorage ─────────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      try {
        const [pRaw, tRaw, mRaw] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY_PRODUCTS),
          AsyncStorage.getItem(STORAGE_KEY_TRANSAKSI),
          AsyncStorage.getItem(STORAGE_KEY_METODE),
        ]);
        if (pRaw) setProducts(JSON.parse(pRaw));
        if (tRaw) setTransaksi(JSON.parse(tRaw));
        if (mRaw) setMetodeValuasi(mRaw as MetodeValuasi);
      } catch (e) {
        console.error("Gagal load storage:", e);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // ── Helpers Save ───────────────────────────────────────────────────────────

  const saveProducts = useCallback(async (data: Product[]) => {
    setProducts(data);
    await AsyncStorage.setItem(STORAGE_KEY_PRODUCTS, JSON.stringify(data));
  }, []);

  const saveTransaksi = useCallback(async (data: Transaksi[]) => {
    setTransaksi(data);
    await AsyncStorage.setItem(STORAGE_KEY_TRANSAKSI, JSON.stringify(data));
  }, []);

  // ── simpanMetode ───────────────────────────────────────────────────────────

  const simpanMetode = useCallback(async (metode: MetodeValuasi) => {
    setMetodeValuasi(metode);
    await AsyncStorage.setItem(STORAGE_KEY_METODE, metode);
  }, []);

  // ── addProduct ─────────────────────────────────────────────────────────────
  // ✅ PERBAIKAN: jangan buat batch jika stock = 0
  // (kasus import produk global: stock awal 0, isi manual saat restock)

  const addProduct = useCallback(
    async (data: Omit<Product, "id"|"avgCost"|"batches"|"createdAt"|"updatedAt">) => {
      const now = new Date().toISOString();
      const id  = Date.now().toString();

      // Buat batch awal hanya jika stok > 0
      const initialBatches: StokBatch[] = data.stock > 0
        ? [{ batchId: id, buyPrice: data.buyPrice, qty: data.stock, tanggal: now }]
        : [];

      const newProd: Product = {
        ...data,
        id,
        stockMin:  data.stockMin ?? STOK_MENIPIS_DEFAULT,
        avgCost:   data.buyPrice,
        batches:   initialBatches,
        createdAt: now,
        updatedAt: now,
      };
      await saveProducts([...products, newProd]);
    },
    [products, saveProducts],
  );

  // ── updateProduct ──────────────────────────────────────────────────────────

  const updateProduct = useCallback(
    async (id: string, data: Partial<Omit<Product, "id"|"createdAt">>) => {
      const updated = products.map(p =>
        p.id === id ? { ...p, ...data, updatedAt: new Date().toISOString() } : p
      );
      await saveProducts(updated);
    },
    [products, saveProducts],
  );

  // ── deleteProduct ──────────────────────────────────────────────────────────

  const deleteProduct = useCallback(
    async (id: string) => {
      await saveProducts(products.filter(p => p.id !== id));
    },
    [products, saveProducts],
  );

  // ── restockProduct ─────────────────────────────────────────────────────────

  const restockProduct = useCallback(
    async (id: string, qty: number, buyPrice: number) => {
      const now     = new Date().toISOString();
      const updated = products.map(p => {
        if (p.id !== id) return p;
        const newAvgCost  = hitungAvgCostBaru(p.stock, p.avgCost, qty, buyPrice);
        const newBatch: StokBatch = {
          batchId:  id + "_" + Date.now(),
          buyPrice,
          qty,
          tanggal:  now,
        };
        return {
          ...p,
          stock:     p.stock + qty,
          buyPrice,
          avgCost:   newAvgCost,
          batches:   [...p.batches, newBatch],
          updatedAt: now,
        };
      });
      await saveProducts(updated);
    },
    [products, saveProducts],
  );

  // ── addTransaksi ───────────────────────────────────────────────────────────

  const addTransaksi = useCallback(
    async (payload: AddTransaksiPayload) => {
      const now           = new Date().toISOString();
      const metode        = metodeValuasi ?? "average";
      let updatedProducts = [...products];
      let totalHPP        = 0;
      const transaksiItems: TransaksiItem[] = [];

      for (const item of payload.items) {
        const idx = updatedProducts.findIndex(p => p.id === item.productId);
        if (idx === -1) continue;

        const product = updatedProducts[idx];
        const { hppPerUnit, updatedBatches } = hitungHPP(product, item.qty, metode);
        const hpp = hppPerUnit * item.qty;
        totalHPP += hpp;

        transaksiItems.push({
          productId: item.productId,
          name:      item.name,
          price:     item.price,
          hpp:       hppPerUnit,
          qty:       item.qty,
        });

        updatedProducts[idx] = {
          ...product,
          stock:     product.stock - item.qty,
          batches:   updatedBatches,
          updatedAt: now,
        };
      }

      const newTransaksi: Transaksi = {
        id:           payload.id,
        ownerId:      payload.ownerId,
        tanggal:      now,
        kasirId:      payload.kasirId,
        kasirNama:    payload.kasirNama,
        items:        transaksiItems,
        subtotal:     payload.subtotal,
        diskon:       payload.diskon,
        biayaLayanan: payload.biayaLayanan,
        total:        payload.total,
        metodeBayar:  payload.metodeBayar,
        dibayar:      payload.dibayar,
        kembalian:    payload.kembalian,
        totalHPP,
        // labaKotor = pendapatan produk (tanpa biaya layanan) - HPP
        labaKotor:    (payload.total - payload.biayaLayanan) - totalHPP,
      };

      await saveProducts(updatedProducts);
      await saveTransaksi([newTransaksi, ...transaksi]);
    },
    [products, transaksi, metodeValuasi, saveProducts, saveTransaksi],
  );

  // ── Helpers Query ──────────────────────────────────────────────────────────

  const getLowStockProducts = useCallback(
    () => products.filter(p => p.stock > 0 && p.stock <= (p.stockMin ?? STOK_MENIPIS_DEFAULT)),
    [products],
  );

  const getOutOfStockProducts = useCallback(
    () => products.filter(p => p.stock === 0),
    [products],
  );

  // ── Context Value ──────────────────────────────────────────────────────────

  const contextValue: ProductsContextType = {
    products, transaksi, isLoading, metodeValuasi,
    simpanMetode, addProduct, updateProduct, deleteProduct,
    restockProduct, addTransaksi, getLowStockProducts, getOutOfStockProducts,
  };

  return (
    <ProductsContext.Provider value={contextValue}>
      {children}
    </ProductsContext.Provider>
  );
};