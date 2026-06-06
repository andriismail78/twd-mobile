// src/screens/customer/CustomerLoginScreen.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
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
});