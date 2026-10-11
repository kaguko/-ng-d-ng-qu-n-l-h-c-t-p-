# Lumo – Ứng dụng quản lý học tập có AI

Ứng dụng di động (Expo / React Native + TypeScript) giúp lập và theo dõi lịch học.
Tích hợp **Google Gemini** bằng API key do chính người dùng nhập – key lưu trong Keychain/Keystore của máy (`expo-secure-store`), gọi thẳng từ thiết bị tới Google, không qua máy chủ trung gian.

## Tính năng
- **Hôm nay**: tiến độ buổi học, thời gian tập trung so với mục tiêu, chuỗi ngày học (🔥), điểm chất lượng, lối tắt tới Tập trung / Hỏi Lumo. Nút *"AI xếp lại lịch"* tự dời các buổi bị lỡ.
- **Lịch**: dạng **lưới tuần** (ngày × giờ, ô màu theo môn, buổi trùng giờ xếp cạnh nhau) hoặc danh sách theo ngày; thêm/sửa/xoá, đánh dấu hoàn thành.
- **AI**: mô tả mục tiêu + khoảng ngày + giờ rảnh → Gemini tạo lịch **và bản đồ kiến thức** (chủ đề + liên kết tiên quyết). Một bộ xếp lịch xác định sửa lại kết quả của AI (khung giờ, không trùng, nghỉ giữa buổi, trần giờ/ngày, không xếp vào quá khứ).
- **Bản đồ**: đồ thị kiến thức dạng phân tầng, đường liên kết có mũi tên, nút tô theo mức thành thạo (chưa học / đang học / nắm vững), khoá chủ đề chưa đủ tiên quyết. Chạm một nút để xem buổi học, chủ đề trước/sau, "Học ngay", sửa liên kết; có "AI gợi ý liên kết".
- **Thống kê**: điểm chất lượng học 0–100 (hoàn thành 40% + đều đặn 30% + đạt mục tiêu 20% + tự đánh giá 10%), phút tập trung 14 ngày, heatmap 12 tuần, thời gian theo môn, xu hướng tự đánh giá, tiến độ theo môn.
- **Tập trung**: Pomodoro tính theo mốc thời gian, bấm "Học ngay" từ một buổi để tự hoàn thành buổi đó; sau mỗi phiên tự đánh giá 1–5.
- **Hỏi Lumo**: huấn luyện viên AI trả lời dựa trên lịch, tiến độ và chuỗi ngày học của bạn.
- **Cài đặt**: nhập/kiểm tra API key, chọn model, mục tiêu ngày, nhắc giờ học (cần APK / development build), quản lý môn học.

## Chạy thử
```bash
npm install
npx expo start        # quét QR bằng Expo Go, hoặc nhấn a (Android) / i (iOS)
```
Lấy key miễn phí tại https://aistudio.google.com/apikey rồi dán vào tab **Cài đặt** → *Lưu & kiểm tra kết nối*.

## Lệnh hữu ích
```bash
npm run typecheck
npm test                 # test bộ xếp lịch, đồ thị, thống kê
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
