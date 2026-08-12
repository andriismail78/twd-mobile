// app.config.js
// Dynamic Expo Configuration untuk Multi-APK Ecosystem TWD-Mobile
// Memungkinkan build APK khusus untuk peran: Marketing, Kurir, WarungPOS, Customer, atau Super App

module.exports = ({ config }) => {
  const target = (process.env.APP_TARGET || "super").toLowerCase();

  let name           = "TWD Mobile";
  let slug           = "twd-mobile";
  let scheme         = "twdmobile";
  let androidPackage = "com.twdmobile.app";
  let bgColor        = "#E6F4FE"; // Biru Default (Super App)

  if (target === "marketing") {
    name           = "TWD Marketing";
    scheme         = "twdmarketing";
    androidPackage = "com.twdmobile.marketing";
    bgColor        = "#FEF3C7"; // Kuning Emas
  } else if (target === "kurir") {
    name           = "TWD Kurir";
    scheme         = "twdkurir";
    androidPackage = "com.twdmobile.kurir";
    bgColor        = "#FFEDD5"; // Oranye Logistik
  } else if (target === "warung") {
    name           = "TWD Warung POS";
    scheme         = "twdwarung";
    androidPackage = "com.twdmobile.warung";
    bgColor        = "#DCFCE7"; // Hijau Toko
  } else if (target === "customer") {
    name           = "TWD Customer";
    scheme         = "twdcustomer";
    androidPackage = "com.twdmobile.customer";
    bgColor        = "#E0E7FF"; // Indigo Belanja
  }

  return {
    ...config,
    name,
    slug,
    scheme,
    android: {
      ...config.android,
      package: androidPackage,
      adaptiveIcon: {
        ...config.android?.adaptiveIcon,
        backgroundColor: bgColor,
      },
    },
    extra: {
      ...config.extra,
      appTarget: target,
      eas: {
        projectId: "40c8abf1-a036-4d67-8ef2-0c665c364e62",
      },
    },
  };
};
