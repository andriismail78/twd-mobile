// src/screens/OwnerWithdrawalScreen.tsx
// Pencairan dana online owner ke rekening bank

import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Modal,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

// ─── Types ────────────────────────────────────────────────────────────────────

interface OnlineOrder {
  id: string;
  ownerId: string;
  subtotal: number;
  total: number;
  status: "menunggu" | "diproses" | "dikirim" | "selesai" | "dibatalkan";
  createdAt: string;
  customerName: string;
  metodeBayar?: string;
}

interface BankAccount {
  namaBank: string;
  nomorRekening: string;
  namaPemilik: string;
}

interface WithdrawalRequest {
  id: string;
  ownerId: string;
  jumlah: number;
  namaBank: string;
  nomorRekening: string;
  namaPemilik: string;
  status: "menunggu" | "diproses" | "selesai" | "ditolak";
  createdAt: string;
  catatan?: string;
}

interface Props {
  ownerId: string;
  ownerName?: string;
  onClose: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ORDERS_KEY      = "@twd_orders";
const OWNER_BANK_PFX  = "@twd_owner_bank_";
const OWNER_WD_PFX    = "@twd_owner_wd_";
const MIN_WITHDRAW    = 100000; // Minimum Rp 100.000 untuk owner
// Platform fee owner: 5% dari setiap transaksi online
// (kurir sudah kena 10% dari ongkir, owner kena 5% dari subtotal)
const OWNER_FEE_PCT   = 0.05;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRp(n: number): string {
  return "Rp " + Math.round(n).toLocaleString("id-ID");
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return (
    d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) +
    " " + d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
  );
}

function todayStr()     { return new Date().toISOString().slice(0, 10); }
function thisMonthStr() { return new Date().toISOString().slice(0, 7); }
function genId(pfx: string) {
  return pfx + "-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6);
}

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

// ─── Component ────────────────────────────────────────────────────────────────

export default function OwnerWithdrawalScreen({ ownerId, ownerName, onClose }: Props) {

  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [orders,        setOrders]        = useState<OnlineOrder[]>([]);
  const [bankAccount,   setBankAccount]   = useState<BankAccount | null>(null);
  const [withdrawals,   setWithdrawals]   = useState<WithdrawalRequest[]>([]);
  const [showBankModal, setShowBankModal] = useState(false);
  const [showWdModal,   setShowWdModal]   = useState(false);
  const [bankInput,     setBankInput]     = useState<BankAccount>({ namaBank: "", nomorRekening: "", namaPemilik: "" });
  const [wdJumlah,      setWdJumlah]      = useState("");
  const [activeTab,     setActiveTab]     = useState<"saldo" | "riwayat">("saldo");

  const loadData = useCallback(async () => {
    try {
      const rawOrders = await AsyncStorage.getItem(ORDERS_KEY);
      const allOrders: OnlineOrder[] = rawOrders ? JSON.parse(rawOrders) : [];
      const myOrders = allOrders.filter((o) => String(o.ownerId) === String(ownerId));
      setOrders(myOrders);

      const rawBank = await AsyncStorage.getItem(OWNER_BANK_PFX + ownerId);
      setBankAccount(rawBank ? JSON.parse(rawBank) : null);

      const rawWd = await AsyncStorage.getItem(OWNER_WD_PFX + ownerId);
      const allWd: WithdrawalRequest[] = rawWd ? JSON.parse(rawWd) : [];
      setWithdrawals(allWd.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch (e) { console.error("OwnerWithdrawal loadData:", e); }
    finally { setLoading(false); setRefreshing(false); }
  }, [ownerId]);

  useEffect(() => { loadData(); }, [loadData]);
  const onRefresh = () => { setRefreshing(true); loadData(); };

  // ── Hitung saldo ──────────────────────────────────────────────────────
  const completedOrders = useMemo(() => orders.filter((o) => o.status === "selesai"), [orders]);
  const pendingOrders   = useMemo(() => orders.filter((o) => ["menunggu", "diproses", "dikirim"].includes(o.status)), [orders]);

  // Owner net = subtotal × (1 - 5% platform fee)
  const calcOwnerNet = (order: OnlineOrder) => Math.round(order.subtotal * (1 - OWNER_FEE_PCT));

  const totalEarned  = useMemo(() => completedOrders.reduce((s, o) => s + calcOwnerNet(o), 0), [completedOrders]);
  const totalWithdrawn = useMemo(() => withdrawals.filter((w) => w.status === "selesai").reduce((s, w) => s + w.jumlah, 0), [withdrawals]);
  const pendingWd    = useMemo(() => withdrawals.filter((w) => w.status === "menunggu" || w.status === "diproses").reduce((s, w) => s + w.jumlah, 0), [withdrawals]);
  const saldoBisa    = useMemo(() => Math.max(0, totalEarned - totalWithdrawn - pendingWd), [totalEarned, totalWithdrawn, pendingWd]);
  const pendingIncome = useMemo(() => pendingOrders.reduce((s, o) => s + calcOwnerNet(o), 0), [pendingOrders]);

  const todayOrders  = useMemo(() => completedOrders.filter((o) => o.createdAt.slice(0, 10) === todayStr()), [completedOrders]);
  const monthOrders  = useMemo(() => completedOrders.filter((o) => o.createdAt.slice(0, 7) === thisMonthStr()), [completedOrders]);
  const todayNet     = useMemo(() => todayOrders.reduce((s, o) => s + calcOwnerNet(o), 0), [todayOrders]);
  const monthNet     = useMemo(() => monthOrders.reduce((s, o) => s + calcOwnerNet(o), 0), [monthOrders]);

  // ── Simpan rekening ────────────────────────────────────────────────────
  const handleSaveBank = async () => {
    if (!bankInput.namaBank.trim() || !bankInput.nomorRekening.trim() || !bankInput.namaPemilik.trim()) {
      Alert.alert("Lengkapi Data", "Semua field rekening harus diisi.");
      return;
    }
    try {
      await AsyncStorage.setItem(OWNER_BANK_PFX + ownerId, JSON.stringify(bankInput));
      setBankAccount({ ...bankInput });
      setShowBankModal(false);
      Alert.alert("Berhasil ✅", "Rekening bank tersimpan.");
    } catch { Alert.alert("Error", "Gagal menyimpan rekening."); }
  };

  // ── Request pencairan ─────────────────────────────────────────────────
  const handleRequestWithdraw = async () => {
    if (!bankAccount) {
      Alert.alert("Rekening Belum Diatur", "Tambahkan rekening bank terlebih dahulu.");
      setShowBankModal(true);
      return;
    }
    const jumlah = Number(wdJumlah.replace(/\D/g, ""));
    if (!jumlah || jumlah < MIN_WITHDRAW) {
      Alert.alert("Jumlah Kurang", "Minimum pencairan " + formatRp(MIN_WITHDRAW) + ".");
      return;
    }
    if (jumlah > saldoBisa) {
      Alert.alert("Saldo Tidak Cukup", "Saldo yang bisa dicairkan: " + formatRp(saldoBisa) + ".");
      return;
    }
    Alert.alert(
      "Konfirmasi Pencairan",
      "Cairkan " + formatRp(jumlah) + " ke:\n" +
      bankAccount.namaBank + "\n" + bankAccount.nomorRekening + "\n" +
      "a.n. " + bankAccount.namaPemilik + "\n\nDana akan diproses 1×24 jam kerja.",
      [
        { text: "Batal", style: "cancel" },
        { text: "Cairkan", onPress: async () => {
          try {
            const wd: WithdrawalRequest = {
              id: genId("owd"),
              ownerId,
              jumlah,
              namaBank: bankAccount.namaBank,
              nomorRekening: bankAccount.nomorRekening,
              namaPemilik: bankAccount.namaPemilik,
              status: "menunggu",
              createdAt: new Date().toISOString(),
            };
            const rawWd = await AsyncStorage.getItem(OWNER_WD_PFX + ownerId);
            const allWd: WithdrawalRequest[] = rawWd ? JSON.parse(rawWd) : [];
            await AsyncStorage.setItem(OWNER_WD_PFX + ownerId, JSON.stringify([wd, ...allWd]));
            setShowWdModal(false);
            setWdJumlah("");
            await loadData();
            Alert.alert("Permintaan Terkirim ✅", "Pencairan " + formatRp(jumlah) + " sedang diproses.\nDana masuk ke rekening dalam 1×24 jam kerja.");
          } catch { Alert.alert("Error", "Gagal mengajukan pencairan."); }
        }},
      ],
    );
  };

  if (loading) {
    return (
      <View style={S.loadingBox}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <View style={S.container}>

      {/* Header */}
      <View style={S.header}>
        <TouchableOpacity onPress={onClose}>
          <Text style={S.backTxt}>{"✕ Tutup"}</Text>
        </TouchableOpacity>
        <Text style={S.headerTitle}>💸 Pencairan Dana Online</Text>
        <View style={S.headerRight} />
      </View>

      {/* Saldo utama */}
      <View style={S.saldoCard}>
        <Text style={S.saldoLbl}>Saldo Bisa Dicairkan</Text>
        <Text style={S.saldoVal}>{formatRp(saldoBisa)}</Text>
        {pendingWd > 0 && <Text style={S.pendingWdTxt}>{"⏳ Sedang diproses: " + formatRp(pendingWd)}</Text>}
        {pendingIncome > 0 && <Text style={S.pendingIncomeTxt}>{"🔄 Pending masuk: " + formatRp(pendingIncome)}</Text>}

        <View style={S.saldoActionRow}>
          <TouchableOpacity
            style={saldoBisa >= MIN_WITHDRAW && bankAccount ? S.cairBtn : S.cairBtnDisabled}
            onPress={() => setShowWdModal(true)}
            disabled={saldoBisa < MIN_WITHDRAW || !bankAccount}
          >
            <Text style={S.cairBtnTxt}>
              {!bankAccount ? "⚠️ Atur Rekening Dulu" : saldoBisa < MIN_WITHDRAW ? "Saldo Belum Cukup" : "💸 Cairkan Dana"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={S.bankBtn} onPress={() => {
            if (bankAccount) setBankInput({ ...bankAccount });
            setShowBankModal(true);
          }}>
            <Text style={S.bankBtnTxt}>{bankAccount ? "🏦 Edit Rekening" : "🏦 + Rekening"}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Ringkasan */}
      <View style={S.summaryRow}>
        <View style={S.summaryItem}>
          <Text style={S.summaryLbl}>Hari Ini</Text>
          <Text style={S.summaryVal}>{formatRp(todayNet)}</Text>
          <Text style={S.summaryCnt}>{String(todayOrders.length) + " order"}</Text>
        </View>
        <View style={S.summaryDivider} />
        <View style={S.summaryItem}>
          <Text style={S.summaryLbl}>Bulan Ini</Text>
          <Text style={S.summaryVal}>{formatRp(monthNet)}</Text>
          <Text style={S.summaryCnt}>{String(monthOrders.length) + " order"}</Text>
        </View>
        <View style={S.summaryDivider} />
        <View style={S.summaryItem}>
          <Text style={S.summaryLbl}>Total Cair</Text>
          <Text style={S.summaryVal}>{formatRp(totalWithdrawn)}</Text>
        </View>
        <View style={S.summaryDivider} />
        <View style={S.summaryItem}>
          <Text style={S.summaryLbl}>Total Pendapatan</Text>
          <Text style={S.summaryVal}>{formatRp(totalEarned)}</Text>
        </View>
      </View>

      {/* Info fee platform */}
      <View style={S.feeInfoCard}>
        <Text style={S.feeInfoTitle}>📐 Sistem Pembayaran Online</Text>
        <View style={S.feeRow}><Text style={S.feeLbl}>Pembayaran customer</Text><Text style={S.feeVal}>→ Rekening Aplikasi</Text></View>
        <View style={S.feeRow}><Text style={S.feeLbl}>Biaya platform (5% dari subtotal)</Text><Text style={S.feeValMinus}>{"-5%"}</Text></View>
        <View style={S.feeRow}><Text style={S.feeLblTotal}>Kamu terima (bersih)</Text><Text style={S.feeValTotal}>{"95% dari subtotal"}</Text></View>
        <Text style={S.feeNote}>{"Ongkir dikelola terpisah melalui rekening kurir.\nPencairan tersedia setelah order berstatus Selesai."}</Text>
      </View>

      {/* Rekening tersimpan */}
      {bankAccount ? (
        <View style={S.bankPreviewCard}>
          <View style={S.bankPreviewLeft}>
            <Text style={S.bankPreviewTitle}>🏦 Rekening Tujuan Pencairan</Text>
            <Text style={S.bankName}>{bankAccount.namaBank}</Text>
            <Text style={S.bankNum}>{bankAccount.nomorRekening}</Text>
            <Text style={S.bankOwner}>{"a.n. " + bankAccount.namaPemilik}</Text>
          </View>
          <TouchableOpacity style={S.editBtn} onPress={() => { setBankInput({ ...bankAccount }); setShowBankModal(true); }}>
            <Text style={S.editBtnTxt}>✏️ Edit</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={S.noBankCard} onPress={() => { setBankInput({ namaBank: "", nomorRekening: "", namaPemilik: "" }); setShowBankModal(true); }}>
          <Text style={S.noBankTxt}>🏦 + Tambahkan Rekening Bank</Text>
          <Text style={S.noBankSub}>Diperlukan untuk mencairkan dana</Text>
        </TouchableOpacity>
      )}

      {/* Tabs */}
      <View style={S.tabRow}>
        <TouchableOpacity style={activeTab === "saldo" ? S.tabActive : S.tabInactive} onPress={() => setActiveTab("saldo")}>
          <Text style={activeTab === "saldo" ? S.tabTxtActive : S.tabTxtInactive}>📊 Per Order</Text>
        </TouchableOpacity>
        <TouchableOpacity style={activeTab === "riwayat" ? S.tabActive : S.tabInactive} onPress={() => setActiveTab("riwayat")}>
          <Text style={activeTab === "riwayat" ? S.tabTxtActive : S.tabTxtInactive}>📋 Riwayat Pencairan</Text>
        </TouchableOpacity>
      </View>

      {/* Tab konten */}
      <ScrollView
        style={S.listScroll}
        contentContainerStyle={S.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {activeTab === "saldo" && (
          completedOrders.length === 0 ? (
            <View style={S.emptyBox}><Text style={S.emptyTxt}>Belum ada order selesai.</Text></View>
          ) : (
            completedOrders.map((order) => {
              const gross  = order.subtotal;
              const fee    = Math.round(gross * OWNER_FEE_PCT);
              const net    = gross - fee;
              return (
                <View key={order.id} style={S.orderCard}>
                  <View style={S.orderCardTop}>
                    <Text style={S.orderIdTxt}>{"#" + order.id.slice(-6).toUpperCase()}</Text>
                    <Text style={S.orderNetTxt}>{"+" + formatRp(net)}</Text>
                  </View>
                  <Text style={S.orderCustomer}>{order.customerName}</Text>
                  <Text style={S.orderDate}>{formatDate(order.createdAt)}</Text>
                  <View style={S.orderBreakRow}>
                    <Text style={S.orderBreakLbl}>Subtotal produk</Text>
                    <Text style={S.orderBreakVal}>{formatRp(gross)}</Text>
                  </View>
                  <View style={S.orderBreakRow}>
                    <Text style={S.orderBreakLblMinus}>Biaya platform (5%)</Text>
                    <Text style={S.orderBreakValMinus}>{"-" + formatRp(fee)}</Text>
                  </View>
                </View>
              );
            })
          )
        )}

        {activeTab === "riwayat" && (
          withdrawals.length === 0 ? (
            <View style={S.emptyBox}><Text style={S.emptyTxt}>Belum ada riwayat pencairan.</Text></View>
          ) : (
            withdrawals.map((wd) => (
              <View key={wd.id} style={S.wdItemCard}>
                <View style={S.wdItemLeft}>
                  <Text style={S.wdItemId}>{"#" + wd.id.slice(-8).toUpperCase()}</Text>
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
          )
        )}
        <View style={S.bottomSpacer} />
      </ScrollView>

      {/* ════ Modal Rekening Bank ════════════════════════════════════════════ */}
      <Modal visible={showBankModal} transparent animationType="slide" onRequestClose={() => setShowBankModal(false)}>
        <View style={S.overlay}>
          <View style={S.sheet}>
            <View style={S.sheetHeader}>
              <Text style={S.sheetTitle}>🏦 Rekening Bank Owner</Text>
              <TouchableOpacity onPress={() => setShowBankModal(false)}><Text style={S.sheetClose}>✕</Text></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={S.fieldLbl}>Nama Bank</Text>
              <TextInput style={S.fieldInput} value={bankInput.namaBank} onChangeText={(v) => setBankInput((p) => ({ ...p, namaBank: v }))} placeholder="BCA, BRI, BNI, Mandiri, dll" placeholderTextColor="#94a3b8" autoCapitalize="characters" />
              <Text style={S.fieldLbl}>Nomor Rekening</Text>
              <TextInput style={S.fieldInput} value={bankInput.nomorRekening} onChangeText={(v) => setBankInput((p) => ({ ...p, nomorRekening: v }))} placeholder="1234567890" placeholderTextColor="#94a3b8" keyboardType="numeric" />
              <Text style={S.fieldLbl}>Nama Pemilik Rekening</Text>
              <TextInput style={S.fieldInput} value={bankInput.namaPemilik} onChangeText={(v) => setBankInput((p) => ({ ...p, namaPemilik: v }))} placeholder="Sesuai buku tabungan" placeholderTextColor="#94a3b8" autoCapitalize="words" />
              <View style={S.warningBox}>
                <Text style={S.warningTxt}>⚠️ Pastikan data rekening benar. Dana yang salah kirim tidak dapat dikembalikan.</Text>
              </View>
              <TouchableOpacity style={S.saveBtn} onPress={handleSaveBank}>
                <Text style={S.saveBtnTxt}>💾 Simpan Rekening</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ════ Modal Pencairan Dana ════════════════════════════════════════════ */}
      <Modal visible={showWdModal} transparent animationType="slide" onRequestClose={() => setShowWdModal(false)}>
        <View style={S.overlay}>
          <View style={S.sheet}>
            <View style={S.sheetHeader}>
              <Text style={S.sheetTitle}>💸 Pencairan Dana</Text>
              <TouchableOpacity onPress={() => setShowWdModal(false)}><Text style={S.sheetClose}>✕</Text></TouchableOpacity>
            </View>
            <View style={S.wdSaldoBox}>
              <Text style={S.wdSaldoLbl}>Saldo Bisa Dicairkan</Text>
              <Text style={S.wdSaldoVal}>{formatRp(saldoBisa)}</Text>
            </View>
            {bankAccount ? (
              <View style={S.wdBankPreview}>
                <Text style={S.wdBankPreviewTxt}>{"🏦 " + bankAccount.namaBank + " · " + bankAccount.nomorRekening}</Text>
                <Text style={S.wdBankPreviewOwner}>{"a.n. " + bankAccount.namaPemilik}</Text>
              </View>
            ) : null}
            <Text style={S.fieldLbl}>{"Jumlah Pencairan (min. " + formatRp(MIN_WITHDRAW) + ")"}</Text>
            <TextInput style={S.fieldInput} value={wdJumlah} onChangeText={setWdJumlah} placeholder={formatRp(MIN_WITHDRAW)} placeholderTextColor="#94a3b8" keyboardType="numeric" />
            {/* Shortcut */}
            <View style={S.shortcutRow}>
              {[100000, 250000, 500000, 1000000].filter((v) => v <= saldoBisa).map((v) => (
                <TouchableOpacity key={v} style={S.shortcutBtn} onPress={() => setWdJumlah(String(v))}>
                  <Text style={S.shortcutTxt}>{formatRp(v)}</Text>
                </TouchableOpacity>
              ))}
              {saldoBisa >= MIN_WITHDRAW && (
                <TouchableOpacity style={[S.shortcutBtn, S.shortcutBtnAll]} onPress={() => setWdJumlah(String(Math.floor(saldoBisa)))}>
                  <Text style={S.shortcutTxt}>Semua</Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={S.warningBox}>
              <Text style={S.warningTxt}>⏰ Proses transfer 1×24 jam kerja. Biaya transfer ditanggung sistem.</Text>
            </View>
            <TouchableOpacity style={S.saveBtn} onPress={handleRequestWithdraw}>
              <Text style={S.saveBtnTxt}>💸 Ajukan Pencairan</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  container:   { flex: 1, backgroundColor: "#f8fafc" },
  loadingBox:  { flex: 1, justifyContent: "center", alignItems: "center" },

  header:       { backgroundColor: "#2563EB", paddingTop: 52, paddingBottom: 16, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backTxt:      { color: "rgba(255,255,255,0.85)", fontSize: 14 },
  headerTitle:  { fontSize: 16, fontWeight: "700", color: "#fff" },
  headerRight:  { width: 60 },

  saldoCard:       { backgroundColor: "#2563EB", margin: 12, borderRadius: 16, padding: 18, alignItems: "center" },
  saldoLbl:        { fontSize: 13, color: "rgba(255,255,255,0.8)", marginBottom: 6 },
  saldoVal:        { fontSize: 32, fontWeight: "800", color: "#fff" },
  pendingWdTxt:    { fontSize: 12, color: "#fde68a", marginTop: 6 },
  pendingIncomeTxt:{ fontSize: 12, color: "rgba(255,255,255,0.7)", marginTop: 2 },
  saldoActionRow:  { flexDirection: "row", gap: 10, marginTop: 14, width: "100%" },
  cairBtn:         { flex: 1, backgroundColor: "#fff", borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  cairBtnDisabled: { flex: 1, backgroundColor: "rgba(255,255,255,0.3)", borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  cairBtnTxt:      { color: "#2563EB", fontWeight: "800", fontSize: 13 },
  bankBtn:         { backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14 },
  bankBtnTxt:      { color: "#fff", fontWeight: "700", fontSize: 12 },

  summaryRow:     { flexDirection: "row", backgroundColor: "#fff", marginHorizontal: 12, borderRadius: 12, padding: 12, justifyContent: "space-around", alignItems: "center", shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, elevation: 2, marginBottom: 10 },
  summaryItem:    { alignItems: "center" },
  summaryLbl:     { fontSize: 10, color: "#64748b", marginBottom: 3 },
  summaryVal:     { fontSize: 13, fontWeight: "700", color: "#1e293b" },
  summaryCnt:     { fontSize: 10, color: "#94a3b8", marginTop: 1 },
  summaryDivider: { width: 1, height: 32, backgroundColor: "#f1f5f9" },

  feeInfoCard:   { backgroundColor: "#fff", marginHorizontal: 12, borderRadius: 12, padding: 14, marginBottom: 10, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
  feeInfoTitle:  { fontSize: 12, fontWeight: "700", color: "#374151", marginBottom: 10 },
  feeRow:        { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  feeLbl:        { fontSize: 12, color: "#64748b" },
  feeVal:        { fontSize: 12, color: "#1e293b", fontWeight: "600" },
  feeValMinus:   { fontSize: 12, color: "#ef4444", fontWeight: "700" },
  feeLblTotal:   { fontSize: 13, fontWeight: "800", color: "#1e293b" },
  feeValTotal:   { fontSize: 13, fontWeight: "800", color: "#2563EB" },
  feeNote:       { fontSize: 11, color: "#94a3b8", marginTop: 8, lineHeight: 16 },

  bankPreviewCard: { backgroundColor: "#eff6ff", marginHorizontal: 12, borderRadius: 12, padding: 14, marginBottom: 10, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#bfdbfe" },
  bankPreviewLeft: { flex: 1 },
  bankPreviewTitle:{ fontSize: 11, color: "#64748b", marginBottom: 4 },
  bankName:        { fontSize: 16, fontWeight: "700", color: "#1e293b" },
  bankNum:         { fontSize: 14, color: "#374151", marginTop: 2 },
  bankOwner:       { fontSize: 12, color: "#64748b", marginTop: 2 },
  editBtn:         { backgroundColor: "#dbeafe", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  editBtnTxt:      { fontSize: 12, color: "#2563EB", fontWeight: "700" },
  noBankCard:      { backgroundColor: "#f8fafc", marginHorizontal: 12, borderRadius: 12, padding: 20, marginBottom: 10, alignItems: "center", borderWidth: 2, borderStyle: "dashed", borderColor: "#cbd5e1" },
  noBankTxt:       { fontSize: 14, fontWeight: "700", color: "#2563EB" },
  noBankSub:       { fontSize: 12, color: "#94a3b8", marginTop: 4 },

  tabRow:       { flexDirection: "row", marginHorizontal: 12, marginBottom: 6, backgroundColor: "#e2e8f0", borderRadius: 10, padding: 3 },
  tabActive:    { flex: 1, backgroundColor: "#2563EB", borderRadius: 8, paddingVertical: 8, alignItems: "center" },
  tabInactive:  { flex: 1, paddingVertical: 8, alignItems: "center" },
  tabTxtActive: { color: "#fff", fontWeight: "600", fontSize: 12 },
  tabTxtInactive:{ color: "#64748b", fontSize: 12 },

  listScroll:   { flex: 1 },
  listContent:  { paddingHorizontal: 12, paddingTop: 4 },
  emptyBox:     { paddingVertical: 40, alignItems: "center" },
  emptyTxt:     { color: "#94a3b8", fontSize: 15 },
  bottomSpacer: { height: 40 },

  orderCard:       { backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 8, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
  orderCardTop:    { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  orderIdTxt:      { fontSize: 12, fontWeight: "700", color: "#64748b", letterSpacing: 0.5 },
  orderNetTxt:     { fontSize: 15, fontWeight: "800", color: "#2563EB" },
  orderCustomer:   { fontSize: 14, fontWeight: "600", color: "#1e293b" },
  orderDate:       { fontSize: 11, color: "#94a3b8", marginBottom: 8, marginTop: 2 },
  orderBreakRow:   { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  orderBreakLbl:   { fontSize: 11, color: "#64748b" },
  orderBreakVal:   { fontSize: 11, color: "#1e293b", fontWeight: "600" },
  orderBreakLblMinus:{ fontSize: 11, color: "#ef4444" },
  orderBreakValMinus:{ fontSize: 11, color: "#ef4444", fontWeight: "600" },

  wdItemCard:    { backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 8, flexDirection: "row", shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 },
  wdItemLeft:    { flex: 1 },
  wdItemId:      { fontSize: 11, fontWeight: "700", color: "#475569", letterSpacing: 0.5 },
  wdItemBank:    { fontSize: 13, fontWeight: "600", color: "#1e293b", marginTop: 2 },
  wdItemOwner:   { fontSize: 11, color: "#64748b" },
  wdItemDate:    { fontSize: 10, color: "#94a3b8", marginTop: 3 },
  wdItemCatatan: { fontSize: 11, color: "#ef4444", marginTop: 3 },
  wdItemRight:   { alignItems: "flex-end", justifyContent: "center", gap: 6 },
  wdItemJumlah:  { fontSize: 16, fontWeight: "800", color: "#1e293b" },
  wdStatusBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  wdStatusTxt:   { fontSize: 10, fontWeight: "700" },

  overlay:      { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet:        { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: "85%" },
  sheetHeader:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  sheetTitle:   { fontSize: 18, fontWeight: "700", color: "#1e293b" },
  sheetClose:   { fontSize: 22, color: "#64748b", fontWeight: "700" },
  fieldLbl:     { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 6, marginTop: 14 },
  fieldInput:   { backgroundColor: "#f8fafc", borderRadius: 10, borderWidth: 1, borderColor: "#e2e8f0", paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: "#1e293b" },
  warningBox:   { backgroundColor: "#fff7ed", borderRadius: 10, padding: 12, marginTop: 16, borderWidth: 1, borderColor: "#fed7aa" },
  warningTxt:   { fontSize: 12, color: "#92400e" },
  saveBtn:      { backgroundColor: "#2563EB", borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 16, marginBottom: 8 },
  saveBtnTxt:   { color: "#fff", fontWeight: "800", fontSize: 15 },
  wdSaldoBox:   { backgroundColor: "#eff6ff", borderRadius: 12, padding: 14, marginBottom: 10, alignItems: "center" },
  wdSaldoLbl:   { fontSize: 12, color: "#64748b" },
  wdSaldoVal:   { fontSize: 24, fontWeight: "800", color: "#2563EB" },
  wdBankPreview:{ backgroundColor: "#f8fafc", borderRadius: 10, padding: 10, marginBottom: 4 },
  wdBankPreviewTxt:  { fontSize: 13, fontWeight: "700", color: "#1e293b" },
  wdBankPreviewOwner:{ fontSize: 12, color: "#64748b" },
  shortcutRow:  { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  shortcutBtn:  { backgroundColor: "#f1f5f9", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  shortcutBtnAll:{ backgroundColor: "#dbeafe" },
  shortcutTxt:  { fontSize: 12, fontWeight: "600", color: "#374151" },
});