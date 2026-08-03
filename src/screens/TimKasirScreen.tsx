// src/screens/TimKasirScreen.tsx — v3 FINAL
import React, { useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "../context/AuthContext";

// ─── Types ────────────────────────────────────────────────────────────────────
interface KasirAccount {
  id:        string;
  name:      string;
  pin:       string;
  ownerId:   string;
  isActive:  boolean;
  createdAt?: string;
}

interface TimKasirScreenProps {
  maxKasir?: number | null;
  onBack?: () => void;
}

// ─── Konstanta ────────────────────────────────────────────────────────────────
const ACCENT      = "#2563EB";
const DANGER      = "#DC2626";
const BOTTOM_SAFE = Platform.OS === "ios" ? 34 : 24;

const MAX_KASIR_DEFAULT: Record<string, number | null> = {
  basic:      2,
  pro:        5,
  enterprise: null,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function genId(): string {
  return "kasir-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6);
}

function formatDate(iso?: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function validatePin(pin: string): string | null {
  if (pin.length < 4) return "PIN minimal 4 digit.";
  if (pin.length > 8) return "PIN maksimal 8 digit.";
  if (!/^\d+$/.test(pin)) return "PIN hanya boleh angka.";
  return null;
}

function validateName(name: string): string | null {
  if (name.trim().length < 2) return "Nama minimal 2 karakter.";
  if (name.trim().length > 32) return "Nama maksimal 32 karakter.";
  return null;
}

// ─── Komponen Utama ───────────────────────────────────────────────────────────
export default function TimKasirScreen({ maxKasir, onBack }: TimKasirScreenProps) {
  const { kasirAccounts, addKasir, updateKasir, deleteKasir, langganan, user } =
    useAuth() as any;

  const batasKasir: number | null = useMemo(() => {
    if (maxKasir !== undefined) return maxKasir;
    const paket = (langganan ?? "basic") as string;
    return MAX_KASIR_DEFAULT[paket] ?? 2;
  }, [maxKasir, langganan]);

  const paketLabel: string = useMemo(() => {
    const paket = (langganan ?? "basic") as string;
    return paket.charAt(0).toUpperCase() + paket.slice(1);
  }, [langganan]);

  const kasirList: KasirAccount[] = useMemo(
    () => (Array.isArray(kasirAccounts) ? kasirAccounts : []),
    [kasirAccounts],
  );

  const sudahPenuh: boolean = batasKasir !== null && kasirList.length >= batasKasir;
  const sisaSlot: number    = batasKasir === null ? 999 : Math.max(0, batasKasir - kasirList.length);

  const [showModal,  setShowModal]  = useState(false);
  const [editTarget, setEditTarget] = useState<KasirAccount | null>(null);
  const [formName,   setFormName]   = useState("");
  const [formPin,    setFormPin]    = useState("");
  const [showPin,    setShowPin]    = useState(false);
  const [saving,     setSaving]     = useState(false);

  function openTambah() {
    if (sudahPenuh) {
      Alert.alert(
        "Batas Kasir Tercapai 🚫",
        "Paket " + paketLabel + " hanya mendukung " + String(batasKasir) + " akun kasir.\n\n" +
        "Upgrade ke paket lebih tinggi untuk menambah lebih banyak kasir.",
        [{ text: "Mengerti", style: "cancel" }],
      );
      return;
    }
    setEditTarget(null);
    setFormName("");
    setFormPin("");
    setShowPin(false);
    setShowModal(true);
  }

  function openEdit(kasir: KasirAccount) {
    setEditTarget(kasir);
    setFormName(kasir.name);
    setFormPin(kasir.pin);
    setShowPin(false);
    setShowModal(true);
  }

  async function handleSimpan() {
    Keyboard.dismiss();

    const nameErr = validateName(formName);
    if (nameErr) { Alert.alert("Nama Tidak Valid", nameErr); return; }

    const pinErr = validatePin(formPin);
    if (pinErr) { Alert.alert("PIN Tidak Valid", pinErr); return; }

    const isDupName = kasirList.some(
      (k: KasirAccount) =>
        k.name.trim().toLowerCase() === formName.trim().toLowerCase() &&
        k.id !== editTarget?.id,
    );
    if (isDupName) {
      Alert.alert("Nama Sudah Digunakan", "Gunakan nama berbeda untuk setiap kasir.");
      return;
    }

    const isDupPin = kasirList.some(
      (k: KasirAccount) => k.pin === formPin.trim() && k.id !== editTarget?.id,
    );
    if (isDupPin) {
      Alert.alert("PIN Sudah Digunakan", "Setiap kasir harus memiliki PIN unik.");
      return;
    }

    setSaving(true);
    try {
      if (editTarget) {
        const updated: KasirAccount = {
          ...editTarget,
          name: formName.trim(),
          pin:  formPin.trim(),
        };
        await updateKasir(updated);
        Alert.alert("Berhasil ✅", "Data kasir " + updated.name + " diperbarui.");
      } else {
        if (batasKasir !== null && kasirList.length >= batasKasir) {
          Alert.alert("Batas Kasir Tercapai", "Upgrade paket untuk menambah kasir.");
          return;
        }
        const newKasir: KasirAccount = {
          id:        genId(),
          name:      formName.trim(),
          pin:       formPin.trim(),
          ownerId:   String(user?.id ?? ""),
          isActive:  true,
          createdAt: new Date().toISOString(),
        };
        await addKasir(newKasir);
        Alert.alert("Berhasil ✅", "Kasir " + newKasir.name + " berhasil ditambahkan.");
      }
      setShowModal(false);
    } catch (e) {
      Alert.alert("Error", "Gagal menyimpan data: " + String(e));
    } finally {
      setSaving(false);
    }
  }

  function handleHapus(kasir: KasirAccount) {
    Alert.alert(
      "Hapus Kasir",
      "Yakin hapus akun kasir \"" + kasir.name + "\"?\n\nKasir tidak akan bisa login setelah dihapus.",
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Hapus",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteKasir(kasir.id);
            } catch {
              Alert.alert("Error", "Gagal menghapus kasir.");
            }
          },
        },
      ],
    );
  }

  return (
    <View style={TK.container}>
      {/* Header */}
      <View style={TK.header}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={TK.backBtn}>
            <Text style={TK.backTxt}>{"<- Kembali"}</Text>
          </TouchableOpacity>
        )}
        <View style={TK.headerCenter}>
          <Text style={TK.headerTitle}>{"Tim Kasir"}</Text>
          <Text style={TK.headerSub}>{"Paket " + paketLabel}</Text>
        </View>
        <TouchableOpacity
          style={sudahPenuh ? TK.addBtnFull : TK.addBtn}
          onPress={openTambah}
        >
          <Text style={TK.addBtnTxt}>{"+ Tambah"}</Text>
        </TouchableOpacity>
      </View>

      {/* Kuota Bar */}
      <View style={TK.kuotaCard}>
        <View style={TK.kuotaTextRow}>
          <Text style={TK.kuotaTitle}>
            {batasKasir === null
              ? "Kasir Tidak Terbatas (Enterprise)"
              : "Slot Kasir Terpakai"}
          </Text>
          {batasKasir !== null && (
            <Text style={sudahPenuh ? TK.kuotaCountFull : TK.kuotaCount}>
              {String(kasirList.length) + " / " + String(batasKasir)}
            </Text>
          )}
        </View>
        {batasKasir !== null && (
          <View>
            <View style={TK.progressTrack}>
              <View
                style={[
                  TK.progressFill,
                  sudahPenuh && TK.progressFull,
                  { width: (Math.min(100, (kasirList.length / batasKasir) * 100) + "%") as any },
                ]}
              />
            </View>
            <View style={TK.kuotaHintRow}>
              {sudahPenuh ? (
                <Text style={TK.kuotaHintFull}>
                  {"Batas kasir tercapai - Upgrade paket untuk menambah lebih banyak"}
                </Text>
              ) : (
                <Text style={TK.kuotaHint}>{String(sisaSlot) + " slot tersisa"}</Text>
              )}
            </View>
          </View>
        )}
      </View>

      {/* Info Batas Paket */}
      <View style={TK.paketInfoRow}>
        {Object.entries(MAX_KASIR_DEFAULT).map(([p, max]) => {
          const isActive = (langganan ?? "basic") === p;
          return (
            <View key={p} style={isActive ? TK.paketChipActive : TK.paketChip}>
              <Text style={isActive ? TK.paketChipLblActive : TK.paketChipLbl}>
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </Text>
              <Text style={isActive ? TK.paketChipMaxActive : TK.paketChipMax}>
                {max === null ? "~" : String(max) + " kasir"}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Daftar Kasir */}
      {kasirList.length === 0 ? (
        <View style={TK.emptyBox}>
          <Text style={TK.emptyIcon}>{"👤"}</Text>
          <Text style={TK.emptyTitle}>{"Belum Ada Kasir"}</Text>
          <Text style={TK.emptyDesc}>
            {"Tambahkan akun kasir agar tim Anda bisa menggunakan aplikasi kasir."}
          </Text>
          <TouchableOpacity style={TK.emptyAddBtn} onPress={openTambah}>
            <Text style={TK.emptyAddBtnTxt}>{"+ Tambah Kasir Pertama"}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={kasirList}
          keyExtractor={(item) => item.id}
          contentContainerStyle={TK.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <View style={TK.kasirCard}>
              <View style={TK.kasirAvatarWrap}>
                <View style={TK.kasirAvatar}>
                  <Text style={TK.kasirAvatarTxt}>
                    {(item.name ?? "?").trim().charAt(0).toUpperCase() || "?"}
                  </Text>
                </View>
                <View style={TK.kasirNomorBadge}>
                  <Text style={TK.kasirNomorTxt}>{"#" + String(index + 1)}</Text>
                </View>
              </View>
              <View style={TK.kasirInfo}>
                <Text style={TK.kasirName}>{item.name || "—"}</Text>
                <Text style={TK.kasirPinRow}>
                  {"PIN: "}
                  <Text style={TK.kasirPinMask}>{"•".repeat(item.pin?.length ?? 4)}</Text>
                </Text>
                {item.createdAt ? (
                  <Text style={TK.kasirDate}>{"Dibuat: " + formatDate(item.createdAt)}</Text>
                ) : null}
                <View style={item.isActive === false ? TK.statusBadgeInactive : TK.statusBadge}>
                  <Text style={item.isActive === false ? TK.statusBadgeTxtInactive : TK.statusBadgeTxt}>
                    {item.isActive === false ? "Nonaktif" : "Aktif"}
                  </Text>
                </View>
              </View>
              <View style={TK.kasirActions}>
                <TouchableOpacity style={TK.editBtn} onPress={() => openEdit(item)}>
                  <Text style={TK.editBtnTxt}>{"Edit"}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={TK.deleteBtn} onPress={() => handleHapus(item)}>
                  <Text style={TK.deleteBtnTxt}>{"Hapus"}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          ListFooterComponent={
            sudahPenuh ? (
              <View style={TK.upgradeCard}>
                <Text style={TK.upgradeIcon}>{"🚀"}</Text>
                <View style={TK.upgradeText}>
                  <Text style={TK.upgradeTitle}>{"Butuh lebih banyak kasir?"}</Text>
                  <Text style={TK.upgradeSub}>
                    {paketLabel === "Basic"
                      ? "Upgrade ke Pro (5 kasir) atau Enterprise (tak terbatas)"
                      : "Upgrade ke Enterprise untuk kasir tak terbatas"}
                  </Text>
                </View>
              </View>
            ) : null
          }
        />
      )}

      {/* Modal: Form Kasir */}
      <Modal
        visible={showModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowModal(false)}
      >
        <Pressable style={TK.overlay} onPress={() => setShowModal(false)}>
          <Pressable style={TK.sheet} onPress={() => {}}>
            <View style={TK.sheetHeader}>
              <Text style={TK.sheetTitle}>
                {editTarget ? "Edit Kasir" : "Tambah Kasir"}
              </Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Text style={TK.sheetClose}>{"X"}</Text>
              </TouchableOpacity>
            </View>

            {editTarget === null && batasKasir !== null && (
              <View style={TK.slotInfoBox}>
                <Text style={TK.slotInfoTxt}>
                  {"Slot: " + String(kasirList.length) + "/" + String(batasKasir) +
                   " terpakai - " + String(sisaSlot) + " tersisa"}
                </Text>
              </View>
            )}

            <Text style={TK.fieldLbl}>{"Nama Kasir"}</Text>
            <TextInput
              style={TK.fieldInput}
              value={formName}
              onChangeText={setFormName}
              placeholder="Contoh: Budi, Kasir 1, Shift Pagi..."
              placeholderTextColor="#94A3B8"
              autoCapitalize="words"
              maxLength={32}
            />
            <Text style={TK.fieldHint}>{"Nama ini akan tampil saat kasir login."}</Text>

            <Text style={TK.fieldLbl}>{"PIN Kasir"}</Text>
            <View style={TK.pinRow}>
              <TextInput
                style={TK.pinInput}
                value={formPin}
                onChangeText={setFormPin}
                placeholder="4-8 digit angka"
                placeholderTextColor="#94A3B8"
                keyboardType="numeric"
                maxLength={8}
                secureTextEntry={!showPin}
              />
              <TouchableOpacity
                style={TK.pinToggleBtn}
                onPress={() => setShowPin((v) => !v)}
              >
                <Text style={TK.pinToggleTxt}>{showPin ? "Sembunyikan" : "Tampilkan"}</Text>
              </TouchableOpacity>
            </View>
            <Text style={TK.fieldHint}>
              {"PIN digunakan kasir untuk login. Jangan bagikan ke orang lain."}
            </Text>

            <View style={TK.tipsBox}>
              <Text style={TK.tipsTxt}>
                {"Tips: Gunakan PIN yang mudah diingat kasir namun sulit ditebak. Hindari 1234, 0000, dll."}
              </Text>
            </View>

            <View style={TK.sheetActions}>
              <TouchableOpacity
                style={TK.cancelBtn}
                onPress={() => setShowModal(false)}
              >
                <Text style={TK.cancelBtnTxt}>{"Batal"}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={saving ? TK.saveBtnDisabled : TK.saveBtn}
                onPress={handleSimpan}
                disabled={saving}
              >
                <Text style={TK.saveBtnTxt}>
                  {saving ? "Menyimpan..." : editTarget ? "Simpan" : "Tambah Kasir"}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={TK.sheetBottomSafe} />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// ─── StyleSheet ───────────────────────────────────────────────────────────────
const TK = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F1F5F9" },

  header:       { backgroundColor: ACCENT, paddingTop: 52, paddingBottom: 14, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", gap: 10 },
  backBtn:      { paddingRight: 4 },
  backTxt:      { color: "rgba(255,255,255,0.9)", fontSize: 13, fontWeight: "700" },
  headerCenter: { flex: 1 },
  headerTitle:  { color: "#fff", fontSize: 18, fontWeight: "800" },
  headerSub:    { color: "rgba(255,255,255,0.75)", fontSize: 11, marginTop: 2 },
  addBtn:       { backgroundColor: "#fff", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  addBtnFull:   { backgroundColor: "rgba(255,255,255,0.3)", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.4)" },
  addBtnTxt:    { color: ACCENT, fontWeight: "800", fontSize: 13 },

  kuotaCard:     { backgroundColor: "#fff", margin: 14, borderRadius: 16, padding: 16, elevation: 2 },
  kuotaTextRow:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  kuotaTitle:    { fontSize: 13, fontWeight: "700", color: "#374151" },
  kuotaCount:    { fontSize: 15, fontWeight: "800", color: ACCENT },
  kuotaCountFull:{ fontSize: 15, fontWeight: "800", color: DANGER },
  progressTrack: { height: 8, backgroundColor: "#E2E8F0", borderRadius: 4, overflow: "hidden" },
  progressFill:  { height: 8, backgroundColor: ACCENT, borderRadius: 4 },
  progressFull:  { backgroundColor: DANGER },
  kuotaHintRow:  { marginTop: 8 },
  kuotaHint:     { fontSize: 12, color: "#64748B" },
  kuotaHintFull: { fontSize: 11, color: DANGER, fontWeight: "600" },

  paketInfoRow:       { flexDirection: "row", gap: 8, paddingHorizontal: 14, marginBottom: 14 },
  paketChip:          { flex: 1, backgroundColor: "#fff", borderRadius: 12, padding: 10, alignItems: "center", borderWidth: 1.5, borderColor: "#E2E8F0" },
  paketChipActive:    { flex: 1, backgroundColor: "#EFF6FF", borderRadius: 12, padding: 10, alignItems: "center", borderWidth: 1.5, borderColor: ACCENT },
  paketChipLbl:       { fontSize: 11, fontWeight: "700", color: "#64748B" },
  paketChipLblActive: { fontSize: 11, fontWeight: "700", color: ACCENT },
  paketChipMax:       { fontSize: 13, fontWeight: "800", color: "#94A3B8", marginTop: 4 },
  paketChipMaxActive: { fontSize: 13, fontWeight: "800", color: ACCENT, marginTop: 4 },

  listContent: { paddingHorizontal: 14, paddingBottom: 40 },

  kasirCard:       { backgroundColor: "#fff", borderRadius: 14, padding: 14, marginBottom: 10, flexDirection: "row", alignItems: "center", gap: 12, elevation: 1 },
  kasirAvatarWrap: { position: "relative" },
  kasirAvatar:     { width: 48, height: 48, borderRadius: 24, backgroundColor: "#EFF6FF", justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: ACCENT },
  kasirAvatarTxt:  { fontSize: 20, fontWeight: "800", color: ACCENT },
  kasirNomorBadge: { position: "absolute", bottom: -2, right: -4, backgroundColor: ACCENT, borderRadius: 8, paddingHorizontal: 4, paddingVertical: 1 },
  kasirNomorTxt:   { fontSize: 9, fontWeight: "800", color: "#fff" },
  kasirInfo:       { flex: 1 },
  kasirName:       { fontSize: 15, fontWeight: "700", color: "#1E293B", marginBottom: 4 },
  kasirPinRow:     { fontSize: 12, color: "#64748B" },
  kasirPinMask:    { fontSize: 12, color: "#94A3B8", letterSpacing: 2 },
  kasirDate:       { fontSize: 10, color: "#94A3B8", marginTop: 3 },
  kasirActions:    { flexDirection: "column", gap: 8 },
  editBtn:         { paddingHorizontal: 10, paddingVertical: 7, backgroundColor: "#EFF6FF", borderRadius: 10, justifyContent: "center", alignItems: "center" },
  editBtnTxt:      { fontSize: 12, fontWeight: "700", color: ACCENT },
  deleteBtn:       { paddingHorizontal: 10, paddingVertical: 7, backgroundColor: "#FEE2E2", borderRadius: 10, justifyContent: "center", alignItems: "center" },
  deleteBtnTxt:    { fontSize: 12, fontWeight: "700", color: DANGER },

  statusBadge:           { alignSelf: "flex-start", marginTop: 4, backgroundColor: "#DCFCE7", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  statusBadgeInactive:   { alignSelf: "flex-start", marginTop: 4, backgroundColor: "#FEE2E2", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  statusBadgeTxt:        { fontSize: 9, fontWeight: "700", color: "#16A34A" },
  statusBadgeTxtInactive:{ fontSize: 9, fontWeight: "700", color: DANGER },

  upgradeCard:  { flexDirection: "row", backgroundColor: "#FFF7ED", borderRadius: 14, padding: 14, alignItems: "center", gap: 12, marginTop: 6, borderWidth: 1, borderColor: "#FED7AA" },
  upgradeIcon:  { fontSize: 28 },
  upgradeText:  { flex: 1 },
  upgradeTitle: { fontSize: 13, fontWeight: "700", color: "#92400E" },
  upgradeSub:   { fontSize: 11, color: "#B45309", marginTop: 3 },

  emptyBox:       { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  emptyIcon:      { fontSize: 54, marginBottom: 14 },
  emptyTitle:     { fontSize: 17, fontWeight: "700", color: "#374151", marginBottom: 8 },
  emptyDesc:      { fontSize: 13, color: "#64748B", textAlign: "center", lineHeight: 20, marginBottom: 20 },
  emptyAddBtn:    { backgroundColor: ACCENT, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  emptyAddBtnTxt: { color: "#fff", fontWeight: "800", fontSize: 14 },

  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet:   { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },

  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  sheetTitle:  { fontSize: 18, fontWeight: "800", color: "#1E293B" },
  sheetClose:  { fontSize: 22, color: "#64748B", fontWeight: "700" },

  slotInfoBox: { backgroundColor: "#EFF6FF", borderRadius: 10, padding: 10, marginBottom: 14 },
  slotInfoTxt: { fontSize: 12, color: ACCENT, fontWeight: "600", textAlign: "center" },

  fieldLbl:   { fontSize: 12, fontWeight: "700", color: "#374151", marginBottom: 6 },
  fieldInput: { borderWidth: 1.5, borderColor: "#CBD5E1", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: "#1E293B", marginBottom: 4, backgroundColor: "#FAFAFA" },
  fieldHint:  { fontSize: 11, color: "#94A3B8", marginBottom: 14 },

  pinRow:       { flexDirection: "row", gap: 8, marginBottom: 4 },
  pinInput:     { flex: 1, borderWidth: 1.5, borderColor: "#CBD5E1", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 18, fontWeight: "700", color: "#1E293B", letterSpacing: 4, backgroundColor: "#FAFAFA" },
  pinToggleBtn: { justifyContent: "center", alignItems: "center", paddingHorizontal: 12, height: 50, backgroundColor: "#F1F5F9", borderRadius: 12, borderWidth: 1.5, borderColor: "#CBD5E1" },
  pinToggleTxt: { fontSize: 11, fontWeight: "700", color: "#64748B" },

  tipsBox: { backgroundColor: "#F0FDF4", borderRadius: 10, padding: 12, marginBottom: 20, borderWidth: 1, borderColor: "#BBF7D0" },
  tipsTxt:  { fontSize: 12, color: "#166534", lineHeight: 18 },

  sheetActions:    { flexDirection: "row", gap: 10 },
  cancelBtn:       { flex: 1, borderWidth: 1.5, borderColor: "#CBD5E1", borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  cancelBtnTxt:    { fontSize: 14, fontWeight: "700", color: "#64748B" },
  saveBtn:         { flex: 2, backgroundColor: ACCENT, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  saveBtnDisabled: { flex: 2, backgroundColor: "#CBD5E1", borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  saveBtnTxt:      { color: "#fff", fontWeight: "800", fontSize: 15 },

  // ← Ganti inline style= height: BOTTOM_SAFE  dengan ini
  sheetBottomSafe: { height: BOTTOM_SAFE },
});