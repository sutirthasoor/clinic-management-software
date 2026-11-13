// Creates demo users for EVERY role (Auth account + Firestore users/{uid} profile). Safe to re-run (idempotent).
// Setup: put the service account key at scripts/serviceAccountKey.json (Firebase console > Project settings > Service accounts)
// Usage:  node scripts/seed-users.mjs            -> create / update users
//         node scripts/seed-users.mjs --dry      -> print only
//         node scripts/seed-users.mjs --clean    -> delete the users this script created
// Login: any email below, password Clinic@123  (CHANGE or --clean before production!)
import { readFileSync } from 'node:fs';

const DRY = process.argv.includes('--dry'), CLEAN = process.argv.includes('--clean');
const PASSWORD = 'Clinic@123';

const USERS = [
  { role: 'admin', name: 'Aarav Admin', email: 'admin@clinic.test', phone: '+919000000001' },
  { role: 'doctor', name: 'Dr. Meera Nair', email: 'doctor1@clinic.test', phone: '+919000000011', specialization: 'General Medicine', qualification: 'MBBS, MD', experienceYears: 12, consultationFee: 600, licenseNo: 'MED-10021' },
  { role: 'doctor', name: 'Dr. Rohan Das', email: 'doctor2@clinic.test', phone: '+919000000012', specialization: 'Cardiology', qualification: 'MBBS, DM', experienceYears: 9, consultationFee: 900, licenseNo: 'MED-10022' },
  { role: 'nutritionist', name: 'Sneha Patel', email: 'nutritionist1@clinic.test', phone: '+919000000021', specialization: 'Clinical Nutrition', qualification: 'MSc Dietetics', experienceYears: 7, consultationFee: 500, nutritionFocus: 'Weight and metabolic health' },
  { role: 'yogaTeacher', name: 'Kabir Yogi', email: 'yoga1@clinic.test', phone: '+919000000031', qualification: 'RYT-500', practiceStyles: 'Hatha, Vinyasa, Pranayama', experienceYears: 10, consultationFee: 400 },
  { role: 'naturopath', name: 'Dr. Ananya Rao', email: 'naturopath1@clinic.test', phone: '+919000000041', qualification: 'BNYS', practiceFocus: 'Hydrotherapy, detox, lifestyle medicine', experienceYears: 8, consultationFee: 550, registrationNo: 'NAT-3301' },
  { role: 'patient', name: 'Priya Sharma', email: 'patient1@clinic.test', phone: '+919000000101', gender: 'Female', dob: '1990-04-12', bloodGroup: 'B+', provider: 'doctor1@clinic.test' },
  { role: 'patient', name: 'Rahul Verma', email: 'patient2@clinic.test', phone: '+919000000102', gender: 'Male', dob: '1985-09-03', bloodGroup: 'O+', provider: 'doctor1@clinic.test' },
  { role: 'patient', name: 'Sunita Mishra', email: 'patient3@clinic.test', phone: '+919000000103', gender: 'Female', dob: '1978-01-27', bloodGroup: 'A+', provider: 'doctor2@clinic.test' },
  { role: 'patient', name: 'Arjun Reddy', email: 'patient4@clinic.test', phone: '+919000000104', gender: 'Male', dob: '2000-11-15', bloodGroup: 'AB+', provider: 'doctor2@clinic.test' },
];

if (DRY) { USERS.forEach((u) => console.log(`${u.role.padEnd(13)} ${u.email.padEnd(28)} ${u.name}`)); process.exit(0); }

const { initializeApp, cert } = await import('firebase-admin/app');
const { getFirestore, FieldValue } = await import('firebase-admin/firestore');
const { getAuth } = await import('firebase-admin/auth');
const key = JSON.parse(readFileSync(new URL('./serviceAccountKey.json', import.meta.url)));
initializeApp({ credential: cert(key) });
const db = getFirestore(), auth = getAuth();
console.log(`Project: ${key.project_id}`);

async function uidFor(email) { try { return (await auth.getUserByEmail(email)).uid; } catch { return null; } }

if (CLEAN) {
  for (const u of USERS) {
    const uid = await uidFor(u.email);
    if (!uid) continue;
    await auth.deleteUser(uid); await db.collection('users').doc(uid).delete();
    console.log(`removed ${u.email}`);
  }
  process.exit(0);
}

const uids = {};
for (const u of USERS) {
  let uid = await uidFor(u.email);
  if (!uid) uid = (await auth.createUser({ email: u.email, password: PASSWORD, displayName: u.name, emailVerified: true })).uid;
  else await auth.updateUser(uid, { displayName: u.name });
  uids[u.email] = uid;
}
for (const u of USERS) {
  const { provider, ...profile } = u;
  const data = { ...profile, uid: uids[u.email], active: true, seed: true, updatedAt: FieldValue.serverTimestamp() };
  if (provider) data.primaryProviderId = uids[provider];
  await db.collection('users').doc(uids[u.email]).set({ createdAt: FieldValue.serverTimestamp(), ...data }, { merge: true });
  console.log(`${u.role.padEnd(13)} ${u.email}`);
}
console.log(`\nDone. ${USERS.length} users. Password for all: ${PASSWORD}`);
