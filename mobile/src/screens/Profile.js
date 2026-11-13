import React, { useState } from 'react';
import { Alert, ScrollView, Text } from 'react-native';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';
import { isProviderRole, PROFILE_FIELDS } from '../config/modules';
import FormFields from '../FormFields';
import { Btn, colors } from '../ui';

export default function Profile() {
  const { profile, role, user, logout } = useAuth();
  const fields = [...PROFILE_FIELDS.common, ...(PROFILE_FIELDS[role] || (isProviderRole(role) ? PROFILE_FIELDS.doctor : []))];
  const [values, setValues] = useState({ ...profile });

  const save = async () => {
    const payload = {};
    fields.forEach((f) => { let v = values[f.name]; if (f.type === 'number' && v !== '' && v != null) v = Number(v); payload[f.name] = v ?? ''; });
    try { await updateDoc(doc(db, 'users', user.uid), { ...payload, updatedAt: serverTimestamp() }); Alert.alert('Saved', 'Profile updated.'); }
    catch (e) { Alert.alert('Error', e.message); }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
      <Text style={{ color: colors.muted, marginBottom: 12 }}>{profile.email} · {role}</Text>
      <FormFields fields={fields} role={role} lists={{}} values={values} onChange={(n, v) => setValues((p) => ({ ...p, [n]: v }))} />
      <Btn title="Save profile" onPress={save} />
      <Btn title="Sign out" ghost onPress={logout} style={{ marginTop: 10 }} />
    </ScrollView>
  );
}
