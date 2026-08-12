import React, { useMemo, useState } from "react";
import {
  FlatList,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import {
  Appbar,
  Badge,
  Button,
  Card,
  Chip,
  Text,
  TextInput,
} from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CustomerSession } from "../../context/OrderContext";
import {
  KategoriProduk,
  useProducts,
} from "../../context/ProductsContext";
import { useStore } from "../../context/StoreContext";

const GREEN = "#2E7D32";

const KATEGORI_FILTER: Array<KategoriProduk | "Semua"> = [
  "Semua", "Makanan", "Minuman", "Snack",
  "Rokok", "Sembako", "Kebersihan", "Lainnya",
];

type CartItem = {
  productId: string;
  name:      string;
  price:     number;
  qty:       number;
};

type Props = {
  session:      CustomerSession;
  onLogout:     () => void;
  onCheckout:   (cart: Record<string, CartItem>) => void;
  onCekPesanan: () => void;
};

export default function CustomerHomeScreen({
  session, onLogout, onCheckout, onCekPesanan,
}: Props) {
  // ✅ Fix navbar: ambil inset bawah
  const insets = useSafeAreaInsets();

  const { products }  = useProducts();
  const { storeName } = useStore();

  const [search,   setSearch]   = useState("");
  const [kategori, setKategori] = useState<KategoriProduk | "Semua">("Semua");
  const [cart,     setCart]     = useState<Record<string, CartItem>>({});

  const availableProducts = products.filter(p => p.stock > 0);

  const filtered = useMemo(() => {
    return availableProducts.filter(p => {
      const matchKat  = kategori === "Semua" || p.kategori === kategori;
      const matchName = p.name.toLowerCase().includes(search.toLowerCase());
      return matchKat && matchName;
    });
  }, [availableProducts, kategori, search]);

  const totalQty   = useMemo(() => Object.values(cart).reduce((a, c) => a + c.qty, 0), [cart]);
  const totalHarga = useMemo(() => Object.values(cart).reduce((a, c) => a + c.qty * c.price, 0), [cart]);

  const addToCart = (p: { id: string; name: string; sellPrice: number; stock: number }) => {
    setCart(prev => {
      const current = prev[p.id];
      const nextQty = (current?.qty ?? 0) + 1;
      if (nextQty > p.stock) return prev;
      return {
        ...prev,
        [p.id]: { productId: p.id, name: p.name, price: p.sellPrice, qty: nextQty },
      };
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => {
      const current = prev[productId];
      if (!current) return prev;
      if (current.qty <= 1) {
        const updated = { ...prev };
        delete updated[productId];
        return updated;
      }
      return { ...prev, [productId]: { ...current, qty: current.qty - 1 } };
    });
  };

  // ✅ Tinggi footer untuk padding FlatList agar tidak tertutup
  const footerHeight = totalQty > 0 ? 80 + insets.bottom : 0;

  return (
    <View style={S.root}>
      <Appbar.Header style={S.appbar}>
        <Appbar.Content
          title={storeName ?? "Toko"}
          subtitle={"Halo, " + session.name + (session.email ? " (" + session.email + ")" : " 👋")}
          titleStyle={S.appbarTitle}
          subtitleStyle={S.appbarSubtitle}
        />
        <TouchableOpacity style={S.pesananBtn} onPress={onCekPesanan}>
          <Text style={S.pesananBtnText}>📦 Pesanan</Text>
        </TouchableOpacity>
        <Appbar.Action icon="logout" color="#fff" onPress={onLogout} />
      </Appbar.Header>

      {/* Search */}
      <View style={S.searchBox}>
        <TextInput
          mode="outlined"
          label="Cari produk..."
          value={search}
          onChangeText={setSearch}
          left={<TextInput.Icon icon="magnify" color={GREEN} />}
          right={
            search
              ? <TextInput.Icon icon="close" onPress={() => setSearch("")} />
              : undefined
          }
          style={S.searchInput}
          dense
        />
      </View>

      {/* Kategori */}
      <View style={S.chipRow}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={KATEGORI_FILTER}
          keyExtractor={k => k}
          contentContainerStyle={S.chipList}
          renderItem={({ item: k }) => (
            <Chip
              selected={kategori === k}
              onPress={() => setKategori(k as KategoriProduk | "Semua")}
              style={[S.chip, kategori === k && S.chipActive]}
              textStyle={[S.chipText, kategori === k && S.chipTextActive]}
              selectedColor={GREEN}
            >
              {k}
            </Chip>
          )}
        />
      </View>

      {/* Daftar Produk */}
      <FlatList
        data={filtered}
        keyExtractor={p => p.id}
        contentContainerStyle={[
          S.listContent,
          // ✅ Tambah padding bawah agar produk terakhir tidak tertutup footer
          { paddingBottom: footerHeight + 16 },
        ]}
        ListEmptyComponent={
          <View style={S.emptyBox}>
            <Text style={S.emptyText}>
              {availableProducts.length === 0
                ? "Belum ada produk tersedia."
                : "Produk tidak ditemukan."}
            </Text>
          </View>
        }
        renderItem={({ item: p }) => {
          const inCart   = cart[p.id]?.qty ?? 0;
          const cartFull = inCart >= p.stock;
          return (
            <Card style={S.productCard} mode="outlined">
              <Card.Content style={S.productContent}>
                <View style={S.productInfo}>
                  <Text style={S.productName}>{p.name}</Text>
                  <Text style={S.productKat}>{p.kategori}</Text>
                  <Text style={S.productPrice}>
                    {"Rp " + p.sellPrice.toLocaleString("id-ID")}
                  </Text>
                  <Text style={S.productStok}>{"Stok: " + p.stock}</Text>
                </View>
                <View style={S.productActions}>
                  {inCart > 0 ? (
                    <View style={S.qtyRow}>
                      <TouchableOpacity
                        style={S.qtyBtn}
                        onPress={() => removeFromCart(p.id)}
                      >
                        <Text style={S.qtyBtnText}>−</Text>
                      </TouchableOpacity>
                      <Text style={S.qtyNum}>{inCart}</Text>
                      <TouchableOpacity
                        style={[S.qtyBtn, cartFull && S.qtyBtnDisabled]}
                        disabled={cartFull}
                        onPress={() => addToCart(p)}
                      >
                        <Text style={[S.qtyBtnText, cartFull && S.qtyBtnTextDisabled]}>
                          +
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <Button
                      mode="contained"
                      buttonColor={GREEN}
                      compact
                      onPress={() => addToCart(p)}
                    >
                      + Tambah
                    </Button>
                  )}
                </View>
              </Card.Content>
            </Card>
          );
        }}
      />

      {/* ✅ Footer Keranjang — pakai insets.bottom agar tidak tertutup navbar */}
      {totalQty > 0 && (
        <View style={[S.cartFooter, { paddingBottom: insets.bottom + 12 }]}>
          <View style={S.cartInfo}>
            <Badge style={S.badge}>{totalQty}</Badge>
            <View>
              <Text style={S.cartTotal}>
                {"Rp " + totalHarga.toLocaleString("id-ID")}
              </Text>
              <Text style={S.cartSub}>{totalQty + " item di keranjang"}</Text>
            </View>
          </View>
          <Button
            mode="contained"
            buttonColor="#FFF"
            textColor={GREEN}
            style={S.checkoutBtn}
            onPress={() => onCheckout(cart)}
          >
            Pesan →
          </Button>
        </View>
      )}
    </View>
  );
}

const S = StyleSheet.create({
  root:               { flex: 1, backgroundColor: "#F7FAF7" },
  appbar:             { backgroundColor: GREEN },
  appbarTitle:        { color: "#FFF", fontWeight: "700" },
  appbarSubtitle:     { color: "#C8E6C9", fontSize: 12 },
  pesananBtn:         {
    backgroundColor:  "rgba(255,255,255,0.2)",
    borderRadius:     16,
    paddingHorizontal: 12,
    paddingVertical:  4,
    marginRight:      4,
  },
  pesananBtnText:     { color: "#FFF", fontSize: 12, fontWeight: "700" },
  searchBox:          { padding: 12, paddingBottom: 4, backgroundColor: "#FFF" },
  searchInput:        { backgroundColor: "#FFF" },
  chipRow:            { backgroundColor: "#FFF", paddingBottom: 8 },
  chipList:           { paddingHorizontal: 12, gap: 8 },
  chip:               { backgroundColor: "#F0F0F0" },
  chipActive:         { backgroundColor: "#E8F5E9" },
  chipText:           { fontSize: 12, color: "#666" },
  chipTextActive:     { color: GREEN, fontWeight: "700" },
  listContent:        { padding: 12, gap: 10 },
  productCard:        { borderColor: "#E1EEE1", backgroundColor: "#FFF" },
  productContent:     {
    flexDirection:  "row",
    justifyContent: "space-between",
    alignItems:     "center",
  },
  productInfo:        { flex: 1 },
  productName:        { fontSize: 14, fontWeight: "700", color: "#1F2D1F" },
  productKat:         { fontSize: 11, color: "#888", marginTop: 1 },
  productPrice:       { fontSize: 15, fontWeight: "800", color: GREEN, marginTop: 4 },
  productStok:        { fontSize: 11, color: "#888", marginTop: 1 },
  productActions:     { marginLeft: 12 },
  qtyRow:             { flexDirection: "row", alignItems: "center", gap: 8 },
  qtyBtn:             {
    width:           32,
    height:          32,
    borderRadius:    16,
    backgroundColor: GREEN,
    alignItems:      "center",
    justifyContent:  "center",
  },
  qtyBtnDisabled:     { backgroundColor: "#CCC" },
  qtyBtnText:         { color: "#FFF", fontSize: 18, fontWeight: "700", lineHeight: 22 },
  qtyBtnTextDisabled: { color: "#999" },
  qtyNum:             {
    fontSize:   16,
    fontWeight: "800",
    color:      "#1F2D1F",
    minWidth:   24,
    textAlign:  "center",
  },
  emptyBox:           { padding: 40, alignItems: "center" },
  emptyText:          { color: "#AAA", fontSize: 14 },

  // ✅ Footer — paddingBottom di-override secara dinamis pakai insets
  cartFooter:         {
    position:        "absolute",
    bottom:          0,
    left:            0,
    right:           0,
    backgroundColor: GREEN,
    paddingTop:      16,
    paddingHorizontal: 16,
    flexDirection:   "row",
    justifyContent:  "space-between",
    alignItems:      "center",
  },
  badge:              { backgroundColor: "#FFF", color: GREEN, marginRight: 10 },
  cartInfo:           { flexDirection: "row", alignItems: "center" },
  cartTotal:          { color: "#FFF", fontSize: 16, fontWeight: "800" },
  cartSub:            { color: "#C8E6C9", fontSize: 11 },
  checkoutBtn:        { borderRadius: 20 },
});