// src/components/TwdLogoBadge.tsx
// Komponen Lencana & Logo Resmi TWD-MOBILE (Toko Warung Digital) — v5.0 ULTRA-LUXURY BLINK-BLINK
// Desain mewah berkilau emas siber bertabur bintang, 100% stabil & anti-crash di semua layar HP Android / iOS!

import React from "react";
import { StyleSheet, Text, View } from "react-native";

type Props = {
  size?: "small" | "medium" | "large";
  showSubtitle?: boolean;
};

export default function TwdLogoBadge({ size = "medium", showSubtitle = true }: Props) {
  const isLarge = size === "large";
  const isSmall = size === "small";

  const circleSize = isLarge ? 84 : isSmall ? 40 : 60;
  const textSize   = isLarge ? 28 : isSmall ? 14 : 20;
  const subSize    = isLarge ? 13 : isSmall ? 9  : 11;

  return (
    <View style={styles.container}>
      <View style={styles.badgeWrapper}>
        {/* Lingkaran Halo Emas Blink-Blink di Belakang */}
        <View
          style={[
            styles.glowHalo,
            {
              width:  circleSize + 24,
              height: circleSize + 24,
              borderRadius: (circleSize + 24) / 2,
            },
          ]}
        />

        {/* Bintang-Bintang Emas Blink-Blink di Sekeliling Logo */}
        <Text style={[styles.starTopLeft,     { top: -4, left: 6 }]}>✨</Text>
        <Text style={[styles.starTopRight,    { top: 2,  right: 2 }]}>⭐</Text>
        <Text style={[styles.starBottomLeft,  { bottom: 4, left: 2 }]}>✨</Text>
        <Text style={[styles.starBottomRight, { bottom: -2, right: 8 }]}>⭐</Text>

        {/* Lencana Utama 3-Lapis Emas Mewah */}
        <View
          style={[
            styles.outerRing,
            {
              width:  circleSize + 8,
              height: circleSize + 8,
              borderRadius: (circleSize + 8) / 2,
            },
          ]}
        >
          <View
            style={[
              styles.goldBorder,
              {
                width:  circleSize + 4,
                height: circleSize + 4,
                borderRadius: (circleSize + 4) / 2,
              },
            ]}
          >
            <View
              style={[
                styles.innerCircle,
                {
                  width:  circleSize - 4,
                  height: circleSize - 4,
                  borderRadius: (circleSize - 4) / 2,
                },
              ]}
            >
              <Text style={[styles.twdText, { fontSize: textSize }]}>TWD</Text>
              {!isSmall && (
                <Text style={styles.miniTag}>WARUNG</Text>
              )}
            </View>
          </View>
        </View>
      </View>

      {showSubtitle && (
        <View style={styles.textWrap}>
          <View style={styles.titleRow}>
            <Text style={styles.titleStar}>✨ </Text>
            <Text style={[styles.title, { fontSize: isSmall ? 13 : 16 }]}>TWD-MOBILE</Text>
            <Text style={styles.titleStar}> ✨</Text>
          </View>
          <Text style={[styles.subtitle, { fontSize: subSize }]}>TOKO WARUNG DIGITAL</Text>
          <View style={styles.underlineBadge}>
            <Text style={styles.underlineText}>RESMI INDONESIA 🇮🇩</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems:     "center",
    justifyContent: "center",
    marginVertical: 6,
  },
  badgeWrapper: {
    alignItems:     "center",
    justifyContent: "center",
    position:       "relative",
  },
  glowHalo: {
    position:        "absolute",
    backgroundColor: "rgba(254, 243, 199, 0.5)", // Halo Kuning Emas Lembut
    borderWidth:     1.5,
    borderColor:     "#FDE047",
  },
  starTopLeft: {
    position: "absolute",
    fontSize: 14,
    zIndex:   2,
  },
  starTopRight: {
    position: "absolute",
    fontSize: 13,
    zIndex:   2,
  },
  starBottomLeft: {
    position: "absolute",
    fontSize: 13,
    zIndex:   2,
  },
  starBottomRight: {
    position: "absolute",
    fontSize: 14,
    zIndex:   2,
  },
  outerRing: {
    backgroundColor: "#0F172A", // Biru Siber Pekat
    borderWidth:     3,
    borderColor:     "#F59E0B", // Emas Mewah
    alignItems:      "center",
    justifyContent:  "center",
    shadowColor:     "#F59E0B",
    shadowOffset:    { width: 0, height: 3 },
    shadowOpacity:   0.45,
    shadowRadius:    5,
    elevation:       5,
  },
  goldBorder: {
    backgroundColor: "#1E293B",
    borderWidth:     1.5,
    borderColor:     "#FEF08A", // Kilau Kuning Emas
    alignItems:      "center",
    justifyContent:  "center",
  },
  innerCircle: {
    backgroundColor: "#0F172A",
    borderWidth:     1.5,
    borderColor:     "#38BDF8", // Aksen Siber Biru
    alignItems:      "center",
    justifyContent:  "center",
  },
  twdText: {
    fontWeight:    "900",
    color:         "#FDE047", // Emas Kuning Terang
    letterSpacing: 2,
    textShadowColor: "rgba(245, 158, 11, 0.7)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  miniTag: {
    fontSize:      7,
    fontWeight:    "900",
    color:         "#38BDF8",
    letterSpacing: 1.5,
    marginTop:     -2,
  },
  textWrap: {
    alignItems: "center",
    marginTop:  8,
  },
  titleRow: {
    flexDirection: "row",
    alignItems:    "center",
  },
  titleStar: {
    fontSize: 12,
  },
  title: {
    fontWeight:    "900",
    color:         "#0F172A",
    letterSpacing: 1.5,
  },
  subtitle: {
    fontWeight:    "800",
    color:         "#0284C7",
    letterSpacing: 1,
    marginTop:     2,
  },
  underlineBadge: {
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 8,
    paddingVertical:   2,
    borderRadius:      10,
    marginTop:         4,
    borderWidth:       1,
    borderColor:       "#FDE047",
  },
  underlineText: {
    fontSize:   9,
    fontWeight: "900",
    color:      "#B45309",
  },
});
