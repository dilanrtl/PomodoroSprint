// src/features/pomodoro/usePomodoroTimer.js
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, DeviceEventEmitter, Animated } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';

import {
  DEFAULT_WORK_MIN,
  DEFAULT_SHORT_MIN,
  DEFAULT_LONG_MIN,
  LONG_BREAK_EVERY,
} from '../../config/constants';
import * as Notif from '../../services/notifications';
import * as Storage from '../../services/storage';
import { minToMs } from '../../utils/time';

/* ------------------------------- SOUND HELPERS ------------------------------- */
async function playSoundByMode(mode) {
  try {
    let file;
    if (mode === 'work') file = require('../../../assets/sounds/work.mp3');
    else if (mode === 'short') file = require('../../../assets/sounds/short.mp3');
    else if (mode === 'long') file = require('../../../assets/sounds/long.mp3');
    else file = require('../../../assets/sounds/chime.mp3');

    const { sound } = await Audio.Sound.createAsync(file);
    await sound.playAsync();
    setTimeout(() => sound.unloadAsync().catch(() => {}), 1500);
  } catch {}
}

/* --------------------------------- HOOK ------------------------------------- */
export default function usePomodoroTimer() {
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
      work:  minToMs(Math.max(1, Number(workMin)  || DEFAULT_WORK_MIN)),
      short: minToMs(Math.max(1, Number(shortMin) || DEFAULT_SHORT_MIN)),
      long:  minToMs(Math.max(1, Number(longMin)  || DEFAULT_LONG_MIN)),
    }),
    [workMin, shortMin, longMin]
  );

  // Kalan süre (ms)
  const [remainingMs, setRemainingMs] = useState(durations.work);

  // Timer refs
  const intervalRef = useRef(null);
  const targetEndRef = useRef(null);
  const scheduledEndTsRef = useRef(0);

  // Progress animasyonu
  const animatedProgressRef = useRef(new Animated.Value(0)); // 0..1
  const lastProgressRef = useRef(0);

  /* ---------------------- İlk yükleme: kanal + saklanan süre ------------------ */
  useEffect(() => {
    (async () => {
      try {
        await Notif.ensureChannel();
        const saved = await Storage.loadDurations();
        if (saved?.focusTime)  setWorkMin(Math.max(1, Number(saved.focusTime)));
        if (saved?.shortBreak) setShortMin(Math.max(1, Number(saved.shortBreak)));
        if (saved?.longBreak)  setLongMin(Math.max(1, Number(saved.longBreak)));
      } catch {}
    })();
  }, []);

  /* --------------- Settings’ten canlı güncelleme → work’e sıfırla ------------- */
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(
      'settingsUpdated',
      async ({ focusTime, shortBreak, longBreak }) => {
        const f = Math.max(1, Number(focusTime)  || DEFAULT_WORK_MIN);
        const s = Math.max(1, Number(shortBreak) || DEFAULT_SHORT_MIN);
        const l = Math.max(1, Number(longBreak)  || DEFAULT_LONG_MIN);

        setWorkMin(f); setShortMin(s); setLongMin(l);

        // Tam temizlik
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = null;
        targetEndRef.current = null;
        scheduledEndTsRef.current = 0;
        setIsActive(false);
        await Notif.fullClean?.();

        // Ekranı work başlangıcına getir
        setMode('work');
        const next = minToMs(f);
        setRemainingMs(next);
        animatedProgressRef.current.setValue(0);
        lastProgressRef.current = 0;

        try { await Haptics.selectionAsync(); } catch {}
      }
    );
    return () => sub.remove();
  }, []);

  /* --- Pasifken SÜRE değişirse kalan süreyi güncelle (mode'u ZORLAMA) -------- */
  useEffect(() => {
    if (!isActive && !intervalRef.current) {
      // Seçili mode’un süresini ekrana yansıt
      setRemainingMs(durations[mode]);
      animatedProgressRef.current.setValue(0);
      lastProgressRef.current = 0;
    }
    // 🔴 Dikkat: burada 'mode' veya 'isActive' dependency olarak yok;
    // sadece süreler değiştiğinde çalışsın istiyoruz.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workMin, shortMin, longMin]);

  /* -------------------------------- Döngü kontrol ----------------------------- */
  const startLoop = useCallback((ms) => {
    const endTs = Date.now() + ms;
    targetEndRef.current = endTs;
    scheduledEndTsRef.current = endTs;

    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      const now = Date.now();
      const next = Math.max(0, (targetEndRef.current ?? now) - now);
      setRemainingMs(next);

      if (next <= 0) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = null;
        targetEndRef.current = null;
        setIsActive(false);
        handleComplete(); // faz bitişi
      }
    }, 100);

    return endTs;
  }, []);

  const stopLoop = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    targetEndRef.current = null;
  }, []);

  /* --------- App aktif olunca zamanı ve animasyonu senkronize et ------------- */
  const ensureActiveLoop = useCallback(() => {
    if (isActive && scheduledEndTsRef.current) {
      const rem = Math.max(0, scheduledEndTsRef.current - Date.now());
      setRemainingMs(rem);

      const to = Math.max(0, Math.min(1, 1 - rem / Math.max(1, durations[mode])));
      Animated.timing(animatedProgressRef.current, {
        toValue: to,
        duration: 650,
        useNativeDriver: false,
      }).start(() => { lastProgressRef.current = to; });

      if (!intervalRef.current && rem > 0) {
        targetEndRef.current = scheduledEndTsRef.current;
        startLoop(rem);
      }
    }
  }, [isActive, durations, mode, startLoop]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') ensureActiveLoop(); });
    return () => sub.remove();
  }, [ensureActiveLoop]);

  /* --------------------------------- Kontroller ------------------------------- */
  const toggle = useCallback(async () => {
    if (isActive) {
      stopLoop();
      setIsActive(false);
      await Notif.fullClean?.();
    } else {
      await Notif.fullClean?.();

      const startFrom =
        Number.isFinite(remainingMs) && remainingMs > 0
          ? remainingMs
          : durations[mode]; // 🔑 mevcut mode

      setIsActive(true);

      setTimeout(async () => {
        await playSoundByMode(mode); // 🔑 mevcut mode için ses
        try { await Haptics.selectionAsync(); } catch {}
        const endTs = startLoop(startFrom);
        scheduledEndTsRef.current = endTs;
        await Notif.schedulePhaseEnd({ phase: mode, msFromNow: startFrom });
      }, 80);
    }
  }, [isActive, remainingMs, durations, mode, startLoop, stopLoop]);

  const reset = useCallback(async () => {
    stopLoop();
    setIsActive(false);
    await Notif.fullClean?.();
    setMode('work');
    setRemainingMs(durations.work);
    animatedProgressRef.current.setValue(0);
    lastProgressRef.current = 0;
  }, [durations.work, stopLoop]);

  /* ------------------------------- Skip -------------------------------------- */
  const skip = useCallback(async () => {
    stopLoop();
    setIsActive(false);
    await Notif.fullClean?.();

    animatedProgressRef.current.setValue(0);
    lastProgressRef.current = 0;

    let nextMode;
    let nextRemaining;

    if (mode === 'work') {
      const nextCount = cycleCount + 1;
      setCycleCount(nextCount);
      nextMode = nextCount % LONG_BREAK_EVERY === 0 ? 'long' : 'short';
      nextRemaining = durations[nextMode];
    } else {
      nextMode = 'work';
      nextRemaining = durations.work;
    }

    setMode(nextMode);
    setRemainingMs(nextRemaining);

    try { await Haptics.selectionAsync(); } catch {}
    try { await playSoundByMode(nextMode); } catch {}

    // Yeni fazı HEMEN başlat
    setIsActive(true);
    const endTs = startLoop(nextRemaining);
    scheduledEndTsRef.current = endTs;
    await Notif.schedulePhaseEnd({ phase: nextMode, msFromNow: nextRemaining });
  }, [mode, cycleCount, durations, stopLoop, startLoop]);

  /* ------------------------------- Faz tamamlandı ----------------------------- */
  const handleComplete = useCallback(async () => {
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

    await playSoundByMode(nextMode);

    animatedProgressRef.current.setValue(0);
    lastProgressRef.current = 0;

    if (isActive) {
      const ms = durations[nextMode];
      setRemainingMs(ms);
      const endTs = startLoop(ms);
      scheduledEndTsRef.current = endTs;
      await Notif.fullClean?.();
      await Notif.schedulePhaseEnd({ phase: nextMode, msFromNow: ms });
    } else {
      setRemainingMs(durations[nextMode]);
    }
  }, [mode, cycleCount, isActive, durations, startLoop]);

  /* --------------------------- Progress hesap/animasyon ----------------------- */
  const totalMs = durations[mode];
  const safeRem = Number.isFinite(remainingMs) && remainingMs >= 0 ? remainingMs : 0;
  const progress = 1 - safeRem / Math.max(1, totalMs);

  useEffect(() => {
    const to = Math.max(0, Math.min(1, progress));
    const from = lastProgressRef.current;
    const delta = Math.abs(to - from);
    const base = 250;
    const extra = Math.min(500, Math.round(delta * 1200));
    Animated.timing(animatedProgressRef.current, {
      toValue: to,
      duration: base + extra,
      useNativeDriver: false,
    }).start(() => { lastProgressRef.current = to; });
  }, [progress]);

  /* ----------------------------------- Temizlik -------------------------------- */
  useEffect(() => {
    return () => {
      stopLoop();
      Notif.fullClean?.();
    };
  }, [stopLoop]);

  /* --------------------------------- Dışarı ver -------------------------------- */
  return {
    mode,
    cycleCount,
    isActive,
    remainingMs,
    totalMs,
    progress,
    // SVG için
    progressAnim: animatedProgressRef.current,
    // Aksiyonlar
    toggle,
    reset,
    skip,
  };
}
