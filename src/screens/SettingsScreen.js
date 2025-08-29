// src/screens/SettingsScreen.js
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ToastAndroid,
  DeviceEventEmitter,
  Alert,
  KeyboardAvoidingView,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';

// 🎨 Pastel Palet (senin verdiğin)
const PALETTE = {
  primary: '#FFB69E',      // Ana
  action:  '#F9A7A7',      // Aksiyon/Uyarı
  compBlue:'#CFE7FF',      // Tamamlayıcı Açık Mavi
  compMint:'#CFFFE5',      // Tamamlayıcı Mint
  bg:      '#FAFAFA',      // Arka Plan
  text:    '#4A4A4A',      // Yazı
  textMuted:'#666666',
  card:    '#FFFFFF',
  stroke:  '#EDEDED',
  chipText:'#3D3D3D',
  saveDisabled:'#FFD6C9',
};

const clampInt = (v, { min = 1, max = 180, fallback = 25 } = {}) => {
  const n = parseInt(String(v).trim(), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};

export default function SettingsScreen({ navigation }) {
  // Form state (string tutuyoruz; input kontrolü kolay)
  const [focusTime, setFocusTime] = useState('25');
  const [shortBreak, setShortBreak] = useState('5');
  const [longBreak, setLongBreak] = useState('15');

  // Durum
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  // İlk yükleme
  useEffect(() => {
    (async () => {
      try {
        const pairs = await AsyncStorage.multiGet(['focusTime', 'shortBreak', 'longBreak']);
        const map = Object.fromEntries(pairs || []);
        if (map.focusTime) setFocusTime(String(map.focusTime));
        if (map.shortBreak) setShortBreak(String(map.shortBreak));
        if (map.longBreak) setLongBreak(String(map.longBreak));
      } catch {}
    })();
  }, []);

  // Sayısal değerler
  const values = useMemo(() => {
    const f = clampInt(focusTime, { fallback: 25 });
    const s = clampInt(shortBreak, { fallback: 5 });
    const l = clampInt(longBreak, { fallback: 15 });
    return { f, s, l };
  }, [focusTime, shortBreak, longBreak]);

  const totalCycleMin = useMemo(() => values.f + values.s + values.f + values.l, [values]);

  // Helpers
  const onChange = (setter) => (txt) => {
    setDirty(true);
    setter(txt.replace(/[^\d]/g, '').slice(0, 3));
  };

  const bump = async (which, delta) => {
    try { await Haptics.selectionAsync(); } catch {}
    setDirty(true);
    const curr = { focus: focusTime, short: shortBreak, long: longBreak }[which];
    const next = clampInt((parseInt(curr || '0', 10) || 0) + delta, { min: 1, max: 180 });
    const setters = { focus: setFocusTime, short: setShortBreak, long: setLongBreak };
    setters[which](String(next));
  };

  const applyPreset = async (f, s, l) => {
    try { await Haptics.selectionAsync(); } catch {}
    setDirty(true);
    setFocusTime(String(f));
    setShortBreak(String(s));
    setLongBreak(String(l));
  };

  const saveSettings = async () => {
    if (saving) return;
    setSaving(true);
    const { f, s, l } = values;
    try {
      await AsyncStorage.multiSet([
        ['focusTime', String(f)],
        ['shortBreak', String(s)],
        ['longBreak', String(l)],
      ]);
      try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
      if (Platform.OS === 'android') {
        ToastAndroid.show('Ayarlar kaydedildi', ToastAndroid.SHORT);
      }
      // PomodoroScreen’e canlı güncelle
      DeviceEventEmitter.emit('settingsUpdated', {
        focusTime: f,
        shortBreak: s,
        longBreak: l,
      });
      setDirty(false);
      navigation.goBack();
    } catch (e) {
      if (Platform.OS === 'android') {
        ToastAndroid.show('Kaydetme hatası', ToastAndroid.SHORT);
      } else {
        Alert.alert('Hata', 'Ayarlar kaydedilemedi.');
      }
    } finally {
      setSaving(false);
    }
  };

  const sendTestNotification = async () => {
    await Notifications.scheduleNotificationAsync({
      content: { title: '🔔 Test Bildirimi', body: 'Bu bir test bildirimidir!', sound: true },
      trigger: null, // hemen
    });
    Alert.alert('Başarılı ✅', 'Test bildirimi gönderildi.');
  };

  const saveDisabled = !dirty || saving;

  // iOS home indicator alanına küçük güvenli boşluk
  const bottomSafePad = Platform.OS === 'ios' ? 24 : 12;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: PALETTE.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>⚙️ Ayarlar</Text>
          <Text style={styles.subtitle}>Ritmini seç, akışını koru.</Text>
        </View>

        {/* İçerik */}
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: 140 }]} // footer altında alan bırak
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Preset Kartı */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Hazır Ayarlar</Text>
            <View style={styles.presetRow}>
              {[
                { label: 'Klasik 25/5/15', f: 25, s: 5, l: 15, bg: PALETTE.compBlue },
                { label: 'Kısa 20/3/10',  f: 20, s: 3, l: 10, bg: PALETTE.compMint },
                { label: 'Yoğun 50/10/20', f: 50, s: 10, l: 20, bg: PALETTE.compBlue },
              ].map((p) => (
                <TouchableOpacity
                  key={p.label}
                  style={[styles.presetChip, { backgroundColor: p.bg }]}
                  onPress={() => applyPreset(p.f, p.s, p.l)}
                  activeOpacity={0.9}
                >
                  <Text style={styles.presetText}>{p.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Süreler Kartı */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Süreler (dk)</Text>

            {/* Odak */}
            <View style={styles.row}>
              <View style={styles.labelWrap}>
                <Text style={styles.label}>Odak</Text>
                <Text style={styles.hint}>Min 1 • Max 180</Text>
              </View>
              <View style={styles.stepper}>
                <TouchableOpacity style={styles.stepBtn} onPress={() => bump('focus', -5)}><Text style={styles.stepBtnText}>–5</Text></TouchableOpacity>
                <TouchableOpacity style={styles.stepBtn} onPress={() => bump('focus', -1)}><Text style={styles.stepBtnText}>–</Text></TouchableOpacity>
                <TextInput
                  value={focusTime}
                  onChangeText={onChange(setFocusTime)}
                  keyboardType="number-pad"
                  style={styles.input}
                  placeholder="25"
                  maxLength={3}
                  placeholderTextColor={PALETTE.textMuted}
                />
                <TouchableOpacity style={styles.stepBtn} onPress={() => bump('focus', +1)}><Text style={styles.stepBtnText}>+</Text></TouchableOpacity>
                <TouchableOpacity style={styles.stepBtn} onPress={() => bump('focus', +5)}><Text style={styles.stepBtnText}>+5</Text></TouchableOpacity>
              </View>
            </View>

            {/* Kısa Mola */}
            <View style={styles.row}>
              <View style={styles.labelWrap}>
                <Text style={styles.label}>Kısa Mola</Text>
                <Text style={styles.hint}>Odaklar arası mini nefes</Text>
              </View>
              <View style={styles.stepper}>
                <TouchableOpacity style={styles.stepBtn} onPress={() => bump('short', -1)}><Text style={styles.stepBtnText}>–</Text></TouchableOpacity>
                <TextInput
                  value={shortBreak}
                  onChangeText={onChange(setShortBreak)}
                  keyboardType="number-pad"
                  style={styles.input}
                  placeholder="5"
                  maxLength={3}
                  placeholderTextColor={PALETTE.textMuted}
                />
                <TouchableOpacity style={styles.stepBtn} onPress={() => bump('short', +1)}><Text style={styles.stepBtnText}>+</Text></TouchableOpacity>
              </View>
            </View>

            {/* Uzun Mola */}
            <View style={styles.row}>
              <View style={styles.labelWrap}>
                <Text style={styles.label}>Uzun Mola</Text>
                <Text style={styles.hint}>4 odaktan sonra ödül</Text>
              </View>
              <View style={styles.stepper}>
                <TouchableOpacity style={styles.stepBtn} onPress={() => bump('long', -1)}><Text style={styles.stepBtnText}>–</Text></TouchableOpacity>
                <TextInput
                  value={longBreak}
                  onChangeText={onChange(setLongBreak)}
                  keyboardType="number-pad"
                  style={styles.input}
                  placeholder="15"
                  maxLength={3}
                  placeholderTextColor={PALETTE.textMuted}
                />
                <TouchableOpacity style={styles.stepBtn} onPress={() => bump('long', +1)}><Text style={styles.stepBtnText}>+</Text></TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Döngü Önizleme */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Döngü Önizlemesi</Text>
            <View style={styles.badgeRow}>
              <Text style={[styles.badge, { backgroundColor: PALETTE.primary }]}>Odak {values.f} dk</Text>
              <Text style={[styles.badge, { backgroundColor: PALETTE.compMint }]}>Kısa {values.s} dk</Text>
              <Text style={[styles.badge, { backgroundColor: PALETTE.primary }]}>Odak {values.f} dk</Text>
              <Text style={[styles.badge, { backgroundColor: PALETTE.compBlue }]}>Uzun {values.l} dk</Text>
            </View>
            <Text style={styles.cycleInfo}>Toplam: {totalCycleMin} dk • 1 döngü</Text>
          </View>

          {/* Bildirim Testi */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Bildirim</Text>
            <TouchableOpacity style={[styles.testBtn, { backgroundColor: PALETTE.action }]} onPress={sendTestNotification} activeOpacity={0.9}>
              <Text style={styles.testBtnText}>🔔 Test Bildirimi Gönder</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Sabit Alt Buton */}
        <View style={[styles.footer, { paddingBottom: bottomSafePad }]}>
          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: saveDisabled ? PALETTE.saveDisabled : PALETTE.primary }]}
            onPress={saveSettings}
            activeOpacity={saveDisabled ? 1 : 0.85}
            disabled={saveDisabled}
          >
            <Text style={styles.saveButtonText}>{saving ? 'Kaydediliyor…' : dirty ? 'Kaydet' : 'Güncel'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 6,
    backgroundColor: PALETTE.bg,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: PALETTE.text,
  },
  subtitle: {
    fontSize: 13,
    color: PALETTE.textMuted,
    marginTop: 4,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  card: {
    backgroundColor: PALETTE.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PALETTE.stroke,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: PALETTE.text,
    marginBottom: 10,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  presetChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PALETTE.stroke,
  },
  presetText: {
    color: PALETTE.chipText,
    fontWeight: '600',
    fontSize: 13,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 10,
  },
  labelWrap: { flex: 1 },
  label: {
    color: PALETTE.text,
    fontSize: 15,
    fontWeight: '600',
  },
  hint: {
    color: PALETTE.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepBtn: {
    backgroundColor: '#EFEFEF',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  stepBtnText: {
    color: PALETTE.text,
    fontWeight: '700',
    fontSize: 14,
  },
  input: {
    width: 64,
    textAlign: 'center',
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: PALETTE.stroke,
    color: PALETTE.text,
    backgroundColor: '#FFF',
    fontWeight: '600',
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
  badge: {
    color: PALETTE.text,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    overflow: 'hidden',
    fontWeight: '600',
  },
  cycleInfo: {
    marginTop: 10,
    color: PALETTE.textMuted,
    fontSize: 12,
  },
  testBtn: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  testBtnText: {
    color: PALETTE.text,
    fontWeight: '700',
  },
  footer: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 10,
    backgroundColor: PALETTE.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: PALETTE.stroke,
  },
  saveButton: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 0.3,
  },
});
