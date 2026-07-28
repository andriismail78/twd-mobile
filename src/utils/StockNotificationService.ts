// src/utils/StockNotificationService.ts
// versi gabungan FINAL — semua fitur notifikasi TWD POS

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

// ─── Storage Keys ─────────────────────────────────────────────────────────────

const NOTIF_PERM_KEY        = "@twd_notif_permission";
const NOTIF_LAST_CHECK_KEY  = "@twd_notif_last_stock_check";
const NOTIF_SNOOZED_KEY     = "@twd_notif_snoozed_products";
const PRODUCTS_KEY          = "@twd_products";
const GLOBAL_PRODUCTS_KEY   = "@twd_global_products";
const NOTIF_HISTORY_KEY     = "@twd_notif_history";
const NOTIF_SETTINGS_KEY    = "@twd_notif_settings";
const NOTIF_DAILY_ID_KEY    = "@twd_notif_daily_id";

const DEFAULT_STOK_MINIMUM  = 5;
const MAX_HISTORY           = 50;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Product {
  id:           string;
  name:         string;
  stok?:        number;
  stock?:       number;
  harga?:       number;
  price?:       number;
  ownerId?:     string;
  kategori?:    string;
  category?:    string;
  stokMinimum?: number;
}

export interface LowStockItem {
  productId:   string;
  productName: string;
  stokSaat:    number;
  stokMinimum: number;
  ownerId?:    string;
}

export interface StockCheckResult {
  lowStockItems: LowStockItem[];
  totalProducts: number;
  checkedAt:     string;
}

export type NotifCategory = "stokMenipis" | "transaksi" | "retur" | "langganan" | "reminderHarian";

export interface NotifSettings {
  stokMenipis:    boolean;
  transaksi:      boolean;
  retur:          boolean;
  langganan:      boolean;
  reminderHarian: boolean;
  reminderJam:    string; // "HH:mm"
}

export interface NotifHistoryItem {
  id:         string;
  category:   NotifCategory;
  title:      string;
  body:       string;
  createdAt:  string;
  isRead:     boolean;
}

// ─── Default Settings ─────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: NotifSettings = {
  stokMenipis:    true,
  transaksi:      true,
  retur:          true,
  langganan:      true,
  reminderHarian: false,
  reminderJam:    "08:00",
};

// ─── Setup handler ────────────────────────────────────────────────────────────

export function setupNotificationHandler() {
  Notifications.setNotificationHandler({
handleNotification: async () => ({
  shouldShowAlert:  true,
  shouldPlaySound:  true,
  shouldSetBadge:   true,
  shouldShowBanner: true,
  shouldShowList:   true,
}),
  });
}

// ─── Izin notifikasi ──────────────────────────────────────────────────────────

export async function requestNotificationPermission(): Promise<boolean> {
  if (!Device.isDevice) {
    console.log("StockNotif: simulator, skip izin.");
    return false;
  }
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  const granted = finalStatus === "granted";
  await AsyncStorage.setItem(NOTIF_PERM_KEY, granted ? "granted" : "denied");

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("stock-alert", {
      name:             "Stok Menipis",
      importance:       Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor:       "#FF6B35",
      sound:            "default",
    });
    await Notifications.setNotificationChannelAsync("transaksi", {
      name:       "Transaksi",
      importance: Notifications.AndroidImportance.DEFAULT,
      sound:      "default",
    });
    await Notifications.setNotificationChannelAsync("general", {
      name:       "Umum",
      importance: Notifications.AndroidImportance.DEFAULT,
      sound:      "default",
    });
  }
  return granted;
}

export async function isNotificationPermissionGranted(): Promise<boolean> {
  const cached = await AsyncStorage.getItem(NOTIF_PERM_KEY);
  if (cached === "granted") return true;
  const { status } = await Notifications.getPermissionsAsync();
  return status === "granted";
}

export async function getPermissionStatus(): Promise<string> {
  const { status } = await Notifications.getPermissionsAsync();
  return status;
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export async function loadNotifSettings(): Promise<NotifSettings> {
  try {
    const raw = await AsyncStorage.getItem(NOTIF_SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveNotifSettings(settings: NotifSettings): Promise<void> {
  await AsyncStorage.setItem(NOTIF_SETTINGS_KEY, JSON.stringify(settings));
}

// ─── History ──────────────────────────────────────────────────────────────────

async function loadNotifHistory(): Promise<NotifHistoryItem[]> {
  try {
    const raw = await AsyncStorage.getItem(NOTIF_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function addToHistory(item: Omit<NotifHistoryItem, "id" | "createdAt" | "isRead">): Promise<void> {
  try {
    const history = await loadNotifHistory();
    const newItem: NotifHistoryItem = {
      ...item,
      id:        Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      createdAt: new Date().toISOString(),
      isRead:    false,
    };
    const updated = [newItem, ...history].slice(0, MAX_HISTORY);
    await AsyncStorage.setItem(NOTIF_HISTORY_KEY, JSON.stringify(updated));
    await updateBadge();
  } catch {}
}

export async function getUnreadCount(): Promise<number> {
  const history = await loadNotifHistory();
  return history.filter((h) => !h.isRead).length;
}

export async function markAllRead(): Promise<void> {
  try {
    const history = await loadNotifHistory();
    const updated = history.map((h) => ({ ...h, isRead: true }));
    await AsyncStorage.setItem(NOTIF_HISTORY_KEY, JSON.stringify(updated));
    await clearBadge();
  } catch {}
}

export async function clearNotifHistory(): Promise<void> {
  await AsyncStorage.removeItem(NOTIF_HISTORY_KEY);
  await clearBadge();
}

// ─── Badge ────────────────────────────────────────────────────────────────────

export async function updateBadge(): Promise<void> {
  try {
    const count = await getUnreadCount();
    await Notifications.setBadgeCountAsync(count);
  } catch {}
}

export async function clearBadge(): Promise<void> {
  try {
    await Notifications.setBadgeCountAsync(0);
  } catch {}
}

// ─── Helper kirim notif lokal ─────────────────────────────────────────────────

async function sendLocal(
  title:    string,
  body:     string,
  data:     Record<string, unknown>,
  category: NotifCategory,
  channelId = "general",
): Promise<void> {
  const permitted = await isNotificationPermissionGranted();
  if (!permitted) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      sound: "default",
      ...(Platform.OS === "android" ? { channelId } : {}),
    },
    trigger: null,
  });
  await addToHistory({ category, title, body });
}

// ─── Produk ───────────────────────────────────────────────────────────────────

async function getAllProducts(ownerId?: string): Promise<Product[]> {
  try {
    const results: Product[] = [];
    if (ownerId) {
      const rawLocal = await AsyncStorage.getItem(PRODUCTS_KEY);
      if (rawLocal) {
        const local: Product[] = JSON.parse(rawLocal);
        results.push(...local.filter((p) => !p.ownerId || p.ownerId === ownerId));
      }
    }
    const rawGlobal = await AsyncStorage.getItem(GLOBAL_PRODUCTS_KEY);
    if (rawGlobal) {
      const global: Product[] = JSON.parse(rawGlobal);
      const globalFiltered = ownerId ? global.filter((p) => p.ownerId === ownerId) : global;
      results.push(...globalFiltered);
    }
    const seen = new Set<string>();
    return results.filter((p) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
  } catch (e) {
    console.error("StockNotif getAllProducts:", e);
    return [];
  }
}

// ─── Snooze ───────────────────────────────────────────────────────────────────

export async function snoozeProduct(productId: string, durationMs = 86400000): Promise<void> {
  try {
    const raw     = await AsyncStorage.getItem(NOTIF_SNOOZED_KEY);
    const snoozed: Record<string, number> = raw ? JSON.parse(raw) : {};
    snoozed[productId] = Date.now() + durationMs;
    await AsyncStorage.setItem(NOTIF_SNOOZED_KEY, JSON.stringify(snoozed));
  } catch {}
}

export async function clearSnooze(productId: string): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(NOTIF_SNOOZED_KEY);
    if (!raw) return;
    const snoozed: Record<string, number> = JSON.parse(raw);
    delete snoozed[productId];
    await AsyncStorage.setItem(NOTIF_SNOOZED_KEY, JSON.stringify(snoozed));
  } catch {}
}

export async function filterSnoozedProducts(items: LowStockItem[]): Promise<LowStockItem[]> {
  try {
    const raw = await AsyncStorage.getItem(NOTIF_SNOOZED_KEY);
    if (!raw) return items;
    const snoozed: Record<string, number> = JSON.parse(raw);
    const now = Date.now();
    return items.filter((item) => {
      const snoozeUntil = snoozed[item.productId];
      return !snoozeUntil || now > snoozeUntil;
    });
  } catch {
    return items;
  }
}

// ─── Cek stok ─────────────────────────────────────────────────────────────────

export async function checkLowStock(
  ownerId?:        string,
  globalThreshold: number = DEFAULT_STOK_MINIMUM,
): Promise<StockCheckResult> {
  const products      = await getAllProducts(ownerId);
  const lowStockItems: LowStockItem[] = [];

  for (const p of products) {
    const stok      = p.stok ?? p.stock ?? 0;
    const threshold = p.stokMinimum ?? globalThreshold;
    if (stok <= threshold && stok >= 0) {
      lowStockItems.push({
        productId:   p.id,
        productName: p.name,
        stokSaat:    stok,
        stokMinimum: threshold,
        ownerId:     p.ownerId,
      });
    }
  }

  const result: StockCheckResult = {
    lowStockItems,
    totalProducts: products.length,
    checkedAt:     new Date().toISOString(),
  };
  await AsyncStorage.setItem(NOTIF_LAST_CHECK_KEY, result.checkedAt);
  return result;
}

// ─── Kirim notif stok menipis ─────────────────────────────────────────────────

export async function sendLowStockNotification(items: LowStockItem[]): Promise<void> {
  if (items.length === 0) return;
  const settings = await loadNotifSettings();
  if (!settings.stokMenipis) return;

  if (items.length === 1) {
    const item = items[0];
    await sendLocal(
      "⚠️ Stok Menipis!",
      item.productName + " tersisa " + item.stokSaat + " unit. Segera restok!",
      { type: "low_stock", productId: item.productId, productName: item.productName },
      "stokMenipis",
      "stock-alert",
    );
  } else {
    const habisCount   = items.filter((i) => i.stokSaat === 0).length;
    const menipisCount = items.length - habisCount;
    const bodyParts: string[] = [];
    if (habisCount > 0)   bodyParts.push(habisCount + " produk habis");
    if (menipisCount > 0) bodyParts.push(menipisCount + " produk menipis");
    const previewNames = items
      .slice(0, 3)
      .map((i) => i.productName + " (" + i.stokSaat + ")")
      .join(", ");
    await sendLocal(
      "⚠️ " + items.length + " Produk Perlu Restok",
      bodyParts.join(", ") + ".\n" + previewNames + (items.length > 3 ? ", ..." : ""),
      { type: "low_stock_bulk", count: items.length },
      "stokMenipis",
      "stock-alert",
    );
  }
}

// ─── Main: cek + filter snooze + kirim ───────────────────────────────────────

export async function checkAndNotifyLowStock(
  ownerId?:  string,
  threshold: number = DEFAULT_STOK_MINIMUM,
): Promise<StockCheckResult> {
  const result   = await checkLowStock(ownerId, threshold);
  const toNotify = await filterSnoozedProducts(result.lowStockItems);
  await sendLowStockNotification(toNotify);
  return result;
}

// Alias
export const checkAndNotifyStok = checkAndNotifyLowStock;

// ─── Jadwal harian ────────────────────────────────────────────────────────────

export async function scheduleStockCheckNotification(hourOfDay = 8): Promise<string> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: "📦 Cek Stok Harian",
      body:  "Saatnya memeriksa stok produk Anda hari ini.",
      data:  { type: "daily_stock_reminder" },
      sound: "default",
      ...(Platform.OS === "android" ? { channelId: "stock-alert" } : {}),
    },
    trigger: {
      type:   Notifications.SchedulableTriggerInputTypes.DAILY,
      hour:   hourOfDay,
      minute: 0,
    },
  });
  return id;
}

export async function cancelScheduledStockCheck(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

// ─── Reminder harian (jam custom dari settings) ───────────────────────────────

export async function scheduleReminderHarian(jamStr: string): Promise<void> {
  try {
    const oldId = await AsyncStorage.getItem(NOTIF_DAILY_ID_KEY);
    if (oldId) await Notifications.cancelScheduledNotificationAsync(oldId);

    const [hourStr, minuteStr] = jamStr.split(":");
    const hour   = parseInt(hourStr, 10);
    const minute = parseInt(minuteStr, 10);
    if (isNaN(hour) || isNaN(minute)) return;

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: "📋 Reminder Harian TWD POS",
        body:  "Jangan lupa cek stok & laporan hari ini!",
        data:  { type: "daily_reminder" },
        sound: "default",
        ...(Platform.OS === "android" ? { channelId: "general" } : {}),
      },
      trigger: {
        type:   Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      },
    });
    await AsyncStorage.setItem(NOTIF_DAILY_ID_KEY, id);
  } catch (e) {
    console.error("scheduleReminderHarian:", e);
  }
}

export async function cancelReminderHarian(): Promise<void> {
  try {
    const id = await AsyncStorage.getItem(NOTIF_DAILY_ID_KEY);
    if (id) {
      await Notifications.cancelScheduledNotificationAsync(id);
      await AsyncStorage.removeItem(NOTIF_DAILY_ID_KEY);
    }
  } catch {}
}

// ─── Notif Transaksi ──────────────────────────────────────────────────────────

export async function notifyTransaksiBaru(
  kasirName: string,
  total:     number,
  itemCount: number,
): Promise<void> {
  const settings = await loadNotifSettings();
  if (!settings.transaksi) return;
  await sendLocal(
    "🧾 Transaksi Baru!",
    kasirName + " baru saja mencatat transaksi " + itemCount + " item — Rp " + total.toLocaleString("id-ID"),
    { type: "transaksi_baru", kasirName, total },
    "transaksi",
    "transaksi",
  );
}

// ─── Notif Retur ──────────────────────────────────────────────────────────────

export async function notifyReturMasuk(
  kasirName:  string,
  totalRetur: number,
): Promise<void> {
  const settings = await loadNotifSettings();
  if (!settings.retur) return;
  await sendLocal(
    "⚠️ Permintaan Retur Masuk",
    kasirName + " mengajukan retur senilai Rp " + totalRetur.toLocaleString("id-ID") + ". Segera tinjau!",
    { type: "retur_masuk", kasirName, totalRetur },
    "retur",
    "general",
  );
}

export async function notifyReturDiproses(
  status:     "disetujui" | "ditolak",
  totalRetur: number,
): Promise<void> {
  const settings = await loadNotifSettings();
  if (!settings.retur) return;
  const approved = status === "disetujui";
  await sendLocal(
    approved ? "✅ Retur Disetujui" : "❌ Retur Ditolak",
    "Retur senilai Rp " + totalRetur.toLocaleString("id-ID") + " telah " + (approved ? "disetujui" : "ditolak") + ".",
    { type: "retur_diproses", status, totalRetur },
    "retur",
    "general",
  );
}

// ─── Notif Langganan ──────────────────────────────────────────────────────────

export async function notifyLanggananHampirExpired(
  tokoName: string,
  daysLeft: number,
): Promise<void> {
  await sendLocal(
    "⏰ Langganan Hampir Habis!",
    tokoName + " — langganan berakhir " + daysLeft + " hari lagi. Segera perpanjang!",
    { type: "langganan_hampir_expired", tokoName, daysLeft },
    "langganan",
    "general",
  );
}

export async function notifyLanggananExpired(tokoName: string): Promise<void> {
  await sendLocal(
    "🚫 Langganan Habis!",
    tokoName + " — masa langganan sudah berakhir. Hubungi marketing untuk perpanjangan.",
    { type: "langganan_expired", tokoName },
    "langganan",
    "general",
  );
}

// ─── Cek & notifikasi langganan (dipanggil dari OwnerDashboard) ───────────────

export async function checkAndNotifyLangganan(
  tokoName:       string,
  expiryDateStr:  string,
): Promise<void> {
  if (!expiryDateStr) return;
  const permitted = await isNotificationPermissionGranted();
  if (!permitted) return;

  const settings = await loadNotifSettings();
  if (!settings.langganan) return;

  const expiryDate = new Date(expiryDateStr);
  const now        = new Date();
  const diffDays   = Math.ceil((expiryDate.getTime() - now.getTime()) / 86400000);

  if (diffDays === 7)      await notifyLanggananHampirExpired(tokoName, 7);
  else if (diffDays === 3) await notifyLanggananHampirExpired(tokoName, 3);
  else if (diffDays === 1) await notifyLanggananHampirExpired(tokoName, 1);
  else if (diffDays <= 0)  await notifyLanggananExpired(tokoName);
}

export async function checkAndNotifyLanggananFull(
  ownerId:  string,
  tokoName: string,
): Promise<void> {
  const expiry = await AsyncStorage.getItem("twd_expiry_date");
  if (!expiry) return;
  await checkAndNotifyLangganan(tokoName, expiry);
}

// ─── Jadwal Pengecekan Langganan Harian ─────────────────────────────────────

export async function scheduleLanggananCheck(hourOfDay = 9): Promise<string> {
  // Batalkan jadwal lama jika ada
  await Notifications.cancelAllScheduledNotificationsAsync();
  // Catatan: Ini akan membatalkan SEMUA jadwal notifikasi lain (stok, reminder, dll).
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: "📅 Cek Langganan Harian",
      body:  "Sistem sedang memeriksa status langganan toko Anda.",
      data:  { type: "daily_langganan_check" },
      sound: "default",
      ...(Platform.OS === "android" ? { channelId: "general" } : {}),
    },
    trigger: {
      type:   Notifications.SchedulableTriggerInputTypes.DAILY,
      hour:   hourOfDay,
      minute: 0,
    },
  });
  return id;
}

export async function cancelScheduledLanggananCheck(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
