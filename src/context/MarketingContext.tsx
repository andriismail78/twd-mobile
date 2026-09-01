// src/context/MarketingContext.tsx
// v4 — FULLY ONLINE (No AsyncStorage Cache)

import React, { createContext, useContext, useEffect, useState } from "react";
import { Alert } from "react-native";
import { API_BASE_URL } from "../config/api.config";
import axiosClient from "../config/axiosClient";
import { subscribeToRealtimeSync } from "../services/SocketService";

export type MarketingRole  = "marketing" | "sub_marketing";
export type KurirStatus    = "available" | "busy" | "offline";
export type DeliveryStatus = "pending" | "assigned" | "delivered";
export type PaketMkt       = "basic" | "pro" | "enterprise";

export const PAKET_HARGA: Record<PaketMkt, number> = {
  basic: 50_000, pro: 150_000, enterprise: 300_000,
};
export const KOMISI_RATE              = 0.20;
export const SUB_MARKETING_SHARE      = 0.70;
export const MARKETING_SHARE_FROM_SUB = 0.30;
export const BIAYA_LAYANAN_PER_TRANSAKSI = 1_000;
export const KOMISI_LAYANAN_MARKETING    = 0.03;
export const KURIR_BASE_FARE = 10_000;
export const KURIR_PER_KM   = 3_500;
export const KURIR_MIN_KM   = 1;

export type PaketFeatureLevel = "all" | "pro_enterprise" | "enterprise_only" | "none";
export interface PaketFeature {
  label:      string;
  basic:      string;
  pro:        string;
  enterprise: string;
}
export const PAKET_FEATURES: PaketFeature[] = [
  { label: "Kasir POS",               basic: "✅",             pro: "✅",              enterprise: "✅" },
  { label: "Produk Katalog",          basic: "✅ Unlimited",   pro: "✅ Unlimited",    enterprise: "✅ Unlimited" },
  { label: "Laporan Penjualan",       basic: "Real-time s/d Bulanan", pro: "Real-time s/d Tahunan", enterprise: "Real-time s/d Tahunan" },
  { label: "Multi Kasir",             basic: "1 akun",         pro: "5 akun",          enterprise: "Unlimited" },
  { label: "Notifikasi Stok Habis",   basic: "✅",             pro: "✅",              enterprise: "✅" },
  { label: "Export Laporan",          basic: "✅",             pro: "✅",              enterprise: "✅" },
  { label: "Layanan Kurir",           basic: "✅",             pro: "✅",              enterprise: "✅" },
  { label: "Multi Cabang",            basic: "❌",             pro: "❌",              enterprise: "✅" },
  { label: "Prioritas Support",       basic: "❌",             pro: "Standar",         enterprise: "Prioritas Tinggi" },
  { label: "AI Support",              basic: "❌",             pro: "Standar",         enterprise: "Premium" },
  { label: "Trial Gratis",            basic: "3 hari",         pro: "3 hari",          enterprise: "3 hari" },
];
export const TRIAL_DAYS = 3;

export function hitungBiayaKurir(jarakKm: number): number {
  const km = Math.max(jarakKm, KURIR_MIN_KM);
  if (km <= 1) return KURIR_BASE_FARE;
  return KURIR_BASE_FARE + Math.ceil(km - 1) * KURIR_PER_KM;
}
export const generateKodeToko = (): string => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "TWD-";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

export interface MarketingAccount {
  id:        string;
  name:      string;
  phone:     string;
  pin:       string;
  role:      MarketingRole;
  uplineId?: string;
  wilayah?:  string;
  createdAt: string;
}
export interface KurirAccount {
  id:           string;
  name:         string;
  phone:        string;
  pin:          string;
  wilayah:      string;
  latitude?:    number;
  longitude?:   number;
  status:       KurirStatus;
  marketingId?: string;
  createdAt:    string;
}
export interface KurirFullRegistration extends KurirAccount {
  alamatRumah:  string;
  noKtp:        string;
  fotoKtp:      string;
  fotoSelfie:   string;
  registeredBy: string;
  verified?:    boolean;
}
export interface OwnerRegistration {
  id:              string;
  kodeToken:       string;
  name:            string;
  tokoName:        string;
  phone:           string;
  alamat?:         string;
  latitude?:       number;
  longitude?:      number;
  jenisBisnis?:    string;
  paket:           PaketMkt;
  recruitedBy:     string;
  recruitedByRole: MarketingRole;
  totalTransaksi:  number;
  createdAt:       string;
  trialStartDate?: string;
  trialEndDate?:   string;
}
export interface KomisiRecord {
  id:                  string;
  ownerId:             string;
  ownerName:           string;
  tokoName:            string;
  paket:               PaketMkt;
  hargaLangganan:      number;
  totalKomisi:         number;
  marketingId:         string;
  subMarketingId?:     string;
  komisiMarketing:     number;
  komisiSubMarketing?: number;
  tanggal:             string;
}
export interface DeliveryRequest {
  id:          string;
  ownerId:     string;
  ownerName:   string;
  tokoName:    string;
  alamat:      string;
  jarakKm?:    number;
  biayaKurir?: number;
  kurirId?:    string;
  kurirName?:  string;
  status:      DeliveryStatus;
  notes?:      string;
  createdAt:   string;
}
export type TrialStatus = {
  isActive: boolean;
  daysLeft: number;
  expired:  boolean;
  endDate:  string | null;
};

interface MarketingContextType {
  marketingAccounts:  MarketingAccount[];
  kurirAccounts:      KurirFullRegistration[];
  ownerRegistrations: OwnerRegistration[];
  komisiRecords:      KomisiRecord[];
  deliveryRequests:   DeliveryRequest[];
  addMarketing:    (data: Omit<MarketingAccount, "id" | "createdAt">) => Promise<void>;
  updateMarketing: (id: string, data: Partial<MarketingAccount>)      => void;
  deleteMarketing: (id: string)                                        => void;
  loginMarketing:  (phone: string, pin: string) => MarketingAccount | null;
  addKurir:    (data: Omit<KurirAccount, "id" | "createdAt">) => Promise<void>;
  updateKurir: (id: string, data: Partial<KurirFullRegistration>)    => void;
  deleteKurir: (id: string)                                           => void;
  loginKurir:  (phone: string, pin: string) => KurirFullRegistration | null;
  updateKurirStatus: (kurirId: string, status: KurirStatus) => void;
  registerKurir: (
    data: Omit<KurirFullRegistration, "id" | "createdAt" | "pin" | "status">
  ) => KurirFullRegistration;
  addOwnerRegistration: (
    data: Omit<OwnerRegistration, "id" | "kodeToken" | "createdAt" | "totalTransaksi">
  ) => Promise<OwnerRegistration | null>;
  registerOwnerWithTrial: (
    data: Omit<OwnerRegistration, "id" | "kodeToken" | "createdAt" | "totalTransaksi" | "trialStartDate" | "trialEndDate">
  ) => Promise<OwnerRegistration | null>;
  deleteOwnerRegistration: (id: string)            => void;
  findOwnerByKode:         (kode: string)           => OwnerRegistration | null;
  updateOwnerTransaksi:    (ownerId: string, tambah: number) => void;
  getTrialStatus: (ownerId: string) => TrialStatus;
  addKomisiRecord: (data: Omit<KomisiRecord, "id">) => void;
  addDeliveryRequest:   (data: Omit<DeliveryRequest, "id" | "createdAt">) => void;
  assignKurir:          (requestId: string, kurirId: string, kurirName: string) => void;
  updateDeliveryStatus: (requestId: string, status: DeliveryStatus)             => void;
  getSubMarketing:           (marketingId: string) => MarketingAccount[];
  getOwnersByMarketing:      (marketingId: string) => OwnerRegistration[];
  getOwnersBySubMarketing:   (subId: string)        => OwnerRegistration[];
  getAllOwnersByMarketing:    (marketingId: string)  => OwnerRegistration[];
  getKomisiByMarketing:      (marketingId: string)  => KomisiRecord[];
  getKomisiBySubMarketing:   (subId: string)         => KomisiRecord[];
  getKurirByWilayah:         (wilayah: string)       => KurirFullRegistration[];
  getKomisiLayananMarketing: (marketingId: string)   => number;
  upgradePaket: (ownerId: string, paketBaru: PaketMkt) => void;
}
const MarketingContext = createContext<MarketingContextType | undefined>(undefined);

export function MarketingProvider({ children }: { children: React.ReactNode }) {
  const [marketingAccounts,  setMarketingAccounts]  = useState<MarketingAccount[]>([]);
  const [kurirAccounts,      setKurirAccounts]      = useState<KurirFullRegistration[]>([]);
  const [ownerRegistrations, setOwnerRegistrations] = useState<OwnerRegistration[]>([]);
  const [komisiRecords,      setKomisiRecords]      = useState<KomisiRecord[]>([]);
  const [deliveryRequests,   setDeliveryRequests]   = useState<DeliveryRequest[]>([]);

  useEffect(() => {
    loadData();
    const unsubscribe = subscribeToRealtimeSync((event) => {
      if (event === "user:sync") {
        loadData();
      }
    });
    return () => unsubscribe();
  }, []);

  // ─── LOAD DATA DARI SERVER (TANPA ASYNCSTORAGE) ──────────────────────────
  const loadData = async () => {
    try {
      const res = await axiosClient.get(`/auth/users`);
      const serverUsers = res.data.data || [];

      let mktAccounts: MarketingAccount[] = [];
      let ownerRegs: OwnerRegistration[] = [];
      let kurirAccs: KurirFullRegistration[] = [];

      serverUsers.forEach((u: any) => {
        if (u.role === "marketing" || u.role === "sub_marketing") {
          mktAccounts.push({
            id: String(u.id),
            name: u.name,
            phone: u.phone,
            pin: "", // PIN tidak diambil dari server untuk alasan keamanan
            role: u.role,
            createdAt: u.createdat || new Date().toISOString(),
          });
        } else if (u.role === "kurir") {
          kurirAccs.push({
            id: String(u.id),
            name: u.name,
            phone: u.phone,
            pin: "",
            wilayah: "",
            status: "available",
            createdAt: u.createdat || new Date().toISOString(),
            alamatRumah: "",
            noKtp: "",
            fotoKtp: "",
            fotoSelfie: "",
            registeredBy: "",
            verified: false,
          });
        } else if (u.role === "owner") {
          ownerRegs.push({
            id: String(u.id),
            kodeToken: u.kodetoken,
            name: u.name,
            tokoName: `Toko ${u.name}`,
            phone: u.phone,
            paket: u.paket || "basic",
            recruitedBy: "system",
            recruitedByRole: "marketing",
            totalTransaksi: 0,
            createdAt: u.createdat || new Date().toISOString(),
          });
        }
      });

      setMarketingAccounts(mktAccounts);
      setKurirAccounts(kurirAccs);
      setOwnerRegistrations(ownerRegs);
      
      // Untuk komisi & delivery, saat ini belum ada route API khusus, biarkan kosong
      // agar tidak menampilkan data fiktif.
      setKomisiRecords([]);
      setDeliveryRequests([]);

    } catch (error) {
      console.error("Gagal memuat data dari server (offline):", error);
      // Sesuai permintaan: Jika offline, jangan muat data lokal (biarkan kosong)
      setMarketingAccounts([]);
      setKurirAccounts([]);
      setOwnerRegistrations([]);
      setKomisiRecords([]);
      setDeliveryRequests([]);
    }
  };

  // Helper untuk update state (Tanpa AsyncStorage)
  const updateState = (setter: any, newData: any) => setter(newData);

  // ─── FUNGSI ONLINE: DAFTAR MARKETING ───────────────────────────────
  const addMarketing = async (data: Omit<MarketingAccount, "id" | "createdAt">) => {
    try {
      const res = await axiosClient.post(`/auth/register`, {
        name: data.name,
        phone: data.phone,
        pin: data.pin,
        role: data.role,
      });

      const newAcc = {
        ...data,
        id: res.data.owner.id,
        createdAt: res.data.owner.createdAt || new Date().toISOString(),
      };
      updateState(setMarketingAccounts, [...marketingAccounts, newAcc]);
    } catch (err: any) {
      Alert.alert("Gagal Daftar", err.response?.data?.error || "Gagal terhubung ke server");
    }
  };

  const updateMarketing = (id: string, data: Partial<MarketingAccount>) => {
    const upd = marketingAccounts.map(m => m.id === id ? { ...m, ...data } : m);
    updateState(setMarketingAccounts, upd);
  };
  const deleteMarketing = (id: string) => {
    const upd = marketingAccounts.filter(m => m.id !== id);
    updateState(setMarketingAccounts, upd);
  };
  const loginMarketing = (phone: string, pin: string): MarketingAccount | null =>
    marketingAccounts.find(m => m.phone === phone && m.pin === pin) ?? null;

  // ─── FUNGSI ONLINE: DAFTAR KURIR ───────────────────────────────────
  const addKurir = async (data: Omit<KurirAccount, "id" | "createdAt">) => {
    try {
      const res = await axiosClient.post(`/auth/register`, {
        name: data.name,
        phone: data.phone,
        pin: data.pin,
        role: "kurir",
      });

      const newKurir: KurirFullRegistration = {
        ...data,
        id:           res.data.owner.id,
        createdAt:    new Date().toISOString(),
        alamatRumah:  "",
        noKtp:        "",
        fotoKtp:      "",
        fotoSelfie:   "",
        registeredBy: "",
        verified:     false,
      };
      updateState(setKurirAccounts, [...kurirAccounts, newKurir]);
    } catch (err: any) {
      Alert.alert("Gagal Daftar", err.response?.data?.error || "Gagal terhubung ke server");
    }
  };

  const updateKurir = (id: string, data: Partial<KurirFullRegistration>) => {
    const upd = kurirAccounts.map(k => k.id === id ? { ...k, ...data } : k);
    updateState(setKurirAccounts, upd);
  };
  const deleteKurir = (id: string) => {
    const upd = kurirAccounts.filter(k => k.id !== id);
    updateState(setKurirAccounts, upd);
  };
  const loginKurir = (phone: string, pin: string): KurirFullRegistration | null =>
    kurirAccounts.find(k => k.phone === phone && k.pin === pin) ?? null;
  const updateKurirStatus = (kurirId: string, status: KurirStatus) => {
    const upd = kurirAccounts.map(k => k.id === kurirId ? { ...k, status } : k);
    updateState(setKurirAccounts, upd);
  };
  const registerKurir = (
    data: Omit<KurirFullRegistration, "id" | "createdAt" | "pin" | "status">,
  ): KurirFullRegistration => {
    // Fallback lokal jika dipanggil tanpa async
    const newKurir: KurirFullRegistration = {
      ...data,
      id:        Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      createdAt: new Date().toISOString(),
      pin:       "",
      status:    "available",
      verified:  false,
    };
    updateState(setKurirAccounts, [...kurirAccounts, newKurir]);
    return newKurir;
  };

  // ─── FUNGSI ONLINE: DAFTAR OWNER (DENGAN TRIAL) ─────────────────────────
  const registerOwnerWithTrial = async (
    data: Omit<OwnerRegistration, "id" | "kodeToken" | "createdAt" | "totalTransaksi" | "trialStartDate" | "trialEndDate">,
  ): Promise<OwnerRegistration | null> => {
    try {
      const res = await axiosClient.post(`/auth/register`, {
        name: data.name,
        phone: data.phone,
        pin: "123456", // Default PIN Owner pertama kali
        role: "owner",
      });

      const now      = new Date();
      const trialEnd = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
      
      const newRec: OwnerRegistration = {
        ...data,
        id:             res.data.owner.id,
        kodeToken:      res.data.owner.kodeToken,
        totalTransaksi: 0,
        createdAt:      now.toISOString(),
        trialStartDate: now.toISOString(),
        trialEndDate:   trialEnd.toISOString(),
      };
      
      updateState(setOwnerRegistrations, [...ownerRegistrations, newRec]);
      return newRec;
    } catch (err: any) {
      Alert.alert("Gagal Daftar Owner", err.response?.data?.error || "Gagal terhubung ke server");
      return null;
    }
  };

  const addOwnerRegistration = async (
    data: Omit<OwnerRegistration, "id" | "kodeToken" | "createdAt" | "totalTransaksi">,
  ): Promise<OwnerRegistration | null> => {
    return registerOwnerWithTrial(data as any);
  };

  const deleteOwnerRegistration = (id: string) => {
    const upd = ownerRegistrations.filter(o => o.id !== id);
    updateState(setOwnerRegistrations, upd);
  };
  const findOwnerByKode = (kode: string): OwnerRegistration | null =>
    ownerRegistrations.find(o =>
      o.kodeToken != null && o.kodeToken.toUpperCase() === kode.toUpperCase()
    ) ?? null;
  const updateOwnerTransaksi = (ownerId: string, tambah: number) => {
    const upd = ownerRegistrations.map(o =>
      o.id === ownerId ? { ...o, totalTransaksi: (o.totalTransaksi ?? 0) + tambah } : o,
    );
    updateState(setOwnerRegistrations, upd);
  };
  const getTrialStatus = (ownerId: string): TrialStatus => {
    const owner = ownerRegistrations.find(o => o.id === ownerId);
    if (!owner?.trialEndDate) {
      return { isActive: false, daysLeft: 0, expired: false, endDate: null };
    }
    const now      = new Date();
    const end      = new Date(owner.trialEndDate);
    const msLeft   = end.getTime() - now.getTime();
    const daysLeft = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));
    return { isActive: msLeft > 0, daysLeft, expired: msLeft <= 0, endDate: owner.trialEndDate };
  };

  const addKomisiRecord = (data: Omit<KomisiRecord, "id">) => {
    const upd = [...komisiRecords, { ...data, id: Date.now().toString() }];
    updateState(setKomisiRecords, upd);
  };
  const addDeliveryRequest = (data: Omit<DeliveryRequest, "id" | "createdAt">) => {
    const biaya = data.jarakKm != null ? hitungBiayaKurir(data.jarakKm) : undefined;
    const upd = [...deliveryRequests, { ...data, biayaKurir: biaya, id: Date.now().toString(), createdAt: new Date().toISOString() }];
    updateState(setDeliveryRequests, upd);
  };
  const assignKurir = (requestId: string, kurirId: string, kurirName: string) => {
    const upd = deliveryRequests.map(r =>
      r.id === requestId ? { ...r, kurirId, kurirName, status: "assigned" as DeliveryStatus } : r,
    );
    updateState(setDeliveryRequests, upd);
  };
  const updateDeliveryStatus = (requestId: string, status: DeliveryStatus) => {
    const upd = deliveryRequests.map(r =>
      r.id === requestId ? { ...r, status } : r,
    );
    updateState(setDeliveryRequests, upd);
  };

  const getSubMarketing          = (mktId: string) =>
    marketingAccounts.filter(m => m.role === "sub_marketing" && m.uplineId === mktId);
  const getOwnersByMarketing     = (mktId: string) =>
    ownerRegistrations.filter(o => o.recruitedBy === mktId && o.recruitedByRole === "marketing");
  const getOwnersBySubMarketing  = (subId: string) =>
    ownerRegistrations.filter(o => o.recruitedBy === subId && o.recruitedByRole === "sub_marketing");
  const getAllOwnersByMarketing   = (mktId: string) => {
    const direct = getOwnersByMarketing(mktId);
    const subs   = getSubMarketing(mktId);
    const via    = subs.flatMap(s => getOwnersBySubMarketing(s.id));
    return [...direct, ...via];
  };
  const getKomisiByMarketing    = (mktId: string) =>
    komisiRecords.filter(k => k.marketingId    === mktId);
  const getKomisiBySubMarketing = (subId: string) =>
    komisiRecords.filter(k => k.subMarketingId === subId);
  const getKurirByWilayah = (w: string): KurirFullRegistration[] =>
    !w.trim()
      ? kurirAccounts
      : kurirAccounts.filter(k => k.wilayah.toLowerCase().includes(w.toLowerCase()));
  const upgradePaket = (ownerId: string, paketBaru: PaketMkt) => {
    const upd = ownerRegistrations.map(o =>
      o.id === ownerId ? { ...o, paket: paketBaru } : o,
    );
    updateState(setOwnerRegistrations, upd);
  };
  const getKomisiLayananMarketing = (marketingId: string): number => {
    const allOwners = getAllOwnersByMarketing(marketingId);
    const totalTrx  = allOwners.reduce(
      (s: number, o: OwnerRegistration) => s + (o.totalTransaksi ?? 0), 0,
    );
    return totalTrx * BIAYA_LAYANAN_PER_TRANSAKSI * KOMISI_LAYANAN_MARKETING;
  };

  const value: MarketingContextType = {
    marketingAccounts, kurirAccounts, ownerRegistrations, komisiRecords, deliveryRequests,
    addMarketing, updateMarketing, deleteMarketing, loginMarketing,
    addKurir, updateKurir, deleteKurir, loginKurir, updateKurirStatus, registerKurir,
    addOwnerRegistration, registerOwnerWithTrial, deleteOwnerRegistration,
    findOwnerByKode, updateOwnerTransaksi, getTrialStatus,
    addKomisiRecord,
    addDeliveryRequest, assignKurir, updateDeliveryStatus,
    getSubMarketing, getOwnersByMarketing, getOwnersBySubMarketing,
    getAllOwnersByMarketing, getKomisiByMarketing, getKomisiBySubMarketing,
    getKurirByWilayah, getKomisiLayananMarketing, upgradePaket,
  };

  return (
    <MarketingContext.Provider value={value}>
      {children}
    </MarketingContext.Provider>
  );
}

export function useMarketing() {
  const ctx = useContext(MarketingContext);
  if (!ctx) throw new Error("useMarketing must be used within MarketingProvider");
  return ctx;
}