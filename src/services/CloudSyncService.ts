// src/services/CloudSyncService.ts
// Layanan Sinkronisasi Cloud 2-Arah (Local AsyncStorage ↔ Server Cloud VPS Biznet Gio 103.127.97.28:5000)
// Memastikan antar HP (HP 1, HP 2, Dasbor Super Admin) selalu terhubung & tersinkronisasi aktual!

import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { API_BASE_URL } from "../config/api.config";

/**
 * Sinkronisasi seluruh akun Pengguna & Mitra ke Server Cloud
 */
export async function syncUsersWithCloud(localUsers: any[]): Promise<any[]> {
  let cloudUsers: any[] = [];
  try {
    const response = await axios.get(`${API_BASE_URL}/auth/users`, { timeout: 4000 });
    if (response.data && response.data.status === "success" && Array.isArray(response.data.data)) {
      cloudUsers = response.data.data;
    }
  } catch (err) {}

  const mergedMap = new Map<string, any>();
  for (const cu of cloudUsers) {
    mergedMap.set(cu.id, cu);
  }

  for (const lu of localUsers) {
    const existsByPhone = cloudUsers.some(
      (c) => c.phone && lu.phone && c.phone === lu.phone
    );
    if (!mergedMap.has(lu.id) && !existsByPhone) {
      mergedMap.set(lu.id, lu);
      try {
        await axios.post(`${API_BASE_URL}/auth/register`, {
          name:     lu.name || lu.nama || "User",
          phone:    lu.phone || "081200000000",
          pin:      lu.pin || "123456",
          role:     lu.role || "owner",
          ownerId:  lu.ownerId || null,
          tokoName: lu.tokoName || null,
        }, { timeout: 3000 });
      } catch {}
    } else if (!mergedMap.has(lu.id)) {
      mergedMap.set(lu.id, lu);
    }
  }

  const result = Array.from(mergedMap.values());
  return result.length > 0 ? result : localUsers;
}

/**
 * Daftarkan Mitra / Owner baru langsung ke Server Cloud VPS Biznet Gio
 */
export async function registerToCloud(accountData: any): Promise<boolean> {
  try {
    const res = await axios.post(`${API_BASE_URL}/auth/register`, {
      name:     accountData.name || accountData.nama || "User",
      phone:    accountData.phone,
      pin:      accountData.pin || "123456",
      role:     accountData.role || "owner",
      ownerId:  accountData.ownerId,
      tokoName: accountData.tokoName,
      kode:     accountData.kodeToken || accountData.kode,
    }, { timeout: 5000 });
    return res.status === 201 || res.status === 200;
  } catch (err) {
    return false;
  }
}

/**
 * Hapus akun Pengguna dari Server Cloud VPS Biznet Gio
 */
export async function deleteFromCloud(userId: string): Promise<boolean> {
  try {
    const res = await axios.delete(`${API_BASE_URL}/auth/users/${userId}`, { timeout: 5000 });
    return res.status === 200;
  } catch {
    return false;
  }
}

/**
 * Sinkronisasi daftar Toko / Owner ke Server Cloud VPS
 */
export async function syncStoresWithCloud(localStores: any[]): Promise<any[]> {
  try {
    const res = await axios.get(`${API_BASE_URL}/stores`, { timeout: 4000 });
    if (res.data && res.data.status === "success" && Array.isArray(res.data.data)) {
      return res.data.data;
    }
  } catch {}
  return localStores;
}
