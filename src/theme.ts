export const colors = {
  bg: '#0B0B1E',
  surface: '#15152E',
  surface2: '#1E1E3F',
  border: '#2A2A52',
  primary: '#7C5CFF',
  accent: '#22D3EE',
  pink: '#FF5CAA',
  success: '#34D399',
  warn: '#FBBF24',
  danger: '#F87171',
  text: '#F3F4FF',
  muted: '#9A9CC4',
};

export const gradients = {
  primary: ['#7C5CFF', '#22D3EE'] as const,
  warm: ['#FF5CAA', '#FBBF24'] as const,
  card: ['#1E1E3F', '#15152E'] as const,
};

export const radius = { sm: 10, md: 16, lg: 24, pill: 999 };

// Bảng màu phân loại đã kiểm chứng (dataviz validate_palette, giao diện tối, nền #15152E):
// đạt dải độ sáng, độ bão hoà, tách biệt cho người mù màu và độ tương phản >= 3:1.
// Thứ tự cố định, không xoay vòng; màu theo môn học, không theo thứ hạng.
export const subjectPalette = [
  '#3987E5',
  '#D95926',
  '#199E70',
  '#C98500',
  '#D55181',
  '#008300',
  '#9085E9',
  '#E66767',
];

// Dải đơn sắc cho heatmap: càng sáng càng nhiều (nền tối). Bậc tối nhất vẫn >= 2:1 so với nền.
export const heatRamp = ['#184F95', '#1C5CAB', '#256ABF', '#3987E5', '#6DA7EC', '#9EC5F4'];

export const subjectEmojis = ['📘', '🧮', '🧪', '🌏', '💻', '🎨', '📝', '🗣️'];
