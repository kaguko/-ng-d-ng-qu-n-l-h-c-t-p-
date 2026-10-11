import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, gradients, radius } from '@/theme';

export function Screen({
  children,
  scroll = true,
  padBottom = 130, // chừa chỗ cho thanh tab nổi
}: {
  children: React.ReactNode;
  scroll?: boolean;
  padBottom?: number;
}) {
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: padBottom, gap: 16 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={{ flex: 1, padding: 20, gap: 16 }}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Title({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={styles.h1}>{children}</Text>
      {sub ? <Text style={styles.muted}>{sub}</Text> : null}
    </View>
  );
}

export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Text style={styles.h2}>{children}</Text>
      {right}
    </View>
  );
}

export function Button({
  label,
  onPress,
  icon,
  loading,
  disabled,
  variant = 'primary',
  style,
}: {
  label: string;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'ghost' | 'danger';
  style?: StyleProp<ViewStyle>;
}) {
  const off = disabled || loading;
  const content = (
    <>
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : icon ? (
        <Ionicons name={icon} size={18} color="#fff" />
      ) : null}
      <Text style={styles.btnText}>{label}</Text>
    </>
  );
  if (variant === 'primary') {
    return (
      <Pressable onPress={onPress} disabled={off} style={[{ opacity: off ? 0.5 : 1 }, style]}>
        <LinearGradient
          colors={gradients.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.btn, { borderRadius: radius.md }]}
        >
          {content}
        </LinearGradient>
      </Pressable>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      style={[
        styles.btn,
        {
          borderRadius: radius.md,
          opacity: off ? 0.5 : 1,
          backgroundColor: variant === 'danger' ? 'rgba(248,113,113,0.15)' : colors.surface2,
          borderWidth: 1,
          borderColor: variant === 'danger' ? colors.danger : colors.border,
        },
        style,
      ]}
    >
      {content}
    </Pressable>
  );
}

export function Chip({
  label,
  active,
  onPress,
  color,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  color?: string;
}) {
  const c = color ?? colors.primary;
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        active
          ? { backgroundColor: c + '33', borderColor: c }
          : { backgroundColor: colors.surface2, borderColor: colors.border },
      ]}
    >
      <Text style={{ color: active ? colors.text : colors.muted, fontWeight: '600', fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

export function Field({ label, style, ...props }: TextInputProps & { label?: string }) {
  return (
    <View style={{ gap: 6 }}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.muted}
        {...props}
        style={[styles.input, props.multiline && { minHeight: 80, textAlignVertical: 'top' }, style]}
      />
    </View>
  );
}

export function Stepper({
  label,
  value,
  onDec,
  onInc,
}: {
  label: string;
  value: string;
  onDec: () => void;
  onInc: () => void;
}) {
  return (
    <View style={{ flex: 1, gap: 6 }}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.stepper}>
        <Pressable onPress={onDec} hitSlop={8} style={styles.stepBtn}>
          <Ionicons name="remove" size={18} color={colors.text} />
        </Pressable>
        <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>{value}</Text>
        <Pressable onPress={onInc} hitSlop={8} style={styles.stepBtn}>
          <Ionicons name="add" size={18} color={colors.text} />
        </Pressable>
      </View>
    </View>
  );
}

export function Empty({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={{ alignItems: 'center', padding: 24, gap: 10 }}>
      <Ionicons name={icon} size={36} color={colors.muted} />
      <Text style={[styles.muted, { textAlign: 'center' }]}>{text}</Text>
    </View>
  );
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <View style={styles.error}>
      <Ionicons name="alert-circle" size={18} color={colors.danger} />
      <Text style={{ color: colors.danger, flex: 1, fontSize: 13 }}>{message}</Text>
    </View>
  );
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  h1: { color: colors.text, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  h2: { color: colors.text, fontSize: 18, fontWeight: '700' },
  muted: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  label: { color: colors.muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1 },
  input: {
    backgroundColor: colors.surface2,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 15,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface2,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 6,
  },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    backgroundColor: 'rgba(248,113,113,0.12)',
    borderRadius: radius.md,
    padding: 12,
  },
});
