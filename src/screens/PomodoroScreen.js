// src/screens/PomodoroScreen.js
import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  AppState,
  DeviceEventEmitter,
  Platform,
  Animated,
  Easing,
} from 'react-native';
import { Svg, Circle } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { Colors, ModeTheme } from '../theme/colors';

const DEFAULT_WORK_MIN = 25;
const DEFAULT_SHORT_MIN = 5;
const DEFAULT_LONG_MIN = 15;
const LONG_BREAK_EVERY = 4;

const ENABLE_SOUND = true; // Sistem bildirim sesi için content.sound:true yeterli
const RING_SIZE = 260;
const STROKE_WIDTH = 16;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export default function PomodoroScreen() {
  // Süre ayarları (dk)
  const [workMin, setWorkMin] = useState(DEFAULT_WORK_MIN);
  const [shortMin, setShortMin] = useState(DEFAULT_SHORT_MIN);
  const [longMin, setLongMin] = useState(DEFAULT_LONG_MIN);

  // Durumlar
  const [mode, setMode] = useState('work'); // 'work' | 'short' | 'long'
  const [cycleCount, setCycleCount] = useState(0);
  const [isActive, setIsActive] = useState(false);

  // Süreler (ms)
  const durations = useMemo(
    () => ({
      work: Math.max(1, Number(workMin) || DEFAULT_WORK_MIN) * 60 * 1000,
      short: Math.max(1, Number(shortMin) || DEFAULT_SHORT_MIN) * 60 * 1000,
      long: Math.max(1, Number(longMin) || DEFAULT_LONG_MIN) * 60 * 1000,
    }),
    [workMin, shortMin, longMin]
  );

  const [remainingMs, setRemainingMs] = useState(durations.work);

  // Timer refs
  const targetEndRef = useRef(null);
  const intervalRef = useRef(null);

  // Bildirim refs
  const notifIdRef = useRef(null);
  const scheduledEndTsRef = useRef(0); // planlanan kesin bitiş zamanı
  const scheduledIdRef = useRef(null); // planlanan bildirimin id'si

  // Progress animasyonu için refs
  const animatedProgressRef = useRef(new Animated.Value(0)); // 0..1
  const lastProgressRef = useRef(0);                         // 0..1

  // Mini toast
  const [toast, setToast] = useState(null);
  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2000); };

  // ▶️ Android bildirim kanalı
  useEffect(() => {
    (async () => {
      try {
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('pomodoro', {
            name: 'Pomodoro Alerts',
            importance: Notifications.AndroidImportance.HIGH,
            sound: true,
            vibrationPattern: [0, 250, 250, 250],
            lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
            bypassDnd: false,
          });
        }
      } catch {}
    })();
  }, []);

  // Ayarları yükle
  useEffect(() => {
    (async () => {
      try {
        const sWork = await AsyncStorage.getItem('focusTime');
        const sShort = await AsyncStorage.getItem('shortBreak');
        const sLong = await AsyncStorage.getItem('longBreak');
        if (sWork != null) setWorkMin(Math.max(1, Number(sWork) || DEFAULT_WORK_MIN));
        if (sShort != null) setShortMin(Math.max(1, Number(sShort) || DEFAULT_SHORT_MIN));
        if (sLong != null) setLongMin(Math.max(1, Number(sLong) || DEFAULT_LONG_MIN));
      } catch {}
    })();
  }, []);

  // SettingsScreen’den canlı güncelleme
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('settingsUpdated', ({ focusTime, shortBreak, longBreak }) => {
      const f = Math.max(1, Number(focusTime) || DEFAULT_WORK_MIN);
      const s = Math.max(1, Number(shortBreak) || DEFAULT_SHORT_MIN);
      const l = Math.max(1, Number(longBreak) || DEFAULT_LONG_MIN);

      setWorkMin(f);
      setShortMin(s);
      setLongMin(l);

      if (!isActive) {
        const nextTotal = ({ work: f, short: s, long: l }[mode] || f) * 60 * 1000;
        setRemainingMs(nextTotal);
      }

      showToast('Ayarlar uygulandı');
      try { Haptics.selectionAsync(); } catch {}
    });
    return () => sub.remove();
  }, [mode, isActive]);

  // ───────── Bildirim Planlama / İptal ─────────
  const cancelScheduledNotification = async () => {
    try {
      // Güvenli olsun: tüm planlı bildirimleri temizle
      await Notifications.cancelAllScheduledNotificationsAsync();
    } catch {}
    notifIdRef.current = null;
    scheduledIdRef.current = null;
  };

  // 🔒 Sağlamlaştırılmış planlama: (1) mutlak tarih dene, (2) doğrula, (3) gerekirse seconds fallback
  const scheduleCompletionNotification = async (ms) => {
    try {
      await cancelScheduledNotification();

      const safeMs = Number.isFinite(ms) && ms > 0 ? ms : 0;
      if (safeMs <= 0) return;

      // Mesaj MEVCUT MODE'un bitişine göre
      let content;
      if (mode === 'work') {
        content = { title: 'Odak Tamamlandı', body: 'Kısa molanı alabilirsin ☕', sound: ENABLE_SOUND, priority: Notifications.AndroidNotificationPriority.HIGH, data: { kind: 'work_done' } };
      } else if (mode === 'short') {
        content = { title: 'Kısa Mola Bitti', body: 'Şimdi odaklanma zamanı ⏳', sound: ENABLE_SOUND, priority: Notifications.AndroidNotificationPriority.HIGH, data: { kind: 'short_done' } };
      } else {
        content = { title: 'Uzun Mola Bitti', body: 'Haydi odaklanmaya geri dönelim 💪', sound: ENABLE_SOUND, priority: Notifications.AndroidNotificationPriority.HIGH, data: { kind: 'long_done' } };
      }

      // Kesin bitiş zamanı
      const endTs = targetEndRef.current ?? (Date.now() + safeMs);
      scheduledEndTsRef.current = endTs;

      // 1) Mutlak tarih tetikleyicisi
      const dateTrigger = Platform.OS === 'android'
        ? { channelId: 'pomodoro', date: new Date(endTs) }
        : { date: new Date(endTs) };

      let willFire = null;
      try {
        willFire = await Notifications.getNextTriggerDateAsync(dateTrigger);
      } catch {
        // iOS/Android bazı versiyonlarda desteklemeyebilir, sorun değil
      }

      let id;
      if (willFire && willFire > Date.now() + 900) {
        // Mutlak tarih güvenli görünüyor
        id = await Notifications.scheduleNotificationAsync({ content, trigger: dateTrigger });
      } else {
        // 2) Geri düş: seconds tetikleyicisi
        const seconds = Math.max(1, Math.ceil((endTs - Date.now()) / 1000));
        const secTrigger = Platform.OS === 'android'
          ? { channelId: 'pomodoro', seconds }
          : { seconds };
        id = await Notifications.scheduleNotificationAsync({ content, trigger: secTrigger });
      }

      notifIdRef.current = id;
      scheduledIdRef.current = id;
    } catch (e) {
      console.log('scheduleCompletionNotification error:', e);
    }
  };

  // ───────── Güvenlik: NaN/negatif remainingMs toparla ─────────
  useEffect(() => {
    if (!Number.isFinite(remainingMs) || remainingMs < 0) setRemainingMs(durations[mode]);
  }, [remainingMs, durations, mode]);

  // ───────── Interval tabanlı döngü ─────────
  const startLoop = (ms) => {
    const startFrom = Number.isFinite(ms) && ms > 0 ? ms : durations[mode];
    const endTs = Date.now() + startFrom;
    targetEndRef.current = endTs;
    scheduledEndTsRef.current = endTs;

    intervalRef.current = setInterval(() => {
      if (!targetEndRef.current) return;
      const now = Date.now();
      const nextRemaining = Math.max(0, targetEndRef.current - now);
      setRemainingMs(nextRemaining);
      if (nextRemaining <= 0) {
        stopLoop();
        setIsActive(false);
        handleComplete();
      }
    }, 100); // 4Hz yeterli, pil dostu
    return startFrom;
  };

  const stopLoop = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    targetEndRef.current = null;
  };

  // HMR / AppState dönüşünde timer’ı geri bağla + görseli yumuşat
  const ensureActiveLoop = useCallback(() => {
    if (isActive && scheduledEndTsRef.current) {
      const rem = Math.max(0, scheduledEndTsRef.current - Date.now());
      setRemainingMs(rem);
      // Görseli birden sıçratma: son görünen → gerçek değere yumuşak akış
      const to = 1 - (rem / Math.max(1, durations[mode]));
      const clamped = Math.max(0, Math.min(1, to));
      Animated.timing(animatedProgressRef.current, {
        toValue: clamped,
        duration: 650,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start(() => { lastProgressRef.current = clamped; });
      if (!intervalRef.current && rem > 0) {
        targetEndRef.current = scheduledEndTsRef.current;
        startLoop(rem);
      }
    }
  }, [isActive, durations, mode]);

  useEffect(() => { ensureActiveLoop(); }, [ensureActiveLoop]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') ensureActiveLoop(); });
    return () => sub.remove();
  }, [ensureActiveLoop]);

  const toggle = async () => {
    if (isActive) {
      stopLoop();
      setIsActive(false);
      await cancelScheduledNotification();
    } else {
      setIsActive(true);
      const startFrom = Number.isFinite(remainingMs) && remainingMs > 0 ? remainingMs : durations[mode];
      const used = startLoop(startFrom);          // aynı ms ile başlat
    }
  };

  const reset = async () => {
    stopLoop();
    setIsActive(false);
    await cancelScheduledNotification();
    setRemainingMs(durations[mode]);
    // Halka görselini de sıfırla
    animatedProgressRef.current.setValue(0);
    lastProgressRef.current = 0;
  };

  const skip = async () => {
    stopLoop();
    setIsActive(false);
    await cancelScheduledNotification();
    setRemainingMs(0);
    animatedProgressRef.current.setValue(0);
    lastProgressRef.current = 0;
    handleComplete();
  };

  const handleComplete = async () => {
    try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}

    let nextMode = 'work';
    if (mode === 'work') {
      const nextCount = cycleCount + 1;
      setCycleCount(nextCount);
      nextMode = nextCount % LONG_BREAK_EVERY === 0 ? 'long' : 'short';
    } else {
      nextMode = 'work';
    }

    setMode(nextMode);

    // Görsel halka başlangıcını 0’a çek
    animatedProgressRef.current.setValue(0);
    lastProgressRef.current = 0;

    // Aktifse otomatik devam + yeni planlama
    if (isActive) {
      const nextMs = durations[nextMode];
      setRemainingMs(nextMs);
      setTimeout(() => {
        const used = startLoop(nextMs);
        scheduleCompletionNotification(used);
      }, 0);
    } else {
      setRemainingMs(durations[nextMode]);
    }
  };

  useEffect(() => () => {
    stopLoop();
    cancelScheduledNotification();
  }, []);

  // Görsel hesaplar
  const safeRemainingMs = Number.isFinite(remainingMs) && remainingMs >= 0 ? remainingMs : 0;
  const totalMs = durations[mode];
  const totalSeconds = Math.ceil(safeRemainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  // İlerleme [0..1]
  const progress = 1 - (safeRemainingMs / Math.max(1, totalMs));

  // Progress değiştikçe halkayı kısa easing ile güncelle
  useEffect(() => {
    const to = Math.max(0, Math.min(1, progress));
    const from = lastProgressRef.current;
    const delta = Math.abs(to - from);
    const base = 250;
    const extra = Math.min(500, Math.round(delta * 1200)); // büyük farkta biraz daha uzun
    Animated.timing(animatedProgressRef.current, {
      toValue: to,
      duration: base + extra,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(() => {
      lastProgressRef.current = to;
    });
  }, [progress]);

  // SVG halka metrikleri
  const radius = (RING_SIZE - STROKE_WIDTH) / 2;
  const circumference = 2 * Math.PI * radius;

  const animatedDashOffset = animatedProgressRef.current.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  });

  const theme = ModeTheme[mode];
  const modeLabel = mode === 'work' ? 'Odak' : mode === 'short' ? 'Kısa Mola' : 'Uzun Mola';

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.bg} />
      <Text style={[styles.appTitle, { color: theme.text }]}>Pomodoro Sprint</Text>
      <Text style={[styles.subtitle, { color: theme.text }]}>
        {modeLabel} • {minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}
      </Text>

      {/* Halka progress (Animated SVG) */}
      <View style={{ marginVertical: 36 }}>
        <Svg width={RING_SIZE} height={RING_SIZE}>
          {/* Arka plan halkası */}
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={radius}
            stroke={Colors.progressBackground}
            strokeWidth={STROKE_WIDTH}
            fill="none"
          />
          {/* İlerleme halkası */}
          <AnimatedCircle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={radius}
            stroke={theme.tint}
            strokeWidth={STROKE_WIDTH}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={animatedDashOffset}
            transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
          />
        </Svg>

        {/* Ortadaki metinler */}
        <View style={[StyleSheet.absoluteFill, styles.center]}>
          <Text style={[styles.timerText, { color: theme.text }]}>
            {`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`}
          </Text>
          <Text style={[styles.modePill, { backgroundColor: theme.pillBg, color: theme.text }]}>
            {modeLabel}
          </Text>
        </View>
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity style={[styles.button, { backgroundColor: theme.tint }]} onPress={toggle}>
          <Text style={[styles.buttonText, { color: Colors.text }]}>{isActive ? 'Duraklat' : 'Başlat'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, { backgroundColor: Colors.secondary }]} onPress={reset}>
          <Text style={[styles.buttonText, { color: Colors.text }]}>Sıfırla</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, { backgroundColor: Colors.text }]} onPress={skip}>
          <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>Atla</Text>
        </TouchableOpacity>
      </View>

      <Text style={[styles.footerInfo, { color: theme.text }]}>
        Tamamlanan odak: {cycleCount} • Döngü: {workMin}-{shortMin}-{workMin}-{longMin}
      </Text>

      {toast && (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  center: { alignItems: 'center', justifyContent: 'center' },
  appTitle: { fontSize: 22, fontFamily: 'Poppins-SemiBold' },
  subtitle: { marginTop: 6, fontSize: 14, opacity: 0.8, fontFamily: 'Poppins-Regular' },
  timerText: { fontSize: 42, fontFamily: 'Poppins-Bold' },
  modePill: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, overflow: 'hidden',
    fontFamily: 'Poppins-Medium', fontSize: 12, marginTop: 8,
  },
  buttonRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  button: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 24 },
  buttonText: { fontSize: 14, fontFamily: 'Poppins-Medium' },
  footerInfo: { marginTop: 14, fontSize: 12, opacity: 0.7, fontFamily: 'Poppins-Regular' },

  toast: {
    position: 'absolute',
    bottom: 28,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  toastText: { color: '#fff', fontFamily: 'Poppins-Medium' },
});
