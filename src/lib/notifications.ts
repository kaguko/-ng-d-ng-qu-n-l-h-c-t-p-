import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { fromISO, toMinutes } from '@/lib/date';
import { Subject, Task } from '@/types';

const CHANNEL = 'study-reminders';
// iOS chỉ giữ tối đa 64 thông báo đang chờ.
const MAX_SCHEDULED = 60;

const supported = Platform.OS === 'android' || Platform.OS === 'ios';

if (supported) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export const remindersSupported = supported;

async function ensureChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL, {
    name: 'Nhắc giờ học',
    importance: Notifications.AndroidImportance.HIGH,
  });
}

/** Xin quyền thông báo; trả về true nếu được cấp. */
export async function requestReminderPermission(): Promise<boolean> {
  if (!supported) return false;
  try {
    await ensureChannel();
    const cur = await Notifications.getPermissionsAsync();
    if (cur.granted) return true;
    const res = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: false, allowSound: true },
    });
    return res.granted || res.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
  } catch {
    return false;
  }
}

/** Đặt lại toàn bộ lịch nhắc theo danh sách buổi học hiện tại. */
export async function syncReminders(
  tasks: Task[],
  subjects: Subject[],
  enabled: boolean,
  leadMin: number,
): Promise<void> {
  if (!supported) return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (!enabled) return;
    if (!(await Notifications.getPermissionsAsync()).granted) return;
    await ensureChannel();

    const now = Date.now();
    const upcoming = tasks
      .filter((t) => !t.done)
      .map((t) => {
        const at = fromISO(t.date);
        at.setMinutes(toMinutes(t.start) - leadMin);
        return { t, at };
      })
      .filter((x) => x.at.getTime() > now + 5000)
      .sort((a, b) => a.at.getTime() - b.at.getTime())
      .slice(0, MAX_SCHEDULED);

    for (const { t, at } of upcoming) {
      const subject = subjects.find((s) => s.id === t.subjectId);
      const when = leadMin > 0 ? `Còn ${leadMin} phút nữa` : 'Đến giờ học rồi';
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `${subject ? subject.emoji + ' ' : '📚 '}${t.title}`,
          body: `${when} · ${t.start}, ${t.duration} phút`,
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: at,
          channelId: CHANNEL,
        },
      });
    }
  } catch {
    // lỗi lập lịch nhắc không được làm hỏng app
  }
}
