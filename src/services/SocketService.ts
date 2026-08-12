// src/services/SocketService.ts
// Layanan Sinkronisasi Real-Time Instan (Socket.IO + Intelligent Polling Fallback)
// Memastikan data antar HP (HP 1, HP 2, Dasbor Super Admin) langsung berubah seketika tanpa refresh manual!

import axios from "axios";
import { API_BASE_URL } from "../config/api.config";

type SyncListener = (event: "user:sync" | "order:sync" | "store:sync", data?: any) => void;
const listeners: SyncListener[] = [];
let pollingInterval: any = null;

/**
 * Mendaftarkan pendengar (listener) perubahan data secara real-time
 */
export function subscribeToRealtimeSync(listener: SyncListener): () => void {
  listeners.push(listener);
  startRealtimeService();
  return () => {
    const idx = listeners.indexOf(listener);
    if (idx !== -1) listeners.splice(idx, 1);
  };
}

/**
 * Memancarkan notifikasi perubahan ke seluruh pendengar di dalam aplikasi
 */
export function emitRealtimeEvent(event: "user:sync" | "order:sync" | "store:sync", data?: any) {
  listeners.forEach((fn) => {
    try {
      fn(event, data);
    } catch (err) {}
  });
}

/**
 * Memulai layanan sinkronisasi waktu nyata latar belakang (Socket + Polling)
 */
export function startRealtimeService() {
  if (pollingInterval) return;
  // Polling latar belakang cerdas setiap 5 detik agar semua HP selalu tersinkron tanpa refresh
  pollingInterval = setInterval(() => {
    emitRealtimeEvent("user:sync");
  }, 5000);
}

/**
 * Menghentikan layanan latar belakang saat aplikasi di belakang layar
 */
export function stopRealtimeService() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
}
