import React, { useEffect, useLayoutEffect, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { addDoc, collection, deleteDoc, doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';
import { MODULES, PRINTABLE, applyComputed, isProviderRole, printableHtml, validateValues } from '../config/modules';
import { can, colName, fetchClinic, logAudit, useUserLists, visibleFields } from '../lib';
import FormFields from '../FormFields';
import { Btn, colors } from '../ui';

export default function ModuleForm({ route, navigation }) {
  const { key, id } = route.params;
  const m = MODULES.find((x) => x.key === key);
  const { user, profile, role } = useAuth();
  const [values, setValues] = useState(() => {
    const v = {};
    m.fields.forEach((f) => { if (f.default !== undefined) v[f.name] = f.default; });
    return v;
  });
  const [original, setOriginal] = useState(null);
  const [loaded, setLoaded] = useState(!id);
  const [saving, setSaving] = useState(false);
  const lists = useUserLists(m.fields, role, user.uid);

  useLayoutEffect(() => { navigation.setOptions({ title: `${id ? 'Edit' : 'New'} ${m.label}` }); }, []);

  useEffect(() => {
    if (!id) return;
    getDoc(doc(db, colName(m), id)).then((s) => { if (s.exists()) { const d = { id: s.id, ...s.data() }; setValues(d); setOriginal(d); } setLoaded(true); });
  }, [id]);

  const ownRow = !m.fields.some((f) => f.name === 'doctorId') || !isProviderRole(role) || !id || values.doctorId === user.uid;
  const editable = id ? can(m, role, 'u') && ownRow : can(m, role, 'c');
  const deletable = id && can(m, role, 'd') && ownRow;

  const save = async () => {
    const v = applyComputed(m, values);
    const problem = validateValues(m, role, v);
    if (problem) return Alert.alert('Check the form', problem);
    setSaving(true);
    const payload = {};
    for (const f of visibleFields(m.fields, role)) {
      let x = v[f.name];
      if (f.type === 'number' && x !== '' && x != null) x = Number(x);
      if (f.type === 'checkbox') x = !!x;
      payload[f.name] = x ?? '';
      if (f.type === 'user') payload[`${f.name}Name`] = (lists[f.userRole] || []).find((u) => u.id === x)?.name || '';
    }
    m.fields.forEach((f) => {
      if (f.selfFor === role || (f.selfFor === 'doctor' && isProviderRole(role))) { payload[f.name] = user.uid; payload[`${f.name}Name`] = profile.name || ''; }
      else if (f.selfRole) payload[f.name] = role;
      else if (!id && f.roles && !f.roles.includes(role) && f.default !== undefined) payload[f.name] = f.default;
    });
    try {
      if (id) { await updateDoc(doc(db, colName(m), id), { ...payload, updatedAt: serverTimestamp(), updatedBy: user.uid }); logAudit(profile, 'update', colName(m), id); }
      else { const r = await addDoc(collection(db, colName(m)), { ...payload, createdBy: user.uid, createdAt: serverTimestamp() }); logAudit(profile, 'create', colName(m), r.id); }
      navigation.goBack();
    } catch (e) { Alert.alert('Could not save', e.message); }
    setSaving(false);
  };

  const remove = () => Alert.alert('Delete record', 'This cannot be undone and is audit-logged.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => {
      try { await deleteDoc(doc(db, colName(m), id)); logAudit(profile, 'delete', colName(m), id); navigation.goBack(); }
      catch (e) { Alert.alert('Error', e.message); }
    } },
  ]);

  const sharePdf = async () => {
    try {
      const { uri } = await Print.printToFileAsync({ html: printableHtml(m, values, await fetchClinic()) });
      logAudit(profile, 'print', colName(m), id);
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: m.label });
    } catch (e) { Alert.alert('Could not create PDF', e.message); }
  };

  if (!loaded) return <Text style={{ padding: 20 }}>Loading...</Text>;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
      {!editable && <Text style={{ color: colors.muted, marginBottom: 12 }}>Read-only record.</Text>}
      <View pointerEvents={editable ? 'auto' : 'none'} style={{ opacity: editable ? 1 : 0.7 }}>
        <FormFields fields={m.fields} role={role} lists={lists} values={values} original={original}
          onChange={(n, x) => setValues((p) => applyComputed(m, { ...p, [n]: x }))} />
      </View>
      {editable && <Btn title={saving ? 'Saving...' : 'Save'} onPress={save} disabled={saving} />}
      {!!id && PRINTABLE.includes(m.key) && <Btn title="Share as PDF" ghost onPress={sharePdf} style={{ marginTop: 10 }} />}
      {!!id && m.key === 'patients' && ['admin', 'doctor'].includes(role) && <Btn title="Clinical timeline" ghost onPress={() => navigation.navigate('Timeline', { patientId: id, name: values.name })} style={{ marginTop: 10 }} />}
      {deletable && <Btn title="Delete" danger onPress={remove} style={{ marginTop: 10 }} />}
    </ScrollView>
  );
}
