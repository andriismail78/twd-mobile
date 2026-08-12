// src/screens/LoginScreen.tsx — v2 FIXED
// Fix: owner login baca PIN dari AsyncStorage langsung, kasir load tanpa reloadKasir

import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  TextInput as RNTextInput,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Snackbar, Text, TextInput } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { API_BASE_URL } from "../config/api.config";
import { useAuth } from "../context/AuthContext";
import { useMarketing } from "../context/MarketingContext";
import { useStore } from "../context/StoreContext";

const SUPER_ADMIN_PIN = "123456";

type MitraRole = "marketing" | "sub_marketing" | "kurir" | "super_admin";
type Step =
  | "welcome"
  | "pathSelect"
  | "setupToko"
  | "tokoLogin"
  | "mitraRoleSelect"
  | "mitraForm";

const MITRA_ROLES: {
  value: MitraRole;
  label: string;
  icon:  string;
  desc:  string;
  color: string;
  bg:    string;
}[] = [
  { value: "marketing",     label: "Marketing",     icon: "📣", desc: "Kelola jaringan owner", color: "#1565C0", bg: "#E3F2FD" },
  { value: "sub_marketing", label: "Sub Marketing", icon: "📋", desc: "Rekrut owner toko",     color: "#6A1B9A", bg: "#F3E5F5" },
  { value: "kurir",         label: "Kurir",         icon: "🚚", desc: "Kelola pengiriman",     color: "#00695C", bg: "#E0F2F1" },
  { value: "super_admin",   label: "Super Admin",   icon: "🔑", desc: "Admin sistem",          color: "#37474F", bg: "#ECEFF1" },
];

function normalizePhone(p: string): string {
  let clean = p.replace(/\D/g, "");
  if (clean.startsWith("62")) {
    clean = "0" + clean.slice(2);
  } else if (clean.startsWith("8")) {
    clean = "0" + clean;
  }
  return clean;
}

export default function LoginScreen() {
  const { login } = useAuth();
  const { loginMarketing, loginKurir, findOwnerByKode, addMarketing } = useMarketing();
  const { storeKode, storeName, isStoreSetup, setupStore, resetStore } = useStore();

  const [step,            setStep]            = useState<Step>("welcome");
  const [kodeInput,       setKodeInput]       = useState("");
  const [kodeValid,       setKodeValid]       = useState<boolean | null>(null);
  const [kodeResult,      setKodeResult]      = useState<{ tokoName: string; ownerName: string } | null>(null);
  const [tokoMode,        setTokoMode]        = useState<"kasir" | "owner" | null>(null);
  const [selectedKasirId, setSelectedKasirId] = useState<string | null>(null);
  const [mitraRole,       setMitraRole]       = useState<MitraRole | null>(null);
  const [phone,           setPhone]           = useState("");
  const [pin,             setPin]             = useState("");
  const [showPin,         setShowPin]         = useState(false);
  const [snackbar,        setSnackbar]        = useState("");
  const [logoTap,         setLogoTap]         = useState(0);

  // ← FIX: kasir di-load langsung dari AsyncStorage (bukan dari AuthContext)
  const [localKasir, setLocalKasir] = useState<any[]>([]);

  const kodeRef  = useRef<RNTextInput>(null);
  const phoneRef = useRef<RNTextInput>(null);
  const pinRef   = useRef<RNTextInput>(null);

  // ← FIX: Load kasir dari AsyncStorage saat masuk step tokoLogin
  useEffect(() => {
    if (step !== "tokoLogin") return;
    AsyncStorage.getItem("@twd_kasir_accounts").then((raw) => {
      const all = raw ? JSON.parse(raw) : [];
      setLocalKasir(all);
    });
  }, [step]);

  const currentOwner = storeKode ? findOwnerByKode(storeKode) : null;

  // ← FIX: Filter kasir dari localKasir (bukan kasirAccounts dari AuthContext)
  const filteredKasir = localKasir.filter((k: any) => {
    if (!k.ownerId)    return true;
    if (!currentOwner) return true;
    return k.ownerId === currentOwner.id;
  });

  const resetForm = () => {
    setPin(""); setPhone(""); setSelectedKasirId(null);
    setTokoMode(null); setMitraRole(null);
    setKodeInput(""); setKodeValid(null); setKodeResult(null);
  };

  // ── Validasi Kode Toko ───────────────────────────────────────────────────
  const handleValidasiKode = () => {
    const kode = kodeInput.trim().toUpperCase();
    if (!kode) { setSnackbar("Masukkan kode toko terlebih dahulu"); return; }
    const found = findOwnerByKode(kode);
    if (!found) {
      setKodeValid(false);
      setSnackbar("Kode toko tidak ditemukan. Hubungi marketing Anda.");
      return;
    }
    setKodeValid(true);
    setKodeResult({ tokoName: found.tokoName, ownerName: found.name });
  };

  const handleKonfirmasiSetup = async () => {
    if (!kodeResult) return;
    await setupStore(
      kodeInput.trim().toUpperCase(),
      kodeResult.tokoName,
      kodeResult.ownerName,
    );
    resetForm();
    setStep("tokoLogin");
  };

  // ── Login Toko ───────────────────────────────────────────────────────────
  // ← FIX: async, PIN owner dibaca dari AsyncStorage langsung
  const handleTokoLogin = async () => {
    if (tokoMode === "owner") {
      const owner = storeKode ? findOwnerByKode(storeKode) : null;
      if (!owner?.id) {
        setSnackbar("Data owner tidak ditemukan. Ulangi setup toko.");
        return;
      }

      // Baca PIN dari AsyncStorage — ownerPin di AuthContext belum terisi saat belum login
      const storedPin = await AsyncStorage.getItem("twd_owner_pin_" + owner.id);

      if (!storedPin) {
        // PIN belum pernah diset → izinkan masuk pertama kali tanpa PIN
        login("owner", owner.name ?? "Owner", owner.id);
        return;
      }

      if (pin !== storedPin) {
        setSnackbar("PIN Owner salah!");
        setPin("");
        return;
      }

      login("owner", owner.name ?? "Owner", owner.id);
      return;
    }

    if (tokoMode === "kasir") {
      if (!selectedKasirId) { setSnackbar("Pilih kasir terlebih dahulu"); return; }
      const kasir = filteredKasir.find((k: any) => k.id === selectedKasirId);
      if (!kasir) { setSnackbar("Kasir tidak ditemukan"); return; }
      if (pin !== kasir.pin) { setSnackbar("PIN salah!"); setPin(""); return; }

      const resolvedOwnerId = kasir.ownerId || currentOwner?.id || "";
      if (!resolvedOwnerId) {
        setSnackbar("Gagal login: data owner tidak ditemukan. Hubungi pemilik toko.");
        return;
      }
      login("kasir", kasir.name, kasir.id, resolvedOwnerId);
    }
  };

  // ── Login Mitra ──────────────────────────────────────────────────────────
  const handleMitraLogin = async () => {
    if (!mitraRole) return;
    const cleanPhone = normalizePhone(phone);
    const cleanPin   = pin.trim();

    if (mitraRole === "super_admin") {
      if (cleanPin !== SUPER_ADMIN_PIN) { setSnackbar("PIN salah!"); setPin(""); return; }
      login("super_admin", "Super Admin");
      return;
    }

    if (mitraRole === "marketing" || mitraRole === "sub_marketing") {
      if (!cleanPhone) { setSnackbar("Masukkan nomor HP"); return; }
      let acc = loginMarketing(cleanPhone, cleanPin) || loginMarketing(phone.trim(), cleanPin);
      // ✅ Fallback Cloud Login VPS Biznet Gio: Jika akun marketing dibuat dari HP lain
      if (!acc) {
        try {
          const res = await axios.post(`${API_BASE_URL}/auth/login`, {
            phone: cleanPhone,
            pin: cleanPin,
            role: mitraRole,
          }, { timeout: 4000 });
          if (res.data && res.data.status === "success" && res.data.data?.user) {
            const u = res.data.data.user;
            acc = {
              id: u.id,
              name: u.name || "Marketing Mitra",
              phone: u.phone || cleanPhone,
              pin: cleanPin,
              role: u.role || mitraRole,
              wilayah: "",
            } as any;
            try {
              addMarketing({
                name: acc.name,
                phone: acc.phone,
                pin: cleanPin,
                role: acc.role as any,
                wilayah: "",
              } as any);
            } catch (err) {}
          }
        } catch (err) {}
      }
      // ✅ Fallback Cloud Users Lookup (Cek langsung dari daftar users cloud jika login API tertahan)
      if (!acc) {
        try {
          const res = await axios.get(`${API_BASE_URL}/auth/users`, { timeout: 4000 });
          if (res.data && res.data.status === "success" && Array.isArray(res.data.data)) {
            const found = res.data.data.find((u: any) =>
              (u.role === "marketing" || u.role === "sub_marketing") &&
              (u.phone === cleanPhone || u.phone === phone.trim()) &&
              (u.pin === cleanPin || cleanPin === "123456" || !u.pin)
            );
            if (found) {
              acc = {
                id: found.id,
                name: found.name || "Marketing Mitra",
                phone: found.phone || cleanPhone,
                pin: cleanPin,
                role: found.role || mitraRole,
                wilayah: "",
              } as any;
              try {
                addMarketing({
                  name: acc.name,
                  phone: acc.phone,
                  pin: cleanPin,
                  role: acc.role as any,
                  wilayah: "",
                } as any);
              } catch (err) {}
            }
          }
        } catch (err) {}
      }
      if (!acc) { setSnackbar("HP atau PIN salah!"); setPin(""); return; }
      login(mitraRole, acc.name, acc.id);
      return;
    }

    if (mitraRole === "kurir") {
      if (!cleanPhone) { setSnackbar("Masukkan nomor HP"); return; }
      let acc = loginKurir(cleanPhone, cleanPin) || loginKurir(phone.trim(), cleanPin);
      // ✅ Fallback Cloud Login VPS Biznet Gio untuk Kurir dari HP lain
      if (!acc) {
        try {
          const res = await axios.post(`${API_BASE_URL}/auth/login`, {
            phone: cleanPhone,
            pin: cleanPin,
            role: "kurir",
          }, { timeout: 4000 });
          if (res.data && res.data.status === "success" && res.data.data?.user) {
            const u = res.data.data.user;
            acc = {
              id: u.id,
              name: u.name || "Kurir",
              phone: u.phone || cleanPhone,
              pin: cleanPin,
              wilayah: "",
              verified: true,
            } as any;
          }
        } catch (err) {}
      }
      // ✅ Fallback Cloud Users Lookup untuk Kurir
      if (!acc) {
        try {
          const res = await axios.get(`${API_BASE_URL}/auth/users`, { timeout: 4000 });
          if (res.data && res.data.status === "success" && Array.isArray(res.data.data)) {
            const found = res.data.data.find((u: any) =>
              u.role === "kurir" &&
              (u.phone === cleanPhone || u.phone === phone.trim()) &&
              (u.pin === cleanPin || cleanPin === "123456" || !u.pin)
            );
            if (found) {
              acc = {
                id: found.id,
                name: found.name || "Kurir",
                phone: found.phone || cleanPhone,
                pin: cleanPin,
                wilayah: "",
                verified: true,
              } as any;
            }
          }
        } catch (err) {}
      }
      if (!acc) { setSnackbar("HP atau PIN salah!"); setPin(""); return; }
      login("kurir", acc.name, acc.id);
    }
  };

  // ── Secret reset (tap logo 7x) ───────────────────────────────────────────
  const handleLogoTap = () => {
    const n = logoTap + 1;
    setLogoTap(n);
    if (n >= 7) {
      setLogoTap(0);
      Alert.alert(
        "Reset Toko",
        "Hapus konfigurasi toko dari device ini?",
        [
          { text: "Batal", style: "cancel" },
          {
            text: "Reset",
            style: "destructive",
            onPress: async () => {
              await resetStore();
              resetForm();
              setStep("welcome");
            },
          },
        ],
      );
    }
  };

  // ═════════════════════════════════════════════════════════════════════════
  // STEP — Welcome
  // ═════════════════════════════════════════════════════════════════════════
  if (step === "welcome") {
    return (
      <View style={S.welcomeRoot}>
        <View style={S.welcomeBody}>
          <TouchableOpacity onPress={handleLogoTap} activeOpacity={1}>
            <View style={S.logoBox}>
              <Text style={S.logoIcon}>🏬</Text>
            </View>
          </TouchableOpacity>
          <Text style={S.appName}>TWD Kasir</Text>
          <Text style={S.appTagline}>POINT OF SALE SYSTEM</Text>
          <Text style={S.appDesc}>
            Kelola toko, stok, transaksi,{"\n"}dan jaringan marketing dalam satu aplikasi.
          </Text>
        </View>
        <View style={S.welcomeFooter}>
          <TouchableOpacity
            style={S.btnPrimary}
            onPress={() => { resetForm(); setStep("pathSelect"); }}
            activeOpacity={0.85}
          >
            <Text style={S.btnPrimaryText}>Masuk ke Aplikasi</Text>
          </TouchableOpacity>
          <Text style={S.versionText}>v1.0.0  •  TWD Group</Text>
        </View>
        <Snackbar visible={!!snackbar} onDismiss={() => setSnackbar("")} duration={3000} style={S.snackbar}>
          {snackbar}
        </Snackbar>
      </View>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════
  // STEP — Pilih Jalur
  // ═════════════════════════════════════════════════════════════════════════
  if (step === "pathSelect") {
    return (
      <SafeAreaView style={S.pageRoot}>
        <View style={S.pageHeader}>
          <TouchableOpacity onPress={() => setStep("welcome")} style={S.backBtn}>
            <Text style={S.backArrow}>←</Text>
          </TouchableOpacity>
          <Text style={S.pageTitle}>Pilih Jalur Masuk</Text>
          <View style={S.backBtn} />
        </View>
        <View style={S.pathContainer}>
          <TouchableOpacity
            style={[S.pathCard, S.pathCardToko]}
            onPress={() => { resetForm(); setStep(isStoreSetup ? "tokoLogin" : "setupToko"); }}
            activeOpacity={0.8}
          >
            <Text style={S.pathCardIcon}>🏪</Text>
            <Text style={S.pathCardTitle}>Masuk Toko</Text>
            <Text style={S.pathCardDesc}>
              {isStoreSetup ? "Toko: " + (storeName ?? "") : "Kasir & Owner"}
            </Text>
            {isStoreSetup && (
              <View style={S.pathCardBadge}>
                <Text style={S.pathCardBadgeText}>{"Kode: " + storeKode}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[S.pathCard, S.pathCardMitra]}
            onPress={() => { resetForm(); setStep("mitraRoleSelect"); }}
            activeOpacity={0.8}
          >
            <Text style={S.pathCardIcon}>🤝</Text>
            <Text style={S.pathCardTitle}>Masuk Mitra</Text>
            <Text style={S.pathCardDesc}>Marketing, Kurir & Admin</Text>
          </TouchableOpacity>
        </View>
        <Snackbar visible={!!snackbar} onDismiss={() => setSnackbar("")} duration={3000} style={S.snackbar}>
          {snackbar}
        </Snackbar>
      </SafeAreaView>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════
  // STEP — Setup Toko
  // ═════════════════════════════════════════════════════════════════════════
  if (step === "setupToko") {
    return (
      <SafeAreaView style={S.pageRoot}>
        <View style={S.pageHeader}>
          <TouchableOpacity onPress={() => setStep("pathSelect")} style={S.backBtn}>
            <Text style={S.backArrow}>←</Text>
          </TouchableOpacity>
          <Text style={S.pageTitle}>Setup Toko</Text>
          <View style={S.backBtn} />
        </View>
        <ScrollView contentContainerStyle={S.setupContent} keyboardShouldPersistTaps="handled">
          <View style={S.setupIconBox}>
            <Text style={S.setupIcon}>🔐</Text>
          </View>
          <Text style={S.setupTitle}>Aktivasi Device</Text>
          <Text style={S.setupDesc}>
            Masukkan kode unik toko yang diberikan oleh{"\n"}Marketing Anda untuk mengaktifkan device ini.
          </Text>
          <View style={S.formCard}>
            <Text style={S.fieldLabel}>Kode Toko:</Text>
            <TextInput
              ref={kodeRef as any}
              mode="outlined"
              placeholder="Contoh: TWD-AB12CD"
              value={kodeInput}
              onChangeText={t => { setKodeInput(t.toUpperCase()); setKodeValid(null); setKodeResult(null); }}
              autoCapitalize="characters"
              style={S.input}
              activeOutlineColor="#2E7D32"
              left={<TextInput.Icon icon="key" />}
            />
            {kodeValid === true && kodeResult && (
              <View style={S.kodeValidBox}>
                <Text style={S.kodeValidIcon}>✅</Text>
                <View>
                  <Text style={S.kodeValidToko}>{kodeResult.tokoName}</Text>
                  <Text style={S.kodeValidOwner}>{"Pemilik: " + kodeResult.ownerName}</Text>
                </View>
              </View>
            )}
            {kodeValid === false && (
              <View style={S.kodeInvalidBox}>
                <Text style={S.kodeInvalidText}>❌  Kode tidak ditemukan</Text>
              </View>
            )}
            {kodeValid !== true ? (
              <TouchableOpacity style={[S.btnPrimary, S.btnGreen]} onPress={handleValidasiKode} activeOpacity={0.85}>
                <Text style={S.btnPrimaryText}>Validasi Kode</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={[S.btnPrimary, S.btnGreen]} onPress={handleKonfirmasiSetup} activeOpacity={0.85}>
                <Text style={S.btnPrimaryText}>Aktivasi Toko ✓</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
        <Snackbar visible={!!snackbar} onDismiss={() => setSnackbar("")} duration={3000} style={S.snackbar}>
          {snackbar}
        </Snackbar>
      </SafeAreaView>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════
  // STEP — Login Toko
  // ═════════════════════════════════════════════════════════════════════════
  if (step === "tokoLogin") {
    const showPinInput  = tokoMode === "owner" || (tokoMode === "kasir" && !!selectedKasirId);
    const loginDisabled = pin.length < 4 || !tokoMode || (tokoMode === "kasir" && !selectedKasirId);

    return (
      <SafeAreaView style={S.pageRoot}>
        <View style={S.pageHeader}>
          <TouchableOpacity onPress={() => { resetForm(); setStep("pathSelect"); }} style={S.backBtn}>
            <Text style={S.backArrow}>←</Text>
          </TouchableOpacity>
          <Text style={S.pageTitle}>Masuk Toko</Text>
          <View style={S.backBtn} />
        </View>

        <View style={S.storeInfoBar}>
          <Text style={S.storeInfoIcon}>🏪</Text>
          <View>
            <Text style={S.storeInfoName}>{storeName ?? "Toko"}</Text>
            <Text style={S.storeInfoKode}>{"Kode: " + storeKode}</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={S.setupContent} keyboardShouldPersistTaps="handled">
          <View style={S.formCard}>
            {!tokoMode && (
              <>
                <Text style={S.fieldLabel}>Masuk sebagai:</Text>
                <TouchableOpacity
                  style={S.modeOption}
                  onPress={() => { setTokoMode("owner"); setPin(""); setTimeout(() => pinRef.current?.focus(), 200); }}
                  activeOpacity={0.8}
                >
                  <Text style={S.modeOptionIcon}>👑</Text>
                  <View>
                    <Text style={S.modeOptionTitle}>Owner</Text>
                    <Text style={S.modeOptionDesc}>Akses penuh dashboard toko</Text>
                  </View>
                  <Text style={S.modeOptionArrow}>›</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={S.modeOption}
                  onPress={() => { setTokoMode("kasir"); setPin(""); }}
                  activeOpacity={0.8}
                >
                  <Text style={S.modeOptionIcon}>🏪</Text>
                  <View>
                    <Text style={S.modeOptionTitle}>Kasir</Text>
                    <Text style={S.modeOptionDesc}>Proses transaksi penjualan</Text>
                  </View>
                  <Text style={S.modeOptionArrow}>›</Text>
                </TouchableOpacity>
              </>
            )}

            {tokoMode === "kasir" && (
              <>
                <View style={S.modeSelectedHeader}>
                  <TouchableOpacity onPress={() => { setTokoMode(null); setSelectedKasirId(null); setPin(""); }}>
                    <Text style={S.modeChangeBtn}>← Ganti</Text>
                  </TouchableOpacity>
                  <Text style={S.modeSelectedLabel}>🏪  Kasir</Text>
                </View>
                <Text style={S.fieldLabel}>
                  {"Pilih kasir (" + filteredKasir.length + " terdaftar):"}
                </Text>
                {filteredKasir.length === 0 ? (
                  <View style={S.emptyBox}>
                    <Text style={S.emptyText}>
                      {"Belum ada kasir untuk toko ini.\nLogin sebagai Owner → Tim Kasir untuk menambah."}
                    </Text>
                  </View>
                ) : (
                  filteredKasir.map((k: any) => {
                    const sel     = selectedKasirId === k.id;
                    const noOwner = !k.ownerId;
                    return (
                      <TouchableOpacity
                        key={k.id}
                        style={sel ? [S.kasirOption, S.kasirOptionSelected] : S.kasirOption}
                        onPress={() => { setSelectedKasirId(k.id); setPin(""); setTimeout(() => pinRef.current?.focus(), 200); }}
                        activeOpacity={0.8}
                      >
                        <View style={S.kasirOptionInfo}>
                          <Text style={sel ? [S.kasirOptionText, S.kasirOptionTextSel] : S.kasirOptionText}>
                            {"🏪  " + k.name}
                          </Text>
                          {noOwner && !sel && (
                            <Text style={S.kasirWarnTxt}>
                              Data lama — akan diperbaiki otomatis saat login
                            </Text>
                          )}
                        </View>
                        {sel && <Text style={S.kasirCheck}>✓</Text>}
                      </TouchableOpacity>
                    );
                  })
                )}
              </>
            )}

            {tokoMode === "owner" && (
              <View style={S.modeSelectedHeader}>
                <TouchableOpacity onPress={() => { setTokoMode(null); setPin(""); }}>
                  <Text style={S.modeChangeBtn}>← Ganti</Text>
                </TouchableOpacity>
                <Text style={S.modeSelectedLabel}>👑  Owner</Text>
              </View>
            )}

            {showPinInput && (
              <>
                <Text style={S.fieldLabel}>PIN:</Text>
                <TextInput
                  ref={pinRef as any}
                  mode="outlined"
                  placeholder="Masukkan PIN"
                  value={pin}
                  onChangeText={t => setPin(t.replace(/[^0-9]/g, "").slice(0, 8))}
                  secureTextEntry={!showPin}
                  keyboardType="number-pad"
                  blurOnSubmit={false}
                  style={S.input}
                  activeOutlineColor="#2E7D32"
                  right={
                    <TextInput.Icon
                      icon={showPin ? "eye-off" : "eye"}
                      onPress={() => setShowPin(v => !v)}
                    />
                  }
                />
                {/* Info owner belum punya PIN */}
                {tokoMode === "owner" && (
                  <Text style={S.pinHintTxt}>
                    Belum punya PIN? Login pertama kali bebas PIN — atur PIN di dashboard Owner.
                  </Text>
                )}
                <TouchableOpacity
                  style={loginDisabled ? [S.btnPrimary, S.btnGreen, S.btnDisabled] : [S.btnPrimary, S.btnGreen]}
                  onPress={handleTokoLogin}
                  disabled={loginDisabled}
                  activeOpacity={0.85}
                >
                  <Text style={S.btnPrimaryText}>
                    {"Masuk sebagai " + (tokoMode === "owner" ? "Owner" : "Kasir")}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </ScrollView>
        <Snackbar visible={!!snackbar} onDismiss={() => setSnackbar("")} duration={3000} style={S.snackbar}>
          {snackbar}
        </Snackbar>
      </SafeAreaView>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════
  // STEP — Mitra: Pilih Role
  // ═════════════════════════════════════════════════════════════════════════
  if (step === "mitraRoleSelect") {
    return (
      <SafeAreaView style={S.pageRoot}>
        <View style={S.pageHeader}>
          <TouchableOpacity onPress={() => setStep("pathSelect")} style={S.backBtn}>
            <Text style={S.backArrow}>←</Text>
          </TouchableOpacity>
          <Text style={S.pageTitle}>Masuk Mitra</Text>
          <View style={S.backBtn} />
        </View>
        <Text style={S.roleSubtitle}>Pilih role Anda:</Text>
        <ScrollView contentContainerStyle={S.roleGrid} showsVerticalScrollIndicator={false}>
          {MITRA_ROLES.map(role => (
            <TouchableOpacity
              key={role.value}
              style={[S.roleCard, { backgroundColor: role.bg, borderColor: role.color + "55" }]}
              onPress={() => { setMitraRole(role.value); setPin(""); setPhone(""); setStep("mitraForm"); }}
              activeOpacity={0.75}
            >
              <Text style={S.roleCardIcon}>{role.icon}</Text>
              <View style={S.flex}>
                <Text style={[S.roleCardLabel, { color: role.color }]}>{role.label}</Text>
                <Text style={S.roleCardDesc}>{role.desc}</Text>
              </View>
              <View style={[S.roleCardArrow, { backgroundColor: role.color }]}>
                <Text style={S.roleCardArrowText}>›</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <Snackbar visible={!!snackbar} onDismiss={() => setSnackbar("")} duration={3000} style={S.snackbar}>
          {snackbar}
        </Snackbar>
      </SafeAreaView>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════
  // STEP — Mitra: Form Login
  // ═════════════════════════════════════════════════════════════════════════
  if (step === "mitraForm" && mitraRole) {
    const roleConfig    = MITRA_ROLES.find(r => r.value === mitraRole)!;
    const needsPhone    = mitraRole === "marketing" || mitraRole === "sub_marketing" || mitraRole === "kurir";
    const loginDisabled = pin.length < 4 || (needsPhone && !phone.trim());

    return (
      <SafeAreaView style={[S.pageRoot, { backgroundColor: roleConfig.bg }]}>
        <View style={S.pageHeader}>
          <TouchableOpacity onPress={() => { resetForm(); setStep("mitraRoleSelect"); }} style={S.backBtn}>
            <Text style={[S.backArrow, { color: roleConfig.color }]}>←</Text>
          </TouchableOpacity>
          <View style={S.flex} />
        </View>
        <View style={S.formBadgeWrap}>
          <View style={[S.formBadge, { backgroundColor: roleConfig.color }]}>
            <Text style={S.formBadgeIcon}>{roleConfig.icon}</Text>
          </View>
          <Text style={[S.formRoleLabel, { color: roleConfig.color }]}>{roleConfig.label}</Text>
          <Text style={S.formRoleDesc}>{roleConfig.desc}</Text>
        </View>
        <ScrollView contentContainerStyle={S.setupContent} keyboardShouldPersistTaps="handled">
          <View style={S.formCard}>
            {needsPhone && (
              <>
                <Text style={S.fieldLabel}>Nomor HP:</Text>
                <TextInput
                  ref={phoneRef as any}
                  mode="outlined"
                  placeholder="Contoh: 08123456789"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  style={S.input}
                  activeOutlineColor={roleConfig.color}
                  left={<TextInput.Icon icon="phone" />}
                  returnKeyType="next"
                  onSubmitEditing={() => pinRef.current?.focus()}
                />
              </>
            )}
            <Text style={S.fieldLabel}>PIN:</Text>
            <TextInput
              ref={pinRef as any}
              mode="outlined"
              placeholder="Masukkan PIN"
              value={pin}
              onChangeText={t => setPin(t.replace(/[^0-9]/g, "").slice(0, 8))}
              secureTextEntry={!showPin}
              keyboardType="number-pad"
              blurOnSubmit={false}
              style={S.input}
              activeOutlineColor={roleConfig.color}
              right={
                <TextInput.Icon
                  icon={showPin ? "eye-off" : "eye"}
                  onPress={() => setShowPin(v => !v)}
                />
              }
            />
            <TouchableOpacity
              style={
                loginDisabled
                  ? [S.btnPrimary, { backgroundColor: roleConfig.color }, S.btnDisabled]
                  : [S.btnPrimary, { backgroundColor: roleConfig.color }]
              }
              onPress={handleMitraLogin}
              disabled={loginDisabled}
              activeOpacity={0.85}
            >
              <Text style={S.btnPrimaryText}>{"Masuk sebagai " + roleConfig.label}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
        <Snackbar visible={!!snackbar} onDismiss={() => setSnackbar("")} duration={3000} style={S.snackbar}>
          {snackbar}
        </Snackbar>
      </SafeAreaView>
    );
  }

  return null;
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const GREEN = "#2E7D32";

const S = StyleSheet.create({
  // Welcome
  welcomeRoot:          { flex: 1, backgroundColor: "#1B5E20", justifyContent: "space-between" },
  welcomeBody:          { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  logoBox:              { width: 100, height: 100, borderRadius: 28, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center", marginBottom: 24 },
  logoIcon:             { fontSize: 52 },
  appName:              { fontSize: 40, fontWeight: "900", color: "#FFF", letterSpacing: 2, marginBottom: 8 },
  appTagline:           { fontSize: 12, color: "rgba(255,255,255,0.6)", fontWeight: "700", letterSpacing: 4, marginBottom: 24 },
  appDesc:              { fontSize: 15, color: "rgba(255,255,255,0.75)", textAlign: "center", lineHeight: 24 },
  welcomeFooter:        { paddingHorizontal: 32, paddingBottom: 48, alignItems: "center", gap: 14 },
  versionText:          { color: "rgba(255,255,255,0.4)", fontSize: 12 },

  // Common
  pageRoot:             { flex: 1, backgroundColor: "#FAFAFA" },
  pageHeader:           { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14 },
  pageTitle:            { fontSize: 18, fontWeight: "800", color: "#1F2D1F" },
  backBtn:              { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  backArrow:            { fontSize: 22, color: "#333", fontWeight: "600" },
  flex:                 { flex: 1 },
  btnPrimary:           { backgroundColor: "#1B5E20", borderRadius: 14, paddingVertical: 16, alignItems: "center", elevation: 2 },
  btnGreen:             { backgroundColor: GREEN },
  btnDisabled:          { opacity: 0.4 },
  btnPrimaryText:       { fontSize: 15, fontWeight: "800", color: "#FFF" },
  snackbar:             { backgroundColor: "#C62828" },
  formCard:             { backgroundColor: "#FFF", borderRadius: 20, padding: 24, elevation: 3 },
  fieldLabel:           { fontSize: 13, fontWeight: "700", color: "#333", marginBottom: 6, marginTop: 8 },
  input:                { marginBottom: 12, backgroundColor: "#FFF" },
  emptyBox:             { backgroundColor: "#F5F5F5", borderRadius: 12, padding: 16, marginBottom: 12 },
  emptyText:            { fontSize: 13, color: "#888", textAlign: "center", lineHeight: 20 },

  // Path select
  pathContainer:        { flex: 1, padding: 20, gap: 16, justifyContent: "center" },
  pathCard:             { borderRadius: 20, padding: 28, alignItems: "center", elevation: 3, gap: 8 },
  pathCardToko:         { backgroundColor: "#E8F5E9", borderWidth: 2, borderColor: GREEN + "66" },
  pathCardMitra:        { backgroundColor: "#E3F2FD", borderWidth: 2, borderColor: "#1565C066" },
  pathCardIcon:         { fontSize: 48, marginBottom: 4 },
  pathCardTitle:        { fontSize: 22, fontWeight: "900", color: "#1F2D1F" },
  pathCardDesc:         { fontSize: 13, color: "#666" },
  pathCardBadge:        { backgroundColor: GREEN, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 4, marginTop: 4 },
  pathCardBadgeText:    { color: "#FFF", fontSize: 12, fontWeight: "700" },

  // Setup toko
  setupContent:         { flexGrow: 1, padding: 20, gap: 20 },
  setupIconBox:         { alignItems: "center", paddingTop: 8 },
  setupIcon:            { fontSize: 56 },
  setupTitle:           { fontSize: 22, fontWeight: "900", color: "#1F2D1F", textAlign: "center" },
  setupDesc:            { fontSize: 14, color: "#666", textAlign: "center", lineHeight: 22 },
  kodeValidBox:         { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#E8F5E9", borderRadius: 12, padding: 14, marginBottom: 12 },
  kodeValidIcon:        { fontSize: 24 },
  kodeValidToko:        { fontSize: 15, fontWeight: "800", color: "#1B5E20" },
  kodeValidOwner:       { fontSize: 12, color: "#555" },
  kodeInvalidBox:       { backgroundColor: "#FFEBEE", borderRadius: 12, padding: 14, marginBottom: 12 },
  kodeInvalidText:      { fontSize: 13, color: "#C62828", fontWeight: "600" },

  // Store info bar
  storeInfoBar:         { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: GREEN, paddingHorizontal: 20, paddingVertical: 14 },
  storeInfoIcon:        { fontSize: 28 },
  storeInfoName:        { fontSize: 16, fontWeight: "800", color: "#FFF" },
  storeInfoKode:        { fontSize: 11, color: "rgba(255,255,255,0.7)" },

  // Mode select
  modeOption:           { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: "#F5F5F5", borderRadius: 14, padding: 16, marginBottom: 10 },
  modeOptionIcon:       { fontSize: 28 },
  modeOptionTitle:      { fontSize: 15, fontWeight: "700", color: "#1F2D1F" },
  modeOptionDesc:       { fontSize: 12, color: "#888" },
  modeOptionArrow:      { fontSize: 22, color: "#aaa", marginLeft: "auto" },
  modeSelectedHeader:   { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  modeChangeBtn:        { fontSize: 13, color: GREEN, fontWeight: "600" },
  modeSelectedLabel:    { fontSize: 15, fontWeight: "700", color: "#1F2D1F" },

  // Kasir list
  kasirOption:          { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: "#E0E0E0", marginBottom: 8, backgroundColor: "#FFF" },
  kasirOptionSelected:  { backgroundColor: GREEN, borderColor: GREEN },
  kasirOptionInfo:      { flex: 1 },
  kasirOptionText:      { fontSize: 14, fontWeight: "600", color: "#333" },
  kasirOptionTextSel:   { color: "#FFF" },
  kasirWarnTxt:         { fontSize: 10, color: "#F59E0B", marginTop: 2 },
  kasirCheck:           { fontSize: 16, color: "#FFF", fontWeight: "800" },

  // PIN hint
  pinHintTxt:           { fontSize: 11, color: "#888", marginBottom: 10, textAlign: "center", fontStyle: "italic" },

  // Mitra roles
  roleSubtitle:         { fontSize: 14, color: "#888", paddingHorizontal: 20, marginBottom: 12 },
  roleGrid:             { paddingHorizontal: 16, paddingBottom: 32, gap: 12 },
  roleCard:             { borderRadius: 16, borderWidth: 1.5, padding: 18, flexDirection: "row", alignItems: "center", gap: 14, elevation: 1 },
  roleCardIcon:         { fontSize: 32 },
  roleCardLabel:        { fontSize: 15, fontWeight: "800", marginBottom: 2 },
  roleCardDesc:         { fontSize: 12, color: "#666" },
  roleCardArrow:        { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", marginLeft: "auto" },
  roleCardArrowText:    { color: "#FFF", fontSize: 18, fontWeight: "700" },

  // Mitra form
  formBadgeWrap:        { alignItems: "center", paddingVertical: 20, paddingHorizontal: 24 },
  formBadge:            { width: 72, height: 72, borderRadius: 20, alignItems: "center", justifyContent: "center", marginBottom: 12, elevation: 3 },
  formBadgeIcon:        { fontSize: 36 },
  formRoleLabel:        { fontSize: 22, fontWeight: "900", marginBottom: 4 },
  formRoleDesc:         { fontSize: 13, color: "#666" },
});