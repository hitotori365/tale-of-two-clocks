/**
 * Y座標⇔音程マッピング
 *
 * VexFlowの getYForNote 準拠。keyProperties の line 値を使用。
 * line: C4=0, D4=0.5, E4=1, ... B5=6.5（半音ではなく全音階ステップで+0.5）
 *
 * Stave y=40, spacing=10 の場合:
 * getYForNote(line) = 130 - 10 * line
 */

const BASE_Y = 130;
const LINE_SPACING = 10;

function getYForNote(line: number): number {
  return BASE_Y - LINE_SPACING * line;
}

type StaffPosition = {
  key: string;
  line: number;
  y: number;
};

// ト音記号: C4〜B5（noteFrequencies.tsと同じ範囲）
// line値はVexFlow keyProperties準拠（C4=0, 上方向に+0.5ずつ）
const POSITIONS: { key: string; line: number }[] = [
  { key: 'b/5', line: 6.5 },
  { key: 'a/5', line: 6 },
  { key: 'g/5', line: 5.5 },
  { key: 'f/5', line: 5 },
  { key: 'e/5', line: 4.5 },
  { key: 'd/5', line: 4 },
  { key: 'c/5', line: 3.5 },
  { key: 'b/4', line: 3 },
  { key: 'a/4', line: 2.5 },
  { key: 'g/4', line: 2 },
  { key: 'f/4', line: 1.5 },
  { key: 'e/4', line: 1 },
  { key: 'd/4', line: 0.5 },
  { key: 'c/4', line: 0 },
];

/** 各音程の { key, line, y } テーブル（Y昇順=高い音が先） */
export const STAFF_POSITIONS: StaffPosition[] = POSITIONS.map(p => ({
  ...p,
  y: getYForNote(p.line),
}));

/** Y座標 → 最寄りの音程キー */
export function yToNearestPitch(svgY: number): string {
  let closest = STAFF_POSITIONS[0];
  let minDist = Math.abs(svgY - closest.y);
  for (let i = 1; i < STAFF_POSITIONS.length; i++) {
    const dist = Math.abs(svgY - STAFF_POSITIONS[i].y);
    if (dist < minDist) {
      minDist = dist;
      closest = STAFF_POSITIONS[i];
    }
  }
  return closest.key;
}

/** 音名 → Y座標 */
export function pitchToY(key: string): number {
  const pos = STAFF_POSITIONS.find(p => p.key === key);
  return pos ? pos.y : getYForNote(0); // fallback to C4
}

/** Y座標 → 最寄りスタッフポジションのY */
export function snapY(svgY: number): number {
  const key = yToNearestPitch(svgY);
  return pitchToY(key);
}
