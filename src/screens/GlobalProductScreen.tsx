import { CameraView, useCameraPermissions } from "expo-camera";
import React, { useMemo, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import {
  Button,
  Card,
  Chip,
  Divider,
  Searchbar,
  Text,
  TextInput,
} from "react-native-paper";
import {
  GlobalProduct,
  useGlobalProducts,
} from "../context/GlobalProductContext";

// ─── Types ────────────────────────────────────────────────────────────────────
export type ImportDetails = {
  sellPrice: number;
  buyPrice:  number;
  stock:     number;
  stockMin:  number;
};

type Props = {
  accentColor?:         string;
  addedBy?:             string;
  addedByName?:         string;
  isAdmin?:             boolean;
  existingBarcodes?:    string[];
  onImportWithDetails?: (product: GlobalProduct, details: ImportDetails) => void;
};

// ─── Constants di luar komponen ───────────────────────────────────────────────
const KATEGORI_LIST = [
  "Makanan", "Minuman", "Snack", "Rokok",
  "Sembako", "Kebersihan", "Lainnya",
];

const BARCODE_SETTINGS = {
  barcodeTypes: ["ean13", "ean8", "code128", "code39", "qr"],
} as const;

// Tinggi navbar Android bervariasi 48–56dp, tambah buffer
const BOTTOM_BAR_PADDING = Platform.OS === "android" ? 52 : 32;

// ─── Helper style functions ───────────────────────────────────────────────────
const getChipAdaStyle      = (color: string) => [S.chipAda, { backgroundColor: color + "22" }];
const getChipAdaTextStyle  = (color: string) => [S.chipAdaText, { color }];
const getBarcodePreviewTxt = (color: string) => [S.barcodePreviewText, { color }];
const getInfoTextColored   = (color: string) => [S.infoText, { color }];

// ─────────────────────────────────────────────────────────────────────────────
export default function GlobalProductScreen({
  accentColor      = "#2E7D32",
  addedBy,
  addedByName,
  isAdmin          = false,
  existingBarcodes = [],
  onImportWithDetails,
}: Props) {
  const { globalProducts, addGlobalProduct, deleteGlobalProduct } = useGlobalProducts();

  // State
  const [searchQuery, setSearchQuery] = useState("");

  // Kamera scan import
  const [showScanCamera,     setShowScanCamera]     = useState(false);
  const [permissionScan,     requestPermissionScan] = useCameraPermissions();
  const scanClosing = useRef(false);

  // Modal import
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [selectedProduct,    setSelectedProduct]    = useState<GlobalProduct | null>(null);
  const [hargaBeli,  setHargaBeli]  = useState("");
  const [hargaJual,  setHargaJual]  = useState("");
  const [stok,       setStok]       = useState("0");
  const [stokMin,    setStokMin]    = useState("5");

  // Modal tambah katalog
  const [formVisible,   setFormVisible]   = useState(false);
  const [namaInput,     setNamaInput]     = useState("");
  const [barcodeInput,  setBarcodeInput]  = useState("");
  const [kategoriInput, setKategoriInput] = useState("Makanan");
  const [showAddCamera, setShowAddCamera] = useState(false);
  const [permissionAdd, requestPermissionAdd] = useCameraPermissions();
  const addCameraClosing = useRef(false);

  // Refs
  const hargaBeliRef = useRef<any>(null);
  const hargaJualRef = useRef<any>(null);
  const stokRef      = useRef<any>(null);
  const stokMinRef   = useRef<any>(null);
  const namaRef      = useRef<any>(null);

  // Filter
  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return globalProducts;
    return globalProducts.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.barcode  && p.barcode.includes(q)) ||
      (p.kategori && p.kategori.toLowerCase().includes(q)),
    );
  }, [globalProducts, searchQuery]);

  // ── Scan kamera import ────────────────────────────────────────────────────
  const openScanCamera = async () => {
    if (!permissionScan?.granted) {
      const r = await requestPermissionScan();
      if (!r.granted) {
        Alert.alert("Izin Kamera", "Izin kamera diperlukan untuk scan barcode.");
        return;
      }
    }
    scanClosing.current = false;
    setShowScanCamera(true);
  };

  const onScanBarcode = ({ data }: { data: string }) => {
    if (!data || scanClosing.current) return;
    scanClosing.current = true;
    setShowScanCamera(false);
    setTimeout(() => {
      scanClosing.current = false;
      const barcode = data.trim();
      const found   = globalProducts.find(p => p.barcode === barcode);
      if (!found) {
        Alert.alert(
          "Produk Tidak Ditemukan",
          "Barcode \"" + barcode + "\" belum ada di katalog global.\n\nMinta admin untuk menambahkan produk ini terlebih dahulu.",
        );
        return;
      }
      openImportModal(found);
    }, 350);
  };

  // ── Import modal ──────────────────────────────────────────────────────────
  const openImportModal = (p: GlobalProduct) => {
    const sudahAda = existingBarcodes.includes(p.barcode ?? "");
    if (sudahAda) {
      Alert.alert("Sudah Ada", "\"" + p.name + "\" sudah ada di toko Anda.");
      return;
    }
    setSelectedProduct(p);
    setHargaBeli(""); setHargaJual(""); setStok("0"); setStokMin("5");
    setImportModalVisible(true);
    setTimeout(() => hargaBeliRef.current?.focus(), 400);
  };

  const handleSimpanImport = () => {
    if (!selectedProduct) return;
    const bp = Number(hargaBeli);
    const sp = Number(hargaJual);
    const s  = Number(stok);
    const sm = Number(stokMin);
    if (!sp && sp !== 0) {
      Alert.alert("Error", "Harga jual harus diisi."); return;
    }
    onImportWithDetails?.(selectedProduct, {
      buyPrice:  bp,
      sellPrice: sp,
      stock:     s,
      stockMin:  sm || 5,
    });
    setImportModalVisible(false);
    setSelectedProduct(null);
  };

  // ── Kamera tambah katalog ─────────────────────────────────────────────────
  const openAddCamera = async () => {
    if (!permissionAdd?.granted) {
      const r = await requestPermissionAdd();
      if (!r.granted) {
        Alert.alert("Izin Kamera", "Izin kamera diperlukan."); return;
      }
    }
    addCameraClosing.current = false;
    setShowAddCamera(true);
  };

  const onAddBarcodeScan = ({ data }: { data: string }) => {
    if (!data || addCameraClosing.current) return;
    addCameraClosing.current = true;
    setShowAddCamera(false);
    setTimeout(() => {
      setBarcodeInput(data.trim());
      addCameraClosing.current = false;
      setTimeout(() => namaRef.current?.focus(), 200);
    }, 350);
  };

  const openForm = () => {
    setNamaInput(""); setBarcodeInput(""); setKategoriInput("Makanan");
    setFormVisible(true);
    setTimeout(() => openAddCamera(), 400);
  };

  const handleSimpanKatalog = () => {
    if (!namaInput.trim()) {
      Alert.alert("Error", "Nama produk wajib diisi."); return;
    }
    if (barcodeInput.trim()) {
      const dup = globalProducts.find(p => p.barcode === barcodeInput.trim());
      if (dup) {
        Alert.alert("Duplikat", "Barcode sudah dipakai oleh \"" + dup.name + "\"."); return;
      }
    }
    addGlobalProduct({
      name:        namaInput.trim(),
      barcode:     barcodeInput.trim(),
      kategori:    kategoriInput,
      addedBy:     addedBy     ?? "owner",
      addedByName: addedByName ?? "Owner",
    });
    setFormVisible(false);
    Alert.alert("Berhasil", "\"" + namaInput.trim() + "\" ditambahkan ke katalog global.");
  };

  const handleHapus = (p: GlobalProduct) => {
    Alert.alert("Hapus", "Hapus \"" + p.name + "\" dari katalog?", [
      { text: "Batal", style: "cancel" },
      { text: "Hapus", style: "destructive", onPress: () => deleteGlobalProduct(p.id) },
    ]);
  };

  // ══════════════════════════════════════════════════════════════════════════
  return (
    <View style={S.root}>

      {/* Scan Banner */}
      {onImportWithDetails && (
        <View style={S.scanBanner}>
          <View style={S.scanBannerContent}>
            <Text style={S.scanBannerTitle}>Import Produk ke Toko</Text>
            <Text style={S.scanBannerSub}>
              Scan barcode produk dari katalog global
            </Text>
          </View>
          <Button
            mode="contained"
            buttonColor="#fff"
            textColor={accentColor}
            icon="barcode-scan"
            style={S.scanBannerBtn}
            onPress={openScanCamera}
          >
            Scan
          </Button>
        </View>
      )}

      {/* Search */}
      <Searchbar
        placeholder="Cari nama, barcode, kategori..."
        value={searchQuery}
        onChangeText={setSearchQuery}
        style={S.searchbar}
        iconColor={accentColor}
      />

      <View style={S.infoRow}>
        <Text style={S.infoText}>{filtered.length + " produk di katalog"}</Text>
        <Text style={getInfoTextColored(accentColor)}>
          Sudah di toko Anda
        </Text>
      </View>

      {/* List */}
      <FlatList
        style={S.flex}
        data={filtered}
        keyExtractor={item => item.id}
        contentContainerStyle={S.list}
        ListEmptyComponent={
          <Text style={S.empty}>
            {searchQuery
              ? "Produk tidak ditemukan."
              : "Katalog masih kosong."}
          </Text>
        }
        renderItem={({ item }) => {
          const sudahAda = existingBarcodes.includes(item.barcode ?? "");
          return (
            <Card style={S.card} onPress={() => openImportModal(item)}>
              <Card.Content>
                <View style={S.cardRow}>
                  <View style={S.flex}>
                    <Text style={S.produkNama}>{item.name}</Text>
                    <View style={S.badgeRow}>
                      <Chip compact style={S.chipKat} textStyle={S.chipKatText}>
                        {item.kategori}
                      </Chip>
                      {sudahAda && (
                        <Chip
                          compact
                          style={getChipAdaStyle(accentColor)}
                          textStyle={getChipAdaTextStyle(accentColor)}
                        >
                          Sudah di toko
                        </Chip>
                      )}
                    </View>
                    {item.barcode
                      ? <Text style={S.barcodeText}>{"Barcode: " + item.barcode}</Text>
                      : <Text style={S.noBarcode}>Tanpa barcode</Text>}
                  </View>
                  <View style={S.cardActions}>
                    {onImportWithDetails && !sudahAda && (
                      <Button compact mode="contained"
                        buttonColor={accentColor} icon="download"
                        onPress={() => openImportModal(item)}>
                        Import
                      </Button>
                    )}
                    {(isAdmin || item.addedBy === addedBy) && (
                      <Button compact mode="outlined"
                        textColor="#C62828" icon="trash-can"
                        onPress={() => handleHapus(item)}>
                        Hapus
                      </Button>
                    )}
                  </View>
                </View>
              </Card.Content>
            </Card>
          );
        }}
      />

      {/* ── bottomBar — FIXED: paddingBottom pakai BOTTOM_BAR_PADDING ── */}
      <View style={S.bottomBar}>
        <Button
          mode="outlined"
          textColor={accentColor}
          icon="plus"
          style={S.addBtn}
          onPress={openForm}
        >
          Tambah Produk ke Katalog
        </Button>
      </View>

      {/* ════ Kamera Scan Import ════ */}
      <Modal visible={showScanCamera} animationType="slide">
        <View style={S.cameraContainer}>
          <CameraView
            style={S.camera}
            facing="back"
            barcodeScannerSettings={BARCODE_SETTINGS as any}
            onBarcodeScanned={onScanBarcode}
          />
          <View style={S.cameraOverlay}>
            <View style={S.scanFrame} />
            <Text style={S.cameraHint}>Arahkan ke barcode produk</Text>
            <Text style={S.cameraSubHint}>
              Nama dan kategori akan otomatis terisi
            </Text>
            <Button mode="contained" buttonColor="#C62828"
              style={S.closeCamera}
              onPress={() => setShowScanCamera(false)}>
              Tutup Kamera
            </Button>
          </View>
        </View>
      </Modal>

      {/* ════ Modal Import — Isi Harga & Stok ════ */}
      <Modal visible={importModalVisible} animationType="slide" transparent>
        <View style={S.modalOverlay}>
          <View style={S.modalCard}>
            <Text style={S.modalTitle}>Import ke Toko</Text>
            <Divider style={S.divider} />
            {selectedProduct && (
              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={S.modalScroll}
              >
                <View style={S.infoBox}>
                  <Text style={S.infoBoxLabel}>Informasi Produk (dari Katalog)</Text>
                  <View style={S.infoRow2}>
                    <Text style={S.infoKey}>Nama</Text>
                    <Text style={S.infoVal}>{selectedProduct.name}</Text>
                  </View>
                  <View style={S.infoRow2}>
                    <Text style={S.infoKey}>Kategori</Text>
                    <Text style={S.infoVal}>{selectedProduct.kategori}</Text>
                  </View>
                  {selectedProduct.barcode ? (
                    <View style={S.infoRow2}>
                      <Text style={S.infoKey}>Barcode</Text>
                      <Text style={S.infoVal}>{selectedProduct.barcode}</Text>
                    </View>
                  ) : null}
                </View>

                <View style={S.lockNote}>
                  <Text style={S.lockNoteText}>
                    Nama dan kategori tidak dapat diubah
                  </Text>
                </View>

                <Divider style={S.dividerGap} />
                <Text style={S.sectionLabel}>Atur Harga dan Stok Toko Anda</Text>

                <Text style={S.fieldLabel}>Harga Beli (Rp)</Text>
                <TextInput ref={hargaBeliRef}
                  label="Harga beli dari supplier"
                  value={hargaBeli} onChangeText={setHargaBeli}
                  keyboardType="numeric" returnKeyType="next"
                  onSubmitEditing={() => hargaJualRef.current?.focus()}
                  mode="outlined" style={S.input} />

                <Text style={S.fieldLabel}>Harga Jual (Rp) *</Text>
                <TextInput ref={hargaJualRef}
                  label="Harga jual ke pelanggan (wajib)"
                  value={hargaJual} onChangeText={setHargaJual}
                  keyboardType="numeric" returnKeyType="next"
                  onSubmitEditing={() => stokRef.current?.focus()}
                  mode="outlined" style={S.input} />

                <Text style={S.fieldLabel}>Stok Awal</Text>
                <TextInput ref={stokRef}
                  label="Jumlah stok (default 0)"
                  value={stok} onChangeText={setStok}
                  keyboardType="numeric" returnKeyType="next"
                  onSubmitEditing={() => stokMinRef.current?.focus()}
                  mode="outlined" style={S.input} />

                <Text style={S.fieldLabel}>Stok Minimum</Text>
                <Text style={S.fieldHint}>
                  Peringatan muncul saat stok lebih kecil atau sama dengan angka ini
                </Text>
                <TextInput ref={stokMinRef}
                  label="Default 5"
                  value={stokMin} onChangeText={setStokMin}
                  keyboardType="numeric" returnKeyType="done"
                  mode="outlined" style={S.input} />

                <View style={S.modalActions}>
                  <Button mode="outlined" textColor={accentColor}
                    style={S.modalBtn}
                    onPress={() => {
                      setImportModalVisible(false);
                      setSelectedProduct(null);
                    }}>
                    Batal
                  </Button>
                  <Button mode="contained" buttonColor={accentColor}
                    style={S.modalBtn} icon="check"
                    onPress={handleSimpanImport}>
                    Simpan ke Toko
                  </Button>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* ════ Kamera Tambah Katalog ════ */}
      <Modal visible={showAddCamera} animationType="slide">
        <View style={S.cameraContainer}>
          <CameraView
            style={S.camera}
            facing="back"
            barcodeScannerSettings={BARCODE_SETTINGS as any}
            onBarcodeScanned={onAddBarcodeScan}
          />
          <View style={S.cameraOverlay}>
            <View style={S.scanFrame} />
            <Text style={S.cameraHint}>Scan barcode produk baru</Text>
            <Button mode="contained" buttonColor="#C62828"
              style={S.closeCamera}
              onPress={() => setShowAddCamera(false)}>
              Tutup Kamera
            </Button>
          </View>
        </View>
      </Modal>

      {/* ════ Modal Tambah ke Katalog ════ */}
      <Modal visible={formVisible} animationType="slide" transparent>
        <View style={S.modalOverlay}>
          <View style={S.modalCard}>
            <Text style={S.modalTitle}>Tambah ke Katalog Global</Text>
            <Divider style={S.divider} />
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={S.modalScroll}
            >
              <Text style={S.fieldLabel}>Barcode</Text>
              <View style={S.barcodeRow}>
                <TextInput
                  label="Scan atau ketik barcode"
                  value={barcodeInput} onChangeText={setBarcodeInput}
                  mode="outlined" returnKeyType="next"
                  onSubmitEditing={() => namaRef.current?.focus()}
                  style={[S.input, S.barcodeInput]}
                  right={barcodeInput.length > 0
                    ? <TextInput.Icon icon="close-circle"
                        onPress={() => setBarcodeInput("")} />
                    : undefined}
                />
                <Button mode="contained" buttonColor={accentColor}
                  icon="camera" style={S.scanBtn}
                  onPress={openAddCamera}>Scan</Button>
              </View>

              {barcodeInput.length > 0 && (
                <View style={S.barcodePreview}>
                  <Text style={getBarcodePreviewTxt(accentColor)}>
                    {"Barcode: " + barcodeInput}
                  </Text>
                </View>
              )}

              <Text style={S.fieldLabel}>Nama Produk *</Text>
              <TextInput ref={namaRef}
                label="Nama produk (wajib)"
                value={namaInput} onChangeText={setNamaInput}
                mode="outlined" style={S.input} returnKeyType="done" />

              <Text style={S.fieldLabel}>Kategori</Text>
              <View style={S.kategoriWrap}>
                {KATEGORI_LIST.map(k => (
                  <Button key={k} compact
                    mode={kategoriInput === k ? "contained" : "outlined"}
                    buttonColor={kategoriInput === k ? accentColor : undefined}
                    textColor={kategoriInput === k ? "#fff" : accentColor}
                    style={S.kategoriBtn}
                    onPress={() => setKategoriInput(k)}>{k}</Button>
                ))}
              </View>

              <View style={S.modalActions}>
                <Button mode="outlined" textColor={accentColor}
                  style={S.modalBtn}
                  onPress={() => setFormVisible(false)}>Batal</Button>
                <Button mode="contained" buttonColor={accentColor}
                  style={S.modalBtn} icon="check"
                  onPress={handleSimpanKatalog}>Simpan</Button>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  root:               { flex: 1, backgroundColor: "#F5F5F5" },
  flex:               { flex: 1 },
  scanBanner:         { backgroundColor: "#2E7D32", flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  scanBannerContent:  { flex: 1 },
  scanBannerTitle:    { color: "#fff", fontSize: 15, fontWeight: "700" },
  scanBannerSub:      { color: "#C8E6C9", fontSize: 12, marginTop: 2 },
  scanBannerBtn:      { borderRadius: 10 },
  searchbar:          { margin: 12, borderRadius: 12, elevation: 2 },
  infoRow:            { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 16, marginBottom: 4 },
  infoText:           { fontSize: 12, color: "#888" },
  // List — paddingBottom besar agar item terakhir tidak tertutup bottomBar
  list:               { padding: 12, paddingBottom: 100 },
  empty:              { textAlign: "center", marginTop: 60, color: "#aaa", lineHeight: 24 },
  card:               { marginBottom: 10, borderRadius: 12, elevation: 2 },
  cardRow:            { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  produkNama:         { fontSize: 15, fontWeight: "700", color: "#1F2D1F", marginBottom: 6 },
  badgeRow:           { flexDirection: "row", gap: 6, flexWrap: "wrap", marginBottom: 4 },
  chipKat:            { backgroundColor: "#E8F5E9", borderRadius: 20 },
  chipKatText:        { fontSize: 11, color: "#2E7D32" },
  chipAda:            { borderRadius: 20 },
  chipAdaText:        { fontSize: 11, fontWeight: "700" },
  barcodeText:        { fontSize: 12, color: "#555", marginTop: 2 },
  noBarcode:          { fontSize: 12, color: "#bbb", fontStyle: "italic", marginTop: 2 },
  cardActions:        { gap: 6, justifyContent: "center" },
  // ✅ FIX UTAMA: paddingBottom pakai BOTTOM_BAR_PADDING (52 Android, 32 iOS)
  bottomBar:          { padding: 16, paddingBottom: BOTTOM_BAR_PADDING, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#E0E0E0" },
  addBtn:             { borderRadius: 10 },
  // Kamera
  cameraContainer:    { flex: 1, backgroundColor: "#000" },
  camera:             { flex: 1 },
  cameraOverlay:      { position: "absolute", bottom: 0, left: 0, right: 0, alignItems: "center", paddingBottom: 52, gap: 12 },
  scanFrame:          { width: 240, height: 240, borderWidth: 3, borderColor: "#4CAF50", borderRadius: 12, position: "absolute", top: "30%" },
  cameraHint:         { color: "#FFF", fontSize: 14, fontWeight: "700", backgroundColor: "rgba(0,0,0,0.55)", paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20 },
  cameraSubHint:      { color: "#ddd", fontSize: 12, backgroundColor: "rgba(0,0,0,0.4)", paddingHorizontal: 12, paddingVertical: 4, borderRadius: 16 },
  closeCamera:        { borderRadius: 8, minWidth: 180 },
  // Modal
  modalOverlay:       { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalCard:          { backgroundColor: "#FFF", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: "92%" },
  modalTitle:         { fontSize: 16, fontWeight: "700", color: "#1B5E20", marginBottom: 4 },
  divider:            { marginBottom: 12 },
  dividerGap:         { marginBottom: 16 },
  modalScroll:        { paddingBottom: 24 },
  infoBox:            { backgroundColor: "#F1F8E9", borderRadius: 10, padding: 12, marginBottom: 8 },
  infoBoxLabel:       { fontSize: 11, color: "#888", marginBottom: 8, fontWeight: "600" },
  infoRow2:           { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  infoKey:            { fontSize: 13, color: "#888", width: 70 },
  infoVal:            { fontSize: 14, fontWeight: "700", color: "#1B5E20", flex: 1 },
  lockNote:           { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  lockNoteText:       { fontSize: 12, color: "#888", fontStyle: "italic" },
  sectionLabel:       { fontSize: 13, fontWeight: "700", color: "#1B5E20", marginBottom: 8 },
  fieldLabel:         { fontSize: 12, fontWeight: "700", color: "#1B5E20", marginBottom: 4, marginTop: 8 },
  fieldHint:          { fontSize: 11, color: "#888", marginBottom: 4 },
  input:              { marginBottom: 4, backgroundColor: "#FFF" },
  modalActions:       { flexDirection: "row", gap: 12, marginTop: 20 },
  modalBtn:           { flex: 1 },
  barcodeRow:         { flexDirection: "row", alignItems: "center", gap: 8 },
  barcodeInput:       { flex: 1 },
  scanBtn:            { borderRadius: 8, alignSelf: "center" },
  barcodePreview:     { backgroundColor: "#E8F5E9", borderRadius: 8, padding: 8, marginBottom: 4 },
  barcodePreviewText: { fontSize: 12, fontWeight: "700" },
  kategoriWrap:       { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 },
  kategoriBtn:        { marginBottom: 0 },
});