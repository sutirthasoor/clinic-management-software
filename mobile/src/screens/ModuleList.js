import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { FlatList, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { collection, limit, onSnapshot, query } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';
import { MODULES, statusFieldOf, statusTone } from '../config/modules';
import { buildConstraints, can, cellValue, colName } from '../lib';
import { Chip, Pill, colors, s } from '../ui';

export default function ModuleList({ route, navigation }) {
  const m = MODULES.find((x) => x.key === route.params.key);
  const { user, role } = useAuth();
  const sf = statusFieldOf(m);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [error, setError] = useState('');

  useLayoutEffect(() => { navigation.setOptions({ title: m.label }); }, [m.label]);

  useEffect(() => {
    const q = query(collection(db, colName(m)), ...buildConstraints(m, role, user.uid), limit(300));
    return onSnapshot(q, (snap) => {
      const d = snap.docs.map((x) => ({ id: x.id, ...x.data() }));
      d.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setRows(d); setLoading(false);
    }, (e) => { setError(e.message); setLoading(false); });
  }, [m.key, role]);

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    let r = rows;
    if (filter && sf) r = r.filter((x) => x[sf.name] === filter);
    return t ? r.filter((x) => JSON.stringify(x).toLowerCase().includes(t)) : r;
  }, [rows, search, filter]);

  const canCreate = can(m, role, 'c') && !m.source;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <TextInput placeholder={`Search ${rows.length} records...`} value={search} onChangeText={setSearch}
        style={{ margin: 12, marginBottom: 8, backgroundColor: '#fff', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: colors.line }} />
      {sf && (
        <View style={{ height: 44 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12 }}>
            {['', ...sf.options].map((o) => <Chip key={o || 'all'} label={o || 'All'} active={filter === o} onPress={() => setFilter(o)} />)}
          </ScrollView>
        </View>
      )}
      {!!error && <Text style={{ color: colors.danger, margin: 12 }}>{error}</Text>}
      <FlatList
        data={filtered}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ padding: 12, paddingBottom: 90 }}
        ListEmptyComponent={<Text style={{ textAlign: 'center', color: colors.muted, marginTop: 40 }}>{loading ? 'Loading...' : 'No records found.'}</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity style={s.card} onPress={() => navigation.navigate('ModuleForm', { key: m.key, id: item.id })}>
            <Text style={{ fontWeight: '600', fontSize: 15, color: colors.text }}>{cellValue(m, item, m.columns[0]) || '-'}</Text>
            {m.columns.slice(1).map((c) => {
              const f = m.fields.find((x) => x.name === c);
              const val = cellValue(m, item, c);
              if (!val) return null;
              if (f.type === 'select' && (f === sf || ['priority', 'flag', 'severity', 'urgency'].includes(f.name))) {
                return <View key={c} style={{ marginTop: 4 }}><Pill label={`${val}`} tone={statusTone(val)} /></View>;
              }
              return <Text key={c} style={{ color: colors.muted, marginTop: 2 }}>{f.label}: {val}</Text>;
            })}
          </TouchableOpacity>
        )}
      />
      {canCreate && (
        <TouchableOpacity onPress={() => navigation.navigate('ModuleForm', { key: m.key })} accessibilityLabel="Add new"
          style={{ position: 'absolute', right: 20, bottom: 24, backgroundColor: colors.brand, width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', elevation: 4 }}>
          <Text style={{ color: '#fff', fontSize: 30, marginTop: -2 }}>+</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
