// src/screens/KurirGPSScreen.tsx — v1
// Fitur: GPS realtime, daftar order aktif per kurir, buka navigasi ke alamat customer
// Dependency: expo-location (install: npx expo install expo-location)

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    Linking,
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

interface OnlineOrder {
  id: string;
  ownerId: string;
  customerName: string;
  customerPhone?: string;
  customerAddress?: string;
  items: Array<{ productId: string; name: string; price: number; qty: number }>;
  subtotal: number;
  total: number;
  status: "menunggu" | "diproses" | "dikirim" | "selesai" | "dibatalkan" | "tertunda";
  kurirId?: string;
  kurirName?: string;
  metodeBayar?: string;
  createdAt: string;
  note?: string;
  fotoBuktiKirim?: string;
  namaPenerima?: string;
  kendalaKirim?: string;
  waktuDiambil?: string;
  waktuDikirim?: string;
  waktuSelesai?: string;
  waktuKendala?: string;
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

// Buka Google Maps Turn-by-Turn Navigation (Pemandu Arah Rute Google Maps)
function bukaNavigasi(address: string, lat?: number, lng?: number) {
  const destination = lat && lng ? `${lat},${lng}` : encodeURIComponent(address);
  const googleMapsDirUrl = `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`;

  if (Platform.OS === "android") {
    const androidNavIntent = `google.navigation:q=${destination}&mode=d`;
    Linking.canOpenURL(androidNavIntent)
      .then((ok) => {
        if (ok) {
          return Linking.openURL(androidNavIntent);
        }
        return Linking.openURL(googleMapsDirUrl);
      })
      .catch(() => {
        Linking.openURL(googleMapsDirUrl);
      });
    return;
  }

  if (Platform.OS === "ios") {
    const iosGoogleMaps = `comgooglemaps://?daddr=${destination}&directionsmode=driving`;
    Linking.canOpenURL(iosGoogleMaps)
      .then((ok) => {
        if (ok) {
          return Linking.openURL(iosGoogleMaps);
        }
        return Linking.openURL(googleMapsDirUrl);
      })
      .catch(() => {
        Linking.openURL(googleMapsDirUrl);
      });
    return;
  }

  Linking.openURL(googleMapsDirUrl);
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

  // ── State upload bukti foto ───────────────────────────────────────────
  const [showBuktiModal, setShowBuktiModal] = useState(false);
  const [selectedOrderBukti, setSelectedOrderBukti] = useState<OrderWithDistance | null>(null);
  const [fotoBuktiUri, setFotoBuktiUri] = useState<string>("");
  const [namaPenerima, setNamaPenerima] = useState("YBS (Customer)");
  const [submittingBukti, setSubmittingBukti] = useState(false);

  // ── State kendala pengantaran ─────────────────────────────────────────
  const [showKendalaModal, setShowKendalaModal] = useState(false);
  const [selectedOrderKendala, setSelectedOrderKendala] = useState<OrderWithDistance | null>(null);
  const [alasanKendala, setAlasanKendala] = useState("Rumah Kosong / Tidak Ada Orang");

  // ── State alert suara/haptics order baru ──────────────────────────────
  const [showNewOrderAlert, setShowNewOrderAlert] = useState(false);
  const prevOrderCountRef = useRef(0);

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

      // Filter: order aktif diproses atau dikirim untuk pengantaran kurir
      const mine = all.filter(
        (o) =>
          o.status === "diproses" || o.status === "dikirim" ||
          String(o.kurirId ?? "") === resolvedKurirId,
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

      // ── Deteksi order baru siap dijemput ──
      const siapDiambilCount = enriched.filter(
        (o) => o.status === "diproses" && (!o.kurirId || !String(o.kurirId).trim()),
      ).length;
      if (siapDiambilCount > prevOrderCountRef.current && prevOrderCountRef.current > 0) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        setShowNewOrderAlert(true);
        setTimeout(() => setShowNewOrderAlert(false), 5000);
      }
      prevOrderCountRef.current = siapDiambilCount;
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

  // ── 1. Kurir ambil orderan dari Kasir ─────────────────────────────────
  async function handleAmbilOrder(order: OrderWithDistance) {
    try {
      const raw = await AsyncStorage.getItem(ORDERS_KEY);
      const all: OnlineOrder[] = raw ? JSON.parse(raw) : [];
      const myName = user?.name || "Kurir";
      const updated = all.map((o) =>
        o.id === order.id
          ? {
              ...o,
              kurirId: resolvedKurirId || "kurir_1",
              kurirName: myName,
              waktuDiambil: new Date().toISOString(),
            }
          : o,
      );
      await AsyncStorage.setItem(ORDERS_KEY, JSON.stringify(updated));
      await loadOrders();
      Alert.alert("Berhasil Diambil 🙋‍♂️", "Order pesanan atas nama " + order.customerName + " telah Anda ambil! Silakan ambil barang dari Kasir/Toko.");
    } catch {
      Alert.alert("Error", "Gagal mengambil order.");
    }
  }

  // ── 2. Kurir mulai antar / barang sudah dibawa dari toko ───────────────
  async function handleMulaiAntar(order: OrderWithDistance) {
    Alert.alert(
      "🚚 Mulai Antar Barang",
      "Tandai bahwa barang pesanan untuk " + order.customerName + " sudah dibawa dan sedang dikirim?",
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Ya, Mulai Antar",
          onPress: async () => {
            try {
              const raw = await AsyncStorage.getItem(ORDERS_KEY);
              const all: OnlineOrder[] = raw ? JSON.parse(raw) : [];
              const updated = all.map((o) =>
                o.id === order.id
                  ? {
                      ...o,
                      status: "dikirim" as const,
                      waktuDikirim: new Date().toISOString(),
                    }
                  : o,
              );
              await AsyncStorage.setItem(ORDERS_KEY, JSON.stringify(updated));
              await loadOrders();
              Alert.alert("Status Diperbarui 🚚", "Barang ditandai sedang dikirim ke alamat customer.");
            } catch {
              Alert.alert("Error", "Gagal memperbarui status.");
            }
          },
        },
      ],
    );
  }

  // ── 3. Pilih foto bukti pengiriman (Kamera / Galeri) ───────────────────
  async function pickBuktiFoto(source: "kamera" | "galeri") {
    try {
      if (source === "kamera") {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (perm.status !== "granted") {
          Alert.alert("Izin Kamera", "Izin kamera diperlukan untuk mengambil foto bukti pengiriman.");
          return;
        }
        const res = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.6,
        });
        if (!res.canceled && res.assets && res.assets.length > 0) {
          setFotoBuktiUri(res.assets[0].uri);
        }
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (perm.status !== "granted") {
          Alert.alert("Izin Galeri", "Izin galeri diperlukan untuk memilih foto bukti pengiriman.");
          return;
        }
        const res = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.6,
        });
        if (!res.canceled && res.assets && res.assets.length > 0) {
          setFotoBuktiUri(res.assets[0].uri);
        }
      }
    } catch (e) {
      console.error("pickBuktiFoto:", e);
      Alert.alert("Error", "Gagal membuka kamera/galeri.");
    }
  }

  // ── 4. Selesaikan pesanan beserta bukti foto ───────────────────────────
  async function handleSelesaikanDenganBukti() {
    if (!selectedOrderBukti) return;
    if (!fotoBuktiUri) {
      Alert.alert("Bukti Foto Wajib ⚠️", "Anda harus mengunggah bukti foto pengiriman barang sebelum pesanan diselesaikan.");
      return;
    }
    setSubmittingBukti(true);
    try {
      const raw = await AsyncStorage.getItem(ORDERS_KEY);
      const all: OnlineOrder[] = raw ? JSON.parse(raw) : [];
      const updated = all.map((o) =>
        o.id === selectedOrderBukti.id
          ? {
              ...o,
              status: "selesai" as const,
              fotoBuktiKirim: fotoBuktiUri,
              namaPenerima: namaPenerima || "YBS (Customer)",
              waktuSelesai: new Date().toISOString(),
            }
          : o,
      );
      await AsyncStorage.setItem(ORDERS_KEY, JSON.stringify(updated));
      setShowBuktiModal(false);
      setFotoBuktiUri("");
      setSelectedOrderBukti(null);
      await loadOrders();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert("Pengiriman Selesai ✅", "Bukti foto penerimaan (" + (namaPenerima || "YBS") + ") disimpan & pesanan selesai.");
    } catch {
      Alert.alert("Error", "Gagal menyelesaikan pesanan.");
    } finally {
      setSubmittingBukti(false);
    }
  }

  // ── 5. Batch Pickup (Ambil Sekaligus) ──────────────────────────────────
  async function handleAmbilSemuaOrder(unassignedOrders: OrderWithDistance[]) {
    try {
      const raw = await AsyncStorage.getItem(ORDERS_KEY);
      const all: OnlineOrder[] = raw ? JSON.parse(raw) : [];
      const myName = user?.name || "Kurir";
      const targetIds = new Set(unassignedOrders.map((o) => o.id));
      const updated = all.map((o) =>
        targetIds.has(o.id)
          ? {
              ...o,
              kurirId: resolvedKurirId || "kurir_1",
              kurirName: myName,
              waktuDiambil: new Date().toISOString(),
            }
          : o,
      );
      await AsyncStorage.setItem(ORDERS_KEY, JSON.stringify(updated));
      await loadOrders();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert("Batch Pickup Berhasil ⚡", `${unassignedOrders.length} order sekaligus telah Anda ambil! Silakan ambil barang di Kasir/Toko.`);
    } catch {
      Alert.alert("Error", "Gagal mengambil batch order.");
    }
  }

  // ── 6. Kendala Pengantaran (Rumah Kosong / Customer Tidak Ada) ─────────
  async function handleKendalaKirim() {
    if (!selectedOrderKendala || !alasanKendala) return;
    try {
      const raw = await AsyncStorage.getItem(ORDERS_KEY);
      const all: OnlineOrder[] = raw ? JSON.parse(raw) : [];
      const updated = all.map((o) =>
        o.id === selectedOrderKendala.id
          ? {
              ...o,
              status: "tertunda" as const,
              kendalaKirim: alasanKendala,
              waktuKendala: new Date().toISOString(),
            }
          : o,
      );
      await AsyncStorage.setItem(ORDERS_KEY, JSON.stringify(updated));
      setShowKendalaModal(false);
      setSelectedOrderKendala(null);
      await loadOrders();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      Alert.alert("Kendala Dicatat ⚠️", `Pesanan atas nama ${selectedOrderKendala.customerName} ditandai Tertunda: ${alasanKendala}`);
    } catch {
      Alert.alert("Error", "Gagal menyimpan kendala pengiriman.");
    }
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

        {/* ── Banner Audio Alert Order Baru ── */}
        {showNewOrderAlert && (
          <View style={{ backgroundColor: "#DC2626", borderRadius: 14, padding: 14, marginBottom: 14, flexDirection: "row", alignItems: "center", gap: 10, elevation: 3 }}>
            <Text style={{ fontSize: 24 }}>{"🔔"}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#fff", fontWeight: "900", fontSize: 13 }}>{"ADA ORDER BARU SIAP DIJEMPUT!"}</Text>
              <Text style={{ color: "rgba(255,255,255,0.9)", fontSize: 11, marginTop: 2 }}>{"Kasir baru saja menyiapkan barang pesanan. Segera ambil orderan ini."}</Text>
            </View>
          </View>
        )}

        {/* ── Banner Batch Pickup (Ambil Sekaligus) ── */}
        {orders.filter(o => o.status === "diproses" && (!o.kurirId || !String(o.kurirId).trim())).length >= 2 && (
          <TouchableOpacity
            style={{ backgroundColor: "#6366F1", borderRadius: 16, padding: 16, marginBottom: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", elevation: 3 }}
            onPress={() => handleAmbilSemuaOrder(orders.filter(o => o.status === "diproses" && (!o.kurirId || !String(o.kurirId).trim())))}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#fff", fontWeight: "900", fontSize: 14 }}>
                {"⚡ BATCH DELIVERY: Ambil Sekaligus " + orders.filter(o => o.status === "diproses" && (!o.kurirId || !String(o.kurirId).trim())).length + " Order"}
              </Text>
              <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 11, marginTop: 3 }}>
                {"Ambil semua pesanan yang siap dijemput dalam satu klik"}
              </Text>
            </View>
            <Text style={{ color: "#fff", fontWeight: "900", fontSize: 22, marginLeft: 10 }}>{"→"}</Text>
          </TouchableOpacity>
        )}

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

                  {/* 1. Jika pesanan siap diproses dan belum diambil kurir */}
                  {order.status === "diproses" && (!order.kurirId || String(order.kurirId).trim() === "") ? (
                    <TouchableOpacity
                      style={[KG.statusBtn, { backgroundColor: BLUE }]}
                      onPress={() => handleAmbilOrder(order)}
                    >
                      <Text style={KG.statusBtnTxt}>{"🙋‍♂️ Ambil Orderan"}</Text>
                    </TouchableOpacity>
                  ) : order.status === "diproses" ? (
                    <TouchableOpacity
                      style={[KG.statusBtn, { backgroundColor: INDIGO }]}
                      onPress={() => handleMulaiAntar(order)}
                    >
                      <Text style={KG.statusBtnTxt}>{"🚚 Barang Dibawa"}</Text>
                    </TouchableOpacity>
                  ) : (
                    <>
                      <TouchableOpacity
                        style={[KG.statusBtn, { backgroundColor: SUCCESS, flex: 2 }]}
                        onPress={() => {
                          setSelectedOrderBukti(order);
                          setFotoBuktiUri("");
                          setShowBuktiModal(true);
                        }}
                      >
                        <Text style={KG.statusBtnTxt}>{"📸 Bukti & Selesai"}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={{ backgroundColor: "#FEF2F2", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, alignItems: "center", borderWidth: 1, borderColor: "#FECACA" }}
                        onPress={() => {
                          setSelectedOrderKendala(order);
                          setAlasanKendala("Rumah Kosong / Tidak Ada Orang");
                          setShowKendalaModal(true);
                        }}
                      >
                        <Text style={{ fontSize: 12, fontWeight: "800", color: "#DC2626" }}>{"⚠️ Kendala"}</Text>
                      </TouchableOpacity>
                    </>
                  )}
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

      {/* ── Modal Bukti Foto Pengiriman ── */}
      <Modal
        visible={showBuktiModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowBuktiModal(false)}
      >
        <View style={KG.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setShowBuktiModal(false)}
          />
          <View style={KG.modalCard}>
            <Text style={KG.modalTitle}>{"📸 Bukti Foto Pengiriman"}</Text>
            <Text style={KG.modalSub}>
              {"Harus disertai bukti foto pengiriman barang untuk pesanan atas nama: " +
                (selectedOrderBukti?.customerName ?? "")}
            </Text>

            <Text style={{ fontSize: 13, fontWeight: "700", color: "#334155", marginBottom: 6 }}>
              {"👤 Diterima Oleh (Nama Penerima):"}
            </Text>
            <TextInput
              style={{ backgroundColor: "#F8FAFC", borderRadius: 10, borderWidth: 1, borderColor: "#E2E8F0", paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: "#1E293B", marginBottom: 10 }}
              value={namaPenerima}
              onChangeText={setNamaPenerima}
              placeholder="Contoh: Pak Budi (YBS) / Istri / Satpam"
              placeholderTextColor="#94A3B8"
            />
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
              {["YBS (Customer)", "Keluarga", "Satpam / Resepsionis", "Tetangga", "Taruh di Depan"].map((chip) => (
                <TouchableOpacity
                  key={chip}
                  style={{ backgroundColor: namaPenerima === chip ? "#EEF2FF" : "#F1F5F9", borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: namaPenerima === chip ? "#C7D2FE" : "#E2E8F0" }}
                  onPress={() => setNamaPenerima(chip)}
                >
                  <Text style={{ fontSize: 11, fontWeight: namaPenerima === chip ? "800" : "600", color: namaPenerima === chip ? "#4338CA" : "#64748B" }}>
                    {chip}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {fotoBuktiUri ? (
              <View style={KG.buktiPreviewBox}>
                <Image
                  source={{ uri: fotoBuktiUri }}
                  style={KG.buktiImg}
                  resizeMode="cover"
                />
                <TouchableOpacity
                  style={KG.gantiFotoBtn}
                  onPress={() => setFotoBuktiUri("")}
                >
                  <Text style={KG.gantiFotoTxt}>{"❌ Hapus & Ulangi Foto"}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={KG.fotoBtnRow}>
                <TouchableOpacity
                  style={KG.kameraBtn}
                  onPress={() => pickBuktiFoto("kamera")}
                >
                  <Text style={KG.fotoBtnIcon}>{"📷"}</Text>
                  <Text style={KG.fotoBtnLabel}>{"Ambil dari Kamera"}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={KG.galeriBtn}
                  onPress={() => pickBuktiFoto("galeri")}
                >
                  <Text style={KG.fotoBtnIcon}>{"🖼️"}</Text>
                  <Text style={KG.fotoBtnLabel}>{"Pilih dari Galeri"}</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={KG.modalActionRow}>
              <TouchableOpacity
                style={KG.modalBatalBtn}
                onPress={() => {
                  setShowBuktiModal(false);
                  setFotoBuktiUri("");
                }}
              >
                <Text style={KG.modalBatalTxt}>{"Batal"}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  KG.modalSimpanBtn,
                  (!fotoBuktiUri || submittingBukti) && { opacity: 0.5 },
                ]}
                disabled={!fotoBuktiUri || submittingBukti}
                onPress={handleSelesaikanDenganBukti}
              >
                <Text style={KG.modalSimpanTxt}>
                  {submittingBukti ? "Menyimpan..." : "✅ Kirim Bukti & Selesai"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Modal Kendala Pengantaran ── */}
      <Modal
        visible={showKendalaModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowKendalaModal(false)}
      >
        <View style={KG.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setShowKendalaModal(false)}
          />
          <View style={KG.modalCard}>
            <Text style={[KG.modalTitle, { color: "#DC2626" }]}>{"⚠️ Kendala Pengantaran"}</Text>
            <Text style={KG.modalSub}>
              {"Pilih alasan mengapa paket pesanan tidak dapat diserahkan ke customer sekarang:"}
            </Text>

            <View style={{ gap: 8, marginBottom: 18 }}>
              {[
                "Rumah Kosong / Tidak Ada Orang",
                "Alamat Tidak Ditemukan / Tidak Jelas",
                "Customer Tidak Dapat Dihubungi (HP Nonaktif)",
                "Kendala Cuaca / Jalan Ditutup",
                "Customer Menolak Terima Paket",
              ].map((alasan) => (
                <TouchableOpacity
                  key={alasan}
                  style={{ backgroundColor: alasanKendala === alasan ? "#FEF2F2" : "#F8FAFC", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: alasanKendala === alasan ? "#FECACA" : "#E2E8F0" }}
                  onPress={() => setAlasanKendala(alasan)}
                >
                  <Text style={{ fontSize: 13, fontWeight: alasanKendala === alasan ? "800" : "600", color: alasanKendala === alasan ? "#DC2626" : "#334155" }}>
                    {alasan}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={KG.modalActionRow}>
              <TouchableOpacity
                style={KG.modalBatalBtn}
                onPress={() => setShowKendalaModal(false)}
              >
                <Text style={KG.modalBatalTxt}>{"Batal"}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[KG.modalSimpanBtn, { backgroundColor: "#DC2626" }]}
                onPress={handleKendalaKirim}
              >
                <Text style={KG.modalSimpanTxt}>{"⚠️ Catat Kendala"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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

  modalOverlay:   { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", padding: 20 },
  modalCard:      { backgroundColor: "#fff", borderRadius: 20, padding: 20, elevation: 5 },
  modalTitle:     { fontSize: 18, fontWeight: "800", color: "#1E293B", textAlign: "center", marginBottom: 6 },
  modalSub:       { fontSize: 13, color: "#64748B", textAlign: "center", marginBottom: 16, lineHeight: 18 },
  fotoBtnRow:     { flexDirection: "row", gap: 12, marginBottom: 20 },
  kameraBtn:      { flex: 1, backgroundColor: "#EEF2FF", borderRadius: 14, padding: 16, alignItems: "center", borderWidth: 1, borderColor: "#C7D2FE" },
  galeriBtn:      { flex: 1, backgroundColor: "#F0FDF4", borderRadius: 14, padding: 16, alignItems: "center", borderWidth: 1, borderColor: "#BBF7D0" },
  fotoBtnIcon:    { fontSize: 28, marginBottom: 6 },
  fotoBtnLabel:   { fontSize: 13, fontWeight: "700", color: "#334155", textAlign: "center" },
  buktiPreviewBox:{ alignItems: "center", marginBottom: 18 },
  buktiImg:       { width: "100%", height: 200, borderRadius: 12, marginBottom: 10, backgroundColor: "#F1F5F9" },
  gantiFotoBtn:   { backgroundColor: "#FEE2E2", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  gantiFotoTxt:   { color: "#DC2626", fontSize: 12, fontWeight: "700" },
  modalActionRow: { flexDirection: "row", gap: 10 },
  modalBatalBtn:  { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: "#F1F5F9", alignItems: "center" },
  modalBatalTxt:  { fontSize: 14, fontWeight: "700", color: "#64748B" },
  modalSimpanBtn: { flex: 2, paddingVertical: 14, borderRadius: 12, backgroundColor: SUCCESS, alignItems: "center" },
  modalSimpanTxt: { fontSize: 14, fontWeight: "800", color: "#fff" },
});