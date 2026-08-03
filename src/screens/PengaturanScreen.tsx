import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import React, { useEffect, useState } from "react";
import {
    Alert,
    Linking,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useAuth } from "../context/AuthContext";
import { useMarketing } from "../context/MarketingContext";

// ─── Constants ────────────────────────────────────────────────────────────────
const ACCENT  = "#2563EB";
const SUCCESS = "#16A34A";
const DANGER  = "#DC2626";
const ORANGE  = "#D97706";
const PURPLE  = "#7C3AED";
const GRAY    = "#64748B";

const STORE_KEY   = "@twd_store_info";
const NOTIF_KEY   = "@twd_notif_settings";
// ✅ FIX KRITIS: payment disimpan TANPA suffix ownerId
// supaya KasirScreen bisa baca dari "@twd_payment_settings" yang sama
const PAYMENT_KEY = "@twd_payment_settings";
const PIN_KEY     = "twd_owner_pin";

const FLEX_ONE = { flex: 1 } as const;

const SWITCH_TRACK_ACCENT  = { false: "#E2E8F0", true: ACCENT + "80"  } as const;
const SWITCH_TRACK_SUCCESS = { false: "#E2E8F0", true: SUCCESS + "80" } as const;
const SWITCH_TRACK_ORANGE  = { false: "#E2E8F0", true: ORANGE + "80"  } as const;

// ─── Types ────────────────────────────────────────────────────────────────────
interface StoreInfo {
  nama:        string;
  phone:       string;
  alamat:      string;
  jenisBisnis: string;
  latitude:    string;
  longitude:   string;
}

interface NotifSettings {
  stok:      boolean;
  transaksi: boolean;
  info:      boolean;
}

interface PaymentSettings {
  qrisId:       string;
  qrisMerchant: string;
  namaRekening: string;
  noRekening:   string;
  namaBank:     string;
  eWalletType:  string;
  eWalletNo:    string;
  eWalletNama:  string;
}

const BANK_LIST = [
  "BCA", "BNI", "BRI", "Mandiri", "BSI",
  "CIMB Niaga", "Danamon", "Permata", "BTN", "Lainnya",
];

const EWALLET_LIST = ["GoPay", "OVO", "DANA", "ShopeePay", "LinkAja"];

const JENIS_BISNIS_LIST = [
  "Retail / Toko Umum",
  "Kuliner / F&B",
  "Fashion & Pakaian",
  "Elektronik",
  "Kecantikan & Perawatan",
  "Apotek / Kesehatan",
  "Otomotif",
  "Lainnya",
];

// ─────────────────────────────────────────────────────────────────────────────
interface PengaturanScreenProps {
  onBack?: () => void;
}

export default function PengaturanScreen({ onBack }: PengaturanScreenProps) {
  const { user, logout }       = useAuth();
  const { ownerRegistrations } = useMarketing();

  const myId  = user?.id ?? "";
  const myReg = ownerRegistrations.find(o => o.id === myId) ?? null;

  // ── State data ────────────────────────────────────────────────────────────
  const [storeInfo, setStoreInfo] = useState<StoreInfo>({
    nama:        myReg?.tokoName    ?? "",
    phone:       myReg?.phone       ?? "",
    alamat:      myReg?.alamat      ?? "",
    jenisBisnis: myReg?.jenisBisnis ?? "",
    latitude:    "",
    longitude:   "",
  });

  const [notif, setNotif] = useState<NotifSettings>({
    stok:      true,
    transaksi: true,
    info:      true,
  });

  const [payment, setPayment] = useState<PaymentSettings>({
    qrisId: "", qrisMerchant: "", namaRekening: "",
    noRekening: "", namaBank: "BCA",
    eWalletType: "GoPay", eWalletNo: "", eWalletNama: "",
  });

  // ── Modal state ───────────────────────────────────────────────────────────
  const [showTokoEdit,    setShowTokoEdit]    = useState(false);
  const [showPayment,     setShowPayment]     = useState(false);
  const [showGantiPin,    setShowGantiPin]    = useState(false);
  const [showTentang,     setShowTentang]     = useState(false);
  const [showBankPicker,  setShowBankPicker]  = useState(false);
  const [showEWalletPick, setShowEWalletPick] = useState(false);
  const [showJenisPicker, setShowJenisPicker] = useState(false);

  // ── Edit state ────────────────────────────────────────────────────────────
  const [editToko,    setEditToko]    = useState<StoreInfo>(storeInfo);
  const [editPayment, setEditPayment] = useState<PaymentSettings>(payment);

  // ── PIN state ─────────────────────────────────────────────────────────────
  const [pinLama,       setPinLama]       = useState("");
  const [pinBaru,       setPinBaru]       = useState("");
  const [pinKonfirmasi, setPinKonfirmasi] = useState("");

  // ── GPS loading ───────────────────────────────────────────────────────────
  const [loadingGps, setLoadingGps] = useState(false);

  // ── Load data ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const [rawStore, rawNotif, rawPayment] = await Promise.all([
          // ✅ store & notif tetap pakai suffix ownerId (per-owner)
          AsyncStorage.getItem(STORE_KEY + "_" + myId),
          AsyncStorage.getItem(NOTIF_KEY + "_" + myId),
          // ✅ payment TANPA suffix — shared key yang dibaca KasirScreen
          AsyncStorage.getItem(PAYMENT_KEY),
        ]);
        if (rawStore)   setStoreInfo(JSON.parse(rawStore));
        if (rawNotif)   setNotif(JSON.parse(rawNotif));
        if (rawPayment) setPayment(JSON.parse(rawPayment));
      } catch (e) {
        console.error("PengaturanScreen load:", e);
      }
    };
    load();
  }, [myId]);

  // ── Save helpers ──────────────────────────────────────────────────────────
  const saveStoreInfo = async (data: StoreInfo) => {
    await AsyncStorage.setItem(STORE_KEY + "_" + myId, JSON.stringify(data));
    setStoreInfo(data);
  };

  const saveNotif = async (data: NotifSettings) => {
    await AsyncStorage.setItem(NOTIF_KEY + "_" + myId, JSON.stringify(data));
    setNotif(data);
  };

  // ✅ FIX: simpan payment TANPA suffix ownerId
  const savePayment = async (data: PaymentSettings) => {
    await AsyncStorage.setItem(PAYMENT_KEY, JSON.stringify(data));
    setPayment(data);
    console.log("=== savePayment ===", JSON.stringify(data));
  };

  // ── GPS ───────────────────────────────────────────────────────────────────
  const handleGetGps = async () => {
    setLoadingGps(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== "granted") {
        Alert.alert("Izin Ditolak", "Izin lokasi diperlukan untuk fitur GPS.");
        setLoadingGps(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const lat  = loc.coords.latitude.toFixed(6);
      const lng  = loc.coords.longitude.toFixed(6);

      const geo = await Location.reverseGeocodeAsync({
        latitude:  loc.coords.latitude,
        longitude: loc.coords.longitude,
      });

      let alamat = editToko.alamat;
      if (geo.length > 0) {
        const g = geo[0];
        const parts = [g.street, g.district, g.city, g.region].filter(Boolean);
        if (parts.length > 0) alamat = parts.join(", ");
      }

      setEditToko(prev => ({ ...prev, latitude: lat, longitude: lng, alamat }));
      Alert.alert("Lokasi Ditemukan", "Lat: " + lat + "\nLng: " + lng);
    } catch (e) {
      Alert.alert("Error", "Gagal mendapatkan lokasi. Coba lagi.");
    } finally {
      setLoadingGps(false);
    }
  };

  const handleOpenMaps = () => {
    const lat = editToko.latitude || storeInfo.latitude;
    const lng = editToko.longitude || storeInfo.longitude;
    if (!lat || !lng) {
      Alert.alert("Belum Ada Koordinat", "Gunakan GPS otomatis atau isi manual.");
      return;
    }
    Linking.openURL("https://maps.google.com/?q=" + lat + "," + lng);
  };

  // ── Ganti PIN ─────────────────────────────────────────────────────────────
  // ✅ FIX: verifikasi PIN lama dari storage + simpan PIN baru ke storage
  const handleGantiPin = async () => {
    if (pinBaru.length < 4) {
      Alert.alert("Error", "PIN minimal 4 digit.");
      return;
    }
    if (pinBaru !== pinKonfirmasi) {
      Alert.alert("Error", "Konfirmasi PIN tidak cocok.");
      return;
    }
    try {
      const storedPin = await AsyncStorage.getItem(PIN_KEY) ?? "1234";
      if (pinLama !== storedPin) {
        Alert.alert("Error", "PIN lama tidak sesuai.");
        return;
      }
      await AsyncStorage.setItem(PIN_KEY, pinBaru);
      Alert.alert("Berhasil ✅", "PIN berhasil diubah.", [
        {
          text: "OK",
          onPress: () => {
            setPinLama("");
            setPinBaru("");
            setPinKonfirmasi("");
            setShowGantiPin(false);
          },
        },
      ]);
    } catch (e) {
      Alert.alert("Error", "Gagal menyimpan PIN baru.");
    }
  };

  // ── Toggle notif ──────────────────────────────────────────────────────────
  const toggleNotif = (key: keyof NotifSettings, val: boolean) => {
    const updated = { ...notif, [key]: val };
    saveNotif(updated);
  };

  // ── Reset data ────────────────────────────────────────────────────────────
  const handleReset = () => {
    Alert.alert(
      "Reset Data Lokal",
      "Semua data lokal (produk, transaksi, kasir) akan dihapus. Aksi ini tidak bisa dibatalkan.",
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            await AsyncStorage.multiRemove([
              "@twd_products",
              "@twd_orders",
              "@twd_kasir_accounts",
              PAYMENT_KEY,
              STORE_KEY   + "_" + myId,
              NOTIF_KEY   + "_" + myId,
              PIN_KEY,
            ]);
            Alert.alert("Selesai", "Data lokal berhasil direset.");
          },
        },
      ],
    );
  };

  // ══════════════════════════════════════════════════════════════════════════
  return (
    <View style={S.root}>
      {/* Header */}
      <View style={S.header}>
        {onBack && (
          <TouchableOpacity onPress={onBack}>
            <Text style={S.backTxt}>← Kembali</Text>
          </TouchableOpacity>
        )}
        <View style={FLEX_ONE}>
          <Text style={S.headerTitle}>⚙️ Pengaturan</Text>
          <Text style={S.headerSub}>{storeInfo.nama || myReg?.tokoName || "Toko Saya"}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={S.scrollContent}>
        {/* ── Info Toko ── */}
        <View style={S.section}>
          <Text style={S.sectionTitle}>🏪 Info Toko</Text>
          <View style={S.infoCard}>
            <InfoRow label="Nama Toko"    value={storeInfo.nama        || "-"} />
            <InfoRow label="No. HP"       value={storeInfo.phone       || "-"} />
            <InfoRow label="Jenis Bisnis" value={storeInfo.jenisBisnis || "-"} />
            <InfoRow label="Alamat"       value={storeInfo.alamat      || "-"} last />
          </View>
          {storeInfo.latitude && storeInfo.longitude ? (
            <TouchableOpacity
              style={S.mapsBtn}
              onPress={() =>
                Linking.openURL(
                  "https://maps.google.com/?q=" + storeInfo.latitude + "," + storeInfo.longitude
                )
              }
            >
              <Text style={S.mapsBtnTxt}>
                📍 Lihat di Google Maps ({storeInfo.latitude}, {storeInfo.longitude})
              </Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={S.editBtn}
            onPress={() => { setEditToko({ ...storeInfo }); setShowTokoEdit(true); }}
          >
            <Text style={S.editBtnTxt}>✏️ Edit Info Toko</Text>
          </TouchableOpacity>
        </View>

        {/* ── Metode Pembayaran ── */}
        <View style={S.section}>
          <Text style={S.sectionTitle}>💳 Metode Pembayaran</Text>
          <View style={S.infoCard}>
            <InfoRow
              label="QRIS"
              value={payment.qrisMerchant || payment.qrisId || "Belum diset"}
            />
            <InfoRow
              label="Transfer"
              value={payment.noRekening
                ? payment.namaBank + " — " + payment.noRekening
                : "Belum diset"}
            />
            <InfoRow
              label="E-Wallet"
              value={payment.eWalletNo
                ? payment.eWalletType + " — " + payment.eWalletNo
                : "Belum diset"}
              last
            />
          </View>
          {/* ✅ Indicator bahwa payment sudah diset */}
          {(payment.qrisId || payment.noRekening || payment.eWalletNo) && (
            <View style={S.paymentActiveInfo}>
              <Text style={S.paymentActiveInfoTxt}>
                ✅ Metode pembayaran aktif akan tampil di checkout kasir
              </Text>
            </View>
          )}
          <TouchableOpacity
            style={S.editBtn}
            onPress={() => { setEditPayment({ ...payment }); setShowPayment(true); }}
          >
            <Text style={S.editBtnTxt}>✏️ Edit Metode Pembayaran</Text>
          </TouchableOpacity>
        </View>

        {/* ── Notifikasi ── */}
        <View style={S.section}>
          <Text style={S.sectionTitle}>🔔 Notifikasi</Text>
          <View style={S.infoCard}>
            <View style={S.notifRow}>
              <View style={FLEX_ONE}>
                <Text style={S.notifLabel}>Peringatan Stok Habis</Text>
                <Text style={S.notifSub}>Notifikasi saat stok produk menipis</Text>
              </View>
              <Switch
                value={notif.stok}
                onValueChange={v => toggleNotif("stok", v)}
                trackColor={SWITCH_TRACK_ACCENT}
                thumbColor={notif.stok ? ACCENT : "#fff"}
              />
            </View>
            <View style={S.notifRow}>
              <View style={FLEX_ONE}>
                <Text style={S.notifLabel}>Transaksi Baru</Text>
                <Text style={S.notifSub}>Notifikasi setiap ada transaksi masuk</Text>
              </View>
              <Switch
                value={notif.transaksi}
                onValueChange={v => toggleNotif("transaksi", v)}
                trackColor={SWITCH_TRACK_SUCCESS}
                thumbColor={notif.transaksi ? SUCCESS : "#fff"}
              />
            </View>
            <View style={[S.notifRow, S.notifRowLast]}>
              <View style={FLEX_ONE}>
                <Text style={S.notifLabel}>Info Sistem</Text>
                <Text style={S.notifSub}>Update fitur dan informasi aplikasi</Text>
              </View>
              <Switch
                value={notif.info}
                onValueChange={v => toggleNotif("info", v)}
                trackColor={SWITCH_TRACK_ORANGE}
                thumbColor={notif.info ? ORANGE : "#fff"}
              />
            </View>
          </View>
        </View>

        {/* ── Akun & Keamanan ── */}
        <View style={S.section}>
          <Text style={S.sectionTitle}>🔑 Akun & Keamanan</Text>
          <TouchableOpacity style={S.menuItem} onPress={() => setShowGantiPin(true)}>
            <Text style={S.menuItemIcon}>🔐</Text>
            <Text style={S.menuItemTxt}>Ganti PIN</Text>
            <Text style={S.menuItemChevron}>›</Text>
          </TouchableOpacity>
        </View>

        {/* ── Tentang ── */}
        <View style={S.section}>
          <Text style={S.sectionTitle}>ℹ️ Tentang Aplikasi</Text>
          <TouchableOpacity style={S.menuItem} onPress={() => setShowTentang(true)}>
            <Text style={S.menuItemIcon}>📱</Text>
            <Text style={S.menuItemTxt}>Info Versi & Aplikasi</Text>
            <Text style={S.menuItemChevron}>›</Text>
          </TouchableOpacity>
        </View>

        {/* ── Zona Berbahaya ── */}
        <View style={S.section}>
          <Text style={S.sectionTitle}>⚠️ Zona Berbahaya</Text>
          <TouchableOpacity style={S.dangerItem} onPress={handleReset}>
            <Text style={S.dangerItemIcon}>🗑️</Text>
            <Text style={S.dangerItemTxt}>Reset Data Lokal</Text>
            <Text style={S.menuItemChevron}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={S.logoutItem}
            onPress={() =>
              Alert.alert("Logout", "Yakin logout?", [
                { text: "Batal", style: "cancel" },
                { text: "Logout", style: "destructive", onPress: logout },
              ])
            }
          >
            <Text style={S.logoutItemIcon}>🚪</Text>
            <Text style={S.logoutItemTxt}>Logout</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ════ Modal: Edit Info Toko ════ */}
      <Modal
        visible={showTokoEdit}
        animationType="slide"
        onRequestClose={() => setShowTokoEdit(false)}
      >
        <View style={S.modalRoot}>
          <View style={[S.modalHeader, { backgroundColor: ACCENT }]}>
            <TouchableOpacity onPress={() => setShowTokoEdit(false)}>
              <Text style={S.modalBackTxt}>Batal</Text>
            </TouchableOpacity>
            <Text style={S.modalTitle}>Edit Info Toko</Text>
            <TouchableOpacity
              onPress={async () => {
                await saveStoreInfo(editToko);
                setShowTokoEdit(false);
                Alert.alert("Berhasil ✅", "Info toko berhasil disimpan.");
              }}
            >
              <Text style={S.modalSaveTxt}>Simpan</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={S.modalBody}>
            <InputField
              label="Nama Toko"
              value={editToko.nama}
              onChangeText={v => setEditToko(p => ({ ...p, nama: v }))}
              placeholder="Contoh: Toko Barokah"
            />
            <InputField
              label="No. HP / WhatsApp"
              value={editToko.phone}
              onChangeText={v => setEditToko(p => ({ ...p, phone: v }))}
              placeholder="08xxxxxxxxxx"
              keyboardType="phone-pad"
            />
            <Text style={S.fieldLabel}>Jenis Bisnis</Text>
            <TouchableOpacity
              style={S.pickerBtn}
              onPress={() => setShowJenisPicker(true)}
            >
              <Text style={editToko.jenisBisnis ? S.pickerBtnTxt : S.pickerBtnPlaceholder}>
                {editToko.jenisBisnis || "Pilih jenis bisnis"}
              </Text>
              <Text style={S.pickerChevron}>▾</Text>
            </TouchableOpacity>
            <InputField
              label="Alamat Lengkap"
              value={editToko.alamat}
              onChangeText={v => setEditToko(p => ({ ...p, alamat: v }))}
              placeholder="Jl. Contoh No. 1, Kota"
              multiline
            />
            <Text style={S.fieldLabel}>📍 Lokasi GPS Toko</Text>
            <TouchableOpacity
              style={[S.gpsBtn, loadingGps && S.gpsBtnLoading]}
              onPress={handleGetGps}
              disabled={loadingGps}
            >
              <Text style={S.gpsBtnTxt}>
                {loadingGps ? "🔄 Mendapatkan Lokasi..." : "📡 Ambil Lokasi Otomatis (GPS)"}
              </Text>
            </TouchableOpacity>
            <View style={S.coordRow}>
              <View style={[FLEX_ONE, { marginRight: 8 }]}>
                <InputField
                  label="Latitude"
                  value={editToko.latitude}
                  onChangeText={v => setEditToko(p => ({ ...p, latitude: v }))}
                  placeholder="-6.200000"
                  keyboardType="numbers-and-punctuation"
                />
              </View>
              <View style={FLEX_ONE}>
                <InputField
                  label="Longitude"
                  value={editToko.longitude}
                  onChangeText={v => setEditToko(p => ({ ...p, longitude: v }))}
                  placeholder="106.816666"
                  keyboardType="numbers-and-punctuation"
                />
              </View>
            </View>
            {editToko.latitude && editToko.longitude ? (
              <TouchableOpacity style={S.mapsPreviewBtn} onPress={handleOpenMaps}>
                <Text style={S.mapsPreviewTxt}>
                  🗺️ Preview Google Maps ({editToko.latitude}, {editToko.longitude})
                </Text>
              </TouchableOpacity>
            ) : null}
          </ScrollView>
        </View>
      </Modal>

      {/* ════ Modal: Jenis Bisnis Picker ════ */}
      <Modal
        visible={showJenisPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowJenisPicker(false)}
      >
        <Pressable style={S.overlay} onPress={() => setShowJenisPicker(false)}>
          <Pressable style={S.pickerSheet} onPress={() => {}}>
            <Text style={S.pickerSheetTitle}>Pilih Jenis Bisnis</Text>
            {JENIS_BISNIS_LIST.map(j => (
              <TouchableOpacity
                key={j}
                style={[S.pickerOption, editToko.jenisBisnis === j && S.pickerOptionActive]}
                onPress={() => {
                  setEditToko(p => ({ ...p, jenisBisnis: j }));
                  setShowJenisPicker(false);
                }}
              >
                <Text style={[S.pickerOptionTxt, editToko.jenisBisnis === j && S.pickerOptionTxtActive]}>
                  {j}
                </Text>
                {editToko.jenisBisnis === j && <Text>✅</Text>}
              </TouchableOpacity>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ════ Modal: Edit Pembayaran ════ */}
      <Modal
        visible={showPayment}
        animationType="slide"
        onRequestClose={() => setShowPayment(false)}
      >
        <View style={S.modalRoot}>
          <View style={[S.modalHeader, { backgroundColor: PURPLE }]}>
            <TouchableOpacity onPress={() => setShowPayment(false)}>
              <Text style={S.modalBackTxt}>Batal</Text>
            </TouchableOpacity>
            <Text style={S.modalTitle}>Metode Pembayaran</Text>
            <TouchableOpacity
              onPress={async () => {
                await savePayment(editPayment);
                setShowPayment(false);
                Alert.alert(
                  "Berhasil ✅",
                  "Metode pembayaran disimpan.\nAkan tampil di checkout kasir.",
                );
              }}
            >
              <Text style={S.modalSaveTxt}>Simpan</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={S.modalBody}>
            {/* QRIS */}
            <View style={S.paySection}>
              <Text style={S.paySectionTitle}>📱 QRIS</Text>
              <InputField
                label="QRIS ID / Merchant ID"
                value={editPayment.qrisId}
                onChangeText={v => setEditPayment(p => ({ ...p, qrisId: v }))}
                placeholder="ID dari penyedia QRIS kamu"
              />
              <InputField
                label="Nama Merchant (tampil di struk)"
                value={editPayment.qrisMerchant}
                onChangeText={v => setEditPayment(p => ({ ...p, qrisMerchant: v }))}
                placeholder="Contoh: Toko Barokah"
              />
            </View>

            {/* Transfer Bank */}
            <View style={S.paySection}>
              <Text style={S.paySectionTitle}>🏦 Transfer Bank</Text>
              <Text style={S.fieldLabel}>Bank</Text>
              <TouchableOpacity
                style={S.pickerBtn}
                onPress={() => setShowBankPicker(true)}
              >
                <Text style={S.pickerBtnTxt}>{editPayment.namaBank || "Pilih Bank"}</Text>
                <Text style={S.pickerChevron}>▾</Text>
              </TouchableOpacity>
              <InputField
                label="No. Rekening"
                value={editPayment.noRekening}
                onChangeText={v => setEditPayment(p => ({ ...p, noRekening: v }))}
                placeholder="Nomor rekening bank"
                keyboardType="number-pad"
              />
              <InputField
                label="Nama Pemilik Rekening"
                value={editPayment.namaRekening}
                onChangeText={v => setEditPayment(p => ({ ...p, namaRekening: v }))}
                placeholder="Nama sesuai rekening"
              />
            </View>

            {/* E-Wallet */}
            <View style={S.paySection}>
              <Text style={S.paySectionTitle}>💰 E-Wallet</Text>
              <Text style={S.fieldLabel}>Platform</Text>
              <TouchableOpacity
                style={S.pickerBtn}
                onPress={() => setShowEWalletPick(true)}
              >
                <Text style={S.pickerBtnTxt}>{editPayment.eWalletType || "Pilih E-Wallet"}</Text>
                <Text style={S.pickerChevron}>▾</Text>
              </TouchableOpacity>
              <InputField
                label="No. E-Wallet / No. HP"
                value={editPayment.eWalletNo}
                onChangeText={v => setEditPayment(p => ({ ...p, eWalletNo: v }))}
                placeholder="08xxxxxxxxxx"
                keyboardType="phone-pad"
              />
              <InputField
                label="Nama Pemilik"
                value={editPayment.eWalletNama}
                onChangeText={v => setEditPayment(p => ({ ...p, eWalletNama: v }))}
                placeholder="Nama pemilik akun"
              />
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* ════ Modal: Bank Picker ════ */}
      <Modal
        visible={showBankPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowBankPicker(false)}
      >
        <Pressable style={S.overlay} onPress={() => setShowBankPicker(false)}>
          <Pressable style={S.pickerSheet} onPress={() => {}}>
            <Text style={S.pickerSheetTitle}>Pilih Bank</Text>
            {BANK_LIST.map(b => (
              <TouchableOpacity
                key={b}
                style={[S.pickerOption, editPayment.namaBank === b && S.pickerOptionActive]}
                onPress={() => {
                  setEditPayment(p => ({ ...p, namaBank: b }));
                  setShowBankPicker(false);
                }}
              >
                <Text style={[S.pickerOptionTxt, editPayment.namaBank === b && S.pickerOptionTxtActive]}>
                  {b}
                </Text>
                {editPayment.namaBank === b && <Text>✅</Text>}
              </TouchableOpacity>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ════ Modal: E-Wallet Picker ════ */}
      <Modal
        visible={showEWalletPick}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEWalletPick(false)}
      >
        <Pressable style={S.overlay} onPress={() => setShowEWalletPick(false)}>
          <Pressable style={S.pickerSheet} onPress={() => {}}>
            <Text style={S.pickerSheetTitle}>Pilih E-Wallet</Text>
            {EWALLET_LIST.map(e => (
              <TouchableOpacity
                key={e}
                style={[S.pickerOption, editPayment.eWalletType === e && S.pickerOptionActive]}
                onPress={() => {
                  setEditPayment(p => ({ ...p, eWalletType: e }));
                  setShowEWalletPick(false);
                }}
              >
                <Text style={[S.pickerOptionTxt, editPayment.eWalletType === e && S.pickerOptionTxtActive]}>
                  {e}
                </Text>
                {editPayment.eWalletType === e && <Text>✅</Text>}
              </TouchableOpacity>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ════ Modal: Ganti PIN ════ */}
      <Modal
        visible={showGantiPin}
        transparent
        animationType="slide"
        onRequestClose={() => setShowGantiPin(false)}
      >
        <Pressable style={S.overlay} onPress={() => setShowGantiPin(false)}>
          <Pressable style={S.pinSheet} onPress={() => {}}>
            <Text style={S.pickerSheetTitle}>🔐 Ganti PIN</Text>
            <InputField
              label="PIN Lama"
              value={pinLama}
              onChangeText={setPinLama}
              placeholder="Masukkan PIN lama"
              secureTextEntry
              keyboardType="number-pad"
              maxLength={6}
            />
            <InputField
              label="PIN Baru"
              value={pinBaru}
              onChangeText={setPinBaru}
              placeholder="Minimal 4 digit"
              secureTextEntry
              keyboardType="number-pad"
              maxLength={6}
            />
            <InputField
              label="Konfirmasi PIN Baru"
              value={pinKonfirmasi}
              onChangeText={setPinKonfirmasi}
              placeholder="Ulangi PIN baru"
              secureTextEntry
              keyboardType="number-pad"
              maxLength={6}
            />
            {/* ✅ Hint PIN default */}
            <View style={S.pinHint}>
              <Text style={S.pinHintTxt}>
                💡 PIN default: 1234 (jika belum pernah diganti)
              </Text>
            </View>
            <View style={S.sheetActions}>
              <TouchableOpacity
                style={S.btnCancel}
                onPress={() => {
                  setPinLama(""); setPinBaru(""); setPinKonfirmasi("");
                  setShowGantiPin(false);
                }}
              >
                <Text style={S.btnCancelTxt}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[S.btnSave, { backgroundColor: ACCENT }]}
                onPress={handleGantiPin}
              >
                <Text style={S.btnSaveTxt}>Simpan PIN</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ════ Modal: Tentang Aplikasi ════ */}
      <Modal
        visible={showTentang}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTentang(false)}
      >
        <Pressable style={S.overlay} onPress={() => setShowTentang(false)}>
          <Pressable style={S.tentangSheet} onPress={() => {}}>
            <Text style={S.tentangLogo}>🏪</Text>
            <Text style={S.tentangApp}>TWD POS Mobile</Text>
            <Text style={S.tentangVersi}>Versi 1.0.0</Text>
            <View style={S.tentangDivider} />
            <InfoRow label="Platform"  value="React Native (Expo)" />
            <InfoRow label="Developer" value="TWD Tech" />
            <InfoRow label="Support"   value="support@twd.id" />
            <InfoRow label="Build"     value="2026.05" last />
            <TouchableOpacity
              style={[S.btnSave, { backgroundColor: ACCENT, marginTop: 16 }]}
              onPress={() => setShowTentang(false)}
            >
              <Text style={S.btnSaveTxt}>Tutup</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// ─── Sub-komponen ─────────────────────────────────────────────────────────────
function InfoRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[SR.row, last && SR.rowLast]}>
      <Text style={SR.label}>{label}</Text>
      <Text style={SR.value} numberOfLines={2}>{value}</Text>
    </View>
  );
}

const SR = StyleSheet.create({
  row:     { flexDirection: "row", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  rowLast: { borderBottomWidth: 0 },
  label:   { fontSize: 12, color: "#64748B", width: 110 },
  value:   { fontSize: 13, color: "#1E293B", fontWeight: "500", flex: 1 },
});

function InputField({
  label, value, onChangeText, placeholder,
  secureTextEntry, keyboardType, multiline, maxLength,
}: {
  label:            string;
  value:            string;
  onChangeText:     (v: string) => void;
  placeholder?:     string;
  secureTextEntry?: boolean;
  keyboardType?:    any;
  multiline?:       boolean;
  maxLength?:       number;
}) {
  return (
    <View style={SF.wrap}>
      <Text style={SF.label}>{label}</Text>
      <TextInput
        style={[SF.input, multiline && SF.inputMulti]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#94A3B8"
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType ?? "default"}
        multiline={multiline}
        maxLength={maxLength}
      />
    </View>
  );
}

const SF = StyleSheet.create({
  wrap:       { marginBottom: 14 },
  label:      { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 6 },
  input:      { backgroundColor: "#F8FAFC", borderRadius: 10, borderWidth: 1.5, borderColor: "#E2E8F0", paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: "#1E293B" },
  inputMulti: { minHeight: 80, textAlignVertical: "top" },
});

// ─── StyleSheet utama ─────────────────────────────────────────────────────────
const S = StyleSheet.create({
  root:               { flex: 1, backgroundColor: "#F1F5F9" },
  header:             { backgroundColor: "#475569", paddingTop: 52, paddingBottom: 14, paddingHorizontal: 20, flexDirection: "row", alignItems: "flex-end", gap: 12 },
  backTxt:            { color: "#fff", fontSize: 14, fontWeight: "600", marginBottom: 2 },
  headerTitle:        { color: "#fff", fontSize: 20, fontWeight: "800" },
  headerSub:          { color: "rgba(255,255,255,0.75)", fontSize: 12, marginTop: 2 },
  scrollContent:      { padding: 16, paddingBottom: 40 },
  section:            { marginBottom: 16 },
  sectionTitle:       { fontSize: 13, fontWeight: "700", color: "#64748B", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 },
  infoCard:           { backgroundColor: "#fff", borderRadius: 14, padding: 16, elevation: 1 },
  mapsBtn:            { backgroundColor: "#EFF6FF", borderRadius: 10, padding: 10, marginTop: 8 },
  mapsBtnTxt:         { fontSize: 12, color: ACCENT, fontWeight: "600" },
  editBtn:            { backgroundColor: "#F8FAFC", borderRadius: 10, padding: 12, alignItems: "center", marginTop: 8, borderWidth: 1, borderColor: "#E2E8F0" },
  editBtnTxt:         { fontSize: 13, fontWeight: "700", color: "#374151" },
  // ✅ Indikator payment aktif
  paymentActiveInfo:  { backgroundColor: "#F0FDF4", borderRadius: 8, padding: 10, marginTop: 6, borderWidth: 1, borderColor: "#86EFAC" },
  paymentActiveInfoTxt:{ fontSize: 12, color: "#166534", fontWeight: "600" },
  notifRow:           { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F1F5F9", gap: 12 },
  notifRowLast:       { borderBottomWidth: 0 },
  notifLabel:         { fontSize: 13, fontWeight: "600", color: "#1E293B" },
  notifSub:           { fontSize: 11, color: "#64748B", marginTop: 2 },
  menuItem:           { backgroundColor: "#fff", borderRadius: 12, padding: 14, flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 6, elevation: 1 },
  menuItemIcon:       { fontSize: 20 },
  menuItemTxt:        { flex: 1, fontSize: 14, fontWeight: "600", color: "#1E293B" },
  menuItemChevron:    { fontSize: 20, color: "#CBD5E1" },
  dangerItem:         { backgroundColor: "#FFF7ED", borderRadius: 12, padding: 14, flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 6, borderWidth: 1, borderColor: "#FED7AA" },
  dangerItemIcon:     { fontSize: 20 },
  dangerItemTxt:      { flex: 1, fontSize: 14, fontWeight: "600", color: ORANGE },
  logoutItem:         { backgroundColor: "#FEF2F2", borderRadius: 12, padding: 14, flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: "#FCA5A5" },
  logoutItemIcon:     { fontSize: 20 },
  logoutItemTxt:      { flex: 1, fontSize: 14, fontWeight: "700", color: DANGER },
  modalRoot:          { flex: 1, backgroundColor: "#F1F5F9" },
  modalHeader:        { paddingTop: 52, paddingBottom: 14, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  modalTitle:         { fontSize: 17, fontWeight: "800", color: "#fff" },
  modalBackTxt:       { color: "rgba(255,255,255,0.8)", fontSize: 14, fontWeight: "600" },
  modalSaveTxt:       { color: "#fff", fontSize: 14, fontWeight: "800" },
  modalBody:          { padding: 16, paddingBottom: 60 },
  gpsBtn:             { backgroundColor: ACCENT, borderRadius: 12, padding: 14, alignItems: "center", marginBottom: 14 },
  gpsBtnLoading:      { backgroundColor: "#93C5FD" },
  gpsBtnTxt:          { color: "#fff", fontWeight: "700", fontSize: 14 },
  coordRow:           { flexDirection: "row" },
  mapsPreviewBtn:     { backgroundColor: "#EFF6FF", borderRadius: 10, padding: 10, marginBottom: 8 },
  mapsPreviewTxt:     { fontSize: 12, color: ACCENT, fontWeight: "600", textAlign: "center" },
  pickerBtn:          { backgroundColor: "#F8FAFC", borderRadius: 10, borderWidth: 1.5, borderColor: "#E2E8F0", paddingHorizontal: 14, paddingVertical: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  pickerBtnTxt:       { fontSize: 14, color: "#1E293B", fontWeight: "500" },
  pickerBtnPlaceholder:{ fontSize: 14, color: "#94A3B8" },
  pickerChevron:      { fontSize: 14, color: "#94A3B8" },
  overlay:            { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  pickerSheet:        { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: "70%" },
  pickerSheetTitle:   { fontSize: 17, fontWeight: "800", color: "#1E293B", marginBottom: 14 },
  pickerOption:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  pickerOptionActive: { backgroundColor: "#EFF6FF", borderRadius: 8, paddingHorizontal: 8 },
  pickerOptionTxt:    { fontSize: 14, color: "#374151", fontWeight: "500" },
  pickerOptionTxtActive:{ color: ACCENT, fontWeight: "700" },
  paySection:         { backgroundColor: "#fff", borderRadius: 14, padding: 16, marginBottom: 12, elevation: 1 },
  paySectionTitle:    { fontSize: 14, fontWeight: "800", color: "#1E293B", marginBottom: 12 },
  pinSheet:           { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  // ✅ PIN hint
  pinHint:            { backgroundColor: "#FFF7ED", borderRadius: 8, padding: 10, marginBottom: 4 },
  pinHintTxt:         { fontSize: 12, color: "#92400E" },
  tentangSheet:       { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, alignItems: "center" },
  tentangLogo:        { fontSize: 56, marginBottom: 8 },
  tentangApp:         { fontSize: 22, fontWeight: "900", color: "#1E293B" },
  tentangVersi:       { fontSize: 14, color: GRAY, marginBottom: 16 },
  tentangDivider:     { width: "100%", height: 1, backgroundColor: "#E2E8F0", marginBottom: 12 },
  fieldLabel:         { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 6 },
  sheetActions:       { flexDirection: "row", gap: 12, marginTop: 16 },
  btnCancel:          { flex: 1, padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: "#CBD5E1", alignItems: "center" },
  btnCancelTxt:       { color: GRAY, fontWeight: "700" },
  btnSave:            { flex: 1, padding: 14, borderRadius: 12, alignItems: "center" },
  btnSaveTxt:         { color: "#fff", fontWeight: "800" },
});