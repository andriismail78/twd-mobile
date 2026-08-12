// app/index.tsx
import React, { useState } from "react";
import {
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import Constants from "expo-constants";

import { useAuth } from "../src/context/AuthContext";
import TwdLogoBadge from "../src/components/TwdLogoBadge";

import CustomerApp from "../src/screens/customer/CustomerApp";
import KasirScreen from "../src/screens/KasirScreen";
import KurirDashboard from "../src/screens/KurirDashboard";
import LoginScreen from "../src/screens/LoginScreen";
import MarketingDashboard from "../src/screens/MarketingDashboard";
import OwnerDashboard from "../src/screens/OwnerDashboard";
import SubMarketingDashboard from "../src/screens/SubMarketingDashboard";
import SuperAdminDashboard from "../src/screens/SuperAdminDashboard";

const GREEN = "#2E7D32";
type PilihanRole = "owner_kasir" | "customer" | null;

// ─── App Router ───────────────────────────────────────────────────────────────

function AppRouter() {
  const { user } = useAuth();

  if (user) {
    switch (user.role) {
      case "super_admin":
        return <SuperAdminDashboard />;
      case "owner":
        return <OwnerDashboard />;
      case "kasir":
        return <KasirScreen />;
      case "marketing":
        return <MarketingDashboard />;
      case "sub_marketing":
        return <SubMarketingDashboard />;
      case "kurir":
        return <KurirDashboard />;
      default:
        return (
          <View style={S.unknownRole}>
            <Text style={S.unknownRoleEmoji}>⚠️</Text>
            <Text style={S.unknownRoleTitle}>Role tidak dikenali</Text>
            <Text style={S.unknownRoleDesc}>{"Role: " + user.role}</Text>
          </View>
        );
    }
  }

  return <RoleSelector />;
}

// ─── Role Selector ────────────────────────────────────────────────────────────

function RoleSelector() {
  const [pilihan, setPilihan] = useState<PilihanRole>(null);
  const appTarget = (Constants.expoConfig?.extra?.appTarget || "super").toLowerCase();

  // Jika di-build khusus untuk Customer APK, langsung tampilkan toko online customer
  if (appTarget === "customer" || pilihan === "customer") {
    return (
      <View style={S.flex}>
        <CustomerApp />
        {appTarget === "super" && (
          <TouchableOpacity
            style={S.backFloating}
            onPress={() => setPilihan(null)}
          >
            <Text style={S.backFloatingText}>← Kembali</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  // Jika di-build untuk Marketing, Kurir, WarungPOS, atau jika pengguna memilih Owner/Kasir
  if (appTarget !== "super" || pilihan === "owner_kasir") {
    return (
      <View style={S.flex}>
        <LoginScreen />
        {appTarget === "super" && (
          <TouchableOpacity
            style={S.backFloating}
            onPress={() => setPilihan(null)}
          >
            <Text style={S.backFloatingText}>← Kembali</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <View style={S.selectorRoot}>
      <View style={S.selectorHero}>
        <TwdLogoBadge size="large" showSubtitle={true} />
        <Text style={[S.selectorSubtitle, { marginTop: 12 }]}>Pilih cara masuk ke aplikasi</Text>
      </View>

      <View style={S.roleCards}>
        <TouchableOpacity
          style={S.roleCard}
          onPress={() => setPilihan("owner_kasir")}
        >
          <Text style={S.roleCardEmoji}>👑</Text>
          <View style={S.roleCardText}>
            <Text style={S.roleCardTitle}>Owner / Kasir</Text>
            <Text style={S.roleCardDesc}>
              Login dengan PIN untuk mengelola toko
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[S.roleCard, S.roleCardCustomer]}
          onPress={() => setPilihan("customer")}
        >
          <Text style={S.roleCardEmoji}>🛒</Text>
          <View style={S.roleCardText}>
            <Text style={S.roleCardTitle}>Customer</Text>
            <Text style={S.roleCardDesc}>Pesan produk secara online</Text>
          </View>
        </TouchableOpacity>
      </View>

      <Text style={S.versionNote}>TWD Mobile v1.0</Text>
    </View>
  );
}

// ─── Export ───────────────────────────────────────────────────────────────────

export default function IndexScreen() {
  return <AppRouter />;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  flex: { flex: 1 },
  selectorRoot: {
    flex:           1,
    backgroundColor:"#F7FAF7",
    padding:        24,
    justifyContent: "center",
  },
  selectorHero: {
    alignItems:   "center",
    marginBottom: 40,
  },
  selectorEmoji: {
    fontSize:    64,
    marginBottom: 8,
  },
  selectorTitle: {
    fontSize:   28,
    fontWeight: "900",
    color:      GREEN,
  },
  selectorSubtitle: {
    fontSize:  14,
    color:     "#888",
    marginTop: 4,
  },
  roleCards: { gap: 14 },
  roleCard: {
    backgroundColor: "#FFF",
    borderRadius:    16,
    padding:         20,
    borderWidth:     1.5,
    borderColor:     "#C8E6C9",
    flexDirection:   "row",
    alignItems:      "center",
    gap:             14,
    elevation:       2,
  },
  roleCardCustomer: {
    borderColor:     "#81C784",
    backgroundColor: "#F1F8E9",
  },
  roleCardEmoji: { fontSize: 36 },
  roleCardText:  { flex: 1 },
  roleCardTitle: {
    fontSize:   16,
    fontWeight: "800",
    color:      "#1B5E20",
  },
  roleCardDesc: {
    fontSize:  12,
    color:     "#777",
    marginTop: 2,
  },
  versionNote: {
    textAlign: "center",
    color:     "#CCC",
    fontSize:  11,
    marginTop: 40,
  },
  backFloating: {
    position:          "absolute",
    top:               48,
    left:              16,
    backgroundColor:   "rgba(0,0,0,0.45)",
    paddingHorizontal: 12,
    paddingVertical:   6,
    borderRadius:      20,
    zIndex:            999,
  },
  backFloatingText: {
    color:      "#FFF",
    fontSize:   12,
    fontWeight: "700",
  },
  unknownRole: {
    flex:           1,
    alignItems:     "center",
    justifyContent: "center",
    backgroundColor:"#FFF",
    padding:        32,
  },
  unknownRoleEmoji: {
    fontSize:    48,
    marginBottom:12,
  },
  unknownRoleTitle: {
    fontSize:   18,
    fontWeight: "800",
    color:      "#C62828",
  },
  unknownRoleDesc: {
    fontSize:  13,
    color:     "#888",
    marginTop: 8,
  },
});