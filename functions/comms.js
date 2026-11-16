// Automatic WhatsApp + email (Resend) delivery for every patient document.
// Files are base64 inside Firestore documents (never Firebase Storage); they are decoded here and sent as attachments.
// Records without an uploaded file (prescription, invoice, plan...) are rendered to a PDF and sent the same way.
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { getFirestore } = require('firebase-admin/firestore');
const PDFDocument = require('pdfkit');
const { SECRETS, REGION, getSettings, emailHtml, notify } = require('./notify');

// collection -> label shown to the patient
const DOCS = {
  prescriptions: 'Prescription', consultations: 'Consultation summary', labResults: 'Lab result', radiology: 'Radiology report',
  referrals: 'Referral letter', documents: 'Medical document', invoices: 'Invoice', payments: 'Payment receipt', creditNotes: 'Credit note',
  insuranceClaims: 'Insurance claim',
  // wellness care
  nutritionPlans: 'Nutrition plan', supplementPlans: 'Supplement plan', nutritionLabs: 'Lab marker summary',
  yogaPrograms: 'Yoga program', mindfulnessPlans: 'Pranayama and meditation plan',
  naturopathyPlans: 'Naturopathy plan', detoxPrograms: 'Detox program', herbalPrescriptions: 'Herbal and remedy prescription',
  sessionPackages: 'Package confirmation',
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

// Approve these WhatsApp templates first:
//  clinic_document_notice (body): "Hi {{1}}, your {{2}} from {{3}} is ready. Please sign in to your patient portal to view it."
//  clinic_document_ready  (header: DOCUMENT, body): "Hi {{1}}, your {{2}} from {{3}} is attached."
async function deliver(col, id, doc) {
  const db = getFirestore();
  const settings = await getSettings();
  if (settings.autoSendDocuments === false || !doc.patientId || doc.createdBy === doc.patientId) return;
  const p = (await db.collection('users').doc(doc.patientId).get()).data();
  if (!p) return;
  const label = DOCS[col]; const clinicName = settings.clinicName || 'your clinic';
  const title = doc.title || label;
  const uploaded = Object.values(doc).filter(isFile).map(decode);
  const files = uploaded.length ? uploaded : [{ filename: `${label.replace(/\s+/g, '-')}.pdf`, contentType: 'application/pdf', content: await renderPdf(title, settings, p.name || 'Patient', doc) }];
  const first = files[0];
  const res = await notify({
    key: `${col}_${id}`, label, patient: p, replyTo: settings.email || undefined,
    email: {
      subject: `${label} from ${clinicName}`,
      text: `Hello ${p.name || ''},\n\nYour ${label.toLowerCase()} from ${clinicName} is attached. You can also view it in your patient portal.\n\n${clinicName}`,
      html: emailHtml(settings, `Your ${label.toLowerCase()} is ready`, [`Hello ${p.name || ''},`, `Your ${label.toLowerCase()} from ${clinicName} is attached to this email. You can also view it any time in your patient portal.`], settings.website ? { label: 'Open patient portal', url: settings.website } : null),
      attachments: files,
    },
    wa: first && first.content.length <= 95 * 1024 * 1024
      ? { template: 'clinic_document_ready', values: [p.name || 'there', label, clinicName], file: first }
      : { template: 'clinic_document_notice', values: [p.name || 'there', label, clinicName] },
  });
  await getFirestore().collection('commLogs').doc(`${col}_${id}`).set({ collection: col, docId: id }, { merge: true });
  if (res.failed) throw new Error(res.error); // retry: true re-runs; a channel already marked sent is not resent
}

for (const col of Object.keys(DOCS)) {
  exports[`autoSend_${col}`] = onDocumentCreated({
    document: `${col}/{id}`, region: REGION, retry: true, memory: '512MiB', timeoutSeconds: 120, secrets: SECRETS,
  }, (event) => deliver(col, event.params.id, event.data.data()));
}
