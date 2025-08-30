// src/services/notifications.js
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export async function ensureChannel() {
  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync('pomodoro', {
        name: 'Pomodoro Alerts',
        importance: Notifications.AndroidImportance.HIGH,
        sound: true,
        vibrationPattern: [0, 250, 250, 250],
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        bypassDnd: false,
      });
    } catch {}
  }
}

/** Planlı bildirimleri iptal et. */
export async function cancelAll() {
  try {
    const pending = await Notifications.getAllScheduledNotificationsAsync();
    if (pending?.length) console.log('[Notif] cancelAll count =', pending.length);
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (e) { console.log('cancelAll err', e); }
}

/** Gösterilen (Notification Center’daki) bildirimleri kapat. */
export async function dismissAll() {
  try {
    const presented = await Notifications.getPresentedNotificationsAsync();
    if (presented?.length) {
      console.log('[Notif] dismiss presented =', presented.length);
      for (const n of presented) {
        await Notifications.dismissNotificationAsync(n.request.identifier).catch(()=>{});
      }
    } else {
      await Notifications.dismissAllNotificationsAsync().catch(()=>{});
    }
  } catch (e) { console.log('dismissAll err', e); }
}

/** Her şeyi temizle (planlı + gösterilen). */
export async function fullClean() {
  await cancelAll();
  await dismissAll();
}

/** Faz sonu bildirimi: güvenli “seconds” tetikleyici. */
export async function schedulePhaseEnd({ phase, msFromNow }) {
  const safeMs = Number.isFinite(msFromNow) ? msFromNow : 0;
  if (safeMs < 1500) {
    console.log('[Notif] skip schedule (too small ms):', safeMs);
    return null;
  }

  const content =
    phase === 'work'
      ? { title: 'Odak tamamlandı', body: 'Kısa molanı alabilirsin ☕', sound: true }
      : phase === 'short'
      ? { title: 'Kısa mola bitti', body: 'Şimdi odak zamanı ⏳', sound: true }
      : { title: 'Uzun mola bitti', body: 'Haydi devam 💪', sound: true };

  const seconds = Math.max(2, Math.ceil(safeMs / 1000));
  const trigger = Platform.select({
    android: { channelId: 'pomodoro', seconds },
    default: { seconds },
  });

  console.log('[Notif] schedule phase:', phase, 'sec:', seconds);
  return await Notifications.scheduleNotificationAsync({ content, trigger });
}
