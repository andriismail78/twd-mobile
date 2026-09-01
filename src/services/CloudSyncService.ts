// src/services/CloudSyncService.ts
import axiosClient from "../config/axiosClient";

/**
 * Sinkronisasi seluruh akun Pengguna & Mitra ke Server Cloud
 */
export async function syncUsersWithCloud(localUsers: any[]): Promise<any[]> {
  let cloudUsers: any[] = [];
  try {
    const response = await axiosClient.get(`/auth/users`, { timeout: 10000 });
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
        await axiosClient.post(`/auth/register`, {
          name:     lu.name || lu.nama || "User",
          phone:    lu.phone || "081200000000",
          pin:      lu.pin || "123456",
          role:     lu.role || "owner",
          ownerId:  lu.ownerId || null,
          tokoName: lu.tokoName || null,
        }, { timeout: 10000 });
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
    const res = await axiosClient.post(`/auth/register`, {
      name:     accountData.name || accountData.nama || "User",
      phone:    accountData.phone,
      pin:      accountData.pin || "123456",
      role:     accountData.role || "owner",
      ownerId:  accountData.ownerId,
      tokoName: accountData.tokoName,
      kode:     accountData.kodeToken || accountData.kode,
    }, { timeout: 15000 }); // Timeout diperpanjang menjadi 15 detik
    
    return res.status === 201 || res.status === 200;
  } catch (err: any) {
    console.error("Gagal daftar ke server (CloudSyncService):", err?.response?.data || err?.message);
    return false;
  }
}

/**
 * Hapus akun Pengguna dari Server Cloud VPS Biznet Gio
 */
export async function deleteFromCloud(userId: string): Promise<boolean> {
  try {
    const res = await axiosClient.delete(`/auth/users/${userId}`, { timeout: 10000 });
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
    const res = await axiosClient.get(`/stores`, { timeout: 10000 });
    if (res.data && res.data.status === "success" && Array.isArray(res.data.data)) {
      return res.data.data;
    }
  } catch {}
  return localStores;
}