// src/screens/KurirGPSScreen.tsx — v1
// Fitur: GPS realtime, daftar order aktif per kurir, buka navigasi ke alamat customer
// Dependency: expo-location (install: npx expo install expo-location)

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Linking,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useAuth } from "../context/AuthContext";

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
  status: "menunggu" | "diproses" | "dikirim" | "selesai" | "dibatalkan";
  kurirId?: string;
  kurirName?: string;
  metodeBayar?: string;
  createdAt: string;
  note?: string;
}

interface StoreInfo {
  namaToko?: string;
  tokoName?: string;
  alamat?: string;
  lat?: number;
  lng?: number;
  phone?: string;
}

interface OrderWithDistance extends OnlineOrder {
  storeNama?: string;
  distanceKm?: number;
}

interface KurirGPSScreenProps {
  kurirId?: string;
  onBack?: () => void;
}

// ─── Konstanta ────────────────────────────────────────────────────────────────

const INDIGO     = "#6366F1";
const SUCCESS    = "#16A34A";
const DANGER     = "#DC2626";
const ORANGE     = "#D97706";
const BLUE       = "#2563EB";
const BOTTOM_SAFE = Platform.OS === "ios" ? 34 : 24;
const ORDERS_KEY  = "@twd_orders";

const STATUS_LABEL: Record<string, string> = {
  diproses: "🔄 Diproses",
  dikirim:  "🚚 Dikirim",
};

const STATUS_COLOR: Record<string, string> = {
  diproses: BLUE,
  dikirim:  INDIGO,
};

const BOTTOM_SPACER_STYLE = { height: BOTTOM_SAFE + 20 };
// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRp(n: number): string {
  return "Rp " + Math.round(n).toLocaleString("id-ID");
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("id-ID", {
    day: "2-digit", month: "short",
    hour: "2-digit", minute: "2-digit",
  });
}

// Haversine — hitung jarak dua koordinat (km)
function hitungJarak(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatJarak(km: number): string {
  if (km < 1) return Math.round(km * 1000) + " m";
  return km.toFixed(1) + " km";
}

// Buka Google Maps / Apple Maps ke alamat
function bukaNavigasi(address: string, lat?: number, lng?: number) {
  let url: string;
  if (lat && lng) {
    url = Platform.OS === "ios"
      ? "maps://?daddr=" + lat + "," + lng
      : "geo:" + lat + "," + lng + "?q=" + encodeURIComponent(address);
  } else {
    const q = encodeURIComponent(address);
    url = Platform.OS === "ios"
      ? "maps://?q=" + q
      : "https://maps.google.com/?q=" + q;
  }
  Linking.canOpenURL(url).then((ok) => {
    if (ok) {
      Linking.openURL(url);
    } else {
      // Fallback Google Maps web
      Linking.openURL("https://maps.google.com/?q=" + encodeURIComponent(address));
    }
  });
}

// Buka telepon
function bukaTelepon(phone: string) {
  Linking.openURL("tel:" + phone.replace(/\D/g, ""));
}

// ─── Komponen Utama ───────────────────────────────────────────────────────────

export default function KurirGPSScreen({ kurirId, onBack }: KurirGPSScreenProps) {
  const { user } = useAuth() as any;

  const resolvedKurirId: string = kurirId ?? user?.id ?? user?.kasirId ?? "";

  // ── State lokasi ──────────────────────────────────────────────────────
  const [locationPerm,  setLocationPerm]  = useState<"unknown" | "granted" | "denied">("unknown");
  const [currentLoc,    setCurrentLoc]    = useState<Location.LocationObject | null>(null);
  const [alamatKurir,   setAlamatKurir]   = useState<string | null>(null);
  const [loadingLoc,    setLoadingLoc]    = useState(false);
  const [tracking,      setTracking]      = useState(false);

  // ── State order ───────────────────────────────────────────────────────
  const [orders,      setOrders]      = useState<OrderWithDistance[]>([]);
  const [loadingOrder,setLoadingOrder] = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);

  const watchRef = useRef<Location.LocationSubscription | null>(null);

  // ── Minta izin & ambil lokasi awal ────────────────────────────────────
  const initLocation = useCallback(async () => {
    setLoadingLoc(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocationPerm("denied");
        return;
      }
      setLocationPerm("granted");
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setCurrentLoc(loc);
      // Reverse geocoding
      try {
        const results = await Location.reverseGeocodeAsync({
          latitude:  loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
        if (results.length > 0) {
          const r = results[0];
          const parts = [r.street, r.district, r.city, r.region].filter(Boolean);
          setAlamatKurir(parts.join(", "));
        }
      } catch {}
    } catch (e) {
      Alert.alert("Gagal GPS", "Tidak dapat mengambil lokasi: " + String(e));
    } finally {
      setLoadingLoc(false);
    }
  }, []);

  // ── Tracking realtime ─────────────────────────────────────────────────
  const startTracking = useCallback(async () => {
    if (watchRef.current) return;
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") { setLocationPerm("denied"); return; }
    setTracking(true);
    watchRef.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Balanced, timeInterval: 10000, distanceInterval: 20 },
      (loc) => {
        setCurrentLoc(loc);
        Location.reverseGeocodeAsync({ latitude: loc.coords.latitude, longitude: loc.coords.longitude })
          .then((res) => {
            if (res.length > 0) {
              const r = res[0];
              setAlamatKurir([r.street, r.district, r.city].filter(Boolean).join(", "));
            }
          })
          .catch(() => {});
      },
    );
  }, []);

  const stopTracking = useCallback(() => {
    watchRef.current?.remove();
    watchRef.current = null;
    setTracking(false);
  }, []);

  useEffect(() => {
    initLocation();
    return () => { watchRef.current?.remove(); };
  }, [initLocation]);

  // ── Load order aktif milik kurir ini ──────────────────────────────────
  const loadOrders = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(ORDERS_KEY);
      const all: OnlineOrder[] = raw ? JSON.parse(raw) : [];

      // Filter: order milik kurir ini, status aktif
      const mine = all.filter(
        (o) =>
          String(o.kurirId ?? "") === resolvedKurirId &&
          (o.status === "diproses" || o.status === "dikirim"),
      );

      // Ambil nama toko per ownerId
      const ownerIds = [...new Set(mine.map((o) => o.ownerId))];
      const storeMap: Record<string, StoreInfo> = {};
      for (const oid of ownerIds) {
        try {
          const infoRaw = await AsyncStorage.getItem("@twd_store_info_" + oid);
          if (infoRaw) storeMap[oid] = JSON.parse(infoRaw);
        } catch {}
      }

      // Hitung jarak jika lokasi tersedia
      const enriched: OrderWithDistance[] = mine.map((o) => {
        const store = storeMap[o.ownerId];
        let distanceKm: number | undefined;
        if (currentLoc && store?.lat && store?.lng) {
          distanceKm = hitungJarak(
            currentLoc.coords.latitude,
            currentLoc.coords.longitude,
            store.lat,
            store.lng,
          );
        }
        return {
          ...o,
          storeNama: store?.namaToko ?? store?.tokoName ?? "Toko",
          distanceKm,
        };
      });

      // Sort: dikirim dulu, lalu diproses; dalam grup sort by jarak
      enriched.sort((a, b) => {
        if (a.status === "dikirim" && b.status !== "dikirim") return -1;
        if (b.status === "dikirim" && a.status !== "dikirim") return 1;
        if (a.distanceKm !== undefined && b.distanceKm !== undefined) {
          return a.distanceKm - b.distanceKm;
        }
        return 0;
      });

      setOrders(enriched);
    } catch (e) {
      console.error("KurirGPS loadOrders:", e);
    } finally {
      setLoadingOrder(false);
      setRefreshing(false);
    }
  }, [resolvedKurirId, currentLoc]);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  function onRefresh() {
    setRefreshing(true);
    initLocation();
    loadOrders();
  }

  // ── Update status order ───────────────────────────────────────────────
  async function updateStatus(orderId: string, newStatus: "dikirim" | "selesai") {
    try {
      const raw = await AsyncStorage.getItem(ORDERS_KEY);
      const all: OnlineOrder[] = raw ? JSON.parse(raw) : [];
      const updated = all.map((o) =>
        o.id === orderId ? { ...o, status: newStatus } : o,
      );
      await AsyncStorage.setItem(ORDERS_KEY, JSON.stringify(updated));
      await loadOrders();
      Alert.alert(
        "Status Diperbarui ✅",
        newStatus === "dikirim" ? "Pesanan ditandai sedang dikirim." : "Pesanan ditandai selesai dikirim.",
      );
    } catch {
      Alert.alert("Error", "Gagal memperbarui status.");
    }
  }

  function konfirmasiUpdate(order: OrderWithDistance, newStatus: "dikirim" | "selesai") {
    const labels = { dikirim: "Tandai Sedang Dikirim", selesai: "Tandai Selesai Dikirim" };
    Alert.alert(
      labels[newStatus],
      "Pesanan untuk " + order.customerName + " akan ditandai " + newStatus + ".",
      [
        { text: "Batal", style: "cancel" },
        { text: labels[newStatus], onPress: () => updateStatus(order.id, newStatus) },
      ],
    );
  }

  // ══════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════

  return (
    <View style={KG.container}>

      {/* ── Header ── */}
      <View style={KG.header}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={KG.backBtn}>
            <Text style={KG.backTxt}>{"← Kembali"}</Text>
          </TouchableOpacity>
        )}
        <View style={KG.headerCenter}>
          <Text style={KG.headerTitle}>{"📍 GPS Kurir"}</Text>
          <Text style={KG.headerSub}>{"Navigasi & Status Pengiriman"}</Text>
        </View>
        <TouchableOpacity
          style={tracking ? KG.trackingBtnOn : KG.trackingBtnOff}
          onPress={tracking ? stopTracking : startTracking}
        >
          <Text style={KG.trackingBtnTxt}>{tracking ? "🔴 Live" : "▶ Track"}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={KG.scrollContent}
      >

        {/* ── Kartu Lokasi Saya ── */}
        <View style={KG.locCard}>
          <View style={KG.locCardTop}>
            <Text style={KG.locCardTitle}>{"📍 Lokasi Saya"}</Text>
            {tracking && (
              <View style={KG.liveDot}>
                <View style={KG.liveDotInner} />
                <Text style={KG.liveTxt}>{"LIVE"}</Text>
              </View>
            )}
          </View>

          {loadingLoc && (
            <View style={KG.locLoading}>
              <ActivityIndicator color={INDIGO} size="small" />
              <Text style={KG.locLoadingTxt}>{"Mengambil lokasi..."}</Text>
            </View>
          )}

          {!loadingLoc && locationPerm === "denied" && (
            <View style={KG.permDenied}>
              <Text style={KG.permDeniedIcon}>{"🚫"}</Text>
              <Text style={KG.permDeniedTxt}>{"Izin lokasi ditolak."}</Text>
              <TouchableOpacity style={KG.permBtn} onPress={initLocation}>
                <Text style={KG.permBtnTxt}>{"Coba Lagi"}</Text>
              </TouchableOpacity>
            </View>
          )}

          {!loadingLoc && locationPerm === "granted" && currentLoc && (
            <View style={KG.locInfo}>
              <View style={KG.locCoordRow}>
                <View style={KG.locCoordItem}>
                  <Text style={KG.locCoordLbl}>{"Latitude"}</Text>
                  <Text style={KG.locCoordVal}>{currentLoc.coords.latitude.toFixed(6)}</Text>
                </View>
                <View style={KG.locCoordDivider} />
                <View style={KG.locCoordItem}>
                  <Text style={KG.locCoordLbl}>{"Longitude"}</Text>
                  <Text style={KG.locCoordVal}>{currentLoc.coords.longitude.toFixed(6)}</Text>
                </View>
                <View style={KG.locCoordDivider} />
                <View style={KG.locCoordItem}>
                  <Text style={KG.locCoordLbl}>{"Akurasi"}</Text>
                  <Text style={KG.locCoordVal}>{Math.round(currentLoc.coords.accuracy ?? 0) + " m"}</Text>
                </View>
              </View>
              {alamatKurir && (
                <View style={KG.alamatRow}>
                  <Text style={KG.alamatTxt}>{alamatKurir}</Text>
                </View>
              )}
              <View style={KG.locActions}>
                <TouchableOpacity
                  style={KG.locRefreshBtn}
                  onPress={initLocation}
                >
                  <Text style={KG.locRefreshTxt}>{"🔄 Perbarui"}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={KG.locOpenMapsBtn}
                  onPress={() => bukaNavigasi(
                    alamatKurir ?? "Lokasi saya",
                    currentLoc.coords.latitude,
                    currentLoc.coords.longitude,
                  )}
                >
                  <Text style={KG.locOpenMapsTxt}>{"🗺 Buka Maps"}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* ── Daftar Order Aktif ── */}
        <View style={KG.sectionHeader}>
          <Text style={KG.sectionTitle}>{"🚚 Pengiriman Aktif"}</Text>
          <View style={KG.sectionBadge}>
            <Text style={KG.sectionBadgeTxt}>{String(orders.length)}</Text>
          </View>
        </View>

        {loadingOrder ? (
          <View style={KG.loadingBox}>
            <ActivityIndicator color={INDIGO} />
            <Text style={KG.loadingTxt}>{"Memuat order..."}</Text>
          </View>
        ) : orders.length === 0 ? (
          <View style={KG.emptyBox}>
            <Text style={KG.emptyIcon}>{"✅"}</Text>
            <Text style={KG.emptyTitle}>{"Tidak Ada Pengiriman Aktif"}</Text>
            <Text style={KG.emptyDesc}>{"Semua order sudah selesai atau belum ada order baru yang ditugaskan."}</Text>
          </View>
        ) : (
          orders.map((order) => {
            const nextStatus = order.status === "diproses" ? "dikirim" as const : "selesai" as const;
            const nextLabel  = order.status === "diproses" ? "🚚 Tandai Dikirim" : "✅ Tandai Selesai";
            const nextColor  = order.status === "diproses" ? INDIGO : SUCCESS;

            return (
              <View key={order.id} style={KG.orderCard}>
                {/* Header kartu */}
                <View style={KG.orderCardHeader}>
                  <View style={KG.orderCardHeaderLeft}>
                    <View style={[KG.statusBadge, { backgroundColor: (STATUS_COLOR[order.status] ?? "#64748B") + "20" }]}>
                      <Text style={[KG.statusBadgeTxt, { color: STATUS_COLOR[order.status] ?? "#64748B" }]}>
                        {STATUS_LABEL[order.status] ?? order.status}
                      </Text>
                    </View>
                    {order.storeNama && (
                      <Text style={KG.storeName}>{order.storeNama}</Text>
                    )}
                  </View>
                  {order.distanceKm !== undefined && (
                    <View style={KG.jarakBadge}>
                      <Text style={KG.jarakBadgeTxt}>{"📏 " + formatJarak(order.distanceKm)}</Text>
                    </View>
                  )}
                </View>

                {/* Info customer */}
                <View style={KG.customerBox}>
                  <Text style={KG.customerName}>{order.customerName}</Text>
                  {order.customerPhone && (
                    <TouchableOpacity
                      style={KG.phoneRow}
                      onPress={() => bukaTelepon(order.customerPhone!)}
                    >
                      <Text style={KG.phoneTxt}>{"📞 " + order.customerPhone}</Text>
                      <View style={KG.callChip}>
                        <Text style={KG.callChipTxt}>{"Hubungi"}</Text>
                      </View>
                    </TouchableOpacity>
                  )}
                  {order.customerAddress && (
                    <View style={KG.addressRow}>
                      <Text style={KG.addressTxt} numberOfLines={2}>
                        {"📍 " + order.customerAddress}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Item pesanan */}
                <View style={KG.itemsBox}>
                  <Text style={KG.itemsTitle}>{"📦 Item Pesanan:"}</Text>
                  {order.items.map((item, i) => (
                    <Text key={i} style={KG.itemRow}>
                      {"• " + item.name + " ×" + item.qty}
                    </Text>
                  ))}
                  <Text style={KG.totalTxt}>{"Total: " + formatRp(order.total)}</Text>
                </View>

                <Text style={KG.orderDate}>{formatDate(order.createdAt)}</Text>

                {/* Tombol navigasi + update status */}
                <View style={KG.orderActions}>
                  {order.customerAddress && (
                    <TouchableOpacity
                      style={KG.naviBtn}
                      onPress={() => bukaNavigasi(order.customerAddress!)}
                    >
                      <Text style={KG.naviBtnTxt}>{"🗺 Navigasi"}</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[KG.statusBtn, { backgroundColor: nextColor }]}
                    onPress={() => konfirmasiUpdate(order, nextStatus)}
                  >
                    <Text style={KG.statusBtnTxt}>{nextLabel}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}

        {/* ── Tips penggunaan ── */}
        <View style={KG.tipsCard}>
          <Text style={KG.tipsTitle}>{"💡 Cara Penggunaan"}</Text>
          <Text style={KG.tipsTxt}>{"1. Tap ▶ Track untuk lacak lokasi secara realtime."}</Text>
          <Text style={KG.tipsTxt}>{"2. Tap 🗺 Navigasi untuk buka Google Maps ke alamat customer."}</Text>
          <Text style={KG.tipsTxt}>{"3. Tap 📞 nomor telepon untuk menghubungi customer."}</Text>
          <Text style={KG.tipsTxt}>{"4. Update status setelah barang diserahkan ke customer."}</Text>
        </View>

        <View style={BOTTOM_SPACER_STYLE} />
      </ScrollView>
    </View>
  );
}

// ─── StyleSheet ───────────────────────────────────────────────────────────────

const KG = StyleSheet.create({
  container:   { flex: 1, backgroundColor: "#F1F5F9" },
  scrollContent:{ padding: 14 },

  header:        { backgroundColor: INDIGO, paddingTop: 52, paddingBottom: 14, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", gap: 10 },
  backBtn:       { paddingRight: 4 },
  backTxt:       { color: "rgba(255,255,255,0.9)", fontSize: 13, fontWeight: "700" },
  headerCenter:  { flex: 1 },
  headerTitle:   { color: "#fff", fontSize: 18, fontWeight: "800" },
  headerSub:     { color: "rgba(255,255,255,0.7)", fontSize: 11, marginTop: 2 },
  trackingBtnOff:{ backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: "rgba(255,255,255,0.35)" },
  trackingBtnOn: { backgroundColor: DANGER, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  trackingBtnTxt:{ color: "#fff", fontWeight: "800", fontSize: 12 },

  locCard:      { backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 16, elevation: 2 },
  locCardTop:   { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  locCardTitle: { fontSize: 15, fontWeight: "700", color: "#1E293B" },
  liveDot:      { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#FEE2E2", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
  liveDotInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: DANGER },
  liveTxt:      { fontSize: 10, fontWeight: "800", color: DANGER },

  locLoading:   { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12 },
  locLoadingTxt:{ fontSize: 13, color: "#64748B" },

  permDenied:    { alignItems: "center", padding: 16 },
  permDeniedIcon:{ fontSize: 32, marginBottom: 8 },
  permDeniedTxt: { fontSize: 14, color: "#64748B", marginBottom: 12 },
  permBtn:       { backgroundColor: INDIGO, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  permBtnTxt:    { color: "#fff", fontWeight: "700" },

  locInfo:       { gap: 10 },
  locCoordRow:   { flexDirection: "row", backgroundColor: "#F8FAFC", borderRadius: 12, padding: 12 },
  locCoordItem:  { flex: 1, alignItems: "center" },
  locCoordDivider:{ width: 1, backgroundColor: "#E2E8F0" },
  locCoordLbl:   { fontSize: 9, fontWeight: "700", color: "#94A3B8", marginBottom: 4 },
  locCoordVal:   { fontSize: 12, fontWeight: "700", color: "#1E293B" },
  alamatRow:     { backgroundColor: "#EEF2FF", borderRadius: 10, padding: 10 },
  alamatTxt:     { fontSize: 12, color: "#3730A3", lineHeight: 18 },
  locActions:    { flexDirection: "row", gap: 10 },
  locRefreshBtn: { flex: 1, backgroundColor: "#F1F5F9", borderRadius: 10, paddingVertical: 10, alignItems: "center", borderWidth: 1, borderColor: "#E2E8F0" },
  locRefreshTxt: { fontSize: 13, fontWeight: "700", color: "#374151" },
  locOpenMapsBtn:{ flex: 1, backgroundColor: INDIGO, borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  locOpenMapsTxt:{ fontSize: 13, fontWeight: "700", color: "#fff" },

  sectionHeader:  { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  sectionTitle:   { fontSize: 14, fontWeight: "700", color: "#1E293B" },
  sectionBadge:   { backgroundColor: INDIGO, borderRadius: 10, minWidth: 22, height: 22, justifyContent: "center", alignItems: "center", paddingHorizontal: 6 },
  sectionBadgeTxt:{ color: "#fff", fontSize: 11, fontWeight: "800" },

  loadingBox:  { paddingVertical: 30, alignItems: "center", gap: 10 },
  loadingTxt:  { fontSize: 13, color: "#64748B" },
  emptyBox:    { paddingVertical: 40, alignItems: "center" },
  emptyIcon:   { fontSize: 44, marginBottom: 12 },
  emptyTitle:  { fontSize: 16, fontWeight: "700", color: "#374151", marginBottom: 6 },
  emptyDesc:   { fontSize: 13, color: "#64748B", textAlign: "center", lineHeight: 20 },

  orderCard:        { backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 12, elevation: 2 },
  orderCardHeader:  { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 },
  orderCardHeaderLeft:{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  statusBadge:      { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  statusBadgeTxt:   { fontSize: 11, fontWeight: "700" },
  storeName:        { fontSize: 11, color: "#64748B", flex: 1 },
  jarakBadge:       { backgroundColor: "#F0FDF4", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: "#BBF7D0" },
  jarakBadgeTxt:    { fontSize: 12, fontWeight: "700", color: SUCCESS },

  customerBox:  { backgroundColor: "#F8FAFC", borderRadius: 12, padding: 12, marginBottom: 10 },
  customerName: { fontSize: 15, fontWeight: "700", color: "#1E293B", marginBottom: 6 },
  phoneRow:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  phoneTxt:     { fontSize: 13, color: "#2563EB" },
  callChip:     { backgroundColor: "#EFF6FF", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  callChipTxt:  { fontSize: 11, color: "#2563EB", fontWeight: "700" },
  addressRow:   { backgroundColor: "#fff", borderRadius: 8, padding: 8, borderWidth: 1, borderColor: "#E2E8F0" },
  addressTxt:   { fontSize: 12, color: "#374151", lineHeight: 18 },

  itemsBox:   { marginBottom: 8 },
  itemsTitle: { fontSize: 11, fontWeight: "700", color: "#64748B", marginBottom: 4 },
  itemRow:    { fontSize: 12, color: "#374151", marginBottom: 2 },
  totalTxt:   { fontSize: 13, fontWeight: "700", color: INDIGO, marginTop: 6 },
  orderDate:  { fontSize: 10, color: "#94A3B8", marginBottom: 10 },

  orderActions:  { flexDirection: "row", gap: 10 },
  naviBtn:       { flex: 1, backgroundColor: "#EEF2FF", borderRadius: 12, paddingVertical: 12, alignItems: "center", borderWidth: 1, borderColor: "#C7D2FE" },
  naviBtnTxt:    { fontSize: 13, fontWeight: "700", color: INDIGO },
  statusBtn:     { flex: 2, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  statusBtnTxt:  { color: "#fff", fontWeight: "800", fontSize: 13 },

  tipsCard:  { backgroundColor: "#EEF2FF", borderRadius: 14, padding: 14, marginTop: 8, borderWidth: 1, borderColor: "#C7D2FE" },
  tipsTitle: { fontSize: 13, fontWeight: "700", color: "#3730A3", marginBottom: 8 },
  tipsTxt:   { fontSize: 12, color: "#4338CA", marginBottom: 4, lineHeight: 18 },
});