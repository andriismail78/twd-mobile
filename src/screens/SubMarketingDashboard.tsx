// src/screens/SubMarketingDashboard.tsx — v7
// FIX LOGOUT: AuthContext exports "logout" bukan "signOut"

import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "../context/AuthContext";

// ─── Safe area bottom ─────────────────────────────────────────────────────────
const BOTTOM_SAFE = Platform.OS === "ios" ? 34 : 24;

// ─── Types ────────────────────────────────────────────────────────────────────

interface OnlineOrder {
  id: string; ownerId: string; customerName: string;
  subtotal: number; total: number; ongkirGross?: number; jarakKm?: number;
  status: "menunggu"|"diproses"|"dikirim"|"selesai"|"dibatalkan";
  kurirId?: string; createdAt: string;
}
interface KurirAccount {
  id: string; name: string; phone?: string;
  marketingRef?: string; subMarketingRef?: string;
}
type PaketMkt = "basic"|"pro"|"enterprise";
interface OwnerRegistration {
  id: string; name: string; tokoName: string; phone: string;
  paket: PaketMkt; recruitedBy: string;
  recruitedByRole: "marketing"|"sub_marketing";
  kodeToken: string; createdAt: string;
}
interface GlobalProduct {
  id: string; name: string; addedBy: string; addedByName: string;
  price: number; createdAt: string;
}
interface BankAccount {
  namaBank: string; nomorRekening: string; namaPemilik: string;
}
interface WithdrawalRequest {
  id: string; subMarketingId: string; jumlah: number;
  namaBank: string; nomorRekening: string; namaPemilik: string;
  status: "menunggu"|"diproses"|"selesai"|"ditolak";
  createdAt: string; catatan?: string;
}
interface SubMarketingDashboardProps {
  subMarketingId?: string; subMarketingName?: string;
  marketingId?: string; onBack?: () => void;
}

// ─── Konstanta ────────────────────────────────────────────────────────────────

const APP_FEE_PCT             = 0.10;
const SUBMARKETING_FEE        = 0.10;
const KOMISI_LANGGANAN_RATE   = 0.14;
const KOMISI_PRODUK_PER_ITEM  = 100;
const MIN_OWNER_UNLOCK_PRODUK = 10;
const DEFAULT_JARAK_KM        = 3;
const MIN_WD                  = 50000;
const ONGKIR_KM1              = 10000;
const ONGKIR_KM_NEXT          = 3500;

const PAKET_HARGA: Record<PaketMkt, number> = {
  basic: 50_000, pro: 150_000, enterprise: 300_000,
};

const PAKET_LIST: Array<{value:PaketMkt; label:string; harga:string; desc:string; color:string}> = [
  { value:"basic",      label:"Basic",      harga:"50rb/bln",  desc:"50 produk, 2 kasir",           color:"#64748B" },
  { value:"pro",        label:"Pro",        harga:"150rb/bln", desc:"200 produk, 5 kasir, laporan",  color:"#2563EB" },
  { value:"enterprise", label:"Enterprise", harga:"300rb/bln", desc:"Unlimited, semua fitur",        color:"#7C3AED" },
];

const ORDERS_KEY    = "@twd_orders";
const KURIR_KEY     = "@twd_kurir_accounts";
const OWNER_REG_KEY = "@twd_owner_registrations";
const PRODUCTS_KEY  = "@twd_global_products";
const SMK_BANK_PFX  = "@twd_smk_bank_";
const SMK_WD_PFX    = "@twd_smk_wd_";

const WD_STATUS_LABELS: Record<string,string> = {
  menunggu:"⏳ Menunggu", diproses:"🔄 Diproses", selesai:"✅ Terkirim", ditolak:"❌ Ditolak",
};
const WD_STATUS_COLORS: Record<string,string> = {
  menunggu:"#f59e0b", diproses:"#3b82f6", selesai:"#10b981", ditolak:"#ef4444",
};

// ─── Demo data ────────────────────────────────────────────────────────────────

const JENIS_BISNIS_LIST = [
  "🏪 Warung / Kelontong","🛒 Minimarket","☕ Cafe / Kedai Kopi",
  "🍽️ Restoran / Rumah Makan","✂️ Barbershop / Salon","👕 Laundry",
  "💊 Apotek / Toko Obat","👗 Toko Fashion","📱 Toko Pulsa / Aksesoris",
  "🔧 Bengkel","🎓 Bimbel / Les Privat",
];

interface DemoProduk {
  id:string; nama:string; harga:number; stok:number; kategori:string; terjual:number;
}
interface DemoTrx {
  id:string; pelanggan:string; items:string; total:number;
  waktu:string; metode:"Tunai"|"QRIS"|"Transfer"|"Debit";
}
interface DemoData {
  tokoName:string; ownerName:string; paket:PaketMkt;
  omsetHariIni:number; trxHariIni:number; pelangganHariIni:number;
  omsetBulanIni:number; trxBulanIni:number;
  produk:DemoProduk[]; transaksi:DemoTrx[];
  stokKritis:string[]; trendHarian:number[];
}

const DEMO_DB: Record<string,DemoData> = {
  "🏪 Warung / Kelontong":{
    tokoName:"Warung Pak Hasan",ownerName:"Hasan",paket:"basic",
    omsetHariIni:1_850_000,trxHariIni:42,pelangganHariIni:38,omsetBulanIni:48_500_000,trxBulanIni:1240,
    produk:[
      {id:"p1",nama:"Beras 5kg",       harga:72000,stok:18,kategori:"Sembako", terjual:48},
      {id:"p2",nama:"Minyak Goreng 2L",harga:32000,stok:12,kategori:"Sembako", terjual:35},
      {id:"p3",nama:"Gula Pasir 1kg",  harga:16000,stok:25,kategori:"Sembako", terjual:52},
      {id:"p4",nama:"Telur 1 Papan",   harga:58000,stok:8, kategori:"Sembako", terjual:29},
      {id:"p5",nama:"Mie Instan",      harga:3500, stok:60,kategori:"Makanan", terjual:120},
      {id:"p6",nama:"Sabun Mandi",     harga:5000, stok:2, kategori:"Toiletri",terjual:30},
    ],
    transaksi:[
      {id:"t1",pelanggan:"Bu Sari",  items:"Beras 5kg, Telur",     total:130000,waktu:"08:12",metode:"Tunai"},
      {id:"t2",pelanggan:"Pak Budi", items:"Minyak Goreng, Gula",  total:48000, waktu:"09:30",metode:"QRIS"},
      {id:"t3",pelanggan:"Mbak Dewi",items:"Mie Instan x5, Sabun", total:27500, waktu:"11:05",metode:"Tunai"},
      {id:"t4",pelanggan:"Pak Rudi", items:"Beras 5kg",            total:72000, waktu:"13:20",metode:"Transfer"},
      {id:"t5",pelanggan:"Bu Ani",   items:"Gula, Telur, Mie x3",  total:84500, waktu:"15:40",metode:"Tunai"},
    ],
    stokKritis:["Sabun Mandi (sisa 2)","Telur 1 Papan (sisa 8)"],
    trendHarian:[65,48,80,72,90,55,100],
  },
  "🛒 Minimarket":{
    tokoName:"Sinar Jaya Mart",ownerName:"Jaya",paket:"pro",
    omsetHariIni:4_200_000,trxHariIni:87,pelangganHariIni:74,omsetBulanIni:112_000_000,trxBulanIni:2680,
    produk:[
      {id:"p1",nama:"Air Mineral 600ml",harga:4000, stok:150,kategori:"Minuman", terjual:215},
      {id:"p2",nama:"Snack Chitato",    harga:12000,stok:42, kategori:"Snack",   terjual:88},
      {id:"p3",nama:"Susu UHT",         harga:8500, stok:30, kategori:"Minuman", terjual:64},
      {id:"p4",nama:"Sabun Lifebuoy",   harga:6500, stok:25, kategori:"Toiletri",terjual:55},
      {id:"p5",nama:"Kopi Sachet 3in1", harga:2500, stok:80, kategori:"Minuman", terjual:180},
      {id:"p6",nama:"Roti Tawar",       harga:18000,stok:5,  kategori:"Makanan", terjual:40},
    ],
    transaksi:[
      {id:"t1",pelanggan:"Andi",      items:"Air Mineral x6, Snack",total:36000,waktu:"07:45",metode:"QRIS"},
      {id:"t2",pelanggan:"Rizki",     items:"Susu UHT, Kopi x3",   total:33000,waktu:"09:15",metode:"Tunai"},
      {id:"t3",pelanggan:"Bu Kartini",items:"Sabun, Shampoo, Odol", total:45000,waktu:"10:30",metode:"Debit"},
      {id:"t4",pelanggan:"Fajar",     items:"Snack x4, Air Mineral",total:52000,waktu:"12:00",metode:"QRIS"},
      {id:"t5",pelanggan:"Siti",      items:"Kopi x5, Susu",        total:21000,waktu:"14:30",metode:"Tunai"},
    ],
    stokKritis:["Roti Tawar (sisa 5)"],
    trendHarian:[75,60,85,78,95,70,100],
  },
  "☕ Cafe / Kedai Kopi":{
    tokoName:"Kopi Nusantara",ownerName:"Nanda",paket:"pro",
    omsetHariIni:2_850_000,trxHariIni:68,pelangganHariIni:55,omsetBulanIni:74_000_000,trxBulanIni:1820,
    produk:[
      {id:"p1",nama:"Kopi Susu",    harga:15000,stok:999,kategori:"Minuman",terjual:95},
      {id:"p2",nama:"Es Kopi Hitam",harga:12000,stok:999,kategori:"Minuman",terjual:72},
      {id:"p3",nama:"Matcha Latte", harga:22000,stok:999,kategori:"Minuman",terjual:48},
      {id:"p4",nama:"Roti Bakar",   harga:18000,stok:20, kategori:"Makanan",terjual:35},
      {id:"p5",nama:"Kopi Tubruk",  harga:8000, stok:999,kategori:"Minuman",terjual:60},
      {id:"p6",nama:"Croissant",    harga:25000,stok:4,  kategori:"Makanan",terjual:22},
    ],
    transaksi:[
      {id:"t1",pelanggan:"Meja 1",  items:"Kopi Susu x2, Roti Bakar", total:48000,waktu:"08:30",metode:"QRIS"},
      {id:"t2",pelanggan:"Meja 3",  items:"Matcha Latte, Es Kopi x2", total:46000,waktu:"09:45",metode:"Tunai"},
      {id:"t3",pelanggan:"Meja 5",  items:"Kopi Tubruk x3",           total:24000,waktu:"11:00",metode:"QRIS"},
      {id:"t4",pelanggan:"Takeaway",items:"Kopi Susu x4",             total:60000,waktu:"12:30",metode:"Transfer"},
      {id:"t5",pelanggan:"Meja 2",  items:"Matcha x2, Roti Bakar",    total:62000,waktu:"14:00",metode:"QRIS"},
    ],
    stokKritis:["Roti Bakar (sisa 20)","Croissant (sisa 4)"],
    trendHarian:[55,62,78,70,88,65,100],
  },
  "🍽️ Restoran / Rumah Makan":{
    tokoName:"RM Sederhana Jaya",ownerName:"Sederhana",paket:"pro",
    omsetHariIni:5_600_000,trxHariIni:95,pelangganHariIni:180,omsetBulanIni:145_000_000,trxBulanIni:2450,
    produk:[
      {id:"p1",nama:"Nasi Ayam Bakar",    harga:28000,stok:999,kategori:"Makanan",terjual:65},
      {id:"p2",nama:"Sop Iga",            harga:45000,stok:999,kategori:"Makanan",terjual:32},
      {id:"p3",nama:"Nasi Goreng Spesial",harga:25000,stok:999,kategori:"Makanan",terjual:80},
      {id:"p4",nama:"Es Teh Manis",       harga:5000, stok:999,kategori:"Minuman",terjual:150},
      {id:"p5",nama:"Ayam Geprek",        harga:22000,stok:999,kategori:"Makanan",terjual:58},
      {id:"p6",nama:"Jus Alpukat",        harga:18000,stok:10, kategori:"Minuman",terjual:25},
    ],
    transaksi:[
      {id:"t1",pelanggan:"Meja 4",  items:"Sop Iga x2, Es Teh x2",    total:100000,waktu:"11:30",metode:"Tunai"},
      {id:"t2",pelanggan:"Meja 7",  items:"Nasi Ayam Bakar x3",        total:84000, waktu:"12:00",metode:"QRIS"},
      {id:"t3",pelanggan:"Delivery",items:"Nasi Goreng x2, Es Teh x2", total:60000, waktu:"12:30",metode:"Transfer"},
      {id:"t4",pelanggan:"Meja 2",  items:"Ayam Geprek x4, Es Teh x4", total:108000,waktu:"13:00",metode:"Tunai"},
      {id:"t5",pelanggan:"Meja 9",  items:"Sop Iga, Nasi Ayam Bakar",  total:73000, waktu:"13:30",metode:"Debit"},
    ],
    stokKritis:["Jus Alpukat (sisa 10 buah)"],
    trendHarian:[70,65,90,80,100,75,95],
  },
  "✂️ Barbershop / Salon":{
    tokoName:"Barber Kings",ownerName:"Reza",paket:"basic",
    omsetHariIni:850_000,trxHariIni:22,pelangganHariIni:22,omsetBulanIni:22_000_000,trxBulanIni:580,
    produk:[
      {id:"p1",nama:"Potong Rambut Reguler",harga:25000, stok:999,kategori:"Layanan",terjual:42},
      {id:"p2",nama:"Potong + Cuci",        harga:35000, stok:999,kategori:"Layanan",terjual:28},
      {id:"p3",nama:"Cukur Jenggot",        harga:20000, stok:999,kategori:"Layanan",terjual:18},
      {id:"p4",nama:"Creambath",            harga:50000, stok:999,kategori:"Layanan",terjual:12},
      {id:"p5",nama:"Cat Rambut",           harga:100000,stok:3,  kategori:"Layanan",terjual:8},
      {id:"p6",nama:"Pomade",              harga:65000, stok:1,  kategori:"Produk", terjual:10},
    ],
    transaksi:[
      {id:"t1",pelanggan:"Budi",  items:"Potong Rambut Reguler",  total:25000, waktu:"09:00",metode:"Tunai"},
      {id:"t2",pelanggan:"Rizal", items:"Potong + Cuci + Jenggot",total:55000, waktu:"10:30",metode:"QRIS"},
      {id:"t3",pelanggan:"Anto",  items:"Potong Rambut Reguler",  total:25000, waktu:"11:45",metode:"Tunai"},
      {id:"t4",pelanggan:"Doni",  items:"Creambath",              total:50000, waktu:"13:00",metode:"QRIS"},
      {id:"t5",pelanggan:"Hendri",items:"Cat Rambut",             total:100000,waktu:"14:30",metode:"Transfer"},
    ],
    stokKritis:["Pomade (sisa 1)","Cat Rambut (sisa 3)"],
    trendHarian:[50,60,70,65,80,55,100],
  },
  "👕 Laundry":{
    tokoName:"Laundry Bersih Kilat",ownerName:"Kilat",paket:"basic",
    omsetHariIni:1_450_000,trxHariIni:38,pelangganHariIni:35,omsetBulanIni:38_000_000,trxBulanIni:980,
    produk:[
      {id:"p1",nama:"Cuci Setrika /kg",harga:7000, stok:999,kategori:"Layanan",terjual:320},
      {id:"p2",nama:"Cuci Kering /kg", harga:5000, stok:999,kategori:"Layanan",terjual:180},
      {id:"p3",nama:"Express /kg",     harga:12000,stok:999,kategori:"Layanan",terjual:45},
      {id:"p4",nama:"Selimut",         harga:25000,stok:999,kategori:"Layanan",terjual:28},
      {id:"p5",nama:"Jas / Blazer",    harga:35000,stok:999,kategori:"Layanan",terjual:15},
      {id:"p6",nama:"Deterjen 1kg",    harga:22000,stok:2,  kategori:"Produk", terjual:20},
    ],
    transaksi:[
      {id:"t1",pelanggan:"Bu Ratna",  items:"Cuci Setrika 5kg",         total:35000,waktu:"08:00",metode:"Tunai"},
      {id:"t2",pelanggan:"Pak Agus",  items:"Express 3kg",              total:36000,waktu:"09:30",metode:"Transfer"},
      {id:"t3",pelanggan:"Mbak Lisa", items:"Cuci Setrika 4kg, Selimut", total:53000,waktu:"11:00",metode:"QRIS"},
      {id:"t4",pelanggan:"Bu Wati",   items:"Cuci Kering 6kg",          total:30000,waktu:"13:00",metode:"Tunai"},
      {id:"t5",pelanggan:"Pak Hadi",  items:"Jas x2, Express 2kg",      total:94000,waktu:"15:00",metode:"QRIS"},
    ],
    stokKritis:["Deterjen 1kg (sisa 2)"],
    trendHarian:[60,55,75,68,85,60,100],
  },
  "💊 Apotek / Toko Obat":{
    tokoName:"Apotek Sehat Selalu",ownerName:"Sehat",paket:"pro",
    omsetHariIni:3_200_000,trxHariIni:75,pelangganHariIni:68,omsetBulanIni:82_000_000,trxBulanIni:1950,
    produk:[
      {id:"p1",nama:"Paracetamol 500mg", harga:1500, stok:100,kategori:"Obat",   terjual:240},
      {id:"p2",nama:"Vitamin C 1000mg",  harga:12000,stok:20, kategori:"Vitamin",terjual:85},
      {id:"p3",nama:"Minyak Kayu Putih", harga:18000,stok:15, kategori:"Herbal", terjual:55},
      {id:"p4",nama:"Masker Medis 50pcs",harga:35000,stok:10, kategori:"Alkes",  terjual:30},
      {id:"p5",nama:"Antangin JRG",      harga:3000, stok:50, kategori:"Herbal", terjual:120},
      {id:"p6",nama:"Betadine 30ml",     harga:28000,stok:3,  kategori:"Obat",   terjual:18},
    ],
    transaksi:[
      {id:"t1",pelanggan:"Ny. Sarah",items:"Paracetamol x2, Vitamin C",total:15000,waktu:"08:30",metode:"Tunai"},
      {id:"t2",pelanggan:"Tn. Joko", items:"Minyak Kayu Putih",        total:18000,waktu:"09:45",metode:"QRIS"},
      {id:"t3",pelanggan:"Ny. Rina", items:"Masker Medis, Vit C x2",   total:59000,waktu:"11:00",metode:"Tunai"},
      {id:"t4",pelanggan:"Tn. Dody", items:"Antangin x3, Paracetamol", total:10500,waktu:"13:30",metode:"Transfer"},
      {id:"t5",pelanggan:"Ny. Putri",items:"Vitamin C x3",             total:36000,waktu:"15:00",metode:"QRIS"},
    ],
    stokKritis:["Betadine 30ml (sisa 3)","Vitamin C (sisa 20)"],
    trendHarian:[68,72,80,75,90,65,100],
  },
  "👗 Toko Fashion":{
    tokoName:"Butik Modis",ownerName:"Modis",paket:"pro",
    omsetHariIni:3_800_000,trxHariIni:28,pelangganHariIni:25,omsetBulanIni:95_000_000,trxBulanIni:720,
    produk:[
      {id:"p1",nama:"Kaos Polos",      harga:75000, stok:25,kategori:"Atasan",   terjual:42},
      {id:"p2",nama:"Celana Jeans",    harga:185000,stok:12,kategori:"Bawahan",  terjual:18},
      {id:"p3",nama:"Dress Casual",    harga:145000,stok:8, kategori:"Dress",    terjual:25},
      {id:"p4",nama:"Hijab Segi Empat",harga:55000, stok:30,kategori:"Aksesoris",terjual:38},
      {id:"p5",nama:"Jaket Denim",     harga:275000,stok:3, kategori:"Atasan",   terjual:12},
      {id:"p6",nama:"Rok Midi",        harga:125000,stok:5, kategori:"Bawahan",  terjual:20},
    ],
    transaksi:[
      {id:"t1",pelanggan:"Mbak Rini", items:"Dress Casual, Hijab x2",    total:255000,waktu:"10:00",metode:"QRIS"},
      {id:"t2",pelanggan:"Mbak Putri",items:"Kaos Polos x3",             total:225000,waktu:"11:30",metode:"Tunai"},
      {id:"t3",pelanggan:"Bu Sinta",  items:"Jaket Denim",              total:275000,waktu:"13:00",metode:"Transfer"},
      {id:"t4",pelanggan:"Mbak Ayu",  items:"Hijab x4, Kaos Polos",      total:295000,waktu:"14:30",metode:"QRIS"},
      {id:"t5",pelanggan:"Mbak Dita", items:"Celana Jeans, Dress Casual",total:330000,waktu:"16:00",metode:"Debit"},
    ],
    stokKritis:["Jaket Denim (sisa 3)","Rok Midi (sisa 5)"],
    trendHarian:[55,70,80,75,90,60,100],
  },
  "📱 Toko Pulsa / Aksesoris":{
    tokoName:"Counter Pulsa Maju",ownerName:"Maju",paket:"basic",
    omsetHariIni:1_850_000,trxHariIni:65,pelangganHariIni:60,omsetBulanIni:48_000_000,trxBulanIni:1680,
    produk:[
      {id:"p1",nama:"Pulsa Telkomsel 25rb",harga:26000, stok:999,kategori:"Pulsa",    terjual:88},
      {id:"p2",nama:"Paket Data 8GB",      harga:45000, stok:999,kategori:"Data",     terjual:55},
      {id:"p3",nama:"Casing HP Universal", harga:35000, stok:15, kategori:"Aksesoris",terjual:28},
      {id:"p4",nama:"Kabel Data Type-C",   harga:25000, stok:8,  kategori:"Aksesoris",terjual:32},
      {id:"p5",nama:"Earphone Bluetooth",  harga:85000, stok:5,  kategori:"Aksesoris",terjual:15},
      {id:"p6",nama:"Power Bank 10000mAh", harga:185000,stok:2,  kategori:"Aksesoris",terjual:8},
    ],
    transaksi:[
      {id:"t1",pelanggan:"Doni",  items:"Pulsa Telkomsel 25rb",   total:26000,waktu:"08:30",metode:"Transfer"},
      {id:"t2",pelanggan:"Hendra",items:"Paket Data 8GB",         total:45000,waktu:"09:45",metode:"QRIS"},
      {id:"t3",pelanggan:"Yuli",  items:"Casing HP, Kabel Type-C",total:60000,waktu:"11:00",metode:"Tunai"},
      {id:"t4",pelanggan:"Fajar", items:"Earphone Bluetooth",     total:85000,waktu:"13:30",metode:"QRIS"},
      {id:"t5",pelanggan:"Rendi", items:"Pulsa x2, Paket Data",   total:97000,waktu:"15:30",metode:"Transfer"},
    ],
    stokKritis:["Power Bank (sisa 2)","Kabel Type-C (sisa 8)"],
    trendHarian:[60,55,75,70,88,62,100],
  },
  "🔧 Bengkel":{
    tokoName:"Bengkel Maju Lancar",ownerName:"Lancar",paket:"basic",
    omsetHariIni:1_250_000,trxHariIni:18,pelangganHariIni:18,omsetBulanIni:32_000_000,trxBulanIni:465,
    produk:[
      {id:"p1",nama:"Ganti Oli Mesin",  harga:85000, stok:10, kategori:"Layanan",terjual:32},
      {id:"p2",nama:"Tune Up Motor",    harga:120000,stok:999,kategori:"Layanan",terjual:18},
      {id:"p3",nama:"Tambal Ban",       harga:25000, stok:999,kategori:"Layanan",terjual:45},
      {id:"p4",nama:"Ganti Kampas Rem", harga:75000, stok:8,  kategori:"Layanan",terjual:22},
      {id:"p5",nama:"Cuci Motor",       harga:20000, stok:999,kategori:"Layanan",terjual:38},
      {id:"p6",nama:"Oli Mesin 1L",     harga:55000, stok:3,  kategori:"Produk", terjual:25},
    ],
    transaksi:[
      {id:"t1",pelanggan:"Tn. Budi", items:"Ganti Oli Mesin",       total:85000, waktu:"08:00",metode:"Tunai"},
      {id:"t2",pelanggan:"Tn. Rudi", items:"Tune Up Motor",         total:120000,waktu:"09:30",metode:"QRIS"},
      {id:"t3",pelanggan:"Tn. Eko",  items:"Tambal Ban x2",         total:50000, waktu:"11:00",metode:"Tunai"},
      {id:"t4",pelanggan:"Tn. Hasan",items:"Ganti Kampas Rem, Oli", total:160000,waktu:"13:00",metode:"Transfer"},
      {id:"t5",pelanggan:"Ny. Indah",items:"Cuci Motor, Tambal Ban",total:45000, waktu:"15:00",metode:"QRIS"},
    ],
    stokKritis:["Oli Mesin (sisa 3L)","Kampas Rem (sisa 8 set)"],
    trendHarian:[45,55,65,60,80,50,100],
  },
  "🎓 Bimbel / Les Privat":{
    tokoName:"Bimbel Cerdas Prestasi",ownerName:"Prestasi",paket:"pro",
    omsetHariIni:2_850_000,trxHariIni:12,pelangganHariIni:12,omsetBulanIni:68_000_000,trxBulanIni:285,
    produk:[
      {id:"p1",nama:"Les Matematika/bln",    harga:350000,stok:999,kategori:"Les Rutin",terjual:22},
      {id:"p2",nama:"Les Bahasa Inggris/bln",harga:350000,stok:999,kategori:"Les Rutin",terjual:18},
      {id:"p3",nama:"Les IPA Terpadu/bln",   harga:400000,stok:999,kategori:"Les Rutin",terjual:15},
      {id:"p4",nama:"Try Out SBMPTN",        harga:150000,stok:50, kategori:"Program",  terjual:30},
      {id:"p5",nama:"Les Privat Rumah",      harga:500000,stok:999,kategori:"Privat",   terjual:8},
      {id:"p6",nama:"Modul Belajar",         harga:85000, stok:5,  kategori:"Produk",   terjual:35},
    ],
    transaksi:[
      {id:"t1",pelanggan:"Tn. Santoso",   items:"Les Matematika (Budi)", total:350000,waktu:"09:00",metode:"Transfer"},
      {id:"t2",pelanggan:"Ny. Rahayu",    items:"Les B.Inggris (Sari)",  total:350000,waktu:"10:00",metode:"Transfer"},
      {id:"t3",pelanggan:"Tn. Hendra",    items:"Try Out SBMPTN x2",     total:300000,waktu:"11:00",metode:"QRIS"},
      {id:"t4",pelanggan:"Ny. Wulandari", items:"Les IPA (Rina)",        total:400000,waktu:"13:00",metode:"Transfer"},
      {id:"t5",pelanggan:"Tn. Darmawan",  items:"Les Privat Rumah",      total:500000,waktu:"14:00",metode:"Tunai"},
    ],
    stokKritis:["Modul Belajar (sisa 5)"],
    trendHarian:[60,70,80,75,90,65,100],
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calcOngkirGross(jarakKm: number): number {
  const km = Math.max(1, jarakKm);
  return km <= 1 ? ONGKIR_KM1 : ONGKIR_KM1 + Math.round((km - 1) * ONGKIR_KM_NEXT);
}
function calcKomisiOngkir(order: OnlineOrder): number {
  const gross  = order.ongkirGross ?? calcOngkirGross(order.jarakKm ?? DEFAULT_JARAK_KM);
  const appFee = Math.round(gross * APP_FEE_PCT);
  return Math.round(appFee * SUBMARKETING_FEE);
}
function formatRp(n: number): string {
  return "Rp " + Math.round(n).toLocaleString("id-ID");
}
function formatRpShort(n: number): string {
  if (n >= 1_000_000) return "Rp " + (n / 1_000_000).toFixed(1) + "jt";
  if (n >= 1_000)     return "Rp " + (n / 1_000).toFixed(0) + "rb";
  return "Rp " + n.toLocaleString("id-ID");
}
function formatDate(iso: string): string {
  const d = new Date(iso);
  return (
    d.toLocaleDateString("id-ID", { day:"2-digit", month:"short", year:"numeric" }) +
    " " + d.toLocaleTimeString("id-ID", { hour:"2-digit", minute:"2-digit" })
  );
}
function todayStr():     string { return new Date().toISOString().slice(0, 10); }
function thisMonthStr(): string { return new Date().toISOString().slice(0, 7); }
function genId(pfx: string): string {
  return pfx + "-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6);
}
function genToken(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let t = "SMK-";
  for (let i = 0; i < 8; i++) t += chars[Math.floor(Math.random() * chars.length)];
  return t;
}

// ─── Demo OwnerDashboard ──────────────────────────────────────────────────────

const OWNER_BLUE    = "#2563EB";
const SUCCESS_GREEN = "#16A34A";
const DANGER_RED    = "#DC2626";
const METODE_COLOR: Record<string,string> = {
  Tunai:"#16A34A", QRIS:"#7C3AED", Transfer:"#2563EB", Debit:"#0891B2",
};

type OwnerTab = "beranda"|"kasir"|"produk"|"laporan";
const OWNER_TABS: Array<{value:OwnerTab; icon:string; label:string}> = [
  {value:"beranda",icon:"🏠",label:"Beranda"},
  {value:"kasir",  icon:"🧾",label:"Kasir"},
  {value:"produk", icon:"📦",label:"Produk"},
  {value:"laporan",icon:"📊",label:"Laporan"},
];

function DemoOwnerDashboard({ jenisBisnis, onClose }: { jenisBisnis:string; onClose:()=>void }) {
  const data: DemoData = DEMO_DB[jenisBisnis] ?? DEMO_DB["🏪 Warung / Kelontong"];
  const [tab, setTab]             = useState<OwnerTab>("beranda");
  const [keranjang, setKeranjang] = useState<Record<string,number>>({});

  const totalKeranjang = Object.entries(keranjang).reduce((sum, [id, qty]) => {
    const p = data.produk.find((x) => x.id === id);
    return sum + (p ? p.harga * qty : 0);
  }, 0);
  const totalItem = Object.values(keranjang).reduce((s, q) => s + q, 0);

  function addToCart(id: string):     void { setKeranjang((p) => ({ ...p, [id]: (p[id] ?? 0) + 1 })); }
  function removeFromCart(id: string): void {
    setKeranjang((p) => {
      const n = { ...p };
      if ((n[id] ?? 0) > 0) n[id] = n[id] - 1;
      if (n[id] === 0) delete n[id];
      return n;
    });
  }
  function bayar(): void {
    Alert.alert("Demo Mode", "Di aplikasi nyata, kasir dapat memproses pembayaran di sini.", [{ text:"Oke" }]);
  }

  function renderBeranda() {
    return (
      <ScrollView contentContainerStyle={OD.scrollContent}>
        <View style={OD.demoBanner}><Text style={OD.demoBannerTxt}>{"👀 MODE DEMO  ·  " + jenisBisnis}</Text></View>
        <View style={OD.statRow}>
          <View style={[OD.statCard, OD.statCardBlue]}>
            <Text style={OD.statCardLbl}>{"Omset Hari Ini"}</Text>
            <Text style={OD.statCardVal}>{formatRpShort(data.omsetHariIni)}</Text>
            <Text style={OD.statCardSub}>{String(data.trxHariIni) + " transaksi"}</Text>
          </View>
          <View style={[OD.statCard, OD.statCardGreen]}>
            <Text style={OD.statCardLbl}>{"Pelanggan"}</Text>
            <Text style={OD.statCardVal}>{String(data.pelangganHariIni)}</Text>
            <Text style={OD.statCardSub}>{"hari ini"}</Text>
          </View>
        </View>
        <View style={OD.statRow}>
          <View style={[OD.statCard, OD.statCardPurple]}>
            <Text style={OD.statCardLbl}>{"Omset Bulan Ini"}</Text>
            <Text style={OD.statCardVal}>{formatRpShort(data.omsetBulanIni)}</Text>
            <Text style={OD.statCardSub}>{String(data.trxBulanIni) + " transaksi"}</Text>
          </View>
          <View style={[OD.statCard, OD.statCardOrange]}>
            <Text style={OD.statCardLbl}>{"Produk Aktif"}</Text>
            <Text style={OD.statCardVal}>{String(data.produk.length)}</Text>
            <Text style={OD.statCardSub}>{"item terdaftar"}</Text>
          </View>
        </View>
        <View style={OD.sectionCard}>
          <Text style={OD.sectionTitle}>{"📈 Tren Omset 7 Hari"}</Text>
          <View style={OD.chartRow}>
            {data.trendHarian.map((pct, i) => {
              const days = ["Sen","Sel","Rab","Kam","Jum","Sab","Min"];
              return (
                <View key={i} style={OD.barCol}>
                  <View style={OD.barBg}>
                    <View style={[OD.barFill, { height: (pct + "%") as any }]} />
                  </View>
                  <Text style={OD.barLbl}>{days[i]}</Text>
                </View>
              );
            })}
          </View>
        </View>
        <View style={OD.sectionCard}>
          <Text style={OD.sectionTitle}>{"🧾 Transaksi Terbaru"}</Text>
          {data.transaksi.slice(0, 3).map((trx) => (
            <View key={trx.id} style={OD.trxRow}>
              <View style={OD.trxLeft}>
                <Text style={OD.trxNama}>{trx.pelanggan}</Text>
                <Text style={OD.trxItems}>{trx.items}</Text>
              </View>
              <View style={OD.trxRight}>
                <Text style={OD.trxTotal}>{formatRp(trx.total)}</Text>
                <View style={[OD.metodeBadge, { backgroundColor: (METODE_COLOR[trx.metode] ?? "#64748B") + "18" }]}>
                  <Text style={[OD.metodeTxt, { color: METODE_COLOR[trx.metode] ?? "#64748B" }]}>{trx.metode}</Text>
                </View>
              </View>
            </View>
          ))}
          <TouchableOpacity style={OD.lihatSemuaBtn} onPress={() => setTab("laporan")}>
            <Text style={OD.lihatSemuaTxt}>{"Lihat semua transaksi →"}</Text>
          </TouchableOpacity>
        </View>
        {data.stokKritis.length > 0 && (
          <View style={OD.stokKritisCard}>
            <Text style={OD.stokKritisTitle}>{"⚠️ Stok Perlu Diisi Ulang"}</Text>
            {data.stokKritis.map((s, i) => (
              <View key={i} style={OD.stokKritisRow}>
                <Text style={OD.stokKritisIcon}>{"📦"}</Text>
                <Text style={OD.stokKritisTxt}>{s}</Text>
                <View style={OD.stokDangerBadge}><Text style={OD.stokDangerTxt}>{"KRITIS"}</Text></View>
              </View>
            ))}
          </View>
        )}
        <View style={OD.bottomSpacer} />
      </ScrollView>
    );
  }

  function renderKasir() {
    return (
      <View style={OD.kasirContainer}>
        <ScrollView style={OD.kasirProdukList} contentContainerStyle={OD.kasirProdukContent}>
          <View style={OD.demoBanner}>
            <Text style={OD.demoBannerTxt}>{"🧾 Kasir — tap untuk menambah ke keranjang"}</Text>
          </View>
          <View style={OD.produkGrid}>
            {data.produk.map((p) => {
              const qty = keranjang[p.id] ?? 0;
              return (
                <View key={p.id} style={OD.kasirProdukCard}>
                  <View style={OD.kasirProdukIcon}><Text style={OD.kasirProdukEmoji}>{"🛍️"}</Text></View>
                  <Text style={OD.kasirProdukNama} numberOfLines={2}>{p.nama}</Text>
                  <Text style={OD.kasirProdukHarga}>{formatRp(p.harga)}</Text>
                  <Text style={OD.kasirProdukStok}>{"Stok: " + (p.stok >= 999 ? "∞" : String(p.stok))}</Text>
                  {qty === 0 ? (
                    <TouchableOpacity style={OD.kasirAddBtn} onPress={() => addToCart(p.id)}>
                      <Text style={OD.kasirAddBtnTxt}>{"+ Tambah"}</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={OD.kasirQtyRow}>
                      <TouchableOpacity style={OD.kasirQtyBtn} onPress={() => removeFromCart(p.id)}>
                        <Text style={OD.kasirQtyBtnTxt}>{"−"}</Text>
                      </TouchableOpacity>
                      <Text style={OD.kasirQtyNum}>{String(qty)}</Text>
                      <TouchableOpacity style={[OD.kasirQtyBtn, OD.kasirQtyBtnAdd]} onPress={() => addToCart(p.id)}>
                        <Text style={[OD.kasirQtyBtnTxt, OD.kasirQtyBtnAddTxt]}>{"+"}</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
          <View style={OD.bottomSpacer} />
        </ScrollView>
        <View style={OD.kasirFooter}>
          <View style={OD.kasirTotalRow}>
            <View>
              <Text style={OD.kasirTotalLbl}>{"Total  ·  " + String(totalItem) + " item"}</Text>
              <Text style={OD.kasirTotalVal}>{formatRp(totalKeranjang)}</Text>
            </View>
            <TouchableOpacity
              style={totalKeranjang > 0 ? OD.kasirBayarBtn : OD.kasirBayarBtnDisabled}
              onPress={bayar}
              disabled={totalKeranjang === 0}
            >
              <Text style={OD.kasirBayarBtnTxt}>{"💳 Bayar"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  function renderProduk() {
    return (
      <ScrollView contentContainerStyle={OD.scrollContent}>
        <View style={OD.demoBanner}>
          <Text style={OD.demoBannerTxt}>{"📦 Manajemen Produk — " + String(data.produk.length) + " produk"}</Text>
        </View>
        {data.produk.map((p) => (
          <View key={p.id} style={OD.produkCard}>
            <View style={OD.produkIconBox}><Text style={OD.produkIconTxt}>{"🛍️"}</Text></View>
            <View style={OD.produkInfo}>
              <Text style={OD.produkNama}>{p.nama}</Text>
              <Text style={OD.produkKategori}>{p.kategori}</Text>
              <Text style={OD.produkHarga}>{formatRp(p.harga)}</Text>
            </View>
            <View style={OD.produkRight}>
              <View style={[OD.stokBadge, p.stok < 10 ? OD.stokBadgeDanger : OD.stokBadgeOk]}>
                <Text style={p.stok < 10 ? OD.stokBadgeTxtDanger : OD.stokBadgeTxtOk}>
                  {p.stok >= 999 ? "Stok ∞" : "Stok " + String(p.stok)}
                </Text>
              </View>
              <Text style={OD.produkTerjual}>{String(p.terjual) + " terjual"}</Text>
            </View>
          </View>
        ))}
        <TouchableOpacity style={OD.tambahProdukBtn}>
          <Text style={OD.tambahProdukBtnTxt}>{"+ Tambah Produk Baru"}</Text>
        </TouchableOpacity>
        <View style={OD.bottomSpacer} />
      </ScrollView>
    );
  }

  function renderLaporan() {
    return (
      <ScrollView contentContainerStyle={OD.scrollContent}>
        <View style={OD.demoBanner}>
          <Text style={OD.demoBannerTxt}>{"📊 Laporan Transaksi Hari Ini"}</Text>
        </View>
        <View style={OD.laporanSummaryCard}>
          <View style={OD.laporanSummaryRow}>
            <Text style={OD.laporanSummaryLbl}>{"Total Omset Hari Ini"}</Text>
            <Text style={[OD.laporanSummaryVal, { color: OWNER_BLUE }]}>{formatRp(data.omsetHariIni)}</Text>
          </View>
          <View style={OD.laporanSummaryRow}>
            <Text style={OD.laporanSummaryLbl}>{"Jumlah Transaksi"}</Text>
            <Text style={OD.laporanSummaryVal}>{String(data.trxHariIni) + " trx"}</Text>
          </View>
          <View style={OD.laporanSummaryRow}>
            <Text style={OD.laporanSummaryLbl}>{"Rata-rata per Transaksi"}</Text>
            <Text style={OD.laporanSummaryVal}>{formatRp(Math.round(data.omsetHariIni / data.trxHariIni))}</Text>
          </View>
          <View style={OD.laporanSummaryRow}>
            <Text style={OD.laporanSummaryLbl}>{"Omset Bulan Ini"}</Text>
            <Text style={[OD.laporanSummaryVal, { color: SUCCESS_GREEN }]}>{formatRp(data.omsetBulanIni)}</Text>
          </View>
        </View>
        <Text style={OD.sectionTitlePlain}>{"🧾 Detail Transaksi"}</Text>
        {data.transaksi.map((trx) => (
          <View key={trx.id} style={OD.laporanTrxCard}>
            <View style={OD.laporanTrxLeft}>
              <Text style={OD.laporanTrxNama}>{trx.pelanggan}</Text>
              <Text style={OD.laporanTrxItems}>{trx.items}</Text>
              <Text style={OD.laporanTrxWaktu}>{"🕐 " + trx.waktu}</Text>
            </View>
            <View style={OD.laporanTrxRight}>
              <Text style={OD.laporanTrxTotal}>{formatRp(trx.total)}</Text>
              <View style={[OD.metodeBadge, { backgroundColor: (METODE_COLOR[trx.metode] ?? "#64748B") + "18" }]}>
                <Text style={[OD.metodeTxt, { color: METODE_COLOR[trx.metode] ?? "#64748B" }]}>{trx.metode}</Text>
              </View>
            </View>
          </View>
        ))}
        <View style={OD.bottomSpacer} />
      </ScrollView>
    );
  }

  return (
    <View style={OD.container}>
      <View style={OD.header}>
        <View style={OD.headerTopRow}>
          <TouchableOpacity style={OD.closeBtn} onPress={onClose}>
            <Text style={OD.closeTxt}>{"✕ Tutup Demo"}</Text>
          </TouchableOpacity>
          <View style={OD.demoBadgePill}><Text style={OD.demoBadgePillTxt}>{"👀 DEMO"}</Text></View>
        </View>
        <View style={OD.headerInfoRow}>
          <View style={OD.headerStoreIcon}><Text style={OD.headerStoreEmoji}>{"🏪"}</Text></View>
          <View style={OD.headerTextCol}>
            <Text style={OD.headerTokoName}>{data.tokoName}</Text>
            <Text style={OD.headerOwnerName}>{"Owner: " + data.ownerName + "  ·  " + data.paket.toUpperCase()}</Text>
          </View>
        </View>
        <View style={OD.headerStatStrip}>
          <View style={OD.headerStatItem}>
            <Text style={OD.headerStatVal}>{formatRpShort(data.omsetHariIni)}</Text>
            <Text style={OD.headerStatLbl}>{"Omset Hari Ini"}</Text>
          </View>
          <View style={OD.headerStatDivider} />
          <View style={OD.headerStatItem}>
            <Text style={OD.headerStatVal}>{String(data.trxHariIni)}</Text>
            <Text style={OD.headerStatLbl}>{"Transaksi"}</Text>
          </View>
          <View style={OD.headerStatDivider} />
          <View style={OD.headerStatItem}>
            <Text style={OD.headerStatVal}>{String(data.produk.length)}</Text>
            <Text style={OD.headerStatLbl}>{"Produk"}</Text>
          </View>
        </View>
      </View>
      <View style={OD.content}>
        {tab === "beranda" && renderBeranda()}
        {tab === "kasir"   && renderKasir()}
        {tab === "produk"  && renderProduk()}
        {tab === "laporan" && renderLaporan()}
      </View>
      <View style={OD.bottomNav}>
        {OWNER_TABS.map((t) => (
          <TouchableOpacity key={t.value} style={OD.bottomNavItem} onPress={() => setTab(t.value)}>
            <Text style={tab === t.value ? OD.bottomNavIconActive : OD.bottomNavIcon}>{t.icon}</Text>
            <Text style={tab === t.value ? OD.bottomNavLblActive : OD.bottomNavLbl}>{t.label}</Text>
            {tab === t.value && <View style={OD.bottomNavIndicator} />}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SubMarketingDashboard(props: SubMarketingDashboardProps) {
  // ✅ FIX: gunakan "logout" sesuai AuthContext, bukan "signOut"
  const { user, logout } = useAuth();
  const subMarketingId   = props.subMarketingId   ?? (user as any)?.id   ?? "";
  const subMarketingName = props.subMarketingName ?? (user as any)?.name ?? "Sub-Marketing";

  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [myKurir,       setMyKurir]       = useState<KurirAccount[]>([]);
  const [myOrders,      setMyOrders]      = useState<OnlineOrder[]>([]);
  const [myOwners,      setMyOwners]      = useState<OwnerRegistration[]>([]);
  const [myProducts,    setMyProducts]    = useState<GlobalProduct[]>([]);
  const [bankAccount,   setBankAccount]   = useState<BankAccount|null>(null);
  const [withdrawals,   setWithdrawals]   = useState<WithdrawalRequest[]>([]);
  const [activeTab,     setActiveTab]     = useState<"ringkasan"|"owner"|"komisi"|"pencairan">("ringkasan");
  const [showBankModal,    setShowBankModal]    = useState(false);
  const [showWdModal,      setShowWdModal]      = useState(false);
  const [showDemoSelector, setShowDemoSelector] = useState(false);
  const [showDemoScreen,   setShowDemoScreen]   = useState(false);
  const [showDaftarOwner,  setShowDaftarOwner]  = useState(false);
  const [bankInput,  setBankInput]  = useState<BankAccount>({ namaBank:"", nomorRekening:"", namaPemilik:"" });
  const [wdJumlah,   setWdJumlah]   = useState("");
  const [demoJenis,  setDemoJenis]  = useState("");
  const [ownerNama,     setOwnerNama]     = useState("");
  const [ownerTokoName, setOwnerTokoName] = useState("");
  const [ownerPhone,    setOwnerPhone]    = useState("");
  const [ownerPaket,    setOwnerPaket]    = useState<PaketMkt>("basic");
  const [ownerToken,    setOwnerToken]    = useState(genToken());
  const [savingOwner,   setSavingOwner]   = useState(false);

  // ── Load data ─────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    if (!subMarketingId) { setLoading(false); return; }
    try {
      const rawKurir = await AsyncStorage.getItem(KURIR_KEY);
      const allKurir: KurirAccount[] = rawKurir ? JSON.parse(rawKurir) : [];
      const registered = allKurir.filter((k) => String(k.subMarketingRef ?? "") === String(subMarketingId));
      setMyKurir(registered);

      const kurirIds  = new Set(registered.map((k) => String(k.id)));
      const rawOrders = await AsyncStorage.getItem(ORDERS_KEY);
      const allOrders: OnlineOrder[] = rawOrders ? JSON.parse(rawOrders) : [];
      setMyOrders(
        allOrders
          .filter((o) => o.status === "selesai" && kurirIds.has(String(o.kurirId ?? "")))
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
      );

      const rawOwners = await AsyncStorage.getItem(OWNER_REG_KEY);
      const allOwners: OwnerRegistration[] = rawOwners ? JSON.parse(rawOwners) : [];
      setMyOwners(allOwners.filter(
        (o) => String(o.recruitedBy) === String(subMarketingId) && o.recruitedByRole === "sub_marketing",
      ));

      const rawProducts = await AsyncStorage.getItem(PRODUCTS_KEY);
      const allProducts: GlobalProduct[] = rawProducts ? JSON.parse(rawProducts) : [];
      setMyProducts(allProducts.filter((p) => String(p.addedBy) === String(subMarketingId)));

      const rawBank = await AsyncStorage.getItem(SMK_BANK_PFX + subMarketingId);
      setBankAccount(rawBank ? JSON.parse(rawBank) : null);

      const rawWd  = await AsyncStorage.getItem(SMK_WD_PFX + subMarketingId);
      const allWd: WithdrawalRequest[] = rawWd ? JSON.parse(rawWd) : [];
      setWithdrawals(allWd.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch (e) {
      console.error("SubMarketingDashboard loadData:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [subMarketingId]);

  useEffect(() => { loadData(); }, [loadData]);
  const onRefresh = () => { setRefreshing(true); loadData(); };

  // ── Computed ──────────────────────────────────────────────────────────

  const komisiOngkir    = useMemo(() => myOrders.reduce((s, o) => s + calcKomisiOngkir(o), 0), [myOrders]);
  const komisiLangganan = useMemo(
    () => myOwners.reduce((s, o) => s + Math.round((PAKET_HARGA[o.paket] ?? 50_000) * KOMISI_LANGGANAN_RATE), 0),
    [myOwners],
  );
  const produkUnlocked = myOwners.length >= MIN_OWNER_UNLOCK_PRODUK;
  const komisiProduk   = produkUnlocked ? myProducts.length * KOMISI_PRODUK_PER_ITEM : 0;
  const totalEarned    = komisiOngkir + komisiLangganan + komisiProduk;

  const totalWithdrawn = useMemo(
    () => withdrawals.filter((w) => w.status === "selesai").reduce((s, w) => s + w.jumlah, 0),
    [withdrawals],
  );
  const pendingWd = useMemo(
    () => withdrawals.filter((w) => w.status === "menunggu" || w.status === "diproses").reduce((s, w) => s + w.jumlah, 0),
    [withdrawals],
  );
  const saldoBisa   = useMemo(() => Math.max(0, totalEarned - totalWithdrawn - pendingWd), [totalEarned, totalWithdrawn, pendingWd]);
  const todayOrders = useMemo(() => myOrders.filter((o) => o.createdAt.slice(0,10) === todayStr()),     [myOrders]);
  const monthOrders = useMemo(() => myOrders.filter((o) => o.createdAt.slice(0,7)  === thisMonthStr()), [myOrders]);
  const todayComm   = useMemo(() => todayOrders.reduce((s, o) => s + calcKomisiOngkir(o), 0), [todayOrders]);
  const monthComm   = useMemo(() => monthOrders.reduce((s, o) => s + calcKomisiOngkir(o), 0), [monthOrders]);

  // ── LOGOUT ✅ FIX FINAL ───────────────────────────────────────────────
  // logout() = setUser(null) di AuthContext → root navigator redirect ke login

  function doLogout(): void {
    logout();
  }

  function handleLogout(): void {
    Alert.alert(
      "Logout",
      "Yakin ingin keluar dari akun ini?",
      [
        { text:"Batal", style:"cancel" },
        { text:"Logout", style:"destructive", onPress: doLogout },
      ],
    );
  }

  // ── Daftarkan owner ───────────────────────────────────────────────────

  function resetFormOwner(): void {
    setOwnerNama(""); setOwnerTokoName(""); setOwnerPhone("");
    setOwnerPaket("basic"); setOwnerToken(genToken());
  }

  async function handleDaftarOwner(): Promise<void> {
    if (!ownerNama.trim())     { Alert.alert("Lengkapi", "Nama owner wajib diisi."); return; }
    if (!ownerTokoName.trim()) { Alert.alert("Lengkapi", "Nama toko wajib diisi."); return; }
    if (!ownerPhone.trim())    { Alert.alert("Lengkapi", "Nomor HP wajib diisi."); return; }
    setSavingOwner(true);
    try {
      const rawOwners = await AsyncStorage.getItem(OWNER_REG_KEY);
      const allOwners: OwnerRegistration[] = rawOwners ? JSON.parse(rawOwners) : [];
      const hpExist = allOwners.find((o) => o.phone.replace(/\D/g,"") === ownerPhone.replace(/\D/g,""));
      if (hpExist) {
        Alert.alert("Nomor HP Sudah Ada", "Sudah terdaftar a.n. " + hpExist.name + " (" + hpExist.tokoName + ").");
        setSavingOwner(false); return;
      }
      const newOwner: OwnerRegistration = {
        id: genId("owner"), name: ownerNama.trim(), tokoName: ownerTokoName.trim(),
        phone: ownerPhone.trim(), paket: ownerPaket,
        recruitedBy: subMarketingId, recruitedByRole: "sub_marketing",
        kodeToken: ownerToken, createdAt: new Date().toISOString(),
      };
      await AsyncStorage.setItem(OWNER_REG_KEY, JSON.stringify([newOwner, ...allOwners]));
      await loadData();
      setShowDaftarOwner(false);
      resetFormOwner();
      Alert.alert(
        "✅ Owner Berhasil Didaftarkan!",
        "Toko: " + newOwner.tokoName + "\nOwner: " + newOwner.name +
        "\nPaket: " + newOwner.paket.toUpperCase() +
        "\nKode Token: " + newOwner.kodeToken +
        "\n\nBagikan kode token ini ke owner untuk aktivasi.",
        [{ text:"Oke" }],
      );
    } catch {
      Alert.alert("Error", "Gagal mendaftarkan owner.");
    } finally {
      setSavingOwner(false);
    }
  }

  // ── Simpan rekening ────────────────────────────────────────────────────

  async function handleSaveBank(): Promise<void> {
    if (!bankInput.namaBank.trim() || !bankInput.nomorRekening.trim() || !bankInput.namaPemilik.trim()) {
      Alert.alert("Lengkapi Data", "Semua field harus diisi."); return;
    }
    try {
      await AsyncStorage.setItem(SMK_BANK_PFX + subMarketingId, JSON.stringify(bankInput));
      setBankAccount({ ...bankInput });
      setShowBankModal(false);
      Alert.alert("Berhasil ✅", "Rekening tersimpan.");
    } catch { Alert.alert("Error", "Gagal menyimpan."); }
  }

  // ── Pencairan ─────────────────────────────────────────────────────────

  async function handleRequestWithdraw(): Promise<void> {
    if (!bankAccount) { Alert.alert("Belum Ada Rekening", "Tambahkan rekening bank dulu."); setShowBankModal(true); return; }
    const jumlah = Number(wdJumlah.replace(/\D/g,""));
    if (!jumlah || jumlah < MIN_WD) { Alert.alert("Jumlah Kurang","Minimum " + formatRp(MIN_WD)); return; }
    if (jumlah > saldoBisa)         { Alert.alert("Saldo Tidak Cukup","Saldo tersedia: " + formatRp(saldoBisa)); return; }
    Alert.alert(
      "Konfirmasi Pencairan",
      formatRp(jumlah) + " → " + bankAccount.namaBank + " " + bankAccount.nomorRekening +
      "\na.n. " + bankAccount.namaPemilik + "\n\nDiproses 1×24 jam kerja.",
      [
        { text:"Batal", style:"cancel" },
        { text:"Cairkan", onPress: async () => {
          try {
            const wd: WithdrawalRequest = {
              id: genId("swd"), subMarketingId, jumlah,
              namaBank: bankAccount.namaBank, nomorRekening: bankAccount.nomorRekening,
              namaPemilik: bankAccount.namaPemilik, status:"menunggu",
              createdAt: new Date().toISOString(),
            };
            const rawWd  = await AsyncStorage.getItem(SMK_WD_PFX + subMarketingId);
            const allWd: WithdrawalRequest[] = rawWd ? JSON.parse(rawWd) : [];
            await AsyncStorage.setItem(SMK_WD_PFX + subMarketingId, JSON.stringify([wd, ...allWd]));
            setShowWdModal(false); setWdJumlah("");
            await loadData();
            Alert.alert("Berhasil ✅","Pencairan " + formatRp(jumlah) + " sedang diproses.");
          } catch { Alert.alert("Error","Gagal mengajukan pencairan."); }
        }},
      ],
    );
  }

  // ── Loading ────────────────────────────────────────────────────────────

  if (loading) return <View style={SM.center}><ActivityIndicator size="large" color="#0891b2" /></View>;

  if (!subMarketingId) {
    return (
      <View style={SM.center}>
        <Text style={SM.emptyTxt}>{"⚠️ Data sub-marketing tidak ditemukan."}</Text>
        {props.onBack && (
          <TouchableOpacity style={SM.backBtn} onPress={props.onBack}>
            <Text style={SM.backBtnTxt}>{"← Kembali"}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  if (showDemoScreen && demoJenis) {
    return (
      <DemoOwnerDashboard
        jenisBisnis={demoJenis}
        onClose={() => { setShowDemoScreen(false); setDemoJenis(""); }}
      />
    );
  }

  return (
    <View style={SM.container}>

      {/* Header */}
      <View style={SM.header}>
        <View style={SM.headerTop}>
          {props.onBack && (
            <TouchableOpacity onPress={props.onBack}>
              <Text style={SM.backTxt}>{"< Kembali"}</Text>
            </TouchableOpacity>
          )}
          <View style={SM.headerCenter}>
            <Text style={SM.headerTitle}>{"📣 Sub-Marketing"}</Text>
            <Text style={SM.headerName}>{subMarketingName}</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <TouchableOpacity
              style={{ backgroundColor: "#10B981", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16 }}
              onPress={() => setShowDaftarOwner(true)}
            >
              <Text style={{ color: "#fff", fontWeight: "800", fontSize: 11 }}>{"+ Owner"}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={SM.logoutBtn} onPress={handleLogout}>
              <Text style={SM.logoutBtnTxt}>{"⏏ Keluar"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Saldo Strip */}
      <View style={SM.saldoStrip}>
        <View style={SM.saldoStripItem}>
          <Text style={SM.saldoStripLbl}>{"Bisa Dicairkan"}</Text>
          <Text style={SM.saldoStripVal}>{formatRpShort(saldoBisa)}</Text>
        </View>
        <View style={SM.saldoStripDivider} />
        <View style={SM.saldoStripItem}>
          <Text style={SM.saldoStripLbl}>{"Total Komisi"}</Text>
          <Text style={SM.saldoStripVal}>{formatRpShort(totalEarned)}</Text>
        </View>
        <View style={SM.saldoStripDivider} />
        <View style={SM.saldoStripItem}>
          <Text style={SM.saldoStripLbl}>{"Owner"}</Text>
          <Text style={SM.saldoStripVal}>{String(myOwners.length)}</Text>
        </View>
        <View style={SM.saldoStripDivider} />
        <View style={SM.saldoStripItem}>
          <Text style={SM.saldoStripLbl}>{"Kurir"}</Text>
          <Text style={SM.saldoStripVal}>{String(myKurir.length)}</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={SM.tabRow}>
        {(["ringkasan","owner","komisi","pencairan"] as const).map((t) => (
          <TouchableOpacity
            key={t}
            style={activeTab === t ? SM.tabActive : SM.tabInactive}
            onPress={() => setActiveTab(t)}
          >
            <Text style={activeTab === t ? SM.tabTxtActive : SM.tabTxtInactive}>
              {t === "ringkasan" ? "📊" : t === "owner" ? "👥" : t === "komisi" ? "💰" : "💸"}
            </Text>
            <Text style={activeTab === t ? SM.tabLblActive : SM.tabLblInactive}>
              {t === "ringkasan" ? "Ringkasan" : t === "owner" ? "Owner" : t === "komisi" ? "Komisi" : "Cairkan"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Tab: Ringkasan ── */}
      {activeTab === "ringkasan" && (
        <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />} contentContainerStyle={SM.scrollContent}>
          {/* ── Tombol Utama: Daftarkan Owner Toko Baru ── */}
          <TouchableOpacity
            style={{
              backgroundColor: "#10B981",
              borderRadius: 16,
              padding: 16,
              marginBottom: 16,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              elevation: 3,
              borderWidth: 1.5,
              borderColor: "#34D399",
            }}
            onPress={() => setShowDaftarOwner(true)}
            activeOpacity={0.85}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "#D1FAE5", justifyContent: "center", alignItems: "center" }}>
                <Text style={{ fontSize: 24 }}>{"🏪"}</Text>
              </View>
              <View>
                <Text style={{ fontSize: 16, fontWeight: "900", color: "#fff" }}>
                  {"+ Daftarkan Owner Toko Baru"}
                </Text>
                <Text style={{ fontSize: 12, color: "#D1FAE5", marginTop: 2 }}>
                  {"Komisi Langganan 70%! Trial Gratis 3 Hari"}
                </Text>
              </View>
            </View>
            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.2)", justifyContent: "center", alignItems: "center" }}>
              <Text style={{ fontSize: 18, fontWeight: "900", color: "#fff" }}>{"+"}</Text>
            </View>
          </TouchableOpacity>

          <View style={SM.statsGrid}>
            <View style={SM.statCard}><Text style={SM.statVal}>{formatRpShort(todayComm)}</Text><Text style={SM.statLbl}>{"Komisi Ongkir Hari Ini"}</Text></View>
            <View style={SM.statCard}><Text style={SM.statVal}>{formatRpShort(monthComm)}</Text><Text style={SM.statLbl}>{"Komisi Ongkir Bulan Ini"}</Text></View>
            <View style={SM.statCard}><Text style={SM.statVal}>{String(todayOrders.length)}</Text><Text style={SM.statLbl}>{"Order Selesai Hari Ini"}</Text></View>
            <View style={SM.statCard}><Text style={SM.statVal}>{String(myOrders.length)}</Text><Text style={SM.statLbl}>{"Total Order Selesai"}</Text></View>
          </View>
          <View style={SM.komisiSummaryCard}>
            <Text style={SM.komisiSummaryTitle}>{"💰 Ringkasan Komisi"}</Text>
            <View style={SM.komisiSummaryRow}>
              <View style={SM.komisiSummaryLeft}>
                <Text style={SM.komisiSummaryLbl}>{"Ongkir (1% per order)"}</Text>
                <Text style={SM.komisiSummaryDesc}>{String(myOrders.length) + " order selesai"}</Text>
              </View>
              <Text style={SM.komisiSummaryVal}>{formatRpShort(komisiOngkir)}</Text>
            </View>
            <View style={SM.komisiSummaryRow}>
              <View style={SM.komisiSummaryLeft}>
                <Text style={SM.komisiSummaryLbl}>{"Langganan Owner (14%/bln)"}</Text>
                <Text style={SM.komisiSummaryDesc}>{String(myOwners.length) + " owner rekrutan"}</Text>
              </View>
              <Text style={SM.komisiSummaryVal}>{formatRpShort(komisiLangganan)}</Text>
            </View>
            <View style={SM.komisiSummaryRow}>
              <View style={SM.komisiSummaryLeft}>
                <Text style={SM.komisiSummaryLbl}>{"Produk Global (Rp100/produk)"}</Text>
                <Text style={produkUnlocked ? SM.komisiSummaryDesc : SM.komisiSummaryDescLocked}>
                  {produkUnlocked ? String(myProducts.length) + " produk" : "🔒 Butuh " + MIN_OWNER_UNLOCK_PRODUK + " owner · saat ini " + myOwners.length}
                </Text>
              </View>
              <Text style={produkUnlocked ? SM.komisiSummaryVal : SM.komisiSummaryValLocked}>
                {produkUnlocked ? formatRpShort(komisiProduk) : "Terkunci"}
              </Text>
            </View>
            <View style={SM.komisiSummaryTotal}>
              <Text style={SM.komisiSummaryTotalLbl}>{"TOTAL"}</Text>
              <Text style={SM.komisiSummaryTotalVal}>{formatRp(totalEarned)}</Text>
            </View>
          </View>
          <TouchableOpacity style={SM.demoBtn} onPress={() => setShowDemoSelector(true)}>
            <Text style={SM.demoBtnIcon}>{"🎬"}</Text>
            <View style={SM.demoBtnTextCol}>
              <Text style={SM.demoBtnTitle}>{"Demo Dashboard Owner"}</Text>
              <Text style={SM.demoBtnSub}>{"Tunjukkan ke calon owner sesuai jenis bisnisnya"}</Text>
            </View>
            <Text style={SM.demoBtnArrow}>{"›"}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={SM.cairCardBtn} onPress={() => setActiveTab("pencairan")} activeOpacity={0.85}>
            <Text style={SM.cairCardLbl}>{"Saldo Bisa Dicairkan"}</Text>
            <Text style={SM.cairCardVal}>{formatRp(saldoBisa)}</Text>
            {pendingWd > 0 && <Text style={SM.cairCardPending}>{"⏳ Pending: " + formatRpShort(pendingWd)}</Text>}
            <Text style={SM.cairCardSub}>{"Tap untuk cairkan →"}</Text>
          </TouchableOpacity>
          <View style={SM.bottomSpacer} />
        </ScrollView>
      )}

      {/* ── Tab: Owner ── */}
      {activeTab === "owner" && (
        <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />} contentContainerStyle={SM.scrollContent}>
          <TouchableOpacity style={SM.daftarOwnerBtn} onPress={() => { resetFormOwner(); setShowDaftarOwner(true); }}>
            <Text style={SM.daftarOwnerBtnIcon}>{"➕"}</Text>
            <View style={SM.daftarOwnerBtnTextCol}>
              <Text style={SM.daftarOwnerBtnTitle}>{"Daftarkan Owner Baru"}</Text>
              <Text style={SM.daftarOwnerBtnSub}>{"Rekrut owner dan dapatkan komisi langganan"}</Text>
            </View>
            <Text style={SM.daftarOwnerBtnArrow}>{"›"}</Text>
          </TouchableOpacity>
          <View style={produkUnlocked ? SM.progressCardDone : SM.progressCard}>
            <Text style={SM.progressTitle}>{produkUnlocked ? "✅ Komisi Produk AKTIF" : "🔒 Progress Unlock Komisi Produk"}</Text>
            <View style={SM.progressBarBg}>
              <View style={[SM.progressBarFill, { width: ((Math.min(myOwners.length, MIN_OWNER_UNLOCK_PRODUK) / MIN_OWNER_UNLOCK_PRODUK * 100) + "%") as any }]} />
            </View>
            <Text style={SM.progressTxt}>
              {produkUnlocked
                ? "Kamu punya " + myOwners.length + " owner. Komisi produk Rp100/item aktif!"
                : String(myOwners.length) + " / " + MIN_OWNER_UNLOCK_PRODUK + " · Tambah " + (MIN_OWNER_UNLOCK_PRODUK - myOwners.length) + " lagi"}
            </Text>
          </View>
          <Text style={SM.sectionTitle}>{"👥 Owner Rekrutan (" + myOwners.length + ")"}</Text>
          {myOwners.length === 0 ? (
            <View style={SM.emptyBox}>
              <Text style={SM.emptyIcon}>{"👥"}</Text>
              <Text style={SM.emptyTxt}>{"Belum ada owner rekrutan."}</Text>
              <Text style={SM.emptySubTxt}>{"Tap tombol di atas untuk mendaftarkan owner pertama."}</Text>
              <TouchableOpacity style={SM.emptyDaftarBtn} onPress={() => { resetFormOwner(); setShowDaftarOwner(true); }}>
                <Text style={SM.emptyDaftarBtnTxt}>{"+ Daftarkan Owner Sekarang"}</Text>
              </TouchableOpacity>
            </View>
          ) : myOwners.map((o) => {
            const komisiOwner = Math.round((PAKET_HARGA[o.paket] ?? 50_000) * KOMISI_LANGGANAN_RATE);
            const paketColor  = o.paket === "enterprise" ? "#7C3AED" : o.paket === "pro" ? "#2563EB" : "#64748B";
            return (
              <View key={o.id} style={SM.ownerCard}>
                <View style={SM.ownerAvatarCircle}><Text style={SM.ownerAvatarTxt}>{o.tokoName.charAt(0).toUpperCase()}</Text></View>
                <View style={SM.ownerInfo}>
                  <Text style={SM.ownerName}>{o.tokoName}</Text>
                  <Text style={SM.ownerPhone}>{o.name + "  ·  " + o.phone}</Text>
                  <Text style={SM.ownerToken}>{"Token: " + o.kodeToken}</Text>
                  <Text style={SM.ownerKomisi}>{"Komisi: " + formatRp(komisiOwner) + "/bln"}</Text>
                </View>
                <View style={[SM.paketBadge, { backgroundColor: paketColor }]}>
                  <Text style={SM.paketBadgeTxt}>{o.paket.toUpperCase()}</Text>
                </View>
              </View>
            );
          })}
          <Text style={SM.sectionTitle}>{"🚚 Kurir Rekrutan (" + myKurir.length + ")"}</Text>
          {myKurir.length === 0 ? (
            <View style={SM.emptyBox}><Text style={SM.emptyIcon}>{"🚚"}</Text><Text style={SM.emptyTxt}>{"Belum ada kurir."}</Text></View>
          ) : myKurir.map((k) => {
            const ko = myOrders.filter((o) => String(o.kurirId) === String(k.id));
            const kc = ko.reduce((s, o) => s + calcKomisiOngkir(o), 0);
            return (
              <View key={k.id} style={SM.kurirCard}>
                <View style={SM.kurirAvatarCircle}><Text style={SM.kurirAvatarTxt}>{k.name.charAt(0).toUpperCase()}</Text></View>
                <View style={SM.kurirInfo}>
                  <Text style={SM.kurirName}>{k.name}</Text>
                  {k.phone ? <Text style={SM.kurirPhone}>{"📞 " + k.phone}</Text> : null}
                  <Text style={SM.kurirStats}>{String(ko.length) + " order · " + formatRpShort(kc)}</Text>
                </View>
                <View style={SM.kurirCommBadge}><Text style={SM.kurirCommBadgeTxt}>{formatRpShort(kc)}</Text></View>
              </View>
            );
          })}
          <View style={SM.bottomSpacer} />
        </ScrollView>
      )}

      {/* ── Tab: Komisi ── */}
      {activeTab === "komisi" && (
        <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />} contentContainerStyle={SM.scrollContent}>
          <View style={SM.komisiRekapCard}>
            <Text style={SM.komisiRekapTitle}>{"📊 Rekap Total Komisi"}</Text>
            <View style={SM.komisiRekapRow}><Text style={SM.komisiRekapLbl}>{"Komisi Ongkir"}</Text><Text style={SM.komisiRekapVal}>{formatRp(komisiOngkir)}</Text></View>
            <View style={SM.komisiRekapRow}><Text style={SM.komisiRekapLbl}>{"Komisi Langganan Owner"}</Text><Text style={SM.komisiRekapVal}>{formatRp(komisiLangganan)}</Text></View>
            <View style={SM.komisiRekapRow}>
              <Text style={SM.komisiRekapLbl}>{"Komisi Produk" + (!produkUnlocked ? " 🔒" : " (" + myProducts.length + " produk)")}</Text>
              <Text style={produkUnlocked ? SM.komisiRekapVal : SM.komisiRekapValLocked}>
                {produkUnlocked ? formatRp(komisiProduk) : "Terkunci"}
              </Text>
            </View>
            <View style={SM.komisiRekapTotalRow}>
              <Text style={SM.komisiRekapTotalLbl}>{"TOTAL"}</Text>
              <Text style={SM.komisiRekapTotalVal}>{formatRp(totalEarned)}</Text>
            </View>
          </View>
          <Text style={SM.sectionTitle}>{"Detail Komisi Langganan per Owner"}</Text>
          {myOwners.length === 0
            ? <View style={SM.emptyBox}><Text style={SM.emptyTxt}>{"Belum ada owner."}</Text></View>
            : myOwners.map((o) => {
              const ko2 = Math.round((PAKET_HARGA[o.paket] ?? 50_000) * KOMISI_LANGGANAN_RATE);
              return (
                <View key={o.id} style={SM.komisiDetailCard}>
                  <View style={SM.komisiDetailTop}>
                    <Text style={SM.komisiDetailName}>{o.tokoName}</Text>
                    <Text style={SM.komisiDetailVal}>{"+" + formatRp(ko2) + "/bln"}</Text>
                  </View>
                  <Text style={SM.komisiDetailSub}>{o.paket.toUpperCase() + " · Rp" + (PAKET_HARGA[o.paket]/1000).toFixed(0) + "rb × 14%"}</Text>
                </View>
              );
            })
          }
          <Text style={SM.sectionTitle}>{"Detail Komisi Ongkir per Order"}</Text>
          {myOrders.length === 0
            ? <View style={SM.emptyBox}><Text style={SM.emptyTxt}>{"Belum ada komisi ongkir."}</Text></View>
            : myOrders.map((order) => {
              const gross  = order.ongkirGross ?? calcOngkirGross(order.jarakKm ?? DEFAULT_JARAK_KM);
              const appFee = Math.round(gross * APP_FEE_PCT);
              const comm   = Math.round(appFee * SUBMARKETING_FEE);
              return (
                <View key={order.id} style={SM.comissionCard}>
                  <View style={SM.comissionTop}>
                    <Text style={SM.comissionId}>{"#" + order.id.slice(-6).toUpperCase()}</Text>
                    <Text style={SM.comissionVal}>{"+" + formatRp(comm)}</Text>
                  </View>
                  <Text style={SM.comissionCustomer}>{order.customerName}</Text>
                  <Text style={SM.comissionDate}>{formatDate(order.createdAt)}</Text>
                  <View style={SM.comissionBreak}>
                    <View style={SM.comissionBreakRow}><Text style={SM.comissionBreakLbl}>{"Ongkir gross"}</Text><Text style={SM.comissionBreakVal}>{formatRp(gross)}</Text></View>
                    <View style={SM.comissionBreakRow}><Text style={SM.comissionBreakLbl}>{"Biaya app (10%)"}</Text><Text style={SM.comissionBreakVal}>{formatRp(appFee)}</Text></View>
                    <View style={SM.comissionBreakRow}><Text style={SM.comissionBreakLblGreen}>{"Komisimu (10% dari fee)"}</Text><Text style={SM.comissionBreakValGreen}>{formatRp(comm)}</Text></View>
                  </View>
                </View>
              );
            })
          }
          <View style={SM.bottomSpacer} />
        </ScrollView>
      )}

      {/* ── Tab: Pencairan ── */}
      {activeTab === "pencairan" && (
        <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />} contentContainerStyle={SM.scrollContent}>
          <View style={SM.wdSaldoCard}>
            <Text style={SM.wdSaldoLbl}>{"Saldo Bisa Dicairkan"}</Text>
            <Text style={SM.wdSaldoVal}>{formatRp(saldoBisa)}</Text>
            {pendingWd > 0 && <Text style={SM.wdPendingTxt}>{"⏳ Dalam proses: " + formatRpShort(pendingWd)}</Text>}
            <Text style={SM.wdTotalTxt}>{"Total: " + formatRpShort(totalEarned) + " · Sudah cair: " + formatRpShort(totalWithdrawn)}</Text>
            <View style={SM.wdActionRow}>
              <TouchableOpacity
                style={saldoBisa >= MIN_WD && bankAccount ? SM.cairBtn : SM.cairBtnDisabled}
                onPress={() => setShowWdModal(true)}
                disabled={saldoBisa < MIN_WD || !bankAccount}
              >
                <Text style={SM.cairBtnTxt}>{!bankAccount ? "⚠️ Atur Rekening Dulu" : saldoBisa < MIN_WD ? "Saldo Belum Cukup" : "💸 Cairkan Komisi"}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={SM.rekeningBtn} onPress={() => { if (bankAccount) setBankInput({...bankAccount}); setShowBankModal(true); }}>
                <Text style={SM.rekeningBtnTxt}>{bankAccount ? "🏦 Edit" : "🏦 + Rekening"}</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={SM.wdBreakdownCard}>
            <Text style={SM.wdBreakdownTitle}>{"📊 Rincian Komisi"}</Text>
            <View style={SM.wdBreakdownRow}><Text style={SM.wdBreakdownLbl}>{"Komisi Ongkir"}</Text><Text style={SM.wdBreakdownVal}>{formatRpShort(komisiOngkir)}</Text></View>
            <View style={SM.wdBreakdownRow}><Text style={SM.wdBreakdownLbl}>{"Komisi Langganan Owner"}</Text><Text style={SM.wdBreakdownVal}>{formatRpShort(komisiLangganan)}</Text></View>
            <View style={SM.wdBreakdownRow}>
              <Text style={SM.wdBreakdownLbl}>{produkUnlocked ? "Komisi Produk" : "Komisi Produk 🔒"}</Text>
              <Text style={produkUnlocked ? SM.wdBreakdownVal : SM.wdBreakdownValLocked}>{produkUnlocked ? formatRpShort(komisiProduk) : "Terkunci"}</Text>
            </View>
          </View>
          <View style={SM.wdInfoCard}>
            <Text style={SM.wdInfoTxt}>{"• Minimum pencairan: " + formatRp(MIN_WD) + "\n• Proses transfer 1×24 jam kerja\n• Biaya transfer ditanggung sistem"}</Text>
          </View>
          {bankAccount ? (
            <View style={SM.bankPreviewCard}>
              <View style={SM.bankPreviewLeft}>
                <Text style={SM.bankPreviewTitle}>{"🏦 Rekening Tujuan"}</Text>
                <Text style={SM.bankName}>{bankAccount.namaBank}</Text>
                <Text style={SM.bankNum}>{bankAccount.nomorRekening}</Text>
                <Text style={SM.bankOwner}>{"a.n. " + bankAccount.namaPemilik}</Text>
              </View>
              <TouchableOpacity style={SM.editBtn} onPress={() => { setBankInput({...bankAccount}); setShowBankModal(true); }}>
                <Text style={SM.editBtnTxt}>{"✏️ Edit"}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={SM.noBankCard} onPress={() => { setBankInput({ namaBank:"", nomorRekening:"", namaPemilik:"" }); setShowBankModal(true); }}>
              <Text style={SM.noBankTxt}>{"🏦 + Tambahkan Rekening Bank"}</Text>
              <Text style={SM.noBankSub}>{"Diperlukan untuk mencairkan komisi"}</Text>
            </TouchableOpacity>
          )}
          <Text style={SM.sectionTitle}>{"Riwayat Pencairan"}</Text>
          {withdrawals.length === 0
            ? <View style={SM.emptyBox}><Text style={SM.emptyTxt}>{"Belum ada pencairan."}</Text></View>
            : withdrawals.map((wd) => (
              <View key={wd.id} style={SM.wdItemCard}>
                <View style={SM.wdItemLeft}>
                  <Text style={SM.wdItemId}>{"#" + wd.id.slice(-8).toUpperCase()}</Text>
                  <Text style={SM.wdItemBank}>{wd.namaBank + " · " + wd.nomorRekening}</Text>
                  <Text style={SM.wdItemOwner}>{"a.n. " + wd.namaPemilik}</Text>
                  <Text style={SM.wdItemDate}>{formatDate(wd.createdAt)}</Text>
                  {wd.catatan ? <Text style={SM.wdItemCatatan}>{wd.catatan}</Text> : null}
                </View>
                <View style={SM.wdItemRight}>
                  <Text style={SM.wdItemJumlah}>{formatRp(wd.jumlah)}</Text>
                  <View style={[SM.wdStatusBadge, { backgroundColor: (WD_STATUS_COLORS[wd.status] ?? "#6b7280") + "22" }]}>
                    <Text style={[SM.wdStatusTxt, { color: WD_STATUS_COLORS[wd.status] ?? "#6b7280" }]}>
                      {WD_STATUS_LABELS[wd.status] ?? wd.status}
                    </Text>
                  </View>
                </View>
              </View>
            ))
          }
          <View style={SM.bottomSpacer} />
        </ScrollView>
      )}

      {/* ── Modal: Daftarkan Owner ── */}
      <Modal visible={showDaftarOwner} transparent animationType="slide" onRequestClose={() => setShowDaftarOwner(false)}>
        <View style={SM.overlay}>
          <View style={SM.sheetTall}>
            <View style={SM.sheetHeader}>
              <Text style={SM.sheetTitle}>{"👤 Daftarkan Owner Baru"}</Text>
              <TouchableOpacity onPress={() => setShowDaftarOwner(false)}><Text style={SM.sheetClose}>{"✕"}</Text></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={SM.fieldLbl}>{"Nama Owner *"}</Text>
              <TextInput style={SM.fieldInput} value={ownerNama} onChangeText={setOwnerNama} placeholder="Nama lengkap owner" placeholderTextColor="#94a3b8" autoCapitalize="words" />
              <Text style={SM.fieldLbl}>{"Nama Toko *"}</Text>
              <TextInput style={SM.fieldInput} value={ownerTokoName} onChangeText={setOwnerTokoName} placeholder="Nama toko / usaha" placeholderTextColor="#94a3b8" autoCapitalize="words" />
              <Text style={SM.fieldLbl}>{"Nomor HP *"}</Text>
              <TextInput style={SM.fieldInput} value={ownerPhone} onChangeText={setOwnerPhone} placeholder="08xxxxxxxxxx" placeholderTextColor="#94a3b8" keyboardType="phone-pad" />
              <Text style={SM.fieldLbl}>{"Pilih Paket Langganan"}</Text>
              {PAKET_LIST.map((p) => {
                const isActive     = ownerPaket === p.value;
                const komisiPaket  = Math.round(PAKET_HARGA[p.value] * KOMISI_LANGGANAN_RATE);
                return (
                  <TouchableOpacity key={p.value} style={isActive ? [SM.paketPilihCard, SM.paketPilihCardActive] : SM.paketPilihCard} onPress={() => setOwnerPaket(p.value)}>
                    <View style={SM.paketPilihLeft}>
                      <View style={[SM.paketPilihBadge, { backgroundColor: p.color }]}>
                        <Text style={SM.paketPilihBadgeTxt}>{p.label.toUpperCase()}</Text>
                      </View>
                      <View style={SM.paketPilihInfo}>
                        <Text style={SM.paketPilihHarga}>{p.harga}</Text>
                        <Text style={SM.paketPilihDesc}>{p.desc}</Text>
                      </View>
                    </View>
                    <View style={SM.paketPilihRight}>
                      <Text style={SM.paketPilihKomisiLbl}>{"Komisimu"}</Text>
                      <Text style={[SM.paketPilihKomisiVal, { color: p.color }]}>{formatRpShort(komisiPaket)}</Text>
                      {isActive && <Text style={SM.paketPilihCheck}>{"✓"}</Text>}
                    </View>
                  </TouchableOpacity>
                );
              })}
              <Text style={SM.fieldLbl}>{"Kode Token Aktivasi"}</Text>
              <View style={SM.tokenRow}>
                <View style={SM.tokenBox}><Text style={SM.tokenTxt}>{ownerToken}</Text></View>
                <TouchableOpacity style={SM.refreshTokenBtn} onPress={() => setOwnerToken(genToken())}>
                  <Text style={SM.refreshTokenBtnTxt}>{"🔄 Baru"}</Text>
                </TouchableOpacity>
              </View>
              <Text style={SM.tokenHint}>{"Berikan kode ini ke owner untuk aktivasi akun."}</Text>
              <View style={SM.daftarInfoCard}>
                <Text style={SM.daftarInfoTitle}>{"💰 Estimasi Komisi Bulanmu"}</Text>
                <View style={SM.daftarInfoRow}>
                  <Text style={SM.daftarInfoLbl}>{"Komisi langganan " + ownerPaket}</Text>
                  <Text style={SM.daftarInfoVal}>{formatRp(Math.round(PAKET_HARGA[ownerPaket] * KOMISI_LANGGANAN_RATE)) + "/bln"}</Text>
                </View>
                <Text style={SM.daftarInfoDesc}>{"= 14% × Rp" + (PAKET_HARGA[ownerPaket] / 1000).toFixed(0) + "rb/bln"}</Text>
              </View>
              <View style={SM.bottomSpacer} />
            </ScrollView>
            <TouchableOpacity style={savingOwner ? SM.saveBtnDisabled : SM.saveBtn} onPress={handleDaftarOwner} disabled={savingOwner}>
              {savingOwner ? <ActivityIndicator color="#fff" /> : <Text style={SM.saveBtnTxt}>{"✅ Daftarkan Owner"}</Text>}
            </TouchableOpacity>
            <View style={SM.sheetBottomSafe} />
          </View>
        </View>
      </Modal>

      {/* ── Modal: Demo Selector ── */}
      <Modal visible={showDemoSelector} transparent animationType="slide" onRequestClose={() => setShowDemoSelector(false)}>
        <View style={SM.overlay}>
          <View style={SM.sheet}>
            <View style={SM.sheetHeader}>
              <Text style={SM.sheetTitle}>{"🎬 Demo Dashboard Owner"}</Text>
              <TouchableOpacity onPress={() => setShowDemoSelector(false)}><Text style={SM.sheetClose}>{"✕"}</Text></TouchableOpacity>
            </View>
            <Text style={SM.sheetSubtitle}>{"Pilih jenis usaha calon owner:"}</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {JENIS_BISNIS_LIST.map((jenis) => (
                <TouchableOpacity key={jenis} style={demoJenis === jenis ? SM.bisnisBtnActive : SM.bisnisBtn} onPress={() => setDemoJenis(jenis)}>
                  <Text style={demoJenis === jenis ? SM.bisnisBtnTxtActive : SM.bisnisBtnTxt}>{jenis}</Text>
                  {demoJenis === jenis && <Text style={SM.bisnisCheck}>{"✓"}</Text>}
                </TouchableOpacity>
              ))}
              <View style={SM.bottomSpacer} />
            </ScrollView>
            <TouchableOpacity style={demoJenis ? SM.saveBtn : SM.saveBtnDisabled} disabled={!demoJenis} onPress={() => { setShowDemoSelector(false); setShowDemoScreen(true); }}>
              <Text style={SM.saveBtnTxt}>{"👀 Lihat Demo Dashboard"}</Text>
            </TouchableOpacity>
            <View style={SM.sheetBottomSafe} />
          </View>
        </View>
      </Modal>

      {/* ── Modal: Rekening Bank ── */}
      <Modal visible={showBankModal} transparent animationType="slide" onRequestClose={() => setShowBankModal(false)}>
        <View style={SM.overlay}>
          <View style={SM.sheet}>
            <View style={SM.sheetHeader}>
              <Text style={SM.sheetTitle}>{"🏦 Rekening Bank"}</Text>
              <TouchableOpacity onPress={() => setShowBankModal(false)}><Text style={SM.sheetClose}>{"✕"}</Text></TouchableOpacity>
            </View>
            <Text style={SM.fieldLbl}>{"Nama Bank"}</Text>
            <TextInput style={SM.fieldInput} value={bankInput.namaBank} onChangeText={(v) => setBankInput((p) => ({...p, namaBank:v}))} placeholder="BCA, BRI, BNI, Mandiri, dll" placeholderTextColor="#94a3b8" autoCapitalize="characters" />
            <Text style={SM.fieldLbl}>{"Nomor Rekening"}</Text>
            <TextInput style={SM.fieldInput} value={bankInput.nomorRekening} onChangeText={(v) => setBankInput((p) => ({...p, nomorRekening:v}))} placeholder="1234567890" placeholderTextColor="#94a3b8" keyboardType="numeric" />
            <Text style={SM.fieldLbl}>{"Nama Pemilik Rekening"}</Text>
            <TextInput style={SM.fieldInput} value={bankInput.namaPemilik} onChangeText={(v) => setBankInput((p) => ({...p, namaPemilik:v}))} placeholder="Sesuai buku tabungan" placeholderTextColor="#94a3b8" autoCapitalize="words" />
            <View style={SM.warningBox}><Text style={SM.warningTxt}>{"⚠️ Pastikan data rekening benar."}</Text></View>
            <TouchableOpacity style={SM.saveBtn} onPress={handleSaveBank}><Text style={SM.saveBtnTxt}>{"💾 Simpan Rekening"}</Text></TouchableOpacity>
            <View style={SM.sheetBottomSafe} />
          </View>
        </View>
      </Modal>

      {/* ── Modal: Pencairan ── */}
      <Modal visible={showWdModal} transparent animationType="slide" onRequestClose={() => setShowWdModal(false)}>
        <View style={SM.overlay}>
          <View style={SM.sheet}>
            <View style={SM.sheetHeader}>
              <Text style={SM.sheetTitle}>{"💸 Cairkan Komisi"}</Text>
              <TouchableOpacity onPress={() => setShowWdModal(false)}><Text style={SM.sheetClose}>{"✕"}</Text></TouchableOpacity>
            </View>
            <View style={SM.wdMiniSaldo}>
              <Text style={SM.wdMiniSaldoLbl}>{"Saldo Tersedia"}</Text>
              <Text style={SM.wdMiniSaldoVal}>{formatRp(saldoBisa)}</Text>
            </View>
            {bankAccount && (
              <View style={SM.wdBankPreview}>
                <Text style={SM.wdBankPreviewTxt}>{"🏦 " + bankAccount.namaBank + " · " + bankAccount.nomorRekening}</Text>
                <Text style={SM.wdBankPreviewOwner}>{"a.n. " + bankAccount.namaPemilik}</Text>
              </View>
            )}
            <Text style={SM.fieldLbl}>{"Jumlah Pencairan (min. " + formatRp(MIN_WD) + ")"}</Text>
            <TextInput style={SM.fieldInput} value={wdJumlah} onChangeText={setWdJumlah} placeholder={formatRp(MIN_WD)} placeholderTextColor="#94a3b8" keyboardType="numeric" />
            <View style={SM.shortcutRow}>
              {[50000,100000,250000,500000].filter((v) => v <= saldoBisa).map((v) => (
                <TouchableOpacity key={v} style={SM.shortcutBtn} onPress={() => setWdJumlah(String(v))}>
                  <Text style={SM.shortcutTxt}>{formatRpShort(v)}</Text>
                </TouchableOpacity>
              ))}
              {saldoBisa >= MIN_WD && (
                <TouchableOpacity style={[SM.shortcutBtn, SM.shortcutBtnAll]} onPress={() => setWdJumlah(String(Math.floor(saldoBisa)))}>
                  <Text style={SM.shortcutTxt}>{"Semua"}</Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={SM.warningBox}><Text style={SM.warningTxt}>{"⏰ Proses transfer 1×24 jam kerja."}</Text></View>
            <TouchableOpacity style={SM.saveBtn} onPress={handleRequestWithdraw}><Text style={SM.saveBtnTxt}>{"💸 Ajukan Pencairan"}</Text></TouchableOpacity>
            <View style={SM.sheetBottomSafe} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── StyleSheet SM ────────────────────────────────────────────────────────────

const SM = StyleSheet.create({
  container:     { flex:1, backgroundColor:"#f8fafc" },
  center:        { flex:1, justifyContent:"center", alignItems:"center", padding:24 },
  scrollContent: { padding:12, paddingBottom:40 },
  bottomSpacer:  { height:40 },
  header:            { backgroundColor:"#0891b2", paddingTop:52, paddingBottom:16, paddingHorizontal:20 },
  headerTop:         { flexDirection:"row", alignItems:"center", justifyContent:"space-between" },
  backTxt:           { color:"rgba(255,255,255,0.85)", fontSize:13 },
  headerCenter:      { alignItems:"center", flex:1 },
  headerTitle:       { fontSize:15, fontWeight:"700", color:"#fff" },
  headerName:        { fontSize:12, color:"rgba(255,255,255,0.75)", marginTop:2 },
  logoutBtn:         { backgroundColor:"rgba(255,255,255,0.18)", borderRadius:8, paddingHorizontal:10, paddingVertical:6, borderWidth:1, borderColor:"rgba(255,255,255,0.3)" },
  logoutBtnTxt:      { color:"#fff", fontSize:12, fontWeight:"700" },
  saldoStrip:        { flexDirection:"row", backgroundColor:"#0e7490", paddingVertical:12, paddingHorizontal:8, justifyContent:"space-around", alignItems:"center" },
  saldoStripItem:    { alignItems:"center" },
  saldoStripLbl:     { fontSize:9, color:"rgba(255,255,255,0.7)", marginBottom:2 },
  saldoStripVal:     { fontSize:13, fontWeight:"700", color:"#fff" },
  saldoStripDivider: { width:1, height:28, backgroundColor:"rgba(255,255,255,0.2)" },
  tabRow:        { flexDirection:"row", backgroundColor:"#e2e8f0", margin:12, borderRadius:10, padding:3 },
  tabActive:     { flex:1, backgroundColor:"#0891b2", borderRadius:8, paddingVertical:8, alignItems:"center" },
  tabInactive:   { flex:1, paddingVertical:8, alignItems:"center" },
  tabTxtActive:  { color:"#fff", fontSize:16 },
  tabTxtInactive:{ color:"#64748b", fontSize:16 },
  tabLblActive:  { color:"#fff", fontSize:9, fontWeight:"600", marginTop:2 },
  tabLblInactive:{ color:"#64748b", fontSize:9, marginTop:2 },
  statsGrid:     { flexDirection:"row", flexWrap:"wrap", gap:8, marginBottom:12 },
  statCard:      { backgroundColor:"#fff", borderRadius:12, padding:14, width:"47%", elevation:2 },
  statVal:       { fontSize:15, fontWeight:"700", color:"#1e293b" },
  statLbl:       { fontSize:11, color:"#64748b", marginTop:4 },
  komisiSummaryCard:        { backgroundColor:"#fff", borderRadius:14, padding:16, marginBottom:12, elevation:2 },
  komisiSummaryTitle:       { fontSize:14, fontWeight:"700", color:"#1e293b", marginBottom:12 },
  komisiSummaryRow:         { flexDirection:"row", justifyContent:"space-between", alignItems:"flex-start", paddingVertical:8, borderBottomWidth:1, borderBottomColor:"#f1f5f9" },
  komisiSummaryLeft:        { flex:1, paddingRight:8 },
  komisiSummaryLbl:         { fontSize:13, fontWeight:"600", color:"#1e293b" },
  komisiSummaryDesc:        { fontSize:11, color:"#64748b", marginTop:2 },
  komisiSummaryDescLocked:  { fontSize:11, color:"#f59e0b", marginTop:2 },
  komisiSummaryVal:         { fontSize:14, fontWeight:"700", color:"#10b981" },
  komisiSummaryValLocked:   { fontSize:13, fontWeight:"600", color:"#94a3b8" },
  komisiSummaryTotal:       { flexDirection:"row", justifyContent:"space-between", marginTop:8, paddingTop:10, borderTopWidth:2, borderTopColor:"#e2e8f0" },
  komisiSummaryTotalLbl:    { fontSize:14, fontWeight:"800", color:"#1e293b" },
  komisiSummaryTotalVal:    { fontSize:18, fontWeight:"800", color:"#0891b2" },
  demoBtn:        { backgroundColor:"#fff", borderRadius:14, padding:16, marginBottom:12, flexDirection:"row", alignItems:"center", borderWidth:2, borderColor:"#0891b2", elevation:2 },
  demoBtnIcon:    { fontSize:28, marginRight:12 },
  demoBtnTextCol: { flex:1 },
  demoBtnTitle:   { fontSize:14, fontWeight:"800", color:"#0891b2" },
  demoBtnSub:     { fontSize:11, color:"#64748b", marginTop:2 },
  demoBtnArrow:   { fontSize:24, color:"#0891b2", fontWeight:"700" },
  cairCardBtn:    { backgroundColor:"#0891b2", borderRadius:14, padding:18, alignItems:"center", elevation:4, marginBottom:16 },
  cairCardLbl:    { fontSize:12, color:"rgba(255,255,255,0.8)", marginBottom:4 },
  cairCardVal:    { fontSize:28, fontWeight:"800", color:"#fff" },
  cairCardPending:{ fontSize:11, color:"#fde68a", marginTop:4 },
  cairCardSub:    { fontSize:11, color:"rgba(255,255,255,0.7)", marginTop:6 },
  daftarOwnerBtn:        { backgroundColor:"#0891b2", borderRadius:14, padding:16, marginBottom:12, flexDirection:"row", alignItems:"center", elevation:3 },
  daftarOwnerBtnIcon:    { fontSize:24, marginRight:12 },
  daftarOwnerBtnTextCol: { flex:1 },
  daftarOwnerBtnTitle:   { fontSize:15, fontWeight:"800", color:"#fff" },
  daftarOwnerBtnSub:     { fontSize:11, color:"rgba(255,255,255,0.75)", marginTop:2 },
  daftarOwnerBtnArrow:   { fontSize:24, color:"#fff", fontWeight:"700" },
  emptyDaftarBtn:    { marginTop:16, backgroundColor:"#0891b2", borderRadius:10, paddingHorizontal:20, paddingVertical:10 },
  emptyDaftarBtnTxt: { color:"#fff", fontWeight:"700", fontSize:13 },
  progressCard:      { backgroundColor:"#fff7ed", borderRadius:12, padding:14, marginBottom:10, borderWidth:1, borderColor:"#fed7aa" },
  progressCardDone:  { backgroundColor:"#f0fdf4", borderRadius:12, padding:14, marginBottom:10, borderWidth:1, borderColor:"#86efac" },
  progressTitle:     { fontSize:13, fontWeight:"700", color:"#1e293b", marginBottom:8 },
  progressBarBg:     { backgroundColor:"#e2e8f0", borderRadius:6, height:8, overflow:"hidden" },
  progressBarFill:   { backgroundColor:"#0891b2", height:8, borderRadius:6 },
  progressTxt:       { fontSize:11, color:"#64748b", marginTop:6 },
  sectionTitle:      { fontSize:13, fontWeight:"700", color:"#374151", marginBottom:8, marginTop:8 },
  ownerCard:         { backgroundColor:"#fff", borderRadius:12, padding:14, marginBottom:8, flexDirection:"row", alignItems:"center", gap:12, elevation:2 },
  ownerAvatarCircle: { width:46, height:46, borderRadius:23, backgroundColor:"#cffafe", justifyContent:"center", alignItems:"center" },
  ownerAvatarTxt:    { fontSize:18, fontWeight:"700", color:"#0891b2" },
  ownerInfo:         { flex:1 },
  ownerName:         { fontSize:15, fontWeight:"600", color:"#1e293b" },
  ownerPhone:        { fontSize:12, color:"#64748b", marginTop:2 },
  ownerToken:        { fontSize:11, color:"#7c3aed", marginTop:2, fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace" },
  ownerKomisi:       { fontSize:12, color:"#10b981", marginTop:4, fontWeight:"600" },
  paketBadge:        { borderRadius:6, paddingHorizontal:8, paddingVertical:3 },
  paketBadgeTxt:     { color:"#fff", fontSize:10, fontWeight:"700" },
  kurirCard:         { backgroundColor:"#fff", borderRadius:12, padding:14, marginBottom:8, flexDirection:"row", alignItems:"center", gap:12, elevation:2 },
  kurirAvatarCircle: { width:46, height:46, borderRadius:23, backgroundColor:"#cffafe", justifyContent:"center", alignItems:"center" },
  kurirAvatarTxt:    { fontSize:18, fontWeight:"700", color:"#0891b2" },
  kurirInfo:         { flex:1 },
  kurirName:         { fontSize:15, fontWeight:"600", color:"#1e293b" },
  kurirPhone:        { fontSize:12, color:"#64748b", marginTop:2 },
  kurirStats:        { fontSize:12, color:"#0891b2", marginTop:4, fontWeight:"600" },
  kurirCommBadge:    { backgroundColor:"#cffafe", borderRadius:10, paddingHorizontal:10, paddingVertical:6 },
  kurirCommBadgeTxt: { fontSize:13, fontWeight:"700", color:"#0e7490" },
  komisiRekapCard:       { backgroundColor:"#fff", borderRadius:14, padding:16, marginBottom:12, elevation:2 },
  komisiRekapTitle:      { fontSize:14, fontWeight:"700", color:"#1e293b", marginBottom:10 },
  komisiRekapRow:        { flexDirection:"row", justifyContent:"space-between", paddingVertical:7, borderBottomWidth:1, borderBottomColor:"#f8fafc" },
  komisiRekapLbl:        { fontSize:13, color:"#475569", flex:1 },
  komisiRekapVal:        { fontSize:13, fontWeight:"700", color:"#10b981" },
  komisiRekapValLocked:  { fontSize:13, fontWeight:"600", color:"#94a3b8" },
  komisiRekapTotalRow:   { flexDirection:"row", justifyContent:"space-between", marginTop:8, paddingTop:8, borderTopWidth:2, borderTopColor:"#e2e8f0" },
  komisiRekapTotalLbl:   { fontSize:14, fontWeight:"800", color:"#1e293b" },
  komisiRekapTotalVal:   { fontSize:18, fontWeight:"800", color:"#0891b2" },
  komisiDetailCard:      { backgroundColor:"#fff", borderRadius:10, padding:14, marginBottom:8, elevation:1 },
  komisiDetailTop:       { flexDirection:"row", justifyContent:"space-between" },
  komisiDetailName:      { fontSize:14, fontWeight:"600", color:"#1e293b" },
  komisiDetailVal:       { fontSize:14, fontWeight:"700", color:"#10b981" },
  komisiDetailSub:       { fontSize:11, color:"#64748b", marginTop:4 },
  comissionCard:          { backgroundColor:"#fff", borderRadius:12, padding:14, marginBottom:8, elevation:2 },
  comissionTop:           { flexDirection:"row", justifyContent:"space-between", marginBottom:4 },
  comissionId:            { fontSize:12, fontWeight:"700", color:"#64748b" },
  comissionVal:           { fontSize:16, fontWeight:"800", color:"#0891b2" },
  comissionCustomer:      { fontSize:14, fontWeight:"600", color:"#1e293b" },
  comissionDate:          { fontSize:11, color:"#94a3b8", marginBottom:8 },
  comissionBreak:         { backgroundColor:"#ecfeff", borderRadius:8, padding:10 },
  comissionBreakRow:      { flexDirection:"row", justifyContent:"space-between", paddingVertical:2 },
  comissionBreakLbl:      { fontSize:11, color:"#64748b" },
  comissionBreakVal:      { fontSize:11, color:"#1e293b", fontWeight:"600" },
  comissionBreakLblGreen: { fontSize:11, color:"#0891b2", fontWeight:"700" },
  comissionBreakValGreen: { fontSize:11, color:"#0891b2", fontWeight:"800" },
  wdSaldoCard:     { backgroundColor:"#0891b2", borderRadius:16, padding:18, marginBottom:12, alignItems:"center" },
  wdSaldoLbl:      { fontSize:12, color:"rgba(255,255,255,0.8)", marginBottom:4 },
  wdSaldoVal:      { fontSize:30, fontWeight:"800", color:"#fff" },
  wdPendingTxt:    { fontSize:11, color:"#fde68a", marginTop:6 },
  wdTotalTxt:      { fontSize:10, color:"rgba(255,255,255,0.6)", marginTop:4 },
  wdActionRow:     { flexDirection:"row", gap:10, marginTop:14, width:"100%" },
  cairBtn:         { flex:1, backgroundColor:"#fff", borderRadius:10, paddingVertical:10, alignItems:"center" },
  cairBtnDisabled: { flex:1, backgroundColor:"rgba(255,255,255,0.3)", borderRadius:10, paddingVertical:10, alignItems:"center" },
  cairBtnTxt:      { color:"#0891b2", fontWeight:"800", fontSize:13 },
  rekeningBtn:     { backgroundColor:"rgba(255,255,255,0.2)", borderRadius:10, paddingVertical:10, paddingHorizontal:14 },
  rekeningBtnTxt:  { color:"#fff", fontWeight:"700", fontSize:12 },
  wdBreakdownCard:      { backgroundColor:"#f0fdfa", borderRadius:12, padding:14, marginBottom:10, borderWidth:1, borderColor:"#99f6e4" },
  wdBreakdownTitle:     { fontSize:13, fontWeight:"700", color:"#134e4a", marginBottom:8 },
  wdBreakdownRow:       { flexDirection:"row", justifyContent:"space-between", paddingVertical:5 },
  wdBreakdownLbl:       { fontSize:12, color:"#0f766e" },
  wdBreakdownVal:       { fontSize:12, fontWeight:"700", color:"#059669" },
  wdBreakdownValLocked: { fontSize:12, fontWeight:"600", color:"#94a3b8" },
  wdInfoCard:  { backgroundColor:"#ecfeff", borderRadius:12, padding:14, marginBottom:10, borderWidth:1, borderColor:"#a5f3fc" },
  wdInfoTxt:   { fontSize:12, color:"#0e7490", lineHeight:20 },
  bankPreviewCard:  { backgroundColor:"#ecfeff", borderRadius:12, padding:14, marginBottom:10, flexDirection:"row", alignItems:"center", borderWidth:1, borderColor:"#a5f3fc" },
  bankPreviewLeft:  { flex:1 },
  bankPreviewTitle: { fontSize:11, color:"#64748b", marginBottom:4 },
  bankName:         { fontSize:15, fontWeight:"700", color:"#1e293b" },
  bankNum:          { fontSize:13, color:"#374151", marginTop:2 },
  bankOwner:        { fontSize:12, color:"#64748b", marginTop:2 },
  editBtn:          { backgroundColor:"#cffafe", borderRadius:8, paddingHorizontal:12, paddingVertical:8 },
  editBtnTxt:       { fontSize:12, color:"#0891b2", fontWeight:"700" },
  noBankCard:  { backgroundColor:"#f8fafc", borderRadius:12, padding:20, marginBottom:10, alignItems:"center", borderWidth:2, borderStyle:"dashed", borderColor:"#a5f3fc" },
  noBankTxt:   { fontSize:14, fontWeight:"700", color:"#0891b2" },
  noBankSub:   { fontSize:12, color:"#94a3b8", marginTop:4 },
  wdItemCard:    { backgroundColor:"#fff", borderRadius:12, padding:14, marginBottom:8, flexDirection:"row", elevation:1 },
  wdItemLeft:    { flex:1 },
  wdItemId:      { fontSize:11, fontWeight:"700", color:"#475569" },
  wdItemBank:    { fontSize:13, fontWeight:"600", color:"#1e293b", marginTop:2 },
  wdItemOwner:   { fontSize:11, color:"#64748b" },
  wdItemDate:    { fontSize:10, color:"#94a3b8", marginTop:3 },
  wdItemCatatan: { fontSize:11, color:"#ef4444", marginTop:3 },
  wdItemRight:   { alignItems:"flex-end", justifyContent:"center", gap:6 },
  wdItemJumlah:  { fontSize:16, fontWeight:"800", color:"#1e293b" },
  wdStatusBadge: { borderRadius:8, paddingHorizontal:8, paddingVertical:4 },
  wdStatusTxt:   { fontSize:10, fontWeight:"700" },
  emptyBox:    { paddingVertical:50, alignItems:"center" },
  emptyIcon:   { fontSize:40, marginBottom:10 },
  emptyTxt:    { color:"#94a3b8", fontSize:15, textAlign:"center" },
  emptySubTxt: { color:"#cbd5e1", fontSize:12, marginTop:4, textAlign:"center" },
  backBtn:     { marginTop:20, backgroundColor:"#0891b2", borderRadius:10, paddingHorizontal:24, paddingVertical:12 },
  backBtnTxt:  { color:"#fff", fontWeight:"700", fontSize:14 },
  overlay:     { flex:1, backgroundColor:"rgba(0,0,0,0.5)", justifyContent:"flex-end" },
  sheet:       { backgroundColor:"#fff", borderTopLeftRadius:24, borderTopRightRadius:24, padding:24, maxHeight:"80%" },
  sheetTall:   { backgroundColor:"#fff", borderTopLeftRadius:24, borderTopRightRadius:24, padding:24, maxHeight:"92%" },
  sheetHeader: { flexDirection:"row", justifyContent:"space-between", alignItems:"center", marginBottom:8 },
  sheetTitle:  { fontSize:18, fontWeight:"700", color:"#1e293b" },
  sheetClose:  { fontSize:22, color:"#64748b", fontWeight:"700" },
  sheetSubtitle:   { fontSize:13, color:"#64748b", marginBottom:14 },
  sheetBottomSafe: { height:BOTTOM_SAFE },
  bisnisBtn:          { flexDirection:"row", alignItems:"center", justifyContent:"space-between", backgroundColor:"#F8FAFC", borderRadius:10, padding:14, marginBottom:8, borderWidth:1, borderColor:"#E2E8F0" },
  bisnisBtnActive:    { flexDirection:"row", alignItems:"center", justifyContent:"space-between", backgroundColor:"#ECFEFF", borderRadius:10, padding:14, marginBottom:8, borderWidth:1.5, borderColor:"#0891b2" },
  bisnisBtnTxt:       { fontSize:14, color:"#374151", fontWeight:"500" },
  bisnisBtnTxtActive: { fontSize:14, color:"#0891b2", fontWeight:"700" },
  bisnisCheck:        { fontSize:16, color:"#0891b2" },
  fieldLbl:    { fontSize:13, fontWeight:"600", color:"#374151", marginBottom:6, marginTop:14 },
  fieldInput:  { backgroundColor:"#f8fafc", borderRadius:10, borderWidth:1, borderColor:"#e2e8f0", paddingHorizontal:14, paddingVertical:12, fontSize:14, color:"#1e293b" },
  warningBox:  { backgroundColor:"#fff7ed", borderRadius:10, padding:12, marginTop:14, borderWidth:1, borderColor:"#fed7aa" },
  warningTxt:  { fontSize:12, color:"#92400e" },
  saveBtn:         { backgroundColor:"#0891b2", borderRadius:12, paddingVertical:14, alignItems:"center", marginTop:16 },
  saveBtnDisabled: { backgroundColor:"#94a3b8", borderRadius:12, paddingVertical:14, alignItems:"center", marginTop:16 },
  saveBtnTxt:      { color:"#fff", fontWeight:"800", fontSize:15 },
  wdMiniSaldo:         { backgroundColor:"#ecfeff", borderRadius:12, padding:14, marginBottom:12, alignItems:"center" },
  wdMiniSaldoLbl:      { fontSize:12, color:"#64748b" },
  wdMiniSaldoVal:      { fontSize:22, fontWeight:"800", color:"#0891b2" },
  wdBankPreview:       { backgroundColor:"#f8fafc", borderRadius:10, padding:10, marginBottom:6 },
  wdBankPreviewTxt:    { fontSize:13, fontWeight:"700", color:"#1e293b" },
  wdBankPreviewOwner:  { fontSize:12, color:"#64748b" },
  shortcutRow:     { flexDirection:"row", flexWrap:"wrap", gap:8, marginTop:10 },
  shortcutBtn:     { backgroundColor:"#f1f5f9", borderRadius:8, paddingHorizontal:12, paddingVertical:8 },
  shortcutBtnAll:  { backgroundColor:"#cffafe" },
  shortcutTxt:     { fontSize:12, fontWeight:"600", color:"#374151" },
  paketPilihCard:       { backgroundColor:"#f8fafc", borderRadius:12, padding:14, marginBottom:8, flexDirection:"row", alignItems:"center", justifyContent:"space-between", borderWidth:1.5, borderColor:"#e2e8f0" },
  paketPilihCardActive: { backgroundColor:"#ecfeff", borderColor:"#0891b2" },
  paketPilihLeft:       { flexDirection:"row", alignItems:"center", flex:1 },
  paketPilihBadge:      { borderRadius:6, paddingHorizontal:8, paddingVertical:4, marginRight:10 },
  paketPilihBadgeTxt:   { color:"#fff", fontSize:10, fontWeight:"800" },
  paketPilihInfo:       { flex:1 },
  paketPilihHarga:      { fontSize:13, fontWeight:"700", color:"#1e293b" },
  paketPilihDesc:       { fontSize:11, color:"#64748b", marginTop:2 },
  paketPilihRight:      { alignItems:"flex-end" },
  paketPilihKomisiLbl:  { fontSize:10, color:"#64748b" },
  paketPilihKomisiVal:  { fontSize:14, fontWeight:"800", marginTop:2 },
  paketPilihCheck:      { fontSize:16, color:"#0891b2", marginTop:4 },
  tokenRow:         { flexDirection:"row", alignItems:"center", gap:10 },
  tokenBox:         { flex:1, backgroundColor:"#f0fdf4", borderRadius:10, padding:14, borderWidth:1, borderColor:"#86efac" },
  tokenTxt:         { fontSize:18, fontWeight:"800", color:"#166534", textAlign:"center", letterSpacing:2 },
  refreshTokenBtn:  { backgroundColor:"#ecfeff", borderRadius:10, padding:12, borderWidth:1, borderColor:"#a5f3fc" },
  refreshTokenBtnTxt: { fontSize:12, fontWeight:"700", color:"#0891b2" },
  tokenHint:        { fontSize:11, color:"#94a3b8", marginTop:6, marginBottom:4 },
  daftarInfoCard:   { backgroundColor:"#f0fdfa", borderRadius:12, padding:14, marginTop:14, borderWidth:1, borderColor:"#99f6e4" },
  daftarInfoTitle:  { fontSize:13, fontWeight:"700", color:"#134e4a", marginBottom:8 },
  daftarInfoRow:    { flexDirection:"row", justifyContent:"space-between", alignItems:"center" },
  daftarInfoLbl:    { fontSize:13, color:"#0f766e" },
  daftarInfoVal:    { fontSize:16, fontWeight:"800", color:"#059669" },
  daftarInfoDesc:   { fontSize:11, color:"#64748b", marginTop:4 },
});

// ─── StyleSheet OD (Demo OwnerDashboard) ──────────────────────────────────────

const OD = StyleSheet.create({
  container:        { flex:1, backgroundColor:"#F1F5F9" },
  header:           { backgroundColor:OWNER_BLUE, paddingTop:52, paddingBottom:12, paddingHorizontal:16 },
  headerTopRow:     { flexDirection:"row", justifyContent:"space-between", alignItems:"center", marginBottom:12 },
  closeBtn:         { backgroundColor:"rgba(255,255,255,0.2)", borderRadius:8, paddingHorizontal:12, paddingVertical:6 },
  closeTxt:         { color:"#fff", fontSize:13, fontWeight:"600" },
  demoBadgePill:    { backgroundColor:"#FEF08A", borderRadius:20, paddingHorizontal:10, paddingVertical:4 },
  demoBadgePillTxt: { color:"#713F12", fontSize:11, fontWeight:"800" },
  headerInfoRow:    { flexDirection:"row", alignItems:"center", marginBottom:14 },
  headerStoreIcon:  { width:48, height:48, borderRadius:12, backgroundColor:"rgba(255,255,255,0.2)", justifyContent:"center", alignItems:"center", marginRight:12 },
  headerStoreEmoji: { fontSize:24 },
  headerTextCol:    { flex:1 },
  headerTokoName:   { fontSize:18, fontWeight:"800", color:"#fff" },
  headerOwnerName:  { fontSize:12, color:"rgba(255,255,255,0.75)", marginTop:2 },
  headerStatStrip:  { flexDirection:"row", backgroundColor:"rgba(255,255,255,0.12)", borderRadius:12, paddingVertical:10, paddingHorizontal:4 },
  headerStatItem:   { flex:1, alignItems:"center" },
  headerStatVal:    { fontSize:14, fontWeight:"800", color:"#fff" },
  headerStatLbl:    { fontSize:9, color:"rgba(255,255,255,0.7)", marginTop:2 },
  headerStatDivider:{ width:1, backgroundColor:"rgba(255,255,255,0.2)" },
  content:       { flex:1 },
  scrollContent: { padding:14, paddingBottom:16 },
  bottomSpacer:  { height:16 },
  demoBanner:    { backgroundColor:"#FEF3C7", borderRadius:10, padding:10, marginBottom:12, borderWidth:1, borderColor:"#FDE68A" },
  demoBannerTxt: { fontSize:11, color:"#92400E", fontWeight:"600", textAlign:"center" },
  statRow:        { flexDirection:"row", gap:10, marginBottom:10 },
  statCard:       { flex:1, borderRadius:14, padding:14, borderLeftWidth:4, elevation:3, backgroundColor:"#fff" },
  statCardBlue:   { borderLeftColor:OWNER_BLUE },
  statCardGreen:  { borderLeftColor:SUCCESS_GREEN },
  statCardPurple: { borderLeftColor:"#7C3AED" },
  statCardOrange: { borderLeftColor:"#EA580C" },
  statCardLbl:    { fontSize:11, color:"#64748B", marginBottom:4 },
  statCardVal:    { fontSize:20, fontWeight:"800", color:"#1E293B" },
  statCardSub:    { fontSize:11, color:"#94A3B8", marginTop:4 },
  sectionCard:       { backgroundColor:"#fff", borderRadius:14, padding:14, marginBottom:12, elevation:2 },
  sectionTitle:      { fontSize:14, fontWeight:"700", color:"#1E293B", marginBottom:10 },
  sectionTitlePlain: { fontSize:14, fontWeight:"700", color:"#1E293B", marginBottom:8 },
  chartRow: { flexDirection:"row", alignItems:"flex-end", justifyContent:"space-between", height:80 },
  barCol:   { flex:1, alignItems:"center" },
  barBg:    { width:"75%", height:"100%", backgroundColor:"#EFF6FF", borderRadius:4, overflow:"hidden", justifyContent:"flex-end" },
  barFill:  { width:"100%", backgroundColor:OWNER_BLUE, borderRadius:4 },
  barLbl:   { fontSize:8, color:"#94A3B8", marginTop:4 },
  trxRow:   { flexDirection:"row", paddingVertical:10, borderBottomWidth:1, borderBottomColor:"#F1F5F9" },
  trxLeft:  { flex:1 },
  trxNama:  { fontSize:13, fontWeight:"600", color:"#1E293B" },
  trxItems: { fontSize:11, color:"#64748B", marginTop:2 },
  trxRight: { alignItems:"flex-end", gap:4 },
  trxTotal: { fontSize:14, fontWeight:"700", color:OWNER_BLUE },
  metodeBadge: { borderRadius:6, paddingHorizontal:8, paddingVertical:3 },
  metodeTxt:   { fontSize:10, fontWeight:"700" },
  lihatSemuaBtn: { marginTop:10, alignItems:"center" },
  lihatSemuaTxt: { fontSize:12, color:OWNER_BLUE, fontWeight:"600" },
  stokKritisCard:    { backgroundColor:"#FEF2F2", borderRadius:14, padding:14, marginBottom:12, borderWidth:1, borderColor:"#FECACA" },
  stokKritisTitle:   { fontSize:13, fontWeight:"700", color:"#991B1B", marginBottom:8 },
  stokKritisRow:     { flexDirection:"row", alignItems:"center", gap:8, paddingVertical:5, borderBottomWidth:1, borderBottomColor:"#FEE2E2" },
  stokKritisIcon:    { fontSize:16 },
  stokKritisTxt:     { flex:1, fontSize:13, color:"#1E293B" },
  stokDangerBadge:   { backgroundColor:DANGER_RED, borderRadius:6, paddingHorizontal:8, paddingVertical:3 },
  stokDangerTxt:     { color:"#fff", fontSize:10, fontWeight:"800" },
  kasirContainer:     { flex:1 },
  kasirProdukList:    { flex:1 },
  kasirProdukContent: { padding:10 },
  produkGrid:         { flexDirection:"row", flexWrap:"wrap", gap:10 },
  kasirProdukCard:    { backgroundColor:"#fff", borderRadius:14, padding:12, width:"47%", elevation:2, alignItems:"center" },
  kasirProdukIcon:    { width:48, height:48, borderRadius:12, backgroundColor:"#EFF6FF", justifyContent:"center", alignItems:"center", marginBottom:8 },
  kasirProdukEmoji:   { fontSize:24 },
  kasirProdukNama:    { fontSize:12, fontWeight:"600", color:"#1E293B", textAlign:"center", marginBottom:4 },
  kasirProdukHarga:   { fontSize:13, fontWeight:"800", color:OWNER_BLUE, marginBottom:2 },
  kasirProdukStok:    { fontSize:10, color:"#94A3B8", marginBottom:8 },
  kasirAddBtn:        { backgroundColor:OWNER_BLUE, borderRadius:8, paddingHorizontal:14, paddingVertical:7, width:"100%", alignItems:"center" },
  kasirAddBtnTxt:     { color:"#fff", fontSize:12, fontWeight:"700" },
  kasirQtyRow:        { flexDirection:"row", alignItems:"center", justifyContent:"space-between", width:"100%" },
  kasirQtyBtn:        { backgroundColor:"#F1F5F9", borderRadius:8, width:32, height:32, justifyContent:"center", alignItems:"center" },
  kasirQtyBtnAdd:     { backgroundColor:OWNER_BLUE },
  kasirQtyBtnTxt:     { fontSize:18, fontWeight:"700", color:"#1E293B" },
  kasirQtyBtnAddTxt:  { color:"#fff" },
  kasirQtyNum:        { fontSize:16, fontWeight:"800", color:"#1E293B" },
  kasirFooter:        { backgroundColor:"#fff", borderTopWidth:1, borderTopColor:"#E2E8F0", padding:16, paddingBottom:BOTTOM_SAFE + 8 },
  kasirTotalRow:      { flexDirection:"row", justifyContent:"space-between", alignItems:"center" },
  kasirTotalLbl:      { fontSize:12, color:"#64748B" },
  kasirTotalVal:      { fontSize:22, fontWeight:"800", color:"#1E293B" },
  kasirBayarBtn:          { backgroundColor:OWNER_BLUE, borderRadius:12, paddingHorizontal:24, paddingVertical:12 },
  kasirBayarBtnDisabled:  { backgroundColor:"#CBD5E1", borderRadius:12, paddingHorizontal:24, paddingVertical:12 },
  kasirBayarBtnTxt:       { color:"#fff", fontSize:14, fontWeight:"800" },
  produkCard:    { backgroundColor:"#fff", borderRadius:12, padding:14, marginBottom:8, flexDirection:"row", alignItems:"center", gap:12, elevation:2 },
  produkIconBox: { width:46, height:46, borderRadius:12, backgroundColor:"#EFF6FF", justifyContent:"center", alignItems:"center" },
  produkIconTxt: { fontSize:22 },
  produkInfo:    { flex:1 },
  produkNama:    { fontSize:14, fontWeight:"600", color:"#1E293B" },
  produkKategori:{ fontSize:11, color:"#64748B", marginTop:2 },
  produkHarga:   { fontSize:13, fontWeight:"700", color:OWNER_BLUE, marginTop:3 },
  produkRight:   { alignItems:"flex-end", gap:6 },
  stokBadge:          { borderRadius:8, paddingHorizontal:10, paddingVertical:4 },
  stokBadgeOk:        { backgroundColor:"#F0FDF4" },
  stokBadgeDanger:    { backgroundColor:"#FEF2F2" },
  stokBadgeTxtOk:     { fontSize:11, fontWeight:"700", color:SUCCESS_GREEN },
  stokBadgeTxtDanger: { fontSize:11, fontWeight:"700", color:DANGER_RED },
  produkTerjual:      { fontSize:10, color:"#94A3B8" },
  tambahProdukBtn:    { backgroundColor:OWNER_BLUE, borderRadius:12, padding:14, alignItems:"center", marginTop:4 },
  tambahProdukBtnTxt: { color:"#fff", fontSize:14, fontWeight:"700" },
  laporanSummaryCard: { backgroundColor:"#fff", borderRadius:14, padding:16, marginBottom:12, elevation:2 },
  laporanSummaryRow:  { flexDirection:"row", justifyContent:"space-between", paddingVertical:9, borderBottomWidth:1, borderBottomColor:"#F8FAFC" },
  laporanSummaryLbl:  { fontSize:13, color:"#475569" },
  laporanSummaryVal:  { fontSize:14, fontWeight:"700", color:"#1E293B" },
  laporanTrxCard:  { backgroundColor:"#fff", borderRadius:12, padding:14, marginBottom:8, flexDirection:"row", elevation:1 },
  laporanTrxLeft:  { flex:1 },
  laporanTrxNama:  { fontSize:13, fontWeight:"600", color:"#1E293B" },
  laporanTrxItems: { fontSize:11, color:"#64748B", marginTop:2 },
  laporanTrxWaktu: { fontSize:10, color:"#94A3B8", marginTop:4 },
  laporanTrxRight: { alignItems:"flex-end", gap:4 },
  laporanTrxTotal: { fontSize:14, fontWeight:"800", color:OWNER_BLUE },
  bottomNav:           { flexDirection:"row", backgroundColor:"#fff", borderTopWidth:1, borderTopColor:"#E2E8F0", paddingTop:10, paddingBottom:BOTTOM_SAFE },
  bottomNavItem:       { flex:1, alignItems:"center" },
  bottomNavIcon:       { fontSize:22, color:"#94A3B8" },
  bottomNavIconActive: { fontSize:22, color:OWNER_BLUE },
  bottomNavLbl:        { fontSize:10, color:"#94A3B8", marginTop:2 },
  bottomNavLblActive:  { fontSize:10, color:OWNER_BLUE, fontWeight:"700", marginTop:2 },
  bottomNavIndicator:  { width:20, height:3, backgroundColor:OWNER_BLUE, borderRadius:2, marginTop:3 },
  emptyBox: { paddingVertical:40, alignItems:"center" },
  emptyTxt: { fontSize:15, color:"#94A3B8" },
});