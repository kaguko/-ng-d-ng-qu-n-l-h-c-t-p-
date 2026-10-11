import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import { fromISO, toMinutes } from '@/lib/date';
import { Subject, Task } from '@/types';

const CHANNEL = 'study-reminders';
// iOS chỉ giữ tối đa 64 thông báo đang chờ.
const MAX_SCHEDULED = 60;

type NotificationsModule = typeof import('expo-notifications');

// Expo Go không có native module của expo-notifications: import sẽ ném lỗi, kể cả khi
// Fast Refresh nạp lại module ngoài try/catch. Vì vậy không nạp nó trong Expo Go;
// nhắc giờ chỉ hoạt động ở development build / APK.
const inExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

let Notifications: NotificationsModule | null = null;
if ((Platform.OS === 'android' || Platform.OS === 'ios') && !inExpoGo) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Notifications = require('expo-notifications') as NotificationsModule;
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  } catch {
    Notifications = null;
  }
}

const supported = Notifications !== null;
export const remindersSupported = supported;

async function ensureChannel(N: NotificationsModule) {
  if (Platform.OS !== 'android') return;
  await N.setNotificationChannelAsync(CHANNEL, {
    name: 'Nhắc giờ học',
    importance: N.AndroidImportance.HIGH,
  });
}

/** Xin quyền thông báo; trả về true nếu được cấp. */
export async function requestReminderPermission(): Promise<boolean> {
  const N = Notifications;
  if (!N) return false;
  try {
    await ensureChannel(N);
    const cur = await N.getPermissionsAsync();
    if (cur.granted) return true;
    const res = await N.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: false, allowSound: true },
    });
    return res.granted || res.ios?.status === N.IosAuthorizationStatus.PROVISIONAL;
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
  const N = Notifications;
  if (!N) return;
  try {
    await N.cancelAllScheduledNotificationsAsync();
    if (!enabled) return;
    if (!(await N.getPermissionsAsync()).granted) return;
    await ensureChannel(N);

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
      await N.scheduleNotificationAsync({
        content: {
          title: `${subject ? subject.emoji + ' ' : '📚 '}${t.title}`,
          body: `${when} · ${t.start}, ${t.duration} phút`,
          sound: true,
        },
        trigger: {
          type: N.SchedulableTriggerInputTypes.DATE,
          date: at,
          channelId: CHANNEL,
        },
      });
    }
  } catch {
    // lỗi lập lịch nhắc không được làm hỏng app
  }
}
