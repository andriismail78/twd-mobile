// src/screens/RekapKeuanganScreen.tsx — v1.1 (fix produkColName & produkColMargin)
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ─── Constants ────────────────────────────────────────────────────────────────

const C_BG     = "#F1F5F9";
const C_CARD   = "#FFFFFF";
const C_TEXT   = "#1E293B";
const C_SUB    = "#64748B";
const C_BORDER = "#E2E8F0";
const C_BLUE   = "#2563EB";
const C_GREEN  = "#16A34A";
const C_RED    = "#DC2626";
const C_ORANGE = "#D97706";
const C_PURPLE = "#7C3AED";
const C_TEAL   = "#0891B2";

const SHADOW_SM = { width: 0, height: 1 };
const SHADOW_MD = { width: 0, height: 2 };

const PERIODE_OPTS = [
  { label: "Hari Ini",   value: "today"     },
  { label: "7 Hari",    value: "7days"     },
  { label: "30 Hari",   value: "30days"    },
  { label: "Bulan Ini", value: "thisMonth" },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface OrderItem {
  name:  string;
  price: number;
  qty:   number;
}

interface Order {
  id:          string;
  ownerId:     string;
  kasirName:   string;
  items:       OrderItem[];
  subtotal:    number;
  diskon:      number;
  total:       number;
  metodeBayar: string;
  createdAt:   string;
}

interface StoreProduct {
  id:        string;
  ownerId:   string;
  name:      string;
  price:     number;
  buyPrice?: number;
  stock:     number;
  category?: string;
}

interface BebanItem {
  id:     string;
  nama:   string;
  jumlah: number;
}

interface RekapData {
  omset:          number;
  hpp:            number;
  labaKotor:      number;
  bebanOperasi:   number;
  labaBersih:     number;
  marginKotor:    number;
  marginBersih:   number;
  totalTransaksi: number;
  rataPerTrx:     number;
  nilaiStok:      number;
  totalDiskon:    number;
}

interface ProdukMargin {
  name:      string;
  qty:       number;
  omset:     number;
  hpp:       number;
  labaKotor: number;
  marginPct: number;
  buyPrice:  number;
  sellPrice: number;
}

interface Props {
  ownerId:   string;
  tokoName?: string;
  onBack:    () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRp(n: number): string {
  return "Rp " + Math.round(n).toLocaleString("id-ID");
}

function formatRpShort(n: number): string {
  if (n >= 1_000_000_000) return "Rp " + (n / 1_000_000_000).toFixed(1) + "M";
  if (n >= 1_000_000)     return "Rp " + (n / 1_000_000).toFixed(1) + "jt";
  if (n >= 1_000)         return "Rp " + (n / 1_000).toFixed(0) + "rb";
  return "Rp " + Math.round(n).toLocaleString("id-ID");
}

function formatPct(n: number): string {
  return n.toFixed(1) + "%";
}

function getPeriodeStart(periode: string): Date {
  const now = new Date();
  if (periode === "today")     return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (periode === "7days")     return new Date(now.getTime() - 7  * 86400000);
  if (periode === "30days")    return new Date(now.getTime() - 30 * 86400000);
  if (periode === "thisMonth") return new Date(now.getFullYear(), now.getMonth(), 1);
  return new Date(0);
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function marginColor(pct: number): string {
  if (pct >= 30) return C_GREEN;
  if (pct >= 15) return C_ORANGE;
  return C_RED;
}

// ─────────────────────────────────────────────────────────────────────────────
//  COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function RekapKeuanganScreen({ ownerId, tokoName = "Toko", onBack }: Props) {
  const insets = useSafeAreaInsets();

  const [periode,       setPeriode]       = useState("thisMonth");
  const [loading,       setLoading]       = useState(true);
  const [rekap,         setRekap]         = useState<RekapData | null>(null);
  const [produkList,    setProdukList]    = useState<ProdukMargin[]>([]);
  const [bebanList,     setBebanList]     = useState<BebanItem[]>([]);
  const [showBeban,     setShowBeban]     = useState(false);
  const [bebanNama,     setBebanNama]     = useState("");
  const [bebanJumlah,   setBebanJumlah]   = useState("");
  const [activeSection, setActiveSection] = useState<"ringkasan" | "produk" | "beban">("ringkasan");

  const bebanKey = "@twd_beban_" + ownerId;

  // ── Load ──────────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [rawOrders, rawProducts, rawBeban] = await Promise.all([
        AsyncStorage.getItem("@twd_orders"),
        AsyncStorage.getItem("@twd_products"),
        AsyncStorage.getItem(bebanKey),
      ]);

      const allOrders:   Order[]        = rawOrders   ? JSON.parse(rawOrders)   : [];
      const allProducts: StoreProduct[] = rawProducts ? JSON.parse(rawProducts) : [];
      const savedBeban:  BebanItem[]    = rawBeban    ? JSON.parse(rawBeban)    : [];

      setBebanList(savedBeban);

      const periodeStart = getPeriodeStart(periode);
      const filtered     = allOrders.filter(
        (o) => o.ownerId === ownerId && new Date(o.createdAt) >= periodeStart
      );

      const ownerProducts = allProducts.filter((p) => p.ownerId === ownerId);
      const hppMap: Record<string, number> = {};
      ownerProducts.forEach((p) => { hppMap[p.name] = p.buyPrice ?? 0; });

      let omset = 0, hpp = 0, totalDiskon = 0;
      const produkMap: Record<string, ProdukMargin> = {};

      filtered.forEach((o) => {
        omset       += o.total;
        totalDiskon += o.diskon ?? 0;
        o.items.forEach((item) => {
          const hargaBeli = hppMap[item.name] ?? 0;
          const hppItem   = hargaBeli * item.qty;
          hpp += hppItem;

          if (!produkMap[item.name]) {
            produkMap[item.name] = {
              name:      item.name,
              qty:       0,
              omset:     0,
              hpp:       0,
              labaKotor: 0,
              marginPct: 0,
              buyPrice:  hargaBeli,
              sellPrice: item.price,
            };
          }
          produkMap[item.name].qty       += item.qty;
          produkMap[item.name].omset     += item.price * item.qty;
          produkMap[item.name].hpp       += hppItem;
          produkMap[item.name].labaKotor += (item.price - hargaBeli) * item.qty;
        });
      });

      Object.values(produkMap).forEach((p) => {
        p.marginPct = p.omset > 0 ? (p.labaKotor / p.omset) * 100 : 0;
      });

      const labaKotor    = omset - hpp;
      const bebanTotal   = savedBeban.reduce((s, b) => s + b.jumlah, 0);
      const labaBersih   = labaKotor - bebanTotal;
      const marginKotor  = omset > 0 ? (labaKotor  / omset) * 100 : 0;
      const marginBersih = omset > 0 ? (labaBersih / omset) * 100 : 0;
      const nilaiStok    = ownerProducts.reduce((s, p) => s + (p.buyPrice ?? 0) * p.stock, 0);

      setRekap({
        omset, hpp, labaKotor, bebanOperasi: bebanTotal,
        labaBersih, marginKotor, marginBersih,
        totalTransaksi: filtered.length,
        rataPerTrx:     filtered.length > 0 ? omset / filtered.length : 0,
        nilaiStok, totalDiskon,
      });

      setProdukList(Object.values(produkMap).sort((a, b) => b.labaKotor - a.labaKotor));
    } catch (e) {
      console.error("RekapKeuangan loadData:", e);
      Alert.alert("Error", "Gagal memuat data keuangan.");
    } finally {
      setLoading(false);
    }
  }, [ownerId, periode, bebanKey]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Beban CRUD ────────────────────────────────────────────────────────────
  async function handleTambahBeban() {
    const nama   = bebanNama.trim();
    const jumlah = parseInt(bebanJumlah.replace(/\D/g, ""), 10);
    if (!nama)                         { Alert.alert("Error", "Nama beban wajib diisi."); return; }
    if (isNaN(jumlah) || jumlah <= 0)  { Alert.alert("Error", "Jumlah harus angka positif."); return; }

    const newItem: BebanItem = { id: generateId(), nama, jumlah };
    const updated = [...bebanList, newItem];
    await AsyncStorage.setItem(bebanKey, JSON.stringify(updated));
    setBebanList(updated);
    setBebanNama("");
    setBebanJumlah("");
    setShowBeban(false);
    loadData();
  }

  async function handleHapusBeban(id: string) {
    Alert.alert("Hapus Beban", "Hapus item beban ini?", [
      { text: "Batal", style: "cancel" },
      { text: "Hapus", style: "destructive", onPress: async () => {
        const updated = bebanList.filter((b) => b.id !== id);
        await AsyncStorage.setItem(bebanKey, JSON.stringify(updated));
        setBebanList(updated);
        loadData();
      }},
    ]);
  }

  // ── BEP ───────────────────────────────────────────────────────────────────
  function hitungBEP(): string {
    if (!rekap || rekap.omset === 0) return "-";
    const marginRatio = rekap.labaKotor / rekap.omset;
    if (marginRatio <= 0) return "Tidak dapat dihitung (margin ≤ 0)";
    return formatRp(rekap.bebanOperasi / marginRatio);
  }

  // ─── Render Ringkasan ─────────────────────────────────────────────────────
  function renderRingkasan() {
    if (!rekap) return null;
    const labaBersihPositif = rekap.labaBersih >= 0;
    const labaBorderColor   = labaBersihPositif ? C_GREEN : C_RED;
    const labaResultStyle   = labaBersihPositif
      ? [RK.flowResult, RK.flowResultGreen]
      : [RK.flowResult, RK.flowResultRed];

    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={RK.scrollPad}>

        {/* Kartu Laba Utama */}
        <View style={[RK.labaCard, { borderColor: labaBorderColor }]}>
          <Text style={RK.labaCardTitle}>{"💰 Laba Bersih"}</Text>
          <Text style={[RK.labaCardVal, { color: labaBorderColor }]}>
            {formatRp(rekap.labaBersih)}
          </Text>
          <Text style={RK.labaCardSub}>
            {labaBersihPositif
              ? "Margin bersih: " + formatPct(rekap.marginBersih)
              : "⚠️ Beban melebihi laba kotor"}
          </Text>
        </View>

        {/* Alur Keuangan */}
        <View style={RK.section}>
          <Text style={RK.sectionTitle}>{"📊 Alur Keuangan"}</Text>

          <View style={RK.flowRow}>
            <View style={[RK.flowDot, { backgroundColor: C_BLUE }]} />
            <View style={RK.flowInfo}>
              <Text style={RK.flowLabel}>{"Omset (Total Penjualan)"}</Text>
              <Text style={RK.flowSub}>{rekap.totalTransaksi + " transaksi · rata " + formatRpShort(rekap.rataPerTrx)}</Text>
            </View>
            <Text style={[RK.flowVal, { color: C_BLUE }]}>{formatRpShort(rekap.omset)}</Text>
          </View>
          <View style={RK.flowDivider} />

          <View style={RK.flowRow}>
            <View style={[RK.flowDot, { backgroundColor: C_RED }]} />
            <View style={RK.flowInfo}>
              <Text style={RK.flowLabel}>{"HPP (Harga Pokok Penjualan)"}</Text>
              <Text style={RK.flowSub}>{"Modal produk yang sudah terjual"}</Text>
            </View>
            <Text style={[RK.flowVal, { color: C_RED }]}>{"– " + formatRpShort(rekap.hpp)}</Text>
          </View>

          <View style={[RK.flowResult, RK.flowResultBlue]}>
            <Text style={RK.flowResultLabel}>{"= Laba Kotor"}</Text>
            <View style={RK.flowResultRight}>
              <Text style={[RK.flowResultVal, { color: C_BLUE }]}>{formatRpShort(rekap.labaKotor)}</Text>
              <Text style={RK.flowResultPct}>{"margin " + formatPct(rekap.marginKotor)}</Text>
            </View>
          </View>
          <View style={RK.flowDivider} />

          <View style={RK.flowRow}>
            <View style={[RK.flowDot, { backgroundColor: C_ORANGE }]} />
            <View style={RK.flowInfo}>
              <Text style={RK.flowLabel}>{"Beban Operasi"}</Text>
              <Text style={RK.flowSub}>{bebanList.length + " item · sewa, gaji, listrik, dll"}</Text>
            </View>
            <Text style={[RK.flowVal, { color: C_ORANGE }]}>{"– " + formatRpShort(rekap.bebanOperasi)}</Text>
          </View>

          <View style={labaResultStyle}>
            <Text style={RK.flowResultLabel}>{"= Laba Bersih"}</Text>
            <View style={RK.flowResultRight}>
              <Text style={[RK.flowResultVal, { color: labaBersihPositif ? C_GREEN : C_RED }]}>
                {formatRpShort(rekap.labaBersih)}
              </Text>
              <Text style={RK.flowResultPct}>{"margin " + formatPct(rekap.marginBersih)}</Text>
            </View>
          </View>
        </View>

        {/* Info Tambahan */}
        <View style={RK.section}>
          <Text style={RK.sectionTitle}>{"📋 Info Tambahan"}</Text>
          <View style={RK.infoGrid}>
            <View style={RK.infoCard}>
              <Text style={RK.infoIcon}>{"📦"}</Text>
              <Text style={RK.infoLabel}>{"Nilai Stok Saat Ini"}</Text>
              <Text style={[RK.infoVal, { color: C_TEAL }]}>{formatRpShort(rekap.nilaiStok)}</Text>
            </View>
            <View style={RK.infoCard}>
              <Text style={RK.infoIcon}>{"🎁"}</Text>
              <Text style={RK.infoLabel}>{"Total Diskon Diberikan"}</Text>
              <Text style={[RK.infoVal, { color: C_ORANGE }]}>{formatRpShort(rekap.totalDiskon)}</Text>
            </View>
            <View style={RK.infoCard}>
              <Text style={RK.infoIcon}>{"⚖️"}</Text>
              <Text style={RK.infoLabel}>{"BEP (Break Even Point)"}</Text>
              <Text style={[RK.infoVal, { color: C_PURPLE }]}>{hitungBEP()}</Text>
            </View>
            <View style={RK.infoCard}>
              <Text style={RK.infoIcon}>{"🔄"}</Text>
              <Text style={RK.infoLabel}>{"Rata-rata per Transaksi"}</Text>
              <Text style={[RK.infoVal, { color: C_BLUE }]}>{formatRpShort(rekap.rataPerTrx)}</Text>
            </View>
          </View>
        </View>

        {/* Tips */}
        {rekap.marginKotor < 20 && rekap.omset > 0 && (
          <View style={RK.tipCard}>
            <Text style={RK.tipIcon}>{"💡"}</Text>
            <View style={RK.tipBody}>
              <Text style={RK.tipTitle}>{"Margin kotor rendah (" + formatPct(rekap.marginKotor) + ")"}</Text>
              <Text style={RK.tipDesc}>{"Pertimbangkan menaikkan harga jual atau cari supplier lebih murah. Target margin ideal 20–30%."}</Text>
            </View>
          </View>
        )}
        {rekap.labaBersih < 0 && rekap.omset > 0 && (
          <View style={[RK.tipCard, RK.tipCardDanger]}>
            <Text style={RK.tipIcon}>{"⚠️"}</Text>
            <View style={RK.tipBody}>
              <Text style={[RK.tipTitle, { color: C_RED }]}>{"Bisnis merugi!"}</Text>
              <Text style={RK.tipDesc}>
                {"Beban operasi melebihi laba kotor. Kurangi beban atau tingkatkan penjualan. BEP: " + hitungBEP() + "."}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    );
  }

  // ─── Render Produk ────────────────────────────────────────────────────────
  function renderProduk() {
    if (produkList.length === 0) {
      return (
        <View style={RK.emptyCenter}>
          <Text style={RK.emptyIcon}>{"📦"}</Text>
          <Text style={RK.emptyTitle}>{"Belum ada data produk"}</Text>
          <Text style={RK.emptySub}>{"Pastikan harga modal (buyPrice) sudah diisi di data produk."}</Text>
        </View>
      );
    }

    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={RK.scrollPad}>
        <View style={RK.hintBox}>
          <Text style={RK.hintTxt}>{"ℹ️ Produk tanpa harga modal dihitung modal Rp 0. Isi harga modal di halaman Kelola Produk."}</Text>
        </View>

        {/* Header tabel */}
        <View style={RK.tableHeader}>
          <Text style={[RK.tableHeaderTxt, RK.produkColName]}>{"Produk"}</Text>
          <Text style={[RK.tableHeaderTxt, RK.tableColQty]}>{"Qty"}</Text>
          <Text style={[RK.tableHeaderTxt, RK.tableColLaba]}>{"Laba"}</Text>
          <Text style={[RK.tableHeaderTxt, RK.tableColMarginHead]}>{"Margin"}</Text>
        </View>

        {produkList.map((p, i) => (
          <View key={p.name} style={[RK.produkRow, i % 2 === 0 && RK.produkRowAlt]}>
            <View style={RK.produkColName}>
              <Text style={RK.produkName} numberOfLines={1}>{p.name}</Text>
              <Text style={RK.produkPriceSub}>
                {"Jual " + formatRpShort(p.sellPrice) + " · Modal " + formatRpShort(p.buyPrice)}
              </Text>
            </View>
            <Text style={[RK.produkCell, RK.tableColQty]}>{p.qty}</Text>
            <Text style={[RK.produkCell, RK.tableColLaba, { color: p.labaKotor >= 0 ? C_GREEN : C_RED }]}>
              {formatRpShort(p.labaKotor)}
            </Text>
            <View style={RK.produkColMargin}>
              <View style={[RK.marginBadge, { backgroundColor: marginColor(p.marginPct) + "22", borderColor: marginColor(p.marginPct) + "55" }]}>
                <Text style={[RK.marginBadgeTxt, { color: marginColor(p.marginPct) }]}>
                  {formatPct(p.marginPct)}
                </Text>
              </View>
            </View>
          </View>
        ))}

        {/* Total */}
        <View style={RK.produkTotal}>
          <Text style={RK.produkTotalLabel}>{"Total Laba Kotor"}</Text>
          <Text style={[RK.produkTotalVal, { color: C_GREEN }]}>
            {formatRp(produkList.reduce((s, p) => s + p.labaKotor, 0))}
          </Text>
        </View>
      </ScrollView>
    );
  }

  // ─── Render Beban ─────────────────────────────────────────────────────────
  function renderBeban() {
    const totalBeban = bebanList.reduce((s, b) => s + b.jumlah, 0);
    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={RK.scrollPad}>

        <View style={RK.bebanHeaderRow}>
          <Text style={RK.sectionTitle}>{"🧾 Beban Operasi"}</Text>
          <TouchableOpacity style={RK.addBebanBtn} onPress={() => setShowBeban(!showBeban)}>
            <Text style={RK.addBebanTxt}>{showBeban ? "✕ Batal" : "+ Tambah"}</Text>
          </TouchableOpacity>
        </View>

        {showBeban && (
          <View style={RK.bebanForm}>
            <Text style={RK.formLabel}>{"Nama Beban"}</Text>
            <TextInput
              style={RK.formInput}
              value={bebanNama}
              onChangeText={setBebanNama}
              placeholder={"Contoh: Sewa toko, Gaji karyawan..."}
              placeholderTextColor={C_SUB}
            />
            <Text style={RK.formLabel}>{"Jumlah (Rp)"}</Text>
            <TextInput
              style={RK.formInput}
              value={bebanJumlah}
              onChangeText={setBebanJumlah}
              placeholder={"Contoh: 1500000"}
              placeholderTextColor={C_SUB}
              keyboardType="number-pad"
            />
            <TouchableOpacity style={RK.formSaveBtn} onPress={handleTambahBeban}>
              <Text style={RK.formSaveBtnTxt}>{"💾 Simpan Beban"}</Text>
            </TouchableOpacity>
          </View>
        )}

        {bebanList.length === 0 ? (
          <View style={RK.emptyCenter}>
            <Text style={RK.emptyIcon}>{"📋"}</Text>
            <Text style={RK.emptyTitle}>{"Belum ada beban operasi"}</Text>
            <Text style={RK.emptySub}>{"Tambahkan sewa, gaji, listrik, dll untuk menghitung laba bersih yang akurat."}</Text>
          </View>
        ) : (
          <>
            {bebanList.map((b) => (
              <View key={b.id} style={RK.bebanRow}>
                <View style={RK.bebanLeft}>
                  <Text style={RK.bebanName}>{b.nama}</Text>
                </View>
                <Text style={RK.bebanJumlah}>{formatRp(b.jumlah)}</Text>
                <TouchableOpacity style={RK.bebanDeleteBtn} onPress={() => handleHapusBeban(b.id)}>
                  <Text style={RK.bebanDeleteTxt}>{"🗑️"}</Text>
                </TouchableOpacity>
              </View>
            ))}

            <View style={RK.bebanTotalRow}>
              <Text style={RK.bebanTotalLabel}>{"Total Beban"}</Text>
              <Text style={[RK.bebanTotalVal, { color: C_ORANGE }]}>{formatRp(totalBeban)}</Text>
            </View>

            {rekap && (
              <View style={RK.bebanImpact}>
                <Text style={RK.bebanImpactTitle}>{"💡 Dampak ke Laba"}</Text>
                <View style={RK.bebanImpactRow}>
                  <Text style={RK.bebanImpactLabel}>{"Laba Kotor"}</Text>
                  <Text style={[RK.bebanImpactVal, { color: C_BLUE }]}>{formatRp(rekap.labaKotor)}</Text>
                </View>
                <View style={RK.bebanImpactRow}>
                  <Text style={RK.bebanImpactLabel}>{"Total Beban"}</Text>
                  <Text style={[RK.bebanImpactVal, { color: C_ORANGE }]}>{"– " + formatRp(totalBeban)}</Text>
                </View>
                <View style={[RK.bebanImpactRow, RK.bebanImpactRowTotal]}>
                  <Text style={RK.bebanImpactLabelBold}>{"Laba Bersih"}</Text>
                  <Text style={[RK.bebanImpactValBold, { color: rekap.labaBersih >= 0 ? C_GREEN : C_RED }]}>
                    {formatRp(rekap.labaBersih)}
                  </Text>
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>
    );
  }

  // ─── Main Render ──────────────────────────────────────────────────────────
  return (
    <View style={[RK.container, { paddingTop: insets.top }]}>

      {/* Header */}
      <View style={RK.header}>
        <TouchableOpacity onPress={onBack} style={RK.backBtn}>
          <Text style={RK.backTxt}>{"← Kembali"}</Text>
        </TouchableOpacity>
        <Text style={RK.headerTitle}>{"💰 Rekap Keuangan"}</Text>
        <TouchableOpacity onPress={loadData} disabled={loading} style={RK.refreshBtn}>
          {loading
            ? <ActivityIndicator color={C_BLUE} size="small" />
            : <Text style={RK.refreshTxt}>{"🔄"}</Text>
          }
        </TouchableOpacity>
      </View>

      {/* Periode */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={RK.periodeScroll}>
        {PERIODE_OPTS.map((p) => (
          <TouchableOpacity
            key={p.value}
            style={[RK.periodeChip, periode === p.value && RK.periodeChipActive]}
            onPress={() => setPeriode(p.value)}
          >
            <Text style={[RK.periodeChipTxt, periode === p.value && RK.periodeChipTxtActive]}>
              {p.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Section Tabs */}
      <View style={RK.sectionTabs}>
        {(["ringkasan", "produk", "beban"] as const).map((s) => (
          <TouchableOpacity
            key={s}
            style={[RK.sectionTab, activeSection === s && RK.sectionTabActive]}
            onPress={() => setActiveSection(s)}
          >
            <Text style={[RK.sectionTabTxt, activeSection === s && RK.sectionTabTxtActive]}>
              {s === "ringkasan" ? "📊 Ringkasan" : s === "produk" ? "📦 Produk" : "🧾 Beban"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <View style={RK.content}>
        {loading ? (
          <View style={RK.loadingCenter}>
            <ActivityIndicator color={C_BLUE} size="large" />
            <Text style={RK.loadingTxt}>{"Menghitung keuangan..."}</Text>
          </View>
        ) : !rekap ? (
          <View style={RK.emptyCenter}>
            <Text style={RK.emptyIcon}>{"📭"}</Text>
            <Text style={RK.emptyTitle}>{"Tidak ada data"}</Text>
          </View>
        ) : activeSection === "ringkasan" ? renderRingkasan()
          : activeSection === "produk"    ? renderProduk()
          :                                  renderBeban()
        }
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const RK = StyleSheet.create({
  container:   { flex: 1, backgroundColor: C_BG },
  content:     { flex: 1 },

  // Header
  header:      { flexDirection: "row", alignItems: "center", backgroundColor: C_CARD, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C_BORDER },
  backBtn:     { paddingRight: 12 },
  backTxt:     { fontSize: 14, color: C_BLUE, fontWeight: "700" },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: "900", color: C_TEXT },
  refreshBtn:  { padding: 4 },
  refreshTxt:  { fontSize: 18 },

  // Periode
  periodeScroll:        { flexGrow: 0, backgroundColor: C_CARD, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C_BORDER },
  periodeChip:          { backgroundColor: "#F1F5F9", borderRadius: 20, paddingHorizontal: 16, paddingVertical: 7, marginRight: 8 },
  periodeChipActive:    { backgroundColor: C_BLUE },
  periodeChipTxt:       { fontSize: 12, color: C_SUB, fontWeight: "600" },
  periodeChipTxtActive: { color: "#fff", fontWeight: "800" },

  // Tabs
  sectionTabs:         { flexDirection: "row", backgroundColor: C_CARD, borderBottomWidth: 1, borderBottomColor: C_BORDER },
  sectionTab:          { flex: 1, paddingVertical: 12, alignItems: "center" },
  sectionTabActive:    { borderBottomWidth: 2, borderBottomColor: C_BLUE },
  sectionTabTxt:       { fontSize: 12, color: C_SUB, fontWeight: "600" },
  sectionTabTxtActive: { color: C_BLUE, fontWeight: "800" },

  scrollPad: { padding: 16, paddingBottom: 40 },

  // Loading / empty
  loadingCenter: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  loadingTxt:    { fontSize: 14, color: C_SUB },
  emptyCenter:   { flex: 1, justifyContent: "center", alignItems: "center", padding: 40 },
  emptyIcon:     { fontSize: 44, marginBottom: 12 },
  emptyTitle:    { fontSize: 15, fontWeight: "800", color: C_TEXT, marginBottom: 6 },
  emptySub:      { fontSize: 12, color: C_SUB, textAlign: "center", lineHeight: 18 },

  // Laba card
  labaCard:      { backgroundColor: C_CARD, borderRadius: 16, padding: 20, marginBottom: 14, alignItems: "center", borderWidth: 2, elevation: 3, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: SHADOW_MD },
  labaCardTitle: { fontSize: 13, color: C_SUB, fontWeight: "700", marginBottom: 8 },
  labaCardVal:   { fontSize: 36, fontWeight: "900", marginBottom: 6 },
  labaCardSub:   { fontSize: 12, color: C_SUB },

  // Section
  section:      { backgroundColor: C_CARD, borderRadius: 14, padding: 16, marginBottom: 12, elevation: 2, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: SHADOW_SM },
  sectionTitle: { fontSize: 13, fontWeight: "800", color: C_TEXT, marginBottom: 14 },

  // Flow
  flowRow:          { flexDirection: "row", alignItems: "flex-start", paddingVertical: 10, gap: 12 },
  flowDot:          { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  flowInfo:         { flex: 1 },
  flowLabel:        { fontSize: 13, fontWeight: "700", color: C_TEXT },
  flowSub:          { fontSize: 11, color: C_SUB, marginTop: 2 },
  flowVal:          { fontSize: 14, fontWeight: "800" },
  flowDivider:      { height: 1, backgroundColor: C_BORDER, marginVertical: 6, marginLeft: 22 },
  flowResult:       { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderRadius: 10, padding: 12, marginVertical: 6, borderWidth: 1 },
  flowResultBlue:   { backgroundColor: C_BLUE  + "11", borderColor: C_BLUE  + "33" },
  flowResultGreen:  { backgroundColor: C_GREEN + "11", borderColor: C_GREEN + "33" },
  flowResultRed:    { backgroundColor: C_RED   + "11", borderColor: C_RED   + "33" },
  flowResultLabel:  { fontSize: 13, fontWeight: "700", color: C_TEXT },
  flowResultRight:  { alignItems: "flex-end" },
  flowResultVal:    { fontSize: 16, fontWeight: "900" },
  flowResultPct:    { fontSize: 10, color: C_SUB, marginTop: 1 },

  // Info grid
  infoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  infoCard: { width: "47%", flexGrow: 1, backgroundColor: C_BG, borderRadius: 12, padding: 12, alignItems: "center", borderWidth: 1, borderColor: C_BORDER },
  infoIcon: { fontSize: 22, marginBottom: 4 },
  infoLabel:{ fontSize: 10, color: C_SUB, marginBottom: 4, textAlign: "center" },
  infoVal:  { fontSize: 14, fontWeight: "800" },

  // Tips
  tipCard:       { flexDirection: "row", backgroundColor: "#FFF7ED", borderRadius: 12, padding: 14, gap: 10, borderWidth: 1, borderColor: "#FED7AA", marginBottom: 8 },
  tipCardDanger: { backgroundColor: "#FEF2F2", borderColor: "#FECACA" },
  tipIcon:       { fontSize: 20 },
  tipBody:       { flex: 1 },
  tipTitle:      { fontSize: 13, fontWeight: "700", color: C_ORANGE, marginBottom: 4 },
  tipDesc:       { fontSize: 11, color: C_TEXT, lineHeight: 17 },

  // Hint
  hintBox: { backgroundColor: "#EFF6FF", borderRadius: 10, padding: 10, marginBottom: 12, borderWidth: 1, borderColor: "#BFDBFE" },
  hintTxt: { fontSize: 11, color: C_BLUE, lineHeight: 16 },

  // Tabel produk — FIX: style kolom didefinisikan di StyleSheet
  tableHeader:         { flexDirection: "row", backgroundColor: C_TEXT, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 4 },
  tableHeaderTxt:      { fontSize: 10, color: "#fff", fontWeight: "700" },
  tableColQty:         { flex: 1, textAlign: "center" },
  tableColLaba:        { flex: 2, textAlign: "right" },
  tableColMarginHead:  { flex: 1, textAlign: "right" },
  produkRow:           { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C_BORDER },
  produkRowAlt:        { backgroundColor: "#F8FAFC" },
  produkColName:       { flex: 3 },                          // FIX ✅
  produkColMargin:     { flex: 1, alignItems: "flex-end" },  // FIX ✅
  produkName:          { fontSize: 12, fontWeight: "700", color: C_TEXT },
  produkPriceSub:      { fontSize: 10, color: C_SUB, marginTop: 1 },
  produkCell:          { fontSize: 12, fontWeight: "600", color: C_TEXT },
  marginBadge:         { borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2, borderWidth: 1 },
  marginBadgeTxt:      { fontSize: 10, fontWeight: "700" },
  produkTotal:         { flexDirection: "row", justifyContent: "space-between", padding: 14, backgroundColor: C_CARD, borderTopWidth: 2, borderTopColor: C_BORDER, marginTop: 4, borderRadius: 8 },
  produkTotalLabel:    { fontSize: 13, fontWeight: "700", color: C_TEXT },
  produkTotalVal:      { fontSize: 14, fontWeight: "900" },

  // Beban
  bebanHeaderRow:       { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  addBebanBtn:          { backgroundColor: C_BLUE, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  addBebanTxt:          { color: "#fff", fontWeight: "700", fontSize: 13 },
  bebanForm:            { backgroundColor: C_CARD, borderRadius: 14, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: C_BORDER },
  formLabel:            { fontSize: 12, color: C_SUB, fontWeight: "700", marginBottom: 6, marginTop: 10 },
  formInput:            { backgroundColor: C_BG, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: C_TEXT, fontSize: 14, borderWidth: 1.5, borderColor: C_BORDER },
  formSaveBtn:          { backgroundColor: C_BLUE, borderRadius: 10, paddingVertical: 12, alignItems: "center", marginTop: 16 },
  formSaveBtnTxt:       { color: "#fff", fontWeight: "800", fontSize: 14 },
  bebanRow:             { flexDirection: "row", alignItems: "center", backgroundColor: C_CARD, borderRadius: 10, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: C_BORDER, elevation: 1, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 2, shadowOffset: SHADOW_SM },
  bebanLeft:            { flex: 1 },
  bebanName:            { fontSize: 13, fontWeight: "700", color: C_TEXT },
  bebanJumlah:          { fontSize: 13, fontWeight: "800", color: C_ORANGE, marginRight: 10 },
  bebanDeleteBtn:       { padding: 4 },
  bebanDeleteTxt:       { fontSize: 18 },
  bebanTotalRow:        { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#FFF7ED", borderRadius: 10, padding: 14, marginTop: 4, borderWidth: 1, borderColor: "#FED7AA" },
  bebanTotalLabel:      { fontSize: 13, fontWeight: "700", color: C_TEXT },
  bebanTotalVal:        { fontSize: 15, fontWeight: "900" },
  bebanImpact:          { backgroundColor: C_CARD, borderRadius: 14, padding: 16, marginTop: 12, borderWidth: 1, borderColor: C_BORDER },
  bebanImpactTitle:     { fontSize: 13, fontWeight: "800", color: C_TEXT, marginBottom: 12 },
  bebanImpactRow:       { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: C_BORDER },
  bebanImpactRowTotal:  { borderBottomWidth: 0, paddingTop: 10, marginTop: 2 },
  bebanImpactLabel:     { fontSize: 13, color: C_SUB },
  bebanImpactVal:       { fontSize: 13, fontWeight: "700" },
  bebanImpactLabelBold: { fontSize: 14, fontWeight: "800", color: C_TEXT },
  bebanImpactValBold:   { fontSize: 16, fontWeight: "900" },
});