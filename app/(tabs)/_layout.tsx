import { Tabs } from "expo-router";
import React from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../src/hooks/useAuth";

const PRIMARY = "#2E7D32";
const HIDE    = { href: null };

export default function TabsLayout() {
  const { logout }  = useAuth();
  const insets      = useSafeAreaInsets();

  const handleLogout = () => {
    Alert.alert("Logout", "Yakin ingin keluar?", [
      { text: "Batal", style: "cancel" },
      { text: "Logout", style: "destructive", onPress: logout },
    ]);
  };

  const renderLogoutBtn = () => (
    <Pressable onPress={handleLogout} style={styles.logoutBtn}>
      <Text style={styles.logoutText}>Logout</Text>
    </Pressable>
  );

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor:   PRIMARY,
        tabBarInactiveTintColor: "#9E9E9E",
        tabBarStyle: {
          backgroundColor: "#FFFFFF",
          borderTopWidth:  0,
          elevation:       12,
          shadowColor:     "#000",
          shadowOpacity:   0.08,
          shadowOffset:    { width: 0, height: -2 },
          shadowRadius:    8,
          height:          56 + insets.bottom,
          paddingBottom:   insets.bottom,
          paddingTop:      6,
        },
        tabBarLabelStyle: styles.tabLabel,
        headerStyle:      { backgroundColor: PRIMARY },
        headerTintColor:  "#fff",
        headerRight:      renderLogoutBtn,
      }}
    >
      <Tabs.Screen
        name="kasir"
        options={{
          title:       "Kasir",
          headerShown: false,
          tabBarIcon:  ({ focused }) => (
            <View style={[styles.iconWrap, focused ? styles.iconWrapActive : null]}>
              <Text style={styles.iconEmoji}>🏪</Text>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="laporan"
        options={{
          title:       "Laporan",
          headerShown: false,
          tabBarIcon:  ({ focused }) => (
            <View style={[styles.iconWrap, focused ? styles.iconWrapActive : null]}>
              <Text style={styles.iconEmoji}>📊</Text>
            </View>
          ),
        }}
      />
      <Tabs.Screen name="index"    options={HIDE} />
      <Tabs.Screen name="explore"  options={HIDE} />
      <Tabs.Screen name="products" options={HIDE} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabLabel: {
    fontSize:   12,
    fontWeight: "700",
    marginTop:  2,
  },
  iconWrap: {
    width:           40,
    height:          30,
    borderRadius:    10,
    alignItems:      "center",
    justifyContent:  "center",
    backgroundColor: "transparent",
  },
  iconWrapActive: {
    backgroundColor: "#E8F5E9",
  },
  iconEmoji: {
    fontSize: 20,
  },
  logoutBtn: {
    marginRight:       12,
    paddingHorizontal: 12,
    paddingVertical:   5,
    borderRadius:      8,
    borderWidth:       1.5,
    borderColor:       "#fff",
    backgroundColor:   "rgba(255,255,255,0.15)",
  },
  logoutText: {
    color:      "#fff",
    fontSize:   13,
    fontWeight: "700",
  },
});