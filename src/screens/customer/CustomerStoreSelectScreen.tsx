// src/screens/customer/CustomerStoreSelectScreen.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  View,
} from "react-native";
import { Button, Card, Divider, Text } from "react-native-paper";
import { useMarketing } from "../../context/MarketingContext";
import { useStore } from "../../context/StoreContext";

const GREEN     = "#2E7D32";
const RADIUS_KM = 10;

function getDistanceKm(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number {
  const R    = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a    =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
    Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

type LocationState =
  | "idle"
  | "requesting"
  | "denied"
  | "loading"
  | "done"
  | "no_location_set";

type Props = {
  onSelect: (ownerId: string) => void;
};

export default function CustomerStoreSelectScreen({ onSelect }: Props) {
  const {
    storeName,
    ownerName,
    storeAddress,
    storePhone,
    storeLatitude,
    storeLongitude,
    storeKode,
  } = useStore();

  // findOwnerByKode sudah ada di MarketingContext — sama persis dengan LoginScreen
  const { findOwnerByKode } = useMarketing();

  const [locState,    setLocState]    = useState<LocationState>("idle");
  const [distanceKm,  setDistanceKm]  = useState<number | null>(null);
  const [inRange,     setInRange]     = useState<boolean | null>(null);
  const [produkCount, setProdukCount] = useState<number>(0);

  // Dapatkan ownerId dari storeKode via MarketingContext
  const currentOwner = storeKode ? findOwnerByKode(storeKode) : null;
  const ownerId      = currentOwner?.id ?? "";

  // Hitung jumlah produk milik owner ini
  useEffect(() => {
    if (!ownerId) return;
    AsyncStorage.getItem("@twd_products").then((raw) => {
      const all: any[] = raw ? JSON.parse(raw) : [];
      const count = all.filter(
        (p: any) => (p.ownerId === ownerId || !p.ownerId) && (p.stock ?? 0) > 0
      ).length;
      setProdukCount(count);
    });
  }, [ownerId]);

  const requestLocation = async () => {
    setLocState("requesting");
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== "granted") {
        setLocState("denied");
        return;
      }
      setLocState("loading");
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const userLat = loc.coords.latitude;
      const userLon = loc.coords.longitude;

      if (!storeLatitude || !storeLongitude) {
        setLocState("no_location_set");
        return;
      }

      const dist = getDistanceKm(userLat, userLon, storeLatitude, storeLongitude);
      setDistanceKm(dist);
      setInRange(dist <= RADIUS_KM);
      setLocState("done");
    } catch {
      setLocState("denied");
    }
  };

  const namaDisplay   = storeName ?? "TWD Store";
  const handleMasuk   = () => onSelect(ownerId);

  return (
    <View style={S.root}>
      <View style={S.header}>
        <Text style={S.headerTitle}>Pilih Toko</Text>
        <Text style={S.headerSubtitle}>
          Toko dalam radius {RADIUS_KM} km dari lokasi Anda
        </Text>
      </View>
      <View style={S.content}>
        <Card style={S.storeCard} mode="outlined">
          <Card.Content>
            <View style={S.storeHeader}>
              <View style={S.storeIconBox}>
                <Text style={S.storeIcon}>🏪</Text>
              </View>
              <View style={S.storeInfo}>
                <Text style={S.storeName}>{namaDisplay}</Text>
                {ownerName    ? <Text style={S.storeSub}>👤 {ownerName}</Text>    : null}
                {storeAddress ? <Text style={S.storeSub}>📍 {storeAddress}</Text> : null}
                {storePhone   ? <Text style={S.storeSub}>📞 {storePhone}</Text>   : null}
              </View>
            </View>

            <Divider style={S.divider} />

            <View style={S.productBadgeRow}>
              <View style={S.productBadge}>
                <Text style={S.productBadgeText}>
                  {produkCount + " produk tersedia"}
                </Text>
              </View>
            </View>

            <Divider style={S.divider} />

            {locState === "idle" && (
              <View style={S.gpsBox}>
                <Text style={S.gpsText}>
                  Izinkan akses lokasi untuk memverifikasi jarak ke toko ini.
                </Text>
                <Button
                  mode="contained" buttonColor={GREEN}
                  icon="map-marker" style={S.gpsBtn}
                  onPress={requestLocation}
                >
                  Cek Jarak ke Toko
                </Button>
              </View>
            )}

            {(locState === "requesting" || locState === "loading") && (
              <View style={S.gpsLoadingBox}>
                <ActivityIndicator color={GREEN} size="small" />
                <Text style={S.gpsLoadingText}>
                  {locState === "requesting"
                    ? "Meminta izin lokasi..."
                    : "Mendeteksi lokasi Anda..."}
                </Text>
              </View>
            )}

            {locState === "denied" && (
              <View style={S.gpsErrorBox}>
                <Text style={S.gpsErrorText}>
                  Izin lokasi ditolak. Aktifkan lokasi di pengaturan HP.
                </Text>
                <Button mode="outlined" textColor={GREEN} style={S.gpsBtn}
                  onPress={requestLocation}>
                  Coba Lagi
                </Button>
                <Button mode="text" textColor="#888" compact onPress={handleMasuk}>
                  Lanjut Tanpa Cek Lokasi
                </Button>
              </View>
            )}

            {locState === "no_location_set" && (
              <View style={S.gpsErrorBox}>
                <Text style={S.gpsErrorText}>
                  Lokasi toko belum diatur. Toko dapat diakses tanpa filter jarak.
                </Text>
                <Button mode="contained" buttonColor={GREEN} style={S.gpsBtn}
                  onPress={handleMasuk}>
                  Masuk ke Toko
                </Button>
              </View>
            )}

            {locState === "done" && distanceKm !== null && (
              <View>
                <View style={[S.distanceBadge, inRange ? S.distanceBadgeOk : S.distanceBadgeFar]}>
                  <Text style={[S.distanceText, inRange ? S.distanceTextOk : S.distanceTextFar]}>
                    {inRange
                      ? "📍 " + distanceKm.toFixed(1) + " km dari Anda"
                      : "📍 " + distanceKm.toFixed(1) + " km — di luar jangkauan"}
                  </Text>
                </View>
                {inRange ? (
                  <Button
                    mode="contained" buttonColor={GREEN}
                    icon="store" style={S.enterBtn}
                    onPress={handleMasuk}
                  >
                    Masuk dan Pesan
                  </Button>
                ) : (
                  <View style={S.outOfRangeBox}>
                    <Text style={S.outOfRangeTitle}>Di Luar Jangkauan</Text>
                    <Text style={S.outOfRangeText}>
                      {"Toko ini berjarak " + distanceKm.toFixed(1) + " km. " +
                       "Hanya dalam radius " + RADIUS_KM + " km yang dapat melayani."}
                    </Text>
                    <Button mode="outlined" textColor="#888" compact
                      style={S.gpsBtn} onPress={requestLocation}>
                      Refresh Lokasi
                    </Button>
                  </View>
                )}
              </View>
            )}
          </Card.Content>
        </Card>

        <View style={S.infoBox}>
          <Text style={S.infoText}>
            {"Layanan antar tersedia untuk radius " + RADIUS_KM + " km dari toko"}
          </Text>
        </View>
      </View>
    </View>
  );
}

const S = StyleSheet.create({
  root:             { flex: 1, backgroundColor: "#F7FAF7" },
  header:           { backgroundColor: GREEN, padding: 20, paddingTop: 32 },
  headerTitle:      { fontSize: 20, fontWeight: "800", color: "#FFF" },
  headerSubtitle:   { fontSize: 13, color: "#C8E6C9", marginTop: 4 },
  content:          { flex: 1, padding: 16 },
  storeCard:        { borderColor: GREEN, borderWidth: 1.5, backgroundColor: "#FFF" },
  storeHeader:      { flexDirection: "row", gap: 14, alignItems: "flex-start" },
  storeIconBox:     { width: 52, height: 52, borderRadius: 14, backgroundColor: "#E8F5E9", alignItems: "center", justifyContent: "center" },
  storeIcon:        { fontSize: 26 },
  storeInfo:        { flex: 1, gap: 3 },
  storeName:        { fontSize: 17, fontWeight: "800", color: "#1B5E20" },
  storeSub:         { fontSize: 12, color: "#555" },
  divider:          { marginVertical: 12 },
  productBadgeRow:  { flexDirection: "row" },
  productBadge:     { backgroundColor: "#E8F5E9", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  productBadgeText: { fontSize: 12, fontWeight: "700", color: GREEN },
  gpsBox:           { alignItems: "center", gap: 12 },
  gpsText:          { fontSize: 13, color: "#555", textAlign: "center", lineHeight: 20 },
  gpsBtn:           { width: "100%", borderRadius: 8, marginTop: 4 },
  gpsLoadingBox:    { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 8 },
  gpsLoadingText:   { fontSize: 13, color: "#888" },
  gpsErrorBox:      { gap: 10 },
  gpsErrorText:     { fontSize: 13, color: "#E65100", lineHeight: 18 },
  distanceBadge:    { borderRadius: 10, padding: 10, marginBottom: 12 },
  distanceBadgeOk:  { backgroundColor: "#E8F5E9" },
  distanceBadgeFar: { backgroundColor: "#FFEBEE" },
  distanceText:     { fontSize: 13, fontWeight: "700", textAlign: "center" },
  distanceTextOk:   { color: GREEN },
  distanceTextFar:  { color: "#C62828" },
  enterBtn:         { borderRadius: 10 },
  outOfRangeBox:    { backgroundColor: "#FFEBEE", borderRadius: 10, padding: 14, gap: 8 },
  outOfRangeTitle:  { fontSize: 15, fontWeight: "800", color: "#C62828" },
  outOfRangeText:   { fontSize: 13, color: "#555", lineHeight: 18 },
  infoBox:          { marginTop: 16, alignItems: "center" },
  infoText:         { fontSize: 12, color: "#888", textAlign: "center" },
});