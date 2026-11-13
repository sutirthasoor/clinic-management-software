import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../AuthContext';
import { ALERT_SOURCES, MODULES, computeAlerts, menuFor, money, statusTone, todayStr } from '../config/modules';
import { loadRows } from '../lib';
import { registerPush, scheduleMedReminders } from '../notifications';
import { Pill, colors, s } from '../ui';

const KEYS = {
  admin: ['appointments', 'patients', 'payments', 'invoices', ...ALERT_SOURCES],
  doctor: ['appointments', 'queue', 'followUps', 'labResults', 'patients'],
  nutritionist: ['appointments', 'patients', 'nutritionAssessments', 'nutritionPlans', 'mealLogs'],
  yogaTeacher: ['appointments', 'patients', 'yogaPrograms', 'yogaSessions', 'practiceLogs'],
  naturopath: ['appointments', 'patients', 'naturopathyAssessments', 'naturopathyPlans', 'therapySessions'],
  patient: ['appointments', 'invoices', 'medReminders', 'followUps', 'prescriptions'],
};
const M = (k) => MODULES.find((x) => x.key === k);

export default function Home({ navigation }) {
  const { user, profile, role } = useAuth();
  const [d, setD] = useState({});
  const [refreshing, setRefreshing] = useState(false);
  const groups = menuFor(role).map(([g, l]) => [g, l.filter((m) => !m.custom)]).filter(([, l]) => l.length);

  const load = useCallback(async () => {
    const keys = KEYS[role] || [];
    const res = await Promise.all(keys.map((k) => loadRows(M(k), role, user.uid)));
    const data = Object.fromEntries(keys.map((k, i) => [k, res[i]]));
    setD(data);
    if (role === 'patient') scheduleMedReminders(data.medReminders || []);
  }, [role]);

  useEffect(() => { load(); registerPush(user.uid); }, [role]);
  const refresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };
  const open = (key) => navigation.navigate('ModuleList', { key });

  const today = todayStr();
  const appts = d.appointments || [];
  const todays = appts.filter((a) => a.date === today);
  const upcoming = appts.filter((a) => a.date >= today && !['Cancelled', 'Completed', 'No-show'].includes(a.status))
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  const due = (d.invoices || []).filter((i) => ['Unpaid', 'Partial'].includes(i.status)).reduce((x, i) => x + (Number(i.total) || 0), 0);
  const month = today.slice(0, 7);

  const kpis = role === 'admin' ? [
    [todays.length, "Today's appointments", 'appointments'], [(d.patients || []).length, 'Patients', 'patients'],
    [money((d.payments || []).filter((p) => String(p.date).startsWith(month)).reduce((x, p) => x + (Number(p.amount) || 0), 0)), 'Collected this month', 'payments'],
    [money(due), 'Unpaid invoices', 'invoices'],
  ] : role === 'doctor' ? [
    [todays.length, "Today's appointments", 'appointments'], [(d.queue || []).filter((q) => ['Waiting', 'Called'].includes(q.status)).length, 'Waiting in queue', 'queue'],
    [(d.followUps || []).filter((f) => f.status === 'Pending' && f.dueDate <= today).length, 'Follow-ups due', 'followUps'],
    [(d.labResults || []).filter((l) => ['Abnormal', 'Critical'].includes(l.flag)).length, 'Abnormal labs', 'labResults'],
  ] : role === 'nutritionist' ? [
    [todays.length, "Today's sessions", 'appointments'], [(d.nutritionPlans || []).filter((p) => p.status === 'Active').length, 'Active nutrition plans', 'nutritionPlans'],
    [(d.nutritionAssessments || []).length, 'Client assessments', 'nutritionAssessments'], [(d.mealLogs || []).length, 'Meal & hydration logs', 'mealLogs'],
  ] : role === 'yogaTeacher' ? [
    [todays.length, "Today's sessions", 'appointments'], [(d.yogaPrograms || []).filter((p) => p.status === 'Active').length, 'Active yoga programs', 'yogaPrograms'],
    [(d.yogaSessions || []).length, 'Session notes', 'yogaSessions'], [(d.practiceLogs || []).length, 'Home practice logs', 'practiceLogs'],
  ] : role === 'naturopath' ? [
    [todays.length, "Today's sessions", 'appointments'], [(d.naturopathyPlans || []).filter((p) => p.status === 'Active').length, 'Active wellness plans', 'naturopathyPlans'],
    [(d.naturopathyAssessments || []).length, 'Wellness assessments', 'naturopathyAssessments'], [(d.therapySessions || []).length, 'Therapy session notes', 'therapySessions'],
  ] : [
    [upcoming[0]?.date || '-', 'Next appointment', 'appointments'], [money(due), 'Amount due', 'invoices'],
    [(d.medReminders || []).filter((r) => r.active).length, 'Medicine reminders', 'medReminders'], [(d.prescriptions || []).length, 'Prescriptions', 'prescriptions'],
  ];
  const alerts = role === 'admin' ? computeAlerts(d) : [];
  const tone = { warn: '#e0a100', bad: colors.danger, info: '#2f6fd0' };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
      <Text style={s.h1}>Hello, {profile?.name}</Text>
      <Text style={{ color: colors.muted, textTransform: 'capitalize', marginBottom: 12 }}>{role}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {kpis.map(([v, label, key]) => (
          <TouchableOpacity key={label} onPress={() => open(key)} style={[s.card, { width: '47%', marginBottom: 0 }]}>
            <Text style={{ fontSize: 22, fontWeight: '700', color: colors.brand }}>{v}</Text>
            <Text style={{ color: colors.muted }}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {!!alerts.length && (<><Text style={s.h2}>Alerts</Text>
        {alerts.map((a) => (
          <TouchableOpacity key={a.text} onPress={() => open(a.link)} style={[s.card, { borderLeftWidth: 4, borderLeftColor: tone[a.tone] }]}>
            <Text style={{ color: colors.text }}>{a.text}</Text>
          </TouchableOpacity>
        ))}</>)}

      {!!upcoming.length && (<><Text style={s.h2}>Upcoming appointments</Text>
        {upcoming.slice(0, 4).map((a) => (
          <TouchableOpacity key={a.id} style={s.card} onPress={() => navigation.navigate('ModuleForm', { key: 'appointments', id: a.id })}>
            <Text style={{ fontWeight: '600', color: colors.text }}>{a.date} {a.time}  -  {(role === 'patient' ? a.doctorIdName : a.patientIdName) || ''}</Text>
            <View style={{ marginTop: 4 }}><Pill label={a.status} tone={statusTone(a.status)} /></View>
          </TouchableOpacity>
        ))}</>)}

      {groups.map(([g, list]) => (
        <View key={g}>
          <Text style={s.h2}>{g}</Text>
          {list.map((m) => (
            <TouchableOpacity key={m.key} onPress={() => open(m.key)} style={[s.card, { flexDirection: 'row', alignItems: 'center' }]}>
              <Ionicons name={m.icon || 'ellipse-outline'} size={20} color={colors.brand} style={{ marginRight: 12 }} />
              <Text style={{ flex: 1, color: colors.text, fontSize: 15 }}>{m.label}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </TouchableOpacity>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}
