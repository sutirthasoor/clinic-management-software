// SINGLE SOURCE OF TRUTH for every module in the clinic system.
// Used by: web app, mobile app, and scripts/gen-rules.mjs (which generates firestore.rules).
// After editing, run `npm run sync` at the repo root to copy this file into web/ and mobile/ and regenerate rules.
//
// access strings per role: r = read, c = create, u = update, d = delete.

export const PROVIDER_ROLES = ['doctor', 'nutritionist', 'yogaTeacher', 'naturopath'];
export const ROLES = ['admin', ...PROVIDER_ROLES, 'patient'];

const mk = (type) => (name, label, extra = {}) => ({ name, label, type, ...extra });
const text = mk('text'), area = mk('textarea'), num = mk('number'), date = mk('date'),
  time = mk('time'), dtime = mk('datetime'), file = mk('file'), check = mk('checkbox');
const sel = (name, label, options, extra = {}) => ({ name, label, type: 'select', options, ...extra });

// selfFor: when the signed-in user has this role, the field is auto-filled with their own uid and hidden.
const P = { name: 'patientId', label: 'Patient', type: 'user', userRole: 'patient', required: true, selfFor: 'patient' };
const D = { name: 'doctorId', label: 'Care provider', type: 'user', userRole: 'doctor', required: true, selfFor: 'doctor' };
const DOPT = { name: 'doctorId', label: 'Care provider', type: 'user', userRole: 'doctor' };

const BLOOD = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const PROFILE_FIELDS = {
  common: [
    text('name', 'Full name', { required: true }), text('phone', 'Phone'), date('dob', 'Date of birth'),
    sel('gender', 'Gender', ['Female', 'Male', 'Other']), area('address', 'Address'),
  ],
  doctor: [
    text('specialization', 'Specialization'), text('qualification', 'Qualification'),
    num('experienceYears', 'Experience (years)'), num('consultationFee', 'Consultation fee'),
    text('licenseNo', 'Medical licence no.'), area('bio', 'About'),
  ],
  nutritionist: [
    text('specialization', 'Nutrition specialty'), text('qualification', 'Nutrition qualification'),
    num('experienceYears', 'Experience (years)'), num('consultationFee', 'Consultation fee'),
    text('nutritionFocus', 'Practice focus'), area('bio', 'About'),
  ],
  yogaTeacher: [
    text('qualification', 'Yoga teacher training'), text('practiceStyles', 'Practice styles'),
    num('experienceYears', 'Teaching experience (years)'), num('consultationFee', 'Session fee'), area('bio', 'About'),
  ],
  naturopath: [
    text('qualification', 'Naturopathic qualification'), text('practiceFocus', 'Practice focus'),
    num('experienceYears', 'Experience (years)'), num('consultationFee', 'Consultation fee'),
    text('registrationNo', 'Professional registration'), area('bio', 'About'),
  ],
  patient: [
    sel('bloodGroup', 'Blood group', BLOOD), text('emergencyContactName', 'Emergency contact name'),
    text('emergencyContactPhone', 'Emergency contact phone'), area('knownAllergies', 'Known allergies'),
    text('insuranceProvider', 'Insurance provider'),
  ],
};

export const isProviderRole = (role) => PROVIDER_ROLES.includes(role);

export const GROUP_ORDER = ['Insights', 'People', 'Clinical', 'Care Tools', 'My Health', 'Billing', 'Operations', 'Communication', 'Administration'];

export const MODULES = [
  // ---------------------------------------------------------------- PEOPLE (read from the users collection)
  { key: 'patients', label: 'Patients', roleLabels: { nutritionist: 'My Clients', yogaTeacher: 'My Clients', naturopath: 'My Clients' }, group: 'People', icon: 'people-outline', source: 'users', where: ['role', '==', 'patient'],
    access: { admin: 'ru', doctor: 'r', nutritionist: 'r', yogaTeacher: 'r', naturopath: 'r' },
    fields: [...PROFILE_FIELDS.common, ...PROFILE_FIELDS.patient, check('active', 'Account active')],
    columns: ['name', 'phone', 'gender', 'bloodGroup'] },
  { key: 'doctors', label: 'Care providers', group: 'People', icon: 'medkit-outline', source: 'users', where: ['role', 'in', PROVIDER_ROLES],
    access: { admin: 'ru', doctor: 'r', patient: 'r' },
    fields: [...PROFILE_FIELDS.common, ...PROFILE_FIELDS.doctor, check('active', 'Account active')],
    columns: ['name', 'specialization', 'qualification', 'consultationFee'] },
  { key: 'users', label: 'Users & Roles', group: 'People', icon: 'key-outline', custom: true, access: { admin: 'rcud' } },

  // ---------------------------------------------------------------- CLINICAL
  { key: 'appointments', label: 'Appointments', roleLabels: { nutritionist: 'Nutrition Sessions', yogaTeacher: 'Yoga Sessions', naturopath: 'Naturopathy Sessions' }, group: 'Clinical', icon: 'calendar-outline', doctorScope: true,
    access: { admin: 'rcud', doctor: 'rcu', nutritionist: 'rcu', yogaTeacher: 'rcu', naturopath: 'rcu', patient: 'rcu' },
    patientCreate: "request.resource.data.status == 'Requested'",
    patientUpdate: "request.resource.data.status in ['Requested', 'Cancelled']",
    fields: [P, D, date('date', 'Date', { required: true }), time('time', 'Time', { required: true }),
      sel('type', 'Type', ['In-person', 'Video', 'Nutrition session', 'Yoga session', 'Naturopathy session', 'Follow-up']), area('reason', 'Reason for visit'),
      sel('status', 'Status', ['Requested', 'Confirmed', 'Checked-in', 'In consultation', 'Completed', 'Cancelled', 'No-show'],
        { default: 'Requested', patientOptions: ['Requested', 'Cancelled'], flowExempt: ['admin'],
          flow: { Requested: ['Confirmed', 'Cancelled'], Confirmed: ['Checked-in', 'Cancelled', 'No-show'], 'Checked-in': ['In consultation', 'Cancelled', 'No-show'],
            'In consultation': ['Completed'], Completed: [], Cancelled: [], 'No-show': [] } })],
    columns: ['patientId', 'doctorId', 'date', 'time', 'status'] },
  { key: 'consultations', label: 'Consultations (EMR)', group: 'Clinical', icon: 'document-text-outline', doctorScope: true,
    access: { admin: 'r', doctor: 'rcu', patient: 'r' },
    fields: [P, D, date('visitDate', 'Visit date', { required: true }), text('chiefComplaint', 'Chief complaint'),
      area('history', 'History of present illness'), area('examination', 'Examination findings'),
      text('diagnosis', 'Diagnosis'), text('icd10', 'ICD-10 code'), area('plan', 'Treatment plan'), date('followUpDate', 'Follow-up date')],
    columns: ['patientId', 'doctorId', 'visitDate', 'diagnosis'] },
  { key: 'prescriptions', label: 'Prescriptions', group: 'Clinical', icon: 'medical-outline', doctorScope: true,
    access: { admin: 'r', doctor: 'rcu', patient: 'r' },
    fields: [P, D, date('date', 'Date', { required: true }), text('diagnosis', 'Diagnosis'),
      area('medicines', 'Medicines (name, dose, frequency, duration)', { required: true }), area('instructions', 'Instructions'),
      date('validUntil', 'Valid until')],
    columns: ['patientId', 'doctorId', 'date', 'diagnosis'] },
  { key: 'vitals', label: 'Vitals', group: 'Clinical', icon: 'heart-outline',
    access: { admin: 'r', doctor: 'rcu', patient: 'rc' },
    fields: [P, dtime('recordedOn', 'Recorded on', { required: true }), text('bp', 'Blood pressure (mmHg)', { pattern: '^\\d{2,3}/\\d{2,3}$', patternMsg: 'Blood pressure must look like 120/80' }), num('pulse', 'Pulse (bpm)', { min: 20, max: 250 }),
      num('temperature', 'Temperature (°C)', { min: 30, max: 45 }), num('spo2', 'SpO2 (%)', { min: 50, max: 100 }), num('weight', 'Weight (kg)', { min: 0.3, max: 500 }), num('height', 'Height (cm)', { min: 20, max: 260 }),
      num('glucose', 'Blood glucose (mg/dL)', { min: 10, max: 1000 }), area('notes', 'Notes')],
    columns: ['patientId', 'recordedOn', 'bp', 'pulse', 'spo2', 'weight'] },
  { key: 'labOrders', label: 'Lab Orders', group: 'Clinical', icon: 'flask-outline', doctorScope: true,
    access: { admin: 'rcud', doctor: 'rcu', patient: 'r' },
    fields: [P, D, date('orderedOn', 'Ordered on', { required: true }), area('tests', 'Tests requested', { required: true }),
      sel('priority', 'Priority', ['Routine', 'Urgent', 'STAT']),
      sel('status', 'Status', ['Ordered', 'Sample collected', 'Processing', 'Completed', 'Cancelled'], { default: 'Ordered' }), area('notes', 'Clinical notes')],
    columns: ['patientId', 'doctorId', 'orderedOn', 'priority', 'status'] },
  { key: 'labResults', label: 'Lab Results', group: 'Clinical', icon: 'analytics-outline', doctorScope: true,
    access: { admin: 'rcud', doctor: 'rcu', patient: 'r' },
    fields: [P, D, text('test', 'Test', { required: true }), text('result', 'Result', { required: true }), text('unit', 'Unit'),
      text('referenceRange', 'Reference range'), date('resultDate', 'Result date'), sel('flag', 'Flag', ['Normal', 'Abnormal', 'Critical']),
      file('report', 'Report file'), area('notes', 'Notes')],
    columns: ['patientId', 'test', 'result', 'unit', 'flag', 'resultDate'] },
  { key: 'radiology', label: 'Radiology & Imaging', group: 'Clinical', icon: 'images-outline', doctorScope: true,
    access: { admin: 'rcud', doctor: 'rcu', patient: 'r' },
    fields: [P, D, sel('modality', 'Modality', ['X-Ray', 'Ultrasound', 'CT', 'MRI', 'ECG', 'Echo', 'Other']), text('bodyPart', 'Body part'),
      date('orderedOn', 'Ordered on'), area('findings', 'Findings'), area('impression', 'Impression'), file('report', 'Report / image')],
    columns: ['patientId', 'modality', 'bodyPart', 'orderedOn'] },
  { key: 'immunizations', label: 'Immunizations', group: 'Clinical', icon: 'shield-checkmark-outline',
    access: { admin: 'r', doctor: 'rcu', patient: 'r' },
    fields: [P, text('vaccine', 'Vaccine', { required: true }), text('doseNo', 'Dose no.'), date('date', 'Date given'),
      date('nextDue', 'Next due'), text('batchNo', 'Batch no.')],
    columns: ['patientId', 'vaccine', 'doseNo', 'date', 'nextDue'] },
  { key: 'allergies', label: 'Allergies', group: 'Clinical', icon: 'alert-circle-outline',
    access: { admin: 'r', doctor: 'rcu', patient: 'rc' },
    fields: [P, text('allergen', 'Allergen', { required: true }), text('reaction', 'Reaction'),
      sel('severity', 'Severity', ['Mild', 'Moderate', 'Severe', 'Life-threatening']), date('notedOn', 'Noted on')],
    columns: ['patientId', 'allergen', 'reaction', 'severity'] },
  { key: 'medicalHistory', label: 'Medical History', group: 'Clinical', icon: 'time-outline',
    access: { admin: 'r', doctor: 'rcu', patient: 'rc' },
    fields: [P, sel('type', 'Type', ['Condition', 'Surgery', 'Family history', 'Current medication', 'Lifestyle']),
      text('title', 'Title', { required: true }), date('since', 'Since'), area('notes', 'Notes')],
    columns: ['patientId', 'type', 'title', 'since'] },
  { key: 'procedures', label: 'Procedures', group: 'Clinical', icon: 'cut-outline', doctorScope: true,
    access: { admin: 'r', doctor: 'rcu', patient: 'r' },
    fields: [P, D, text('procedure', 'Procedure', { required: true }), date('date', 'Date'), text('anaesthesia', 'Anaesthesia'),
      text('outcome', 'Outcome'), num('charges', 'Charges'), area('notes', 'Notes')],
    columns: ['patientId', 'procedure', 'date', 'outcome'] },
  { key: 'referrals', label: 'Referrals', group: 'Clinical', icon: 'swap-horizontal-outline', doctorScope: true,
    access: { admin: 'r', doctor: 'rcu', patient: 'r' },
    fields: [P, D, text('referredTo', 'Referred to (specialist / hospital)', { required: true }), text('specialty', 'Specialty'),
      sel('urgency', 'Urgency', ['Routine', 'Urgent', 'Emergency']), area('reason', 'Reason'),
      sel('status', 'Status', ['Issued', 'Accepted', 'Completed', 'Cancelled'], { default: 'Issued' })],
    columns: ['patientId', 'referredTo', 'urgency', 'status'] },
  { key: 'admissions', label: 'Admissions (IPD)', group: 'Clinical', icon: 'bed-outline', ranges: [['admitDate', 'dischargeDate']], doctorScope: true,
    access: { admin: 'rcud', doctor: 'rcu', patient: 'r' },
    fields: [P, D, text('ward', 'Ward / room'), text('bed', 'Bed'), date('admitDate', 'Admit date', { required: true }),
      date('dischargeDate', 'Discharge date'), text('diagnosis', 'Diagnosis'),
      sel('status', 'Status', ['Admitted', 'Discharged', 'Transferred'], { default: 'Admitted' })],
    columns: ['patientId', 'doctorId', 'ward', 'admitDate', 'status'] },
  { key: 'telemedicine', label: 'Telemedicine', group: 'Clinical', icon: 'videocam-outline', doctorScope: true,
    access: { admin: 'rcud', doctor: 'rcu', patient: 'r' },
    fields: [P, D, dtime('scheduledAt', 'Scheduled at', { required: true }), text('meetingLink', 'Meeting link'),
      sel('status', 'Status', ['Scheduled', 'Live', 'Completed', 'Missed', 'Cancelled'], { default: 'Scheduled' }), area('notes', 'Notes')],
    columns: ['patientId', 'doctorId', 'scheduledAt', 'status'] },
  { key: 'followUps', label: 'Follow-ups', group: 'Clinical', icon: 'repeat-outline', doctorScope: true,
    access: { admin: 'r', doctor: 'rcu', patient: 'r' },
    fields: [P, D, date('dueDate', 'Due date', { required: true }), text('reason', 'Reason'),
      sel('status', 'Status', ['Pending', 'Done', 'Missed'], { default: 'Pending' })],
    columns: ['patientId', 'doctorId', 'dueDate', 'status'] },
  { key: 'documents', label: 'Medical Documents', group: 'Clinical', icon: 'folder-outline',
    access: { admin: 'rcud', doctor: 'rc', patient: 'rcud' },
    fields: [P, text('title', 'Title', { required: true }),
      sel('category', 'Category', ['Lab report', 'Scan', 'Discharge summary', 'Prescription', 'Insurance', 'Consent form', 'Other']),
      file('file', 'File'), area('notes', 'Notes')],
    columns: ['patientId', 'title', 'category'] },

  // ---------------------------------------------------------------- SPECIALIST CARE
  { key: 'nutritionAssessments', label: 'Nutrition Assessments', group: 'Nutrition Care', icon: 'nutrition-outline', doctorScope: true,
    access: { admin: 'rcud', nutritionist: 'rcu', patient: 'r' },
    fields: [P, D, date('assessedOn', 'Assessment date', { required: true }), num('weightKg', 'Weight (kg)'), num('heightCm', 'Height (cm)'),
      text('dietaryPattern', 'Dietary pattern'), area('foodPreferences', 'Food preferences'), area('nutritionConcerns', 'Nutrition concerns'), area('notes', 'Assessment notes')],
    columns: ['patientId', 'assessedOn', 'weightKg', 'dietaryPattern'] },
  { key: 'nutritionPlans', label: 'Nutrition Plans', group: 'Nutrition Care', icon: 'clipboard-outline', doctorScope: true,
    access: { admin: 'rcud', nutritionist: 'rcu', patient: 'r' },
    fields: [P, D, text('title', 'Plan name', { required: true }), date('startDate', 'Start date', { required: true }), date('endDate', 'Review date'),
      num('calorieTarget', 'Daily energy target (kcal)'), num('waterTargetMl', 'Daily water target (ml)'), text('dietaryFocus', 'Dietary focus'),
      area('mealPlan', 'Meal guidance'), area('avoidFoods', 'Foods to limit'), sel('status', 'Status', ['Draft', 'Active', 'Completed', 'On hold'], { default: 'Active' })],
    columns: ['patientId', 'title', 'startDate', 'dietaryFocus', 'status'] },
  { key: 'mealLogs', label: 'Meal & Hydration Logs', group: 'Nutrition Care', icon: 'restaurant-outline', doctorScope: true,
    access: { admin: 'rcud', nutritionist: 'rcu', patient: 'rc' },
    fields: [P, D, date('logDate', 'Log date', { required: true }), sel('meal', 'Meal', ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Daily summary']),
      area('foodLog', 'Food and portions', { required: true }), num('waterMl', 'Water (ml)'), num('adherenceRating', 'Plan adherence (1–5)', { min: 1, max: 5 }), area('notes', 'Notes')],
    columns: ['patientId', 'logDate', 'meal', 'waterMl', 'adherenceRating'] },

  { key: 'yogaPrograms', label: 'Yoga Programs', group: 'Yoga Practice', icon: 'body-outline', doctorScope: true,
    access: { admin: 'rcud', yogaTeacher: 'rcu', patient: 'r' },
    fields: [P, D, text('title', 'Program name', { required: true }), sel('level', 'Level', ['Gentle', 'Beginner', 'Intermediate', 'Advanced']),
      sel('focus', 'Practice focus', ['Mobility', 'Balance', 'Strength', 'Breathwork', 'Restoration', 'Stress relief']),
      num('durationWeeks', 'Duration (weeks)'), text('weeklySchedule', 'Weekly schedule'), area('sequence', 'Practice sequence'),
      area('adaptations', 'Adaptations and precautions'), sel('status', 'Status', ['Draft', 'Active', 'Completed', 'On hold'], { default: 'Active' })],
    columns: ['patientId', 'title', 'level', 'focus', 'status'] },
  { key: 'yogaSessions', label: 'Yoga Session Notes', group: 'Yoga Practice', icon: 'calendar-outline', doctorScope: true,
    access: { admin: 'rcud', yogaTeacher: 'rcu', patient: 'r' },
    fields: [P, D, date('sessionDate', 'Session date', { required: true }), time('sessionTime', 'Session time'),
      sel('practiceType', 'Practice type', ['Asana', 'Pranayama', 'Meditation', 'Restorative', 'Mixed']), num('durationMinutes', 'Duration (minutes)'),
      sel('attendance', 'Attendance', ['Attended', 'Late', 'Cancelled', 'No-show']), area('practiceNotes', 'Practice notes'), area('nextPractice', 'Home practice')],
    columns: ['patientId', 'sessionDate', 'practiceType', 'durationMinutes', 'attendance'] },
  { key: 'practiceLogs', label: 'Home Practice Logs', group: 'Yoga Practice', icon: 'journal-outline', doctorScope: true,
    access: { admin: 'rcud', yogaTeacher: 'rcu', patient: 'rc' },
    fields: [P, D, date('practiceDate', 'Practice date', { required: true }), num('durationMinutes', 'Duration (minutes)'),
      text('practiceCompleted', 'Practice completed'), sel('energyLevel', 'Energy after practice', ['Low', 'Steady', 'Good', 'High']),
      sel('comfortLevel', 'Comfort level', ['Needs adjustment', 'Comfortable', 'Very comfortable']), area('reflection', 'Reflection')],
    columns: ['patientId', 'practiceDate', 'durationMinutes', 'energyLevel', 'comfortLevel'] },

  { key: 'naturopathyAssessments', label: 'Wellness Assessments', group: 'Naturopathy Care', icon: 'leaf-outline', doctorScope: true,
    access: { admin: 'rcud', naturopath: 'rcu', patient: 'r' },
    fields: [P, D, date('assessedOn', 'Assessment date', { required: true }), area('wellnessGoals', 'Wellness goals'),
      sel('sleepQuality', 'Sleep quality', ['Poor', 'Fair', 'Good', 'Very good']), sel('stressLevel', 'Stress level', ['Low', 'Moderate', 'High']),
      sel('digestion', 'Digestion', ['Needs attention', 'Fair', 'Good']), sel('energyLevel', 'Energy level', ['Low', 'Moderate', 'Good']),
      area('lifestyleNotes', 'Lifestyle notes'), area('assessmentNotes', 'Assessment notes')],
    columns: ['patientId', 'assessedOn', 'sleepQuality', 'stressLevel', 'energyLevel'] },
  { key: 'naturopathyPlans', label: 'Natural Wellness Plans', group: 'Naturopathy Care', icon: 'leaf-outline', doctorScope: true,
    access: { admin: 'rcud', naturopath: 'rcu', patient: 'r' },
    fields: [P, D, text('title', 'Plan name', { required: true }), date('startDate', 'Start date', { required: true }), date('reviewDate', 'Review date'),
      sel('approach', 'Approach', ['Nutrition', 'Lifestyle', 'Hydrotherapy', 'Bodywork', 'Herbal support', 'Breathwork']),
      area('goals', 'Wellness goals'), area('recommendations', 'Recommendations'), area('precautions', 'Precautions'),
      sel('status', 'Status', ['Draft', 'Active', 'Completed', 'On hold'], { default: 'Active' })],
    columns: ['patientId', 'title', 'startDate', 'approach', 'status'] },
  { key: 'therapySessions', label: 'Therapy Session Notes', group: 'Naturopathy Care', icon: 'clipboard-outline', doctorScope: true,
    access: { admin: 'rcud', naturopath: 'rcu', patient: 'r' },
    fields: [P, D, date('sessionDate', 'Session date', { required: true }), time('sessionTime', 'Session time'),
      sel('modality', 'Therapy modality', ['Hydrotherapy', 'Massage / bodywork', 'Breathwork', 'Herbal consultation', 'Lifestyle coaching', 'Other']),
      num('durationMinutes', 'Duration (minutes)'), sel('response', 'Patient response', ['Positive', 'Neutral', 'Needs review']),
      area('sessionNotes', 'Session notes'), area('nextSteps', 'Next steps')],
    columns: ['patientId', 'sessionDate', 'modality', 'durationMinutes', 'response'] },

  // ---------------------------------------------------------------- CARE TOOLS (doctor)
  { key: 'schedules', label: 'My Schedule', group: 'Care Tools', icon: 'calendar-number-outline', ranges: [['startTime', 'endTime']], doctorRead: 'all',
    access: { admin: 'rcud', doctor: 'rcud', patient: 'r' },
    fields: [D, sel('day', 'Day', DAYS, { required: true }), time('startTime', 'Start', { required: true }), time('endTime', 'End', { required: true }),
      num('slotMinutes', 'Slot length (min)'), sel('mode', 'Mode', ['In-person', 'Video', 'Both'])],
    columns: ['doctorId', 'day', 'startTime', 'endTime', 'mode'] },
  { key: 'rxTemplates', label: 'Prescription Templates', group: 'Care Tools', icon: 'copy-outline',
    access: { admin: 'r', doctor: 'rcud' },
    fields: [D, text('title', 'Template name', { required: true }), area('medicines', 'Medicines', { required: true }), area('instructions', 'Instructions')],
    columns: ['title'] },
  { key: 'leaves', label: 'Leave Requests', group: 'Care Tools', icon: 'airplane-outline', ranges: [['fromDate', 'toDate']],
    access: { admin: 'rcud', doctor: 'rc' },
    fields: [D, date('fromDate', 'From', { required: true }), date('toDate', 'To', { required: true }),
      sel('type', 'Type', ['Casual', 'Sick', 'Annual', 'Conference']), area('reason', 'Reason'),
      sel('status', 'Status', ['Pending', 'Approved', 'Rejected'], { default: 'Pending', roles: ['admin'] })],
    columns: ['doctorId', 'fromDate', 'toDate', 'type', 'status'] },

  // ---------------------------------------------------------------- MY HEALTH (patient)
  { key: 'familyMembers', label: 'Family Members', group: 'My Health', icon: 'people-circle-outline',
    access: { admin: 'r', doctor: 'r', patient: 'rcud' },
    fields: [P, text('name', 'Name', { required: true }), text('relation', 'Relation'), date('dob', 'Date of birth'),
      sel('gender', 'Gender', ['Female', 'Male', 'Other']), sel('bloodGroup', 'Blood group', BLOOD)],
    columns: ['name', 'relation', 'dob'] },
  { key: 'insurancePolicies', label: 'Insurance Policies', group: 'My Health', icon: 'shield-outline',
    access: { admin: 'rcud', doctor: 'r', patient: 'rcu' },
    fields: [P, text('provider', 'Provider', { required: true }), text('policyNo', 'Policy no.', { required: true }), text('planName', 'Plan'),
      date('validTill', 'Valid till'), num('sumInsured', 'Sum insured'), file('card', 'Insurance card')],
    columns: ['patientId', 'provider', 'policyNo', 'validTill'] },
  { key: 'feedback', label: 'Feedback', group: 'My Health', icon: 'star-outline',
    access: { admin: 'r', patient: 'rc' },
    fields: [P, DOPT, num('rating', 'Rating (1-5)', { required: true, min: 1, max: 5 }), area('comments', 'Comments')],
    columns: ['patientId', 'doctorId', 'rating', 'comments'] },
  { key: 'tickets', label: 'Support Tickets', group: 'My Health', icon: 'help-buoy-outline',
    access: { admin: 'rcud', patient: 'rc' },
    fields: [P, text('subject', 'Subject', { required: true }), sel('category', 'Category', ['Appointment', 'Billing', 'Medical records', 'Technical', 'Other']),
      area('description', 'Description', { required: true }),
      sel('status', 'Status', ['Open', 'In progress', 'Resolved', 'Closed'], { default: 'Open', roles: ['admin'] })],
    columns: ['patientId', 'subject', 'category', 'status'] },

  // ---------------------------------------------------------------- BILLING
  { key: 'invoices', label: 'Invoices', group: 'Billing', icon: 'receipt-outline',
    access: { admin: 'rcud', patient: 'r' },
    fields: [P, text('invoiceNo', 'Invoice no.', { required: true }), date('date', 'Date', { required: true }), area('items', 'Line items'),
      num('subtotal', 'Subtotal'), num('tax', 'Tax'), num('discount', 'Discount'), num('total', 'Total', { required: true, computed: true }),
      sel('status', 'Status', ['Unpaid', 'Partial', 'Paid', 'Refunded', 'Cancelled'], { default: 'Unpaid' }),
      sel('paymentMode', 'Payment mode', ['Cash', 'Card', 'UPI', 'Net banking', 'Insurance'])],
    columns: ['patientId', 'invoiceNo', 'date', 'total', 'status'] },
  { key: 'payments', label: 'Payments', group: 'Billing', icon: 'card-outline',
    access: { admin: 'rcud', patient: 'r' },
    fields: [P, text('invoiceNo', 'Invoice no.'), num('amount', 'Amount', { required: true }), date('date', 'Date', { required: true }),
      sel('mode', 'Mode', ['Cash', 'Card', 'UPI', 'Net banking', 'Insurance']), text('reference', 'Reference / txn id')],
    columns: ['patientId', 'invoiceNo', 'amount', 'mode', 'date'] },
  { key: 'insuranceClaims', label: 'Insurance Claims', group: 'Billing', icon: 'umbrella-outline',
    access: { admin: 'rcud', patient: 'r' },
    fields: [P, text('claimNo', 'Claim no.'), text('insurer', 'Insurer'), text('invoiceNo', 'Invoice no.'), num('claimedAmount', 'Claimed'),
      num('approvedAmount', 'Approved'), sel('status', 'Status', ['Submitted', 'Under review', 'Approved', 'Rejected', 'Settled'], { default: 'Submitted' }),
      date('submittedOn', 'Submitted on')],
    columns: ['patientId', 'claimNo', 'insurer', 'claimedAmount', 'status'] },
  { key: 'services', label: 'Services & Price List', group: 'Billing', icon: 'pricetags-outline',
    access: { admin: 'rcud', doctor: 'r', patient: 'r' },
    fields: [text('name', 'Service', { required: true }), text('code', 'Code'),
      sel('category', 'Category', ['Consultation', 'Procedure', 'Lab', 'Radiology', 'Pharmacy', 'Room', 'Package', 'Other']),
      num('price', 'Price', { required: true }), num('taxPercent', 'Tax %'), check('active', 'Active', { default: true })],
    columns: ['name', 'category', 'price', 'active'] },
  { key: 'expenses', label: 'Expenses', group: 'Billing', icon: 'wallet-outline',
    access: { admin: 'rcud' },
    fields: [date('date', 'Date', { required: true }), text('category', 'Category'), text('vendor', 'Vendor'),
      num('amount', 'Amount', { required: true }), file('receipt', 'Receipt'), area('notes', 'Notes')],
    columns: ['date', 'category', 'vendor', 'amount'] },

  // ---------------------------------------------------------------- OPERATIONS
  { key: 'staff', label: 'Staff Directory', group: 'Operations', icon: 'briefcase-outline',
    access: { admin: 'rcud' },
    fields: [text('name', 'Name', { required: true }),
      sel('role', 'Role', ['Nurse', 'Receptionist', 'Lab technician', 'Pharmacist', 'Accountant', 'Housekeeping', 'Other']),
      text('department', 'Department'), text('phone', 'Phone'), text('email', 'Email'), date('joinDate', 'Joined on'),
      sel('status', 'Status', ['Active', 'On leave', 'Resigned'], { default: 'Active' })],
    columns: ['name', 'role', 'department', 'phone', 'status'] },
  { key: 'departments', label: 'Departments', group: 'Operations', icon: 'business-outline',
    access: { admin: 'rcud', doctor: 'r', patient: 'r' },
    fields: [text('name', 'Name', { required: true }), text('head', 'Head of department'), text('location', 'Location'), text('phone', 'Phone'), area('description', 'Description')],
    columns: ['name', 'head', 'location'] },
  { key: 'shifts', label: 'Shift Roster', group: 'Operations', icon: 'time-outline',
    access: { admin: 'rcud' },
    fields: [text('staffName', 'Staff member', { required: true }), date('date', 'Date', { required: true }),
      sel('shift', 'Shift', ['Morning', 'Evening', 'Night']), time('startTime', 'Start'), time('endTime', 'End'), area('notes', 'Notes')],
    columns: ['staffName', 'date', 'shift'] },
  { key: 'attendance', label: 'Attendance', group: 'Operations', icon: 'checkmark-done-outline',
    access: { admin: 'rcud' },
    fields: [text('staffName', 'Staff member', { required: true }), date('date', 'Date', { required: true }),
      sel('status', 'Status', ['Present', 'Absent', 'Half day', 'Leave']), time('checkIn', 'Check-in'), time('checkOut', 'Check-out')],
    columns: ['staffName', 'date', 'status', 'checkIn', 'checkOut'] },
  { key: 'rooms', label: 'Rooms & Beds', group: 'Operations', icon: 'home-outline',
    access: { admin: 'rcud', doctor: 'r' },
    fields: [text('name', 'Room / ward', { required: true }),
      sel('type', 'Type', ['Consultation room', 'General ward', 'Private room', 'ICU', 'OT', 'Lab', 'Radiology']), text('floor', 'Floor'),
      num('beds', 'Beds'), sel('status', 'Status', ['Available', 'Occupied', 'Cleaning', 'Maintenance'], { default: 'Available' })],
    columns: ['name', 'type', 'floor', 'beds', 'status'] },
  { key: 'inventory', label: 'Inventory', group: 'Operations', icon: 'cube-outline',
    access: { admin: 'rcud', doctor: 'r' },
    fields: [text('item', 'Item', { required: true }), text('sku', 'SKU'), sel('category', 'Category', ['Consumable', 'Equipment', 'Stationery', 'Other']),
      num('quantity', 'Quantity', { required: true }), text('unit', 'Unit'), num('reorderLevel', 'Reorder level'), date('expiry', 'Expiry'), text('supplier', 'Supplier')],
    columns: ['item', 'category', 'quantity', 'reorderLevel', 'expiry'] },
  { key: 'pharmacy', label: 'Pharmacy Stock', group: 'Operations', icon: 'bandage-outline',
    access: { admin: 'rcud', doctor: 'r' },
    fields: [text('medicine', 'Medicine', { required: true }), text('batchNo', 'Batch no.'), date('expiry', 'Expiry'),
      num('quantity', 'Quantity', { required: true }), num('mrp', 'MRP'), text('rack', 'Rack / location')],
    columns: ['medicine', 'batchNo', 'quantity', 'expiry', 'mrp'] },
  { key: 'suppliers', label: 'Suppliers', group: 'Operations', icon: 'storefront-outline',
    access: { admin: 'rcud' },
    fields: [text('name', 'Name', { required: true }), text('contact', 'Contact person'), text('phone', 'Phone'), text('email', 'Email'),
      area('address', 'Address'), text('taxId', 'GSTIN / tax id')],
    columns: ['name', 'contact', 'phone'] },
  { key: 'purchaseOrders', label: 'Purchase Orders', group: 'Operations', icon: 'cart-outline',
    access: { admin: 'rcud' },
    fields: [text('poNo', 'PO no.', { required: true }), text('supplier', 'Supplier'), date('orderDate', 'Order date'), area('items', 'Items'),
      num('amount', 'Amount'), sel('status', 'Status', ['Draft', 'Ordered', 'Received', 'Cancelled'], { default: 'Draft' })],
    columns: ['poNo', 'supplier', 'orderDate', 'amount', 'status'] },
  { key: 'equipment', label: 'Equipment & Assets', group: 'Operations', icon: 'construct-outline',
    access: { admin: 'rcud', doctor: 'r' },
    fields: [text('name', 'Equipment', { required: true }), text('serialNo', 'Serial no.'), text('location', 'Location'),
      date('purchaseDate', 'Purchased'), date('warrantyUntil', 'Warranty until'), date('lastServiceDate', 'Last service'), date('nextServiceDate', 'Next service'),
      sel('status', 'Status', ['Working', 'Under maintenance', 'Retired'], { default: 'Working' })],
    columns: ['name', 'location', 'nextServiceDate', 'status'] },
  { key: 'branches', label: 'Branches', group: 'Operations', icon: 'git-branch-outline',
    access: { admin: 'rcud' },
    fields: [text('name', 'Branch', { required: true }), area('address', 'Address'), text('city', 'City'), text('phone', 'Phone'),
      text('manager', 'Manager'), check('active', 'Active', { default: true })],
    columns: ['name', 'city', 'phone', 'active'] },


  // ---------------------------------------------------------------- ENTERPRISE ADDITIONS
  { key: 'queue', label: 'Walk-in Queue', group: 'Clinical', icon: 'list-circle-outline', doctorScope: true,
    access: { admin: 'rcud', doctor: 'ru' },
    fields: [num('tokenNo', 'Token no.', { required: true, min: 1 }), text('patientName', 'Patient name', { required: true }), text('phone', 'Phone'), D,
      sel('visitType', 'Visit type', ['Walk-in', 'Emergency', 'Follow-up', 'Referral']), text('complaint', 'Complaint'),
      sel('status', 'Status', ['Waiting', 'Called', 'In consultation', 'Done', 'Skipped'], { default: 'Waiting' })],
    columns: ['tokenNo', 'patientName', 'doctorId', 'visitType', 'status'] },
  { key: 'medReminders', label: 'Medicine Reminders', group: 'My Health', icon: 'alarm-outline',
    access: { admin: 'r', doctor: 'r', patient: 'rcud' },
    fields: [P, text('medicine', 'Medicine', { required: true }), text('dose', 'Dose'),
      text('times', 'Times (HH:MM, comma separated)', { required: true, pattern: '^\\s*([01]\\d|2[0-3]):[0-5]\\d(\\s*,\\s*([01]\\d|2[0-3]):[0-5]\\d)*\\s*$', patternMsg: 'Use times like 08:00, 20:00' }),
      date('startDate', 'Start date'), date('endDate', 'End date'), check('active', 'Reminder on', { default: true })],
    ranges: [['startDate', 'endDate']],
    columns: ['medicine', 'dose', 'times', 'active'] },
  { key: 'consents', label: 'Consents & Privacy', group: 'My Health', icon: 'finger-print-outline',
    access: { admin: 'r', doctor: 'r', patient: 'rcu' },
    fields: [P, sel('consentType', 'Consent type', ['Treatment', 'Data sharing', 'Telemedicine', 'Research', 'Marketing messages'], { required: true }),
      check('granted', 'Granted', { default: true }), date('grantedOn', 'Date'), area('notes', 'Notes')],
    columns: ['patientId', 'consentType', 'granted', 'grantedOn'] },
  { key: 'dataRequests', label: 'Data Requests', group: 'My Health', icon: 'download-outline',
    access: { admin: 'rcud', patient: 'rc' },
    fields: [P, sel('requestType', 'Request', ['Export my data', 'Correct my data', 'Erase my data'], { required: true }), area('details', 'Details'),
      sel('status', 'Status', ['Open', 'In progress', 'Completed', 'Rejected'], { default: 'Open', roles: ['admin'] })],
    columns: ['patientId', 'requestType', 'status'] },
  { key: 'creditNotes', label: 'Credit Notes & Refunds', group: 'Billing', icon: 'return-down-back-outline',
    access: { admin: 'rcud', patient: 'r' },
    fields: [P, text('creditNoteNo', 'Credit note no.', { required: true }), text('invoiceNo', 'Against invoice no.', { required: true }), date('date', 'Date', { required: true }),
      num('amount', 'Amount', { required: true }), area('reason', 'Reason'),
      sel('status', 'Status', ['Issued', 'Applied', 'Refunded'], { default: 'Issued' })],
    columns: ['patientId', 'creditNoteNo', 'invoiceNo', 'amount', 'status'] },

  // ---------------------------------------------------------------- COMMUNICATION
  { key: 'announcements', label: 'Announcements', group: 'Communication', icon: 'megaphone-outline',
    access: { admin: 'rcud', doctor: 'r', patient: 'r' },
    fields: [text('title', 'Title', { required: true }), area('body', 'Message', { required: true }),
      sel('audience', 'Audience', ['All', 'Doctors', 'Patients', 'Staff']), date('publishOn', 'Publish on')],
    columns: ['title', 'audience', 'publishOn'] },

  { key: 'messages', label: 'Secure Messages', group: 'Communication', icon: 'chatbubbles-outline', doctorScope: true, doctorRead: 'own',
    access: { admin: 'r', doctor: 'rc', patient: 'rc' },
    patientCreate: "request.resource.data.fromRole == 'patient'",
    doctorCreate: "request.resource.data.fromRole == 'doctor'",
    fields: [P, D, { name: 'fromRole', label: 'From', type: 'text', selfRole: true },
      area('body', 'Message', { required: true })],
    columns: ['patientId', 'doctorId', 'fromRole', 'body'] },
  { key: 'analytics', label: 'Analytics', group: 'Insights', icon: 'bar-chart-outline', custom: true, access: { admin: 'r' } },
  { key: 'timeline', label: 'Patient Timeline', group: 'Insights', icon: 'git-network-outline', custom: true, access: { admin: 'r', doctor: 'r' } },

  // ---------------------------------------------------------------- ADMINISTRATION
  { key: 'settings', label: 'Clinic Settings', group: 'Administration', icon: 'settings-outline',
    access: { admin: 'rcu', doctor: 'r', patient: 'r' },
    fields: [text('clinicName', 'Clinic name', { required: true }), area('address', 'Address'), text('phone', 'Phone'), text('email', 'Email'),
      text('website', 'Website'), text('workingHours', 'Working hours'), text('currency', 'Currency'), text('taxId', 'GSTIN / tax id'),
      num('slotMinutes', 'Default slot length (min)'), file('logo', 'Logo')],
    columns: ['clinicName', 'phone', 'workingHours'] },
  { key: 'auditLogs', label: 'Audit Logs', group: 'Administration', icon: 'list-outline',
    access: { admin: 'r' },
    extraRules: "allow create: if signedIn() && request.resource.data.uid == request.auth.uid;",
    fields: [text('userName', 'User'), text('role', 'Role'), text('action', 'Action'), text('collection', 'Collection'), text('docId', 'Document')],
    columns: ['userName', 'role', 'action', 'collection', 'docId'] },
];

// ---------------------------------------------------------------- helpers shared by apps + rules generator
export const hasField = (m, name) => (m.fields || []).some((f) => f.name === name);
// Provider records carry an owner id so Firestore can enforce patient scope, including records
// such as vitals and allergies that were previously patient-linked only.
for (const m of MODULES) {
  if (PROVIDER_ROLES.some((role) => m.access?.[role]) && hasField(m, 'patientId') && !hasField(m, 'doctorId')) m.fields.unshift({ ...D, required: false });
}
export function doctorReadMode(m) {
  if (m.doctorScope) return 'own';
  if (m.doctorRead) return m.doctorRead;
  if (hasField(m, 'doctorId')) return 'own';
  if (hasField(m, 'patientId')) return 'own';
  return 'all';
}

export const modulesFor = (role) =>
  MODULES.filter((m) => (m.access?.[role] || '').includes('r'));

export const DASHBOARD = {
  admin: ['appointments', 'patients', 'doctors', 'invoices', 'inventory', 'tickets'],
  doctor: ['appointments', 'consultations', 'prescriptions', 'patients'],
  patient: ['appointments', 'prescriptions', 'labResults', 'invoices'],
};

// ================================================================ enterprise helpers (pure JS: shared by web, mobile)
export const STATUS_FIELDS = ['status', 'priority', 'flag', 'severity', 'urgency'];
const TONE_WORDS = {
  bad: ['cancelled', 'rejected', 'missed', 'no-show', 'critical', 'life-threatening', 'emergency', 'abnormal', 'unpaid', 'severe', 'stat', 'retired', 'resigned', 'absent', 'refunded', 'skipped'],
  warn: ['pending', 'requested', 'partial', 'urgent', 'moderate', 'under review', 'open', 'draft', 'processing', 'waiting', 'in progress', 'under maintenance', 'cleaning', 'maintenance', 'on leave', 'half day', 'submitted', 'issued'],
  ok: ['completed', 'paid', 'approved', 'confirmed', 'normal', 'done', 'resolved', 'closed', 'settled', 'available', 'working', 'active', 'present', 'received', 'accepted', 'discharged', 'applied', 'mild', 'routine'],
  info: ['checked-in', 'in consultation', 'scheduled', 'admitted', 'called', 'sample collected', 'transferred', 'occupied', 'ordered', 'live', 'walk-in'],
};
export const statusTone = (v) => {
  const x = String(v ?? '').toLowerCase();
  return ['bad', 'warn', 'ok', 'info'].find((t) => TONE_WORDS[t].includes(x)) || 'muted';
};
export const statusFieldOf = (m) => (m.fields || []).find((f) => f.type === 'select' && STATUS_FIELDS.includes(f.name));

// Allowed options for a select field (patient subset + workflow transitions).
export function optionsFor(f, role, original) {
  let opts = role === 'patient' && f.patientOptions ? f.patientOptions : f.options;
  const cur = original?.[f.name];
  if (f.flow && cur && !(f.flowExempt || []).includes(role)) opts = [cur, ...(f.flow[cur] || [])].filter((o, i, a) => a.indexOf(o) === i && (!f.patientOptions || role !== 'patient' || f.patientOptions.includes(o) || o === cur));
  return opts;
}

export function validateValues(m, role, v) {
  const label = (n) => (m.fields.find((f) => f.name === n) || {}).label || n;
  for (const f of m.fields) {
    if ((f.roles && !f.roles.includes(role)) || f.selfFor === role || f.selfRole) continue;
    const val = v[f.name];
    const empty = val === undefined || val === null || val === '';
    if (f.required && empty) return `${f.label} is required`;
    if (empty) continue;
    if (f.type === 'number') {
      const n = Number(val);
      if (!Number.isFinite(n)) return `${f.label} must be a number`;
      if (n < (f.min ?? 0)) return `${f.label} must be at least ${f.min ?? 0}`;
      if (f.max !== undefined && n > f.max) return `${f.label} must be at most ${f.max}`;
    }
    const str = String(val);
    if (f.pattern && !new RegExp(f.pattern).test(str)) return f.patternMsg || `${f.label} is not valid`;
    if (f.type === 'text' && /email/i.test(f.name) && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(str)) return `${f.label} is not a valid email`;
    if (f.type === 'text' && /phone/i.test(f.name) && !/^\+?[0-9 ()-]{7,16}$/.test(str)) return `${f.label} is not a valid phone number`;
    if (f.type === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(str)) return `${f.label} must be YYYY-MM-DD`;
    if (f.type === 'time' && !/^([01]\d|2[0-3]):[0-5]\d$/.test(str)) return `${f.label} must be HH:MM`;
  }
  for (const [a, b] of m.ranges || []) if (v[a] && v[b] && String(v[a]) > String(v[b])) return `${label(b)} cannot be before ${label(a)}`;
  return '';
}

// Auto-calculated fields (invoice total = subtotal + tax - discount).
export function applyComputed(m, v) {
  if (m.key !== 'invoices') return v;
  const n = (x) => Number(x) || 0;
  if (![v.subtotal, v.tax, v.discount].some((x) => x !== undefined && x !== null && x !== '')) return v;
  return { ...v, total: Math.max(0, Math.round((n(v.subtotal) + n(v.tax) - n(v.discount)) * 100) / 100) };
}

export const todayStr = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
export const toMs = (v) => (v && typeof v.toDate === 'function' ? v.toDate().getTime() : v ? Date.parse(v) || 0 : 0);
export const daysFromNow = (d) => (d ? Math.round((Date.parse(d) - Date.parse(todayStr())) / 86400000) : null);
export const money = (n, cur = '₹') => `${cur}${(Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export const countBy = (rows, field) => rows.reduce((a, r) => { const k = r[field] || 'Unknown'; a[k] = (a[k] || 0) + 1; return a; }, {});

export function revenueByMonth(payments, months = 6) {
  const now = new Date(); const out = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    out.push({ key, label: d.toLocaleString('en', { month: 'short' }), value: 0 });
  }
  payments.forEach((p) => { const b = out.find((o) => String(p.date || '').startsWith(o.key)); if (b) b.value += Number(p.amount) || 0; });
  return out;
}

export const ALERT_SOURCES = ['pharmacy', 'inventory', 'equipment', 'tickets', 'leaves'];
export function computeAlerts(d) {
  const a = [];
  const low = (d.inventory || []).filter((r) => r.reorderLevel !== '' && r.reorderLevel != null && Number(r.quantity) <= Number(r.reorderLevel));
  const lowRx = (d.pharmacy || []).filter((r) => Number(r.quantity) <= 10);
  if (low.length) a.push({ tone: 'warn', text: `${low.length} inventory item(s) at or below reorder level`, link: 'inventory' });
  if (lowRx.length) a.push({ tone: 'warn', text: `${lowRx.length} medicine(s) with 10 or fewer units`, link: 'pharmacy' });
  const exp = [...(d.pharmacy || []), ...(d.inventory || [])].filter((r) => r.expiry && daysFromNow(r.expiry) <= 60);
  if (exp.length) a.push({ tone: 'bad', text: `${exp.length} item(s) expired or expiring within 60 days`, link: 'pharmacy' });
  const svc = (d.equipment || []).filter((r) => r.status !== 'Retired' && r.nextServiceDate && daysFromNow(r.nextServiceDate) <= 30);
  if (svc.length) a.push({ tone: 'warn', text: `${svc.length} equipment item(s) due for service within 30 days`, link: 'equipment' });
  const t = (d.tickets || []).filter((r) => r.status === 'Open').length;
  if (t) a.push({ tone: 'info', text: `${t} open support ticket(s)`, link: 'tickets' });
  const l = (d.leaves || []).filter((r) => r.status === 'Pending').length;
  if (l) a.push({ tone: 'info', text: `${l} leave request(s) awaiting approval`, link: 'leaves' });
  return a;
}

// ---- patient timeline: [collection, date field, label, summary]
const firstLine = (t) => String(t || '').split('\n')[0];
export const TIMELINE = [
  ['consultations', 'visitDate', 'Consultation', (r) => r.diagnosis || r.chiefComplaint],
  ['prescriptions', 'date', 'Prescription', (r) => r.diagnosis || firstLine(r.medicines)],
  ['vitals', 'recordedOn', 'Vitals', (r) => [r.bp && `BP ${r.bp}`, r.pulse && `Pulse ${r.pulse}`, r.spo2 && `SpO2 ${r.spo2}%`].filter(Boolean).join(' · ')],
  ['labResults', 'resultDate', 'Lab', (r) => `${r.test}: ${r.result} ${r.unit || ''}`.trim() + (r.flag && r.flag !== 'Normal' ? ` (${r.flag})` : '')],
  ['radiology', 'orderedOn', 'Imaging', (r) => `${r.modality || ''} ${r.bodyPart || ''}`.trim()],
  ['procedures', 'date', 'Procedure', (r) => r.procedure],
  ['admissions', 'admitDate', 'Admission', (r) => `${r.ward || ''} ${r.status || ''}`.trim()],
  ['immunizations', 'date', 'Vaccine', (r) => r.vaccine],
  ['allergies', 'notedOn', 'Allergy', (r) => `${r.allergen} (${r.severity || '-'})`],
  ['referrals', 'createdAt', 'Referral', (r) => r.referredTo],
];
export const buildTimeline = (data) => Object.entries(data)
  .flatMap(([key, rows]) => { const t = TIMELINE.find((x) => x[0] === key); return rows.map((r) => ({ id: `${key}-${r.id}`, key, type: t[2], when: toMs(r[t[1]]) || toMs(r.createdAt), text: t[3](r) || '' })); })
  .sort((a, b) => b.when - a.when);

// ---- printable documents (web: window.print, mobile: expo-print)
export const PRINTABLE = ['invoices', 'payments', 'creditNotes', 'prescriptions', 'labResults', 'radiology', 'consultations', 'admissions', 'referrals'];
const esc = (x) => String(x ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export function printableHtml(m, row, clinic = {}) {
  const val = (f) => {
    const v = row[f.name];
    if (f.type === 'user') return row[`${f.name}Name`] || v || '';
    if (v && typeof v.toDate === 'function') return v.toDate().toLocaleDateString();
    if (typeof v === 'boolean') return v ? 'Yes' : 'No';
    return v ?? '';
  };
  const body = m.fields.filter((f) => f.type !== 'file' && val(f) !== '')
    .map((f) => `<tr><th>${esc(f.label)}</th><td>${esc(val(f)).replace(/\n/g, '<br>')}</td></tr>`).join('');
  const sig = ['prescriptions', 'consultations', 'referrals', 'radiology'].includes(m.key) ? '<div class="sig">Doctor signature &amp; stamp</div>' : '';
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(m.label)}</title><style>
body{font-family:Arial,sans-serif;margin:32px;color:#1c2b33}header{border-bottom:3px solid #0e7c86;padding-bottom:10px;margin-bottom:18px}
h1{margin:0;color:#0e7c86;font-size:24px}header p{margin:4px 0 0;color:#555;font-size:12px}h2{font-size:16px;text-transform:uppercase;letter-spacing:.06em}
table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:8px 10px;border-bottom:1px solid #e1e8ec;vertical-align:top;font-size:13px}th{width:32%;color:#555;font-weight:600}
.sig{margin-top:60px;border-top:1px solid #333;width:240px;padding-top:4px;font-size:12px;float:right}footer{clear:both;margin-top:50px;color:#888;font-size:11px}
</style></head><body><header><h1>${esc(clinic.clinicName || 'Clinic')}</h1><p>${esc(clinic.address || '')} ${esc(clinic.phone || '')} ${clinic.taxId ? '· GSTIN ' + esc(clinic.taxId) : ''}</p></header>
<h2>${esc(m.label)}</h2><table>${body}</table>${sig}<footer>Generated ${esc(new Date().toLocaleString())}. Computer-generated document.</footer></body></html>`;
}

// ================================================================ role-specific sidebar / home menu
// Access control still comes from `access` (and the Firestore rules); this only curates what each role SEES in the menu.
export const MENU = {
  admin: [
    ['Insights', ['analytics', 'timeline']],
    ['People', ['patients', 'doctors', 'users']],
    ['Front desk', ['appointments', 'queue', 'schedules', 'leaves', 'telemedicine']],
    ['Clinical oversight', ['consultations', 'prescriptions', 'labOrders', 'labResults', 'radiology', 'admissions', 'procedures', 'referrals', 'followUps', 'documents', 'vitals', 'immunizations', 'allergies', 'medicalHistory', 'nutritionAssessments', 'nutritionPlans', 'mealLogs', 'yogaPrograms', 'yogaSessions', 'practiceLogs', 'naturopathyAssessments', 'naturopathyPlans', 'therapySessions']],
    ['Billing', ['invoices', 'payments', 'creditNotes', 'insuranceClaims', 'insurancePolicies', 'services', 'expenses']],
    ['Operations', ['staff', 'shifts', 'attendance', 'departments', 'branches', 'rooms', 'inventory', 'pharmacy', 'suppliers', 'purchaseOrders', 'equipment']],
    ['Communication', ['announcements', 'messages', 'tickets', 'feedback', 'dataRequests', 'consents']],
    ['Administration', ['settings', 'auditLogs']],
  ],
  doctor: [
    ['Insights', ['timeline']],
    ['My day', ['appointments', 'queue', 'telemedicine', 'followUps', 'schedules', 'leaves']],
    ['Patients', ['patients', 'consultations', 'prescriptions', 'rxTemplates', 'vitals', 'allergies', 'medicalHistory', 'immunizations']],
    ['Orders & referrals', ['labOrders', 'labResults', 'radiology', 'procedures', 'referrals', 'admissions', 'documents']],
    ['Communication', ['messages', 'announcements']],
  ],
  nutritionist: [
    ['My Clients', ['patients']],
    ['Nutrition Care', ['appointments', 'nutritionAssessments', 'nutritionPlans', 'mealLogs']],
  ],
  yogaTeacher: [
    ['My Clients', ['patients']],
    ['Yoga Practice', ['appointments', 'yogaPrograms', 'yogaSessions', 'practiceLogs']],
  ],
  naturopath: [
    ['My Clients', ['patients']],
    ['Naturopathy Care', ['appointments', 'naturopathyAssessments', 'naturopathyPlans', 'therapySessions']],
  ],
  patient: [
    ['Appointments', ['appointments', 'doctors', 'telemedicine', 'followUps']],
    ['My records', ['consultations', 'prescriptions', 'labResults', 'radiology', 'procedures', 'referrals', 'admissions', 'documents']],
    ['My health', ['vitals', 'medReminders', 'allergies', 'medicalHistory', 'immunizations', 'familyMembers']],
    ['Billing & insurance', ['invoices', 'payments', 'creditNotes', 'insuranceClaims', 'insurancePolicies']],
    ['Help & privacy', ['messages', 'announcements', 'feedback', 'tickets', 'consents', 'dataRequests']],
  ],
};

// -> [[groupLabel, [module, ...]], ...] containing only modules this role can read.
export const menuFor = (role) => (MENU[role] || [])
  .map(([label, keys]) => [label, keys.map((k) => MODULES.find((m) => m.key === k)).filter((m) => m && (m.access?.[role] || '').includes('r')).map((m) => m.roleLabels?.[role] ? { ...m, label: m.roleLabels[role] } : m)])
  .filter(([, list]) => list.length);
