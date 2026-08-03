// src/screens/SuperAdminScreen.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMarketing } from "../context/MarketingContext";

const C_BG     = "#0F172A";
const C_CARD   = "#1E293B";
const C_BORDER = "#334155";
const C_TEXT   = "#F1F5F9";
const C_SUB    = "#94A3B8";
const C_ACCENT = "#38BDF8";
const C_GREEN  = "#4ADE80";
const C_RED    = "#F87171";
const C_ORANGE = "#FBBF24";
const C_PURPLE = "#A78BFA";
const SHADOW_DOWN = { width: 0, height: 2 };

const TABS = [
  { key: "dashboard", label: "📊 Dashboard" },
  { key: "owner",     label: "🏪 Owner"     },
  { key: "kasir",     label: "💼 Kasir"     },
  { key: "mitra",     label: "🤝 Mitra"     },
];
const PAKET_OPTIONS = ["basic", "pro", "enterprise"];
const MITRA_ROLES = [
  { value: "marketing",     label: "Marketing"     },
  { value: "sub_marketing", label: "Sub Marketing" },
  { value: "kurir",         label: "Kurir"         },
];
const STORAGE_KEYS = {
  owners:    "@twd_owner_registrations",
  kasir:     "@twd_kasir_accounts",
  marketing: "@twd_marketing_accounts",
  orders:    "@twd_orders",
};

interface OwnerReg {
  id:         string;
  name:       string;
  kode:       string;
  tokoName:   string;
  phone:      string;
  pin:        string;
  paket:      string;
  expiryDate: string;
  langganan:  boolean;
  suspended?: boolean;
  createdAt?: string;
}
interface KasirAccount {
  id:      string;
  ownerId: string;
  name:    string;
  phone:   string;
  pin:     string;
  active?: boolean;
}
interface MitraAccount {
  id:       string;
  name:     string;
  phone:    string;
  pin:      string;
  role:     string;
  ownerId?: string;
  active?:  boolean;
}
interface SuperAdminScreenProps {
  onBack?: () => void;
}
interface StatCard {
  label: string;
  value: string;
  color: string;
  icon:  string;
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
function formatDate(iso: string): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "2-digit", month: "short", year: "numeric",
  });
}
function isExpired(expiryDate: string): boolean {
  if (!expiryDate) return true;
  return new Date(expiryDate) < new Date();
}
function paketColor(paket: string): string {
  if (paket === "enterprise") return C_PURPLE;
  if (paket === "pro")        return C_ORANGE;
  return C_ACCENT;
}
function roleLabel(role: string): string {
  if (role === "marketing")     return "Marketing";
  if (role === "sub_marketing") return "Sub Marketing";
  if (role === "kurir")         return "Kurir";
  return role;
}
function maskPin(pin: string): string {
  return "•".repeat(pin.length);
}
function ACCENT_BG() { return "#38BDF822"; }

export default function SuperAdminScreen({ onBack }: SuperAdminScreenProps) {
  const insets = useSafeAreaInsets();
  const { addMarketing, addKurir } = useMarketing();

  const [activeTab,   setActiveTab]   = useState("dashboard");
  const [loading,     setLoading]     = useState(true);
  const [owners,      setOwners]      = useState<OwnerReg[]>([]);
  const [kasirList,   setKasirList]   = useState<KasirAccount[]>([]);
  const [mitraList,   setMitraList]   = useState<MitraAccount[]>([]);
  const [totalOrders, setTotalOrders] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [mitraFilter, setMitraFilter] = useState("semua");

  const [modalType,     setModalType]     = useState<"owner" | "kasir" | "mitra" | null>(null);
  const [editTarget,    setEditTarget]    = useState<OwnerReg | KasirAccount | MitraAccount | null>(null);
  const [modalVisible,  setModalVisible]  = useState(false);
  const [detailOwner,   setDetailOwner]   = useState<OwnerReg | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);

  const [fName,    setFName]    = useState("");
  const [fPhone,   setFPhone]   = useState("");
  const [fPin,     setFPin]     = useState("");
  const [fToko,    setFToko]    = useState("");
  const [fPaket,   setFPaket]   = useState("basic");
  const [fExpiry,  setFExpiry]  = useState("");
  const [fRole,    setFRole]    = useState("marketing");
  const [fOwnerId, setFOwnerId] = useState("");

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [rawO, rawK, rawM, rawOrd] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.owners),
        AsyncStorage.getItem(STORAGE_KEYS.kasir),
        AsyncStorage.getItem(STORAGE_KEYS.marketing),
        AsyncStorage.getItem(STORAGE_KEYS.orders),
      ]);
      setOwners(rawO  ? JSON.parse(rawO)  : []);
      setKasirList(rawK  ? JSON.parse(rawK)  : []);
      setMitraList(rawM  ? JSON.parse(rawM)  : []);
      const orders = rawOrd ? JSON.parse(rawOrd) : [];
      setTotalOrders(orders.length);
    } catch (e) {
      console.error("SuperAdmin loadAll:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  async function saveOwners(list: OwnerReg[]) {
    await AsyncStorage.setItem(STORAGE_KEYS.owners, JSON.stringify(list));
    setOwners(list);
  }
  async function saveKasir(list: KasirAccount[]) {
    await AsyncStorage.setItem(STORAGE_KEYS.kasir, JSON.stringify(list));
    setKasirList(list);
  }
  async function saveMitra(list: MitraAccount[]) {
    await AsyncStorage.setItem(STORAGE_KEYS.marketing, JSON.stringify(list));
    setMitraList(list);
  }

  function openAddOwner() {
    setEditTarget(null);
    setFName(""); setFPhone(""); setFPin(""); setFToko("");
    setFPaket("basic");
    const expiry = new Date();
    expiry.setMonth(expiry.getMonth() + 1);
    setFExpiry(expiry.toISOString().slice(0, 10));
    setModalType("owner"); setModalVisible(true);
  }
  function openEditOwner(o: OwnerReg) {
    setEditTarget(o);
    setFName(o.name); setFPhone(o.phone); setFPin(o.pin); setFToko(o.tokoName);
    setFPaket(o.paket); setFExpiry(o.expiryDate?.slice(0, 10) ?? "");
    setModalType("owner"); setModalVisible(true);
  }
  function openAddKasir() {
    setEditTarget(null);
    setFName(""); setFPhone(""); setFPin(""); setFOwnerId("");
    setModalType("kasir"); setModalVisible(true);
  }
  function openEditKasir(k: KasirAccount) {
    setEditTarget(k);
    setFName(k.name); setFPhone(k.phone); setFPin(k.pin); setFOwnerId(k.ownerId);
    setModalType("kasir"); setModalVisible(true);
  }
  function openAddMitra() {
    setEditTarget(null);
    setFName(""); setFPhone(""); setFPin(""); setFRole("marketing");
    setModalType("mitra"); setModalVisible(true);
  }
  function openEditMitra(m: MitraAccount) {
    setEditTarget(m);
    setFName(m.name); setFPhone(m.phone); setFPin(m.pin); setFRole(m.role);
    setModalType("mitra"); setModalVisible(true);
  }
  function closeModal() { setModalVisible(false); setEditTarget(null); setModalType(null); }

  async function handleSave() {
    if (!fName.trim() || !fPin.trim()) {
      Alert.alert("Error", "Nama dan PIN wajib diisi.");
      return;
    }
    if (fPin.length < 4) {
      Alert.alert("Error", "PIN minimal 4 digit.");
      return;
    }

    if (modalType === "owner") {
      if (!fToko.trim()) { Alert.alert("Error", "Nama toko wajib diisi."); return; }
      const isEdit = editTarget !== null;
      if (isEdit) {
        const updated = owners.map((o) =>
          o.id === (editTarget as OwnerReg).id
            ? { ...o, name: fName, phone: fPhone, pin: fPin, tokoName: fToko, paket: fPaket, expiryDate: fExpiry, langganan: true }
            : o
        );
        await saveOwners(updated);
      } else {
        const newOwner: OwnerReg = {
          id:         generateId(),
          name:       fName,
          phone:      fPhone,
          pin:        fPin,
          tokoName:   fToko,
          kode:       "OWN" + Math.random().toString(36).slice(2, 6).toUpperCase(),
          paket:      fPaket,
          expiryDate: fExpiry,
          langganan:  true,
          createdAt:  new Date().toISOString(),
        };
        await saveOwners([...owners, newOwner]);
        // ✅ Simpan PIN ke twd_owner_pin_{id} agar LoginScreen bisa verifikasi
        await AsyncStorage.setItem("twd_owner_pin_" + newOwner.id, fPin);
      }
    }

    if (modalType === "kasir") {
      const isEdit = editTarget !== null;
      const updated = isEdit
        ? kasirList.map((k) =>
            k.id === (editTarget as KasirAccount).id
              ? { ...k, name: fName, phone: fPhone, pin: fPin, ownerId: fOwnerId }
              : k
          )
        : [
            ...kasirList,
            { id: generateId(), name: fName, phone: fPhone, pin: fPin, ownerId: fOwnerId, active: true } as KasirAccount,
          ];
      await saveKasir(updated);
    }

    if (modalType === "mitra") {
      const isEdit = editTarget !== null;
      const updated = isEdit
        ? mitraList.map((m) =>
            m.id === (editTarget as MitraAccount).id
              ? { ...m, name: fName, phone: fPhone, pin: fPin, role: fRole }
              : m
          )
        : [
            ...mitraList,
            { id: generateId(), name: fName, phone: fPhone, pin: fPin, role: fRole, active: true } as MitraAccount,
          ];
      await saveMitra(updated);

      // ✅ Sync ke MarketingContext agar login langsung bisa pakai data baru
      if (!isEdit) {
        if (fRole === "kurir") {
          addKurir({
            name: fName, phone: fPhone, pin: fPin,
            wilayah: "", status: "available",
          });
        } else {
          addMarketing({
            name: fName, phone: fPhone, pin: fPin,
            role: fRole as "marketing" | "sub_marketing",
          });
        }
      }
    }

    closeModal();
    Alert.alert("✅ Berhasil", "Data berhasil disimpan.");
  }

  function confirmSuspendOwner(o: OwnerReg) {
    const action = o.suspended ? "Aktifkan" : "Suspend";
    Alert.alert(action + " Owner", action + " akun " + o.name + "?", [
      { text: "Batal", style: "cancel" },
      {
        text: action, style: o.suspended ? "default" : "destructive",
        onPress: async () => {
          const updated = owners.map((x) => x.id === o.id ? { ...x, suspended: !x.suspended } : x);
          await saveOwners(updated);
          if (detailOwner?.id === o.id) setDetailOwner({ ...o, suspended: !o.suspended });
        },
      },
    ]);
  }
  function confirmDeleteOwner(o: OwnerReg) {
    Alert.alert("Hapus Owner", "Hapus akun " + o.name + "? Semua kasir owner ini juga akan dihapus.", [
      { text: "Batal", style: "cancel" },
      {
        text: "Hapus", style: "destructive",
        onPress: async () => {
          await saveOwners(owners.filter((x) => x.id !== o.id));
          await saveKasir(kasirList.filter((k) => k.ownerId !== o.id));
          setDetailVisible(false);
        },
      },
    ]);
  }
  function confirmResetPin(type: "owner" | "kasir" | "mitra", target: OwnerReg | KasirAccount | MitraAccount) {
    Alert.prompt
      ? Alert.prompt(
          "Reset PIN", "Masukkan PIN baru untuk " + target.name,
          async (newPin) => {
            if (!newPin || newPin.length < 4) { Alert.alert("Error", "PIN minimal 4 digit."); return; }
            await applyResetPin(type, target, newPin);
          },
          "plain-text", "", "number-pad"
        )
      : Alert.alert("Reset PIN", "Fitur reset PIN tersedia di iOS. Gunakan Edit untuk ubah PIN.", [{ text: "OK" }]);
  }
  async function applyResetPin(type: "owner" | "kasir" | "mitra", target: any, newPin: string) {
    if (type === "owner") {
      const updated = owners.map((o) => o.id === target.id ? { ...o, pin: newPin } : o);
      await saveOwners(updated);
      await AsyncStorage.setItem("twd_owner_pin_" + target.id, newPin);
    } else if (type === "kasir") {
      const updated = kasirList.map((k) => k.id === target.id ? { ...k, pin: newPin } : k);
      await saveKasir(updated);
    } else {
      const updated = mitraList.map((m) => m.id === target.id ? { ...m, pin: newPin } : m);
      await saveMitra(updated);
    }
    Alert.alert("✅ PIN Direset", "PIN baru berhasil disimpan.");
  }
  function confirmDeleteKasir(k: KasirAccount) {
    Alert.alert("Hapus Kasir", "Hapus kasir " + k.name + "?", [
      { text: "Batal", style: "cancel" },
      { text: "Hapus", style: "destructive", onPress: async () => { await saveKasir(kasirList.filter((x) => x.id !== k.id)); } },
    ]);
  }
  function confirmDeleteMitra(m: MitraAccount) {
    Alert.alert("Hapus Mitra", "Hapus akun " + m.name + "?", [
      { text: "Batal", style: "cancel" },
      { text: "Hapus", style: "destructive", onPress: async () => { await saveMitra(mitraList.filter((x) => x.id !== m.id)); } },
    ]);
  }
  function confirmToggleKasirActive(k: KasirAccount) {
    const action = k.active === false ? "Aktifkan" : "Nonaktifkan";
    Alert.alert(action + " Kasir", action + " " + k.name + "?", [
      { text: "Batal", style: "cancel" },
      { text: action, onPress: async () => {
        const updated = kasirList.map((x) => x.id === k.id ? { ...x, active: k.active === false } : x);
        await saveKasir(updated);
      }},
    ]);
  }
  function extendLangganan(o: OwnerReg) {
    Alert.alert("Perpanjang Langganan", "Perpanjang 1 bulan untuk " + o.name + "?", [
      { text: "Batal", style: "cancel" },
      {
        text: "Perpanjang",
        onPress: async () => {
          const base = o.expiryDate && !isExpired(o.expiryDate) ? new Date(o.expiryDate) : new Date();
          base.setMonth(base.getMonth() + 1);
          const updated = owners.map((x) =>
            x.id === o.id ? { ...x, expiryDate: base.toISOString(), langganan: true } : x
          );
          await saveOwners(updated);
          if (detailOwner?.id === o.id) setDetailOwner({ ...o, expiryDate: base.toISOString(), langganan: true });
          Alert.alert("✅ Berhasil", "Langganan diperpanjang hingga " + formatDate(base.toISOString()));
        },
      },
    ]);
  }

  const filteredOwners = owners.filter(
    (o) =>
      o.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.tokoName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.kode?.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredKasir = kasirList.filter(
    (k) =>
      k.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      k.phone?.includes(searchQuery)
  );
  const filteredMitra = mitraList.filter((m) => {
    const matchRole   = mitraFilter === "semua" || m.role === mitraFilter;
    const matchSearch =
      m.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.phone?.includes(searchQuery);
    return matchRole && matchSearch;
  });

  const activeOwners  = owners.filter((o) => !o.suspended && !isExpired(o.expiryDate)).length;
  const expiredOwners = owners.filter((o) => isExpired(o.expiryDate) && !o.suspended).length;
  const proOwners     = owners.filter((o) => o.paket === "pro").length;
  const entOwners     = owners.filter((o) => o.paket === "enterprise").length;

  const statCards: StatCard[] = [
    { label: "Total Owner",     value: String(owners.length),    color: C_ACCENT,  icon: "🏪" },
    { label: "Owner Aktif",     value: String(activeOwners),     color: C_GREEN,   icon: "✅" },
    { label: "Exp/Suspend",     value: String(expiredOwners + owners.filter((o) => o.suspended).length), color: C_RED, icon: "⚠️" },
    { label: "Total Kasir",     value: String(kasirList.length), color: C_ORANGE,  icon: "💼" },
    { label: "Total Mitra",     value: String(mitraList.length), color: C_PURPLE,  icon: "🤝" },
    { label: "Total Transaksi", value: String(totalOrders),      color: C_ACCENT,  icon: "🧾" },
    { label: "Paket Pro",       value: String(proOwners),        color: C_ORANGE,  icon: "⭐" },
    { label: "Enterprise",      value: String(entOwners),        color: C_PURPLE,  icon: "👑" },
  ];
    function renderDashboard() {
    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={SS.scrollPad}>
        <Text style={SS.sectionTitle}>{"📊 Statistik Workspace"}</Text>
        <View style={SS.statsGrid}>
          {statCards.map((s) => (
            <View key={s.label} style={SS.statCard}>
              <Text style={SS.statIcon}>{s.icon}</Text>
              <Text style={[SS.statVal, { color: s.color }]}>{s.value}</Text>
              <Text style={SS.statLbl}>{s.label}</Text>
            </View>
          ))}
        </View>
        <Text style={SS.sectionTitle}>{"🏪 Owner Terbaru"}</Text>
        {owners.slice(-5).reverse().map((o) => (
          <TouchableOpacity
            key={o.id} style={SS.recentCard}
            onPress={() => { setDetailOwner(o); setDetailVisible(true); }}
          >
            <View style={SS.recentLeft}>
              <Text style={SS.recentName}>{o.tokoName}</Text>
              <Text style={SS.recentSub}>{o.name + " · " + o.kode}</Text>
            </View>
            <View style={SS.recentRight}>
              <View style={[SS.paketBadge, { borderColor: paketColor(o.paket) }]}>
                <Text style={[SS.paketBadgeTxt, { color: paketColor(o.paket) }]}>{o.paket.toUpperCase()}</Text>
              </View>
              {o.suspended && <Text style={SS.suspendBadge}>{"SUSPEND"}</Text>}
              {!o.suspended && isExpired(o.expiryDate) && <Text style={SS.expiredBadge}>{"EXPIRED"}</Text>}
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  }

  function renderOwners() {
    return (
      <View style={SS.flex}>
        <View style={SS.listHeader}>
          <TextInput
            style={SS.searchInput} placeholder={"Cari owner / toko / kode..."}
            placeholderTextColor={C_SUB} value={searchQuery} onChangeText={setSearchQuery}
          />
          <TouchableOpacity style={SS.addBtn} onPress={openAddOwner}>
            <Text style={SS.addBtnTxt}>{"+ Owner"}</Text>
          </TouchableOpacity>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={SS.scrollPad}>
          {filteredOwners.length === 0 && <Text style={SS.emptyTxt}>{"Tidak ada owner ditemukan."}</Text>}
          {filteredOwners.map((o) => (
            <TouchableOpacity
              key={o.id} style={SS.userCard}
              onPress={() => { setDetailOwner(o); setDetailVisible(true); }}
              activeOpacity={0.85}
            >
              <View style={SS.userCardLeft}>
                <View style={SS.userAvatar}>
                  <Text style={SS.userAvatarTxt}>{(o.tokoName ?? "?")[0].toUpperCase()}</Text>
                </View>
                <View style={SS.userInfo}>
                  <Text style={SS.userName}>{o.tokoName}</Text>
                  <Text style={SS.userSub}>{o.name + " · " + (o.phone || "-")}</Text>
                  <Text style={SS.userSub}>{"Kode: " + o.kode + " · Exp: " + formatDate(o.expiryDate)}</Text>
                </View>
              </View>
              <View style={SS.userCardRight}>
                <View style={[SS.paketBadge, { borderColor: paketColor(o.paket) }]}>
                  <Text style={[SS.paketBadgeTxt, { color: paketColor(o.paket) }]}>{o.paket.toUpperCase()}</Text>
                </View>
                {o.suspended
                  ? <Text style={SS.suspendBadge}>{"SUSPEND"}</Text>
                  : isExpired(o.expiryDate)
                    ? <Text style={SS.expiredBadge}>{"EXPIRED"}</Text>
                    : <Text style={SS.activeBadge}>{"AKTIF"}</Text>
                }
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  }

  function renderKasir() {
    return (
      <View style={SS.flex}>
        <View style={SS.listHeader}>
          <TextInput
            style={SS.searchInput} placeholder={"Cari kasir / nomor HP..."}
            placeholderTextColor={C_SUB} value={searchQuery} onChangeText={setSearchQuery}
          />
          <TouchableOpacity style={SS.addBtn} onPress={openAddKasir}>
            <Text style={SS.addBtnTxt}>{"+ Kasir"}</Text>
          </TouchableOpacity>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={SS.scrollPad}>
          {filteredKasir.length === 0 && <Text style={SS.emptyTxt}>{"Tidak ada kasir ditemukan."}</Text>}
          {filteredKasir.map((k) => {
            const ownerData = owners.find((o) => o.id === k.ownerId);
            return (
              <View key={k.id} style={SS.userCard}>
                <View style={SS.userCardLeft}>
                  <View style={[SS.userAvatar, SS.userAvatarKasir]}>
                    <Text style={SS.userAvatarTxt}>{(k.name ?? "?")[0].toUpperCase()}</Text>
                  </View>
                  <View style={SS.userInfo}>
                    <Text style={SS.userName}>{k.name}</Text>
                    <Text style={SS.userSub}>{k.phone || "No HP: -"}</Text>
                    <Text style={SS.userSub}>{"Toko: " + (ownerData?.tokoName ?? k.ownerId)}</Text>
                    <Text style={SS.userPin}>{"PIN: " + maskPin(k.pin)}</Text>
                  </View>
                </View>
                <View style={SS.actionCol}>
                  {k.active === false
                    ? <Text style={SS.expiredBadge}>{"NONAKTIF"}</Text>
                    : <Text style={SS.activeBadge}>{"AKTIF"}</Text>
                  }
                  <TouchableOpacity style={SS.iconBtn} onPress={() => openEditKasir(k)}>
                    <Text style={SS.iconBtnTxt}>{"✏️"}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={SS.iconBtn} onPress={() => confirmToggleKasirActive(k)}>
                    <Text style={SS.iconBtnTxt}>{k.active === false ? "▶️" : "⏸️"}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={SS.iconBtn} onPress={() => confirmResetPin("kasir", k)}>
                    <Text style={SS.iconBtnTxt}>{"🔑"}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={SS.iconBtn} onPress={() => confirmDeleteKasir(k)}>
                    <Text style={SS.iconBtnTxt}>{"🗑️"}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </ScrollView>
      </View>
    );
  }

  function renderMitra() {
    return (
      <View style={SS.flex}>
        <View style={SS.listHeader}>
          <TextInput
            style={SS.searchInputSmall} placeholder={"Cari mitra..."}
            placeholderTextColor={C_SUB} value={searchQuery} onChangeText={setSearchQuery}
          />
          <TouchableOpacity style={SS.addBtn} onPress={openAddMitra}>
            <Text style={SS.addBtnTxt}>{"+ Mitra"}</Text>
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={SS.filterScroll}>
          {[{ value: "semua", label: "Semua" }, ...MITRA_ROLES].map((r) => (
            <TouchableOpacity
              key={r.value}
              style={[SS.filterChip, mitraFilter === r.value && SS.filterChipActive]}
              onPress={() => setMitraFilter(r.value)}
            >
              <Text style={[SS.filterChipTxt, mitraFilter === r.value && SS.filterChipTxtActive]}>
                {r.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={SS.scrollPad}>
          {filteredMitra.length === 0 && <Text style={SS.emptyTxt}>{"Tidak ada mitra ditemukan."}</Text>}
          {filteredMitra.map((m) => (
            <View key={m.id} style={SS.userCard}>
              <View style={SS.userCardLeft}>
                <View style={[SS.userAvatar, SS.userAvatarMitra]}>
                  <Text style={SS.userAvatarTxt}>{(m.name ?? "?")[0].toUpperCase()}</Text>
                </View>
                <View style={SS.userInfo}>
                  <Text style={SS.userName}>{m.name}</Text>
                  <Text style={SS.userSub}>{m.phone || "No HP: -"}</Text>
                  <View style={SS.roleBadgeRow}>
                    <View style={SS.roleBadge}>
                      <Text style={SS.roleBadgeTxt}>{roleLabel(m.role)}</Text>
                    </View>
                  </View>
                </View>
              </View>
              <View style={SS.actionCol}>
                <TouchableOpacity style={SS.iconBtn} onPress={() => openEditMitra(m)}>
                  <Text style={SS.iconBtnTxt}>{"✏️"}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={SS.iconBtn} onPress={() => confirmResetPin("mitra", m)}>
                  <Text style={SS.iconBtnTxt}>{"🔑"}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={SS.iconBtn} onPress={() => confirmDeleteMitra(m)}>
                  <Text style={SS.iconBtnTxt}>{"🗑️"}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
    );
  }

  function renderModalForm() {
    const title =
      modalType === "owner" ? (editTarget ? "Edit Owner" : "Tambah Owner") :
      modalType === "kasir" ? (editTarget ? "Edit Kasir" : "Tambah Kasir") :
                               (editTarget ? "Edit Mitra" : "Tambah Mitra");
    return (
      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={closeModal}>
        <View style={SS.modalOverlay}>
          <View style={SS.modalBox}>
            <View style={SS.modalHead}>
              <Text style={SS.modalTitle}>{title}</Text>
              <TouchableOpacity onPress={closeModal}>
                <Text style={SS.modalCloseTxt}>{"✕"}</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={SS.modalBody} showsVerticalScrollIndicator={false}>
              <Text style={SS.fieldLabel}>{"Nama Lengkap *"}</Text>
              <TextInput style={SS.fieldInput} value={fName} onChangeText={setFName} placeholder={"Masukkan nama..."} placeholderTextColor={C_SUB} />
              <Text style={SS.fieldLabel}>{"No. HP"}</Text>
              <TextInput style={SS.fieldInput} value={fPhone} onChangeText={setFPhone} placeholder={"08xx..."} placeholderTextColor={C_SUB} keyboardType="phone-pad" />
              <Text style={SS.fieldLabel}>{"PIN *"}</Text>
              <TextInput style={SS.fieldInput} value={fPin} onChangeText={setFPin} placeholder={"Min 4 digit..."} placeholderTextColor={C_SUB} keyboardType="number-pad" secureTextEntry />

              {modalType === "owner" && (
                <>
                  <Text style={SS.fieldLabel}>{"Nama Toko *"}</Text>
                  <TextInput style={SS.fieldInput} value={fToko} onChangeText={setFToko} placeholder={"Nama toko..."} placeholderTextColor={C_SUB} />
                  <Text style={SS.fieldLabel}>{"Paket"}</Text>
                  <View style={SS.paketRow}>
                    {PAKET_OPTIONS.map((p) => (
                      <TouchableOpacity
                        key={p}
                        style={[SS.paketOpt, fPaket === p && { borderColor: paketColor(p), backgroundColor: paketColor(p) + "22" }]}
                        onPress={() => setFPaket(p)}
                      >
                        <Text style={[SS.paketOptTxt, fPaket === p && { color: paketColor(p), fontWeight: "700" }]}>
                          {p.charAt(0).toUpperCase() + p.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={SS.fieldLabel}>{"Tanggal Expiry (YYYY-MM-DD)"}</Text>
                  <TextInput style={SS.fieldInput} value={fExpiry} onChangeText={setFExpiry} placeholder={"2025-12-31"} placeholderTextColor={C_SUB} />
                </>
              )}

              {modalType === "kasir" && (
                <>
                  <Text style={SS.fieldLabel}>{"Owner ID"}</Text>
                  <TextInput style={SS.fieldInput} value={fOwnerId} onChangeText={setFOwnerId} placeholder={"ID owner..."} placeholderTextColor={C_SUB} />
                  <Text style={SS.fieldHint}>{"Pilih dari daftar Owner:"}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={SS.ownerPickerScroll}>
                    {owners.map((o) => (
                      <TouchableOpacity
                        key={o.id}
                        style={[SS.ownerPickerChip, fOwnerId === o.id && SS.ownerPickerChipActive]}
                        onPress={() => setFOwnerId(o.id)}
                      >
                        <Text style={[SS.ownerPickerTxt, fOwnerId === o.id && SS.ownerPickerTxtActive]}>
                          {o.tokoName}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </>
              )}

              {modalType === "mitra" && (
                <>
                  <Text style={SS.fieldLabel}>{"Role"}</Text>
                  <View style={SS.roleRow}>
                    {MITRA_ROLES.map((r) => (
                      <TouchableOpacity
                        key={r.value}
                        style={[SS.roleOpt, fRole === r.value && SS.roleOptActive]}
                        onPress={() => setFRole(r.value)}
                      >
                        <Text style={[SS.roleOptTxt, fRole === r.value && SS.roleOptTxtActive]}>{r.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}
            </ScrollView>
            <View style={SS.modalFooter}>
              <TouchableOpacity style={SS.cancelBtn} onPress={closeModal}>
                <Text style={SS.cancelBtnTxt}>{"Batal"}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={SS.saveBtn} onPress={handleSave}>
                <Text style={SS.saveBtnTxt}>{"Simpan"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  function renderOwnerDetail() {
    if (!detailOwner) return null;
    const ownerKasir = kasirList.filter((k) => k.ownerId === detailOwner.id);
    const expired    = isExpired(detailOwner.expiryDate);
    return (
      <Modal visible={detailVisible} animationType="slide" onRequestClose={() => setDetailVisible(false)}>
        <View style={[SS.detailContainer, { paddingTop: insets.top }]}>
          <View style={SS.detailHeader}>
            <TouchableOpacity onPress={() => setDetailVisible(false)}>
              <Text style={SS.detailBackTxt}>{"← Kembali"}</Text>
            </TouchableOpacity>
            <Text style={SS.detailHeaderTitle}>{"Detail Owner"}</Text>
            <TouchableOpacity onPress={() => openEditOwner(detailOwner)}>
              <Text style={SS.detailEditTxt}>{"✏️ Edit"}</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={SS.scrollPad} showsVerticalScrollIndicator={false}>
            <View style={SS.detailCard}>
              <View style={SS.detailAvatarRow}>
                <View style={SS.detailAvatar}>
                  <Text style={SS.detailAvatarTxt}>{(detailOwner.tokoName ?? "?")[0].toUpperCase()}</Text>
                </View>
                <View style={SS.detailAvatarInfo}>
                  <Text style={SS.detailTokoName}>{detailOwner.tokoName}</Text>
                  <Text style={SS.detailOwnerName}>{detailOwner.name}</Text>
                  <View style={SS.detailBadgeRow}>
                    <View style={[SS.paketBadge, { borderColor: paketColor(detailOwner.paket) }]}>
                      <Text style={[SS.paketBadgeTxt, { color: paketColor(detailOwner.paket) }]}>{detailOwner.paket.toUpperCase()}</Text>
                    </View>
                    {detailOwner.suspended
                      ? <Text style={SS.suspendBadge}>{"SUSPEND"}</Text>
                      : expired
                        ? <Text style={SS.expiredBadge}>{"EXPIRED"}</Text>
                        : <Text style={SS.activeBadge}>{"AKTIF"}</Text>
                    }
                  </View>
                </View>
              </View>
              <View style={SS.detailInfoGrid}>
                <View style={SS.detailInfoItem}>
                  <Text style={SS.detailInfoLbl}>{"Kode Toko"}</Text>
                  <Text style={SS.detailInfoVal}>{detailOwner.kode}</Text>
                </View>
                <View style={SS.detailInfoItem}>
                  <Text style={SS.detailInfoLbl}>{"No. HP"}</Text>
                  <Text style={SS.detailInfoVal}>{detailOwner.phone || "-"}</Text>
                </View>
                <View style={SS.detailInfoItem}>
                  <Text style={SS.detailInfoLbl}>{"PIN"}</Text>
                  <Text style={SS.detailInfoVal}>{maskPin(detailOwner.pin)}</Text>
                </View>
                <View style={SS.detailInfoItem}>
                  <Text style={SS.detailInfoLbl}>{"Daftar"}</Text>
                  <Text style={SS.detailInfoVal}>{formatDate(detailOwner.createdAt ?? "")}</Text>
                </View>
                <View style={SS.detailInfoItem}>
                  <Text style={SS.detailInfoLbl}>{"Expiry"}</Text>
                  <Text style={[SS.detailInfoVal, expired && { color: C_RED }]}>{formatDate(detailOwner.expiryDate)}</Text>
                </View>
                <View style={SS.detailInfoItem}>
                  <Text style={SS.detailInfoLbl}>{"Kasir"}</Text>
                  <Text style={SS.detailInfoVal}>{String(ownerKasir.length) + " akun"}</Text>
                </View>
              </View>
            </View>

            <Text style={SS.sectionTitle}>{"⚡ Aksi"}</Text>
            <View style={SS.actionGrid}>
              <TouchableOpacity style={SS.actionItem} onPress={() => extendLangganan(detailOwner)}>
                <Text style={SS.actionItemIcon}>{"📅"}</Text>
                <Text style={SS.actionItemTxt}>{"Perpanjang\nLangganan"}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={SS.actionItem} onPress={() => confirmResetPin("owner", detailOwner)}>
                <Text style={SS.actionItemIcon}>{"🔑"}</Text>
                <Text style={SS.actionItemTxt}>{"Reset\nPIN"}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={SS.actionItem} onPress={() => confirmSuspendOwner(detailOwner)}>
                <Text style={SS.actionItemIcon}>{detailOwner.suspended ? "▶️" : "⏸️"}</Text>
                <Text style={SS.actionItemTxt}>{detailOwner.suspended ? "Aktifkan\nAkun" : "Suspend\nAkun"}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[SS.actionItem, SS.actionItemDanger]} onPress={() => confirmDeleteOwner(detailOwner)}>
                <Text style={SS.actionItemIcon}>{"🗑️"}</Text>
                <Text style={[SS.actionItemTxt, { color: C_RED }]}>{"Hapus\nOwner"}</Text>
              </TouchableOpacity>
            </View>

            {ownerKasir.length > 0 && (
              <>
                <Text style={SS.sectionTitle}>{"💼 Kasir Terdaftar (" + ownerKasir.length + ")"}</Text>
                {ownerKasir.map((k) => (
                  <View key={k.id} style={SS.miniCard}>
                    <View style={SS.miniCardLeft}>
                      <Text style={SS.miniCardName}>{k.name}</Text>
                      <Text style={SS.miniCardSub}>{k.phone || "-"}</Text>
                    </View>
                    <View style={SS.miniCardRight}>
                      {k.active === false
                        ? <Text style={SS.expiredBadge}>{"NONAKTIF"}</Text>
                        : <Text style={SS.activeBadge}>{"AKTIF"}</Text>
                      }
                      <TouchableOpacity onPress={() => confirmResetPin("kasir", k)}>
                        <Text style={SS.miniAction}>{"🔑"}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </>
            )}
          </ScrollView>
        </View>
      </Modal>
    );
  }

  return (
    <View style={[SS.container, { paddingTop: insets.top }]}>
      <View style={SS.header}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={SS.backBtn}>
            <Text style={SS.backTxt}>{"← Keluar"}</Text>
          </TouchableOpacity>
        )}
        <Text style={SS.headerTitle}>{"⚙️ Super Admin"}</Text>
        <TouchableOpacity onPress={loadAll} style={SS.refreshBtn} disabled={loading}>
          {loading
            ? <ActivityIndicator color={C_ACCENT} size="small" />
            : <Text style={SS.refreshTxt}>{"🔄"}</Text>
          }
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={SS.tabBar}>
        {TABS.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[SS.tab, activeTab === t.key && SS.tabActive]}
            onPress={() => { setActiveTab(t.key); setSearchQuery(""); }}
          >
            <Text style={[SS.tabTxt, activeTab === t.key && SS.tabTxtActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={SS.content}>
        {loading
          ? <View style={SS.center}><ActivityIndicator color={C_ACCENT} size="large" /></View>
          : activeTab === "dashboard" ? renderDashboard()
          : activeTab === "owner"     ? renderOwners()
          : activeTab === "kasir"     ? renderKasir()
          :                             renderMitra()
        }
      </View>

      {renderModalForm()}
      {renderOwnerDetail()}
    </View>
  );
}

const SS = StyleSheet.create({
  container: { flex: 1, backgroundColor: C_BG },
  flex:      { flex: 1 },
  center:    { flex: 1, justifyContent: "center", alignItems: "center" },
  header:      { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C_BORDER },
  backBtn:     { paddingRight: 12 },
  backTxt:     { color: C_ACCENT, fontSize: 14, fontWeight: "700" },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: "900", color: C_TEXT },
  refreshBtn:  { padding: 4 },
  refreshTxt:  { fontSize: 18 },
  tabBar:       { flexGrow: 0, borderBottomWidth: 1, borderBottomColor: C_BORDER },
  tab:          { paddingHorizontal: 18, paddingVertical: 12 },
  tabActive:    { borderBottomWidth: 2, borderBottomColor: C_ACCENT },
  tabTxt:       { fontSize: 12, color: C_SUB, fontWeight: "600" },
  tabTxtActive: { color: C_ACCENT, fontWeight: "800" },
  content:   { flex: 1 },
  scrollPad: { padding: 16, paddingBottom: 40 },
  sectionTitle: { fontSize: 13, fontWeight: "800", color: C_TEXT, marginBottom: 12, marginTop: 4 },
  statsGrid:    { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 },
  statCard:     { width: "22%", flexGrow: 1, backgroundColor: C_CARD, borderRadius: 12, padding: 12, alignItems: "center", borderWidth: 1, borderColor: C_BORDER },
  statIcon:     { fontSize: 20, marginBottom: 4 },
  statVal:      { fontSize: 20, fontWeight: "900" },
  statLbl:      { fontSize: 10, color: C_SUB, marginTop: 2, textAlign: "center" },
  recentCard:  { backgroundColor: C_CARD, borderRadius: 12, padding: 14, marginBottom: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderColor: C_BORDER },
  recentLeft:  { flex: 1 },
  recentName:  { fontSize: 14, fontWeight: "700", color: C_TEXT },
  recentSub:   { fontSize: 11, color: C_SUB, marginTop: 2 },
  recentRight: { alignItems: "flex-end", gap: 4 },
  listHeader:       { flexDirection: "row", padding: 12, gap: 10, borderBottomWidth: 1, borderBottomColor: C_BORDER, alignItems: "center" },
  searchInput:      { flex: 1, backgroundColor: C_CARD, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, color: C_TEXT, fontSize: 13, borderWidth: 1, borderColor: C_BORDER },
  searchInputSmall: { flex: 1, backgroundColor: C_CARD, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, color: C_TEXT, fontSize: 13, borderWidth: 1, borderColor: C_BORDER },
  addBtn:    { backgroundColor: C_ACCENT, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  addBtnTxt: { color: "#0F172A", fontWeight: "800", fontSize: 13 },
  emptyTxt:  { textAlign: "center", color: C_SUB, marginTop: 40, fontSize: 14 },
  userCard:      { backgroundColor: C_CARD, borderRadius: 14, padding: 14, marginBottom: 10, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: C_BORDER },
  userCardLeft:  { flex: 1, flexDirection: "row", gap: 12, alignItems: "center" },
  userCardRight: { alignItems: "flex-end", gap: 6 },
  userAvatar:      { width: 44, height: 44, borderRadius: 22, backgroundColor: ACCENT_BG(), justifyContent: "center", alignItems: "center" },
  userAvatarKasir: { backgroundColor: "#F59E0B33" },
  userAvatarMitra: { backgroundColor: "#A78BFA33" },
  userAvatarTxt:   { fontSize: 18, fontWeight: "800", color: C_TEXT },
  userInfo:  { flex: 1 },
  userName:  { fontSize: 14, fontWeight: "700", color: C_TEXT },
  userSub:   { fontSize: 11, color: C_SUB, marginTop: 1 },
  userPin:   { fontSize: 10, color: C_SUB, marginTop: 2 },
  actionCol: { alignItems: "center", gap: 6 },
  iconBtn:   { padding: 4 },
  iconBtnTxt:{ fontSize: 16 },
  paketBadge:    { borderWidth: 1.5, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  paketBadgeTxt: { fontSize: 10, fontWeight: "800" },
  activeBadge:   { fontSize: 10, fontWeight: "700", color: C_GREEN },
  suspendBadge:  { fontSize: 10, fontWeight: "700", color: C_RED },
  expiredBadge:  { fontSize: 10, fontWeight: "700", color: C_ORANGE },
  filterScroll:        { flexGrow: 0, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C_BORDER },
  filterChip:          { backgroundColor: C_CARD, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, marginRight: 8, borderWidth: 1, borderColor: C_BORDER },
  filterChipActive:    { backgroundColor: C_ACCENT, borderColor: C_ACCENT },
  filterChipTxt:       { fontSize: 12, color: C_SUB, fontWeight: "600" },
  filterChipTxtActive: { color: "#0F172A", fontWeight: "800" },
  roleBadgeRow: { flexDirection: "row", marginTop: 4 },
  roleBadge:    { backgroundColor: "#A78BFA22", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: C_PURPLE },
  roleBadgeTxt: { fontSize: 10, color: C_PURPLE, fontWeight: "700" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  modalBox:     { backgroundColor: C_CARD, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "90%", paddingBottom: 34 },
  modalHead:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: C_BORDER },
  modalTitle:   { fontSize: 17, fontWeight: "800", color: C_TEXT },
  modalCloseTxt:{ fontSize: 20, color: C_SUB, fontWeight: "700" },
  modalBody:    { padding: 20 },
  modalFooter:  { flexDirection: "row", gap: 12, paddingHorizontal: 20, paddingTop: 12 },
  cancelBtn:    { flex: 1, backgroundColor: C_BORDER, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  cancelBtnTxt: { color: C_TEXT, fontWeight: "700" },
  saveBtn:      { flex: 2, backgroundColor: C_ACCENT, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  saveBtnTxt:   { color: "#0F172A", fontWeight: "900", fontSize: 15 },
  fieldLabel:   { fontSize: 12, color: C_SUB, fontWeight: "700", marginBottom: 6, marginTop: 14 },
  fieldInput:   { backgroundColor: "#0F172A", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: C_TEXT, fontSize: 14, borderWidth: 1, borderColor: C_BORDER },
  fieldHint:    { fontSize: 11, color: C_SUB, marginTop: 8, marginBottom: 4 },
  paketRow:    { flexDirection: "row", gap: 8 },
  paketOpt:    { flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: "center", borderWidth: 1.5, borderColor: C_BORDER },
  paketOptTxt: { fontSize: 12, color: C_SUB },
  roleRow:          { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  roleOpt:          { borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1.5, borderColor: C_BORDER },
  roleOptActive:    { borderColor: C_PURPLE, backgroundColor: "#A78BFA22" },
  roleOptTxt:       { fontSize: 13, color: C_SUB },
  roleOptTxtActive: { color: C_PURPLE, fontWeight: "700" },
  ownerPickerScroll:     { flexGrow: 0, marginBottom: 4 },
  ownerPickerChip:       { backgroundColor: C_BORDER, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginRight: 8 },
  ownerPickerChipActive: { backgroundColor: C_ACCENT },
  ownerPickerTxt:        { fontSize: 12, color: C_SUB },
  ownerPickerTxtActive:  { color: "#0F172A", fontWeight: "700" },
  detailContainer:   { flex: 1, backgroundColor: C_BG },
  detailHeader:      { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C_BORDER },
  detailBackTxt:     { color: C_ACCENT, fontSize: 14, fontWeight: "700", flex: 1 },
  detailHeaderTitle: { fontSize: 16, fontWeight: "800", color: C_TEXT, flex: 2, textAlign: "center" },
  detailEditTxt:     { color: C_ORANGE, fontSize: 13, fontWeight: "700", flex: 1, textAlign: "right" },
  detailCard:       { backgroundColor: C_CARD, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: C_BORDER },
  detailAvatarRow:  { flexDirection: "row", gap: 14, marginBottom: 16 },
  detailAvatar:     { width: 60, height: 60, borderRadius: 30, backgroundColor: "#38BDF822", justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: C_ACCENT },
  detailAvatarTxt:  { fontSize: 24, fontWeight: "900", color: C_ACCENT },
  detailAvatarInfo: { flex: 1 },
  detailTokoName:   { fontSize: 18, fontWeight: "900", color: C_TEXT },
  detailOwnerName:  { fontSize: 13, color: C_SUB, marginTop: 2 },
  detailBadgeRow:   { flexDirection: "row", gap: 8, marginTop: 8 },
  detailInfoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  detailInfoItem: { width: "30%", flexGrow: 1, backgroundColor: "#0F172A", borderRadius: 10, padding: 10, borderWidth: 1, borderColor: C_BORDER },
  detailInfoLbl:  { fontSize: 10, color: C_SUB, marginBottom: 3 },
  detailInfoVal:  { fontSize: 13, fontWeight: "700", color: C_TEXT },
  actionGrid:       { flexDirection: "row", gap: 10, marginBottom: 20 },
  actionItem:       { flex: 1, backgroundColor: C_CARD, borderRadius: 12, padding: 14, alignItems: "center", borderWidth: 1, borderColor: C_BORDER },
  actionItemDanger: { borderColor: C_RED + "55" },
  actionItemIcon:   { fontSize: 22, marginBottom: 6 },
  actionItemTxt:    { fontSize: 10, color: C_SUB, textAlign: "center", lineHeight: 14 },
  miniCard:      { backgroundColor: "#0F172A", borderRadius: 10, padding: 12, marginBottom: 8, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: C_BORDER },
  miniCardLeft:  { flex: 1 },
  miniCardName:  { fontSize: 13, fontWeight: "700", color: C_TEXT },
  miniCardSub:   { fontSize: 11, color: C_SUB, marginTop: 2 },
  miniCardRight: { flexDirection: "row", gap: 10, alignItems: "center" },
  miniAction:    { fontSize: 18 },
  shadowDown:    { ...SHADOW_DOWN },
});