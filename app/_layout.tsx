// app/_layout.tsx

// ✅ WAJIB: Polyfill crypto untuk React Native — harus di baris PALING ATAS
if (typeof global !== "undefined") {
  if (!(global as any).crypto) {
    (global as any).crypto = {};
  }
  if (!(global as any).crypto.getRandomValues) {
    (global as any).crypto.getRandomValues = function (array: Uint8Array) {
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
      return array;
    };
  }
}

import { Slot } from "expo-router";
import React from "react";
import { MD3LightTheme, PaperProvider } from "react-native-paper";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "../src/context/AuthContext";
import { GlobalProductProvider } from "../src/context/GlobalProductContext";
import { MarketingProvider } from "../src/context/MarketingContext";
import { OrderProvider } from "../src/context/OrderContext";
import { PaymentMethodProvider } from "../src/context/PaymentMethodContext";
import { ProductsProvider } from "../src/context/ProductsContext";
import { StoreProvider } from "../src/context/StoreContext";

// ✅ HAPUS: const { logout } = useAuth() — tidak boleh di luar component

const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary:          "#2E7D32",
    primaryContainer: "#E8F5E9",
    secondary:        "#388E3C",
    surface:          "#FFFFFF",
    background:       "#F7FAF7",
  },
};

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <PaperProvider theme={theme}>
        <StoreProvider>
          <AuthProvider>
            <MarketingProvider>
              <GlobalProductProvider>
                <ProductsProvider>
                  <PaymentMethodProvider>
                    <OrderProvider>
                      {/*
                        <Slot /> = expo-router render child routes di sini.
                        Semua route (termasuk (tabs)/_layout.tsx) sekarang
                        berada DI DALAM AuthProvider.
                      */}
                      <Slot />
                    </OrderProvider>
                  </PaymentMethodProvider>
                </ProductsProvider>
              </GlobalProductProvider>
            </MarketingProvider>
          </AuthProvider>
        </StoreProvider>
      </PaperProvider>
    </SafeAreaProvider>
  );
}