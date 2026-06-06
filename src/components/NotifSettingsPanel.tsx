// src/components/NotifSettingsPanel.tsx
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  cancelReminderHarian,
  loadNotifSettings,
  NotifSettings,
  saveNotifSettings,
  scheduleReminderHarian,
} from "../utils/StockNotificationService";

const SWITCH_TRACK_COLOR = { false: "#CBD5E1", true: "#2563EB" };

interface Props {
  ownerId:  string;
  tokoName: string;
  onClose:  () => void;
}

type SettingItem = {
  key:   keyof NotifSettings;
  label: string;
  desc:  string;
  emoji: string;
};

const ITEMS: SettingItem[] = [
  { key: "stokMenipis",    label: "Stok Menipis",    desc: "Notif saat produk hampir habis",    emoji: "📦" },
  { key: "transaksi",      label: "Transaksi Baru",  desc: "Notif setiap ada penjualan",        emoji: "🧾" },
  { key: "retur",          label: "Retur Masuk",     desc: "Notif saat kasir ajukan retur",     emoji: "↩️" },
  { key: "langganan",      label: "Langganan",       desc: "Notif saat langganan hampir habis", emoji: "⏰" },
  { key: "reminderHarian", label: "Reminder Harian", desc: "Pengingat cek stok setiap hari",   emoji: "📋" },
];

export default function NotifSettingsPanel({ ownerId, tokoName, onClose }: Props) {
  const [settings, setSettings] = useState<NotifSettings | null>(null);
  const [saving,   setSaving]   = useState(false);

  const load = useCallback(async () => {
    const s = await loadNotifSettings();
    setSettings(s);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function toggle(key: keyof NotifSettings, val: boolean) {
    if (!settings) return;
    const updated = { ...settings, [key]: val };
    setSettings(updated);
    setSaving(true);
    try {
      await saveNotifSettings(updated);
      if (key === "reminderHarian") {
        if (val) await scheduleReminderHarian(updated.reminderJam);
        else     await cancelReminderHarian();
      }
    } finally {
      setSaving(false);
    }
  }

  if (!settings) {
    return (
      <View style={NP.center}>
        <ActivityIndicator color="#2563EB" size="large" />
        <Text style={NP.loadingTxt}>{"Memuat pengaturan..."}</Text>
      </View>
    );
  }

  return (
    <View style={NP.container}>
      <View style={NP.header}>
        <Text style={NP.title}>{"🔔 Pengaturan Notifikasi"}</Text>
        <Text style={NP.sub}>{tokoName}</Text>
        <TouchableOpacity style={NP.closeBtn} onPress={onClose}>
          <Text style={NP.closeTxt}>{"✕ Tutup"}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={NP.list} showsVerticalScrollIndicator={false}>
        <View style={NP.infoBox}>
          <Text style={NP.infoTxt}>
            {"ℹ️ Aktifkan notifikasi yang ingin kamu terima. Pastikan izin notifikasi sudah diberikan di pengaturan HP."}
          </Text>
        </View>

        {ITEMS.map((item) => (
          <View key={String(item.key)} style={NP.row}>
            <Text style={NP.emoji}>{item.emoji}</Text>
            <View style={NP.info}>
              <Text style={NP.label}>{item.label}</Text>
              <Text style={NP.desc}>{item.desc}</Text>
            </View>
            <Switch
              value={Boolean(settings[item.key])}
              onValueChange={(v) => toggle(item.key, v)}
              trackColor={SWITCH_TRACK_COLOR}
              thumbColor="#fff"
            />
          </View>
        ))}

        {saving && (
          <View style={NP.savingRow}>
            <ActivityIndicator size="small" color="#2563EB" />
            <Text style={NP.savingTxt}>{"Menyimpan..."}</Text>
          </View>
        )}
        <View style={NP.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

const NP = StyleSheet.create({
  container:    { flex: 1, backgroundColor: "#F1F5F9" },
  center:       { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  loadingTxt:   { fontSize: 13, color: "#64748B" },
  header:       { backgroundColor: "#2563EB", padding: 20, paddingTop: 52 },
  title:        { color: "#fff", fontSize: 18, fontWeight: "800" },
  sub:          { color: "rgba(255,255,255,0.75)", fontSize: 12, marginTop: 2 },
  closeBtn:     { marginTop: 12, alignSelf: "flex-start", backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7 },
  closeTxt:     { color: "#fff", fontWeight: "700", fontSize: 13 },
  list:         { padding: 16 },
  infoBox:      { backgroundColor: "#EFF6FF", borderRadius: 10, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: "#BFDBFE" },
  infoTxt:      { fontSize: 12, color: "#1D4ED8", lineHeight: 18 },
  row:          { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 10, gap: 12, elevation: 1, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
  emoji:        { fontSize: 22 },
  info:         { flex: 1 },
  label:        { fontSize: 14, fontWeight: "700", color: "#1E293B" },
  desc:         { fontSize: 11, color: "#64748B", marginTop: 2 },
  savingRow:    { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 10 },
  savingTxt:    { fontSize: 12, color: "#64748B" },
  bottomSpacer: { height: 40 },
});