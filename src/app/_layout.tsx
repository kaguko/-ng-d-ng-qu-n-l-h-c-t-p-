import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ToastProvider } from '@/components/Toast';
import { syncFocusAlarm, syncReminders } from '@/lib/notifications';
import { StoreProvider, useStore } from '@/store';
import { colors } from '@/theme';

function Gate() {
  const { ready, tasks, subjects, settings, focus } = useStore();

  useEffect(() => {
    if (!ready) return;
    const id = setTimeout(() => syncReminders(tasks, subjects, settings.reminders, settings.reminderLead), 600);
    return () => clearTimeout(id);
  }, [ready, tasks, subjects, settings.reminders, settings.reminderLead]);

  const focusEnd = focus?.endAt ?? null;
  const focusTitle = focus?.taskId ? tasks.find((t) => t.id === focus.taskId)?.title : undefined;
  useEffect(() => {
    if (ready) syncFocusAlarm(focusEnd, focusTitle);
  }, [ready, focusEnd, focusTitle]);

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
      <Stack.Screen name="focus" options={{ animation: 'slide_from_bottom' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <ToastProvider>
          <StatusBar style="light" />
          <Gate />
        </ToastProvider>
      </StoreProvider>
    </SafeAreaProvider>
  );
}
