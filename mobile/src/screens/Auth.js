import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../AuthContext';
import { Btn, Input, colors } from '../ui';

export default function Auth() {
  const { login, register, reset } = useAuth();
  const [mode, setMode] = useState('login');
  const [f, setF] = useState({ name: '', email: '', phone: '', password: '' });
  const [busy, setBusy] = useState(false);
  const set = (k) => (t) => setF({ ...f, [k]: t });

  const submit = async () => {
    setBusy(true);
    try {
      if (mode === 'login') await login(f.email.trim(), f.password);
      else if (mode === 'register') await register({ ...f, email: f.email.trim() });
      else { await reset(f.email.trim()); Alert.alert('Check your email', 'Password reset link sent.'); }
    } catch (e) { Alert.alert('Error', e.message.replace('Firebase: ', '')); }
    setBusy(false);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.dark }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 20 }} keyboardShouldPersistTaps="handled">
        <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 22 }}>
          <Text style={{ fontSize: 26, fontWeight: '700', color: colors.brand, textAlign: 'center' }}>ClinicCare</Text>
          <Text style={{ fontSize: 18, fontWeight: '600', marginVertical: 14 }}>
            {mode === 'login' ? 'Sign in' : mode === 'register' ? 'Create patient account' : 'Reset password'}
          </Text>
          {mode === 'register' && <Input label="Full name" value={f.name} onChangeText={set('name')} />}
          <Input label="Email" value={f.email} onChangeText={set('email')} autoCapitalize="none" keyboardType="email-address" />
          {mode === 'register' && <Input label="Phone" value={f.phone} onChangeText={set('phone')} keyboardType="phone-pad" />}
          {mode !== 'reset' && <Input label="Password" value={f.password} onChangeText={set('password')} secureTextEntry />}
          <Btn title={busy ? 'Please wait...' : mode === 'login' ? 'Sign in' : mode === 'register' ? 'Register' : 'Send reset link'} onPress={submit} disabled={busy} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 }}>
            {mode !== 'login' && <TouchableOpacity onPress={() => setMode('login')}><Text style={{ color: colors.brand }}>Back to sign in</Text></TouchableOpacity>}
            {mode === 'login' && <TouchableOpacity onPress={() => setMode('register')}><Text style={{ color: colors.brand }}>New patient? Register</Text></TouchableOpacity>}
            {mode === 'login' && <TouchableOpacity onPress={() => setMode('reset')}><Text style={{ color: colors.brand }}>Forgot password?</Text></TouchableOpacity>}
          </View>
          <Text style={{ color: colors.muted, marginTop: 14, fontSize: 12 }}>Doctor and admin accounts are created by the clinic administrator.</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
