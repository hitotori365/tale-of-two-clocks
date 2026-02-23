export type NoteData = {
  id: string;
  keys: string[];
  durationBeats: number;
};

export type ScoreMetadata = {
  tempo: number;
  timeSignature: [number, number];
};

export class ScoreDocument {
  notes: NoteData[];
  metadata: ScoreMetadata;

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
