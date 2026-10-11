# Lumo – Ứng dụng quản lý học tập có AI

Ứng dụng di động (Expo / React Native + TypeScript) giúp lập và theo dõi lịch học.
Tích hợp **Google Gemini** bằng API key do chính người dùng nhập – key lưu trong Keychain/Keystore của máy (`expo-secure-store`), gọi thẳng từ thiết bị tới Google, không qua máy chủ trung gian.

## Tính năng
- **Hôm nay**: tiến độ buổi học, thời gian tập trung so với mục tiêu, chuỗi ngày học (🔥), biểu đồ 7 ngày.
- **Lịch**: dải ngày, thêm/sửa/xoá buổi học, đánh dấu hoàn thành.
- **AI**: mô tả mục tiêu + khoảng ngày + giờ rảnh → Gemini tạo lịch (ôn ngắt quãng, tránh trùng giờ đã bận), xem trước rồi mới thêm vào lịch. Nút *"AI xếp lại lịch"* tự dời các buổi bị lỡ.
- **Tập trung**: đồng hồ Pomodoro tính theo mốc thời gian, tự ghi nhật ký phút học.
- **Cài đặt**: nhập/kiểm tra API key, chọn model, mục tiêu ngày, quản lý môn học.

## Chạy thử
```bash
npm install
npx expo start        # quét QR bằng Expo Go, hoặc nhấn a (Android) / i (iOS)
```
Lấy key miễn phí tại https://aistudio.google.com/apikey rồi dán vào tab **Cài đặt** → *Lưu & kiểm tra kết nối*.

## Lệnh hữu ích
```bash
npm run typecheck
npx expo lint
npx eas-cli@latest build -p android --profile preview   # build APK/AAB trên cloud
```

## Cấu trúc
```
src/app/            màn hình (Expo Router, tabs)
src/components/     UI dùng chung
src/lib/gemini.ts   gọi Gemini (JSON schema + kiểm tra đầu ra)
src/store.tsx       state + lưu AsyncStorage
```
