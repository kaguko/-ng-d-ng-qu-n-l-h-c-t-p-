import { Alert, Platform } from 'react-native';

/** Hộp thoại xác nhận cho thao tác phá huỷ; trên web dùng window.confirm. */
export function confirmAction(title: string, message: string, onOk: () => void, okLabel = 'Đồng ý', cancelLabel = 'Huỷ') {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n${message}`)) onOk();
    return;
  }
  Alert.alert(title, message, [
    { text: cancelLabel, style: 'cancel' },
    { text: okLabel, style: 'destructive', onPress: onOk },
  ]);
}
