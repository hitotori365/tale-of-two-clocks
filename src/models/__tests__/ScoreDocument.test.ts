import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ScoreDocument } from '../ScoreDocument';
import { resetTimeSignatures, setTimeSignature } from '../../stores/timeSignatureStore';

describe('ScoreDocument chords (beat-level)', () => {
  let doc: ScoreDocument;

  beforeEach(() => {
    resetTimeSignatures();
    doc = ScoreDocument.createDefault();
  });

  it('setChord(0, 0, "C") → getChord(0, 0) が "C"', () => {
    doc.setChord(0, 0, 'C');
    expect(doc.getChord(0, 0)).toBe('C');
  });

  it('setChord(0, 2, "Am") → 独立して保持', () => {
    doc.setChord(0, 0, 'C');
    doc.setChord(0, 2, 'Am');
    expect(doc.getChord(0, 0)).toBe('C');
    expect(doc.getChord(0, 2)).toBe('Am');
  });

  it('setChord(0, 0, "") → 削除', () => {
    doc.setChord(0, 0, 'C');
    doc.setChord(0, 0, '');
    expect(doc.getChord(0, 0)).toBeUndefined();
  });

  it('getMeasureChords(0) → Map', () => {
    doc.setChord(0, 0, 'C');
    doc.setChord(0, 2, 'Am');
    const chords = doc.getMeasureChords(0);
    expect(chords).toEqual(new Map([[0, 'C'], [2, 'Am']]));
  });

  it('getMeasureChords 未設定小節は空Map', () => {
    expect(doc.getMeasureChords(5)).toEqual(new Map());
  });
});

describe('computeMeasureNoteIndices (nanostore対応)', () => {
  beforeEach(() => {
    resetTimeSignatures();
  });

  it('4音符(各0.5), 4/4拍子 → [[0,1,2,3]]', () => {
    const doc = new ScoreDocument(
      [
        { id: 'n1', keys: ['c/4'], durationBeats: 0.5 },
        { id: 'n2', keys: ['d/4'], durationBeats: 0.5 },
        { id: 'n3', keys: ['e/4'], durationBeats: 0.5 },
        { id: 'n4', keys: ['f/4'], durationBeats: 0.5 },
      ],
      { tempo: 120, timeSignature: [4, 4] },
    );
    expect(doc.computeMeasureNoteIndices()).toEqual([[0, 1, 2, 3]]);
  });

  it('8音符(各0.5), 4/4拍子 → [[0,1,2,3],[4,5,6,7]]', () => {
    const notes = Array.from({ length: 8 }, (_, i) => ({
      id: `n${i}`, keys: ['c/4'], durationBeats: 0.5,
    }));
    const doc = new ScoreDocument(notes, { tempo: 120, timeSignature: [4, 4] });
    expect(doc.computeMeasureNoteIndices()).toEqual([[0, 1, 2, 3], [4, 5, 6, 7]]);
  });

  it('nanostoreで拍子を[3,4]に変更 → 4音符で [[0,1,2],[3]]', () => {
    setTimeSignature(0, [3, 4]);
    const doc = new ScoreDocument(
      [
        { id: 'n1', keys: ['c/4'], durationBeats: 0.5 },
        { id: 'n2', keys: ['d/4'], durationBeats: 0.5 },
        { id: 'n3', keys: ['e/4'], durationBeats: 0.5 },
        { id: 'n4', keys: ['f/4'], durationBeats: 0.5 },
      ],
      { tempo: 120, timeSignature: [4, 4] },
    );
    expect(doc.computeMeasureNoteIndices()).toEqual([[0, 1, 2], [3]]);
  });
});

describe('computeBeatNoteMapping', () => {
  beforeEach(() => {
    resetTimeSignatures();
  });

  it('4/4、四分音符4つ → 各拍に1音符', () => {
    const doc = new ScoreDocument(
      [
        { id: 'n0', keys: ['c/4'], durationBeats: 0.5 },
        { id: 'n1', keys: ['d/4'], durationBeats: 0.5 },
        { id: 'n2', keys: ['e/4'], durationBeats: 0.5 },
        { id: 'n3', keys: ['f/4'], durationBeats: 0.5 },
      ],
      { tempo: 120, timeSignature: [4, 4] },
    );
    expect(doc.computeBeatNoteMapping()).toEqual([
      [
        { beat: 0, noteIndex: 0 },
        { beat: 1, noteIndex: 1 },
        { beat: 2, noteIndex: 2 },
        { beat: 3, noteIndex: 3 },
      ],
    ]);
  });

  it('4/4、二分音符2つ(durationBeats:1.0) → 拍0,1が音符0、拍2,3が音符1', () => {
    const doc = new ScoreDocument(
      [
        { id: 'n0', keys: ['c/4'], durationBeats: 1.0 },
        { id: 'n1', keys: ['e/4'], durationBeats: 1.0 },
      ],
      { tempo: 120, timeSignature: [4, 4] },
    );
    expect(doc.computeBeatNoteMapping()).toEqual([
      [
        { beat: 0, noteIndex: 0 },
        { beat: 1, noteIndex: 0 },
        { beat: 2, noteIndex: 1 },
        { beat: 3, noteIndex: 1 },
      ],
    ]);
  });

  it('3/4、四分音符3つ → 3拍', () => {
    setTimeSignature(0, [3, 4]);
    const doc = new ScoreDocument(
      [
        { id: 'n0', keys: ['c/4'], durationBeats: 0.5 },
        { id: 'n1', keys: ['d/4'], durationBeats: 0.5 },
        { id: 'n2', keys: ['e/4'], durationBeats: 0.5 },
      ],
      { tempo: 120, timeSignature: [3, 4] },
    );
    expect(doc.computeBeatNoteMapping()).toEqual([
      [
        { beat: 0, noteIndex: 0 },
        { beat: 1, noteIndex: 1 },
        { beat: 2, noteIndex: 2 },
      ],
    ]);
  });
});

describe('beatDuration', () => {
  it('tempo=120 → 0.5秒/拍', () => {
    // 準備
    const doc = new ScoreDocument([], { tempo: 120, timeSignature: [4, 4] });

    // 実行
    const duration = doc.beatDuration;

    // 検証
    expect(duration).toBe(0.5);
  });

  it('tempo=60 → 1.0秒/拍', () => {
    // 準備
    const doc = new ScoreDocument([], { tempo: 60, timeSignature: [4, 4] });

    // 実行
    const duration = doc.beatDuration;

    // 検証
    expect(duration).toBe(1.0);
  });
});

describe('setNoteKeys', () => {
  let doc: ScoreDocument;

  beforeEach(() => {
    doc = ScoreDocument.createDefault();
  });

  it('音高を変更できる', () => {
    // 準備
    const newKeys = ['g/4'];

    // 実行
    doc.setNoteKeys(0, newKeys);

    // 検証
    expect(doc.notes[0].keys).toEqual(['g/4']);
  });

  it('他の音符に影響しない', () => {
    // 準備
    const originalKeys1 = [...doc.notes[1].keys];

    // 実行
    doc.setNoteKeys(0, ['a/5']);

    // 検証
    expect(doc.notes[1].keys).toEqual(originalKeys1);
  });

  it('範囲外のインデックス → 何も変更しない', () => {
    // 準備
    const originalNotes = doc.notes.map(n => ({ ...n }));

    // 実行
    doc.setNoteKeys(-1, ['g/4']);
    doc.setNoteKeys(100, ['g/4']);

    // 検証
    expect(doc.notes).toEqual(originalNotes);
  });
});

describe('addMeasure / removeMeasure', () => {
  let doc: ScoreDocument;

  beforeEach(() => {
    resetTimeSignatures();
    doc = ScoreDocument.createDefault();
  });

  it('addMeasure で休符4つが追加される', () => {
    const before = doc.notes.length;
    doc.addMeasure();
    expect(doc.notes.length).toBe(before + 4);
    // 追加された音符はすべて休符
    for (let i = before; i < doc.notes.length; i++) {
      expect(doc.notes[i].isRest).toBe(true);
      expect(doc.notes[i].durationBeats).toBe(0.5);
    }
  });

  it('addMeasure で change イベントが発火する', () => {
    const callback = vi.fn();
    doc.on('change', callback);
    doc.addMeasure();
    expect(callback).toHaveBeenCalledOnce();
  });

  it('addMeasure 後に computeMeasureNoteIndices が2小節返す', () => {
    doc.addMeasure();
    const measures = doc.computeMeasureNoteIndices();
    expect(measures.length).toBe(2);
    expect(measures[0]).toEqual([0, 1, 2, 3]);
    expect(measures[1]).toEqual([4, 5, 6, 7]);
  });

  it('addMeasure で一意なIDが付与される', () => {
    doc.addMeasure();
    const ids = doc.notes.map(n => n.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('removeMeasure で最後の小節が削除される', () => {
    doc.addMeasure();
    expect(doc.notes.length).toBe(8);
    doc.removeMeasure();
    expect(doc.notes.length).toBe(4);
  });

  it('removeMeasure で1小節以下なら何もしない', () => {
    const before = doc.notes.length;
    doc.removeMeasure();
    expect(doc.notes.length).toBe(before);
  });

  it('removeMeasure で該当小節のコードも削除される', () => {
    doc.addMeasure();
    doc.setChord(1, 0, 'G');
    expect(doc.getChord(1, 0)).toBe('G');
    doc.removeMeasure();
    expect(doc.getChord(1, 0)).toBeUndefined();
  });

  it('removeMeasure で change イベントが発火する', () => {
    doc.addMeasure();
    const callback = vi.fn();
    doc.on('change', callback);
    doc.removeMeasure();
    expect(callback).toHaveBeenCalledOnce();
  });
});

describe('イベントシステム', () => {
  let doc: ScoreDocument;

  beforeEach(() => {
    resetTimeSignatures();
    doc = ScoreDocument.createDefault();
  });

  it('setChord で change イベントが発火する', () => {
    // 準備
    const callback = vi.fn();
    doc.on('change', callback);

    // 実行
    doc.setChord(0, 0, 'C');

    // 検証
    expect(callback).toHaveBeenCalledOnce();
  });

  it('setNoteKeys で change イベントが発火する', () => {
    // 準備
    const callback = vi.fn();
    doc.on('change', callback);

    // 実行
    doc.setNoteKeys(0, ['g/4']);

    // 検証
    expect(callback).toHaveBeenCalledOnce();
  });

  it('off でリスナーを解除できる', () => {
    // 準備
    const callback = vi.fn();
    doc.on('change', callback);
    doc.off('change', callback);

    // 実行
    doc.setChord(0, 0, 'C');

    // 検証
    expect(callback).not.toHaveBeenCalled();
  });
});
