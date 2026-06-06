// src/screens/KurirVerifikasiScreen.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
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
const BLUE = "#2563EB";
const GREEN = "#16A34A";
const RED = "#DC2626";
const ORANGE = "#D97706";
const GRAY = "#6B7280";
const LIGHT_BG = "#F3F4F6";

// ─── Helper: buat image source dari uri string ────────────────────────────────
// PENTING: Selalu gunakan fungsi ini, jangan pernah tulis { uri: "..." } inline di JSX
// karena Notion markdown akan strip double curly brace dan menyebabkan syntax error.

function makeImageSource(uri: string | undefined) {
  if (!uri) return null;
  return { uri };
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function KurirVerifikasiScreen({ route, navigation }: any) {
  const authUser: AuthUser = route?.params?.authUser ?? {};
  const role = authUser.role ?? "";

  const [kurirList, setKurirList] = useState<KurirAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDetail, setShowDetail] = useState<KurirAccount | null>(null);
  const [catatan, setCatatan] = useState("");
  const [saving, setSaving] = useState(false);
  const [filterStatus, setFilterStatus] = useState<KurirStatus | "semua">(
    "menunggu_verifikasi"
  );

  // ── Load data ──────────────────────────────────────────────────────────────

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const all: KurirAccount[] = raw ? JSON.parse(raw) : [];
      setKurirList(all);
    } catch (e) {
      Alert.alert("Error", "Gagal memuat data kurir.");
    } finally {
      setLoading(false);
    }
  }

  // ── Verifikasi / Tolak ─────────────────────────────────────────────────────

  async function handleVerifikasi(k: KurirAccount, action: "terverifikasi" | "ditolak") {
    if (action === "ditolak" && !catatan.trim()) {
      Alert.alert("Validasi", "Catatan wajib diisi saat menolak pendaftaran kurir.");
      return;
    }

    setSaving(true);
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const all: KurirAccount[] = raw ? JSON.parse(raw) : [];
      const idx = all.findIndex((x) => x.id === k.id);
      if (idx >= 0) {
        all[idx].status = action;
        all[idx].aktif = action === "terverifikasi";
        all[idx].catatanAdmin = catatan.trim() || undefined;
      }
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(all));
      setKurirList(all);
      setShowDetail(null);
      setCatatan("");

      const msg =
        action === "terverifikasi"
          ? `Kurir ${k.nama} berhasil diverifikasi dan siap beroperasi.`
          : `Kurir ${k.nama} ditolak.`;
      Alert.alert("Berhasil", msg);
    } catch (e) {
      Alert.alert("Error", "Gagal menyimpan keputusan verifikasi.");
    } finally {
      setSaving(false);
    }
  }

  // ── Status helpers ─────────────────────────────────────────────────────────

  function getStatusLabel(status: KurirStatus) {
    switch (status) {
      case "terverifikasi":
        return "✅ Terverifikasi";
      case "ditolak":
        return "❌ Ditolak";
      default:
        return "⏳ Menunggu";
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

  // ── Filter ─────────────────────────────────────────────────────────────────

  const filteredList =
    filterStatus === "semua"
      ? kurirList
      : kurirList.filter((k) => k.status === filterStatus);

  const pendingCount = kurirList.filter(
    (k) => k.status === "menunggu_verifikasi"
  ).length;

  // ── Detail Modal ───────────────────────────────────────────────────────────

  function renderDetailModal() {
    if (!showDetail) return null;

    // Gunakan helper makeImageSource — TIDAK boleh inline object literal di JSX
    const ktpSource = makeImageSource(showDetail.fotoKtp);
    const selfieSource = makeImageSource(showDetail.fotoSelfie);
    const statusColor = getStatusColor(showDetail.status);

    return (
      <Modal
        visible={true}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowDetail(null)}
      >
        <View style={S.modalContainer}>
          {/* Modal header */}
          <View style={S.modalHeader}>
            <Text style={S.modalTitle}>Detail Pendaftaran Kurir</Text>
            <TouchableOpacity
              style={S.modalClose}
              onPress={() => {
                setShowDetail(null);
                setCatatan("");
              }}
            >
              <Text style={S.modalCloseTxt}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={S.modalScroll} contentContainerStyle={S.modalContent}>
            {/* Info kurir */}
            <View style={S.detailCard}>
              <Text style={S.detailName}>{showDetail.nama}</Text>
              <Text style={S.detailPhone}>📱 {showDetail.phone}</Text>
              <Text style={S.detailDate}>
                Daftar:{" "}
                {new Date(showDetail.createdAt).toLocaleDateString("id-ID", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </Text>
              <Text style={[S.detailStatus, { color: statusColor }]}>
                {getStatusLabel(showDetail.status)}
              </Text>
              {showDetail.catatanAdmin ? (
                <View style={S.prevNote}>
                  <Text style={S.prevNoteTxt}>
                    Catatan sebelumnya: {showDetail.catatanAdmin}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* Foto KTP */}
            <Text style={S.docLabel}>📋 Foto KTP</Text>
            <View style={S.docBox}>
              {ktpSource ? (
                <Image
                  source={ktpSource}
                  style={S.docImg}
                  resizeMode="contain"
                />
              ) : (
                <View style={S.docEmpty}>
                  <Text style={S.docEmptyTxt}>Foto KTP tidak tersedia</Text>
                </View>
              )}
            </View>

            {/* Foto Selfie */}
            <Text style={S.docLabel}>🤳 Foto Selfie dengan KTP</Text>
            <View style={S.docBox}>
              {selfieSource ? (
                <Image
                  source={selfieSource}
                  style={S.docImg}
                  resizeMode="contain"
                />
              ) : (
                <View style={S.docEmpty}>
                  <Text style={S.docEmptyTxt}>Foto selfie tidak tersedia</Text>
                </View>
              )}
            </View>

            {/* Catatan admin */}
            {showDetail.status !== "terverifikasi" ? (
              <View style={S.catatanSection}>
                <Text style={S.catatanLabel}>
                  Catatan Admin{" "}
                  {showDetail.status === "menunggu_verifikasi"
                    ? "(wajib jika ditolak)"
                    : ""}
                </Text>
                <TextInput
                  style={S.catatanInput}
                  value={catatan}
                  onChangeText={setCatatan}
                  placeholder="Tulis catatan atau alasan penolakan..."
                  placeholderTextColor={GRAY}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>
            ) : null}

            {/* Action buttons */}
            {showDetail.status === "menunggu_verifikasi" ? (
              <View style={S.actionRow}>
                <TouchableOpacity
                  style={S.btnTolak}
                  onPress={() => handleVerifikasi(showDetail, "ditolak")}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={S.btnTolakTxt}>❌ Tolak</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={S.btnVerif}
                  onPress={() => handleVerifikasi(showDetail, "terverifikasi")}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={S.btnVerifTxt}>✅ Verifikasi</Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : showDetail.status === "ditolak" ? (
              <TouchableOpacity
                style={S.btnReverif}
                onPress={() => handleVerifikasi(showDetail, "terverifikasi")}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={S.btnReverifTxt}>✅ Verifikasi Sekarang</Text>
                )}
              </TouchableOpacity>
            ) : null}
          </ScrollView>
        </View>
      </Modal>
    );
  }

  // ── Main render ────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={S.center}>
        <ActivityIndicator size="large" color={BLUE} />
      </View>
    );
  }

  return (
    <View style={S.container}>
      {/* Header */}
      <View style={S.header}>
        <Text style={S.headerTitle}>🛵 Verifikasi Kurir</Text>
        {pendingCount > 0 ? (
          <View style={S.pendingBadge}>
            <Text style={S.pendingBadgeTxt}>{pendingCount} menunggu</Text>
          </View>
        ) : null}
      </View>

      {/* Filter tabs */}
      <View style={S.filterRow}>
        {(
          [
            { key: "menunggu_verifikasi", label: "Menunggu" },
            { key: "terverifikasi", label: "Terverifikasi" },
            { key: "ditolak", label: "Ditolak" },
            { key: "semua", label: "Semua" },
          ] as Array<{ key: KurirStatus | "semua"; label: string }>
        ).map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[
              S.filterTab,
              filterStatus === f.key && S.filterTabActive,
            ]}
            onPress={() => setFilterStatus(f.key)}
          >
            <Text
              style={[
                S.filterTabTxt,
                filterStatus === f.key && S.filterTabTxtActive,
              ]}
            >
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* List */}
      <ScrollView style={S.list} contentContainerStyle={S.listContent}>
        {filteredList.length === 0 ? (
          <View style={S.empty}>
            <Text style={S.emptyTxt}>Tidak ada data kurir.</Text>
          </View>
        ) : (
          filteredList.map((k) => {
            const statusColor = getStatusColor(k.status);
            const statusLabel = getStatusLabel(k.status);
            return (
              <TouchableOpacity
                key={k.id}
                style={S.card}
                onPress={() => {
                  setCatatan(k.catatanAdmin ?? "");
                  setShowDetail(k);
                }}
                activeOpacity={0.8}
              >
                <View style={S.cardRow}>
                  <View style={S.cardInfo}>
                    <Text style={S.cardNama}>{k.nama}</Text>
                    <Text style={S.cardPhone}>{k.phone}</Text>
                    <Text style={S.cardDate}>
                      {new Date(k.createdAt).toLocaleDateString("id-ID")}
                    </Text>
                  </View>
                  <View style={S.cardRight}>
                    <Text style={[S.cardStatus, { color: statusColor }]}>
                      {statusLabel}
                    </Text>
                    <Text style={S.cardArrow}>›</Text>
                  </View>
                </View>
                {k.status === "ditolak" && k.catatanAdmin ? (
                  <Text style={S.cardNote} numberOfLines={1}>
                    Catatan: {k.catatanAdmin}
                  </Text>
                ) : null}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* Detail modal */}
      {renderDetailModal()}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    paddingBottom: 8,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1F2937",
    flex: 1,
  },
  pendingBadge: {
    backgroundColor: ORANGE,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pendingBadgeTxt: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  // Filter
  filterRow: {
    flexDirection: "row",
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingBottom: 10,
    gap: 6,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: LIGHT_BG,
    alignItems: "center",
  },
  filterTabActive: {
    backgroundColor: BLUE,
  },
  filterTabTxt: {
    fontSize: 11,
    fontWeight: "600",
    color: GRAY,
  },
  filterTabTxtActive: {
    color: "#fff",
  },
  // List
  list: {
    flex: 1,
  },
  listContent: {
    padding: 12,
    paddingBottom: 32,
  },
  empty: {
    alignItems: "center",
    paddingTop: 60,
  },
  emptyTxt: {
    fontSize: 14,
    color: GRAY,
  },
  // Card
  card: {
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
  cardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardInfo: {
    flex: 1,
  },
  cardNama: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 2,
  },
  cardPhone: {
    fontSize: 13,
    color: GRAY,
    marginBottom: 2,
  },
  cardDate: {
    fontSize: 11,
    color: "#9CA3AF",
  },
  cardRight: {
    alignItems: "flex-end",
    marginLeft: 8,
  },
  cardStatus: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 4,
  },
  cardArrow: {
    fontSize: 20,
    color: GRAY,
  },
  cardNote: {
    marginTop: 6,
    fontSize: 12,
    color: RED,
    fontStyle: "italic",
  },
  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: "#fff",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  modalTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: "700",
    color: "#1F2937",
  },
  modalClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: LIGHT_BG,
    justifyContent: "center",
    alignItems: "center",
  },
  modalCloseTxt: {
    fontSize: 14,
    fontWeight: "700",
    color: "#374151",
  },
  modalScroll: {
    flex: 1,
  },
  modalContent: {
    padding: 16,
    paddingBottom: 40,
  },
  // Detail card
  detailCard: {
    backgroundColor: LIGHT_BG,
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
  },
  detailName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 4,
  },
  detailPhone: {
    fontSize: 14,
    color: GRAY,
    marginBottom: 4,
  },
  detailDate: {
    fontSize: 12,
    color: "#9CA3AF",
    marginBottom: 6,
  },
  detailStatus: {
    fontSize: 14,
    fontWeight: "700",
  },
  prevNote: {
    marginTop: 8,
    backgroundColor: "#FEF2F2",
    borderRadius: 6,
    padding: 8,
    borderLeftWidth: 3,
    borderLeftColor: RED,
  },
  prevNoteTxt: {
    fontSize: 12,
    color: RED,
  },
  // Document images
  docLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  docBox: {
    width: "100%",
    height: 220,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: LIGHT_BG,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  docImg: {
    width: "100%",
    height: "100%",
  },
  docEmpty: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  docEmptyTxt: {
    fontSize: 13,
    color: GRAY,
    fontStyle: "italic",
  },
  // Catatan
  catatanSection: {
    marginBottom: 16,
  },
  catatanLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 6,
  },
  catatanInput: {
    backgroundColor: LIGHT_BG,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#1F2937",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    minHeight: 80,
  },
  // Action buttons
  actionRow: {
    flexDirection: "row",
    gap: 10,
  },
  btnTolak: {
    flex: 1,
    backgroundColor: RED,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
  },
  btnTolakTxt: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  btnVerif: {
    flex: 2,
    backgroundColor: GREEN,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
  },
  btnVerifTxt: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  btnReverif: {
    backgroundColor: GREEN,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
  },
  btnReverifTxt: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
});