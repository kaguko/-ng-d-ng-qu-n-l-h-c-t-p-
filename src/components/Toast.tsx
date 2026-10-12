import { Ionicons } from '@expo/vector-icons';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBannerInset } from '@/components/ui';
import { colors, radius } from '@/theme';

type ToastOpts = { icon?: keyof typeof Ionicons.glyphMap; action?: { label: string; onPress: () => void } };
type Toast = ToastOpts & { id: number; message: string };

const Ctx = createContext<(message: string, opts?: ToastOpts) => void>(() => {});

const DURATION = 3500;
// có nút (VD "Hoàn tác") thì để lâu hơn cho kịp bấm
const ACTION_DURATION = 7000;

/** Thông báo ngắn ở đáy màn hình, có thể kèm nút (VD "Hoàn tác"). */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const [anim] = useState(() => new Animated.Value(0));
  const insets = useSafeAreaInsets();
  const bannerInset = useBannerInset();

  const show = useCallback((message: string, opts?: ToastOpts) => setToast({ ...opts, message, id: Date.now() }), []);

  useEffect(() => {
    if (!toast) return;
    anim.setValue(0);
    Animated.timing(anim, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    const id = setTimeout(() => setToast((t) => (t?.id === toast.id ? null : t)), toast.action ? ACTION_DURATION : DURATION);
    return () => clearTimeout(id);
  }, [toast, anim]);

  return (
    <Ctx.Provider value={show}>
      {children}
      {toast && (
        <Animated.View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            left: 16,
            right: 16,
            // nằm trên thanh tab nổi
            bottom: Math.max(insets.bottom, 8) + 84 + bannerInset,
            opacity: anim,
            transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
          }}
        >
          <View
            accessibilityLiveRegion="polite"
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              backgroundColor: colors.surface2,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: radius.md,
              paddingVertical: 12,
              paddingHorizontal: 14,
              elevation: 16,
              shadowColor: '#000',
              shadowOpacity: 0.4,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 6 },
            }}
          >
            <Ionicons name={toast.icon ?? 'checkmark-circle'} size={20} color={colors.accent} />
            <Text style={{ color: colors.text, flex: 1, fontSize: 14 }}>{toast.message}</Text>
            {toast.action && (
              <Pressable
                hitSlop={10}
                onPress={() => {
                  toast.action!.onPress();
                  setToast(null);
                }}
              >
                <Text style={{ color: colors.accent, fontWeight: '800' }}>{toast.action.label}</Text>
              </Pressable>
            )}
          </View>
        </Animated.View>
      )}
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
