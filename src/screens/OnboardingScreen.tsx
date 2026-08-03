// src/screens/OnboardingScreen.tsx — v1
// Alur: Welcome → Info Toko → PIN Owner → Pilih Paket → Tambah Kasir (opsional) → Selesai

import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Animated,
    Dimensions,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ─── Constants ────────────────────────────────────────────────────────────────

const { width: SW } = Dimensions.get("window");

const C_BG     = "#0F172A";
const C_CARD   = "#1E293B";
const C_BORDER = "#334155";
const C_TEXT   = "#F1F5F9";
const C_SUB    = "#94A3B8";
const C_ACCENT = "#38BDF8";
const C_GREEN  = "#4ADE80";
const C_ORANGE = "#FBBF24";
const C_PURPLE = "#A78BFA";

const SHADOW_DOWN = { width: 0, height: 4 };

const PAKET_LIST = [
  {
    key:      "basic",
    label:    "Basic",
    price:    "Rp 50.000/bln",
    color:    C_ACCENT,
    icon:     "🏪",
    features: ["Max 50 produk", "Max 2 kasir", "Laporan dasar", "Export PDF"],
  },
  {
    key:      "pro",
    label:    "Pro",
    price:    "Rp 150.000/bln",
    color:    C_ORANGE,
    icon:     "⭐",
    popular:  true,
    features: ["Max 200 produk", "Max 5 kasir", "Laporan lengkap", "Export PDF", "AI Assistant", "Retur owner"],
  },
  {
    key:      "enterprise",
    label:    "Enterprise",
    price:    "Rp 300.000/bln",
    color:    C_PURPLE,
    icon:     "👑",
    features: ["Produk tidak terbatas", "Kasir tidak terbatas", "Semua fitur Pro", "Prioritas support"],
  },
];

const TOTAL_STEPS = 5; // welcome, toko, pin, paket, kasir

const STEP_LABELS = ["Mulai", "Toko", "PIN", "Paket", "Kasir"];

// ─── Types ────────────────────────────────────────────────────────────────────

interface OnboardingScreenProps {
  onFinish: (ownerId: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function generateKode(): string {
  return "OWN" + Math.random().toString(36).slice(2, 6).toUpperCase();
}

function getExpiryDate(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString();
}

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: number }) {
  return (
    <View style={SI.row}>
      {STEP_LABELS.map((lbl, i) => (
        <React.Fragment key={lbl}>
          <View style={SI.item}>
            <View style={[SI.dot, i < current && SI.dotDone, i === current && SI.dotActive]}>
              {i < current
                ? <Text style={SI.dotCheck}>{"✓"}</Text>
                : <Text style={[SI.dotNum, i === current && SI.dotNumActive]}>{String(i + 1)}</Text>
              }
            </View>
            <Text style={[SI.lbl, i === current && SI.lblActive]}>{lbl}</Text>
          </View>
          {i < TOTAL_STEPS - 1 && (
            <View style={[SI.line, i < current && SI.lineDone]} />
          )}
        </React.Fragment>
      ))}
    </View>
  );
}

const SI = StyleSheet.create({
  row:          { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingHorizontal: 12, paddingVertical: 16 },
  item:         { alignItems: "center", gap: 4 },
  dot:          { width: 28, height: 28, borderRadius: 14, backgroundColor: C_BORDER, justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: C_BORDER },
  dotActive:    { borderColor: C_ACCENT, backgroundColor: C_ACCENT + "22" },
  dotDone:      { borderColor: C_GREEN, backgroundColor: C_GREEN },
  dotNum:       { fontSize: 11, color: C_SUB, fontWeight: "700" },
  dotNumActive: { color: C_ACCENT },
  dotCheck:     { fontSize: 12, color: "#0F172A", fontWeight: "900" },
  lbl:          { fontSize: 9, color: C_SUB, fontWeight: "600" },
  lblActive:    { color: C_ACCENT },
  line:         { flex: 1, height: 2, backgroundColor: C_BORDER, marginBottom: 14, marginHorizontal: 2 },
  lineDone:     { backgroundColor: C_GREEN },
});

// ─────────────────────────────────────────────────────────────────────────────
//  COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function OnboardingScreen({ onFinish }: OnboardingScreenProps) {
  const insets  = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(0)).current;

  const [step,    setStep]    = useState(0);
  const [saving,  setSaving]  = useState(false);

  // Step 1 — Info toko
  const [namaOwner, setNamaOwner] = useState("");
  const [namaToko,  setNamaToko]  = useState("");
  const [phone,     setPhone]     = useState("");

  // Step 2 — PIN
  const [pin,      setPin]      = useState("");
  const [pinKonf,  setPinKonf]  = useState("");
  const [showPin,  setShowPin]  = useState(false);

  // Step 3 — Paket
  const [paket, setPaket] = useState("basic");

  // Step 4 — Kasir pertama (opsional)
  const [addKasir,    setAddKasir]    = useState(false);
  const [kasirName,   setKasirName]   = useState("");
  const [kasirPhone,  setKasirPhone]  = useState("");
  const [kasirPin,    setKasirPin]    = useState("");

  // ── Animasi slide ──────────────────────────────────────────────────────────
  function animateTo(dir: 1 | -1, callback: () => void) {
    Animated.timing(slideAnim, {
      toValue:         dir * -SW,
      duration:        200,
      useNativeDriver: true,
    }).start(() => {
      callback();
      slideAnim.setValue(dir * SW);
      Animated.timing(slideAnim, {
        toValue:         0,
        duration:        200,
        useNativeDriver: true,
      }).start();
    });
  }

  function goNext() {
    if (!validateStep()) return;
    if (step < TOTAL_STEPS - 1) {
      animateTo(1, () => setStep((s) => s + 1));
    } else {
      handleFinish();
    }
  }

  function goBack() {
    if (step > 0) {
      animateTo(-1, () => setStep((s) => s - 1));
    }
  }

  // ── Validasi per step ──────────────────────────────────────────────────────
  function validateStep(): boolean {
    if (step === 1) {
      if (!namaOwner.trim()) { Alert.alert("Wajib diisi", "Nama pemilik harus diisi."); return false; }
      if (!namaToko.trim())  { Alert.alert("Wajib diisi", "Nama toko harus diisi."); return false; }
    }
    if (step === 2) {
      if (pin.length < 4)      { Alert.alert("PIN Terlalu Pendek", "PIN minimal 4 digit."); return false; }
      if (pin !== pinKonf)     { Alert.alert("PIN Tidak Cocok", "Konfirmasi PIN tidak sesuai."); return false; }
    }
    if (step === 4 && addKasir) {
      if (!kasirName.trim())   { Alert.alert("Wajib diisi", "Nama kasir harus diisi."); return false; }
      if (kasirPin.length < 4) { Alert.alert("PIN Terlalu Pendek", "PIN kasir minimal 4 digit."); return false; }
    }
    return true;
  }

  // ── Simpan & selesai ───────────────────────────────────────────────────────
  async function handleFinish() {
    if (!validateStep()) return;
    setSaving(true);
    try {
      const ownerId = generateId();

      // Buat owner
      const newOwner = {
        id:          ownerId,
        name:        namaOwner,
        tokoName:    namaToko,
        phone,
        pin,
        kode:        generateKode(),
        paket,
        langganan:   true,
        expiryDate:  getExpiryDate(1),
        createdAt:   new Date().toISOString(),
        suspended:   false,
      };

      const rawOwners = await AsyncStorage.getItem("@twd_owner_registrations");
      const owners    = rawOwners ? JSON.parse(rawOwners) : [];
      owners.push(newOwner);
      await AsyncStorage.setItem("@twd_owner_registrations", JSON.stringify(owners));

      // Simpan store info (untuk LaporanScreen)
      await AsyncStorage.setItem(
        "@twd_store_info_" + ownerId,
        JSON.stringify({ namaToko, ownerName: namaOwner })
      );

      // PIN owner
      await AsyncStorage.setItem("twd_owner_pin_" + ownerId, pin);

      // Buat kasir pertama jika diisi
      if (addKasir && kasirName.trim()) {
        const newKasir = {
          id:      generateId(),
          ownerId,
          name:    kasirName,
          phone:   kasirPhone,
          pin:     kasirPin,
          active:  true,
        };
        const rawKasir = await AsyncStorage.getItem("@twd_kasir_accounts");
        const kasirArr = rawKasir ? JSON.parse(rawKasir) : [];
        kasirArr.push(newKasir);
        await AsyncStorage.setItem("@twd_kasir_accounts", JSON.stringify(kasirArr));
      }

      onFinish(ownerId);
    } catch (e) {
      Alert.alert("Error", "Gagal menyimpan data. Coba lagi.");
      console.error("OnboardingScreen handleFinish:", e);
    } finally {
      setSaving(false);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  //  RENDER STEPS
  // ─────────────────────────────────────────────────────────────────────────────

  function renderStep0Welcome() {
    return (
      <View style={OS.centerStep}>
        <Text style={OS.welcomeIcon}>{"🏪"}</Text>
        <Text style={OS.welcomeTitle}>{"Selamat Datang di TWD POS"}</Text>
        <Text style={OS.welcomeDesc}>
          {"Sistem kasir modern untuk bisnis Anda.\nSetup hanya butuh 2 menit — ikuti langkah berikut."}
        </Text>
        <View style={OS.featureList}>
          {[
            "✅ Manajemen produk & stok",
            "✅ Kasir multi-user",
            "✅ Laporan penjualan lengkap",
            "✅ Export PDF otomatis",
            "✅ AI Assistant bisnis",
          ].map((f) => (
            <Text key={f} style={OS.featureItem}>{f}</Text>
          ))}
        </View>
      </View>
    );
  }

  function renderStep1Toko() {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={OS.flex}
      >
        <ScrollView contentContainerStyle={OS.formScroll} showsVerticalScrollIndicator={false}>
          <Text style={OS.stepIcon}>{"👤"}</Text>
          <Text style={OS.stepTitle}>{"Info Toko & Pemilik"}</Text>
          <Text style={OS.stepDesc}>{"Masukkan informasi dasar toko Anda."}</Text>

          <Text style={OS.label}>{"Nama Pemilik *"}</Text>
          <TextInput
            style={OS.input}
            value={namaOwner}
            onChangeText={setNamaOwner}
            placeholder={"Contoh: Budi Santoso"}
            placeholderTextColor={C_SUB}
            autoCapitalize="words"
          />

          <Text style={OS.label}>{"Nama Toko *"}</Text>
          <TextInput
            style={OS.input}
            value={namaToko}
            onChangeText={setNamaToko}
            placeholder={"Contoh: Toko Berkah Jaya"}
            placeholderTextColor={C_SUB}
            autoCapitalize="words"
          />

          <Text style={OS.label}>{"No. HP (opsional)"}</Text>
          <TextInput
            style={OS.input}
            value={phone}
            onChangeText={setPhone}
            placeholder={"08xx-xxxx-xxxx"}
            placeholderTextColor={C_SUB}
            keyboardType="phone-pad"
          />

          <View style={OS.tipBox}>
            <Text style={OS.tipTxt}>{"💡 Nama toko akan muncul di struk dan laporan PDF."}</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  function renderStep2Pin() {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={OS.flex}
      >
        <ScrollView contentContainerStyle={OS.formScroll} showsVerticalScrollIndicator={false}>
          <Text style={OS.stepIcon}>{"🔑"}</Text>
          <Text style={OS.stepTitle}>{"Buat PIN Owner"}</Text>
          <Text style={OS.stepDesc}>{"PIN digunakan untuk login sebagai pemilik toko."}</Text>

          <Text style={OS.label}>{"PIN (min 4 digit) *"}</Text>
          <View style={OS.pinRow}>
            <TextInput
              style={OS.inputPin}
              value={pin}
              onChangeText={setPin}
              placeholder={"••••"}
              placeholderTextColor={C_SUB}
              keyboardType="number-pad"
              secureTextEntry={!showPin}
              maxLength={8}
            />
            <TouchableOpacity style={OS.eyeBtn} onPress={() => setShowPin(!showPin)}>
              <Text style={OS.eyeTxt}>{showPin ? "🙈" : "👁️"}</Text>
            </TouchableOpacity>
          </View>

          <Text style={OS.label}>{"Konfirmasi PIN *"}</Text>
          <TextInput
            style={[OS.input, pinKonf.length > 0 && pin !== pinKonf && OS.inputError]}
            value={pinKonf}
            onChangeText={setPinKonf}
            placeholder={"Ulangi PIN..."}
            placeholderTextColor={C_SUB}
            keyboardType="number-pad"
            secureTextEntry={!showPin}
            maxLength={8}
          />
          {pinKonf.length > 0 && pin !== pinKonf && (
            <Text style={OS.errorTxt}>{"❌ PIN tidak cocok"}</Text>
          )}
          {pinKonf.length > 0 && pin === pinKonf && pin.length >= 4 && (
            <Text style={OS.successTxt}>{"✅ PIN cocok"}</Text>
          )}

          {/* Visual PIN strength */}
          <View style={OS.pinStrengthRow}>
            {[4, 6, 8].map((len) => (
              <View key={len} style={[OS.pinStrengthDot, pin.length >= len && OS.pinStrengthDotFill]} />
            ))}
            <Text style={OS.pinStrengthTxt}>
              {pin.length >= 8 ? "Kuat 💪" : pin.length >= 6 ? "Sedang" : pin.length >= 4 ? "Cukup" : ""}
            </Text>
          </View>

          <View style={OS.tipBox}>
            <Text style={OS.tipTxt}>{"🔒 Simpan PIN Anda di tempat yang aman. Jangan bagikan ke kasir."}</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  function renderStep3Paket() {
    return (
      <ScrollView contentContainerStyle={OS.formScroll} showsVerticalScrollIndicator={false}>
        <Text style={OS.stepIcon}>{"📦"}</Text>
        <Text style={OS.stepTitle}>{"Pilih Paket Langganan"}</Text>
        <Text style={OS.stepDesc}>{"Bisa upgrade kapan saja. Semua paket gratis 1 bulan pertama."}</Text>

        {PAKET_LIST.map((p) => (
          <TouchableOpacity
            key={p.key}
            style={[OS.paketCard, paket === p.key && { borderColor: p.color, backgroundColor: p.color + "11" }]}
            onPress={() => setPaket(p.key)}
            activeOpacity={0.85}
          >
            <View style={OS.paketTop}>
              <View style={OS.paketLeft}>
                <Text style={OS.paketIcon}>{p.icon}</Text>
                <View>
                  <View style={OS.paketTitleRow}>
                    <Text style={[OS.paketLabel, { color: p.color }]}>{p.label}</Text>
                    {p.popular && (
                      <View style={OS.popularBadge}>
                        <Text style={OS.popularTxt}>{"POPULER"}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[OS.paketPrice, { color: p.color }]}>{p.price}</Text>
                </View>
              </View>
              <View style={[OS.radioOuter, paket === p.key && { borderColor: p.color }]}>
                {paket === p.key && <View style={[OS.radioInner, { backgroundColor: p.color }]} />}
              </View>
            </View>
            <View style={OS.paketFeatures}>
              {p.features.map((f) => (
                <Text key={f} style={OS.paketFeatureTxt}>{"• " + f}</Text>
              ))}
            </View>
          </TouchableOpacity>
        ))}

        <View style={OS.tipBox}>
          <Text style={OS.tipTxt}>{"🎁 Semua paket gratis 1 bulan pertama. Tidak perlu kartu kredit."}</Text>
        </View>
      </ScrollView>
    );
  }

  function renderStep4Kasir() {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={OS.flex}
      >
        <ScrollView contentContainerStyle={OS.formScroll} showsVerticalScrollIndicator={false}>
          <Text style={OS.stepIcon}>{"💼"}</Text>
          <Text style={OS.stepTitle}>{"Tambah Kasir Pertama"}</Text>
          <Text style={OS.stepDesc}>{"Opsional — bisa ditambah nanti di pengaturan toko."}</Text>

          {/* Toggle */}
          <View style={OS.toggleRow}>
            <TouchableOpacity
              style={[OS.toggleBtn, !addKasir && OS.toggleBtnActive]}
              onPress={() => setAddKasir(false)}
            >
              <Text style={[OS.toggleBtnTxt, !addKasir && OS.toggleBtnTxtActive]}>{"⏭ Lewati"}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[OS.toggleBtn, addKasir && OS.toggleBtnActive]}
              onPress={() => setAddKasir(true)}
            >
              <Text style={[OS.toggleBtnTxt, addKasir && OS.toggleBtnTxtActive]}>{"➕ Tambah Kasir"}</Text>
            </TouchableOpacity>
          </View>

          {addKasir && (
            <View style={OS.kasirForm}>
              <Text style={OS.label}>{"Nama Kasir *"}</Text>
              <TextInput
                style={OS.input}
                value={kasirName}
                onChangeText={setKasirName}
                placeholder={"Contoh: Siti Aminah"}
                placeholderTextColor={C_SUB}
                autoCapitalize="words"
              />

              <Text style={OS.label}>{"No. HP Kasir (opsional)"}</Text>
              <TextInput
                style={OS.input}
                value={kasirPhone}
                onChangeText={setKasirPhone}
                placeholder={"08xx-xxxx-xxxx"}
                placeholderTextColor={C_SUB}
                keyboardType="phone-pad"
              />

              <Text style={OS.label}>{"PIN Kasir * (min 4 digit)"}</Text>
              <TextInput
                style={OS.input}
                value={kasirPin}
                onChangeText={setKasirPin}
                placeholder={"••••"}
                placeholderTextColor={C_SUB}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={8}
              />

              <View style={OS.tipBox}>
                <Text style={OS.tipTxt}>{"💡 Berikan PIN kasir kepada karyawan Anda. Mereka tidak bisa mengakses dashboard owner."}</Text>
              </View>
            </View>
          )}

          {!addKasir && (
            <View style={OS.skipInfo}>
              <Text style={OS.skipIcon}>{"ℹ️"}</Text>
              <Text style={OS.skipTxt}>{"Anda bisa menambah kasir kapan saja\nmelalui menu Kelola Kasir di dashboard."}</Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  //  MAIN RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  const isLastStep = step === TOTAL_STEPS - 1;
  const btnLabel   = isLastStep ? "🚀 Mulai Gunakan Aplikasi" : "Lanjut →";

  return (
    <View style={[OS.container, { paddingTop: insets.top }]}>

      {/* Progress bar */}
      <View style={OS.progressBg}>
        <Animated.View
          style={[
            OS.progressFill,
            { width: (((step + 1) / TOTAL_STEPS) * 100 + "%") as any },
          ]}
        />
      </View>

      {/* Step indicator */}
      <StepIndicator current={step} />

      {/* Content */}
      <Animated.View style={[OS.stepContainer, { transform: [{ translateX: slideAnim }] }]}>
        {step === 0 && renderStep0Welcome()}
        {step === 1 && renderStep1Toko()}
        {step === 2 && renderStep2Pin()}
        {step === 3 && renderStep3Paket()}
        {step === 4 && renderStep4Kasir()}
      </Animated.View>

      {/* Footer navigation */}
      <View style={[OS.footer, { paddingBottom: Math.max(insets.bottom + 12, 24) }]}>
        {step > 0 && (
          <TouchableOpacity style={OS.backBtn} onPress={goBack} disabled={saving}>
            <Text style={OS.backBtnTxt}>{"← Kembali"}</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[OS.nextBtn, isLastStep && OS.nextBtnFinish, saving && OS.nextBtnDisabled]}
          onPress={goNext}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving
            ? <ActivityIndicator color="#0F172A" size="small" />
            : <Text style={OS.nextBtnTxt}>{btnLabel}</Text>
          }
        </TouchableOpacity>
      </View>

    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const OS = StyleSheet.create({
  container:     { flex: 1, backgroundColor: C_BG },
  flex:          { flex: 1 },

  // Progress bar
  progressBg:    { height: 3, backgroundColor: C_BORDER },
  progressFill:  { height: 3, backgroundColor: C_ACCENT, borderRadius: 2 },

  // Step container
  stepContainer: { flex: 1 },

  // Welcome step
  centerStep:    { flex: 1, justifyContent: "center", alignItems: "center", padding: 32 },
  welcomeIcon:   { fontSize: 72, marginBottom: 20 },
  welcomeTitle:  { fontSize: 26, fontWeight: "900", color: C_TEXT, textAlign: "center", marginBottom: 12 },
  welcomeDesc:   { fontSize: 14, color: C_SUB, textAlign: "center", lineHeight: 22, marginBottom: 28 },
  featureList:   { alignSelf: "stretch", backgroundColor: C_CARD, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: C_BORDER, gap: 10 },
  featureItem:   { fontSize: 14, color: C_TEXT, lineHeight: 20 },

  // Form steps
  formScroll:    { padding: 24, paddingBottom: 40 },
  stepIcon:      { fontSize: 40, textAlign: "center", marginBottom: 12 },
  stepTitle:     { fontSize: 22, fontWeight: "900", color: C_TEXT, textAlign: "center", marginBottom: 8 },
  stepDesc:      { fontSize: 13, color: C_SUB, textAlign: "center", marginBottom: 24, lineHeight: 20 },

  // Input
  label:         { fontSize: 12, color: C_SUB, fontWeight: "700", marginBottom: 8, marginTop: 16 },
  input:         { backgroundColor: C_CARD, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, color: C_TEXT, fontSize: 15, borderWidth: 1.5, borderColor: C_BORDER },
  inputError:    { borderColor: "#F87171" },
  errorTxt:      { fontSize: 12, color: "#F87171", marginTop: 6 },
  successTxt:    { fontSize: 12, color: C_GREEN, marginTop: 6 },

  // PIN
  pinRow:        { flexDirection: "row", gap: 10, alignItems: "center" },
  inputPin:      { flex: 1, backgroundColor: C_CARD, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, color: C_TEXT, fontSize: 15, borderWidth: 1.5, borderColor: C_BORDER },
  eyeBtn:        { padding: 12 },
  eyeTxt:        { fontSize: 20 },
  pinStrengthRow:{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 },
  pinStrengthDot:{ width: 20, height: 6, borderRadius: 3, backgroundColor: C_BORDER },
  pinStrengthDotFill: { backgroundColor: C_GREEN },
  pinStrengthTxt:{ fontSize: 11, color: C_SUB },

  // Tip box
  tipBox:        { backgroundColor: "#38BDF811", borderRadius: 12, padding: 14, marginTop: 20, borderWidth: 1, borderColor: "#38BDF833" },
  tipTxt:        { fontSize: 12, color: C_ACCENT, lineHeight: 18 },

  // Paket
  paketCard:     { backgroundColor: C_CARD, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 2, borderColor: C_BORDER, elevation: 2, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: SHADOW_DOWN },
  paketTop:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  paketLeft:     { flexDirection: "row", alignItems: "center", gap: 12 },
  paketIcon:     { fontSize: 28 },
  paketTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  paketLabel:    { fontSize: 16, fontWeight: "900" },
  paketPrice:    { fontSize: 13, fontWeight: "600", marginTop: 2 },
  paketFeatures: { gap: 4 },
  paketFeatureTxt:{ fontSize: 12, color: C_SUB, lineHeight: 18 },
  popularBadge:  { backgroundColor: "#F59E0B22", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: C_ORANGE },
  popularTxt:    { fontSize: 9, color: C_ORANGE, fontWeight: "900" },
  radioOuter:    { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: C_BORDER, justifyContent: "center", alignItems: "center" },
  radioInner:    { width: 12, height: 12, borderRadius: 6 },

  // Kasir step
  toggleRow:     { flexDirection: "row", backgroundColor: C_CARD, borderRadius: 12, padding: 4, marginBottom: 20, borderWidth: 1, borderColor: C_BORDER },
  toggleBtn:     { flex: 1, paddingVertical: 12, alignItems: "center", borderRadius: 10 },
  toggleBtnActive:  { backgroundColor: C_ACCENT },
  toggleBtnTxt:     { fontSize: 13, color: C_SUB, fontWeight: "600" },
  toggleBtnTxtActive:{ color: "#0F172A", fontWeight: "800" },
  kasirForm:     { gap: 2 },
  skipInfo:      { alignItems: "center", padding: 32, gap: 12 },
  skipIcon:      { fontSize: 40 },
  skipTxt:       { fontSize: 14, color: C_SUB, textAlign: "center", lineHeight: 22 },

  // Footer
  footer:        { flexDirection: "row", gap: 12, paddingHorizontal: 24, paddingTop: 16, borderTopWidth: 1, borderTopColor: C_BORDER },
  backBtn:       { backgroundColor: C_CARD, borderRadius: 14, paddingHorizontal: 20, paddingVertical: 16, borderWidth: 1, borderColor: C_BORDER },
  backBtnTxt:    { color: C_TEXT, fontWeight: "700", fontSize: 14 },
  nextBtn:       { flex: 1, backgroundColor: C_ACCENT, borderRadius: 14, paddingVertical: 16, alignItems: "center" },
  nextBtnFinish: { backgroundColor: C_GREEN },
  nextBtnDisabled:{ opacity: 0.5 },
  nextBtnTxt:    { color: "#0F172A", fontWeight: "900", fontSize: 15 },
});