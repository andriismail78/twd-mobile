// src/context/MarketingContext.tsx
// src/context/MarketingContext.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";


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
  addMarketing:    (data: Omit<MarketingAccount, "id" | "createdAt">) => void;
  updateMarketing: (id: string, data: Partial<MarketingAccount>)      => void;
  deleteMarketing: (id: string)                                        => void;
  loginMarketing:  (phone: string, pin: string) => MarketingAccount | null;
  addKurir:    (data: Omit<KurirAccount, "id" | "createdAt">) => void;
  updateKurir: (id: string, data: Partial<KurirFullRegistration>)    => void;
  deleteKurir: (id: string)                                           => void;
  loginKurir:  (phone: string, pin: string) => KurirFullRegistration | null;
  updateKurirStatus: (kurirId: string, status: KurirStatus) => void;
  registerKurir: (
    data: Omit<KurirFullRegistration, "id" | "createdAt" | "pin" | "status">
  ) => KurirFullRegistration;
  addOwnerRegistration: (
    data: Omit<OwnerRegistration, "id" | "kodeToken" | "createdAt" | "totalTransaksi">
  ) => OwnerRegistration;
  registerOwnerWithTrial: (
    data: Omit<OwnerRegistration, "id" | "kodeToken" | "createdAt" | "totalTransaksi" | "trialStartDate" | "trialEndDate">
  ) => OwnerRegistration;
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
const STORAGE_KEY = "mkt_data_v1";

export function MarketingProvider({ children }: { children: React.ReactNode }) {
  const [marketingAccounts,  setMarketingAccounts]  = useState<MarketingAccount[]>([]);
  const [kurirAccounts,      setKurirAccounts]      = useState<KurirFullRegistration[]>([]);
  const [ownerRegistrations, setOwnerRegistrations] = useState<OwnerRegistration[]>([]);
  const [komisiRecords,      setKomisiRecords]      = useState<KomisiRecord[]>([]);
  const [deliveryRequests,   setDeliveryRequests]   = useState<DeliveryRequest[]>([]);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [raw, rawMitra, rawOwners] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEY),
        AsyncStorage.getItem("@twd_marketing_accounts"),
        AsyncStorage.getItem("@twd_owner_registrations"),
      ]);

      const d = raw ? JSON.parse(raw) : {};

      let mktAccounts: MarketingAccount[]     = d.marketingAccounts  ?? [];
      let kurirAccs:   KurirFullRegistration[] = d.kurirAccounts      ?? [];
      let ownerRegs:   OwnerRegistration[]     = d.ownerRegistrations ?? [];

      // ── Merge mitra dari @twd_marketing_accounts (SuperAdmin) ─────────────
      if (rawMitra) {
        const mitraList: any[] = JSON.parse(rawMitra);
        mitraList.forEach((m) => {
          if (m.role === "kurir") {
            if (!kurirAccs.find((k) => k.id === m.id || k.phone === m.phone)) {
              kurirAccs = [
                ...kurirAccs,
                {
                  id:           m.id,
                  name:         m.name,
                  phone:        m.phone,
                  pin:          m.pin,
                  wilayah:      m.wilayah   ?? "",
                  status:       "available" as KurirStatus,
                  createdAt:    m.createdAt ?? "",
                  alamatRumah:  "",
                  noKtp:        "",
                  fotoKtp:      "",
                  fotoSelfie:   "",
                  registeredBy: "super_admin",
                  verified:     false,
                },
              ];
            }
          } else if (m.role === "marketing" || m.role === "sub_marketing") {
            if (!mktAccounts.find((a) => a.id === m.id || a.phone === m.phone)) {
              mktAccounts = [
                ...mktAccounts,
                {
                  id:        m.id,
                  name:      m.name,
                  phone:     m.phone,
                  pin:       m.pin,
                  role:      m.role as MarketingRole,
                  createdAt: m.createdAt ?? "",
                },
              ];
            }
          }
        });
      }

      // ── Merge owner dari @twd_owner_registrations (SuperAdmin) ────────────
      if (rawOwners) {
        const ownerList: any[] = JSON.parse(rawOwners);
        ownerList.forEach((o) => {
          if (!ownerRegs.find((r) => r.id === o.id)) {
            ownerRegs = [
              ...ownerRegs,
              {
                id:              o.id,
                kodeToken:       o.kode ?? o.kodeToken ?? "",
                name:            o.name      ?? "",
                tokoName:        o.tokoName   ?? "",
                phone:           o.phone      ?? "",
                paket:           (o.paket ?? "basic") as PaketMkt,
                recruitedBy:     "super_admin",
                recruitedByRole: "marketing" as MarketingRole,
                totalTransaksi:  0,
                createdAt:       o.createdAt  ?? "",
              },
            ];
          }
        });
      }

      setMarketingAccounts(mktAccounts);
      setKurirAccounts(kurirAccs);
      setOwnerRegistrations(ownerRegs);
      setKomisiRecords(d.komisiRecords     ?? []);
      setDeliveryRequests(d.deliveryRequests ?? []);
    } catch (e) {
      console.error(e);
    }
  };

  const persist = (patch: Record<string, unknown>) => {
    const data = {
      marketingAccounts, kurirAccounts, ownerRegistrations,
      komisiRecords, deliveryRequests, ...patch,
    };
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  };

  const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const ts    = () => new Date().toISOString();

  const addMarketing = (data: Omit<MarketingAccount, "id" | "createdAt">) => {
    const upd = [...marketingAccounts, { ...data, id: genId(), createdAt: ts() }];
    setMarketingAccounts(upd); persist({ marketingAccounts: upd });
  };
  const updateMarketing = (id: string, data: Partial<MarketingAccount>) => {
    const upd = marketingAccounts.map(m => m.id === id ? { ...m, ...data } : m);
    setMarketingAccounts(upd); persist({ marketingAccounts: upd });
  };
  const deleteMarketing = (id: string) => {
    const upd = marketingAccounts.filter(m => m.id !== id);
    setMarketingAccounts(upd); persist({ marketingAccounts: upd });
  };
  const loginMarketing = (phone: string, pin: string): MarketingAccount | null =>
    marketingAccounts.find(m => m.phone === phone && m.pin === pin) ?? null;

  const addKurir = (data: Omit<KurirAccount, "id" | "createdAt">) => {
    const newKurir: KurirFullRegistration = {
      ...data,
      id:           genId(),
      createdAt:    ts(),
      alamatRumah:  "",
      noKtp:        "",
      fotoKtp:      "",
      fotoSelfie:   "",
      registeredBy: "",
      verified:     false,
    };
    const upd = [...kurirAccounts, newKurir];
    setKurirAccounts(upd); persist({ kurirAccounts: upd });
  };
  const updateKurir = (id: string, data: Partial<KurirFullRegistration>) => {
    const upd = kurirAccounts.map(k => k.id === id ? { ...k, ...data } : k);
    setKurirAccounts(upd); persist({ kurirAccounts: upd });
  };
  const deleteKurir = (id: string) => {
    const upd = kurirAccounts.filter(k => k.id !== id);
    setKurirAccounts(upd); persist({ kurirAccounts: upd });
  };
  const loginKurir = (phone: string, pin: string): KurirFullRegistration | null =>
    kurirAccounts.find(k => k.phone === phone && k.pin === pin) ?? null;
  const updateKurirStatus = (kurirId: string, status: KurirStatus) => {
    const upd = kurirAccounts.map(k => k.id === kurirId ? { ...k, status } : k);
    setKurirAccounts(upd); persist({ kurirAccounts: upd });
  };
  const registerKurir = (
    data: Omit<KurirFullRegistration, "id" | "createdAt" | "pin" | "status">,
  ): KurirFullRegistration => {
    const newKurir: KurirFullRegistration = {
      ...data,
      id:        genId(),
      createdAt: ts(),
      pin:       "",
      status:    "available",
      verified:  false,
    };
    const upd = [...kurirAccounts, newKurir];
    setKurirAccounts(upd); persist({ kurirAccounts: upd });
    return newKurir;
  };

  const addOwnerRegistration = (
    data: Omit<OwnerRegistration, "id" | "kodeToken" | "createdAt" | "totalTransaksi">,
  ): OwnerRegistration => {
    const newRec: OwnerRegistration = {
      ...data,
      id:             genId(),
      kodeToken:      generateKodeToko(),
      totalTransaksi: 0,
      createdAt:      ts(),
    };
    const upd = [...ownerRegistrations, newRec];
    setOwnerRegistrations(upd); persist({ ownerRegistrations: upd });
    return newRec;
  };
  const registerOwnerWithTrial = (
    data: Omit<OwnerRegistration, "id" | "kodeToken" | "createdAt" | "totalTransaksi" | "trialStartDate" | "trialEndDate">,
  ): OwnerRegistration => {
    const now      = new Date();
    const trialEnd = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
    const newRec: OwnerRegistration = {
      ...data,
      id:             genId(),
      kodeToken:      generateKodeToko(),
      totalTransaksi: 0,
      createdAt:      now.toISOString(),
      trialStartDate: now.toISOString(),
      trialEndDate:   trialEnd.toISOString(),
    };
    const upd = [...ownerRegistrations, newRec];
    setOwnerRegistrations(upd); persist({ ownerRegistrations: upd });
    return newRec;
  };
  const deleteOwnerRegistration = (id: string) => {
    const upd = ownerRegistrations.filter(o => o.id !== id);
    setOwnerRegistrations(upd); persist({ ownerRegistrations: upd });
  };
  const findOwnerByKode = (kode: string): OwnerRegistration | null =>
    ownerRegistrations.find(o =>
      o.kodeToken != null && o.kodeToken.toUpperCase() === kode.toUpperCase()
    ) ?? null;
  const updateOwnerTransaksi = (ownerId: string, tambah: number) => {
    const upd = ownerRegistrations.map(o =>
      o.id === ownerId ? { ...o, totalTransaksi: (o.totalTransaksi ?? 0) + tambah } : o,
    );
    setOwnerRegistrations(upd); persist({ ownerRegistrations: upd });
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
    const upd = [...komisiRecords, { ...data, id: genId() }];
    setKomisiRecords(upd); persist({ komisiRecords: upd });
  };
  const addDeliveryRequest = (data: Omit<DeliveryRequest, "id" | "createdAt">) => {
    const biaya = data.jarakKm != null ? hitungBiayaKurir(data.jarakKm) : undefined;
    const upd = [...deliveryRequests, { ...data, biayaKurir: biaya, id: genId(), createdAt: ts() }];
    setDeliveryRequests(upd); persist({ deliveryRequests: upd });
  };
  const assignKurir = (requestId: string, kurirId: string, kurirName: string) => {
    const upd = deliveryRequests.map(r =>
      r.id === requestId ? { ...r, kurirId, kurirName, status: "assigned" as DeliveryStatus } : r,
    );
    setDeliveryRequests(upd); persist({ deliveryRequests: upd });
  };
  const updateDeliveryStatus = (requestId: string, status: DeliveryStatus) => {
    const upd = deliveryRequests.map(r =>
      r.id === requestId ? { ...r, status } : r,
    );
    setDeliveryRequests(upd); persist({ deliveryRequests: upd });
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
    setOwnerRegistrations(upd); persist({ ownerRegistrations: upd });
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