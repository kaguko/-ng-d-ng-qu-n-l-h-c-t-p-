import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Alert, Linking, Platform, Pressable, Switch, Text, View } from 'react-native';
import { Button, Card, Chip, ErrorBox, Field, Screen, SectionTitle, Stepper, Title } from '@/components/ui';
import { formatDuration } from '@/lib/date';
import { GeminiError, testConnection } from '@/lib/gemini';
import { remindersSupported, requestReminderPermission } from '@/lib/notifications';
import { useStore } from '@/store';
import { colors } from '@/theme';

const MODELS = ['gemini-flash-latest', 'gemini-2.5-flash', 'gemini-2.5-pro'];

export default function Settings() {
  const { apiKey, setApiKey, settings, setSettings, subjects, deleteSubject, resetData } = useStore();
  const [keyDraft, setKeyDraft] = useState(apiKey);
  const [show, setShow] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [model, setModel] = useState(settings.model);

  const saveKey = async () => {
    await setApiKey(keyDraft);
    setStatus({ ok: true, msg: keyDraft.trim() ? 'Đã lưu key an toàn trên thiết bị.' : 'Đã xoá key.' });
  };

  const test = async () => {
    setTesting(true);
    setStatus(null);
    try {
      await setApiKey(keyDraft);
      await testConnection(keyDraft.trim(), model);
      setSettings({ model: model.trim() });
      setStatus({ ok: true, msg: 'Kết nối Gemini thành công ✅' });
    } catch (e) {
      setStatus({ ok: false, msg: e instanceof GeminiError ? e.message : 'Có lỗi xảy ra.' });
    } finally {
      setTesting(false);
    }
  };

  const toggleReminders = async (on: boolean) => {
    if (!on) return setSettings({ reminders: false });
    if (await requestReminderPermission()) return setSettings({ reminders: true });
    setSettings({ reminders: false });
    Alert.alert('Chưa có quyền thông báo', 'Hãy bật thông báo cho Lumo trong cài đặt hệ thống.', [
      { text: 'Để sau', style: 'cancel' },
      { text: 'Mở cài đặt', onPress: () => Linking.openSettings() },
    ]);
  };

  const confirm = (title: string, message: string, onOk: () => void) => {
    if (Platform.OS === 'web') {
      if (window.confirm(`${title}\n${message}`)) onOk();
      return;
    }
    Alert.alert(title, message, [
      { text: 'Huỷ', style: 'cancel' },
      { text: 'Đồng ý', style: 'destructive', onPress: onOk },
    ]);
  };

  return (
    <Screen>
      <Title sub="Lumo dùng key Gemini của chính bạn, không qua máy chủ trung gian.">Cài đặt</Title>

      <Card>
        <SectionTitle>Gemini API key</SectionTitle>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Field
              value={keyDraft}
              onChangeText={setKeyDraft}
              placeholder="Dán API key (AIza…)"
              secureTextEntry={!show}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          <Pressable onPress={() => setShow(!show)} hitSlop={8}>
            <Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={22} color={colors.muted} />
          </Pressable>
        </View>

        <Field label="Model" value={model} onChangeText={setModel} autoCapitalize="none" autoCorrect={false} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {MODELS.map((m) => (
            <Chip key={m} label={m} active={model === m} onPress={() => setModel(m)} />
          ))}
        </View>

        {status ? (
          status.ok ? (
            <Text style={{ color: colors.success, fontWeight: '600' }}>{status.msg}</Text>
          ) : (
            <ErrorBox message={status.msg} />
          )
        ) : null}

        <Button label="Lưu & kiểm tra kết nối" icon="flash" onPress={test} loading={testing} disabled={!keyDraft.trim()} />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button label="Chỉ lưu" variant="ghost" onPress={saveKey} style={{ flex: 1 }} />
          <Button
            label="Lấy key miễn phí"
            icon="open-outline"
            variant="ghost"
            onPress={() => Linking.openURL('https://aistudio.google.com/apikey')}
            style={{ flex: 1 }}
          />
        </View>
        <Text style={{ color: colors.muted, fontSize: 12 }}>
          Key được lưu trong Keychain/Keystore của thiết bị. Nội dung mục tiêu học tập bạn nhập sẽ được gửi tới Google Gemini để tạo lịch.
        </Text>
      </Card>

      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <SectionTitle>Nhắc giờ học</SectionTitle>
          <Switch
            value={settings.reminders}
            onValueChange={toggleReminders}
            disabled={!remindersSupported}
            trackColor={{ true: colors.primary, false: colors.border }}
          />
        </View>
        {!remindersSupported ? (
          <Text style={{ color: colors.muted, fontSize: 12 }}>Nhắc giờ học cần bản APK / development build (không chạy trong Expo Go hay web).</Text>
        ) : settings.reminders ? (
          <View style={{ flexDirection: 'row' }}>
            <Stepper
              label="Nhắc trước"
              value={settings.reminderLead === 0 ? 'Đúng giờ' : `${settings.reminderLead} phút`}
              onDec={() => setSettings({ reminderLead: Math.max(0, settings.reminderLead - 5) })}
              onInc={() => setSettings({ reminderLead: Math.min(60, settings.reminderLead + 5) })}
            />
          </View>
        ) : (
          <Text style={{ color: colors.muted, fontSize: 12 }}>Nhận thông báo trước mỗi buổi học chưa hoàn thành.</Text>
        )}
      </Card>

      <Card>
        <SectionTitle>Mục tiêu mỗi ngày</SectionTitle>
        <View style={{ flexDirection: 'row' }}>
          <Stepper
            label="Thời gian tập trung"
            value={formatDuration(settings.dailyGoalMin)}
            onDec={() => setSettings({ dailyGoalMin: Math.max(15, settings.dailyGoalMin - 15) })}
            onInc={() => setSettings({ dailyGoalMin: Math.min(720, settings.dailyGoalMin + 15) })}
          />
        </View>
      </Card>

      <Card>
        <SectionTitle>Môn học</SectionTitle>
        {subjects.length === 0 ? (
          <Text style={{ color: colors.muted }}>Chưa có môn nào. Thêm trong tab AI khi lập lịch.</Text>
        ) : (
          subjects.map((s) => (
            <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: s.color }} />
              <Text style={{ color: colors.text, flex: 1, fontWeight: '600' }}>
                {s.emoji} {s.name}
              </Text>
              <Pressable
                hitSlop={10}
                onPress={() => confirm('Xoá môn học', `Xoá "${s.name}"? Các buổi học sẽ chuyển thành không có môn.`, () => deleteSubject(s.id))}
              >
                <Ionicons name="trash-outline" size={20} color={colors.danger} />
              </Pressable>
            </View>
          ))
        )}
      </Card>

      <Button
        label="Xoá toàn bộ dữ liệu học tập"
        icon="trash-outline"
        variant="danger"
        onPress={() => confirm('Xoá dữ liệu', 'Toàn bộ lịch, môn học và lịch sử tập trung sẽ bị xoá.', resetData)}
      />
    </Screen>
  );
}
