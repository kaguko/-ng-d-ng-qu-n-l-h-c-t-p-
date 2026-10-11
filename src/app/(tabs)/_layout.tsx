import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { ColorValue } from 'react-native';
import { FloatingTabBar } from '@/components/FloatingTabBar';
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
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={tab('Hôm nay', 'flame-outline', 'flame')} />
      <Tabs.Screen name="schedule" options={tab('Lịch', 'calendar-outline', 'calendar')} />
      <Tabs.Screen name="planner" options={tab('AI', 'sparkles-outline', 'sparkles')} />
      <Tabs.Screen name="map" options={tab('Bản đồ', 'git-network-outline', 'git-network')} />
      <Tabs.Screen name="stats" options={tab('Thống kê', 'stats-chart-outline', 'stats-chart')} />
      <Tabs.Screen name="settings" options={tab('Cài đặt', 'settings-outline', 'settings')} />
    </Tabs>
  );
}
