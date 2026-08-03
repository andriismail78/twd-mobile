// src/screens/KurirRegistrationScreen.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

// ─── Types ───────────────────────────────────────────────────────────────────

type KurirStatus = "menunggu_verifikasi" | "terverifikasi" | "ditolak";

interface KurirAccount {
  id: string;
  ownerId: string;
  nama: string;
  phone: string;
  aktif: boolean;
  status: KurirStatus;
  catatanAdmin?: string;
  fotoKtp?: string;
  fotoSelfie?: string;
  createdAt: string;
}

interface AuthUser {
  role: string;
  name: string;
  id?: string;
  ownerId?: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STORAGE_KEY = "@twd_kurir_accounts";
const PURPLE = "#7C3AED";
const GREEN = "#16A34A";
const RED = "#DC2626";
const ORANGE = "#D97706";
const GRAY = "#6B7280";
const LIGHT_BG = "#F3F4F6";

// ─── Component ───────────────────────────────────────────────────────────────

export default function KurirRegistrationScreen({ route, navigation }: any) {
  const authUser: AuthUser = route?.params?.authUser ?? {};
  const ownerId: string = authUser.ownerId ?? authUser.id ?? "";

  const [kurirList, setKurirList] = useState<KurirAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Form fields
  const [nama, setNama] = useState("");
  const [phone, setPhone] = useState("");
  const [fotoKtp, setFotoKtp] = useState<string | undefined>(undefined);
  const [fotoSelfie, setFotoSelfie] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);

  // ── Load data ──────────────────────────────────────────────────────────────

  useEffect(() => {
    loadKurir();
  }, []);

  async function loadKurir() {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const all: KurirAccount[] = raw ? JSON.parse(raw) : [];
      const mine = all.filter((k) => k.ownerId === ownerId);
      setKurirList(mine);
    } catch (e) {
      Alert.alert("Error", "Gagal memuat data kurir.");
    } finally {
      setLoading(false);
    }
  }

  // ── Image picker ───────────────────────────────────────────────────────────

  async function requestPermission() {
    if (Platform.OS !== "web") {
      const result = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (result.status !== "granted") {
        Alert.alert(
          "Izin Diperlukan",
          "Aplikasi memerlukan akses galeri untuk upload foto."
        );
        return false;
      }
    }
    return true;
  }

  async function pickImage(type: "ktp" | "selfie") {
    const ok = await requestPermission();
    if (!ok) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: type === "ktp" ? [4, 3] : [1, 1],
      quality: 0.7,
    });

    if (!result.canceled && result.assets.length > 0) {
      const uri = result.assets[0].uri;
      if (type === "ktp") {
        setFotoKtp(uri);
      } else {
        setFotoSelfie(uri);
      }
    }
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!nama.trim()) {
      Alert.alert("Validasi", "Nama kurir wajib diisi.");
      return;
    }
    if (!phone.trim()) {
      Alert.alert("Validasi", "Nomor telepon wajib diisi.");
      return;
    }
    if (!fotoKtp) {
      Alert.alert("Validasi", "Foto KTP wajib diupload.");
      return;
    }
    if (!fotoSelfie) {
      Alert.alert("Validasi", "Foto selfie dengan KTP wajib diupload.");
      return;
    }

    setSubmitting(true);
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const all: KurirAccount[] = raw ? JSON.parse(raw) : [];

      const newKurir: KurirAccount = {
        id: `kurir_${Date.now()}`,
        ownerId,
        nama: nama.trim(),
        phone: phone.trim(),
        aktif: false,
        status: "menunggu_verifikasi",
        fotoKtp,
        fotoSelfie,
        createdAt: new Date().toISOString(),
      };

      all.push(newKurir);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(all));

      setKurirList((prev) => [...prev, newKurir]);
      setShowForm(false);
      resetForm();

      Alert.alert(
        "Berhasil",
        "Pendaftaran kurir berhasil dikirim. Menunggu verifikasi dari admin."
      );
    } catch (e) {
      Alert.alert("Error", "Gagal menyimpan data kurir.");
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setNama("");
    setPhone("");
    setFotoKtp(undefined);
    setFotoSelfie(undefined);
  }

  // ── Status helpers ─────────────────────────────────────────────────────────

  function getStatusLabel(status: KurirStatus) {
    switch (status) {
      case "terverifikasi":
        return "✅ Terverifikasi";
      case "ditolak":
        return "❌ Ditolak";
      default:
        return "⏳ Menunggu Verifikasi";
    }
  }

  function getStatusColor(status: KurirStatus) {
    switch (status) {
      case "terverifikasi":
        return GREEN;
      case "ditolak":
        return RED;
      default:
        return ORANGE;
    }
  }

  // ── Photo upload component ─────────────────────────────────────────────────

  function PhotoUpload(props: {
    label: string;
    hint: string;
    uri: string | undefined;
    onPress: () => void;
  }) {
    // Gunakan variabel untuk hindari double curly brace di JSX
    const imageSource = props.uri ? { uri: props.uri } : null;

    return (
      <View style={S.photoBlock}>
        <Text style={S.photoLabel}>{props.label}</Text>
        <Text style={S.photoHint}>{props.hint}</Text>
        <TouchableOpacity style={S.photoBox} onPress={props.onPress}>
          {imageSource ? (
            <>
              <Image
                source={imageSource}
                style={S.photoPreview}
                resizeMode="cover"
              />
              <View style={S.changeOverlay}>
                <Text style={S.changeTxt}>📷 Ganti Foto</Text>
              </View>
            </>
          ) : (
            <View style={S.photoPlaceholder}>
              <Text style={S.photoIcon}>📷</Text>
              <Text style={S.photoPlaceholderTxt}>Tap untuk upload foto</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={S.center}>
        <ActivityIndicator size="large" color={PURPLE} />
      </View>
    );
  }

  return (
    <ScrollView style={S.container} contentContainerStyle={S.content}>
      {/* Header */}
      <View style={S.header}>
        <Text style={S.headerTitle}>🛵 Kurir Saya</Text>
        <Text style={S.headerSub}>
          Daftarkan kurir untuk outlet Anda. Kurir akan aktif setelah diverifikasi
          oleh admin.
        </Text>
      </View>

      {/* Info banner */}
      <View style={S.infoBanner}>
        <Text style={S.infoBannerTxt}>
          ℹ️ Proses verifikasi dilakukan oleh Marketing / Sub-Marketing /
          SuperAdmin. Pastikan foto KTP dan selfie jelas terbaca.
        </Text>
      </View>

      {/* Daftar kurir */}
      {kurirList.length > 0 && (
        <View style={S.section}>
          <Text style={S.sectionTitle}>Kurir Terdaftar</Text>
          {kurirList.map((k) => {
            const statusColor = getStatusColor(k.status);
            const statusLabel = getStatusLabel(k.status);
            return (
              <View key={k.id} style={S.kurirCard}>
                <View style={S.kurirCardRow}>
                  <View style={S.kurirInfo}>
                    <Text style={S.kurirNama}>{k.nama}</Text>
                    <Text style={S.kurirPhone}>{k.phone}</Text>
                    <Text style={S.kurirDate}>
                      Daftar: {new Date(k.createdAt).toLocaleDateString("id-ID")}
                    </Text>
                  </View>
                  <View style={S.statusBadge}>
                    <Text style={[S.statusTxt, { color: statusColor }]}>
                      {statusLabel}
                    </Text>
                  </View>
                </View>
                {k.status === "ditolak" && k.catatanAdmin ? (
                  <View style={S.rejectNote}>
                    <Text style={S.rejectNoteTxt}>
                      Catatan: {k.catatanAdmin}
                    </Text>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      )}

      {/* Form tambah kurir */}
      {showForm ? (
        <View style={S.formCard}>
          <Text style={S.formTitle}>Daftarkan Kurir Baru</Text>

          <Text style={S.inputLabel}>Nama Lengkap *</Text>
          <TextInput
            style={S.input}
            value={nama}
            onChangeText={setNama}
            placeholder="Masukkan nama kurir"
            placeholderTextColor={GRAY}
          />

          <Text style={S.inputLabel}>Nomor Telepon *</Text>
          <TextInput
            style={S.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="Contoh: 08123456789"
            placeholderTextColor={GRAY}
            keyboardType="phone-pad"
          />

          <PhotoUpload
            label="Foto KTP *"
            hint="Upload foto KTP kurir dengan jelas"
            uri={fotoKtp}
            onPress={() => pickImage("ktp")}
          />

          <PhotoUpload
            label="Foto Selfie dengan KTP *"
            hint="Upload foto selfie kurir sambil memegang KTP"
            uri={fotoSelfie}
            onPress={() => pickImage("selfie")}
          />

          <View style={S.formActions}>
            <TouchableOpacity
              style={S.btnCancel}
              onPress={() => {
                setShowForm(false);
                resetForm();
              }}
            >
              <Text style={S.btnCancelTxt}>Batal</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={S.btnSubmit}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={S.btnSubmitTxt}>Kirim Pendaftaran</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity
          style={S.btnAdd}
          onPress={() => setShowForm(true)}
        >
          <Text style={S.btnAddTxt}>+ Daftarkan Kurir Baru</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  // Header
  header: {
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 4,
  },
  headerSub: {
    fontSize: 13,
    color: GRAY,
    lineHeight: 18,
  },
  // Info banner
  infoBanner: {
    backgroundColor: "#EDE9FE",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: PURPLE,
  },
  infoBannerTxt: {
    fontSize: 12,
    color: "#5B21B6",
    lineHeight: 18,
  },
  // Section
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 10,
  },
  // Kurir card
  kurirCard: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  kurirCardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  kurirInfo: {
    flex: 1,
  },
  kurirNama: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 2,
  },
  kurirPhone: {
    fontSize: 13,
    color: GRAY,
    marginBottom: 2,
  },
  kurirDate: {
    fontSize: 11,
    color: "#9CA3AF",
  },
  statusBadge: {
    marginLeft: 8,
    alignItems: "flex-end",
  },
  statusTxt: {
    fontSize: 12,
    fontWeight: "600",
  },
  rejectNote: {
    marginTop: 8,
    backgroundColor: "#FEF2F2",
    borderRadius: 6,
    padding: 8,
    borderLeftWidth: 3,
    borderLeftColor: RED,
  },
  rejectNoteTxt: {
    fontSize: 12,
    color: RED,
  },
  // Form card
  formCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  formTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 6,
  },
  input: {
    backgroundColor: LIGHT_BG,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#1F2937",
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  // Photo upload
  photoBlock: {
    marginBottom: 14,
  },
  photoLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 2,
  },
  photoHint: {
    fontSize: 11,
    color: GRAY,
    marginBottom: 6,
  },
  photoBox: {
    width: "100%",
    height: 160,
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#E5E7EB",
    borderStyle: "dashed",
    backgroundColor: LIGHT_BG,
  },
  photoPreview: {
    width: "100%",
    height: "100%",
  },
  changeOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.45)",
    paddingVertical: 6,
    alignItems: "center",
  },
  changeTxt: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  photoPlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  photoIcon: {
    fontSize: 32,
    marginBottom: 6,
  },
  photoPlaceholderTxt: {
    fontSize: 13,
    color: GRAY,
  },
  // Form actions
  formActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },
  btnCancel: {
    flex: 1,
    backgroundColor: LIGHT_BG,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  btnCancelTxt: {
    fontSize: 14,
    fontWeight: "600",
    color: GRAY,
  },
  btnSubmit: {
    flex: 2,
    backgroundColor: PURPLE,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  btnSubmitTxt: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
  // Add button
  btnAdd: {
    backgroundColor: PURPLE,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    shadowColor: PURPLE,
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  btnAddTxt: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
});