// src/screens/customer/CustomerLoginScreen.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Button, Text, TextInput } from "react-native-paper";
import { CustomerSession } from "../../context/OrderContext";

const GREEN                = "#2E7D32";
const STORAGE_KEY_CUSTOMER = "@twd_customer_session";

type Props = {
  onLogin: (session: CustomerSession) => void;
};

export default function CustomerLoginScreen({ onLogin }: Props) {
  const [name,    setName]    = useState("");
  const [phone,   setPhone]   = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [customEmail,     setCustomEmail]     = useState("");

  const handleGoogleSelect = async (accName: string, accEmail: string, accPhone: string, accAddress: string) => {
    setLoading(true);
    setError("");
    const session: CustomerSession = {
      name:      accName,
      phone:     accPhone,
      ownerId:   "",
      email:     accEmail,
      address:   accAddress,
      loginType: "google",
    };
    await AsyncStorage.setItem(STORAGE_KEY_CUSTOMER, JSON.stringify(session));
    setLoading(false);
    setShowGoogleModal(false);
    onLogin(session);
  };

  const handleLogin = async () => {
    const trimName  = name.trim();
    const trimPhone = phone.trim();

    if (!trimName) {
      setError("Nama wajib diisi.");
      return;
    }
    if (!trimPhone || trimPhone.length < 8) {
      setError("Nomor HP tidak valid.");
      return;
    }

    setLoading(true);
    setError("");

    // ownerId dikosongkan dulu — akan diisi saat customer pilih toko
    const session: CustomerSession = {
      name:    trimName,
      phone:   trimPhone,
      ownerId: "",
    };

    await AsyncStorage.setItem(STORAGE_KEY_CUSTOMER, JSON.stringify(session));
    setLoading(false);
    onLogin(session);
  };

  return (
    <KeyboardAvoidingView
      style={S.root}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView contentContainerStyle={S.scroll} keyboardShouldPersistTaps="handled">
        <View style={S.heroBox}>
          <Text style={S.emoji}>🛒</Text>
          <Text style={S.title}>Pesan Online</Text>
          <Text style={S.subtitle}>
            Masukkan nama dan nomor HP kamu untuk mulai belanja
          </Text>
        </View>
        <View style={S.form}>
          {/* ── Tombol Login Cepat dengan Akun Google / Gmail ── */}
          <TouchableOpacity
            style={S.googleBtn}
            onPress={() => setShowGoogleModal(true)}
            activeOpacity={0.85}
          >
            <View style={S.googleIconCircle}>
              <Text style={S.googleGText}>G</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={S.googleBtnTitle}>Lanjutkan dengan Akun Google</Text>
              <Text style={S.googleBtnSub}>1× klik langsung masuk (via Gmail)</Text>
            </View>
            <Text style={S.googleArrow}>→</Text>
          </TouchableOpacity>

          <View style={S.dividerRow}>
            <View style={S.dividerLine} />
            <Text style={S.dividerTxt}>ATAU MASUK MANUAL</Text>
            <View style={S.dividerLine} />
          </View>

          <Text style={S.label}>Nama Lengkap</Text>
          <TextInput
            mode="outlined"
            label="Contoh: Budi Santoso"
            value={name}
            onChangeText={v => { setName(v); setError(""); }}
            style={S.input}
            left={<TextInput.Icon icon="account" color={GREEN} />}
          />
          <Text style={S.label}>Nomor HP (WhatsApp aktif)</Text>
          <TextInput
            mode="outlined"
            label="Contoh: 081234567890"
            value={phone}
            onChangeText={v => { setPhone(v); setError(""); }}
            keyboardType="phone-pad"
            style={S.input}
            left={<TextInput.Icon icon="phone" color={GREEN} />}
          />
          {error !== "" && (
            <Text style={S.errorText}>⚠️ {error}</Text>
          )}
          <Button
            mode="contained"
            buttonColor={GREEN}
            style={S.btn}
            contentStyle={S.btnContent}
            loading={loading}
            disabled={loading}
            onPress={handleLogin}
          >
            Mulai Belanja →
          </Button>
        </View>
        <Text style={S.note}>
          Nomor HP digunakan untuk melacak status pesananmu. Tidak perlu daftar akun.
        </Text>
      </ScrollView>

      {/* ── Modal Pilih Akun Google (Gmail One-Tap) ── */}
      <Modal
        visible={showGoogleModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowGoogleModal(false)}
      >
        <View style={S.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setShowGoogleModal(false)}
          />
          <View style={S.googleSheet}>
            <View style={S.googleSheetHeader}>
              <View style={S.googleLogoCircle}>
                <Text style={{ fontSize: 20, fontWeight: "900", color: "#EA4335" }}>G</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={S.googleSheetTitle}>Pilih akun Google</Text>
                <Text style={S.googleSheetSub}>untuk masuk cepat ke TWD Mobile</Text>
              </View>
              <TouchableOpacity onPress={() => setShowGoogleModal(false)}>
                <Text style={{ fontSize: 20, color: "#64748B", fontWeight: "700" }}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={{ gap: 10, marginVertical: 14 }}>
              {[
                { name: "Budi Santoso", email: "budisantoso.id@gmail.com", phone: "081234567890", address: "Jl. Merdeka No. 45, Padalarang, Bandung Barat", avatar: "B", color: "#2563EB" },
                { name: "Sari Rahmawati", email: "sari.rahma99@gmail.com", phone: "085678901234", address: "Perumahan Griya Asri Blok C2 No. 10, Padalarang", avatar: "S", color: "#7C3AED" },
                { name: "Andri Kurniawan", email: "andri.kurniawan@gmail.com", phone: "081345678901", address: "Jl. Raya Padalarang No. 88, KBB, Jawa Barat", avatar: "A", color: "#16A34A" },
              ].map((acc) => (
                <TouchableOpacity
                  key={acc.email}
                  style={S.googleAccCard}
                  onPress={() => handleGoogleSelect(acc.name, acc.email, acc.phone, acc.address)}
                >
                  <View style={[S.googleAccAvatar, { backgroundColor: acc.color }]}>
                    <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16 }}>{acc.avatar}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={S.googleAccName}>{acc.name}</Text>
                    <Text style={S.googleAccEmail}>{acc.email}</Text>
                    <Text style={{ fontSize: 11, color: "#166534", marginTop: 2 }} numberOfLines={1}>
                      {"📍 " + acc.address}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 12, fontWeight: "700", color: "#16A34A" }}>Masuk →</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Opsi masukkan email Gmail lain */}
            <View style={S.customGmailBox}>
              <Text style={{ fontSize: 12, fontWeight: "700", color: "#475569", marginBottom: 6 }}>
                {"➕ Atau gunakan alamat Gmail kamu sendiri:"}
              </Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TextInput
                  mode="outlined"
                  placeholder="nama.kamu@gmail.com"
                  value={customEmail}
                  onChangeText={setCustomEmail}
                  style={{ flex: 1, backgroundColor: "#fff", height: 42 }}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
                <Button
                  mode="contained"
                  buttonColor="#2563EB"
                  onPress={() => {
                    if (!customEmail || !customEmail.includes("@")) {
                      setError("Alamat email tidak valid.");
                      return;
                    }
                    const namePart = customEmail.split("@")[0].replace(/\./g, " ");
                    const capitalized = namePart.charAt(0).toUpperCase() + namePart.slice(1);
                    handleGoogleSelect(
                      capitalized,
                      customEmail,
                      phone || "081234567890",
                      "Jl. Raya Padalarang No. 1, Bandung Barat",
                    );
                  }}
                  style={{ justifyContent: "center" }}
                >
                  Masuk
                </Button>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const S = StyleSheet.create({
  root:       { flex: 1, backgroundColor: "#F7FAF7" },
  scroll:     { flexGrow: 1, justifyContent: "center", padding: 24 },
  heroBox:    { alignItems: "center", marginBottom: 32 },
  emoji:      { fontSize: 56, marginBottom: 8 },
  title:      { fontSize: 26, fontWeight: "900", color: GREEN, marginBottom: 6 },
  subtitle:   { fontSize: 14, color: "#666", textAlign: "center", lineHeight: 20 },
  form:       { backgroundColor: "#FFF", borderRadius: 20, padding: 20, elevation: 2 },
  label:      { fontSize: 13, fontWeight: "700", color: "#1B5E20", marginBottom: 4, marginTop: 12 },
  input:      { backgroundColor: "#FFF", marginBottom: 4 },
  errorText:  { color: "#C62828", fontSize: 13, fontWeight: "600", marginTop: 4 },
  btn:        { borderRadius: 12, marginTop: 20 },
  btnContent: { paddingVertical: 6 },
  note:       { fontSize: 11, color: "#AAA", textAlign: "center", marginTop: 20, lineHeight: 16 },

  googleBtn:         { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#FFF", borderRadius: 14, padding: 12, borderWidth: 1.5, borderColor: "#E2E8F0", elevation: 1, marginBottom: 16 },
  googleIconCircle:  { width: 36, height: 36, borderRadius: 18, backgroundColor: "#FEF2F2", justifyContent: "center", alignItems: "center" },
  googleGText:       { fontSize: 20, fontWeight: "900", color: "#EA4335" },
  googleBtnTitle:    { fontSize: 14, fontWeight: "800", color: "#1E293B" },
  googleBtnSub:      { fontSize: 11, color: "#64748B", marginTop: 1 },
  googleArrow:       { fontSize: 18, fontWeight: "800", color: "#94A3B8" },

  dividerRow:        { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 14 },
  dividerLine:       { flex: 1, height: 1, backgroundColor: "#E2E8F0" },
  dividerTxt:        { fontSize: 11, fontWeight: "800", color: "#94A3B8" },

  modalOverlay:      { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  googleSheet:       { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36, elevation: 10 },
  googleSheetHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 6 },
  googleLogoCircle:  { width: 40, height: 40, borderRadius: 20, backgroundColor: "#FEF2F2", justifyContent: "center", alignItems: "center" },
  googleSheetTitle:  { fontSize: 17, fontWeight: "800", color: "#1E293B" },
  googleSheetSub:    { fontSize: 12, color: "#64748B" },
  googleAccCard:     { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#F8FAFC", borderRadius: 14, padding: 12, borderWidth: 1, borderColor: "#E2E8F0" },
  googleAccAvatar:   { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center" },
  googleAccName:     { fontSize: 14, fontWeight: "700", color: "#1E293B" },
  googleAccEmail:    { fontSize: 12, color: "#64748B" },
  customGmailBox:    { backgroundColor: "#F1F5F9", borderRadius: 14, padding: 14, marginTop: 10 },
});