// src/screens/PomodoroScreen.js
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar, Animated } from 'react-native';
import { Svg, Circle } from 'react-native-svg';
import usePomodoroTimer from '../features/pomodoro/usePomodoroTimer';
import { Colors, ModeTheme } from '../theme/colors';

const RING_SIZE = 260;
const STROKE_WIDTH = 16;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export default function PomodoroScreen() {
  const {
    mode,
    cycleCount,
    isActive,
    remainingMs,
    totalMs,
    progressAnim,   // ✅ Animated.Value
    toggle,
    reset,
    skip,
  } = usePomodoroTimer();

  const totalSeconds = Math.ceil(Math.max(0, remainingMs) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  // SVG halka metrikleri
  const radius = (RING_SIZE - STROKE_WIDTH) / 2;
  const circumference = 2 * Math.PI * radius;

  // ✅ Animated.Value.interpolate
  const animatedDashOffset = progressAnim.interpolate({
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

      <View style={{ marginVertical: 36 }}>
        <Svg width={RING_SIZE} height={RING_SIZE}>
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={radius}
            stroke={Colors.progressBackground}
            strokeWidth={STROKE_WIDTH}
            fill="none"
          />
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
        Tamamlanan odak: {cycleCount} • Toplam: {Math.round(totalMs/60000)} dk
      </Text>
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
});
