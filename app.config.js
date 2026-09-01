export default ({ config }) => {
  // PERBAIKAN: Gunakan EXPO_PUBLIC_APP_TARGET sesuai aturan Expo
  const appTarget = process.env.EXPO_PUBLIC_APP_TARGET || "super";

  const appNames = {
    owner: "TWD Owner & Kasir",
    marketing: "TWD Marketing",
    submarketing: "TWD Sub-Marketing",
    kurir: "TWD Kurir",
    customer: "TWD Customer",
    super: "TWD Super Admin"
  };

  return {
    ...config,
    name: appNames[appTarget] || "TWD Mobile",
    slug: "twd-mobile",
    version: "1.0.0",
    scheme: "twd-mobile", // <-- TAMBAHKAN INI
    extra: {
      ...config.extra,
      appTarget: appTarget,
      eas: {
        projectId: "9898d0fb-c5e9-47d5-919c-fd633774fea0"
      }
    },
    android: {
      ...config.android,
      // Package name harus huruf kecil semua, tidak boleh ada underscore/kapital
      package: `com.twdmobile.${appTarget}`,
      usesCleartextTraffic: true // <-- INI DIA KUNCINYA
    }
  };
};