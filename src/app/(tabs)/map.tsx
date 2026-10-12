import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, Text, useWindowDimensions, View } from 'react-native';
import Svg, { G, Path, Polygon, Rect, Text as SvgText } from 'react-native-svg';
import { Meter } from '@/components/charts';
import { TaskEditor } from '@/components/TaskEditor';
import { TaskRow } from '@/components/TaskRow';
import { Button, Card, Chip, Empty, ErrorBox, Field, Screen, SectionTitle, Title } from '@/components/ui';
import { confirmAction } from '@/lib/confirm';
import { formatDuration, todayISO } from '@/lib/date';
import { GeminiError, suggestLinks } from '@/lib/gemini';
import { isUnlocked, layoutGraph, NODE_H, NODE_W, topicProgress, TopicStatus } from '@/lib/graph';
import { useStore } from '@/store';
import { colors } from '@/theme';
import { Task } from '@/types';

const EDGE = '#4B4F8A';
const EDGE_OUT = '#9085E9';

const STATUS_COLOR: Record<TopicStatus, string> = {
  new: colors.border,
  learning: colors.warn,
  mastered: colors.success,
};

function wrapName(name: string, max = 15): string[] {
  const words = name.split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length <= max) cur = (cur + ' ' + w).trim();
    else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  if (lines.length > 2) {
    const rest = lines.slice(1).join(' ');
    return [lines[0], rest.length > max ? rest.slice(0, max - 1) + '…' : rest];
  }
  return lines.map((l) => (l.length > max ? l.slice(0, max - 1) + '…' : l));
}

export default function KnowledgeMap() {
  const { topics, tasks, subjects, subjectOf, apiKey, settings, addTopic, updateTopic, deleteTopic } = useStore();
  const { width } = useWindowDimensions();

  const { topic: topicParam } = useLocalSearchParams<{ topic?: string }>();
  const [selected, setSelected] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Mở từ một buổi học (chạm vào nhãn chủ đề) thì chọn sẵn chủ đề đó. Điều chỉnh state ngay khi render
  // theo tham số mới (không qua effect), rồi xoá tham số để lần sau chạm cùng chủ đề vẫn có tác dụng.
  const [seenParam, setSeenParam] = useState<string | undefined>(undefined);
  if (topicParam !== seenParam) {
    setSeenParam(topicParam);
    if (topicParam) {
      setSelected(topicParam);
      setEditing(false);
    }
  }
  // cuộn xuống thẻ chi tiết (nằm dưới đồ thị) để thấy ngay chủ đề vừa mở
  const scroller = useRef<ScrollView>(null);
  const detailY = useRef(0);
  const pendingScroll = useRef(false);
  useEffect(() => {
    if (!topicParam) return;
    pendingScroll.current = true;
    router.setParams({ topic: '' });
    // thẻ đã hiện sẵn ở đúng chỗ thì không có onLayout mới: tự cuộn sau một nhịp
    // (không huỷ trong cleanup: tham số bị xoá ngay sau đó sẽ chạy lại effect này)
    setTimeout(() => {
      if (!pendingScroll.current || !detailY.current) return;
      pendingScroll.current = false;
      scroller.current?.scrollTo({ y: Math.max(0, detailY.current - 16), animated: true });
    }, 400);
  }, [topicParam]);

  const layout = useMemo(() => layoutGraph(topics, width - 40), [topics, width]);
  const progress = useMemo(() => new Map(topics.map((t) => [t.id, topicProgress(t.id, tasks)])), [topics, tasks]);
  const sel = topics.find((t) => t.id === selected) ?? null;
  const pos = new Map(layout.nodes.map((n) => [n.topic.id, n]));

  const related = new Set<string>();
  if (sel) {
    related.add(sel.id);
    sel.requires.forEach((r) => related.add(r));
    topics.filter((t) => t.requires.includes(sel.id)).forEach((t) => related.add(t.id));
  }

  const submitTopic = () => {
    if (!name.trim()) return;
    addTopic(name, subjectId, []);
    setName('');
    setAdding(false);
  };

  const aiLinks = async () => {
    setError('');
    setNotice('');
    if (!apiKey) {
      setError('Hãy nhập API key Gemini trong tab Cài đặt trước.');
      return;
    }
    setBusy(true);
    try {
      const result = await suggestLinks({
        apiKey,
        model: settings.model,
        topics: topics.map((t) => ({ name: t.name, subject: subjectOf(t.subjectId)?.name })),
      });
      const byName = new Map(topics.map((t) => [t.name.toLowerCase(), t]));
      let added = 0;
      for (const [topicName, reqNames] of result) {
        const t = byName.get(topicName.toLowerCase());
        if (!t) continue;
        const ids = reqNames.map((r) => byName.get(r.toLowerCase())?.id).filter((x): x is string => !!x);
        const merged = [...new Set([...t.requires, ...ids])];
        added += merged.length - t.requires.length;
        if (merged.length !== t.requires.length) updateTopic(t.id, { requires: merged });
      }
      setNotice(added ? `Đã thêm ${added} liên kết mới.` : 'Không có liên kết mới nào để thêm.');
    } catch (e) {
      setError(e instanceof GeminiError ? e.message : 'Có lỗi xảy ra, thử lại nhé.');
    } finally {
      setBusy(false);
    }
  };

  /** Đường nối cong; nếu bắc qua nhiều tầng thì vòng ra ngoài các nút nằm giữa để không bị cắt ngang. */
  const edgePath = (a: { x: number; y: number; layer: number }, b: { x: number; y: number; layer: number }) => {
    const sx = a.x + NODE_W / 2;
    const sy = a.y + NODE_H;
    const ex = b.x + NODE_W / 2;
    const ey = b.y;
    const between = layout.nodes.filter((n) => n.layer > a.layer && n.layer < b.layer);
    if (!between.length) {
      const dy = Math.max(28, (ey - sy) / 2);
      return `M${sx} ${sy} C${sx} ${sy + dy}, ${ex} ${ey - dy}, ${ex} ${ey - 8}`;
    }
    const left = Math.min(...between.map((n) => n.x)) - 14;
    const right = Math.max(...between.map((n) => n.x + NODE_W)) + 14;
    const wx = sx >= ex ? Math.min(right, layout.width - 8) : Math.max(left, 8);
    const midY = (sy + ey) / 2;
    const d = (midY - sy) / 2;
    return `M${sx} ${sy} C${sx} ${sy + d}, ${wx} ${midY - d}, ${wx} ${midY} C${wx} ${midY + d}, ${ex} ${ey - d}, ${ex} ${ey - 8}`;
  };

  const edgeStyle = (from: string, to: string) => {
    if (!sel) return { stroke: progress.get(from)?.status === 'mastered' ? colors.success : EDGE, opacity: 0.9, w: 1.5 };
    if (to === sel.id) return { stroke: colors.accent, opacity: 1, w: 2.5 };
    if (from === sel.id) return { stroke: EDGE_OUT, opacity: 1, w: 2.5 };
    return { stroke: EDGE, opacity: 0.15, w: 1.5 };
  };

  const startNext = () => {
    if (!sel) return;
    const next = tasks
      .filter((t) => t.topicId === sel.id && !t.done)
      .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))[0];
    if (next) router.push({ pathname: '/focus', params: { taskId: next.id } });
  };

  const selProgress = sel ? progress.get(sel.id)! : null;
  const selSubject = sel ? subjectOf(sel.subjectId) : undefined;
  const unlocked = sel ? isUnlocked(sel, topics, tasks) : true;
  const selTasks = sel
    ? tasks.filter((t) => t.topicId === sel.id).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))
    : [];
  const unlocks = sel ? topics.filter((t) => t.requires.includes(sel.id)) : [];

  return (
    <Screen scrollRef={scroller}>
      <Title sub="Kiến thức nào cần nắm trước kiến thức nào. Chạm vào một nút để xem chi tiết.">Bản đồ kiến thức</Title>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button label="Chủ đề" icon="add" variant="ghost" onPress={() => setAdding(!adding)} style={{ flex: 1 }} />
        <Button
          label="AI gợi ý liên kết"
          icon="sparkles"
          onPress={aiLinks}
          loading={busy}
          disabled={topics.length < 2}
          style={{ flex: 1.4 }}
        />
      </View>
      {error ? <ErrorBox message={error} /> : null}
      {notice ? <Text style={{ color: colors.success, fontWeight: '600' }}>{notice}</Text> : null}

      {adding && (
        <Card>
          <Field label="Tên chủ đề" value={name} onChangeText={setName} placeholder="VD: Đạo hàm" onSubmitEditing={submitTopic} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Chip label="Không có môn" active={subjectId === null} onPress={() => setSubjectId(null)} />
            {subjects.map((s) => (
              <Chip key={s.id} label={`${s.emoji} ${s.name}`} color={s.color} active={subjectId === s.id} onPress={() => setSubjectId(s.id)} />
            ))}
          </View>
          <Button label="Thêm chủ đề" icon="checkmark" onPress={submitTopic} disabled={!name.trim()} />
        </Card>
      )}

      {topics.length === 0 ? (
        <Card>
          <Empty
            icon="git-network-outline"
            text="Chưa có chủ đề nào. Khi AI lập lịch học, nó sẽ tự dựng bản đồ kiến thức và các liên kết giữa chúng."
          />
          <Button label="Lập lịch bằng AI" icon="sparkles" onPress={() => router.navigate('/planner')} />
        </Card>
      ) : (
        <>
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <Svg width={layout.width} height={layout.height}>
                {layout.edges.map((e) => {
                  const a = pos.get(e.from);
                  const b = pos.get(e.to);
                  if (!a || !b) return null;
                  const ex = b.x + NODE_W / 2;
                  const ey = b.y;
                  const st = edgeStyle(e.from, e.to);
                  return (
                    <G key={`${e.from}-${e.to}`} opacity={st.opacity}>
                      <Path d={edgePath(a, b)} stroke={st.stroke} strokeWidth={st.w} fill="none" strokeLinecap="round" />
                      <Polygon points={`${ex},${ey} ${ex - 5},${ey - 9} ${ex + 5},${ey - 9}`} fill={st.stroke} />
                    </G>
                  );
                })}
                {layout.nodes.map((n) => {
                  const p = progress.get(n.topic.id)!;
                  const color = subjectOf(n.topic.subjectId)?.color ?? colors.muted;
                  const isSel = n.topic.id === selected;
                  const locked = p.status === 'new' && !isUnlocked(n.topic, topics, tasks);
                  const dim = sel && !related.has(n.topic.id);
                  const lines = wrapName(n.topic.name);
                  return (
                    <G key={n.topic.id} opacity={dim ? 0.35 : locked ? 0.7 : 1} onPress={() => setSelected(isSel ? null : n.topic.id)}>
                      <Rect
                        x={n.x}
                        y={n.y}
                        width={NODE_W}
                        height={NODE_H}
                        rx={16}
                        fill={colors.surface2}
                        stroke={isSel ? colors.text : STATUS_COLOR[p.status]}
                        strokeWidth={isSel ? 2.5 : 1.5}
                      />
                      <Rect x={n.x + 8} y={n.y + 12} width={4} height={NODE_H - 34} rx={2} fill={color} />
                      {lines.map((l, i) => (
                        <SvgText key={i} x={n.x + 20} y={n.y + 22 + i * 15} fill={colors.text} fontSize={12.5} fontWeight="700">
                          {l}
                        </SvgText>
                      ))}
                      <Rect x={n.x + 20} y={n.y + NODE_H - 14} width={NODE_W - 36} height={4} rx={2} fill={colors.border} />
                      <Rect x={n.x + 20} y={n.y + NODE_H - 14} width={(NODE_W - 36) * p.pct} height={4} rx={2} fill={color} />
                      {p.status === 'mastered' ? (
                        <SvgText x={n.x + NODE_W - 12} y={n.y + 18} fill={colors.success} fontSize={13} fontWeight="800" textAnchor="end">
                          ✓
                        </SvgText>
                      ) : locked ? (
                        <SvgText x={n.x + NODE_W - 10} y={n.y + 18} fontSize={11} textAnchor="end">
                          🔒
                        </SvgText>
                      ) : null}
                    </G>
                  );
                })}
              </Svg>
            </ScrollView>
          </Card>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
            {(
              [
                ['new', 'Chưa học'],
                ['learning', 'Đang học'],
                ['mastered', 'Nắm vững ✓'],
              ] as [TopicStatus, string][]
            ).map(([k, label]) => (
              <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 14, height: 10, borderRadius: 4, borderWidth: 1.5, borderColor: STATUS_COLOR[k] }} />
                <Text style={{ color: colors.muted, fontSize: 11 }}>{label}</Text>
              </View>
            ))}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 16, height: 2, backgroundColor: colors.accent }} />
              <Text style={{ color: colors.muted, fontSize: 11 }}>cần học trước</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 16, height: 2, backgroundColor: EDGE_OUT }} />
              <Text style={{ color: colors.muted, fontSize: 11 }}>mở khoá</Text>
            </View>
          </View>
        </>
      )}

      {sel && selProgress && (
        <Card
          onLayout={(e) => {
            detailY.current = e.nativeEvent.layout.y;
            if (pendingScroll.current) {
              pendingScroll.current = false;
              scroller.current?.scrollTo({ y: Math.max(0, detailY.current - 16), animated: true });
            }
          }}
        >
          <View style={{ gap: 2 }}>
            <Text style={{ color: colors.muted, fontSize: 12 }}>{selSubject ? `${selSubject.emoji} ${selSubject.name}` : 'Chưa gắn môn'}</Text>
            <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800' }}>{sel.name}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons
              name={selProgress.status === 'mastered' ? 'checkmark-circle' : selProgress.status === 'learning' ? 'time' : unlocked ? 'ellipse-outline' : 'lock-closed'}
              size={18}
              color={selProgress.status === 'mastered' ? colors.success : selProgress.status === 'learning' ? colors.warn : colors.muted}
            />
            <Text style={{ color: colors.text, fontWeight: '600' }}>
              {selProgress.status === 'mastered'
                ? 'Đã nắm vững'
                : selProgress.status === 'learning'
                  ? 'Đang học'
                  : unlocked
                    ? 'Sẵn sàng bắt đầu'
                    : 'Cần nắm các chủ đề tiên quyết trước'}
            </Text>
          </View>
          <Meter value={selProgress.pct} color={selSubject?.color} />
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            {selProgress.done}/{selProgress.total} buổi · {formatDuration(selProgress.minutes)} đã học
          </Text>

          <SectionTitle>Cần nắm trước</SectionTitle>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {sel.requires.length === 0 ? <Text style={{ color: colors.muted, fontSize: 13 }}>Đây là kiến thức nền tảng.</Text> : null}
            {sel.requires.map((r) => {
              const t = topics.find((x) => x.id === r);
              return t ? <Chip key={r} label={t.name} color={colors.accent} active onPress={() => setSelected(r)} /> : null;
            })}
          </View>

          {unlocks.length > 0 && (
            <>
              <SectionTitle>Mở khoá</SectionTitle>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {unlocks.map((t) => (
                  <Chip key={t.id} label={t.name} color={EDGE_OUT} active onPress={() => setSelected(t.id)} />
                ))}
              </View>
            </>
          )}

          {editing && (
            <>
              <SectionTitle>Chọn chủ đề cần học trước</SectionTitle>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {topics
                  .filter((t) => t.id !== sel.id)
                  .map((t) => {
                    const on = sel.requires.includes(t.id);
                    return (
                      <Chip
                        key={t.id}
                        label={t.name}
                        active={on}
                        onPress={() => updateTopic(sel.id, { requires: on ? sel.requires.filter((r) => r !== t.id) : [...sel.requires, t.id] })}
                      />
                    );
                  })}
              </View>
              <Text style={{ color: colors.muted, fontSize: 11 }}>Liên kết tạo vòng tròn sẽ tự bị bỏ.</Text>
            </>
          )}

          {selTasks.length > 0 && (
            <>
              <SectionTitle>Các buổi học</SectionTitle>
              <View style={{ gap: 8 }}>
                {selTasks.slice(0, 6).map((t) => (
                  <TaskRow key={t.id} task={t} showTopic={false} onPress={() => setEditingTask(t)} />
                ))}
                {selTasks.length > 6 ? <Text style={{ color: colors.muted, fontSize: 12 }}>… và {selTasks.length - 6} buổi nữa</Text> : null}
              </View>
            </>
          )}

          {selTasks.some((t) => !t.done) && <Button label="Học ngay" icon="play" onPress={startNext} />}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button label={editing ? 'Xong' : 'Sửa liên kết'} icon="git-branch-outline" variant="ghost" onPress={() => setEditing(!editing)} style={{ flex: 1 }} />
            <Button
              label="Xoá"
              icon="trash-outline"
              variant="danger"
              onPress={() =>
                confirmAction(
                  'Xoá chủ đề',
                  `Xoá "${sel.name}"? Các liên kết với chủ đề này sẽ bị gỡ, buổi học vẫn được giữ.`,
                  () => {
                    deleteTopic(sel.id);
                    setSelected(null);
                    setEditing(false);
                  },
                  'Xoá',
                )
              }
              style={{ flex: 1 }}
            />
          </View>
        </Card>
      )}

      <TaskEditor visible={!!editingTask} task={editingTask} defaultDate={todayISO()} onClose={() => setEditingTask(null)} />
    </Screen>
  );
}
