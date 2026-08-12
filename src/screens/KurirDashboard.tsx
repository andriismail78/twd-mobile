// src/screens/KurirDashboard.tsx
// v7 — fix logout (pakai logout() dari AuthContext), tambah tab GPS

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Linking,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { useAuth } from "../context/AuthContext";
import KurirGPSScreen from "./KurirGPSScreen";

// ─── Types ────────────────────────────────────────────────────────────────────

interface OnlineOrder {
  id: string;
  ownerId: string;
  customerName: string;
  customerPhone?: string;
  customerAddress?: string;
  items: Array<{ productId: string; name: string; price: number; qty: number }>;
  subtotal: number;
  total: number;
  jarakKm?: number;
  ongkirGross?: number;
  status: "menunggu" | "diproses" | "dikirim" | "selesai" | "dibatalkan";
  kurirId?: string;
  kurirName?: string;
  metodeBayar?: string;
  createdAt: string;
  note?: string;
  catatanKasir?: string;
}

interface KurirAccount {
  id: string;
  ownerId: string;
  name: string;
  nama?: string;
  phone?: string;
  verified: boolean;
  rating?: number;
}

interface StoreInfo {
  namaToko?: string;
  tokoName?: string;
}

interface BankAccount {
  namaBank: string;
  nomorRekening: string;
  namaPemilik: string;
}

interface WithdrawalRequest {
  id: string;
  kurirId: string;
  jumlah: number;
  namaBank: string;
  nomorRekening: string;
  namaPemilik: string;
  status: "menunggu" | "diproses" | "selesai" | "ditolak";
  createdAt: string;
  catatan?: string;
}

interface KurirDashboardProps {
  kurirId?: string;
  ownerId?: string;
  onBack?: () => void;
  route?: { params?: { kurirId?: string; ownerId?: string; authUser?: any } };
}

// ─── Formula Ongkir ───────────────────────────────────────────────────────────

const ONGKIR_KM1       = 10000;
const ONGKIR_KM_NEXT   = 3500;
const APP_FEE_PCT      = 0.10;
const MARKETING_OF_FEE = 0.10;
const ADMIN_OF_FEE     = 0.03;
const DEFAULT_JARAK_KM = 3;
const MIN_WITHDRAW     = 50000;

function calcOngkir(jarakKm: number) {
  const km  = Math.max(1, jarakKm);
  const gross = km <= 1 ? ONGKIR_KM1 : ONGKIR_KM1 + Math.round((km - 1) * ONGKIR_KM_NEXT);
  const appFee       = Math.round(gross * APP_FEE_PCT);
  const marketingFee = Math.round(appFee * MARKETING_OF_FEE);
  const adminFee     = Math.round(appFee * ADMIN_OF_FEE);
  const platformFee  = appFee - marketingFee - adminFee;
  const kurirNet     = gross - appFee;
  return { gross, appFee, marketingFee, adminFee, platformFee, kurirNet };
}

function getOrderEarning(order: OnlineOrder) {
  const jarakKm = order.jarakKm ?? DEFAULT_JARAK_KM;
  if (order.ongkirGross) {
    const gross  = order.ongkirGross;
    const appFee = Math.round(gross * APP_FEE_PCT);
    return {
      gross, appFee,
      marketingFee: Math.round(appFee * MARKETING_OF_FEE),
      adminFee:     Math.round(appFee * ADMIN_OF_FEE),
      platformFee:  appFee - Math.round(appFee * MARKETING_OF_FEE) - Math.round(appFee * ADMIN_OF_FEE),
      kurirNet:     gross - appFee,
      jarakKm,
    };
  }
  return { ...calcOngkir(jarakKm), jarakKm };
}

// ─── Storage Keys ─────────────────────────────────────────────────────────────

const ORDERS_KEY       = "@twd_orders";
const KURIR_KEY        = "@twd_kurir_accounts";
const STORE_PFX        = "@twd_store_info_";
const KURIR_ONLINE_PFX = "@twd_kurir_online_";
const KURIR_BANK_PFX   = "@twd_kurir_bank_";
const KURIR_WD_PFX     = "@twd_kurir_wd_";

// ─── Status constants ─────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  menunggu:   "⏳ Menunggu",
  diproses:   "🔄 Diproses",
  dikirim:    "🚚 Dikirim",
  selesai:    "✅ Selesai",
  dibatalkan: "❌ Dibatalkan",
};

const WD_STATUS_LABELS: Record<string, string> = {
  menunggu: "⏳ Menunggu Review",
  diproses: "🔄 Diproses Admin",
  selesai:  "✅ Dana Terkirim",
  ditolak:  "❌ Ditolak",
};

const WD_STATUS_COLORS: Record<string, string> = {
  menunggu: "#f59e0b",
  diproses: "#3b82f6",
  selesai:  "#10b981",
  ditolak:  "#ef4444",
};

const AKTIF_STATUSES:   OnlineOrder["status"][] = ["menunggu", "diproses", "dikirim"];
const RIWAYAT_STATUSES: OnlineOrder["status"][] = ["selesai", "dibatalkan"];

const BADGE_BG: Record<string, { backgroundColor: string }> = {
  menunggu:   { backgroundColor: "#f59e0b" },
  diproses:   { backgroundColor: "#3b82f6" },
  dikirim:    { backgroundColor: "#8b5cf6" },
  selesai:    { backgroundColor: "#10b981" },
  dibatalkan: { backgroundColor: "#ef4444" },
};

const SWITCH_TRACK_COLOR = { false: "#e2e8f0", true: "#10b981" };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRp(n: number): string {
  return "Rp " + Math.round(n).toLocaleString("id-ID");
}
function safeSlice(str?: string, len = -6, fallback = "0000") {
  if (!str || typeof str !== "string") return fallback;
  return str.slice(len).toUpperCase();
}
function formatDate(iso?: string): string {
  if (!iso) return "-";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return (
      d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) +
      " " + d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
    );
  } catch {
    return iso;
  }
}
function getTokoName(ownerId?: string, map: Record<string, string> = {}) {
  if (!ownerId) return "Toko";
  return map[ownerId] ?? "Toko #" + safeSlice(ownerId, -4, "0000");
}
function todayStr()     { return new Date().toISOString().slice(0, 10); }
function thisMonthStr() { return new Date().toISOString().slice(0, 7); }
function genId(pfx: string) { return pfx + "-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6); }
function getStatusBg(status: string) { return BADGE_BG[status] ?? { backgroundColor: "#6b7280" }; }
function renderStars(r: number) {
  const f = Math.floor(r); const h = r - f >= 0.5 ? 1 : 0;
  return "★".repeat(f) + (h ? "½" : "") + "☆".repeat(5 - f - h);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function KurirDashboard(props: KurirDashboardProps) {

  const { user, logout } = useAuth();

  // ── Resolve kurirId ────────────────────────────────────────────────────
  const resolvedKurirId = useMemo(() => {
    if (props.kurirId && String(props.kurirId).trim() !== "") return String(props.kurirId).trim();
    const rp = props.route?.params;
    if (rp?.kurirId && String(rp.kurirId).trim() !== "") return String(rp.kurirId).trim();
    if (rp?.authUser?.kurirId && String(rp.authUser.kurirId).trim() !== "") return String(rp.authUser.kurirId).trim();
    if (rp?.authUser?.id && String(rp.authUser.id).trim() !== "") return String(rp.authUser.id).trim();
    const u = user as any;
    if (u?.kurirId && String(u.kurirId).trim() !== "") return String(u.kurirId).trim();
    if (u?.id && String(u.id).trim() !== "") return String(u.id).trim();
    return "";
  }, [props.kurirId, props.route?.params, user]);

  const idValid = resolvedKurirId !== "";

  // ── State ──────────────────────────────────────────────────────────────
  const [orders,         setOrders]         = useState<OnlineOrder[]>([]);
  const [kurirInfo,      setKurirInfo]       = useState<KurirAccount | null>(null);
  const [storeNames,     setStoreNames]      = useState<Record<string, string>>({});
  const [isOnline,       setIsOnline]        = useState(false);
  const [togglingOnline, setTogglingOnline]  = useState(false);
  const [loading,        setLoading]         = useState(true);
  const [refreshing,     setRefreshing]      = useState(false);
  const [selectedOrder,  setSelectedOrder]   = useState<OnlineOrder | null>(null);
  const [detailVisible,  setDetailVisible]   = useState(false);
  const [activeTab,      setActiveTab]       = useState<"aktif" | "riwayat" | "pendapatan" | "pencairan" | "gps">("aktif");

  // Rekening bank
  const [bankAccount,  setBankAccount]  = useState<BankAccount | null>(null);
  const [showBankModal,setShowBankModal] = useState(false);
  const [bankInput,    setBankInput]    = useState<BankAccount>({ namaBank: "", nomorRekening: "", namaPemilik: "" });

  // Pencairan
  const [withdrawals,  setWithdrawals]  = useState<WithdrawalRequest[]>([]);
  const [showWdModal,  setShowWdModal]  = useState(false);
  const [wdJumlah,     setWdJumlah]    = useState("");

  // Bukti foto pengiriman
  const [showBuktiModal, setShowBuktiModal] = useState(false);
  const [selectedOrderBukti, setSelectedOrderBukti] = useState<OnlineOrder | null>(null);
  const [fotoBuktiUri, setFotoBuktiUri] = useState<string>("");
  const [submittingBukti, setSubmittingBukti] = useState(false);

  // ── Load store names ───────────────────────────────────────────────────
  const loadStoreNames = useCallback(async (ownerIds: string[]) => {
    const map: Record<string, string> = {};
    await Promise.all(ownerIds.map(async (oid) => {
      try {
        const raw = await AsyncStorage.getItem(STORE_PFX + oid);
        if (raw) {
          const info: StoreInfo = JSON.parse(raw);
          map[oid] = info.namaToko ?? info.tokoName ?? "Toko #" + safeSlice(oid, -4, "0000");
        } else { map[oid] = "Toko #" + safeSlice(oid, -4, "0000"); }
      } catch { map[oid] = "Toko #" + safeSlice(oid, -4, "0000"); }
    }));
    setStoreNames(map);
  }, []);

  // ── Load semua data ────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!idValid) { setLoading(false); return; }
    try {
      const rawKurir = await AsyncStorage.getItem(KURIR_KEY);
      const allKurir: KurirAccount[] = rawKurir ? JSON.parse(rawKurir) : [];
      setKurirInfo(allKurir.find((k) => String(k.id).trim() === resolvedKurirId) ?? null);

      const rawOnline = await AsyncStorage.getItem(KURIR_ONLINE_PFX + resolvedKurirId);
      setIsOnline(rawOnline === "true");

      const rawOrders = await AsyncStorage.getItem(ORDERS_KEY);
      const allOrders: OnlineOrder[] = rawOrders ? JSON.parse(rawOrders) : [];
      const myOrders = allOrders
        .filter((o) => {
          const matchId = String(o.kurirId ?? "").trim() === resolvedKurirId;
          const matchName =
            !!o.kurirName &&
            !!(kurirInfo?.nama || kurirInfo?.name || (user as any)?.name) &&
            String(o.kurirName).trim().toLowerCase() ===
              String(kurirInfo?.nama || kurirInfo?.name || (user as any)?.name).trim().toLowerCase();
          const isAssigned = o.status === "diproses" || o.status === "dikirim";
          return matchId || matchName || isAssigned;
        })
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setOrders(myOrders);

      const uniqueOwnerIds = Array.from(new Set(myOrders.map((o) => o.ownerId).filter(Boolean)));
      await loadStoreNames(uniqueOwnerIds);

      const rawBank = await AsyncStorage.getItem(KURIR_BANK_PFX + resolvedKurirId);
      setBankAccount(rawBank ? JSON.parse(rawBank) : null);

      const rawWd = await AsyncStorage.getItem(KURIR_WD_PFX + resolvedKurirId);
      const allWd: WithdrawalRequest[] = rawWd ? JSON.parse(rawWd) : [];
      setWithdrawals(allWd.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch (e) { console.error("KurirDashboard loadData:", e); }
    finally { setLoading(false); setRefreshing(false); }
  }, [resolvedKurirId, idValid, loadStoreNames]);

  useEffect(() => { loadData(); }, [loadData]);
  function onRefresh() { setRefreshing(true); loadData(); }

  // ── Toggle Online ─────────────────────────────────────────────────────
  function handleToggleOnline() {
    const newVal = !isOnline;
    Alert.alert(
      newVal ? "🟢 Aktifkan?" : "🔴 Nonaktifkan?",
      newVal ? "Kamu akan mulai menerima pesanan." : "Kamu tidak akan menerima pesanan baru.",
      [
        { text: "Batal", style: "cancel" },
        { text: newVal ? "ONLINE" : "OFFLINE", onPress: async () => {
          setTogglingOnline(true);
          try { await AsyncStorage.setItem(KURIR_ONLINE_PFX + resolvedKurirId, String(newVal)); setIsOnline(newVal); }
          catch { Alert.alert("Error", "Gagal mengubah status."); }
          finally { setTogglingOnline(false); }
        }},
      ],
    );
  }

  // ── LOGOUT ────────────────────────────────────────────────────────────
  function handleLogout() {
    Alert.alert(
      "⏏ Logout",
      "Yakin ingin keluar? Status akan otomatis menjadi OFFLINE.",
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Ya, Logout",
          style: "destructive",
          onPress: async () => {
            // Set offline dulu sebelum logout
            try { await AsyncStorage.setItem(KURIR_ONLINE_PFX + resolvedKurirId, "false"); } catch {}
            logout();
          },
        },
      ],
    );
  }

  // ── Update status order ────────────────────────────────────────────────
  async function updateOrderStatus(orderId: string, newStatus: OnlineOrder["status"]) {
    try {
      const rawOrders = await AsyncStorage.getItem(ORDERS_KEY);
      const allOrders: OnlineOrder[] = rawOrders ? JSON.parse(rawOrders) : [];
      await AsyncStorage.setItem(
        ORDERS_KEY,
        JSON.stringify(allOrders.map((o) => o.id === orderId ? { ...o, status: newStatus } : o)),
      );
      await loadData();
      setSelectedOrder((prev) => prev && prev.id === orderId ? { ...prev, status: newStatus } : prev);
      Alert.alert("Berhasil ✅", STATUS_LABELS[newStatus] ?? newStatus);
    } catch { Alert.alert("Error", "Gagal memperbarui status."); }
  }

  function confirmUpdateStatus(order: OnlineOrder, newStatus: OnlineOrder["status"]) {
    Alert.alert(
      "Konfirmasi",
      "Ubah #" + safeSlice(order.id, -6, "ORDER") + " → " + (STATUS_LABELS[newStatus] ?? newStatus) + "?",
      [{ text: "Batal", style: "cancel" }, { text: "Ya", onPress: () => updateOrderStatus(order.id, newStatus) }],
    );
  }

  function openDetail(o: OnlineOrder) { setSelectedOrder(o); setDetailVisible(true); }

  // ── Pemandu Arah Google Maps (Turn-by-Turn Driving Navigation) ─────────
  function bukaNavigasiDashboard(address?: string) {
    if (!address || !address.trim()) {
      Alert.alert("Alamat Kosong", "Pesanan ini tidak memiliki alamat tujuan yang jelas.");
      return;
    }
    const destination = encodeURIComponent(address.trim());
    const googleMapsDirUrl = `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`;

    if (Platform.OS === "android") {
      const androidNavIntent = `google.navigation:q=${destination}&mode=d`;
      Linking.canOpenURL(androidNavIntent)
        .then((ok) => {
          if (ok) return Linking.openURL(androidNavIntent);
          return Linking.openURL(googleMapsDirUrl);
        })
        .catch(() => Linking.openURL(googleMapsDirUrl));
      return;
    }

    if (Platform.OS === "ios") {
      const iosGoogleMaps = `comgooglemaps://?daddr=${destination}&directionsmode=driving`;
      Linking.canOpenURL(iosGoogleMaps)
        .then((ok) => {
          if (ok) return Linking.openURL(iosGoogleMaps);
          return Linking.openURL(googleMapsDirUrl);
        })
        .catch(() => Linking.openURL(googleMapsDirUrl));
      return;
    }

    Linking.openURL(googleMapsDirUrl);
  }

  // ── 1. Kurir ambil orderan dari Kasir ─────────────────────────────────
  async function handleAmbilOrder(order: OnlineOrder) {
    try {
      const raw = await AsyncStorage.getItem(ORDERS_KEY);
      const all: OnlineOrder[] = raw ? JSON.parse(raw) : [];
      const myName = kurirInfo?.name || kurirInfo?.nama || (user as any)?.name || "Kurir";
      const updated = all.map((o) =>
        o.id === order.id
          ? {
              ...o,
              kurirId: resolvedKurirId || "kurir_1",
              kurirName: myName,
              waktuDiambil: new Date().toISOString(),
            }
          : o,
      );
      await AsyncStorage.setItem(ORDERS_KEY, JSON.stringify(updated));
      await loadData();
      Alert.alert("Berhasil Diambil 🙋‍♂️", "Order pesanan untuk " + order.customerName + " telah Anda ambil!");
    } catch {
      Alert.alert("Error", "Gagal mengambil order.");
    }
  }

  // ── 2. Kurir mulai antar / barang sudah dibawa dari toko ───────────────
  async function handleMulaiAntar(order: OnlineOrder) {
    Alert.alert(
      "🚚 Mulai Antar Barang",
      "Tandai bahwa barang pesanan untuk " + order.customerName + " sudah dibawa dari Kasir dan sedang dikirim?",
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Ya, Mulai Antar",
          onPress: async () => {
            try {
              const raw = await AsyncStorage.getItem(ORDERS_KEY);
              const all: OnlineOrder[] = raw ? JSON.parse(raw) : [];
              const updated = all.map((o) =>
                o.id === order.id
                  ? {
                      ...o,
                      status: "dikirim" as const,
                      waktuDikirim: new Date().toISOString(),
                    }
                  : o,
              );
              await AsyncStorage.setItem(ORDERS_KEY, JSON.stringify(updated));
              await loadData();
              Alert.alert("Status Diperbarui 🚚", "Barang ditandai sedang dikirim ke alamat customer.");
            } catch {
              Alert.alert("Error", "Gagal memperbarui status.");
            }
          },
        },
      ],
    );
  }

  // ── 3. Pilih foto bukti pengiriman (Kamera / Galeri) ───────────────────
  async function pickBuktiFoto(source: "kamera" | "galeri") {
    try {
      if (source === "kamera") {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (perm.status !== "granted") {
          Alert.alert("Izin Kamera", "Izin kamera diperlukan untuk mengambil foto bukti pengiriman.");
          return;
        }
        const res = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.6,
        });
        if (!res.canceled && res.assets && res.assets.length > 0) {
          setFotoBuktiUri(res.assets[0].uri);
        }
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (perm.status !== "granted") {
          Alert.alert("Izin Galeri", "Izin galeri diperlukan untuk memilih foto bukti pengiriman.");
          return;
        }
        const res = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.6,
        });
        if (!res.canceled && res.assets && res.assets.length > 0) {
          setFotoBuktiUri(res.assets[0].uri);
        }
      }
    } catch (e) {
      console.error("pickBuktiFoto:", e);
      Alert.alert("Error", "Gagal membuka kamera/galeri.");
    }
  }

  // ── 4. Selesaikan pesanan beserta bukti foto ───────────────────────────
  async function handleSelesaikanDenganBukti() {
    if (!selectedOrderBukti) return;
    if (!fotoBuktiUri) {
      Alert.alert("Bukti Foto Wajib ⚠️", "Anda harus mengunggah bukti foto pengiriman barang sebelum pesanan diselesaikan.");
      return;
    }
    setSubmittingBukti(true);
    try {
      const raw = await AsyncStorage.getItem(ORDERS_KEY);
      const all: OnlineOrder[] = raw ? JSON.parse(raw) : [];
      const updated = all.map((o) =>
        o.id === selectedOrderBukti.id
          ? {
              ...o,
              status: "selesai" as const,
              fotoBuktiKirim: fotoBuktiUri,
              waktuSelesai: new Date().toISOString(),
            }
          : o,
      );
      await AsyncStorage.setItem(ORDERS_KEY, JSON.stringify(updated));
      setShowBuktiModal(false);
      setFotoBuktiUri("");
      setSelectedOrderBukti(null);
      await loadData();
      Alert.alert("Pengiriman Selesai ✅", "Bukti foto pengiriman berhasil disimpan dan pesanan telah selesai.");
    } catch {
      Alert.alert("Error", "Gagal menyelesaikan pesanan.");
    } finally {
      setSubmittingBukti(false);
    }
  }

  function handleCall(phone: string) {
    Linking.canOpenURL("tel:" + phone).then((can) => {
      if (can) Linking.openURL("tel:" + phone);
      else Alert.alert("Tidak Bisa Menelepon");
    });
  }

  // ── Simpan rekening bank ───────────────────────────────────────────────
  async function handleSaveBank() {
    if (!bankInput.namaBank.trim() || !bankInput.nomorRekening.trim() || !bankInput.namaPemilik.trim()) {
      Alert.alert("Lengkapi Data", "Semua field rekening harus diisi.");
      return;
    }
    try {
      await AsyncStorage.setItem(KURIR_BANK_PFX + resolvedKurirId, JSON.stringify(bankInput));
      setBankAccount({ ...bankInput });
      setShowBankModal(false);
      Alert.alert("Berhasil ✅", "Rekening bank tersimpan.");
    } catch { Alert.alert("Error", "Gagal menyimpan rekening."); }
  }

  // ── Computed ──────────────────────────────────────────────────────────
  const completedOrders = useMemo(() => orders.filter((o) => o.status === "selesai"), [orders]);
  const totalEarned     = useMemo(() => completedOrders.reduce((s, o) => s + getOrderEarning(o).kurirNet, 0), [completedOrders]);
  const totalWithdrawn  = useMemo(() => withdrawals.filter((w) => w.status === "selesai").reduce((s, w) => s + w.jumlah, 0), [withdrawals]);
  const pendingWd       = useMemo(() => withdrawals.filter((w) => w.status === "menunggu" || w.status === "diproses").reduce((s, w) => s + w.jumlah, 0), [withdrawals]);
  const saldoBisa       = useMemo(() => Math.max(0, totalEarned - totalWithdrawn - pendingWd), [totalEarned, totalWithdrawn, pendingWd]);

  const ordersToday     = useMemo(() => completedOrders.filter((o) => (o.createdAt || "").slice(0, 10) === todayStr()), [completedOrders]);
  const ordersThisMonth = useMemo(() => completedOrders.filter((o) => (o.createdAt || "").slice(0, 7) === thisMonthStr()), [completedOrders]);
  const saldoToday      = useMemo(() => ordersToday.reduce((s, o) => s + getOrderEarning(o).kurirNet, 0), [ordersToday]);
  const saldoMonth      = useMemo(() => ordersThisMonth.reduce((s, o) => s + getOrderEarning(o).kurirNet, 0), [ordersThisMonth]);
  const successRate     = useMemo(() => {
    const t = orders.filter((o) => o.status === "selesai" || o.status === "dibatalkan").length;
    return t === 0 ? 100 : Math.round((completedOrders.length / t) * 100);
  }, [orders, completedOrders]);

  const aktifOrders    = useMemo(() => orders.filter((o) => AKTIF_STATUSES.includes(o.status)), [orders]);
  const riwayatOrders  = useMemo(() => orders.filter((o) => RIWAYAT_STATUSES.includes(o.status)), [orders]);
  const filteredOrders = useMemo(() => activeTab === "aktif" ? aktifOrders : riwayatOrders, [activeTab, aktifOrders, riwayatOrders]);
  const totalAktif     = useMemo(() => aktifOrders.length, [aktifOrders]);
  const totalDiproses  = useMemo(() => orders.filter((o) => o.status === "diproses").length, [orders]);
  const totalDikirim   = useMemo(() => orders.filter((o) => o.status === "dikirim").length, [orders]);
  const sedangMengantar = useMemo(() => orders.filter((o) => o.status === "dikirim"), [orders]);
  const tokoCount      = useMemo(() => new Set(orders.map((o) => o.ownerId)).size, [orders]);

  // ── Request pencairan ─────────────────────────────────────────────────
  function handleRequestWithdraw() {
    if (!bankAccount) { Alert.alert("Rekening Belum Diatur", "Tambahkan rekening bank dulu."); setShowBankModal(true); return; }
    const jumlah = Number(wdJumlah.replace(/\D/g, ""));
    if (!jumlah || jumlah < MIN_WITHDRAW) { Alert.alert("Jumlah Kurang", "Minimum pencairan " + formatRp(MIN_WITHDRAW) + "."); return; }
    if (jumlah > saldoBisa) { Alert.alert("Saldo Tidak Cukup", "Saldo yang bisa dicairkan: " + formatRp(saldoBisa) + "."); return; }
    Alert.alert(
      "Konfirmasi Pencairan",
      "Cairkan " + formatRp(jumlah) + " ke:\n" +
      bankAccount.namaBank + "\n" + bankAccount.nomorRekening + "\na.n. " + bankAccount.namaPemilik + "\n\nDana diproses 1×24 jam.",
      [
        { text: "Batal", style: "cancel" },
        { text: "Cairkan", onPress: async () => {
          try {
            const wd: WithdrawalRequest = {
              id: genId("wd"),
              kurirId: resolvedKurirId,
              jumlah,
              namaBank: bankAccount.namaBank,
              nomorRekening: bankAccount.nomorRekening,
              namaPemilik: bankAccount.namaPemilik,
              status: "menunggu",
              createdAt: new Date().toISOString(),
            };
            const rawWd = await AsyncStorage.getItem(KURIR_WD_PFX + resolvedKurirId);
            const allWd: WithdrawalRequest[] = rawWd ? JSON.parse(rawWd) : [];
            await AsyncStorage.setItem(KURIR_WD_PFX + resolvedKurirId, JSON.stringify([wd, ...allWd]));
            setShowWdModal(false);
            setWdJumlah("");
            await loadData();
            Alert.alert("Permintaan Terkirim ✅", "Pencairan " + formatRp(jumlah) + " sedang diproses.");
          } catch { Alert.alert("Error", "Gagal mengajukan pencairan."); }
        }},
      ],
    );
  }

  // ── Loading ────────────────────────────────────────────────────────────
  if (loading) {
    return <View style={S.center}><ActivityIndicator size="large" color="#6366f1" /></View>;
  }

  if (!idValid) {
    return (
      <View style={S.center}>
        <Text style={S.emptyText}>{"⚠️ Data kurir tidak terdeteksi."}</Text>
        <Text style={S.emptyTextSub}>{"Silakan login ulang dari halaman utama."}</Text>
        {props.onBack && <TouchableOpacity style={S.btnPurple} onPress={props.onBack}><Text style={S.btnPurpleTxt}>{"← Kembali"}</Text></TouchableOpacity>}
      </View>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════

  return (
    <View style={S.container}>

      {/* ── Header ── */}
      <View style={S.header}>
        <View style={S.headerTopRow}>
          {props.onBack && (
            <TouchableOpacity onPress={props.onBack}>
              <Text style={S.backBtnText}>{"< Kembali"}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={S.logoutBtn} onPress={handleLogout}>
            <Text style={S.logoutBtnTxt}>{"⏏ Logout"}</Text>
          </TouchableOpacity>
        </View>
        <View style={S.profileRow}>
          <View style={S.avatarCircle}>
            <Text style={S.avatarTxt}>{(kurirInfo?.name ?? "K").charAt(0).toUpperCase()}</Text>
          </View>
          <View style={S.profileInfo}>
            <Text style={S.profileName}>{kurirInfo?.name ?? "Kurir"}</Text>
            {kurirInfo?.phone ? <Text style={S.profilePhone}>{"📞 " + kurirInfo.phone}</Text> : null}
            <View style={S.profileBadgeRow}>
              <Text style={S.ratingTxt}>{renderStars(kurirInfo?.rating ?? 5.0) + " " + (kurirInfo?.rating?.toFixed(1) ?? "5.0")}</Text>
              <View style={S.tokoCountBadge}><Text style={S.tokoCountTxt}>{"🏪 " + tokoCount + " toko"}</Text></View>
            </View>
          </View>
          <View style={S.onlineToggleBox}>
            <Text style={isOnline ? S.onlineLbl : S.offlineLbl}>{isOnline ? "🟢 ONLINE" : "🔴 OFFLINE"}</Text>
            <Switch value={isOnline} onValueChange={handleToggleOnline} disabled={togglingOnline} trackColor={SWITCH_TRACK_COLOR} thumbColor={isOnline ? "#fff" : "#f4f4f5"} />
          </View>
        </View>
      </View>

      {/* ── Banner Sedang Mengantar ── */}
      {sedangMengantar.length > 0 && (
        <View style={S.menghantarBanner}>
          <Text style={S.menghantarIcon}>{"🚚"}</Text>
          <View style={S.menghantarInfo}>
            <Text style={S.menghantarTitle}>{"Sedang Mengantar " + sedangMengantar.length + " pesanan"}</Text>
            <Text style={S.menghantarSub} numberOfLines={1}>{sedangMengantar.map((o) => o.customerName).join(", ")}</Text>
          </View>
          <TouchableOpacity style={S.menghantarBtn} onPress={() => setActiveTab("aktif")}>
            <Text style={S.menghantarBtnTxt}>{"Lihat"}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Saldo Card ── */}
      <View style={S.saldoCard}>
        <View style={S.saldoMain}>
          <Text style={S.saldoLbl}>{"Saldo Bisa Dicairkan"}</Text>
          <Text style={S.saldoVal}>{formatRp(saldoBisa)}</Text>
          <View style={S.saldoActionRow}>
            <TouchableOpacity style={S.cairBtn} onPress={() => { setActiveTab("pencairan"); setShowWdModal(true); }}>
              <Text style={S.cairBtnTxt}>{"💸 Cairkan Dana"}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={S.rekeningBtn} onPress={() => { if (bankAccount) setBankInput({ ...bankAccount }); setShowBankModal(true); }}>
              <Text style={S.rekeningBtnTxt}>{bankAccount ? "🏦 Edit Rekening" : "🏦 Tambah Rekening"}</Text>
            </TouchableOpacity>
          </View>
          {pendingWd > 0 && <Text style={S.pendingWdTxt}>{"⏳ Pending pencairan: " + formatRp(pendingWd)}</Text>}
        </View>
        <View style={S.saldoDivider} />
        <View style={S.saldoSecondary}>
          <View style={S.saldoSecItem}><Text style={S.saldoSecLbl}>{"Hari Ini"}</Text><Text style={S.saldoSecVal}>{formatRp(saldoToday)}</Text></View>
          <View style={S.saldoSecItem}><Text style={S.saldoSecLbl}>{"Bulan Ini"}</Text><Text style={S.saldoSecVal}>{formatRp(saldoMonth)}</Text></View>
          <View style={S.saldoSecItem}><Text style={S.saldoSecLbl}>{"Total Cair"}</Text><Text style={S.saldoSecVal}>{formatRp(totalWithdrawn)}</Text></View>
          <View style={S.saldoSecItem}><Text style={S.saldoSecLbl}>{"Sukses"}</Text><Text style={S.saldoSecVal}>{String(successRate) + "%"}</Text></View>
        </View>
        {bankAccount && (
          <View style={S.bankInfoStrip}>
            <Text style={S.bankInfoTxt}>{"🏦 " + bankAccount.namaBank + " · " + bankAccount.nomorRekening + " · a.n. " + bankAccount.namaPemilik}</Text>
          </View>
        )}
      </View>

      {/* ── Stats ── */}
      <View style={S.statsRow}>
        <View style={S.statCard}><Text style={S.statNum}>{String(totalDiproses)}</Text><Text style={S.statLabel}>{"Diproses"}</Text></View>
        <View style={S.statCard}><Text style={S.statNum}>{String(totalDikirim)}</Text><Text style={S.statLabel}>{"Dikirim"}</Text></View>
        <View style={S.statCard}><Text style={S.statNum}>{String(ordersToday.length)}</Text><Text style={S.statLabel}>{"Selesai Hari Ini"}</Text></View>
        <View style={S.statCard}><Text style={S.statNum}>{String(orders.length)}</Text><Text style={S.statLabel}>{"Total Tugas"}</Text></View>
      </View>

      {/* ── Tabs ── */}
      <View style={S.tabRow}>
        {(["aktif", "riwayat", "pendapatan", "pencairan", "gps"] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={activeTab === tab ? S.tabActive : S.tabInactive}
            onPress={() => setActiveTab(tab)}
          >
            <View style={S.tabInner}>
              <Text style={activeTab === tab ? S.tabTextActive : S.tabTextInactive}>
                {tab === "aktif" ? "Aktif" : tab === "riwayat" ? "Riwayat" : tab === "pendapatan" ? "💰" : tab === "pencairan" ? "💸" : "📍"}
              </Text>
              {tab === "aktif" && totalAktif > 0 && (
                <View style={S.tabBadge}><Text style={S.tabBadgeTxt}>{String(totalAktif)}</Text></View>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* ════ TAB GPS ════════════════════════════════════════════════════ */}
      {activeTab === "gps" && (
        <View style={S.gpsContainer}>
          <KurirGPSScreen kurirId={resolvedKurirId} />
        </View>
      )}

      {/* ════ TAB PENCAIRAN ══════════════════════════════════════════════ */}
      {activeTab === "pencairan" && (
        <ScrollView style={S.pendapatanScroll} contentContainerStyle={S.pendapatanContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
          <View style={S.wdSaldoCard}>
            <Text style={S.wdSaldoLbl}>{"Saldo Bisa Dicairkan"}</Text>
            <Text style={S.wdSaldoVal}>{formatRp(saldoBisa)}</Text>
            {pendingWd > 0 && <Text style={S.wdPendingTxt}>{"⏳ Dalam proses: " + formatRp(pendingWd)}</Text>}
            <Text style={S.wdTotalTxt}>{"Total pendapatan: " + formatRp(totalEarned) + " · Sudah cair: " + formatRp(totalWithdrawn)}</Text>
          </View>
          {bankAccount ? (
            <View style={S.wdBankCard}>
              <View style={S.wdBankLeft}>
                <Text style={S.wdBankTitle}>{"🏦 Rekening Tujuan"}</Text>
                <Text style={S.wdBankName}>{bankAccount.namaBank}</Text>
                <Text style={S.wdBankNum}>{bankAccount.nomorRekening}</Text>
                <Text style={S.wdBankOwner}>{"a.n. " + bankAccount.namaPemilik}</Text>
              </View>
              <TouchableOpacity style={S.wdBankEditBtn} onPress={() => { setBankInput({ ...bankAccount }); setShowBankModal(true); }}>
                <Text style={S.wdBankEditTxt}>{"✏️ Edit"}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={S.wdNoBankCard} onPress={() => { setBankInput({ namaBank: "", nomorRekening: "", namaPemilik: "" }); setShowBankModal(true); }}>
              <Text style={S.wdNoBankTxt}>{"+ Tambahkan Rekening Bank"}</Text>
              <Text style={S.wdNoBankSub}>{"Diperlukan untuk mencairkan dana"}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={saldoBisa >= MIN_WITHDRAW && bankAccount ? S.cairBtnBig : S.cairBtnBigDisabled}
            onPress={() => setShowWdModal(true)}
            disabled={saldoBisa < MIN_WITHDRAW || !bankAccount}
          >
            <Text style={S.cairBtnBigTxt}>
              {!bankAccount ? "⚠️ Tambah Rekening Dulu" : saldoBisa < MIN_WITHDRAW ? ("Minimum " + formatRp(MIN_WITHDRAW)) : "💸 Cairkan Dana"}
            </Text>
          </TouchableOpacity>
          <Text style={S.earningsSectionTitle}>{"Riwayat Pencairan"}</Text>
          {withdrawals.length === 0 ? (
            <View style={S.emptyBox}><Text style={S.emptyText}>{"Belum ada pencairan."}</Text></View>
          ) : (
            withdrawals.map((wd) => (
              <View key={wd.id} style={S.wdItemCard}>
                <View style={S.wdItemLeft}>
                  <Text style={S.wdItemId}>{"#" + safeSlice(wd.id, -8, "WD")}</Text>
                  <Text style={S.wdItemBank}>{wd.namaBank + " · " + wd.nomorRekening}</Text>
                  <Text style={S.wdItemOwner}>{"a.n. " + wd.namaPemilik}</Text>
                  <Text style={S.wdItemDate}>{formatDate(wd.createdAt)}</Text>
                  {wd.catatan ? <Text style={S.wdItemCatatan}>{wd.catatan}</Text> : null}
                </View>
                <View style={S.wdItemRight}>
                  <Text style={S.wdItemJumlah}>{formatRp(wd.jumlah)}</Text>
                  <View style={[S.wdStatusBadge, { backgroundColor: (WD_STATUS_COLORS[wd.status] ?? "#6b7280") + "20" }]}>
                    <Text style={[S.wdStatusTxt, { color: WD_STATUS_COLORS[wd.status] ?? "#6b7280" }]}>
                      {WD_STATUS_LABELS[wd.status] ?? wd.status}
                    </Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* ════ TAB PENDAPATAN ═════════════════════════════════════════════ */}
      {activeTab === "pendapatan" && (
        <ScrollView style={S.pendapatanScroll} contentContainerStyle={S.pendapatanContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
          <View style={S.earningsSummaryCard}>
            <Text style={S.earningsSummaryTitle}>{"💰 Ringkasan Pendapatan Bersih"}</Text>
            <View style={S.earningsSummaryRow}>
              <View style={S.earningsSummaryItem}><Text style={S.earningsSummaryLbl}>{"Hari Ini"}</Text><Text style={S.earningsSummaryVal}>{formatRp(saldoToday)}</Text><Text style={S.earningsSummaryCount}>{String(ordersToday.length) + " order"}</Text></View>
              <View style={S.earningsSumDivider} />
              <View style={S.earningsSummaryItem}><Text style={S.earningsSummaryLbl}>{"Bulan Ini"}</Text><Text style={S.earningsSummaryVal}>{formatRp(saldoMonth)}</Text><Text style={S.earningsSummaryCount}>{String(ordersThisMonth.length) + " order"}</Text></View>
              <View style={S.earningsSumDivider} />
              <View style={S.earningsSummaryItem}><Text style={S.earningsSummaryLbl}>{"Total"}</Text><Text style={S.earningsSummaryVal}>{formatRp(totalEarned)}</Text><Text style={S.earningsSummaryCount}>{String(completedOrders.length) + " order"}</Text></View>
            </View>
          </View>
          <View style={S.formulaCard}>
            <Text style={S.formulaTitle}>{"📐 Formula Ongkir"}</Text>
            <View style={S.formulaRow}><Text style={S.formulaLbl}>{"1 km pertama"}</Text><Text style={S.formulaVal}>{formatRp(ONGKIR_KM1)}</Text></View>
            <View style={S.formulaRow}><Text style={S.formulaLbl}>{"Setiap km berikutnya"}</Text><Text style={S.formulaVal}>{formatRp(ONGKIR_KM_NEXT) + " / km"}</Text></View>
            <View style={S.formulaDivider} />
            <View style={S.formulaRow}><Text style={S.formulaLbl}>{"Biaya aplikasi"}</Text><Text style={S.formulaValMinus}>{"-10%"}</Text></View>
            <View style={S.formulaRow}><Text style={S.formulaLblSub}>{"  └ Marketing (10% dari fee)"}</Text><Text style={S.formulaValSub}>{"= 1%"}</Text></View>
            <View style={S.formulaRow}><Text style={S.formulaLblSub}>{"  └ Admin (3% dari fee)"}</Text><Text style={S.formulaValSub}>{"= 0.3%"}</Text></View>
            <View style={S.formulaRow}><Text style={S.formulaLblSub}>{"  └ Platform (87% dari fee)"}</Text><Text style={S.formulaValSub}>{"= 8.7%"}</Text></View>
            <View style={S.formulaDivider} />
            <View style={S.formulaRow}><Text style={S.formulaLblTotal}>{"Kamu dapat (bersih)"}</Text><Text style={S.formulaValTotal}>{"90% dari ongkir"}</Text></View>
            <View style={S.formulaExample}><Text style={S.formulaExampleTxt}>{"Contoh 3 km:\nOngkir = " + formatRp(calcOngkir(3).gross) + " → Kamu dapat " + formatRp(calcOngkir(3).kurirNet)}</Text></View>
          </View>
          <Text style={S.earningsSectionTitle}>{"Riwayat Per Order"}</Text>
          {completedOrders.length === 0 ? (
            <View style={S.emptyBox}><Text style={S.emptyText}>{"Belum ada pendapatan."}</Text></View>
          ) : (
            completedOrders.map((order) => {
              const earn = getOrderEarning(order);
              return (
                <View key={order.id} style={S.earningsItemCard}>
                  <View style={S.earningsItemLeft}>
                    <Text style={S.earningsItemId}>{"#" + safeSlice(order.id, -6, "ORDER")}</Text>
                    <Text style={S.earningsItemCustomer}>{order.customerName}</Text>
                    <Text style={S.earningsItemToko}>{"🏪 " + getTokoName(order.ownerId, storeNames)}</Text>
                    <Text style={S.earningsItemJarak}>{"📍 " + earn.jarakKm + " km" + (order.jarakKm ? "" : " (estimasi)")}</Text>
                    <Text style={S.earningsItemDate}>{formatDate(order.createdAt)}</Text>
                    <View style={S.breakdownRow}><Text style={S.breakdownLbl}>{"Ongkir kotor"}</Text><Text style={S.breakdownVal}>{formatRp(earn.gross)}</Text></View>
                    <View style={S.breakdownRow}><Text style={S.breakdownLblMinus}>{"Biaya app (10%)"}</Text><Text style={S.breakdownValMinus}>{"-" + formatRp(earn.appFee)}</Text></View>
                  </View>
                  <View style={S.earningsItemRight}>
                    <Text style={S.earningsItemAmount}>{"+" + formatRp(earn.kurirNet)}</Text>
                    <View style={S.earningsItemSelesaiBadge}><Text style={S.earningsItemSelesaiTxt}>{"✅ Selesai"}</Text></View>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      {/* ════ TAB AKTIF & RIWAYAT ════════════════════════════════════════ */}
      {(activeTab === "aktif" || activeTab === "riwayat") && (
        <>
          {activeTab === "aktif" && !isOnline && (
            <View style={S.offlineBanner}>
              <Text style={S.offlineBannerTxt}>{"🔴 OFFLINE — aktifkan untuk menerima pesanan baru"}</Text>
              <TouchableOpacity style={S.offlineBannerBtn} onPress={handleToggleOnline}><Text style={S.offlineBannerBtnTxt}>{"Aktifkan"}</Text></TouchableOpacity>
            </View>
          )}
          {filteredOrders.length === 0 ? (
            <View style={S.emptyBox}><Text style={S.emptyText}>{activeTab === "aktif" ? "Tidak ada pesanan aktif." : "Belum ada riwayat."}</Text></View>
          ) : (
            <FlatList
              data={filteredOrders}
              keyExtractor={(item) => item.id}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
              contentContainerStyle={S.listContent}
              renderItem={({ item }) => {
                const earn = getOrderEarning(item);
                return (
                  <TouchableOpacity style={S.orderCard} onPress={() => openDetail(item)} activeOpacity={0.85}>
                    <View style={S.tokoStrip}>
                      <Text style={S.tokoStripTxt}>{"🏪 " + getTokoName(item.ownerId, storeNames)}</Text>
                      <Text style={S.earningBadge}>{"+" + formatRp(earn.kurirNet)}</Text>
                    </View>
                    <View style={S.orderCardTop}>
                      <Text style={S.orderId}>{"#" + safeSlice(item.id, -6, "ORDER")}</Text>
                      <View style={[S.statusBadge, getStatusBg(item.status)]}><Text style={S.statusBadgeText}>{STATUS_LABELS[item.status] ?? item.status}</Text></View>
                    </View>
                    <Text style={S.customerName}>{item.customerName}</Text>
                    {Boolean(item.customerPhone) && (
                      <TouchableOpacity style={S.phoneRow} onPress={() => handleCall(item.customerPhone!)}>
                        <Text style={S.phoneText}>{"📞 " + item.customerPhone}</Text>
                        <View style={S.callBadge}><Text style={S.callBadgeTxt}>{"Telpon"}</Text></View>
                      </TouchableOpacity>
                    )}
                    <View style={{ backgroundColor: "#EFF6FF", borderRadius: 10, padding: 10, marginTop: 8, marginBottom: 8, borderWidth: 1, borderColor: "#BFDBFE" }}>
                      <Text style={{ fontSize: 11, fontWeight: "800", color: "#1E40AF", marginBottom: 2 }}>{"📍 TUJUAN PENGIRIMAN:"}</Text>
                      <Text style={{ fontSize: 13, fontWeight: "700", color: "#1E293B", lineHeight: 18 }}>
                        {item.customerAddress || "Alamat tidak dicantumkan (Hubungi Customer)"}
                      </Text>
                      {Boolean(item.customerAddress) && (
                        <TouchableOpacity
                          style={{ marginTop: 8, backgroundColor: "#2563EB", borderRadius: 8, paddingVertical: 8, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 6 }}
                          onPress={(e) => {
                            e.stopPropagation();
                            bukaNavigasiDashboard(item.customerAddress);
                          }}
                        >
                          <Text style={{ color: "#fff", fontWeight: "800", fontSize: 12 }}>{"🗺 Buka Pemandu Arah (Google Maps)"}</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                    <Text style={S.jarakTxt}>{"📏 Jarak " + earn.jarakKm + " km · bersih " + formatRp(earn.kurirNet)}</Text>
                    <View style={S.orderCardBottom}>
                      <Text style={S.orderTotal}>{formatRp(item.total)}</Text>
                      <Text style={S.orderDate}>{formatDate(item.createdAt)}</Text>
                    </View>
                    {Boolean(item.catatanKasir) && <View style={S.catatanKasirStrip}><Text style={S.catatanKasirStripTxt} numberOfLines={1}>{"🗒 " + item.catatanKasir}</Text></View>}
                    {item.status === "diproses" && (!item.kurirId || String(item.kurirId).trim() === "") ? (
                      <TouchableOpacity style={S.actionBtn} onPress={() => handleAmbilOrder(item)}>
                        <Text style={S.actionBtnText}>{"🙋‍♂️ Ambil Orderan"}</Text>
                      </TouchableOpacity>
                    ) : item.status === "diproses" ? (
                      <TouchableOpacity style={[S.actionBtn, { backgroundColor: "#4338CA" }]} onPress={() => handleMulaiAntar(item)}>
                        <Text style={S.actionBtnText}>{"🚚 Barang Dibawa (Mulai Antar)"}</Text>
                      </TouchableOpacity>
                    ) : item.status === "dikirim" ? (
                      <TouchableOpacity
                        style={S.actionBtnGreen}
                        onPress={() => {
                          setSelectedOrderBukti(item);
                          setFotoBuktiUri("");
                          setShowBuktiModal(true);
                        }}
                      >
                        <Text style={S.actionBtnText}>{"📸 Upload Bukti & Selesai"}</Text>
                      </TouchableOpacity>
                    ) : null}
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </>
      )}

      {/* ════ Modal Detail Order ══════════════════════════════════════════ */}
      <Modal visible={detailVisible} animationType="slide" onRequestClose={() => setDetailVisible(false)}>
        <View style={S.modalContainer}>
          <View style={S.modalHeader}>
            <Text style={S.modalTitle}>{"Detail Pesanan"}</Text>
            <TouchableOpacity onPress={() => setDetailVisible(false)}><Text style={S.modalClose}>{"✕"}</Text></TouchableOpacity>
          </View>
          {selectedOrder !== null && (() => {
            const earn = getOrderEarning(selectedOrder);
            return (
              <ScrollView style={S.modalBody} showsVerticalScrollIndicator={false}>
                <View style={S.modalTokoEarningRow}>
                  <View style={S.modalTokoStrip}><Text style={S.modalTokoTxt}>{"🏪 " + getTokoName(selectedOrder.ownerId, storeNames)}</Text></View>
                  <View style={S.modalEarningBadge}><Text style={S.modalEarningTxt}>{"+" + formatRp(earn.kurirNet)}</Text></View>
                </View>
                <View style={[S.detailStatusStrip, getStatusBg(selectedOrder.status)]}><Text style={S.detailStatusStripTxt}>{STATUS_LABELS[selectedOrder.status] ?? selectedOrder.status}</Text></View>
                <Text style={S.detailSection}>{"INFO PESANAN"}</Text>
                <Text style={S.detailRow}>{"ID: #" + safeSlice(selectedOrder.id, -6, "ORDER")}</Text>
                <Text style={S.detailRow}>{"Tanggal: " + formatDate(selectedOrder.createdAt)}</Text>
                <Text style={S.detailRow}>{"Pembayaran: " + (selectedOrder.metodeBayar ?? "-").toUpperCase()}</Text>
                <Text style={S.detailSection}>{"RINCIAN ONGKIR"}</Text>
                <View style={S.ongkirDetailCard}>
                  <View style={S.ongkirDetailRow}><Text style={S.ongkirDetailLbl}>{"Jarak " + earn.jarakKm + " km"}</Text><Text style={S.ongkirDetailVal}>{formatRp(earn.gross)}</Text></View>
                  <View style={S.ongkirDetailDivider} />
                  <View style={S.ongkirDetailRow}><Text style={S.ongkirDetailLblMinus}>{"Biaya aplikasi (10%)"}</Text><Text style={S.ongkirDetailValMinus}>{"-" + formatRp(earn.appFee)}</Text></View>
                  <View style={S.ongkirDetailSubRow}><Text style={S.ongkirDetailSubLbl}>{"  └ Marketing (1%)"}</Text><Text style={S.ongkirDetailSubVal}>{formatRp(earn.marketingFee)}</Text></View>
                  <View style={S.ongkirDetailSubRow}><Text style={S.ongkirDetailSubLbl}>{"  └ Admin (0.3%)"}</Text><Text style={S.ongkirDetailSubVal}>{formatRp(earn.adminFee)}</Text></View>
                  <View style={S.ongkirDetailSubRow}><Text style={S.ongkirDetailSubLbl}>{"  └ Platform (8.7%)"}</Text><Text style={S.ongkirDetailSubVal}>{formatRp(earn.platformFee)}</Text></View>
                  <View style={S.ongkirDetailDivider} />
                  <View style={S.ongkirDetailRow}><Text style={S.ongkirDetailLblTotal}>{"Kamu dapat (bersih)"}</Text><Text style={S.ongkirDetailValTotal}>{formatRp(earn.kurirNet)}</Text></View>
                </View>
                <Text style={S.detailSection}>{"INFO CUSTOMER"}</Text>
                <Text style={S.detailRow}>{"Nama: " + selectedOrder.customerName}</Text>
                {Boolean(selectedOrder.customerPhone) && (
                  <TouchableOpacity style={S.phoneRowDetail} onPress={() => handleCall(selectedOrder!.customerPhone!)}>
                    <Text style={S.detailRow}>{"📞 " + selectedOrder.customerPhone}</Text>
                    <View style={S.callBadge}><Text style={S.callBadgeTxt}>{"Telpon"}</Text></View>
                  </TouchableOpacity>
                )}
                <View style={{ backgroundColor: "#EFF6FF", borderRadius: 12, padding: 12, marginTop: 8, marginBottom: 12, borderWidth: 1, borderColor: "#BFDBFE" }}>
                  <Text style={{ fontSize: 12, fontWeight: "800", color: "#1E40AF", marginBottom: 4 }}>{"📍 TUJUAN PENGIRIMAN:"}</Text>
                  <Text style={{ fontSize: 14, fontWeight: "700", color: "#1E293B", lineHeight: 20 }}>
                    {selectedOrder.customerAddress || "Alamat tidak dicantumkan (Hubungi Customer)"}
                  </Text>
                  {Boolean(selectedOrder.customerAddress) && (
                    <TouchableOpacity
                      style={{ marginTop: 10, backgroundColor: "#2563EB", borderRadius: 10, paddingVertical: 10, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 6 }}
                      onPress={() => bukaNavigasiDashboard(selectedOrder.customerAddress)}
                    >
                      <Text style={{ color: "#fff", fontWeight: "800", fontSize: 13 }}>{"🗺 Buka Pemandu Arah (Google Maps)"}</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <Text style={S.detailSection}>{"ITEM PESANAN"}</Text>
                {selectedOrder.items.map((it, idx) => <Text key={String(idx)} style={S.detailRow}>{it.qty + "x " + it.name + " — " + formatRp(it.price * it.qty)}</Text>)}
                <View style={S.totalRow}><Text style={S.totalLabel}>{"Total Pesanan"}</Text><Text style={S.totalValue}>{formatRp(selectedOrder.total)}</Text></View>
                {Boolean(selectedOrder.note) && (<><Text style={S.detailSection}>{"CATATAN CUSTOMER"}</Text><View style={S.noteBox}><Text style={S.noteBoxTxt}>{selectedOrder.note}</Text></View></>)}
                {Boolean(selectedOrder.catatanKasir) && (<><Text style={S.detailSection}>{"CATATAN KASIR"}</Text><View style={S.catatanKasirBox}><Text style={S.catatanKasirBoxTxt}>{selectedOrder.catatanKasir}</Text></View></>)}
                {selectedOrder.status === "diproses" && (!selectedOrder.kurirId || String(selectedOrder.kurirId).trim() === "") ? (
                  <TouchableOpacity style={S.actionBtnModal} onPress={() => handleAmbilOrder(selectedOrder)}>
                    <Text style={S.actionBtnText}>{"🙋‍♂️ Ambil Orderan Ini"}</Text>
                  </TouchableOpacity>
                ) : selectedOrder.status === "diproses" ? (
                  <TouchableOpacity style={[S.actionBtnModal, { backgroundColor: "#4338CA" }]} onPress={() => handleMulaiAntar(selectedOrder)}>
                    <Text style={S.actionBtnText}>{"🚚 Barang Dibawa (Mulai Antar)"}</Text>
                  </TouchableOpacity>
                ) : selectedOrder.status === "dikirim" ? (
                  <TouchableOpacity
                    style={S.actionBtnModalGreen}
                    onPress={() => {
                      setDetailVisible(false);
                      setSelectedOrderBukti(selectedOrder);
                      setFotoBuktiUri("");
                      setShowBuktiModal(true);
                    }}
                  >
                    <Text style={S.actionBtnText}>{"📸 Upload Bukti & Selesai"}</Text>
                  </TouchableOpacity>
                ) : null}
                {selectedOrder.status === "selesai" && <View style={S.selesaiInfo}><Text style={S.selesaiInfoTxt}>{"✅ Selesai · Pendapatan: " + formatRp(earn.kurirNet)}</Text></View>}
                {selectedOrder.status === "dibatalkan" && <View style={S.batalInfo}><Text style={S.batalInfoTxt}>{"❌ Pesanan ini dibatalkan."}</Text></View>}
                <View style={S.modalBottomSpacer} />
              </ScrollView>
            );
          })()}
        </View>
      </Modal>

      {/* ════ Modal Rekening Bank ══════════════════════════════════════════ */}
      <Modal visible={showBankModal} transparent animationType="slide" onRequestClose={() => setShowBankModal(false)}>
        <View style={S.modalOverlay}>
          <View style={S.bankModalSheet}>
            <View style={S.bankModalHeader}>
              <Text style={S.bankModalTitle}>{"🏦 Rekening Bank"}</Text>
              <TouchableOpacity onPress={() => setShowBankModal(false)}><Text style={S.bankModalClose}>{"✕"}</Text></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={S.bankFieldLbl}>{"Bank / e-Wallet Tujuan"}</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                {["BCA", "BRI", "BNI", "MANDIRI", "DANA", "GOPAY", "OVO", "SHOPEEPAY"].map((bank) => (
                  <TouchableOpacity
                    key={bank}
                    style={{
                      backgroundColor: bankInput.namaBank === bank ? "#EEF2FF" : "#F8FAFC",
                      borderRadius: 12,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderWidth: 1,
                      borderColor: bankInput.namaBank === bank ? "#6366F1" : "#E2E8F0",
                    }}
                    onPress={() => setBankInput((p) => ({ ...p, namaBank: bank }))}
                  >
                    <Text style={{ fontSize: 12, fontWeight: bankInput.namaBank === bank ? "800" : "600", color: bankInput.namaBank === bank ? "#4338CA" : "#64748B" }}>
                      {(["DANA", "GOPAY", "OVO", "SHOPEEPAY"].includes(bank) ? "📱 " : "🏦 ") + bank}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput style={S.bankInput} value={bankInput.namaBank} onChangeText={(v) => setBankInput((p) => ({ ...p, namaBank: v }))} placeholder="Nama Bank atau e-Wallet (contoh: DANA / BCA)" placeholderTextColor="#94a3b8" autoCapitalize="characters" />
              <Text style={S.bankFieldLbl}>{"No. Rekening / No. HP e-Wallet"}</Text>
              <TextInput style={S.bankInput} value={bankInput.nomorRekening} onChangeText={(v) => setBankInput((p) => ({ ...p, nomorRekening: v }))} placeholder="081234567890 (e-Wallet) / 1234567890 (Bank)" placeholderTextColor="#94a3b8" keyboardType="numeric" />
              <Text style={S.bankFieldLbl}>{"Nama Pemilik Akun / Rekening"}</Text>
              <TextInput style={S.bankInput} value={bankInput.namaPemilik} onChangeText={(v) => setBankInput((p) => ({ ...p, namaPemilik: v }))} placeholder="Sesuai nama terdaftar di e-Wallet / buku tabungan" placeholderTextColor="#94a3b8" autoCapitalize="words" />
              <View style={S.bankWarningBox}>
                <Text style={S.bankWarningTxt}>{"⚠️ Pastikan data nomor rekening/e-Wallet benar. Dana yang salah transfer tidak dapat dikembalikan."}</Text>
              </View>
              <TouchableOpacity style={S.bankSaveBtn} onPress={handleSaveBank}>
                <Text style={S.bankSaveBtnTxt}>{"💾 Simpan Rekening / e-Wallet"}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ════ Modal Pencairan Dana ════════════════════════════════════════ */}
      <Modal visible={showWdModal} transparent animationType="slide" onRequestClose={() => setShowWdModal(false)}>
        <View style={S.modalOverlay}>
          <View style={S.wdModalSheet}>
            <View style={S.bankModalHeader}>
              <Text style={S.bankModalTitle}>{"💸 Pencairan Dana"}</Text>
              <TouchableOpacity onPress={() => setShowWdModal(false)}><Text style={S.bankModalClose}>{"✕"}</Text></TouchableOpacity>
            </View>
            <View style={S.wdSaldoInfo}>
              <Text style={S.wdSaldoInfoLbl}>{"Saldo Bisa Dicairkan"}</Text>
              <Text style={S.wdSaldoInfoVal}>{formatRp(saldoBisa)}</Text>
            </View>
            {bankAccount ? (
              <View style={S.wdBankPreview}>
                <Text style={S.wdBankPreviewTxt}>{"🏦 " + bankAccount.namaBank + " · " + bankAccount.nomorRekening}</Text>
                <Text style={S.wdBankPreviewOwner}>{"a.n. " + bankAccount.namaPemilik}</Text>
              </View>
            ) : (
              <View style={S.wdNoBankWarning}>
                <Text style={S.wdNoBankWarningTxt}>{"⚠️ Tambahkan rekening bank terlebih dahulu."}</Text>
              </View>
            )}
            <Text style={S.bankFieldLbl}>{"Jumlah Pencairan (min. " + formatRp(MIN_WITHDRAW) + ")"}</Text>
            <TextInput style={S.bankInput} value={wdJumlah} onChangeText={setWdJumlah} placeholder={formatRp(MIN_WITHDRAW)} placeholderTextColor="#94a3b8" keyboardType="numeric" />
            <View style={S.wdShortcutRow}>
              {[50000, 100000, 200000, 500000].filter((v) => v <= saldoBisa).map((v) => (
                <TouchableOpacity key={v} style={S.wdShortcutBtn} onPress={() => setWdJumlah(String(v))}>
                  <Text style={S.wdShortcutTxt}>{formatRp(v)}</Text>
                </TouchableOpacity>
              ))}
              {saldoBisa >= MIN_WITHDRAW && (
                <TouchableOpacity style={[S.wdShortcutBtn, S.wdShortcutBtnAll]} onPress={() => setWdJumlah(String(Math.floor(saldoBisa)))}>
                  <Text style={S.wdShortcutTxt}>{"Semua"}</Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={S.bankWarningBox}>
              <Text style={S.bankWarningTxt}>{"⏰ Proses transfer 1×24 jam kerja. Biaya transfer ditanggung sistem."}</Text>
            </View>
            <TouchableOpacity
              style={saldoBisa >= MIN_WITHDRAW && bankAccount ? S.bankSaveBtn : S.cairBtnBigDisabled}
              onPress={handleRequestWithdraw}
              disabled={saldoBisa < MIN_WITHDRAW || !bankAccount}
            >
              <Text style={S.bankSaveBtnTxt}>{"💸 Ajukan Pencairan"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Modal Bukti Foto Pengiriman ── */}
      <Modal
        visible={showBuktiModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowBuktiModal(false)}
      >
        <View style={S.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setShowBuktiModal(false)}
          />
          <View style={S.buktiModalSheet}>
            <Text style={S.modalTitle}>{"📸 Bukti Foto Pengiriman"}</Text>
            <Text style={{ fontSize: 13, color: "#64748B", textAlign: "center", marginBottom: 16 }}>
              {"Harus disertai bukti foto pengiriman barang untuk pesanan atas nama: " +
                (selectedOrderBukti?.customerName ?? "")}
            </Text>

            {fotoBuktiUri ? (
              <View style={S.buktiPreviewBox}>
                <Image
                  source={{ uri: fotoBuktiUri }}
                  style={S.buktiImg}
                  resizeMode="cover"
                />
                <TouchableOpacity
                  style={S.gantiFotoBtn}
                  onPress={() => setFotoBuktiUri("")}
                >
                  <Text style={S.gantiFotoTxt}>{"❌ Hapus & Ulangi Foto"}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={S.fotoBtnRow}>
                <TouchableOpacity
                  style={S.kameraBtn}
                  onPress={() => pickBuktiFoto("kamera")}
                >
                  <Text style={S.fotoBtnIcon}>{"📷"}</Text>
                  <Text style={S.fotoBtnLabel}>{"Ambil dari Kamera"}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={S.galeriBtn}
                  onPress={() => pickBuktiFoto("galeri")}
                >
                  <Text style={S.fotoBtnIcon}>{"🖼️"}</Text>
                  <Text style={S.fotoBtnLabel}>{"Pilih dari Galeri"}</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={S.modalActionRow}>
              <TouchableOpacity
                style={S.modalBatalBtn}
                onPress={() => {
                  setShowBuktiModal(false);
                  setFotoBuktiUri("");
                }}
              >
                <Text style={S.modalBatalTxt}>{"Batal"}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  S.modalSimpanBtn,
                  (!fotoBuktiUri || submittingBukti) && { opacity: 0.5 },
                ]}
                disabled={!fotoBuktiUri || submittingBukti}
                onPress={handleSelesaikanDenganBukti}
              >
                <Text style={S.modalSimpanTxt}>
                  {submittingBukti ? "Menyimpan..." : "✅ Kirim Bukti & Selesai"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  center:    { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },

  header:           { backgroundColor: "#6366f1", paddingTop: 52, paddingBottom: 16, paddingHorizontal: 20 },
  headerTopRow:     { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  backBtnText:      { color: "rgba(255,255,255,0.85)", fontSize: 14 },
  logoutBtn:        { backgroundColor: "rgba(255,255,255,0.18)", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: "rgba(255,255,255,0.3)" },
  logoutBtnTxt:     { color: "#fff", fontSize: 12, fontWeight: "700" },
  profileRow:       { flexDirection: "row", alignItems: "center", gap: 12 },
  avatarCircle:     { width: 52, height: 52, borderRadius: 26, backgroundColor: "rgba(255,255,255,0.25)", justifyContent: "center", alignItems: "center" },
  avatarTxt:        { fontSize: 22, fontWeight: "800", color: "#fff" },
  profileInfo:      { flex: 1 },
  profileName:      { fontSize: 17, fontWeight: "700", color: "#fff" },
  profilePhone:     { fontSize: 12, color: "rgba(255,255,255,0.75)", marginTop: 2 },
  profileBadgeRow:  { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  ratingTxt:        { fontSize: 12, color: "#fbbf24" },
  tokoCountBadge:   { backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  tokoCountTxt:     { fontSize: 11, color: "#fff" },
  onlineToggleBox:  { alignItems: "center", gap: 4 },
  onlineLbl:        { fontSize: 11, fontWeight: "800", color: "#10b981" },
  offlineLbl:       { fontSize: 11, fontWeight: "800", color: "#fca5a5" },

  menghantarBanner: { flexDirection: "row", alignItems: "center", backgroundColor: "#7c3aed", paddingHorizontal: 16, paddingVertical: 10, gap: 10 },
  menghantarIcon:   { fontSize: 24 },
  menghantarInfo:   { flex: 1 },
  menghantarTitle:  { fontSize: 13, fontWeight: "700", color: "#fff" },
  menghantarSub:    { fontSize: 11, color: "rgba(255,255,255,0.75)" },
  menghantarBtn:    { backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  menghantarBtnTxt: { fontSize: 12, color: "#fff", fontWeight: "700" },

  saldoCard:      { backgroundColor: "#fff", margin: 12, borderRadius: 16, padding: 16, elevation: 3 },
  saldoMain:      { alignItems: "center", marginBottom: 12 },
  saldoLbl:       { fontSize: 12, color: "#64748b", marginBottom: 4 },
  saldoVal:       { fontSize: 28, fontWeight: "800", color: "#10b981" },
  saldoActionRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  cairBtn:        { flex: 1, backgroundColor: "#10b981", borderRadius: 10, paddingVertical: 8, alignItems: "center" },
  cairBtnTxt:     { color: "#fff", fontWeight: "700", fontSize: 13 },
  rekeningBtn:    { flex: 1, backgroundColor: "#ede9fe", borderRadius: 10, paddingVertical: 8, alignItems: "center" },
  rekeningBtnTxt: { color: "#6366f1", fontWeight: "700", fontSize: 13 },
  pendingWdTxt:   { fontSize: 11, color: "#f59e0b", marginTop: 6, fontWeight: "600" },
  saldoDivider:   { height: 1, backgroundColor: "#f1f5f9", marginBottom: 12, marginTop: 4 },
  saldoSecondary: { flexDirection: "row", justifyContent: "space-around" },
  saldoSecItem:   { alignItems: "center" },
  saldoSecLbl:    { fontSize: 10, color: "#64748b", marginBottom: 2 },
  saldoSecVal:    { fontSize: 13, fontWeight: "700", color: "#1e293b" },
  bankInfoStrip:  { marginTop: 10, backgroundColor: "#f0fdf4", borderRadius: 8, padding: 8 },
  bankInfoTxt:    { fontSize: 11, color: "#166534" },

  statsRow: { flexDirection: "row", marginHorizontal: 12, marginBottom: 8, gap: 6 },
  statCard: { flex: 1, backgroundColor: "#fff", borderRadius: 12, padding: 10, alignItems: "center", elevation: 2 },
  statNum:  { fontSize: 18, fontWeight: "700", color: "#1e293b" },
  statLabel:{ fontSize: 9, color: "#64748b", marginTop: 2, textAlign: "center" },

  tabRow:         { flexDirection: "row", marginHorizontal: 12, marginBottom: 6, backgroundColor: "#e2e8f0", borderRadius: 10, padding: 3 },
  tabActive:      { flex: 1, backgroundColor: "#6366f1", borderRadius: 8, paddingVertical: 8, alignItems: "center" },
  tabInactive:    { flex: 1, paddingVertical: 8, alignItems: "center" },
  tabInner:       { flexDirection: "row", alignItems: "center", gap: 4 },
  tabTextActive:  { color: "#fff", fontWeight: "600", fontSize: 12 },
  tabTextInactive:{ color: "#64748b", fontSize: 12 },
  tabBadge:       { backgroundColor: "#ef4444", borderRadius: 8, minWidth: 16, height: 16, justifyContent: "center", alignItems: "center", paddingHorizontal: 3 },
  tabBadgeTxt:    { color: "#fff", fontSize: 9, fontWeight: "800" },

  // Tab GPS
  gpsContainer: { flex: 1 },

  offlineBanner:      { backgroundColor: "#fef2f2", borderRadius: 10, marginHorizontal: 12, marginBottom: 6, padding: 10, flexDirection: "row", alignItems: "center", gap: 8 },
  offlineBannerTxt:   { flex: 1, fontSize: 11, color: "#991b1b" },
  offlineBannerBtn:   { backgroundColor: "#ef4444", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  offlineBannerBtnTxt:{ color: "#fff", fontWeight: "700", fontSize: 11 },

  listContent: { padding: 12, paddingTop: 4, gap: 10, paddingBottom: 40 },
  emptyBox:    { flex: 1, justifyContent: "center", alignItems: "center", paddingVertical: 40 },
  emptyText:   { color: "#94a3b8", fontSize: 15, textAlign: "center" },
  emptyTextSub:{ color: "#cbd5e1", fontSize: 12, marginTop: 6, textAlign: "center" },

  tokoStrip:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  tokoStripTxt: { fontSize: 11, fontWeight: "700", color: "#6366f1", backgroundColor: "#ede9fe", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  earningBadge: { fontSize: 13, fontWeight: "800", color: "#10b981" },

  orderCard:       { backgroundColor: "#fff", borderRadius: 14, padding: 14, elevation: 2 },
  orderCardTop:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  orderId:         { fontSize: 13, fontWeight: "700", color: "#475569", letterSpacing: 0.5 },
  statusBadge:     { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  statusBadgeText: { color: "#fff", fontSize: 11, fontWeight: "600" },
  customerName:    { fontSize: 15, fontWeight: "600", color: "#1e293b", marginBottom: 4 },
  phoneRow:        { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  phoneRowDetail:  { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 },
  phoneText:       { fontSize: 13, color: "#6366f1", fontWeight: "600" },
  callBadge:       { backgroundColor: "#ede9fe", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  callBadgeTxt:    { fontSize: 11, color: "#6366f1", fontWeight: "700" },
  address:         { fontSize: 12, color: "#64748b", marginBottom: 4 },
  jarakTxt:        { fontSize: 11, color: "#10b981", fontWeight: "600", marginBottom: 4 },
  orderCardBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 },
  orderTotal:      { fontSize: 14, fontWeight: "700", color: "#6366f1" },
  orderDate:       { fontSize: 11, color: "#94a3b8" },
  catatanKasirStrip:    { marginTop: 8, backgroundColor: "#f0fdf4", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: "#bbf7d0" },
  catatanKasirStripTxt: { fontSize: 12, color: "#166534" },
  actionBtn:      { marginTop: 10, backgroundColor: "#6366f1", borderRadius: 8, paddingVertical: 10, alignItems: "center" },
  actionBtnGreen: { marginTop: 10, backgroundColor: "#10b981", borderRadius: 8, paddingVertical: 10, alignItems: "center" },
  actionBtnText:  { color: "#fff", fontWeight: "600", fontSize: 14 },

  pendapatanScroll:     { flex: 1 },
  pendapatanContent:    { padding: 12, paddingBottom: 40 },
  earningsSummaryCard:  { backgroundColor: "#fff", borderRadius: 14, padding: 16, marginBottom: 10, elevation: 2 },
  earningsSummaryTitle: { fontSize: 13, fontWeight: "700", color: "#374151", marginBottom: 12 },
  earningsSummaryRow:   { flexDirection: "row", justifyContent: "space-around", alignItems: "center" },
  earningsSummaryItem:  { alignItems: "center" },
  earningsSummaryLbl:   { fontSize: 11, color: "#64748b", marginBottom: 4 },
  earningsSummaryVal:   { fontSize: 15, fontWeight: "800", color: "#10b981" },
  earningsSummaryCount: { fontSize: 10, color: "#94a3b8", marginTop: 2 },
  earningsSumDivider:   { width: 1, height: 40, backgroundColor: "#f1f5f9" },
  formulaCard:          { backgroundColor: "#fff", borderRadius: 14, padding: 16, marginBottom: 10, elevation: 2 },
  formulaTitle:         { fontSize: 13, fontWeight: "700", color: "#374151", marginBottom: 10 },
  formulaRow:           { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  formulaLbl:           { fontSize: 12, color: "#374151" },
  formulaVal:           { fontSize: 12, fontWeight: "700", color: "#1e293b" },
  formulaValMinus:      { fontSize: 12, fontWeight: "700", color: "#ef4444" },
  formulaLblSub:        { fontSize: 11, color: "#64748b" },
  formulaValSub:        { fontSize: 11, color: "#64748b" },
  formulaLblTotal:      { fontSize: 13, fontWeight: "800", color: "#1e293b" },
  formulaValTotal:      { fontSize: 13, fontWeight: "800", color: "#10b981" },
  formulaDivider:       { height: 1, backgroundColor: "#f1f5f9", marginVertical: 6 },
  formulaExample:       { marginTop: 10, backgroundColor: "#f0fdf4", borderRadius: 8, padding: 10 },
  formulaExampleTxt:    { fontSize: 11, color: "#166534", lineHeight: 18 },
  earningsSectionTitle: { fontSize: 13, fontWeight: "700", color: "#374151", marginBottom: 8, marginTop: 4 },
  earningsItemCard:     { backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 8, flexDirection: "row", elevation: 1 },
  earningsItemLeft:     { flex: 1 },
  earningsItemId:       { fontSize: 11, fontWeight: "700", color: "#475569", letterSpacing: 0.5 },
  earningsItemCustomer: { fontSize: 14, fontWeight: "600", color: "#1e293b", marginTop: 2 },
  earningsItemToko:     { fontSize: 11, color: "#6366f1", marginTop: 2 },
  earningsItemJarak:    { fontSize: 11, color: "#64748b", marginTop: 1 },
  earningsItemDate:     { fontSize: 10, color: "#94a3b8", marginTop: 2, marginBottom: 4 },
  breakdownRow:         { flexDirection: "row", justifyContent: "space-between", paddingVertical: 1 },
  breakdownLbl:         { fontSize: 10, color: "#64748b" },
  breakdownVal:         { fontSize: 10, color: "#1e293b", fontWeight: "600" },
  breakdownLblMinus:    { fontSize: 10, color: "#ef4444" },
  breakdownValMinus:    { fontSize: 10, color: "#ef4444", fontWeight: "600" },
  earningsItemRight:        { alignItems: "flex-end", justifyContent: "center", gap: 6 },
  earningsItemAmount:       { fontSize: 16, fontWeight: "800", color: "#10b981" },
  earningsItemSelesaiBadge: { backgroundColor: "#dcfce7", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  earningsItemSelesaiTxt:   { fontSize: 10, color: "#166534", fontWeight: "700" },

  wdSaldoCard:        { backgroundColor: "#10b981", borderRadius: 14, padding: 16, marginBottom: 12, alignItems: "center" },
  wdSaldoLbl:         { fontSize: 12, color: "rgba(255,255,255,0.8)", marginBottom: 4 },
  wdSaldoVal:         { fontSize: 30, fontWeight: "800", color: "#fff" },
  wdPendingTxt:       { fontSize: 11, color: "rgba(255,255,255,0.85)", marginTop: 4 },
  wdTotalTxt:         { fontSize: 10, color: "rgba(255,255,255,0.7)", marginTop: 4 },
  wdBankCard:         { backgroundColor: "#fff", borderRadius: 14, padding: 14, marginBottom: 10, flexDirection: "row", alignItems: "center", elevation: 2 },
  wdBankLeft:         { flex: 1 },
  wdBankTitle:        { fontSize: 11, color: "#64748b", marginBottom: 4 },
  wdBankName:         { fontSize: 16, fontWeight: "700", color: "#1e293b" },
  wdBankNum:          { fontSize: 14, color: "#374151", marginTop: 2 },
  wdBankOwner:        { fontSize: 12, color: "#64748b", marginTop: 2 },
  wdBankEditBtn:      { backgroundColor: "#ede9fe", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  wdBankEditTxt:      { fontSize: 12, color: "#6366f1", fontWeight: "700" },
  wdNoBankCard:       { backgroundColor: "#f8fafc", borderRadius: 14, padding: 20, marginBottom: 10, alignItems: "center", borderWidth: 2, borderStyle: "dashed", borderColor: "#cbd5e1" },
  wdNoBankTxt:        { fontSize: 14, fontWeight: "700", color: "#6366f1" },
  wdNoBankSub:        { fontSize: 12, color: "#94a3b8", marginTop: 4 },
  cairBtnBig:         { backgroundColor: "#10b981", borderRadius: 12, paddingVertical: 14, alignItems: "center", marginBottom: 16 },
  cairBtnBigDisabled: { backgroundColor: "#e2e8f0", borderRadius: 12, paddingVertical: 14, alignItems: "center", marginBottom: 16 },
  cairBtnBigTxt:      { color: "#fff", fontWeight: "800", fontSize: 15 },
  wdItemCard:         { backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 8, flexDirection: "row", elevation: 1 },
  wdItemLeft:         { flex: 1 },
  wdItemId:           { fontSize: 11, fontWeight: "700", color: "#475569", letterSpacing: 0.5 },
  wdItemBank:         { fontSize: 13, fontWeight: "600", color: "#1e293b", marginTop: 2 },
  wdItemOwner:        { fontSize: 11, color: "#64748b", marginTop: 1 },
  wdItemDate:         { fontSize: 10, color: "#94a3b8", marginTop: 3 },
  wdItemCatatan:      { fontSize: 11, color: "#ef4444", marginTop: 3 },
  wdItemRight:        { alignItems: "flex-end", justifyContent: "center", gap: 6 },
  wdItemJumlah:       { fontSize: 16, fontWeight: "800", color: "#1e293b" },
  wdStatusBadge:      { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  wdStatusTxt:        { fontSize: 11, fontWeight: "700" },

  modalContainer:      { flex: 1, backgroundColor: "#f8fafc" },
  modalHeader:         { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, paddingTop: 56, backgroundColor: "#6366f1" },
  modalTitle:          { fontSize: 18, fontWeight: "700", color: "#fff" },
  modalClose:          { fontSize: 20, color: "#fff", fontWeight: "700" },
  modalBody:           { padding: 20 },
  modalTokoEarningRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  modalTokoStrip:      { backgroundColor: "#ede9fe", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  modalTokoTxt:        { fontSize: 12, fontWeight: "700", color: "#6366f1" },
  modalEarningBadge:   { backgroundColor: "#dcfce7", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  modalEarningTxt:     { fontSize: 14, fontWeight: "800", color: "#10b981" },
  detailStatusStrip:   { borderRadius: 10, padding: 12, marginBottom: 4, alignItems: "center" },
  detailStatusStripTxt:{ color: "#fff", fontSize: 15, fontWeight: "800" },
  detailSection:       { fontSize: 11, fontWeight: "700", color: "#6366f1", letterSpacing: 1, marginTop: 20, marginBottom: 6 },
  detailRow:           { fontSize: 14, color: "#334155", paddingVertical: 3 },
  ongkirDetailCard:    { backgroundColor: "#f8fafc", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#e2e8f0" },
  ongkirDetailRow:     { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  ongkirDetailLbl:     { fontSize: 13, color: "#374151" },
  ongkirDetailVal:     { fontSize: 13, fontWeight: "700", color: "#1e293b" },
  ongkirDetailLblMinus:{ fontSize: 13, color: "#ef4444" },
  ongkirDetailValMinus:{ fontSize: 13, fontWeight: "700", color: "#ef4444" },
  ongkirDetailSubRow:  { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  ongkirDetailSubLbl:  { fontSize: 11, color: "#94a3b8" },
  ongkirDetailSubVal:  { fontSize: 11, color: "#94a3b8" },
  ongkirDetailDivider: { height: 1, backgroundColor: "#e2e8f0", marginVertical: 6 },
  ongkirDetailLblTotal:{ fontSize: 14, fontWeight: "800", color: "#1e293b" },
  ongkirDetailValTotal:{ fontSize: 16, fontWeight: "800", color: "#10b981" },
  totalRow:            { flexDirection: "row", justifyContent: "space-between", marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#e2e8f0" },
  totalLabel:          { fontSize: 15, fontWeight: "700", color: "#1e293b" },
  totalValue:          { fontSize: 15, fontWeight: "700", color: "#6366f1" },
  noteBox:             { backgroundColor: "#fff7ed", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "#fed7aa" },
  noteBoxTxt:          { fontSize: 13, color: "#78350f" },
  catatanKasirBox:     { backgroundColor: "#f0fdf4", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "#bbf7d0" },
  catatanKasirBoxTxt:  { fontSize: 13, color: "#166534" },
  actionBtnModal:      { marginTop: 20, marginBottom: 8, backgroundColor: "#6366f1", borderRadius: 8, paddingVertical: 12, alignItems: "center" },
  actionBtnModalGreen: { marginTop: 20, marginBottom: 8, backgroundColor: "#10b981", borderRadius: 8, paddingVertical: 12, alignItems: "center" },
  selesaiInfo:         { marginTop: 20, backgroundColor: "#dcfce7", borderRadius: 10, padding: 12, alignItems: "center" },
  selesaiInfoTxt:      { fontSize: 14, color: "#166534", fontWeight: "600" },
  batalInfo:           { marginTop: 20, backgroundColor: "#fee2e2", borderRadius: 10, padding: 12, alignItems: "center" },
  batalInfoTxt:        { fontSize: 14, color: "#991b1b", fontWeight: "600" },
  modalBottomSpacer:   { height: 40 },

  modalOverlay:       { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  bankModalSheet:     { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: "85%" },
  wdModalSheet:       { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: "80%" },
  bankModalHeader:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  bankModalTitle:     { fontSize: 18, fontWeight: "700", color: "#1e293b" },
  bankModalClose:     { fontSize: 22, color: "#64748b", fontWeight: "700" },
  bankFieldLbl:       { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 6, marginTop: 14 },
  bankInput:          { backgroundColor: "#f8fafc", borderRadius: 10, borderWidth: 1, borderColor: "#e2e8f0", paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: "#1e293b" },
  bankWarningBox:     { backgroundColor: "#fff7ed", borderRadius: 10, padding: 12, marginTop: 16, borderWidth: 1, borderColor: "#fed7aa" },
  bankWarningTxt:     { fontSize: 12, color: "#92400e" },
  bankSaveBtn:        { backgroundColor: "#6366f1", borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 16, marginBottom: 8 },
  bankSaveBtnTxt:     { color: "#fff", fontWeight: "800", fontSize: 15 },
  wdSaldoInfo:        { backgroundColor: "#f0fdf4", borderRadius: 12, padding: 14, marginBottom: 14, alignItems: "center" },
  wdSaldoInfoLbl:     { fontSize: 12, color: "#64748b" },
  wdSaldoInfoVal:     { fontSize: 24, fontWeight: "800", color: "#10b981" },
  wdBankPreview:      { backgroundColor: "#f8fafc", borderRadius: 10, padding: 12, marginBottom: 8 },
  wdBankPreviewTxt:   { fontSize: 13, fontWeight: "700", color: "#1e293b" },
  wdBankPreviewOwner: { fontSize: 12, color: "#64748b", marginTop: 2 },
  wdNoBankWarning:    { backgroundColor: "#fef2f2", borderRadius: 10, padding: 12, marginBottom: 8 },
  wdNoBankWarningTxt: { fontSize: 13, color: "#991b1b" },
  wdShortcutRow:      { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  wdShortcutBtn:      { backgroundColor: "#f1f5f9", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  wdShortcutBtnAll:   { backgroundColor: "#ede9fe" },
  wdShortcutTxt:      { fontSize: 12, fontWeight: "600", color: "#374151" },

  btnPurple:    { marginTop: 20, backgroundColor: "#6366f1", borderRadius: 10, paddingHorizontal: 24, paddingVertical: 12 },
  btnPurpleTxt: { color: "#fff", fontWeight: "700", fontSize: 14 },

  buktiModalSheet:    { backgroundColor: "#fff", borderRadius: 24, padding: 20, margin: 20, elevation: 10, width: "90%", maxWidth: 400 },
  fotoBtnRow:         { flexDirection: "row", gap: 12, marginBottom: 20 },
  kameraBtn:          { flex: 1, backgroundColor: "#EEF2FF", borderRadius: 14, padding: 16, alignItems: "center", borderWidth: 1, borderColor: "#C7D2FE" },
  galeriBtn:          { flex: 1, backgroundColor: "#F0FDF4", borderRadius: 14, padding: 16, alignItems: "center", borderWidth: 1, borderColor: "#BBF7D0" },
  fotoBtnIcon:        { fontSize: 28, marginBottom: 6 },
  fotoBtnLabel:       { fontSize: 13, fontWeight: "700", color: "#334155", textAlign: "center" },
  buktiPreviewBox:    { alignItems: "center", marginBottom: 18 },
  buktiImg:           { width: "100%", height: 200, borderRadius: 12, marginBottom: 10, backgroundColor: "#F1F5F9" },
  gantiFotoBtn:       { backgroundColor: "#FEE2E2", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  gantiFotoTxt:       { color: "#DC2626", fontSize: 12, fontWeight: "700" },
  modalActionRow:     { flexDirection: "row", gap: 10 },
  modalBatalBtn:      { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: "#F1F5F9", alignItems: "center" },
  modalBatalTxt:      { fontSize: 14, fontWeight: "700", color: "#64748B" },
  modalSimpanBtn:     { flex: 2, paddingVertical: 14, borderRadius: 12, backgroundColor: "#10B981", alignItems: "center" },
  modalSimpanTxt:     { fontSize: 14, fontWeight: "800", color: "#fff" },
});