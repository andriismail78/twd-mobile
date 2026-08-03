import { CameraView, useCameraPermissions } from "expo-camera";
import React, { useRef, useState } from "react";
import { Alert, Modal, ScrollView, StyleSheet, View } from "react-native";
import {
  Appbar, Button, Card, Divider, FAB, IconButton,
  Modal as PaperModal, Portal, Text, TextInput,
} from "react-native-paper";
import {
  KATEGORI_LIST, KategoriProduk, Product, useProducts,
} from "../context/ProductsContext";

const GREEN = "#2E7D32";

type FormState = {
  barcode:   string;
  name:      string;
  kategori:  KategoriProduk;
  buyPrice:  string;
  sellPrice: string;
  stock:     string;
  stockMin:  string;            // ✅ stok minimum
};

const EMPTY_FORM: FormState = {
  barcode:   "",
  name:      "",
  kategori:  "Lainnya",
  buyPrice:  "",
  sellPrice: "",
  stock:     "",
  stockMin:  "5",               // ✅ default 5
};

const barcodeSettings = {
  barcodeTypes: ["ean13", "ean8", "code128", "code39", "qr"],
};

export default function ProductScreen() {
  const { products, addProduct, updateProduct, deleteProduct } = useProducts();

  const [showModal, setShowModal]       = useState(false);
  const [editTarget, setEditTarget]     = useState<Product | null>(null);
  const [form, setForm]                 = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors]             = useState<Record<string, string>>({});
  const [showCategory, setShowCategory] = useState(false);
  const [showCamera, setShowCamera]     = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraClosing                   = useRef(false);

  const nameRef      = useRef<any>(null);
  const buyPriceRef  = useRef<any>(null);
  const sellPriceRef = useRef<any>(null);
  const stockRef     = useRef<any>(null);
  const stockMinRef  = useRef<any>(null);  // ✅

  const openAdd = () => {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setShowModal(true);
    setTimeout(() => openCamera(), 300);
  };

  const openEdit = (p: Product) => {
    setEditTarget(p);
    setForm({
      barcode:   p.barcode ?? "",
      name:      p.name,
      kategori:  p.kategori ?? "Lainnya",
      buyPrice:  p.buyPrice.toString(),
      sellPrice: p.sellPrice.toString(),
      stock:     p.stock.toString(),
      stockMin:  (p.stockMin ?? 5).toString(),   // ✅
    });
    setErrors({});
    setShowModal(true);
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim())
      e.name = "Nama produk wajib diisi";
    if (!form.buyPrice || isNaN(Number(form.buyPrice)) || Number(form.buyPrice) < 0)
      e.buyPrice = "Harga beli tidak valid";
    if (!form.sellPrice || isNaN(Number(form.sellPrice)) || Number(form.sellPrice) < 0)
      e.sellPrice = "Harga jual tidak valid";
    if (!form.stock || isNaN(Number(form.stock)) || Number(form.stock) < 0)
      e.stock = "Stok tidak valid";
    if (!form.stockMin || isNaN(Number(form.stockMin)) || Number(form.stockMin) < 0)
      e.stockMin = "Stok minimum tidak valid";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    const buyPrice  = Number(form.buyPrice);
    const sellPrice = Number(form.sellPrice);
    const data = {
      name:      form.name.trim(),
      kategori:  form.kategori,
      buyPrice,
      sellPrice,
      stock:     Number(form.stock),
      stockMin:  Number(form.stockMin),    // ✅
      barcode:   form.barcode.trim(),
      satuan:    "pcs",
    };
    if (editTarget) { updateProduct(editTarget.id, data); }
    else            { addProduct(data); }
    setShowModal(false);
  };

  const handleDelete = (p: Product) => {
    Alert.alert(
      "Hapus Produk",
      `Yakin ingin menghapus "${p.name}"?`,
      [
        { text: "Batal", style: "cancel" },
        { text: "Hapus", style: "destructive", onPress: () => deleteProduct(p.id) },
      ],
    );
  };

  const openCamera = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert("Izin Kamera", "Izin kamera diperlukan untuk scan barcode.");
        return;
      }
    }
    setShowCamera(true);
  };

  const onCameraScan = ({ data }: { data: string }) => {
    if (!data || cameraClosing.current) return;
    cameraClosing.current = true;
    setShowCamera(false);
    setTimeout(() => {
      setForm(f => ({ ...f, barcode: data.trim() }));
      cameraClosing.current = false;
      setTimeout(() => nameRef.current?.focus(), 200);
    }, 350);
  };

  return (
    <View style={styles.root}>
      <Appbar.Header style={styles.appbar}>
        <Appbar.Content title="Manajemen Produk" titleStyle={styles.appbarTitle} />
      </Appbar.Header>

      <ScrollView style={styles.content}>
        <Card style={styles.card} mode="outlined">
          {products.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.muted}>Belum ada produk. Tambah produk baru!</Text>
            </View>
          ) : (
            products.map((p, index) => (
              <View key={p.id}>
                {index > 0 && <Divider />}
                <View style={styles.row}>
                  <View style={styles.rowLeft}>
                    <Text style={styles.productName}>{p.name}</Text>
                    <Text style={styles.muted}>
                      {p.kategori +
                        " • Jual: Rp " + p.sellPrice.toLocaleString("id-ID") +
                        " • Beli: Rp " + p.buyPrice.toLocaleString("id-ID") +
                        " • Stok: " + p.stock +
                        " • Min: " + (p.stockMin ?? 5) +           // ✅ tampilkan stockMin
                        (p.barcode ? " • " + p.barcode : "")}
                    </Text>
                    {/* ✅ Badge peringatan stok */}
                    {p.stock === 0 && (
                      <Text style={styles.badgeHabis}>⛔ Stok Habis</Text>
                    )}
                    {p.stock > 0 && p.stock <= (p.stockMin ?? 5) && (
                      <Text style={styles.badgeMenipis}>⚠️ Stok Menipis (sisa {p.stock})</Text>
                    )}
                  </View>
                  <View style={styles.actions}>
                    <IconButton icon="pencil" iconColor={GREEN} size={20} onPress={() => openEdit(p)} />
                    <IconButton icon="trash-can" iconColor="#C62828" size={20} onPress={() => handleDelete(p)} />
                  </View>
                </View>
              </View>
            ))
          )}
        </Card>
      </ScrollView>

      <FAB icon="plus" style={styles.fab} color="#FFF" onPress={openAdd} />

      {/* Modal Kamera */}
      <Modal visible={showCamera} animationType="slide">
        <View style={styles.cameraContainer}>
          <CameraView
            style={styles.camera} facing="back"
            barcodeScannerSettings={barcodeSettings as any}
            onBarcodeScanned={onCameraScan}
          />
          <View style={styles.cameraOverlay}>
            <View style={styles.scanFrame} />
            <Text style={styles.cameraHint}>Arahkan kamera ke barcode produk</Text>
            <Button mode="contained" buttonColor="#C62828"
              style={styles.closeCamera} onPress={() => setShowCamera(false)}>
              Tutup Kamera
            </Button>
          </View>
        </View>
      </Modal>

      {/* Modal Kategori */}
      <Portal>
        <PaperModal
          visible={showCategory}
          onDismiss={() => setShowCategory(false)}
          contentContainerStyle={styles.categoryModal}
        >
          <Text style={styles.modalTitle}>Pilih Kategori</Text>
          <Divider style={styles.divider} />
          {KATEGORI_LIST.map(kat => (
            <Button
              key={kat}
              mode={form.kategori === kat ? "contained" : "text"}
              buttonColor={form.kategori === kat ? GREEN : undefined}
              textColor={form.kategori === kat ? "#FFF" : GREEN}
              style={styles.categoryItem}
              onPress={() => { setForm(f => ({ ...f, kategori: kat })); setShowCategory(false); }}
            >
              {kat}
            </Button>
          ))}
        </PaperModal>
      </Portal>

      {/* Modal Tambah/Edit Produk */}
      <Portal>
        <PaperModal
          visible={showModal}
          onDismiss={() => setShowModal(false)}
          contentContainerStyle={styles.modalContainer}
        >
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.modalTitle}>
              {editTarget ? "Edit Produk" : "Tambah Produk"}
            </Text>
            <Divider style={styles.divider} />

            {/* ① BARCODE */}
            <Text style={styles.fieldLabel}>① Barcode</Text>
            <View style={styles.barcodeRow}>
              <TextInput
                mode="outlined" label="Ketuk 📷 atau scan barcode"
                value={form.barcode}
                onChangeText={v => setForm(f => ({ ...f, barcode: v }))}
                returnKeyType="next"
                onSubmitEditing={() => nameRef.current?.focus()}
                style={[styles.input, styles.barcodeInput]}
                right={form.barcode.length > 0
                  ? <TextInput.Icon icon="close-circle" onPress={() => setForm(f => ({ ...f, barcode: "" }))} />
                  : undefined}
              />
              <IconButton
                icon="camera" iconColor="#FFF" size={24}
                style={styles.cameraIconBtn} onPress={openCamera}
              />
            </View>

            {/* ② NAMA */}
            <Text style={styles.fieldLabel}>② Nama Produk *</Text>
            <TextInput
              ref={nameRef}
              mode="outlined" label="Nama produk"
              value={form.name}
              onChangeText={v => setForm(f => ({ ...f, name: v }))}
              returnKeyType="next"
              onSubmitEditing={() => buyPriceRef.current?.focus()}
              error={!!errors.name}
              style={styles.input}
            />
            {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}

            {/* ③ KATEGORI */}
            <Text style={styles.fieldLabel}>③ Kategori</Text>
            <Button
              mode="outlined" textColor={GREEN}
              style={styles.categoryBtn} icon="tag"
              onPress={() => setShowCategory(true)}
            >
              {form.kategori}
            </Button>

            {/* ④ HARGA BELI */}
            <Text style={styles.fieldLabel}>④ Harga Beli (Rp) *</Text>
            <TextInput
              ref={buyPriceRef}
              mode="outlined" label="Harga beli dari supplier"
              value={form.buyPrice}
              onChangeText={v => setForm(f => ({ ...f, buyPrice: v }))}
              keyboardType="numeric" returnKeyType="next"
              onSubmitEditing={() => sellPriceRef.current?.focus()}
              error={!!errors.buyPrice}
              style={styles.input}
            />
            {errors.buyPrice && <Text style={styles.errorText}>{errors.buyPrice}</Text>}

            {/* ⑤ HARGA JUAL */}
            <Text style={styles.fieldLabel}>⑤ Harga Jual (Rp) *</Text>
            <TextInput
              ref={sellPriceRef}
              mode="outlined" label="Harga jual ke pelanggan"
              value={form.sellPrice}
              onChangeText={v => setForm(f => ({ ...f, sellPrice: v }))}
              keyboardType="numeric" returnKeyType="next"
              onSubmitEditing={() => stockRef.current?.focus()}
              error={!!errors.sellPrice}
              style={styles.input}
            />
            {errors.sellPrice && <Text style={styles.errorText}>{errors.sellPrice}</Text>}

            {/* ⑥ STOK AWAL */}
            <Text style={styles.fieldLabel}>⑥ Stok Awal *</Text>
            <TextInput
              ref={stockRef}
              mode="outlined" label="Jumlah stok awal"
              value={form.stock}
              onChangeText={v => setForm(f => ({ ...f, stock: v }))}
              keyboardType="numeric" returnKeyType="next"
              onSubmitEditing={() => stockMinRef.current?.focus()}
              error={!!errors.stock}
              style={styles.input}
            />
            {errors.stock && <Text style={styles.errorText}>{errors.stock}</Text>}

            {/* ⑦ STOK MINIMUM ✅ */}
            <Text style={styles.fieldLabel}>⑦ Stok Minimum *</Text>
            <Text style={styles.fieldHint}>
              Notifikasi peringatan muncul ketika stok ≤ angka ini
            </Text>
            <TextInput
              ref={stockMinRef}
              mode="outlined" label="Contoh: 5"
              value={form.stockMin}
              onChangeText={v => setForm(f => ({ ...f, stockMin: v }))}
              keyboardType="numeric" returnKeyType="done"
              error={!!errors.stockMin}
              style={styles.input}
            />
            {errors.stockMin && <Text style={styles.errorText}>{errors.stockMin}</Text>}

            <View style={styles.modalActions}>
              <Button mode="outlined" textColor={GREEN} style={styles.modalBtn}
                onPress={() => setShowModal(false)}>Batal</Button>
              <Button mode="contained" buttonColor={GREEN} style={styles.modalBtn}
                onPress={handleSave}>
                {editTarget ? "Simpan" : "Tambah"}
              </Button>
            </View>
          </ScrollView>
        </PaperModal>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  root:            { flex: 1, backgroundColor: "#F7FAF7" },
  appbar:          { backgroundColor: GREEN },
  appbarTitle:     { color: "#FFF", fontWeight: "700" },
  content:         { flex: 1, padding: 16 },
  card:            { borderColor: "#E1EEE1", backgroundColor: "#FFF" },
  row:             { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingLeft: 12, paddingVertical: 6 },
  rowLeft:         { flex: 1 },
  productName:     { fontSize: 15, fontWeight: "700", color: "#1F2D1F" },
  muted:           { fontSize: 11, color: "#5E6E5E", marginTop: 2 },
  badgeHabis:      { fontSize: 11, color: "#C62828", fontWeight: "700", marginTop: 2 },
  badgeMenipis:    { fontSize: 11, color: "#E65100", fontWeight: "700", marginTop: 2 },
  actions:         { flexDirection: "row" },
  empty:           { padding: 16 },
  fab:             { position: "absolute", right: 16, bottom: 24, backgroundColor: GREEN },
  modalContainer:  { backgroundColor: "#FFF", margin: 16, borderRadius: 16, padding: 20, maxHeight: "92%" },
  modalTitle:      { fontSize: 16, fontWeight: "700", color: "#1B5E20", marginBottom: 8 },
  divider:         { marginBottom: 12 },
  fieldLabel:      { fontSize: 12, fontWeight: "700", color: "#1B5E20", marginBottom: 2, marginTop: 8 },
  fieldHint:       { fontSize: 11, color: "#888", marginBottom: 4 },
  barcodeRow:      { flexDirection: "row", alignItems: "center", gap: 4 },
  barcodeInput:    { flex: 1, backgroundColor: "#FFF" },
  cameraIconBtn:   { backgroundColor: GREEN, borderRadius: 8, margin: 0 },
  input:           { marginBottom: 2, backgroundColor: "#FFF" },
  errorText:       { fontSize: 11, color: "#C62828", marginBottom: 4, marginLeft: 4 },
  categoryBtn:     { borderColor: GREEN, marginBottom: 2, justifyContent: "flex-start" },
  modalActions:    { flexDirection: "row", gap: 12, marginTop: 20, marginBottom: 8 },
  modalBtn:        { flex: 1 },
  categoryModal:   { backgroundColor: "#FFF", margin: 24, borderRadius: 16, padding: 20 },
  categoryItem:    { marginBottom: 4 },
  cameraContainer: { flex: 1, backgroundColor: "#000" },
  camera:          { flex: 1 },
  cameraOverlay:   { position: "absolute", bottom: 0, left: 0, right: 0, alignItems: "center", paddingBottom: 48, gap: 16 },
  scanFrame:       { width: 240, height: 240, borderWidth: 3, borderColor: GREEN, borderRadius: 12, position: "absolute", top: "30%" },
  cameraHint:      { color: "#FFF", fontSize: 14, fontWeight: "600", backgroundColor: "rgba(0,0,0,0.5)", paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20 },
  closeCamera:     { borderRadius: 8, minWidth: 160 },
});