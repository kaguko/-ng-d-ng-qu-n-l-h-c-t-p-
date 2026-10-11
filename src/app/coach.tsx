import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useRef, useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Chip, ErrorBox } from '@/components/ui';
import { buildCoachContext } from '@/lib/coachContext';
import { nowHHmm, todayISO } from '@/lib/date';
import { ChatMessage, coachReply, GeminiError } from '@/lib/gemini';
import { useStore } from '@/store';
import { colors, gradients, radius } from '@/theme';
import { LinearGradient } from 'expo-linear-gradient';

const SUGGESTIONS = [
  'Tuần này mình nên ưu tiên gì?',
  'Đánh giá tuần qua của mình',
  'Mình đang bị trễ, làm sao theo kịp?',
];

// Chỉ gửi vài lượt gần nhất để giữ yêu cầu nhỏ gọn.
const MAX_HISTORY = 12;

export default function Coach() {
  const { apiKey, settings, tasks, logs, subjects, streak } = useStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const scroller = useRef<ScrollView>(null);

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || busy) return;
    setError('');
    if (!apiKey) {
      setError('Hãy nhập API key Gemini trong tab Cài đặt trước.');
      return;
    }
    const next: ChatMessage[] = [...messages, { role: 'user', text: content }];
    setMessages(next);
    setInput('');
    setBusy(true);
    try {
      const reply = await coachReply({
        apiKey,
        model: settings.model,
        context: buildCoachContext({
          today: todayISO(),
          now: nowHHmm(),
          tasks,
          logs,
          subjects,
          dailyGoalMin: settings.dailyGoalMin,
          streak,
        }),
        history: next.slice(-MAX_HISTORY),
      });
      setMessages([...next, { role: 'model', text: reply }]);
    } catch (e) {
      setError(e instanceof GeminiError ? e.message : 'Có lỗi xảy ra, thử lại nhé.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 20, paddingBottom: 12 }}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Quay lại">
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800' }}>Hỏi Lumo</Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>Huấn luyện viên hiểu lịch và tiến độ của bạn</Text>
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView
          ref={scroller}
          contentContainerStyle={{ padding: 20, paddingTop: 8, gap: 12 }}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: true })}
        >
          {messages.length === 0 && (
            <View style={{ gap: 12 }}>
              <Text style={{ color: colors.muted, lineHeight: 20 }}>
                Hỏi bất cứ điều gì về việc học. Lumo sẽ trả lời dựa trên lịch học, nhật ký tập trung và chuỗi ngày học thật của bạn.
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {SUGGESTIONS.map((s) => (
                  <Chip key={s} label={s} onPress={() => send(s)} />
                ))}
              </View>
            </View>
          )}

          {messages.map((m, idx) => (
            <View
              key={idx}
              style={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '88%',
                backgroundColor: m.role === 'user' ? colors.primary : colors.surface,
                borderWidth: m.role === 'user' ? 0 : 1,
                borderColor: colors.border,
                borderRadius: radius.lg,
                padding: 12,
              }}
            >
              <Text style={{ color: colors.text, fontSize: 15, lineHeight: 22 }} selectable>
                {m.text}
              </Text>
            </View>
          ))}

          {busy && <Text style={{ color: colors.muted }}>Lumo đang suy nghĩ…</Text>}
          {error ? <ErrorBox message={error} /> : null}
        </ScrollView>

        <View style={{ flexDirection: 'row', gap: 10, padding: 16, alignItems: 'flex-end' }}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Nhập câu hỏi…"
            placeholderTextColor={colors.muted}
            multiline
            style={{
              flex: 1,
              maxHeight: 120,
              backgroundColor: colors.surface2,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: radius.lg,
              paddingHorizontal: 16,
              paddingVertical: 12,
              color: colors.text,
              fontSize: 15,
            }}
          />
          <Pressable onPress={() => send(input)} disabled={busy || !input.trim()} accessibilityLabel="Gửi">
            <LinearGradient
              colors={gradients.primary}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: busy || !input.trim() ? 0.5 : 1,
              }}
            >
              <Ionicons name="arrow-up" size={24} color="#fff" />
            </LinearGradient>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
