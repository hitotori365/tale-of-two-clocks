import { describe, it, expect } from 'vitest';
import { Timeline } from '../Timeline';
import { ScoreDocument } from '../ScoreDocument';

describe('Timeline コンストラクタ', () => {
  it('各音符のstartTime・duration・totalDurationを算出する', () => {
    // 準備
    const doc = new ScoreDocument(
      [
        { id: 'n1', keys: ['c/4'], durationBeats: 0.5 },
        { id: 'n2', keys: ['d/4'], durationBeats: 0.5 },
        { id: 'n3', keys: ['e/4'], durationBeats: 1.0 },
      ],
      { tempo: 120, timeSignature: [4, 4] },
    );

    // 実行
    const timeline = new Timeline(doc);

    // 検証 (tempo=120 → beatDuration=0.5s)
    expect(timeline.noteStartTimes).toEqual([0, 0.25, 0.5]);
    expect(timeline.noteDurations).toEqual([0.25, 0.25, 0.5]);
    expect(timeline.totalDuration).toBe(1.0);
  });

  it('テンポ60の場合、beatDuration=1sで計算される', () => {
    // 準備
    const doc = new ScoreDocument(
      [
        { id: 'n1', keys: ['c/4'], durationBeats: 0.5 },
        { id: 'n2', keys: ['d/4'], durationBeats: 0.5 },
      ],
      { tempo: 60, timeSignature: [4, 4] },
    );

    // 実行
    const timeline = new Timeline(doc);

    // 検証 (tempo=60 → beatDuration=1.0s)
    expect(timeline.noteStartTimes).toEqual([0, 0.5]);
    expect(timeline.noteDurations).toEqual([0.5, 0.5]);
    expect(timeline.totalDuration).toBe(1.0);
  });
});

describe('Timeline.getIndexAtTime', () => {
  // 準備 (共通)
  // tempo=120, beatDuration=0.5s
  // n1: 0.0-0.25s, n2: 0.25-0.5s, n3: 0.5-0.75s, n4: 0.75-1.0s
  const doc = new ScoreDocument(
    [
      { id: 'n1', keys: ['c/4'], durationBeats: 0.5 },
      { id: 'n2', keys: ['d/4'], durationBeats: 0.5 },
      { id: 'n3', keys: ['e/4'], durationBeats: 0.5 },
      { id: 'n4', keys: ['f/4'], durationBeats: 0.5 },
    ],
    { tempo: 120, timeSignature: [4, 4] },
  );
  const timeline = new Timeline(doc);

  it('0秒 → インデックス0', () => {
    // 実行
    const index = timeline.getIndexAtTime(0);

    // 検証
    expect(index).toBe(0);
  });

  it('音符の開始時刻ちょうど → その音符のインデックス', () => {
    // 実行
    const index = timeline.getIndexAtTime(0.25);

    // 検証
    expect(index).toBe(1);
  });

  it('音符の中間時刻 → その音符のインデックス', () => {
    // 実行
    const index = timeline.getIndexAtTime(0.6);

    // 検証
    expect(index).toBe(2);
  });

  it('最後の音符の終了後 → 最後のインデックス', () => {
    // 実行
    const index = timeline.getIndexAtTime(5.0);

    // 検証
    expect(index).toBe(3);
  });
});

describe('Timeline.getPlayheadX', () => {
  // 準備 (共通)
  const doc = new ScoreDocument(
    [
      { id: 'n1', keys: ['c/4'], durationBeats: 0.5 },
      { id: 'n2', keys: ['d/4'], durationBeats: 0.5 },
      { id: 'n3', keys: ['e/4'], durationBeats: 0.5 },
    ],
    { tempo: 120, timeSignature: [4, 4] },
  );
  const timeline = new Timeline(doc);
  const noteXPositions = [100, 200, 300];

  it('音符開始時刻 → その音符のX座標', () => {
    // 実行
    const x = timeline.getPlayheadX(0, noteXPositions);

    // 検証
    expect(x).toBe(100);
  });

  it('音符の中間 → 次の音符との線形補間', () => {
    // 実行 (0.125s = n1の50%地点)
    const x = timeline.getPlayheadX(0.125, noteXPositions);

    // 検証 (100 + (200-100) * 0.5 = 150)
    expect(x).toBe(150);
  });

  it('最後の音符 → +50pxフォールバックで補間', () => {
    // 実行 (0.5s = n3の開始)
    const x = timeline.getPlayheadX(0.5, noteXPositions);

    // 検証 (最後の音符のX=300、次がないので300+50=350がnextX)
    expect(x).toBe(300);
  });

  it('最後の音符の50%地点 → 300と350の中間', () => {
    // 実行 (0.625s = n3の50%地点)
    const x = timeline.getPlayheadX(0.625, noteXPositions);

    // 検証 (300 + (350-300) * 0.5 = 325)
    expect(x).toBe(325);
  });
});
