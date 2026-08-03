// src/screens/OwnerDashboard.tsx
// v9 — Tambahan: RekapKeuangan, NotifSettings, badge notifikasi di header

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "../context/AuthContext";
import { GlobalProduct } from "../context/GlobalProductContext";
import {
  PAKET_FEATURES,
  PAKET_HARGA,
  PaketFeature,
  PaketMkt,
  TrialStatus,
  useMarketing,
} from "../context/MarketingContext";
import { useProducts } from "../context/ProductsContext";
import { createMayarPayment } from "../utils/MayarService";
import AIOwnerAssistant from "./AIOwnerAssistant";
import GlobalProductScreen, { ImportDetails } from "./GlobalProductScreen";
import KasirScreen from "./KasirScreen";
import KurirRegistrationScreen from "./KurirRegistrationScreen";
import LaporanScreen from "./LaporanScreen";
import PengaturanScreen from "./PengaturanScreen";
import RekapKeuanganScreen from "./RekapKeuanganScreen"; // TAMBAHAN
import ReturOwnerScreen from "./ReturOwnerScreen";
import StokProdukScreen from "./StokProdukScreen";
import TimKasirScreen from "./TimKasirScreen";

// TAMBAHAN: Notifikasi
import NotifSettingsPanel from "../components/NotifSettingsPanel";
import {
  checkAndNotifyLangganan,
  checkAndNotifyLowStock,
  getUnreadCount,
  markAllRead,
  scheduleLanggananCheck,
  scheduleStockCheckNotification,
} from "../utils/StockNotificationService";

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCENT  = "#2563EB";
const SUCCESS = "#16A34A";
const DANGER  = "#DC2626";
const ORANGE  = "#D97706";
const PURPLE  = "#7C3AED";
const TEAL    = "#0891B2";

const ORDERS_KEY   = "@twd_orders";
const PRODUCTS_KEY = "@twd_products";

const OWN_BANK_PFX = "@twd_owner_bank_";
const OWN_WD_PFX   = "@twd_owner_wd_";
const MIN_WD       = 100000;

const WD_STATUS_LABEL: Record<string, string> = {
  menunggu: "⏳ Menunggu",
  diproses: "🔄 Diproses",
  selesai:  "✅ Terkirim",
  ditolak:  "❌ Ditolak",
};

const WD_STATUS_COLOR: Record<string, string> = {
  menunggu: "#F59E0B",
  diproses: "#3B82F6",
  selesai:  "#10B981",
  ditolak:  "#EF4444",
};

const PAKET_COLOR: Record<PaketMkt, string> = {
  basic:      "#64748B",
  pro:        ACCENT,
  enterprise: PURPLE,
};

const PAKET_LABEL: Record<PaketMkt, string> = {
  basic:      "Basic",
  pro:        "Pro",
  enterprise: "Enterprise",
};

const UPGRADE_MAP: Record<PaketMkt, PaketMkt | null> = {
  basic:      "pro",
  pro:        "enterprise",
  enterprise: null,
};

const DOWNGRADE_OPTIONS: Record<PaketMkt, PaketMkt[]> = {
  basic:      [],
  pro:        ["basic"],
  enterprise: ["pro", "basic"],
};

const DOWNGRADE_WARNINGS: Record<PaketMkt, string[]> = {
  basic:      ["Fitur laporan terbatas", "Maksimal 2 kasir"],
  pro:        ["Maksimal 5 kasir"],
  enterprise: [],   // ← TAMBAHKAN
};

const PAKET_LIST: PaketMkt[] = ["basic", "pro", "enterprise"];

// ─── Feature Gates ────────────────────────────────────────────────────────────

const FEATURE_ACCESS: Record<string, PaketMkt[]> = {
  laporan_mingguan:    ["pro", "enterprise"],
  laporan_pdf:         ["pro", "enterprise"],
  kurir:               ["pro", "enterprise"],
  grafik_7hari:        ["pro", "enterprise"],
  grafik_30hari:       ["enterprise"],
  top_produk:          ["enterprise"],
  ai_assistant:        ["pro", "enterprise"],
  tim_kasir_unlimited: ["enterprise"],
};

function canAccess(feature: string, paket: PaketMkt): boolean {
  return (FEATURE_ACCESS[feature] ?? []).includes(paket);
}

const MAX_PRODUK: Record<PaketMkt, number | null> = {
  basic:      50,
  pro:        200,
  enterprise: null,
};

const MAX_KASIR: Record<PaketMkt, number | null> = {
  basic:      2,
  pro:        5,
  enterprise: null,
};

// ─── Reusable style constants ─────────────────────────────────────────────────

const FLEX_ONE = { flex: 1 } as const;
const PB_STYLE = { paddingBottom: 120 } as const;

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReturItem {
  name:     string;
  maxQty:   number;
  qtyRetur: number;
  price:    number;
}

interface ReturRequest {
  id:         string;
  ownerId:    string;
  txId:       string;
  txDate:     string;
  txTime:     string;
  kasirName:  string;
  namaToko:   string;
  items:      ReturItem[];
  totalRetur: number;
  alasan:     string;
  status:     "menunggu" | "disetujui" | "ditolak";
  createdAt:  string;
}

interface Order {
  id:          string;
  ownerId:     string;
  kasirId?:    string;
  kasirName:   string;
  items:       Array<{ productId: string; name: string; price: number; qty: number }>;
  subtotal:    number;
  diskon:      number;
  total:       number;
  bayar:       number;
  kembalian:   number;
  metodeBayar: string;
  createdAt:   string;
  status?:     string;
  tanggal?:    string;
  type?:       string;
}

interface StoreProduct {
  id:        string;
  ownerId:   string;
  name:      string;
  price:     number;
  buyPrice?: number;
  stock:     number;
  stockMin?: number;
  category?: string;
  barcode?:  string;
  createdAt: string;
}

interface DayStats {
  transaksi:     number;
  omset:         number;
  produkTerjual: number;
}

interface DayOmset {
  label: string;
  date:  string;
  omset: number;
  trx:   number;
}

interface TopProduk {
  name:  string;
  qty:   number;
  omset: number;
}

interface BankAccount {
  namaBank:      string;
  nomorRekening: string;
  namaPemilik:   string;
}

interface WithdrawalRequest {
  id:            string;
  ownerId:       string;
  jumlah:        number;
  namaBank:      string;
  nomorRekening: string;
  namaPemilik:   string;
  status:        "menunggu" | "diproses" | "selesai" | "ditolak";
  createdAt:     string;
  catatan?:      string;
}

// ─── Helper fns ───────────────────────────────────────────────────────────────

function formatOmset(n: number): string {
  if (n >= 1_000_000) return "Rp " + (n / 1_000_000).toFixed(1) + "jt";
  if (n >= 1_000)     return "Rp " + (n / 1_000).toFixed(0) + "rb";
  return "Rp " + n.toLocaleString("id-ID");
}

function formatRpFull(n: number): string {
  return "Rp " + Math.round(n).toLocaleString("id-ID");
}

function formatDateWd(iso: string): string {
  const d = new Date(iso);
  return (
    d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) +
    " " +
    d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
  );
}

function genWdId(): string {
  return "owd-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6);
}

function getPast7Days(): DayOmset[] {
  const DAY_NAMES = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
  const days: DayOmset[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push({ label: DAY_NAMES[d.getDay()], date: d.toISOString().slice(0, 10), omset: 0, trx: 0 });
  }
  return days;
}

function getPast30Days(): DayOmset[] {
  const days: DayOmset[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm  = String(d.getMonth() + 1).padStart(2, "0");
    days.push({ label: dd + "/" + mm, date: d.toISOString().slice(0, 10), omset: 0, trx: 0 });
  }
  return days;
}

// ─── Helper style fns ─────────────────────────────────────────────────────────

const getPaketBadgeStyle  = (p: PaketMkt) => [S.paketBadge, { backgroundColor: PAKET_COLOR[p] }];
const getTrialBarColor    = (d: number) => d > 1 ? SUCCESS : d === 1 ? ORANGE : DANGER;
const getMenuBtnStyle     = (color: string) => [S.menuBtn, { backgroundColor: color }];
const getPaketOptStyle    = (active: boolean, color: string) =>
  active ? [S.paketOpt, { borderColor: color, backgroundColor: color + "18" }] : [S.paketOpt];
const getPaketOptLblStyle = (active: boolean, color: string) =>
  active ? [S.paketOptLbl, { color }] : [S.paketOptLbl];

// ─── Sub-component: FeatureVal ────────────────────────────────────────────────

function FeatureVal({ value, paket }: { value: string; paket: PaketMkt }) {
  const color =
    value === "❌"           ? "#CBD5E1"
    : paket === "enterprise" ? PURPLE
    : paket === "pro"        ? ACCENT
    : SUCCESS;
  return <Text style={[S.fVal, { color }]}>{value}</Text>;
}

function PaketTable({ highlight }: { highlight: PaketMkt }) {
  return (
    <View style={S.fTable}>
      <View style={S.fHeadRow}>
        <Text style={[S.fHeadLbl, S.fCol0]}>{"Fitur"}</Text>
        {PAKET_LIST.map((p) => (
          <Text
            key={p}
            style={[
              S.fHead, S.fCol1,
              { color: PAKET_COLOR[p] },
              p === highlight && S.fHeadActive,
            ]}
          >
            {p === "enterprise" ? "Ent." : p.charAt(0).toUpperCase() + p.slice(1)}
          </Text>
        ))}
      </View>
      {PAKET_FEATURES.map((f: PaketFeature) => (
        <View key={f.label} style={S.fRow}>
          <Text style={[S.fLbl, S.fCol0]} numberOfLines={2}>{f.label}</Text>
          {PAKET_LIST.map((p) => (
            <View key={p} style={S.fCol1}>
              <FeatureVal value={f[p as keyof PaketFeature] as string} paket={p} />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

// ─── Sub-component: TrialBanner ───────────────────────────────────────────────

function TrialBanner({
  trial, paket, onUpgrade,
}: {
  trial: TrialStatus; paket: PaketMkt; onUpgrade: () => void;
}) {
  if (!trial.isActive && !trial.expired) return null;
  if (trial.expired) {
    return (
      <View style={S.trialExpiredBanner}>
        <View style={FLEX_ONE}>
          <Text style={S.trialExpiredTitle}>{"Trial Habis"}</Text>
          <Text style={S.trialExpiredSub}>{"Aktifkan langganan untuk tetap menggunakan TWD POS"}</Text>
        </View>
        <TouchableOpacity style={S.upgradeBtn} onPress={onUpgrade}>
          <Text style={S.upgradeBtnTxt}>{"Aktifkan"}</Text>
        </TouchableOpacity>
      </View>
    );
  }
  const barColor     = getTrialBarColor(trial.daysLeft);
  const urgent       = trial.daysLeft <= 1;
  const widthPct     = Math.max(4, Math.round((trial.daysLeft / 3) * 100));
  const barFillStyle = [S.trialBarFill, { width: (widthPct + "%") as any, backgroundColor: barColor }];
  return (
    <View style={[S.trialBanner, urgent && S.trialBannerUrgent]}>
      <View style={FLEX_ONE}>
        <Text style={S.trialBannerTitle}>
          {urgent ? "Segera Aktifkan Langganan!" : "Masa Trial Aktif"}
        </Text>
        <Text style={S.trialBannerSub}>
          {trial.daysLeft > 0
            ? "Sisa " + trial.daysLeft + " hari — berakhir " + (trial.endDate ?? "-")
            : "Trial berakhir hari ini!"}
        </Text>
        <View style={S.trialBarBg}>
          <View style={barFillStyle} />
        </View>
        <Text style={[S.trialDaysLeft, { color: barColor }]}>
          {trial.daysLeft + " / 3 hari"}
        </Text>
      </View>
      <TouchableOpacity style={S.upgradeBtn} onPress={onUpgrade}>
        <Text style={S.upgradeBtnTxt}>
          {UPGRADE_MAP[paket] ? "Upgrade" : "Perpanjang"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Sub-component: FeatureLock ───────────────────────────────────────────────

function FeatureLock({
  requiredPaket, currentPaket, onUpgrade,
}: {
  requiredPaket: PaketMkt; currentPaket: PaketMkt; onUpgrade: () => void;
}) {
  return (
    <View style={S.featureLockOverlay}>
      <Text style={S.featureLockIcon}>{"🔒"}</Text>
      <Text style={S.featureLockTitle}>{"Fitur " + PAKET_LABEL[requiredPaket]}</Text>
      <Text style={S.featureLockDesc}>
        {"Upgrade ke Paket " + PAKET_LABEL[requiredPaket] + " untuk mengakses fitur ini."}
      </Text>
      <TouchableOpacity
        style={[S.featureLockBtn, { backgroundColor: PAKET_COLOR[requiredPaket] }]}
        onPress={onUpgrade}
      >
        <Text style={S.featureLockBtnTxt}>{"Upgrade ke " + PAKET_LABEL[requiredPaket]}</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Sub-component: BarChart ──────────────────────────────────────────────────

const BAR_HEIGHT = 100;

function BarChart({ data, color, compact }: { data: DayOmset[]; color: string; compact?: boolean }) {
  const maxOmset = Math.max(...data.map((d) => d.omset), 1);
  const barW     = compact ? 8 : 20;
  return (
    <View style={S.barChartWrap}>
      <View style={S.barChartBars}>
        {data.map((d, idx) => {
          const heightPct = Math.max(3, Math.round((d.omset / maxOmset) * BAR_HEIGHT));
          const isToday   = idx === data.length - 1;
          return (
            <View key={d.date} style={S.barItem}>
              <Text style={S.barOmsetLbl}>{d.omset > 0 ? formatOmset(d.omset) : ""}</Text>
              <View style={S.barContainer}>
                <View
                  style={[
                    S.barFill,
                    {
                      height: heightPct,
                      width:  barW,
                      backgroundColor:       isToday ? color : color + "66",
                      borderTopLeftRadius:   4,
                      borderTopRightRadius:  4,
                    },
                  ]}
                />
              </View>
              <Text style={[S.barLabel, isToday && { color, fontWeight: "700" }]}>{d.label}</Text>
              {isToday && <View style={[S.barTodayDot, { backgroundColor: color }]} />}
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ─── Sub-component: StatistikDetail ──────────────────────────────────────────

function StatistikDetail({
  paket, ownerId, accentColor, onUpgrade,
}: {
  paket: PaketMkt; ownerId: string; accentColor: string; onUpgrade: () => void;
}) {
  const [data7,     setData7]     = useState<DayOmset[]>([]);
  const [data30,    setData30]    = useState<DayOmset[]>([]);
  const [topProduk, setTopProduk] = useState<TopProduk[]>([]);
  const [chartMode, setChartMode] = useState<"7" | "30">("7");
  const [loading,   setLoading]   = useState(true);

  const canChart7  = canAccess("grafik_7hari", paket);
  const canChart30 = canAccess("grafik_30hari", paket);
  const canTop     = canAccess("top_produk", paket);

  const loadChartData = useCallback(async () => {
    setLoading(true);
    try {
      const raw   = await AsyncStorage.getItem(ORDERS_KEY);
      const all: Order[] = raw ? JSON.parse(raw) : [];
      const mine = all.filter((o) => String(o.ownerId ?? "").trim() === ownerId);

      const days7 = getPast7Days();
      mine.forEach((o) => {
        const date = o.createdAt?.slice(0, 10) ?? o.tanggal ?? "";
        const day  = days7.find((d) => d.date === date);
        if (day) { day.omset += o.total ?? 0; day.trx += 1; }
      });
      setData7(days7);

      const days30 = getPast30Days();
      mine.forEach((o) => {
        const date = o.createdAt?.slice(0, 10) ?? o.tanggal ?? "";
        const day  = days30.find((d) => d.date === date);
        if (day) { day.omset += o.total ?? 0; day.trx += 1; }
      });
      setData30(days30);

      const produkMap: Record<string, TopProduk> = {};
      mine.forEach((o) => {
        o.items.forEach((it) => {
          if (!produkMap[it.name]) produkMap[it.name] = { name: it.name, qty: 0, omset: 0 };
          produkMap[it.name].qty   += it.qty;
          produkMap[it.name].omset += it.price * it.qty;
        });
      });
      setTopProduk(Object.values(produkMap).sort((a, b) => b.qty - a.qty).slice(0, 5));
    } catch (e) {
      console.error("StatistikDetail load error", e);
    } finally {
      setLoading(false);
    }
  }, [ownerId]);

  useEffect(() => { loadChartData(); }, [loadChartData]);

  if (!canChart7) {
    return (
      <View style={S.statDetailCard}>
        <Text style={S.statDetailTitle}>{"Statistik Mingguan"}</Text>
        <FeatureLock requiredPaket="pro" currentPaket={paket} onUpgrade={onUpgrade} />
      </View>
    );
  }

  const displayData      = chartMode === "30" ? data30 : data7;
  const totalOmsetPeriod = displayData.reduce((s, d) => s + d.omset, 0);
  const totalTrxPeriod   = displayData.reduce((s, d) => s + d.trx, 0);
  const thisWeekOmset    = data7.slice(3).reduce((s, d) => s + d.omset, 0);
  const lastWeekOmset    = data7.slice(0, 3).reduce((s, d) => s + d.omset, 0);
  const weekDiffPct      = lastWeekOmset > 0 ? Math.round(((thisWeekOmset - lastWeekOmset) / lastWeekOmset) * 100) : 0;
  const weekDiffPositive = weekDiffPct >= 0;

  return (
    <View style={S.statDetailCard}>
      <View style={S.statDetailHeader}>
        <Text style={S.statDetailTitle}>{"Statistik Penjualan"}</Text>
        <View style={S.chartToggleRow}>
          <TouchableOpacity
            style={chartMode === "7" ? [S.chartToggleBtn, { backgroundColor: accentColor }] : S.chartToggleBtnOff}
            onPress={() => setChartMode("7")}
          >
            <Text style={chartMode === "7" ? S.chartToggleTxtOn : S.chartToggleTxtOff}>{"7 Hari"}</Text>
          </TouchableOpacity>
          {canChart30 ? (
            <TouchableOpacity
              style={chartMode === "30" ? [S.chartToggleBtn, { backgroundColor: accentColor }] : S.chartToggleBtnOff}
              onPress={() => setChartMode("30")}
            >
              <Text style={chartMode === "30" ? S.chartToggleTxtOn : S.chartToggleTxtOff}>{"30 Hari"}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={S.chartToggleLocked} onPress={onUpgrade}>
              <Text style={S.chartToggleLockedTxt}>{"🔒 30 Hari"}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={S.chartSummaryRow}>
        <View style={S.chartSummaryItem}>
          <Text style={S.chartSummaryLbl}>{chartMode === "7" ? "Omset 7 Hari" : "Omset 30 Hari"}</Text>
          <Text style={[S.chartSummaryVal, { color: accentColor }]}>{formatOmset(totalOmsetPeriod)}</Text>
        </View>
        <View style={S.chartSummaryItem}>
          <Text style={S.chartSummaryLbl}>{"Transaksi"}</Text>
          <Text style={[S.chartSummaryVal, { color: accentColor }]}>{String(totalTrxPeriod)}</Text>
        </View>
        {chartMode === "7" && lastWeekOmset > 0 && (
          <View style={S.chartSummaryItem}>
            <Text style={S.chartSummaryLbl}>{"vs 3 Hari Lalu"}</Text>
            <Text style={[S.chartSummaryVal, { color: weekDiffPositive ? SUCCESS : DANGER }]}>
              {(weekDiffPositive ? "+" : "") + weekDiffPct + "%"}
            </Text>
          </View>
        )}
      </View>

      {loading ? (
        <View style={S.chartLoading}>
          <Text style={S.chartLoadingTxt}>{"Memuat grafik..."}</Text>
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <BarChart data={chartMode === "7" ? data7 : data30} color={accentColor} compact={chartMode === "30"} />
        </ScrollView>
      )}

      {canTop ? (
        topProduk.length > 0 && (
          <View style={S.topProdukSection}>
            <Text style={S.topProdukTitle}>{"🏆 Top 5 Produk Terlaris"}</Text>
            {topProduk.map((p, idx) => (
              <View key={p.name} style={S.topProdukRow}>
                <Text style={S.topProdukRank}>{String(idx + 1)}</Text>
                <Text style={[S.topProdukName, FLEX_ONE]} numberOfLines={1}>{p.name}</Text>
                <Text style={S.topProdukQty}>{p.qty + " pcs"}</Text>
                <Text style={[S.topProdukOmset, { color: accentColor }]}>{formatOmset(p.omset)}</Text>
              </View>
            ))}
          </View>
        )
      ) : (
        <View style={S.topProdukLockWrap}>
          <Text style={S.topProdukLockTxt}>{"🔒 Top Produk tersedia di Paket Enterprise"}</Text>
          <TouchableOpacity onPress={onUpgrade}>
            <Text style={[S.topProdukLockUpgrade, { color: PURPLE }]}>{"Upgrade "}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function OwnerDashboard() {
  const { user, logout }                                      = useAuth();
  const { addProduct: ctxAddProduct } = useProducts();
  const { ownerRegistrations, getTrialStatus, upgradePaket } = useMarketing();

  const [showKasir,       setShowKasir]       = useState(false);
  const [showProduk,      setShowProduk]      = useState(false);
  const [showStok,        setShowStok]        = useState(false);
  const [showKurir,       setShowKurir]       = useState(false);
  const [showLaporan,     setShowLaporan]     = useState(false);
  const [showTimKasir,    setShowTimKasir]    = useState(false);
  const [showPengaturan,  setShowPengaturan]  = useState(false);
  const [showRetur,       setShowRetur]       = useState(false);
  const [showPaketInfo,   setShowPaketInfo]   = useState(false);
  const [showUpgrade,     setShowUpgrade]     = useState(false);
  const [showDowngrade,   setShowDowngrade]   = useState(false);
  const [showPerpanjang,  setShowPerpanjang]  = useState(false);
  const [selectedUpgrade,   setSelectedUpgrade]   = useState<PaketMkt | null>(null);
  const [selectedDowngrade, setSelectedDowngrade] = useState<PaketMkt | null>(null);

  // TAMBAHAN: state baru
  const [showRekap,        setShowRekap]        = useState(false);
  const [showNotifSettings,setShowNotifSettings] = useState(false);
  const [unreadNotif,      setUnreadNotif]       = useState(0);

  const [pendingReturs,   setPendingReturs]   = useState<ReturRequest[]>([]);
  const [autoOpenReturId, setAutoOpenReturId] = useState<string | undefined>();

  const [stats,           setStats]           = useState<DayStats>({ transaksi: 0, omset: 0, produkTerjual: 0 });
  const [ownerProducts,   setOwnerProducts]   = useState<StoreProduct[]>([]);
  const [lowStockCount,   setLowStockCount]   = useState(0);
  const [emptyStockCount, setEmptyStockCount] = useState(0);

  // pencairan state
  const [showPencairan, setShowPencairan] = useState(false);
  const [bankAccount,   setBankAccount]   = useState<BankAccount | null>(null);
  const [withdrawals,   setWithdrawals]   = useState<WithdrawalRequest[]>([]);
  const [saldoOnline,   setSaldoOnline]   = useState(0);
  const [showBankForm,  setShowBankForm]  = useState(false);
  const [bankInput,     setBankInput]     = useState<BankAccount>({ namaBank: "", nomorRekening: "", namaPemilik: "" });
  const [wdJumlah,      setWdJumlah]     = useState("");
  const [showWdForm,    setShowWdForm]   = useState(false);
  const [showMayarSubModal, setShowMayarSubModal] = useState(false);

  const handleBayarLanggananMayar = async () => {
    const harga = PAKET_HARGA[paket] || 50000;
    const tokoName = myRegistration?.tokoName || "Toko Owner";
    try {
      const mayarResp = await createMayarPayment({
        orderId:       `SUB-${Date.now()}`,
        amount:        harga,
        customerName:  tokoName,
        customerEmail: "owner@twdmobile.com",
        customerPhone: "081200000000",
        description:   `Langganan TWD ${PAKET_LABEL[paket]} - ${tokoName}`,
      });
      if (mayarResp && mayarResp.linkUrl && !mayarResp.linkUrl.includes("mayar.id/pay/twdmobile")) {
        return Linking.openURL(mayarResp.linkUrl);
      }
      setShowMayarSubModal(true);
    } catch {
      setShowMayarSubModal(true);
    }
  };

  const myId = user?.id ?? "";

  const myRegistration = useMemo(
    () => ownerRegistrations.find((o) => o.id === myId) ?? null,
    [ownerRegistrations, myId],
  );

  const paket: PaketMkt    = (myRegistration?.paket as PaketMkt) ?? "basic";
  const accentColor         = PAKET_COLOR[paket];
  const trial: TrialStatus  = useMemo(() => getTrialStatus(myId), [myId, ownerRegistrations]);
  const upgradeTo            = UPGRADE_MAP[paket];
  const downgradeOptions     = DOWNGRADE_OPTIONS[paket];
  const canDowngrade         = downgradeOptions.length > 0;

  useEffect(() => { setSelectedUpgrade(upgradeTo); }, [upgradeTo]);
  useEffect(() => {
    if (downgradeOptions.length > 0) setSelectedDowngrade(downgradeOptions[0]);
  }, [paket]);

  const maxProduk          = MAX_PRODUK[paket];
  const maxKasirVal        = MAX_KASIR[paket];
  const canKurir           = canAccess("kurir", paket);
  const canAI              = canAccess("ai_assistant", paket);
  const produkLimitReached = maxProduk !== null && ownerProducts.length >= maxProduk;

  // ── TAMBAHAN: Load unread notif & cek stok/langganan saat buka ──────────────
  const loadNotifData = useCallback(async () => {
    const count = await getUnreadCount();
    setUnreadNotif(count);
  }, []);

 useFocusEffect(useCallback(() => {
  loadNotifData();
  if (myId) {
    checkAndNotifyLowStock(myId).catch(() => {});
    AsyncStorage.getItem("twd_expiry_date").then((expiry) => {
      if (expiry && myRegistration?.tokoName) {
        checkAndNotifyLangganan(myRegistration.tokoName, expiry).catch(() => {});
      }
    });
    // Jadwal harian untuk pengecekan stok dan langganan
    scheduleStockCheckNotification(8).catch(() => {});   // Pukul 08:00
    scheduleLanggananCheck(9).catch(() => {});           // Pukul 09:00
  }
}, [myId, myRegistration, loadNotifData]));

  // ── Load retur ──
  const loadPendingReturs = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem("@twd_retur_" + myId);
      const all: ReturRequest[] = raw ? JSON.parse(raw) : [];
      const pending = all
        .filter((r) => r.status === "menunggu")
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setPendingReturs(pending);
    } catch {}
  }, [myId]);

  useFocusEffect(useCallback(() => { loadPendingReturs(); }, [loadPendingReturs]));

  function handleBannerReturPress() {
    setAutoOpenReturId(pendingReturs.length === 1 ? pendingReturs[0].id : undefined);
    setShowRetur(true);
  }

  // ── Load produk ──
  const loadOwnerProducts = useCallback(async () => {
    try {
      const raw   = await AsyncStorage.getItem(PRODUCTS_KEY);
      const all: StoreProduct[] = raw ? JSON.parse(raw) : [];
      const mine = all.filter((p) => String(p.ownerId ?? "").trim() === myId);
      setOwnerProducts(mine);
      setLowStockCount(mine.filter((p) => p.stock > 0 && p.stock <= (p.stockMin ?? 5)).length);
      setEmptyStockCount(mine.filter((p) => p.stock === 0).length);
    } catch (e) { console.error("loadOwnerProducts error:", e); }
  }, [myId]);

  useEffect(() => { loadOwnerProducts(); }, [loadOwnerProducts]);
  useEffect(() => { if (showProduk || showStok) loadOwnerProducts(); }, [showProduk, showStok]);

  const existingBarcodes = useMemo(
    () => ownerProducts.map((p) => p.barcode ?? "").filter(Boolean),
    [ownerProducts],
  );

 const handleImportWithDetails = async (product: GlobalProduct, details: ImportDetails) => {
  if (produkLimitReached) {
    Alert.alert(
      "Batas Produk",
      "Paket " + PAKET_LABEL[paket] + " hanya mendukung maks " + String(maxProduk) + " produk.\nUpgrade untuk menambah lebih banyak produk."
    );
    return;
  }
  try {
    // ✅ Gunakan ProductsContext.addProduct agar in-memory state ter-update
    await ctxAddProduct({
      ownerId:   myId,          // akan ikut tersimpan via ...data spread
      name:      product.name,
      barcode:   product.barcode ?? "",
      sellPrice: details.sellPrice,
      buyPrice:  details.buyPrice,
      stock:     details.stock,
      stockMin:  details.stockMin ?? 5,
      kategori:  (product.kategori ?? "Lainnya") as any,
      satuan:    "pcs",
    } as any);

    await loadOwnerProducts();
    Alert.alert(
      "Berhasil! ✅",
      '"' + product.name + '" berhasil ditambahkan ke toko.\n' +
      "Harga jual: Rp " + details.sellPrice.toLocaleString("id-ID") + "\n" +
      "Stok: " + details.stock + " pcs",
    );
  } catch {
    Alert.alert("Error", "Gagal menyimpan produk ke toko.");
  }
};

  // ── Load statistik ──
  const loadStats = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(ORDERS_KEY);
      const allOrders: Order[] = raw ? JSON.parse(raw) : [];
      const todayStr = new Date().toISOString().slice(0, 10);
      const todayOrders = allOrders.filter(
        (o) => o.ownerId === myId && o.createdAt?.slice(0, 10) === todayStr
      );
      setStats({
        transaksi:     todayOrders.length,
        omset:         todayOrders.reduce((s, o) => s + (o.total ?? 0), 0),
        produkTerjual: todayOrders.reduce((s, o) => s + o.items.reduce((ss, i) => ss + i.qty, 0), 0),
      });
    } catch (e) { console.error("loadStats error:", e); }
  }, [myId]);

  useEffect(() => { loadStats(); }, [loadStats]);

  // ── Load pencairan ──
  const loadPencairan = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(ORDERS_KEY);
      const allOrders: Order[] = raw ? JSON.parse(raw) : [];
      const onlineSelesai = allOrders.filter(
        (o) => String(o.ownerId) === myId && o.type === "online" && o.status === "selesai"
      );
      const totalMasuk = onlineSelesai.reduce((s, o) => s + (o.subtotal ?? o.total ?? 0), 0);

      const rawWd = await AsyncStorage.getItem(OWN_WD_PFX + myId);
      const allWd: WithdrawalRequest[] = rawWd ? JSON.parse(rawWd) : [];
      setWithdrawals(allWd.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));

      const totalCair    = allWd.filter((w) => w.status === "selesai").reduce((s, w) => s + w.jumlah, 0);
      const totalPending = allWd.filter((w) => w.status === "menunggu" || w.status === "diproses").reduce((s, w) => s + w.jumlah, 0);
      setSaldoOnline(Math.max(0, totalMasuk - totalCair - totalPending));

      const rawBank = await AsyncStorage.getItem(OWN_BANK_PFX + myId);
      setBankAccount(rawBank ? JSON.parse(rawBank) : null);
    } catch (e) { console.error("loadPencairan error:", e); }
  }, [myId]);

  // ── Simpan rekening ──
  const handleSaveBank = async () => {
    if (!bankInput.namaBank.trim() || !bankInput.nomorRekening.trim() || !bankInput.namaPemilik.trim()) {
      Alert.alert("Lengkapi Data", "Semua field rekening harus diisi."); return;
    }
    try {
      await AsyncStorage.setItem(OWN_BANK_PFX + myId, JSON.stringify(bankInput));
      setBankAccount({ ...bankInput });
      setShowBankForm(false);
      Alert.alert("Berhasil ✅", "Rekening bank tersimpan.");
    } catch { Alert.alert("Error", "Gagal menyimpan rekening."); }
  };

  // ── Ajukan pencairan ──
  const handleRequestWithdraw = async () => {
    if (!bankAccount) {
      Alert.alert("Belum Ada Rekening", "Tambahkan rekening bank terlebih dahulu.");
      setShowBankForm(true);
      return;
    }
    const jumlah = Number(wdJumlah.replace(/\D/g, ""));
    if (!jumlah || jumlah < MIN_WD) {
      Alert.alert("Jumlah Kurang", "Minimum pencairan " + formatRpFull(MIN_WD)); return;
    }
    if (jumlah > saldoOnline) {
      Alert.alert("Saldo Tidak Cukup", "Saldo tersedia: " + formatRpFull(saldoOnline)); return;
    }
    Alert.alert(
      "Konfirmasi Pencairan",
      formatRpFull(jumlah) + " → " + bankAccount.namaBank + " " + bankAccount.nomorRekening +
      "\na.n. " + bankAccount.namaPemilik + "\n\nDiproses 1×24 jam kerja.",
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Cairkan",
          onPress: async () => {
            try {
              const wd: WithdrawalRequest = {
                id: genWdId(), ownerId: myId, jumlah,
                namaBank: bankAccount.namaBank,
                nomorRekening: bankAccount.nomorRekening,
                namaPemilik: bankAccount.namaPemilik,
                status: "menunggu",
                createdAt: new Date().toISOString(),
              };
              const rawWd = await AsyncStorage.getItem(OWN_WD_PFX + myId);
              const allWd: WithdrawalRequest[] = rawWd ? JSON.parse(rawWd) : [];
              await AsyncStorage.setItem(OWN_WD_PFX + myId, JSON.stringify([wd, ...allWd]));
              setShowWdForm(false);
              setWdJumlah("");
              await loadPencairan();
              Alert.alert("Berhasil ✅", "Pencairan " + formatRpFull(jumlah) + " sedang diproses.\nTransfer 1×24 jam kerja.");
            } catch { Alert.alert("Error", "Gagal mengajukan pencairan."); }
          },
        },
      ],
    );
  };

  // ── Handlers paket ──
  const handleOpenUpgrade = () => {
    if (!upgradeTo) setShowPerpanjang(true);
    else            setShowUpgrade(true);
  };

  const handleConfirmUpgrade = () => {
    if (!selectedUpgrade) return;
    upgradePaket?.(myId, selectedUpgrade);
    setShowUpgrade(false);
    Alert.alert(
      "Permintaan Dikirim",
      "Paket dipilih: " + selectedUpgrade.toUpperCase() +
      "\nHubungi marketing kamu untuk konfirmasi pembayaran.",
    );
  };

  const handleConfirmDowngrade = () => {
    if (!selectedDowngrade) return;
    Alert.alert(
      "Konfirmasi Downgrade",
      "Yakin ingin downgrade ke Paket " + PAKET_LABEL[selectedDowngrade] + "?\n\n" +
      "Beberapa fitur akan dinonaktifkan. Downgrade berlaku di periode berikutnya.",
      [
        { text: "Batal", style: "cancel" },
        {
          text:  "Ya, Downgrade",
          style: "destructive",
          onPress: () => {
            upgradePaket?.(myId, selectedDowngrade);
            setShowDowngrade(false);
            Alert.alert(
              "Permintaan Downgrade Dikirim",
              "Paket dipilih: " + PAKET_LABEL[selectedDowngrade] +
              "\nHubungi marketing kamu untuk konfirmasi perubahan.",
            );
          },
        },
      ]
    );
  };

  // TAMBAHAN: handle buka notif settings
  function handleOpenNotif() {
    markAllRead().then(() => setUnreadNotif(0));
    setShowNotifSettings(true);
  }

  const MENU_ITEMS = [
    { icon: "🧾", label: "Buka Kasir",     color: SUCCESS,   locked: false,    onPress: () => setShowKasir(true) },
    { icon: "📊", label: "Laporan",         color: ACCENT,    locked: false,    onPress: () => setShowLaporan(true) },
    { icon: "💰", label: "Rekap Keuangan",  color: "#0F766E", locked: false,    onPress: () => setShowRekap(true) }, // TAMBAHAN
    { icon: "📦", label: "Produk",          color: ORANGE,    locked: false,    onPress: () => setShowProduk(true) },
    { icon: "📋", label: "Stok",            color: TEAL,      locked: false,    onPress: () => setShowStok(true) },
    { icon: "🚚", label: "Kurir",           color: "#0E7490", locked: !canKurir, onPress: () => canKurir ? setShowKurir(true) : handleOpenUpgrade() },
    { icon: "👥", label: "Tim Kasir",       color: PURPLE,    locked: false,    onPress: () => setShowTimKasir(true) },
    { icon: "💸", label: "Pencairan",       color: "#0F766E", locked: false,    onPress: () => { loadPencairan(); setShowPencairan(true); } },
    { icon: "⚙️", label: "Pengaturan",     color: "#475569", locked: false,    onPress: () => setShowPengaturan(true) },
  ];

  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <View style={S.root}>
      {/* Header */}
      <View style={[S.header, { backgroundColor: accentColor }]}>
        <View style={FLEX_ONE}>
          <Text style={S.headerTitle}>{myRegistration?.tokoName ?? "Toko Saya"}</Text>
          <Text style={S.headerSub}>{myRegistration?.jenisBisnis ?? "Owner Dashboard"}</Text>
        </View>

        {/* TAMBAHAN: Tombol notifikasi dengan badge */}
        <TouchableOpacity style={S.notifBtn} onPress={handleOpenNotif}>
          <Text style={S.notifBtnIcon}>{"🔔"}</Text>
          {unreadNotif > 0 && (
            <View style={S.notifBadge}>
              <Text style={S.notifBadgeTxt}>{unreadNotif > 9 ? "9+" : String(unreadNotif)}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={getPaketBadgeStyle(paket)} onPress={() => setShowPaketInfo(true)}>
          <Text style={S.paketBadgeTxt}>{PAKET_LABEL[paket]}</Text>
          <Text style={S.paketBadgeSub}>{"Tap info"}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={PB_STYLE}>
        <TrialBanner trial={trial} paket={paket} onUpgrade={handleOpenUpgrade} />

        {!trial.isActive && !trial.expired && (
          <View style={S.aktifBanner}>
            <Text style={S.aktifIcon}>{"✅"}</Text>
            <View style={FLEX_ONE}>
              <Text style={S.aktifTitle}>{"Langganan " + PAKET_LABEL[paket] + " Aktif"}</Text>
              <Text style={S.aktifSub}>{"Rp " + (PAKET_HARGA[paket] / 1000).toFixed(0) + ".000/bulan"}</Text>
            </View>
            <View style={S.aktifBannerBtns}>
              {upgradeTo && (
                <TouchableOpacity style={S.upgradeSmallBtn} onPress={handleOpenUpgrade}>
                  <Text style={S.upgradeSmallTxt}>{"Upgrade"}</Text>
                </TouchableOpacity>
              )}
              {canDowngrade && (
                <TouchableOpacity style={S.downgradeSmallBtn} onPress={() => setShowDowngrade(true)}>
                  <Text style={S.downgradeSmallTxt}>{"Turunkan"}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {produkLimitReached && (
          <TouchableOpacity style={S.limitBanner} onPress={handleOpenUpgrade} activeOpacity={0.85}>
            <Text style={S.limitBannerTxt}>
              {"⚠️ Batas produk Paket " + PAKET_LABEL[paket] + " (" + String(maxProduk) + ") tercapai. Upgrade untuk tambah lebih."}
            </Text>
          </TouchableOpacity>
        )}

        {pendingReturs.length > 0 && (
          <TouchableOpacity style={S.returWarningBanner} onPress={handleBannerReturPress} activeOpacity={0.85}>
            <View style={S.returWarningStripe} />
            <View style={S.returWarningBody}>
              <View style={S.returWarningTop}>
                <Text style={S.returWarningEmoji}>{"⚠️"}</Text>
                <View style={FLEX_ONE}>
                  <Text style={S.returWarningTitle}>{"Permintaan Retur Menunggu Persetujuan"}</Text>
                  <Text style={S.returWarningDesc}>
                    {pendingReturs.length === 1
                      ? "Kasir " + pendingReturs[0].kasirName + " mengajukan retur — " + pendingReturs[0].txDate + " " + pendingReturs[0].txTime
                      : pendingReturs.length + " permintaan dari kasir menunggu keputusan Anda"}
                  </Text>
                </View>
                <View style={S.returWarningBadge}>
                  <Text style={S.returWarningBadgeTxt}>{String(pendingReturs.length)}</Text>
                </View>
              </View>
              {pendingReturs.length === 1 && (
                <View style={S.returPreviewBox}>
                  <Text style={S.returPreviewItem} numberOfLines={2}>
                    {"📦 " + pendingReturs[0].items.map((i) => i.name + " ×" + i.qtyRetur).join(", ")}
                  </Text>
                  <Text style={S.returPreviewAlasan} numberOfLines={1}>
                    {"💬 \"" + pendingReturs[0].alasan + "\""}
                  </Text>
                  <Text style={S.returPreviewTotal}>
                    {"Total: Rp " + Math.round(pendingReturs[0].totalRetur).toLocaleString("id-ID")}
                  </Text>
                </View>
              )}
              <View style={S.returWarningCta}>
                <Text style={S.returWarningCtaTxt}>
                  {pendingReturs.length === 1 ? "Ketuk untuk tinjau dan putuskan →" : "Ketuk untuk lihat semua permintaan →"}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        )}

        {(emptyStockCount > 0 || lowStockCount > 0) && (
          <TouchableOpacity
            style={[S.stokWarningBanner, emptyStockCount > 0 ? S.stokWarningBannerRed : S.stokWarningBannerOrange]}
            onPress={() => setShowStok(true)}
            activeOpacity={0.85}
          >
            <View style={[S.stokWarningStripe, { backgroundColor: emptyStockCount > 0 ? DANGER : ORANGE }]} />
            <View style={S.stokWarningBody}>
              <View style={S.stokWarningTop}>
                <Text style={S.stokWarningEmoji}>{emptyStockCount > 0 ? "🔴" : "⚠️"}</Text>
                <View style={FLEX_ONE}>
                  <Text style={[S.stokWarningTitle, { color: emptyStockCount > 0 ? "#7F1D1D" : "#78350F" }]}>
                    {emptyStockCount > 0 ? emptyStockCount + " produk stok habis!" : lowStockCount + " produk stok menipis"}
                  </Text>
                  <Text style={[S.stokWarningDesc, { color: emptyStockCount > 0 ? "#991B1B" : "#92400E" }]}>
                    {emptyStockCount > 0 && lowStockCount > 0
                      ? emptyStockCount + " habis, " + lowStockCount + " menipis — segera restock"
                      : emptyStockCount > 0
                      ? "Produk tidak dapat dijual, segera lakukan restock"
                      : "Stok hampir habis, segera lakukan restock"}
                  </Text>
                </View>
              </View>
              <View style={S.stokWarningCta}>
                <Text style={[S.stokWarningCtaTxt, { color: emptyStockCount > 0 ? DANGER : ORANGE }]}>
                  {"Ketuk untuk restock →"}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        )}

        {/* Info Toko */}
        <View style={S.tokoCard}>
          <Text style={S.tokoCardTitle}>{"Info Toko"}</Text>
          <View style={S.tokoRow}>
            <Text style={S.tokoKey}>{"Pemilik"}</Text>
            <Text style={S.tokoVal}>{myRegistration?.name ?? "-"}</Text>
          </View>
          <View style={S.tokoRow}>
            <Text style={S.tokoKey}>{"No. HP"}</Text>
            <Text style={S.tokoVal}>{myRegistration?.phone ?? "-"}</Text>
          </View>
          <View style={S.tokoRow}>
            <Text style={S.tokoKey}>{"Kode Toko"}</Text>
            <Text style={[S.tokoVal, S.tokoKode]}>{myRegistration?.kodeToken ?? "-"}</Text>
          </View>
          {Boolean(myRegistration?.alamat) && (
            <View style={S.tokoRow}>
              <Text style={S.tokoKey}>{"Alamat"}</Text>
              <Text style={[S.tokoVal, FLEX_ONE]}>{myRegistration?.alamat}</Text>
            </View>
          )}
          <View style={S.paketLimitRow}>
            <Text style={S.paketLimitItem}>{"📦 Produk: " + ownerProducts.length + "/" + (maxProduk !== null ? String(maxProduk) : "∞")}</Text>
            <Text style={S.paketLimitItem}>{"👥 Kasir: max " + (maxKasirVal !== null ? String(maxKasirVal) : "∞")}</Text>
            <Text style={S.paketLimitItem}>{"🚚 Kurir: " + (canKurir ? "✅" : "🔒 Pro+")}</Text>
            <Text style={S.paketLimitItem}>{"🤖 AI: " + (canAI ? "✅" : "🔒 Pro+")}</Text>
          </View>
        </View>

        {/* Produk Info */}
        <View style={S.produkInfoCard}>
          <Text style={S.produkInfoIcon}>{"📦"}</Text>
          <View style={FLEX_ONE}>
            <Text style={S.produkInfoTitle}>
              {ownerProducts.length > 0 ? ownerProducts.length + " produk di toko" : "Belum ada produk di toko"}
            </Text>
            <View style={S.produkStokRow}>
              {ownerProducts.length > 0 && (
                <>
                  <Text style={S.produkStokOk}>{"✅ " + (ownerProducts.length - lowStockCount - emptyStockCount) + " aman"}</Text>
                  {lowStockCount > 0 && <Text style={S.produkStokWarn}>{"⚠️ " + lowStockCount + " menipis"}</Text>}
                  {emptyStockCount > 0 && <Text style={S.produkStokEmpty}>{"🔴 " + emptyStockCount + " habis"}</Text>}
                </>
              )}
              {ownerProducts.length === 0 && (
                <Text style={S.produkInfoSub}>{"Tap Produk → Import dari katalog global"}</Text>
              )}
            </View>
          </View>
          <View style={S.produkInfoBtns}>
            <TouchableOpacity
              style={produkLimitReached ? [S.produkInfoBtn, S.produkInfoBtnDisabled] : S.produkInfoBtn}
              onPress={() => produkLimitReached ? handleOpenUpgrade() : setShowProduk(true)}
            >
              <Text style={S.produkInfoBtnTxt}>{produkLimitReached ? "🔒" : "Import"}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={S.produkInfoBtnStok} onPress={() => setShowStok(true)}>
              <Text style={S.produkInfoBtnStokTxt}>{"Stok"}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Statistik Hari Ini */}
        <View style={S.statsSectionHeader}>
          <Text style={S.menuSectionTitle}>{"Statistik Hari Ini"}</Text>
          <TouchableOpacity style={S.refreshBtn} onPress={loadStats}>
            <Text style={S.refreshTxt}>{"🔄 Refresh"}</Text>
          </TouchableOpacity>
        </View>
        <View style={S.statsRow}>
          <View style={[S.statCard, S.statCardBlue]}>
            <Text style={S.statIcon}>{"🧾"}</Text>
            <Text style={[S.statNum, { color: ACCENT }]}>{String(stats.transaksi)}</Text>
            <Text style={S.statLbl}>{"Transaksi"}</Text>
          </View>
          <View style={[S.statCard, S.statCardGreen]}>
            <Text style={S.statIcon}>{"💰"}</Text>
            <Text style={[S.statNum, { color: SUCCESS }]}>{formatOmset(stats.omset)}</Text>
            <Text style={S.statLbl}>{"Omset"}</Text>
          </View>
          <View style={[S.statCard, S.statCardOrange]}>
            <Text style={S.statIcon}>{"📦"}</Text>
            <Text style={[S.statNum, { color: ORANGE }]}>{String(stats.produkTerjual)}</Text>
            <Text style={S.statLbl}>{"Produk Terjual"}</Text>
          </View>
        </View>

        <StatistikDetail paket={paket} ownerId={myId} accentColor={accentColor} onUpgrade={handleOpenUpgrade} />

        <Text style={[S.menuSectionTitle, { marginTop: 16 }]}>{"🤖 AI Assistant"}</Text>
        {canAI ? (
          <AIOwnerAssistant ownerId={myId} paket={paket} onUpgrade={handleOpenUpgrade} />
        ) : (
          <TouchableOpacity style={S.aiTeaserCard} onPress={handleOpenUpgrade} activeOpacity={0.85}>
            <Text style={S.aiTeaserIcon}>{"🤖"}</Text>
            <View style={FLEX_ONE}>
              <Text style={S.aiTeaserTitle}>{"TWD AI Assistant"}</Text>
              <Text style={S.aiTeaserDesc}>
                {"Analisis penjualan, stok, prediksi omset & saran promo otomatis.\nTersedia di Paket Pro & Enterprise."}
              </Text>
            </View>
            <Text style={S.aiTeaserLock}>{"🔒"}</Text>
          </TouchableOpacity>
        )}

        <Text style={S.menuSectionTitle}>{"Menu Utama"}</Text>
        <View style={S.menuGrid}>
          {MENU_ITEMS.map((m) => (
            <TouchableOpacity
              key={m.label}
              style={[...getMenuBtnStyle(m.color), m.locked && S.menuBtnLocked]}
              onPress={m.onPress}
            >
              <Text style={S.menuIcon}>{m.icon}</Text>
              <Text style={S.menuLabel}>{m.label}</Text>
              {m.locked && <Text style={S.menuLockBadge}>{"🔒 Pro"}</Text>}
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={S.logoutBtn}
          onPress={() =>
            Alert.alert("Logout", "Yakin logout?", [
              { text: "Batal",  style: "cancel" },
              { text: "Logout", style: "destructive", onPress: logout },
            ])
          }
        >
          <Text style={S.logoutTxt}>{"🚪 Logout"}</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* ── Modals ── */}

      <Modal visible={showKasir} animationType="slide" onRequestClose={() => { setShowKasir(false); loadStats(); }}>
        <KasirScreen
          ownerId={myId}
          kasirName={myRegistration?.name ?? "Owner"}
          onBack={() => { setShowKasir(false); loadStats(); }}
          onTransactionDone={loadStats}
        />
      </Modal>

      <Modal visible={showLaporan} animationType="slide" onRequestClose={() => setShowLaporan(false)}>
        <LaporanScreen ownerId={myId} onBack={() => setShowLaporan(false)} />
      </Modal>

      {/* TAMBAHAN: Modal Rekap Keuangan */}
      <Modal visible={showRekap} animationType="slide" onRequestClose={() => setShowRekap(false)}>
        <RekapKeuanganScreen
          ownerId={myId}
          tokoName={myRegistration?.tokoName ?? "Toko"}
          onBack={() => setShowRekap(false)}
        />
      </Modal>

      <Modal visible={showProduk} animationType="slide" onRequestClose={() => setShowProduk(false)}>
        <View style={S.fullModal}>
          <View style={[S.fullModalHeader, { backgroundColor: ORANGE }]}>
            <TouchableOpacity onPress={() => setShowProduk(false)}>
              <Text style={S.backTxt}>{"Tutup"}</Text>
            </TouchableOpacity>
            <Text style={S.fullModalTitle}>{"Produk Toko"}</Text>
            <Text style={S.headerCountTxt}>{ownerProducts.length + " item"}</Text>
          </View>
          {produkLimitReached && (
            <View style={S.modalLimitBanner}>
              <Text style={S.modalLimitBannerTxt}>
                {"🔒 Batas " + String(maxProduk) + " produk (Paket " + PAKET_LABEL[paket] + ") tercapai. Upgrade untuk menambah lebih."}
              </Text>
            </View>
          )}
          <GlobalProductScreen
            accentColor={ORANGE}
            addedBy={myId}
            addedByName={myRegistration?.name ?? "Owner"}
            existingBarcodes={existingBarcodes}
            onImportWithDetails={handleImportWithDetails}
          />
        </View>
      </Modal>

      <Modal visible={showStok} animationType="slide" onRequestClose={() => { setShowStok(false); loadOwnerProducts(); }}>
        <View style={S.fullModal}>
          <View style={[S.fullModalHeader, { backgroundColor: TEAL }]}>
            <TouchableOpacity onPress={() => { setShowStok(false); loadOwnerProducts(); }}>
              <Text style={S.backTxt}>{"Tutup"}</Text>
            </TouchableOpacity>
            <Text style={S.fullModalTitle}>{"📋 Stok Produk"}</Text>
            <View style={S.headerStokBadgeWrap}>
              {emptyStockCount > 0 && (
                <View style={[S.headerStokBadge, { backgroundColor: DANGER }]}>
                  <Text style={S.headerStokBadgeTxt}>{String(emptyStockCount) + "🔴"}</Text>
                </View>
              )}
              {lowStockCount > 0 && (
                <View style={[S.headerStokBadge, { backgroundColor: ORANGE }]}>
                  <Text style={S.headerStokBadgeTxt}>{String(lowStockCount) + "⚠️"}</Text>
                </View>
              )}
            </View>
          </View>
          <StokProdukScreen route={{ params: { ownerId: myId } }} />
        </View>
      </Modal>

      <Modal visible={showKurir} animationType="slide" onRequestClose={() => setShowKurir(false)}>
        <KurirRegistrationScreen
          recruitedBy={myId}
          accentColor="#0891B2"
          onBack={() => setShowKurir(false)}
          onSuccess={(name: string) => { setShowKurir(false); Alert.alert("Berhasil", name + " telah didaftarkan sebagai kurir toko."); }}
        />
      </Modal>

      <Modal visible={showTimKasir} animationType="slide" onRequestClose={() => setShowTimKasir(false)}>
        <TimKasirScreen onBack={() => setShowTimKasir(false)} maxKasir={maxKasirVal} />
      </Modal>

      <Modal visible={showPengaturan} animationType="slide" onRequestClose={() => setShowPengaturan(false)}>
        <PengaturanScreen onBack={() => setShowPengaturan(false)} />
      </Modal>

      <Modal
        visible={showRetur}
        animationType="slide"
        onRequestClose={() => { setShowRetur(false); setAutoOpenReturId(undefined); loadPendingReturs(); }}
      >
        <View style={S.fullModal}>
          <View style={[S.fullModalHeader, { backgroundColor: DANGER }]}>
            <TouchableOpacity onPress={() => { setShowRetur(false); setAutoOpenReturId(undefined); loadPendingReturs(); }}>
              <Text style={S.backTxt}>{"Tutup"}</Text>
            </TouchableOpacity>
            <Text style={S.fullModalTitle}>{"⚠️ Tinjau Retur"}</Text>
            <View style={S.headerReturBadge}>
              <Text style={S.headerReturBadgeTxt}>{String(pendingReturs.length)}</Text>
            </View>
          </View>
          <ReturOwnerScreen
            route={{ params: { ownerId: myId, ownerName: myRegistration?.name ?? "Owner", autoOpenId: autoOpenReturId } }}
          />
        </View>
      </Modal>

      {/* TAMBAHAN: Modal Notif Settings */}
      <Modal
        visible={showNotifSettings}
        animationType="slide"
        transparent
        onRequestClose={() => setShowNotifSettings(false)}
      >
        <Pressable style={S.overlay} onPress={() => setShowNotifSettings(false)}>
          <Pressable style={S.sheetTall} onPress={() => {}}>
            <NotifSettingsPanel
              ownerId={myId}
              tokoName={myRegistration?.tokoName ?? "Toko"}
              onClose={() => setShowNotifSettings(false)}
            />
          </Pressable>
        </Pressable>
      </Modal>

      {/* ══ Modal Pencairan Dana ══ */}
      <Modal
        visible={showPencairan}
        animationType="slide"
        onRequestClose={() => { setShowPencairan(false); setShowBankForm(false); setShowWdForm(false); }}
      >
        <View style={S.fullModal}>
          <View style={[S.fullModalHeader, { backgroundColor: "#0F766E" }]}>
            <TouchableOpacity onPress={() => { setShowPencairan(false); setShowBankForm(false); setShowWdForm(false); }}>
              <Text style={S.backTxt}>{"Tutup"}</Text>
            </TouchableOpacity>
            <Text style={S.fullModalTitle}>{"💸 Pencairan Dana"}</Text>
            <Text style={S.headerCountTxt}>{""}</Text>
          </View>

          <ScrollView contentContainerStyle={S.pencairanScroll}>
            <View style={S.pencairanSaldoCard}>
              <Text style={S.pencairanSaldoLbl}>{"Saldo Bisa Dicairkan"}</Text>
              <Text style={S.pencairanSaldoVal}>{formatRpFull(saldoOnline)}</Text>
              <Text style={S.pencairanSaldoSub}>{"Dari order online selesai · Owner tidak dikenakan biaya apapun"}</Text>
              <View style={S.pencairanSaldoBtnRow}>
                <TouchableOpacity
                  style={saldoOnline >= MIN_WD && bankAccount ? S.pencairanCairBtn : S.pencairanCairBtnDisabled}
                  onPress={() => { setShowWdForm(true); setShowBankForm(false); }}
                  disabled={saldoOnline < MIN_WD || !bankAccount}
                >
                  <Text style={S.pencairanCairBtnTxt}>
                    {!bankAccount
                      ? "⚠️ Atur Rekening Dulu"
                      : saldoOnline < MIN_WD
                      ? "Saldo Belum Cukup"
                      : "💸 Cairkan"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={S.pencairanRekeningBtn}
                  onPress={() => {
                    if (bankAccount) setBankInput({ ...bankAccount });
                    setShowBankForm(true);
                    setShowWdForm(false);
                  }}
                >
                  <Text style={S.pencairanRekeningBtnTxt}>{bankAccount ? "🏦 Edit Rekening" : "🏦 + Rekening"}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={S.pencairanInfoBox}>
              <Text style={S.pencairanInfoTxt}>
                {"• Minimum pencairan: " + formatRpFull(MIN_WD) +
                 "\n• Proses transfer 1×24 jam kerja" +
                 "\n• Biaya transfer ditanggung sistem" +
                 "\n• Saldo dari subtotal produk order online selesai"}
              </Text>
            </View>

            {bankAccount && !showBankForm && (
              <View style={S.pencairanBankCard}>
                <View style={FLEX_ONE}>
                  <Text style={S.pencairanBankTitle}>{"🏦 Rekening Tujuan"}</Text>
                  <Text style={S.pencairanBankName}>{bankAccount.namaBank}</Text>
                  <Text style={S.pencairanBankNum}>{bankAccount.nomorRekening}</Text>
                  <Text style={S.pencairanBankOwner}>{"a.n. " + bankAccount.namaPemilik}</Text>
                </View>
                <TouchableOpacity
                  style={S.pencairanBankEditBtn}
                  onPress={() => { setBankInput({ ...bankAccount }); setShowBankForm(true); }}
                >
                  <Text style={S.pencairanBankEditTxt}>{"✏️ Edit"}</Text>
                </TouchableOpacity>
              </View>
            )}

            {showBankForm && (
              <View style={S.pencairanFormCard}>
                <Text style={S.pencairanFormTitle}>{"🏦 " + (bankAccount ? "Edit" : "Tambah") + " Rekening Bank"}</Text>
                <Text style={S.pencairanFormLbl}>{"Nama Bank"}</Text>
                <TextInput
                  style={S.pencairanFormInput}
                  value={bankInput.namaBank}
                  onChangeText={(v) => setBankInput((p) => ({ ...p, namaBank: v }))}
                  placeholder="BCA, BRI, BNI, Mandiri, dll"
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="characters"
                />
                <Text style={S.pencairanFormLbl}>{"Nomor Rekening"}</Text>
                <TextInput
                  style={S.pencairanFormInput}
                  value={bankInput.nomorRekening}
                  onChangeText={(v) => setBankInput((p) => ({ ...p, nomorRekening: v }))}
                  placeholder="1234567890"
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                />
                <Text style={S.pencairanFormLbl}>{"Nama Pemilik Rekening"}</Text>
                <TextInput
                  style={S.pencairanFormInput}
                  value={bankInput.namaPemilik}
                  onChangeText={(v) => setBankInput((p) => ({ ...p, namaPemilik: v }))}
                  placeholder="Sesuai buku tabungan"
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="words"
                />
                <View style={S.pencairanWarnBox}>
                  <Text style={S.pencairanWarnTxt}>{"⚠️ Pastikan data rekening benar. Dana salah kirim tidak dapat dikembalikan."}</Text>
                </View>
                <View style={S.pencairanFormBtnRow}>
                  <TouchableOpacity style={S.pencairanFormCancelBtn} onPress={() => setShowBankForm(false)}>
                    <Text style={S.pencairanFormCancelTxt}>{"Batal"}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={S.pencairanFormSaveBtn} onPress={handleSaveBank}>
                    <Text style={S.pencairanFormSaveTxt}>{"💾 Simpan"}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {showWdForm && (
              <View style={S.pencairanFormCard}>
                <Text style={S.pencairanFormTitle}>{"💸 Jumlah Pencairan"}</Text>
                <View style={S.pencairanSaldoMini}>
                  <Text style={S.pencairanSaldoMiniLbl}>{"Saldo tersedia"}</Text>
                  <Text style={S.pencairanSaldoMiniVal}>{formatRpFull(saldoOnline)}</Text>
                </View>
                {bankAccount && (
                  <View style={S.pencairanBankPreview}>
                    <Text style={S.pencairanBankPreviewTxt}>
                      {"🏦 " + bankAccount.namaBank + " · " + bankAccount.nomorRekening}
                    </Text>
                    <Text style={S.pencairanBankPreviewOwner}>{"a.n. " + bankAccount.namaPemilik}</Text>
                  </View>
                )}
                <Text style={S.pencairanFormLbl}>{"Jumlah (min. " + formatRpFull(MIN_WD) + ")"}</Text>
                <TextInput
                  style={S.pencairanFormInput}
                  value={wdJumlah}
                  onChangeText={setWdJumlah}
                  placeholder={formatRpFull(MIN_WD)}
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                />
                <View style={S.pencairanShortcutRow}>
                  {[100000, 250000, 500000, 1000000, 2000000]
                    .filter((v) => v <= saldoOnline)
                    .map((v) => (
                      <TouchableOpacity key={v} style={S.pencairanShortcutBtn} onPress={() => setWdJumlah(String(v))}>
                        <Text style={S.pencairanShortcutTxt}>{formatOmset(v)}</Text>
                      </TouchableOpacity>
                    ))}
                  {saldoOnline >= MIN_WD && (
                    <TouchableOpacity
                      style={S.pencairanShortcutBtnAll}
                      onPress={() => setWdJumlah(String(Math.floor(saldoOnline)))}
                    >
                      <Text style={S.pencairanShortcutTxt}>{"Semua"}</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <View style={S.pencairanWarnBox}>
                  <Text style={S.pencairanWarnTxt}>{"⏰ Proses transfer 1×24 jam kerja. Biaya transfer ditanggung sistem."}</Text>
                </View>
                <View style={S.pencairanFormBtnRow}>
                  <TouchableOpacity style={S.pencairanFormCancelBtn} onPress={() => setShowWdForm(false)}>
                    <Text style={S.pencairanFormCancelTxt}>{"Batal"}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={S.pencairanFormSaveBtn} onPress={handleRequestWithdraw}>
                    <Text style={S.pencairanFormSaveTxt}>{"💸 Ajukan"}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <Text style={S.pencairanHistoryTitle}>{"Riwayat Pencairan"}</Text>
            {withdrawals.length === 0 ? (
              <View style={S.pencairanHistoryEmpty}>
                <Text style={S.pencairanHistoryEmptyTxt}>{"Belum ada riwayat pencairan."}</Text>
              </View>
            ) : (
              withdrawals.map((wd) => (
                <View key={wd.id} style={S.pencairanHistoryItem}>
                  <View style={FLEX_ONE}>
                    <Text style={S.pencairanHistoryId}>{"#" + wd.id.slice(-8).toUpperCase()}</Text>
                    <Text style={S.pencairanHistoryBank}>{wd.namaBank + " · " + wd.nomorRekening}</Text>
                    <Text style={S.pencairanHistoryOwner}>{"a.n. " + wd.namaPemilik}</Text>
                    <Text style={S.pencairanHistoryDate}>{formatDateWd(wd.createdAt)}</Text>
                    {wd.catatan ? <Text style={S.pencairanHistoryCatatan}>{wd.catatan}</Text> : null}
                  </View>
                  <View style={S.pencairanHistoryRight}>
                    <Text style={S.pencairanHistoryJumlah}>{formatRpFull(wd.jumlah)}</Text>
                    <View style={[S.pencairanStatusBadge, { backgroundColor: (WD_STATUS_COLOR[wd.status] ?? "#64748B") + "22" }]}>
                      <Text style={[S.pencairanStatusTxt, { color: WD_STATUS_COLOR[wd.status] ?? "#64748B" }]}>
                        {WD_STATUS_LABEL[wd.status] ?? wd.status}
                      </Text>
                    </View>
                  </View>
                </View>
              ))
            )}
            <View style={S.pencairanBottomSpacer} />
          </ScrollView>
        </View>
      </Modal>

      {/* Modal: Info Paket */}
      <Modal visible={showPaketInfo} transparent animationType="slide" onRequestClose={() => setShowPaketInfo(false)}>
        <Pressable style={S.overlay} onPress={() => setShowPaketInfo(false)}>
          <Pressable style={S.sheetTall} onPress={() => {}}>
            <Text style={S.sheetTitle}>{"Paket Langganan Saya"}</Text>
            <View style={[S.paketActiveCard, { borderColor: PAKET_COLOR[paket] }]}>
              <View style={[S.paketActiveBadge, { backgroundColor: PAKET_COLOR[paket] }]}>
                <Text style={S.paketActiveBadgeTxt}>{"AKTIF"}</Text>
              </View>
              <Text style={[S.paketActiveName, { color: PAKET_COLOR[paket] }]}>{"Paket " + PAKET_LABEL[paket]}</Text>
              <Text style={S.paketActivePrice}>{"Rp " + (PAKET_HARGA[paket] / 1000).toFixed(0) + ".000 / bulan"}</Text>
              <View style={S.paketLimitInfoRow}>
                <Text style={S.paketLimitInfoTxt}>{"Max produk: " + (maxProduk !== null ? String(maxProduk) : "Unlimited")}</Text>
                <Text style={S.paketLimitInfoTxt}>{"Max kasir: " + (maxKasirVal !== null ? String(maxKasirVal) : "Unlimited")}</Text>
                <Text style={S.paketLimitInfoTxt}>{"Kurir: " + (canKurir ? "Tersedia" : "Tidak tersedia")}</Text>
                <Text style={S.paketLimitInfoTxt}>{"AI Assistant: " + (canAI ? "Tersedia" : "Tidak tersedia")}</Text>
              </View>
              {trial.isActive && <Text style={S.paketTrialNote}>{"Masa trial: sisa " + trial.daysLeft + " hari"}</Text>}
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <PaketTable highlight={paket} />
            </ScrollView>
            <View style={S.sheetActions}>
              {upgradeTo && (
                <TouchableOpacity
                  style={[S.sheetBtn, { backgroundColor: PAKET_COLOR[upgradeTo] }]}
                  onPress={() => { setShowPaketInfo(false); setShowUpgrade(true); }}
                >
                  <Text style={S.sheetBtnTxt}>{"⬆️ Upgrade"}</Text>
                </TouchableOpacity>
              )}
              {canDowngrade && (
                <TouchableOpacity
                  style={[S.sheetBtn, S.sheetBtnDowngrade]}
                  onPress={() => { setShowPaketInfo(false); setShowDowngrade(true); }}
                >
                  <Text style={S.sheetBtnDowngradeTxt}>{"⬇️ Turunkan Paket"}</Text>
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity style={[S.sheetBtn, S.sheetBtnGray, { marginTop: 8 }]} onPress={() => setShowPaketInfo(false)}>
              <Text style={S.sheetBtnGrayTxt}>{"Tutup"}</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal: Upgrade */}
      <Modal visible={showUpgrade} transparent animationType="slide" onRequestClose={() => setShowUpgrade(false)}>
        <Pressable style={S.overlay} onPress={() => setShowUpgrade(false)}>
          <Pressable style={S.sheet} onPress={() => {}}>
            <Text style={S.sheetTitle}>{"⬆️ Upgrade Paket"}</Text>
            <Text style={S.sheetSubtitle}>{"Saat ini: Paket " + PAKET_LABEL[paket]}</Text>
            {PAKET_LIST.filter((p) => p !== paket && PAKET_LIST.indexOf(p) > PAKET_LIST.indexOf(paket)).map((p) => {
              const isActive = selectedUpgrade === p;
              const color    = PAKET_COLOR[p];
              return (
                <TouchableOpacity key={p} style={getPaketOptStyle(isActive, color)} onPress={() => setSelectedUpgrade(p)}>
                  <View style={FLEX_ONE}>
                    <Text style={getPaketOptLblStyle(isActive, color)}>{"Paket " + PAKET_LABEL[p]}</Text>
                    <Text style={S.paketOptPrice}>{"Rp " + (PAKET_HARGA[p] / 1000).toFixed(0) + ".000/bulan"}</Text>
                    <Text style={S.paketOptFeatureHint}>
                      {p === "pro"
                        ? "+ Kurir, AI, Grafik 7 hari, PDF, 5 Kasir, 200 Produk"
                        : "+ Grafik 30 hari, Top Produk, AI Prediksi, Kasir & Produk Unlimited"}
                    </Text>
                  </View>
                  {isActive && <Text style={S.checkMark}>{"✅"}</Text>}
                </TouchableOpacity>
              );
            })}
            <View style={S.sheetNote}>
              <Text style={S.sheetNoteTxt}>{"Hubungi marketing kamu untuk konfirmasi pembayaran setelah memilih paket."}</Text>
            </View>
            <View style={S.sheetActions}>
              <TouchableOpacity style={[S.sheetBtn, S.sheetBtnGray]} onPress={() => setShowUpgrade(false)}>
                <Text style={S.sheetBtnGrayTxt}>{"Batal"}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[S.sheetBtn, { backgroundColor: selectedUpgrade ? PAKET_COLOR[selectedUpgrade] : "#CBD5E1" }]}
                onPress={handleConfirmUpgrade}
                disabled={!selectedUpgrade}
              >
                <Text style={S.sheetBtnTxt}>{"Ajukan Upgrade"}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal: Downgrade */}
      <Modal visible={showDowngrade} transparent animationType="slide" onRequestClose={() => setShowDowngrade(false)}>
        <Pressable style={S.overlay} onPress={() => setShowDowngrade(false)}>
          <Pressable style={S.sheetTall} onPress={() => {}}>
            <Text style={S.sheetTitle}>{"⬇️ Turunkan Paket"}</Text>
            <Text style={S.sheetSubtitle}>{"Saat ini: Paket " + PAKET_LABEL[paket]}</Text>
            {downgradeOptions.map((p) => {
              const isActive = selectedDowngrade === p;
              const color    = PAKET_COLOR[p];
              return (
                <TouchableOpacity key={p} style={getPaketOptStyle(isActive, color)} onPress={() => setSelectedDowngrade(p)}>
                  <View style={FLEX_ONE}>
                    <Text style={getPaketOptLblStyle(isActive, color)}>{"Paket " + PAKET_LABEL[p]}</Text>
                    <Text style={S.paketOptPrice}>{"Rp " + (PAKET_HARGA[p] / 1000).toFixed(0) + ".000/bulan"}</Text>
                  </View>
                  {isActive && <Text style={S.checkMark}>{"✅"}</Text>}
                </TouchableOpacity>
              );
            })}
            {selectedDowngrade && (
              <View style={S.downgradeWarnBox}>
                <Text style={S.downgradeWarnTitle}>{"⚠️ Fitur yang akan hilang:"}</Text>
                {(DOWNGRADE_WARNINGS[selectedDowngrade] ?? []).map((w) => (
                  <View key={w} style={S.downgradeWarnRow}>
                    <Text style={S.downgradeWarnDot}>{"•"}</Text>
                    <Text style={S.downgradeWarnItem}>{w}</Text>
                  </View>
                ))}
                <Text style={S.downgradeWarnNote}>{"Downgrade berlaku di periode tagihan berikutnya. Data kamu tetap aman."}</Text>
              </View>
            )}
            <View style={S.sheetNote}>
              <Text style={S.sheetNoteTxt}>{"Hubungi marketing kamu untuk konfirmasi perubahan paket."}</Text>
            </View>
            <View style={S.sheetActions}>
              <TouchableOpacity style={[S.sheetBtn, S.sheetBtnGray]} onPress={() => setShowDowngrade(false)}>
                <Text style={S.sheetBtnGrayTxt}>{"Batal"}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[S.sheetBtn, S.sheetBtnDangerDowngrade]}
                onPress={handleConfirmDowngrade}
                disabled={!selectedDowngrade}
              >
                <Text style={S.sheetBtnTxt}>{"Ajukan Downgrade"}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal: Perpanjang */}
      <Modal visible={showPerpanjang} transparent animationType="slide" onRequestClose={() => setShowPerpanjang(false)}>
        <Pressable style={S.overlay} onPress={() => setShowPerpanjang(false)}>
          <Pressable style={S.sheet} onPress={() => {}}>
            <Text style={S.sheetTitle}>{"Perpanjang Langganan"}</Text>
            <Text style={S.sheetSubtitle}>{"Paket " + PAKET_LABEL[paket] + " — Rp " + (PAKET_HARGA[paket] / 1000).toFixed(0) + ".000/bulan"}</Text>
            <View style={S.perpanjangInfo}>
              <Text style={S.perpanjangIcon}>{"📞"}</Text>
              <Text style={S.perpanjangTxt}>{"Hubungi marketing kamu untuk melakukan pembayaran dan perpanjangan langganan."}</Text>
            </View>
            <TouchableOpacity
              style={{ backgroundColor: "#2563EB", borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 12, elevation: 2 }}
              onPress={handleBayarLanggananMayar}
            >
              <Text style={{ color: "#fff", fontWeight: "800", fontSize: 13 }}>
                {"⚡ Bayar Online via mayar.id (QRIS/VA/e-Wallet) →"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[S.sheetBtn, { backgroundColor: "#64748B", marginTop: 10 }]}
              onPress={() => setShowPerpanjang(false)}
            >
              <Text style={S.sheetBtnTxt}>{"Tutup"}</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Modal Simulasi Pembayaran Langganan Owner (mayar.id) ── */}
      <Modal visible={showMayarSubModal} transparent animationType="slide" onRequestClose={() => setShowMayarSubModal(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", padding: 20 }}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShowMayarSubModal(false)} />
          <View style={{ backgroundColor: "#fff", borderRadius: 24, padding: 20, elevation: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={{ backgroundColor: "#EEF2FF", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
                  <Text style={{ fontSize: 13, fontWeight: "900", color: "#4338CA" }}>{"mayar.id"}</Text>
                </View>
                <Text style={{ fontSize: 16, fontWeight: "800", color: "#1E293B" }}>{"Pembayaran Langganan"}</Text>
              </View>
              <TouchableOpacity onPress={() => setShowMayarSubModal(false)}>
                <Text style={{ fontSize: 20, color: "#64748B", fontWeight: "700" }}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={{ backgroundColor: "#F8FAFC", borderRadius: 14, padding: 14, alignItems: "center", marginBottom: 14, borderWidth: 1, borderColor: "#E2E8F0" }}>
              <Text style={{ fontSize: 12, color: "#64748B" }}>{"Paket " + PAKET_LABEL[paket] + " (1 Bulan):"}</Text>
              <Text style={{ fontSize: 26, fontWeight: "900", color: "#2563EB", marginVertical: 2 }}>
                {"Rp " + ((PAKET_HARGA[paket] || 50000) / 1000).toFixed(0) + ".000"}
              </Text>
              <Text style={{ fontSize: 11, color: "#16A34A", fontWeight: "700" }}>
                {"✅ TWD POS — " + (myRegistration?.tokoName || "Toko Anda")}
              </Text>
            </View>

            <View style={{ backgroundColor: "#fff", borderRadius: 16, padding: 16, alignItems: "center", marginBottom: 16, borderWidth: 1.5, borderColor: "#E2E8F0" }}>
              <Text style={{ fontSize: 13, fontWeight: "800", color: "#1E293B", marginBottom: 4 }}>
                {"📱 SCAN QRIS PEMBAYARAN"}
              </Text>
              <Text style={{ fontSize: 11, color: "#64748B", marginBottom: 12 }}>
                {"Bisa di-scan menggunakan DANA, GoPay, OVO, ShopeePay, BCA, dll."}
              </Text>
              <View style={{ width: 150, height: 150, backgroundColor: "#F1F5F9", borderRadius: 12, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "#CBD5E1", marginBottom: 10 }}>
                <Text style={{ fontSize: 52 }}>{"📱"}</Text>
                <Text style={{ fontSize: 11, fontWeight: "800", color: "#475569", marginTop: 4 }}>
                  {"[QRIS MAYAR.ID]"}
                </Text>
              </View>
              <Text style={{ fontSize: 11, color: "#2563EB", fontWeight: "700" }}>
                {"Nomor VA Bank: 88910" + Math.floor(10000000 + Math.random() * 90000000)}
              </Text>
            </View>

            <TouchableOpacity
              style={{ backgroundColor: "#10B981", borderRadius: 14, paddingVertical: 14, alignItems: "center", elevation: 2 }}
              onPress={async () => {
                try {
                  const currentExp = await AsyncStorage.getItem("twd_expiry_date");
                  const baseDate = currentExp && new Date(currentExp) > new Date() ? new Date(currentExp) : new Date();
                  const newExp = new Date(baseDate.getTime() + 30 * 86400000).toISOString();
                  await AsyncStorage.setItem("twd_expiry_date", newExp);
                  setShowMayarSubModal(false);
                  setShowPerpanjang(false);
                  Alert.alert("Langganan Aktif! 🎉", `Pembayaran via Mayar.id sukses! Masa aktif paket ${PAKET_LABEL[paket]} toko Anda diperpanjang +30 Hari.`);
                } catch {
                  Alert.alert("Error", "Gagal mengaktifkan langganan.");
                }
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>
                {"✅ Bayar Sekarang (Simulasi Sukses)"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  root:        { flex: 1, backgroundColor: "#F1F5F9" },
  header:      { paddingTop: 52, paddingBottom: 16, paddingHorizontal: 20, flexDirection: "row", alignItems: "center" },
  headerTitle: { color: "#fff", fontSize: 20, fontWeight: "800" },
  headerSub:   { color: "rgba(255,255,255,0.75)", fontSize: 12, marginTop: 2 },
  paketBadge:    { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, alignItems: "center", marginLeft: 12, opacity: 0.9 },
  paketBadgeTxt: { color: "#fff", fontSize: 13, fontWeight: "800" },
  paketBadgeSub: { color: "rgba(255,255,255,0.7)", fontSize: 9, marginTop: 1 },

  // TAMBAHAN: notif button
  notifBtn:      { position: "relative", padding: 8, marginRight: 4 },
  notifBtnIcon:  { fontSize: 20 },
  notifBadge:    { position: "absolute", top: 2, right: 2, backgroundColor: DANGER, borderRadius: 8, minWidth: 16, height: 16, justifyContent: "center", alignItems: "center", paddingHorizontal: 3 },
  notifBadgeTxt: { color: "#fff", fontSize: 9, fontWeight: "900" },

  trialBanner:        { backgroundColor: "#ECFDF5", margin: 16, marginBottom: 4, borderRadius: 14, padding: 16, flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1.5, borderColor: "#86EFAC" },
  trialBannerUrgent:  { backgroundColor: "#FEF9C3", borderColor: "#FCD34D" },
  trialBannerTitle:   { fontSize: 14, fontWeight: "800", color: "#1E293B", marginBottom: 2 },
  trialBannerSub:     { fontSize: 12, color: "#475569", marginBottom: 8 },
  trialBarBg:         { height: 6, backgroundColor: "#E2E8F0", borderRadius: 4, overflow: "hidden", marginBottom: 4 },
  trialBarFill:       { height: 6, borderRadius: 4 },
  trialDaysLeft:      { fontSize: 11, fontWeight: "700" },
  trialExpiredBanner: { backgroundColor: "#FEF2F2", margin: 16, marginBottom: 4, borderRadius: 14, padding: 16, flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1.5, borderColor: "#FCA5A5" },
  trialExpiredTitle:  { fontSize: 14, fontWeight: "800", color: DANGER },
  trialExpiredSub:    { fontSize: 12, color: "#475569", marginTop: 2 },
  upgradeBtn:      { backgroundColor: ACCENT, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  upgradeBtnTxt:   { color: "#fff", fontWeight: "800", fontSize: 13 },
  aktifBanner:      { backgroundColor: "#F0FDF4", margin: 16, marginBottom: 4, borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: "#86EFAC" },
  aktifIcon:        { fontSize: 24 },
  aktifTitle:       { fontSize: 13, fontWeight: "700", color: "#166534" },
  aktifSub:         { fontSize: 12, color: "#64748B", marginTop: 1 },
  aktifBannerBtns:  { flexDirection: "column", gap: 4 },
  upgradeSmallBtn:  { backgroundColor: ACCENT, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, alignItems: "center" },
  upgradeSmallTxt:  { color: "#fff", fontWeight: "700", fontSize: 11 },
  downgradeSmallBtn:{ backgroundColor: "#FEF2F2", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, alignItems: "center", borderWidth: 1, borderColor: "#FECACA" },
  downgradeSmallTxt:{ color: DANGER, fontWeight: "700", fontSize: 11 },
  limitBanner:         { backgroundColor: "#FFF7ED", marginHorizontal: 16, marginBottom: 4, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: "#FED7AA" },
  limitBannerTxt:      { fontSize: 12, color: "#92400E", fontWeight: "600" },
  modalLimitBanner:    { backgroundColor: "#FFF7ED", margin: 12, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: "#FED7AA" },
  modalLimitBannerTxt: { fontSize: 12, color: "#92400E", fontWeight: "600" },
  featureLockOverlay: { backgroundColor: "#F8FAFC", borderRadius: 12, padding: 24, alignItems: "center", margin: 8, borderWidth: 1, borderColor: "#E2E8F0" },
  featureLockIcon:    { fontSize: 32, marginBottom: 8 },
  featureLockTitle:   { fontSize: 15, fontWeight: "800", color: "#1E293B", marginBottom: 4 },
  featureLockDesc:    { fontSize: 13, color: "#64748B", textAlign: "center", marginBottom: 14 },
  featureLockBtn:     { borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  featureLockBtnTxt:  { color: "#fff", fontWeight: "700", fontSize: 13 },
  returWarningBanner:   { marginHorizontal: 16, marginBottom: 4, marginTop: 4, borderRadius: 14, overflow: "hidden", flexDirection: "row", backgroundColor: "#FEF2F2", borderWidth: 1.5, borderColor: "#FCA5A5", elevation: 3, shadowColor: DANGER, shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  returWarningStripe:   { width: 5, backgroundColor: DANGER },
  returWarningBody:     { flex: 1, padding: 14 },
  returWarningTop:      { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 10 },
  returWarningEmoji:    { fontSize: 24 },
  returWarningTitle:    { fontSize: 13, fontWeight: "800", color: "#7F1D1D", marginBottom: 3 },
  returWarningDesc:     { fontSize: 12, color: "#991B1B", lineHeight: 18 },
  returWarningBadge:    { backgroundColor: DANGER, borderRadius: 10, minWidth: 24, height: 24, justifyContent: "center", alignItems: "center", paddingHorizontal: 6 },
  returWarningBadgeTxt: { color: "#fff", fontSize: 12, fontWeight: "800" },
  returPreviewBox:      { backgroundColor: "#fff", borderRadius: 10, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: "#FECACA" },
  returPreviewItem:     { fontSize: 12, color: "#374151", marginBottom: 3 },
  returPreviewAlasan:   { fontSize: 12, color: "#6B7280", fontStyle: "italic", marginBottom: 4 },
  returPreviewTotal:    { fontSize: 13, fontWeight: "700", color: DANGER },
  returWarningCta:      { alignItems: "flex-end" },
  returWarningCtaTxt:   { fontSize: 12, color: DANGER, fontWeight: "700" },
  stokWarningBanner:       { marginHorizontal: 16, marginBottom: 4, marginTop: 4, borderRadius: 14, overflow: "hidden", flexDirection: "row", borderWidth: 1.5, elevation: 2, shadowOpacity: 0.08, shadowRadius: 3, shadowOffset: { width: 0, height: 2 } },
  stokWarningBannerRed:    { backgroundColor: "#FEF2F2", borderColor: "#FCA5A5", shadowColor: DANGER },
  stokWarningBannerOrange: { backgroundColor: "#FFF7ED", borderColor: "#FED7AA", shadowColor: ORANGE },
  stokWarningStripe:       { width: 5 },
  stokWarningBody:         { flex: 1, padding: 14 },
  stokWarningTop:          { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 8 },
  stokWarningEmoji:        { fontSize: 22 },
  stokWarningTitle:        { fontSize: 13, fontWeight: "800", marginBottom: 3 },
  stokWarningDesc:         { fontSize: 12, lineHeight: 18 },
  stokWarningCta:          { alignItems: "flex-end" },
  stokWarningCtaTxt:       { fontSize: 12, fontWeight: "700" },
  tokoCard:      { backgroundColor: "#fff", borderRadius: 14, margin: 16, marginBottom: 4, padding: 16, elevation: 2 },
  tokoCardTitle: { fontSize: 14, fontWeight: "700", color: "#1E293B", marginBottom: 10 },
  tokoRow:       { flexDirection: "row", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  tokoKey:       { fontSize: 12, color: "#64748B", width: 80 },
  tokoVal:       { fontSize: 13, color: "#1E293B", fontWeight: "500", flex: 1 },
  tokoKode:      { fontWeight: "800", color: ACCENT, letterSpacing: 1 },
  paketLimitRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  paketLimitItem:{ fontSize: 11, color: "#64748B", backgroundColor: "#F1F5F9", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  produkInfoCard:        { backgroundColor: "#FFF7ED", borderRadius: 14, marginHorizontal: 16, marginBottom: 4, marginTop: 4, padding: 14, flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: "#FED7AA" },
  produkInfoIcon:        { fontSize: 28 },
  produkInfoTitle:       { fontSize: 13, fontWeight: "700", color: "#92400E", marginBottom: 4 },
  produkInfoSub:         { fontSize: 11, color: "#B45309" },
  produkStokRow:         { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  produkStokOk:          { fontSize: 11, color: "#166534", fontWeight: "600" },
  produkStokWarn:        { fontSize: 11, color: ORANGE, fontWeight: "600" },
  produkStokEmpty:       { fontSize: 11, color: DANGER, fontWeight: "700" },
  produkInfoBtns:        { flexDirection: "column", gap: 6 },
  produkInfoBtn:         { backgroundColor: ORANGE, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, alignItems: "center" },
  produkInfoBtnDisabled: { backgroundColor: "#94a3b8" },
  produkInfoBtnTxt:      { color: "#fff", fontWeight: "700", fontSize: 11 },
  produkInfoBtnStok:     { backgroundColor: TEAL, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, alignItems: "center" },
  produkInfoBtnStokTxt:  { color: "#fff", fontWeight: "700", fontSize: 11 },
  statsSectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginHorizontal: 16, marginTop: 16, marginBottom: 10 },
  refreshBtn:         { backgroundColor: "#EFF6FF", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  refreshTxt:         { fontSize: 11, color: ACCENT, fontWeight: "700" },
  statsRow:      { flexDirection: "row", marginHorizontal: 16, gap: 8, marginBottom: 4 },
  statCard:      { flex: 1, borderRadius: 12, padding: 12, elevation: 2, alignItems: "center", borderWidth: 1 },
  statCardBlue:  { backgroundColor: "#EFF6FF", borderColor: "#BFDBFE" },
  statCardGreen: { backgroundColor: "#F0FDF4", borderColor: "#BBF7D0" },
  statCardOrange:{ backgroundColor: "#FFF7ED", borderColor: "#FED7AA" },
  statIcon:      { fontSize: 20, marginBottom: 4 },
  statNum:       { fontSize: 15, fontWeight: "800" },
  statLbl:       { fontSize: 10, color: "#64748B", marginTop: 3, textAlign: "center" },
  statDetailCard:   { backgroundColor: "#fff", borderRadius: 16, margin: 16, marginTop: 8, padding: 16, elevation: 2 },
  statDetailHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  statDetailTitle:  { fontSize: 14, fontWeight: "700", color: "#1E293B" },
  chartToggleRow:      { flexDirection: "row", gap: 4 },
  chartToggleBtn:      { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  chartToggleBtnOff:   { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: "#F1F5F9" },
  chartToggleTxtOn:    { color: "#fff", fontWeight: "700", fontSize: 11 },
  chartToggleTxtOff:   { color: "#64748B", fontSize: 11 },
  chartToggleLocked:   { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: "#F1F5F9" },
  chartToggleLockedTxt:{ color: "#94A3B8", fontSize: 11 },
  chartSummaryRow:  { flexDirection: "row", gap: 8, marginBottom: 14 },
  chartSummaryItem: { flex: 1, backgroundColor: "#F8FAFC", borderRadius: 10, padding: 10, alignItems: "center" },
  chartSummaryLbl:  { fontSize: 10, color: "#64748B", marginBottom: 4 },
  chartSummaryVal:  { fontSize: 14, fontWeight: "800" },
  chartLoading:     { height: 130, justifyContent: "center", alignItems: "center" },
  chartLoadingTxt:  { color: "#94A3B8", fontSize: 13 },
  barChartWrap:  { paddingVertical: 4 },
  barChartBars:  { flexDirection: "row", alignItems: "flex-end", gap: 6, paddingHorizontal: 4 },
  barItem:       { alignItems: "center" },
  barOmsetLbl:   { fontSize: 8, color: "#64748B", marginBottom: 2, textAlign: "center" },
  barContainer:  { height: BAR_HEIGHT, justifyContent: "flex-end" },
  barFill:       {},
  barLabel:      { fontSize: 9, color: "#94A3B8", marginTop: 4 },
  barTodayDot:   { width: 4, height: 4, borderRadius: 2, marginTop: 2 },
  topProdukSection:     { marginTop: 16, borderTopWidth: 1, borderTopColor: "#F1F5F9", paddingTop: 12 },
  topProdukTitle:       { fontSize: 13, fontWeight: "700", color: "#1E293B", marginBottom: 8 },
  topProdukRow:         { flexDirection: "row", alignItems: "center", paddingVertical: 6, gap: 8, borderBottomWidth: 1, borderBottomColor: "#F8FAFC" },
  topProdukRank:        { fontSize: 13, fontWeight: "800", color: "#94A3B8", width: 18, textAlign: "center" },
  topProdukName:        { fontSize: 13, color: "#334155" },
  topProdukQty:         { fontSize: 12, color: "#64748B", width: 48, textAlign: "right" },
  topProdukOmset:       { fontSize: 12, fontWeight: "700", width: 60, textAlign: "right" },
  topProdukLockWrap:    { marginTop: 12, flexDirection: "row", alignItems: "center", gap: 6 },
  topProdukLockTxt:     { fontSize: 12, color: "#94A3B8" },
  topProdukLockUpgrade: { fontSize: 12, fontWeight: "700", textDecorationLine: "underline" },
  aiTeaserCard:  { flexDirection: "row", alignItems: "center", backgroundColor: "#F5F3FF", borderRadius: 14, marginHorizontal: 16, marginBottom: 4, padding: 14, gap: 12, borderWidth: 1.5, borderColor: "#DDD6FE" },
  aiTeaserIcon:  { fontSize: 28 },
  aiTeaserTitle: { fontSize: 13, fontWeight: "700", color: "#5B21B6", marginBottom: 2 },
  aiTeaserDesc:  { fontSize: 11, color: "#7C3AED", lineHeight: 16 },
  aiTeaserLock:  { fontSize: 20 },
  paketLimitInfoRow: { marginTop: 10, gap: 4 },
  paketLimitInfoTxt: { fontSize: 12, color: "#475569" },
  menuSectionTitle:  { fontSize: 14, fontWeight: "700", color: "#1E293B", marginHorizontal: 16, marginTop: 16, marginBottom: 10 },
  menuGrid:          { flexDirection: "row", flexWrap: "wrap", marginHorizontal: 12, gap: 10 },
  menuBtn:           { width: "30%", borderRadius: 14, padding: 16, alignItems: "center", elevation: 2, minWidth: 100 },
  menuBtnLocked:     { opacity: 0.65 },
  menuIcon:          { fontSize: 28, marginBottom: 6 },
  menuLabel:         { color: "#fff", fontSize: 12, fontWeight: "700", textAlign: "center" },
  menuLockBadge:     { color: "rgba(255,255,255,0.85)", fontSize: 9, marginTop: 3 },
  headerReturBadge:    { backgroundColor: "rgba(255,255,255,0.3)", borderRadius: 8, minWidth: 22, height: 22, justifyContent: "center", alignItems: "center", paddingHorizontal: 5 },
  headerReturBadgeTxt: { color: "#fff", fontSize: 11, fontWeight: "700" },
  headerStokBadgeWrap: { flexDirection: "row", gap: 4 },
  headerStokBadge:     { borderRadius: 8, minWidth: 38, height: 22, justifyContent: "center", alignItems: "center", paddingHorizontal: 5 },
  headerStokBadgeTxt:  { color: "#fff", fontSize: 10, fontWeight: "700" },
  logoutBtn: { margin: 16, marginTop: 20, backgroundColor: "#FEF2F2", borderRadius: 12, padding: 14, alignItems: "center" },
  logoutTxt: { color: DANGER, fontWeight: "700" },
  fullModal:       { flex: 1, backgroundColor: "#F5F5F5" },
  fullModalHeader: { paddingTop: 52, paddingBottom: 14, paddingHorizontal: 20, flexDirection: "row", alignItems: "center" },
  fullModalTitle:  { flex: 1, color: "#fff", fontSize: 17, fontWeight: "800", textAlign: "center" },
  backTxt:         { color: "#fff", fontSize: 14, fontWeight: "600", width: 50 },
  headerCountTxt:  { color: "rgba(255,255,255,0.85)", fontSize: 11, fontWeight: "600", width: 50, textAlign: "right" },
  overlay:   { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet:     { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: "75%" },
  sheetTall: { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: "92%" },
  sheetTitle:    { fontSize: 18, fontWeight: "800", color: "#1E293B", marginBottom: 4 },
  sheetSubtitle: { fontSize: 13, color: "#64748B", marginBottom: 16 },
  sheetActions:  { flexDirection: "row", gap: 10, marginTop: 16 },
  sheetBtn:       { flex: 1, padding: 14, borderRadius: 12, alignItems: "center" },
  sheetBtnTxt:    { color: "#fff", fontWeight: "800", fontSize: 14 },
  sheetBtnGray:    { backgroundColor: "#F1F5F9", borderWidth: 1, borderColor: "#CBD5E1" },
  sheetBtnGrayTxt: { color: "#475569", fontWeight: "700", fontSize: 14 },
  sheetBtnDowngrade:    { backgroundColor: "#FEF2F2", borderWidth: 1.5, borderColor: "#FECACA" },
  sheetBtnDowngradeTxt: { color: DANGER, fontWeight: "700", fontSize: 13 },
  sheetBtnDangerDowngrade: { backgroundColor: DANGER },
  sheetNote:    { backgroundColor: "#FFF7ED", borderRadius: 10, padding: 12, marginTop: 12 },
  sheetNoteTxt: { fontSize: 12, color: "#92400E", lineHeight: 18 },
  paketActiveCard:     { borderWidth: 2, borderRadius: 14, padding: 16, alignItems: "center", marginBottom: 16 },
  paketActiveBadge:    { borderRadius: 6, paddingHorizontal: 12, paddingVertical: 3, marginBottom: 8 },
  paketActiveBadgeTxt: { color: "#fff", fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  paketActiveName:     { fontSize: 20, fontWeight: "800" },
  paketActivePrice:    { fontSize: 14, color: "#64748B", marginTop: 4 },
  paketTrialNote:      { fontSize: 12, color: ORANGE, marginTop: 6, fontWeight: "600" },
  paketOpt:      { flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderColor: "#CBD5E1", borderRadius: 12, padding: 14, marginBottom: 8, backgroundColor: "#F8FAFC" },
  paketOptLbl:   { fontSize: 14, fontWeight: "700", color: "#374151" },
  paketOptPrice: { fontSize: 12, color: "#64748B", marginTop: 2 },
  paketOptFeatureHint: { fontSize: 10, color: "#94A3B8", marginTop: 3 },
  checkMark:     { fontSize: 20 },
  downgradeWarnBox:  { backgroundColor: "#FEF2F2", borderRadius: 12, padding: 14, marginTop: 10, borderWidth: 1, borderColor: "#FECACA" },
  downgradeWarnTitle:{ fontSize: 13, fontWeight: "800", color: "#7F1D1D", marginBottom: 8 },
  downgradeWarnRow:  { flexDirection: "row", gap: 6, marginBottom: 4, alignItems: "flex-start" },
  downgradeWarnDot:  { fontSize: 12, color: DANGER, lineHeight: 18 },
  downgradeWarnItem: { fontSize: 12, color: "#991B1B", flex: 1, lineHeight: 18 },
  downgradeWarnNote: { fontSize: 11, color: "#94A3B8", marginTop: 8, fontStyle: "italic" },
  perpanjangInfo: { backgroundColor: "#F0F9FF", borderRadius: 12, padding: 16, flexDirection: "row", gap: 12, alignItems: "flex-start", marginTop: 8 },
  perpanjangIcon: { fontSize: 28 },
  perpanjangTxt:  { flex: 1, fontSize: 13, color: "#0C4A6E", lineHeight: 20 },
  fTable:      { borderRadius: 10, overflow: "hidden", borderWidth: 1, borderColor: "#E2E8F0", marginBottom: 8 },
  fHeadRow:    { flexDirection: "row", backgroundColor: "#F8FAFC", padding: 8, borderBottomWidth: 1, borderBottomColor: "#E2E8F0" },
  fHeadLbl:    { fontSize: 11, fontWeight: "700", color: "#64748B" },
  fHead:       { fontSize: 11, fontWeight: "700", textAlign: "center" },
  fHeadActive: { fontWeight: "900", textDecorationLine: "underline" },
  fRow:        { flexDirection: "row", padding: 8, borderBottomWidth: 1, borderBottomColor: "#F1F5F9", alignItems: "center" },
  fLbl:        { fontSize: 11, color: "#374151", fontWeight: "500" },
  fVal:        { fontSize: 10, fontWeight: "700", textAlign: "center" },
  fCol0:       { flex: 2 },
  fCol1:       { flex: 1, alignItems: "center" },

  // ── Pencairan styles ──
  pencairanScroll:          { padding: 16, paddingBottom: 40 },
  pencairanBottomSpacer:    { height: 40 },
  pencairanSaldoCard:       { backgroundColor: "#0F766E", borderRadius: 16, padding: 18, marginBottom: 12, alignItems: "center" },
  pencairanSaldoLbl:        { fontSize: 12, color: "rgba(255,255,255,0.8)", marginBottom: 4 },
  pencairanSaldoVal:        { fontSize: 28, fontWeight: "800", color: "#fff" },
  pencairanSaldoSub:        { fontSize: 10, color: "rgba(255,255,255,0.65)", marginTop: 4, textAlign: "center" },
  pencairanSaldoBtnRow:     { flexDirection: "row", gap: 10, marginTop: 14, width: "100%" },
  pencairanCairBtn:         { flex: 1, backgroundColor: "#fff", borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  pencairanCairBtnDisabled: { flex: 1, backgroundColor: "rgba(255,255,255,0.3)", borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  pencairanCairBtnTxt:      { color: "#0F766E", fontWeight: "800", fontSize: 13 },
  pencairanRekeningBtn:     { backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12 },
  pencairanRekeningBtnTxt:  { color: "#fff", fontWeight: "700", fontSize: 12 },
  pencairanInfoBox:         { backgroundColor: "#F0FDFA", borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: "#99F6E4" },
  pencairanInfoTxt:         { fontSize: 12, color: "#134E4A", lineHeight: 20 },
  pencairanBankCard:        { backgroundColor: "#F0FDFA", borderRadius: 12, padding: 14, marginBottom: 10, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#99F6E4" },
  pencairanBankTitle:       { fontSize: 11, color: "#64748B", marginBottom: 4 },
  pencairanBankName:        { fontSize: 15, fontWeight: "700", color: "#1E293B" },
  pencairanBankNum:         { fontSize: 13, color: "#374151", marginTop: 2 },
  pencairanBankOwner:       { fontSize: 12, color: "#64748B", marginTop: 2 },
  pencairanBankEditBtn:     { backgroundColor: "#CCFBF1", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  pencairanBankEditTxt:     { fontSize: 12, color: "#0F766E", fontWeight: "700" },
  pencairanFormCard:        { backgroundColor: "#fff", borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#E2E8F0", elevation: 2 },
  pencairanFormTitle:       { fontSize: 15, fontWeight: "700", color: "#1E293B", marginBottom: 12 },
  pencairanFormLbl:         { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 6, marginTop: 12 },
  pencairanFormInput:       { backgroundColor: "#F8FAFC", borderRadius: 10, borderWidth: 1, borderColor: "#E2E8F0", paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: "#1E293B" },
  pencairanWarnBox:         { backgroundColor: "#FFF7ED", borderRadius: 10, padding: 12, marginTop: 12, borderWidth: 1, borderColor: "#FED7AA" },
  pencairanWarnTxt:         { fontSize: 12, color: "#92400E" },
  pencairanFormBtnRow:      { flexDirection: "row", gap: 10, marginTop: 16 },
  pencairanFormCancelBtn:   { flex: 1, backgroundColor: "#F1F5F9", borderRadius: 12, paddingVertical: 12, alignItems: "center", borderWidth: 1, borderColor: "#CBD5E1" },
  pencairanFormCancelTxt:   { color: "#475569", fontWeight: "700", fontSize: 14 },
  pencairanFormSaveBtn:     { flex: 1, backgroundColor: "#0F766E", borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  pencairanFormSaveTxt:     { color: "#fff", fontWeight: "800", fontSize: 14 },
  pencairanSaldoMini:       { backgroundColor: "#F0FDFA", borderRadius: 10, padding: 12, marginBottom: 8, alignItems: "center" },
  pencairanSaldoMiniLbl:    { fontSize: 11, color: "#64748B" },
  pencairanSaldoMiniVal:    { fontSize: 20, fontWeight: "800", color: "#0F766E" },
  pencairanBankPreview:     { backgroundColor: "#F8FAFC", borderRadius: 10, padding: 10, marginBottom: 6 },
  pencairanBankPreviewTxt:  { fontSize: 13, fontWeight: "700", color: "#1E293B" },
  pencairanBankPreviewOwner:{ fontSize: 12, color: "#64748B" },
  pencairanShortcutRow:     { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  pencairanShortcutBtn:     { backgroundColor: "#F1F5F9", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  pencairanShortcutBtnAll:  { backgroundColor: "#CCFBF1", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  pencairanShortcutTxt:     { fontSize: 12, fontWeight: "600", color: "#374151" },
  pencairanHistoryTitle:    { fontSize: 14, fontWeight: "700", color: "#1E293B", marginBottom: 8, marginTop: 4 },
  pencairanHistoryEmpty:    { paddingVertical: 30, alignItems: "center" },
  pencairanHistoryEmptyTxt: { color: "#94A3B8", fontSize: 14 },
  pencairanHistoryItem:     { backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 8, flexDirection: "row", elevation: 1, borderWidth: 1, borderColor: "#F1F5F9" },
  pencairanHistoryId:       { fontSize: 11, fontWeight: "700", color: "#475569", letterSpacing: 0.5 },
  pencairanHistoryBank:     { fontSize: 13, fontWeight: "600", color: "#1E293B", marginTop: 2 },
  pencairanHistoryOwner:    { fontSize: 11, color: "#64748B" },
  pencairanHistoryDate:     { fontSize: 10, color: "#94A3B8", marginTop: 3 },
  pencairanHistoryCatatan:  { fontSize: 11, color: DANGER, marginTop: 3 },
  pencairanHistoryRight:    { alignItems: "flex-end", justifyContent: "center", gap: 6 },
  pencairanHistoryJumlah:   { fontSize: 16, fontWeight: "800", color: "#1E293B" },
  pencairanStatusBadge:     { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  pencairanStatusTxt:       { fontSize: 10, fontWeight: "700" },
});