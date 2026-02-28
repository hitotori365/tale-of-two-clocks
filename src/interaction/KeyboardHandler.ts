import type { ScoreDocument } from '../models/ScoreDocument';
import type { UndoManager } from '../models/UndoManager';
import { $selection, selectNote, clearSelection } from '../stores/selectionStore';

export class KeyboardHandler {
  private scoreDocument: ScoreDocument;
  private undoManager: UndoManager;

  constructor(scoreDocument: ScoreDocument, undoManager: UndoManager) {
    this.scoreDocument = scoreDocument;
    this.undoManager = undoManager;
    document.addEventListener('keydown', this.onKeyDown.bind(this));
  }

  private onKeyDown(e: KeyboardEvent): void {
    // テキスト入力中はスキップ
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }

    const isMeta = e.metaKey || e.ctrlKey;

    // Cmd+Z / Cmd+Shift+Z
    if (isMeta && e.key === 'z') {
      e.preventDefault();
      if (e.shiftKey) {
        this.undoManager.redo();
      } else {
        this.undoManager.undo();
      }
      return;
    }

    // 矢印キーで選択移動
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      this.moveSelection(e.key === 'ArrowRight' ? 1 : -1);
      return;
    }

    // Escape で選択解除
    if (e.key === 'Escape') {
      clearSelection();
      return;
    }
  }

  private moveSelection(direction: number): void {
    const { selectedNoteIndices } = $selection.get();
    const noteCount = this.scoreDocument.notes.length;
    if (noteCount === 0) return;

    if (selectedNoteIndices.size === 0) {
      // 何も選択されていなければ最初/最後のノートを選択
      selectNote(direction > 0 ? 0 : noteCount - 1);
      return;
    }

    // 選択の端を基準に移動
    const indices = Array.from(selectedNoteIndices).sort((a, b) => a - b);
    const anchor = direction > 0 ? indices[indices.length - 1] : indices[0];
    const next = anchor + direction;
    if (next >= 0 && next < noteCount) {
      selectNote(next);
    }
  }
}
