import * as Location from "expo-location";
import React, { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import MapView, { Marker, Region } from "react-native-maps";

// ─── Constants di luar komponen ───────────────────────────────────────────────
const ACCENT         = "#2563EB";
const DEFAULT_LAT    = -6.2088;
const DEFAULT_LNG    = 106.8456;
const DEFAULT_DELTA  = 0.01;

// ─── Helper: buat Region object (hindari double curly brace di JSX) ───────────
function makeRegion(lat: number, lng: number): Region {
  const r: Region = {
    latitude:        lat,
    longitude:       lng,
    latitudeDelta:   DEFAULT_DELTA,
    longitudeDelta:  DEFAULT_DELTA,
  };
  return r;
}

// ─── Helper: buat coordinate object ──────────────────────────────────────────
function makeCoord(lat: number, lng: number) {
  return { latitude: lat, longitude: lng };
}

// ─── Types ────────────────────────────────────────────────────────────────────
export interface LocationResult {
  latitude:  number;
  longitude: number;
  address:   string;
}

interface Props {
  initialLatitude?:  number;
  initialLongitude?: number;
  onConfirm: (result: LocationResult) => void;
  onClose:   () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
export default function LocationPickerModal({
  initialLatitude,
  initialLongitude,
  onConfirm,
  onClose,
}: Props) {
  const mapRef = useRef<MapView>(null);

  const startLat = initialLatitude  ?? DEFAULT_LAT;
  const startLng = initialLongitude ?? DEFAULT_LNG;

  const [pinLat,   setPinLat]   = useState(startLat);
  const [pinLng,   setPinLng]   = useState(startLng);
  const [address,  setAddress]  = useState("");
  const [loading,  setLoading]  = useState(false);
  const [inputAddr, setInputAddr] = useState("");

  // ── Reverse geocode saat pin bergerak ─────────────────────────────────────
  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      const geo = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      const g   = geo[0] ?? {};
      const addr = [g.street, g.district, g.city, g.region]
        .filter(Boolean)
        .join(", ");
      setAddress(addr || "Lokasi dipilih");
      setInputAddr(addr || "");
    } catch {
      setAddress("Lokasi dipilih");
    }
  };

  useEffect(() => {
    reverseGeocode(startLat, startLng);
  }, []);

  // ── GPS otomatis ──────────────────────────────────────────────────────────
  const handleGps = async () => {
    setLoading(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== "granted") {
        Alert.alert("Izin Ditolak", "Aktifkan izin lokasi di pengaturan.");
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      setPinLat(lat);
      setPinLng(lng);
      await reverseGeocode(lat, lng);
      mapRef.current?.animateToRegion(makeRegion(lat, lng), 800);
    } catch {
      Alert.alert("Gagal", "Tidak dapat mengambil lokasi GPS.");
    } finally {
      setLoading(false);
    }
  };

  // ── Saat marker digeser ───────────────────────────────────────────────────
  const handleMarkerDragEnd = async (e: { nativeEvent: { coordinate: { latitude: number; longitude: number } } }) => {
    const lat = e.nativeEvent.coordinate.latitude;
    const lng = e.nativeEvent.coordinate.longitude;
    setPinLat(lat);
    setPinLng(lng);
    await reverseGeocode(lat, lng);
  };

  // ── Tap di peta ───────────────────────────────────────────────────────────
  const handleMapPress = async (e: { nativeEvent: { coordinate: { latitude: number; longitude: number } } }) => {
    const lat = e.nativeEvent.coordinate.latitude;
    const lng = e.nativeEvent.coordinate.longitude;
    setPinLat(lat);
    setPinLng(lng);
    await reverseGeocode(lat, lng);
  };

  // ── Konfirmasi ────────────────────────────────────────────────────────────
  const handleConfirm = () => {
    const finalAddr = inputAddr.trim() || address || "Lokasi dipilih";
    onConfirm({
      latitude:  pinLat,
      longitude: pinLng,
      address:   finalAddr,
    });
  };

  const pinCoord  = makeCoord(pinLat, pinLng);
  const mapRegion = makeRegion(pinLat, pinLng);

  // ══════════════════════════════════════════════════════════════════════════
  return (
    <View style={S.root}>
      {/* Header */}
      <View style={S.header}>
        <TouchableOpacity onPress={onClose} style={S.cancelBtn}>
          <Text style={S.cancelTxt}>Batal</Text>
        </TouchableOpacity>
        <Text style={S.headerTitle}>Pilih Lokasi</Text>
        <TouchableOpacity onPress={handleConfirm} style={S.confirmBtn}>
          <Text style={S.confirmTxt}>Pilih</Text>
        </TouchableOpacity>
      </View>

      {/* Peta */}
      <MapView
        ref={mapRef}
        style={S.map}
        initialRegion={mapRegion}
        onPress={handleMapPress}
      >
        <Marker
          coordinate={pinCoord}
          draggable
          onDragEnd={handleMarkerDragEnd}
          title="Lokasi Anda"
          description={address}
        />
      </MapView>

      {/* Bottom panel */}
      <View style={S.bottomPanel}>
        <Text style={S.panelLabel}>Alamat Terdeteksi</Text>
        <Text style={S.detectedAddr}>
          {address || "Belum ada lokasi dipilih"}
        </Text>

        <Text style={S.panelLabel}>Edit / Lengkapi Alamat</Text>
        <TextInput
          style={S.addrInput}
          placeholder="Tulis alamat lengkap (RT/RW, No rumah, dll)"
          value={inputAddr}
          onChangeText={setInputAddr}
          multiline
          placeholderTextColor="#94A3B8"
        />

        <View style={S.btnRow}>
          <TouchableOpacity
            style={[S.gpsBtn, loading && S.gpsBtnDisabled]}
            onPress={handleGps}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={S.gpsBtnTxt}>GPS Saya</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={S.confirmBtnLarge} onPress={handleConfirm}>
            <Text style={S.confirmBtnLargeTxt}>Konfirmasi Lokasi Ini</Text>
          </TouchableOpacity>
        </View>

        <Text style={S.hintTxt}>
          Geser pin merah atau tap di peta untuk pindah lokasi
        </Text>
      </View>
    </View>
  );
}

// ─── StyleSheet ───────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  root:               { flex: 1, backgroundColor: "#fff" },
  // Header
  header:             { backgroundColor: ACCENT, paddingTop: 52, paddingBottom: 14, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cancelBtn:          { paddingHorizontal: 4 },
  cancelTxt:          { color: "#fff", fontSize: 14, fontWeight: "600" },
  headerTitle:        { color: "#fff", fontSize: 17, fontWeight: "800" },
  confirmBtn:         { paddingHorizontal: 4 },
  confirmTxt:         { color: "#BFDBFE", fontSize: 14, fontWeight: "700" },
  // Map
  map:                { flex: 1 },
  // Bottom panel
  bottomPanel:        { backgroundColor: "#fff", padding: 16, paddingBottom: 32, elevation: 12, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  panelLabel:         { fontSize: 11, fontWeight: "700", color: "#64748B", marginBottom: 4, marginTop: 10, textTransform: "uppercase", letterSpacing: 0.5 },
  detectedAddr:       { fontSize: 13, color: "#1E293B", fontWeight: "500", marginBottom: 4, lineHeight: 20 },
  addrInput:          { borderWidth: 1.5, borderColor: "#CBD5E1", borderRadius: 10, padding: 12, fontSize: 13, color: "#1E293B", backgroundColor: "#F8FAFC", minHeight: 56, textAlignVertical: "top", marginBottom: 12 },
  btnRow:             { flexDirection: "row", gap: 10, marginBottom: 10 },
  gpsBtn:             { backgroundColor: "#16A34A", borderRadius: 10, padding: 12, alignItems: "center", justifyContent: "center", width: 100 },
  gpsBtnDisabled:     { backgroundColor: "#94A3B8" },
  gpsBtnTxt:          { color: "#fff", fontWeight: "700", fontSize: 13 },
  confirmBtnLarge:    { flex: 1, backgroundColor: ACCENT, borderRadius: 10, padding: 14, alignItems: "center" },
  confirmBtnLargeTxt: { color: "#fff", fontWeight: "800", fontSize: 14 },
  hintTxt:            { fontSize: 11, color: "#94A3B8", textAlign: "center", fontStyle: "italic" },
});