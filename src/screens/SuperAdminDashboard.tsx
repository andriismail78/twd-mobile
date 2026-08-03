// src/screens/SuperAdminDashboard.tsx — v3 (+ fitur registrasi mitra)
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

// ─── Types ────────────────────────────────────────────────────────────────────
type WdRole = "owner" | "kurir" | "marketing" | "sub_marketing";
type RegRole = "marketing" | "sub_marketing" | "kurir";

interface WithdrawalRequest {
  id: string;
  jumlah: number;
  namaBank: string;
  nomorRekening: string;
  namaPemilik: string;
  status: "menunggu" | "diproses" | "selesai" | "ditolak";
  createdAt: string;
  catatan?: string;
  ownerId?: string;
  kurirId?: string;
  marketingId?: string;
  subMarketingId?: string;
}
interface WdItem extends WithdrawalRequest {
  role: WdRole;
  ownerKey: string;
  userName: string;
}
interface UserEntry {
  id: string;
  name: string;
  role: WdRole;
  phone?: string;
  paket?: string;
  recruitedBy?: string;
}
interface OwnerRegistration {
  id: string;
  name: string;
  tokoName: string;
  phone: string;
  paket: string;
  recruitedBy: string;
  recruitedByRole: string;
  kodeToken: string;
  createdAt: string;
}
interface KurirAccount {
  id: string;
  name?: string;
  phone?: string;
  ownerId?: string;
  marketingRef?: string;
  subMarketingRef?: string;
  verified?: boolean;
}

// ─── Konstanta ────────────────────────────────────────────────────────────────
const ACCENT      = "#7C3AED";
const SUCCESS     = "#16A34A";
const DANGER      = "#DC2626";
const ORANGE      = "#D97706";
const BLUE        = "#2563EB";
const CYAN        = "#0891B2";
const BOTTOM_SAFE = Platform.OS === "ios" ? 34 : 24;

const ROLE_LABEL: Record<WdRole, string> = {
  owner:         "🏪 Owner",
  kurir:         "🚚 Kurir",
  marketing:     "📣 Marketing",
  sub_marketing: "📣 Sub-Marketing",
};
const ROLE_COLOR: Record<WdRole, string> = {
  owner:         BLUE,
  kurir:         "#6366F1",
  marketing:     ACCENT,
  sub_marketing: CYAN,
};
const WD_STATUS_LABEL: Record<string, string> = {
  menunggu: "⏳ Menunggu",
  diproses: "🔄 Diproses",
  selesai:  "✅ Selesai",
  ditolak:  "❌ Ditolak",
};
const WD_STATUS_COLOR: Record<string, string> = {
  menunggu: ORANGE,
  diproses: BLUE,
  selesai:  SUCCESS,
  ditolak:  DANGER,
};
const FILTER_ROLE_OPTIONS: Array<{ key: string; label: string }> = [
  { key: "semua",         label: "📋 Semua"     },
  { key: "owner",         label: "🏪 Owner"     },
  { key: "kurir",         label: "🚚 Kurir"     },
  { key: "marketing",     label: "📣 Marketing" },
  { key: "sub_marketing", label: "📣 Sub-Mkt"  },
];
const FILTER_STATUS_OPTIONS: Array<{ key: string; label: string }> = [
  { key: "semua",    label: "📋 Semua"    },
  { key: "menunggu", label: "⏳ Menunggu" },
  { key: "diproses", label: "🔄 Diproses" },
  { key: "selesai",  label: "✅ Selesai"  },
  { key: "ditolak",  label: "❌ Ditolak"  },
];
const REG_ROLE_OPTIONS: Array<{ key: RegRole; label: string; color: string }> = [
  { key: "marketing",     label: "📣 Marketing",     color: ACCENT },
  { key: "sub_marketing", label: "📣 Sub Marketing", color: CYAN   },
  { key: "kurir",         label: "🚚 Kurir",         color: "#6366F1" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatRp(n: number): string {
  return "Rp " + Math.round(n).toLocaleString("id-ID");
}
function formatRpShort(n: number): string {
  if (n >= 1_000_000) return "Rp " + (n / 1_000_000).toFixed(1) + "jt";
  if (n >= 1_000)     return "Rp " + (n / 1_000).toFixed(0) + "rb";
  return "Rp " + n.toLocaleString("id-ID");
}
function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("id-ID", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}
function safeInitial(val?: string | null): string {
  return (val ?? "?").trim().charAt(0).toUpperCase() || "?";
}
function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface SuperAdminScreenProps {
  onBack?: () => void;
}

// ─── Komponen Utama ───────────────────────────────────────────────────────────
export default function SuperAdminScreen({ onBack }: SuperAdminScreenProps) {
  const { logout } = useAuth();

  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [activeTab,     setActiveTab]     = useState<"dashboard" | "owner" | "kasir" | "pencairan" | "users" | "daftar">("dashboard");
  const [allWd,         setAllWd]         = useState<WdItem[]>([]);
  const [allUsers,      setAllUsers]      = useState<UserEntry[]>([]);
  const [ownersList,    setOwnersList]    = useState<OwnerRegistration[]>([]);
  const [kasirList,     setKasirList]     = useState<any[]>([]);
  const [totalOmzet,    setTotalOmzet]    = useState(0);
  const [totalOrders,   setTotalOrders]   = useState(0);
  const [searchQuery,   setSearchQuery]   = useState("");

  const [detailOwner,   setDetailOwner]   = useState<OwnerRegistration | null>(null);
  const [showOwnerMod,  setShowOwnerMod]  = useState(false);
  const [filterRole,    setFilterRole]    = useState("semua");
  const [filterStatus,  setFilterStatus]  = useState("menunggu");
  const [selectedWd,    setSelectedWd]    = useState<WdItem | null>(null);
  const [showWdDetail,  setShowWdDetail]  = useState(false);
  const [actionCatatan, setActionCatatan] = useState("");
  const [processing,    setProcessing]    = useState(false);

  // ── State Registrasi Mitra ─────────────────────────────────────────────
  const [regRole,    setRegRole]    = useState<RegRole>("marketing");
  const [regName,    setRegName]    = useState("");
  const [regPhone,   setRegPhone]   = useState("");
  const [regPin,     setRegPin]     = useState("");
  const [regLoading, setRegLoading] = useState(false);

  // ── Load data ────────────────────────────────────────────────────────────
  const loadAllData = useCallback(async () => {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const wdItems: WdItem[] = [];

      // Owner WD
      const ownerWdKeys = allKeys.filter((k) => k.startsWith("@twd_owner_wd_"));
      for (const key of ownerWdKeys) {
        const ownerId = key.replace("@twd_owner_wd_", "");
        const raw = await AsyncStorage.getItem(key);
        if (!raw) continue;
        const list: WithdrawalRequest[] = JSON.parse(raw);
        const infoRaw = await AsyncStorage.getItem("@twd_store_info_" + ownerId);
        let userName = "Owner " + ownerId.slice(-4);
        if (infoRaw) {
          try {
            const info = JSON.parse(infoRaw);
            userName = info.namaToko ?? info.tokoName ?? userName;
          } catch {}
        }
        for (const wd of list) {
          wdItems.push({ ...wd, role: "owner", ownerKey: key, userName });
        }
      }

      // Kurir WD
      const kurirWdKeys = allKeys.filter((k) => k.startsWith("@twd_kurir_wd_"));
      const kurirRaw    = await AsyncStorage.getItem("@twd_kurir_accounts");
      const allKurir: KurirAccount[] = kurirRaw ? JSON.parse(kurirRaw) : [];
      for (const key of kurirWdKeys) {
        const kurirId = key.replace("@twd_kurir_wd_", "");
        const raw = await AsyncStorage.getItem(key);
        if (!raw) continue;
        const list: WithdrawalRequest[] = JSON.parse(raw);
        const kurir    = allKurir.find((k) => String(k.id) === kurirId);
        const userName = kurir?.name ?? "Kurir " + kurirId.slice(-4);
        for (const wd of list) {
          wdItems.push({ ...wd, role: "kurir", ownerKey: key, userName });
        }
      }

      // Marketing WD
      const mktWdKeys = allKeys.filter((k) => k.startsWith("@twd_mkt_wd_"));
      for (const key of mktWdKeys) {
        const mktId = key.replace("@twd_mkt_wd_", "");
        const raw = await AsyncStorage.getItem(key);
        if (!raw) continue;
        const list: WithdrawalRequest[] = JSON.parse(raw);
        const bankRaw = await AsyncStorage.getItem("@twd_mkt_bank_" + mktId);
        let userName  = "Marketing " + mktId.slice(-4);
        if (bankRaw) {
          try { userName = JSON.parse(bankRaw).namaPemilik ?? userName; } catch {}
        }
        for (const wd of list) {
          wdItems.push({ ...wd, role: "marketing", ownerKey: key, userName });
        }
      }

      // Sub-Marketing WD
      const smkWdKeys = allKeys.filter((k) => k.startsWith("@twd_smk_wd_"));
      for (const key of smkWdKeys) {
        const smkId = key.replace("@twd_smk_wd_", "");
        const raw = await AsyncStorage.getItem(key);
        if (!raw) continue;
        const list: WithdrawalRequest[] = JSON.parse(raw);
        const bankRaw = await AsyncStorage.getItem("@twd_smk_bank_" + smkId);
        let userName  = "Sub-Mkt " + smkId.slice(-4);
        if (bankRaw) {
          try { userName = JSON.parse(bankRaw).namaPemilik ?? userName; } catch {}
        }
        for (const wd of list) {
          wdItems.push({ ...wd, role: "sub_marketing", ownerKey: key, userName });
        }
      }

      wdItems.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setAllWd(wdItems);

      // Load users
      const users: UserEntry[] = [];
      const ownerRegRaw = await AsyncStorage.getItem("@twd_owner_registrations");
      const ownerRegs: OwnerRegistration[] = ownerRegRaw ? JSON.parse(ownerRegRaw) : [];
      for (const o of ownerRegs) {
        const name = (o.tokoName ?? "") + (o.name ? " (" + o.name + ")" : "");
        users.push({ id: o.id, name: name || "Owner", role: "owner", phone: o.phone, paket: o.paket, recruitedBy: o.recruitedBy });
      }
      for (const k of allKurir) {
        users.push({ id: k.id, name: k.name ?? "Kurir " + String(k.id).slice(-4), role: "kurir", phone: k.phone });
      }

      // ✅ Load marketing & sub_marketing dari @twd_marketing_accounts
      const mktRaw = await AsyncStorage.getItem("@twd_marketing_accounts");
      const mktList: any[] = mktRaw ? JSON.parse(mktRaw) : [];
      for (const m of mktList) {
        if (m.role === "marketing" || m.role === "sub_marketing") {
          users.push({ id: m.id, name: m.name ?? "Marketing", role: m.role, phone: m.phone });
        } else if (m.role === "kurir") {
          // Kurir dari SuperAdmin — tambahkan jika belum ada
          if (!users.find((u) => u.id === m.id)) {
            users.push({ id: m.id, name: m.name ?? "Kurir", role: "kurir", phone: m.phone });
          }
        }
      }

      // Load owners & kasir list
      setOwnersList(ownerRegs);
      const kasirRaw = await AsyncStorage.getItem("@twd_kasir_accounts");
      const kList: any[] = kasirRaw ? JSON.parse(kasirRaw) : [];
      setKasirList(kList);

      // Load total omzet ekosistem
      const ordRaw = await AsyncStorage.getItem("@twd_orders");
      const allOrds: any[] = ordRaw ? JSON.parse(ordRaw) : [];
      let omzetSum = 0;
      allOrds.forEach((o) => {
        if (o && (o.status === "selesai" || o.status === "dikirim" || o.status === "diproses")) {
          omzetSum += Number(o.total) || 0;
        }
      });
      setTotalOmzet(omzetSum);
      setTotalOrders(allOrds.length);

      setAllUsers(users);
    } catch (e) {
      console.error("SuperAdmin loadAllData:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadAllData(); }, [loadAllData]);
  function onRefresh() { setRefreshing(true); loadAllData(); }

  // ── Owner Langganan & Store Management ──────────────────────────────────
  async function handleUpdatePaketOwner(owner: OwnerRegistration, paketBaru: "basic" | "pro" | "enterprise") {
    try {
      const raw = await AsyncStorage.getItem("@twd_owner_registrations");
      const all: OwnerRegistration[] = raw ? JSON.parse(raw) : [];
      const upd = all.map((o) => (o.id === owner.id ? { ...o, paket: paketBaru } : o));
      await AsyncStorage.setItem("@twd_owner_registrations", JSON.stringify(upd));
      setDetailOwner((prev) => (prev ? { ...prev, paket: paketBaru } : null));
      await loadAllData();
      Alert.alert("Berhasil ✅", `Paket toko ${owner.tokoName} diubah ke ${paketBaru.toUpperCase()}`);
    } catch {
      Alert.alert("Error", "Gagal merubah paket.");
    }
  }

  async function handlePerpanjangOwner(owner: OwnerRegistration, hari: number) {
    try {
      const raw = await AsyncStorage.getItem("@twd_owner_registrations");
      const all: OwnerRegistration[] = raw ? JSON.parse(raw) : [];
      const expLama = owner.expiryDate ? new Date(owner.expiryDate) : new Date();
      const now = new Date();
      const baseDate = expLama > now ? expLama : now;
      const baruDate = new Date(baseDate.getTime() + hari * 86400000).toISOString();
      const upd = all.map((o) => (o.id === owner.id ? { ...o, expiryDate: baruDate } : o));
      await AsyncStorage.setItem("@twd_owner_registrations", JSON.stringify(upd));
      setDetailOwner((prev) => (prev ? { ...prev, expiryDate: baruDate } : null));
      await loadAllData();
      Alert.alert("Berhasil ✅", `Masa aktif toko ${owner.tokoName} diperpanjang +${hari} hari.`);
    } catch {
      Alert.alert("Error", "Gagal memperpanjang masa aktif.");
    }
  }

  async function handleHapusOwner(owner: OwnerRegistration) {
    Alert.alert(
      "Hapus Toko / Owner?",
      `Yakin ingin menghapus toko ${owner.tokoName}? Data tidak dapat dikembalikan.`,
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Hapus",
          style: "destructive",
          onPress: async () => {
            try {
              const raw = await AsyncStorage.getItem("@twd_owner_registrations");
              const all: OwnerRegistration[] = raw ? JSON.parse(raw) : [];
              const upd = all.filter((o) => o.id !== owner.id);
              await AsyncStorage.setItem("@twd_owner_registrations", JSON.stringify(upd));
              setShowOwnerMod(false);
              await loadAllData();
              Alert.alert("Toko Dihapus ✅", `Toko ${owner.tokoName} telah dihapus.`);
            } catch {
              Alert.alert("Error", "Gagal menghapus toko.");
            }
          },
        },
      ],
    );
  }

  async function handleToggleKasir(kasir: any) {
    try {
      const raw = await AsyncStorage.getItem("@twd_kasir_accounts");
      const all: any[] = raw ? JSON.parse(raw) : [];
      const upd = all.map((k) => (k.id === kasir.id ? { ...k, active: k.active === false ? true : false } : k));
      await AsyncStorage.setItem("@twd_kasir_accounts", JSON.stringify(upd));
      await loadAllData();
    } catch {}
  }

  // ── Registrasi Mitra ──────────────────────────────────────────────────────
  async function handleRegister() {
    if (!regName.trim()) { Alert.alert("Error", "Nama wajib diisi."); return; }
    if (!regPhone.trim()) { Alert.alert("Error", "No HP wajib diisi."); return; }
    if (!regPin.trim() || regPin.length < 4) { Alert.alert("Error", "PIN minimal 4 digit."); return; }

    setRegLoading(true);
    try {
      const id = genId();
      const createdAt = new Date().toISOString();
      const newAccount = {
        id, name: regName.trim(), phone: regPhone.trim(),
        pin: regPin.trim(), role: regRole, active: true, createdAt,
      };

      // ✅ Simpan ke @twd_marketing_accounts
      const rawMkt = await AsyncStorage.getItem("@twd_marketing_accounts");
      const mktList: any[] = rawMkt ? JSON.parse(rawMkt) : [];
      mktList.push(newAccount);
      await AsyncStorage.setItem("@twd_marketing_accounts", JSON.stringify(mktList));

      // ✅ Juga update mkt_data_v1 agar MarketingContext langsung bisa login
      const rawV1 = await AsyncStorage.getItem("mkt_data_v1");
      const v1: any = rawV1 ? JSON.parse(rawV1) : {};

      if (regRole === "kurir") {
        const kurirAccounts: any[] = v1.kurirAccounts ?? [];
        kurirAccounts.push({
          ...newAccount,
          wilayah: "", status: "available",
          alamatRumah: "", noKtp: "", fotoKtp: "",
          fotoSelfie: "", registeredBy: "super_admin", verified: false,
        });
        v1.kurirAccounts = kurirAccounts;
      } else {
        const marketingAccounts: any[] = v1.marketingAccounts ?? [];
        marketingAccounts.push(newAccount);
        v1.marketingAccounts = marketingAccounts;
      }
      await AsyncStorage.setItem("mkt_data_v1", JSON.stringify(v1));

      const roleStr = regRole === "marketing" ? "Marketing" : regRole === "sub_marketing" ? "Sub Marketing" : "Kurir";
      Alert.alert(
        "✅ Berhasil Didaftarkan",
        roleStr + " baru berhasil dibuat.\n\n" +
        "Nama  : " + regName.trim() + "\n" +
        "No HP : " + regPhone.trim() + "\n" +
        "PIN   : " + regPin.trim(),
      );

      setRegName(""); setRegPhone(""); setRegPin(""); setRegRole("marketing");
      await loadAllData();
    } catch (e) {
      console.error("handleRegister:", e);
      Alert.alert("Error", "Gagal menyimpan data. Coba lagi.");
    } finally {
      setRegLoading(false);
    }
  }

  // ── Computed ──────────────────────────────────────────────────────────────
  const pendingWd    = useMemo(() => allWd.filter((w) => w.status === "menunggu"), [allWd]);
  const diprosesWd   = useMemo(() => allWd.filter((w) => w.status === "diproses"), [allWd]);
  const totalPending = useMemo(() => pendingWd.reduce((s, w) => s + w.jumlah, 0), [pendingWd]);
  const totalSelesai = useMemo(
    () => allWd.filter((w) => w.status === "selesai").reduce((s, w) => s + w.jumlah, 0),
    [allWd],
  );
  const filteredWd = useMemo(() => {
    let list = allWd;
    if (filterRole   !== "semua") list = list.filter((w) => w.role   === filterRole);
    if (filterStatus !== "semua") list = list.filter((w) => w.status === filterStatus);
    return list;
  }, [allWd, filterRole, filterStatus]);
  const wdByRole = useMemo(() => {
    const map: Record<WdRole, number> = { owner: 0, kurir: 0, marketing: 0, sub_marketing: 0 };
    for (const w of pendingWd) map[w.role] = (map[w.role] ?? 0) + 1;
    return map;
  }, [pendingWd]);

  // ── Update WD status ──────────────────────────────────────────────────────
  async function updateWdStatus(wd: WdItem, newStatus: "diproses" | "selesai" | "ditolak", catatan: string) {
    setProcessing(true);
    try {
      const raw  = await AsyncStorage.getItem(wd.ownerKey);
      const list: WithdrawalRequest[] = raw ? JSON.parse(raw) : [];
      const updated = list.map((w) =>
        w.id === wd.id ? { ...w, status: newStatus, catatan: catatan.trim() || w.catatan } : w,
      );
      await AsyncStorage.setItem(wd.ownerKey, JSON.stringify(updated));
      await loadAllData();
      setShowWdDetail(false);
      setActionCatatan("");
      Alert.alert("Berhasil ✅", "Status diperbarui: " + WD_STATUS_LABEL[newStatus]);
    } catch {
      Alert.alert("Error", "Gagal memperbarui status.");
    } finally {
      setProcessing(false);
    }
  }

  function confirmAction(wd: WdItem, action: "diproses" | "selesai" | "ditolak") {
    const labels: Record<string, string> = {
      diproses: "Tandai Sedang Diproses",
      selesai:  "Konfirmasi Transfer Selesai",
      ditolak:  "Tolak Pencairan",
    };
    Alert.alert(
      labels[action],
      formatRp(wd.jumlah) + "\na.n. " + wd.namaPemilik +
      "\n" + wd.namaBank + " · " + wd.nomorRekening +
      (actionCatatan.trim() ? "\n\nCatatan: " + actionCatatan.trim() : ""),
      [
        { text: "Batal", style: "cancel" },
        {
          text: labels[action],
          style: action === "ditolak" ? "destructive" : "default",
          onPress: () => updateWdStatus(wd, action, actionCatatan),
        },
      ],
    );
  }

  function handleLogout() {
    Alert.alert("Logout", "Yakin ingin keluar dari Super Admin?", [
      { text: "Batal", style: "cancel" },
      { text: "Logout", style: "destructive", onPress: () => logout() },
    ]);
  }

  if (loading) {
    return (
      <View style={SA.center}>
        <ActivityIndicator size="large" color={ACCENT} />
        <Text style={SA.loadingTxt}>{"Memuat data..."}</Text>
      </View>
    );
  }
    return (
    <View style={SA.container}>
      {/* Header */}
      <View style={SA.header}>
        {onBack && (
          <TouchableOpacity onPress={onBack}>
            <Text style={SA.backTxt}>{"< Kembali"}</Text>
          </TouchableOpacity>
        )}
        <View style={SA.headerCenter}>
          <Text style={SA.headerTitle}>{"⚙️ Super Admin"}</Text>
          <Text style={SA.headerSub}>{"Panel Manajemen Aplikasi"}</Text>
        </View>
        <TouchableOpacity style={SA.logoutBtn} onPress={handleLogout}>
          <Text style={SA.logoutBtnTxt}>{"⏏ Keluar"}</Text>
        </TouchableOpacity>
      </View>

      {/* Tab Bar */}
      <View style={SA.tabBar}>
        {(["dashboard", "owner", "kasir", "pencairan", "users", "daftar"] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={activeTab === tab ? SA.tabActive : SA.tabInactive}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={activeTab === tab ? SA.tabLblActive : SA.tabLblInactive}>
              {tab === "dashboard" ? "📊" :
               tab === "owner"     ? "🏪" :
               tab === "kasir"     ? "💼" :
               tab === "pencairan" ? "💸" :
               tab === "users"     ? "👥" : "➕"}
            </Text>
            {tab === "pencairan" && pendingWd.length > 0 && (
              <View style={SA.tabBadge}>
                <Text style={SA.tabBadgeTxt}>{String(pendingWd.length)}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* ════ TAB: DASHBOARD ════ */}
      {activeTab === "dashboard" && (
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={SA.scrollContent}
        >
          {/* ── Ringkasan Ekosistem TWD ── */}
          <Text style={SA.sectionTitlePlain}>{"📈 Performa & Ekosistem TWD Mobile"}</Text>
          <View style={SA.statsGrid}>
            <View style={[SA.statCard, { backgroundColor: "#EEF2FF", borderColor: "#C7D2FE" }]}>
              <Text style={SA.statCardIcon}>{"💰"}</Text>
              <Text style={[SA.statCardVal, { color: "#3730A3" }]}>{formatRpShort(totalOmzet)}</Text>
              <Text style={SA.statCardLbl}>{"Total Omzet Ekosistem"}</Text>
              <Text style={SA.statCardSub}>{String(totalOrders) + " transaksi pesanan"}</Text>
            </View>
            <View style={[SA.statCard, { backgroundColor: "#F0FDF4", borderColor: "#BBF7D0" }]}>
              <Text style={SA.statCardIcon}>{"🏪"}</Text>
              <Text style={[SA.statCardVal, { color: "#166534" }]}>{String(ownersList.length)}</Text>
              <Text style={SA.statCardLbl}>{"Total Toko / Owner"}</Text>
              <Text style={SA.statCardSub}>{String(ownersList.filter(o => o.paket === "pro" || o.paket === "enterprise").length) + " paket berbayar"}</Text>
            </View>
            <View style={[SA.statCard, { backgroundColor: "#FFFBEB", borderColor: "#FDE68A" }]}>
              <Text style={SA.statCardIcon}>{"💼"}</Text>
              <Text style={[SA.statCardVal, { color: "#92400E" }]}>{String(kasirList.length)}</Text>
              <Text style={SA.statCardLbl}>{"Total Akun Kasir"}</Text>
              <Text style={SA.statCardSub}>{"POS Warung aktif"}</Text>
            </View>
            <View style={[SA.statCard, { backgroundColor: "#FAF5FF", borderColor: "#E9D5FF" }]}>
              <Text style={SA.statCardIcon}>{"👥"}</Text>
              <Text style={[SA.statCardVal, { color: "#6B21A8" }]}>{String(allUsers.length)}</Text>
              <Text style={SA.statCardLbl}>{"Mitra & Kurir"}</Text>
              <Text style={SA.statCardSub}>{"Jaringan aktif"}</Text>
            </View>
          </View>

          {/* ── Status Pembayaran Mayar.id ── */}
          <View style={{ backgroundColor: "#EEF2FF", borderRadius: 16, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: "#C7D2FE", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={{ backgroundColor: "#DBEAFE", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 }}>
                <Text style={{ fontSize: 13, fontWeight: "900", color: "#1D4ED8" }}>{"mayar.id"}</Text>
              </View>
              <View>
                <Text style={{ fontSize: 13, fontWeight: "800", color: "#1E3A8A" }}>{"Pembayaran Online Terintegrasi"}</Text>
                <Text style={{ fontSize: 11, color: "#3B82F6" }}>{"QRIS, Virtual Account, & e-Wallet — Live Production"}</Text>
              </View>
            </View>
            <View style={{ backgroundColor: "#DCFCE7", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 }}>
              <Text style={{ fontSize: 11, fontWeight: "800", color: "#15803D" }}>{"✅ CONNECTED"}</Text>
            </View>
          </View>

          <Text style={SA.sectionTitlePlain}>{"💸 Statistik Pencairan Dana (WD)"}</Text>
          <View style={SA.statsGrid}>
            <View style={[SA.statCard, SA.statCardOrange]}>
              <Text style={SA.statCardIcon}>{"⏳"}</Text>
              <Text style={SA.statCardVal}>{String(pendingWd.length)}</Text>
              <Text style={SA.statCardLbl}>{"Menunggu Approval"}</Text>
              <Text style={SA.statCardSub}>{formatRpShort(totalPending)}</Text>
            </View>
            <View style={[SA.statCard, SA.statCardBlue]}>
              <Text style={SA.statCardIcon}>{"🔄"}</Text>
              <Text style={SA.statCardVal}>{String(diprosesWd.length)}</Text>
              <Text style={SA.statCardLbl}>{"Sedang Diproses"}</Text>
              <Text style={SA.statCardSub}>{formatRpShort(diprosesWd.reduce((s, w) => s + w.jumlah, 0))}</Text>
            </View>
            <View style={[SA.statCard, SA.statCardGreen]}>
              <Text style={SA.statCardIcon}>{"✅"}</Text>
              <Text style={SA.statCardVal}>{String(allWd.filter((w) => w.status === "selesai").length)}</Text>
              <Text style={SA.statCardLbl}>{"Selesai Dicairkan"}</Text>
              <Text style={SA.statCardSub}>{formatRpShort(totalSelesai)}</Text>
            </View>
            <View style={[SA.statCard, SA.statCardPurple]}>
              <Text style={SA.statCardIcon}>{"👥"}</Text>
              <Text style={SA.statCardVal}>{String(allUsers.length)}</Text>
              <Text style={SA.statCardLbl}>{"Total User Terdaftar"}</Text>
              <Text style={SA.statCardSub}>{String(allUsers.filter((u) => u.role === "owner").length) + " owner"}</Text>
            </View>
          </View>

          <View style={SA.sectionCard}>
            <Text style={SA.sectionTitle}>{"📊 Pencairan Menunggu per Role"}</Text>
            {(["owner", "kurir", "marketing", "sub_marketing"] as WdRole[]).map((role) => {
              const count  = wdByRole[role] ?? 0;
              const amount = pendingWd.filter((w) => w.role === role).reduce((s, w) => s + w.jumlah, 0);
              return (
                <View key={role} style={SA.roleRow}>
                  <View style={[SA.roleColorDot, { backgroundColor: ROLE_COLOR[role] }]} />
                  <Text style={SA.roleLbl}>{ROLE_LABEL[role]}</Text>
                  <View style={SA.roleRight}>
                    {count > 0 ? (
                      <>
                        <View style={[SA.roleBadge, { backgroundColor: ROLE_COLOR[role] + "20" }]}>
                          <Text style={[SA.roleBadgeTxt, { color: ROLE_COLOR[role] }]}>{String(count) + " req"}</Text>
                        </View>
                        <Text style={SA.roleAmount}>{formatRpShort(amount)}</Text>
                      </>
                    ) : (
                      <Text style={SA.roleEmpty}>{"—"}</Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>

          {pendingWd.length > 0 && (
            <TouchableOpacity
              style={SA.quickActionBtn}
              onPress={() => { setActiveTab("pencairan"); setFilterStatus("menunggu"); }}
            >
              <Text style={SA.quickActionIcon}>{"⏳"}</Text>
              <View style={SA.quickActionText}>
                <Text style={SA.quickActionTitle}>{String(pendingWd.length) + " Pencairan Menunggu Persetujuan"}</Text>
                <Text style={SA.quickActionSub}>{"Total: " + formatRp(totalPending) + " — Tap untuk review"}</Text>
              </View>
              <Text style={SA.quickActionArrow}>{"›"}</Text>
            </TouchableOpacity>
          )}

          <Text style={SA.sectionTitlePlain}>{"🕐 Permintaan Terbaru"}</Text>
          {allWd.slice(0, 5).map((wd) => (
            <TouchableOpacity
              key={wd.id + wd.role}
              style={SA.recentWdCard}
              onPress={() => { setSelectedWd(wd); setActionCatatan(wd.catatan ?? ""); setShowWdDetail(true); }}
            >
              <View style={SA.recentWdLeft}>
                <View style={SA.recentWdTopRow}>
                  <View style={[SA.roleChip, { backgroundColor: ROLE_COLOR[wd.role] + "18" }]}>
                    <Text style={[SA.roleChipTxt, { color: ROLE_COLOR[wd.role] }]}>{ROLE_LABEL[wd.role]}</Text>
                  </View>
                  <Text style={SA.recentWdName}>{wd.userName}</Text>
                </View>
                <Text style={SA.recentWdBank}>{wd.namaBank + " · " + wd.nomorRekening}</Text>
                <Text style={SA.recentWdDate}>{formatDate(wd.createdAt)}</Text>
              </View>
              <View style={SA.recentWdRight}>
                <Text style={SA.recentWdJumlah}>{formatRpShort(wd.jumlah)}</Text>
                <View style={[SA.statusPill, { backgroundColor: (WD_STATUS_COLOR[wd.status] ?? "#64748B") + "20" }]}>
                  <Text style={[SA.statusPillTxt, { color: WD_STATUS_COLOR[wd.status] ?? "#64748B" }]}>
                    {WD_STATUS_LABEL[wd.status]}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}

          {allWd.length === 0 && (
            <View style={SA.emptyBox}>
              <Text style={SA.emptyIcon}>{"💸"}</Text>
              <Text style={SA.emptyTxt}>{"Belum ada permintaan pencairan."}</Text>
            </View>
          )}
          <View style={SA.bottomSpacer} />
        </ScrollView>
      )}

      {/* ════ TAB: PENCAIRAN ════ */}
      {/* ════ TAB: OWNER (Manajemen Toko & Langganan) ════ */}
      {activeTab === "owner" && (
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={SA.scrollContent}
        >
          <Text style={SA.sectionTitlePlain}>{"🏪 Manajemen Semua Toko & Owner (" + ownersList.length + ")"}</Text>
          {ownersList.length === 0 ? (
            <View style={SA.emptyCard}>
              <Text style={SA.emptyTxt}>{"Belum ada toko terdaftar."}</Text>
            </View>
          ) : (
            ownersList.map((owner) => (
              <TouchableOpacity
                key={owner.id}
                style={[SA.card, { marginBottom: 12 }]}
                onPress={() => { setDetailOwner(owner); setShowOwnerMod(true); }}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <Text style={{ fontSize: 16, fontWeight: "800", color: "#1E293B" }}>
                    {"🏪 " + (owner.tokoName || "Toko #" + owner.id.slice(-4))}
                  </Text>
                  <View style={{ backgroundColor: owner.paket === "enterprise" ? "#F3E8FF" : owner.paket === "pro" ? "#FEF3C7" : "#E2E8F0", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
                    <Text style={{ fontSize: 11, fontWeight: "800", color: owner.paket === "enterprise" ? "#7E22CE" : owner.paket === "pro" ? "#D97706" : "#475569" }}>
                      {(owner.paket || "basic").toUpperCase()}
                    </Text>
                  </View>
                </View>
                <Text style={{ fontSize: 13, color: "#475569", marginBottom: 4 }}>
                  {"👤 " + owner.name + " · 📞 " + (owner.phone || "-")}
                </Text>
                <Text style={{ fontSize: 12, color: "#64748B", marginBottom: 8 }}>
                  {"Kode Toko: "}
                  <Text style={{ fontWeight: "800", color: "#2563EB" }}>{owner.kode || "TWD-" + owner.id.slice(-6).toUpperCase()}</Text>
                  {" · Exp: " + (owner.expiryDate ? new Date(owner.expiryDate).toLocaleDateString("id-ID") : "Aktif")}
                </Text>
                <View style={{ flexDirection: "row", justifyContent: "flex-end", borderTopWidth: 1, borderTopColor: "#F1F5F9", paddingTop: 8 }}>
                  <Text style={{ fontSize: 12, fontWeight: "700", color: "#7C3AED" }}>{"⚙️ Kelola Langganan →"}</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}

      {/* ════ TAB: KASIR (Manajemen Kasir Semua Toko) ════ */}
      {activeTab === "kasir" && (
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={SA.scrollContent}
        >
          <Text style={SA.sectionTitlePlain}>{"💼 Semua Akun Kasir Toko (" + kasirList.length + ")"}</Text>
          {kasirList.length === 0 ? (
            <View style={SA.emptyCard}>
              <Text style={SA.emptyTxt}>{"Belum ada akun kasir terdaftar."}</Text>
            </View>
          ) : (
            kasirList.map((k) => (
              <View key={k.id} style={[SA.card, { marginBottom: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }]}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: "800", color: "#1E293B" }}>
                    {"💼 " + (k.name || k.nama || "Kasir")}
                  </Text>
                  <Text style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>
                    {"Toko Owner: #" + String(k.ownerId ?? "").slice(-4) + " · 📞 " + (k.phone || "-")}
                  </Text>
                  <Text style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>
                    {"PIN: •••••• · Status: " + (k.active === false ? "NONAKTIF" : "AKTIF")}
                  </Text>
                </View>
                <TouchableOpacity
                  style={{ backgroundColor: k.active === false ? "#FEE2E2" : "#DCFCE7", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 }}
                  onPress={() => handleToggleKasir(k)}
                >
                  <Text style={{ fontSize: 12, fontWeight: "800", color: k.active === false ? "#DC2626" : "#16A34A" }}>
                    {k.active === false ? "▶️ Aktifkan" : "⏸️ Nonaktifkan"}
                  </Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* ════ TAB: PENCAIRAN ════ */}
      {activeTab === "pencairan" && (
        <View style={SA.pencairanRoot}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={SA.filterScroll} contentContainerStyle={SA.filterContent}>
            {FILTER_ROLE_OPTIONS.map((opt) => {
              const cnt = opt.key === "semua" ? allWd.length : allWd.filter((w) => w.role === opt.key).length;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={filterRole === opt.key ? [SA.filterBtn, SA.filterBtnActive] : SA.filterBtn}
                  onPress={() => setFilterRole(opt.key)}
                >
                  <Text style={filterRole === opt.key ? SA.filterTxtActive : SA.filterTxt}>{opt.label}</Text>
                  {cnt > 0 && (
                    <View style={SA.filterBadge}>
                      <Text style={SA.filterBadgeTxt}>{String(cnt)}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={SA.filterScroll2} contentContainerStyle={SA.filterContent}>
            {FILTER_STATUS_OPTIONS.map((opt) => {
              const cnt = opt.key === "semua" ? allWd.length : allWd.filter((w) => w.status === opt.key).length;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={filterStatus === opt.key ? [SA.filterBtn2, SA.filterBtn2Active] : SA.filterBtn2}
                  onPress={() => setFilterStatus(opt.key)}
                >
                  <Text style={filterStatus === opt.key ? SA.filterTxt2Active : SA.filterTxt2}>{opt.label}</Text>
                  {cnt > 0 && (
                    <View style={[SA.filterBadge, { backgroundColor: (WD_STATUS_COLOR[opt.key] ?? "#64748B") + "25" }]}>
                      <Text style={[SA.filterBadgeTxt, { color: WD_STATUS_COLOR[opt.key] ?? "#64748B" }]}>{String(cnt)}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <ScrollView style={SA.pencairanScroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />} contentContainerStyle={SA.pencairanContent}>
            {filteredWd.length === 0 ? (
              <View style={SA.emptyBox}>
                <Text style={SA.emptyIcon}>{"💸"}</Text>
                <Text style={SA.emptyTxt}>{"Tidak ada data dengan filter ini."}</Text>
              </View>
            ) : (
              filteredWd.map((wd) => (
                <TouchableOpacity
                  key={wd.id + wd.role}
                  style={SA.wdCard}
                  onPress={() => { setSelectedWd(wd); setActionCatatan(wd.catatan ?? ""); setShowWdDetail(true); }}
                  activeOpacity={0.85}
                >
                  <View style={SA.wdCardTop}>
                    <View style={SA.wdCardTopLeft}>
                      <View style={[SA.roleChip, { backgroundColor: ROLE_COLOR[wd.role] + "18" }]}>
                        <Text style={[SA.roleChipTxt, { color: ROLE_COLOR[wd.role] }]}>{ROLE_LABEL[wd.role]}</Text>
                      </View>
                      <Text style={SA.wdCardName}>{wd.userName}</Text>
                    </View>
                    <View style={[SA.statusPill, { backgroundColor: (WD_STATUS_COLOR[wd.status] ?? "#64748B") + "20" }]}>
                      <Text style={[SA.statusPillTxt, { color: WD_STATUS_COLOR[wd.status] ?? "#64748B" }]}>
                        {WD_STATUS_LABEL[wd.status]}
                      </Text>
                    </View>
                  </View>
                  <View style={SA.wdCardBank}>
                    <Text style={SA.wdCardBankName}>{wd.namaBank}</Text>
                    <Text style={SA.wdCardBankNum}>{wd.nomorRekening}</Text>
                    <Text style={SA.wdCardBankOwner}>{"a.n. " + wd.namaPemilik}</Text>
                  </View>
                  <View style={SA.wdCardFooter}>
                    <Text style={SA.wdCardDate}>{formatDate(wd.createdAt)}</Text>
                    <Text style={SA.wdCardJumlah}>{formatRp(wd.jumlah)}</Text>
                  </View>
                  {wd.catatan ? (
                    <View style={SA.wdCatatanBox}>
                      <Text style={SA.wdCatatanTxt}>{"📝 " + wd.catatan}</Text>
                    </View>
                  ) : null}
                  {wd.status === "menunggu" && (
                    <View style={SA.wdQuickActions}>
                      <TouchableOpacity style={SA.wdBtnProses} onPress={() => { setSelectedWd(wd); updateWdStatus(wd, "diproses", ""); }}>
                        <Text style={SA.wdBtnProsesTxt}>{"🔄 Proses"}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={SA.wdBtnApprove} onPress={() => { setSelectedWd(wd); setActionCatatan(""); confirmAction(wd, "selesai"); }}>
                        <Text style={SA.wdBtnApproveTxt}>{"✅ Approve"}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={SA.wdBtnReject} onPress={() => { setSelectedWd(wd); setShowWdDetail(true); setActionCatatan(""); }}>
                        <Text style={SA.wdBtnRejectTxt}>{"❌ Tolak"}</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  {wd.status === "diproses" && (
                    <View style={SA.wdQuickActions}>
                      <TouchableOpacity style={SA.wdBtnApprove} onPress={() => { setSelectedWd(wd); setActionCatatan(""); confirmAction(wd, "selesai"); }}>
                        <Text style={SA.wdBtnApproveTxt}>{"✅ Konfirmasi Transfer"}</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </TouchableOpacity>
              ))
            )}
            <View style={SA.bottomSpacer} />
          </ScrollView>
        </View>
      )}

      {/* ════ TAB: USERS ════ */}
      {activeTab === "users" && (
        <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />} contentContainerStyle={SA.scrollContent}>
          <View style={SA.usersSummaryRow}>
            {(["owner", "kurir", "marketing", "sub_marketing"] as WdRole[]).map((role) => {
              const count = allUsers.filter((u) => u.role === role).length;
              return (
                <View key={role} style={[SA.usersSummaryCard, { borderTopColor: ROLE_COLOR[role] }]}>
                  <Text style={[SA.usersSummaryVal, { color: ROLE_COLOR[role] }]}>{String(count)}</Text>
                  <Text style={SA.usersSummaryLbl}>
                    {role === "owner" ? "Owner" : role === "kurir" ? "Kurir" : role === "marketing" ? "Marketing" : "Sub-Mkt"}
                  </Text>
                </View>
              );
            })}
          </View>
          {(["owner", "kurir", "marketing", "sub_marketing"] as WdRole[]).map((role) => {
            const users = allUsers.filter((u) => u.role === role);
            if (users.length === 0) return null;
            return (
              <View key={role}>
                <View style={[SA.userRoleHeader, { backgroundColor: ROLE_COLOR[role] + "12" }]}>
                  <View style={[SA.userRoleDot, { backgroundColor: ROLE_COLOR[role] }]} />
                  <Text style={[SA.userRoleTitle, { color: ROLE_COLOR[role] }]}>
                    {ROLE_LABEL[role] + "  (" + String(users.length) + ")"}
                  </Text>
                </View>
                {users.map((u) => (
                  <View key={u.id} style={SA.userCard}>
                    <View style={[SA.userAvatar, { backgroundColor: ROLE_COLOR[role] + "20" }]}>
                      <Text style={[SA.userAvatarTxt, { color: ROLE_COLOR[role] }]}>{safeInitial(u.name)}</Text>
                    </View>
                    <View style={SA.userInfo}>
                      <Text style={SA.userName}>{u.name || "—"}</Text>
                      {u.phone ? <Text style={SA.userPhone}>{"📞 " + u.phone}</Text> : null}
                      {u.paket ? (
                        <View style={SA.userPaketRow}>
                          <View style={[SA.userPaketBadge, { backgroundColor: ROLE_COLOR[role] }]}>
                            <Text style={SA.userPaketBadgeTxt}>{u.paket?.toUpperCase() ?? ""}</Text>
                          </View>
                        </View>
                      ) : null}
                    </View>
                    <Text style={SA.userId}>{"#" + String(u.id).slice(-6)}</Text>
                  </View>
                ))}
              </View>
            );
          })}
          {allUsers.length === 0 && (
            <View style={SA.emptyBox}>
              <Text style={SA.emptyIcon}>{"👥"}</Text>
              <Text style={SA.emptyTxt}>{"Belum ada user terdaftar."}</Text>
            </View>
          )}
          <View style={SA.bottomSpacer} />
        </ScrollView>
      )}

      {/* ════ TAB: DAFTAR ════ */}
      {activeTab === "daftar" && (
        <ScrollView contentContainerStyle={SA.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={SA.regCard}>
            <Text style={SA.regTitle}>{"➕ Daftarkan Mitra Baru"}</Text>
            <Text style={SA.regSubtitle}>{"Pilih role yang akan didaftarkan:"}</Text>

            {/* Pilih Role */}
            <View style={SA.regRoleRow}>
              {REG_ROLE_OPTIONS.map((r) => (
                <TouchableOpacity
                  key={r.key}
                  style={[SA.regRoleBtn, regRole === r.key && { borderColor: r.color, backgroundColor: r.color + "15" }]}
                  onPress={() => setRegRole(r.key)}
                >
                  <Text style={[SA.regRoleBtnTxt, regRole === r.key && { color: r.color, fontWeight: "800" }]}>
                    {r.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Form */}
            <Text style={SA.regFieldLbl}>{"Nama Lengkap *"}</Text>
            <TextInput
              style={SA.regInput}
              value={regName}
              onChangeText={setRegName}
              placeholder="Masukkan nama lengkap..."
              placeholderTextColor="#94A3B8"
            />

            <Text style={SA.regFieldLbl}>{"No. HP *"}</Text>
            <TextInput
              style={SA.regInput}
              value={regPhone}
              onChangeText={setRegPhone}
              placeholder="08xx..."
              placeholderTextColor="#94A3B8"
              keyboardType="phone-pad"
            />

            <Text style={SA.regFieldLbl}>{"PIN * (min 4 digit)"}</Text>
            <TextInput
              style={SA.regInput}
              value={regPin}
              onChangeText={setRegPin}
              placeholder="Masukkan PIN..."
              placeholderTextColor="#94A3B8"
              keyboardType="number-pad"
              secureTextEntry
            />

            <TouchableOpacity
              style={[SA.regSubmitBtn, regLoading && { opacity: 0.6 }]}
              onPress={handleRegister}
              disabled={regLoading}
            >
              {regLoading
                ? <ActivityIndicator color="#fff" />
                : <Text style={SA.regSubmitBtnTxt}>{"✅ Daftarkan Sekarang"}</Text>
              }
            </TouchableOpacity>
          </View>

          {/* Info */}
          <View style={SA.regInfoCard}>
            <Text style={SA.regInfoTitle}>{"ℹ️ Informasi"}</Text>
            <Text style={SA.regInfoTxt}>{"• Marketing & Sub Marketing dapat login di halaman login mitra."}</Text>
            <Text style={SA.regInfoTxt}>{"• Kurir dapat login di halaman login kurir."}</Text>
            <Text style={SA.regInfoTxt}>{"• Data tersimpan dan langsung bisa digunakan."}</Text>
          </View>

          <View style={SA.bottomSpacer} />
        </ScrollView>
      )}

      {/* ════ Modal: Detail WD ════ */}
      <Modal visible={showWdDetail} transparent animationType="slide" onRequestClose={() => setShowWdDetail(false)}>
        <View style={SA.overlay}>
          <View style={SA.detailSheet}>
            {selectedWd !== null && (
              <>
                <View style={SA.detailHeader}>
                  <Text style={SA.detailTitle}>{"Detail Pencairan"}</Text>
                  <TouchableOpacity onPress={() => setShowWdDetail(false)}>
                    <Text style={SA.detailClose}>{"✕"}</Text>
                  </TouchableOpacity>
                </View>
                <View style={[SA.detailStatusStrip, { backgroundColor: (WD_STATUS_COLOR[selectedWd.status] ?? "#64748B") + "18" }]}>
                  <Text style={[SA.detailStatusTxt, { color: WD_STATUS_COLOR[selectedWd.status] ?? "#64748B" }]}>
                    {WD_STATUS_LABEL[selectedWd.status]}
                  </Text>
                  <View style={[SA.roleChip, { backgroundColor: ROLE_COLOR[selectedWd.role] + "20" }]}>
                    <Text style={[SA.roleChipTxt, { color: ROLE_COLOR[selectedWd.role] }]}>{ROLE_LABEL[selectedWd.role]}</Text>
                  </View>
                </View>
                <ScrollView showsVerticalScrollIndicator={false}>
                  <View style={SA.detailSection}>
                    <Text style={SA.detailSectionTitle}>{"👤 Pemohon"}</Text>
                    <Text style={SA.detailName}>{selectedWd.userName}</Text>
                    <Text style={SA.detailId}>{"ID: #" + selectedWd.id.slice(-8).toUpperCase()}</Text>
                    <Text style={SA.detailDate}>{formatDate(selectedWd.createdAt)}</Text>
                  </View>
                  <View style={SA.detailSection}>
                    <Text style={SA.detailSectionTitle}>{"🏦 Rekening Tujuan"}</Text>
                    <Text style={SA.detailBankName}>{selectedWd.namaBank}</Text>
                    <Text style={SA.detailBankNum}>{selectedWd.nomorRekening}</Text>
                    <Text style={SA.detailBankOwner}>{"a.n. " + selectedWd.namaPemilik}</Text>
                  </View>
                  <View style={SA.detailJumlahCard}>
                    <Text style={SA.detailJumlahLbl}>{"Jumlah Transfer"}</Text>
                    <Text style={SA.detailJumlahVal}>{formatRp(selectedWd.jumlah)}</Text>
                  </View>
                  {selectedWd.catatan ? (
                    <View style={SA.detailCatatanExist}>
                      <Text style={SA.detailCatatanExistLbl}>{"📝 Catatan Sebelumnya"}</Text>
                      <Text style={SA.detailCatatanExistTxt}>{selectedWd.catatan}</Text>
                    </View>
                  ) : null}
                  {selectedWd.status !== "selesai" && selectedWd.status !== "ditolak" && (
                    <View style={SA.detailCatatanInput}>
                      <Text style={SA.detailCatatanLbl}>{"📝 Catatan Admin (opsional)"}</Text>
                      <TextInput
                        style={SA.catatanInput}
                        value={actionCatatan}
                        onChangeText={setActionCatatan}
                        placeholder="Misal: Sudah ditransfer jam 14.00..."
                        placeholderTextColor="#94A3B8"
                        multiline
                        numberOfLines={2}
                      />
                    </View>
                  )}
                  {selectedWd.status === "menunggu" && (
                    <View style={SA.detailActions}>
                      <TouchableOpacity style={[SA.detailActionBtn, SA.detailActionProses]} onPress={() => confirmAction(selectedWd, "diproses")} disabled={processing}>
                        {processing ? <ActivityIndicator color="#fff" /> : <Text style={SA.detailActionBtnTxt}>{"🔄 Proses"}</Text>}
                      </TouchableOpacity>
                      <TouchableOpacity style={[SA.detailActionBtn, SA.detailActionApprove]} onPress={() => confirmAction(selectedWd, "selesai")} disabled={processing}>
                        {processing ? <ActivityIndicator color="#fff" /> : <Text style={SA.detailActionBtnTxt}>{"✅ Approve"}</Text>}
                      </TouchableOpacity>
                      <TouchableOpacity style={[SA.detailActionBtn, SA.detailActionReject]} onPress={() => confirmAction(selectedWd, "ditolak")} disabled={processing}>
                        {processing ? <ActivityIndicator color="#fff" /> : <Text style={SA.detailActionBtnTxt}>{"❌ Tolak"}</Text>}
                      </TouchableOpacity>
                    </View>
                  )}
                  {selectedWd.status === "diproses" && (
                    <View style={SA.detailActions}>
                      <TouchableOpacity style={[SA.detailActionBtn, SA.detailActionApprove, SA.detailActionFull]} onPress={() => confirmAction(selectedWd, "selesai")} disabled={processing}>
                        {processing ? <ActivityIndicator color="#fff" /> : <Text style={SA.detailActionBtnTxt}>{"✅ Konfirmasi Transfer Selesai"}</Text>}
                      </TouchableOpacity>
                      <TouchableOpacity style={[SA.detailActionBtn, SA.detailActionReject]} onPress={() => confirmAction(selectedWd, "ditolak")} disabled={processing}>
                        {processing ? <ActivityIndicator color="#fff" /> : <Text style={SA.detailActionBtnTxt}>{"❌ Tolak"}</Text>}
                      </TouchableOpacity>
                    </View>
                  )}
                  {(selectedWd.status === "selesai" || selectedWd.status === "ditolak") && (
                    <View style={[SA.detailFinalBadge, { backgroundColor: WD_STATUS_COLOR[selectedWd.status] + "15" }]}>
                      <Text style={[SA.detailFinalTxt, { color: WD_STATUS_COLOR[selectedWd.status] }]}>
                        {selectedWd.status === "selesai"
                          ? "✅ Transfer sudah selesai diproses."
                          : "❌ Pencairan ini telah ditolak."}
                      </Text>
                    </View>
                  )}
                </ScrollView>
                <View style={SA.sheetBottomSafe} />
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ── Modal Kelola Langganan Toko (Owner) ── */}
      <Modal visible={showOwnerMod} transparent animationType="slide" onRequestClose={() => setShowOwnerMod(false)}>
        <View style={SA.overlay}>
          <View style={SA.detailSheet}>
            {detailOwner && (
              <>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <Text style={{ fontSize: 18, fontWeight: "800", color: "#1E293B" }}>
                    {"🏪 " + detailOwner.tokoName}
                  </Text>
                  <TouchableOpacity onPress={() => setShowOwnerMod(false)}>
                    <Text style={{ fontSize: 20, color: "#64748B", fontWeight: "700" }}>✕</Text>
                  </TouchableOpacity>
                </View>

                <View style={{ backgroundColor: "#F8FAFC", borderRadius: 12, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: "#E2E8F0" }}>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: "#1E293B" }}>{"👤 Owner: " + detailOwner.name}</Text>
                  <Text style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>{"📞 WhatsApp: " + (detailOwner.phone || "-")}</Text>
                  <Text style={{ fontSize: 12, color: "#2563EB", fontWeight: "700", marginTop: 4 }}>
                    {"Kode Toko: " + (detailOwner.kode || "TWD-" + detailOwner.id.slice(-6).toUpperCase())}
                  </Text>
                </View>

                <Text style={{ fontSize: 13, fontWeight: "800", color: "#334155", marginBottom: 8 }}>
                  {"⚡ Ganti Paket Langganan Toko:"}
                </Text>
                <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
                  {(["basic", "pro", "enterprise"] as const).map((pkg) => (
                    <TouchableOpacity
                      key={pkg}
                      style={{
                        flex: 1,
                        backgroundColor: detailOwner.paket === pkg ? "#EEF2FF" : "#F1F5F9",
                        paddingVertical: 10,
                        borderRadius: 10,
                        alignItems: "center",
                        borderWidth: 1,
                        borderColor: detailOwner.paket === pkg ? "#6366F1" : "#E2E8F0",
                      }}
                      onPress={() => handleUpdatePaketOwner(detailOwner, pkg)}
                    >
                      <Text style={{ fontSize: 12, fontWeight: detailOwner.paket === pkg ? "800" : "600", color: detailOwner.paket === pkg ? "#4338CA" : "#64748B" }}>
                        {pkg.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={{ fontSize: 13, fontWeight: "800", color: "#334155", marginBottom: 8 }}>
                  {"📅 Perpanjang Masa Aktif:"}
                </Text>
                <View style={{ flexDirection: "row", gap: 8, marginBottom: 18 }}>
                  <TouchableOpacity
                    style={{ flex: 1, backgroundColor: "#EEF2FF", borderRadius: 10, paddingVertical: 12, alignItems: "center", borderWidth: 1, borderColor: "#C7D2FE" }}
                    onPress={() => handlePerpanjangOwner(detailOwner, 30)}
                  >
                    <Text style={{ fontSize: 12, fontWeight: "800", color: "#4338CA" }}>{"+ 30 Hari (1 Bulan)"}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ flex: 1, backgroundColor: "#EEF2FF", borderRadius: 10, paddingVertical: 12, alignItems: "center", borderWidth: 1, borderColor: "#C7D2FE" }}
                    onPress={() => handlePerpanjangOwner(detailOwner, 365)}
                  >
                    <Text style={{ fontSize: 12, fontWeight: "800", color: "#4338CA" }}>{"+ 365 Hari (1 Tahun)"}</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={{ backgroundColor: "#FEE2E2", borderRadius: 12, paddingVertical: 14, alignItems: "center" }}
                  onPress={() => handleHapusOwner(detailOwner)}
                >
                  <Text style={{ color: "#DC2626", fontWeight: "800", fontSize: 13 }}>{"❌ Hapus / Nonaktifkan Toko Ini"}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── StyleSheet ───────────────────────────────────────────────────────────────
const SA = StyleSheet.create({
  container:    { flex: 1, backgroundColor: "#F1F5F9" },
  center:       { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingTxt:   { marginTop: 12, fontSize: 14, color: "#64748B" },
  scrollContent:{ padding: 14, paddingBottom: 40 },
  bottomSpacer: { height: 40 },
  header:       { backgroundColor: ACCENT, paddingTop: 52, paddingBottom: 16, paddingHorizontal: 20, flexDirection: "row", alignItems: "center" },
  backTxt:      { color: "rgba(255,255,255,0.85)", fontSize: 13, marginRight: 10 },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle:  { fontSize: 18, fontWeight: "800", color: "#fff" },
  headerSub:    { fontSize: 11, color: "rgba(255,255,255,0.7)", marginTop: 2 },
  logoutBtn:    { backgroundColor: "rgba(255,255,255,0.18)", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: "rgba(255,255,255,0.3)" },
  logoutBtnTxt: { color: "#fff", fontSize: 12, fontWeight: "700" },
  tabBar:        { flexDirection: "row", backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#E2E8F0" },
  tabActive:     { flex: 1, paddingVertical: 12, alignItems: "center", borderBottomWidth: 3, borderBottomColor: ACCENT, flexDirection: "row", justifyContent: "center", gap: 4 },
  tabInactive:   { flex: 1, paddingVertical: 12, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 4 },
  tabLblActive:  { fontSize: 16, fontWeight: "800", color: ACCENT },
  tabLblInactive:{ fontSize: 16, fontWeight: "600", color: "#64748B" },
  tabBadge:      { backgroundColor: DANGER, borderRadius: 8, minWidth: 16, height: 16, justifyContent: "center", alignItems: "center", paddingHorizontal: 4 },
  tabBadgeTxt:   { color: "#fff", fontSize: 9, fontWeight: "800" },
  statsGrid:     { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 14 },
  statCard:      { width: "47%", borderRadius: 14, padding: 14, backgroundColor: "#fff", borderTopWidth: 4, elevation: 2 },
  statCardOrange:{ borderTopColor: ORANGE },
  statCardBlue:  { borderTopColor: BLUE },
  statCardGreen: { borderTopColor: SUCCESS },
  statCardPurple:{ borderTopColor: ACCENT },
  statCardIcon:  { fontSize: 20, marginBottom: 6 },
  statCardVal:   { fontSize: 24, fontWeight: "800", color: "#1E293B" },
  statCardLbl:   { fontSize: 11, color: "#64748B", marginTop: 4 },
  statCardSub:   { fontSize: 12, fontWeight: "700", color: "#475569", marginTop: 2 },
  sectionCard:   { backgroundColor: "#fff", borderRadius: 14, padding: 16, marginBottom: 12, elevation: 2 },
  sectionTitle:  { fontSize: 14, fontWeight: "700", color: "#1E293B", marginBottom: 12 },
  sectionTitlePlain: { fontSize: 13, fontWeight: "700", color: "#374151", marginBottom: 8 },
  roleRow:      { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#F8FAFC" },
  roleColorDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  roleLbl:      { fontSize: 13, color: "#374151", flex: 1 },
  roleRight:    { flexDirection: "row", alignItems: "center", gap: 8 },
  roleBadge:    { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  roleBadgeTxt: { fontSize: 11, fontWeight: "700" },
  roleAmount:   { fontSize: 13, fontWeight: "700", color: "#1E293B" },
  roleEmpty:    { fontSize: 13, color: "#CBD5E1" },
  quickActionBtn:   { backgroundColor: "#FFF7ED", borderRadius: 14, padding: 16, marginBottom: 14, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#FED7AA" },
  quickActionIcon:  { fontSize: 28, marginRight: 12 },
  quickActionText:  { flex: 1 },
  quickActionTitle: { fontSize: 14, fontWeight: "700", color: "#92400E" },
  quickActionSub:   { fontSize: 11, color: "#B45309", marginTop: 2 },
  quickActionArrow: { fontSize: 24, color: ORANGE },
  recentWdCard:   { backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 8, elevation: 1, flexDirection: "row", alignItems: "flex-start" },
  recentWdLeft:   { flex: 1 },
  recentWdTopRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  recentWdName:   { fontSize: 13, fontWeight: "600", color: "#1E293B" },
  recentWdBank:   { fontSize: 11, color: "#64748B", marginTop: 2 },
  recentWdDate:   { fontSize: 10, color: "#94A3B8", marginTop: 2 },
  recentWdRight:  { alignItems: "flex-end", gap: 6 },
  recentWdJumlah: { fontSize: 15, fontWeight: "800", color: "#1E293B" },
  roleChip:    { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  roleChipTxt: { fontSize: 9, fontWeight: "800" },
  statusPill:   { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  statusPillTxt:{ fontSize: 10, fontWeight: "700" },
  pencairanRoot:    { flex: 1 },
  filterScroll:     { backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#E2E8F0", maxHeight: 48 },
  filterScroll2:    { backgroundColor: "#F8FAFC", borderBottomWidth: 1, borderBottomColor: "#E2E8F0", maxHeight: 44 },
  filterContent:    { paddingHorizontal: 10, paddingVertical: 7, gap: 6, flexDirection: "row" },
  filterBtn:        { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 5, borderRadius: 14, backgroundColor: "#F1F5F9", borderWidth: 1, borderColor: "#E2E8F0", gap: 4 },
  filterBtnActive:  { backgroundColor: ACCENT, borderColor: ACCENT },
  filterTxt:        { fontSize: 11, fontWeight: "600", color: "#64748B" },
  filterTxtActive:  { fontSize: 11, fontWeight: "700", color: "#fff" },
  filterBtn2:       { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E2E8F0", gap: 4 },
  filterBtn2Active: { backgroundColor: "#EDE9FE", borderColor: ACCENT },
  filterTxt2:       { fontSize: 11, fontWeight: "600", color: "#64748B" },
  filterTxt2Active: { fontSize: 11, fontWeight: "700", color: ACCENT },
  filterBadge:      { backgroundColor: "rgba(0,0,0,0.12)", borderRadius: 8, minWidth: 16, height: 16, justifyContent: "center", alignItems: "center", paddingHorizontal: 3 },
  filterBadgeTxt:   { color: "#fff", fontSize: 9, fontWeight: "800" },
  pencairanScroll:  { flex: 1 },
  pencairanContent: { padding: 12, paddingBottom: 40 },
  wdCard:         { backgroundColor: "#fff", borderRadius: 14, padding: 14, marginBottom: 10, elevation: 2 },
  wdCardTop:      { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 },
  wdCardTopLeft:  { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  wdCardName:     { fontSize: 14, fontWeight: "700", color: "#1E293B", flex: 1 },
  wdCardBank:     { backgroundColor: "#F8FAFC", borderRadius: 10, padding: 10, marginBottom: 10 },
  wdCardBankName: { fontSize: 14, fontWeight: "700", color: "#1E293B" },
  wdCardBankNum:  { fontSize: 13, color: "#374151", marginTop: 2 },
  wdCardBankOwner:{ fontSize: 11, color: "#64748B", marginTop: 2 },
  wdCardFooter:   { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  wdCardDate:     { fontSize: 10, color: "#94A3B8" },
  wdCardJumlah:   { fontSize: 18, fontWeight: "800", color: "#1E293B" },
  wdCatatanBox:   { backgroundColor: "#FFF7ED", borderRadius: 8, padding: 8, marginTop: 8 },
  wdCatatanTxt:   { fontSize: 11, color: "#92400E" },
  wdQuickActions: { flexDirection: "row", gap: 8, marginTop: 12 },
  wdBtnProses:    { flex: 1, backgroundColor: "#EFF6FF", borderRadius: 8, paddingVertical: 8, alignItems: "center", borderWidth: 1, borderColor: "#BFDBFE" },
  wdBtnProsesTxt: { fontSize: 12, fontWeight: "700", color: BLUE },
  wdBtnApprove:   { flex: 1, backgroundColor: "#DCFCE7", borderRadius: 8, paddingVertical: 8, alignItems: "center", borderWidth: 1, borderColor: "#86EFAC" },
  wdBtnApproveTxt:{ fontSize: 12, fontWeight: "700", color: SUCCESS },
  wdBtnReject:    { flex: 1, backgroundColor: "#FEE2E2", borderRadius: 8, paddingVertical: 8, alignItems: "center", borderWidth: 1, borderColor: "#FCA5A5" },
  wdBtnRejectTxt: { fontSize: 12, fontWeight: "700", color: DANGER },
  usersSummaryRow:  { flexDirection: "row", gap: 8, marginBottom: 14 },
  usersSummaryCard: { flex: 1, backgroundColor: "#fff", borderRadius: 12, padding: 12, alignItems: "center", borderTopWidth: 4, elevation: 1 },
  usersSummaryVal:  { fontSize: 22, fontWeight: "800" },
  usersSummaryLbl:  { fontSize: 10, color: "#64748B", marginTop: 4 },
  userRoleHeader: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, marginBottom: 4, borderRadius: 10 },
  userRoleDot:    { width: 8, height: 8, borderRadius: 4 },
  userRoleTitle:  { fontSize: 13, fontWeight: "700" },
  userCard:       { backgroundColor: "#fff", borderRadius: 10, padding: 12, marginBottom: 6, flexDirection: "row", alignItems: "center", gap: 10, elevation: 1 },
  userAvatar:     { width: 42, height: 42, borderRadius: 21, justifyContent: "center", alignItems: "center" },
  userAvatarTxt:  { fontSize: 16, fontWeight: "800" },
  userInfo:       { flex: 1 },
  userName:       { fontSize: 14, fontWeight: "600", color: "#1E293B" },
  userPhone:      { fontSize: 12, color: "#64748B", marginTop: 2 },
  userPaketRow:   { marginTop: 4 },
  userPaketBadge: { alignSelf: "flex-start", borderRadius: 5, paddingHorizontal: 7, paddingVertical: 2 },
  userPaketBadgeTxt:{ color: "#fff", fontSize: 9, fontWeight: "800" },
  userId:         { fontSize: 10, color: "#94A3B8" },
  emptyBox:  { paddingVertical: 50, alignItems: "center" },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyTxt:  { fontSize: 14, color: "#94A3B8", textAlign: "center" },
  // ── Registrasi ────────────────────────────────────────────────────────────
  regCard:        { backgroundColor: "#fff", borderRadius: 16, padding: 20, marginBottom: 12, elevation: 2 },
  regTitle:       { fontSize: 18, fontWeight: "800", color: "#1E293B", marginBottom: 4 },
  regSubtitle:    { fontSize: 13, color: "#64748B", marginBottom: 16 },
  regRoleRow:     { flexDirection: "row", gap: 8, marginBottom: 16, flexWrap: "wrap" },
  regRoleBtn:     { flex: 1, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 8, alignItems: "center", borderWidth: 1.5, borderColor: "#E2E8F0", minWidth: 90 },
  regRoleBtnTxt:  { fontSize: 12, color: "#64748B" },
  regFieldLbl:    { fontSize: 12, fontWeight: "700", color: "#374151", marginBottom: 6, marginTop: 12 },
  regInput:       { backgroundColor: "#F8FAFC", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: "#1E293B", fontSize: 14, borderWidth: 1, borderColor: "#E2E8F0" },
  regSubmitBtn:   { backgroundColor: ACCENT, borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 20 },
  regSubmitBtnTxt:{ color: "#fff", fontWeight: "900", fontSize: 15 },
  regInfoCard:    { backgroundColor: "#EDE9FE", borderRadius: 12, padding: 16, marginBottom: 12 },
  regInfoTitle:   { fontSize: 13, fontWeight: "700", color: "#5B21B6", marginBottom: 8 },
  regInfoTxt:     { fontSize: 12, color: "#6D28D9", marginBottom: 4, lineHeight: 18 },
  // ── Modal ─────────────────────────────────────────────────────────────────
  overlay:      { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  detailSheet:  { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: "88%" },
  detailHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  detailTitle:  { fontSize: 18, fontWeight: "800", color: "#1E293B" },
  detailClose:  { fontSize: 22, color: "#64748B" },
  detailStatusStrip:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderRadius: 10, padding: 12, marginBottom: 14 },
  detailStatusTxt:    { fontSize: 16, fontWeight: "800" },
  detailSection:      { backgroundColor: "#F8FAFC", borderRadius: 12, padding: 14, marginBottom: 10 },
  detailSectionTitle: { fontSize: 11, fontWeight: "700", color: "#64748B", marginBottom: 8 },
  detailName:         { fontSize: 15, fontWeight: "700", color: "#1E293B" },
  detailId:           { fontSize: 11, color: "#64748B", marginTop: 2 },
  detailDate:         { fontSize: 11, color: "#94A3B8", marginTop: 2 },
  detailBankName:     { fontSize: 16, fontWeight: "700", color: "#1E293B" },
  detailBankNum:      { fontSize: 14, color: "#374151", marginTop: 4 },
  detailBankOwner:    { fontSize: 12, color: "#64748B", marginTop: 2 },
  detailJumlahCard:   { backgroundColor: "#EDE9FE", borderRadius: 14, padding: 16, alignItems: "center", marginBottom: 12 },
  detailJumlahLbl:    { fontSize: 12, color: "#5B21B6", marginBottom: 4 },
  detailJumlahVal:    { fontSize: 28, fontWeight: "800", color: ACCENT },
  detailCatatanExist:    { backgroundColor: "#FFF7ED", borderRadius: 10, padding: 12, marginBottom: 10 },
  detailCatatanExistLbl: { fontSize: 11, fontWeight: "700", color: "#92400E", marginBottom: 4 },
  detailCatatanExistTxt: { fontSize: 12, color: "#78350F" },
  detailCatatanInput:    { marginBottom: 14 },
  detailCatatanLbl:      { fontSize: 12, fontWeight: "600", color: "#374151", marginBottom: 6 },
  catatanInput:          { borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 10, padding: 12, fontSize: 13, color: "#1E293B", minHeight: 60, backgroundColor: "#F8FAFC" },
  detailActions:      { flexDirection: "row", gap: 8, marginBottom: 8, flexWrap: "wrap" },
  detailActionBtn:    { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: "center", minWidth: 90 },
  detailActionFull:   { flex: 2 },
  detailActionProses: { backgroundColor: BLUE },
  detailActionApprove:{ backgroundColor: SUCCESS },
  detailActionReject: { backgroundColor: DANGER },
  detailActionBtnTxt: { color: "#fff", fontWeight: "800", fontSize: 13 },
  detailFinalBadge:   { borderRadius: 12, padding: 14, alignItems: "center", marginBottom: 10 },
  detailFinalTxt:     { fontSize: 14, fontWeight: "700" },
  sheetBottomSafe:    { height: BOTTOM_SAFE },
});