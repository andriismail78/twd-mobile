// src/screens/customer/CustomerApp.tsx
import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { CustomerSession } from "../../context/OrderContext";
import CustomerCartScreen from "./CustomerCartScreen";
import CustomerLoginScreen from "./CustomerLoginScreen";
import CustomerOrderStatusScreen from "./CustomerOrderStatusScreen";
import CustomerStoreSelectScreen from "./CustomerStoreSelectScreen";

type CustomerFlow =
  | "login"
  | "store_select"
  | "home"
  | "order_status";

type ActiveTab = "produk" | "pesanan";

export default function CustomerApp() {
  const [flow,          setFlow]          = useState<CustomerFlow>("login");
  const [session,       setSession]       = useState<CustomerSession | null>(null);
  const [activeTab,     setActiveTab]     = useState<ActiveTab>("produk");
  const [selectedOwner, setSelectedOwner] = useState<string>("");

  // STEP: LOGIN
  if (flow === "login") {
    return (
      <CustomerLoginScreen
        onLogin={(s: CustomerSession) => {
          setSession(s);
          setFlow("store_select");
        }}
      />
    );
  }

  // STEP: PILIH TOKO
  if (flow === "store_select") {
    return (
      <CustomerStoreSelectScreen
        onSelect={(ownerId: string) => {
          setSelectedOwner(ownerId);
          // Update session dengan ownerId toko yang dipilih
          setSession((prev) =>
            prev ? { ...prev, ownerId } : { name: "", phone: "", ownerId }
          );
          setFlow("home");
        }}
      />
    );
  }

  // STEP: HOME (Produk & Pesanan)
  if (flow === "home" && session) {
    return (
      <SafeAreaView style={S.root} edges={["bottom"]}>
        <View style={S.content}>
          {activeTab === "produk" ? (
            <CustomerCartScreen
              session={session}
              onCheckoutDone={() => setActiveTab("pesanan")}
            />
          ) : (
            <CustomerOrderStatusScreen session={session} />
          )}
        </View>
        <View style={S.navbar}>
          <NavTab
            icon="🛒"
            label="Produk"
            active={activeTab === "produk"}
            onPress={() => setActiveTab("produk")}
          />
          <NavTab
            icon="📦"
            label="Pesanan"
            active={activeTab === "pesanan"}
            onPress={() => setActiveTab("pesanan")}
          />
        </View>
      </SafeAreaView>
    );
  }

  // FALLBACK
  return (
    <View style={S.fallback}>
      <Text style={S.fallbackText}>Memuat...</Text>
    </View>
  );
}

function NavTab({
  icon, label, active, onPress,
}: {
  icon:    string;
  label:   string;
  active:  boolean;
  onPress: () => void;
}) {
  return (
    <View
      style={[S.navTab, active && S.navTabActive]}
      // @ts-ignore
      onTouchEnd={onPress}
    >
      <Text style={S.navTabIcon}>{icon}</Text>
      <Text style={[S.navTabLabel, active && S.navTabLabelActive]}>{label}</Text>
    </View>
  );
}

const S = StyleSheet.create({
  root:              { flex: 1, backgroundColor: "#F7FAF7" },
  content:           { flex: 1 },
  navbar:            {
    flexDirection:   "row",
    backgroundColor: "#FFFFFF",
    borderTopWidth:  1,
    borderTopColor:  "#E1EEE1",
    paddingVertical: 4,
  },
  navTab:            {
    flex:            1,
    alignItems:      "center",
    paddingVertical: 8,
    borderTopWidth:  2,
    borderTopColor:  "transparent",
  },
  navTabActive:      { borderTopColor: "#2E7D32" },
  navTabIcon:        { fontSize: 22 },
  navTabLabel:       { fontSize: 11, color: "#888", marginTop: 2, fontWeight: "600" },
  navTabLabelActive: { color: "#2E7D32", fontWeight: "800" },
  fallback:          { flex: 1, justifyContent: "center", alignItems: "center" },
  fallbackText:      { color: "#888" },
});