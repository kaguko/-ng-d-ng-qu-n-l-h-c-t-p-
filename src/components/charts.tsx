import React, { useState } from 'react';
import { LayoutChangeEvent, Text, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { colors, heatRamp } from '@/theme';

// Quy cách (dataviz): cột <= 24px, bo 4px ở đầu cột, đường 2px, chấm >= 8px có viền 2px màu nền,
// lưới mảnh và mờ, nhãn chọn lọc, chữ dùng màu chữ (không dùng màu dữ liệu).
const SURFACE = colors.surface;
const GRID = colors.border;
const SERIES = '#3987E5';
const SERIES_SELECTED = '#9EC5F4';

function useWidth(initial = 300) {
  const [w, setW] = useState(initial);
  return { w, onLayout: (e: LayoutChangeEvent) => setW(Math.max(120, Math.floor(e.nativeEvent.layout.width))) };
}

function niceMax(v: number): number {
  if (v <= 0) return 60;
  const steps = [30, 60, 90, 120, 180, 240, 360, 480, 600];
  return steps.find((s) => s >= v) ?? Math.ceil(v / 120) * 120;
}

export const fmtMin = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}g${m % 60 ? String(m % 60).padStart(2, '0') : ''}` : `${m}'`);

// ---------------------------------------------------------------------------------------------

export type Bar = { key: string; label: string; value: number };

export function BarChart({
  data,
  goal,
  height = 150,
  selectedKey,
  onSelect,
}: {
  data: Bar[];
  goal?: number;
  height?: number;
  selectedKey?: string | null;
  onSelect?: (b: Bar) => void;
}) {
  const { w, onLayout } = useWidth();
  const left = 30;
  const bottom = 20;
  const top = 20; // chừa chỗ cho nhãn mục tiêu
  const plotH = height - bottom - top;
  const max = niceMax(Math.max(goal ?? 0, ...data.map((d) => d.value)));
  const slot = (w - left) / Math.max(1, data.length);
  const barW = Math.min(24, slot * 0.62);
  const y = (v: number) => top + plotH - (v / max) * plotH;
  const base = top + plotH;
  const r = 4;

  return (
    <View onLayout={onLayout}>
      <Svg width={w} height={height}>
        {[0, max / 2, max].map((t) => (
          <G key={t}>
            <Line x1={left} x2={w} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} opacity={0.6} />
            <SvgText x={left - 6} y={y(t) + 3} fill={colors.muted} fontSize={10} textAnchor="end">
              {fmtMin(Math.round(t))}
            </SvgText>
          </G>
        ))}
        {data.map((d, i) => {
          const cx = left + slot * i + slot / 2;
          const x = cx - barW / 2;
          const h = Math.max(d.value > 0 ? 4 : 0, base - y(d.value));
          const top2 = base - h;
          const sel = d.key === selectedKey;
          return (
            <G key={d.key} onPress={() => onSelect?.(d)}>
              <Rect x={left + slot * i} y={top} width={slot} height={plotH + bottom} fill="transparent" />
              {h > 0 && (
                <Path
                  d={`M${x} ${base} L${x} ${top2 + r} Q${x} ${top2} ${x + r} ${top2} L${x + barW - r} ${top2} Q${x + barW} ${top2} ${x + barW} ${top2 + r} L${x + barW} ${base} Z`}
                  fill={sel ? SERIES_SELECTED : SERIES}
                />
              )}
              <SvgText x={cx} y={height - 5} fill={sel ? colors.text : colors.muted} fontSize={10} textAnchor="middle" fontWeight={sel ? '700' : '400'}>
                {d.label}
              </SvgText>
            </G>
          );
        })}
        {goal ? (
          <G>
            <Line x1={left} x2={w} y1={y(goal)} y2={y(goal)} stroke={colors.muted} strokeWidth={1} />
            <SvgText x={w} y={y(goal) - 4} fill={colors.muted} fontSize={10} textAnchor="end">
              Mục tiêu {fmtMin(goal)}
            </SvgText>
          </G>
        ) : null}
      </Svg>
    </View>
  );
}

// ---------------------------------------------------------------------------------------------

export type HeatCell = { date: string; minutes: number };

function heatColor(minutes: number, goal: number): string {
  if (minutes <= 0) return colors.surface2;
  const f = minutes / Math.max(1, goal);
  if (f >= 1.5) return heatRamp[5];
  if (f >= 1) return heatRamp[4];
  if (f >= 0.75) return heatRamp[3];
  if (f >= 0.5) return heatRamp[2];
  if (f >= 0.25) return heatRamp[1];
  return heatRamp[0];
}

export function Heatmap({
  weeks,
  dates,
  goal,
  selectedDate,
  onSelect,
}: {
  /** cột = tuần (cũ -> mới), hàng = T2..CN; null = chưa tới */
  weeks: (number | null)[][];
  /** ngày tương ứng từng ô, cùng kích thước với weeks */
  dates: string[][];
  goal: number;
  selectedDate?: string | null;
  onSelect?: (c: HeatCell) => void;
}) {
  const { w, onLayout } = useWidth();
  const gap = 3;
  const labelW = 18;
  const n = weeks.length;
  const cell = Math.max(10, Math.min(24, Math.floor((w - labelW - (n - 1) * gap) / n)));
  const H = 7 * cell + 6 * gap;
  const labels = ['T2', '', 'T4', '', 'T6', '', 'CN'];

  return (
    <View onLayout={onLayout}>
      <Svg width={w} height={H}>
        {labels.map((l, row) =>
          l ? (
            <SvgText key={row} x={0} y={row * (cell + gap) + cell * 0.72} fill={colors.muted} fontSize={9}>
              {l}
            </SvgText>
          ) : null,
        )}
        {weeks.map((col, wi) =>
          col.map((m, row) => {
            if (m === null) return null;
            const date = dates[wi][row];
            return (
              <Rect
                key={date}
                x={labelW + wi * (cell + gap)}
                y={row * (cell + gap)}
                width={cell}
                height={cell}
                rx={4}
                fill={heatColor(m, goal)}
                stroke={date === selectedDate ? colors.text : 'none'}
                strokeWidth={date === selectedDate ? 1.5 : 0}
                onPress={() => onSelect?.({ date, minutes: m })}
              />
            );
          }),
        )}
      </Svg>
    </View>
  );
}

export function HeatLegend() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Text style={{ color: colors.muted, fontSize: 10 }}>Ít</Text>
      {[colors.surface2, ...heatRamp].map((c, i) => (
        <View key={i} style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: c }} />
      ))}
      <Text style={{ color: colors.muted, fontSize: 10 }}>Nhiều</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------------------------

export type Slice = { key: string; label: string; value: number; color: string };

export function Donut({
  slices,
  size = 150,
  centerTop,
  centerBottom,
  selectedKey,
  onSelect,
}: {
  slices: Slice[];
  size?: number;
  centerTop: string;
  centerBottom: string;
  selectedKey?: string | null;
  onSelect?: (s: Slice) => void;
}) {
  const stroke = 22;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const total = slices.reduce((s, x) => s + x.value, 0);
  const gap = slices.length > 1 ? 2 : 0; // khe 2px màu nền giữa các cung
  let acc = 0;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.surface2} strokeWidth={stroke} fill="none" />
        {total > 0 &&
          slices.map((s) => {
            const len = (s.value / total) * c;
            const seg = (
              <Circle
                key={s.key}
                cx={size / 2}
                cy={size / 2}
                r={r}
                stroke={s.color}
                strokeWidth={s.key === selectedKey ? stroke + 4 : stroke}
                fill="none"
                strokeDasharray={`${Math.max(0, len - gap)} ${c}`}
                strokeDashoffset={-acc}
                onPress={() => onSelect?.(s)}
              />
            );
            acc += len;
            return seg;
          })}
      </Svg>
      <Text style={{ color: colors.text, fontSize: 24, fontWeight: '800' }}>{centerTop}</Text>
      <Text style={{ color: colors.muted, fontSize: 11 }}>{centerBottom}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------------------------

export type LinePoint = { key: string; label: string; value: number | null };

export function LineChart({
  data,
  min,
  max,
  height = 130,
  ticks,
  selectedKey,
  onSelect,
}: {
  data: LinePoint[];
  min: number;
  max: number;
  height?: number;
  ticks: number[];
  selectedKey?: string | null;
  onSelect?: (p: LinePoint) => void;
}) {
  const { w, onLayout } = useWidth();
  const left = 22;
  const bottom = 18;
  const top = 10;
  const right = 18;
  const plotH = height - top - bottom;
  const slot = (w - left - right) / Math.max(1, data.length - 1);
  const x = (i: number) => left + i * slot;
  const y = (v: number) => top + plotH - ((v - min) / (max - min)) * plotH;
  const pts = data.map((d, i) => (d.value === null ? null : { i, v: d.value, key: d.key, label: d.label }));
  const real = pts.filter((p): p is NonNullable<typeof p> => p !== null);
  const path = real.map((p, k) => `${k ? 'L' : 'M'}${x(p.i)} ${y(p.v)}`).join(' ');
  const last = real[real.length - 1];

  return (
    <View onLayout={onLayout}>
      <Svg width={w} height={height}>
        {ticks.map((t) => (
          <G key={t}>
            <Line x1={left} x2={w - right} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} opacity={0.6} />
            <SvgText x={left - 6} y={y(t) + 3} fill={colors.muted} fontSize={10} textAnchor="end">
              {t}
            </SvgText>
          </G>
        ))}
        {path ? <Path d={path} stroke={SERIES} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" /> : null}
        {real.map((p) => (
          <G key={p.key} onPress={() => onSelect?.({ key: p.key, label: p.label, value: p.v })}>
            <Circle cx={x(p.i)} cy={y(p.v)} r={14} fill="transparent" />
            <Circle
              cx={x(p.i)}
              cy={y(p.v)}
              r={p.key === selectedKey ? 5.5 : 4}
              fill={p.key === selectedKey ? SERIES_SELECTED : SERIES}
              stroke={SURFACE}
              strokeWidth={2}
            />
          </G>
        ))}
        {last ? (
          <SvgText x={Math.min(w - 4, x(last.i))} y={y(last.v) - 9} fill={colors.text} fontSize={11} fontWeight="700" textAnchor="middle">
            {last.v.toFixed(1)}
          </SvgText>
        ) : null}
        {[0, data.length - 1].map((i) => (
          <SvgText key={i} x={x(i)} y={height - 4} fill={colors.muted} fontSize={10} textAnchor={i === 0 ? 'start' : 'end'}>
            {data[i]?.label}
          </SvgText>
        ))}
      </Svg>
    </View>
  );
}

// ---------------------------------------------------------------------------------------------

export function Meter({ value, color = SERIES, height = 8 }: { value: number; color?: string; height?: number }) {
  return (
    <View style={{ height, borderRadius: height / 2, backgroundColor: colors.surface2, overflow: 'hidden' }}>
      <View style={{ height, width: `${Math.max(0, Math.min(1, value)) * 100}%`, backgroundColor: color, borderRadius: height / 2 }} />
    </View>
  );
}

export function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: 18,
        padding: 12,
        gap: 2,
      }}
    >
      <Text style={{ color: colors.muted, fontSize: 11 }}>{label}</Text>
      <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800' }}>{value}</Text>
      {sub ? <Text style={{ color: colors.muted, fontSize: 11 }}>{sub}</Text> : null}
    </View>
  );
}
