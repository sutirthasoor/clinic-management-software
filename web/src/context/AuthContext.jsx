import { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut, sendPasswordResetEmail, updateProfile,
} from 'firebase/auth';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let unsubProfile = () => {};
    const unsub = onAuthStateChanged(auth, (u) => {
      unsubProfile();
      setUser(u);
      setProfile(null);
      if (!u) { setReady(true); return; }
      setTimeout(() => setReady(true), 6000);
      unsubProfile = onSnapshot(
        doc(db, 'users', u.uid),
        (snap) => { setProfile(snap.exists() ? { id: snap.id, ...snap.data() } : null); setReady(true); },
        () => setReady(true),
      );
    });
    return () => { unsub(); unsubProfile(); };
  }, []);

  const login = (email, password) => signInWithEmailAndPassword(auth, email, password);
  const reset = (email) => sendPasswordResetEmail(auth, email);
  const logout = () => signOut(auth);

  // Self-registration always creates a PATIENT. Doctors/admins are created by an admin (Users & Roles).
  const register = async ({ name, email, password, phone }) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: name });
    await setDoc(doc(db, 'users', cred.user.uid), {
      uid: cred.user.uid, name, email, phone: phone || '', role: 'patient', active: true, createdAt: serverTimestamp(),
    });
  };

  const value = { user, profile, role: profile?.role, ready, login, logout, register, reset };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
