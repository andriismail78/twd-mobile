// src/screens/customer/CustomerCartScreen.tsx

import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import {
  Button,
  Card,
  Divider,
  IconButton,
  Text,
  TextInput,
} from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../context/AuthContext";
import { CustomerSession, useOrders } from "../../context/OrderContext";
import { usePaymentMethods } from "../../context/PaymentMethodContext";
import { createMayarPayment, MayarPaymentResult } from "../../utils/MayarService";
import { Linking } from "react-native";

const GREEN         = "#2E7D32";
const BIAYA_LAYANAN = 1_000;

type CartItem = {
  productId: string;
  name:      string;
  price:     number;
  qty:       number;
};

type Props = {
  session:        CustomerSession;
  onCheckoutDone: () => void;
};

type CheckoutStep = "cart" | "form" | "bayar_method" | "instruksi_bayar";

// Helper: ambil harga produk dari field manapun yang tersedia
function getProductPrice(p: any): number {
  return typeof p.sellPrice === "number" ? p.sellPrice
       : typeof p.price     === "number" ? p.price
       : 0;
}

export default function CustomerCartScreen({ session, onCheckoutDone }: Props) {
  const { user }                       = useAuth();
  const { addOrder }                   = useOrders();
  const { enabledMethods: rawMethods } = usePaymentMethods();
  const insets                         = useSafeAreaInsets();

  const enabledMethods = rawMethods ?? [];

  // ✅ ownerId: dari session dulu, fallback ke user context
  const ownerId: string = String(
    (session as any).ownerId ??
    user?.ownerId            ??
    user?.id                 ??
    ""
  ).trim();

  // ✅ Load produk langsung dari AsyncStorage, filter by ownerId
  const [ownerProducts, setOwnerProducts] = useState<any[]>([]);
  useEffect(() => {
    const loadOwnerProducts = async () => {
      try {
        const raw = await AsyncStorage.getItem("@twd_products");
        const all: any[] = raw ? JSON.parse(raw) : [];
        const filtered = all.filter((p: any) => {
          const milikOwner = p.ownerId === ownerId || (!p.ownerId && !ownerId);
          const adaStok    = (p.stock ?? 0) > 0;
          return milikOwner && adaStok;
        });
        setOwnerProducts(filtered);
      } catch (e) {
        console.error("Gagal load produk owner:", e);
        setOwnerProducts([]);
      }
    };
    loadOwnerProducts();
  }, [ownerId]);

  const [cart,            setCart]           = useState<Record<string, CartItem>>({});
  const [step,            setStep]           = useState<CheckoutStep>("cart");
  const [nama,            setNama]           = useState(session.name);
  const [telepon,         setTelepon]        = useState(session.phone);
  const [alamat,          setAlamat]         = useState(session.address || "");
  const [catatan,         setCatatan]        = useState("");
  const [metodeBayar,     setMetodeBayar]    = useState<string>("");
  const [loading,         setLoading]        = useState(false);

  // ✅ State khusus Mayar.id Payment Gateway
  const [mayarPaymentResult, setMayarPaymentResult] = useState<MayarPaymentResult | null>(null);
  const [mayarError,         setMayarError]         = useState<string>("");
  const [showMayarModal,     setShowMayarModal]     = useState(false);

  // Metode manual dari PaymentMethodContext (transfer manual & qris)
  const bayarOptions = useMemo(
    () => enabledMethods.filter(m => m.id === "transfer" || m.id === "qris"),
    [enabledMethods],
  );

  const addToCart = (p: { id: string; name: string; price: number; stock: number }) => {
    setCart(prev => {
      const curr    = prev[p.id];
      const nextQty = (curr?.qty ?? 0) + 1;
      if (nextQty > p.stock) return prev;
      return {
        ...prev,
        [p.id]: { productId: p.id, name: p.name, price: p.price, qty: nextQty },
      };
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => {
      const curr = prev[productId];
      if (!curr) return prev;
      if (curr.qty <= 1) {
        const next = { ...prev };
        delete next[productId];
        return next;
      }
      return { ...prev, [productId]: { ...curr, qty: curr.qty - 1 } };
    });
  };

  const cartItems  = useMemo(() => Object.values(cart), [cart]);
  const subtotal   = useMemo(() => cartItems.reduce((a, it) => a + it.qty * it.price, 0), [cartItems]);
  const totalAkhir = useMemo(() => subtotal + BIAYA_LAYANAN, [subtotal]);

  // ✅ Validasi sebelum lanjut ke pembayaran
  const canProceedToBayar = useMemo(() => {
    if (!metodeBayar) return false;
    return true;
  }, [metodeBayar]);

  // ✅ Handler utama: buat pesanan + panggil Mayar.id jika perlu
  const handleBuatPesanan = async () => {
    if (!alamat.trim()) {
      Alert.alert("Alamat Kosong", "Masukkan alamat pengiriman.");
      return;
    }
    setLoading(true);
    setMayarError("");

    try {
      // ── Jika metode Pembayaran Online (Mayar.id) ─────────────────────────
      if (metodeBayar === "mayar") {
        const orderId = `TWD-${Date.now()}`;
        try {
          const mayarResp = await createMayarPayment({
            orderId,
            amount:        totalAkhir,
            customerName:  nama.trim(),
            customerEmail: session.email || "customer@twdmobile.com",
            customerPhone: telepon.trim(),
            description:   `Pesanan #${orderId} TWD Mobile (${cartItems.length} item)`,
          });
          setMayarPaymentResult(mayarResp);
        } catch (err: any) {
          console.warn("Mayar.id payment gagal:", err?.message);
          setMayarError("Gagal membuat link pembayaran otomatis. Kamu tetap bisa membayar secara manual.");
        }
      }

      // ── Simpan pesanan ke OrderContext ─────────────────────────────
      await addOrder({
        ownerId,
        customerName:        nama.trim(),
        customerPhone:       telepon.trim(),
        alamat:              alamat.trim(),
        catatan:             catatan.trim() || undefined,
        items:               cartItems.map(it => ({
          productId: it.productId,
          name:      it.name,
          price:     it.price,
          qty:       it.qty,
        })),
        subtotal,
        biayaLayanan:        BIAYA_LAYANAN,
        total:               totalAkhir,
        status:              "menunggu",
        metodeBayarCustomer: metodeBayar,
      });

      setStep("instruksi_bayar");
    } catch {
      Alert.alert("Gagal", "Pesanan tidak tersimpan. Coba lagi.");
    }
    setLoading(false);
  };

  const handleOpenMayarLink = async () => {
    try {
      const savedLink = await AsyncStorage.getItem("@twd_mayar_link");
      if (savedLink && savedLink.trim().startsWith("http")) {
        const url = `${savedLink.trim()}?amount=${totalAkhir}&name=${encodeURIComponent(nama.trim())}`;
        const canOpen = await Linking.canOpenURL(url).catch(() => false);
        if (canOpen) return Linking.openURL(url);
      }

      if (
        mayarPaymentResult &&
        mayarPaymentResult.linkUrl &&
        mayarPaymentResult.linkUrl.startsWith("http") &&
        !mayarPaymentResult.linkUrl.includes("mayar.id/pay/twdmobile")
      ) {
        const canOpen = await Linking.canOpenURL(mayarPaymentResult.linkUrl).catch(() => false);
        if (canOpen) return Linking.openURL(mayarPaymentResult.linkUrl);
      }

      setShowMayarModal(true);
    } catch {
      setShowMayarModal(true);
    }
  };

  const selectedMethod = enabledMethods.find(m => m.id === metodeBayar);
  const scrollStyle    = { paddingBottom: insets.bottom + 120 };
  const instruksiStyle = { paddingBottom: insets.bottom + 32 };
  const footerStyle    = [S.footer, { paddingBottom: insets.bottom + 8 }];

  // ══════════════════════════════════════════════════════════════════
  // STEP: CART
  // ══════════════════════════════════════════════════════════════════
  if (step === "cart") {
    return (
      <View style={S.root}>
        <View style={S.header}>
          <Text style={S.headerTitle}>🛒 Pilih Produk</Text>
          <Text style={S.headerSubtitle}>Produk tersedia di toko</Text>
        </View>
        <ScrollView contentContainerStyle={scrollStyle}>
          {ownerProducts.length === 0 ? (
            <View style={S.emptyBox}>
              <Text style={S.emptyIcon}>📦</Text>
              <Text style={S.emptyTitle}>Belum ada produk tersedia</Text>
              <Text style={S.emptySubtitle}>
                Hubungi toko untuk informasi lebih lanjut
              </Text>
            </View>
          ) : (
            ownerProducts.map((p: any) => {
              const harga     = getProductPrice(p);
              const inCartQty = cart[p.id]?.qty ?? 0;
              const atMax     = inCartQty >= p.stock;
              return (
                <Card key={p.id} style={S.productCard} mode="outlined">
                  <View style={S.productRow}>
                    <View style={S.productInfo}>
                      <Text style={S.productName}>{p.name}</Text>
                      <Text style={S.productPrice}>
                        {"Rp " + harga.toLocaleString("id-ID")}
                      </Text>
                      <Text style={S.productStok}>Stok: {p.stock}</Text>
                    </View>
                    <View style={S.qtyControl}>
                      {inCartQty > 0 ? (
                        <>
                          <IconButton
                            icon="minus" iconColor={GREEN} size={20}
                            onPress={() => removeFromCart(p.id)}
                          />
                          <Text style={S.qtyText}>{inCartQty}</Text>
                          <IconButton
                            icon="plus" size={20}
                            iconColor={atMax ? "#CCC" : GREEN}
                            disabled={atMax}
                            onPress={() => addToCart({
                              id: p.id, name: p.name,
                              price: harga, stock: p.stock,
                            })}
                          />
                        </>
                      ) : (
                        <Button
                          mode="contained" buttonColor={GREEN} compact
                          onPress={() => addToCart({
                            id: p.id, name: p.name,
                            price: harga, stock: p.stock,
                          })}
                        >
                          + Tambah
                        </Button>
                      )}
                    </View>
                  </View>
                </Card>
              );
            })
          )}
        </ScrollView>
        {cartItems.length > 0 && (
          <View style={footerStyle}>
            <View style={S.footerSummary}>
              <Text style={S.footerQty}>
                {cartItems.reduce((a, i) => a + i.qty, 0) + " item"}
              </Text>
              <Text style={S.footerTotal}>
                {"Rp " + totalAkhir.toLocaleString("id-ID")}
              </Text>
            </View>
            <Button
              mode="contained" buttonColor={GREEN} style={S.footerBtn}
              icon="arrow-right" contentStyle={S.footerBtnContent}
              onPress={() => setStep("form")}
            >
              Lanjut ke Pengiriman
            </Button>
          </View>
        )}
      </View>
    );
  }

  // ══════════════════════════════════════════════════════════════════
  // STEP: FORM
  // ══════════════════════════════════════════════════════════════════
  if (step === "form") {
    return (
      <KeyboardAvoidingView
        style={S.root}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={S.header}>
          <TouchableOpacity onPress={() => setStep("cart")} style={S.backBtn}>
            <Text style={S.backBtnText}>← Kembali</Text>
          </TouchableOpacity>
          <Text style={S.headerTitle}>📍 Info Pengiriman</Text>
        </View>
        <ScrollView contentContainerStyle={scrollStyle} keyboardShouldPersistTaps="handled">
          <Card style={S.summaryCard} mode="outlined">
            <Card.Content>
              <Text style={S.sectionLabel}>🧾 Ringkasan Pesanan</Text>
              {cartItems.map(it => (
                <View key={it.productId} style={S.summaryRow}>
                  <Text style={S.summaryItemName}>{it.name} x{it.qty}</Text>
                  <Text style={S.summaryItemPrice}>
                    {"Rp " + (it.qty * it.price).toLocaleString("id-ID")}
                  </Text>
                </View>
              ))}
              <Divider style={S.divider} />
              <View style={S.summaryRow}>
                <Text style={S.summaryMuted}>Biaya Layanan</Text>
                <Text style={S.summaryMuted}>
                  {"Rp " + BIAYA_LAYANAN.toLocaleString("id-ID")}
                </Text>
              </View>
              <View style={S.summaryRow}>
                <Text style={S.totalLabel}>Total</Text>
                <Text style={S.totalValue}>
                  {"Rp " + totalAkhir.toLocaleString("id-ID")}
                </Text>
              </View>
            </Card.Content>
          </Card>
          <Card style={S.formCard} mode="outlined">
            <Card.Content>
              {session.loginType === "google" && (
                <View style={{ backgroundColor: "#F0FDF4", borderRadius: 12, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: "#BBF7D0", flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <Text style={{ fontSize: 22 }}>{"✨"}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: "800", color: "#166534" }}>
                      {"Data Otomatis Terisi dari Akun Google"}
                    </Text>
                    <Text style={{ fontSize: 11, color: "#15803D", marginTop: 2 }}>
                      {"Nama, No. HP, & Alamat kirim sudah terisi otomatis dari profil Gmail (" + (session.email || "") + "). Kamu tetap bisa mengubahnya jika perlu."}
                    </Text>
                  </View>
                </View>
              )}
              <Text style={S.sectionLabel}>👤 Data Penerima</Text>
              <TextInput mode="outlined" label="Nama"
                value={nama} onChangeText={setNama} style={S.input} />
              <TextInput mode="outlined" label="No. Telepon"
                value={telepon} onChangeText={setTelepon}
                keyboardType="phone-pad" style={S.input} />
              <TextInput mode="outlined" label="Alamat Lengkap *"
                value={alamat} onChangeText={setAlamat}
                multiline numberOfLines={3} style={S.input} />
              <TextInput mode="outlined" label="Catatan (opsional)"
                value={catatan} onChangeText={setCatatan}
                multiline numberOfLines={2} style={S.input} />
            </Card.Content>
          </Card>
        </ScrollView>
        <View style={footerStyle}>
          <Button
            mode="contained" buttonColor={GREEN} style={S.footerBtn}
            contentStyle={S.footerBtnContent}
            disabled={!alamat.trim()}
            onPress={() => setStep("bayar_method")}
          >
            Lanjut ke Pembayaran
          </Button>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // ══════════════════════════════════════════════════════════════════
  // STEP: PILIH METODE BAYAR
  // ══════════════════════════════════════════════════════════════════
  if (step === "bayar_method") {
    return (
      <View style={S.root}>
        <View style={S.header}>
          <TouchableOpacity onPress={() => setStep("form")} style={S.backBtn}>
            <Text style={S.backBtnText}>← Kembali</Text>
          </TouchableOpacity>
          <Text style={S.headerTitle}>💳 Pilih Metode Bayar</Text>
          <Text style={S.headerSubtitle}>
            {"Total: Rp " + totalAkhir.toLocaleString("id-ID")}
          </Text>
        </View>
        <ScrollView contentContainerStyle={scrollStyle}>
          <Card style={S.infoCard} mode="outlined">
            <Card.Content>
              <Text style={S.infoText}>
                Pilih metode pembayaran. Pesanan akan diproses setelah kasir memverifikasi pembayaran.
              </Text>
            </Card.Content>
          </Card>

          {/* ✅ Opsi Pembayaran Online (mayar.id — QRIS, VA Bank, e-Wallet, Alfamart/Indomaret) */}
          {(() => {
            const isActive = metodeBayar === "mayar";
            return (
              <TouchableOpacity onPress={() => setMetodeBayar("mayar")}>
                <Card style={[S.methodCard, isActive && S.methodCardActive]} mode="outlined">
                  <Card.Content>
                    <View style={S.methodRow}>
                      <View style={S.methodLeft}>
                        <Text style={S.methodIcon}>⚡</Text>
                        <View style={S.methodLabelBox}>
                          <Text style={[S.methodLabel, isActive && S.methodLabelActive]}>
                            Pembayaran Online (mayar.id)
                          </Text>
                          <Text style={S.methodDetail}>
                            QRIS, Virtual Account Bank, e-Wallet & Alfamart/Indomaret
                          </Text>
                        </View>
                      </View>
                      <View style={[S.radioCircle, isActive && S.radioCircleActive]}>
                        {isActive && <View style={S.radioInner} />}
                      </View>
                    </View>

                    {isActive && (
                      <View style={{ backgroundColor: "#EEF2FF", borderRadius: 12, padding: 12, marginTop: 12, borderWidth: 1, borderColor: "#C7D2FE" }}>
                        <Text style={{ fontSize: 13, fontWeight: "800", color: "#3730A3", marginBottom: 4 }}>
                          {"⚡ Pembayaran Otomatis by mayar.id"}
                        </Text>
                        <Text style={{ fontSize: 11, color: "#4338CA", lineHeight: 16 }}>
                          {"Setelah klik 'Buat Pesanan', kamu akan diarahkan ke halaman pembayaran mayar.id untuk menyelesaikan transaksi melalui metode pilihanmu (QRIS, VA Bank, e-Wallet, dll)."}
                        </Text>
                      </View>
                    )}
                  </Card.Content>
                </Card>
              </TouchableOpacity>
            );
          })()}

          {/* Metode manual dari PaymentMethodContext */}
          {bayarOptions.length === 0 && metodeBayar !== "mayar" ? (
            <Card style={S.infoCard} mode="outlined">
              <Card.Content>
                <Text style={S.noMethodText}>
                  ⚠️ Tidak ada metode pembayaran manual tersedia. Gunakan Virtual Account di atas.
                </Text>
              </Card.Content>
            </Card>
          ) : (
            bayarOptions.map(m => {
              const isActive  = metodeBayar === m.id;
              const cardStyle = [S.methodCard, isActive && S.methodCardActive];
              return (
                <TouchableOpacity key={m.id} onPress={() => setMetodeBayar(m.id)}>
                  <Card style={cardStyle} mode="outlined">
                    <Card.Content>
                      <View style={S.methodRow}>
                        <View style={S.methodLeft}>
                          <Text style={S.methodIcon}>{m.icon}</Text>
                          <View style={S.methodLabelBox}>
                            <Text style={[S.methodLabel, isActive && S.methodLabelActive]}>
                              {m.label}
                            </Text>
                            {isActive && m.id === "transfer" && (
                              <Text style={S.methodDetail}>
                                {(m.bankName ?? "") + " " + (m.accountNumber ?? "")}
                              </Text>
                            )}
                            {isActive && m.id === "qris" && (
                              <Text style={S.methodDetail}>Scan QR dari toko</Text>
                            )}
                          </View>
                        </View>
                        <View style={[S.radioCircle, isActive && S.radioCircleActive]}>
                          {isActive && <View style={S.radioInner} />}
                        </View>
                      </View>
                      {isActive && m.id === "transfer" && (
                        <View style={S.methodDetailBox}>
                          {m.bankName
                            ? <Text style={S.methodDetailText}>🏦 {m.bankName}</Text>
                            : null}
                          {m.accountNumber ? (
                            <Text style={S.methodAccNum}>{m.accountNumber}</Text>
                          ) : null}
                          {m.accountName
                            ? <Text style={S.methodDetailText}>a/n {m.accountName}</Text>
                            : null}
                          {m.note
                            ? <Text style={S.methodNote}>{m.note}</Text>
                            : null}
                        </View>
                      )}
                    </Card.Content>
                  </Card>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
        <View style={footerStyle}>
          <Button
            mode="contained" buttonColor={GREEN} style={S.footerBtn}
            contentStyle={S.footerBtnContent}
            disabled={!canProceedToBayar || loading}
            loading={loading}
            onPress={handleBuatPesanan}
          >
            Buat Pesanan & Bayar
          </Button>
        </View>
      </View>
    );
  }

  // ══════════════════════════════════════════════════════════════════
  // STEP: INSTRUKSI BAYAR
  // ══════════════════════════════════════════════════════════════════
  return (
    <View style={S.root}>
      <ScrollView contentContainerStyle={instruksiStyle}>
        <View style={S.instruksiHeader}>
          <Text style={S.instruksiCheckmark}>✅</Text>
          <Text style={S.instruksiTitle}>Pesanan Dibuat!</Text>
          <Text style={S.instruksiSubtitle}>
            Selesaikan pembayaran untuk memproses pesanan Anda.
          </Text>
        </View>

        <Card style={S.instruksiAmountCard} mode="outlined">
          <Card.Content>
            <Text style={S.instruksiAmountLabel}>Total yang harus dibayar</Text>
            <Text style={S.instruksiAmount}>
              {"Rp " + totalAkhir.toLocaleString("id-ID")}
            </Text>
          </Card.Content>
        </Card>

        {/* ✅ Instruksi Pembayaran Mayar.id */}
        {metodeBayar === "mayar" && (
          <Card style={S.instruksiCard} mode="outlined">
            <Card.Content>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <View style={{ backgroundColor: "#EEF2FF", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
                  <Text style={{ fontSize: 13, fontWeight: "900", color: "#4338CA" }}>{"mayar.id"}</Text>
                </View>
                <Text style={S.instruksiMethodTitle}>{"Pembayaran Online Terintegrasi"}</Text>
              </View>

              {mayarError !== "" && (
                <View style={S.dokuErrorBox}>
                  <Text style={S.dokuErrorText}>{"⚠️ " + mayarError}</Text>
                </View>
              )}

              {mayarPaymentResult ? (
                <View>
                  <View style={{ backgroundColor: "#F8FAFC", borderRadius: 12, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: "#E2E8F0" }}>
                    <Text style={{ fontSize: 12, color: "#64748B", marginBottom: 4 }}>{"Total yang Harus Dibayar:"}</Text>
                    <Text style={{ fontSize: 22, fontWeight: "900", color: "#1E293B" }}>
                      {"Rp " + totalAkhir.toLocaleString("id-ID")}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={{ backgroundColor: "#2563EB", borderRadius: 12, paddingVertical: 14, alignItems: "center", marginBottom: 14, flexDirection: "row", justifyContent: "center", gap: 8, elevation: 2 }}
                    onPress={handleOpenMayarLink}
                  >
                    <Text style={{ fontSize: 16, color: "#fff" }}>{"💳"}</Text>
                    <Text style={{ color: "#fff", fontWeight: "800", fontSize: 14 }}>
                      {"Buka Halaman Pembayaran (mayar.id) →"}
                    </Text>
                  </TouchableOpacity>

                  <Text style={{ fontSize: 11, color: "#64748B", textAlign: "center", marginBottom: 12 }}>
                    {`Link: ${mayarPaymentResult.linkUrl}`}
                  </Text>

                  <Divider style={S.divider} />
                  <Text style={S.instruksiStep}>{"Metode yang tersedia di mayar.id:"}</Text>
                  <Text style={S.instruksiStepItem}>{"• QRIS (Scan dengan DANA, GoPay, OVO, ShopeePay, BCA, dll)"}</Text>
                  <Text style={S.instruksiStepItem}>{"• Virtual Account (BCA, BRI, BNI, Mandiri, BSI, Permata)"}</Text>
                  <Text style={S.instruksiStepItem}>{"• e-Wallet (GoPay, OVO, ShopeePay)"}</Text>
                  <Text style={S.instruksiStepItem}>{"• Alfamart & Indomaret"}</Text>
                </View>
              ) : null}
            </Card.Content>
          </Card>
        )}

        {/* Instruksi Transfer Manual */}
        {selectedMethod && selectedMethod.id === "transfer" && (
          <Card style={S.instruksiCard} mode="outlined">
            <Card.Content>
              <Text style={S.instruksiMethodTitle}>🏦 Transfer Bank</Text>
              {selectedMethod.bankName
                ? <Text style={S.instruksiRow}>Bank: {selectedMethod.bankName}</Text>
                : null}
              {selectedMethod.accountNumber ? (
                <View style={S.instruksiAccBox}>
                  <Text style={S.instruksiAccLabel}>Nomor Rekening</Text>
                  <Text style={S.instruksiAccNum}>
                    {selectedMethod.accountNumber}
                  </Text>
                </View>
              ) : null}
              {selectedMethod.accountName
                ? <Text style={S.instruksiRow}>a/n {selectedMethod.accountName}</Text>
                : null}
              <Divider style={S.divider} />
              <Text style={S.instruksiStep}>Langkah pembayaran:</Text>
              <Text style={S.instruksiStepItem}>1. Buka m-Banking / ATM Anda</Text>
              <Text style={S.instruksiStepItem}>
                {"2. Transfer Rp " + totalAkhir.toLocaleString("id-ID") + " ke nomor di atas"}
              </Text>
              <Text style={S.instruksiStepItem}>3. Simpan bukti transfer</Text>
              <Text style={S.instruksiStepItem}>
                4. Kirim bukti ke toko (WA / tunjukkan langsung)
              </Text>
              <Text style={S.instruksiStepItem}>5. Kasir verifikasi & kirim kurir</Text>
            </Card.Content>
          </Card>
        )}

        {/* Instruksi QRIS */}
        {selectedMethod && selectedMethod.id === "qris" && (
          <Card style={S.instruksiCard} mode="outlined">
            <Card.Content>
              <Text style={S.instruksiMethodTitle}>📱 QRIS</Text>
              <Text style={S.instruksiRow}>
                Scan kode QRIS dari toko menggunakan aplikasi dompet digital (GoPay, OVO, Dana, dll).
              </Text>
              <Divider style={S.divider} />
              <Text style={S.instruksiStep}>Langkah pembayaran:</Text>
              <Text style={S.instruksiStepItem}>1. Buka aplikasi dompet digital</Text>
              <Text style={S.instruksiStepItem}>
                {"2. Scan QRIS & masukkan nominal Rp " + totalAkhir.toLocaleString("id-ID")}
              </Text>
              <Text style={S.instruksiStepItem}>3. Tunjukkan bukti bayar ke kasir</Text>
              <Text style={S.instruksiStepItem}>4. Kasir verifikasi & kirim kurir</Text>
            </Card.Content>
          </Card>
        )}

        <View style={S.waitingBox}>
          <Text style={S.waitingIcon}>⏳</Text>
          <Text style={S.waitingText}>
            Setelah kasir menerima bukti bayar, pesanan akan dikonfirmasi dan kurir segera dikirim.
          </Text>
        </View>

        <Button
          mode="contained" buttonColor={GREEN}
          style={S.doneBtn} icon="check-circle"
          onPress={onCheckoutDone}
        >
          Lihat Status Pesanan
        </Button>
      </ScrollView>

      {/* ── Modal Simulasi Pembayaran Mayar.id (Sandbox / Tanpa 404 - Di luar ScrollView) ── */}
      <Modal visible={showMayarModal} transparent animationType="slide" onRequestClose={() => setShowMayarModal(false)}>
        <View style={S.mayarOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShowMayarModal(false)} />
          <View style={S.mayarSheet}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={{ backgroundColor: "#EEF2FF", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
                  <Text style={{ fontSize: 13, fontWeight: "900", color: "#4338CA" }}>{"mayar.id"}</Text>
                </View>
                <Text style={{ fontSize: 16, fontWeight: "800", color: "#1E293B" }}>{"Pembayaran Online"}</Text>
              </View>
              <TouchableOpacity onPress={() => setShowMayarModal(false)}>
                <Text style={{ fontSize: 20, color: "#64748B", fontWeight: "700" }}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={{ backgroundColor: "#F8FAFC", borderRadius: 14, padding: 14, alignItems: "center", marginBottom: 14, borderWidth: 1, borderColor: "#E2E8F0" }}>
              <Text style={{ fontSize: 12, color: "#64748B" }}>{"Total Tagihan Pesanan:"}</Text>
              <Text style={{ fontSize: 26, fontWeight: "900", color: "#2563EB", marginVertical: 2 }}>
                {"Rp " + totalAkhir.toLocaleString("id-ID")}
              </Text>
              <Text style={{ fontSize: 11, color: "#16A34A", fontWeight: "700" }}>
                {"✅ ID Transaksi: #" + (mayarPaymentResult?.id || "TWD-MAYAR")}
              </Text>
            </View>

            {/* Simulasi QRIS */}
            <View style={{ backgroundColor: "#fff", borderRadius: 16, padding: 16, alignItems: "center", marginBottom: 16, borderWidth: 1.5, borderColor: "#E2E8F0" }}>
              <Text style={{ fontSize: 13, fontWeight: "800", color: "#1E293B", marginBottom: 4 }}>
                {"📱 SCAN QRIS PEMBAYARAN"}
              </Text>
              <Text style={{ fontSize: 11, color: "#64748B", marginBottom: 12 }}>
                {"Bisa di-scan menggunakan DANA, GoPay, OVO, ShopeePay, BCA, dll."}
              </Text>
              <View style={{ width: 160, height: 160, backgroundColor: "#F1F5F9", borderRadius: 12, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "#CBD5E1", marginBottom: 10 }}>
                <Text style={{ fontSize: 56 }}>{"📱"}</Text>
                <Text style={{ fontSize: 11, fontWeight: "800", color: "#475569", marginTop: 4 }}>
                  {"[QRIS CODE MAYAR.ID]"}
                </Text>
              </View>
              <Text style={{ fontSize: 11, color: "#2563EB", fontWeight: "700" }}>
                {"Nomor VA Mandiri / BCA: 88910" + Math.floor(10000000 + Math.random() * 90000000)}
              </Text>
            </View>

            <View style={{ backgroundColor: "#FEF2F2", borderRadius: 10, padding: 10, marginBottom: 14 }}>
              <Text style={{ fontSize: 11, color: "#B91C1C", textAlign: "center" }}>
                {"💡 Info: Anda sedang berada dalam Mode Simulasi/Sandbox. Untuk menghubungkan ke halaman bayar Mayar.id asli Anda, paste Link Pembayaran Anda di menu Pengaturan Pembayaran Owner!"}
              </Text>
            </View>

            <TouchableOpacity
              style={{ backgroundColor: "#10B981", borderRadius: 14, paddingVertical: 14, alignItems: "center", elevation: 2 }}
              onPress={() => {
                setShowMayarModal(false);
                Alert.alert("Pembayaran Sukses ✅", "Transaksi telah terverifikasi oleh Mayar.id! Pesanan Anda sedang disiapkan oleh Kasir.");
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>
                {"✅ Bayar Sekarang (Simulasi Sukses)"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const S = StyleSheet.create({
  root:                 { flex: 1, backgroundColor: "#F7FAF7" },
  header:               { backgroundColor: "#2E7D32", padding: 16, paddingTop: 20 },
  headerTitle:          { fontSize: 18, fontWeight: "800", color: "#FFF" },
  headerSubtitle:       { fontSize: 13, color: "#C8E6C9", marginTop: 4 },
  backBtn:              { marginBottom: 8 },
  backBtnText:          { color: "#C8E6C9", fontSize: 13 },
  emptyBox:             { alignItems: "center", paddingTop: 80 },
  emptyIcon:            { fontSize: 48, marginBottom: 12 },
  emptyTitle:           { fontSize: 16, fontWeight: "800", color: "#333" },
  emptySubtitle:        { fontSize: 12, color: "#AAA", marginTop: 4, textAlign: "center" },
  productCard:          { margin: 12, marginBottom: 4, borderColor: "#E1EEE1" },
  productRow:           { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 12 },
  productInfo:          { flex: 1, paddingRight: 8 },
  productName:          { fontSize: 14, fontWeight: "700", color: "#1F2D1F" },
  productPrice:         { fontSize: 13, color: "#2E7D32", fontWeight: "700", marginTop: 2 },
  productStok:          { fontSize: 11, color: "#888", marginTop: 1 },
  qtyControl:           { flexDirection: "row", alignItems: "center" },
  qtyText:              { minWidth: 24, textAlign: "center", fontWeight: "800", fontSize: 16, color: "#2E7D32" },
  summaryCard:          { margin: 12, borderColor: "#E1EEE1" },
  sectionLabel:         { fontSize: 13, fontWeight: "700", color: "#1B5E20", marginBottom: 10 },
  summaryRow:           { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  summaryItemName:      { fontSize: 13, color: "#1F2D1F", flex: 1 },
  summaryItemPrice:     { fontSize: 13, fontWeight: "700", color: "#1F2D1F" },
  summaryMuted:         { fontSize: 12, color: "#888" },
  totalLabel:           { fontSize: 14, fontWeight: "800", color: "#1B5E20" },
  totalValue:           { fontSize: 15, fontWeight: "900", color: "#2E7D32" },
  divider:              { marginVertical: 8 },
  formCard:             { margin: 12, marginTop: 4, borderColor: "#E1EEE1" },
  input:                { backgroundColor: "#FFF", marginBottom: 8 },
  infoCard:             { margin: 12, marginBottom: 4, borderColor: "#E1EEE1" },
  infoText:             { fontSize: 13, color: "#555", lineHeight: 20 },
  noMethodText:         { fontSize: 13, color: "#C62828", textAlign: "center" },
  methodCard:           { margin: 12, marginBottom: 4, borderColor: "#E1EEE1", borderWidth: 1.5 },
  methodCardActive:     { borderColor: "#2E7D32", borderWidth: 2 },
  methodRow:            { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  methodLeft:           { flexDirection: "row", alignItems: "center", flex: 1, gap: 12 },
  methodIcon:           { fontSize: 24 },
  methodLabelBox:       { flex: 1 },
  methodLabel:          { fontSize: 15, fontWeight: "700", color: "#333" },
  methodLabelActive:    { color: "#2E7D32" },
  methodDetail:         { fontSize: 11, color: "#888", marginTop: 2 },
  radioCircle:          { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: "#CCC", alignItems: "center", justifyContent: "center" },
  radioCircleActive:    { borderColor: "#2E7D32" },
  radioInner:           { width: 12, height: 12, borderRadius: 6, backgroundColor: "#2E7D32" },
  methodDetailBox:      { backgroundColor: "#E8F5E9", borderRadius: 10, padding: 12, marginTop: 10 },
  methodDetailText:     { fontSize: 13, color: "#2E7D32", fontWeight: "600" },
  methodAccNum:         { fontSize: 20, fontWeight: "900", color: "#1B5E20", letterSpacing: 2, marginVertical: 6 },
  methodNote:           { fontSize: 11, color: "#888", marginTop: 4 },
  // ✅ Styles baru untuk DOKU bank selector
  bankSelectorBox:      { backgroundColor: "#E8F5E9", borderRadius: 10, padding: 12, marginTop: 10 },
  bankSelectorLabel:    { fontSize: 12, fontWeight: "700", color: "#1B5E20", marginBottom: 8 },
  bankGrid:             { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  bankChip:             { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1.5, borderColor: "#A5D6A7", backgroundColor: "#FFF" },
  bankChipActive:       { backgroundColor: "#2E7D32", borderColor: "#2E7D32" },
  bankChipText:         { fontSize: 13, fontWeight: "700", color: "#2E7D32" },
  bankChipTextActive:   { color: "#FFF" },
  bankSelectedInfo:     { fontSize: 11, color: "#388E3C", marginTop: 8, fontStyle: "italic" },
  // ✅ Styles baru untuk instruksi DOKU
  instruksiAccLabel:    { fontSize: 11, color: "#888", marginBottom: 4 },
  instruksiExpiry:      { fontSize: 11, color: "#E65100", marginTop: 4, marginBottom: 4 },
  dokuErrorBox:         { backgroundColor: "#FFF3E0", borderRadius: 8, padding: 10, marginBottom: 10 },
  dokuErrorText:        { fontSize: 12, color: "#E65100", lineHeight: 18 },
  // Existing styles
  footer:               { padding: 16, backgroundColor: "#FFF", borderTopWidth: 1, borderTopColor: "#E1EEE1" },
  footerSummary:        { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  footerQty:            { fontSize: 13, color: "#888" },
  footerTotal:          { fontSize: 15, fontWeight: "800", color: "#2E7D32" },
  footerBtn:            { borderRadius: 10 },
  footerBtnContent:     { paddingVertical: 4 },
  instruksiHeader:      { alignItems: "center", padding: 32, paddingBottom: 16 },
  instruksiCheckmark:   { fontSize: 56, marginBottom: 12 },
  instruksiTitle:       { fontSize: 22, fontWeight: "900", color: "#1B5E20" },
  instruksiSubtitle:    { fontSize: 13, color: "#5E6E5E", marginTop: 6, textAlign: "center" },
  instruksiAmountCard:  { margin: 16, marginBottom: 8, borderColor: "#2E7D32", borderWidth: 2 },
  instruksiAmountLabel: { fontSize: 12, color: "#888", marginBottom: 4 },
  instruksiAmount:      { fontSize: 28, fontWeight: "900", color: "#2E7D32" },
  instruksiCard:        { margin: 16, marginTop: 8, borderColor: "#E1EEE1" },
  instruksiMethodTitle: { fontSize: 16, fontWeight: "800", color: "#1B5E20", marginBottom: 10 },
  instruksiRow:         { fontSize: 13, color: "#555", lineHeight: 20, marginBottom: 4 },
  instruksiAccBox:      { backgroundColor: "#E8F5E9", borderRadius: 10, padding: 12, marginVertical: 8, alignItems: "center" },
  instruksiAccNum:      { fontSize: 24, fontWeight: "900", color: "#1B5E20", letterSpacing: 3 },
  instruksiStep:        { fontSize: 13, fontWeight: "700", color: "#1B5E20", marginBottom: 8, marginTop: 4 },
  instruksiStepItem:    { fontSize: 13, color: "#444", paddingVertical: 3, paddingLeft: 4 },
  waitingBox:           { flexDirection: "row", alignItems: "flex-start", backgroundColor: "#FFF3E0", margin: 16, marginTop: 8, borderRadius: 12, padding: 14, gap: 10 },
  waitingIcon:          { fontSize: 20 },
  waitingText:          { fontSize: 13, color: "#E65100", lineHeight: 20, flex: 1 },
  doneBtn:              { margin: 16, borderRadius: 10 },
  mayarOverlay:         { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", padding: 20 },
  mayarSheet:           { backgroundColor: "#fff", borderRadius: 24, padding: 20, elevation: 10 },
});