# Clinic Management System: Module Catalogue

Legend: **[Built]** = working in this codebase (web + mobile, driven by `shared/modules.js`) · **[Planned]** = not built yet; needs Cloud Functions, third-party integrations or a dedicated UI.

Every [Built] module gives the role list, search, create, edit and delete according to its access rules (`r/c/u/d`), live updates, audit logging, and rules generated from the same registry. Web adds file upload and CSV export.

---

## 1. Admin

### Identity, access and security
- Users & Roles: create doctor/admin/patient accounts, change role, activate/deactivate **[Built, web]**
- Patients directory (view/edit profile, deactivate) **[Built]**
- Doctors directory (view/edit profile, deactivate) **[Built]**
- Audit logs (who did what, where) **[Built]**
- Granular permission matrix / custom roles (receptionist, nurse, pharmacist, lab tech, accountant) **[Planned]**
- Two-factor authentication, session/device management, IP allow-list **[Planned]**
- Data export/erase requests, consent registry (DPDP / HIPAA-style) **[Planned]**

### Front desk and scheduling
- Appointments (all doctors, status workflow) **[Built]**
- Doctor schedules / availability **[Built]**
- Doctor leave approvals **[Built]**
- Walk-in registration, queue / token display, check-in kiosk **[Planned]**
- Waitlist and automatic slot allocation, recurring appointments **[Planned]**

### Clinical oversight
- Consultations (EMR), prescriptions, vitals, immunizations, allergies, medical history, procedures, referrals, follow-ups (read) **[Built]**
- Admissions / IPD **[Built]**; bed transfers, discharge summary PDF, OT scheduling **[Planned]**
- Lab orders and results **[Built]**; sample tracking with barcodes, analyser integration (HL7) **[Planned]**
- Radiology orders and reports **[Built]**; DICOM/PACS viewer **[Planned]**
- Telemedicine sessions **[Built]**; embedded video call (WebRTC/Agora/Jitsi) **[Planned]**
- Medical documents repository **[Built]**

### Billing and finance
- Invoices, payments, insurance claims **[Built]**
- Services & price list **[Built]**
- Expenses **[Built]**
- Auto-generated invoice PDF, GST invoices, receipts, refunds, credit notes **[Planned]**
- Online payments (Razorpay/Stripe), payment links, packages and memberships **[Planned]**
- TPA / cashless pre-authorisation workflow, revenue and P&L reports **[Planned]**

### Operations
- Staff directory, shift roster, attendance **[Built]**
- Departments, branches, rooms & beds **[Built]**
- Inventory, pharmacy stock, suppliers, purchase orders **[Built]**
- Equipment & assets (service dates, warranty) **[Built]**
- Payroll, recruitment, training and credential expiry tracking **[Planned]**
- Biomedical waste log, housekeeping, ambulance, visitor management **[Planned]**
- Low-stock and expiry alerts (scheduled Cloud Function) **[Planned]**

### Communication and settings
- Announcements **[Built]**
- Support tickets (patient requests, admin resolves) **[Built]**
- Patient feedback and ratings **[Built]**
- Clinic settings (name, hours, tax id, logo, slot length) **[Built]**
- SMS / WhatsApp / email reminders, campaigns, push notifications (FCM) **[Planned]**
- Templates (consent forms, letters, invoices), multi-language, multi-clinic tenancy **[Planned]**

### Analytics
- Dashboard counts and upcoming appointments **[Built]**
- Revenue, footfall, no-show rate, doctor utilisation, inventory valuation, retention, scheduled report export **[Planned]**

---

## 2. Doctor

- Dashboard (appointment, consultation, prescription, patient counts; upcoming appointments) **[Built]**
- My appointments, update status **[Built]**
- Patients directory (read) **[Built]**
- Consultations / EMR notes with ICD-10 field **[Built]**
- Prescriptions **[Built]**; prescription PDF with letterhead and e-signature, drug-interaction checks **[Planned]**
- Prescription templates **[Built]**
- Vitals entry, allergies, medical history, immunizations **[Built]**
- Lab orders, lab results, radiology orders and reports **[Built]**
- Procedures, referrals, follow-ups, admissions, telemedicine sessions **[Built]**
- Medical documents (upload and view) **[Built]**
- My schedule / availability **[Built]**
- Leave requests **[Built]**
- Services & price list, departments, rooms, inventory, pharmacy stock, equipment, announcements, clinic settings (read) **[Built]**
- My profile (specialization, qualification, fee, licence, bio) **[Built]**
- Patient timeline view, growth charts, clinical decision support, voice dictation / AI note drafting **[Planned]**
- Secure chat with patients, case discussions between doctors **[Planned]**
- Earnings / commission statements, CME tracker **[Planned]**

---

## 3. Patient

- Dashboard (counts, upcoming appointments) **[Built]**
- Book / reschedule / cancel appointments (requests start as "Requested") **[Built]**
- Browse doctors, their specialization and schedules **[Built]**
- My consultations, prescriptions, lab results, radiology reports, procedures, referrals, follow-ups, admissions **[Built]**
- Vitals self-logging (BP, pulse, SpO2, weight, glucose) **[Built]**
- Allergies and medical history (self-reported) **[Built]**
- Immunization record **[Built]**
- Medical documents (upload, view, delete own) **[Built]**
- Family members / dependents **[Built]**
- Insurance policies **[Built]**
- Invoices, payments, claims (read) **[Built]**
- Telemedicine sessions (join link) **[Built]**
- Announcements, departments, services & prices, clinic info **[Built]**
- Feedback and ratings, support tickets **[Built]**
- My profile (blood group, emergency contact, known allergies) **[Built]**
- Online payment of invoices, downloadable invoices / prescriptions / reports as PDF **[Planned]**
- Push / SMS / WhatsApp reminders (appointments, medicines, follow-ups) **[Planned]**
- Medicine reminders, symptom checker, health charts and trends, wearable sync **[Planned]**
- Secure messaging with the clinic or doctor, in-app video consult **[Planned]**
- Switch between family member profiles when booking **[Planned]**
- Pharmacy ordering and home sample collection **[Planned]**
- Biometric app lock, consent management, data download **[Planned]**


---

## Enterprise upgrade, phase 1 (this release)

Applies to web AND mobile unless noted. Everything is driven from `shared/modules.js`; run `npm run sync` after editing it.

**Platform / engine**
- Validation: required, number min/max (vitals ranges, rating 1-5), BP / time / date / phone / email formats, date-range checks (leave, admission, schedule, reminders)
- Workflow-controlled statuses (appointment: Requested > Confirmed > Checked-in > In consultation > Completed; admin can override)
- Auto-calculated invoice total; coloured status pills; status filter chips
- Web: sortable columns, pagination, detail view, loading skeletons, toasts, dark mode, responsive nav, 15-min idle sign-out, error boundary, lazy-loaded pages, CSV export (non-patients, audit-logged)
- Printable / PDF documents for invoices, payments, credit notes, prescriptions, lab results, imaging, consultations, admissions, referrals (web: print dialog; mobile: share as PDF). Print, export and timeline views are audit-logged
- Mobile: biometric / passcode app lock (60 s in background), pull-to-refresh dashboard, file upload (image/PDF) from device, push token registration, daily local medicine reminders
- Security rules: fields restricted by `roles` (ticket / leave / request status) can no longer be set or changed by other roles through crafted requests; upload type limited to images and PDF; messages are private to patient + their doctor (+ admin)

**Admin:** role dashboard (today's appointments, patients, revenue, unpaid invoices, 6-month revenue chart, appointment status chart, alerts for low stock / expiring stock / equipment service / open tickets / pending leave), Analytics page (no-show rate, collection rate, rating, revenue 12 months, payment modes, doctor load), Walk-in Queue **[Built]**, Credit Notes & Refunds **[Built]**, Secure Messages oversight **[Built]**, Data Requests (export / erase / correct) **[Built]**, Consent registry (read) **[Built]**, Patient Timeline **[Built]**

**Doctor:** dashboard with today's schedule and one-tap status advance, waiting queue, follow-ups due, abnormal lab results; Patient Timeline (all history in one view, web + mobile) **[Built]**; Walk-in Queue (update own) **[Built]**; Secure Messages with patients **[Built]**; printable prescriptions with signature block **[Built]**

**Patient:** dashboard (next appointment, amount due, active reminders, vaccine / follow-up due list); Medicine Reminders with device notifications **[Built, mobile notifications]**; Consents & Privacy **[Built]**; Data Requests **[Built]**; Secure Messages with doctor **[Built]**; printable invoices / prescriptions / reports **[Built]**

## Phase 2 backlog (needs Cloud Functions or third-party accounts)
- Server-side booking (transactional slot locking, waitlist, recurring appointments); today patients cannot see other patients' slots, so double-booking can only be prevented server-side
- Scheduled functions: SMS / WhatsApp / email / FCM reminders using `users.pushToken`, low-stock and expiry alerts, nightly BigQuery export
- Online payments (Razorpay / Stripe), GST invoice numbering, server-generated PDFs
- Custom roles / permission matrix (receptionist, nurse, pharmacist, lab tech), 2FA / MFA, App Check, IP allow-list
- Chat-style thread UI for messages, WebRTC video for telemedicine, drug-interaction checks, DICOM viewer, HL7 lab integration
- Native date / time pickers on mobile (currently typed with a "Use today" shortcut)
