// Solar icon names used across the shell and modules (Omnia uses the same icon set).
export const NAV_ICONS = {
  dashboard: 'solar:home-2-linear', chart: 'solar:user-id-linear', appointments: 'solar:calendar-linear', patients: 'solar:users-group-rounded-linear',
  doctors: 'solar:stethoscope-linear', analytics: 'solar:chart-2-linear', timeline: 'solar:history-linear', users: 'solar:shield-user-linear',
  queue: 'solar:list-check-linear', consultations: 'solar:clipboard-text-linear', prescriptions: 'solar:pills-linear', labOrders: 'solar:test-tube-linear',
  labResults: 'solar:document-medicine-linear', radiology: 'solar:scanner-linear', documents: 'solar:folder-with-files-linear', messages: 'solar:chat-round-dots-linear',
  schedules: 'solar:clock-circle-linear', followUps: 'solar:restart-linear', vitals: 'solar:heart-pulse-linear', invoices: 'solar:bill-list-linear',
  payments: 'solar:wallet-money-linear', nutritionAssessments: 'solar:clipboard-heart-linear', nutritionPlans: 'solar:notebook-linear', mealLogs: 'solar:cup-hot-linear',
  yogaPrograms: 'solar:meditation-round-linear', yogaSessions: 'solar:calendar-mark-linear', practiceLogs: 'solar:pen-new-square-linear',
  naturopathyAssessments: 'solar:leaf-linear', naturopathyPlans: 'solar:notebook-bookmark-linear', therapySessions: 'solar:waterdrops-linear',
  settings: 'solar:settings-linear', auditLogs: 'solar:shield-check-linear', commLogs: 'solar:letter-linear', telemedicine: 'solar:videocamera-record-linear',
  announcements: 'solar:bell-bing-linear', admissions: 'solar:bed-linear', inventory: 'solar:box-linear', pharmacy: 'solar:medical-kit-linear',
  staff: 'solar:users-group-two-rounded-linear', expenses: 'solar:card-linear', services: 'solar:tag-price-linear', default: 'solar:document-text-linear',
};
export const UI_ICONS = ['solar:magnifer-linear', 'solar:bell-linear', 'solar:sun-linear', 'solar:moon-linear', 'solar:monitor-linear', 'solar:logout-2-linear', 'solar:user-linear',
  'solar:alt-arrow-down-linear', 'solar:sidebar-minimalistic-linear', 'solar:hamburger-menu-linear', 'solar:close-circle-linear', 'solar:letter-linear', 'solar:lock-password-linear',
  'solar:eye-linear', 'solar:eye-closed-linear', 'solar:danger-circle-linear', 'solar:shield-warning-bold', 'solar:refresh-bold', 'solar:phone-linear', 'solar:printer-linear',
  'solar:file-text-linear', 'solar:check-circle-linear', 'solar:arrow-right-linear', 'solar:download-minimalistic-linear'];
export const ICON_NAMES = [...new Set([...Object.values(NAV_ICONS), ...UI_ICONS])];
