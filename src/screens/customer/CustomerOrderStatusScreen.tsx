import React, { useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Card, Divider, Text } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CustomerSession, useOrders } from "../../context/OrderContext";

const GREEN = "#2E7D32";

// ✅ Alur baru: customer sudah bayar dulu, kasir konfirmasi setelah verifikasi
const STEP_CONFIG = [
  {
    status: "menunggu",
    icon:   "💳",
    label:  "Menunggu Konfirmasi",
    desc:   "Kasir sedang memverifikasi pembayaran Anda",
  },
  {
    status: "dikonfirmasi",
    icon:   "✅",
    label:  "Pesanan Dikonfirmasi",
    desc:   "Pembayaran diterima! Pesanan sedang disiapkan",
  },
  {
    status: "disiapkan",
    icon:   "📦",
    label:  "Pesanan Disiapkan",
    desc:   "Kurir sedang dalam perjalanan ke lokasi Anda",
  },
  {
    status: "selesai",
    icon:   "🎉",
    label:  "Selesai",
    desc:   "Pesanan telah diterima. Terima kasih!",
  },
];

const STATUS_ORDER = ["menunggu", "dikonfirmasi", "disiapkan", "selesai"];

const METODE_LABEL: Record<string, string> = {
  transfer: "🏦 Transfer Bank",
  qris:     "📱 QRIS",
  va:       "🏧 Virtual Account",
};

type Props = {
  session: CustomerSession;
};

export default function CustomerOrderStatusScreen({ session }: Props) {
  const { orders }  = useOrders();
  const insets      = useSafeAreaInsets();
  const [refreshing,  setRefreshing]  = useState(false);
  const [expandedId,  setExpandedId]  = useState<string | null>(null);

  const myOrders = orders
    .filter(o => o.customerPhone === session.phone)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return (
      d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) +
      " " +
      d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
    );
  };

  const scrollPad = { paddingBottom: insets.bottom + 24 };

  return (
    <ScrollView
      contentContainerStyle={[S.scroll, scrollPad]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[GREEN]} />
      }
    >
      {/* Header */}
      <View style={S.header}>
        <Text style={S.headerTitle}>📦 Status Pesanan</Text>
        <Text style={S.headerSub}>Halo, {session.name}!</Text>
      </View>

      {myOrders.length === 0 ? (
        <View style={S.emptyBox}>
          <Text style={S.emptyIcon}>🛒</Text>
          <Text style={S.emptyTitle}>Belum ada pesanan</Text>
          <Text style={S.emptySubtitle}>
            Pesanan Anda akan muncul di sini setelah checkout
          </Text>
        </View>
      ) : (
        myOrders.map(order => {
          const isBatalkan  = order.status === "dibatalkan";
          const currentStep = STATUS_ORDER.indexOf(order.status);
          const isExpanded  = expandedId === order.id;

          return (
            <Card
              key={order.id}
              style={[S.card, isBatalkan && S.cardBatalkan]}
              mode="outlined"
            >
              <Card.Content>

                {/* ── Header pesanan (tap untuk expand) ── */}
                <TouchableOpacity onPress={() => setExpandedId(isExpanded ? null : order.id)}>
                  <View style={S.orderHeader}>
                    <View>
                      <Text style={S.orderId}>{"Pesanan #" + order.id.slice(-6)}</Text>
                      <Text style={S.orderDate}>{formatDate(order.createdAt)}</Text>
                    </View>
                    <View style={S.headerRight}>
                      <Text style={S.orderTotal}>
                        {"Rp " + order.total.toLocaleString("id-ID")}
                      </Text>
                      <Text style={S.expandIcon}>{isExpanded ? "▲" : "▼"}</Text>
                    </View>
                  </View>
                </TouchableOpacity>

                {/* ── Metode bayar yang digunakan ── */}
                {order.metodeBayarCustomer ? (
                  <View style={S.metodeBadge}>
                    <Text style={S.metodeBadgeText}>
                      {METODE_LABEL[order.metodeBayarCustomer] ??
                        ("💳 " + order.metodeBayarCustomer)}
                    </Text>
                  </View>
                ) : null}

                {/* ── Status Steps ── */}
                {!isBatalkan && (
                  <View style={S.stepsBox}>
                    {STEP_CONFIG.map((step, idx) => {
                      const done    = idx < currentStep;
                      const active  = idx === currentStep;
                      const pending = idx > currentStep;

                      const dotStyle = [
                        S.stepDot,
                        done    && S.stepDotDone,
                        active  && S.stepDotActive,
                        pending && S.stepDotPending,
                      ];
                      const labelStyle = [
                        S.stepLabel,
                        done    && S.stepLabelDone,
                        active  && S.stepLabelActive,
                        pending && S.stepLabelPending,
                      ];

                      return (
                        <View key={step.status} style={S.stepRow}>
                          <View style={S.stepLeft}>
                            <View style={dotStyle}>
                              <Text style={S.stepDotIcon}>{done ? "✓" : step.icon}</Text>
                            </View>
                            {idx < STEP_CONFIG.length - 1 && (
                              <View style={[S.stepLine, done && S.stepLineDone]} />
                            )}
                          </View>
                          <View style={S.stepContent}>
                            <Text style={labelStyle}>{step.label}</Text>
                            {active && (
                              <Text style={S.stepDesc}>{step.desc}</Text>
                            )}
                            {/* Tampilkan nama kurir saat step disiapkan / active */}
                            {active && step.status === "disiapkan" && order.kurirName && (
                              <Text style={S.stepKurir}>
                                {"🛵 " + order.kurirName}
                              </Text>
                            )}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}

                {/* ── Status dibatalkan ── */}
                {isBatalkan && (
                  <View style={S.batalBox}>
                    <Text style={S.batalText}>❌ Pesanan ini telah dibatalkan</Text>
                  </View>
                )}

                {/* ── Info kurir (setelah dikonfirmasi) ── */}
                {!isBatalkan && order.kurirName &&
                  (order.status === "dikonfirmasi" ||
                   order.status === "disiapkan"    ||
                   order.status === "selesai") && (
                    <View style={S.kurirInfoBox}>
                      <Text style={S.kurirInfoText}>
                        🛵 Kurir Anda: {order.kurirName}
                      </Text>
                    </View>
                  )}

                {/* ── Menunggu box (status menunggu) ── */}
                {order.status === "menunggu" && (
                  <View style={S.waitingBox}>
                    <Text style={S.waitingIcon}>⏳</Text>
                    <Text style={S.waitingText}>
                      Pembayaran Anda sedang diverifikasi oleh kasir.
                      Mohon tunggu konfirmasi.
                    </Text>
                  </View>
                )}

                {/* ── Detail pesanan (expandable) ── */}
                {isExpanded && (
                  <View>
                    <Divider style={S.divider} />
                    <Text style={S.detailTitle}>Detail Produk</Text>
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
                    {order.biayaLayanan > 0 && (
                      <View style={S.summaryRow}>
                        <Text style={S.summaryLabel}>Biaya Layanan</Text>
                        <Text style={S.summaryValue}>
                          {"Rp " + order.biayaLayanan.toLocaleString("id-ID")}
                        </Text>
                      </View>
                    )}
                    <View style={S.summaryRow}>
                      <Text style={[S.summaryLabel, S.totalLabelStyle]}>Total Bayar</Text>
                      <Text style={S.totalValueStyle}>
                        {"Rp " + order.total.toLocaleString("id-ID")}
                      </Text>
                    </View>
                    <Divider style={S.divider} />
                    <Text style={S.infoSmall}>📍 {order.alamat}</Text>
                    {order.catatan
                      ? <Text style={S.infoSmallCatatan}>📝 {order.catatan}</Text>
                      : null}
                  </View>
                )}

              </Card.Content>
            </Card>
          );
        })
      )}

      <Text style={S.refreshHint}>↓ Tarik ke bawah untuk refresh status</Text>
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  scroll:             { padding: 16 },

  // Header
  header:             { marginBottom: 16 },
  headerTitle:        { fontSize: 20, fontWeight: "800", color: "#1B5E20" },
  headerSub:          { fontSize: 13, color: "#5E6E5E", marginTop: 4 },

  // Empty
  emptyBox:           { alignItems: "center", paddingTop: 80 },
  emptyIcon:          { fontSize: 48, marginBottom: 12 },
  emptyTitle:         { fontSize: 16, fontWeight: "800", color: "#333" },
  emptySubtitle:      { fontSize: 12, color: "#AAA", marginTop: 4, textAlign: "center" },

  // Card
  card:               { marginBottom: 14, borderColor: "#E1EEE1", backgroundColor: "#FFF" },
  cardBatalkan:       { borderColor: "#C62828", opacity: 0.7 },
  orderHeader:        { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  orderId:            { fontSize: 15, fontWeight: "800", color: "#1B5E20" },
  orderDate:          { fontSize: 11, color: "#888", marginTop: 2 },
  headerRight:        { alignItems: "flex-end" },
  orderTotal:         { fontSize: 15, fontWeight: "800", color: GREEN },
  expandIcon:         { fontSize: 12, color: "#AAA", marginTop: 4 },

  // Metode badge
  metodeBadge:        { backgroundColor: "#E3F2FD", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginTop: 8, alignSelf: "flex-start" },
  metodeBadgeText:    { fontSize: 11, fontWeight: "700", color: "#1565C0" },

  // Steps
  stepsBox:           { marginTop: 14 },
  stepRow:            { flexDirection: "row" },
  stepLeft:           { alignItems: "center", width: 36 },
  stepDot:            { width: 32, height: 32, borderRadius: 16, backgroundColor: "#EEE", alignItems: "center", justifyContent: "center" },
  stepDotDone:        { backgroundColor: GREEN },
  stepDotActive:      { backgroundColor: "#FFF3E0", borderWidth: 2, borderColor: "#E65100" },
  stepDotPending:     { backgroundColor: "#F5F5F5" },
  stepDotIcon:        { fontSize: 14 },
  stepLine:           { width: 2, height: 24, backgroundColor: "#DDD", marginVertical: 2 },
  stepLineDone:       { backgroundColor: GREEN },
  stepContent:        { flex: 1, paddingLeft: 12, paddingBottom: 16 },
  stepLabel:          { fontSize: 13, fontWeight: "700" },
  stepLabelDone:      { color: GREEN },
  stepLabelActive:    { color: "#E65100" },
  stepLabelPending:   { color: "#BBB" },
  stepDesc:           { fontSize: 11, color: "#E65100", marginTop: 2 },
  stepKurir:          { fontSize: 12, color: GREEN, fontWeight: "700", marginTop: 4 },

  // Batalkan
  batalBox:           { backgroundColor: "#FFEBEE", borderRadius: 8, padding: 12, marginTop: 10 },
  batalText:          { fontSize: 13, fontWeight: "700", color: "#C62828", textAlign: "center" },

  // Kurir info
  kurirInfoBox:       { backgroundColor: "#E8F5E9", borderRadius: 8, padding: 10, marginTop: 8 },
  kurirInfoText:      { fontSize: 13, fontWeight: "700", color: GREEN },

  // Waiting box
  waitingBox:         { flexDirection: "row", alignItems: "flex-start", backgroundColor: "#FFF9C4", borderRadius: 10, padding: 12, marginTop: 8, gap: 8 },
  waitingIcon:        { fontSize: 18 },
  waitingText:        { fontSize: 12, color: "#795548", lineHeight: 18, flex: 1 },

  // Detail expand
  divider:            { marginVertical: 10 },
  detailTitle:        { fontSize: 13, fontWeight: "700", color: "#1B5E20", marginBottom: 8 },
  itemRow:            { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  itemName:           { fontSize: 13, color: "#1F2D1F", flex: 1 },
  itemDetail:         { fontSize: 12, color: "#888", marginHorizontal: 8 },
  itemTotal:          { fontSize: 13, fontWeight: "700", color: GREEN },
  summaryRow:         { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  summaryLabel:       { fontSize: 13, color: "#555" },
  summaryValue:       { fontSize: 13, fontWeight: "700", color: "#333" },
  totalLabelStyle:    { fontWeight: "800", color: "#1B5E20" },
  totalValueStyle:    { fontSize: 15, fontWeight: "900", color: GREEN },
  infoSmall:          { fontSize: 12, color: "#555", marginTop: 4 },
  infoSmallCatatan:   { fontSize: 11, color: "#888", fontStyle: "italic", marginTop: 2 },

  refreshHint:        { textAlign: "center", color: "#CCC", fontSize: 11, marginTop: 12, marginBottom: 8 },
});