// src/screens/StokProdukScreen.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ─── Types ────────────────────────────────────────────────────────────────────

interface StoreProduct {
  id:        string;
  ownerId:   string;
  name:      string;
  price:     number;
  buyPrice?: number;
  stock:     number;
  stockMin?: number;
  category?: string;
  barcode?:  string;
  createdAt: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BLUE   = "#2563EB";
const GREEN  = "#16A34A";
const RED    = "#DC2626";
const ORANGE = "#D97706";
const GRAY   = "#6B7280";
const PRODUCTS_KEY = "@twd_products";

function formatRp(n: number) {
  return "Rp " + Math.round(n).toLocaleString("id-ID");
}

function stockStatus(product: StoreProduct): { label: string; color: string; bg: string } {
  const min = product.stockMin ?? 5;
  if (product.stock === 0)        return { label: "Habis",     color: RED,    bg: "#FEF2F2" };
  if (product.stock <= min)       return { label: "Menipis",   color: ORANGE, bg: "#FFF7ED" };
  return                                 { label: "Tersedia",  color: GREEN,  bg: "#F0FDF4" };
}

// ─────────────────────────────────────────────────────────────────────────────

export default function StokProdukScreen({ route }: any) {
  const insets  = useSafeAreaInsets();
  const ownerId = String(route?.params?.ownerId ?? "").trim();

  const [products,    setProducts]    = useState<StoreProduct[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTab,   setFilterTab]   = useState<"semua" | "menipis" | "habis">("semua");

  // ── Modal restock ──────────────────────────────────────────────────────
  const [showRestock,     setShowRestock]     = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<StoreProduct | null>(null);
  const [tambahQty,       setTambahQty]       = useState("");
  const [hargaBeli,       setHargaBeli]       = useState("");
  const [saving,          setSaving]          = useState(false);

  // ── Modal edit harga ───────────────────────────────────────────────────
  const [showEditHarga,   setShowEditHarga]   = useState(false);
  const [newHargaJual,    setNewHargaJual]    = useState("");
  const [newHargaBeli,    setNewHargaBeli]    = useState("");

  // ── Load ─────────────────────────────────────────────────────────────
  useFocusEffect(
    useCallback(() => { loadProducts(); }, [ownerId])
  );

  async function loadProducts() {
    setLoading(true);
    try {
      const raw = await AsyncStorage.getItem(PRODUCTS_KEY);
      const all: StoreProduct[] = raw ? JSON.parse(raw) : [];
      const mine = all
        .filter((p) => String(p.ownerId ?? "").trim() === ownerId)
        .sort((a, b) => {
          // Urutkan: habis dulu, lalu menipis, lalu tersedia
          const order = (p: StoreProduct) => {
            const min = p.stockMin ?? 5;
            if (p.stock === 0)    return 0;
            if (p.stock <= min)   return 1;
            return 2;
          };
          return order(a) - order(b);
        });
      setProducts(mine);
    } catch {
      Alert.alert("Error", "Gagal memuat produk.");
    } finally {
      setLoading(false);
    }
  }

  // ── Filter ─────────────────────────────────────────────────────────────
  const filtered = products.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchSearch) return false;
    const min = p.stockMin ?? 5;
    if (filterTab === "habis")   return p.stock === 0;
    if (filterTab === "menipis") return p.stock > 0 && p.stock <= min;
    return true;
  });

  const habisCount   = products.filter((p) => p.stock === 0).length;
  const menipisCount = products.filter((p) => p.stock > 0 && p.stock <= (p.stockMin ?? 5)).length;

  // ── Buka modal restock ─────────────────────────────────────────────────
  function openRestock(product: StoreProduct) {
    setSelectedProduct(product);
    setTambahQty("");
    setHargaBeli(product.buyPrice ? String(product.buyPrice) : "");
    setShowRestock(true);
  }

  // ── Buka modal edit harga ──────────────────────────────────────────────
  function openEditHarga(product: StoreProduct) {
    setSelectedProduct(product);
    setNewHargaJual(String(product.price));
    setNewHargaBeli(product.buyPrice ? String(product.buyPrice) : "");
    setShowEditHarga(true);
  }

  // ── Simpan restock ─────────────────────────────────────────────────────
  async function handleSaveRestock() {
    if (!selectedProduct) return;
    const qty = parseInt(tambahQty);
    if (!qty || qty <= 0) {
      Alert.alert("Perhatian", "Masukkan jumlah stok yang valid.");
      return;
    }
    setSaving(true);
    try {
      const raw = await AsyncStorage.getItem(PRODUCTS_KEY);
      const all: StoreProduct[] = raw ? JSON.parse(raw) : [];
      const idx = all.findIndex((p) => p.id === selectedProduct.id);
      if (idx >= 0) {
        all[idx] = {
          ...all[idx],
          stock:    all[idx].stock + qty,
          buyPrice: hargaBeli ? parseFloat(hargaBeli) : all[idx].buyPrice,
        };
        await AsyncStorage.setItem(PRODUCTS_KEY, JSON.stringify(all));
      }
      setShowRestock(false);
      await loadProducts();
      Alert.alert(
        "✅ Restock Berhasil",
        selectedProduct.name + "\n+" + qty + " pcs" +
        "\nStok sekarang: " + ((all[idx]?.stock ?? 0)) + " pcs"
      );
    } catch {
      Alert.alert("Error", "Gagal menyimpan restock.");
    } finally {
      setSaving(false);
    }
  }

  // ── Simpan edit harga ──────────────────────────────────────────────────
  async function handleSaveHarga() {
    if (!selectedProduct) return;
    const hj = parseFloat(newHargaJual);
    const hb = newHargaBeli ? parseFloat(newHargaBeli) : undefined;
    if (!hj || hj <= 0) {
      Alert.alert("Perhatian", "Masukkan harga jual yang valid.");
      return;
    }
    setSaving(true);
    try {
      const raw = await AsyncStorage.getItem(PRODUCTS_KEY);
      const all: StoreProduct[] = raw ? JSON.parse(raw) : [];
      const idx = all.findIndex((p) => p.id === selectedProduct.id);
      if (idx >= 0) {
        all[idx] = { ...all[idx], price: hj, buyPrice: hb };
        await AsyncStorage.setItem(PRODUCTS_KEY, JSON.stringify(all));
      }
      setShowEditHarga(false);
      await loadProducts();
      Alert.alert("✅ Harga Diperbarui", selectedProduct.name + "\nHarga jual: " + formatRp(hj));
    } catch {
      Alert.alert("Error", "Gagal menyimpan harga.");
    } finally {
      setSaving(false);
    }
  }

  // ── Hapus produk ───────────────────────────────────────────────────────
  async function handleDeleteProduct(product: StoreProduct) {
    Alert.alert(
      "Hapus Produk?",
      '"' + product.name + '" akan dihapus dari toko.',
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Hapus", style: "destructive",
          onPress: async () => {
            try {
              const raw = await AsyncStorage.getItem(PRODUCTS_KEY);
              const all: StoreProduct[] = raw ? JSON.parse(raw) : [];
              await AsyncStorage.setItem(
                PRODUCTS_KEY,
                JSON.stringify(all.filter((p) => p.id !== product.id))
              );
              await loadProducts();
            } catch {
              Alert.alert("Error", "Gagal menghapus produk.");
            }
          },
        },
      ]
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  return (
    <View style={[SP.container, { paddingTop: insets.top }]}>

      {/* ── Search ─────────────────────────────────────────────────────── */}
      <View style={SP.searchBox}>
        <TextInput
          style={SP.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="🔍 Cari produk..."
          placeholderTextColor={GRAY}
        />
      </View>

      {/* ── Summary bar ────────────────────────────────────────────────── */}
      <View style={SP.summaryBar}>
        <View style={SP.summaryItem}>
          <Text style={SP.summaryNum}>{products.length}</Text>
          <Text style={SP.summaryLbl}>Total Produk</Text>
        </View>
        <View style={SP.summaryDivider} />
        <View style={SP.summaryItem}>
          <Text style={[SP.summaryNum, { color: ORANGE }]}>{menipisCount}</Text>
          <Text style={SP.summaryLbl}>Stok Menipis</Text>
        </View>
        <View style={SP.summaryDivider} />
        <View style={SP.summaryItem}>
          <Text style={[SP.summaryNum, { color: RED }]}>{habisCount}</Text>
          <Text style={SP.summaryLbl}>Stok Habis</Text>
        </View>
      </View>

      {/* ── Filter Tab ─────────────────────────────────────────────────── */}
      <View style={SP.filterRow}>
        {([
          { key: "semua",   label: "Semua",        count: products.length },
          { key: "menipis", label: "⚠️ Menipis",   count: menipisCount },
          { key: "habis",   label: "🔴 Habis",      count: habisCount },
        ] as const).map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[SP.filterTab, filterTab === tab.key && SP.filterTabActive]}
            onPress={() => setFilterTab(tab.key)}
          >
            <Text style={[SP.filterTabTxt, filterTab === tab.key && SP.filterTabTxtActive]}>
              {tab.label}
            </Text>
            {tab.count > 0 && (
              <View style={[
                SP.filterBadge,
                filterTab === tab.key && SP.filterBadgeActive,
              ]}>
                <Text style={SP.filterBadgeTxt}>{tab.count}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* ── List produk ────────────────────────────────────────────────── */}
      {loading ? (
        <ActivityIndicator color={BLUE} size="large" style={SP.loader} />
      ) : filtered.length === 0 ? (
        <View style={SP.emptyCenter}>
          <Text style={SP.emptyIcon}>📦</Text>
          <Text style={SP.emptyTxt}>
            {searchQuery
              ? "Produk tidak ditemukan"
              : filterTab === "habis"
                ? "Tidak ada produk yang habis"
                : "Tidak ada produk stok menipis"}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={[SP.listContent, { paddingBottom: insets.bottom + 20 }]}>
          {filtered.map((product) => {
            const st  = stockStatus(product);
            const min = product.stockMin ?? 5;
            return (
              <View key={product.id} style={[SP.productCard, { borderLeftColor: st.color }]}>

                {/* ── Info produk ───────────────────────────────────── */}
                <View style={SP.productHeader}>
                  <View style={SP.flex}>
                    <Text style={SP.productName}>{product.name}</Text>
                    {product.category ? (
                      <Text style={SP.productCategory}>{product.category}</Text>
                    ) : null}
                  </View>
                  <View style={[SP.stockPill, { backgroundColor: st.bg }]}>
                    <Text style={[SP.stockPillTxt, { color: st.color }]}>{st.label}</Text>
                  </View>
                </View>

                {/* ── Stok besar ────────────────────────────────────── */}
                <View style={SP.stockRow}>
                  <View style={SP.stockNumBox}>
                    <Text style={[SP.stockNum, { color: st.color }]}>{product.stock}</Text>
                    <Text style={SP.stockUnit}>pcs</Text>
                  </View>
                  <View style={SP.stockInfo}>
                    <Text style={SP.stockInfoTxt}>Stok minimum: {min} pcs</Text>
                    {product.stock <= min && product.stock > 0 && (
                      <Text style={SP.stockWarn}>
                        ⚠️ Segera restock ({product.stock} tersisa)
                      </Text>
                    )}
                    {product.stock === 0 && (
                      <Text style={SP.stockWarnRed}>🔴 Stok habis!</Text>
                    )}
                  </View>
                </View>

                {/* ── Harga ─────────────────────────────────────────── */}
                <View style={SP.priceRow}>
                  <View style={SP.pricePair}>
                    <Text style={SP.priceLabel}>Harga Jual</Text>
                    <Text style={SP.priceVal}>{formatRp(product.price)}</Text>
                  </View>
                  {product.buyPrice ? (
                    <View style={SP.pricePair}>
                      <Text style={SP.priceLabel}>Harga Beli</Text>
                      <Text style={SP.priceValGray}>{formatRp(product.buyPrice)}</Text>
                    </View>
                  ) : null}
                  {product.buyPrice && product.price > product.buyPrice ? (
                    <View style={SP.pricePair}>
                      <Text style={SP.priceLabel}>Margin</Text>
                      <Text style={SP.priceMargin}>
                        {formatRp(product.price - product.buyPrice)}
                      </Text>
                    </View>
                  ) : null}
                </View>

                {/* ── Tombol aksi ───────────────────────────────────── */}
                <View style={SP.actionRow}>
                  <TouchableOpacity
                    style={SP.btnRestock}
                    onPress={() => openRestock(product)}
                  >
                    <Text style={SP.btnRestockTxt}>📥 Restock</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={SP.btnEditHarga}
                    onPress={() => openEditHarga(product)}
                  >
                    <Text style={SP.btnEditHargaTxt}>✏️ Harga</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={SP.btnHapus}
                    onPress={() => handleDeleteProduct(product)}
                  >
                    <Text style={SP.btnHapusTxt}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* ════ Modal: Restock ════ */}
      <Modal
        visible={showRestock}
        transparent
        animationType="slide"
        onRequestClose={() => setShowRestock(false)}
      >
        <View style={SP.overlay}>
          <View style={SP.sheet}>
            <Text style={SP.sheetTitle}>📥 Restock Produk</Text>
            {selectedProduct && (
              <>
                <View style={SP.sheetProductInfo}>
                  <Text style={SP.sheetProductName}>{selectedProduct.name}</Text>
                  <Text style={SP.sheetProductStock}>
                    Stok sekarang: {selectedProduct.stock} pcs
                  </Text>
                </View>

                <Text style={SP.inputLabel}>Jumlah Tambah Stok *</Text>
                <View style={SP.inputRow}>
                  <TouchableOpacity
                    style={SP.qtyBtn}
                    onPress={() => setTambahQty((v) => String(Math.max(1, (parseInt(v) || 0) - 1)))}
                  >
                    <Text style={SP.qtyBtnTxt}>−</Text>
                  </TouchableOpacity>
                  <TextInput
                    style={SP.qtyInput}
                    value={tambahQty}
                    onChangeText={(v) => setTambahQty(v.replace(/\D/g, ""))}
                    keyboardType="number-pad"
                    placeholder="0"
                    placeholderTextColor={GRAY}
                    textAlign="center"
                  />
                  <TouchableOpacity
                    style={SP.qtyBtn}
                    onPress={() => setTambahQty((v) => String((parseInt(v) || 0) + 1))}
                  >
                    <Text style={SP.qtyBtnTxt}>+</Text>
                  </TouchableOpacity>
                </View>

                {/* Shortcut qty */}
                <View style={SP.shortcutRow}>
                  {[6, 12, 24, 48].map((n) => (
                    <TouchableOpacity
                      key={n}
                      style={SP.shortcutBtn}
                      onPress={() => setTambahQty(String(n))}
                    >
                      <Text style={SP.shortcutTxt}>+{n}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={SP.inputLabel}>Harga Beli Baru (opsional)</Text>
                <TextInput
                  style={SP.textInput}
                  value={hargaBeli}
                  onChangeText={setHargaBeli}
                  placeholder="Rp 0"
                  placeholderTextColor={GRAY}
                  keyboardType="number-pad"
                />

                {tambahQty ? (
                  <View style={SP.previewBox}>
                    <Text style={SP.previewTxt}>
                      Setelah restock:{" "}
                      <Text style={SP.previewVal}>
                        {selectedProduct.stock + (parseInt(tambahQty) || 0)} pcs
                      </Text>
                    </Text>
                  </View>
                ) : null}
              </>
            )}

            <View style={SP.sheetActions}>
              <TouchableOpacity
                style={SP.btnCancel}
                onPress={() => setShowRestock(false)}
                disabled={saving}
              >
                <Text style={SP.btnCancelTxt}>Batal</Text>
              </TouchableOpacity>
              {saving ? (
                <ActivityIndicator color={BLUE} style={SP.flex} />
              ) : (
                <TouchableOpacity
                  style={SP.btnSave}
                  onPress={handleSaveRestock}
                >
                  <Text style={SP.btnSaveTxt}>✅ Simpan Restock</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* ════ Modal: Edit Harga ════ */}
      <Modal
        visible={showEditHarga}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEditHarga(false)}
      >
        <View style={SP.overlay}>
          <View style={SP.sheet}>
            <Text style={SP.sheetTitle}>✏️ Edit Harga</Text>
            {selectedProduct && (
              <>
                <Text style={SP.sheetProductName}>{selectedProduct.name}</Text>

                <Text style={SP.inputLabel}>Harga Jual *</Text>
                <TextInput
                  style={SP.textInput}
                  value={newHargaJual}
                  onChangeText={setNewHargaJual}
                  placeholder="Rp 0"
                  placeholderTextColor={GRAY}
                  keyboardType="number-pad"
                />

                <Text style={SP.inputLabel}>Harga Beli (opsional)</Text>
                <TextInput
                  style={SP.textInput}
                  value={newHargaBeli}
                  onChangeText={setNewHargaBeli}
                  placeholder="Rp 0"
                  placeholderTextColor={GRAY}
                  keyboardType="number-pad"
                />

                {newHargaJual && newHargaBeli && parseFloat(newHargaJual) > parseFloat(newHargaBeli) ? (
                  <View style={SP.previewBox}>
                    <Text style={SP.previewTxt}>
                      Margin:{" "}
                      <Text style={SP.previewVal}>
                        {formatRp(parseFloat(newHargaJual) - parseFloat(newHargaBeli))}
                      </Text>
                    </Text>
                  </View>
                ) : null}
              </>
            )}

            <View style={SP.sheetActions}>
              <TouchableOpacity style={SP.btnCancel} onPress={() => setShowEditHarga(false)}>
                <Text style={SP.btnCancelTxt}>Batal</Text>
              </TouchableOpacity>
              {saving ? (
                <ActivityIndicator color={BLUE} style={SP.flex} />
              ) : (
                <TouchableOpacity style={SP.btnSave} onPress={handleSaveHarga}>
                  <Text style={SP.btnSaveTxt}>✅ Simpan Harga</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const SP = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  flex:      { flex: 1 },
  loader:    { marginTop: 60 },

  searchBox:   { padding: 12, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#E5E7EB" },
  searchInput: { backgroundColor: "#F3F4F6", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: "#1F2937" },

  summaryBar:     { flexDirection: "row", backgroundColor: "#fff", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#E5E7EB" },
  summaryItem:    { flex: 1, alignItems: "center" },
  summaryDivider: { width: 1, backgroundColor: "#E5E7EB" },
  summaryNum:     { fontSize: 20, fontWeight: "800", color: "#1F2937" },
  summaryLbl:     { fontSize: 11, color: GRAY, marginTop: 2 },

  filterRow:       { flexDirection: "row", backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#E5E7EB" },
  filterTab:       { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 10, gap: 5 },
  filterTabActive: { borderBottomWidth: 2, borderBottomColor: BLUE },
  filterTabTxt:    { fontSize: 12, fontWeight: "600", color: GRAY },
  filterTabTxtActive: { color: BLUE },
  filterBadge:     { backgroundColor: "#E5E7EB", borderRadius: 8, minWidth: 18, height: 18, justifyContent: "center", alignItems: "center", paddingHorizontal: 4 },
  filterBadgeActive: { backgroundColor: BLUE },
  filterBadgeTxt:  { color: "#fff", fontSize: 10, fontWeight: "700" },

  listContent: { padding: 12 },
  emptyCenter: { flex: 1, justifyContent: "center", alignItems: "center", marginTop: 80 },
  emptyIcon:   { fontSize: 48, marginBottom: 12 },
  emptyTxt:    { fontSize: 14, color: GRAY, textAlign: "center" },

  productCard: {
    backgroundColor: "#fff", borderRadius: 12, padding: 14,
    marginBottom: 10, borderLeftWidth: 4,
    shadowColor: "#000", shadowOpacity: 0.05,
    shadowRadius: 3, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  productHeader:   { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 },
  productName:     { fontSize: 15, fontWeight: "700", color: "#1F2937", marginBottom: 3 },
  productCategory: { fontSize: 12, color: GRAY },

  stockPill:    { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  stockPillTxt: { fontSize: 11, fontWeight: "700" },

  stockRow:    { flexDirection: "row", alignItems: "center", marginBottom: 10, gap: 16 },
  stockNumBox: { alignItems: "center", backgroundColor: "#F3F4F6", borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 },
  stockNum:    { fontSize: 28, fontWeight: "900" },
  stockUnit:   { fontSize: 11, color: GRAY, marginTop: 2 },
  stockInfo:   { flex: 1 },
  stockInfoTxt:{ fontSize: 12, color: GRAY },
  stockWarn:   { fontSize: 12, color: ORANGE, fontWeight: "600", marginTop: 4 },
  stockWarnRed:{ fontSize: 12, color: RED, fontWeight: "700", marginTop: 4 },

  priceRow:     { flexDirection: "row", gap: 12, marginBottom: 12, flexWrap: "wrap" },
  pricePair:    { alignItems: "flex-start" },
  priceLabel:   { fontSize: 10, color: GRAY, marginBottom: 2 },
  priceVal:     { fontSize: 13, fontWeight: "700", color: "#1F2937" },
  priceValGray: { fontSize: 13, fontWeight: "600", color: GRAY },
  priceMargin:  { fontSize: 13, fontWeight: "700", color: GREEN },

  actionRow:      { flexDirection: "row", gap: 8 },
  btnRestock:     { flex: 2, backgroundColor: BLUE, borderRadius: 8, paddingVertical: 10, alignItems: "center" },
  btnRestockTxt:  { color: "#fff", fontSize: 12, fontWeight: "700" },
  btnEditHarga:   { flex: 1, backgroundColor: "#EFF6FF", borderRadius: 8, paddingVertical: 10, alignItems: "center", borderWidth: 1, borderColor: "#BFDBFE" },
  btnEditHargaTxt:{ color: BLUE, fontSize: 12, fontWeight: "700" },
  btnHapus:       { backgroundColor: "#FEF2F2", borderRadius: 8, paddingVertical: 10, paddingHorizontal: 12, alignItems: "center", borderWidth: 1, borderColor: "#FECACA" },
  btnHapusTxt:    { fontSize: 14 },

  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet:   { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36 },

  sheetTitle:       { fontSize: 18, fontWeight: "800", color: "#1F2937", marginBottom: 14 },
  sheetProductInfo: { backgroundColor: "#F3F4F6", borderRadius: 10, padding: 12, marginBottom: 14 },
  sheetProductName: { fontSize: 14, fontWeight: "700", color: "#1F2937", marginBottom: 4 },
  sheetProductStock:{ fontSize: 13, color: GRAY },
  sheetActions:     { flexDirection: "row", gap: 10, marginTop: 16 },

  inputLabel: { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 6 },
  textInput:  { backgroundColor: "#F3F4F6", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: "#1F2937", marginBottom: 14 },

  inputRow:  { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  qtyBtn:    { width: 44, height: 44, backgroundColor: BLUE, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  qtyBtnTxt: { color: "#fff", fontSize: 22, fontWeight: "700" },
  qtyInput:  { flex: 1, backgroundColor: "#F3F4F6", borderRadius: 8, paddingVertical: 10, fontSize: 20, fontWeight: "800", color: "#1F2937" },

  shortcutRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  shortcutBtn: { flex: 1, backgroundColor: "#EFF6FF", borderRadius: 8, paddingVertical: 8, alignItems: "center", borderWidth: 1, borderColor: "#BFDBFE" },
  shortcutTxt: { color: BLUE, fontSize: 13, fontWeight: "700" },

  previewBox: { backgroundColor: "#F0FDF4", borderRadius: 8, padding: 10, marginBottom: 10 },
  previewTxt: { fontSize: 13, color: "#166534" },
  previewVal: { fontWeight: "800" },

  btnCancel:    { flex: 1, backgroundColor: "#F3F4F6", borderRadius: 10, padding: 14, alignItems: "center" },
  btnCancelTxt: { color: GRAY, fontWeight: "700", fontSize: 14 },
  btnSave:      { flex: 2, backgroundColor: BLUE, borderRadius: 10, padding: 14, alignItems: "center" },
  btnSaveTxt:   { color: "#fff", fontWeight: "700", fontSize: 14 },
});