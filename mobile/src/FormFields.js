import React, { useState } from 'react';
import { Alert, Switch, Text, TouchableOpacity, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Chip, Input, s, colors } from './ui';
import { visibleFields } from './lib';
import { optionsFor, todayStr } from './config/modules';

const HINT = { date: 'YYYY-MM-DD', time: 'HH:MM', datetime: 'YYYY-MM-DDTHH:MM' };

export default function FormFields({ fields, values, onChange, role, lists, original }) {
  const [busy, setBusy] = useState('');

  const upload = async (f) => {
    try {
      const r = await DocumentPicker.getDocumentAsync({ type: ['image/*', 'application/pdf'], copyToCacheDirectory: true });
      if (r.canceled) return;
      const a = r.assets[0];
      if (a.size && a.size > 650 * 1024) return Alert.alert('Too large', 'Firestore attachments must be 650 KB or smaller.');
      setBusy(f.name);
      const blob = await (await fetch(a.uri)).blob();
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Could not read this file.'));
        reader.readAsDataURL(blob);
      });
      onChange(f.name, { dataUrl, name: a.name, type: a.mimeType || 'application/octet-stream', size: a.size || 0 });
    } catch (e) { Alert.alert('Upload failed', e.message); }
    setBusy('');
  };

  return visibleFields(fields, role).map((f) => {
    const v = values[f.name];
    if (f.type === 'select' || f.type === 'user') {
      const opts = f.type === 'user'
        ? (lists[f.userRole] || []).map((u) => ({ id: u.id, label: u.name }))
        : optionsFor(f, role, original).map((o) => ({ id: o, label: o }));
      return (
        <View key={f.name} style={{ marginBottom: 8 }}>
          <Text style={s.label}>{f.label}{f.required ? ' *' : ''}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {opts.map((o) => <Chip key={o.id} label={o.label} active={v === o.id} onPress={() => onChange(f.name, o.id)} />)}
            {!opts.length && <Text style={{ color: '#9aa8af' }}>No options available</Text>}
          </View>
        </View>
      );
    }
    if (f.type === 'checkbox') {
      return (
        <View key={f.name} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Text style={s.label}>{f.label}</Text>
          <Switch value={!!v} onValueChange={(x) => onChange(f.name, x)} />
        </View>
      );
    }
    if (f.type === 'file') {
      return (
        <View key={f.name} style={{ marginBottom: 12 }}>
          <Text style={s.label}>{f.label}</Text>
          <TouchableOpacity onPress={() => upload(f)} style={[s.input, { alignItems: 'center' }]}>
            <Text style={{ color: colors.brand }}>{busy === f.name ? 'Saving...' : v ? `Attached: ${v.name || 'file'} · tap to replace` : 'Choose image / PDF'}</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <View key={f.name}>
        <Input label={f.label} required={f.required} value={v === undefined || v === null ? '' : String(v)}
          onChangeText={(t) => onChange(f.name, t)} multiline={f.type === 'textarea'}
          keyboardType={f.type === 'number' ? 'decimal-pad' : 'default'} placeholder={HINT[f.type]} autoCapitalize="none" />
        {f.type === 'date' && !v && <TouchableOpacity onPress={() => onChange(f.name, todayStr())} style={{ marginTop: -8, marginBottom: 10 }}><Text style={{ color: colors.brand }}>Use today</Text></TouchableOpacity>}
      </View>
    );
  });
}
