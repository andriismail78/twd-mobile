// src/screens/KasirScreen.tsx
// v4 — fix online: pencatatan transaksi+stok saat selesai, filter status,
//       validasi stok saat konfirmasi, catatan internal kasir

import AsyncStorage from "@react-native-async-storage/async-storage";
import { CameraView, useCameraPermissions } from "expo-camera";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "../context/AuthContext";
import { useProducts } from "../context/ProductsContext";
import TwdLogoBadge from "../components/TwdLogoBadge";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface KasirScreenProps {
  ownerId?: string;
  kasirName?: string;
  onBack?: () => void;
  onTransactionDone?: () => void;
  route?: { params?: { ownerId?: string; kasirName?: string; authUser?: any } };
}

interface StoreProduct {
  id: string;
  ownerId: string;
  name: string;
  price: number;
  buyPrice?: number;
  sellPrice?: number;
  stock: number;
  stockMin?: number;
  category?: string;
  barcode?: string;
  createdAt: string;
}

interface CartItem {
  product: StoreProduct;
  qty: number;
}

interface HeldCart {
  id: string;
  label: string;
  cart: CartItem[];
  diskon: string;
  notes: string;
  savedAt: string;
}

interface Transaction {
  id: string;
  ownerId: string;
  kasirId: string;
  kasirName: string;
  namaToko: string;
  items: Array<{ name: string; price: number; qty: number; subtotal: number }>;
  subtotal: number;
  diskon: number;
  total: number;
  bayar: number;
  kembalian: number;
  metodeBayar: string;
  notes?: string;
  sourceOrderId?: string;
  createdAt: string;
  tanggal: string;
}

interface OnlineOrder {
  id: string;
  ownerId: string;
  customerName: string;
  customerPhone?: string;
  customerAddress?: string;
  items: Array<{ productId: string; name: string; price: number; qty: number }>;
  subtotal: number;
  total: number;
  status: "menunggu" | "diproses" | "dikirim" | "selesai" | "dibatalkan" | "tertunda";
  kurirId?: string;
  kurirName?: string;
  metodeBayar?: string;
  createdAt: string;
  note?: string;
  catatanKasir?: string;
  fotoBuktiKirim?: string;
  kendalaKirim?: string;
  namaPenerima?: string;
}

interface KurirAccount {
  id: string;
  ownerId: string;
  name: string;
  phone?: string;
  verified: boolean;
}

interface ReturItem {
  name: string;
  maxQty: number;
  qtyRetur: number;
  price: number;
}

interface ReturRequest {
  id: string;
  ownerId: string;
  txId: string;
  nomorStruk?: string;
  txDate: string;
  txTime: string;
  kasirName: string;
  namaToko: string;
  items: ReturItem[];
  totalRetur: number;
  alasan: string;
  status: "menunggu" | "disetujui" | "ditolak";
  createdAt: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PRODUCTS_KEY   = "@twd_products";
const STORE_INFO_PFX = "@twd_store_info_";
const ORDERS_KEY     = "@twd_orders";
const KURIR_KEY      = "@twd_kurir_accounts";

const ACCENT  = "#2563EB";
const SUCCESS = "#16A34A";
const DANGER  = "#DC2626";
const ORANGE  = "#D97706";
const PURPLE  = "#7C3AED";

const BARCODE_SCANNER_SETTINGS = {
  barcodeTypes: ["qr","ean13","ean8","code128","code39","pdf417","upc_e"] as any[],
};

const ORDER_STATUS_LABEL: Record<string, string> = {
  menunggu:   "⏳ Menunggu",
  diproses:   "🔄 Diproses",
  dikirim:    "🚚 Dikirim",
  selesai:    "✅ Selesai",
  dibatalkan: "❌ Dibatalkan",
};

const ORDER_STATUS_COLOR: Record<string, string> = {
  menunggu:   "#D97706",
  diproses:   ACCENT,
  dikirim:    PURPLE,
  selesai:    SUCCESS,
  dibatalkan: DANGER,
};

// Alur status berikutnya
const ORDER_NEXT_STATUS: Record<string, { status: string; label: string; color: string } | null> = {
  menunggu:   { status: "diproses", label: "🔄 Proses Pesanan", color: ACCENT  },
  diproses:   { status: "dikirim",  label: "🚚 Tandai Dikirim", color: PURPLE  },
  dikirim:    { status: "selesai",  label: "✅ Tandai Selesai", color: SUCCESS },
  selesai:    null,
  dibatalkan: null,
};

// Filter tab online
const ONLINE_FILTER_OPTIONS: Array<{ key: string; label: string }> = [
  { key: "aktif",     label: "🔴 Aktif"      },
  { key: "semua",     label: "📋 Semua"      },
  { key: "menunggu",  label: "⏳ Menunggu"   },
  { key: "diproses",  label: "🔄 Diproses"   },
  { key: "dikirim",   label: "🚚 Dikirim"    },
  { key: "selesai",   label: "✅ Selesai"    },
  { key: "dibatalkan",label: "❌ Dibatalkan" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayStr()            { return new Date().toISOString().slice(0, 10); }
function txKey(id: string)     { return "@twd_tx_" + id; }
function returKey(id: string)  { return "@twd_retur_" + id; }
function getProductPrice(p: StoreProduct) { return p.sellPrice ?? p.price ?? 0; }
function fmtRp(n: number)      { return "Rp " + Math.round(n).toLocaleString("id-ID"); }
function genId(prefix: string) { return prefix + "-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6); }

function isReturAllowed(tanggal: string): boolean {
  const diff = (Date.now() - new Date(tanggal).getTime()) / 86400000;
  return diff <= 2;
}

function buildStrukText(tx: Transaction): string {
  const divider = "─────────────────────────";
  const lines = [
    tx.namaToko,
    divider,
    "No: #" + tx.id.slice(-8).toUpperCase(),
    new Date(tx.createdAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }),
    divider,
    ...tx.items.map((i) => i.name + " x" + i.qty + "  " + fmtRp(i.subtotal)),
    divider,
    "Subtotal   : " + fmtRp(tx.subtotal),
    ...(tx.diskon > 0 ? ["Diskon     : -" + fmtRp(tx.diskon)] : []),
    "TOTAL      : " + fmtRp(tx.total),
    divider,
    "Metode     : " + (tx.metodeBayar ?? "online").toUpperCase(),
    divider,
    "Kasir      : " + tx.kasirName,
    ...(tx.notes ? ["Catatan    : " + tx.notes] : []),
    ...(tx.sourceOrderId ? ["Order ID   : #" + tx.sourceOrderId.slice(-8).toUpperCase()] : []),
    divider,
    "Terima kasih! 🙏",
  ];
  return lines.join("\n");
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function KasirScreen({
  ownerId: ownerIdProp,
  kasirName: kasirNameProp,
  onBack,
  onTransactionDone,
  route,
}: KasirScreenProps) {

  const { user, logout } = useAuth();
  const { addTransaksi } = useProducts();

  // ── Resolve identitas ─────────────────────────────────────────────────
  const resolvedOwnerId = useMemo(() => {
    if (ownerIdProp && String(ownerIdProp).trim() !== "") return String(ownerIdProp).trim();
    const rp = route?.params;
    if (rp?.ownerId && String(rp.ownerId).trim() !== "") return String(rp.ownerId).trim();
    if (rp?.authUser?.ownerId && String(rp.authUser.ownerId).trim() !== "") return String(rp.authUser.ownerId).trim();
    if (rp?.authUser?.id && String(rp.authUser.id).trim() !== "") return String(rp.authUser.id).trim();
    const u = user as any;
    if (u?.ownerId && String(u.ownerId).trim() !== "") return String(u.ownerId).trim();
    if (u?.id && String(u.id).trim() !== "") return String(u.id).trim();
    return "";
  }, [ownerIdProp, route?.params, user]);

  const resolvedKasirName = useMemo(() => {
    if (kasirNameProp && kasirNameProp.trim() !== "") return kasirNameProp.trim();
    const rp = route?.params;
    if (rp?.kasirName && String(rp.kasirName).trim() !== "") return String(rp.kasirName).trim();
    if (rp?.authUser?.name && String(rp.authUser.name).trim() !== "") return String(rp.authUser.name).trim();
    const u = user as any;
    if (u?.name && String(u.name).trim() !== "") return String(u.name).trim();
    return "Kasir";
  }, [kasirNameProp, route?.params, user]);

  const resolvedKasirId = useMemo(() => {
    const rp = route?.params;
    if (rp?.authUser?.kasirId) return String(rp.authUser.kasirId);
    if (rp?.authUser?.id) return String(rp.authUser.id);
    const u = user as any;
    if (u?.kasirId) return String(u.kasirId);
    if (u?.id) return String(u.id);
    return resolvedKasirName;
  }, [route?.params, user, resolvedKasirName]);

  const ownerIdValid = resolvedOwnerId !== "";

  // ── Logout ────────────────────────────────────────────────────────────
  const handleLogout = () => {
  Alert.alert(
    "Keluar dari Kasir",
    "Yakin ingin logout dari sesi kasir ini?",
    [
      { text: "Batal", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: () => { logout(); },
      },
    ],
  );
};

  // ── State: Kasir ──────────────────────────────────────────────────────
  const [products,   setProducts]   = useState<StoreProduct[]>([]);
  const [cart,       setCart]       = useState<CartItem[]>([]);
  const [search,     setSearch]     = useState("");
  const [filterCat,  setFilterCat]  = useState<string>("Semua");
  const [diskon,     setDiskon]     = useState("0");
  const [bayar,      setBayar]      = useState("");
  const [metode,     setMetode]     = useState<"tunai"|"transfer"|"qris">("tunai");
  const [namaToko,   setNamaToko]   = useState("-");
  const [loadingMsg, setLoadingMsg] = useState<string|null>(null);
  const [txNotes,    setTxNotes]    = useState("");

  // ── State: Hold Cart ──────────────────────────────────────────────────
  const [heldCarts,     setHeldCarts]     = useState<HeldCart[]>([]);
  const [showHeldCarts, setShowHeldCarts] = useState(false);

  // ── State: Tabs ───────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<"kasir"|"online"|"riwayat">("kasir");

  // ── State: Riwayat ────────────────────────────────────────────────────
  const [recentTx,   setRecentTx]   = useState<Transaction[]>([]);
  const [omzetToday, setOmzetToday] = useState(0);

  // ── State: Online ─────────────────────────────────────────────────────
  const [onlineOrders,    setOnlineOrders]    = useState<OnlineOrder[]>([]);
  const [kurirList,       setKurirList]       = useState<KurirAccount[]>([]);
  const [selectedOrder,   setSelectedOrder]   = useState<OnlineOrder | null>(null);
  const [showOrderDetail, setShowOrderDetail] = useState(false);
  const [selectedKurirId, setSelectedKurirId] = useState<string>("");
  const [processingOrder, setProcessingOrder] = useState(false);
  const [onlineFilter,    setOnlineFilter]    = useState<string>("aktif");
  // Catatan internal kasir (sementara di form, belum disimpan)
  const [catatanKasirInput, setCatatanKasirInput] = useState("");

  // ── State: Retur ──────────────────────────────────────────────────────
  const [showReturModal,  setShowReturModal]  = useState(false);
  const [returTx,         setReturTx]         = useState<Transaction | null>(null);
  const [returItems,      setReturItems]      = useState<ReturItem[]>([]);
  const [returAlasan,     setReturAlasan]     = useState("");
  const [returAll,        setReturAll]        = useState(true);
  const [returNomorStruk, setReturNomorStruk] = useState("");

  // ── State: Scanner + Struk + Bayar ───────────────────────────────────
  const [showScanner, setShowScanner] = useState(false);
  const [showStruk,   setShowStruk]   = useState(false);
  const [lastTx,      setLastTx]      = useState<Transaction|null>(null);
  const [showBayar,   setShowBayar]   = useState(false);

  const [permission, requestPermission] = useCameraPermissions();
  const scannedRef = useRef(false);

  // ── Load nama toko ────────────────────────────────────────────────────
  useEffect(() => {
    if (!ownerIdValid) return;
    AsyncStorage.getItem(STORE_INFO_PFX + resolvedOwnerId).then((raw) => {
      if (!raw) return;
      try {
        const info = JSON.parse(raw);
        if (info?.namaToko) setNamaToko(info.namaToko);
        else if (info?.tokoName) setNamaToko(info.tokoName);
      } catch {}
    });
  }, [resolvedOwnerId, ownerIdValid]);

  // ── Load produk ───────────────────────────────────────────────────────
  const loadProducts = useCallback(async () => {
    if (!ownerIdValid) { setProducts([]); return; }
    setLoadingMsg("Memuat produk...");
    try {
      const raw = await AsyncStorage.getItem(PRODUCTS_KEY);
      const all: StoreProduct[] = raw ? JSON.parse(raw) : [];
      setProducts(all.filter((p) => String(p.ownerId ?? "").trim() === resolvedOwnerId));
    } catch (e) { console.error("loadProducts:", e); }
    finally { setLoadingMsg(null); }
  }, [resolvedOwnerId, ownerIdValid]);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  // ── Kategori list ─────────────────────────────────────────────────────
  const categories = useMemo(() => {
    const cats = Array.from(new Set(products.map((p) => p.category ?? "").filter(Boolean)));
    return ["Semua", ...cats.sort()];
  }, [products]);

  // ── Load riwayat ──────────────────────────────────────────────────────
  const loadRecentTx = useCallback(async () => {
    if (!ownerIdValid) return;
    try {
      const raw = await AsyncStorage.getItem(txKey(resolvedOwnerId));
      const all: Transaction[] = raw ? JSON.parse(raw) : [];
      const batas = new Date(); batas.setDate(batas.getDate() - 7);
      const filtered = all
        .filter((t) => new Date(t.createdAt) >= batas)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setRecentTx(filtered);
      setOmzetToday(filtered.filter((t) => t.tanggal === todayStr()).reduce((s, t) => s + t.total, 0));
    } catch (e) { console.error("loadRecentTx:", e); }
  }, [resolvedOwnerId, ownerIdValid]);

  useEffect(() => { loadRecentTx(); }, [loadRecentTx]);

  // ── Load online orders ────────────────────────────────────────────────
  const loadOnlineOrders = useCallback(async () => {
    if (!ownerIdValid) return;
    try {
      const raw = await AsyncStorage.getItem(ORDERS_KEY);
      const all: OnlineOrder[] = raw ? JSON.parse(raw) : [];
      const mine = all
        .filter((o) => String(o.ownerId ?? "").trim() === resolvedOwnerId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setOnlineOrders(mine);
    } catch (e) { console.error("loadOnlineOrders:", e); }
  }, [resolvedOwnerId, ownerIdValid]);

  // ── Load kurir ────────────────────────────────────────────────────────
  const loadKurir = useCallback(async () => {
    if (!ownerIdValid) return;
    try {
      const raw = await AsyncStorage.getItem(KURIR_KEY);
      const all: any[] = raw ? JSON.parse(raw) : [];
      const validKurir: KurirAccount[] = all
        .filter((k) => {
          const isVerified =
            k.verified === true ||
            k.status === "terverifikasi" ||
            k.aktif === true ||
            k.status === "menunggu_verifikasi";
          const matchOwner =
            !k.ownerId ||
            String(k.ownerId).trim() === "" ||
            String(k.ownerId).trim() === resolvedOwnerId;
          return isVerified && matchOwner && k.status !== "ditolak";
        })
        .map((k) => ({
          id: k.id,
          ownerId: k.ownerId ?? resolvedOwnerId,
          name: k.name || k.nama || "Kurir",
          phone: k.phone || k.noHp || "",
          verified: true,
        }));
      setKurirList(validKurir);
    } catch (e) { console.error("loadKurir:", e); }
  }, [resolvedOwnerId, ownerIdValid]);

  useEffect(() => { loadOnlineOrders(); loadKurir(); }, [loadOnlineOrders, loadKurir]);

  // ── Badge counts ──────────────────────────────────────────────────────
  const pendingOnline = useMemo(
    () => onlineOrders.filter((o) => o.status === "menunggu").length,
    [onlineOrders],
  );

  const txToday = useMemo(
    () => recentTx.filter((t) => t.tanggal === todayStr()).length,
    [recentTx],
  );

  // ── Filter online orders ──────────────────────────────────────────────
  const filteredOnlineOrders = useMemo(() => {
    if (onlineFilter === "semua") return onlineOrders;
    if (onlineFilter === "aktif") return onlineOrders.filter((o) => o.status !== "selesai" && o.status !== "dibatalkan");
    return onlineOrders.filter((o) => o.status === onlineFilter);
  }, [onlineOrders, onlineFilter]);

  // ── Filter produk ─────────────────────────────────────────────────────
  const filteredProducts = useMemo(() => {
    let list = products;
    if (filterCat !== "Semua") list = list.filter((p) => (p.category ?? "") === filterCat);
    if (!search.trim()) return list;
    const q = search.toLowerCase().trim();
    return list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.barcode ?? "").toLowerCase().includes(q) ||
        (p.category ?? "").toLowerCase().includes(q),
    );
  }, [products, search, filterCat]);

  // ── Cart helpers ──────────────────────────────────────────────────────
  const addToCart = (product: StoreProduct) => {
    if (product.stock <= 0) { Alert.alert("Stok Habis", product.name + " tidak tersedia."); return; }
    setCart((prev) => {
      const idx = prev.findIndex((c) => c.product.id === product.id);
      if (idx >= 0) {
        const cur = prev[idx];
        if (cur.qty >= product.stock) { Alert.alert("Stok Kurang", "Stok " + product.name + " hanya " + product.stock); return prev; }
        const next = [...prev]; next[idx] = { ...cur, qty: cur.qty + 1 }; return next;
      }
      return [...prev, { product, qty: 1 }];
    });
  };

  const setQty = (productId: string, qty: number) => {
    if (qty <= 0) setCart((prev) => prev.filter((c) => c.product.id !== productId));
    else setCart((prev) => prev.map((c) => c.product.id === productId ? { ...c, qty: Math.min(qty, c.product.stock) } : c));
  };

  const removeFromCart = (productId: string) =>
    setCart((prev) => prev.filter((c) => c.product.id !== productId));

  const clearCart = () => { setCart([]); setDiskon("0"); setBayar(""); setMetode("tunai"); setTxNotes(""); };

  // ── Hold Cart ─────────────────────────────────────────────────────────
  const handleHoldCart = () => {
    if (cart.length === 0) { Alert.alert("Keranjang Kosong", "Tidak ada item untuk ditahan."); return; }
    const newHeld: HeldCart = {
      id:      genId("hold"),
      label:   "Hold #" + (heldCarts.length + 1) + " — " + cart.length + " item",
      cart:    [...cart],
      diskon:  diskon,
      notes:   txNotes,
      savedAt: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
    };
    setHeldCarts((prev) => [...prev, newHeld]);
    clearCart();
    Alert.alert("Cart Ditahan ✅", "Tersimpan sebagai \"" + newHeld.label + "\".\nKetuk tombol 📂 untuk mengambil.");
  };

  const handleRestoreCart = (held: HeldCart) => {
    const doRestore = () => {
      setCart(held.cart);
      setDiskon(held.diskon);
      setTxNotes(held.notes);
      setHeldCarts((prev) => prev.filter((h) => h.id !== held.id));
      setShowHeldCarts(false);
    };
    if (cart.length > 0) {
      Alert.alert("Timpa Keranjang?", "Keranjang saat ini akan diganti.", [
        { text: "Batal", style: "cancel" },
        { text: "Timpa", onPress: doRestore },
      ]);
    } else {
      doRestore();
    }
  };

  const handleDeleteHeld = (heldId: string) =>
    setHeldCarts((prev) => prev.filter((h) => h.id !== heldId));

  // ── Kalkulasi ─────────────────────────────────────────────────────────
  const subtotal  = useMemo(() => cart.reduce((s, c) => s + getProductPrice(c.product) * c.qty, 0), [cart]);
  const diskonVal = useMemo(() => Math.min(Number(diskon) || 0, subtotal), [diskon, subtotal]);
  const total     = useMemo(() => Math.max(0, subtotal - diskonVal), [subtotal, diskonVal]);
  const bayarVal  = useMemo(() => Number(bayar) || 0, [bayar]);
  const kembalian = useMemo(() => Math.max(0, bayarVal - total), [bayarVal, total]);
  const canBayar  = cart.length > 0 && (metode !== "tunai" || bayarVal >= total);

  const shortcutAmounts = useMemo(() =>
    [total, Math.ceil(total / 10000) * 10000, Math.ceil(total / 50000) * 50000, 100000, 200000]
    .filter((v, i, a) => a.indexOf(v) === i && v >= total).slice(0, 5),
    [total],
  );

  // ── Simpan transaksi ke storage (shared logic) ────────────────────────
  const saveTxRecord = async (tx: Transaction) => {
    const rawTx = await AsyncStorage.getItem(txKey(resolvedOwnerId));
    const allTx: Transaction[] = rawTx ? JSON.parse(rawTx) : [];
    await AsyncStorage.setItem(txKey(resolvedOwnerId), JSON.stringify([tx, ...allTx]));
  };

  // ── Kurangi stok produk (shared logic) ────────────────────────────────
  const deductStock = async (
    items: Array<{ productId: string; qty: number }>,
  ): Promise<string[]> => {
    const rawProd = await AsyncStorage.getItem(PRODUCTS_KEY);
    const allProd: StoreProduct[] = rawProd ? JSON.parse(rawProd) : [];
    const kritis: string[] = [];
    for (const item of items) {
      const idx = allProd.findIndex((p) => p.id === item.productId);
      if (idx >= 0) {
        allProd[idx].stock = Math.max(0, allProd[idx].stock - item.qty);
        const ns = allProd[idx].stock;
        const mn = allProd[idx].stockMin ?? 5;
        if (ns === 0) kritis.push(allProd[idx].name + " (HABIS ‼️)");
        else if (ns <= mn) kritis.push(allProd[idx].name + " (sisa " + ns + ")");
      }
    }
    await AsyncStorage.setItem(PRODUCTS_KEY, JSON.stringify(allProd));
    return kritis;
  };

  // ── Bayar kasir ───────────────────────────────────────────────────────
  const handleBayar = async () => {
  if (!canBayar) {
    if (cart.length === 0) Alert.alert("Keranjang Kosong", "Tambah produk terlebih dahulu.");
    else Alert.alert("Uang Kurang", "Jumlah bayar kurang dari total.");
    return;
  }
  Keyboard.dismiss();
  setShowBayar(false);
  try {
    const now   = new Date();
    const txId  = genId("tx");
    const BIAYA = 1000; // Rp 1.000 biaya layanan per transaksi

    // ✅ Gunakan ProductsContext.addTransaksi (handles HPP + stock deduction + @twd_transaksi)
    await addTransaksi({
      id:           txId,
      ownerId:      resolvedOwnerId,
      items:        cart.map((c) => ({
        productId: c.product.id,
        name:      c.product.name,
        price:     getProductPrice(c.product),
        qty:       c.qty,
      })),
      subtotal,
      diskon:       diskonVal,
      biayaLayanan: BIAYA,
      total:        total + BIAYA,
      metodeBayar:  metode,
      dibayar:      metode === "tunai" ? bayarVal : total + BIAYA,
      kembalian:    metode === "tunai" ? Math.max(0, bayarVal - (total + BIAYA)) : 0,
      kasirId:      resolvedKasirId,
      kasirNama:    resolvedKasirName,
    });

    // ✅ Tetap simpan ke @twd_tx_{ownerId} untuk tampilan Riwayat di KasirScreen
    const tx: Transaction = {
      id:          txId,
      ownerId:     resolvedOwnerId,
      kasirId:     resolvedKasirId,
      kasirName:   resolvedKasirName,
      namaToko:    namaToko,
      items:       cart.map((c) => ({
        name:     c.product.name,
        price:    getProductPrice(c.product),
        qty:      c.qty,
        subtotal: getProductPrice(c.product) * c.qty,
      })),
      subtotal,
      diskon:      diskonVal,
      total:       total + BIAYA,
      bayar:       metode === "tunai" ? bayarVal : total + BIAYA,
      kembalian:   metode === "tunai" ? Math.max(0, bayarVal - (total + BIAYA)) : 0,
      metodeBayar: metode,
      notes:       txNotes.trim() || undefined,
      createdAt:   now.toISOString(),
      tanggal:     now.toISOString().slice(0, 10),
    };
    await saveTxRecord(tx);

    setLastTx(tx);
    clearCart();
    await loadProducts();
    await loadRecentTx();
    setShowStruk(true);
    onTransactionDone?.();

    // Cek low stock setelah transaksi
    const rawProd = await AsyncStorage.getItem(PRODUCTS_KEY);
    const allProd: StoreProduct[] = rawProd ? JSON.parse(rawProd) : [];
    const mineProd = allProd.filter((p) => String(p.ownerId ?? "").trim() === resolvedOwnerId);
    const kritis = mineProd
      .filter((p) => p.stock === 0 || p.stock <= (p.stockMin ?? 5))
      .map((p) => p.stock === 0 ? p.name + " (HABIS ‼️)" : p.name + " (sisa " + p.stock + ")");
    if (kritis.length > 0) {
      setTimeout(() => {
        Alert.alert("⚠️ Peringatan Stok", "Stok berikut perlu segera diisi:\n\n" + kritis.join("\n"));
      }, 1200);
    }
  } catch (e) { Alert.alert("Error", "Gagal menyimpan transaksi: " + String(e)); }
};

  // ── Share Struk ───────────────────────────────────────────────────────
  const handleShareStruk = async (tx: Transaction) => {
    try {
      await Share.share({ message: buildStrukText(tx), title: "Struk " + tx.namaToko });
    } catch {
      Alert.alert("Gagal Share", "Tidak dapat membagikan struk.");
    }
  };

  // ── Online: Validasi stok order ───────────────────────────────────────
  const validateStokOrder = async (order: OnlineOrder): Promise<{ ok: boolean; pesan: string }> => {
    try {
      const rawProd = await AsyncStorage.getItem(PRODUCTS_KEY);
      const allProd: StoreProduct[] = rawProd ? JSON.parse(rawProd) : [];
      const kurang: string[] = [];
      for (const item of order.items) {
        const prod = allProd.find((p) => p.id === item.productId || p.name === item.name);
        if (prod && prod.stock < item.qty) {
          kurang.push(item.name + " (butuh " + item.qty + ", stok " + prod.stock + ")");
        }
      }
      if (kurang.length > 0) return { ok: false, pesan: "Stok tidak mencukupi:\n" + kurang.join("\n") };
      return { ok: true, pesan: "" };
    } catch {
      return { ok: true, pesan: "" }; // biarkan lanjut jika gagal cek
    }
  };

  // ── Online: Simpan catatan kasir ──────────────────────────────────────
  const saveCatatanKasir = async (orderId: string, catatan: string) => {
    try {
      const raw = await AsyncStorage.getItem(ORDERS_KEY);
      const all: OnlineOrder[] = raw ? JSON.parse(raw) : [];
      const updated = all.map((o) => o.id === orderId ? { ...o, catatanKasir: catatan } : o);
      await AsyncStorage.setItem(ORDERS_KEY, JSON.stringify(updated));
    } catch {}
  };

  // ── Online: Konfirmasi pesanan siap (menunggu → diproses) ─────────────
  const handleKonfirmasiOrder = async () => {
    if (!selectedOrder) return;

    // Validasi stok sebelum konfirmasi
    const stokCheck = await validateStokOrder(selectedOrder);
    if (!stokCheck.ok) {
      Alert.alert("⚠️ Stok Tidak Cukup", stokCheck.pesan + "\n\nTambah stok terlebih dahulu atau batalkan pesanan.");
      return;
    }

    const kurir = selectedKurirId ? kurirList.find((k) => k.id === selectedKurirId) : null;
    setProcessingOrder(true);
    try {
      // Simpan catatan kasir jika ada
      if (catatanKasirInput.trim()) await saveCatatanKasir(selectedOrder.id, catatanKasirInput.trim());

      const raw = await AsyncStorage.getItem(ORDERS_KEY);
      const all: OnlineOrder[] = raw ? JSON.parse(raw) : [];
      const updated = all.map((o) =>
        o.id === selectedOrder.id
          ? {
              ...o,
              status: "diproses" as const,
              kurirId: selectedKurirId || "",
              kurirName: kurir?.name || "",
              catatanKasir: catatanKasirInput.trim() || o.catatanKasir,
            }
          : o,
      );
      await AsyncStorage.setItem(ORDERS_KEY, JSON.stringify(updated));
      await loadOnlineOrders();
      setSelectedOrder({
        ...selectedOrder,
        status: "diproses",
        kurirId: selectedKurirId || "",
        kurirName: kurir?.name || "",
        catatanKasir: catatanKasirInput.trim() || selectedOrder.catatanKasir,
      });
      Alert.alert(
        "Pesanan Siap 📦",
        selectedKurirId
          ? "Pesanan dikonfirmasi untuk kurir: " + kurir?.name
          : "Pesanan ditandai SIAP! Sekarang muncul di Dasbor Kurir untuk diambil kurir.",
      );
    } catch { Alert.alert("Error", "Gagal konfirmasi pesanan."); }
    finally { setProcessingOrder(false); }
  };

  // ── Online: Update status lanjutan + pencatatan transaksi saat selesai ─
  const handleUpdateOrderStatus = async (order: OnlineOrder, nextStatus: string) => {
    setProcessingOrder(true);
    try {
      // Jika menuju "selesai" → kurangi stok + catat transaksi
      if (nextStatus === "selesai") {
  const stokCheck = await validateStokOrder(order);
  if (!stokCheck.ok) {
    Alert.alert("⚠️ Stok Tidak Cukup", stokCheck.pesan);
    setProcessingOrder(false);
    return;
  }

  const now    = new Date();
  const txId   = genId("tx");
  const BIAYA  = 1000;

  // ✅ ProductsContext.addTransaksi handles HPP + stock deduction
  await addTransaksi({
    id:           txId,
    ownerId:      resolvedOwnerId,
    items:        order.items.map((i) => ({
      productId: i.productId,
      name:      i.name,
      price:     i.price,
      qty:       i.qty,
    })),
    subtotal:     order.subtotal,
    diskon:       0,
    biayaLayanan: BIAYA,
    total:        order.total + BIAYA,
    metodeBayar:  order.metodeBayar ?? "online",
    dibayar:      order.total + BIAYA,
    kembalian:    0,
    kasirId:      resolvedKasirId,
    kasirNama:    resolvedKasirName,
  });

  // Simpan ke @twd_tx_{ownerId} untuk riwayat
  const tx: Transaction = {
    id:           txId,
    ownerId:      resolvedOwnerId,
    kasirId:      resolvedKasirId,
    kasirName:    resolvedKasirName,
    namaToko:     namaToko,
    items:        order.items.map((i) => ({
      name: i.name, price: i.price, qty: i.qty, subtotal: i.price * i.qty,
    })),
    subtotal:     order.subtotal,
    diskon:       0,
    total:        order.total + BIAYA,
    bayar:        order.total + BIAYA,
    kembalian:    0,
    metodeBayar:  order.metodeBayar ?? "online",
    notes:        order.catatanKasir || undefined,
    sourceOrderId: order.id,
    createdAt:    now.toISOString(),
    tanggal:      now.toISOString().slice(0, 10),
  };
  await saveTxRecord(tx);
  await loadRecentTx();
  await loadProducts();

  // Cek low stock
  const rawProd = await AsyncStorage.getItem(PRODUCTS_KEY);
  const allProd: StoreProduct[] = rawProd ? JSON.parse(rawProd) : [];
  const kritis = allProd
    .filter((p) => String(p.ownerId ?? "").trim() === resolvedOwnerId && (p.stock === 0 || p.stock <= (p.stockMin ?? 5)))
    .map((p) => p.stock === 0 ? p.name + " (HABIS ‼️)" : p.name + " (sisa " + p.stock + ")");
  if (kritis.length > 0) {
    setTimeout(() => Alert.alert("⚠️ Peringatan Stok", kritis.join("\n")), 1200);
  }
}

      // Update status order
      const raw = await AsyncStorage.getItem(ORDERS_KEY);
      const all: OnlineOrder[] = raw ? JSON.parse(raw) : [];
      const updated = all.map((o) => o.id === order.id ? { ...o, status: nextStatus as any } : o);
      await AsyncStorage.setItem(ORDERS_KEY, JSON.stringify(updated));
      await loadOnlineOrders();
      setSelectedOrder({ ...order, status: nextStatus as any });

      Alert.alert(
        "Status Diperbarui ✅",
        ORDER_STATUS_LABEL[nextStatus] + "\n" +
        (nextStatus === "selesai" ? "Transaksi telah dicatat ke riwayat." : ""),
      );
    } catch { Alert.alert("Error", "Gagal update status pesanan."); }
    finally { setProcessingOrder(false); }
  };

  const handleBatalOrder = async (orderId: string) => {
    Alert.alert("Batalkan Pesanan", "Yakin batalkan pesanan ini?", [
      { text: "Tidak", style: "cancel" },
      {
        text: "Batalkan", style: "destructive",
        onPress: async () => {
          const raw = await AsyncStorage.getItem(ORDERS_KEY);
          const all: OnlineOrder[] = raw ? JSON.parse(raw) : [];
          const updated = all.map((o) => o.id === orderId ? { ...o, status: "dibatalkan" as const } : o);
          await AsyncStorage.setItem(ORDERS_KEY, JSON.stringify(updated));
          await loadOnlineOrders();
          setShowOrderDetail(false);
        },
      },
    ]);
  };

  // ── Retur ─────────────────────────────────────────────────────────────
  const openReturModal = (tx: Transaction) => {
    setReturTx(tx);
    setReturItems(tx.items.map((i) => ({ name: i.name, maxQty: i.qty, qtyRetur: i.qty, price: i.price })));
    setReturAlasan("");
    setReturNomorStruk(tx.id.slice(-8).toUpperCase());
    setReturAll(true);
    setShowReturModal(true);
  };

  const totalRetur = useMemo(() => returItems.reduce((s, i) => s + i.price * i.qtyRetur, 0), [returItems]);

  const handleSubmitRetur = async () => {
    if (!returTx) return;
    if (!returAlasan.trim()) { Alert.alert("Alasan Wajib", "Masukkan alasan retur."); return; }
    const validItems = returItems.filter((i) => i.qtyRetur > 0);
    if (validItems.length === 0) { Alert.alert("Item Kosong", "Pilih minimal 1 item untuk diretur."); return; }
    try {
      const now = new Date();
      const retur: ReturRequest = {
        id:          genId("retur"),
        ownerId:     resolvedOwnerId,
        txId:        returTx.id,
        nomorStruk:  returNomorStruk.trim() || returTx.id.slice(-8).toUpperCase(),
        txDate:      returTx.tanggal,
        txTime:      new Date(returTx.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
        kasirName:   resolvedKasirName,
        namaToko:    namaToko,
        items:       validItems,
        totalRetur,
        alasan:      returAlasan.trim(),
        status:      "menunggu",
        createdAt:   now.toISOString(),
      };
      const raw = await AsyncStorage.getItem(returKey(resolvedOwnerId));
      const all: ReturRequest[] = raw ? JSON.parse(raw) : [];
      await AsyncStorage.setItem(returKey(resolvedOwnerId), JSON.stringify([retur, ...all]));
      setShowReturModal(false);
      Alert.alert(
        "Retur Diajukan ✅",
        "No. Struk: " + retur.nomorStruk + "\n" +
        "Total retur: " + fmtRp(totalRetur) + "\n\nPermintaan dikirim ke owner untuk persetujuan.",
      );
    } catch { Alert.alert("Error", "Gagal mengajukan retur."); }
  };

  // ── Barcode ───────────────────────────────────────────────────────────
  const handleBarcode = ({ data }: { data: string }) => {
    if (scannedRef.current) return;
    scannedRef.current = true;
    setShowScanner(false);
    const found = products.find((p) => p.barcode === data);
    if (found) { addToCart(found); setSearch(""); }
    else {
      setSearch(data);
      Alert.alert("Barcode", "Produk \"" + data + "\" tidak ditemukan.\nCoba cari manual.");
    }
    setTimeout(() => { scannedRef.current = false; }, 1500);
  };

  const openScanner = async () => {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) { Alert.alert("Izin Kamera", "Izinkan akses kamera untuk scan barcode."); return; }
    }
    scannedRef.current = false;
    setShowScanner(true);
  };

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER: ownerIdValid = false
  // ══════════════════════════════════════════════════════════════════════════

  if (!ownerIdValid) {
    return (
      <View style={S.root}>
        <View style={S.header}>
          {onBack && <TouchableOpacity onPress={onBack} style={S.backBtn}><Text style={S.backTxt}>← Kembali</Text></TouchableOpacity>}
          <View style={S.headerCenter}><Text style={S.headerTitle}>Kasir</Text></View>
          <TouchableOpacity style={S.logoutBtn} onPress={handleLogout}>
            <Text style={S.logoutBtnTxt}>⏏ Logout</Text>
          </TouchableOpacity>
        </View>
        <View style={S.emptyCenter}>
          <Text style={S.emptyIcon}>⚠️</Text>
          <Text style={S.emptyTitle}>Owner ID Tidak Terdeteksi</Text>
          <Text style={S.emptyDesc}>Buka kasir dari Dashboard Owner atau login ulang.</Text>
          {onBack && <TouchableOpacity style={S.retryBtn} onPress={onBack}><Text style={S.retryTxt}>Kembali ke Dashboard</Text></TouchableOpacity>}
        </View>
      </View>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER UTAMA
  // ══════════════════════════════════════════════════════════════════════════

  return (
    <View style={S.root}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <View style={S.header}>
        {onBack && <TouchableOpacity onPress={onBack} style={S.backBtn}><Text style={S.backTxt}>← Kembali</Text></TouchableOpacity>}
        <View style={S.headerCenter}>
          <Text style={S.headerTitle}>{namaToko}</Text>
          <Text style={S.headerSub}>{resolvedKasirName}</Text>
        </View>
        <View style={S.headerRight}>
          <Text style={S.omzetLbl}>Omzet Hari Ini</Text>
          <Text style={S.omzetVal}>{fmtRp(omzetToday)}</Text>
          <TouchableOpacity style={S.logoutBtn} onPress={handleLogout}>
            <Text style={S.logoutBtnTxt}>⏏ Logout</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Tabs ────────────────────────────────────────────────────────── */}
      <View style={S.tabBar}>
        <TouchableOpacity style={[S.tab, activeTab === "kasir" && S.tabActive]} onPress={() => setActiveTab("kasir")}>
          <Text style={[S.tabTxt, activeTab === "kasir" && S.tabTxtActive]}>🧾 Kasir</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[S.tab, activeTab === "online" && S.tabActive]}
          onPress={() => { setActiveTab("online"); loadOnlineOrders(); loadKurir(); }}
        >
          <View style={S.tabRow}>
            <Text style={[S.tabTxt, activeTab === "online" && S.tabTxtActive]}>🌐 Online</Text>
            {pendingOnline > 0 && (
              <View style={S.tabBadge}><Text style={S.tabBadgeTxt}>{pendingOnline}</Text></View>
            )}
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[S.tab, activeTab === "riwayat" && S.tabActive]}
          onPress={() => { setActiveTab("riwayat"); loadRecentTx(); }}
        >
          <View style={S.tabRow}>
            <Text style={[S.tabTxt, activeTab === "riwayat" && S.tabTxtActive]}>📋 Riwayat</Text>
            {txToday > 0 && (
              <View style={[S.tabBadge, S.tabBadgeGreen]}><Text style={S.tabBadgeTxt}>{txToday}</Text></View>
            )}
          </View>
        </TouchableOpacity>
      </View>

      {/* ════ TAB KASIR ══════════════════════════════════════════════════ */}
      {activeTab === "kasir" && (
        <View style={S.kasirLayout}>
          <View style={S.produkCol}>
            <View style={S.searchRow}>
              <TextInput
                style={S.searchInput}
                placeholder="Cari produk / barcode..."
                placeholderTextColor="#94A3B8"
                value={search}
                onChangeText={setSearch}
              />
              <TouchableOpacity style={S.iconBtn} onPress={openScanner}><Text style={S.iconBtnTxt}>📷</Text></TouchableOpacity>
              <TouchableOpacity style={S.iconBtnGreen} onPress={loadProducts}><Text style={S.iconBtnTxt}>🔄</Text></TouchableOpacity>
            </View>

            {categories.length > 1 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={S.catScroll} contentContainerStyle={S.catScrollContent}>
                {categories.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={filterCat === cat ? [S.catBtn, S.catBtnActive] : S.catBtn}
                    onPress={() => setFilterCat(cat)}
                  >
                    <Text style={filterCat === cat ? [S.catBtnTxt, S.catBtnTxtActive] : S.catBtnTxt}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {loadingMsg !== null && (
              <View style={S.loadingRow}><Text style={S.loadingTxt}>{loadingMsg}</Text></View>
            )}

            {loadingMsg === null && products.length === 0 && (
              <View style={S.emptyProduk}>
                <Text style={S.emptyIcon}>📦</Text>
                <Text style={S.emptyTitle}>Belum ada produk</Text>
                <Text style={S.emptyDesc}>Tambahkan produk di menu Produk pada Dashboard Owner.</Text>
                <Text style={S.debugTxt}>{"OwnerID: " + resolvedOwnerId}</Text>
                <TouchableOpacity style={S.retryBtn} onPress={loadProducts}><Text style={S.retryTxt}>🔄 Muat Ulang</Text></TouchableOpacity>
              </View>
            )}

            {loadingMsg === null && products.length > 0 && (
              <FlatList
                data={filteredProducts}
                keyExtractor={(p) => p.id}
                contentContainerStyle={S.produkListContent}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                  <View style={S.emptySearch}>
                    <Text style={S.emptySearchTxt}>Tidak ada produk ditemukan</Text>
                  </View>
                }
                renderItem={({ item: p }) => (
                  <TouchableOpacity
                    style={[S.produkCard, p.stock === 0 && S.produkCardHabis]}
                    onPress={() => addToCart(p)}
                    disabled={p.stock === 0}
                  >
                    <View style={S.produkInfo}>
                      <Text style={S.produkName} numberOfLines={2}>{p.name}</Text>
                      {p.category ? <Text style={S.produkCat}>{p.category}</Text> : null}
                      <Text style={S.produkPrice}>{fmtRp(getProductPrice(p))}</Text>
                    </View>
                    <View style={S.produkRight}>
                      <View style={[S.stokBadge, p.stock === 0 ? S.stokHabis : p.stock <= (p.stockMin ?? 5) ? S.stokMenipis : S.stokOk]}>
                        <Text style={S.stokBadgeTxt}>{p.stock === 0 ? "Habis" : "Stok: " + p.stock}</Text>
                      </View>
                      {p.stock > 0 && (
                        <TouchableOpacity style={S.addBtn} onPress={() => addToCart(p)}>
                          <Text style={S.addBtnTxt}>+</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </TouchableOpacity>
                )}
              />
            )}
          </View>

          <View style={S.cartCol}>
            <View style={S.cartTitleRow}>
              <Text style={S.cartTitle}>{"🛒 (" + cart.length + ")"}</Text>
              <TouchableOpacity style={S.holdBtn} onPress={handleHoldCart}>
                <Text style={S.holdBtnTxt}>⏸ Hold</Text>
              </TouchableOpacity>
              {heldCarts.length > 0 && (
                <TouchableOpacity style={S.heldListBtn} onPress={() => setShowHeldCarts(true)}>
                  <Text style={S.heldListBtnTxt}>{"📂 " + heldCarts.length}</Text>
                </TouchableOpacity>
              )}
            </View>

            {cart.length === 0 ? (
              <View style={S.emptyCart}>
                <Text style={S.emptyCartIcon}>🛒</Text>
                <Text style={S.emptyCartTxt}>Ketuk produk untuk tambah</Text>
                {heldCarts.length > 0 && (
                  <TouchableOpacity style={S.emptyCartHeldBtn} onPress={() => setShowHeldCarts(true)}>
                    <Text style={S.emptyCartHeldTxt}>{"📂 " + heldCarts.length + " cart ditahan"}</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <ScrollView style={S.cartScroll} showsVerticalScrollIndicator={false}>
                {cart.map((c) => (
                  <View key={c.product.id} style={S.cartItem}>
                    <View style={S.cartItemLeft}>
                      <Text style={S.cartItemName} numberOfLines={2}>{c.product.name}</Text>
                      <Text style={S.cartItemPrice}>{fmtRp(getProductPrice(c.product))}</Text>
                    </View>
                    <View style={S.cartQtyRow}>
                      <TouchableOpacity style={S.qtyBtn} onPress={() => setQty(c.product.id, c.qty - 1)}><Text style={S.qtyBtnTxt}>−</Text></TouchableOpacity>
                      <Text style={S.qtyTxt}>{c.qty}</Text>
                      <TouchableOpacity style={S.qtyBtn} onPress={() => setQty(c.product.id, c.qty + 1)}><Text style={S.qtyBtnTxt}>+</Text></TouchableOpacity>
                      <TouchableOpacity style={S.delBtn} onPress={() => removeFromCart(c.product.id)}><Text style={S.delBtnTxt}>🗑</Text></TouchableOpacity>
                    </View>
                    <Text style={S.cartItemSubtotal}>{fmtRp(getProductPrice(c.product) * c.qty)}</Text>
                  </View>
                ))}
              </ScrollView>
            )}

            {cart.length > 0 && (
              <View style={S.summary}>
                <View style={S.summaryRow}>
                  <Text style={S.summaryLbl}>Subtotal</Text>
                  <Text style={S.summaryVal}>{fmtRp(subtotal)}</Text>
                </View>
                <View style={S.summaryRow}>
                  <Text style={S.summaryLbl}>Diskon (Rp)</Text>
                  <TextInput
                    style={S.diskonInput}
                    value={diskon}
                    onChangeText={setDiskon}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor="#94A3B8"
                  />
                </View>
                <View style={S.summaryTotalRow}>
                  <Text style={S.summaryTotalLbl}>TOTAL</Text>
                  <Text style={S.summaryTotalVal}>{fmtRp(total)}</Text>
                </View>
                <TextInput
                  style={S.notesInput}
                  value={txNotes}
                  onChangeText={setTxNotes}
                  placeholder="📝 Catatan transaksi (opsional)"
                  placeholderTextColor="#94A3B8"
                />
                <TouchableOpacity style={[S.bayarBtn, !canBayar && S.bayarBtnDisabled]} onPress={() => setShowBayar(true)}>
                  <Text style={S.bayarBtnTxt}>💳 Bayar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={S.clearBtn} onPress={clearCart}>
                  <Text style={S.clearBtnTxt}>Bersihkan Keranjang</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      )}

      {/* ════ TAB ONLINE ═════════════════════════════════════════════════ */}
      {activeTab === "online" && (
        <View style={S.onlineRoot}>
          {/* Header + refresh */}
          <View style={S.onlineHeader}>
            <Text style={S.onlineHeaderTxt}>Pesanan Online</Text>
            <TouchableOpacity style={S.refreshSmallBtn} onPress={() => { loadOnlineOrders(); loadKurir(); }}>
              <Text style={S.refreshSmallTxt}>🔄 Refresh</Text>
            </TouchableOpacity>
          </View>

          {/* Filter status */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={S.onlineFilterScroll} contentContainerStyle={S.onlineFilterContent}>
            {ONLINE_FILTER_OPTIONS.map((opt) => {
              const count = opt.key === "aktif"
                ? onlineOrders.filter((o) => o.status !== "selesai" && o.status !== "dibatalkan").length
                : opt.key === "semua"
                  ? onlineOrders.length
                  : onlineOrders.filter((o) => o.status === opt.key).length;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={onlineFilter === opt.key ? [S.onlineFilterBtn, S.onlineFilterBtnActive] : S.onlineFilterBtn}
                  onPress={() => setOnlineFilter(opt.key)}
                >
                  <Text style={onlineFilter === opt.key ? [S.onlineFilterTxt, S.onlineFilterTxtActive] : S.onlineFilterTxt}>
                    {opt.label}
                  </Text>
                  {count > 0 && (
                    <View style={S.onlineFilterBadge}>
                      <Text style={S.onlineFilterBadgeTxt}>{count}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {kurirList.length === 0 && (
            <View style={S.kurirWarning}>
              <Text style={S.kurirWarningTxt}>⚠️ Belum ada kurir terverifikasi. Daftarkan kurir di menu Kurir pada Dashboard Owner.</Text>
            </View>
          )}

          <ScrollView style={S.onlineScroll} contentContainerStyle={S.onlineContent}>
            {filteredOnlineOrders.length === 0 ? (
              <View style={S.emptyCenter}>
                <Text style={S.emptyIcon}>🌐</Text>
                <Text style={S.emptyTitle}>Tidak ada pesanan</Text>
                <Text style={S.emptyDesc}>Tidak ada pesanan dengan filter yang dipilih.</Text>
              </View>
            ) : (
              filteredOnlineOrders.map((order) => (
                <TouchableOpacity
                  key={order.id}
                  style={S.orderCard}
                  onPress={() => {
                    setSelectedOrder(order);
                    setSelectedKurirId(order.kurirId ?? "");
                    setCatatanKasirInput(order.catatanKasir ?? "");
                    setShowOrderDetail(true);
                  }}
                >
                  <View style={S.orderCardHeader}>
                    <View style={S.orderCardLeft}>
                      <Text style={S.orderCustomer}>{order.customerName}</Text>
                      <Text style={S.orderTime}>
                        {new Date(order.createdAt).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })}
                      </Text>
                    </View>
                    <View style={[S.orderStatusBadge, { backgroundColor: (ORDER_STATUS_COLOR[order.status] ?? "#64748B") + "20" }]}>
                      <Text style={[S.orderStatusTxt, { color: ORDER_STATUS_COLOR[order.status] ?? "#64748B" }]}>
                        {ORDER_STATUS_LABEL[order.status] ?? order.status}
                      </Text>
                    </View>
                  </View>
                  <Text style={S.orderItems} numberOfLines={1}>
                    {order.items.map((i) => i.name + " ×" + i.qty).join(", ")}
                  </Text>
                  <View style={S.orderCardFooter}>
                    <Text style={S.orderTotal}>{fmtRp(order.total)}</Text>
                    <View style={S.orderCardFooterRight}>
                      {order.kurirName && <Text style={S.orderKurir}>{"🚚 " + order.kurirName}</Text>}
                      {order.catatanKasir ? <Text style={S.orderHasCatatan}>📝</Text> : null}
                    </View>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>
      )}

      {/* ════ TAB RIWAYAT ════════════════════════════════════════════════ */}
      {activeTab === "riwayat" && (
        <ScrollView style={S.riwayatScroll} contentContainerStyle={S.riwayatContent}>
          <View style={S.riwayatHeader}>
            <View>
              <Text style={S.riwayatHeaderTxt}>Transaksi 7 Hari Terakhir</Text>
              <Text style={S.riwayatSubTxt}>{txToday + " transaksi hari ini"}</Text>
            </View>
            <View style={S.riwayatOmzetBox}>
              <Text style={S.riwayatOmzetLbl}>Omzet Hari Ini</Text>
              <Text style={S.riwayatOmzetVal}>{fmtRp(omzetToday)}</Text>
            </View>
          </View>

          {recentTx.length === 0 ? (
            <View style={S.emptyCenter}>
              <Text style={S.emptyIcon}>📋</Text>
              <Text style={S.emptyTitle}>Belum ada transaksi</Text>
              <Text style={S.emptyDesc}>Transaksi yang dibuat akan muncul di sini.</Text>
            </View>
          ) : (
            recentTx.map((tx) => (
              <View key={tx.id} style={S.txCard}>
                <View style={S.txCardHeader}>
                  <Text style={S.txId} numberOfLines={1}>{"#" + tx.id.slice(-8).toUpperCase()}</Text>
                  {tx.sourceOrderId ? (
                    <View style={S.txOnlineBadge}><Text style={S.txOnlineBadgeTxt}>🌐 Online</Text></View>
                  ) : (
                    <Text style={S.txMetode}>{tx.metodeBayar.toUpperCase()}</Text>
                  )}
                  <Text style={S.txTotal}>{fmtRp(tx.total)}</Text>
                </View>
                <View style={S.txCardBody}>
                  <Text style={S.txInfo}>
                    {tx.kasirName + " · " + tx.tanggal + " · " +
                    new Date(tx.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                  </Text>
                  <Text style={S.txItems} numberOfLines={2}>
                    {tx.items.map((i) => i.name + " ×" + i.qty).join(", ")}
                  </Text>
                  {tx.diskon > 0 && <Text style={S.txDiskon}>{"Diskon: " + fmtRp(tx.diskon)}</Text>}
                  {tx.metodeBayar === "tunai" && (
                    <Text style={S.txKembalian}>{"Bayar: " + fmtRp(tx.bayar) + " · Kembali: " + fmtRp(tx.kembalian)}</Text>
                  )}
                  {tx.notes ? <Text style={S.txNotes}>{"📝 " + tx.notes}</Text> : null}
                  <View style={S.txActionRow}>
                    <TouchableOpacity style={S.shareStrukBtn} onPress={() => handleShareStruk(tx)}>
                      <Text style={S.shareStrukBtnTxt}>📤 Bagikan Struk</Text>
                    </TouchableOpacity>
                    {isReturAllowed(tx.tanggal) && !tx.sourceOrderId && (
                      <TouchableOpacity style={S.returBtn} onPress={() => openReturModal(tx)}>
                        <Text style={S.returBtnTxt}>↩️ Retur</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* ════ Modal: Hold Cart List ════════════════════════════════════════ */}
      <Modal visible={showHeldCarts} transparent animationType="slide" onRequestClose={() => setShowHeldCarts(false)}>
        <Pressable style={S.overlay} onPress={() => setShowHeldCarts(false)}>
          <Pressable style={S.heldSheet} onPress={() => {}}>
            <Text style={S.heldSheetTitle}>{"📂 Cart Ditahan (" + heldCarts.length + ")"}</Text>
            {heldCarts.length === 0 ? (
              <View style={S.heldEmpty}><Text style={S.heldEmptyTxt}>Tidak ada cart yang ditahan.</Text></View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {heldCarts.map((h) => (
                  <View key={h.id} style={S.heldCard}>
                    <View style={S.heldCardLeft}>
                      <Text style={S.heldCardLabel}>{h.label}</Text>
                      <Text style={S.heldCardTime}>{"Disimpan " + h.savedAt}</Text>
                      <Text style={S.heldCardItems} numberOfLines={1}>
                        {h.cart.map((c) => c.product.name + " ×" + c.qty).join(", ")}
                      </Text>
                    </View>
                    <View style={S.heldCardActions}>
                      <TouchableOpacity style={S.heldRestoreBtn} onPress={() => handleRestoreCart(h)}>
                        <Text style={S.heldRestoreTxt}>↩ Ambil</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={S.heldDeleteBtn} onPress={() => handleDeleteHeld(h.id)}>
                        <Text style={S.heldDeleteTxt}>🗑</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}
            <TouchableOpacity style={[S.konfirmBtn, S.konfirmBtnGray]} onPress={() => setShowHeldCarts(false)}>
              <Text style={S.konfirmBtnGrayTxt}>Tutup</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ════ Modal: Bayar ════════════════════════════════════════════════ */}
      <Modal visible={showBayar} transparent animationType="slide" onRequestClose={() => setShowBayar(false)}>
        <Pressable style={S.overlay} onPress={() => setShowBayar(false)}>
          <Pressable style={S.bayarSheet} onPress={() => {}}>
            <Text style={S.bayarSheetTitle}>💳 Pembayaran</Text>
            <View style={S.bayarSummary}>
              <View style={S.bayarSumRow}><Text style={S.bayarSumLbl}>Subtotal</Text><Text style={S.bayarSumVal}>{fmtRp(subtotal)}</Text></View>
              {diskonVal > 0 && <View style={S.bayarSumRow}><Text style={S.bayarSumLbl}>Diskon</Text><Text style={S.bayarSumDiskon}>{"-" + fmtRp(diskonVal)}</Text></View>}
              <View style={S.bayarSumTotalRow}><Text style={S.bayarSumTotalLbl}>TOTAL</Text><Text style={S.bayarSumTotalVal}>{fmtRp(total)}</Text></View>
            </View>
            <Text style={S.sectionLbl}>Metode Pembayaran</Text>
            <View style={S.metodeRow}>
              <TouchableOpacity style={[S.metodeBtn, metode === "tunai" && S.metodeBtnActive]} onPress={() => setMetode("tunai")}>
                <Text style={[S.metodeBtnTxt, metode === "tunai" && S.metodeBtnTxtActive]}>💵 Tunai</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[S.metodeBtn, metode === "transfer" && S.metodeBtnActive]} onPress={() => setMetode("transfer")}>
                <Text style={[S.metodeBtnTxt, metode === "transfer" && S.metodeBtnTxtActive]}>🏦 Transfer</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[S.metodeBtn, metode === "qris" && S.metodeBtnActive]} onPress={() => setMetode("qris")}>
                <Text style={[S.metodeBtnTxt, metode === "qris" && S.metodeBtnTxtActive]}>📱 QRIS</Text>
              </TouchableOpacity>
            </View>
            {metode === "tunai" && (
              <>
                <Text style={S.sectionLbl}>Jumlah Uang Bayar</Text>
                <TextInput
                  style={S.bayarInput}
                  value={bayar}
                  onChangeText={setBayar}
                  keyboardType="numeric"
                  placeholder={"Min. " + fmtRp(total)}
                  placeholderTextColor="#94A3B8"
                  autoFocus
                />
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={S.shortcutRow}>
                    {shortcutAmounts.map((v) => (
                      <TouchableOpacity key={v} style={S.shortcutBtn} onPress={() => setBayar(String(v))}>
                        <Text style={S.shortcutTxt}>{fmtRp(v)}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
                {bayarVal >= total && bayarVal > 0 && (
                  <View style={S.kembalianBox}>
                    <Text style={S.kembalianLbl}>Kembalian</Text>
                    <Text style={S.kembalianVal}>{fmtRp(kembalian)}</Text>
                  </View>
                )}
              </>
            )}
            <TouchableOpacity style={[S.konfirmBtn, !canBayar && S.konfirmBtnDisabled]} onPress={handleBayar} disabled={!canBayar}>
              <Text style={S.konfirmBtnTxt}>
                {metode === "tunai" ? "✅ Konfirmasi Bayar" : metode === "transfer" ? "✅ Konfirmasi Transfer" : "✅ Konfirmasi QRIS"}
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ════ Modal: Detail Order Online ═════════════════════════════════ */}
      <Modal visible={showOrderDetail} transparent animationType="slide" onRequestClose={() => setShowOrderDetail(false)}>
        <View style={S.overlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setShowOrderDetail(false)}
          />
          <View style={S.orderDetailSheet}>
            {selectedOrder !== null && (
              <>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <Text style={[S.orderDetailTitle, { marginBottom: 0, flex: 1 }]}>Detail Pesanan</Text>
                  <TouchableOpacity
                    onPress={() => setShowOrderDetail(false)}
                    style={{ paddingHorizontal: 12, paddingVertical: 4, backgroundColor: "#F1F5F9", borderRadius: 20 }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: "700", color: "#64748B" }}>✕ Tutup</Text>
                  </TouchableOpacity>
                </View>
                <View style={[S.orderStatusStrip, { backgroundColor: (ORDER_STATUS_COLOR[selectedOrder.status] ?? "#64748B") + "18" }]}>
                  <Text style={[S.orderStatusStripTxt, { color: ORDER_STATUS_COLOR[selectedOrder.status] ?? "#64748B" }]}>
                    {ORDER_STATUS_LABEL[selectedOrder.status] ?? selectedOrder.status}
                  </Text>
                  {selectedOrder.kurirName && (
                    <Text style={S.orderStatusStripKurir}>{"🚚 " + selectedOrder.kurirName}</Text>
                  )}
                </View>

                <ScrollView
                  showsVerticalScrollIndicator={true}
                  contentContainerStyle={{ paddingBottom: 50 }}
                  keyboardShouldPersistTaps="handled"
                >
                  {/* Info customer */}
                  <View style={S.orderDetailCustomer}>
                    <Text style={S.orderDetailCustomerName}>{selectedOrder.customerName}</Text>
                    {selectedOrder.customerPhone ? <Text style={S.orderDetailPhone}>📞 {selectedOrder.customerPhone}</Text> : null}
                    {selectedOrder.customerAddress ? <Text style={S.orderDetailAddress}>📍 {selectedOrder.customerAddress}</Text> : null}
                    <Text style={S.orderDetailTime}>
                      {new Date(selectedOrder.createdAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
                    </Text>
                  </View>

                  {/* Item pesanan */}
                  <View style={S.orderDetailItems}>
                    {selectedOrder.items.map((item, i) => (
                      <View key={i} style={S.orderDetailItemRow}>
                        <Text style={S.orderDetailItemName} numberOfLines={1}>{item.name}</Text>
                        <Text style={S.orderDetailItemQty}>{"×" + item.qty}</Text>
                        <Text style={S.orderDetailItemPrice}>{fmtRp(item.price * item.qty)}</Text>
                      </View>
                    ))}
                    <View style={S.orderDetailTotalRow}>
                      <Text style={S.orderDetailTotalLbl}>TOTAL</Text>
                      <Text style={S.orderDetailTotalVal}>{fmtRp(selectedOrder.total)}</Text>
                    </View>
                    {selectedOrder.metodeBayar && (
                      <Text style={S.orderDetailMetode}>{"Metode: " + selectedOrder.metodeBayar.toUpperCase()}</Text>
                    )}
                  </View>

                  {/* Catatan customer */}
                  {selectedOrder.note ? (
                    <View style={S.orderNoteBox}>
                      <Text style={S.orderNoteLbl}>📝 Catatan Customer</Text>
                      <Text style={S.orderNoteTxt}>{selectedOrder.note}</Text>
                    </View>
                  ) : null}

                  {/* ── Catatan internal kasir (selalu tampil, bisa diedit jika belum selesai/batal) ── */}
                  <View style={S.catatanKasirBox}>
                    <Text style={S.catatanKasirLbl}>🗒 Catatan Internal Kasir</Text>
                    {selectedOrder.status === "selesai" || selectedOrder.status === "dibatalkan" ? (
                      <Text style={S.catatanKasirReadOnly}>
                        {selectedOrder.catatanKasir || "—"}
                      </Text>
                    ) : (
                      <TextInput
                        style={S.catatanKasirInput}
                        value={catatanKasirInput}
                        onChangeText={setCatatanKasirInput}
                        placeholder="Catatan untuk internal toko (tidak terlihat customer)"
                        placeholderTextColor="#94A3B8"
                        multiline
                        numberOfLines={2}
                      />
                    )}
                  </View>

                  {/* Konfirmasi + kurir (status menunggu) */}
                  {selectedOrder.status === "menunggu" && (
                    <>
                      <Text style={[S.sectionLbl, S.sectionLblMt]}>Pilih Kurir Pengiriman</Text>
                      {kurirList.length === 0 ? (
                        <View style={S.kurirWarning}>
                          <Text style={S.kurirWarningTxt}>⚠️ Belum ada kurir terverifikasi. Daftarkan kurir dulu di Dashboard Owner.</Text>
                        </View>
                      ) : (
                        kurirList.map((k) => (
                          <TouchableOpacity
                            key={k.id}
                            style={[S.kurirOpt, selectedKurirId === k.id && S.kurirOptActive]}
                            onPress={() => setSelectedKurirId(k.id)}
                          >
                            <Text style={S.kurirOptIcon}>🚚</Text>
                            <View style={S.kurirOptInfo}>
                              <Text style={[S.kurirOptName, selectedKurirId === k.id && S.kurirOptNameActive]}>{k.name}</Text>
                              {k.phone ? <Text style={S.kurirOptPhone}>{k.phone}</Text> : null}
                            </View>
                            {selectedKurirId === k.id && <Text style={S.kurirOptCheck}>✅</Text>}
                          </TouchableOpacity>
                        ))
                      )}
                      <View style={S.orderDetailActions}>
                        <TouchableOpacity style={S.batalBtn} onPress={() => handleBatalOrder(selectedOrder.id)}>
                          <Text style={S.batalBtnTxt}>❌ Batalkan</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[S.konfirmOrderBtn, processingOrder && S.konfirmBtnDisabled]}
                          onPress={handleKonfirmasiOrder}
                          disabled={processingOrder}
                        >
                          <Text style={S.konfirmOrderBtnTxt}>
                            {processingOrder
                              ? "Memproses..."
                              : selectedKurirId
                              ? "✅ Konfirmasi & Tugaskan Kurir"
                              : "📦 Tandai Pesanan Siap (Muncul di Kurir)"}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  )}

                  {/* Info status diproses */}
                  {selectedOrder.status === "diproses" && (
                    <View style={{ backgroundColor: "#EFF6FF", padding: 12, borderRadius: 10, marginBottom: 12, borderWidth: 1, borderColor: "#BFDBFE" }}>
                      <Text style={{ fontSize: 13, fontWeight: "700", color: "#1D4ED8" }}>
                        {selectedOrder.kurirName && selectedOrder.kurirName !== "-" && selectedOrder.kurirName !== ""
                          ? "🙋‍♂️ Order Diambil Kurir: " + selectedOrder.kurirName
                          : "⏳ Pesanan SIAP — Menunggu kurir mengambil pesanan di Dasbor Kurir..."}
                      </Text>
                    </View>
                  )}

                  {/* Info status tertunda (Kendala Kirim dari Kurir) */}
                  {selectedOrder.status === "tertunda" && (
                    <View style={{ backgroundColor: "#FEF2F2", padding: 14, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: "#FECACA" }}>
                      <Text style={{ fontSize: 14, fontWeight: "800", color: "#DC2626", marginBottom: 4 }}>
                        {"⚠️ KENDALA PENGIRIMAN KURIR"}
                      </Text>
                      <Text style={{ fontSize: 13, color: "#991B1B", marginBottom: 12 }}>
                        {"Alasan: " + (selectedOrder.kendalaKirim || "Rumah Kosong / Customer Tidak Ada")}
                      </Text>
                      <View style={{ flexDirection: "row", gap: 10 }}>
                        <TouchableOpacity
                          style={{ flex: 1, backgroundColor: "#DC2626", borderRadius: 10, paddingVertical: 10, alignItems: "center" }}
                          onPress={() => handleUpdateOrderStatus(selectedOrder, "diproses")}
                        >
                          <Text style={{ color: "#fff", fontWeight: "800", fontSize: 12 }}>{"🔄 Kirim Ulang (Siap Diambil)"}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={{ flex: 1, backgroundColor: "#FEE2E2", borderRadius: 10, paddingVertical: 10, alignItems: "center" }}
                          onPress={() => handleBatalOrder(selectedOrder.id)}
                        >
                          <Text style={{ color: "#DC2626", fontWeight: "800", fontSize: 12 }}>{"❌ Batalkan Pesanan"}</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  {/* Tombol update status lanjutan */}
                  {ORDER_NEXT_STATUS[selectedOrder.status] != null && selectedOrder.status !== "menunggu" && (
                    <View style={S.statusFlowWrap}>
                      <TouchableOpacity
                        style={[
                          S.statusFlowBtn,
                          { backgroundColor: ORDER_NEXT_STATUS[selectedOrder.status]!.color },
                          processingOrder && S.konfirmBtnDisabled,
                        ]}
                        onPress={() => handleUpdateOrderStatus(selectedOrder, ORDER_NEXT_STATUS[selectedOrder.status]!.status)}
                        disabled={processingOrder}
                      >
                        <Text style={S.statusFlowBtnTxt}>
                          {processingOrder ? "Memproses..." : ORDER_NEXT_STATUS[selectedOrder.status]!.label}
                        </Text>
                      </TouchableOpacity>
                      {selectedOrder.status !== "selesai" && (
                        <TouchableOpacity style={S.batalBtn} onPress={() => handleBatalOrder(selectedOrder.id)}>
                          <Text style={S.batalBtnTxt}>❌ Batalkan</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}

                  {/* Info jika selesai + Bukti Foto Pengiriman */}
                  {selectedOrder.status === "selesai" && (
                    <View style={S.orderSelesaiInfo}>
                      <Text style={S.orderSelesaiTxt}>✅ Transaksi telah dicatat ke riwayat kasir.</Text>
                      {selectedOrder.namaPenerima ? (
                        <Text style={{ fontSize: 13, fontWeight: "700", color: "#166534", marginTop: 6 }}>
                          {"👤 Diterima oleh: " + selectedOrder.namaPenerima}
                        </Text>
                      ) : null}
                      {selectedOrder.fotoBuktiKirim ? (
                        <View style={{ marginTop: 12, alignItems: "center" }}>
                          <Text style={{ fontSize: 13, fontWeight: "800", color: "#15803D", marginBottom: 8 }}>
                            {"📸 Bukti Foto Pengiriman Kurir"}
                          </Text>
                          <Image
                            source={{ uri: selectedOrder.fotoBuktiKirim }}
                            style={{ width: "100%", height: 180, borderRadius: 10, backgroundColor: "#E2E8F0" }}
                            resizeMode="cover"
                          />
                        </View>
                      ) : null}
                    </View>
                  )}
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ════ Modal: Retur ════════════════════════════════════════════════ */}
      <Modal visible={showReturModal} transparent animationType="slide" onRequestClose={() => setShowReturModal(false)}>
        <Pressable style={S.overlay} onPress={() => setShowReturModal(false)}>
          <Pressable style={S.returSheet} onPress={() => {}}>
            <Text style={S.returSheetTitle}>↩️ Ajukan Retur</Text>
            {returTx !== null && (
              <Text style={S.returTxInfo}>{"Transaksi #" + returTx.id.slice(-8).toUpperCase() + " · " + returTx.tanggal}</Text>
            )}
            <Text style={S.sectionLbl}>No. Struk</Text>
            <TextInput
              style={S.returNomorStrukInput}
              value={returNomorStruk}
              onChangeText={setReturNomorStruk}
              placeholder="Contoh: TX12345678"
              placeholderTextColor="#94A3B8"
              autoCapitalize="characters"
            />
            <View style={S.returToggleRow}>
              <TouchableOpacity
                style={[S.returToggleBtn, returAll && S.returToggleBtnActive]}
                onPress={() => { setReturAll(true); if (returTx) setReturItems(returTx.items.map((i) => ({ name: i.name, maxQty: i.qty, qtyRetur: i.qty, price: i.price }))); }}
              >
                <Text style={[S.returToggleTxt, returAll && S.returToggleTxtActive]}>Retur Semua</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[S.returToggleBtn, !returAll && S.returToggleBtnActive]}
                onPress={() => { setReturAll(false); if (returTx) setReturItems(returTx.items.map((i) => ({ name: i.name, maxQty: i.qty, qtyRetur: 0, price: i.price }))); }}
              >
                <Text style={[S.returToggleTxt, !returAll && S.returToggleTxtActive]}>Pilih Item</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={S.returItemsScroll} showsVerticalScrollIndicator={false}>
              {returItems.map((item, idx) => (
                <View key={idx} style={S.returItemRow}>
                  <View style={S.returItemLeft}>
                    <Text style={S.returItemName} numberOfLines={1}>{item.name}</Text>
                    <Text style={S.returItemPrice}>{fmtRp(item.price) + " / pcs"}</Text>
                  </View>
                  {returAll ? (
                    <Text style={S.returItemQtyFixed}>{"×" + item.qtyRetur}</Text>
                  ) : (
                    <View style={S.returQtyRow}>
                      <TouchableOpacity style={S.returQtyBtn} onPress={() => setReturItems((prev) => prev.map((r, i) => i === idx ? { ...r, qtyRetur: Math.max(0, r.qtyRetur - 1) } : r))}>
                        <Text style={S.returQtyBtnTxt}>−</Text>
                      </TouchableOpacity>
                      <Text style={S.returQtyTxt}>{item.qtyRetur}</Text>
                      <TouchableOpacity style={S.returQtyBtn} onPress={() => setReturItems((prev) => prev.map((r, i) => i === idx ? { ...r, qtyRetur: Math.min(r.maxQty, r.qtyRetur + 1) } : r))}>
                        <Text style={S.returQtyBtnTxt}>+</Text>
                      </TouchableOpacity>
                      <Text style={S.returMaxTxt}>{"/ " + item.maxQty}</Text>
                    </View>
                  )}
                  <Text style={S.returItemTotal}>{fmtRp(item.price * item.qtyRetur)}</Text>
                </View>
              ))}
            </ScrollView>
            <View style={S.returTotalRow}>
              <Text style={S.returTotalLbl}>Total Retur</Text>
              <Text style={S.returTotalVal}>{fmtRp(totalRetur)}</Text>
            </View>
            <Text style={S.sectionLbl}>Alasan Retur</Text>
            <TextInput
              style={S.returAlasanInput}
              value={returAlasan}
              onChangeText={setReturAlasan}
              placeholder="Contoh: Produk rusak, salah item, dll..."
              placeholderTextColor="#94A3B8"
              multiline
              numberOfLines={2}
            />
            <View style={S.returActions}>
              <TouchableOpacity style={S.batalBtn} onPress={() => setShowReturModal(false)}>
                <Text style={S.batalBtnTxt}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={S.submitReturBtn} onPress={handleSubmitRetur}>
                <Text style={S.submitReturBtnTxt}>📤 Ajukan ke Owner</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ════ Modal: Struk ════════════════════════════════════════════════ */}
      <Modal visible={showStruk} transparent animationType="fade" onRequestClose={() => setShowStruk(false)}>
        <Pressable style={S.overlay} onPress={() => setShowStruk(false)}>
          <Pressable style={S.strukSheet} onPress={() => {}}>
            <View style={S.strukHeader}>
              <TwdLogoBadge size="small" showSubtitle={false} />
              <Text style={{ fontSize: 13, fontWeight: "900", color: "#0F172A", letterSpacing: 1, marginTop: 4 }}>
                {"TWD-MOBILE — BON PEMBAYARAN RESMI"}
              </Text>
              <Text style={S.strukSuccessTitle}>Transaksi Berhasil! ✅</Text>
              <Text style={S.strukTokoName}>{"🏪 " + (lastTx?.namaToko ?? namaToko)}</Text>
              <Text style={{ fontSize: 11, color: "#166534", fontWeight: "700", marginTop: 2 }}>
                {"Kode Toko: TWD-" + (lastTx?.ownerId ?? "000000").slice(-6).toUpperCase()}
              </Text>
            </View>
            {lastTx !== null && (
              <View style={S.strukBody}>
                <Text style={S.strukId}>{"#" + lastTx.id.slice(-8).toUpperCase()}</Text>
                <Text style={S.strukTime}>{new Date(lastTx.createdAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}</Text>
                <View style={S.strukDivider} />
                {lastTx.items.map((item, i) => (
                  <View key={i} style={S.strukItemRow}>
                    <Text style={S.strukItemName} numberOfLines={1}>{item.name}</Text>
                    <Text style={S.strukItemQty}>{"×" + item.qty}</Text>
                    <Text style={S.strukItemSubtotal}>{fmtRp(item.subtotal)}</Text>
                  </View>
                ))}
                <View style={S.strukDivider} />
                <View style={S.strukSumRow}><Text style={S.strukSumLbl}>Subtotal</Text><Text style={S.strukSumVal}>{fmtRp(lastTx.subtotal)}</Text></View>
                {lastTx.diskon > 0 && <View style={S.strukSumRow}><Text style={S.strukSumLbl}>Diskon</Text><Text style={S.strukDiskon}>{"-" + fmtRp(lastTx.diskon)}</Text></View>}
                <View style={S.strukTotalRow}>
                  <Text style={S.strukTotalLbl}>TOTAL</Text>
                  <Text style={S.strukTotalVal}>{fmtRp(lastTx.total)}</Text>
                </View>
                <View style={S.strukDivider} />
                <View style={S.strukSumRow}><Text style={S.strukSumLbl}>Metode</Text><Text style={S.strukSumVal}>{lastTx.metodeBayar.toUpperCase()}</Text></View>
                {lastTx.metodeBayar === "tunai" && (
                  <>
                    <View style={S.strukSumRow}><Text style={S.strukSumLbl}>Bayar</Text><Text style={S.strukSumVal}>{fmtRp(lastTx.bayar)}</Text></View>
                    <View style={S.strukSumRow}><Text style={S.strukSumLbl}>Kembalian</Text><Text style={S.strukKembalian}>{fmtRp(lastTx.kembalian)}</Text></View>
                  </>
                )}
                {lastTx.notes ? <Text style={S.strukNotes}>{"📝 " + lastTx.notes}</Text> : null}
                <Text style={S.strukKasir}>{"Dilayani: " + lastTx.kasirName}</Text>
              </View>
            )}
            <View style={S.strukBtnRow}>
              <TouchableOpacity style={S.strukShareBtn} onPress={() => lastTx && handleShareStruk(lastTx)}>
                <Text style={S.strukShareBtnTxt}>📤 Bagikan</Text>
              </TouchableOpacity>
              <TouchableOpacity style={S.strukCloseBtn} onPress={() => { setShowStruk(false); loadProducts(); }}>
                <Text style={S.strukCloseBtnTxt}>Transaksi Baru</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ════ Modal: Scanner ══════════════════════════════════════════════ */}
      <Modal visible={showScanner} animationType="slide" onRequestClose={() => setShowScanner(false)}>
        <View style={S.scannerRoot}>
          <View style={S.scannerHeader}>
            <TouchableOpacity onPress={() => setShowScanner(false)}><Text style={S.scannerClose}>✕ Tutup</Text></TouchableOpacity>
            <Text style={S.scannerTitle}>Scan Barcode Produk</Text>
            <View style={S.scannerSpacer} />
          </View>
          {permission?.granted ? (
            <CameraView
              style={S.cameraFull}
              facing="back"
              barcodeScannerSettings={BARCODE_SCANNER_SETTINGS}
              onBarcodeScanned={handleBarcode}
            />
          ) : (
            <View style={S.emptyCenter}>
              <Text style={S.emptyIcon}>📷</Text>
              <Text style={S.emptyTitle}>Izin kamera diperlukan</Text>
              <TouchableOpacity style={S.retryBtn} onPress={requestPermission}><Text style={S.retryTxt}>Berikan Izin</Text></TouchableOpacity>
            </View>
          )}
          <View style={S.scannerFooter}><Text style={S.scannerHint}>Arahkan kamera ke barcode produk</Text></View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F1F5F9" },

  header:       { backgroundColor: ACCENT, paddingTop: 52, paddingBottom: 12, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 10 },
  backBtn:      { paddingRight: 8 },
  backTxt:      { color: "#fff", fontSize: 13, fontWeight: "700" },
  headerCenter: { flex: 1 },
  headerTitle:  { color: "#fff", fontSize: 17, fontWeight: "800" },
  headerSub:    { color: "rgba(255,255,255,0.75)", fontSize: 11, marginTop: 1 },
  headerRight:  { alignItems: "flex-end" },
  omzetLbl:     { color: "rgba(255,255,255,0.75)", fontSize: 9 },
  omzetVal:     { color: "#fff", fontSize: 13, fontWeight: "800" },
  logoutBtn:    { marginTop: 6, backgroundColor: "rgba(255,255,255,0.18)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: "rgba(255,255,255,0.3)" },
  logoutBtnTxt: { color: "#fff", fontSize: 10, fontWeight: "700" },

  tabBar:        { flexDirection: "row", backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#E2E8F0" },
  tab:           { flex: 1, paddingVertical: 12, alignItems: "center" },
  tabActive:     { borderBottomWidth: 3, borderBottomColor: ACCENT },
  tabTxt:        { fontSize: 12, color: "#64748B", fontWeight: "600" },
  tabTxtActive:  { color: ACCENT, fontWeight: "800" },
  tabRow:        { flexDirection: "row", alignItems: "center", gap: 4 },
  tabBadge:      { backgroundColor: DANGER, borderRadius: 8, minWidth: 16, height: 16, justifyContent: "center", alignItems: "center", paddingHorizontal: 4 },
  tabBadgeGreen: { backgroundColor: SUCCESS },
  tabBadgeTxt:   { color: "#fff", fontSize: 9, fontWeight: "800" },

  kasirLayout: { flex: 1, flexDirection: "row" },

  produkCol:         { flex: 1, borderRightWidth: 1, borderRightColor: "#E2E8F0" },
  searchRow:         { flexDirection: "row", padding: 8, gap: 6, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  searchInput:       { flex: 1, backgroundColor: "#F8FAFC", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, color: "#1E293B", borderWidth: 1, borderColor: "#E2E8F0" },
  iconBtn:           { backgroundColor: "#EFF6FF", borderRadius: 10, width: 38, height: 38, justifyContent: "center", alignItems: "center" },
  iconBtnGreen:      { backgroundColor: "#F0FDF4", borderRadius: 10, width: 38, height: 38, justifyContent: "center", alignItems: "center" },
  iconBtnTxt:        { fontSize: 18 },
  catScroll:         { backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#F1F5F9", maxHeight: 44 },
  catScrollContent:  { paddingHorizontal: 8, paddingVertical: 6, gap: 6, flexDirection: "row" },
  catBtn:            { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 14, backgroundColor: "#F1F5F9", borderWidth: 1, borderColor: "#E2E8F0" },
  catBtnActive:      { backgroundColor: ACCENT, borderColor: ACCENT },
  catBtnTxt:         { fontSize: 11, fontWeight: "600", color: "#64748B" },
  catBtnTxtActive:   { color: "#fff", fontWeight: "800" },
  loadingRow:        { padding: 16, alignItems: "center" },
  loadingTxt:        { fontSize: 13, color: "#64748B" },
  produkListContent: { padding: 8, paddingBottom: 120 },
  produkCard:        { flexDirection: "row", backgroundColor: "#fff", borderRadius: 10, marginBottom: 6, padding: 10, borderWidth: 1, borderColor: "#E2E8F0", alignItems: "center" },
  produkCardHabis:   { opacity: 0.5, backgroundColor: "#F8FAFC" },
  produkInfo:        { flex: 1 },
  produkName:        { fontSize: 12, fontWeight: "700", color: "#1E293B", marginBottom: 2 },
  produkCat:         { fontSize: 10, color: "#64748B", marginBottom: 3 },
  produkPrice:       { fontSize: 12, fontWeight: "800", color: ACCENT },
  produkRight:       { alignItems: "flex-end", gap: 6 },
  stokBadge:         { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  stokOk:            { backgroundColor: "#DCFCE7" },
  stokMenipis:       { backgroundColor: "#FEF9C3" },
  stokHabis:         { backgroundColor: "#FEE2E2" },
  stokBadgeTxt:      { fontSize: 9, fontWeight: "700", color: "#374151" },
  addBtn:            { backgroundColor: ACCENT, borderRadius: 6, width: 28, height: 28, justifyContent: "center", alignItems: "center" },
  addBtnTxt:         { color: "#fff", fontSize: 20, fontWeight: "700", lineHeight: 24 },
  emptyProduk:       { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  emptySearch:       { padding: 24, alignItems: "center" },
  emptySearchTxt:    { fontSize: 12, color: "#64748B", textAlign: "center" },
  debugTxt:          { fontSize: 10, color: "#94A3B8", marginBottom: 12 },

  cartCol:          { flex: 1, backgroundColor: "#fff" },
  cartTitleRow:     { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#F1F5F9", gap: 6 },
  cartTitle:        { fontSize: 13, fontWeight: "800", color: "#1E293B", flex: 1 },
  holdBtn:          { backgroundColor: "#FFF7ED", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: "#FED7AA" },
  holdBtnTxt:       { fontSize: 10, fontWeight: "700", color: ORANGE },
  heldListBtn:      { backgroundColor: "#EFF6FF", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  heldListBtnTxt:   { fontSize: 10, fontWeight: "700", color: ACCENT },
  cartScroll:       { flex: 1 },
  cartItem:         { padding: 10, borderBottomWidth: 1, borderBottomColor: "#F8FAFC" },
  cartItemLeft:     { flex: 1 },
  cartItemName:     { fontSize: 11, fontWeight: "700", color: "#1E293B" },
  cartItemPrice:    { fontSize: 10, color: "#64748B" },
  cartItemSubtotal: { fontSize: 12, fontWeight: "800", color: ACCENT, textAlign: "right", marginTop: 4 },
  cartQtyRow:       { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  qtyBtn:           { width: 26, height: 26, backgroundColor: "#EFF6FF", borderRadius: 8, justifyContent: "center", alignItems: "center" },
  qtyBtnTxt:        { fontSize: 16, fontWeight: "700", color: ACCENT },
  qtyTxt:           { fontSize: 13, fontWeight: "700", color: "#1E293B", minWidth: 22, textAlign: "center" },
  delBtn:           { width: 26, height: 26, backgroundColor: "#FEE2E2", borderRadius: 8, justifyContent: "center", alignItems: "center" },
  delBtnTxt:        { fontSize: 14 },
  emptyCart:        { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  emptyCartIcon:    { fontSize: 36, marginBottom: 8 },
  emptyCartTxt:     { fontSize: 12, color: "#94A3B8", textAlign: "center" },
  emptyCartHeldBtn: { marginTop: 10, backgroundColor: "#EFF6FF", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  emptyCartHeldTxt: { fontSize: 11, color: ACCENT, fontWeight: "700" },

  summary:         { borderTopWidth: 1, borderTopColor: "#E2E8F0", padding: 10 },
  summaryRow:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  summaryLbl:      { fontSize: 11, color: "#64748B" },
  summaryVal:      { fontSize: 12, fontWeight: "700", color: "#1E293B" },
  summaryTotalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, borderTopColor: "#E2E8F0", paddingTop: 6, marginTop: 4, marginBottom: 6 },
  summaryTotalLbl: { fontSize: 13, fontWeight: "800", color: "#1E293B" },
  summaryTotalVal: { fontSize: 15, fontWeight: "800", color: ACCENT },
  diskonInput:     { borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, fontSize: 12, color: "#1E293B", width: 90, textAlign: "right" },
  notesInput:      { borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, fontSize: 11, color: "#1E293B", marginBottom: 8 },
  bayarBtn:        { backgroundColor: SUCCESS, borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  bayarBtnDisabled:{ backgroundColor: "#CBD5E1" },
  bayarBtnTxt:     { color: "#fff", fontWeight: "800", fontSize: 14 },
  clearBtn:        { marginTop: 6, alignItems: "center", paddingVertical: 8 },
  clearBtnTxt:     { fontSize: 11, color: DANGER, fontWeight: "600" },

  // Online tab
  onlineRoot:           { flex: 1 },
  onlineHeader:         { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  onlineHeaderTxt:      { fontSize: 14, fontWeight: "700", color: "#1E293B" },
  refreshSmallBtn:      { backgroundColor: "#EFF6FF", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  refreshSmallTxt:      { fontSize: 11, color: ACCENT, fontWeight: "700" },
  onlineFilterScroll:   { maxHeight: 44, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  onlineFilterContent:  { paddingHorizontal: 10, paddingVertical: 6, gap: 6, flexDirection: "row" },
  onlineFilterBtn:      { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 14, backgroundColor: "#F1F5F9", borderWidth: 1, borderColor: "#E2E8F0", gap: 4 },
  onlineFilterBtnActive:{ backgroundColor: ACCENT, borderColor: ACCENT },
  onlineFilterTxt:      { fontSize: 11, fontWeight: "600", color: "#64748B" },
  onlineFilterTxtActive:{ color: "#fff", fontWeight: "800" },
  onlineFilterBadge:    { backgroundColor: "rgba(0,0,0,0.18)", borderRadius: 8, minWidth: 16, height: 16, justifyContent: "center", alignItems: "center", paddingHorizontal: 3 },
  onlineFilterBadgeTxt: { color: "#fff", fontSize: 9, fontWeight: "800" },
  kurirWarning:         { backgroundColor: "#FEF9C3", borderRadius: 10, padding: 12, marginHorizontal: 16, marginBottom: 8, borderWidth: 1, borderColor: "#FCD34D" },
  kurirWarningTxt:      { fontSize: 12, color: "#92400E" },
  onlineScroll:         { flex: 1 },
  onlineContent:        { padding: 16, paddingBottom: 80 },
  orderCard:            { backgroundColor: "#fff", borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: "#E2E8F0", padding: 14 },
  orderCardHeader:      { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 },
  orderCardLeft:        { flex: 1 },
  orderCustomer:        { fontSize: 14, fontWeight: "700", color: "#1E293B" },
  orderTime:            { fontSize: 11, color: "#64748B", marginTop: 2 },
  orderStatusBadge:     { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  orderStatusTxt:       { fontSize: 11, fontWeight: "700" },
  orderItems:           { fontSize: 12, color: "#64748B", marginBottom: 8 },
  orderCardFooter:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  orderCardFooterRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  orderTotal:           { fontSize: 14, fontWeight: "800", color: ACCENT },
  orderKurir:           { fontSize: 11, color: PURPLE },
  orderHasCatatan:      { fontSize: 13 },

  riwayatScroll:    { flex: 1 },
  riwayatContent:   { padding: 16, paddingBottom: 80 },
  riwayatHeader:    { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  riwayatHeaderTxt: { fontSize: 13, fontWeight: "700", color: "#374151" },
  riwayatSubTxt:    { fontSize: 11, color: "#64748B", marginTop: 2 },
  riwayatOmzetBox:  { alignItems: "flex-end" },
  riwayatOmzetLbl:  { fontSize: 10, color: "#64748B" },
  riwayatOmzetVal:  { fontSize: 14, fontWeight: "800", color: SUCCESS },
  txCard:           { backgroundColor: "#fff", borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: "#E2E8F0", overflow: "hidden" },
  txCardHeader:     { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#F1F5F9", gap: 8 },
  txId:             { fontSize: 11, fontWeight: "700", color: "#374151", flex: 1 },
  txMetode:         { fontSize: 10, color: "#64748B", backgroundColor: "#F1F5F9", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  txOnlineBadge:    { backgroundColor: "#EDE9FE", borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
  txOnlineBadgeTxt: { fontSize: 10, color: PURPLE, fontWeight: "700" },
  txTotal:          { fontSize: 14, fontWeight: "800", color: ACCENT },
  txCardBody:       { padding: 14 },
  txInfo:           { fontSize: 11, color: "#64748B", marginBottom: 4 },
  txItems:          { fontSize: 12, color: "#374151", marginBottom: 4 },
  txDiskon:         { fontSize: 11, color: SUCCESS },
  txKembalian:      { fontSize: 11, color: "#64748B" },
  txNotes:          { fontSize: 11, color: ORANGE, marginTop: 3 },
  txActionRow:      { flexDirection: "row", gap: 8, marginTop: 10 },
  shareStrukBtn:    { backgroundColor: "#EFF6FF", borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10, borderWidth: 1, borderColor: "#BFDBFE" },
  shareStrukBtnTxt: { fontSize: 11, color: ACCENT, fontWeight: "700" },
  returBtn:         { backgroundColor: "#FEF2F2", borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10, borderWidth: 1, borderColor: "#FCA5A5" },
  returBtnTxt:      { fontSize: 11, color: DANGER, fontWeight: "700" },

  emptyCenter: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  emptyIcon:   { fontSize: 48, marginBottom: 14 },
  emptyTitle:  { fontSize: 16, fontWeight: "700", color: "#374151", marginBottom: 8, textAlign: "center" },
  emptyDesc:   { fontSize: 13, color: "#64748B", textAlign: "center", lineHeight: 20 },
  retryBtn:    { marginTop: 16, backgroundColor: ACCENT, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  retryTxt:    { color: "#fff", fontWeight: "700", fontSize: 13 },

  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },

  heldSheet:       { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: "70%" },
  heldSheetTitle:  { fontSize: 16, fontWeight: "800", color: "#1E293B", marginBottom: 14 },
  heldEmpty:       { padding: 24, alignItems: "center" },
  heldEmptyTxt:    { color: "#94A3B8", fontSize: 13 },
  heldCard:        { flexDirection: "row", alignItems: "center", backgroundColor: "#F8FAFC", borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: "#E2E8F0" },
  heldCardLeft:    { flex: 1 },
  heldCardLabel:   { fontSize: 13, fontWeight: "700", color: "#1E293B", marginBottom: 2 },
  heldCardTime:    { fontSize: 10, color: "#94A3B8", marginBottom: 3 },
  heldCardItems:   { fontSize: 11, color: "#64748B" },
  heldCardActions: { flexDirection: "column", gap: 6, marginLeft: 10 },
  heldRestoreBtn:  { backgroundColor: ACCENT, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  heldRestoreTxt:  { color: "#fff", fontWeight: "700", fontSize: 11 },
  heldDeleteBtn:   { backgroundColor: "#FEE2E2", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, alignItems: "center" },
  heldDeleteTxt:   { fontSize: 13 },

  bayarSheet:          { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: "90%" },
  bayarSheetTitle:     { fontSize: 18, fontWeight: "800", color: "#1E293B", marginBottom: 14, textAlign: "center" },
  bayarSummary:        { backgroundColor: "#F8FAFC", borderRadius: 12, padding: 14, marginBottom: 16 },
  bayarSumRow:         { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  bayarSumLbl:         { fontSize: 13, color: "#64748B" },
  bayarSumVal:         { fontSize: 13, fontWeight: "700", color: "#1E293B" },
  bayarSumDiskon:      { fontSize: 13, fontWeight: "700", color: SUCCESS },
  bayarSumTotalRow:    { flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: "#E2E8F0", paddingTop: 8, marginTop: 4 },
  bayarSumTotalLbl:    { fontSize: 15, fontWeight: "800", color: "#1E293B" },
  bayarSumTotalVal:    { fontSize: 18, fontWeight: "800", color: ACCENT },
  sectionLbl:          { fontSize: 12, fontWeight: "700", color: "#374151", marginBottom: 8 },
  sectionLblMt:        { marginTop: 4 },
  metodeRow:           { flexDirection: "row", gap: 8, marginBottom: 14 },
  metodeBtn:           { flex: 1, borderWidth: 1.5, borderColor: "#CBD5E1", borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  metodeBtnActive:     { borderColor: ACCENT, backgroundColor: "#EFF6FF" },
  metodeBtnTxt:        { fontSize: 12, fontWeight: "600", color: "#64748B" },
  metodeBtnTxtActive:  { color: ACCENT, fontWeight: "800" },
  bayarInput:          { borderWidth: 1.5, borderColor: "#CBD5E1", borderRadius: 12, padding: 14, fontSize: 18, fontWeight: "700", color: "#1E293B", textAlign: "center", marginBottom: 10 },
  shortcutRow:         { flexDirection: "row", gap: 8, paddingVertical: 4, paddingBottom: 12 },
  shortcutBtn:         { backgroundColor: "#EFF6FF", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  shortcutTxt:         { fontSize: 11, fontWeight: "700", color: ACCENT },
  kembalianBox:        { backgroundColor: "#DCFCE7", borderRadius: 12, padding: 12, alignItems: "center", marginBottom: 10 },
  kembalianLbl:        { fontSize: 12, color: "#166534", marginBottom: 2 },
  kembalianVal:        { fontSize: 22, fontWeight: "800", color: SUCCESS },
  konfirmBtn:          { backgroundColor: SUCCESS, borderRadius: 12, paddingVertical: 16, alignItems: "center", marginTop: 4 },
  konfirmBtnDisabled:  { backgroundColor: "#CBD5E1" },
  konfirmBtnTxt:       { color: "#fff", fontWeight: "800", fontSize: 16 },
  konfirmBtnGray:      { backgroundColor: "#F1F5F9", borderWidth: 1, borderColor: "#CBD5E1" },
  konfirmBtnGrayTxt:   { color: "#475569", fontWeight: "700", fontSize: 14 },

  orderDetailSheet:        { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: "92%" },
  orderDetailTitle:        { fontSize: 18, fontWeight: "800", color: "#1E293B", marginBottom: 10, textAlign: "center" },
  orderStatusStrip:        { borderRadius: 10, padding: 10, marginBottom: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  orderStatusStripTxt:     { fontSize: 15, fontWeight: "800" },
  orderStatusStripKurir:   { fontSize: 12, color: PURPLE },
  orderDetailCustomer:     { backgroundColor: "#F8FAFC", borderRadius: 12, padding: 14, marginBottom: 12 },
  orderDetailCustomerName: { fontSize: 15, fontWeight: "800", color: "#1E293B", marginBottom: 4 },
  orderDetailPhone:        { fontSize: 12, color: "#64748B", marginBottom: 2 },
  orderDetailAddress:      { fontSize: 12, color: "#64748B", marginBottom: 4 },
  orderDetailTime:         { fontSize: 11, color: "#94A3B8" },
  orderDetailItems:        { backgroundColor: "#F8FAFC", borderRadius: 12, padding: 12, marginBottom: 12 },
  orderDetailItemRow:      { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  orderDetailItemName:     { flex: 1, fontSize: 12, color: "#374151" },
  orderDetailItemQty:      { fontSize: 11, color: "#64748B", width: 30, textAlign: "center" },
  orderDetailItemPrice:    { fontSize: 12, fontWeight: "700", color: "#1E293B", width: 80, textAlign: "right" },
  orderDetailTotalRow:     { flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: "#E2E8F0", paddingTop: 8, marginTop: 4 },
  orderDetailTotalLbl:     { fontSize: 13, fontWeight: "800", color: "#1E293B" },
  orderDetailTotalVal:     { fontSize: 15, fontWeight: "800", color: ACCENT },
  orderDetailMetode:       { fontSize: 11, color: "#64748B", marginTop: 6 },
  orderNoteBox:            { backgroundColor: "#FFF7ED", borderRadius: 10, padding: 10, marginBottom: 12 },
  orderNoteLbl:            { fontSize: 11, fontWeight: "700", color: "#92400E", marginBottom: 4 },
  orderNoteTxt:            { fontSize: 12, color: "#78350F" },
  catatanKasirBox:         { backgroundColor: "#F0FDF4", borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: "#BBF7D0" },
  catatanKasirLbl:         { fontSize: 11, fontWeight: "700", color: "#166534", marginBottom: 6 },
  catatanKasirInput:       { borderWidth: 1, borderColor: "#BBF7D0", borderRadius: 8, padding: 8, fontSize: 12, color: "#1E293B", minHeight: 52, backgroundColor: "#fff" },
  catatanKasirReadOnly:    { fontSize: 12, color: "#374151", fontStyle: "italic" },
  kurirOpt:                { flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderColor: "#CBD5E1", borderRadius: 12, padding: 12, marginBottom: 8, gap: 10 },
  kurirOptActive:          { borderColor: ACCENT, backgroundColor: "#EFF6FF" },
  kurirOptIcon:            { fontSize: 22 },
  kurirOptInfo:            { flex: 1 },
  kurirOptName:            { fontSize: 13, fontWeight: "700", color: "#374151" },
  kurirOptNameActive:      { color: ACCENT },
  kurirOptPhone:           { fontSize: 11, color: "#64748B", marginTop: 2 },
  kurirOptCheck:           { fontSize: 18 },
  orderDetailActions:      { flexDirection: "row", gap: 10, marginTop: 16 },
  batalBtn:                { flex: 1, borderWidth: 1.5, borderColor: DANGER, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  batalBtnTxt:             { color: DANGER, fontWeight: "700", fontSize: 13 },
  konfirmOrderBtn:         { flex: 2, backgroundColor: SUCCESS, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  konfirmOrderBtnTxt:      { color: "#fff", fontWeight: "800", fontSize: 13 },
  statusFlowWrap:          { flexDirection: "row", gap: 10, marginTop: 16 },
  statusFlowBtn:           { flex: 2, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  statusFlowBtnTxt:        { color: "#fff", fontWeight: "800", fontSize: 14 },
  orderSelesaiInfo:        { backgroundColor: "#DCFCE7", borderRadius: 10, padding: 12, marginTop: 8, alignItems: "center" },
  orderSelesaiTxt:         { fontSize: 13, color: "#166534", fontWeight: "600" },

  returSheet:           { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: "92%" },
  returSheetTitle:      { fontSize: 18, fontWeight: "800", color: "#1E293B", marginBottom: 4, textAlign: "center" },
  returTxInfo:          { fontSize: 12, color: "#64748B", textAlign: "center", marginBottom: 10 },
  returNomorStrukInput: { borderWidth: 1.5, borderColor: "#CBD5E1", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, fontWeight: "700", color: "#1E293B", marginBottom: 12, letterSpacing: 1 },
  returToggleRow:       { flexDirection: "row", gap: 8, marginBottom: 12 },
  returToggleBtn:       { flex: 1, borderWidth: 1.5, borderColor: "#CBD5E1", borderRadius: 10, paddingVertical: 8, alignItems: "center" },
  returToggleBtnActive: { borderColor: ORANGE, backgroundColor: "#FFF7ED" },
  returToggleTxt:       { fontSize: 12, fontWeight: "600", color: "#64748B" },
  returToggleTxtActive: { color: ORANGE, fontWeight: "800" },
  returItemsScroll:     { maxHeight: 200 },
  returItemRow:         { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#F1F5F9", gap: 8 },
  returItemLeft:        { flex: 1 },
  returItemName:        { fontSize: 12, fontWeight: "700", color: "#1E293B" },
  returItemPrice:       { fontSize: 10, color: "#64748B" },
  returItemQtyFixed:    { fontSize: 13, fontWeight: "700", color: "#374151", width: 30, textAlign: "center" },
  returQtyRow:          { flexDirection: "row", alignItems: "center", gap: 4 },
  returQtyBtn:          { width: 24, height: 24, backgroundColor: "#EFF6FF", borderRadius: 6, justifyContent: "center", alignItems: "center" },
  returQtyBtnTxt:       { fontSize: 14, fontWeight: "700", color: ACCENT },
  returQtyTxt:          { fontSize: 13, fontWeight: "700", color: "#1E293B", minWidth: 20, textAlign: "center" },
  returMaxTxt:          { fontSize: 10, color: "#94A3B8" },
  returItemTotal:       { fontSize: 12, fontWeight: "700", color: DANGER, width: 72, textAlign: "right" },
  returTotalRow:        { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, borderTopWidth: 1, borderTopColor: "#E2E8F0", marginTop: 4, marginBottom: 10 },
  returTotalLbl:        { fontSize: 13, fontWeight: "800", color: "#1E293B" },
  returTotalVal:        { fontSize: 15, fontWeight: "800", color: DANGER },
  returAlasanInput:     { borderWidth: 1.5, borderColor: "#CBD5E1", borderRadius: 12, padding: 12, fontSize: 13, color: "#1E293B", marginBottom: 12, minHeight: 60 },
  returActions:         { flexDirection: "row", gap: 10 },
  submitReturBtn:       { flex: 2, backgroundColor: ORANGE, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  submitReturBtnTxt:    { color: "#fff", fontWeight: "800", fontSize: 13 },

  strukSheet:        { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: "92%" },
  strukHeader:       { alignItems: "center", marginBottom: 16 },
  strukCheckmark:    { fontSize: 40, marginBottom: 8 },
  strukSuccessTitle: { fontSize: 18, fontWeight: "800", color: SUCCESS },
  strukTokoName:     { fontSize: 13, color: "#64748B", marginTop: 4 },
  strukBody:         { backgroundColor: "#F8FAFC", borderRadius: 14, padding: 16 },
  strukId:           { fontSize: 12, color: "#64748B", marginBottom: 2 },
  strukTime:         { fontSize: 11, color: "#94A3B8", marginBottom: 10 },
  strukDivider:      { height: 1, backgroundColor: "#E2E8F0", marginVertical: 8 },
  strukItemRow:      { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  strukItemName:     { flex: 1, fontSize: 12, color: "#374151" },
  strukItemQty:      { fontSize: 11, color: "#64748B", width: 30, textAlign: "center" },
  strukItemSubtotal: { fontSize: 12, fontWeight: "700", color: "#1E293B", width: 80, textAlign: "right" },
  strukSumRow:       { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  strukSumLbl:       { fontSize: 12, color: "#64748B" },
  strukSumVal:       { fontSize: 12, fontWeight: "700", color: "#1E293B" },
  strukDiskon:       { fontSize: 12, fontWeight: "700", color: SUCCESS },
  strukTotalRow:     { flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: "#E2E8F0", paddingTop: 8, marginTop: 4, marginBottom: 4 },
  strukTotalLbl:     { fontSize: 14, fontWeight: "800", color: "#1E293B" },
  strukTotalVal:     { fontSize: 16, fontWeight: "800", color: ACCENT },
  strukKembalian:    { fontSize: 12, fontWeight: "700", color: ACCENT },
  strukNotes:        { fontSize: 11, color: ORANGE, marginTop: 6, fontStyle: "italic" },
  strukKasir:        { fontSize: 11, color: "#94A3B8", marginTop: 8, textAlign: "center" },
  strukBtnRow:       { flexDirection: "row", gap: 10, marginTop: 16 },
  strukShareBtn:     { flex: 1, backgroundColor: "#EFF6FF", borderRadius: 12, paddingVertical: 14, alignItems: "center", borderWidth: 1, borderColor: "#BFDBFE" },
  strukShareBtnTxt:  { color: ACCENT, fontWeight: "800", fontSize: 14 },
  strukCloseBtn:     { flex: 2, backgroundColor: ACCENT, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  strukCloseBtnTxt:  { color: "#fff", fontWeight: "800", fontSize: 15 },

  scannerRoot:    { flex: 1, backgroundColor: "#000" },
  scannerHeader:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 52, paddingBottom: 16, paddingHorizontal: 20, backgroundColor: "#000" },
  scannerClose:   { color: "#fff", fontSize: 14, fontWeight: "700" },
  scannerTitle:   { color: "#fff", fontSize: 16, fontWeight: "800" },
  scannerSpacer:  { width: 60 },
  cameraFull:     { flex: 1 },
  scannerFooter:  { backgroundColor: "#000", paddingVertical: 16, alignItems: "center" },
  scannerHint:    { color: "#94A3B8", fontSize: 13 },
});