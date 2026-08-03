import React, { useState } from "react";
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from "react-native";

// ─── Constants ────────────────────────────────────────────────────────────────
const PB_STYLE   = { paddingBottom: 48 } as const;
const FLEX_ONE   = { flex: 1 } as const;

type BusinessType = {
  id:          string;
  icon:        string;
  nama:        string;
  deskripsi:   string;
  color:       string;
  contohProduk: string[];
  fiturUtama:  string[];
  omzetDemo:   string;
};

const BUSINESS_TYPES: BusinessType[] = [
  {
    id:          "warung",
    icon:        "🏪",
    nama:        "Warung / Toko Kelontong",
    deskripsi:   "Cocok untuk toko kebutuhan sehari-hari, sembako, dan produk rumah tangga",
    color:       "#16A34A",
    contohProduk: ["Beras 5kg", "Minyak Goreng", "Gula Pasir", "Kopi Sachet", "Sabun Mandi"],
    fiturUtama:  ["Kasir digital", "Stok otomatis", "Laporan harian", "Hutang pelanggan"],
    omzetDemo:   "Rp 2.500.000/hari",
  },
  {
    id:          "minimarket",
    icon:        "🛒",
    nama:        "Minimarket",
    deskripsi:   "Untuk toko modern dengan banyak SKU dan multiple kasir",
    color:       "#2563EB",
    contohProduk: ["Indomie Goreng", "Aqua 600ml", "Teh Botol", "Roti Tawar", "Susu UHT"],
    fiturUtama:  ["Multi kasir", "Barcode scanner", "Diskon & promo", "Laporan per shift"],
    omzetDemo:   "Rp 8.000.000/hari",
  },
  {
    id:          "cafe",
    icon:        "☕",
    nama:        "Cafe / Kedai Kopi",
    deskripsi:   "Kelola menu minuman, makanan ringan, dan pesanan meja",
    color:       "#92400E",
    contohProduk: ["Es Kopi Susu", "Matcha Latte", "Croissant", "Sandwich", "Smoothie Bowl"],
    fiturUtama:  ["Menu digital", "Order per meja", "Nota custom", "Rekap harian"],
    omzetDemo:   "Rp 1.800.000/hari",
  },
  {
    id:          "restoran",
    icon:        "🍽️",
    nama:        "Restoran / Rumah Makan",
    deskripsi:   "Untuk restoran dengan menu lengkap, paket makan, dan delivery",
    color:       "#DC2626",
    contohProduk: ["Nasi Goreng", "Soto Ayam", "Ayam Bakar", "Es Teh Manis", "Paket Hemat"],
    fiturUtama:  ["Menu per kategori", "Paket bundling", "Kurir delivery", "Split bill"],
    omzetDemo:   "Rp 4.200.000/hari",
  },
  {
    id:          "barbershop",
    icon:        "✂️",
    nama:        "Barbershop / Salon",
    deskripsi:   "Kelola layanan potong rambut, booking, dan produk perawatan",
    color:       "#7C3AED",
    contohProduk: ["Potong Rambut", "Cuci Blow", "Catok", "Semir Rambut", "Produk Styling"],
    fiturUtama:  ["Booking jadwal", "Riwayat pelanggan", "Komisi stylist", "Laporan layanan"],
    omzetDemo:   "Rp 950.000/hari",
  },
  {
    id:          "laundry",
    icon:        "👕",
    nama:        "Laundry",
    deskripsi:   "Kelola order laundry, kiloan, satuan, dan pengambilan",
    color:       "#0891B2",
    contohProduk: ["Cuci Kiloan", "Cuci Satuan", "Express 3 Jam", "Setrika Only", "Dry Clean"],
    fiturUtama:  ["Status order", "Notif siap ambil", "Antar jemput", "Kartu member"],
    omzetDemo:   "Rp 750.000/hari",
  },
  {
    id:          "apotek",
    icon:        "💊",
    nama:        "Apotek / Toko Obat",
    deskripsi:   "Stok obat, resep dokter, dan notifikasi kadaluarsa",
    color:       "#059669",
    contohProduk: ["Paracetamol", "Vitamin C", "Masker", "Antasida", "Obat Batuk"],
    fiturUtama:  ["Cek kedaluarsa", "Stok minimum", "Kategori obat", "Riwayat resep"],
    omzetDemo:   "Rp 1.200.000/hari",
  },
  {
    id:          "fashion",
    icon:        "👗",
    nama:        "Toko Fashion / Pakaian",
    deskripsi:   "Kelola stok pakaian per size & warna, diskon, dan konsinyasi",
    color:       "#DB2777",
    contohProduk: ["Kaos Polos S/M/L", "Celana Jeans", "Dress Casual", "Jaket", "Aksesori"],
    fiturUtama:  ["Variasi produk", "Foto produk", "Diskon timed", "Konsinyasi"],
    omzetDemo:   "Rp 2.100.000/hari",
  },
];

type Props = {
  onClose:          () => void;
  onRegisterOwner?: () => void;
  accentColor?:     string;
};

export default function DemoScreen({ onClose, onRegisterOwner, accentColor = "#2563EB" }: Props) {
  const [selectedBiz, setSelectedBiz] = useState<BusinessType | null>(null);
  const [demoStep,    setDemoStep]    = useState<"list" | "detail" | "kasir">("list");

  // ─── Demo Kasir State (simulasi) ──────────────────────────────────────────
  const [cart, setCart] = useState<Record<string, number>>({});

  const addToCart = (produk: string) => {
    setCart(prev => ({ ...prev, [produk]: (prev[produk] ?? 0) + 1 }));
  };

  const removeFromCart = (produk: string) => {
    setCart(prev => {
      const updated = { ...prev };
      if ((updated[produk] ?? 0) <= 1) { delete updated[produk]; }
      else { updated[produk]--; }
      return updated;
    });
  };

  const cartTotal = Object.keys(cart).length;
  const demoHarga = 15_000;
  const totalBayar = Object.values(cart).reduce((s, q) => s + q * demoHarga, 0);

  // ─── Render List ──────────────────────────────────────────────────────────
  const renderList = () => (
    <ScrollView contentContainerStyle={PB_STYLE}>
      <View style={[S.demoHeader, { backgroundColor: accentColor }]}>
        <Text style={S.demoHeaderTitle}>🎮 Mode Demo</Text>
        <Text style={S.demoHeaderSub}>
          Pilih jenis bisnis untuk melihat simulasi aplikasi
        </Text>
      </View>

      <View style={S.demoBanner}>
        <Text style={S.demoBannerTxt}>
          ✨ Tidak perlu daftar! Coba dulu, daftar kemudian.
        </Text>
      </View>

      <Text style={S.bizListTitle}>Pilih Jenis Bisnis:</Text>

      {BUSINESS_TYPES.map(biz => (
        <TouchableOpacity
          key={biz.id}
          style={S.bizCard}
          onPress={() => { setSelectedBiz(biz); setDemoStep("detail"); setCart({}); }}
        >
          <View style={[S.bizIconBox, { backgroundColor: biz.color + "18" }]}>
            <Text style={S.bizIcon}>{biz.icon}</Text>
          </View>
          <View style={FLEX_ONE}>
            <Text style={S.bizNama}>{biz.nama}</Text>
            <Text style={S.bizDesc} numberOfLines={2}>{biz.deskripsi}</Text>
          </View>
          <Text style={S.bizChevron}>›</Text>
        </TouchableOpacity>
      ))}

      <TouchableOpacity style={S.closeBtn} onPress={onClose}>
        <Text style={S.closeTxt}>Kembali</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  // ─── Render Detail Bisnis ─────────────────────────────────────────────────
  const renderDetail = () => {
    if (!selectedBiz) return null;
    return (
      <ScrollView contentContainerStyle={PB_STYLE}>
        {/* Header bisnis */}
        <View style={[S.bizDetailHeader, { backgroundColor: selectedBiz.color }]}>
          <TouchableOpacity onPress={() => setDemoStep("list")} style={S.backBtnWhite}>
            <Text style={S.backBtnTxt}>← Kembali</Text>
          </TouchableOpacity>
          <Text style={S.bizDetailIcon}>{selectedBiz.icon}</Text>
          <Text style={S.bizDetailNama}>{selectedBiz.nama}</Text>
          <Text style={S.bizDetailDesc}>{selectedBiz.deskripsi}</Text>
          <View style={S.omzetBadge}>
            <Text style={S.omzetTxt}>📈 Demo omzet: {selectedBiz.omzetDemo}</Text>
          </View>
        </View>

        {/* Fitur utama */}
        <View style={S.detailSection}>
          <Text style={S.detailSectionTitle}>🚀 Fitur Utama</Text>
          {selectedBiz.fiturUtama.map(f => (
            <View key={f} style={S.fiturRow}>
              <Text style={[S.fiturDot, { color: selectedBiz.color }]}>✓</Text>
              <Text style={S.fiturTxt}>{f}</Text>
            </View>
          ))}
        </View>

        {/* Contoh produk */}
        <View style={S.detailSection}>
          <Text style={S.detailSectionTitle}>📦 Contoh Produk</Text>
          <View style={S.produkChipRow}>
            {selectedBiz.contohProduk.map(p => (
              <View key={p} style={[S.produkChip, { borderColor: selectedBiz.color }]}>
                <Text style={[S.produkChipTxt, { color: selectedBiz.color }]}>{p}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Demo kasir button */}
        <TouchableOpacity
          style={[S.demoKasirBtn, { backgroundColor: selectedBiz.color }]}
          onPress={() => setDemoStep("kasir")}
        >
          <Text style={S.demoKasirTxt}>🖥️ Coba Demo Kasir</Text>
        </TouchableOpacity>

        {/* CTA Daftar */}
        <View style={S.ctaCard}>
          <Text style={S.ctaTitle}>Tertarik dengan bisnis ini?</Text>
          <Text style={S.ctaSub}>
            Daftar sekarang dan dapatkan uji coba gratis 3 hari!
          </Text>
          <TouchableOpacity
            style={[S.ctaBtn, { backgroundColor: selectedBiz.color }]}
            onPress={() => {
              onRegisterOwner?.();
              onClose();
            }}
          >
            <Text style={S.ctaBtnTxt}>🎁 Daftar — Coba Gratis 3 Hari</Text>
          </TouchableOpacity>
          <Text style={S.ctaNote}>
            Tidak perlu kartu kredit · Bisa cancel kapan saja
          </Text>
        </View>

        <TouchableOpacity style={S.closeBtn} onPress={onClose}>
          <Text style={S.closeTxt}>Tutup Demo</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  };

  // ─── Demo Kasir Simulasi ──────────────────────────────────────────────────
  const renderKasir = () => {
    if (!selectedBiz) return null;
    return (
      <View style={FLEX_ONE}>
        {/* Header kasir demo */}
        <View style={[S.kasirHeader, { backgroundColor: selectedBiz.color }]}>
          <TouchableOpacity onPress={() => setDemoStep("detail")} style={S.backBtnWhite}>
            <Text style={S.backBtnTxt}>← Detail</Text>
          </TouchableOpacity>
          <Text style={S.kasirHeaderTitle}>Demo Kasir — {selectedBiz.nama}</Text>
          <View style={S.kasirBadge}>
            <Text style={S.kasirBadgeTxt}>🎮 DEMO</Text>
          </View>
        </View>

        <View style={S.kasirBody}>
          {/* Produk list */}
          <View style={S.kasirProducts}>
            <Text style={S.kasirSectionTitle}>Pilih Produk</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {selectedBiz.contohProduk.map(p => {
                const qty = cart[p] ?? 0;
                return (
                  <View key={p} style={S.kasirProdRow}>
                    <View style={FLEX_ONE}>
                      <Text style={S.kasirProdNama}>{p}</Text>
                      <Text style={S.kasirProdHarga}>Rp {demoHarga.toLocaleString()}</Text>
                    </View>
                    <View style={S.qtyRow}>
                      <TouchableOpacity
                        style={S.qtyBtn}
                        onPress={() => removeFromCart(p)}
                        disabled={qty === 0}
                      >
                        <Text style={S.qtyBtnTxt}>−</Text>
                      </TouchableOpacity>
                      <Text style={S.qtyTxt}>{qty}</Text>
                      <TouchableOpacity
                        style={[S.qtyBtn, { backgroundColor: selectedBiz.color }]}
                        onPress={() => addToCart(p)}
                      >
                        <Text style={[S.qtyBtnTxt, { color: "#fff" }]}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          </View>

          {/* Ringkasan & bayar */}
          <View style={S.kasirSummary}>
            <Text style={S.kasirSectionTitle}>Ringkasan</Text>
            {cartTotal === 0 ? (
              <Text style={S.kasirEmptyCart}>Belum ada produk dipilih</Text>
            ) : (
              <>
                {Object.entries(cart).map(([p, q]) => (
                  <View key={p} style={S.summaryRow}>
                    <Text style={S.summaryNama} numberOfLines={1}>{p}</Text>
                    <Text style={S.summaryQty}>×{q}</Text>
                    <Text style={S.summaryHarga}>
                      Rp {(q * demoHarga).toLocaleString()}
                    </Text>
                  </View>
                ))}
                <View style={S.summaryTotal}>
                  <Text style={S.summaryTotalLbl}>TOTAL</Text>
                  <Text style={[S.summaryTotalVal, { color: selectedBiz.color }]}>
                    Rp {totalBayar.toLocaleString()}
                  </Text>
                </View>
              </>
            )}

            <TouchableOpacity
              style={[
                S.bayarBtn,
                { backgroundColor: cartTotal > 0 ? selectedBiz.color : "#CBD5E1" },
              ]}
              onPress={() => {
                if (cartTotal === 0) return;
                setCart({});
                // Simulasi konfirmasi
              }}
              disabled={cartTotal === 0}
            >
              <Text style={S.bayarBtnTxt}>
                {cartTotal > 0 ? `💳 Bayar Rp ${totalBayar.toLocaleString()}` : "Pilih produk dulu"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[S.daftarNowBtn, { borderColor: selectedBiz.color }]}
              onPress={() => { onRegisterOwner?.(); onClose(); }}
            >
              <Text style={[S.daftarNowTxt, { color: selectedBiz.color }]}>
                🎁 Daftar Sekarang — Gratis 3 Hari
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={S.root}>
      {demoStep === "list"   && renderList()}
      {demoStep === "detail" && renderDetail()}
      {demoStep === "kasir"  && renderKasir()}
    </View>
  );
}

const S = StyleSheet.create({
  root:               { flex: 1, backgroundColor: "#F1F5F9" },
  // Demo header
  demoHeader:         { paddingTop: 52, paddingBottom: 24, paddingHorizontal: 20, alignItems: "center" },
  demoHeaderTitle:    { color: "#fff", fontSize: 24, fontWeight: "800", marginBottom: 6 },
  demoHeaderSub:      { color: "rgba(255,255,255,0.85)", fontSize: 13, textAlign: "center" },
  demoBanner:         { backgroundColor: "#FEF9C3", margin: 16, borderRadius: 12, padding: 12, borderLeftWidth: 4, borderLeftColor: "#EAB308" },
  demoBannerTxt:      { fontSize: 13, color: "#854D0E", fontWeight: "600", textAlign: "center" },
  bizListTitle:       { fontSize: 15, fontWeight: "800", color: "#1E293B", marginHorizontal: 16, marginBottom: 8 },
  bizCard:            { backgroundColor: "#fff", borderRadius: 14, marginHorizontal: 16, marginBottom: 10, padding: 14, flexDirection: "row", alignItems: "center", gap: 12, elevation: 2 },
  bizIconBox:         { width: 50, height: 50, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  bizIcon:            { fontSize: 26 },
  bizNama:            { fontSize: 14, fontWeight: "800", color: "#1E293B", marginBottom: 3 },
  bizDesc:            { fontSize: 12, color: "#64748B", lineHeight: 17 },
  bizChevron:         { fontSize: 24, color: "#CBD5E1" },
  closeBtn:           { margin: 16, padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: "#CBD5E1", alignItems: "center" },
  closeTxt:           { color: "#64748B", fontWeight: "700" },
  // Detail
  bizDetailHeader:    { paddingTop: 52, paddingBottom: 28, paddingHorizontal: 20, alignItems: "center" },
  backBtnWhite:       { alignSelf: "flex-start", marginBottom: 16 },
  backBtnTxt:         { color: "rgba(255,255,255,0.9)", fontWeight: "700", fontSize: 14 },
  bizDetailIcon:      { fontSize: 52, marginBottom: 8 },
  bizDetailNama:      { color: "#fff", fontSize: 20, fontWeight: "800", textAlign: "center" },
  bizDetailDesc:      { color: "rgba(255,255,255,0.85)", fontSize: 13, textAlign: "center", marginTop: 6, lineHeight: 18 },
  omzetBadge:         { backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6, marginTop: 12 },
  omzetTxt:           { color: "#fff", fontSize: 12, fontWeight: "700" },
  detailSection:      { backgroundColor: "#fff", borderRadius: 14, margin: 16, marginBottom: 4, padding: 16, elevation: 2 },
  detailSectionTitle: { fontSize: 14, fontWeight: "800", color: "#1E293B", marginBottom: 10 },
  fiturRow:           { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 5 },
  fiturDot:           { fontSize: 16, fontWeight: "800" },
  fiturTxt:           { fontSize: 13, color: "#374151" },
  produkChipRow:      { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  produkChip:         { borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  produkChipTxt:      { fontSize: 12, fontWeight: "600" },
  demoKasirBtn:       { margin: 16, padding: 16, borderRadius: 14, alignItems: "center", elevation: 2 },
  demoKasirTxt:       { color: "#fff", fontWeight: "800", fontSize: 15 },
  ctaCard:            { backgroundColor: "#fff", borderRadius: 14, margin: 16, padding: 20, elevation: 3, alignItems: "center" },
  ctaTitle:           { fontSize: 16, fontWeight: "800", color: "#1E293B", marginBottom: 6 },
  ctaSub:             { fontSize: 13, color: "#64748B", textAlign: "center", marginBottom: 16, lineHeight: 18 },
  ctaBtn:             { width: "100%", padding: 16, borderRadius: 14, alignItems: "center", marginBottom: 10 },
  ctaBtnTxt:          { color: "#fff", fontWeight: "800", fontSize: 15 },
  ctaNote:            { fontSize: 11, color: "#94A3B8" },
  // Kasir demo
  kasirHeader:        { paddingTop: 52, paddingBottom: 14, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 10 },
  kasirHeaderTitle:   { flex: 1, color: "#fff", fontSize: 15, fontWeight: "800" },
  kasirBadge:         { backgroundColor: "rgba(255,255,255,0.25)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  kasirBadgeTxt:      { color: "#fff", fontSize: 11, fontWeight: "800" },
  kasirBody:          { flex: 1, flexDirection: "row" },
  kasirProducts:      { flex: 1, backgroundColor: "#F8FAFC", padding: 12, borderRightWidth: 1, borderRightColor: "#E2E8F0" },
  kasirSummary:       { width: 180, backgroundColor: "#fff", padding: 12 },
  kasirSectionTitle:  { fontSize: 13, fontWeight: "800", color: "#1E293B", marginBottom: 10 },
  kasirProdRow:       { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 10, padding: 10, marginBottom: 8, elevation: 1 },
  kasirProdNama:      { fontSize: 13, fontWeight: "700", color: "#1E293B" },
  kasirProdHarga:     { fontSize: 11, color: "#64748B", marginTop: 2 },
  qtyRow:             { flexDirection: "row", alignItems: "center", gap: 8 },
  qtyBtn:             { width: 28, height: 28, borderRadius: 8, backgroundColor: "#F1F5F9", alignItems: "center", justifyContent: "center" },
  qtyBtnTxt:          { fontSize: 18, fontWeight: "700", color: "#1E293B", lineHeight: 22 },
  qtyTxt:             { fontSize: 15, fontWeight: "700", color: "#1E293B", minWidth: 20, textAlign: "center" },
  kasirEmptyCart:     { fontSize: 12, color: "#94A3B8", textAlign: "center", marginTop: 20, fontStyle: "italic" },
  summaryRow:         { flexDirection: "row", alignItems: "center", marginBottom: 6, gap: 4 },
  summaryNama:        { flex: 1, fontSize: 11, color: "#374151" },
  summaryQty:         { fontSize: 11, color: "#64748B", width: 22 },
  summaryHarga:       { fontSize: 11, fontWeight: "700", color: "#1E293B" },
  summaryTotal:       { flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: "#E2E8F0", paddingTop: 8, marginTop: 6, marginBottom: 12 },
  summaryTotalLbl:    { fontSize: 12, fontWeight: "800", color: "#1E293B" },
  summaryTotalVal:    { fontSize: 13, fontWeight: "800" },
  bayarBtn:           { borderRadius: 12, padding: 12, alignItems: "center", marginBottom: 8 },
  bayarBtnTxt:        { color: "#fff", fontWeight: "800", fontSize: 12 },
  daftarNowBtn:       { borderWidth: 2, borderRadius: 12, padding: 10, alignItems: "center" },
  daftarNowTxt:       { fontSize: 11, fontWeight: "800" },
});