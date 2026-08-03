import React, { useEffect, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import {
  Appbar,
  Button,
  Card,
  Chip,
  Divider,
  Switch,
  Text,
  TextInput,
} from "react-native-paper";
import { usePaymentMethods } from "../context/PaymentMethodContext";
import { useStore } from "../context/StoreContext";

const GREEN = "#2E7D32";

type PaymentMethodId = "tunai" | "qris" | "transfer" | "gopay" | "dana";

const ALL_METHODS: {
  id:    PaymentMethodId;
  label: string;
  icon:  string;
  desc:  string;
}[] = [
  { id: "tunai",    label: "Tunai",           icon: "💵", desc: "Pembayaran cash langsung" },
  { id: "qris",     label: "QRIS",            icon: "📱", desc: "Scan QR dari semua dompet digital" },
  { id: "transfer", label: "Transfer Bank",   icon: "🏦", desc: "Transfer antar bank" },
  { id: "gopay",    label: "GoPay",           icon: "💚", desc: "Dompet digital GoPay" },
  { id: "dana",     label: "DANA",            icon: "💙", desc: "Dompet digital DANA" },
];

type Props = {
  onBack: () => void;
};

// ── Koordinat kota besar Indonesia sebagai referensi ──────────────────────────
const KOTA_REFERENSI = [
  { nama: "Jakarta",   lat: "-6.2088",  lon: "106.8456" },
  { nama: "Surabaya",  lat: "-7.2575",  lon: "112.7521" },
  { nama: "Bandung",   lat: "-6.9175",  lon: "107.6191" },
  { nama: "Medan",     lat: "3.5952",   lon: "98.6722"  },
  { nama: "Makassar",  lat: "-5.1477",  lon: "119.4327" },
  { nama: "Semarang",  lat: "-6.9932",  lon: "110.4203" },
  { nama: "Palembang", lat: "-2.9761",  lon: "104.7754" },
  { nama: "Batam",     lat: "1.0456",   lon: "104.0305" },
];

export default function PaymentSettingScreen({ onBack }: Props) {
  const { methods, updateMethod } = usePaymentMethods();
  const {
    storeName,
    ownerName,
    storeAddress,
    storePhone,
    storeLatitude,
    storeLongitude,
    updateStore,
  } = useStore();

  // ── State metode bayar ─────────────────────────────────────────────────────
  const [expandedId, setExpandedId] = useState<PaymentMethodId | null>(null);

  // ── State info toko ────────────────────────────────────────────────────────
  const [editStoreName,    setEditStoreName]    = useState(storeName    ?? "");
  const [editOwnerName,    setEditOwnerName]    = useState(ownerName    ?? "");
  const [editStoreAddress, setEditStoreAddress] = useState(storeAddress ?? "");
  const [editStorePhone,   setEditStorePhone]   = useState(storePhone   ?? "");
  const [editLat,          setEditLat]          = useState(storeLatitude  ? storeLatitude.toString()  : "");
  const [editLon,          setEditLon]          = useState(storeLongitude ? storeLongitude.toString() : "");
  const [storeSaving,      setStoreSaving]      = useState(false);
  const [showKotaRef,      setShowKotaRef]      = useState(false);

  // Sync saat context berubah
  useEffect(() => {
    setEditStoreName(storeName       ?? "");
    setEditOwnerName(ownerName       ?? "");
    setEditStoreAddress(storeAddress ?? "");
    setEditStorePhone(storePhone     ?? "");
    setEditLat(storeLatitude  ? storeLatitude.toString()  : "");
    setEditLon(storeLongitude ? storeLongitude.toString() : "");
  }, [storeName, ownerName, storeAddress, storePhone, storeLatitude, storeLongitude]);

  // ── State per metode ───────────────────────────────────────────────────────
  const [fieldValues, setFieldValues] = useState<Record<string, Record<string, string>>>(() => {
    const init: Record<string, Record<string, string>> = {};
    ALL_METHODS.forEach(m => {
      const existing = methods.find(x => x.id === m.id);
      init[m.id] = {
        accountName:   existing?.accountName   ?? "",
        accountNumber: existing?.accountNumber ?? "",
        bankName:      existing?.bankName      ?? "",
        note:          existing?.note          ?? "",
        qrisImageUri:  existing?.qrisImageUri  ?? "",
      };
    });
    return init;
  });

  // Sync fieldValues saat methods berubah dari storage
  useEffect(() => {
    setFieldValues(prev => {
      const next = { ...prev };
      ALL_METHODS.forEach(m => {
        const existing = methods.find(x => x.id === m.id);
        if (existing) {
          next[m.id] = {
            accountName:   existing.accountName   ?? "",
            accountNumber: existing.accountNumber ?? "",
            bankName:      existing.bankName       ?? "",
            note:          existing.note           ?? "",
            qrisImageUri:  existing.qrisImageUri   ?? "",
          };
        }
      });
      return next;
    });
  }, [methods]);

  const setField = (methodId: string, field: string, value: string) => {
    setFieldValues(prev => ({
      ...prev,
      [methodId]: { ...prev[methodId], [field]: value },
    }));
  };

  const isEnabled = (id: string) =>
    methods.find(m => m.id === id)?.enabled ?? false;

  const toggleMethod = async (id: PaymentMethodId) => {
    const current = methods.find(m => m.id === id);
    await updateMethod(id, { enabled: !current?.enabled });
  };

  const saveMethodDetail = async (id: PaymentMethodId) => {
    const vals = fieldValues[id];
    await updateMethod(id, {
      accountName:   vals.accountName   || undefined,
      accountNumber: vals.accountNumber || undefined,
      bankName:      vals.bankName      || undefined,
      note:          vals.note          || undefined,
      qrisImageUri:  vals.qrisImageUri  || undefined,
    });
    setExpandedId(null);
    Alert.alert("Tersimpan", "Pengaturan " + id + " berhasil disimpan.");
  };

  const handleSaveStoreInfo = async () => {
    if (!editStoreName.trim()) {
      Alert.alert("Nama Toko Kosong", "Masukkan nama toko terlebih dahulu.");
      return;
    }
    setStoreSaving(true);
    const latNum = parseFloat(editLat);
    const lonNum = parseFloat(editLon);
    await updateStore({
      storeName:      editStoreName.trim(),
      ownerName:      editOwnerName.trim()      || undefined,
      storeAddress:   editStoreAddress.trim()   || undefined,
      storePhone:     editStorePhone.trim()      || undefined,
      storeLatitude:  !isNaN(latNum) && editLat.trim() !== "" ? latNum : null,
      storeLongitude: !isNaN(lonNum) && editLon.trim() !== "" ? lonNum : null,
    } as any);
    setStoreSaving(false);
    Alert.alert("✅ Tersimpan", "Informasi toko berhasil diperbarui.");
  };

  const handlePickKota = (lat: string, lon: string, nama: string) => {
    setEditLat(lat);
    setEditLon(lon);
    setShowKotaRef(false);
    Alert.alert(
      "Referensi Dipilih",
      "Koordinat " + nama + " diisi. Sesuaikan dengan lokasi toko Anda yang lebih spesifik.",
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={S.root}>
      <Appbar.Header style={S.appbar}>
        <Appbar.BackAction color="#fff" onPress={onBack} />
        <Appbar.Content
          title="Pengaturan Toko"
          titleStyle={S.appbarTitle}
        />
      </Appbar.Header>

      <ScrollView contentContainerStyle={S.scroll}>

        {/* ════════════════════════════════════
            SEKSI 1 — INFO TOKO
        ════════════════════════════════════ */}
        <Text style={S.sectionHeader}>🏪 Informasi Toko</Text>

        <Card style={S.card} mode="outlined">
          <Card.Content>
            <TextInput
              mode="outlined" label="Nama Toko *"
              value={editStoreName} onChangeText={setEditStoreName}
              style={S.input}
            />
            <TextInput
              mode="outlined" label="Nama Pemilik"
              value={editOwnerName} onChangeText={setEditOwnerName}
              style={S.input}
            />
            <TextInput
              mode="outlined" label="Alamat Toko"
              value={editStoreAddress} onChangeText={setEditStoreAddress}
              multiline numberOfLines={2} style={S.input}
            />
            <TextInput
              mode="outlined" label="No. Telepon Toko"
              value={editStorePhone} onChangeText={setEditStorePhone}
              keyboardType="phone-pad" style={S.input}
            />
          </Card.Content>
        </Card>

        {/* ── Lokasi GPS Toko ── */}
        <Text style={S.sectionHeader}>📍 Lokasi GPS Toko</Text>

        <Card style={S.card} mode="outlined">
          <Card.Content>
            <Text style={S.locationDesc}>
              Koordinat GPS digunakan untuk memfilter customer dalam radius 10 km.
              Customer di luar radius tidak dapat memesan.
            </Text>

            <Divider style={S.divider} />

            <View style={S.coordRow}>
              <TextInput
                mode="outlined" label="Latitude"
                value={editLat} onChangeText={setEditLat}
                keyboardType="numbers-and-punctuation"
                style={S.coordInput}
                placeholder="-6.2088"
              />
              <TextInput
                mode="outlined" label="Longitude"
                value={editLon} onChangeText={setEditLon}
                keyboardType="numbers-and-punctuation"
                style={S.coordInput}
                placeholder="106.8456"
              />
            </View>

            {/* Cara dapat koordinat */}
            <View style={S.coordHintBox}>
              <Text style={S.coordHintTitle}>💡 Cara mendapatkan koordinat:</Text>
              <Text style={S.coordHintItem}>1. Buka Google Maps di HP</Text>
              <Text style={S.coordHintItem}>2. Tap & tahan lokasi toko Anda</Text>
              <Text style={S.coordHintItem}>3. Salin angka yang muncul di bawah</Text>
              <Text style={S.coordHintItem}>
                {"   Contoh: -6.2088, 106.8456"}
              </Text>
            </View>

            {/* Referensi kota besar */}
            <TouchableOpacity
              style={S.kotaRefBtn}
              onPress={() => setShowKotaRef(!showKotaRef)}
            >
              <Text style={S.kotaRefBtnText}>
                {showKotaRef ? "▲ Tutup referensi kota" : "🗺️ Pilih referensi kota besar"}
              </Text>
            </TouchableOpacity>

            {showKotaRef && (
              <View style={S.kotaRefGrid}>
                {KOTA_REFERENSI.map(kota => (
                  <TouchableOpacity
                    key={kota.nama}
                    style={S.kotaChip}
                    onPress={() => handlePickKota(kota.lat, kota.lon, kota.nama)}
                  >
                    <Text style={S.kotaChipText}>{kota.nama}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Status koordinat */}
            {editLat.trim() && editLon.trim() ? (
              <View style={S.coordStatusOk}>
                <Text style={S.coordStatusOkText}>
                  {"✅ Koordinat: " + editLat + ", " + editLon}
                </Text>
              </View>
            ) : (
              <View style={S.coordStatusEmpty}>
                <Text style={S.coordStatusEmptyText}>
                  ⚠️ Koordinat belum diisi — customer tidak akan difilter berdasarkan jarak
                </Text>
              </View>
            )}

          </Card.Content>
        </Card>

        {/* Tombol Simpan Info Toko */}
        <Button
          mode="contained" buttonColor={GREEN}
          style={S.saveStoreBtn} icon="content-save"
          loading={storeSaving}
          disabled={storeSaving}
          onPress={handleSaveStoreInfo}
        >
          Simpan Informasi Toko
        </Button>

        <Divider style={S.sectionDivider} />

        {/* ════════════════════════════════════
            SEKSI 2 — METODE PEMBAYARAN
        ════════════════════════════════════ */}
        <Text style={S.sectionHeader}>💳 Metode Pembayaran</Text>
        <Text style={S.sectionDesc}>
          Aktifkan metode yang tersedia di toko Anda. Customer dapat memilih metode yang aktif saat checkout.
        </Text>

        {/* ── Integrasi Pembayaran Otomatis (mayar.id) ── */}
        <Card style={[S.card, { borderColor: "#6366F1", borderWidth: 1.5, backgroundColor: "#F8FAFC" }]}>
          <Card.Content>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={{ backgroundColor: "#EEF2FF", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
                  <Text style={{ fontSize: 13, fontWeight: "900", color: "#4338CA" }}>{"mayar.id"}</Text>
                </View>
                <Text style={{ fontSize: 15, fontWeight: "800", color: "#1E293B" }}>
                  {"Pembayaran Otomatis"}
                </Text>
              </View>
              <View style={{ backgroundColor: "#DCFCE7", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 }}>
                <Text style={{ fontSize: 11, fontWeight: "800", color: "#15803D" }}>{"✅ TERINTEGRASI"}</Text>
              </View>
            </View>
            <Text style={{ fontSize: 12, color: "#64748B", lineHeight: 18, marginBottom: 12 }}>
              {"Menggantikan DOKU. Customer sekarang dapat checkout otomatis via QRIS, Virtual Account Bank, dan e-Wallet di halaman pembayaran Mayar.id toko Anda."}
            </Text>
            <View style={{ backgroundColor: "#fff", borderRadius: 10, padding: 10, borderWidth: 1, borderColor: "#E2E8F0" }}>
              <Text style={{ fontSize: 11, fontWeight: "700", color: "#475569" }}>{"API Key Aktif:"}</Text>
              <Text style={{ fontSize: 12, fontFamily: "monospace", color: "#2563EB", marginTop: 2 }}>
                {"mayar_live_•••••••••••••••• (Terhubung)"}
              </Text>
            </View>
          </Card.Content>
        </Card>

        {ALL_METHODS.map(method => {
          const enabled    = isEnabled(method.id);
          const isExpanded = expandedId === method.id;
          const vals       = fieldValues[method.id] ?? {};
          const needsDetail = method.id !== "tunai";

          return (
            <Card
              key={method.id}
              style={[S.methodCard, enabled && S.methodCardActive]}
              mode="outlined"
            >
              <Card.Content>

                {/* ── Toggle baris utama ── */}
                <View style={S.methodHeader}>
                  <View style={S.methodLeft}>
                    <Text style={S.methodIcon}>{method.icon}</Text>
                    <View>
                      <Text style={S.methodLabel}>{method.label}</Text>
                      <Text style={S.methodDesc}>{method.desc}</Text>
                    </View>
                  </View>
                  <Switch
                    value={enabled}
                    onValueChange={() => toggleMethod(method.id as PaymentMethodId)}
                    color={GREEN}
                  />
                </View>

                {/* ── Detail info (jika ada) ── */}
                {enabled && needsDetail && (
                  <>
                    {/* Preview info singkat */}
                    {!isExpanded && (
                      <View style={S.methodPreview}>
                        {method.id === "transfer" && (
                          <Text style={S.methodPreviewText}>
                            {vals.bankName
                              ? "🏦 " + vals.bankName + (vals.accountNumber ? " — " + vals.accountNumber : "")
                              : "⚠️ Detail rekening belum diisi"}
                          </Text>
                        )}
                        {(method.id === "qris") && (
                          <Text style={S.methodPreviewText}>
                            {vals.qrisImageUri
                              ? "✅ Foto QRIS sudah diupload"
                              : "⚠️ Foto QRIS belum diupload"}
                          </Text>
                        )}
                        {(method.id === "gopay" || method.id === "dana") && (
                          <Text style={S.methodPreviewText}>
                            {vals.accountNumber
                              ? "📱 " + vals.accountNumber
                              : "⚠️ Nomor belum diisi"}
                          </Text>
                        )}
                        <TouchableOpacity
                          style={S.editDetailBtn}
                          onPress={() => setExpandedId(method.id as PaymentMethodId)}
                        >
                          <Text style={S.editDetailBtnText}>✏️ Edit Detail</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {/* Form detail (expanded) */}
                    {isExpanded && (
                      <View style={S.detailForm}>
                        <Divider style={S.divider} />

                        {/* Transfer Bank */}
                        {method.id === "transfer" && (
                          <>
                            <TextInput
                              mode="outlined" label="Nama Bank"
                              value={vals.bankName ?? ""}
                              onChangeText={v => setField(method.id, "bankName", v)}
                              style={S.input}
                              placeholder="BCA, Mandiri, BNI, dll"
                            />
                            <TextInput
                              mode="outlined" label="Nomor Rekening"
                              value={vals.accountNumber ?? ""}
                              onChangeText={v => setField(method.id, "accountNumber", v)}
                              keyboardType="numeric" style={S.input}
                            />
                            <TextInput
                              mode="outlined" label="Nama Pemilik Rekening"
                              value={vals.accountName ?? ""}
                              onChangeText={v => setField(method.id, "accountName", v)}
                              style={S.input}
                            />
                            <TextInput
                              mode="outlined" label="Catatan (opsional)"
                              value={vals.note ?? ""}
                              onChangeText={v => setField(method.id, "note", v)}
                              style={S.input}
                              placeholder="Contoh: Konfirmasi transfer via WA"
                            />
                          </>
                        )}

                        {/* QRIS */}
                        {method.id === "qris" && (
                          <>
                            <View style={S.qrisInfoBox}>
                              <Text style={S.qrisInfoTitle}>📷 Foto QRIS Statis</Text>
                              <Text style={S.qrisInfoDesc}>
                                Masukkan URL foto QRIS toko Anda. Upload foto ke Google Drive / Imgur, lalu salin link-nya di sini.
                              </Text>
                            </View>
                            <TextInput
                              mode="outlined" label="URL Foto QRIS"
                              value={vals.qrisImageUri ?? ""}
                              onChangeText={v => setField(method.id, "qrisImageUri", v)}
                              style={S.input}
                              placeholder="https://drive.google.com/..."
                              multiline
                            />
                            <TextInput
                              mode="outlined" label="Nama Merchant QRIS"
                              value={vals.accountName ?? ""}
                              onChangeText={v => setField(method.id, "accountName", v)}
                              style={S.input}
                              placeholder="Nama toko / pemilik di QRIS"
                            />
                            <TextInput
                              mode="outlined" label="Catatan (opsional)"
                              value={vals.note ?? ""}
                              onChangeText={v => setField(method.id, "note", v)}
                              style={S.input}
                              placeholder="Contoh: Scan & konfirmasi ke kasir"
                            />
                          </>
                        )}

                        {/* GoPay / DANA */}
                        {(method.id === "gopay" || method.id === "dana") && (
                          <>
                            <TextInput
                              mode="outlined"
                              label={"Nomor " + method.label}
                              value={vals.accountNumber ?? ""}
                              onChangeText={v => setField(method.id, "accountNumber", v)}
                              keyboardType="phone-pad" style={S.input}
                              placeholder="08xxxxxxxxxx"
                            />
                            <TextInput
                              mode="outlined" label="Nama Akun"
                              value={vals.accountName ?? ""}
                              onChangeText={v => setField(method.id, "accountName", v)}
                              style={S.input}
                            />
                            <TextInput
                              mode="outlined" label="Catatan (opsional)"
                              value={vals.note ?? ""}
                              onChangeText={v => setField(method.id, "note", v)}
                              style={S.input}
                            />
                          </>
                        )}

                        {/* Tombol simpan / batal */}
                        <View style={S.detailActions}>
                          <Button
                            mode="outlined" textColor="#888"
                            style={S.detailBtn}
                            onPress={() => setExpandedId(null)}
                          >
                            Batal
                          </Button>
                          <Button
                            mode="contained" buttonColor={GREEN}
                            style={S.detailBtn}
                            onPress={() => saveMethodDetail(method.id as PaymentMethodId)}
                          >
                            Simpan
                          </Button>
                        </View>
                      </View>
                    )}
                  </>
                )}

              </Card.Content>
            </Card>
          );
        })}

        {/* Info aktif */}
        <Card style={S.summaryCard} mode="outlined">
          <Card.Content>
            <Text style={S.summaryTitle}>✅ Metode Aktif Saat Ini</Text>
            <View style={S.chipRow}>
              {methods.filter(m => m.enabled).length === 0 ? (
                <Text style={S.noMethodText}>
                  Belum ada metode pembayaran yang diaktifkan
                </Text>
              ) : (
                methods.filter(m => m.enabled).map(m => (
                  <Chip key={m.id} style={S.chip} textStyle={S.chipText}>
                    {m.icon + " " + m.label}
                  </Chip>
                ))
              )}
            </View>
          </Card.Content>
        </Card>

        <View style={S.bottomPad} />
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  root:                { flex: 1, backgroundColor: "#F7FAF7" },
  appbar:              { backgroundColor: GREEN },
  appbarTitle:         { color: "#FFF", fontWeight: "700" },
  scroll:              { padding: 16, paddingBottom: 40 },

  // Section
  sectionHeader:       { fontSize: 15, fontWeight: "800", color: "#1B5E20", marginTop: 16, marginBottom: 8 },
  sectionDesc:         { fontSize: 12, color: "#666", marginBottom: 12, lineHeight: 18 },
  sectionDivider:      { marginVertical: 20 },

  // Cards
  card:                { borderColor: "#E1EEE1", backgroundColor: "#FFF", marginBottom: 12 },
  methodCard:          { borderColor: "#E1EEE1", backgroundColor: "#FFF", marginBottom: 10 },
  methodCardActive:    { borderColor: GREEN, borderWidth: 1.5 },

  // Store form
  input:               { backgroundColor: "#FFF", marginBottom: 10 },
  divider:             { marginVertical: 12 },

  // Lokasi
  locationDesc:        { fontSize: 13, color: "#555", lineHeight: 18, marginBottom: 4 },
  coordRow:            { flexDirection: "row", gap: 10, marginBottom: 8 },
  coordInput:          { flex: 1, backgroundColor: "#FFF" },
  coordHintBox:        { backgroundColor: "#F5F5F5", borderRadius: 10, padding: 12, marginVertical: 8, gap: 3 },
  coordHintTitle:      { fontSize: 12, fontWeight: "700", color: "#333", marginBottom: 2 },
  coordHintItem:       { fontSize: 12, color: "#555" },
  kotaRefBtn:          { paddingVertical: 8, alignItems: "center" },
  kotaRefBtnText:      { fontSize: 13, color: GREEN, fontWeight: "700" },
  kotaRefGrid:         { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  kotaChip:            { backgroundColor: "#E8F5E9", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  kotaChipText:        { fontSize: 12, color: GREEN, fontWeight: "600" },
  coordStatusOk:       { backgroundColor: "#E8F5E9", borderRadius: 8, padding: 10, marginTop: 4 },
  coordStatusOkText:   { fontSize: 12, color: GREEN, fontWeight: "700" },
  coordStatusEmpty:    { backgroundColor: "#FFF3E0", borderRadius: 8, padding: 10, marginTop: 4 },
  coordStatusEmptyText:{ fontSize: 12, color: "#E65100" },

  // Simpan toko
  saveStoreBtn:        { borderRadius: 10, marginTop: 4, marginBottom: 4 },

  // Metode bayar
  methodHeader:        { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  methodLeft:          { flexDirection: "row", alignItems: "center", flex: 1, gap: 12 },
  methodIcon:          { fontSize: 26 },
  methodLabel:         { fontSize: 15, fontWeight: "700", color: "#1F2D1F" },
  methodDesc:          { fontSize: 11, color: "#888", marginTop: 1 },
  methodPreview:       { marginTop: 10, backgroundColor: "#F9FBF9", borderRadius: 8, padding: 10 },
  methodPreviewText:   { fontSize: 12, color: "#555", marginBottom: 6 },
  editDetailBtn:       { alignSelf: "flex-start" },
  editDetailBtnText:   { fontSize: 12, color: GREEN, fontWeight: "700" },
  detailForm:          { marginTop: 4 },
  detailActions:       { flexDirection: "row", gap: 10, marginTop: 4 },
  detailBtn:           { flex: 1 },

  // QRIS
  qrisInfoBox:         { backgroundColor: "#E3F2FD", borderRadius: 10, padding: 12, marginBottom: 8 },
  qrisInfoTitle:       { fontSize: 13, fontWeight: "700", color: "#1565C0", marginBottom: 4 },
  qrisInfoDesc:        { fontSize: 12, color: "#1565C0", lineHeight: 18 },

  // Summary
  summaryCard:         { borderColor: "#E1EEE1", backgroundColor: "#F9FBF9", marginTop: 8 },
  summaryTitle:        { fontSize: 13, fontWeight: "700", color: "#1B5E20", marginBottom: 10 },
  chipRow:             { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip:                { backgroundColor: "#E8F5E9" },
  chipText:            { color: GREEN, fontSize: 12, fontWeight: "600" },
  noMethodText:        { fontSize: 12, color: "#C62828" },
  bottomPad:           { height: 32 },
});