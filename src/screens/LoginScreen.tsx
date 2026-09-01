// src/screens/LoginScreen.tsx — v8 AXIOSCLIENT FIX
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  TextInput as RNTextInput,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Checkbox, Snackbar, Text, TextInput } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import axiosClient from "../config/axiosClient"; // SUDAH DIPERBAIKI: Pakai axiosClient
import { useAuth, UserRole } from "../context/AuthContext";
import { useMarketing } from "../context/MarketingContext";
import { useStore } from "../context/StoreContext";

type MitraRole = "marketing" | "sub_marketing" | "kurir" | "super_admin";
type Step =
  | "welcome"
  | "agreement"
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
  
  const [agreeLegal,      setAgreeLegal]      = useState(false);
  const [localKasir, setLocalKasir] = useState<any[]>([]);

  const kodeRef  = useRef<RNTextInput>(null);
  const phoneRef = useRef<RNTextInput>(null);
  const pinRef   = useRef<RNTextInput>(null);

  useEffect(() => {
    if (step !== "tokoLogin") return;
    AsyncStorage.getItem("@twd_kasir_accounts").then((raw) => {
      const all = raw ? JSON.parse(raw) : [];
      setLocalKasir(all);
    });
  }, [step]);

  const currentOwner = storeKode ? findOwnerByKode(storeKode) : null;

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

  const handleValidasiKode = async () => {
    const kode = kodeInput.trim().toUpperCase();
    if (!kode) { setSnackbar("Masukkan kode toko terlebih dahulu"); return; }

    try {
      // SUDAH DIPERBAIKI: Pakai axiosClient
      const res = await axiosClient.get(`/auth/validate-kode?kode=${kode}`);
      if (res.data && res.data.status === "success") {
        setKodeValid(true);
        setKodeResult({ 
          tokoName: res.data.data.tokoName || res.data.data.name, 
          ownerName: res.data.data.name 
        });
      } else {
        setKodeValid(false);
        setSnackbar("Kode toko tidak ditemukan di server.");
      }
    } catch (err: any) {
      setKodeValid(false);
      setSnackbar("Kode toko tidak ditemukan di server.");
    }
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

      const handleTokoLogin = async () => {
    if (tokoMode === "owner") {
      try {
        // 1. Ambil data owner dari server berdasarkan kode toko
        const res = await axiosClient.get(`/auth/validate-kode?kode=${storeKode}`);
        const ownerData = res.data.data;

        if (!ownerData?.id) {
          setSnackbar("Data owner tidak ditemukan di server.");
          return;
        }

        const ownerId = ownerData.id;
        const ownerName = ownerData.name;
        const ownerEmail = ownerData.email; // Kita butuh email ini untuk login JWT

        // 2. Login ke backend untuk mendapatkan JWT Token
        try {
          const loginRes = await axiosClient.post(`/auth/login`, {
            email: ownerEmail,
            pin: pin,
            password: pin, // Backend mungkin menerima field password atau pin
          });

          const token = loginRes.data?.data?.token || loginRes.data?.token;
          
          if (token) {
            // 3. Simpan Token & ID ke AsyncStorage
            await AsyncStorage.setItem("twd_token", token);
            await AsyncStorage.setItem("twd_user_id", String(ownerId));
            await AsyncStorage.setItem("twd_owner_id", String(ownerId));
            
            // 4. Masuk ke aplikasi
            login("owner", ownerName ?? "Owner", String(ownerId));
            return;
          } else {
            setSnackbar("Login gagal. Token tidak diterima dari server.");
            return;
          }
        } catch (loginErr: any) {
          const errorMsg = loginErr.response?.data?.message || loginErr.response?.data?.error || "Gagal login, periksa PIN & koneksi internet.";
          setSnackbar(errorMsg);
          setPin("");
          return;
        }
      } catch (error: any) {
        setSnackbar("Gagal terhubung ke server. Cek koneksi internet.");
        return;
      }
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
      // Kasir mungkin tidak butuh JWT backend jika hanya pakai data lokal, tapi kita simpan owner id-nya
      await AsyncStorage.setItem("twd_owner_id", String(resolvedOwnerId));
      login("kasir", kasir.name, kasir.id, resolvedOwnerId);
    }
  };

  // ── Login Mitra (CEK KE SERVER) ──────────────────────────────────────────────
    // ── Login Mitra (CEK KE SERVER) ──────────────────────────────────────────────
  const handleMitraLogin = async () => {
    if (!mitraRole) return;
    const cleanPhone = normalizePhone(phone);
    const cleanPin   = pin.trim();

    if (mitraRole !== "super_admin" && !cleanPhone) { 
      setSnackbar("Masukkan nomor HP"); return; 
    }
    if (!cleanPin) { setSnackbar("Masukkan PIN"); return; }

    try {
      const res = await axiosClient.post(`/auth/login`, {
        phone: cleanPhone || null,
        pin: cleanPin,
        password: cleanPin, 
        role: mitraRole,
      }, { timeout: 10000 });

      // ✨ ROBUST CHECK: Tangkap berbagai format respons backend
      const isSuccess = res.data?.status === "success" || res.data?.message === "Login successful" || res.data?.message === "Login berhasil.";
      const token = res.data?.data?.token || res.data?.token;
      const userData = res.data?.data?.user || res.data?.user || res.data?.owner;

      if (isSuccess && token && userData) {
        try {
          // PENTING: Simpan Token & ID User ke AsyncStorage
          await AsyncStorage.setItem("twd_token", token);
          await AsyncStorage.setItem("twd_user_id", String(userData.id));
        } catch (storageErr) {
          console.error("Gagal menyimpan token ke AsyncStorage:", storageErr);
        }

        const roleFromDB = (userData.role || mitraRole) as UserRole;
        Alert.alert(
          "DEBUG LOGIN", 
          `Role dari Backend: ${userData.role}\nRole Mitra: ${mitraRole}\nRole Final: ${roleFromDB}`
        );
        
        login(roleFromDB, userData.name || "User", String(userData.id));
      } else {
        setSnackbar(res.data?.message || "Login gagal. Periksa kembali PIN dan No HP.");
        setPin("");
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || err.response?.data?.error || "Gagal terhubung ke server. Periksa koneksi internet.";
      setSnackbar(errorMsg);
      setPin("");
    }
  };

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
            onPress={() => { resetForm(); setStep("agreement"); }}
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

  if (step === "agreement") {
    return (
      <SafeAreaView style={S.pageRoot}>
        <View style={S.pageHeader}>
          <TouchableOpacity onPress={() => setStep("welcome")} style={S.backBtn}>
            <Text style={S.backArrow}>←</Text>
          </TouchableOpacity>
          <Text style={S.pageTitle}>Syarat & Ketentuan</Text>
          <View style={S.backBtn} />
        </View>
        
        <ScrollView contentContainerStyle={S.agreementContent}>
          <View style={S.formCard}>
            <Text style={S.agreementTitle}>Perjanjian Layanan TWD-Mobile</Text>
            <Text style={S.agreementText}>
              Selamat datang di Toko Warung Digital (TWD). Sebelum menggunakan aplikasi, mohon baca ketentuan berikut:
              {"\n\n"}
              1. Data Pribadi: Kami mengumpulkan data seperti nama, nomor HP, dan data transaksi untuk keperluan operasional aplikasi.
              {"\n\n"}
              2. Keamanan: Data Anda disimpan di server cloud yang aman. Transaksi pembayaran diproses melalui pihak ketiga tepercaya (Mayar.id).
              {"\n\n"}
              3. Tanggung Jawab: Pengguna bertanggung jawab atas keakuratan data toko, stok, dan transaksi yang dimasukkan ke dalam aplikasi.
              {"\n\n"}
              4. Pembatalan: TWD berhak menonaktifkan akun yang melanggar ketentuan layanan atau melakukan tindakan penipuan/fraud.
              {"\n\n"}
              Dengan mencentang tombol di bawah, Anda menyatakan telah membaca, memahami, dan menyetujui Syarat & Ketentuan serta Kebijakan Privasi TWD-Mobile.
            </Text>
          </View>
          
          <TouchableOpacity 
            style={S.checkboxRow} 
            onPress={() => setAgreeLegal(!agreeLegal)}
          >
            <Checkbox 
              status={agreeLegal ? 'checked' : 'unchecked'} 
              color="#2E7D32"
            />
            <Text style={S.checkboxLabel}>Saya setuju dengan syarat & ketentuan di atas</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={agreeLegal ? [S.btnPrimary, S.btnGreen] : [S.btnPrimary, S.btnGreen, S.btnDisabled]}
            disabled={!agreeLegal}
            onPress={() => setStep("pathSelect")}
            activeOpacity={0.85}
          >
            <Text style={S.btnPrimaryText}>Lanjutkan</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (step === "pathSelect") {
    return (
      <SafeAreaView style={S.pageRoot}>
        <View style={S.pageHeader}>
          <TouchableOpacity onPress={() => setStep("agreement")} style={S.backBtn}>
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

const GREEN = "#2E7D32";

const S = StyleSheet.create({
  welcomeRoot:          { flex: 1, backgroundColor: "#1B5E20", justifyContent: "space-between" },
  welcomeBody:          { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  logoBox:              { width: 100, height: 100, borderRadius: 28, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center", marginBottom: 24 },
  logoIcon:             { fontSize: 52 },
  appName:              { fontSize: 40, fontWeight: "900", color: "#FFF", letterSpacing: 2, marginBottom: 8 },
  appTagline:           { fontSize: 12, color: "rgba(255,255,255,0.6)", fontWeight: "700", letterSpacing: 4, marginBottom: 24 },
  appDesc:              { fontSize: 15, color: "rgba(255,255,255,0.75)", textAlign: "center", lineHeight: 24 },
  welcomeFooter:        { paddingHorizontal: 32, paddingBottom: 48, alignItems: "center", gap: 14 },
  versionText:          { color: "rgba(255,255,255,0.4)", fontSize: 12 },

  agreementContent:     { flexGrow: 1, padding: 20, gap: 16 },
  agreementTitle:       { fontSize: 18, fontWeight: "900", color: "#1F2D1F", marginBottom: 12, textAlign: "center" },
  agreementText:        { fontSize: 14, color: "#444", lineHeight: 22 },
  checkboxRow:          { flexDirection: "row", alignItems: "center", paddingVertical: 8 },
  checkboxLabel:        { fontSize: 14, color: "#333", flex: 1, flexWrap: 'wrap' },

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

  pathContainer:        { flex: 1, padding: 20, gap: 16, justifyContent: "center" },
  pathCard:             { borderRadius: 20, padding: 28, alignItems: "center", elevation: 3, gap: 8 },
  pathCardToko:         { backgroundColor: "#E8F5E9", borderWidth: 2, borderColor: GREEN + "66" },
  pathCardMitra:        { backgroundColor: "#E3F2FD", borderWidth: 2, borderColor: "#1565C066" },
  pathCardIcon:         { fontSize: 48, marginBottom: 4 },
  pathCardTitle:        { fontSize: 22, fontWeight: "900", color: "#1F2D1F" },
  pathCardDesc:         { fontSize: 13, color: "#666" },
  pathCardBadge:        { backgroundColor: GREEN, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 4, marginTop: 4 },
  pathCardBadgeText:    { color: "#FFF", fontSize: 12, fontWeight: "700" },

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

  storeInfoBar:         { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: GREEN, paddingHorizontal: 20, paddingVertical: 14 },
  storeInfoIcon:        { fontSize: 28 },
  storeInfoName:        { fontSize: 16, fontWeight: "800", color: "#FFF" },
  storeInfoKode:        { fontSize: 11, color: "rgba(255,255,255,0.7)" },

  modeOption:           { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: "#F5F5F5", borderRadius: 14, padding: 16, marginBottom: 10 },
  modeOptionIcon:       { fontSize: 28 },
  modeOptionTitle:      { fontSize: 15, fontWeight: "700", color: "#1F2D1F" },
  modeOptionDesc:       { fontSize: 12, color: "#888" },
  modeOptionArrow:      { fontSize: 22, color: "#aaa", marginLeft: "auto" },
  modeSelectedHeader:   { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  modeChangeBtn:        { fontSize: 13, color: GREEN, fontWeight: "600" },
  modeSelectedLabel:    { fontSize: 15, fontWeight: "700", color: "#1F2D1F" },

  kasirOption:          { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: "#E0E0E0", marginBottom: 8, backgroundColor: "#FFF" },
  kasirOptionSelected:  { backgroundColor: GREEN, borderColor: GREEN },
  kasirOptionInfo:      { flex: 1 },
  kasirOptionText:      { fontSize: 14, fontWeight: "600", color: "#333" },
  kasirOptionTextSel:   { color: "#FFF" },
  kasirWarnTxt:         { fontSize: 10, color: "#F59E0B", marginTop: 2 },
  kasirCheck:           { fontSize: 16, color: "#FFF", fontWeight: "800" },

  pinHintTxt:           { fontSize: 11, color: "#888", marginBottom: 10, textAlign: "center", fontStyle: "italic" },

  roleSubtitle:         { fontSize: 14, color: "#888", paddingHorizontal: 20, marginBottom: 12 },
  roleGrid:             { paddingHorizontal: 16, paddingBottom: 32, gap: 12 },
  roleCard:             { borderRadius: 16, borderWidth: 1.5, padding: 18, flexDirection: "row", alignItems: "center", gap: 14, elevation: 1 },
  roleCardIcon:         { fontSize: 32 },
  roleCardLabel:        { fontSize: 15, fontWeight: "800", marginBottom: 2 },
  roleCardDesc:         { fontSize: 12, color: "#666" },
  roleCardArrow:        { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", marginLeft: "auto" },
  roleCardArrowText:    { color: "#FFF", fontSize: 18, fontWeight: "700" },

  formBadgeWrap:        { alignItems: "center", paddingVertical: 20, paddingHorizontal: 24 },
  formBadge:            { width: 72, height: 72, borderRadius: 20, alignItems: "center", justifyContent: "center", marginBottom: 12, elevation: 3 },
  formBadgeIcon:        { fontSize: 36 },
  formRoleLabel:        { fontSize: 22, fontWeight: "900", marginBottom: 4 },
  formRoleDesc:         { fontSize: 13, color: "#666" },
});