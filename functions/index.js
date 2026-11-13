const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { defineSecret, defineString } = require('firebase-functions/params');

initializeApp();
const db = getFirestore();
const accessToken = defineSecret('WHATSAPP_ACCESS_TOKEN');
const phoneNumberId = defineSecret('WHATSAPP_PHONE_NUMBER_ID');
const apiVersion = defineString('WHATSAPP_GRAPH_API_VERSION', { default: 'v27.0' });

// Configure and approve these WhatsApp Business templates before enabling the trigger:
// clinic_booking_received: "Hi {{1}}, we received your {{2}} request for {{3}} at {{4}}."
// clinic_session_confirmed: "Hi {{1}}, your {{2}} session is confirmed for {{3}} at {{4}} with {{5}}."
exports.sendBookingWhatsApp = onDocumentWritten({
  document: 'appointments/{appointmentId}',
  region: 'asia-south1',
  retry: true,
  secrets: [accessToken, phoneNumberId],
}, async (event) => {
  const before = event.data?.before?.data();
  const after = event.data?.after?.data();
  if (!after) return;
  const requested = !before && after.status === 'Requested';
  const confirmed = before?.status !== 'Confirmed' && after.status === 'Confirmed';
  if (!requested && !confirmed) return;

  const patientSnap = await db.collection('users').doc(after.patientId).get();
  const patient = patientSnap.data();
  const digits = String(patient?.phone || '').replace(/\D/g, '');
  if (!digits) {
    console.warn('WhatsApp booking message skipped: patient has no phone number', event.params.appointmentId);
    return;
  }
  const providerSnap = after.doctorId ? await db.collection('users').doc(after.doctorId).get() : null;
  const providerName = providerSnap?.data()?.name || 'your care provider';
  const template = requested ? 'clinic_booking_received' : 'clinic_session_confirmed';
  // Keep sensitive clinical details out of external message contents.
  const values = requested
    ? [patient?.name || 'there', 'session', after.date || 'your selected date', after.time || 'your selected time']
    : [patient?.name || 'there', 'session', after.date || 'your selected date', after.time || 'your selected time', providerName];

  const response = await fetch(`https://graph.facebook.com/${apiVersion.value()}/${phoneNumberId.value()}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken.value()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp', to: digits, type: 'template',
      template: { name: template, language: { code: 'en' }, components: [{ type: 'body', parameters: values.map((text) => ({ type: 'text', text: String(text) })) }] },
    }),
  });
  if (!response.ok) throw new Error(`WhatsApp API returned ${response.status}: ${await response.text()}`);
});
