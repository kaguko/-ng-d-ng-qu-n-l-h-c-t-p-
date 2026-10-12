import type { BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/theme';
import { FocusBanner } from './FocusBanner';

/** Thanh tab nổi, bo tròn; tab đang chọn có nền dạng viên thuốc. */
export function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', left: 14, right: 14, bottom: Math.max(insets.bottom, 8) + 6 }}
    >
      <FocusBanner />
      <View
        style={{
          flexDirection: 'row',
          height: 64,
          padding: 6,
          borderRadius: 28,
          backgroundColor: 'rgba(21,21,46,0.97)',
          borderWidth: 1,
          borderColor: colors.border,
          elevation: 14,
          shadowColor: '#000',
          shadowOpacity: 0.4,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
        }}
      >
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const focused = state.index === index;
          const color = focused ? colors.accent : colors.muted;
          const label = typeof options.title === 'string' ? options.title : route.name;

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
              onPress={() => {
                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) {
                  Haptics.selectionAsync().catch(() => {});
                  navigation.navigate(route.name, route.params);
                }
              }}
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                borderRadius: 22,
                backgroundColor: focused ? 'rgba(124,92,255,0.22)' : 'transparent',
              }}
            >
              {options.tabBarIcon?.({ focused, color, size: 22 })}
              <Text style={{ color, fontSize: 10, fontWeight: '700' }} numberOfLines={1}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
