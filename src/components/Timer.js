// src/components/Timer.js
import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Colors } from '../theme/colors';

export default function Timer({
  progress,              // 0..1
  timeLeft,              // "MM:SS"
  size,                  // px (opsiyonel)
  strokeWidth = 16,
  tintColor = Colors.primary,
  backgroundStroke = Colors.progressBackground,
  textColor = Colors.text,
}) {
  const { width } = Dimensions.get('window');
  const computedSize = size ?? Math.min(320, Math.max(220, Math.floor(width * 0.65)));
  const radius = (computedSize - strokeWidth) / 2;
  const cx = computedSize / 2;
  const cy = computedSize / 2;

  const circumference = 2 * Math.PI * radius;
  const dash = Math.max(0, Math.min(1, progress)) * circumference;
  const strokeDashoffset = circumference - dash;

  return (
    <View style={styles.container}>
      <Svg width={computedSize} height={computedSize}>
        {/* Arka plan halkası */}
        <Circle
          stroke={backgroundStroke}
          fill="none"
          cx={cx}
          cy={cy}
          r={radius}
          strokeWidth={strokeWidth}
        />
        {/* İlerleme halkası */}
        <Circle
          stroke={tintColor}
          fill="none"
          cx={cx}
          cy={cy}
          r={radius}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${cx}, ${cy}`}
        />
      </Svg>

      {/* Süre yazısı */}
      <Text style={[styles.timerText, { color: textColor, fontSize: Math.floor(computedSize / 6.5) }]}>
        {timeLeft}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { justifyContent: 'center', alignItems: 'center' },
  timerText: {
    position: 'absolute',
    fontFamily: 'Poppins-Bold',
  },
});
