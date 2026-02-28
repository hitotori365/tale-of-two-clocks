import { describe, it, expect } from 'vitest';
import { getFrequency } from '../noteFrequencies';

describe('getFrequency', () => {
  const expectedFrequencies: [string, number][] = [
    ['c/4', 261.63],
    ['d/4', 293.66],
    ['e/4', 329.63],
    ['f/4', 349.23],
    ['g/4', 392.00],
    ['a/4', 440.00],
    ['b/4', 493.88],
    ['c/5', 523.25],
    ['d/5', 587.33],
    ['e/5', 659.25],
    ['f/5', 698.46],
    ['g/5', 783.99],
    ['a/5', 880.00],
    ['b/5', 987.77],
  ];

  it.each(expectedFrequencies)(
    '%s → %f Hz',
    (note, expected) => {
      // 準備 (入力値はパラメータから)

      // 実行
      const freq = getFrequency(note);

      // 検証
      expect(freq).toBe(expected);
    },
  );

  it('未定義の音名 → 440Hz フォールバック', () => {
    // 準備
    const unknownNote = 'x/9';

    // 実行
    const freq = getFrequency(unknownNote);

    // 検証
    expect(freq).toBe(440);
  });

  it('空文字列 → 440Hz フォールバック', () => {
    // 準備
    const emptyNote = '';

    // 実行
    const freq = getFrequency(emptyNote);

    // 検証
    expect(freq).toBe(440);
  });
});
