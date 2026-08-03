import React, { useState } from "react";
import { Modal, StyleSheet, View } from "react-native";
import { Button, Divider, RadioButton, Text } from "react-native-paper";
import { MetodeValuasi } from "../src/context/ProductsContext";

const GREEN = "#2E7D32";

type Props = {
  visible: boolean;
  onPilih: (metode: MetodeValuasi) => void;
};

const PILIHAN: { value: MetodeValuasi; label: string; desc: string }[] = [
  {
    value: "average",
    label: "Average (Rata-rata Tertimbang)",
    desc:  "Harga pokok dihitung dari rata-rata semua harga beli. Paling simpel & umum untuk warung.",
  },
  {
    value: "fifo",
    label: "FIFO (First In, First Out)",
    desc:  "Stok yang pertama masuk, pertama keluar. Cocok untuk produk dengan tanggal kedaluwarsa.",
  },
  {
    value: "lifo",
    label: "LIFO (Last In, First Out)",
    desc:  "Stok yang terakhir masuk, pertama keluar. Cocok jika harga beli sering naik.",
  },
];

export default function MetodeValuasiModal({ visible, onPilih }: Props) {
  const [selected, setSelected] = useState<MetodeValuasi>("average");

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>📦 Metode Pencatatan Stok</Text>
          <Text style={styles.subtitle}>
            Pilihan ini hanya muncul sekali. Bisa diubah nanti di menu Pengaturan.
          </Text>
          <Divider style={styles.divider} />
          <RadioButton.Group
            value={selected}
            onValueChange={(v) => setSelected(v as MetodeValuasi)}
          >
            {PILIHAN.map((p) => (
              <View key={p.value} style={styles.pilihanRow}>
                <RadioButton.Item
                  label={p.label}
                  value={p.value}
                  color={GREEN}
                  labelStyle={styles.pilihanLabel}
                />
                <Text style={styles.pilihanDesc}>{p.desc}</Text>
              </View>
            ))}
          </RadioButton.Group>
          <Divider style={styles.divider} />
          <Button
            mode="contained"
            buttonColor={GREEN}
            style={styles.btn}
            onPress={() => onPilih(selected)}
          >
            Simpan & Lanjutkan
          </Button>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay:      { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  card:         { backgroundColor: "#FFF", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 44 },
  title:        { fontSize: 17, fontWeight: "700", color: "#1B5E20", marginBottom: 6 },
  subtitle:     { fontSize: 13, color: "#5E6E5E" },
  divider:      { marginVertical: 14 },
  pilihanRow:   { marginBottom: 2 },
  pilihanLabel: { fontSize: 14, fontWeight: "600", color: "#1F2D1F" },
  pilihanDesc:  { fontSize: 12, color: "#5E6E5E", marginLeft: 52, marginTop: -6, marginBottom: 10, lineHeight: 18 },
  btn:          { borderRadius: 10, marginTop: 4 },
});