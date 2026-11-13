import React from 'react';
import { Text, TextInput, TouchableOpacity, View, StyleSheet } from 'react-native';

export const colors = { brand: '#0e7c86', dark: '#0b2e33', bg: '#f3f6f8', card: '#ffffff', text: '#1c2b33', muted: '#6b7c85', line: '#e1e8ec', danger: '#c0392b' };

export const Btn = ({ title, onPress, ghost, danger, disabled, style }) => (
  <TouchableOpacity onPress={onPress} disabled={disabled}
    style={[s.btn, ghost && s.btnGhost, danger && { backgroundColor: colors.danger }, disabled && { opacity: 0.5 }, style]}>
    <Text style={[s.btnText, ghost && { color: colors.brand }]}>{title}</Text>
  </TouchableOpacity>
);

export const Input = ({ label, required, ...p }) => (
  <View style={{ marginBottom: 12 }}>
    {!!label && <Text style={s.label}>{label}{required ? ' *' : ''}</Text>}
    <TextInput style={[s.input, p.multiline && { height: 80, textAlignVertical: 'top' }]} placeholderTextColor="#9aa8af" {...p} />
  </View>
);

export const Chip = ({ label, active, onPress }) => (
  <TouchableOpacity onPress={onPress} style={[s.chip, active && s.chipActive]}>
    <Text style={{ color: active ? '#fff' : colors.text }}>{label}</Text>
  </TouchableOpacity>
);

export const s = StyleSheet.create({
  btn: { backgroundColor: colors.brand, borderRadius: 8, paddingVertical: 12, paddingHorizontal: 18, alignItems: 'center' },
  btnGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.brand },
  btnText: { color: '#fff', fontWeight: '600' },
  label: { fontSize: 12, color: colors.muted, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#cdd8dd', borderRadius: 8, padding: 10, backgroundColor: '#fff', color: colors.text },
  chip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1, borderColor: '#cdd8dd', marginRight: 8, marginBottom: 8, backgroundColor: '#fff' },
  chipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  card: { backgroundColor: colors.card, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.line, marginBottom: 10 },
  h1: { fontSize: 22, fontWeight: '700', color: colors.text },
  h2: { fontSize: 13, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', marginTop: 18, marginBottom: 8 },
});

const TONES = { ok: ['#d8f3e3', '#14633a'], warn: ['#fdf0cf', '#8a5a00'], bad: ['#fbdcd8', '#9b2c20'], info: ['#dbe8fb', '#1d4f9a'], muted: ['#e8eef1', '#33454d'] };
export const Pill = ({ label, tone = 'muted' }) => (
  <View style={{ alignSelf: 'flex-start', backgroundColor: TONES[tone][0], borderRadius: 10, paddingHorizontal: 9, paddingVertical: 2 }}>
    <Text style={{ color: TONES[tone][1], fontSize: 11, fontWeight: '600' }}>{label}</Text>
  </View>
);
