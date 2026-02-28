import { describe, it, expect, beforeEach } from 'vitest';
import {
  $timeSignatures,
  getTimeSignatureAtMeasure,
  setTimeSignature,
  resetTimeSignatures,
} from '../timeSignatureStore';

describe('timeSignatureStore', () => {
  beforeEach(() => {
    resetTimeSignatures();
  });

  it('初期値が [{ measureIndex: 0, timeSignature: [4, 4] }]', () => {
    expect($timeSignatures.get()).toEqual([
      { measureIndex: 0, timeSignature: [4, 4] },
    ]);
  });

  it('getTimeSignatureAtMeasure(0) → [4, 4]', () => {
    expect(getTimeSignatureAtMeasure(0)).toEqual([4, 4]);
  });

  it('拍子変更追加: measureIndex 2 に [3, 4]', () => {
    setTimeSignature(2, [3, 4]);
    expect(getTimeSignatureAtMeasure(1)).toEqual([4, 4]);
    expect(getTimeSignatureAtMeasure(2)).toEqual([3, 4]);
    expect(getTimeSignatureAtMeasure(5)).toEqual([3, 4]);
  });

  it('同じmeasureIndexへの上書き', () => {
    setTimeSignature(2, [3, 4]);
    setTimeSignature(2, [6, 8]);
    expect(getTimeSignatureAtMeasure(2)).toEqual([6, 8]);
  });
});
