import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { addDays, formatLong, fromMinutes, toMinutes } from '@/lib/date';
import { useStore } from '@/store';
import { colors } from '@/theme';
import { Task } from '@/types';
import { useToast } from './Toast';
import { Button, Chip, Field, Stepper } from './ui';

type Draft = {
  title: string;
  subjectId: string | null;
  topicId: string | undefined;
  date: string;
  start: string;
  duration: number;
  note: string;
};

/** Thêm mới (task = null) hoặc sửa một buổi học. */
export function TaskEditor({
  visible,
  task,
  defaultDate,
  defaultStart,
  onClose,
}: {
  visible: boolean;
  task: Task | null;
  defaultDate: string;
  /** giờ bắt đầu gợi ý khi thêm mới (VD chạm vào ô trống trên lưới tuần) */
  defaultStart?: string;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      {visible ? <EditorForm task={task} defaultDate={defaultDate} defaultStart={defaultStart} onClose={onClose} /> : null}
    </Modal>
  );
}

function EditorForm({
  task,
  defaultDate,
  defaultStart,
  onClose,
}: {
  task: Task | null;
  defaultDate: string;
  defaultStart?: string;
  onClose: () => void;
}) {
  const { subjects, topics, addTask, updateTask, deleteTask, restoreTask } = useStore();
  const toast = useToast();
  const [d, setD] = useState<Draft>(() =>
    task
      ? {
          title: task.title,
          subjectId: task.subjectId,
          topicId: task.topicId,
          date: task.date,
          start: task.start,
          duration: task.duration,
          note: task.note ?? '',
        }
      : { title: '', subjectId: null, topicId: undefined, date: defaultDate, start: defaultStart ?? '19:00', duration: 45, note: '' },
  );

  const save = () => {
    if (!d.title.trim()) return;
    const payload = {
      title: d.title.trim(),
      subjectId: d.subjectId,
      topicId: d.topicId,
      date: d.date,
      start: d.start,
      duration: d.duration,
      note: d.note.trim() || undefined,
    };
    if (task) updateTask(task.id, payload);
    else addTask(payload);
    toast(task ? 'Đã lưu thay đổi' : 'Đã thêm buổi học');
    onClose();
  };

  return (
    <>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20 }}>
            <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800' }}>
              {task ? 'Sửa buổi học' : 'Buổi học mới'}
            </Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name='close' size={26} color={colors.muted} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 0, gap: 16 }} keyboardShouldPersistTaps='handled'>
            <Field label="Nội dung" value={d.title} onChangeText={(title) => setD({ ...d, title })} placeholder="VD: Ôn chương 3 – Đạo hàm" />

            <View style={{ gap: 8 }}>
              <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' }}>Môn học</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <Chip label="Không" active={d.subjectId === null} onPress={() => setD({ ...d, subjectId: null })} />
                {subjects.map((s) => (
                  <Chip
                    key={s.id}
                    label={`${s.emoji} ${s.name}`}
                    color={s.color}
                    active={d.subjectId === s.id}
                    onPress={() => setD({ ...d, subjectId: s.id })}
                  />
                ))}
              </View>
              {subjects.length === 0 && (
                <Text style={{ color: colors.muted, fontSize: 12 }}>Thêm môn học trong tab Cài đặt hoặc Lập lịch AI.</Text>
              )}
            </View>

            {topics.length > 0 && (
              <View style={{ gap: 8 }}>
                <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' }}>Chủ đề kiến thức</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  <Chip label="Không" active={d.topicId === undefined} onPress={() => setD({ ...d, topicId: undefined })} />
                  {topics.map((t) => (
                    <Chip key={t.id} label={t.name} active={d.topicId === t.id} onPress={() => setD({ ...d, topicId: t.id })} />
                  ))}
                </View>
              </View>
            )}

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Stepper
                label="Ngày"
                value={formatLong(d.date)}
                onDec={() => setD({ ...d, date: addDays(d.date, -1) })}
                onInc={() => setD({ ...d, date: addDays(d.date, 1) })}
              />
            </View>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Stepper
                label="Bắt đầu"
                value={d.start}
                onDec={() => setD({ ...d, start: fromMinutes(Math.max(0, toMinutes(d.start) - 15)) })}
                onInc={() => setD({ ...d, start: fromMinutes(Math.min(1425, toMinutes(d.start) + 15)) })}
              />
              <Stepper
                label="Thời lượng"
                value={`${d.duration} phút`}
                onDec={() => setD({ ...d, duration: Math.max(15, d.duration - 15) })}
                onInc={() => setD({ ...d, duration: Math.min(240, d.duration + 15) })}
              />
            </View>

            <Field label="Ghi chú" value={d.note} onChangeText={(note) => setD({ ...d, note })} multiline placeholder="Tài liệu, bài tập cần làm…" />

            <Button label="Lưu" icon='checkmark' onPress={save} disabled={!d.title.trim()} />
            {task && (
              <Button
                label="Xoá buổi học"
                icon='trash-outline'
                variant='danger'
                onPress={() => {
                  const removed = deleteTask(task.id);
                  onClose();
                  if (removed) {
                    toast(`Đã xoá "${removed.title}"`, {
                      icon: 'trash-outline',
                      action: { label: 'Hoàn tác', onPress: () => restoreTask(removed) },
                    });
                  }
                }}
              />
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}
