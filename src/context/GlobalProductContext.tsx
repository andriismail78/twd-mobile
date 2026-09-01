// src/context/GlobalProductContext.tsx
import React, { createContext, useContext, useEffect, useState } from "react";
import axiosClient from "../config/axiosClient";

export const KOMISI_PER_PRODUK = 100;

export interface GlobalProduct {
  id: string;
  name: string;
  barcode: string;
  kategori?: string;
  satuan?: string;
  ownerId?: string;
  addedBy?: string; // ID Marketing yang menambahkan
}

interface GlobalProductContextType {
  globalProducts: GlobalProduct[];
  getProductsAddedByUser: (userId: string) => GlobalProduct[];
  getKomisiProduk: (userId: string) => number;
  updateGlobalProduct: (id: string, data: Partial<GlobalProduct>) => Promise<void>;
  addGlobalProduct: (data: Omit<GlobalProduct, "id">) => Promise<void>;
  reloadGlobalProducts: () => Promise<void>;
}

const GlobalProductContext = createContext<GlobalProductContextType | undefined>(undefined);

export const GlobalProductProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [globalProducts, setGlobalProducts] = useState<GlobalProduct[]>([]);

  const reloadGlobalProducts = async () => {
    try {
      const res = await axiosClient.get(`/products/global`);
      setGlobalProducts(res.data || []);
    } catch (error) {
      console.error("Gagal memuat produk global:", error);
      setGlobalProducts([]);
    }
  };

  useEffect(() => {
    reloadGlobalProducts();
  }, []);

  const getProductsAddedByUser = (userId: string) => {
    return globalProducts.filter((p) => String(p.addedBy) === String(userId));
  };

  const getKomisiProduk = (userId: string) => {
    return getProductsAddedByUser(userId).length * KOMISI_PER_PRODUK;
  };

  const updateGlobalProduct = async (id: string, data: Partial<GlobalProduct>) => {
    // Untuk sementara, assign owner ke produk global hanya update state lokal di HP.
    // Karena di backend belum ada route PUT /global/:id khusus untuk ini.
    setGlobalProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...data } : p)));
  };

  const addGlobalProduct = async (data: Omit<GlobalProduct, "id">) => {
    try {
      const res = await axiosClient.post(`/products/global`, data);
      setGlobalProducts((prev) => [...prev, res.data]);
    } catch (error) {
      console.error("Gagal menambah produk global:", error);
      throw error;
    }
  };

  return (
    <GlobalProductContext.Provider 
      value={{ 
        globalProducts, 
        getProductsAddedByUser, 
        getKomisiProduk, 
        updateGlobalProduct, 
        addGlobalProduct,
        reloadGlobalProducts
      }}
    >
      {children}
    </GlobalProductContext.Provider>
  );
};

export function useGlobalProducts() {
  const ctx = useContext(GlobalProductContext);
  if (!ctx) throw new Error("useGlobalProducts must be used within GlobalProductProvider");
  return ctx;
}