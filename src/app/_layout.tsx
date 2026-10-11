import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { syncReminders } from '@/lib/notifications';
import { StoreProvider, useStore } from '@/store';
import { colors } from '@/theme';

function Gate() {
  const { ready, tasks, subjects, settings } = useStore();

  useEffect(() => {
    if (!ready) return;
    const id = setTimeout(() => syncReminders(tasks, subjects, settings.reminders, settings.reminderLead), 600);
    return () => clearTimeout(id);
  }, [ready, tasks, subjects, settings.reminders, settings.reminderLead]);

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="coach" options={{ animation: 'slide_from_right' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <StatusBar style="light" />
        <Gate />
      </StoreProvider>
    </SafeAreaProvider>
  );
}
