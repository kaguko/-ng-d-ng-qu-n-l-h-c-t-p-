import React from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { colors } from '@/theme';

export function ProgressRing({
  size,
  stroke = 12,
  progress,
  center,
  caption,
}: {
  size: number;
  stroke?: number;
  progress: number;
  center: string;
  caption?: string;
}) {
  const p = Math.max(0, Math.min(1, progress));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Defs>
          <SvgGradient id="g" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#7C5CFF" />
            <Stop offset="1" stopColor="#22D3EE" />
          </SvgGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.surface2} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="url(#g)"
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={c * (1 - p)}
        />
      </Svg>
      <Text style={{ color: colors.text, fontSize: size / 4.2, fontWeight: '800' }}>{center}</Text>
      {caption ? <Text style={{ color: colors.muted, fontSize: 12 }}>{caption}</Text> : null}
    </View>
  );
}
