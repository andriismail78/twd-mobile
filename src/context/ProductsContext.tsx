import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useState,
} from "react";
import { Alert } from "react-native";
import axiosClient from "../config/axiosClient"; // SUDAH DIPERBAIKI: Pakai axiosClient

// ─── Storage Keys ─────────────────────────────────────────────────────────────

const STORAGE_KEY_PRODUCTS  = "@twd_products"; // Masih dipakai untuk cache lokal
const STORAGE_KEY_TRANSAKSI = "@twd_transaksi"; // Masih dipakai untuk cache lokal
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
  biayaLayanan: number;
  total:        number;
  metodeBayar:  string;
  dibayar:      number;
  kembalian:    number;
  totalHPP:     number;
  labaKotor:    number;
};

export type AddTransaksiPayload = {
  id:           string;
  ownerId?:     string;
  items:        { productId: string; name: string; price: number; qty: number }[];
  subtotal:     number;
  diskon:       number;
  biayaLayanan: number;
  total:        number;
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

  // ── Load dari Server Cloud ─────────────────────────────────────────────────

  const loadFromServer = useCallback(async () => {
    try {
      // AmbilOwnerId dari AsyncStorage (disimpan saat login)
      const ownerId = await AsyncStorage.getItem("twd_owner_id");
      if (!ownerId) {
        setIsLoading(false);
        return;
      }

      // Fetch Products
      const prodRes = await axiosClient.get(`/products?ownerId=${ownerId}`);
      const serverProducts = prodRes.data.map((p: any) => ({
        ...p,
        avgCost: p.buyPrice || 0,
        batches: p.stock > 0 ? [{ batchId: p.id, buyPrice: p.buyPrice, qty: p.stock, tanggal: p.createdAt }] : []
      }));
      setProducts(serverProducts);
      await AsyncStorage.setItem(STORAGE_KEY_PRODUCTS, JSON.stringify(serverProducts));

      // Fetch Transaksi
      const trxRes = await axiosClient.get(`/orders?ownerId=${ownerId}`);
      setTransaksi(trxRes.data);
      await AsyncStorage.setItem(STORAGE_KEY_TRANSAKSI, JSON.stringify(trxRes.data));

    } catch (error) {
      console.error("Gagal load dari server, memuat cache lokal:", error);
      // Fallback ke lokal jika offline
      const [pRaw, tRaw] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEY_PRODUCTS),
        AsyncStorage.getItem(STORAGE_KEY_TRANSAKSI),
      ]);
      if (pRaw) setProducts(JSON.parse(pRaw));
      if (tRaw) setTransaksi(JSON.parse(tRaw));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const mRaw = await AsyncStorage.getItem(STORAGE_KEY_METODE);
      if (mRaw) setMetodeValuasi(mRaw as MetodeValuasi);
      await loadFromServer();
    })();
  }, [loadFromServer]);

  // ── Helpers Save Lokal (Cache) ──────────────────────────────────────────────

  const saveProductsLocal = useCallback(async (data: Product[]) => {
    setProducts(data);
    await AsyncStorage.setItem(STORAGE_KEY_PRODUCTS, JSON.stringify(data));
  }, []);

  const saveTransaksiLocal = useCallback(async (data: Transaksi[]) => {
    setTransaksi(data);
    await AsyncStorage.setItem(STORAGE_KEY_TRANSAKSI, JSON.stringify(data));
  }, []);

  const simpanMetode = useCallback(async (metode: MetodeValuasi) => {
    setMetodeValuasi(metode);
    await AsyncStorage.setItem(STORAGE_KEY_METODE, metode);
  }, []);

  // ── addProduct (KIRIM KE SERVER) ────────────────────────────────────────────

  const addProduct = useCallback(
    async (data: Omit<Product, "id"|"avgCost"|"batches"|"createdAt"|"updatedAt">) => {
      try {
        // 1. Kirim ke Server Biznet
        const res = await axiosClient.post(`/products`, {
          ownerId:   data.ownerId,
          name:      data.name,
          barcode:   data.barcode,
          sellPrice: data.sellPrice,
          buyPrice:  data.buyPrice,
          stock:     data.stock,
          stockMin:  data.stockMin,
          kategori:  data.kategori,
          satuan:    data.satuan,
        });

        const newServerProduct = res.data;

        // 2. Update state lokal dengan data dari server
        const now = new Date().toISOString();
        const initialBatches: StokBatch[] = data.stock > 0
          ? [{ batchId: newServerProduct.id, buyPrice: data.buyPrice, qty: data.stock, tanggal: now }]
          : [];

        const newProd: Product = {
          ...data,
          id:        newServerProduct.id,
          stockMin:  data.stockMin ?? STOK_MENIPIS_DEFAULT,
          avgCost:   data.buyPrice,
          batches:   initialBatches,
          createdAt: newServerProduct.createdAt || now,
          updatedAt: now,
        };

        await saveProductsLocal([...products, newProd]);
      } catch (error: any) {
        Alert.alert("Gagal Simpan", error.response?.data?.error || "Gagal menyimpan produk ke server.");
        throw error;
      }
    },
    [products, saveProductsLocal],
  );

  // ── updateProduct (KIRIM KE SERVER) ────────────────────────────────────────

  const updateProduct = useCallback(
    async (id: string, data: Partial<Omit<Product, "id"|"createdAt">>) => {
      try {
        // 1. Update ke Server
        await axiosClient.put(`/products/${id}`, data);

        // 2. Update lokal
        const updated = products.map(p =>
          p.id === id ? { ...p, ...data, updatedAt: new Date().toISOString() } : p
        );
        await saveProductsLocal(updated);
      } catch (error: any) {
        Alert.alert("Gagal Update", error.response?.data?.error || "Gagal update produk ke server.");
        throw error;
      }
    },
    [products, saveProductsLocal],
  );

  // ── deleteProduct (KIRIM KE SERVER) ────────────────────────────────────────

  const deleteProduct = useCallback(
    async (id: string) => {
      try {
        // 1. Hapus dari Server
        await axiosClient.delete(`/products/${id}`);
        // 2. Hapus dari lokal
        await saveProductsLocal(products.filter(p => p.id !== id));
      } catch (error: any) {
        Alert.alert("Gagal Hapus", error.response?.data?.error || "Gagal menghapus produk dari server.");
        throw error;
      }
    },
    [products, saveProductsLocal],
  );

  // ── restockProduct (KIRIM KE SERVER) ────────────────────────────────────────

  const restockProduct = useCallback(
    async (id: string, qty: number, buyPrice: number) => {
      try {
        const product = products.find(p => p.id === id);
        if (!product) return;

        const newStock = product.stock + qty;
        const newAvgCost = hitungAvgCostBaru(product.stock, product.avgCost, qty, buyPrice);

        // 1. Update stok di Server
        await axiosClient.put(`/products/${id}`, {
          stock: newStock,
          buyPrice: buyPrice,
        });

        // 2. Update lokal dengan batch baru
        const now = new Date().toISOString();
        const newBatch: StokBatch = {
          batchId:  id + "_" + Date.now(),
          buyPrice,
          qty,
          tanggal:  now,
        };

        const updated = products.map(p =>
          p.id === id ? {
            ...p,
            stock:     newStock,
            buyPrice,
            avgCost:   newAvgCost,
            batches:   [...p.batches, newBatch],
            updatedAt: now,
          } : p
        );
        await saveProductsLocal(updated);

      } catch (error: any) {
        Alert.alert("Gagal Restock", error.response?.data?.error || "Gagal update stok ke server.");
        throw error;
      }
    },
    [products, saveProductsLocal],
  );

  // ── addTransaksi / CHECKOUT KASIR (KIRIM KE SERVER) ────────────────────────

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

        // Update stok lokal sementara
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
        labaKotor:    (payload.total - payload.biayaLayanan) - totalHPP,
      };

      try {
        // 1. Kirim data Transaksi ke Server Biznet
        await axiosClient.post(`/orders`, {
          id:           payload.id,
          ownerId:      payload.ownerId,
          kasirId:      payload.kasirId,
          kasirName:    payload.kasirNama,
          items:        JSON.stringify(transaksiItems), // Backend simpan sebagai JSON string
          subtotal:     payload.subtotal,
          diskon:       payload.diskon,
          total:        payload.total,
          bayar:        payload.dibayar,
          kembalian:    payload.kembalian,
          metodeBayar:  payload.metodeBayar,
          type:         "pos",
          status:       "selesai",
        });

        // 2. Update stok produk di server (Looping tiap produk)
        for (const item of payload.items) {
          const prod = updatedProducts.find(p => p.id === item.productId);
          if (prod) {
            await axiosClient.put(`/products/${item.productId}`, {
              stock: prod.stock,
            });
          }
        }

        // 3. Jika sukses, simpan ke state lokal & AsyncStorage
        await saveProductsLocal(updatedProducts);
        await saveTransaksiLocal([newTransaksi, ...transaksi]);

      } catch (error: any) {
        Alert.alert("Gagal Checkout", "Transaksi disimpan lokal, tapi gagal kirim ke server. Cek koneksi internet.");
        // Tetap simpan lokal agar kasir bisa lanjut transaksi lain
        await saveProductsLocal(updatedProducts);
        await saveTransaksiLocal([newTransaksi, ...transaksi]);
        throw error;
      }
    },
    [products, transaksi, metodeValuasi, saveProductsLocal, saveTransaksiLocal],
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

  // ─── Context Value ──────────────────────────────────────────────────────────

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