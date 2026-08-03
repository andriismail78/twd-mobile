// App.tsx v3.1 — + SafeAreaProvider + setupNotificationHandler
import AsyncStorage from "@react-native-async-storage/async-storage";
import { NavigationContainer } from "@react-navigation/native";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import { GlobalProductProvider } from "./src/context/GlobalProductContext";
import { MarketingProvider } from "./src/context/MarketingContext";
import { StoreProvider } from "./src/context/StoreContext";
import KasirScreen from "./src/screens/KasirScreen";
import KurirDashboard from "./src/screens/KurirDashboard";
import MarketingDashboard from "./src/screens/MarketingDashboard";
import OnboardingScreen from "./src/screens/OnboardingScreen";
import OwnerDashboard from "./src/screens/OwnerDashboard";
import SubMarketingDashboard from "./src/screens/SubMarketingDashboard";
import SuperAdminScreen from "./src/screens/SuperAdminScreen";
import { setupNotificationHandler } from "./src/utils/StockNotificationService";

// ─── Setup notifikasi (1× saat app buka) ─────────────────────────────────────
setupNotificationHandler();

const ONBOARDING_KEY = "@twd_onboarding_done";

// ─── App Router ───────────────────────────────────────────────────────────────
function AppRouter() {
  const { user, logout } = useAuth();
  if (!user) return null;

  switch (user.role) {
    case "owner":
      return <OwnerDashboard />;
    case "kasir":
      return (
        <KasirScreen
          ownerId={user.ownerId ?? ""}
          kasirName={user.name}
          onBack={logout}
        />
      );
    case "kurir":
      return <KurirDashboard kurirId={user.id ?? ""} onBack={logout} />;
    case "marketing":
      return <MarketingDashboard {...{ marketingId: user.id ?? "", onBack: logout } as any} />;
    case "sub_marketing":
      return <SubMarketingDashboard subMarketingId={user.id ?? ""} onBack={logout} />;
    case "super_admin":
      return <SuperAdminScreen onBack={logout} />;
    default:
      return null;
  }
}

// ─── Onboarding Gate ─────────────────────────────────────────────────────────
function OnboardingGate() {
  const [loading,      setLoading]      = useState(true);
  const [hasOnboarded, setHasOnboarded] = useState(false);

  const checkOnboarding = useCallback(async () => {
    try {
      const val = await AsyncStorage.getItem(ONBOARDING_KEY);
      setHasOnboarded(val === "true");
    } catch {
      setHasOnboarded(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { checkOnboarding(); }, [checkOnboarding]);

  if (loading) {
    return (
      <View style={AS.splashContainer}>
        <ActivityIndicator color="#38BDF8" size="large" />
      </View>
    );
  }

  if (!hasOnboarded) {
    return (
      <OnboardingScreen
        onFinish={async () => {
          await AsyncStorage.setItem(ONBOARDING_KEY, "true");
          setHasOnboarded(true);
        }}
      />
    );
  }

  return <AppRouter />;
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StoreProvider>
          <GlobalProductProvider>
            <MarketingProvider>
              <AuthProvider>
                <OnboardingGate />
              </AuthProvider>
            </MarketingProvider>
          </GlobalProductProvider>
        </StoreProvider>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const AS = StyleSheet.create({
  splashContainer: {
    flex:            1,
    justifyContent:  "center",
    alignItems:      "center",
    backgroundColor: "#0F172A",
  },
});