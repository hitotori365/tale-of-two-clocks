import { getTimeSignatureAtMeasure } from '../stores/timeSignatureStore';

export type NoteData = {
  id: string;
  keys: string[];
  durationBeats: number;
};

export type BeatNoteEntry = {
  beat: number;
  noteIndex: number;
};

export type ScoreMetadata = {
  tempo: number;
  timeSignature: [number, number];
};

export class ScoreDocument {
  notes: NoteData[];
  metadata: ScoreMetadata;
  chords: Map<number, Map<number, string>> = new Map();

  private listeners: Map<string, Set<() => void>> = new Map();

  constructor(notes: NoteData[], metadata: ScoreMetadata) {
    this.notes = notes;
    this.metadata = metadata;
  }

  get beatDuration(): number {
    return 60 / this.metadata.tempo;
  }

  on(event: string, callback: () => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off(event: string, callback: () => void): void {
    this.listeners.get(event)?.delete(callback);
  }

  private emit(event: string): void {
    this.listeners.get(event)?.forEach(cb => cb());
  }

  setChord(measureIndex: number, beatIndex: number, chord: string): void {
    if (chord === '') {
      const measure = this.chords.get(measureIndex);
      if (measure) {
        measure.delete(beatIndex);
        if (measure.size === 0) this.chords.delete(measureIndex);
      }
    } else {
      if (!this.chords.has(measureIndex)) {
        this.chords.set(measureIndex, new Map());
      }
      this.chords.get(measureIndex)!.set(beatIndex, chord);
    }
    this.emit('change');
  }

  getChord(measureIndex: number, beatIndex: number): string | undefined {
    return this.chords.get(measureIndex)?.get(beatIndex);
  }

  getMeasureChords(measureIndex: number): Map<number, string> {
    return this.chords.get(measureIndex) ?? new Map();
  }

  computeMeasureNoteIndices(): number[][] {
    const measures: number[][] = [];
    let currentMeasure: number[] = [];
    let accumulated = 0;
    let measureIndex = 0;

    const getMeasureCapacity = (m: number): number => {
      const [numBeats, beatValue] = getTimeSignatureAtMeasure(m);
      return numBeats * (4 / beatValue) * 0.5;
    };

    let measureCapacity = getMeasureCapacity(0);

    for (let i = 0; i < this.notes.length; i++) {
      if (accumulated >= measureCapacity && currentMeasure.length > 0) {
        measures.push(currentMeasure);
        currentMeasure = [];
        accumulated = 0;
        measureIndex++;
        measureCapacity = getMeasureCapacity(measureIndex);
      }
      currentMeasure.push(i);
      accumulated += this.notes[i].durationBeats;
    }
    if (currentMeasure.length > 0) {
      measures.push(currentMeasure);
    }

    return measures;
  }

  computeBeatNoteMapping(): BeatNoteEntry[][] {
    const measures = this.computeMeasureNoteIndices();
    const result: BeatNoteEntry[][] = [];

    for (let m = 0; m < measures.length; m++) {
      const [numBeats] = getTimeSignatureAtMeasure(m);
      const noteIndices = measures[m];
      const beatDurationBeats = 0.5; // 四分音符 = 0.5 durationBeats

      const entries: BeatNoteEntry[] = [];
      let notePos = 0; // noteIndices内の位置
      let accumulatedInNote = 0; // 現在の音符内で消費済みのdurationBeats

      for (let beat = 0; beat < numBeats; beat++) {
        if (notePos < noteIndices.length) {
          entries.push({ beat, noteIndex: noteIndices[notePos] });
        }
        accumulatedInNote += beatDurationBeats;
        // 現在の音符のdurationBeatsを超えたら次の音符へ
        while (
          notePos < noteIndices.length &&
          accumulatedInNote >= this.notes[noteIndices[notePos]].durationBeats - 1e-9
        ) {
          accumulatedInNote -= this.notes[noteIndices[notePos]].durationBeats;
          notePos++;
        }
      }
      result.push(entries);
    }

    return result;
  }

  setNoteKeys(index: number, keys: string[]): void {
    if (index < 0 || index >= this.notes.length) return;
    this.notes[index] = { ...this.notes[index], keys };
    this.emit('change');
  }

  static createDefault(): ScoreDocument {
    return new ScoreDocument(
      [
        { id: 'n1', keys: ['c/4'], durationBeats: 0.5 },
        { id: 'n2', keys: ['d/4'], durationBeats: 0.5 },
        { id: 'n3', keys: ['e/4'], durationBeats: 0.5 },
        { id: 'n4', keys: ['f/4'], durationBeats: 0.5 },
      ],
      { tempo: 120, timeSignature: [4, 4] },
    );
  }
}
