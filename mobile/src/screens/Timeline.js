import React, { useEffect, useLayoutEffect, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';
import { TIMELINE, buildTimeline } from '../config/modules';
import { logAudit } from '../lib';
import { Chip, Pill, colors, s } from '../ui';

export default function Timeline({ route, navigation }) {
  const { patientId, name } = route.params;
  const { profile, role, user } = useAuth();
  const [events, setEvents] = useState([]);
  const [busy, setBusy] = useState(true);
  const [filter, setFilter] = useState('');
  useLayoutEffect(() => { navigation.setOptions({ title: `${name || 'Patient'} - history` }); }, []);

  useEffect(() => {
    Promise.all(TIMELINE.map(async ([k]) => {
      try {
        const filters = [where('patientId', '==', patientId)];
        if (role !== 'admin') filters.push(where('doctorId', '==', user.uid));
        const sn = await getDocs(query(collection(db, k), ...filters)); return [k, sn.docs.map((d) => ({ id: d.id, ...d.data() }))];
      }
      catch { return [k, []]; }
    })).then((r) => { setEvents(buildTimeline(Object.fromEntries(r))); setBusy(false); logAudit(profile, 'view-timeline', 'users', patientId); });
  }, []);

  const types = [...new Set(events.map((e) => e.type))];
  const shown = events.filter((e) => !filter || e.type === filter);
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', padding: 12, paddingBottom: 0 }}>
        {['', ...types].map((t) => <Chip key={t || 'all'} label={t || 'All'} active={filter === t} onPress={() => setFilter(t)} />)}
      </View>
      <FlatList data={shown} keyExtractor={(e) => e.id} contentContainerStyle={{ padding: 12 }}
        ListEmptyComponent={<Text style={{ textAlign: 'center', color: colors.muted, marginTop: 40 }}>{busy ? 'Loading...' : 'No clinical history recorded.'}</Text>}
        renderItem={({ item }) => (
          <View style={s.card}>
            <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4 }}>{item.when ? new Date(item.when).toLocaleDateString() : '-'}</Text>
            <Pill label={item.type} tone="info" />
            <Text style={{ color: colors.text, marginTop: 6 }}>{item.text}</Text>
          </View>
        )} />
    </View>
  );
}
