// src/context/AuthContext.tsx — FINAL v2
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
export type UserRole =
  | "owner"
  | "kasir"
  | "kurir"
  | "marketing"
  | "sub_marketing"
  | "super_admin";

export interface KasirAccount {
  id:        string;
  name:      string;
  pin:       string;
  ownerId:   string;
  isActive:  boolean;
  createdAt?: string;
}

export interface AuthUser {
  role:     UserRole;
  name:     string;
  id?:      string;
  ownerId?: string;
}

interface AuthContextValue {
  user:           AuthUser | null;
  login:          (role: UserRole, name: string, id?: string, ownerId?: string) => void;
  logout:         () => void;
  kasirAccounts:  KasirAccount[];
  ownerPin:       string;
  langganan:      string;
  expiryDate:     string;
  addKasir:       (k: KasirAccount)        => Promise<void>;
  updateKasir:    (k: KasirAccount)        => Promise<void>;
  deleteKasir:    (id: string)             => Promise<void>;
  changeOwnerPin: (pin: string)            => Promise<void>;
  setLangganan:   (l: string, exp: string) => Promise<void>;
  reloadKasir:    ()                       => Promise<void>;
}

// ─── Context ──────────────────────────────────────────────────────────────────
const AuthContext = createContext<AuthContextValue>({
  user:           null,
  login:          () => {},
  logout:         () => {},
  kasirAccounts:  [],
  ownerPin:       "",
  langganan:      "basic",
  expiryDate:     "",
  addKasir:       async () => {},
  updateKasir:    async () => {},
  deleteKasir:    async () => {},
  changeOwnerPin: async () => {},
  setLangganan:   async () => {},
  reloadKasir:    async () => {},
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
// Filter kasir: tampilkan kasir milik owner ini ATAU kasir lama tanpa ownerId
function filterKasir(all: KasirAccount[], ownerId: string): KasirAccount[] {
  return all.filter((k) => k.ownerId === ownerId || !k.ownerId);
}

// ─── Provider ─────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,          setUser]           = useState<AuthUser | null>(null);
  const [kasirAccounts, setKasirAccounts]  = useState<KasirAccount[]>([]);
  const [ownerPin,      setOwnerPin]       = useState("");
  const [langganan,     setLanggananState] = useState("basic");
  const [expiryDate,    setExpiryDate]     = useState("");

  // ── Load data owner ────────────────────────────────────────────────────────
  const loadOwnerData = useCallback(async (ownerId: string) => {
    try {
      const rawKasir = await AsyncStorage.getItem("@twd_kasir_accounts");
      const allKasir: KasirAccount[] = rawKasir ? JSON.parse(rawKasir) : [];
      setKasirAccounts(filterKasir(allKasir, ownerId));

      const pin  = await AsyncStorage.getItem("twd_owner_pin_" + ownerId);
      setOwnerPin(pin ?? "");

      const lang = await AsyncStorage.getItem("twd_langganan");
      setLanggananState(lang ?? "basic");

      const exp  = await AsyncStorage.getItem("twd_expiry_date");
      setExpiryDate(exp ?? "");
    } catch (e) {
      console.error("AuthContext loadOwnerData:", e);
    }
  }, []);

  // ── Restore session saat app dibuka ────────────────────────────────────────
  useEffect(() => {
    AsyncStorage.getItem("@twd_session").then((raw) => {
      if (!raw) return;
      try {
        const saved: AuthUser = JSON.parse(raw);
        setUser(saved);
        if (saved.role === "owner" && saved.id) {
          loadOwnerData(saved.id);
        }
      } catch {}
    });
  }, [loadOwnerData]);

  // ── login ──────────────────────────────────────────────────────────────────
  const login = useCallback(
    (role: UserRole, name: string, id?: string, ownerId?: string) => {
      const newUser: AuthUser = { role, name, id, ownerId };
      setUser(newUser);
      // Simpan session agar tidak logout saat app restart
      AsyncStorage.setItem("@twd_session", JSON.stringify(newUser)).catch(() => {});
      if (role === "owner" && id) loadOwnerData(id);
    },
    [loadOwnerData],
  );

  // ── logout ─────────────────────────────────────────────────────────────────
  const logout = useCallback(() => {
    setUser(null);
    setKasirAccounts([]);
    setOwnerPin("");
    setLanggananState("basic");
    setExpiryDate("");
    AsyncStorage.removeItem("@twd_session").catch(() => {});
  }, []);

  // ── reloadKasir ────────────────────────────────────────────────────────────
  const reloadKasir = useCallback(async () => {
    if (!user?.id) return;
    const rawKasir = await AsyncStorage.getItem("@twd_kasir_accounts");
    const allKasir: KasirAccount[] = rawKasir ? JSON.parse(rawKasir) : [];
    setKasirAccounts(filterKasir(allKasir, user.id));
  }, [user?.id]);

  // ── addKasir ───────────────────────────────────────────────────────────────
  const addKasir = useCallback(async (k: KasirAccount) => {
    const rawKasir = await AsyncStorage.getItem("@twd_kasir_accounts");
    const all: KasirAccount[] = rawKasir ? JSON.parse(rawKasir) : [];
    const updated = [...all, k];
    await AsyncStorage.setItem("@twd_kasir_accounts", JSON.stringify(updated));
    if (user?.id) setKasirAccounts(filterKasir(updated, user.id));
  }, [user?.id]);

  // ── updateKasir ────────────────────────────────────────────────────────────
  const updateKasir = useCallback(async (k: KasirAccount) => {
    const rawKasir = await AsyncStorage.getItem("@twd_kasir_accounts");
    const all: KasirAccount[] = rawKasir ? JSON.parse(rawKasir) : [];
    const updated = all.map((x) => (x.id === k.id ? k : x));
    await AsyncStorage.setItem("@twd_kasir_accounts", JSON.stringify(updated));
    if (user?.id) setKasirAccounts(filterKasir(updated, user.id));
  }, [user?.id]);

  // ── deleteKasir ────────────────────────────────────────────────────────────
  const deleteKasir = useCallback(async (id: string) => {
    const rawKasir = await AsyncStorage.getItem("@twd_kasir_accounts");
    const all: KasirAccount[] = rawKasir ? JSON.parse(rawKasir) : [];
    const updated = all.filter((x) => x.id !== id);
    await AsyncStorage.setItem("@twd_kasir_accounts", JSON.stringify(updated));
    if (user?.id) setKasirAccounts(filterKasir(updated, user.id));
  }, [user?.id]);

  // ── changeOwnerPin ─────────────────────────────────────────────────────────
  const changeOwnerPin = useCallback(async (pin: string) => {
    if (!user?.id) return;
    await AsyncStorage.setItem("twd_owner_pin_" + user.id, pin);
    setOwnerPin(pin);
  }, [user?.id]);

  // ── setLangganan ───────────────────────────────────────────────────────────
  const setLangganan = useCallback(async (l: string, exp: string) => {
    await AsyncStorage.setItem("twd_langganan", l);
    await AsyncStorage.setItem("twd_expiry_date", exp);
    setLanggananState(l);
    setExpiryDate(exp);
  }, []);

  // ── Context value ──────────────────────────────────────────────────────────
  const ctxValue: AuthContextValue = {
    user,
    login,
    logout,
    kasirAccounts,
    ownerPin,
    langganan,
    expiryDate,
    addKasir,
    updateKasir,
    deleteKasir,
    changeOwnerPin,
    setLangganan,
    reloadKasir,
  };

  return (
    <AuthContext.Provider value={ctxValue}>
      {children}
    </AuthContext.Provider>
  );
}

export { AuthContext };

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}