// src/screens/LaporanScreen.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface TransactionItem {
  name:     string;
  price:    number;
  qty:      number;
  subtotal: number;
}
interface Transaction {
  id:          string;
  ownerId:     string;
  kasirName:   string;
  namaToko:    string;
  items:       TransactionItem[];
  subtotal:    number;
  diskon:      number;
  total:       number;
  bayar:       number;
  kembalian:   number;
  metodeBayar: string;
  createdAt:   string;
  tanggal:     string;
}
interface StoreProduct {
  id:        string;
  ownerId:   string;
  name:      string;
  price:     number;
  buyPrice?: number;
  stock:     number;
}
interface LaporanScreenProps {
  ownerId?: string;
  onBack?:  () => void;
  route?:   { params?: { ownerId?: string } };
}
interface TopProduk {
  name:   string;
  qty:    number;
  omset:  number;
  profit: number;
}
interface KasirStats {
  name:      string;
  transaksi: number;
  omset:     number;
}
interface TrenData {
  label: string;
  omset: number;
  trx:   number;
}

const PERIOD_OPTIONS = [
  { label: "Hari Ini",  value: "today"     },
  { label: "7 Hari",    value: "7days"     },
  { label: "30 Hari",   value: "30days"    },
  { label: "Bulan Ini", value: "thisMonth" },
];
const SHADOW_DOWN = { width: 0, height: 2 };

function txKey(ownerId: string): string { return "@twd_tx_" + ownerId; }
function getItemKey(item: Transaction, index: number): string { return item.id + "_" + String(index); }
function formatRp(n: number): string { return "Rp " + Math.round(n).toLocaleString("id-ID"); }
function formatRpShort(n: number): string {
  if (n >= 1_000_000) return "Rp " + (n / 1_000_000).toFixed(1) + "jt";
  if (n >= 1_000)     return "Rp " + (n / 1_000).toFixed(0) + "rb";
  return "Rp " + Math.round(n).toLocaleString("id-ID");
}
function formatDate(iso: string): string {
  const d = new Date(iso);
  return (
    d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) +
    " " + d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
  );
}
function getPeriodStart(period: string): Date {
  const now = new Date();
  if (period === "today")     return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === "7days")     return new Date(now.getTime() - 7  * 86400000);
  if (period === "30days")    return new Date(now.getTime() - 30 * 86400000);
  if (period === "thisMonth") return new Date(now.getFullYear(), now.getMonth(), 1);
  return new Date(0);
}
function hitungHPP(items: TransactionItem[], bpMap: Record<string, number>): number {
  return items.reduce((sum, item) => sum + (bpMap[item.name] ?? 0) * item.qty, 0);
}
function buildTopProduk(transactions: Transaction[], bpMap: Record<string, number>): TopProduk[] {
  const map: Record<string, TopProduk> = {};
  transactions.forEach((tx) => {
    tx.items.forEach((i) => {
      if (!map[i.name]) map[i.name] = { name: i.name, qty: 0, omset: 0, profit: 0 };
      const bp = bpMap[i.name] ?? 0;
      map[i.name].qty    += i.qty;
      map[i.name].omset  += i.subtotal;
      map[i.name].profit += i.subtotal - bp * i.qty;
    });
  });
  return Object.values(map).sort((a, b) => b.qty - a.qty).slice(0, 8);
}
function buildKasirStats(transactions: Transaction[]): KasirStats[] {
  const map: Record<string, KasirStats> = {};
  transactions.forEach((tx) => {
    const name = tx.kasirName || "Tidak Diketahui";
    if (!map[name]) map[name] = { name, transaksi: 0, omset: 0 };
    map[name].transaksi += 1;
    map[name].omset     += tx.total;
  });
  return Object.values(map).sort((a, b) => b.omset - a.omset);
}
function buildTrenData(transactions: Transaction[], period: string): TrenData[] {
  const days  = period === "today" ? 1 : period === "7days" ? 7 : 30;
  if (days <= 1) return [];
  const limit = Math.min(days, 14);
  const result: TrenData[] = [];
  for (let i = limit - 1; i >= 0; i--) {
    const d        = new Date(Date.now() - i * 86400000);
    const key      = d.toISOString().slice(0, 10);
    const label    = (d.getMonth() + 1) + "/" + d.getDate();
    const filtered = transactions.filter((tx) => tx.createdAt.slice(0, 10) === key);
    result.push({ label, omset: filtered.reduce((s, tx) => s + tx.total, 0), trx: filtered.length });
  }
  return result;
}

function buildHtmlReport(
  transactions:  Transaction[],
  periodLabel:   string,
  totalOmzet:    number,
  totalDiskon:   number,
  totalHPP:      number,
  totalProfit:   number,
  storeName:     string,
  topProduk:     TopProduk[],
  kasirStats:    KasirStats[],
  totalTunai:    number,
  totalTransfer: number,
  hasBuyPrice:   boolean,
): string {
  const rowsHtml = transactions.map((tx) =>
    "<tr>" +
    "<td>" + formatDate(tx.createdAt) + "</td>" +
    "<td>" + tx.kasirName + "</td>" +
    "<td>" + tx.items.map((i) => i.qty + "x " + i.name).join(", ") + "</td>" +
    "<td>" + tx.metodeBayar + "</td>" +
    "<td style='text-align:right'>" + formatRp(tx.diskon) + "</td>" +
    "<td style='text-align:right;font-weight:600;color:#0ea5e9'>" + formatRp(tx.total) + "</td>" +
    "</tr>"
  ).join("");

  const topRows = topProduk.map((p, i) =>
    "<tr style='background:" + (i % 2 === 0 ? "#fff" : "#f8fafc") + "'>" +
    "<td style='padding:7px 10px;font-weight:700;color:#64748b'>" + (i + 1) + "</td>" +
    "<td style='padding:7px 10px;font-weight:600'>" + p.name + "</td>" +
    "<td style='padding:7px 10px;text-align:center'>" + p.qty + " pcs</td>" +
    "<td style='padding:7px 10px;text-align:right;color:#0ea5e9;font-weight:700'>" + formatRp(p.omset) + "</td>" +
    (hasBuyPrice ? "<td style='padding:7px 10px;text-align:right;color:#16a34a;font-weight:700'>" + formatRp(p.profit) + "</td>" : "") +
    "</tr>"
  ).join("");

  const kasirRows = kasirStats.map((k, i) =>
    "<tr style='background:" + (i % 2 === 0 ? "#fff" : "#f8fafc") + "'>" +
    "<td style='padding:7px 10px;font-weight:600'>" + k.name + "</td>" +
    "<td style='padding:7px 10px;text-align:center'>" + k.transaksi + "x</td>" +
    "<td style='padding:7px 10px;text-align:right;color:#0ea5e9;font-weight:700'>" + formatRp(k.omset) + "</td>" +
    "</tr>"
  ).join("");

  const profitSection = hasBuyPrice
    ? "<h3>Rekap Profit</h3>" +
      "<div class='summary'>" +
      "<div class='sum-card'><div class='sum-label'>HPP (Modal)</div><div class='sum-val'>" + formatRp(totalHPP) + "</div></div>" +
      "<div class='sum-card' style='background:#f0fdf4'><div class='sum-label'>Profit Bersih</div><div class='sum-val' style='color:#16a34a'>" + formatRp(totalProfit) + "</div></div>" +
      "<div class='sum-card'><div class='sum-label'>Margin</div><div class='sum-val'>" + (totalOmzet > 0 ? Math.round((totalProfit / totalOmzet) * 100) : 0) + "%</div></div>" +
      "</div>"
    : "";

  return (
    "<!DOCTYPE html><html><head><meta charset='utf-8'><style>" +
    "body{font-family:Arial,sans-serif;padding:24px;color:#1e293b}" +
    "h1{font-size:22px;margin-bottom:4px;color:#0ea5e9}" +
    "h2{font-size:13px;color:#64748b;font-weight:normal;margin-bottom:20px}" +
    "h3{font-size:14px;margin:20px 0 10px;color:#1e293b;border-bottom:2px solid #0ea5e9;padding-bottom:6px}" +
    ".summary{display:flex;gap:16px;margin-bottom:24px;flex-wrap:wrap}" +
    ".sum-card{background:#f1f5f9;border-radius:10px;padding:14px 20px;min-width:130px}" +
    ".sum-label{font-size:11px;color:#64748b}" +
    ".sum-val{font-size:18px;font-weight:700;color:#1e293b;margin-top:4px}" +
    ".metode-row{display:flex;gap:12px;margin-bottom:20px}" +
    ".metode-card{flex:1;background:#e0f2fe;border-radius:8px;padding:10px 14px}" +
    ".metode-label{font-size:11px;color:#0369a1}" +
    ".metode-val{font-size:14px;font-weight:700;color:#0ea5e9}" +
    "table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:24px}" +
    "th{background:#1e293b;color:#fff;padding:8px 10px;text-align:left}" +
    "td{padding:7px 10px;border-bottom:1px solid #e2e8f0}" +
    "tr:nth-child(even){background:#f8fafc}" +
    ".footer{margin-top:30px;font-size:11px;color:#94a3b8;text-align:center;border-top:1px solid #e2e8f0;padding-top:12px}" +
    "</style></head><body>" +
    "<h1>Laporan Penjualan — " + storeName + "</h1>" +
    "<h2>Periode: " + periodLabel + " &nbsp;|&nbsp; Dicetak: " + formatDate(new Date().toISOString()) + "</h2>" +
    "<div class='summary'>" +
    "<div class='sum-card'><div class='sum-label'>Total Transaksi</div><div class='sum-val'>" + String(transactions.length) + "</div></div>" +
    "<div class='sum-card'><div class='sum-label'>Total Omzet</div><div class='sum-val' style='color:#0ea5e9'>" + formatRp(totalOmzet) + "</div></div>" +
    "<div class='sum-card'><div class='sum-label'>Total Diskon</div><div class='sum-val'>" + formatRp(totalDiskon) + "</div></div>" +
    "</div>" +
    profitSection +
    "<div class='metode-row'>" +
    "<div class='metode-card'><div class='metode-label'>Tunai</div><div class='metode-val'>" + formatRp(totalTunai) + "</div></div>" +
    "<div class='metode-card'><div class='metode-label'>Transfer/QRIS</div><div class='metode-val'>" + formatRp(totalTransfer) + "</div></div>" +
    "</div>" +
    (topProduk.length > 0
      ? "<h3>Top Produk Terlaris</h3><table><tr><th>#</th><th>Produk</th><th style='text-align:center'>Qty</th><th style='text-align:right'>Omset</th>" +
        (hasBuyPrice ? "<th style='text-align:right'>Profit</th>" : "") + "</tr>" + topRows + "</table>"
      : "") +
    (kasirStats.length > 0
      ? "<h3>Performa Kasir</h3><table><tr><th>Kasir</th><th style='text-align:center'>Transaksi</th><th style='text-align:right'>Omset</th></tr>" + kasirRows + "</table>"
      : "") +
    "<h3>Riwayat Transaksi</h3>" +
    "<table><tr><th>Waktu</th><th>Kasir</th><th>Item</th><th>Metode</th><th>Diskon</th><th>Total</th></tr>" +
    rowsHtml + "</table>" +
    "<div class='footer'>TWD POS — Laporan dibuat otomatis</div>" +
    "</body></html>"
  );
}
export default function LaporanScreen(props: LaporanScreenProps) {
  const insets          = useSafeAreaInsets();
  const resolvedOwnerId = String(props.ownerId ?? props.route?.params?.ownerId ?? "").trim();

  const [transactions,  setTransactions]  = useState<Transaction[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [period,        setPeriod]        = useState("today");
  const [exporting,     setExporting]     = useState(false);
  const [selectedTx,    setSelectedTx]    = useState<Transaction | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [storeName,     setStoreName]     = useState("Toko");
  const [topProduk,     setTopProduk]     = useState<TopProduk[]>([]);
  const [kasirStats,    setKasirStats]    = useState<KasirStats[]>([]);
  const [trenData,      setTrenData]      = useState<TrenData[]>([]);
  const [buyPriceMap,   setBuyPriceMap]   = useState<Record<string, number>>({});
  const [hasBuyPrice,   setHasBuyPrice]   = useState(false);

  const loadData = useCallback(async (selectedPeriod: string) => {
    setLoading(true);
    try {
      const storeRaw = await AsyncStorage.getItem("@twd_store_info_" + resolvedOwnerId);
      if (storeRaw) {
        const si = JSON.parse(storeRaw);
        setStoreName(si.namaToko ?? "Toko");
      }

      // Build buyPriceMap dari @twd_products
      const produkRaw = await AsyncStorage.getItem("@twd_products");
      const allProduk: StoreProduct[] = produkRaw ? JSON.parse(produkRaw) : [];
      const bpMap: Record<string, number> = {};
      let   anyBP = false;
      allProduk
        .filter((p) => String(p.ownerId ?? "").trim() === resolvedOwnerId)
        .forEach((p) => {
          if (p.buyPrice && p.buyPrice > 0) {
            bpMap[p.name] = p.buyPrice;
            anyBP         = true;
          }
        });
      setBuyPriceMap(bpMap);
      setHasBuyPrice(anyBP);

      // Load transaksi
      const raw = await AsyncStorage.getItem(txKey(resolvedOwnerId));
      const all: Transaction[] = raw ? JSON.parse(raw) : [];
      const periodStart = getPeriodStart(selectedPeriod);
      const filtered = all
        .filter((tx) => new Date(tx.createdAt).getTime() >= periodStart.getTime())
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      setTransactions(filtered);
      setTopProduk(buildTopProduk(filtered, bpMap));
      setKasirStats(buildKasirStats(filtered));
      setTrenData(buildTrenData(filtered, selectedPeriod));
    } catch (e) {
      console.error("LaporanScreen loadData error", e);
    } finally {
      setLoading(false);
    }
  }, [resolvedOwnerId]);

  React.useEffect(() => { loadData(period); }, [loadData, period]);

  const totalOmzet    = transactions.reduce((s, tx) => s + tx.total, 0);
  const totalDiskon   = transactions.reduce((s, tx) => s + tx.diskon, 0);
  const totalTunai    = transactions.filter((tx) => tx.metodeBayar === "Tunai").reduce((s, tx) => s + tx.total, 0);
  const totalTransfer = transactions.filter((tx) => tx.metodeBayar !== "Tunai").reduce((s, tx) => s + tx.total, 0);
  const totalHPP      = hasBuyPrice ? transactions.reduce((s, tx) => s + hitungHPP(tx.items, buyPriceMap), 0) : 0;
  const totalProfit   = totalOmzet - totalHPP - totalDiskon;
  const marginPct     = totalOmzet > 0 ? Math.round((totalProfit / totalOmzet) * 100) : 0;

  const exportPdf = async () => {
    if (transactions.length === 0) { Alert.alert("Tidak ada data", "Tidak ada transaksi untuk diekspor."); return; }
    setExporting(true);
    try {
      const lbl  = PERIOD_OPTIONS.find((p) => p.value === period)?.label ?? period;
      const html = buildHtmlReport(
        transactions, lbl, totalOmzet, totalDiskon, totalHPP, totalProfit,
        storeName, topProduk, kasirStats, totalTunai, totalTransfer, hasBuyPrice
      );
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: "Ekspor Laporan PDF", UTI: "com.adobe.pdf" });
      } else {
        Alert.alert("Berhasil", "File PDF tersimpan di: " + uri);
      }
    } catch { Alert.alert("Error", "Gagal membuat PDF."); }
    finally { setExporting(false); }
  };

  const handlePrint = async () => {
    if (transactions.length === 0) { Alert.alert("Tidak ada data", "Tidak ada transaksi untuk dicetak."); return; }
    try {
      const lbl  = PERIOD_OPTIONS.find((p) => p.value === period)?.label ?? period;
      const html = buildHtmlReport(
        transactions, lbl, totalOmzet, totalDiskon, totalHPP, totalProfit,
        storeName, topProduk, kasirStats, totalTunai, totalTransfer, hasBuyPrice
      );
      await Print.printAsync({ html });
    } catch { Alert.alert("Gagal Print", "Tidak dapat membuka dialog print."); }
  };

  const openDetail   = (tx: Transaction) => { setSelectedTx(tx); setDetailVisible(true); };
  const periodLabel  = PERIOD_OPTIONS.find((p) => p.value === period)?.label ?? period;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top + 12, 52) }]}>
        {props.onBack && (
          <TouchableOpacity style={styles.backBtn} onPress={props.onBack}>
            <Text style={styles.backBtnText}>{"< Kembali"}</Text>
          </TouchableOpacity>
        )}
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>{"Laporan"}</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.printBtn} onPress={handlePrint} disabled={exporting || loading}>
              <Text style={styles.printBtnText}>{"🖨️"}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={exporting ? styles.exportBtnDisabled : styles.exportBtn}
              onPress={exportPdf} disabled={exporting}
            >
              {exporting
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.exportBtnText}>{"⬇ PDF"}</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Periode */}
      <View style={styles.periodRow}>
        {PERIOD_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={period === opt.value ? styles.periodActive : styles.periodInactive}
            onPress={() => setPeriod(opt.value)}
          >
            <Text style={period === opt.value ? styles.periodTextActive : styles.periodTextInactive}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#0ea5e9" /></View>
      ) : (
       <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }} showsVerticalScrollIndicator={false}>

          {/* Summary Baris 1 */}
          <View style={styles.summaryRow}>
            <View style={styles.sumCard}>
              <Text style={styles.sumLabel}>{"Transaksi"}</Text>
              <Text style={styles.sumVal}>{String(transactions.length)}</Text>
            </View>
            <View style={styles.sumCard}>
              <Text style={styles.sumLabel}>{"Omzet"}</Text>
              <Text style={styles.sumValSmall}>{formatRp(totalOmzet)}</Text>
            </View>
            <View style={styles.sumCard}>
              <Text style={styles.sumLabel}>{"Diskon"}</Text>
              <Text style={styles.sumValSmall}>{formatRp(totalDiskon)}</Text>
            </View>
          </View>

          {/* Summary Baris 2 — Metode */}
          <View style={styles.summaryRow}>
            <View style={styles.sumCardWide}>
              <Text style={styles.sumLabel}>{"💵 Tunai"}</Text>
              <Text style={styles.sumValSmall}>{formatRp(totalTunai)}</Text>
            </View>
            <View style={styles.sumCardWide}>
              <Text style={styles.sumLabel}>{"🏦 Transfer/QRIS"}</Text>
              <Text style={styles.sumValSmall}>{formatRp(totalTransfer)}</Text>
            </View>
          </View>

          {/* Summary Profit — hanya tampil kalau ada buyPrice */}
          {hasBuyPrice && (
            <View style={styles.summaryRow}>
              <View style={styles.sumCard}>
                <Text style={styles.sumLabel}>{"HPP (Modal)"}</Text>
                <Text style={[styles.sumValSmall, { color: "#64748b" }]}>{formatRp(totalHPP)}</Text>
              </View>
              <View style={[styles.sumCard, { backgroundColor: "#f0fdf4" }]}>
                <Text style={styles.sumLabel}>{"Profit Bersih"}</Text>
                <Text style={[styles.sumValSmall, { color: "#16a34a" }]}>{formatRp(totalProfit)}</Text>
              </View>
              <View style={styles.sumCard}>
                <Text style={styles.sumLabel}>{"Margin"}</Text>
                <Text style={[styles.sumValSmall, { color: "#0ea5e9" }]}>{marginPct + "%"}</Text>
              </View>
            </View>
          )}

          {/* Tren Harian */}
          {trenData.length > 0 && (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>{"📈 Tren Harian"}</Text>
              {(() => {
                const maxOmset = Math.max(...trenData.map((d) => d.omset), 1);
                return trenData.map((d) => {
                  const pct = Math.round((d.omset / maxOmset) * 100);
                  return (
                    <View key={d.label} style={styles.trenRow}>
                      <Text style={styles.trenLabel}>{d.label}</Text>
                      <View style={styles.trenBarBg}>
                        <View style={[styles.trenBarFill, { width: (pct + "%") as any, backgroundColor: d.omset > 0 ? "#0ea5e9" : "#e2e8f0" }]} />
                      </View>
                      <Text style={styles.trenVal}>{d.omset > 0 ? formatRpShort(d.omset) : "-"}</Text>
                      <Text style={styles.trenTrx}>{d.trx > 0 ? d.trx + "x" : ""}</Text>
                    </View>
                  );
                });
              })()}
            </View>
          )}

          {/* Top Produk */}
          {topProduk.length > 0 && (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>{"🏆 Top Produk Terlaris"}</Text>
              {topProduk.map((p, i) => (
                <View key={p.name} style={styles.topRow}>
                  <Text style={styles.topRank}>{String(i + 1)}</Text>
                  <View style={styles.topInfo}>
                    <Text style={styles.topName} numberOfLines={1}>{p.name}</Text>
                    <Text style={styles.topSub}>{p.qty + " pcs terjual"}</Text>
                  </View>
                  <View style={styles.topRight}>
                    <Text style={styles.topOmset}>{formatRpShort(p.omset)}</Text>
                    {hasBuyPrice && p.profit > 0 && (
                      <Text style={styles.topProfit}>{"+" + formatRpShort(p.profit)}</Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Performa Kasir */}
          {kasirStats.length > 1 && (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>{"👥 Performa Kasir"}</Text>
              {kasirStats.map((k, i) => (
                <View key={k.name} style={styles.kasirRow}>
                  <View style={[styles.kasirBadge, { backgroundColor: i === 0 ? "#fbbf24" : "#94a3b8" }]}>
                    <Text style={styles.kasirBadgeTxt}>{String(i + 1)}</Text>
                  </View>
                  <View style={styles.kasirInfo}>
                    <Text style={styles.kasirName}>{k.name}</Text>
                    <Text style={styles.kasirTrx}>{k.transaksi + " transaksi"}</Text>
                  </View>
                  <Text style={styles.kasirOmset}>{formatRpShort(k.omset)}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Riwayat Transaksi */}
          {transactions.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>{"Belum ada transaksi " + periodLabel.toLowerCase() + "."}</Text>
            </View>
          ) : (
            <View style={styles.txSection}>
              <Text style={styles.txSectionTitle}>{"Riwayat Transaksi (" + String(transactions.length) + ")"}</Text>
              {transactions.map((tx, index) => (
                <TouchableOpacity key={getItemKey(tx, index)} style={styles.txCard} onPress={() => openDetail(tx)} activeOpacity={0.85}>
                  <View style={styles.txCardTop}>
                    <Text style={styles.txKasir}>{tx.kasirName}</Text>
                    <Text style={styles.txTotal}>{formatRp(tx.total)}</Text>
                  </View>
                  <View style={styles.txCardBottom}>
                    <Text style={styles.txMetode}>{tx.metodeBayar}</Text>
                    <Text style={styles.txDate}>{formatDate(tx.createdAt)}</Text>
                  </View>
                  {tx.diskon > 0 && (
                    <Text style={styles.txDiskon}>{"Diskon: " + formatRp(tx.diskon)}</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {/* Modal Detail Transaksi */}
      <Modal visible={detailVisible} animationType="slide" onRequestClose={() => setDetailVisible(false)}>
        <View style={styles.modalContainer}>
          <View style={[styles.modalHeader, { paddingTop: Math.max(insets.top + 16, 56) }]}>
            <Text style={styles.modalTitle}>{"Detail Transaksi"}</Text>
            <TouchableOpacity onPress={() => setDetailVisible(false)}>
              <Text style={styles.modalClose}>{"✕"}</Text>
            </TouchableOpacity>
          </View>
          {selectedTx !== null && (
            <ScrollView style={styles.modalBody}>
              <Text style={styles.detailSection}>{"INFO"}</Text>
              <Text style={styles.detailRow}>{"Kasir: " + selectedTx.kasirName}</Text>
              <Text style={styles.detailRow}>{"Toko: " + selectedTx.namaToko}</Text>
              <Text style={styles.detailRow}>{"Waktu: " + formatDate(selectedTx.createdAt)}</Text>
              <Text style={styles.detailRow}>{"Metode: " + selectedTx.metodeBayar}</Text>
              <Text style={styles.detailSection}>{"ITEM"}</Text>
              {selectedTx.items.map((it, idx) => (
                <Text key={String(idx)} style={styles.detailRow}>
                  {it.qty + "x " + it.name + " — " + formatRp(it.subtotal)}
                </Text>
              ))}
              <Text style={styles.detailSection}>{"RINGKASAN"}</Text>
              <View style={styles.detailSumRow}>
                <Text style={styles.detailSumLabel}>{"Subtotal"}</Text>
                <Text style={styles.detailSumVal}>{formatRp(selectedTx.subtotal)}</Text>
              </View>
              <View style={styles.detailSumRow}>
                <Text style={styles.detailSumLabel}>{"Diskon"}</Text>
                <Text style={styles.detailSumVal}>{formatRp(selectedTx.diskon)}</Text>
              </View>
              <View style={styles.detailSumRowTotal}>
                <Text style={styles.detailSumLabelTotal}>{"Total"}</Text>
                <Text style={styles.detailSumValTotal}>{formatRp(selectedTx.total)}</Text>
              </View>
              <View style={styles.detailSumRow}>
                <Text style={styles.detailSumLabel}>{"Bayar"}</Text>
                <Text style={styles.detailSumVal}>{formatRp(selectedTx.bayar)}</Text>
              </View>
              <View style={styles.detailSumRow}>
                <Text style={styles.detailSumLabel}>{"Kembalian"}</Text>
                <Text style={styles.detailSumVal}>{formatRp(selectedTx.kembalian)}</Text>
              </View>
            </ScrollView>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  center:    { flex: 1, justifyContent: "center", alignItems: "center" },
  header:         { backgroundColor: "#0ea5e9", paddingBottom: 16, paddingHorizontal: 20 },
  headerRow:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  headerActions:  { flexDirection: "row", gap: 8, alignItems: "center" },
  backBtn:        { marginBottom: 8 },
  backBtnText:    { color: "rgba(255,255,255,0.85)", fontSize: 14 },
  headerTitle:    { fontSize: 22, fontWeight: "700", color: "#fff" },
  printBtn:       { backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  printBtnText:   { fontSize: 16 },
  exportBtn:         { backgroundColor: "rgba(255,255,255,0.25)", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7 },
  exportBtnDisabled: { backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7 },
  exportBtnText:  { color: "#fff", fontWeight: "600", fontSize: 13 },
  periodRow:          { flexDirection: "row", margin: 14, gap: 8 },
  periodActive:       { flex: 1, backgroundColor: "#0ea5e9", borderRadius: 8, paddingVertical: 8, alignItems: "center" },
  periodInactive:     { flex: 1, backgroundColor: "#e2e8f0", borderRadius: 8, paddingVertical: 8, alignItems: "center" },
  periodTextActive:   { color: "#fff", fontWeight: "600", fontSize: 12 },
  periodTextInactive: { color: "#64748b", fontSize: 12 },
  scroll: { flex: 1 },
  summaryRow:  { flexDirection: "row", marginHorizontal: 14, marginBottom: 8, gap: 8 },
  sumCard:     { flex: 1, backgroundColor: "#fff", borderRadius: 12, padding: 14, alignItems: "center", elevation: 2, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: SHADOW_DOWN },
  sumCardWide: { flex: 1, backgroundColor: "#fff", borderRadius: 12, padding: 14, alignItems: "center", elevation: 2, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: SHADOW_DOWN },
  sumLabel:    { fontSize: 11, color: "#64748b", marginBottom: 4, textAlign: "center" },
  sumVal:      { fontSize: 24, fontWeight: "700", color: "#1e293b" },
  sumValSmall: { fontSize: 13, fontWeight: "700", color: "#0ea5e9", textAlign: "center" },
  sectionCard:  { backgroundColor: "#fff", borderRadius: 14, marginHorizontal: 14, marginBottom: 12, padding: 16, elevation: 2, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: SHADOW_DOWN },
  sectionTitle: { fontSize: 13, fontWeight: "800", color: "#1e293b", marginBottom: 14 },
  trenRow:    { flexDirection: "row", alignItems: "center", paddingVertical: 4, gap: 6 },
  trenLabel:  { fontSize: 10, color: "#374151", width: 36 },
  trenBarBg:  { flex: 1, height: 10, backgroundColor: "#e2e8f0", borderRadius: 5, overflow: "hidden" },
  trenBarFill:{ height: 10, borderRadius: 5 },
  trenVal:    { fontSize: 10, fontWeight: "700", color: "#0ea5e9", width: 52, textAlign: "right" },
  trenTrx:    { fontSize: 10, color: "#94a3b8", width: 22, textAlign: "right" },
  topRow:    { flexDirection: "row", alignItems: "center", paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: "#f1f5f9", gap: 10 },
  topRank:   { fontSize: 13, fontWeight: "800", color: "#94a3b8", width: 20, textAlign: "center" },
  topInfo:   { flex: 1 },
  topName:   { fontSize: 13, fontWeight: "700", color: "#1e293b" },
  topSub:    { fontSize: 11, color: "#94a3b8", marginTop: 1 },
  topRight:  { alignItems: "flex-end" },
  topOmset:  { fontSize: 12, fontWeight: "800", color: "#0ea5e9" },
  topProfit: { fontSize: 11, fontWeight: "700", color: "#16a34a", marginTop: 2 },
  kasirRow:     { flexDirection: "row", alignItems: "center", paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: "#f1f5f9", gap: 10 },
  kasirBadge:   { width: 24, height: 24, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  kasirBadgeTxt:{ color: "#fff", fontSize: 11, fontWeight: "800" },
  kasirInfo:    { flex: 1 },
  kasirName:    { fontSize: 13, fontWeight: "700", color: "#1e293b" },
  kasirTrx:     { fontSize: 11, color: "#94a3b8", marginTop: 1 },
  kasirOmset:   { fontSize: 13, fontWeight: "800", color: "#0ea5e9" },
  txSection:      { margin: 14, marginTop: 6 },
  txSectionTitle: { fontSize: 13, fontWeight: "700", color: "#64748b", marginBottom: 10 },
  txCard:         { backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 8, elevation: 1, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: SHADOW_DOWN },
  txCardTop:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  txKasir:        { fontSize: 14, fontWeight: "600", color: "#1e293b" },
  txTotal:        { fontSize: 15, fontWeight: "700", color: "#0ea5e9" },
  txCardBottom:   { flexDirection: "row", justifyContent: "space-between" },
  txMetode:       { fontSize: 12, color: "#64748b" },
  txDate:         { fontSize: 11, color: "#94a3b8" },
  txDiskon:       { fontSize: 12, color: "#f59e0b", marginTop: 4 },
  emptyBox:  { alignItems: "center", paddingVertical: 48 },
  emptyText: { color: "#94a3b8", fontSize: 15 },
  modalContainer:      { flex: 1, backgroundColor: "#f8fafc" },
  modalHeader:         { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, backgroundColor: "#0ea5e9" },
  modalTitle:          { fontSize: 18, fontWeight: "700", color: "#fff" },
  modalClose:          { fontSize: 20, color: "#fff", fontWeight: "700" },
  modalBody:           { padding: 20 },
  detailSection:       { fontSize: 11, fontWeight: "700", color: "#0ea5e9", letterSpacing: 1, marginTop: 20, marginBottom: 6 },
  detailRow:           { fontSize: 14, color: "#334155", paddingVertical: 3 },
  detailSumRow:        { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  detailSumLabel:      { fontSize: 14, color: "#64748b" },
  detailSumVal:        { fontSize: 14, color: "#334155" },
  detailSumRowTotal:   { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderTopWidth: 1, borderTopColor: "#e2e8f0", borderBottomWidth: 1, borderBottomColor: "#e2e8f0", marginVertical: 4 },
  detailSumLabelTotal: { fontSize: 15, fontWeight: "700", color: "#1e293b" },
  detailSumValTotal:   { fontSize: 15, fontWeight: "700", color: "#0ea5e9" },
});