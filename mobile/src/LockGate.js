import React, { useEffect, useRef, useState } from 'react';
import { AppState, Text, View } from 'react-native';
import * as LocalAuth from 'expo-local-authentication';
import { Btn, colors } from './ui';

const LOCK_AFTER_MS = 60 * 1000; // re-authenticate after 60s in background

// Biometric / device-passcode app lock. Silently skipped when the device has none enrolled.
export default function LockGate({ children }) {
  const [locked, setLocked] = useState(false);
  const left = useRef(0);

  const unlock = async () => {
    const r = await LocalAuth.authenticateAsync({ promptMessage: 'Unlock ClinicCare', fallbackLabel: 'Use passcode' });
    if (r.success) setLocked(false);
  };

  useEffect(() => {
    const sub = AppState.addEventListener('change', async (st) => {
      if (st === 'background' || st === 'inactive') { if (!left.current) left.current = Date.now(); return; }
      if (st === 'active' && left.current && Date.now() - left.current > LOCK_AFTER_MS) {
        if (await LocalAuth.isEnrolledAsync()) { setLocked(true); unlock(); }
      }
      left.current = 0;
    });
    return () => sub.remove();
  }, []);

  if (!locked) return children;
  return (
    <View style={{ flex: 1, backgroundColor: colors.dark, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 }}>
      <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700' }}>ClinicCare is locked</Text>
      <Btn title="Unlock" onPress={unlock} />
    </View>
  );
}
