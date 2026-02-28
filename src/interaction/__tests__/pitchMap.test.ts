import { describe, it, expect } from 'vitest';
import { STAFF_POSITIONS, yToNearestPitch, pitchToY, snapY } from '../pitchMap';

describe('STAFF_POSITIONS', () => {
  it('14音分のポジションが定義されている', () => {
    // 準備 (なし)

    // 実行 (なし — 定数の検証)

    // 検証
    expect(STAFF_POSITIONS).toHaveLength(14);
  });

  it('Y座標が降順（高い音=小さいY が先）', () => {
    // 準備
    const yValues = STAFF_POSITIONS.map(p => p.y);

    // 実行 (なし)

    // 検証 — 各Yが次のYより小さい（上から下）
    for (let i = 0; i < yValues.length - 1; i++) {
      expect(yValues[i]).toBeLessThan(yValues[i + 1]);
    }
  });
});

describe('yToNearestPitch', () => {
  it('各音程の正確なY座標 → 対応する音名を返す', () => {
    for (const pos of STAFF_POSITIONS) {
      // 準備
      const y = pos.y;

      // 実行
      const pitch = yToNearestPitch(y);

      // 検証
      expect(pitch).toBe(pos.key);
    }
  });

  it('2音の中間Y → より近い方の音名を返す', () => {
    // 準備 — C4(y=130)とD4(y=125)の中間より少しC4寄り
    const yNearC4 = 128;

    // 実行
    const pitch = yToNearestPitch(yNearC4);

    // 検証
    expect(pitch).toBe('c/4');
  });

  it('範囲外の大きいY（下端超え） → C4（最低音）', () => {
    // 準備
    const yFarBelow = 500;

    // 実行
    const pitch = yToNearestPitch(yFarBelow);

    // 検証
    expect(pitch).toBe('c/4');
  });

  it('範囲外の小さいY（上端超え） → B5（最高音）', () => {
    // 準備
    const yFarAbove = -100;

    // 実行
    const pitch = yToNearestPitch(yFarAbove);

    // 検証
    expect(pitch).toBe('b/5');
  });
});

describe('pitchToY', () => {
  it('定義済みの音名 → 正しいY座標を返す', () => {
    // 準備・実行・検証
    expect(pitchToY('c/4')).toBe(130); // line=0 → 130 - 10*0
    expect(pitchToY('e/4')).toBe(120); // line=1 → 130 - 10*1
    expect(pitchToY('b/5')).toBe(65);  // line=6.5 → 130 - 10*6.5
  });

  it('未定義の音名 → C4のY座標（130）にフォールバック', () => {
    // 準備
    const unknownKey = 'z/9';

    // 実行
    const y = pitchToY(unknownKey);

    // 検証
    expect(y).toBe(130);
  });
});

describe('snapY', () => {
  it('正確なスタッフ位置 → そのまま返す', () => {
    // 準備
    const exactY = pitchToY('e/4'); // 120

    // 実行
    const snapped = snapY(exactY);

    // 検証
    expect(snapped).toBe(exactY);
  });

  it('スタッフ位置の間 → 最寄りのスタッフ位置にスナップ', () => {
    // 準備 — D4(125)とE4(120)の間、E4寄り
    const betweenY = 121;

    // 実行
    const snapped = snapY(betweenY);

    // 検証
    expect(snapped).toBe(120); // E4
  });
});
