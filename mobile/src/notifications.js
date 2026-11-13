import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowAlert: true, shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }) });

async function allowed() {
  const cur = await Notifications.getPermissionsAsync();
  if (cur.granted) return true;
  return (await Notifications.requestPermissionsAsync()).granted;
}

// Saves the Expo push token on the user's profile so a Cloud Function can send reminders and alerts.
export async function registerPush(uid) {
  try {
    if (!(await allowed())) return;
    if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('default', { name: 'default', importance: Notifications.AndroidImportance.DEFAULT });
    const projectId = Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;
    const t = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    await updateDoc(doc(db, 'users', uid), { pushToken: t.data });
  } catch { /* simulator or permission denied */ }
}

// Re-creates daily local notifications for the patient's active medicine reminders.
export async function scheduleMedReminders(reminders) {
  try {
    if (!(await allowed())) return;
    await Notifications.cancelAllScheduledNotificationsAsync();
    const today = new Date().toISOString().slice(0, 10);
    for (const r of reminders) {
      if (!r.active || (r.endDate && r.endDate < today)) continue;
      for (const t of String(r.times || '').split(',').map((x) => x.trim()).filter(Boolean)) {
        const [hour, minute] = t.split(':').map(Number);
        await Notifications.scheduleNotificationAsync({
          content: { title: 'Medicine reminder', body: `${r.medicine}${r.dose ? ` - ${r.dose}` : ''}` },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute },
        });
      }
    }
  } catch { /* ignore */ }
}
