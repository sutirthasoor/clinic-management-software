# ClinicCare: Clinic Management System

Web app (React + Vite + Firebase) and mobile app (React Native + Expo + Firebase) with **Admin**, **Doctor**, **Nutritionist**, **Yoga teacher**, **Naturopath** and **Patient** logins.

```
shared/modules.js      single source of truth: every module, field, and per-role access (r/c/u/d)
scripts/gen-rules.mjs  generates firestore.rules from the registry
web/                   React web app
mobile/                React Native (Expo) app
MODULES.md             full module catalogue per role, marked Built / Planned
```

## How it works
Each module is declared once in `shared/modules.js`. Both apps render its list, search, form and permissions from that file, and `firestore.rules` is generated from it, so UI and security cannot drift apart. To add a module, add an entry, then run `npm run sync` at the repo root.

## Setup
1. **Firebase console** (project `blog-app-55355`): enable **Authentication → Email/Password** and create **Firestore**. New app documents are stored in Firestore; Cloud Storage writes are disabled.
2. **Deploy rules**: `npm i -g firebase-tools`, `firebase login`, `firebase use blog-app-55355`, then `npm run deploy:rules`.
3. **First admin**: register in the app (creates a patient), then in Firestore open `users/<uid>` and change `role` to `admin`. From then on the admin creates staff and patients in **Users & Roles** (web), and assigns each patient to their primary provider. Provider dashboards and patient lists are scoped to that assignment; clinical records are owned by their provider id.
4. **Web**: `cd web && npm install && npm run dev`. Deploy with `npm run deploy:web` from the root.
5. **Mobile**: `cd mobile && npm install && npx expo install --fix`, then `npx expo start`. (`--fix` aligns Expo package versions to your SDK.)

Firebase web config lives in `web/.env` and `mobile/.env` (copied from your snippet). Web API keys are not secrets, since access is enforced by the rules, but restrict the key by HTTP referrer in Google Cloud and enable App Check before going live.

## Files and messaging
- Web and mobile attachments are saved in Firestore as data URLs with base64 content. To stay within Firestore's 1 MiB document limit, uploads are capped at 650 KB. Cloud Storage writes are disabled; existing legacy Storage objects remain read-only.
- Patient rows offer WhatsApp (opens a chat with a prefilled message) and Email (opens the user's mail app with a prefilled subject).
- Automatic WhatsApp booking messages use the Cloud Function in `functions/`. Before deployment, create and approve the `clinic_booking_received` and `clinic_session_confirmed` WhatsApp templates, set `WHATSAPP_ACCESS_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID` with `firebase functions:secrets:set`, and set `WHATSAPP_GRAPH_API_VERSION` if needed. Enter patient phone numbers with country code. Deploy with `firebase deploy --only functions:sendBookingWhatsApp`.
- The booking received template is sent when a patient books; the session confirmed template is sent when staff changes the appointment to Confirmed. Email remains a one-click mail-app handoff and does not send in the background.

## Known limits of this first cut (please read)
- **Not installed, built or run.** This session had no network access, so dependencies were not installed. The module registry and generated rules were checked with Node; the React and React Native code has not been compiled. Expect small fixes on first run.
- **Field-level rules:** rules enforce who can read or write a *record* (own records, own role). Restrictions on individual fields (for example only admins setting leave status) are enforced in the UI only. Harden with Cloud Functions or field checks in rules before production.
- Provider access is scoped to each patient's assigned primary provider. Existing clinical records that do not have a `doctorId` owner need migration before providers can read them under the stricter rules.
- **Roles are looked up from `users/{uid}`** in the rules (one extra read per request). Moving to Firebase custom claims via a Cloud Function is the production upgrade.
- Mobile date/time inputs are plain text (`YYYY-MM-DD`); file upload is web-only (mobile accepts a URL). Admin user creation is web-only.
- Push reminders, payments and video calls are still not implemented; see **Planned** items in `MODULES.md`.
- Handles sensitive health data: complete a privacy and compliance review (India DPDP Act, and HIPAA if applicable) before real patient use.

## Upgrade notes (enterprise phase 1)
1. `npm install` in `web/` and `mobile/` (mobile adds expo-print, expo-sharing, expo-local-authentication, expo-notifications, expo-document-picker, expo-constants; run `npx expo install` in `mobile/` to pin SDK-compatible versions).
2. `npm run deploy:rules` to publish the regenerated Firestore + Storage rules (required: new collections and stricter field guards).
3. Rotate / restrict the Firebase web API key (HTTP referrer + app restrictions) and enable App Check; `.env` files were included in the original zip and must not be shared.
4. Messaging, queue, consents, data requests and credit notes are new collections; no migration needed.
