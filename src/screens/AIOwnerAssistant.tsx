// src/screens/AIOwnerAssistant.tsx
// v2 — fix: quick question tidak ada respons

import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useRef, useState } from "react";
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

// ─── Types ────────────────────────────────────────────────────────────────────

type PaketMkt = "basic" | "pro" | "enterprise";

interface Order {
  id:        string;
  ownerId:   string;
  kasirId?:  string;
  kasirName: string;
  items:     Array<{ productId: string; name: string; price: number; qty: number }>;
  total:     number;
  createdAt: string;
  tanggal?:  string;
}

interface StoreProduct {
  id:        string;
  ownerId:   string;
  name:      string;
  price:     number;
  buyPrice?: number;
  stock:     number;
  stockMin?: number;
  createdAt: string;
}

interface KasirAccount {
  id:      string;
  ownerId: string;
  name:    string;
}

interface ChatMessage {
  id:        string;
  role:      "user" | "ai";
  text:      string;
  timestamp: number;
}

interface AIOwnerAssistantProps {
  ownerId:   string;
  paket:     PaketMkt;
  onUpgrade: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCENT  = "#2563EB";
const PURPLE  = "#7C3AED";
const SUCCESS = "#16A34A";
const ORANGE  = "#D97706";
const DANGER  = "#DC2626";

const AI_ACCENT: Record<PaketMkt, string> = {
  basic:      "#64748B",
  pro:        ACCENT,
  enterprise: PURPLE,
};

const ORDERS_KEY = "@twd_orders";
const PRODUCTS_KEY = "@twd_products";
const KASIR_KEY = "@twd_kasir_accounts";

const QUICK_QUESTIONS_PRO = [
  "Penjualan hari ini",
  "Produk terlaris",
  "Stok perlu diisi",
  "Omset minggu ini",
  "Kasir terbaik",
];

const QUICK_QUESTIONS_ENTERPRISE = [
  "Penjualan hari ini",
  "Produk terlaris",
  "Stok perlu diisi",
  "Omset minggu ini",
  "Kasir terbaik",
  "Prediksi omset",
  "Saran promo",
  "Analisis lengkap",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRp(n: number): string {
  if (n >= 1_000_000) return "Rp " + (n / 1_000_000).toFixed(1) + " jt";
  if (n >= 1_000)     return "Rp " + (n / 1_000).toFixed(0) + " rb";
  return "Rp " + n.toLocaleString("id-ID");
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function dateStrOf(o: Order): string {
  return o.createdAt?.slice(0, 10) ?? o.tanggal ?? "";
}

function msgId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
}

// ─── AI Engine ────────────────────────────────────────────────────────────────

async function runAIEngine(
  question: string,
  ownerId: string,
  paket: PaketMkt,
): Promise<string> {
  try {
    const [rawOrders, rawProducts, rawKasir] = await Promise.all([
      AsyncStorage.getItem(ORDERS_KEY),
      AsyncStorage.getItem(PRODUCTS_KEY),
      AsyncStorage.getItem(KASIR_KEY),
    ]);

    const allOrders:   Order[]        = rawOrders   ? JSON.parse(rawOrders)   : [];
    const allProducts: StoreProduct[] = rawProducts ? JSON.parse(rawProducts) : [];
    const allKasir:    KasirAccount[] = rawKasir    ? JSON.parse(rawKasir)    : [];

    const myOrders   = allOrders.filter((o) => String(o.ownerId ?? "").trim() === ownerId);
    const myProducts = allProducts.filter((p) => String(p.ownerId ?? "").trim() === ownerId);
    const myKasir    = allKasir.filter((k) => String(k.ownerId ?? "").trim() === ownerId);

    const today     = todayStr();
    const todayOrd  = myOrders.filter((o) => dateStrOf(o) === today);

    const q = question.toLowerCase();

    // ── Penjualan hari ini ──
    if (q.includes("hari ini") || q.includes("penjualan hari")) {
      const omset   = todayOrd.reduce((s, o) => s + (o.total ?? 0), 0);
      const prodQty = todayOrd.reduce((s, o) => s + o.items.reduce((ss, i) => ss + i.qty, 0), 0);
      if (todayOrd.length === 0) {
        return "📊 Hari ini belum ada transaksi yang tercatat di tokomu.";
      }
      return (
        "📊 **Penjualan Hari Ini**\n\n" +
        "• Transaksi: " + todayOrd.length + " order\n" +
        "• Total omset: " + formatRp(omset) + "\n" +
        "• Produk terjual: " + prodQty + " pcs\n" +
        "• Rata-rata per transaksi: " + formatRp(todayOrd.length > 0 ? Math.round(omset / todayOrd.length) : 0)
      );
    }

    // ── Produk terlaris ──
    if (q.includes("terlaris") || q.includes("best seller")) {
      const map: Record<string, { name: string; qty: number; omset: number }> = {};
      myOrders.forEach((o) => {
        o.items.forEach((it) => {
          if (!map[it.name]) map[it.name] = { name: it.name, qty: 0, omset: 0 };
          map[it.name].qty   += it.qty;
          map[it.name].omset += it.price * it.qty;
        });
      });
      const sorted = Object.values(map).sort((a, b) => b.qty - a.qty).slice(0, 5);
      if (sorted.length === 0) return "📦 Belum ada data penjualan untuk menentukan produk terlaris.";
      const lines = sorted.map((p, i) => (i + 1) + ". " + p.name + " — " + p.qty + " pcs (" + formatRp(p.omset) + ")");
      return "🏆 **Top 5 Produk Terlaris**\n\n" + lines.join("\n");
    }

    // ── Stok perlu diisi ──
    if (q.includes("stok") || q.includes("restock") || q.includes("isi")) {
      const low   = myProducts.filter((p) => p.stock > 0 && p.stock <= (p.stockMin ?? 5));
      const empty = myProducts.filter((p) => p.stock === 0);
      if (low.length === 0 && empty.length === 0) {
        return "✅ Semua stok produk di toko kamu masih aman!";
      }
      let result = "📦 **Status Stok Toko**\n\n";
      if (empty.length > 0) {
        result += "🔴 **Stok Habis (" + empty.length + " produk):**\n";
        result += empty.slice(0, 5).map((p) => "• " + p.name + " (0 pcs)").join("\n");
        if (empty.length > 5) result += "\n• ...dan " + (empty.length - 5) + " lainnya";
        result += "\n\n";
      }
      if (low.length > 0) {
        result += "⚠️ **Stok Menipis (" + low.length + " produk):**\n";
        result += low.slice(0, 5).map((p) => "• " + p.name + " (" + p.stock + " pcs)").join("\n");
        if (low.length > 5) result += "\n• ...dan " + (low.length - 5) + " lainnya";
      }
      return result;
    }

    // ── Omset minggu ini ──
    if (q.includes("minggu") || q.includes("omset minggu")) {
      const now   = new Date();
      const day   = now.getDay();
      const diff  = (day + 6) % 7;
      const mondayDate = new Date(now);
      mondayDate.setDate(now.getDate() - diff);
      const weekOrders = myOrders.filter((o) => {
        const d = new Date(dateStrOf(o));
        return d >= mondayDate && d <= now;
      });
      const omset = weekOrders.reduce((s, o) => s + (o.total ?? 0), 0);
      return (
        "📅 **Omset Minggu Ini**\n\n" +
        "• Total transaksi: " + weekOrders.length + "\n" +
        "• Total omset: " + formatRp(omset) + "\n" +
        "• Sejak: " + mondayDate.toLocaleDateString("id-ID", { day: "numeric", month: "long" })
      );
    }

    // ── Kasir terbaik ──
    if (q.includes("kasir") && (q.includes("terbaik") || q.includes("performa") || q.includes("top"))) {
      const map: Record<string, { name: string; trx: number; omset: number }> = {};
      myOrders.forEach((o) => {
        const kName = o.kasirName ?? "Unknown";
        if (!map[kName]) map[kName] = { name: kName, trx: 0, omset: 0 };
        map[kName].trx   += 1;
        map[kName].omset += o.total ?? 0;
      });
      const sorted = Object.values(map).sort((a, b) => b.omset - a.omset).slice(0, 3);
      if (sorted.length === 0) return "👥 Belum ada data transaksi kasir.";
      const lines = sorted.map((k, i) => (i + 1) + ". " + k.name + " — " + k.trx + " trx | " + formatRp(k.omset));
      return "👥 **Performa Kasir**\n\n" + lines.join("\n");
    }

    // ── Prediksi omset (Enterprise) ──
    if ((q.includes("prediksi") || q.includes("forecast")) && paket === "enterprise") {
      const past7: number[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dStr = d.toISOString().slice(0, 10);
        const dayOmset = myOrders.filter((o) => dateStrOf(o) === dStr).reduce((s, o) => s + (o.total ?? 0), 0);
        past7.push(dayOmset);
      }
      const avg    = Math.round(past7.reduce((s, v) => s + v, 0) / 7);
      const trend  = past7[6] >= past7[0] ? "📈 meningkat" : "📉 menurun";
      const predik = Math.round(avg * 7);
      return (
        "🔮 **Prediksi Omset**\n\n" +
        "• Rata-rata harian (7 hari): " + formatRp(avg) + "\n" +
        "• Tren saat ini: " + trend + "\n" +
        "• Prediksi 7 hari ke depan: " + formatRp(predik) + "\n\n" +
        "_Berdasarkan rata-rata 7 hari terakhir._"
      );
    }

    // ── Saran promo (Enterprise) ──
    if ((q.includes("promo") || q.includes("saran")) && paket === "enterprise") {
      const map: Record<string, { name: string; qty: number }> = {};
      myOrders.forEach((o) => {
        o.items.forEach((it) => {
          if (!map[it.name]) map[it.name] = { name: it.name, qty: 0 };
          map[it.name].qty += it.qty;
        });
      });
      const sorted = Object.values(map).sort((a, b) => a.qty - b.qty).slice(0, 3);
      if (sorted.length === 0) return "💡 Belum cukup data untuk memberikan saran promo.";
      const lines = sorted.map((p) => "• " + p.name + " (terjual " + p.qty + " pcs) → coba bundling atau diskon");
      return "💡 **Saran Promo**\n\nProduk ini jarang terjual, pertimbangkan promo:\n\n" + lines.join("\n");
    }

    // ── Analisis lengkap (Enterprise) ──
    if ((q.includes("analisis") || q.includes("lengkap")) && paket === "enterprise") {
      const omsetTotal  = myOrders.reduce((s, o) => s + (o.total ?? 0), 0);
      const omsetToday  = todayOrd.reduce((s, o) => s + (o.total ?? 0), 0);
      const emptyStock  = myProducts.filter((p) => p.stock === 0).length;
      const lowStock    = myProducts.filter((p) => p.stock > 0 && p.stock <= (p.stockMin ?? 5)).length;
      return (
        "📈 **Analisis Lengkap Toko**\n\n" +
        "💰 Omset hari ini: " + formatRp(omsetToday) + "\n" +
        "💰 Total omset (semua waktu): " + formatRp(omsetTotal) + "\n" +
        "🧾 Total transaksi: " + myOrders.length + "\n" +
        "📦 Total produk: " + myProducts.length + "\n" +
        "🔴 Stok habis: " + emptyStock + " produk\n" +
        "⚠️ Stok menipis: " + lowStock + " produk\n" +
        "👥 Jumlah kasir: " + myKasir.length
      );
    }

    return "🤖 Maaf, aku belum bisa menjawab pertanyaan itu. Coba tanyakan soal penjualan, stok, omset, atau kasir.";
  } catch (err) {
    console.error("runAIEngine error:", err);
    return "❌ Terjadi kesalahan saat mengambil data. Coba lagi.";
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AIOwnerAssistant({ ownerId, paket, onUpgrade }: AIOwnerAssistantProps) {
  const [expanded,   setExpanded]   = useState(false);
  const [messages,   setMessages]   = useState<ChatMessage[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const accent = AI_ACCENT[paket];
  const quickQs = paket === "enterprise" ? QUICK_QUESTIONS_ENTERPRISE : QUICK_QUESTIONS_PRO;

  const addMessage = (role: "user" | "ai", text: string) => {
    const msg: ChatMessage = { id: msgId(), role, text, timestamp: Date.now() };
    setMessages((prev) => [...prev, msg]);
    return msg;
  };

  const handleAsk = async (question: string) => {
    if (isThinking) return;

    // Tambah pesan user
    setMessages((prev) => [
      ...prev,
      { id: msgId(), role: "user", text: question, timestamp: Date.now() },
    ]);
    setIsThinking(true);

    // Scroll ke bawah
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      // Simulasi delay thinking (0.8 - 1.5 detik)
      const delay = 800 + Math.random() * 700;
      await new Promise((resolve) => setTimeout(resolve, delay));

      const answer = await runAIEngine(question, ownerId, paket);

      setMessages((prev) => [
        ...prev,
        { id: msgId(), role: "ai", text: answer, timestamp: Date.now() },
      ]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        { id: msgId(), role: "ai", text: "❌ Gagal mendapatkan jawaban. Coba lagi.", timestamp: Date.now() },
      ]);
    } finally {
      setIsThinking(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
    }
  };

  // ── Collapsed card ──
  if (!expanded) {
    return (
      <TouchableOpacity
        style={[S.collapsedCard, { borderColor: accent }]}
        onPress={() => setExpanded(true)}
        activeOpacity={0.85}
      >
        <View style={[S.collapsedDot, { backgroundColor: accent }]}>
          <Text style={S.collapsedDotTxt}>{"AI"}</Text>
        </View>
        <View style={S.collapsedBody}>
          <Text style={[S.collapsedTitle, { color: accent }]}>{"TWD AI Assistant"}</Text>
          <Text style={S.collapsedSub}>
            {paket === "enterprise"
              ? "Analisis lengkap, prediksi omset & saran promo"
              : "Analisis penjualan, stok & performa kasir"}
          </Text>
        </View>
        <Text style={S.collapsedArrow}>{"▶"}</Text>
      </TouchableOpacity>
    );
  }

  // ── Expanded chat ──
  return (
    <View style={[S.expandedCard, { borderColor: accent }]}>
      {/* Header */}
      <View style={[S.chatHeader, { backgroundColor: accent }]}>
        <View style={S.chatHeaderLeft}>
          <Text style={S.chatHeaderIcon}>{"🤖"}</Text>
          <View>
            <Text style={S.chatHeaderTitle}>{"TWD AI Assistant"}</Text>
            <Text style={S.chatHeaderSub}>
              {paket === "enterprise" ? "Enterprise Mode" : "Pro Mode"}
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => setExpanded(false)} style={S.chatCloseBtn}>
          <Text style={S.chatCloseTxt}>{"✕"}</Text>
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollRef}
        style={S.chatScroll}
        contentContainerStyle={S.chatScrollContent}
        showsVerticalScrollIndicator={false}
      >
        {messages.length === 0 && (
          <View style={S.emptyState}>
            <Text style={S.emptyStateIcon}>{"👋"}</Text>
            <Text style={S.emptyStateTxt}>
              {"Halo! Aku AI Assistant tokomu.\nPilih pertanyaan di bawah untuk mulai."}
            </Text>
          </View>
        )}

        {messages.map((msg) => (
          <View
            key={msg.id}
            style={msg.role === "user" ? S.bubbleUserWrap : S.bubbleAiWrap}
          >
            {msg.role === "ai" && (
              <View style={[S.aiBubbleAvatar, { backgroundColor: accent }]}>
                <Text style={S.aiBubbleAvatarTxt}>{"AI"}</Text>
              </View>
            )}
            <View
              style={
                msg.role === "user"
                  ? [S.bubbleUser, { backgroundColor: accent }]
                  : S.bubbleAi
              }
            >
              <Text
                style={msg.role === "user" ? S.bubbleUserTxt : S.bubbleAiTxt}
              >
                {msg.text}
              </Text>
            </View>
          </View>
        ))}

        {isThinking && (
          <View style={S.bubbleAiWrap}>
            <View style={[S.aiBubbleAvatar, { backgroundColor: accent }]}>
              <Text style={S.aiBubbleAvatarTxt}>{"AI"}</Text>
            </View>
            <View style={S.bubbleThinking}>
              <ActivityIndicator size="small" color={accent} />
              <Text style={[S.thinkingTxt, { color: accent }]}>{"Sedang menganalisis..."}</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Quick Questions */}
      <View style={S.quickSection}>
        <Text style={S.quickLabel}>{"Pertanyaan Cepat:"}</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={S.quickScrollContent}
        >
          {quickQs.map((q) => (
            <TouchableOpacity
              key={q}
              style={[
                S.quickBtn,
                { borderColor: accent },
                isThinking && S.quickBtnDisabled,
              ]}
              onPress={() => handleAsk(q)}
              disabled={isThinking}
              activeOpacity={0.7}
            >
              <Text style={[S.quickBtnTxt, { color: accent }, isThinking && S.quickBtnTxtDisabled]}>
                {q}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  collapsedCard:  { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 14, marginHorizontal: 16, marginBottom: 4, padding: 14, gap: 12, borderWidth: 1.5, elevation: 2 },
  collapsedDot:   { width: 44, height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center" },
  collapsedDotTxt:{ color: "#fff", fontWeight: "900", fontSize: 13 },
  collapsedBody:  { flex: 1 },
  collapsedTitle: { fontSize: 14, fontWeight: "800", marginBottom: 2 },
  collapsedSub:   { fontSize: 11, color: "#64748B" },
  collapsedArrow: { color: "#CBD5E1", fontSize: 12 },
  expandedCard:     { backgroundColor: "#fff", borderRadius: 16, marginHorizontal: 16, marginBottom: 4, borderWidth: 1.5, overflow: "hidden", elevation: 3 },
  chatHeader:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14 },
  chatHeaderLeft:   { flexDirection: "row", alignItems: "center", gap: 10 },
  chatHeaderIcon:   { fontSize: 22 },
  chatHeaderTitle:  { color: "#fff", fontSize: 14, fontWeight: "800" },
  chatHeaderSub:    { color: "rgba(255,255,255,0.75)", fontSize: 10, marginTop: 1 },
  chatCloseBtn:     { backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  chatCloseTxt:     { color: "#fff", fontWeight: "700", fontSize: 13 },
  chatScroll:        { maxHeight: 300 },
  chatScrollContent: { padding: 14, gap: 10 },
  emptyState:        { alignItems: "center", paddingVertical: 24 },
  emptyStateIcon:    { fontSize: 36, marginBottom: 10 },
  emptyStateTxt:     { fontSize: 13, color: "#94A3B8", textAlign: "center", lineHeight: 20 },
  bubbleUserWrap: { flexDirection: "row", justifyContent: "flex-end", marginBottom: 8 },
  bubbleAiWrap:   { flexDirection: "row", alignItems: "flex-end", gap: 8, marginBottom: 8 },
  aiBubbleAvatar:    { width: 28, height: 28, borderRadius: 14, justifyContent: "center", alignItems: "center" },
  aiBubbleAvatarTxt: { color: "#fff", fontWeight: "800", fontSize: 9 },
  bubbleUser:    { maxWidth: "80%", borderRadius: 14, borderBottomRightRadius: 4, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleUserTxt: { color: "#fff", fontSize: 13, lineHeight: 20 },
  bubbleAi:      { maxWidth: "78%", backgroundColor: "#F1F5F9", borderRadius: 14, borderBottomLeftRadius: 4, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleAiTxt:   { color: "#1E293B", fontSize: 13, lineHeight: 20 },
  bubbleThinking:{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#F1F5F9", borderRadius: 14, borderBottomLeftRadius: 4, paddingHorizontal: 14, paddingVertical: 10 },
  thinkingTxt:   { fontSize: 12, fontStyle: "italic" },
  quickSection:       { borderTopWidth: 1, borderTopColor: "#F1F5F9", paddingTop: 10, paddingBottom: 12 },
  quickLabel:         { fontSize: 11, color: "#94A3B8", fontWeight: "600", marginBottom: 8, paddingHorizontal: 14 },
  quickScrollContent: { paddingHorizontal: 14, gap: 8 },
  quickBtn:         { borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: "#F8FAFC" },
  quickBtnDisabled: { opacity: 0.4 },
  quickBtnTxt:         { fontSize: 12, fontWeight: "700" },
  quickBtnTxtDisabled: { color: "#94A3B8" },
});