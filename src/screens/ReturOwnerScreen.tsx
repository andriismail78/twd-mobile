// src/screens/ReturOwnerScreen.tsx — v3 (GABUNGAN LENGKAP)
// Base: versi Anda (Modal slide-up, checklist, processedBy, useFocusEffect, SafeArea)
// Tambahan: statistik summary, search filter, delete riwayat, autoOpenId

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReturItem {
  name:     string;
  maxQty:   number;
  qtyRetur: number;
  price:    number;
}

interface ReturRequest {
  id:            string;
  ownerId:       string;
  txId:          string;
  txDate:        string;
  txTime:        string;
  kasirName:     string;
  namaToko:      string;
  items:         ReturItem[];
  totalRetur:    number;
  alasan:        string;
  status:        "menunggu" | "disetujui" | "ditolak";
  createdAt:     string;
  processedAt?:  string;
  processedBy?:  string;
  catatanOwner?: string;
}

interface StoreProduct {
  id:        string;
  ownerId:   string;
  name:      string;
  price:     number;
  buyPrice?: number;
  sellPrice?: number;
  stock:     number;
  stockMin?: number;
  category?: string;
  barcode?:  string;
  createdAt: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BLUE      = "#2563EB";
const GREEN     = "#16A34A";
const RED       = "#DC2626";
const ORANGE    = "#D97706";
const GRAY      = "#6B7280";
const LIGHT_BG  = "#F3F4F6";
const PRODUCTS_KEY = "@twd_products";
const SHADOW_DOWN  = { width: 0, height: 2 };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function returKey(ownerId: string): string {
  return "@twd_retur_" + ownerId;
}

function formatRp(n: number): string {
  return "Rp " + Math.round(n).toLocaleString("id-ID");
}

function statusColor(s: ReturRequest["status"]): string {
  return s === "menunggu" ? ORANGE : s === "disetujui" ? GREEN : RED;
}

function statusLabel(s: ReturRequest["status"]): string {
  return s === "menunggu" ? "⏳ Menunggu" : s === "disetujui" ? "✅ Disetujui" : "❌ Ditolak";
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  } as any);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("id-ID", {
    hour: "2-digit", minute: "2-digit",
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function ReturOwnerScreen({ route }: any) {
  const insets     = useSafeAreaInsets();
  const ownerId    = String(route?.params?.ownerId   ?? "").trim();
  const ownerName  = String(route?.params?.ownerName ?? "Owner");
  const autoOpenId = route?.params?.autoOpenId as string | undefined;

  const [requests,     setRequests]     = useState<ReturRequest[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [activeTab,    setActiveTab]    = useState<"menunggu" | "riwayat">("menunggu");
  const [selected,     setSelected]     = useState<ReturRequest | null>(null);
  const [showDetail,   setShowDetail]   = useState(false);
  const [catatanOwner, setCatatanOwner] = useState("");
  const [processing,   setProcessing]   = useState(false);

  // ── TAMBAHAN: search filter ───────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");

  // ── Load ─────────────────────────────────────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      loadRequests();
    }, [ownerId])
  );

  async function loadRequests() {
    setLoading(true);
    try {
      const raw = await AsyncStorage.getItem(returKey(ownerId));
      const all: ReturRequest[] = raw ? JSON.parse(raw) : [];
      all.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setRequests(all);
    } catch {
      Alert.alert("Error", "Gagal memuat permintaan retur.");
    } finally {
      setLoading(false);
    }
  }

  // ── TAMBAHAN: auto-open dari banner OwnerDashboard ────────────────────────
  useEffect(() => {
    if (!autoOpenId || requests.length === 0) return;
    const found = requests.find((r) => r.id === autoOpenId);
    if (found) {
      setSelected(found);
      setCatatanOwner("");
      setShowDetail(true);
    }
  }, [autoOpenId, requests]);

  function openDetail(req: ReturRequest) {
    setSelected(req);
    setCatatanOwner("");
    setShowDetail(true);
  }

  // ── Proses retur ─────────────────────────────────────────────────────────
  async function processRetur(action: "disetujui" | "ditolak") {
    if (!selected) return;
    setProcessing(true);
    try {
      const now = new Date().toISOString();
      if (action === "disetujui") {
        const rawP = await AsyncStorage.getItem(PRODUCTS_KEY);
        const allP: StoreProduct[] = rawP ? JSON.parse(rawP) : [];
        selected.items.forEach((ri) => {
          const idx = allP.findIndex(
            (p) => p.name === ri.name && String(p.ownerId ?? "").trim() === ownerId
          );
          if (idx >= 0) {
            allP[idx] = { ...allP[idx], stock: allP[idx].stock + ri.qtyRetur };
          }
        });
        await AsyncStorage.setItem(PRODUCTS_KEY, JSON.stringify(allP));
      }
      const rawR = await AsyncStorage.getItem(returKey(ownerId));
      const allR: ReturRequest[] = rawR ? JSON.parse(rawR) : [];
      const idx = allR.findIndex((r) => r.id === selected.id);
      if (idx >= 0) {
        allR[idx] = {
          ...allR[idx],
          status:       action,
          processedAt:  now,
          processedBy:  ownerName,
          catatanOwner: catatanOwner.trim() || undefined,
        };
      }
      await AsyncStorage.setItem(returKey(ownerId), JSON.stringify(allR));
      setShowDetail(false);
      await loadRequests();
      if (action === "disetujui") {
        Alert.alert(
          "✅ Retur Disetujui",
          "Stok " +
            selected.items.map((i) => i.name + " +" + i.qtyRetur).join(", ") +
            " telah dikembalikan ke gudang.\nTotal refund: " +
            formatRp(selected.totalRetur)
        );
      } else {
        Alert.alert(
          "❌ Retur Ditolak",
          "Permintaan retur dari " + selected.kasirName + " ditolak."
        );
      }
    } catch {
      Alert.alert("Error", "Gagal memproses retur.");
    } finally {
      setProcessing(false);
    }
  }

  function confirmProcess(action: "disetujui" | "ditolak") {
    if (!selected) return;
    const isApprove = action === "disetujui";
    Alert.alert(
      isApprove ? "Setujui Retur?" : "Tolak Retur?",
      isApprove
        ? "Total pengembalian: " +
          formatRp(selected.totalRetur) +
          "\nStok " + selected.items.length + " item akan dikembalikan ke gudang."
        : "Permintaan retur dari kasir " + selected.kasirName + " akan ditolak.",
      [
        { text: "Batal", style: "cancel" },
        {
          text: isApprove ? "✅ Ya, Setujui" : "❌ Ya, Tolak",
          style: isApprove ? "default" : "destructive",
          onPress: () => processRetur(action),
        },
      ]
    );
  }

  // ── TAMBAHAN: delete riwayat ──────────────────────────────────────────────
  function handleDelete(returId: string) {
    Alert.alert(
      "Hapus Riwayat?",
      "Hapus catatan retur ini dari daftar?",
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Hapus",
          style: "destructive",
          onPress: async () => {
            try {
              const raw = await AsyncStorage.getItem(returKey(ownerId));
              const all: ReturRequest[] = raw ? JSON.parse(raw) : [];
              await AsyncStorage.setItem(
                returKey(ownerId),
                JSON.stringify(all.filter((r) => r.id !== returId))
              );
              await loadRequests();
            } catch {
              Alert.alert("Error", "Gagal menghapus riwayat.");
            }
          },
        },
      ]
    );
  }

  // ── Data & filter ─────────────────────────────────────────────────────────
  const pendingList  = requests.filter((r) => r.status === "menunggu");
  const riwayatList  = requests.filter((r) => r.status !== "menunggu");
  const approvedCount = requests.filter((r) => r.status === "disetujui").length;
  const rejectedCount = requests.filter((r) => r.status === "ditolak").length;

  const baseList = activeTab === "menunggu" ? pendingList : riwayatList;

  // TAMBAHAN: apply search filter
  const displayList = searchQuery.trim()
    ? baseList.filter((r) => {
        const q = searchQuery.trim().toLowerCase();
        return (
          r.kasirName.toLowerCase().includes(q) ||
          r.txId.toLowerCase().includes(q) ||
          r.alasan.toLowerCase().includes(q)
        );
      })
    : baseList;

  // ─────────────────────────────────────────────────────────────────────────
  //  RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View style={[RS.container, { paddingTop: insets.top }]}>

      {/* ── Header ── */}
      <View style={RS.header}>
        <Text style={RS.headerTitle}>{"↩ Manajemen Retur"}</Text>
        <Text style={RS.headerSub}>
          {pendingList.length > 0
            ? pendingList.length + " permintaan menunggu persetujuan"
            : "Tidak ada permintaan baru"}
        </Text>
      </View>

      {/* ── TAMBAHAN: Statistik Summary ── */}
      <View style={RS.statsRow}>
        <View style={[RS.statItem, RS.statOrange]}>
          <Text style={RS.statNum}>{String(pendingList.length)}</Text>
          <Text style={RS.statLbl}>{"Menunggu"}</Text>
        </View>
        <View style={[RS.statItem, RS.statGreen]}>
          <Text style={RS.statNum}>{String(approvedCount)}</Text>
          <Text style={RS.statLbl}>{"Disetujui"}</Text>
        </View>
        <View style={[RS.statItem, RS.statRed]}>
          <Text style={RS.statNum}>{String(rejectedCount)}</Text>
          <Text style={RS.statLbl}>{"Ditolak"}</Text>
        </View>
        <View style={[RS.statItem, RS.statGray]}>
          <Text style={RS.statNum}>{String(requests.length)}</Text>
          <Text style={RS.statLbl}>{"Total"}</Text>
        </View>
      </View>

      {/* ── Tab Bar ── */}
      <View style={RS.tabBar}>
        {(["menunggu", "riwayat"] as const).map((key) => (
          <TouchableOpacity
            key={key}
            style={[RS.tab, activeTab === key && RS.tabActive]}
            onPress={() => { setActiveTab(key); setSearchQuery(""); }}
          >
            <Text style={[RS.tabTxt, activeTab === key && RS.tabTxtActive]}>
              {key === "menunggu" ? "⏳ Menunggu" : "📋 Riwayat"}
            </Text>
            {key === "menunggu" && pendingList.length > 0 && (
              <View style={RS.tabBadge}>
                <Text style={RS.tabBadgeTxt}>{pendingList.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* ── TAMBAHAN: Search Bar ── */}
      <View style={RS.searchBar}>
        <Text style={RS.searchIcon}>{"🔍"}</Text>
        <TextInput
          style={RS.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Cari nama kasir, ID transaksi, alasan..."
          placeholderTextColor="#9CA3AF"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery("")} style={RS.searchClearBtn}>
            <Text style={RS.searchClearTxt}>{"✕"}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── List ── */}
      {loading ? (
        <ActivityIndicator style={RS.loader} color={BLUE} size="large" />
      ) : displayList.length === 0 ? (
        <View style={RS.emptyCenter}>
          <Text style={RS.emptyIcon}>
            {searchQuery ? "🔍" : activeTab === "menunggu" ? "🎉" : "📋"}
          </Text>
          <Text style={RS.emptyTxt}>
            {searchQuery
              ? "Tidak ada hasil untuk \"" + searchQuery + "\""
              : activeTab === "menunggu"
              ? "Tidak ada permintaan retur"
              : "Belum ada retur yang diproses"}
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[RS.listContent, { paddingBottom: insets.bottom + 20 }]}
        >
          {displayList.map((req) => {
            const sc = statusColor(req.status);
            const sl = statusLabel(req.status);
            return (
              <TouchableOpacity
                key={req.id}
                style={RS.card}
                onPress={() => openDetail(req)}
                activeOpacity={0.8}
              >
                <View style={RS.cardHeader}>
                  <View style={RS.flex}>
                    <Text style={RS.cardKasir}>{"Kasir: " + req.kasirName}</Text>
                    <Text style={RS.cardToko}>{req.namaToko}</Text>
                  </View>
                  <View style={RS.cardHeaderRight}>
                    <View style={[RS.statusPill, { backgroundColor: sc + "22" }]}>
                      <Text style={[RS.statusPillTxt, { color: sc }]}>{sl}</Text>
                    </View>
                    {/* TAMBAHAN: tombol delete untuk riwayat */}
                    {req.status !== "menunggu" && (
                      <TouchableOpacity
                        style={RS.deleteBtn}
                        onPress={() => handleDelete(req.id)}
                        hitSlop={ {top: 8, bottom: 8, left: 8, right: 8} }
                      >
                        <Text style={RS.deleteBtnTxt}>{"🗑"}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                <Text style={RS.cardItems} numberOfLines={2}>
                  {"📦 " + req.items.map((i) => i.name + " ×" + i.qtyRetur).join(", ")}
                </Text>

                <Text style={RS.cardAlasan} numberOfLines={1}>
                  {"💬 \"" + req.alasan + "\""}
                </Text>

                <View style={RS.cardFooter}>
                  <View>
                    <Text style={RS.cardTxDate}>
                      {"Transaksi: " + req.txDate + " " + req.txTime}
                    </Text>
                    <Text style={RS.cardAjukan}>
                      {"Diajukan: " + formatDate(req.createdAt) + " " + formatTime(req.createdAt)}
                    </Text>
                  </View>
                  <Text style={RS.cardTotal}>{formatRp(req.totalRetur)}</Text>
                </View>

                {req.status === "menunggu" && (
                  <View style={RS.cardCta}>
                    <Text style={RS.cardCtaTxt}>{"Ketuk untuk tinjau dan proses →"}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          MODAL: DETAIL & KEPUTUSAN RETUR
      ══════════════════════════════════════════════════════════════════ */}
      <Modal
        visible={showDetail}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowDetail(false)}
      >
        {selected && (
          <View style={RS.flex}>
            {/* Modal header */}
            <View style={[RS.modalHeader, { paddingTop: insets.top + 8 }]}>
              <View style={RS.flex}>
                <Text style={RS.modalTitle}>{"Detail Permintaan Retur"}</Text>
                <View style={[RS.statusPillSm, { backgroundColor: statusColor(selected.status) + "22" }]}>
                  <Text style={[RS.statusPillSmTxt, { color: statusColor(selected.status) }]}>
                    {statusLabel(selected.status)}
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setShowDetail(false)}>
                <Text style={RS.modalCloseTxt}>{"✕"}</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={RS.modalContent}
              keyboardShouldPersistTaps="handled"
            >
              {/* ── Informasi Transaksi ── */}
              <View style={RS.section}>
                <Text style={RS.sectionTitle}>{"📋 Informasi Transaksi"}</Text>
                <View style={RS.infoRow}>
                  <Text style={RS.infoLabel}>{"Tanggal Beli"}</Text>
                  <Text style={RS.infoVal}>{selected.txDate + " — " + selected.txTime}</Text>
                </View>
                <View style={RS.infoRow}>
                  <Text style={RS.infoLabel}>{"Kasir"}</Text>
                  <Text style={RS.infoVal}>{selected.kasirName}</Text>
                </View>
                <View style={RS.infoRow}>
                  <Text style={RS.infoLabel}>{"Toko"}</Text>
                  <Text style={RS.infoVal}>{selected.namaToko}</Text>
                </View>
                <View style={RS.infoRow}>
                  <Text style={RS.infoLabel}>{"Diajukan"}</Text>
                  <Text style={RS.infoVal}>{formatDateTime(selected.createdAt)}</Text>
                </View>
              </View>

              {/* ── Item yang Diretur ── */}
              <View style={RS.section}>
                <Text style={RS.sectionTitle}>{"📦 Item yang Diretur"}</Text>
                {selected.items.map((item, idx) => (
                  <View key={idx} style={RS.itemRow}>
                    <View style={RS.flex}>
                      <Text style={RS.itemName}>{item.name}</Text>
                      <Text style={RS.itemDetail}>
                        {item.qtyRetur + " pcs × " + formatRp(item.price)}
                        {item.qtyRetur < item.maxQty
                          ? " (dari " + item.maxQty + " pcs)"
                          : " (semua)"}
                      </Text>
                    </View>
                    <Text style={RS.itemSubtotal}>{formatRp(item.price * item.qtyRetur)}</Text>
                  </View>
                ))}
                <View style={RS.totalReturBox}>
                  <Text style={RS.totalReturLabel}>{"Total Pengembalian"}</Text>
                  <Text style={RS.totalReturVal}>{formatRp(selected.totalRetur)}</Text>
                </View>
              </View>

              {/* ── Alasan ── */}
              <View style={RS.section}>
                <Text style={RS.sectionTitle}>{"💬 Alasan Retur dari Kasir"}</Text>
                <View style={RS.alasanBox}>
                  <Text style={RS.alasanTxt}>{"\u201C" + selected.alasan + "\u201D"}</Text>
                </View>
              </View>

              {/* ── Checklist Verifikasi (hanya pending) ── */}
              {selected.status === "menunggu" && (
                <View style={RS.checklistSection}>
                  <Text style={RS.sectionTitle}>{"✅ Checklist Sebelum Menyetujui"}</Text>
                  <View style={RS.checklistItem}>
                    <Text style={RS.checklistIcon}>{"1️⃣"}</Text>
                    <Text style={RS.checklistTxt}>
                      {"Pastikan customer telah membawa "}
                      <Text style={RS.checklistBold}>{"struk transaksi asli"}</Text>
                      {" dan tunjukkan kepada kasir."}
                    </Text>
                  </View>
                  <View style={RS.checklistItem}>
                    <Text style={RS.checklistIcon}>{"2️⃣"}</Text>
                    <Text style={RS.checklistTxt}>
                      {"Periksa tanggal transaksi — "}
                      <Text style={RS.checklistBold}>{"maksimal 2 hari"}</Text>
                      {" dari tanggal pembelian."}
                    </Text>
                  </View>
                  <View style={RS.checklistItem}>
                    <Text style={RS.checklistIcon}>{"3️⃣"}</Text>
                    <Text style={RS.checklistTxt}>
                      {"Pastikan barang yang diretur dalam kondisi dapat diterima sesuai kebijakan toko."}
                    </Text>
                  </View>
                  <View style={RS.checklistItem}>
                    <Text style={RS.checklistIcon}>{"4️⃣"}</Text>
                    <Text style={RS.checklistTxt}>
                      {"Jika disetujui, stok barang akan "}
                      <Text style={RS.checklistBold}>{"otomatis dikembalikan"}</Text>
                      {" ke gudang."}
                    </Text>
                  </View>
                </View>
              )}

              {/* ── Keputusan Owner / Hasil ── */}
              {selected.status === "menunggu" ? (
                <View style={RS.section}>
                  <Text style={RS.sectionTitle}>{"⚡ Keputusan Owner"}</Text>
                  <Text style={RS.inputLabel}>{"Catatan untuk Kasir (opsional)"}</Text>
                  <TextInput
                    style={RS.textInput}
                    value={catatanOwner}
                    onChangeText={setCatatanOwner}
                    placeholder="Contoh: Disetujui, harap kembalikan uang ke customer..."
                    placeholderTextColor={GRAY}
                    multiline
                    numberOfLines={2}
                  />
                  {processing ? (
                    <ActivityIndicator color={BLUE} size="large" style={RS.processingLoader} />
                  ) : (
                    <View style={RS.actionRow}>
                      <TouchableOpacity
                        style={RS.btnApprove}
                        onPress={() => confirmProcess("disetujui")}
                      >
                        <Text style={RS.btnActionTxt}>{"✅ Setujui"}</Text>
                        <Text style={RS.btnActionSub}>{"Stok dikembalikan"}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={RS.btnReject}
                        onPress={() => confirmProcess("ditolak")}
                      >
                        <Text style={RS.btnActionTxt}>{"❌ Tolak"}</Text>
                        <Text style={RS.btnActionSub}>{"Tidak ada perubahan"}</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  <View style={RS.warningBanner}>
                    <Text style={RS.warningTxt}>
                      {"⚠️ Pastikan struk transaksi asli sudah diperiksa sebelum menyetujui retur. Keputusan ini tidak dapat dibatalkan."}
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={RS.section}>
                  <Text style={RS.sectionTitle}>
                    {selected.status === "disetujui"
                      ? "✅ Retur Telah Disetujui"
                      : "❌ Retur Telah Ditolak"}
                  </Text>
                  <View style={RS.infoRow}>
                    <Text style={RS.infoLabel}>{"Diproses oleh"}</Text>
                    <Text style={RS.infoVal}>{selected.processedBy ?? "-"}</Text>
                  </View>
                  <View style={RS.infoRow}>
                    <Text style={RS.infoLabel}>{"Waktu"}</Text>
                    <Text style={RS.infoVal}>
                      {selected.processedAt ? formatDateTime(selected.processedAt) : "-"}
                    </Text>
                  </View>
                  {selected.catatanOwner ? (
                    <View style={RS.alasanBox}>
                      <Text style={RS.alasanTxt}>{"📝 " + selected.catatanOwner}</Text>
                    </View>
                  ) : null}
                  {selected.status === "disetujui" && (
                    <View style={RS.stockRestoredBanner}>
                      <Text style={RS.stockRestoredTxt}>
                        {"✅ Stok " +
                          selected.items.map((i) => i.name + " +" + i.qtyRetur + " pcs").join(", ") +
                          " telah dikembalikan ke gudang."}
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </ScrollView>
          </View>
        )}
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const RS = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  flex:      { flex: 1 },

  // Header
  header:      { backgroundColor: "#fff", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#E5E7EB" },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#1F2937" },
  headerSub:   { fontSize: 12, color: GRAY, marginTop: 3 },

  // TAMBAHAN: Statistik
  statsRow:   { flexDirection: "row", backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#E5E7EB", paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  statItem:   { flex: 1, borderRadius: 10, padding: 8, alignItems: "center", borderWidth: 1 },
  statOrange: { backgroundColor: "#FFF7ED", borderColor: "#FED7AA" },
  statGreen:  { backgroundColor: "#F0FDF4", borderColor: "#BBF7D0" },
  statRed:    { backgroundColor: "#FEF2F2", borderColor: "#FECACA" },
  statGray:   { backgroundColor: "#F8FAFC", borderColor: "#E2E8F0" },
  statNum:    { fontSize: 18, fontWeight: "900", color: "#1F2937" },
  statLbl:    { fontSize: 9, color: GRAY, marginTop: 2, textAlign: "center" },

  // Tab Bar
  tabBar:       { flexDirection: "row", backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#E5E7EB", elevation: 2, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 2, shadowOffset: SHADOW_DOWN },
  tab:          { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 13, gap: 5 },
  tabActive:    { borderBottomWidth: 2, borderBottomColor: BLUE },
  tabTxt:       { fontSize: 13, fontWeight: "600", color: GRAY },
  tabTxtActive: { color: BLUE },
  tabBadge:     { backgroundColor: RED, borderRadius: 8, minWidth: 18, height: 18, justifyContent: "center", alignItems: "center", paddingHorizontal: 5 },
  tabBadgeTxt:  { color: "#fff", fontSize: 10, fontWeight: "700" },

  // TAMBAHAN: Search Bar
  searchBar:      { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", marginHorizontal: 12, marginVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: "#E5E7EB", paddingHorizontal: 10, elevation: 1 },
  searchIcon:     { fontSize: 14, marginRight: 6 },
  searchInput:    { flex: 1, paddingVertical: 9, fontSize: 13, color: "#1F2937" },
  searchClearBtn: { padding: 4 },
  searchClearTxt: { fontSize: 13, color: GRAY, fontWeight: "700" },

  // List
  listContent:  { padding: 12 },
  loader:       { marginTop: 60 },
  emptyCenter:  { flex: 1, justifyContent: "center", alignItems: "center", marginTop: 80 },
  emptyIcon:    { fontSize: 48, marginBottom: 12 },
  emptyTxt:     { fontSize: 14, color: GRAY, textAlign: "center" },

  // Card
  card:            { backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 10, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: SHADOW_DOWN, elevation: 2 },
  cardHeader:      { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 },
  cardHeaderRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  cardKasir:       { fontSize: 14, fontWeight: "700", color: "#1F2937" },
  cardToko:        { fontSize: 12, color: GRAY, marginTop: 2 },
  cardItems:       { fontSize: 12, color: "#374151", marginBottom: 5, lineHeight: 18 },
  cardAlasan:      { fontSize: 12, color: GRAY, fontStyle: "italic", marginBottom: 10 },
  cardFooter:      { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  cardTxDate:      { fontSize: 11, color: GRAY },
  cardAjukan:      { fontSize: 11, color: "#9CA3AF", marginTop: 2 },
  cardTotal:       { fontSize: 16, fontWeight: "700", color: BLUE },
  cardCta:         { marginTop: 10, borderTopWidth: 1, borderTopColor: "#F3F4F6", paddingTop: 8 },
  cardCtaTxt:      { fontSize: 12, color: BLUE, textAlign: "right", fontWeight: "600" },

  // TAMBAHAN: Delete button
  deleteBtn:    { padding: 4 },
  deleteBtnTxt: { fontSize: 16 },

  // Status pill
  statusPill:      { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  statusPillTxt:   { fontSize: 11, fontWeight: "700" },
  statusPillSm:    { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, alignSelf: "flex-start", marginTop: 4 },
  statusPillSmTxt: { fontSize: 11, fontWeight: "700" },

  // Modal
  modalHeader:   { flexDirection: "row", alignItems: "flex-start", padding: 16, borderBottomWidth: 1, borderBottomColor: "#E5E7EB", backgroundColor: "#fff" },
  modalTitle:    { fontSize: 17, fontWeight: "700", color: "#1F2937" },
  modalCloseTxt: { fontSize: 22, color: GRAY, padding: 4 },
  modalContent:  { padding: 16, paddingBottom: 50 },

  // Section
  section:      { backgroundColor: LIGHT_BG, borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: "#E5E7EB" },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: "#1F2937", marginBottom: 12 },

  // Info rows
  infoRow:   { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#E5E7EB" },
  infoLabel: { fontSize: 13, color: GRAY },
  infoVal:   { fontSize: 13, color: "#1F2937", fontWeight: "500", flex: 1, textAlign: "right" },

  // Item retur
  itemRow:      { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#E5E7EB" },
  itemName:     { fontSize: 13, fontWeight: "600", color: "#1F2937", marginBottom: 3 },
  itemDetail:   { fontSize: 12, color: GRAY },
  itemSubtotal: { fontSize: 13, fontWeight: "700", color: "#1F2937", marginLeft: 10 },

  totalReturBox:   { backgroundColor: BLUE, borderRadius: 8, padding: 12, marginTop: 12, flexDirection: "row", justifyContent: "space-between" },
  totalReturLabel: { fontSize: 13, fontWeight: "600", color: "#fff" },
  totalReturVal:   { fontSize: 16, fontWeight: "700", color: "#fff" },

  // Alasan
  alasanBox: { backgroundColor: "#fff", borderRadius: 8, padding: 12, borderWidth: 1, borderColor: "#E5E7EB" },
  alasanTxt: { fontSize: 13, color: "#374151", lineHeight: 20, fontStyle: "italic" },

  // Checklist
  checklistSection: { backgroundColor: "#EFF6FF", borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: "#BFDBFE" },
  checklistItem:    { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 10 },
  checklistIcon:    { fontSize: 16 },
  checklistTxt:     { flex: 1, fontSize: 13, color: "#1E40AF", lineHeight: 20 },
  checklistBold:    { fontSize: 13, color: "#1E40AF", fontWeight: "700" },

  // Keputusan
  inputLabel:       { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 6 },
  textInput:        { backgroundColor: "#fff", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: "#1F2937", marginBottom: 14, borderWidth: 1, borderColor: "#E5E7EB", height: 72, textAlignVertical: "top" },
  processingLoader: { marginVertical: 16 },
  actionRow:        { flexDirection: "row", gap: 10, marginBottom: 12 },
  btnApprove:       { flex: 1, backgroundColor: GREEN, borderRadius: 10, paddingVertical: 14, alignItems: "center" },
  btnReject:        { flex: 1, backgroundColor: RED, borderRadius: 10, paddingVertical: 14, alignItems: "center" },
  btnActionTxt:     { color: "#fff", fontSize: 14, fontWeight: "700" },
  btnActionSub:     { color: "rgba(255,255,255,0.8)", fontSize: 10, marginTop: 3 },
  warningBanner:    { backgroundColor: "#FEF3C7", borderRadius: 8, padding: 10, borderLeftWidth: 3, borderLeftColor: ORANGE },
  warningTxt:       { fontSize: 12, color: "#92400E", lineHeight: 18 },

  // Hasil diproses
  stockRestoredBanner: { backgroundColor: "#ECFDF5", borderRadius: 8, padding: 10, marginTop: 10, borderLeftWidth: 3, borderLeftColor: GREEN },
  stockRestoredTxt:    { fontSize: 12, color: GREEN, lineHeight: 18 },
});