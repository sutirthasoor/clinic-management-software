// Automatic WhatsApp + email delivery for every patient document.
// Files are base64 inside Firestore documents (never Firebase Storage); they are decoded here and sent as attachments.
// Records without an uploaded file (prescription, invoice, plan...) are rendered to a PDF and sent the same way.
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { defineSecret, defineString } = require('firebase-functions/params');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const nodemailer = require('nodemailer');
const PDFDocument = require('pdfkit');

const waToken = defineSecret('WHATSAPP_ACCESS_TOKEN');
const waPhone = defineSecret('WHATSAPP_PHONE_NUMBER_ID');
const smtpUser = defineSecret('SMTP_USER');
const smtpPass = defineSecret('SMTP_PASS');
const smtpHost = defineString('SMTP_HOST', { default: 'smtp.gmail.com' });
const smtpPort = defineString('SMTP_PORT', { default: '465' });
const mailFrom = defineString('MAIL_FROM', { default: '' });
const apiVersion = defineString('WHATSAPP_GRAPH_API_VERSION', { default: 'v27.0' });

// collection -> label shown to the patient
const DOCS = {
  prescriptions: 'Prescription', consultations: 'Consultation summary', labResults: 'Lab result', radiology: 'Radiology report',
  referrals: 'Referral letter', documents: 'Medical document', invoices: 'Invoice', payments: 'Payment receipt', creditNotes: 'Credit note',
  insuranceClaims: 'Insurance claim', nutritionPlans: 'Nutrition plan', yogaPrograms: 'Yoga program', naturopathyPlans: 'Naturopathy plan',
};
const SKIP_KEYS = new Set(['patientId', 'doctorId', 'createdBy', 'createdAt', 'updatedAt', 'updatedBy']);
const isFile = (v) => v && typeof v === 'object' && typeof v.dataUrl === 'string' && v.dataUrl.startsWith('data:');

function decode(v) {
  const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(v.dataUrl);
  return { filename: v.name || 'document', contentType: v.type || m?.[1] || 'application/octet-stream', content: Buffer.from(m?.[3] || '', 'base64') };
}

function renderPdf(title, clinic, patientName, data) {
  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument({ margin: 48 }); const chunks = [];
    pdf.on('data', (c) => chunks.push(c)); pdf.on('end', () => resolve(Buffer.concat(chunks))); pdf.on('error', reject);
    pdf.fontSize(20).fillColor('#1e3a5f').text(clinic.clinicName || 'Clinic');
    pdf.fontSize(9).fillColor('#667085').text([clinic.address, clinic.phone, clinic.email].filter(Boolean).join('  ·  ')).moveDown();
    pdf.fontSize(15).fillColor('#1f2937').text(title).fontSize(10).fillColor('#667085').text(`Patient: ${patientName}`).moveDown(0.6);
    for (const [k, v] of Object.entries(data)) {
      if (SKIP_KEYS.has(k) || k.endsWith('Name') || v === '' || v == null || isFile(v)) continue;
      const val = v && typeof v.toDate === 'function' ? v.toDate().toLocaleString('en-IN') : typeof v === 'object' ? JSON.stringify(v) : String(v);
      pdf.fontSize(9).fillColor('#667085').text(k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()));
      pdf.fontSize(11).fillColor('#1f2937').text(val).moveDown(0.4);
    }
    pdf.moveDown().fontSize(8).fillColor('#98a2b3').text(`Generated ${new Date().toLocaleString('en-IN')}. Computer-generated document.`);
    pdf.end();
  });
}

async function sendEmail(to, subject, text, files, clinic) {
  const t = nodemailer.createTransport({ host: smtpHost.value(), port: Number(smtpPort.value()), secure: Number(smtpPort.value()) === 465, auth: { user: smtpUser.value(), pass: smtpPass.value() } });
  await t.sendMail({ from: mailFrom.value() || smtpUser.value(), to, subject, text, attachments: files });
}

async function sendWhatsApp(phone, name, label, clinicName, file) {
  const base = `https://graph.facebook.com/${apiVersion.value()}/${waPhone.value()}`;
  const headers = { Authorization: `Bearer ${waToken.value()}` };
  let components = [{ type: 'body', parameters: [name, label, clinicName].map((text) => ({ type: 'text', text: String(text) })) }];
  let template = 'clinic_document_notice';
  if (file && file.content.length <= 95 * 1024 * 1024) {
    const form = new FormData();
    form.append('messaging_product', 'whatsapp'); form.append('type', file.contentType);
    form.append('file', new Blob([file.content], { type: file.contentType }), file.filename);
    const up = await fetch(`${base}/media`, { method: 'POST', headers, body: form });
    if (!up.ok) throw new Error(`WhatsApp media upload ${up.status}: ${await up.text()}`);
    const { id } = await up.json();
    template = 'clinic_document_ready';
    components = [{ type: 'header', parameters: [{ type: 'document', document: { id, filename: file.filename } }] }, ...components];
  }
  const r = await fetch(`${base}/messages`, {
    method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to: phone, type: 'template', template: { name: template, language: { code: 'en' }, components } }),
  });
  if (!r.ok) throw new Error(`WhatsApp send ${r.status}: ${await r.text()}`);
}

// Approve these WhatsApp templates first:
//  clinic_document_notice (body): "Hi {{1}}, your {{2}} from {{3}} is ready. Please sign in to your patient portal to view it."
//  clinic_document_ready  (header: DOCUMENT, body): "Hi {{1}}, your {{2}} from {{3}} is attached."
async function deliver(col, id, doc) {
  const db = getFirestore();
  const log = db.collection('commLogs').doc(`${col}_${id}`);
  const prior = await log.get();
  if (prior.exists && prior.data().done) return;
  const settings = (await db.collection('settings').limit(1).get()).docs[0]?.data() || {};
  if (settings.autoSendDocuments === false || !doc.patientId || doc.createdBy === doc.patientId) return;
  const p = (await db.collection('users').doc(doc.patientId).get()).data();
  if (!p) return;
  const label = DOCS[col]; const clinicName = settings.clinicName || 'your clinic';
  const title = doc.title || label;
  const uploaded = Object.values(doc).filter(isFile).map(decode);
  const files = uploaded.length ? uploaded : [{ filename: `${label.replace(/\s+/g, '-')}.pdf`, contentType: 'application/pdf', content: await renderPdf(title, settings, p.name || 'Patient', doc) }];
  const was = prior.exists ? prior.data() : {};
  const out = { docLabel: label, patientName: p.name || '', collection: col, docId: id, emailStatus: was.emailStatus === 'sent' ? 'sent' : 'skipped', whatsappStatus: was.whatsappStatus === 'sent' ? 'sent' : 'skipped', error: '' };
  const errors = [];
  const email = String(p.email || '').trim();
  const digits = String(p.phone || '').replace(/\D/g, '');
  if (email && smtpUser.value() && out.emailStatus !== 'sent') {
    try { await sendEmail(email, `${label} from ${clinicName}`, `Hello ${p.name || ''},\n\nYour ${label.toLowerCase()} from ${clinicName} is attached. You can also view it in your patient portal.\n\n${clinicName}`, files, settings); out.emailStatus = 'sent'; }
    catch (e) { out.emailStatus = 'failed'; errors.push(`email: ${e.message}`); }
  }
  if (digits && out.whatsappStatus !== 'sent') {
    try { await sendWhatsApp(digits, p.name || 'there', label, clinicName, files[0]); out.whatsappStatus = 'sent'; }
    catch (e) { out.whatsappStatus = 'failed'; errors.push(`whatsapp: ${e.message}`); }
  }
  out.error = errors.join(' | ').slice(0, 900);
  const failed = out.emailStatus === 'failed' || out.whatsappStatus === 'failed';
  await log.set({ ...out, done: !failed, attempts: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  if (failed) throw new Error(out.error); // retry: true re-runs; a channel already marked sent is not resent
}

for (const col of Object.keys(DOCS)) {
  exports[`autoSend_${col}`] = onDocumentCreated({
    document: `${col}/{id}`, region: 'asia-south1', retry: true, memory: '512MiB', timeoutSeconds: 120,
    secrets: [waToken, waPhone, smtpUser, smtpPass],
  }, (event) => deliver(col, event.params.id, event.data.data()));
}
