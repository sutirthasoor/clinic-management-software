// Seeds demo data (default 100 records + demo users). Bypasses security rules via the Admin SDK.
// Usage (from clinic-system root):
//   npm i -D firebase-admin
//   put your service account key at scripts/serviceAccountKey.json   (Firebase console > Project settings > Service accounts > Generate new private key)
//   node scripts/seed.mjs            -> seed 100 records
//   node scripts/seed.mjs --max=60   -> fewer records
//   node scripts/seed.mjs --dry      -> only print what would be created
//   node scripts/seed.mjs --clean    -> remove everything this script created
// Demo logins: seed-doc1@clinic.test ... seed-pat1@clinic.test, password Clinic@123 (change/delete before production!)
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const DRY = args.includes('--dry'), CLEAN = args.includes('--clean');
const MAX = Number((args.find((a) => a.startsWith('--max=')) || '--max=100').split('=')[1]);
const PASSWORD = 'Clinic@123', DOMAIN = '@clinic.test';

let db, auth, TS;
if (!DRY) {
  const { initializeApp, cert } = await import('firebase-admin/app');
  const { getFirestore, FieldValue } = await import('firebase-admin/firestore');
  const { getAuth } = await import('firebase-admin/auth');
  const key = JSON.parse(readFileSync(new URL('./serviceAccountKey.json', import.meta.url)));
  initializeApp({ credential: cert(key) });
  db = getFirestore(); auth = getAuth(); TS = FieldValue.serverTimestamp();
  console.log(`Project: ${key.project_id}`);
}

const COLLECTIONS = ['appointments', 'consultations', 'prescriptions', 'vitals', 'labOrders', 'labResults', 'immunizations', 'allergies', 'followUps',
  'invoices', 'payments', 'services', 'departments', 'inventory', 'pharmacy', 'schedules', 'announcements', 'settings', 'queue', 'feedback', 'medReminders', 'consents'];

if (CLEAN) {
  for (const c of COLLECTIONS) {
    const s = await db.collection(c).where('seed', '==', true).get();
    for (let i = 0; i < s.docs.length; i += 400) { const b = db.batch(); s.docs.slice(i, i + 400).forEach((d) => b.delete(d.ref)); await b.commit(); }
    console.log(`${c}: removed ${s.size}`);
  }
  const u = await db.collection('users').where('seed', '==', true).get();
  for (const d of u.docs) { try { await auth.deleteUser(d.id); } catch {} await d.ref.delete(); }
  console.log(`users: removed ${u.size}`);
  process.exit(0);
}

// ---------- helpers
let seedN = 7; const rnd = () => (seedN = (seedN * 9301 + 49297) % 233280) / 233280;
const pick = (a) => a[Math.floor(rnd() * a.length)];
const int = (lo, hi) => Math.floor(lo + rnd() * (hi - lo + 1));
const day = (off) => { const d = new Date(); d.setDate(d.getDate() + off); return d.toISOString().slice(0, 10); };
const pad = (n) => String(n).padStart(2, '0');

// ---------- people
const DOCS = [['Dr. Anita Rao', 'General Medicine', 'MBBS, MD', 500], ['Dr. Rohan Mehta', 'Cardiology', 'MBBS, DM', 900], ['Dr. Sana Iqbal', 'Pediatrics', 'MBBS, DCH', 600]];
const PATS = ['Aarav Sharma', 'Diya Patel', 'Vihaan Singh', 'Ananya Das', 'Kabir Khan', 'Meera Nair', 'Arjun Reddy', 'Ishita Roy', 'Rahul Verma', 'Sneha Joshi', 'Imran Ali', 'Priya Mishra'];
const users = [
  ...DOCS.map((d, i) => ({ email: `seed-doc${i + 1}${DOMAIN}`, role: 'doctor', name: d[0], specialization: d[1], qualification: d[2], consultationFee: d[3], experienceYears: int(4, 20), licenseNo: `ODM-${1000 + i}`, phone: `98${int(10000000, 99999999)}`, gender: i === 1 ? 'Male' : 'Female', active: true })),
  ...PATS.map((n, i) => ({ email: `seed-pat${i + 1}${DOMAIN}`, role: 'patient', name: n, phone: `97${int(10000000, 99999999)}`, gender: pick(['Male', 'Female']), bloodGroup: pick(['A+', 'B+', 'O+', 'AB+', 'O-']), dob: `${int(1960, 2015)}-${pad(int(1, 12))}-${pad(int(1, 28))}`, active: true })),
  { email: `seed-admin${DOMAIN}`, role: 'admin', name: 'Demo Admin', active: true },
];

const recs = []; // { c: collection, d: data }
const add = (c, d) => recs.push({ c, d });
const ids = { doctor: [], patient: [] }; // filled after user creation (or fake in dry run)

function build() {
  const D = () => pick(ids.doctor), P = () => pick(ids.patient);
  const link = (doc, pat) => ({ patientId: pat.id, patientIdName: pat.name, doctorId: doc.id, doctorIdName: doc.name });
  const own = (pat) => ({ patientId: pat.id, patientIdName: pat.name });

  add('settings', { clinicName: 'ClinicCare Demo Clinic', address: 'Saheed Nagar, Bhubaneswar', phone: '0674-2500000', email: 'hello@cliniccare.test', workingHours: 'Mon-Sat 9:00-18:00', currency: '₹', taxId: '21ABCDE1234F1Z5', slotMinutes: 15 });
  ['General Medicine', 'Cardiology', 'Pediatrics', 'Pathology'].forEach((n) => add('departments', { name: n, head: pick(DOCS)[0], location: `Floor ${int(1, 3)}`, phone: `0674-25${int(10000, 99999)}`, description: `${n} outpatient services` }));
  [['Consultation', 'Consultation', 500], ['Follow-up visit', 'Consultation', 300], ['CBC', 'Lab', 350], ['Lipid profile', 'Lab', 700], ['ECG', 'Radiology', 400], ['Health check package', 'Package', 2500]]
    .forEach(([name, category, price], i) => add('services', { name, code: `SVC${100 + i}`, category, price, taxPercent: 5, active: true }));
  ids.doctor.forEach((d, i) => ['Monday', 'Thursday'].forEach((dayName) => add('schedules', { doctorId: d.id, doctorIdName: d.name, day: dayName, startTime: i === 1 ? '14:00' : '09:30', endTime: i === 1 ? '18:00' : '13:30', slotMinutes: 15, mode: 'Both' })));
  [['Paracetamol 500mg', 'Rack A1'], ['Amoxicillin 500mg', 'Rack A2'], ['Metformin 500mg', 'Rack B1'], ['Atorvastatin 10mg', 'Rack B2'], ['ORS sachet', 'Rack C1'], ['Cetirizine 10mg', 'Rack C2']]
    .forEach(([medicine, rack], i) => add('pharmacy', { medicine, batchNo: `B${2600 + i}`, expiry: day(i === 4 ? 20 : int(90, 500)), quantity: i === 5 ? 6 : int(40, 300), mrp: int(20, 250), rack }));
  [['Surgical gloves (box)', 'Consumable', 40, 50], ['Syringes 5ml (pack)', 'Consumable', 120, 60], ['Face masks (box)', 'Consumable', 15, 20], ['Printer paper (ream)', 'Stationery', 30, 10]]
    .forEach(([item, category, quantity, reorderLevel], i) => add('inventory', { item, sku: `INV${200 + i}`, category, quantity, unit: 'pcs', reorderLevel, expiry: category === 'Consumable' ? day(int(120, 700)) : '', supplier: 'MediSupply Co.' }));
  add('announcements', { title: 'Clinic timing update', body: 'Saturday OPD runs until 2 pm from next week.', audience: 'All', publishOn: day(0) });
  add('announcements', { title: 'Free BP camp', body: 'Free blood pressure screening this Sunday.', audience: 'Patients', publishOn: day(-2) });

  // appointments + clinical data
  const STAT = ['Requested', 'Confirmed', 'Completed', 'Completed', 'Completed', 'Cancelled', 'No-show'];
  for (let i = 0; i < 16; i++) {
    const doc = D(), pat = P(), off = int(-25, 8), status = off < 0 ? pick(['Completed', 'Completed', 'Completed', 'Cancelled', 'No-show']) : pick(['Requested', 'Confirmed', 'Confirmed']);
    add('appointments', { ...link(doc, pat), date: day(off), time: `${pad(int(9, 17))}:${pick(['00', '15', '30', '45'])}`, type: pick(['In-person', 'In-person', 'Video', 'Follow-up']), reason: pick(['Fever', 'Chest discomfort', 'Routine check-up', 'Cough and cold', 'Back pain', 'Skin rash']), status });
  }
  const DX = [['Viral fever', 'B34.9'], ['Hypertension', 'I10'], ['Type 2 diabetes', 'E11.9'], ['Acute bronchitis', 'J20.9'], ['Migraine', 'G43.9']];
  for (let i = 0; i < 8; i++) {
    const doc = D(), pat = P(), [dx, icd10] = pick(DX), date = day(-int(1, 60));
    add('consultations', { ...link(doc, pat), visitDate: date, chiefComplaint: pick(['Fever for 3 days', 'Headache', 'Breathlessness on exertion', 'Fatigue']), history: 'Symptoms started a few days ago.', examination: 'Vitals stable. Systemic exam unremarkable.', diagnosis: dx, icd10, plan: 'Medication, hydration, review if symptoms persist.', followUpDate: day(int(5, 20)) });
    if (i < 6) add('prescriptions', { ...link(doc, pat), date, diagnosis: dx, medicines: '1. Paracetamol 500mg - 1 tab TDS - 3 days\n2. Cetirizine 10mg - 1 tab HS - 5 days', instructions: 'Plenty of fluids. Review after 5 days.', validUntil: day(30) });
  }
  for (let i = 0; i < 5; i++) { const pat = P(); add('vitals', { ...own(pat), recordedOn: `${day(-int(0, 40))}T${pad(int(8, 18))}:00`, bp: `${int(105, 150)}/${int(65, 95)}`, pulse: int(60, 100), temperature: 36 + Math.round(rnd() * 30) / 10, spo2: int(94, 100), weight: int(45, 95), height: int(150, 185), glucose: int(80, 180), notes: '' }); }
  for (let i = 0; i < 4; i++) {
    const doc = D(), pat = P(), [test, unit, ref, lo, hi] = pick([['Hemoglobin', 'g/dL', '12-16', 9, 16], ['Fasting glucose', 'mg/dL', '70-100', 80, 190], ['Total cholesterol', 'mg/dL', '<200', 150, 260]]);
    const val = int(lo, hi);
    add('labOrders', { ...link(doc, pat), orderedOn: day(-int(2, 30)), tests: test, priority: pick(['Routine', 'Routine', 'Urgent']), status: 'Completed', notes: '' });
    add('labResults', { ...link(doc, pat), test, result: String(val), unit, referenceRange: ref, resultDate: day(-int(0, 20)), flag: val > hi - 3 || val < lo + 1 ? 'Abnormal' : 'Normal', notes: '' });
  }
  for (let i = 0; i < 3; i++) { const pat = P(); add('immunizations', { ...own(pat), vaccine: pick(['Influenza', 'Hepatitis B', 'Tetanus booster']), doseNo: '1', date: day(-int(30, 300)), nextDue: day(int(10, 200)), batchNo: `VX${int(100, 999)}` }); }
  for (let i = 0; i < 2; i++) { const pat = P(); add('allergies', { ...own(pat), allergen: pick(['Penicillin', 'Peanuts', 'Dust']), reaction: 'Rash', severity: pick(['Mild', 'Moderate']), notedOn: day(-int(30, 400)) }); }
  for (let i = 0; i < 3; i++) { const doc = D(), pat = P(); add('followUps', { ...link(doc, pat), dueDate: day(int(-3, 15)), reason: 'Review reports', status: 'Pending' }); }
  for (let i = 1; i <= 3; i++) { const doc = ids.doctor[i % ids.doctor.length]; add('queue', { tokenNo: i, patientName: pick(PATS), phone: `97${int(10000000, 99999999)}`, doctorId: doc.id, doctorIdName: doc.name, visitType: 'Walk-in', complaint: 'Fever', status: pick(['Waiting', 'Waiting', 'Called']) }); }
  for (let i = 0; i < 2; i++) { const pat = P(); add('feedback', { ...own(pat), rating: int(3, 5), comments: pick(['Very helpful doctor', 'Short waiting time', 'Clean clinic']) }); }
  for (let i = 0; i < 2; i++) { const pat = P(); add('medReminders', { ...own(pat), medicine: 'Metformin 500mg', dose: '1 tab', times: '08:00, 20:00', startDate: day(-5), endDate: day(25), active: true }); }
  for (let i = 0; i < 2; i++) { const pat = P(); add('consents', { ...own(pat), consentType: pick(['Treatment', 'Data sharing']), granted: true, grantedOn: day(-int(1, 90)), notes: '' }); }

  // billing: invoices + payments over ~6 months (feeds the revenue chart)
  for (let i = 0; i < 8; i++) {
    const pat = P(), subtotal = int(3, 30) * 100, tax = Math.round(subtotal * 0.05), discount = rnd() < 0.2 ? 100 : 0, total = subtotal + tax - discount;
    const status = pick(['Paid', 'Paid', 'Paid', 'Unpaid', 'Partial']), date = day(-int(0, 170)), invoiceNo = `INV-${2600 + i}`;
    add('invoices', { ...own(pat), invoiceNo, date, items: 'Consultation\nLab tests', subtotal, tax, discount, total, status, paymentMode: pick(['Cash', 'UPI', 'Card']) });
    if (status !== 'Unpaid') add('payments', { ...own(pat), invoiceNo, amount: status === 'Partial' ? Math.round(total / 2) : total, date, mode: pick(['Cash', 'UPI', 'Card']), reference: `TXN${int(100000, 999999)}` });
  }
}

// ---------- run
if (DRY) {
  users.forEach((u) => { const id = `dry-${u.email}`; (ids[u.role] || []).push({ id, name: u.name }); });
  build();
} else {
  for (const u of users) {
    let rec;
    try { rec = await auth.getUserByEmail(u.email); } catch { rec = await auth.createUser({ email: u.email, password: PASSWORD, displayName: u.name }); }
    const { email, ...rest } = u;
    await db.collection('users').doc(rec.uid).set({ uid: rec.uid, email, ...rest, seed: true, createdAt: TS }, { merge: true });
    if (ids[u.role]) ids[u.role].push({ id: rec.uid, name: u.name });
  }
  console.log(`users ready: ${users.length}`);
  build();
}

const out = recs.slice(0, MAX);
const tally = out.reduce((a, r) => ((a[r.c] = (a[r.c] || 0) + 1), a), {});
console.log(`${out.length} records:`, tally);
if (DRY) process.exit(0);

for (let i = 0; i < out.length; i += 400) {
  const b = db.batch();
  out.slice(i, i + 400).forEach((r) => b.set(db.collection(r.c).doc(), { ...r.d, seed: true, createdBy: 'seed', createdAt: TS }));
  await b.commit();
}
console.log('Seeding complete. Log in with seed-admin@clinic.test / Clinic@123 (or seed-doc1@..., seed-pat1@...).');
