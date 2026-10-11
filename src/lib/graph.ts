import type { Task, Topic } from '../types';

export const NODE_W = 140;
export const NODE_H = 64;
const GAP_X = 18;
const GAP_Y = 60;
const PAD = 20;

/** Bỏ cạnh trỏ tới chủ đề không tồn tại, trỏ vào chính nó, trùng lặp hoặc tạo chu trình. */
export function sanitizeTopics(topics: Topic[]): Topic[] {
  const ids = new Set(topics.map((t) => t.id));
  const requires = new Map<string, string[]>();
  for (const t of topics) requires.set(t.id, []);

  // A phụ thuộc B và B phụ thuộc A thì giữ cạnh xuất hiện trước (theo thứ tự danh sách).
  const reaches = (from: string, target: string): boolean => {
    const seen = new Set<string>();
    const stack = [from];
    while (stack.length) {
      const cur = stack.pop()!;
      if (cur === target) return true;
      if (seen.has(cur)) continue;
      seen.add(cur);
      for (const r of requires.get(cur) ?? []) stack.push(r);
    }
    return false;
  };

  for (const t of topics) {
    for (const r of t.requires) {
      if (!ids.has(r) || r === t.id || requires.get(t.id)!.includes(r)) continue;
      // thêm cạnh r -> t tạo chu trình nếu r đã (gián tiếp) phụ thuộc vào t
      if (reaches(r, t.id)) continue;
      requires.get(t.id)!.push(r);
    }
  }
  return topics.map((t) => ({ ...t, requires: requires.get(t.id)! }));
}

export type LaidOutNode = { topic: Topic; layer: number; x: number; y: number };
export type LaidOutEdge = { from: string; to: string };
export type GraphLayout = {
  nodes: LaidOutNode[];
  edges: LaidOutEdge[];
  width: number;
  height: number;
};

/** Bố cục phân tầng: chủ đề cần học trước nằm ở tầng trên, chủ đề phụ thuộc nằm dưới. */
export function layoutGraph(input: Topic[], minWidth = 0): GraphLayout {
  const topics = sanitizeTopics(input);
  if (!topics.length) return { nodes: [], edges: [], width: minWidth, height: 0 };

  const byId = new Map(topics.map((t) => [t.id, t]));
  const depth = new Map<string, number>();
  const depthOf = (id: string): number => {
    const cached = depth.get(id);
    if (cached !== undefined) return cached;
    const reqs = byId.get(id)!.requires;
    const d = reqs.length ? 1 + Math.max(...reqs.map(depthOf)) : 0;
    depth.set(id, d);
    return d;
  };
  topics.forEach((t) => depthOf(t.id));

  const layerCount = Math.max(...depth.values()) + 1;
  const layers: string[][] = Array.from({ length: layerCount }, () => []);
  topics.forEach((t) => layers[depth.get(t.id)!].push(t.id));

  // Giảm số đường cắt nhau: xếp theo vị trí trung bình của các chủ đề cha (2 lượt).
  const order = new Map<string, number>();
  layers.forEach((l) => l.forEach((id, i) => order.set(id, i)));
  for (let pass = 0; pass < 2; pass++) {
    for (let li = 1; li < layerCount; li++) {
      const score = (id: string) => {
        const reqs = byId.get(id)!.requires;
        return reqs.length ? reqs.reduce((s, r) => s + (order.get(r) ?? 0), 0) / reqs.length : order.get(id)!;
      };
      layers[li].sort((a, b) => score(a) - score(b));
      layers[li].forEach((id, i) => order.set(id, i));
    }
  }

  const widest = Math.max(...layers.map((l) => l.length));
  const width = Math.max(minWidth, widest * (NODE_W + GAP_X) - GAP_X + PAD * 2);
  const nodes: LaidOutNode[] = [];
  layers.forEach((ids, li) => {
    const rowW = ids.length * (NODE_W + GAP_X) - GAP_X;
    const startX = (width - rowW) / 2;
    ids.forEach((id, i) =>
      nodes.push({
        topic: byId.get(id)!,
        layer: li,
        x: startX + i * (NODE_W + GAP_X),
        y: PAD + li * (NODE_H + GAP_Y),
      }),
    );
  });

  const edges: LaidOutEdge[] = topics.flatMap((t) => t.requires.map((r) => ({ from: r, to: t.id })));
  return { nodes, edges, width, height: PAD * 2 + layerCount * NODE_H + (layerCount - 1) * GAP_Y };
}

export type TopicStatus = 'new' | 'learning' | 'mastered';

export type TopicProgress = {
  total: number;
  done: number;
  /** 0..1 */
  pct: number;
  minutes: number;
  status: TopicStatus;
};

export function topicProgress(topicId: string, tasks: Task[]): TopicProgress {
  const mine = tasks.filter((t) => t.topicId === topicId);
  const done = mine.filter((t) => t.done);
  const pct = mine.length ? done.length / mine.length : 0;
  return {
    total: mine.length,
    done: done.length,
    pct,
    minutes: done.reduce((s, t) => s + t.duration, 0),
    status: mine.length && done.length === mine.length ? 'mastered' : done.length ? 'learning' : 'new',
  };
}

/** Chủ đề đã sẵn sàng học: mọi chủ đề tiên quyết đều đã nắm xong. */
export function isUnlocked(topic: Topic, all: Topic[], tasks: Task[]): boolean {
  return topic.requires.every((r) => {
    const p = topicProgress(r, tasks);
    return all.some((t) => t.id === r) ? p.status === 'mastered' : true;
  });
}
