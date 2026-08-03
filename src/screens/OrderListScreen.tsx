import React, { useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import {
  Appbar,
  Badge,
  Button,
  Card,
  Divider,
  Text,
  TextInput,
} from "react-native-paper";
import { useMarketing } from "../context/MarketingContext";
import { Order, OrderStatus, useOrders } from "../context/OrderContext";
import { usePaymentMethods } from "../context/PaymentMethodContext";

const GREEN = "#2E7D32";
const BLUE  = "#1565C0";
const ORANGE = "#E65100";

const STATUS_CONFIG: Record<OrderStatus, {
  label: string; color: string; bg: string; icon: string;
}> = {
  menunggu:     { label: "Menunggu",     color: ORANGE,   bg: "#FFF3E0", icon: "⏳" },
  dikonfirmasi: { label: "Dikonfirmasi", color: BLUE,     bg: "#E3F2FD", icon: "✅" },
  disiapkan:    { label: "Disiapkan",    color: "#6A1B9A", bg: "#F3E5F5", icon: "📦" },
  selesai:      { label: "Selesai",      color: GREEN,    bg: "#E8F5E9", icon: "🎉" },
  dibatalkan:   { label: "Dibatalkan",   color: "#C62828", bg: "#FFEBEE", icon: "❌" },
};

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  menunggu:     "dikonfirmasi",
  dikonfirmasi: "disiapkan",
  disiapkan:    "selesai",
};

const NEXT_LABEL: Partial<Record<OrderStatus, string>> = {
  menunggu:     "✅ Konfirmasi",
  dikonfirmasi: "📦 Siapkan",
  disiapkan:    "🎉 Selesai",
};

const METODE_LABEL: Record<string, string> = {
  transfer: "🏦 Bayar Transfer",
  qris:     "📱 Bayar QRIS",
  va:       "🏧 Virtual Account",
};

type FilterTab = "aktif" | "selesai" | "semua";
type Props     = { onBack: () => void };

export default function OrderListScreen({ onBack }: Props) {
  const { orders, updateStatus }      = useOrders();
  const { enabledMethods }            = usePaymentMethods();
  const { kurirAccounts, updateKurirStatus } = useMarketing();

  const [filterTab,      setFilterTab]      = useState<FilterTab>("aktif");
  const [showKurirDialog,setShowKurirDialog] = useState(false);
  const [selectedOrder,  setSelectedOrder]  = useState<Order | null>(null);
  const [kurirInput,     setKurirInput]     = useState("");
  const [showManualInput,setShowManualInput] = useState(false);

  // ── Kurir yang sedang standby (available) ─────────────────────────────────
  const kurirStandby = kurirAccounts.filter(k => k.status === "available");
  const kurirBusy    = kurirAccounts.filter(k => k.status === "busy");
  const kurirOffline = kurirAccounts.filter(k => k.status === "offline");

  // ── Filter & sort ──────────────────────────────────────────────────────────
  const filteredOrders = [...orders]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .filter(o => {
      if (filterTab === "aktif")   return o.status !== "selesai" && o.status !== "dibatalkan";
      if (filterTab === "selesai") return o.status === "selesai" || o.status === "dibatalkan";
      return true;
    });

  const totalMenunggu = orders.filter(o => o.status === "menunggu").length;

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return (
      d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) +
      " " +
      d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
    );
  };

  // ── Handle next status ─────────────────────────────────────────────────────
  const handleNextStatus = (order: Order) => {
    const next = NEXT_STATUS[order.status];
    if (!next) return;

    if (order.status === "menunggu") {
      setSelectedOrder(order);
      setKurirInput(order.kurirName ?? "");
      setShowManualInput(false);
      setShowKurirDialog(true);
      return;
    }

    const nextLabel = NEXT_LABEL[order.status] ?? "Update";
    Alert.alert(
      "Update Status",
      "Ubah pesanan #" + order.id.slice(-6) + " menjadi \"" + STATUS_CONFIG[next].label + "\"?",
      [
        { text: "Batal", style: "cancel" },
        { text: nextLabel, onPress: () => updateStatus(order.id, next) },
      ],
    );
  };

  const handleKonfirmasiDenganKurir = async () => {
    if (!selectedOrder) return;
    const kurir = kurirInput.trim();
    if (!kurir) {
      Alert.alert("Kurir Belum Dipilih", "Pilih kurir dari daftar atau ketik manual.");
      return;
    }

    // ✅ Auto set kurir status → busy
    const kurirData = kurirAccounts.find(k => k.name === kurir);
    if (kurirData) {
      updateKurirStatus(kurirData.id, "busy");
    }

    await updateStatus(selectedOrder.id, "dikonfirmasi", kurir);
    setShowKurirDialog(false);
    setSelectedOrder(null);
    setKurirInput("");
    setShowManualInput(false);
  };

  const handleBatalkan = (order: Order) => {
    Alert.alert(
      "Batalkan Pesanan",
      "Yakin ingin membatalkan pesanan #" + order.id.slice(-6) + "?",
      [
        { text: "Tidak", style: "cancel" },
        {
          text:    "Batalkan",
          style:   "destructive",
          onPress: () => updateStatus(order.id, "dibatalkan"),
        },
      ],
    );
  };

  const transferMethod = enabledMethods.find(m => m.id === "transfer");
  const qrisMethod     = enabledMethods.find(m => m.id === "qris");

  // ══════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════
  return (
    <View style={S.root}>

      {/* ── Appbar ── */}
      <Appbar.Header style={S.appbar}>
        <Appbar.BackAction color="#fff" onPress={onBack} />
        <Appbar.Content
          title="Pesanan Masuk"
          subtitle={
            totalMenunggu > 0
              ? totalMenunggu + " pesanan menunggu konfirmasi"
              : "Semua pesanan"
          }
          titleStyle={S.appbarTitle}
          subtitleStyle={S.appbarSubtitle}
        />
        {totalMenunggu > 0 && (
          <Badge style={S.headerBadge}>{totalMenunggu}</Badge>
        )}
      </Appbar.Header>

      {/* ── Filter Tab ── */}
      <View style={S.tabRow}>
        {(["aktif", "selesai", "semua"] as FilterTab[]).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[S.tabBtn, filterTab === tab && S.tabBtnActive]}
            onPress={() => setFilterTab(tab)}
          >
            <Text style={[S.tabBtnText, filterTab === tab && S.tabBtnTextActive]}>
              {tab === "aktif" ? "🔥 Aktif" : tab === "selesai" ? "✅ Selesai" : "📋 Semua"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Info kurir tersedia (hanya di tab aktif) ── */}
      {filterTab === "aktif" && (
        <View style={S.kurirSummaryBar}>
          <Text style={S.kurirSummaryText}>
            {"🟢 " + kurirStandby.length + " Standby"}
          </Text>
          <Text style={S.kurirSummaryDivider}>|</Text>
          <Text style={S.kurirSummaryText}>
            {"🟡 " + kurirBusy.length + " Busy"}
          </Text>
          <Text style={S.kurirSummaryDivider}>|</Text>
          <Text style={[S.kurirSummaryText, { color: "#999" }]}>
            {"🔴 " + kurirOffline.length + " Offline"}
          </Text>
        </View>
      )}

      {/* ── List pesanan ── */}
      <ScrollView contentContainerStyle={S.scroll}>
        {filteredOrders.length === 0 ? (
          <View style={S.emptyBox}>
            <Text style={S.emptyIcon}>📭</Text>
            <Text style={S.emptyTitle}>
              {filterTab === "aktif" ? "Tidak ada pesanan aktif" : "Belum ada pesanan"}
            </Text>
            <Text style={S.emptySubtitle}>
              Pesanan dari customer akan muncul di sini
            </Text>
          </View>
        ) : (
          filteredOrders.map(order => {
            const cfg        = STATUS_CONFIG[order.status];
            const nextStatus = NEXT_STATUS[order.status];
            const nextLabel  = NEXT_LABEL[order.status];
            const isAktif    = order.status !== "selesai" && order.status !== "dibatalkan";

            return (
              <Card
                key={order.id}
                style={[S.card, order.status === "menunggu" && S.cardHighlight]}
                mode="outlined"
              >
                <Card.Content>
                  {/* ── Header ── */}
                  <View style={S.orderHeader}>
                    <View>
                      <Text style={S.orderId}>{"#" + order.id.slice(-6)}</Text>
                      <Text style={S.orderDate}>{formatDate(order.createdAt)}</Text>
                    </View>
                    <View style={[S.statusBadge, { backgroundColor: cfg.bg }]}>
                      <Text style={[S.statusText, { color: cfg.color }]}>
                        {cfg.icon + " " + cfg.label}
                      </Text>
                    </View>
                  </View>

                  <Divider style={S.divider} />

                  {/* ── Info Customer ── */}
                  <View style={S.infoBox}>
                    <Text style={S.infoName}>👤 {order.customerName}</Text>
                    <Text style={S.infoSub}>📞 {order.customerPhone}</Text>
                    <Text style={S.infoSub}>📍 {order.alamat}</Text>
                    {order.catatan
                      ? <Text style={S.infoCatatan}>📝 {order.catatan}</Text>
                      : null}
                    {order.metodeBayarCustomer ? (
                      <View style={S.bayarBadge}>
                        <Text style={S.bayarBadgeText}>
                          {METODE_LABEL[order.metodeBayarCustomer] ??
                            ("💳 " + order.metodeBayarCustomer)}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  {/* ── Info Kurir ── */}
                  {order.kurirName ? (
                    <View style={S.kurirBox}>
                      <Text style={S.kurirText}>🛵 Kurir: {order.kurirName}</Text>
                    </View>
                  ) : null}

                  <Divider style={S.divider} />

                  {/* ── Item Pesanan ── */}
                  {order.items.map(item => (
                    <View key={item.productId} style={S.itemRow}>
                      <Text style={S.itemName}>{item.name}</Text>
                      <Text style={S.itemDetail}>
                        {item.qty + " x Rp " + item.price.toLocaleString("id-ID")}
                      </Text>
                      <Text style={S.itemTotal}>
                        {"Rp " + (item.qty * item.price).toLocaleString("id-ID")}
                      </Text>
                    </View>
                  ))}

                  <Divider style={S.divider} />

                  {/* ── Total ── */}
                  <View style={S.totalRow}>
                    <Text style={S.totalLabel}>Total Bayar</Text>
                    <Text style={S.totalValue}>
                      {"Rp " + order.total.toLocaleString("id-ID")}
                    </Text>
                  </View>

                  {/* ── Box verifikasi bayar ── */}
                  {order.status === "menunggu" && (
                    <View style={S.verifikasiBox}>
                      <Text style={S.verifikasiTitle}>🔍 Verifikasi Pembayaran</Text>
                      <Text style={S.verifikasiDesc}>
                        Pastikan bukti bayar sudah diterima sebelum konfirmasi.
                      </Text>
                      {order.metodeBayarCustomer === "transfer" && transferMethod && (
                        <View style={S.verifikasiMethodRow}>
                          <Text style={S.verifikasiMethodText}>
                            {"🏦 Cek mutasi " + (transferMethod.bankName ?? "") +
                              " — " + (transferMethod.accountNumber ?? "")}
                          </Text>
                        </View>
                      )}
                      {order.metodeBayarCustomer === "qris" && qrisMethod && (
                        <View style={S.verifikasiMethodRow}>
                          <Text style={S.verifikasiMethodText}>
                            📱 Cek notifikasi pembayaran QRIS
                          </Text>
                        </View>
                      )}
                    </View>
                  )}

                  {/* ── Info kurir sedang antar ── */}
                  {(order.status === "dikonfirmasi" || order.status === "disiapkan") &&
                    order.kurirName && (
                      <View style={S.kurirStatusBox}>
                        <Text style={S.kurirStatusText}>
                          🛵 Kurir {order.kurirName} sedang mengantar
                        </Text>
                      </View>
                    )}

                  {/* ── Aksi ── */}
                  {isAktif && (
                    <View style={S.actionRow}>
                      <Button
                        mode="outlined"
                        textColor="#C62828"
                        style={S.btnBatal}
                        compact
                        onPress={() => handleBatalkan(order)}
                      >
                        ❌ Batalkan
                      </Button>
                      {nextStatus && nextLabel && (
                        <Button
                          mode="contained"
                          buttonColor={GREEN}
                          style={S.btnNext}
                          compact
                          onPress={() => handleNextStatus(order)}
                        >
                          {nextLabel}
                        </Button>
                      )}
                    </View>
                  )}
                </Card.Content>
              </Card>
            );
          })
        )}
      </ScrollView>

      {/* ════════════════════════════════════════════════════════════
          DIALOG ASSIGN KURIR
      ════════════════════════════════════════════════════════════ */}
      {showKurirDialog && selectedOrder && (
        <View style={S.dialogOverlay}>
          <View style={S.dialogCard}>
            <Text style={S.dialogTitle}>🛵 Pilih Kurir</Text>
            <Text style={S.dialogSubtitle}>
              {"Pesanan #" + selectedOrder.id.slice(-6) +
                " — " + selectedOrder.customerName}
            </Text>

            {selectedOrder.metodeBayarCustomer ? (
              <View style={S.dialogBayarBadge}>
                <Text style={S.dialogBayarBadgeText}>
                  {METODE_LABEL[selectedOrder.metodeBayarCustomer] ??
                    ("💳 " + selectedOrder.metodeBayarCustomer)}
                </Text>
              </View>
            ) : null}

            <Divider style={S.divider} />

            {/* ── Checklist verifikasi bayar ── */}
            <View style={S.checklistBox}>
              <Text style={S.checklistText}>
                ✅ Bukti pembayaran sudah diterima & diverifikasi
              </Text>
            </View>

            <Divider style={S.divider} />

            {/* ── Daftar kurir STANDBY ── */}
            <Text style={S.kurirListTitle}>
              {"🟢 Kurir Standby (" + kurirStandby.length + ")"}
            </Text>

            {kurirStandby.length === 0 ? (
              <View style={S.noKurirBox}>
                <Text style={S.noKurirText}>
                  Tidak ada kurir standby saat ini.{"\n"}
                  Gunakan input manual di bawah.
                </Text>
              </View>
            ) : (
              <ScrollView
                style={S.kurirListScroll}
                nestedScrollEnabled
                showsVerticalScrollIndicator={false}
              >
                {kurirStandby.map(k => (
                  <TouchableOpacity
                    key={k.id}
                    style={[
                      S.kurirListItem,
                      kurirInput === k.name && S.kurirListItemActive,
                    ]}
                    onPress={() => setKurirInput(k.name)}
                  >
                    <View style={S.kurirListItemLeft}>
                      <Text style={S.kurirListItemName}>{k.name}</Text>
                      <Text style={S.kurirListItemSub}>
                        {k.wilayah + (k.phone ? "  •  " + k.phone : "")}
                      </Text>
                    </View>
                    <View style={S.kurirStandbyBadge}>
                      <Text style={S.kurirStandbyBadgeText}>🟢 Standby</Text>
                    </View>
                    {kurirInput === k.name && (
                      <Text style={S.kurirSelectedCheck}>✓</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {/* ── Kurir Busy (informasi saja) ── */}
            {kurirBusy.length > 0 && (
              <View style={S.kurirBusyInfo}>
                <Text style={S.kurirBusyInfoText}>
                  {"🟡 " + kurirBusy.length + " kurir sedang busy: " +
                    kurirBusy.map(k => k.name).join(", ")}
                </Text>
              </View>
            )}

            {/* ── Toggle input manual ── */}
            <TouchableOpacity
              style={S.manualToggle}
              onPress={() => setShowManualInput(!showManualInput)}
            >
              <Text style={S.manualToggleText}>
                {showManualInput ? "▲ Tutup input manual" : "✏️ Input nama kurir manual"}
              </Text>
            </TouchableOpacity>

            {showManualInput && (
              <TextInput
                mode="outlined"
                label="Nama Kurir Manual"
                value={kurirInput}
                onChangeText={setKurirInput}
                placeholder="Ketik nama kurir..."
                style={S.kurirInput}
                left={<TextInput.Icon icon="account-cowboy-hat" color={GREEN} />}
              />
            )}

            {/* ── Kurir terpilih ── */}
            {kurirInput.trim() !== "" && (
              <View style={S.selectedKurirBox}>
                <Text style={S.selectedKurirText}>
                  {"✅ Dipilih: " + kurirInput}
                </Text>
              </View>
            )}

            <Divider style={S.divider} />

            <Text style={S.dialogTotal}>
              {"Total: Rp " + selectedOrder.total.toLocaleString("id-ID")}
            </Text>

            <View style={S.dialogActions}>
              <Button
                mode="outlined"
                textColor="#888"
                style={S.dialogBtn}
                onPress={() => {
                  setShowKurirDialog(false);
                  setSelectedOrder(null);
                  setKurirInput("");
                  setShowManualInput(false);
                }}
              >
                Batal
              </Button>
              <Button
                mode="contained"
                buttonColor={GREEN}
                style={S.dialogBtn}
                disabled={!kurirInput.trim()}
                onPress={handleKonfirmasiDenganKurir}
              >
                ✅ Konfirmasi
              </Button>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  root:                 { flex: 1, backgroundColor: "#F7FAF7" },
  appbar:               { backgroundColor: GREEN },
  appbarTitle:          { color: "#FFF", fontWeight: "700" },
  appbarSubtitle:       { color: "#C8E6C9", fontSize: 11 },
  headerBadge:          { backgroundColor: "#C62828", marginRight: 12 },

  // Tab
  tabRow:               { flexDirection: "row", backgroundColor: "#FFF", borderBottomWidth: 1, borderBottomColor: "#E1EEE1" },
  tabBtn:               { flex: 1, paddingVertical: 12, alignItems: "center" },
  tabBtnActive:         { borderBottomWidth: 2, borderBottomColor: GREEN },
  tabBtnText:           { fontSize: 13, color: "#888", fontWeight: "600" },
  tabBtnTextActive:     { color: GREEN, fontWeight: "800" },

  // Kurir summary bar
  kurirSummaryBar:      { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#FFF", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#E1EEE1", gap: 8 },
  kurirSummaryText:     { fontSize: 12, fontWeight: "700", color: "#444" },
  kurirSummaryDivider:  { color: "#DDD", fontSize: 14 },

  // List
  scroll:               { padding: 16, paddingBottom: 40 },
  emptyBox:             { alignItems: "center", paddingTop: 80 },
  emptyIcon:            { fontSize: 48, marginBottom: 12 },
  emptyTitle:           { fontSize: 16, fontWeight: "800", color: "#333" },
  emptySubtitle:        { fontSize: 12, color: "#AAA", marginTop: 4, textAlign: "center" },

  // Card
  card:                 { marginBottom: 14, borderColor: "#E1EEE1", backgroundColor: "#FFF" },
  cardHighlight:        { borderColor: "#E65100", borderWidth: 2 },
  orderHeader:          { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  orderId:              { fontSize: 16, fontWeight: "800", color: "#1B5E20" },
  orderDate:            { fontSize: 11, color: "#888", marginTop: 2 },
  statusBadge:          { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  statusText:           { fontSize: 12, fontWeight: "700" },
  divider:              { marginVertical: 10 },

  infoBox:              { gap: 4 },
  infoName:             { fontSize: 14, fontWeight: "700", color: "#1F2D1F" },
  infoSub:              { fontSize: 12, color: "#555" },
  infoCatatan:          { fontSize: 11, color: "#888", fontStyle: "italic" },
  bayarBadge:           { backgroundColor: "#E3F2FD", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginTop: 4, alignSelf: "flex-start" },
  bayarBadgeText:       { fontSize: 11, fontWeight: "700", color: "#1565C0" },

  kurirBox:             { backgroundColor: "#E8F5E9", borderRadius: 8, padding: 8, marginTop: 6 },
  kurirText:            { fontSize: 13, fontWeight: "700", color: GREEN },

  itemRow:              { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  itemName:             { fontSize: 13, color: "#1F2D1F", flex: 1 },
  itemDetail:           { fontSize: 12, color: "#888", marginHorizontal: 8 },
  itemTotal:            { fontSize: 13, fontWeight: "700", color: GREEN },

  totalRow:             { flexDirection: "row", justifyContent: "space-between" },
  totalLabel:           { fontSize: 14, fontWeight: "700", color: "#1B5E20" },
  totalValue:           { fontSize: 15, fontWeight: "900", color: GREEN },

  verifikasiBox:        { backgroundColor: "#FFF9C4", borderRadius: 10, padding: 12, marginTop: 10, borderWidth: 1, borderColor: "#F9A825" },
  verifikasiTitle:      { fontSize: 13, fontWeight: "700", color: "#F57F17", marginBottom: 4 },
  verifikasiDesc:       { fontSize: 12, color: "#795548", lineHeight: 18 },
  verifikasiMethodRow:  { marginTop: 6 },
  verifikasiMethodText: { fontSize: 12, color: "#5D4037", fontWeight: "600" },

  kurirStatusBox:       { backgroundColor: "#E8F5E9", borderRadius: 8, padding: 10, marginTop: 8 },
  kurirStatusText:      { fontSize: 12, color: GREEN, fontWeight: "600" },

  actionRow:            { flexDirection: "row", gap: 10, marginTop: 12 },
  btnBatal:             { flex: 1 },
  btnNext:              { flex: 2, borderRadius: 8 },

  // Dialog
  dialogOverlay:        { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", padding: 20 },
  dialogCard:           { backgroundColor: "#FFF", borderRadius: 20, padding: 20, maxHeight: "90%" },
  dialogTitle:          { fontSize: 18, fontWeight: "800", color: "#1B5E20", marginBottom: 4 },
  dialogSubtitle:       { fontSize: 12, color: "#888" },
  dialogBayarBadge:     { backgroundColor: "#E3F2FD", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginTop: 6, alignSelf: "flex-start" },
  dialogBayarBadgeText: { fontSize: 11, fontWeight: "700", color: "#1565C0" },
  checklistBox:         { backgroundColor: "#E8F5E9", borderRadius: 8, padding: 10 },
  checklistText:        { fontSize: 13, color: GREEN, fontWeight: "600" },

  // Daftar kurir
  kurirListTitle:       { fontSize: 13, fontWeight: "800", color: "#1B5E20", marginBottom: 8 },
  kurirListScroll:      { maxHeight: 180 },
  kurirListItem:        { flexDirection: "row", alignItems: "center", padding: 12, borderRadius: 10, borderWidth: 1.5, borderColor: "#E1EEE1", marginBottom: 6, backgroundColor: "#FAFAFA" },
  kurirListItemActive:  { borderColor: GREEN, backgroundColor: "#E8F5E9" },
  kurirListItemLeft:    { flex: 1 },
  kurirListItemName:    { fontSize: 14, fontWeight: "700", color: "#1F2D1F" },
  kurirListItemSub:     { fontSize: 11, color: "#888", marginTop: 2 },
  kurirStandbyBadge:    { backgroundColor: "#E8F5E9", borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2, marginLeft: 8 },
  kurirStandbyBadgeText:{ fontSize: 10, color: GREEN, fontWeight: "700" },
  kurirSelectedCheck:   { fontSize: 18, color: GREEN, fontWeight: "900", marginLeft: 8 },

  noKurirBox:           { backgroundColor: "#FFF3E0", borderRadius: 8, padding: 12, marginBottom: 8 },
  noKurirText:          { fontSize: 12, color: "#E65100", textAlign: "center", lineHeight: 20 },

  kurirBusyInfo:        { backgroundColor: "#FFF8E1", borderRadius: 8, padding: 8, marginTop: 4, marginBottom: 4 },
  kurirBusyInfoText:    { fontSize: 11, color: "#F57F17" },

  manualToggle:         { paddingVertical: 8, alignItems: "center" },
  manualToggleText:     { fontSize: 12, color: GREEN, fontWeight: "700" },
  kurirInput:           { backgroundColor: "#FFF", marginBottom: 8 },

  selectedKurirBox:     { backgroundColor: "#E8F5E9", borderRadius: 8, padding: 10, marginTop: 4 },
  selectedKurirText:    { fontSize: 13, fontWeight: "700", color: GREEN },

  dialogTotal:          { fontSize: 15, fontWeight: "800", color: GREEN, textAlign: "right", marginBottom: 12 },
  dialogActions:        { flexDirection: "row", gap: 12 },
  dialogBtn:            { flex: 1 },
});