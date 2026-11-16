const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { onDocumentWritten, onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');

initializeApp();
const db = getFirestore();
const { SECRETS, REGION, getSettings, apptStart, clinicDate, emailHtml, sendEmail, notify } = require('./notify');

const SESSION_WORD = { 'Nutrition session': 'nutrition session', 'Yoga session': 'yoga session', 'Naturopathy session': 'naturopathy session', Video: 'video consultation', 'In-person': 'appointment', 'Follow-up': 'follow-up' };
const sessionWord = (a) => SESSION_WORD[a.type] || 'session';
const prettyDate = (d) => { const t = Date.parse(`${d}T00:00:00Z`); return t ? new Date(t).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : d || 'your selected date'; };
const user = async (uid) => (uid ? (await db.collection('users').doc(uid).get()).data() : undefined);

// =====================================================================================================
// WhatsApp templates to approve in Meta Business Manager (language: English). Variables are {{1}}, {{2}}...
//  clinic_booking_received   "Hi {{1}}, we received your {{2}} request for {{3}} at {{4}}."
//  clinic_session_confirmed  "Hi {{1}}, your {{2}} is confirmed for {{3}} at {{4}} with {{5}}."
//  clinic_session_rescheduled"Hi {{1}}, your {{2}} has been moved to {{3}} at {{4}} with {{5}}."
//  clinic_session_cancelled  "Hi {{1}}, your {{2}} on {{3}} at {{4}} has been cancelled. Please contact {{5}} to rebook."
//  clinic_session_reminder   "Hi {{1}}, a reminder of your {{2}} on {{3}} at {{4}} with {{5}}."
//  clinic_log_nudge          "Hi {{1}}, a gentle reminder to log your {{2}} today so {{3}} can follow your progress."
//  clinic_welcome            "Hi {{1}}, welcome to {{2}}! Sign in to your patient portal to book sessions and see your plans."
//  clinic_custom_message     "Hi {{1}}, you have a message from {{2}}: {{3}}"
//  clinic_document_notice / clinic_document_ready: see comms.js
// =====================================================================================================

// ---- 1. Appointment alerts: requested, confirmed, rescheduled, cancelled (WhatsApp + email)
exports.appointmentAlerts = onDocumentWritten({ document: 'appointments/{id}', region: REGION, retry: true, secrets: SECRETS }, async (event) => {
  const before = event.data?.before?.data();
  const after = event.data?.after?.data();
  if (!after || !after.patientId) return;
  const settings = await getSettings();
  if (settings.autoSendAppointmentAlerts === false) return;

  const moved = before && (before.date !== after.date || before.time !== after.time);
  let kind = null;
  if (!before && after.status === 'Requested') kind = 'received';
  else if (before?.status !== 'Confirmed' && after.status === 'Confirmed') kind = 'confirmed';
  else if (before && before.status !== 'Cancelled' && after.status === 'Cancelled') kind = 'cancelled';
  else if (moved && ['Requested', 'Confirmed'].includes(after.status)) kind = 'rescheduled';
  if (moved && after.reminderSentAt) await event.data.after.ref.update({ reminderSentAt: FieldValue.delete() }); // re-arm the reminder for the new slot
  if (!kind) return;

  const patient = await user(after.patientId);
  if (!patient) return;
  const provider = (await user(after.doctorId))?.name || 'your care provider';
  const clinic = settings.clinicName || 'our clinic';
  const word = sessionWord(after);
  const when = `${prettyDate(after.date)} at ${after.time || 'the selected time'}`;
  const copy = {
    received: { heading: 'We received your request', line: `We received your ${word} request for ${when}. You will get another message as soon as it is confirmed.`, tpl: 'clinic_booking_received', v: [patient.name || 'there', word, after.date || '-', after.time || '-'] },
    confirmed: { heading: 'Your session is confirmed', line: `Your ${word} is confirmed for ${when} with ${provider}.${after.type === 'Video' ? ' Join from the patient portal at the scheduled time.' : ''}`, tpl: 'clinic_session_confirmed', v: [patient.name || 'there', word, after.date || '-', after.time || '-', provider] },
    rescheduled: { heading: 'Your session was rescheduled', line: `Your ${word} has been moved to ${when} with ${provider}.`, tpl: 'clinic_session_rescheduled', v: [patient.name || 'there', word, after.date || '-', after.time || '-', provider] },
    cancelled: { heading: 'Your session was cancelled', line: `Your ${word} on ${when} has been cancelled. Please contact ${clinic}${settings.phone ? ' on ' + settings.phone : ''} to book another time.`, tpl: 'clinic_session_cancelled', v: [patient.name || 'there', word, after.date || '-', after.time || '-', clinic] },
  }[kind];

  const res = await notify({
    key: `appt_${event.params.id}_${kind}_${after.date}_${after.time}`, label: `Appointment ${kind}`, patient, replyTo: settings.email || undefined,
    email: { subject: `${copy.heading} - ${clinic}`, text: `Hello ${patient.name || ''},\n\n${copy.line}\n\n${clinic}`, html: emailHtml(settings, copy.heading, [`Hello ${patient.name || ''},`, copy.line], settings.website ? { label: 'Open patient portal', url: settings.website } : null) },
    wa: { template: copy.tpl, values: copy.v },
  });

  // New patient request: also tell the provider by email so it is not missed.
  if (kind === 'received' && after.doctorId) {
    const p = await user(after.doctorId);
    if (p?.email) {
      try {
        await sendEmail({ to: p.email, subject: `New ${word} request from ${patient.name || 'a patient'}`, text: `${patient.name || 'A patient'} requested a ${word} for ${when}. Open the app to confirm.`,
          html: emailHtml(settings, 'New session request', [`${patient.name || 'A patient'} requested a ${word} for ${when}.`, 'Open the clinic app to confirm or reschedule.']), idempotencyKey: `appt_${event.params.id}_provider` });
      } catch (e) { console.warn('provider email failed', e.message); }
    }
  }
  if (res.failed) throw new Error(res.error);
});

// ---- 2. Appointment reminders (default 24h before; set "Reminder lead time" in Clinic Settings)
exports.appointmentReminders = onSchedule({ schedule: 'every 30 minutes', timeZone: 'Asia/Kolkata', region: REGION, secrets: SECRETS, timeoutSeconds: 300, memory: '512MiB' }, async () => {
  const settings = await getSettings();
  if (settings.autoSendReminders === false || settings.autoSendAppointmentAlerts === false) return;
  const lead = Math.min(72, Math.max(1, Number(settings.reminderHoursBefore) || 24));
  const dates = Array.from({ length: Math.ceil(lead / 24) + 1 }, (_, i) => clinicDate(i));
  const snap = await db.collection('appointments').where('status', '==', 'Confirmed').where('date', 'in', dates).get();
  const clinic = settings.clinicName || 'our clinic';
  for (const d of snap.docs) {
    const a = d.data();
    const hours = (apptStart(a) - Date.now()) / 3600000;
    if (a.reminderSentAt || !a.patientId || !(hours > 0 && hours <= lead)) continue;
    const patient = await user(a.patientId); if (!patient) continue;
    const provider = (await user(a.doctorId))?.name || 'your care provider';
    const word = sessionWord(a); const when = `${prettyDate(a.date)} at ${a.time}`;
    const line = `A reminder of your ${word} on ${when} with ${provider}. Reply to this message or call ${settings.phone || clinic} if you need to reschedule.`;
    const res = await notify({
      key: `appt_${d.id}_reminder_${a.date}_${a.time}`, label: 'Appointment reminder', patient, replyTo: settings.email || undefined,
      email: { subject: `Reminder: your ${word} on ${prettyDate(a.date)}`, text: `Hello ${patient.name || ''},\n\n${line}\n\n${clinic}`, html: emailHtml(settings, 'Session reminder', [`Hello ${patient.name || ''},`, line]) },
      wa: { template: 'clinic_session_reminder', values: [patient.name || 'there', word, a.date, a.time, provider] },
    });
    if (!res.failed) await d.ref.update({ reminderSentAt: FieldValue.serverTimestamp() });
  }
});

// ---- 3. Daily nudge (7 pm clinic time) for clients on an ACTIVE plan who have not logged anything today
const NUDGES = [
  { plan: 'nutritionPlans', log: 'mealLogs', dateField: 'logDate', what: 'meals and water' },
  { plan: 'yogaPrograms', log: 'practiceLogs', dateField: 'practiceDate', what: 'yoga practice' },
  { plan: 'naturopathyPlans', log: 'symptomLogs', dateField: 'logDate', what: 'symptoms and energy' },
];
exports.dailyLogNudges = onSchedule({ schedule: '0 19 * * *', timeZone: 'Asia/Kolkata', region: REGION, secrets: SECRETS, timeoutSeconds: 540, memory: '512MiB' }, async () => {
  const settings = await getSettings();
  if (settings.autoSendLogNudges === false) return;
  const today = clinicDate(0); const clinic = settings.clinicName || 'your clinic';
  let sent = 0;
  for (const n of NUDGES) {
    const plans = await db.collection(n.plan).where('status', '==', 'Active').get();
    const seen = new Set();
    for (const p of plans.docs) {
      const plan = p.data();
      if (!plan.patientId || seen.has(plan.patientId) || (plan.startDate && plan.startDate > today) || sent >= 300) continue;
      seen.add(plan.patientId);
      const logged = await db.collection(n.log).where('patientId', '==', plan.patientId).where(n.dateField, '==', today).limit(1).get();
      if (!logged.empty) continue;
      const patient = await user(plan.patientId); if (!patient) continue;
      const provider = (await user(plan.doctorId))?.name || clinic;
      const line = `A gentle reminder to log your ${n.what} today so ${provider} can follow your progress. It takes a minute in your patient portal.`;
      await notify({
        key: `nudge_${n.plan}_${plan.patientId}_${today}`, label: 'Daily log reminder', patient, replyTo: settings.email || undefined,
        email: { subject: `Today's check-in: log your ${n.what}`, text: `Hello ${patient.name || ''},\n\n${line}\n\n${clinic}`, html: emailHtml(settings, 'Daily check-in', [`Hello ${patient.name || ''},`, line], settings.website ? { label: 'Open patient portal', url: settings.website } : null) },
        wa: { template: 'clinic_log_nudge', values: [patient.name || 'there', n.what, provider] },
      });
      sent += 1;
    }
  }
});

// ---- 4. Welcome message for new patients
exports.welcomeNewPatient = onDocumentCreated({ document: 'users/{uid}', region: REGION, retry: true, secrets: SECRETS }, async (event) => {
  const p = event.data?.data();
  if (!p || p.role !== 'patient') return;
  const settings = await getSettings();
  if (settings.autoSendWelcome === false) return;
  const clinic = settings.clinicName || 'our clinic';
  const line = `Welcome to ${clinic}. Sign in to your patient portal to book sessions, see your plans and message your care team.`;
  const res = await notify({
    key: `welcome_${event.params.uid}`, label: 'Welcome message', patient: p, replyTo: settings.email || undefined,
    email: { subject: `Welcome to ${clinic}`, text: `Hello ${p.name || ''},\n\n${line}`, html: emailHtml(settings, `Welcome to ${clinic}`, [`Hello ${p.name || ''},`, line], settings.website ? { label: 'Open patient portal', url: settings.website } : null) },
    wa: { template: 'clinic_welcome', values: [p.name || 'there', clinic] },
  });
  if (res.failed) throw new Error(res.error);
});

// ---- 5. "Send WhatsApp / Email" module: a provider writes a message to a client, we deliver it and write the result back
exports.sendClientMessage = onDocumentCreated({ document: 'outbox/{id}', region: REGION, retry: false, secrets: SECRETS }, async (event) => {
  const m = event.data?.data();
  if (!m || m.status !== 'Queued') return;
  const settings = await getSettings();
  const patient = await user(m.patientId);
  const provider = (await user(m.doctorId))?.name || settings.clinicName || 'your care team';
  if (!patient) return event.data.ref.update({ status: 'Failed', deliveryNote: 'Patient not found' });
  const channels = m.channel === 'WhatsApp' ? 'whatsapp' : m.channel === 'Email' ? 'email' : 'both';
  const res = await notify({
    key: `outbox_${event.params.id}`, label: `Message: ${(m.subject || m.message || '').slice(0, 40)}`, patient, channels, replyTo: settings.email || undefined,
    email: { subject: m.subject || `Message from ${provider}`, text: `Hello ${patient.name || ''},\n\n${m.message}\n\n${provider}`, html: emailHtml(settings, m.subject || `Message from ${provider}`, [`Hello ${patient.name || ''},`, m.message, `- ${provider}`]) },
    wa: { template: 'clinic_custom_message', values: [patient.name || 'there', provider, m.message] },
  });
  const sent = [res.emailStatus, res.whatsappStatus].filter((s) => s === 'sent').length;
  const status = res.failed ? (sent ? 'Partial' : 'Failed') : sent ? 'Sent' : 'Failed';
  const note = res.error || (sent ? `Email: ${res.emailStatus}, WhatsApp: ${res.whatsappStatus}` : 'No usable email or phone on the patient profile');
  await event.data.ref.update({ status, deliveryNote: note.slice(0, 400), deliveredAt: FieldValue.serverTimestamp() });
});

// ---- 6. Automatic delivery of every patient document and plan (see comms.js)
Object.assign(exports, require('./comms'));
