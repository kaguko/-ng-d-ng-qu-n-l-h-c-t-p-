import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { ColorValue } from 'react-native';
import { colors } from '@/theme';

type IconName = keyof typeof Ionicons.glyphMap;

const tab = (title: string, icon: IconName, iconOn: IconName) => ({
  title,
  tabBarIcon: ({ color, focused, size }: { color: ColorValue; focused: boolean; size: number }) => (
    <Ionicons name={focused ? iconOn : icon} size={size} color={color} />
  ),
});

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={tab('Hôm nay', 'flame-outline', 'flame')} />
      <Tabs.Screen name="schedule" options={tab('Lịch', 'calendar-outline', 'calendar')} />
      <Tabs.Screen name="planner" options={tab('AI', 'sparkles-outline', 'sparkles')} />
      <Tabs.Screen name="focus" options={tab('Tập trung', 'timer-outline', 'timer')} />
      <Tabs.Screen name="settings" options={tab('Cài đặt', 'settings-outline', 'settings')} />
    </Tabs>
  );
}
