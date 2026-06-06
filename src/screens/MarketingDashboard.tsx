// src/screens/MarketingDashboard.tsx
// v2 — tambah tab Pencairan Komisi

import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "../context/AuthContext";
import {
  GlobalProduct,
  KOMISI_PER_PRODUK,
  useGlobalProducts,
} from "../context/GlobalProductContext";
import {
  BIAYA_LAYANAN_PER_TRANSAKSI,
  KOMISI_LAYANAN_MARKETING,
  KOMISI_RATE,
  KurirAccount,
  MARKETING_SHARE_FROM_SUB,
  MarketingAccount,
  OwnerRegistration,
  PAKET_FEATURES,
  PAKET_HARGA,
  PaketFeature,
  PaketMkt,
  SUB_MARKETING_SHARE,
  useMarketing,
} from "../context/MarketingContext";
import DemoScreen from "./DemoScreen";
import GlobalProductScreen from "./GlobalProductScreen";
import KurirRegistrationScreen from "./KurirRegistrationScreen";
import KurirVerifikasiScreen from "./KurirVerifikasiScreen";

// ─── Constants ────────────────────────────────────────────────────────────────

const PRIMARY = "#2563EB";
const ACCENT  = "#3B82F6";
const SUCCESS = "#16A34A";
const DANGER  = "#DC2626";
const ORANGE  = "#D97706";
const PURPLE  = "#7C3AED";
const GOLD    = "#B45309";
const CYAN    = "#0891B2";
const TEAL    = "#0F766E";

const KURIR_STORE_KEY = "@twd_kurir_accounts";
const MKT_BANK_PFX   = "@twd_mkt_bank_";
const MKT_WD_PFX     = "@twd_mkt_wd_";
const MIN_WD_MKT      = 50000;

const PB_STYLE = { paddingBottom: 100 } as const;
const FLEX_ONE = { flex: 1 } as const;

const PAKET_LIST: PaketMkt[] = ["basic", "pro", "enterprise"];

const PAKET_LABEL: Record<PaketMkt, string> = {
  basic:      "Basic — Rp 50.000/bln",
  pro:        "Pro — Rp 150.000/bln",
  enterprise: "Enterprise — Rp 300.000/bln",
};

const PAKET_COLOR: Record<PaketMkt, string> = {
  basic:      "#64748B",
  pro:        PRIMARY,
  enterprise: PURPLE,
};

const PAKET_DESC: Record<PaketMkt, string> = {
  basic:      "Cocok untuk usaha kecil yang baru mulai",
  pro:        "Untuk usaha berkembang dengan tim kasir",
  enterprise: "Untuk bisnis skala besar / multi cabang",
};

const JENIS_BISNIS_LIST = [
  "🏪 Warung / Kelontong", "🛒 Minimarket", "☕ Cafe / Kedai Kopi",
  "🍽️ Restoran / Rumah Makan", "✂️ Barbershop / Salon", "👕 Laundry",
  "💊 Apotek / Toko Obat", "👗 Toko Fashion", "📱 Toko Pulsa / Aksesoris",
  "🔧 Bengkel", "🎓 Bimbel / Les Privat", "🏗️ Lainnya",
];

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

type Tab = "ringkasan" | "jaringan" | "komisi" | "kurir" | "produk" | "pencairan";

const TABS: Array<{ value: Tab; icon: string; label: string }> = [
  { value: "ringkasan",  icon: "📊", label: "Ringkasan"  },
  { value: "jaringan",   icon: "🌐", label: "Jaringan"   },
  { value: "komisi",     icon: "💰", label: "Komisi"     },
  { value: "kurir",      icon: "🚚", label: "Kurir"      },
  { value: "produk",     icon: "📦", label: "Produk"     },
  { value: "pencairan",  icon: "💸", label: "Pencairan"  },
];

// ─── Helper style functions ───────────────────────────────────────────────────

const getBadgeBg  = (color: string) => [S.paketBadge, { backgroundColor: color }];
const getKurirBg  = (status: string) => {
  const bg =
    status === "available" ? SUCCESS :
    status === "busy"      ? ORANGE  : "#64748B";
  return [S.paketBadge, { backgroundColor: bg }];
};
const getBizChip  = (active: boolean) =>
  active ? [S.bizChip, S.bizChipActive] : [S.bizChip];
const getBizTxt   = (active: boolean) =>
  active ? [S.bizChipTxt, S.bizChipTxtActive] : [S.bizChipTxt];
const getPaketOpt = (active: boolean, color: string) =>
  active
    ? [S.paketOption, { borderColor: color, backgroundColor: color + "15" }]
    : [S.paketOption];
const getPaketLbl = (active: boolean, color: string) =>
  active ? [S.paketOptionLabel, { color }] : [S.paketOptionLabel];

// ─── Komponen fitur per paket ─────────────────────────────────────────────────

function FeatureValue({ value, paket }: { value: string; paket: PaketMkt }) {
  const isNo  = value === "❌";
  const color = isNo ? "#94A3B8"
    : paket === "enterprise" ? PURPLE
    : paket === "pro"        ? PRIMARY
    : SUCCESS;
  return <Text style={[S.featureVal, { color }]}>{value}</Text>;
}

function PaketFeaturesTable({ activePaket }: { activePaket: PaketMkt }) {
  return (
    <View style={S.featureTable}>
      <View style={S.featureHeaderRow}>
        <Text style={[S.featureHeaderLabel, S.featureCol0]}>Fitur</Text>
        <Text style={[S.featureHeader, S.featureCol1, { color: PAKET_COLOR.basic }]}>Basic</Text>
        <Text style={[S.featureHeader, S.featureCol1, { color: PAKET_COLOR.pro }]}>Pro</Text>
        <Text style={[S.featureHeader, S.featureCol1, { color: PAKET_COLOR.enterprise }]}>Ent.</Text>
      </View>
      {PAKET_FEATURES.map((f: PaketFeature) => (
        <View key={f.label} style={[S.featureRow, S.featureRowActive]}>
          <Text style={[S.featureLbl, S.featureCol0]} numberOfLines={2}>{f.label}</Text>
          <View style={S.featureCol1}><FeatureValue value={f.basic}      paket="basic" /></View>
          <View style={S.featureCol1}><FeatureValue value={f.pro}        paket="pro" /></View>
          <View style={S.featureCol1}><FeatureValue value={f.enterprise} paket="enterprise" /></View>
        </View>
      ))}
    </View>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface StoreKurirAccount {
  id:            string;
  ownerId:       string;
  nama:          string;
  phone:         string;
  aktif:         boolean;
  status:        "menunggu_verifikasi" | "terverifikasi" | "ditolak";
  catatanAdmin?: string;
  fotoKtp?:      string;
  fotoSelfie?:   string;
  createdAt:     string;
}

interface BankAccount {
  namaBank:      string;
  nomorRekening: string;
  namaPemilik:   string;
}

interface WithdrawalRequest {
  id:            string;
  marketingId:   string;
  jumlah:        number;
  namaBank:      string;
  nomorRekening: string;
  namaPemilik:   string;
  status:        "menunggu" | "diproses" | "selesai" | "ditolak";
  createdAt:     string;
  catatan?:      string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRpFull(n: number): string {
  return "Rp " + Math.round(n).toLocaleString("id-ID");
}

function formatOmsetShort(n: number): string {
  if (n >= 1_000_000) return "Rp " + (n / 1_000_000).toFixed(1) + "jt";
  if (n >= 1_000)     return "Rp " + (n / 1_000).toFixed(0) + "rb";
  return "Rp " + n.toLocaleString("id-ID");
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
  return "mwd-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6);
}

// ─────────────────────────────────────────────────────────────────────────────

export default function MarketingDashboard() {
  const { user, logout } = useAuth();
  const {
    ownerRegistrations,
    kurirAccounts,
    marketingAccounts,
    getSubMarketing,
    getOwnersByMarketing,
    getAllOwnersByMarketing,
    getKomisiLayananMarketing,
    addMarketing,
    registerOwnerWithTrial,
  } = useMarketing();
  const {
    getKomisiProduk,
    getProductsAddedByUser,
    updateGlobalProduct,
  } = useGlobalProducts();

  const [tab, setTab] = useState<Tab>("ringkasan");

  // Modal flags
  const [showAddSubMkt,       setShowAddSubMkt]       = useState(false);
  const [showAddOwner,        setShowAddOwner]         = useState(false);
  const [showAddKurir,        setShowAddKurir]         = useState(false);
  const [showVerifikasiKurir, setShowVerifikasiKurir]  = useState(false);
  const [showDemo,            setShowDemo]             = useState(false);
  const [showSuccessOwner,    setShowSuccessOwner]     = useState(false);
  const [showFeatures,        setShowFeatures]         = useState(false);

  // Pending kurir count
  const [pendingKurirCount, setPendingKurirCount] = useState(0);

  // Form: Sub-Marketing
  const [smNama,    setSmNama]    = useState("");
  const [smPhone,   setSmPhone]   = useState("");
  const [smPin,     setSmPin]     = useState("");
  const [smWilayah, setSmWilayah] = useState("");

  // Form: Owner
  const [owNama,   setOwNama]   = useState("");
  const [owToko,   setOwToko]   = useState("");
  const [owPhone,  setOwPhone]  = useState("");
  const [owPaket,  setOwPaket]  = useState<PaketMkt>("basic");
  const [owBisnis, setOwBisnis] = useState("");
  const [owAlamat, setOwAlamat] = useState("");
  const [lastRegistered, setLastRegistered] = useState<OwnerRegistration | null>(null);

  // Assign produk
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [selectedProduct,    setSelectedProduct]    = useState<GlobalProduct | null>(null);

  // ── Pencairan state ──
  const [bankAccount,  setBankAccount]  = useState<BankAccount | null>(null);
  const [withdrawals,  setWithdrawals]  = useState<WithdrawalRequest[]>([]);
  const [saldoKomisi,  setSaldoKomisi]  = useState(0);
  const [showBankForm, setShowBankForm] = useState(false);
  const [bankInput,    setBankInput]    = useState<BankAccount>({ namaBank: "", nomorRekening: "", namaPemilik: "" });
  const [wdJumlah,     setWdJumlah]    = useState("");
  const [showWdForm,   setShowWdForm]  = useState(false);

  const myId   = user?.id   ?? "";
  const myName = user?.name ?? "";

  // Computed
  const myOwners        = useMemo(() => getOwnersByMarketing(myId),   [ownerRegistrations, myId]);
  const mySubMarketings = useMemo(() => getSubMarketing(myId),        [marketingAccounts,  myId]);
  const allMyOwners     = useMemo(() => getAllOwnersByMarketing(myId), [ownerRegistrations, myId]);
  const myProdukList    = useMemo(() => getProductsAddedByUser(myId), [myId]);

  const komisiLangganan = useMemo(() =>
    myOwners.reduce((sum: number, o: OwnerRegistration) =>
      sum + (PAKET_HARGA[o.paket] ?? 50_000) * KOMISI_RATE, 0),
    [myOwners],
  );

  const komisiDariSubOwner = useMemo(() => {
    let total = 0;
    mySubMarketings.forEach((sm: MarketingAccount) => {
      ownerRegistrations
        .filter((o: OwnerRegistration) => o.recruitedBy === sm.id)
        .forEach((o: OwnerRegistration) => {
          total += (PAKET_HARGA[o.paket] ?? 50_000) * SUB_MARKETING_SHARE * MARKETING_SHARE_FROM_SUB;
        });
    });
    return total;
  }, [mySubMarketings, ownerRegistrations]);

  const totalTrxSemua = allMyOwners.reduce(
    (s: number, o: OwnerRegistration) => s + (o.totalTransaksi ?? 0), 0,
  );

  const komisiLayanan = getKomisiLayananMarketing(myId);
  const komisiProduk  = getKomisiProduk(myId);
  const myProdukCount = myProdukList.length;
  const totalKomisi   = komisiLangganan + komisiDariSubOwner + komisiLayanan + komisiProduk;

  // ── Load pending kurir ──
  const loadPendingKurir = async () => {
    try {
      const raw = await AsyncStorage.getItem(KURIR_STORE_KEY);
      const all: StoreKurirAccount[] = raw ? JSON.parse(raw) : [];
      setPendingKurirCount(all.filter(k => k.status === "menunggu_verifikasi").length);
    } catch { /* ignore */ }
  };

  const handleTabKurir = () => {
    setTab("kurir");
    loadPendingKurir();
  };

  // ── Load pencairan ──
  const loadPencairan = useCallback(async () => {
    try {
      const rawWd = await AsyncStorage.getItem(MKT_WD_PFX + myId);
      const allWd: WithdrawalRequest[] = rawWd ? JSON.parse(rawWd) : [];
      setWithdrawals(allWd.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));

      const totalCair    = allWd.filter((w) => w.status === "selesai").reduce((s, w) => s + w.jumlah, 0);
      const totalPending = allWd.filter((w) => w.status === "menunggu" || w.status === "diproses").reduce((s, w) => s + w.jumlah, 0);
      setSaldoKomisi(Math.max(0, totalKomisi - totalCair - totalPending));

      const rawBank = await AsyncStorage.getItem(MKT_BANK_PFX + myId);
      setBankAccount(rawBank ? JSON.parse(rawBank) : null);
    } catch (e) { console.error("loadPencairan mkt error:", e); }
  }, [myId, totalKomisi]);

  useEffect(() => {
    if (tab === "pencairan") loadPencairan();
  }, [tab, loadPencairan]);

  // ── Simpan rekening ──
  const handleSaveBank = async () => {
    if (!bankInput.namaBank.trim() || !bankInput.nomorRekening.trim() || !bankInput.namaPemilik.trim()) {
      Alert.alert("Lengkapi Data", "Semua field rekening harus diisi."); return;
    }
    try {
      await AsyncStorage.setItem(MKT_BANK_PFX + myId, JSON.stringify(bankInput));
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
    if (!jumlah || jumlah < MIN_WD_MKT) {
      Alert.alert("Jumlah Kurang", "Minimum pencairan " + formatRpFull(MIN_WD_MKT)); return;
    }
    if (jumlah > saldoKomisi) {
      Alert.alert("Saldo Tidak Cukup", "Saldo tersedia: " + formatRpFull(saldoKomisi)); return;
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
                id: genWdId(), marketingId: myId, jumlah,
                namaBank: bankAccount.namaBank,
                nomorRekening: bankAccount.nomorRekening,
                namaPemilik: bankAccount.namaPemilik,
                status: "menunggu",
                createdAt: new Date().toISOString(),
              };
              const rawWd = await AsyncStorage.getItem(MKT_WD_PFX + myId);
              const allWd: WithdrawalRequest[] = rawWd ? JSON.parse(rawWd) : [];
              await AsyncStorage.setItem(MKT_WD_PFX + myId, JSON.stringify([wd, ...allWd]));
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

  // Reset forms
  const resetSmForm = () => {
    setSmNama(""); setSmPhone(""); setSmPin(""); setSmWilayah("");
  };
  const resetOwnerForm = () => {
    setOwNama(""); setOwToko(""); setOwPhone("");
    setOwPaket("basic"); setOwBisnis(""); setOwAlamat("");
  };

  const handleSaveSubMkt = () => {
    if (!smNama.trim())   { Alert.alert("Error", "Nama wajib diisi.");    return; }
    if (!smPhone.trim())  { Alert.alert("Error", "No. HP wajib diisi.");  return; }
    if (smPin.length < 4) { Alert.alert("Error", "PIN minimal 4 digit."); return; }
    addMarketing({
      name: smNama.trim(), phone: smPhone.trim(), pin: smPin,
      role: "sub_marketing", uplineId: myId, wilayah: smWilayah.trim(),
    });
    resetSmForm();
    setShowAddSubMkt(false);
    Alert.alert("Berhasil", smNama.trim() + " telah didaftarkan sebagai Sub Marketing.");
  };

  const handleSaveOwner = () => {
    if (!owNama.trim())  { Alert.alert("Error", "Nama pemilik wajib diisi."); return; }
    if (!owToko.trim())  { Alert.alert("Error", "Nama toko wajib diisi.");    return; }
    if (!owPhone.trim()) { Alert.alert("Error", "No. HP wajib diisi.");       return; }
    if (!owBisnis)       { Alert.alert("Error", "Pilih jenis bisnis.");       return; }
    const result = registerOwnerWithTrial({
      name: owNama.trim(), tokoName: owToko.trim(), phone: owPhone.trim(),
      paket: owPaket, alamat: owAlamat.trim(), jenisBisnis: owBisnis,
      recruitedBy: myId, recruitedByRole: "marketing",
    });
    setLastRegistered(result);
    resetOwnerForm();
    setShowAddOwner(false);
    setShowSuccessOwner(true);
  };

  const handleOpenAssign = (product: GlobalProduct) => {
    setSelectedProduct(product);
    setAssignModalVisible(true);
  };

  const handleAssignOwner = (owner: OwnerRegistration) => {
    if (!selectedProduct) return;
    updateGlobalProduct(selectedProduct.id, { ownerId: owner.id });
    setAssignModalVisible(false);
    setSelectedProduct(null);
    Alert.alert("Berhasil", "Produk \"" + selectedProduct.name + "\" -> " + owner.tokoName);
  };

  const handleRemoveOwner = () => {
    if (!selectedProduct) return;
    updateGlobalProduct(selectedProduct.id, { ownerId: undefined });
    setAssignModalVisible(false);
    setSelectedProduct(null);
  };

  // ══════════════════════════════════════════════════════════════════════════

  const renderRingkasan = () => (
    <ScrollView style={S.tabContent} contentContainerStyle={PB_STYLE}>
      <View style={S.heroCard}>
        <Text style={S.heroGreet}>Halo, {myName}</Text>
        <Text style={S.heroRole}>Marketing</Text>
        <Text style={S.heroId}>ID: {myId}</Text>
      </View>
      <View style={S.statsRow}>
        <View style={[S.statCard, S.statBorderBlue]}>
          <Text style={S.statNum}>{myOwners.length}</Text>
          <Text style={S.statLbl}>Owner Langsung</Text>
        </View>
        <View style={[S.statCard, S.statBorderAccent]}>
          <Text style={S.statNum}>{mySubMarketings.length}</Text>
          <Text style={S.statLbl}>Sub Marketing</Text>
        </View>
        <View style={[S.statCard, S.statBorderOrange]}>
          <Text style={S.statNum}>{totalTrxSemua.toLocaleString()}</Text>
          <Text style={S.statLbl}>Total Transaksi</Text>
        </View>
      </View>
      <View style={S.sectionCard}>
        <Text style={S.sectionTitle}>Estimasi Komisi Bulan Ini</Text>
        <View style={S.komisiRow}>
          <Text style={S.komisiLabel}>Langganan Owner (20%)</Text>
          <Text style={S.komisiVal}>Rp {komisiLangganan.toLocaleString()}</Text>
        </View>
        <View style={S.komisiRow}>
          <Text style={S.komisiLabel}>Dari Sub Marketing (30%)</Text>
          <Text style={S.komisiVal}>Rp {komisiDariSubOwner.toLocaleString()}</Text>
        </View>
        <View style={S.komisiRow}>
          <Text style={S.komisiLabel}>
            {"Biaya Layanan 3% (" + totalTrxSemua + " trx x Rp 1.000)"}
          </Text>
          <Text style={S.komisiVal}>Rp {komisiLayanan.toLocaleString()}</Text>
        </View>
        <View style={S.komisiRow}>
          <Text style={S.komisiLabel}>
            {"Produk Global (" + myProdukCount + " x Rp " + KOMISI_PER_PRODUK.toLocaleString() + ")"}
          </Text>
          <Text style={S.komisiVal}>Rp {komisiProduk.toLocaleString()}</Text>
        </View>
        <View style={[S.komisiRow, S.komisiTotalRow]}>
          <Text style={S.komisiTotalLbl}>TOTAL</Text>
          <Text style={S.komisiTotalVal}>Rp {totalKomisi.toLocaleString()}</Text>
        </View>
      </View>
      <TouchableOpacity
        style={S.pencairanQuickBtn}
        onPress={() => setTab("pencairan")}
      >
        <Text style={S.pencairanQuickTxt}>{"💸 Cairkan Komisi Saya →"}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={S.viewPaketBtn} onPress={() => setShowFeatures(true)}>
        <Text style={S.viewPaketTxt}>Lihat Perbandingan Paket Langganan</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={S.logoutBtn}
        onPress={() =>
          Alert.alert("Logout", "Yakin logout?", [
            { text: "Batal",  style: "cancel" },
            { text: "Logout", style: "destructive", onPress: logout },
          ])
        }
      >
        <Text style={S.logoutTxt}>Logout</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderJaringan = () => (
    <ScrollView style={S.tabContent} contentContainerStyle={PB_STYLE}>
      <View style={S.actionHeader}>
        <Text style={S.sectionHeader}>{"Owner Saya (" + myOwners.length + ")"}</Text>
        <TouchableOpacity style={[S.addBtn, S.addBtnBlue]} onPress={() => setShowAddOwner(true)}>
          <Text style={S.addBtnTxt}>+ Daftarkan Owner</Text>
        </TouchableOpacity>
      </View>
      {myOwners.length === 0 ? (
        <Text style={S.emptyTxt}>Belum ada owner. Tap "Daftarkan Owner" untuk mulai.</Text>
      ) : (
        myOwners.map((o: OwnerRegistration) => {
          const daysLeft = o.trialEndDate
            ? Math.max(0, Math.ceil(
                (new Date(o.trialEndDate).getTime() - Date.now()) / 86_400_000,
              ))
            : -1;
          return (
            <View key={o.id} style={S.memberCard}>
              <View style={FLEX_ONE}>
                <Text style={S.memberName}>{o.tokoName}</Text>
                <Text style={S.memberSub}>{o.name}  |  {o.phone}</Text>
                <Text style={S.memberSub}>
                  {"Transaksi: " + (o.totalTransaksi ?? 0) + "x  |  Kode: " + o.kodeToken}
                </Text>
                {o.jenisBisnis ? <Text style={S.memberSub}>{"Bisnis: " + o.jenisBisnis}</Text> : null}
              </View>
              <View style={S.memberBadgeCol}>
                <View style={getBadgeBg(PAKET_COLOR[o.paket])}>
                  <Text style={S.paketTxt}>{o.paket.toUpperCase()}</Text>
                </View>
                {daysLeft > 0 && (
                  <View style={S.trialBadge}>
                    <Text style={S.trialTxt}>{daysLeft + "h trial"}</Text>
                  </View>
                )}
                {daysLeft === 0 && (
                  <View style={S.trialBadgeExpired}>
                    <Text style={S.trialTxtExpired}>Trial habis</Text>
                  </View>
                )}
              </View>
            </View>
          );
        })
      )}
      <View style={S.divider} />
      <View style={S.actionHeader}>
        <Text style={S.sectionHeader}>{"Sub Marketing (" + mySubMarketings.length + ")"}</Text>
        <TouchableOpacity style={[S.addBtn, S.addBtnPurple]} onPress={() => setShowAddSubMkt(true)}>
          <Text style={S.addBtnTxt}>+ Tambah Sub Mkt</Text>
        </TouchableOpacity>
      </View>
      {mySubMarketings.length === 0 ? (
        <Text style={S.emptyTxt}>Belum ada sub marketing.</Text>
      ) : (
        mySubMarketings.map((sm: MarketingAccount) => {
          const smOwners = ownerRegistrations.filter(
            (o: OwnerRegistration) => o.recruitedBy === sm.id,
          );
          return (
            <View key={sm.id} style={S.memberCard}>
              <View style={FLEX_ONE}>
                <Text style={S.memberName}>{sm.name}</Text>
                <Text style={S.memberSub}>{sm.phone + "  |  " + smOwners.length + " owner"}</Text>
                {sm.wilayah ? <Text style={S.memberSub}>{"Wilayah: " + sm.wilayah}</Text> : null}
              </View>
              <View style={getBadgeBg(PURPLE)}>
                <Text style={S.paketTxt}>SUB MKT</Text>
              </View>
            </View>
          );
        })
      )}
    </ScrollView>
  );

  const renderKomisi = () => (
    <ScrollView style={S.tabContent} contentContainerStyle={PB_STYLE}>
      <Text style={S.sectionHeader}>Detail Komisi</Text>
      <View style={S.sectionCard}>
        <Text style={S.sectionTitle}>Komisi Langganan Owner (20%)</Text>
        {myOwners.length === 0 ? (
          <Text style={S.emptyTxt}>Belum ada owner.</Text>
        ) : (
          myOwners.map((o: OwnerRegistration) => (
            <View key={o.id} style={S.komisiRow}>
              <Text style={S.komisiLabel}>{o.tokoName + " (" + o.paket + ")"}</Text>
              <Text style={S.komisiVal}>
                {"Rp " + ((PAKET_HARGA[o.paket] ?? 50_000) * KOMISI_RATE).toLocaleString()}
              </Text>
            </View>
          ))
        )}
      </View>
      <View style={S.sectionCard}>
        <Text style={S.sectionTitle}>Komisi dari Sub Marketing (30%)</Text>
        {mySubMarketings.length === 0 ? (
          <Text style={S.emptyTxt}>Belum ada sub marketing.</Text>
        ) : (
          mySubMarketings.map((sm: MarketingAccount) => {
            const smOwners = ownerRegistrations.filter(
              (o: OwnerRegistration) => o.recruitedBy === sm.id,
            );
            const smKom = smOwners.reduce((s: number, o: OwnerRegistration) =>
              s + (PAKET_HARGA[o.paket] ?? 50_000) * SUB_MARKETING_SHARE * MARKETING_SHARE_FROM_SUB,
              0,
            );
            return (
              <View key={sm.id} style={S.komisiRow}>
                <Text style={S.komisiLabel}>{sm.name + " (" + smOwners.length + " owner)"}</Text>
                <Text style={S.komisiVal}>{"Rp " + smKom.toLocaleString()}</Text>
              </View>
            );
          })
        )}
      </View>
      <View style={S.sectionCard}>
        <Text style={S.sectionTitle}>Komisi Biaya Layanan (3%)</Text>
        <Text style={S.infoSmall}>Rp 1.000/transaksi - Marketing dapat 3% = Rp 30/transaksi</Text>
        {allMyOwners.map((o: OwnerRegistration) => {
          const trx = o.totalTransaksi ?? 0;
          const kom = trx * BIAYA_LAYANAN_PER_TRANSAKSI * KOMISI_LAYANAN_MARKETING;
          return (
            <View key={o.id} style={S.komisiRow}>
              <Text style={S.komisiLabel}>{o.tokoName + " (" + trx + " trx)"}</Text>
              <Text style={S.komisiVal}>{"Rp " + kom.toLocaleString()}</Text>
            </View>
          );
        })}
        <View style={S.komisiRow}>
          <Text style={S.komisiLabelBold}>Total</Text>
          <Text style={S.komisiVal}>{"Rp " + komisiLayanan.toLocaleString()}</Text>
        </View>
      </View>
      <View style={S.sectionCard}>
        <Text style={S.sectionTitle}>Komisi Produk Global</Text>
        <View style={S.komisiRow}>
          <Text style={S.komisiLabel}>
            {myProdukCount + " produk x Rp " + KOMISI_PER_PRODUK.toLocaleString()}
          </Text>
          <Text style={S.komisiVal}>{"Rp " + komisiProduk.toLocaleString()}</Text>
        </View>
      </View>
      <View style={[S.sectionCard, S.totalCard]}>
        <View style={S.komisiRow}>
          <Text style={S.komisiTotalLbl}>TOTAL KOMISI</Text>
          <Text style={S.komisiTotalVal}>{"Rp " + totalKomisi.toLocaleString()}</Text>
        </View>
      </View>
      <TouchableOpacity
        style={S.pencairanQuickBtn}
        onPress={() => setTab("pencairan")}
      >
        <Text style={S.pencairanQuickTxt}>{"💸 Cairkan Komisi Saya →"}</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderKurir = () => (
    <ScrollView style={S.tabContent} contentContainerStyle={PB_STYLE}>
      <View style={S.kurirActionRow}>
        <TouchableOpacity
          style={[S.kurirActionBtn, S.kurirActionBtnBlue]}
          onPress={() => setShowAddKurir(true)}
        >
          <Text style={S.kurirActionTxt}>🛵 Daftarkan Kurir</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[S.kurirActionBtn, S.kurirActionBtnYellow]}
          onPress={() => setShowDemo(true)}
        >
          <Text style={S.kurirActionTxt}>🎬 Demo Owner</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        style={S.verifikasiBanner}
        onPress={() => { loadPendingKurir(); setShowVerifikasiKurir(true); }}
      >
        <View style={S.verifikasiLeft}>
          <Text style={S.verifikasiIcon}>🔍</Text>
          <View style={FLEX_ONE}>
            <Text style={S.verifikasiTitle}>Verifikasi Kurir Owner</Text>
            <Text style={S.verifikasiSub}>
              Review dokumen KTP & selfie kurir yang didaftarkan owner
            </Text>
          </View>
        </View>
        <View style={S.verifikasiRight}>
          {pendingKurirCount > 0 && (
            <View style={S.pendingBadge}>
              <Text style={S.pendingBadgeTxt}>{pendingKurirCount}</Text>
            </View>
          )}
          <Text style={S.verifikasiArrow}>›</Text>
        </View>
      </TouchableOpacity>
      <Text style={S.sectionHeader}>{"Kurir Jaringan Marketing (" + kurirAccounts.length + ")"}</Text>
      {kurirAccounts.length === 0 ? (
        <Text style={S.emptyTxt}>Belum ada kurir di jaringan marketing.</Text>
      ) : (
        kurirAccounts.map((k: KurirAccount) => (
          <View key={k.id} style={S.memberCard}>
            <View style={FLEX_ONE}>
              <Text style={S.memberName}>{k.name}</Text>
              <Text style={S.memberSub}>{k.phone + "  |  " + k.wilayah}</Text>
            </View>
            <View style={getKurirBg(k.status)}>
              <Text style={S.paketTxt}>{k.status.toUpperCase()}</Text>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );

  const renderProduk = () => (
    <View style={FLEX_ONE}>
      {myProdukList.length > 0 && (
        <View style={S.assignBanner}>
          <Text style={S.assignBannerTxt}>Tap chip produk untuk assign ke owner</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={S.assignChipRow}
          >
            {myProdukList.map((p: GlobalProduct) => {
              const ownerName = myOwners.find(
                (o: OwnerRegistration) => o.id === p.ownerId,
              )?.tokoName;
              return (
                <TouchableOpacity
                  key={p.id}
                  style={p.ownerId ? [S.assignChip, S.assignChipDone] : [S.assignChip, S.assignChipEmpty]}
                  onPress={() => handleOpenAssign(p)}
                >
                  <Text style={S.assignChipName} numberOfLines={1}>{p.name}</Text>
                  <Text style={S.assignChipOwner}>
                    {ownerName ? "Assigned: " + ownerName : "Belum assign"}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}
      <GlobalProductScreen
        accentColor={PRIMARY}
        addedBy={myId}
        addedByName={myName}
      />
      <Modal
        visible={assignModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAssignModalVisible(false)}
      >
        <Pressable style={S.modalOverlay} onPress={() => setAssignModalVisible(false)}>
          <Pressable style={S.modalSheet} onPress={() => {}}>
            <Text style={S.modalTitle}>Assign Owner ke Produk</Text>
            {selectedProduct && (
              <Text style={S.modalSubtitle}>{"Produk: " + selectedProduct.name}</Text>
            )}
            {myOwners.length === 0 ? (
              <Text style={S.emptyTxt}>Belum ada owner.</Text>
            ) : (
              <FlatList
                data={myOwners}
                keyExtractor={(o: OwnerRegistration) => o.id}
                style={S.modalList}
                renderItem={({ item: o }: { item: OwnerRegistration }) => {
                  const isSelected = selectedProduct?.ownerId === o.id;
                  return (
                    <TouchableOpacity
                      style={isSelected ? [S.ownerItem, S.ownerItemSelected] : [S.ownerItem]}
                      onPress={() => handleAssignOwner(o)}
                    >
                      <View style={FLEX_ONE}>
                        <Text style={S.ownerItemName}>{o.tokoName}</Text>
                        <Text style={S.ownerItemSub}>{o.name + "  |  " + o.paket.toUpperCase()}</Text>
                      </View>
                      {isSelected && <Text>{"✅"}</Text>}
                    </TouchableOpacity>
                  );
                }}
              />
            )}
            {selectedProduct?.ownerId && (
              <TouchableOpacity style={S.removeOwnerBtn} onPress={handleRemoveOwner}>
                <Text style={S.removeOwnerTxt}>Hapus Assignment</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={S.modalCancelBtn} onPress={() => setAssignModalVisible(false)}>
              <Text style={S.modalCancelTxt}>Batal</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );

  // ── Render tab Pencairan ──
  const renderPencairan = () => (
    <ScrollView style={S.tabContent} contentContainerStyle={PB_STYLE}>

      {/* Saldo card */}
      <View style={S.pcSaldoCard}>
        <Text style={S.pcSaldoLbl}>{"Saldo Komisi Bisa Dicairkan"}</Text>
        <Text style={S.pcSaldoVal}>{formatRpFull(saldoKomisi)}</Text>
        <Text style={S.pcSaldoSub}>
          {"Dari total komisi bulan ini · Min. pencairan " + formatRpFull(MIN_WD_MKT)}
        </Text>
        <View style={S.pcSaldoBtnRow}>
          <TouchableOpacity
            style={saldoKomisi >= MIN_WD_MKT && bankAccount ? S.pcCairBtn : S.pcCairBtnDisabled}
            onPress={() => { setShowWdForm(true); setShowBankForm(false); }}
            disabled={saldoKomisi < MIN_WD_MKT || !bankAccount}
          >
            <Text style={S.pcCairBtnTxt}>
              {!bankAccount
                ? "⚠️ Atur Rekening Dulu"
                : saldoKomisi < MIN_WD_MKT
                ? "Saldo Belum Cukup"
                : "💸 Cairkan"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={S.pcRekeningBtn}
            onPress={() => {
              if (bankAccount) setBankInput({ ...bankAccount });
              setShowBankForm(true);
              setShowWdForm(false);
            }}
          >
            <Text style={S.pcRekeningBtnTxt}>{bankAccount ? "🏦 Edit Rekening" : "🏦 + Rekening"}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Ringkasan komisi */}
      <View style={S.pcKomisiBox}>
        <Text style={S.pcKomisiTitle}>{"📊 Rincian Komisi"}</Text>
        <View style={S.pcKomisiRow}>
          <Text style={S.pcKomisiLbl}>{"Langganan Owner"}</Text>
          <Text style={S.pcKomisiVal}>{formatOmsetShort(komisiLangganan)}</Text>
        </View>
        <View style={S.pcKomisiRow}>
          <Text style={S.pcKomisiLbl}>{"Dari Sub Marketing"}</Text>
          <Text style={S.pcKomisiVal}>{formatOmsetShort(komisiDariSubOwner)}</Text>
        </View>
        <View style={S.pcKomisiRow}>
          <Text style={S.pcKomisiLbl}>{"Biaya Layanan"}</Text>
          <Text style={S.pcKomisiVal}>{formatOmsetShort(komisiLayanan)}</Text>
        </View>
        <View style={S.pcKomisiRow}>
          <Text style={S.pcKomisiLbl}>{"Produk Global"}</Text>
          <Text style={S.pcKomisiVal}>{formatOmsetShort(komisiProduk)}</Text>
        </View>
        <View style={[S.pcKomisiRow, S.pcKomisiTotalRow]}>
          <Text style={S.pcKomisiTotalLbl}>{"Total Komisi"}</Text>
          <Text style={S.pcKomisiTotalVal}>{formatRpFull(totalKomisi)}</Text>
        </View>
      </View>

      {/* Info */}
      <View style={S.pcInfoBox}>
        <Text style={S.pcInfoTxt}>
          {"• Minimum pencairan: " + formatRpFull(MIN_WD_MKT) +
            "\n• Proses transfer 1×24 jam kerja" +
            "\n• Biaya transfer ditanggung sistem" +
            "\n• Saldo dikurangi pencairan yang sedang diproses"}
        </Text>
      </View>

      {/* Rekening tersimpan */}
      {bankAccount && !showBankForm && (
        <View style={S.pcBankCard}>
          <View style={FLEX_ONE}>
            <Text style={S.pcBankTitle}>{"🏦 Rekening Tujuan"}</Text>
            <Text style={S.pcBankName}>{bankAccount.namaBank}</Text>
            <Text style={S.pcBankNum}>{bankAccount.nomorRekening}</Text>
            <Text style={S.pcBankOwner}>{"a.n. " + bankAccount.namaPemilik}</Text>
          </View>
          <TouchableOpacity
            style={S.pcBankEditBtn}
            onPress={() => { setBankInput({ ...bankAccount }); setShowBankForm(true); }}
          >
            <Text style={S.pcBankEditTxt}>{"✏️ Edit"}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Form Rekening */}
      {showBankForm && (
        <View style={S.pcFormCard}>
          <Text style={S.pcFormTitle}>{"🏦 " + (bankAccount ? "Edit" : "Tambah") + " Rekening Bank"}</Text>
          <Text style={S.pcFormLbl}>{"Nama Bank"}</Text>
          <TextInput
            style={S.pcFormInput}
            value={bankInput.namaBank}
            onChangeText={(v) => setBankInput((p) => ({ ...p, namaBank: v }))}
            placeholder="BCA, BRI, BNI, Mandiri, dll"
            placeholderTextColor="#94A3B8"
            autoCapitalize="characters"
          />
          <Text style={S.pcFormLbl}>{"Nomor Rekening"}</Text>
          <TextInput
            style={S.pcFormInput}
            value={bankInput.nomorRekening}
            onChangeText={(v) => setBankInput((p) => ({ ...p, nomorRekening: v }))}
            placeholder="1234567890"
            placeholderTextColor="#94A3B8"
            keyboardType="numeric"
          />
          <Text style={S.pcFormLbl}>{"Nama Pemilik Rekening"}</Text>
          <TextInput
            style={S.pcFormInput}
            value={bankInput.namaPemilik}
            onChangeText={(v) => setBankInput((p) => ({ ...p, namaPemilik: v }))}
            placeholder="Sesuai buku tabungan"
            placeholderTextColor="#94A3B8"
            autoCapitalize="words"
          />
          <View style={S.pcWarnBox}>
            <Text style={S.pcWarnTxt}>{"⚠️ Pastikan data rekening benar. Dana salah kirim tidak dapat dikembalikan."}</Text>
          </View>
          <View style={S.pcFormBtnRow}>
            <TouchableOpacity style={S.pcFormCancelBtn} onPress={() => setShowBankForm(false)}>
              <Text style={S.pcFormCancelTxt}>{"Batal"}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={S.pcFormSaveBtn} onPress={handleSaveBank}>
              <Text style={S.pcFormSaveTxt}>{"💾 Simpan"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Form Pencairan */}
      {showWdForm && (
        <View style={S.pcFormCard}>
          <Text style={S.pcFormTitle}>{"💸 Jumlah Pencairan"}</Text>
          <View style={S.pcSaldoMini}>
            <Text style={S.pcSaldoMiniLbl}>{"Saldo tersedia"}</Text>
            <Text style={S.pcSaldoMiniVal}>{formatRpFull(saldoKomisi)}</Text>
          </View>
          {bankAccount && (
            <View style={S.pcBankPreview}>
              <Text style={S.pcBankPreviewTxt}>
                {"🏦 " + bankAccount.namaBank + " · " + bankAccount.nomorRekening}
              </Text>
              <Text style={S.pcBankPreviewOwner}>{"a.n. " + bankAccount.namaPemilik}</Text>
            </View>
          )}
          <Text style={S.pcFormLbl}>{"Jumlah (min. " + formatRpFull(MIN_WD_MKT) + ")"}</Text>
          <TextInput
            style={S.pcFormInput}
            value={wdJumlah}
            onChangeText={setWdJumlah}
            placeholder={formatRpFull(MIN_WD_MKT)}
            placeholderTextColor="#94A3B8"
            keyboardType="numeric"
          />
          <View style={S.pcShortcutRow}>
            {[50000, 100000, 250000, 500000, 1000000]
              .filter((v) => v <= saldoKomisi)
              .map((v) => (
                <TouchableOpacity key={v} style={S.pcShortcutBtn} onPress={() => setWdJumlah(String(v))}>
                  <Text style={S.pcShortcutTxt}>{formatOmsetShort(v)}</Text>
                </TouchableOpacity>
              ))}
            {saldoKomisi >= MIN_WD_MKT && (
              <TouchableOpacity
                style={S.pcShortcutBtnAll}
                onPress={() => setWdJumlah(String(Math.floor(saldoKomisi)))}
              >
                <Text style={S.pcShortcutTxt}>{"Semua"}</Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={S.pcWarnBox}>
            <Text style={S.pcWarnTxt}>{"⏰ Proses transfer 1×24 jam kerja. Biaya transfer ditanggung sistem."}</Text>
          </View>
          <View style={S.pcFormBtnRow}>
            <TouchableOpacity style={S.pcFormCancelBtn} onPress={() => setShowWdForm(false)}>
              <Text style={S.pcFormCancelTxt}>{"Batal"}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={S.pcFormSaveBtn} onPress={handleRequestWithdraw}>
              <Text style={S.pcFormSaveTxt}>{"💸 Ajukan"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Riwayat */}
      <Text style={S.pcHistoryTitle}>{"Riwayat Pencairan"}</Text>
      {withdrawals.length === 0 ? (
        <View style={S.pcHistoryEmpty}>
          <Text style={S.pcHistoryEmptyTxt}>{"Belum ada riwayat pencairan."}</Text>
        </View>
      ) : (
        withdrawals.map((wd) => (
          <View key={wd.id} style={S.pcHistoryItem}>
            <View style={FLEX_ONE}>
              <Text style={S.pcHistoryId}>{"#" + wd.id.slice(-8).toUpperCase()}</Text>
              <Text style={S.pcHistoryBank}>{wd.namaBank + " · " + wd.nomorRekening}</Text>
              <Text style={S.pcHistoryOwner}>{"a.n. " + wd.namaPemilik}</Text>
              <Text style={S.pcHistoryDate}>{formatDateWd(wd.createdAt)}</Text>
              {wd.catatan ? <Text style={S.pcHistoryCatatan}>{wd.catatan}</Text> : null}
            </View>
            <View style={S.pcHistoryRight}>
              <Text style={S.pcHistoryJumlah}>{formatRpFull(wd.jumlah)}</Text>
              <View style={[S.pcStatusBadge, { backgroundColor: (WD_STATUS_COLOR[wd.status] ?? "#64748B") + "22" }]}>
                <Text style={[S.pcStatusTxt, { color: WD_STATUS_COLOR[wd.status] ?? "#64748B" }]}>
                  {WD_STATUS_LABEL[wd.status] ?? wd.status}
                </Text>
              </View>
            </View>
          </View>
        ))
      )}

      <View style={S.pcBottomSpacer} />
    </ScrollView>
  );

  const renderTab = () => {
    switch (tab) {
      case "ringkasan":  return renderRingkasan();
      case "jaringan":   return renderJaringan();
      case "komisi":     return renderKomisi();
      case "kurir":      return renderKurir();
      case "produk":     return renderProduk();
      case "pencairan":  return renderPencairan();
    }
  };

  // ════════════════════════════════════════════════════════════════════════════

  return (
    <View style={S.root}>
      <View style={S.header}>
        <Text style={S.headerTitle}>Marketing Dashboard</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={S.tabScroll}
        contentContainerStyle={S.tabBar}
      >
        {TABS.map(t => (
          <TouchableOpacity
            key={t.value}
            style={tab === t.value ? [S.tabItem, S.tabItemActive] : [S.tabItem]}
            onPress={() => t.value === "kurir" ? handleTabKurir() : setTab(t.value)}
          >
            <View style={S.tabInner}>
              <Text style={tab === t.value ? [S.tabTxt, S.tabTxtActive] : [S.tabTxt]}>
                {t.icon + " " + t.label}
              </Text>
              {t.value === "kurir" && pendingKurirCount > 0 && (
                <View style={S.tabBadge}>
                  <Text style={S.tabBadgeTxt}>{pendingKurirCount}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <View style={FLEX_ONE}>{renderTab()}</View>

      {/* ════ Modal: Perbandingan Paket ════ */}
      <Modal
        visible={showFeatures}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFeatures(false)}
      >
        <Pressable style={S.modalOverlay} onPress={() => setShowFeatures(false)}>
          <Pressable style={[S.modalSheet, S.modalSheetTall]} onPress={() => {}}>
            <Text style={S.modalTitle}>Perbandingan Paket Langganan</Text>
            <Text style={S.modalSubtitle}>Pilih paket terbaik untuk calon owner</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={S.paketSummaryRow}>
                {PAKET_LIST.map(p => (
                  <View key={p} style={[S.paketSummaryCard, { borderColor: PAKET_COLOR[p] }]}>
                    <Text style={[S.paketSummaryName, { color: PAKET_COLOR[p] }]}>
                      {p.toUpperCase()}
                    </Text>
                    <Text style={S.paketSummaryPrice}>
                      {"Rp " + (PAKET_HARGA[p] / 1000).toFixed(0) + "rb/bln"}
                    </Text>
                    <Text style={S.paketSummaryDesc}>{PAKET_DESC[p]}</Text>
                  </View>
                ))}
              </View>
              <PaketFeaturesTable activePaket="basic" />
            </ScrollView>
            <TouchableOpacity
              style={[S.modalBtnSave, S.modalBtnBlue, S.modalCloseFull]}
              onPress={() => setShowFeatures(false)}
            >
              <Text style={S.modalBtnSaveTxt}>Tutup</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ════ Modal: Tambah Sub-Marketing ════ */}
      <Modal
        visible={showAddSubMkt}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddSubMkt(false)}
      >
        <KeyboardAvoidingView
          style={S.kvContainer}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <Pressable style={FLEX_ONE} onPress={() => setShowAddSubMkt(false)} />
          <View style={S.modalSheet}>
            <Text style={S.modalTitle}>Tambah Sub-Marketing</Text>
            <Text style={S.modalSubtitle}>{"Upline: " + myName}</Text>
            <Text style={S.formLabel}>Nama Lengkap *</Text>
            <TextInput
              style={S.formInput}
              placeholder="Nama sub marketing"
              value={smNama}
              onChangeText={setSmNama}
              placeholderTextColor="#94A3B8"
            />
            <Text style={S.formLabel}>No. HP *</Text>
            <TextInput
              style={S.formInput}
              placeholder="08xxxxxxxxxx"
              value={smPhone}
              onChangeText={setSmPhone}
              keyboardType="phone-pad"
              placeholderTextColor="#94A3B8"
            />
            <Text style={S.formLabel}>PIN (min. 4 digit) *</Text>
            <TextInput
              style={S.formInput}
              placeholder="PIN untuk login"
              value={smPin}
              onChangeText={v => setSmPin(v.replace(/\D/g, "").slice(0, 6))}
              keyboardType="number-pad"
              secureTextEntry
              placeholderTextColor="#94A3B8"
            />
            <Text style={S.formLabel}>Wilayah</Text>
            <TextInput
              style={S.formInput}
              placeholder="Wilayah kerja (opsional)"
              value={smWilayah}
              onChangeText={setSmWilayah}
              placeholderTextColor="#94A3B8"
            />
            <View style={S.modalActions}>
              <TouchableOpacity
                style={S.modalBtnCancel}
                onPress={() => { resetSmForm(); setShowAddSubMkt(false); }}
              >
                <Text style={S.modalBtnCancelTxt}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[S.modalBtnSave, S.modalBtnPurple]}
                onPress={handleSaveSubMkt}
              >
                <Text style={S.modalBtnSaveTxt}>Daftarkan</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ════ Modal: Daftarkan Owner ════ */}
      <Modal
        visible={showAddOwner}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddOwner(false)}
      >
        <KeyboardAvoidingView
          style={S.kvContainer}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <Pressable style={FLEX_ONE} onPress={() => setShowAddOwner(false)} />
          <View style={S.modalSheetTall}>
            <Text style={S.modalTitle}>Daftarkan Owner</Text>
            <View style={S.trialInfoBanner}>
              <Text style={S.trialInfoTxt}>Owner baru mendapat uji coba GRATIS 3 hari!</Text>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={S.formLabel}>Nama Pemilik *</Text>
              <TextInput
                style={S.formInput}
                placeholder="Nama lengkap pemilik"
                value={owNama}
                onChangeText={setOwNama}
                placeholderTextColor="#94A3B8"
              />
              <Text style={S.formLabel}>Nama Toko *</Text>
              <TextInput
                style={S.formInput}
                placeholder="Nama toko / usaha"
                value={owToko}
                onChangeText={setOwToko}
                placeholderTextColor="#94A3B8"
              />
              <Text style={S.formLabel}>No. HP *</Text>
              <TextInput
                style={S.formInput}
                placeholder="08xxxxxxxxxx"
                value={owPhone}
                onChangeText={setOwPhone}
                keyboardType="phone-pad"
                placeholderTextColor="#94A3B8"
              />
              <Text style={S.formLabel}>Jenis Bisnis *</Text>
              <View style={S.bizGrid}>
                {JENIS_BISNIS_LIST.map(biz => (
                  <TouchableOpacity
                    key={biz}
                    style={getBizChip(owBisnis === biz)}
                    onPress={() => setOwBisnis(biz)}
                  >
                    <Text style={getBizTxt(owBisnis === biz)}>{biz}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={S.formLabel}>Paket Langganan *</Text>
              {PAKET_LIST.map(p => {
                const isActive = owPaket === p;
                const color    = PAKET_COLOR[p];
                const highlights: string[] = [];
                if (p === "basic")      highlights.push("1 kasir", "Semua laporan", "Kurir tersedia");
                if (p === "pro")        highlights.push("5 kasir", "AI Support Standar", "Prioritas Support");
                if (p === "enterprise") highlights.push("Unlimited kasir", "Multi cabang", "AI Support Premium");
                return (
                  <TouchableOpacity
                    key={p}
                    style={getPaketOpt(isActive, color)}
                    onPress={() => setOwPaket(p)}
                  >
                    <View style={FLEX_ONE}>
                      <Text style={getPaketLbl(isActive, color)}>{PAKET_LABEL[p]}</Text>
                      <Text style={S.paketDesc}>{PAKET_DESC[p]}</Text>
                      <View style={S.highlightRow}>
                        {highlights.map(h => (
                          <View key={h} style={S.highlightChip}>
                            <Text style={S.highlightTxt}>{h}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                    {isActive && <Text>{"✅"}</Text>}
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity
                style={S.seeAllFeaturesBtn}
                onPress={() => { setShowAddOwner(false); setShowFeatures(true); }}
              >
                <Text style={S.seeAllFeaturesTxt}>Lihat semua fitur dan perbandingan paket</Text>
              </TouchableOpacity>
              <Text style={S.formLabel}>Alamat Toko (opsional)</Text>
              <TextInput
                style={S.formInputMulti}
                placeholder="Alamat lengkap toko"
                value={owAlamat}
                onChangeText={setOwAlamat}
                multiline
                placeholderTextColor="#94A3B8"
              />
              <View style={S.modalActions}>
                <TouchableOpacity
                  style={S.modalBtnCancel}
                  onPress={() => { resetOwnerForm(); setShowAddOwner(false); }}
                >
                  <Text style={S.modalBtnCancelTxt}>Batal</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[S.modalBtnSave, S.modalBtnBlue]}
                  onPress={handleSaveOwner}
                >
                  <Text style={S.modalBtnSaveTxt}>Daftarkan</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ════ Modal: Sukses Owner ════ */}
      <Modal
        visible={showSuccessOwner}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSuccessOwner(false)}
      >
        <Pressable style={S.modalOverlay} onPress={() => setShowSuccessOwner(false)}>
          <Pressable style={S.successCard} onPress={() => {}}>
            <Text style={S.successIcon}>🎉</Text>
            <Text style={S.successTitle}>Owner Berhasil Didaftarkan!</Text>
            {lastRegistered && (
              <>
                <Text style={S.successSub}>{lastRegistered.tokoName}</Text>
                <Text style={S.successSub}>{lastRegistered.name}</Text>
                <View style={[S.paketBadgeSuccess, { backgroundColor: PAKET_COLOR[lastRegistered.paket] }]}>
                  <Text style={S.paketTxt}>
                    {lastRegistered.paket.toUpperCase() + " — Rp " + (PAKET_HARGA[lastRegistered.paket] / 1000).toFixed(0) + "rb/bln"}
                  </Text>
                </View>
                <View style={S.kodeTokenBox}>
                  <Text style={S.kodeTokenLabel}>Kode Aktivasi Toko</Text>
                  <Text style={S.kodeTokenVal}>{lastRegistered.kodeToken}</Text>
                  <Text style={S.kodeTokenHint}>Berikan kode ini ke owner untuk aktivasi akun</Text>
                </View>
                <View style={S.trialSuccessBadge}>
                  <Text style={S.trialSuccessTxt}>Trial Gratis 3 Hari aktif mulai sekarang</Text>
                </View>
              </>
            )}
            <TouchableOpacity
              style={[S.modalBtnSave, S.modalBtnBlue, S.successCloseBtn]}
              onPress={() => setShowSuccessOwner(false)}
            >
              <Text style={S.modalBtnSaveTxt}>OK, Mengerti</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ════ Modal Full: Daftarkan Kurir ════ */}
      <Modal
        visible={showAddKurir}
        animationType="slide"
        onRequestClose={() => setShowAddKurir(false)}
      >
        <KurirRegistrationScreen
          recruitedBy={myId}
          accentColor={PRIMARY}
          onBack={() => setShowAddKurir(false)}
          onSuccess={(name: string) => {
            setShowAddKurir(false);
            loadPendingKurir();
            Alert.alert("Berhasil", name + " telah didaftarkan sebagai kurir.");
          }}
        />
      </Modal>

      {/* ════ Modal Full: Verifikasi Kurir Owner ════ */}
      <Modal
        visible={showVerifikasiKurir}
        animationType="slide"
        onRequestClose={() => { setShowVerifikasiKurir(false); loadPendingKurir(); }}
      >
        <KurirVerifikasiScreen
          accentColor={CYAN}
          onBack={() => { setShowVerifikasiKurir(false); loadPendingKurir(); }}
        />
      </Modal>

      {/* ════ Modal Full: Demo ════ */}
      <Modal
        visible={showDemo}
        animationType="slide"
        onRequestClose={() => setShowDemo(false)}
      >
        <DemoScreen
          onClose={() => setShowDemo(false)}
          onRegisterOwner={() => { setShowDemo(false); setShowAddOwner(true); }}
          accentColor={PRIMARY}
        />
      </Modal>
    </View>
  );
}

// ─── StyleSheet ───────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  root:                 { flex: 1, backgroundColor: "#F1F5F9" },
  header:               { backgroundColor: PRIMARY, paddingTop: 52, paddingBottom: 16, paddingHorizontal: 20 },
  headerTitle:          { color: "#fff", fontSize: 20, fontWeight: "800" },
  tabScroll:            { backgroundColor: "#fff", maxHeight: 52 },
  tabBar:               { flexDirection: "row", alignItems: "center", paddingHorizontal: 8 },
  tabItem:              { paddingHorizontal: 14, paddingVertical: 14 },
  tabItemActive:        { borderBottomWidth: 3, borderBottomColor: PRIMARY },
  tabInner:             { flexDirection: "row", alignItems: "center", gap: 4 },
  tabTxt:               { fontSize: 13, color: "#64748B", fontWeight: "600" },
  tabTxtActive:         { color: PRIMARY, fontWeight: "800" },
  tabBadge:             { backgroundColor: DANGER, borderRadius: 8, minWidth: 16, height: 16, alignItems: "center", justifyContent: "center", paddingHorizontal: 3 },
  tabBadgeTxt:          { color: "#fff", fontSize: 9, fontWeight: "900" },
  tabContent:           { flex: 1 },
  heroCard:             { backgroundColor: PRIMARY, margin: 16, borderRadius: 16, padding: 20 },
  heroGreet:            { color: "#fff", fontSize: 18, fontWeight: "800" },
  heroRole:             { color: "#BFDBFE", fontSize: 13, marginTop: 2 },
  heroId:               { color: "#93C5FD", fontSize: 11, marginTop: 4 },
  statsRow:             { flexDirection: "row", marginHorizontal: 16, gap: 8, marginBottom: 8 },
  statCard:             { flex: 1, backgroundColor: "#fff", borderRadius: 12, padding: 12, borderLeftWidth: 4, elevation: 2 },
  statBorderBlue:       { borderLeftColor: PRIMARY },
  statBorderAccent:     { borderLeftColor: ACCENT },
  statBorderOrange:     { borderLeftColor: ORANGE },
  statNum:              { fontSize: 20, fontWeight: "800", color: "#1E293B" },
  statLbl:              { fontSize: 10, color: "#64748B", marginTop: 2 },
  sectionCard:          { backgroundColor: "#fff", borderRadius: 14, margin: 16, marginBottom: 4, padding: 16, elevation: 2 },
  sectionTitle:         { fontSize: 14, fontWeight: "700", color: "#1E293B", marginBottom: 10 },
  sectionHeader:        { fontSize: 15, fontWeight: "800", color: "#1E293B", marginHorizontal: 16, marginTop: 16, marginBottom: 6 },
  komisiRow:            { flexDirection: "row", justifyContent: "space-between", paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  komisiLabel:          { fontSize: 12, color: "#475569", flex: 1, paddingRight: 8 },
  komisiLabelBold:      { fontSize: 12, color: "#475569", flex: 1, paddingRight: 8, fontWeight: "700" },
  komisiVal:            { fontSize: 12, fontWeight: "700", color: SUCCESS },
  komisiTotalRow:       { borderTopWidth: 2, borderTopColor: "#E2E8F0", borderBottomWidth: 0, marginTop: 4, paddingTop: 10 },
  komisiTotalLbl:       { fontSize: 14, fontWeight: "800", color: "#1E293B" },
  komisiTotalVal:       { fontSize: 16, fontWeight: "800", color: PRIMARY },
  totalCard:            { borderColor: PRIMARY, borderWidth: 2 },
  infoSmall:            { fontSize: 11, color: "#64748B", marginBottom: 8, fontStyle: "italic" },
  pencairanQuickBtn:    { backgroundColor: "#ECFDF5", borderRadius: 12, margin: 16, marginTop: 4, marginBottom: 4, padding: 14, alignItems: "center", borderWidth: 1.5, borderColor: "#6EE7B7" },
  pencairanQuickTxt:    { color: TEAL, fontWeight: "700", fontSize: 13 },
  viewPaketBtn:         { backgroundColor: "#EFF6FF", borderRadius: 12, margin: 16, marginTop: 4, padding: 14, alignItems: "center", borderWidth: 1, borderColor: "#BFDBFE" },
  viewPaketTxt:         { color: PRIMARY, fontWeight: "700", fontSize: 13 },
  logoutBtn:            { margin: 16, backgroundColor: "#FEF2F2", borderRadius: 12, padding: 14, alignItems: "center" },
  logoutTxt:            { color: DANGER, fontWeight: "700" },
  memberCard:           { backgroundColor: "#fff", borderRadius: 12, marginHorizontal: 16, marginBottom: 10, padding: 14, elevation: 2, flexDirection: "row", alignItems: "flex-start", gap: 10 },
  memberName:           { fontSize: 15, fontWeight: "700", color: "#1E293B" },
  memberSub:            { fontSize: 12, color: "#64748B", marginTop: 2 },
  memberBadgeCol:       { alignItems: "flex-end", gap: 6 },
  paketBadge:           { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 3 },
  paketTxt:             { color: "#fff", fontSize: 10, fontWeight: "700" },
  trialBadge:           { backgroundColor: "#FEF9C3", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  trialTxt:             { color: "#854D0E", fontSize: 10, fontWeight: "700" },
  trialBadgeExpired:    { backgroundColor: "#FEE2E2", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  trialTxtExpired:      { color: DANGER, fontSize: 10, fontWeight: "700" },
  divider:              { height: 1, backgroundColor: "#E2E8F0", marginHorizontal: 16, marginVertical: 12 },
  emptyTxt:             { textAlign: "center", color: "#94A3B8", marginTop: 12, marginHorizontal: 16, fontSize: 13, fontStyle: "italic" },
  actionHeader:         { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginRight: 16, marginTop: 8 },
  addBtn:               { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  addBtnBlue:           { backgroundColor: PRIMARY },
  addBtnPurple:         { backgroundColor: PURPLE },
  addBtnTxt:            { color: "#fff", fontSize: 12, fontWeight: "700" },
  kurirActionRow:       { flexDirection: "row", gap: 10, margin: 16, marginBottom: 10 },
  kurirActionBtn:       { flex: 1, borderRadius: 12, padding: 12, alignItems: "center" },
  kurirActionBtnBlue:   { backgroundColor: PRIMARY },
  kurirActionBtnYellow: { backgroundColor: "#F59E0B" },
  kurirActionTxt:       { color: "#fff", fontWeight: "700", fontSize: 12 },
  verifikasiBanner:     { backgroundColor: "#ECFEFF", borderRadius: 14, marginHorizontal: 16, marginBottom: 14, padding: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1.5, borderColor: "#A5F3FC", elevation: 1 },
  verifikasiLeft:       { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  verifikasiIcon:       { fontSize: 26 },
  verifikasiTitle:      { fontSize: 14, fontWeight: "800", color: "#164E63" },
  verifikasiSub:        { fontSize: 11, color: "#0891B2", marginTop: 2, lineHeight: 16 },
  verifikasiRight:      { flexDirection: "row", alignItems: "center", gap: 6 },
  verifikasiArrow:      { fontSize: 22, color: CYAN, fontWeight: "700" },
  pendingBadge:         { backgroundColor: DANGER, borderRadius: 12, minWidth: 24, height: 24, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  pendingBadgeTxt:      { color: "#fff", fontSize: 12, fontWeight: "900" },
  assignBanner:         { backgroundColor: "#EFF6FF", paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: "#BFDBFE" },
  assignBannerTxt:      { fontSize: 12, color: PRIMARY, fontWeight: "600", marginBottom: 8 },
  assignChipRow:        { gap: 8, paddingRight: 8 },
  assignChip:           { borderRadius: 10, padding: 10, minWidth: 120, maxWidth: 160, elevation: 1 },
  assignChipDone:       { backgroundColor: "#DCFCE7", borderWidth: 1, borderColor: SUCCESS },
  assignChipEmpty:      { backgroundColor: "#fff", borderWidth: 1, borderColor: "#CBD5E1" },
  assignChipName:       { fontSize: 12, fontWeight: "700", color: "#1E293B" },
  assignChipOwner:      { fontSize: 10, color: "#64748B", marginTop: 3 },
  kvContainer:          { flex: 1 },
  modalOverlay:         { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  modalSheet:           { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: "80%" },
  modalSheetTall:       { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: "92%" },
  modalTitle:           { fontSize: 17, fontWeight: "800", color: "#1E293B", marginBottom: 4 },
  modalSubtitle:        { fontSize: 13, color: "#64748B", marginBottom: 14 },
  modalList:            { maxHeight: 280 },
  modalCloseFull:       { marginTop: 12 },
  ownerItem:            { flexDirection: "row", alignItems: "center", backgroundColor: "#F8FAFC", borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: "#E2E8F0" },
  ownerItemSelected:    { borderColor: SUCCESS, backgroundColor: "#F0FDF4" },
  ownerItemName:        { fontSize: 14, fontWeight: "700", color: "#1E293B" },
  ownerItemSub:         { fontSize: 11, color: "#64748B", marginTop: 2 },
  removeOwnerBtn:       { marginTop: 8, padding: 12, backgroundColor: "#FEF2F2", borderRadius: 10, alignItems: "center" },
  removeOwnerTxt:       { color: DANGER, fontWeight: "700", fontSize: 13 },
  modalCancelBtn:       { marginTop: 6, padding: 14, alignItems: "center" },
  modalCancelTxt:       { color: "#64748B", fontWeight: "600" },
  modalActions:         { flexDirection: "row", gap: 12, marginTop: 20, marginBottom: 8 },
  modalBtnCancel:       { flex: 1, padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: "#CBD5E1", alignItems: "center" },
  modalBtnCancelTxt:    { color: "#64748B", fontWeight: "700" },
  modalBtnSave:         { flex: 1, padding: 14, borderRadius: 12, alignItems: "center" },
  modalBtnBlue:         { backgroundColor: PRIMARY },
  modalBtnPurple:       { backgroundColor: PURPLE },
  modalBtnSaveTxt:      { color: "#fff", fontWeight: "800" },
  formLabel:            { fontSize: 12, fontWeight: "700", color: "#374151", marginBottom: 6, marginTop: 10 },
  formInput:            { borderWidth: 1.5, borderColor: "#CBD5E1", borderRadius: 10, padding: 12, fontSize: 14, color: "#1E293B", backgroundColor: "#F8FAFC" },
  formInputMulti:       { borderWidth: 1.5, borderColor: "#CBD5E1", borderRadius: 10, padding: 12, fontSize: 14, color: "#1E293B", backgroundColor: "#F8FAFC", minHeight: 60, textAlignVertical: "top" },
  bizGrid:              { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 },
  bizChip:              { borderWidth: 1.5, borderColor: "#CBD5E1", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: "#F8FAFC" },
  bizChipActive:        { backgroundColor: PRIMARY, borderColor: PRIMARY },
  bizChipTxt:           { fontSize: 12, fontWeight: "600", color: "#374151" },
  bizChipTxtActive:     { color: "#fff" },
  paketOption:          { flexDirection: "row", alignItems: "flex-start", borderWidth: 1.5, borderColor: "#CBD5E1", borderRadius: 12, padding: 14, marginBottom: 8, backgroundColor: "#F8FAFC" },
  paketOptionLabel:     { fontSize: 13, fontWeight: "700", color: "#374151" },
  paketDesc:            { fontSize: 11, color: "#64748B", marginTop: 2, marginBottom: 6 },
  highlightRow:         { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  highlightChip:        { backgroundColor: "#F1F5F9", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  highlightTxt:         { fontSize: 10, color: "#475569", fontWeight: "600" },
  seeAllFeaturesBtn:    { alignItems: "center", marginVertical: 8 },
  seeAllFeaturesTxt:    { color: PRIMARY, fontSize: 12, fontWeight: "600", textDecorationLine: "underline" },
  trialInfoBanner:      { backgroundColor: "#DCFCE7", borderRadius: 10, padding: 10, marginBottom: 12 },
  trialInfoTxt:         { color: "#166534", fontSize: 12, fontWeight: "700", textAlign: "center" },
  paketSummaryRow:      { flexDirection: "row", gap: 8, marginBottom: 16 },
  paketSummaryCard:     { flex: 1, borderWidth: 2, borderRadius: 12, padding: 10, alignItems: "center", backgroundColor: "#F8FAFC" },
  paketSummaryName:     { fontSize: 12, fontWeight: "800" },
  paketSummaryPrice:    { fontSize: 13, fontWeight: "700", color: "#1E293B", marginTop: 2 },
  paketSummaryDesc:     { fontSize: 9, color: "#64748B", textAlign: "center", marginTop: 2 },
  featureTable:         { borderRadius: 10, overflow: "hidden", borderWidth: 1, borderColor: "#E2E8F0" },
  featureHeaderRow:     { flexDirection: "row", backgroundColor: "#F8FAFC", padding: 8, borderBottomWidth: 1, borderBottomColor: "#E2E8F0" },
  featureHeaderLabel:   { fontSize: 11, fontWeight: "700", color: "#64748B" },
  featureHeader:        { fontSize: 11, fontWeight: "800", textAlign: "center" },
  featureRow:           { flexDirection: "row", padding: 8, borderBottomWidth: 1, borderBottomColor: "#F1F5F9", alignItems: "center" },
  featureRowActive:     { backgroundColor: "#F8FAFC" },
  featureLbl:           { fontSize: 11, color: "#374151", fontWeight: "500" },
  featureVal:           { fontSize: 10, fontWeight: "700", textAlign: "center" },
  featureCol0:          { flex: 2 },
  featureCol1:          { flex: 1, alignItems: "center" },
  successCard:          { backgroundColor: "#fff", borderRadius: 20, margin: 32, padding: 24, alignItems: "center" },
  successIcon:          { fontSize: 52, marginBottom: 8 },
  successTitle:         { fontSize: 18, fontWeight: "800", color: "#1E293B", marginBottom: 4, textAlign: "center" },
  successSub:           { fontSize: 14, color: "#64748B", marginBottom: 2 },
  paketBadgeSuccess:    { borderRadius: 8, paddingHorizontal: 14, paddingVertical: 5, marginTop: 8 },
  kodeTokenBox:         { backgroundColor: "#EFF6FF", borderRadius: 14, padding: 16, marginTop: 16, alignItems: "center", width: "100%", borderWidth: 2, borderColor: PRIMARY },
  kodeTokenLabel:       { fontSize: 11, color: "#64748B", marginBottom: 4 },
  kodeTokenVal:         { fontSize: 28, fontWeight: "900", color: PRIMARY, letterSpacing: 4 },
  kodeTokenHint:        { fontSize: 11, color: "#64748B", marginTop: 6, textAlign: "center" },
  trialSuccessBadge:    { backgroundColor: "#DCFCE7", borderRadius: 10, padding: 10, marginTop: 12, width: "100%" },
  trialSuccessTxt:      { color: "#166534", fontSize: 12, fontWeight: "700", textAlign: "center" },
  successCloseBtn:      { marginTop: 16 },

  // ── Pencairan styles ──
  pcSaldoCard:         { backgroundColor: TEAL, borderRadius: 16, margin: 16, marginBottom: 10, padding: 18, alignItems: "center" },
  pcSaldoLbl:          { fontSize: 12, color: "rgba(255,255,255,0.8)", marginBottom: 4 },
  pcSaldoVal:          { fontSize: 28, fontWeight: "800", color: "#fff" },
  pcSaldoSub:          { fontSize: 10, color: "rgba(255,255,255,0.65)", marginTop: 4, textAlign: "center" },
  pcSaldoBtnRow:       { flexDirection: "row", gap: 10, marginTop: 14, width: "100%" },
  pcCairBtn:           { flex: 1, backgroundColor: "#fff", borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  pcCairBtnDisabled:   { flex: 1, backgroundColor: "rgba(255,255,255,0.3)", borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  pcCairBtnTxt:        { color: TEAL, fontWeight: "800", fontSize: 13 },
  pcRekeningBtn:       { backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12 },
  pcRekeningBtnTxt:    { color: "#fff", fontWeight: "700", fontSize: 12 },
  pcKomisiBox:         { backgroundColor: "#fff", borderRadius: 14, marginHorizontal: 16, marginBottom: 10, padding: 14, elevation: 1, borderWidth: 1, borderColor: "#E2E8F0" },
  pcKomisiTitle:       { fontSize: 13, fontWeight: "700", color: "#1E293B", marginBottom: 8 },
  pcKomisiRow:         { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#F8FAFC" },
  pcKomisiLbl:         { fontSize: 12, color: "#64748B", flex: 1 },
  pcKomisiVal:         { fontSize: 12, fontWeight: "700", color: SUCCESS },
  pcKomisiTotalRow:    { borderTopWidth: 1.5, borderTopColor: "#E2E8F0", borderBottomWidth: 0, marginTop: 4, paddingTop: 8 },
  pcKomisiTotalLbl:    { fontSize: 13, fontWeight: "800", color: "#1E293B" },
  pcKomisiTotalVal:    { fontSize: 15, fontWeight: "800", color: PRIMARY },
  pcInfoBox:           { backgroundColor: "#F0FDFA", borderRadius: 12, marginHorizontal: 16, marginBottom: 10, padding: 14, borderWidth: 1, borderColor: "#99F6E4" },
  pcInfoTxt:           { fontSize: 12, color: "#134E4A", lineHeight: 20 },
  pcBankCard:          { backgroundColor: "#F0FDFA", borderRadius: 12, marginHorizontal: 16, marginBottom: 10, padding: 14, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#99F6E4" },
  pcBankTitle:         { fontSize: 11, color: "#64748B", marginBottom: 4 },
  pcBankName:          { fontSize: 15, fontWeight: "700", color: "#1E293B" },
  pcBankNum:           { fontSize: 13, color: "#374151", marginTop: 2 },
  pcBankOwner:         { fontSize: 12, color: "#64748B", marginTop: 2 },
  pcBankEditBtn:       { backgroundColor: "#CCFBF1", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  pcBankEditTxt:       { fontSize: 12, color: TEAL, fontWeight: "700" },
  pcFormCard:          { backgroundColor: "#fff", borderRadius: 14, marginHorizontal: 16, marginBottom: 10, padding: 16, borderWidth: 1, borderColor: "#E2E8F0", elevation: 2 },
  pcFormTitle:         { fontSize: 15, fontWeight: "700", color: "#1E293B", marginBottom: 12 },
  pcFormLbl:           { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 6, marginTop: 12 },
  pcFormInput:         { backgroundColor: "#F8FAFC", borderRadius: 10, borderWidth: 1, borderColor: "#E2E8F0", paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: "#1E293B" },
  pcWarnBox:           { backgroundColor: "#FFF7ED", borderRadius: 10, padding: 12, marginTop: 12, borderWidth: 1, borderColor: "#FED7AA" },
  pcWarnTxt:           { fontSize: 12, color: "#92400E" },
  pcFormBtnRow:        { flexDirection: "row", gap: 10, marginTop: 16 },
  pcFormCancelBtn:     { flex: 1, backgroundColor: "#F1F5F9", borderRadius: 12, paddingVertical: 12, alignItems: "center", borderWidth: 1, borderColor: "#CBD5E1" },
  pcFormCancelTxt:     { color: "#475569", fontWeight: "700", fontSize: 14 },
  pcFormSaveBtn:       { flex: 1, backgroundColor: TEAL, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  pcFormSaveTxt:       { color: "#fff", fontWeight: "800", fontSize: 14 },
  pcSaldoMini:         { backgroundColor: "#F0FDFA", borderRadius: 10, padding: 12, marginBottom: 8, alignItems: "center" },
  pcSaldoMiniLbl:      { fontSize: 11, color: "#64748B" },
  pcSaldoMiniVal:      { fontSize: 20, fontWeight: "800", color: TEAL },
  pcBankPreview:       { backgroundColor: "#F8FAFC", borderRadius: 10, padding: 10, marginBottom: 6 },
  pcBankPreviewTxt:    { fontSize: 13, fontWeight: "700", color: "#1E293B" },
  pcBankPreviewOwner:  { fontSize: 12, color: "#64748B" },
  pcShortcutRow:       { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  pcShortcutBtn:       { backgroundColor: "#F1F5F9", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  pcShortcutBtnAll:    { backgroundColor: "#CCFBF1", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  pcShortcutTxt:       { fontSize: 12, fontWeight: "600", color: "#374151" },
  pcHistoryTitle:      { fontSize: 14, fontWeight: "700", color: "#1E293B", marginHorizontal: 16, marginBottom: 8, marginTop: 4 },
  pcHistoryEmpty:      { paddingVertical: 30, alignItems: "center" },
  pcHistoryEmptyTxt:   { color: "#94A3B8", fontSize: 14 },
  pcHistoryItem:       { backgroundColor: "#fff", borderRadius: 12, marginHorizontal: 16, marginBottom: 8, padding: 14, flexDirection: "row", elevation: 1, borderWidth: 1, borderColor: "#F1F5F9" },
  pcHistoryId:         { fontSize: 11, fontWeight: "700", color: "#475569", letterSpacing: 0.5 },
  pcHistoryBank:       { fontSize: 13, fontWeight: "600", color: "#1E293B", marginTop: 2 },
  pcHistoryOwner:      { fontSize: 11, color: "#64748B" },
  pcHistoryDate:       { fontSize: 10, color: "#94A3B8", marginTop: 3 },
  pcHistoryCatatan:    { fontSize: 11, color: DANGER, marginTop: 3 },
  pcHistoryRight:      { alignItems: "flex-end", justifyContent: "center", gap: 6 },
  pcHistoryJumlah:     { fontSize: 16, fontWeight: "800", color: "#1E293B" },
  pcStatusBadge:       { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  pcStatusTxt:         { fontSize: 10, fontWeight: "700" },
  pcBottomSpacer:      { height: 40 },
});