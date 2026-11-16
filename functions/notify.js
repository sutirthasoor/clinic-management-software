// Shared WhatsApp (Meta Cloud API) + email (Resend) delivery used by every automation in this folder.
// - Email goes through Resend's REST API (https://resend.com/docs/api-reference/emails/send-email). No SMTP.
// - WhatsApp uses approved message templates (required by Meta for business-initiated messages).
// - Every send is logged in `commLogs/{key}`; a channel that already succeeded is never re-sent on retry.
const { defineSecret, defineString } = require('firebase-functions/params');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const resendKey = defineSecret('RESEND_API_KEY');
const waToken = defineSecret('WHATSAPP_ACCESS_TOKEN');
const waPhone = defineSecret('WHATSAPP_PHONE_NUMBER_ID');
const mailFrom = defineString('MAIL_FROM', { default: 'Clinic <onboarding@resend.dev>' }); // use a verified Resend domain in production
const apiVersion = defineString('WHATSAPP_GRAPH_API_VERSION', { default: 'v27.0' });
const countryCode = defineString('DEFAULT_COUNTRY_CODE', { default: '91' });
const tzOffset = defineString('CLINIC_UTC_OFFSET', { default: '+05:30' });

const SECRETS = [resendKey, waToken, waPhone];
const REGION = 'asia-south1';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function getSettings() {
  return (await getFirestore().collection('settings').limit(1).get()).docs[0]?.data() || {};
}

// "98765 43210" -> "919876543210". Numbers already carrying a country code are left as they are.
function waNumber(phone) {
  let d = String(phone || '').replace(/\D/g, '').replace(/^00/, '');
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  if (d.length === 10) d = countryCode.value() + d;
  return d.length >= 11 ? d : '';
}

// Clinic start time of an appointment as epoch ms.
const apptStart = (a) => Date.parse(`${a.date}T${a.time || '09:00'}:00${tzOffset.value()}`);
const clinicDate = (offsetDays = 0) => new Date(Date.now() + offsetDays * 86400000 + (parseOffset() * 60000)).toISOString().slice(0, 10);
function parseOffset() { const m = /^([+-])(\d{2}):(\d{2})$/.exec(tzOffset.value()); return m ? (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : 330; }

// Simple branded HTML email. `lines` are paragraphs; `cta` is an optional { label, url }.
function emailHtml(clinic, heading, lines, cta) {
  const body = lines.filter(Boolean).map((l) => `<p style="margin:0 0 14px;line-height:1.55">${esc(l).replace(/\n/g, '<br>')}</p>`).join('');
  const btn = cta?.url ? `<p style="margin:22px 0"><a href="${esc(cta.url)}" style="background:#2f6fed;color:#fff;padding:11px 20px;border-radius:8px;text-decoration:none;font-weight:600">${esc(cta.label)}</a></p>` : '';
  return `<div style="background:#f4f6fa;padding:24px 12px;font-family:Segoe UI,Arial,sans-serif;color:#1f2937"><div style="max-width:560px;margin:auto;background:#fff;border-radius:12px;padding:28px;border:1px solid #e5e7eb">
<h2 style="margin:0 0 18px;font-size:19px;color:#1e3a5f">${esc(heading)}</h2>${body}${btn}
<hr style="border:none;border-top:1px solid #eee;margin:22px 0 12px"><p style="margin:0;font-size:12px;color:#667085">${esc(clinic.clinicName || 'Clinic')}${clinic.phone ? ' · ' + esc(clinic.phone) : ''}${clinic.address ? '<br>' + esc(clinic.address) : ''}</p></div></div>`;
}

// attachments: [{ filename, contentType, content: Buffer }]
async function sendEmail({ to, subject, text, html, attachments = [], replyTo, idempotencyKey }) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendKey.value()}`, 'Content-Type': 'application/json', ...(idempotencyKey ? { 'Idempotency-Key': String(idempotencyKey).slice(0, 250) } : {}) },
    body: JSON.stringify({
      from: mailFrom.value(), to: [to], subject, text, html, ...(replyTo ? { reply_to: replyTo } : {}),
      ...(attachments.length ? { attachments: attachments.map((a) => ({ filename: a.filename, content: a.content.toString('base64') })) } : {}),
    }),
  });
  if (!r.ok) throw new Error(`Resend ${r.status}: ${(await r.text()).slice(0, 300)}`);
  await sleep(550); // Resend's default limit is 2 requests/second
  return (await r.json()).id;
}

// values: strings for {{1}}, {{2}}... ; file: optional { filename, contentType, content } sent as a document header.
async function sendWhatsApp(to, template, values, file) {
  const base = `https://graph.facebook.com/${apiVersion.value()}/${waPhone.value()}`;
  const headers = { Authorization: `Bearer ${waToken.value()}` };
  const clean = (v) => String(v ?? '').replace(/[\r\n\t]+/g, ' ').replace(/ {4,}/g, '   ').trim().slice(0, 1000) || '-';
  let components = [{ type: 'body', parameters: values.map((text) => ({ type: 'text', text: clean(text) })) }];
  if (file && file.content.length <= 95 * 1024 * 1024) {
    const form = new FormData();
    form.append('messaging_product', 'whatsapp'); form.append('type', file.contentType);
    form.append('file', new Blob([file.content], { type: file.contentType }), file.filename);
    const up = await fetch(`${base}/media`, { method: 'POST', headers, body: form });
    if (!up.ok) throw new Error(`WhatsApp media upload ${up.status}: ${(await up.text()).slice(0, 300)}`);
    const { id } = await up.json();
    components = [{ type: 'header', parameters: [{ type: 'document', document: { id, filename: file.filename } }] }, ...components];
  }
  const r = await fetch(`${base}/messages`, {
    method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'template', template: { name: template, language: { code: 'en' }, components } }),
  });
  if (!r.ok) throw new Error(`WhatsApp send ${r.status}: ${(await r.text()).slice(0, 300)}`);
}

/**
 * Send one notification to a patient over email and/or WhatsApp and record it in commLogs/{key}.
 *   email: { subject, text, html, attachments }   wa: { template, values, file }
 *   channels: 'both' | 'email' | 'whatsapp'
 * Channels that previously succeeded under the same key are skipped, so Cloud Function retries are safe.
 * Returns { emailStatus, whatsappStatus, failed, error }.
 */
async function notify({ key, label, patient, email, wa, channels = 'both', replyTo }) {
  const log = getFirestore().collection('commLogs').doc(key);
  const prior = await log.get();
  if (prior.exists && prior.data().done) return { ...prior.data(), failed: false };
  const was = prior.exists ? prior.data() : {};
  const out = { docLabel: label, patientName: patient.name || '', emailStatus: was.emailStatus === 'sent' ? 'sent' : 'skipped', whatsappStatus: was.whatsappStatus === 'sent' ? 'sent' : 'skipped' };
  const errors = [];
  const to = String(patient.email || '').trim();
  const num = waNumber(patient.phone);
  if (email && to && channels !== 'whatsapp' && out.emailStatus !== 'sent') {
    try { await sendEmail({ ...email, to, replyTo, idempotencyKey: `${key}-email` }); out.emailStatus = 'sent'; }
    catch (e) { out.emailStatus = 'failed'; errors.push(`email: ${e.message}`); }
  }
  if (wa && num && channels !== 'email' && out.whatsappStatus !== 'sent') {
    try { await sendWhatsApp(num, wa.template, wa.values, wa.file); out.whatsappStatus = 'sent'; }
    catch (e) { out.whatsappStatus = 'failed'; errors.push(`whatsapp: ${e.message}`); }
  }
  const failed = out.emailStatus === 'failed' || out.whatsappStatus === 'failed';
  out.error = errors.join(' | ').slice(0, 900);
  await log.set({ ...out, done: !failed, attempts: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return { ...out, failed };
}

module.exports = { SECRETS, REGION, esc, sleep, getSettings, waNumber, apptStart, clinicDate, emailHtml, sendEmail, sendWhatsApp, notify };
