// src/utils/NotificationService.ts — v1
// Push Notification lengkap: permission, stok, transaksi, reminder harian
// Menggunakan expo-notifications

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";

// ─── Constants ────────────────────────────────────────────────────────────────

const KEY_NOTIF_PERMISSION  = "@twd_notif_permission";
const KEY_NOTIF_DAILY_ID    = "@twd_notif_daily_id";
const KEY_NOTIF_HISTORY     = "@twd_notif_history";
const KEY_NOTIF_SETTINGS    = "@twd_notif_settings";
const MAX_HISTORY           = 50;

// ─── Types ────────────────────────────────────────────────────────────────────

export type NotifCategory =
  | "stok"
  | "transaksi"
  | "reminder"
  | "laporan"
  | "langganan"
  | "retur"
  | "umum";

export interface NotifHistoryItem {
  id:         string;
  title:      string;
  body:       string;
  category:   NotifCategory;
  createdAt:  string;
  read:       boolean;
  data?:      Record<string, unknown>;
}

export interface NotifSettings {
  stokMenipis:    boolean;
  transaksi:      boolean;
  reminderHarian: boolean;
  jamReminder:    string; // "HH:mm" format, e.g. "08:00"
  langganan:      boolean;
  retur:          boolean;
}

const DEFAULT_SETTINGS: NotifSettings = {
  stokMenipis:    true,
  transaksi:      false, // default off (bisa ribuan notif)
  reminderHarian: true,
  jamReminder:    "08:00",
  langganan:      true,
  retur:          true,
};

// ─── Handler Setup ────────────────────────────────────────────────────────────
// Panggil SEKALI di App.tsx level modul

export function setupNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
  shouldShowAlert:  true,
  shouldPlaySound:  true,
  shouldSetBadge:   true,
  shouldShowBanner: true,   // ← TAMBAH
  shouldShowList:   true,   // ← TAMBAH
}),
  });
}

// ─── Permission ───────────────────────────────────────────────────────────────

export async function requestNotificationPermission(): Promise<boolean> {
  if (!Device.isDevice) {
    // Emulator — simpan sebagai granted agar development tidak error
    await AsyncStorage.setItem(KEY_NOTIF_PERMISSION, "granted");
    return true;
  }

  const { status: existing } = await Notifications.getPermissionsAsync();

  if (existing === "granted") {
    await AsyncStorage.setItem(KEY_NOTIF_PERMISSION, "granted");
    return true;
  }

  if (existing === "undetermined") {
    const { status } = await Notifications.requestPermissionsAsync();
    await AsyncStorage.setItem(KEY_NOTIF_PERMISSION, status);
    return status === "granted";
  }

  // denied
  await AsyncStorage.setItem(KEY_NOTIF_PERMISSION, "denied");
  return false;
}

export async function getPermissionStatus(): Promise<string> {
  const cached = await AsyncStorage.getItem(KEY_NOTIF_PERMISSION);
  if (cached) return cached;
  const { status } = await Notifications.getPermissionsAsync();
  return status;
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export async function loadNotifSettings(): Promise<NotifSettings> {
  try {
    const raw = await AsyncStorage.getItem(KEY_NOTIF_SETTINGS);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch { /* pakai default */ }
  return { ...DEFAULT_SETTINGS };
}

export async function saveNotifSettings(settings: NotifSettings): Promise<void> {
  await AsyncStorage.setItem(KEY_NOTIF_SETTINGS, JSON.stringify(settings));
}

// ─── History ──────────────────────────────────────────────────────────────────

export async function loadNotifHistory(): Promise<NotifHistoryItem[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY_NOTIF_HISTORY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export async function addToHistory(item: Omit<NotifHistoryItem, "id" | "createdAt" | "read">): Promise<void> {
  try {
    const history = await loadNotifHistory();
    const newItem: NotifHistoryItem = {
      ...item,
      id:        Date.now().toString(36),
      createdAt: new Date().toISOString(),
      read:      false,
    };
    const trimmed = [newItem, ...history].slice(0, MAX_HISTORY);
    await AsyncStorage.setItem(KEY_NOTIF_HISTORY, JSON.stringify(trimmed));
  } catch { /* silent */ }
}

export async function markAllRead(): Promise<void> {
  const history = await loadNotifHistory();
  const updated = history.map((h) => ({ ...h, read: true }));
  await AsyncStorage.setItem(KEY_NOTIF_HISTORY, JSON.stringify(updated));
}

export async function clearNotifHistory(): Promise<void> {
  await AsyncStorage.setItem(KEY_NOTIF_HISTORY, JSON.stringify([]));
}

export async function getUnreadCount(): Promise<number> {
  const history = await loadNotifHistory();
  return history.filter((h) => !h.read).length;
}

// ─── Send Local Notification ──────────────────────────────────────────────────

async function sendLocal(
  title:    string,
  body:     string,
  category: NotifCategory,
  data?:    Record<string, unknown>,
): Promise<string | null> {
  const status = await getPermissionStatus();
  if (status !== "granted") return null;

  const settings = await loadNotifSettings();

  // Cek setting per kategori
  const enabled =
    category === "stok"       ? settings.stokMenipis    :
    category === "transaksi"  ? settings.transaksi       :
    category === "reminder"   ? settings.reminderHarian  :
    category === "laporan"    ? settings.reminderHarian  :
    category === "langganan"  ? settings.langganan       :
    category === "retur"      ? settings.retur           :
    true;

  if (!enabled) return null;

  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data:  data ?? {},
        sound: true,
      },
      trigger: null, // kirim sekarang
    });

    await addToHistory({ title, body, category, data });
    return id;
  } catch (e) {
    console.error("sendLocal error:", e);
    return null;
  }
}

// ─── Notifikasi Stok ──────────────────────────────────────────────────────────

export async function notifyStokMenipis(
  produkName: string,
  stokSisa:   number,
  tokoName:   string,
): Promise<void> {
  await sendLocal(
    "⚠️ Stok Menipis — " + tokoName,
    produkName + " tersisa " + stokSisa + " pcs. Segera restok!",
    "stok",
    { produkName, stokSisa }
  );
}

export async function notifyStokHabis(
  produkName: string,
  tokoName:   string,
): Promise<void> {
  await sendLocal(
    "🚨 Stok Habis — " + tokoName,
    produkName + " sudah habis. Produk tidak bisa dijual!",
    "stok",
    { produkName, stokSisa: 0 }
  );
}

// ─── Notifikasi Transaksi ─────────────────────────────────────────────────────

export async function notifyTransaksiBaru(
  total:     number,
  kasirName: string,
  tokoName:  string,
): Promise<void> {
  const rp = "Rp " + Math.round(total).toLocaleString("id-ID");
  await sendLocal(
    "🧾 Transaksi Baru — " + tokoName,
    kasirName + " · " + rp,
    "transaksi",
    { total, kasirName }
  );
}

// ─── Notifikasi Retur ─────────────────────────────────────────────────────────

export async function notifyReturMasuk(
  kasirName: string,
  alasan:    string,
  tokoName:  string,
): Promise<void> {
  await sendLocal(
    "↩️ Retur Masuk — " + tokoName,
    "Dari kasir: " + kasirName + " · " + alasan,
    "retur",
    { kasirName, alasan }
  );
}

export async function notifyReturDiproses(
  status:   "disetujui" | "ditolak",
  tokoName: string,
): Promise<void> {
  const icon = status === "disetujui" ? "✅" : "❌";
  await sendLocal(
    icon + " Retur " + (status === "disetujui" ? "Disetujui" : "Ditolak"),
    "Retur dari " + tokoName + " telah " + status + ".",
    "retur",
    { status }
  );
}

// ─── Notifikasi Langganan ─────────────────────────────────────────────────────

export async function notifyLanggananHampirExpired(
  tokoName:    string,
  hariSisa:    number,
  expiryDate:  string,
): Promise<void> {
  await sendLocal(
    "⏳ Langganan Hampir Berakhir",
    tokoName + " · Sisa " + hariSisa + " hari (exp: " + expiryDate + ")",
    "langganan",
    { tokoName, hariSisa }
  );
}

export async function notifyLanggananExpired(tokoName: string): Promise<void> {
  await sendLocal(
    "🔴 Langganan Expired",
    tokoName + " — Perpanjang sekarang agar kasir bisa kembali beroperasi.",
    "langganan",
    { tokoName }
  );
}

// ─── Notifikasi Laporan Harian (Scheduled) ───────────────────────────────────

export async function scheduleReminderHarian(jamStr: string): Promise<void> {
  // Batalkan reminder lama dulu
  await cancelReminderHarian();

  const status = await getPermissionStatus();
  if (status !== "granted") return;

  const settings = await loadNotifSettings();
  if (!settings.reminderHarian) return;

  const [hourStr, minStr] = jamStr.split(":");
  const hour   = parseInt(hourStr ?? "8",  10);
  const minute = parseInt(minStr  ?? "0",  10);

  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: "📊 Cek Laporan Harian",
        body:  "Waktunya review transaksi hari ini. Buka laporan penjualan sekarang!",
        sound: true,
      },
      trigger: {
        type:     Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      },
    });
    await AsyncStorage.setItem(KEY_NOTIF_DAILY_ID, id);
  } catch (e) {
    console.error("scheduleReminderHarian error:", e);
  }
}

export async function cancelReminderHarian(): Promise<void> {
  try {
    const id = await AsyncStorage.getItem(KEY_NOTIF_DAILY_ID);
    if (id) {
      await Notifications.cancelScheduledNotificationAsync(id);
      await AsyncStorage.removeItem(KEY_NOTIF_DAILY_ID);
    }
  } catch { /* silent */ }
}

// ─── Cek Stok Semua Produk ────────────────────────────────────────────────────

export async function checkAndNotifyStok(ownerId: string, tokoName: string): Promise<void> {
  try {
    const raw      = await AsyncStorage.getItem("@twd_products");
    const products = raw ? JSON.parse(raw) : [];
    const milik    = products.filter((p: any) => p.ownerId === ownerId);

    for (const p of milik) {
      const minStock = p.stockMin ?? 5;
      if (p.stock === 0) {
        await notifyStokHabis(p.name, tokoName);
      } else if (p.stock <= minStock) {
        await notifyStokMenipis(p.name, p.stock, tokoName);
      }
    }
  } catch (e) {
    console.error("checkAndNotifyStok error:", e);
  }
}

// ─── Badge ────────────────────────────────────────────────────────────────────

export async function updateBadge(): Promise<void> {
  try {
    const count = await getUnreadCount();
    await Notifications.setBadgeCountAsync(count);
  } catch { /* silent */ }
}

export async function clearBadge(): Promise<void> {
  try {
    await Notifications.setBadgeCountAsync(0);
  } catch { /* silent */ }
}