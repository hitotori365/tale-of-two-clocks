import type { ScoreDocument, NoteData } from './ScoreDocument';

type Snapshot = {
  notes: NoteData[];
  chords: Map<number, Map<number, string>>;
};

export class UndoManager {
  private undoStack: Snapshot[] = [];
  private redoStack: Snapshot[] = [];
  private maxHistory = 50;
  private document: ScoreDocument;

  constructor(document: ScoreDocument) {
    this.document = document;
  }

  saveSnapshot(): void {
    this.undoStack.push(this.capture());
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }
    this.redoStack = [];
  }

  undo(): boolean {
    if (this.undoStack.length === 0) return false;
    this.redoStack.push(this.capture());
    const snapshot = this.undoStack.pop()!;
    this.restore(snapshot);
    return true;
  }

  redo(): boolean {
    if (this.redoStack.length === 0) return false;
    this.undoStack.push(this.capture());
    const snapshot = this.redoStack.pop()!;
    this.restore(snapshot);
    return true;
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  private capture(): Snapshot {
    const notes = this.document.notes.map(n => ({
      ...n,
      keys: [...n.keys],
    }));
    const chords = new Map<number, Map<number, string>>();
    for (const [m, beats] of this.document.chords) {
      chords.set(m, new Map(beats));
    }
    return { notes, chords };
  }

  private restore(snapshot: Snapshot): void {
    this.document.notes = snapshot.notes.map(n => ({
      ...n,
      keys: [...n.keys],
    }));
    this.document.chords = new Map<number, Map<number, string>>();
    for (const [m, beats] of snapshot.chords) {
      this.document.chords.set(m, new Map(beats));
    }
    this.document.emit('change');
  }
}
