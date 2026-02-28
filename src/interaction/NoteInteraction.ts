import type { ScoreDocument, NotePosition } from '../models/ScoreDocument';
import { yToNearestPitch, pitchToY, snapY } from './pitchMap';
import { ROW_HEIGHT } from '../rendering/ScoreRenderer';
import { $selection, selectNote, toggleNote, selectRange, clearSelection } from '../stores/selectionStore';

const STAVE_Y_BASE = 40; // pitchMapはこの値を前提としている

export type NoteInteractionConfig = {
  wrapper: HTMLElement;
  container: HTMLElement;
  scoreDocument: ScoreDocument;
  getNotePositions: () => NotePosition[];
  isPlaybackActive: () => boolean;
};

type DragState = {
  draggedIndex: number;
  affectedIndices: number[];
  originalKeys: Map<number, string>;
  startY: number;
  rowOffset: number; // staveY - STAVE_Y_BASE
};

type PendingClick = {
  noteIndex: number | null;
  startX: number;
  startY: number;
  shiftKey: boolean;
  metaKey: boolean;
};

const HIT_TOLERANCE_X = 20;
const HIT_TOLERANCE_Y = 20;
const DRAG_THRESHOLD = 5; // px

export class NoteInteraction {
  private config: NoteInteractionConfig;
  private dragState: DragState | null = null;
  private pendingClick: PendingClick | null = null;
  private isDragging: boolean = false;
  private selectionAnchor: number | null = null;

  // hybrid mode state
  private svgOverlay: SVGSVGElement | null = null;
  private clonedNoteGroup: SVGGElement | null = null;
  private cloneOriginalY: number = 0;

  private boundMouseMove: (e: MouseEvent) => void;
  private boundMouseUp: (e: MouseEvent) => void;

  constructor(config: NoteInteractionConfig) {
    this.config = config;
    this.boundMouseMove = this.onMouseMove.bind(this);
    this.boundMouseUp = this.onMouseUp.bind(this);

    // wrapperでイベントをキャッチ（chord-click-zoneがcontainerの上に被さるため）
    this.config.wrapper.addEventListener('mousedown', this.onMouseDown.bind(this));

    // 選択中ノート以外のクリックで選択解除
    document.addEventListener('mousedown', (e) => {
      if (this.config.isPlaybackActive()) return;
      if (!this.config.wrapper.contains(e.target as Node)) {
        clearSelection();
      }
    });
  }

  private getSvgY(clientY: number): number {
    const rect = this.config.container.getBoundingClientRect();
    return clientY - rect.top;
  }

  private getSvgX(clientX: number): number {
    const rect = this.config.container.getBoundingClientRect();
    return clientX - rect.left;
  }

  private findNoteAtPosition(svgX: number, svgY: number): number | null {
    const positions = this.config.getNotePositions();
    let bestIndex = -1;
    let bestDist = Infinity;

    for (let i = 0; i < positions.length; i++) {
      if (this.config.scoreDocument.notes[i]?.isRest) continue;
      // Y距離で行を絞り込む（staveYの中心付近にいるか）
      const rowCenterY = positions[i].y + 50; // stave中央付近
      if (Math.abs(svgY - rowCenterY) > ROW_HEIGHT / 2) continue;

      const dist = Math.abs(svgX - positions[i].x);
      if (dist < bestDist) {
        bestDist = dist;
        bestIndex = i;
      }
    }

    if (bestIndex === -1 || bestDist > HIT_TOLERANCE_X) return null;

    // Y位置の検証: 現在の音符のY座標と比較
    const currentKey = this.config.scoreDocument.notes[bestIndex].keys[0];
    const rowOffset = positions[bestIndex].y - STAVE_Y_BASE;
    const noteY = pitchToY(currentKey) + rowOffset;
    if (Math.abs(svgY - noteY) > HIT_TOLERANCE_Y) return null;

    return bestIndex;
  }

  private onMouseDown(e: MouseEvent): void {
    if (this.config.isPlaybackActive()) return;

    // chord-popoverやbeat-indicator上のクリックは無視
    const target = e.target as HTMLElement;
    if (target.closest('.chord-popover') || target.closest('.beat-indicator')) return;

    const svgX = this.getSvgX(e.clientX);
    const svgY = this.getSvgY(e.clientY);
    const noteIndex = this.findNoteAtPosition(svgX, svgY);

    e.preventDefault();

    this.pendingClick = {
      noteIndex,
      startX: svgX,
      startY: svgY,
      shiftKey: e.shiftKey,
      metaKey: e.metaKey || e.ctrlKey,
    };
    this.isDragging = false;

    if (noteIndex !== null) {
      const positions = this.config.getNotePositions();
      const rowOffset = positions[noteIndex].y - STAVE_Y_BASE;

      const { selectedNoteIndices } = $selection.get();
      const affectedIndices = selectedNoteIndices.has(noteIndex) && selectedNoteIndices.size > 1
        ? Array.from(selectedNoteIndices)
        : [noteIndex];

      const originalKeys = new Map<number, string>();
      for (const idx of affectedIndices) {
        originalKeys.set(idx, this.config.scoreDocument.notes[idx].keys[0]);
      }

      this.dragState = {
        draggedIndex: noteIndex,
        affectedIndices,
        originalKeys,
        startY: svgY,
        rowOffset,
      };
    }

    document.addEventListener('mousemove', this.boundMouseMove);
    document.addEventListener('mouseup', this.boundMouseUp);
  }

  private onMouseMove(e: MouseEvent): void {
    if (!this.pendingClick) return;

    const svgY = this.getSvgY(e.clientY);

    // ドラッグ判定: Y方向の移動量がしきい値を超えた場合
    if (!this.isDragging) {
      const deltaY = Math.abs(svgY - this.pendingClick.startY);
      if (deltaY > DRAG_THRESHOLD && this.dragState) {
        this.isDragging = true;
        this.createHybridClone(this.dragState.draggedIndex);
        this.config.container.style.cursor = 'grabbing';
      } else {
        return;
      }
    }

    if (!this.dragState) return;

    // rowOffsetを引いてpitchMap座標系に変換
    const snappedY = snapY(svgY - this.dragState.rowOffset);
    this.updateHybridClone(snappedY + this.dragState.rowOffset);
  }

  private onMouseUp(e: MouseEvent): void {
    document.removeEventListener('mousemove', this.boundMouseMove);
    document.removeEventListener('mouseup', this.boundMouseUp);

    if (this.isDragging && this.dragState) {
      // ドラッグ完了: 音程変更（選択中なら全選択ノートをまとめて移動）
      const svgY = this.getSvgY(e.clientY);
      const newKey = yToNearestPitch(svgY - this.dragState.rowOffset);
      const { draggedIndex, affectedIndices, originalKeys } = this.dragState;
      const draggedOriginalKey = originalKeys.get(draggedIndex)!;

      this.removeHybridClone();
      if (newKey !== draggedOriginalKey) {
        const deltaY = pitchToY(newKey) - pitchToY(draggedOriginalKey);
        this.config.scoreDocument.batch(() => {
          for (const idx of affectedIndices) {
            const origKey = originalKeys.get(idx)!;
            const newNoteKey = yToNearestPitch(pitchToY(origKey) + deltaY);
            this.config.scoreDocument.setNoteKeys(idx, [newNoteKey]);
          }
        });
      }

      this.config.container.style.cursor = '';
    } else if (this.pendingClick) {
      // クリック: 選択操作
      this.handleClick(this.pendingClick);
    }

    this.dragState = null;
    this.pendingClick = null;
    this.isDragging = false;
  }

  private handleClick(click: PendingClick): void {
    if (click.noteIndex === null) {
      clearSelection();
      return;
    }

    if (click.metaKey) {
      toggleNote(click.noteIndex);
    } else if (click.shiftKey && this.selectionAnchor !== null) {
      selectRange(this.selectionAnchor, click.noteIndex);
    } else {
      selectNote(click.noteIndex);
      this.selectionAnchor = click.noteIndex;
    }

    // Shift+クリックではアンカーを更新しない
    if (!click.shiftKey) {
      this.selectionAnchor = click.noteIndex;
    }
  }

  // --- Hybrid mode (SVG notehead clone) ---

  /** 祖先チェーンを辿り、指定属性の値を探す */
  private findAncestorAttr(start: Element, attr: string): string | null {
    let node: Element | null = start;
    while (node) {
      const val = node.getAttribute(attr);
      if (val) return val;
      node = node.parentElement;
    }
    return null;
  }

  /** 祖先<g>チェーンからフォント属性を収集して<text>に明示的に設定する */
  private resolveInheritedFontAttrs(textEl: SVGTextElement, ancestor: Element): void {
    const fontAttrs = ['font-family', 'font-size', 'font-weight', 'font-style'] as const;
    for (const attr of fontAttrs) {
      if (textEl.hasAttribute(attr)) continue;
      const val = this.findAncestorAttr(ancestor, attr);
      if (val) textEl.setAttribute(attr, val);
    }
  }

  /** VexFlowのSVGからnoteIndex番目のノートヘッド<text>要素を取得する */
  private findNoteheadText(noteIndex: number): { text: SVGTextElement; notehead: Element; scoreSvg: SVGSVGElement } | null {
    const scoreSvg = this.config.container.querySelector('svg');
    if (!scoreSvg) return null;

    const staveNotes = scoreSvg.querySelectorAll('.vf-stavenote');
    const targetNote = staveNotes[noteIndex];
    if (!targetNote) return null;

    const notehead = targetNote.querySelector('.vf-notehead');
    if (!notehead) return null;

    const text = notehead.querySelector('text');
    if (!text) return null;

    return { text, notehead, scoreSvg };
  }

  /** score SVGと同サイズのオーバーレイSVGを生成する */
  private createSvgOverlay(scoreSvg: SVGSVGElement): SVGSVGElement {
    const svgWidth = scoreSvg.getAttribute('width') || scoreSvg.clientWidth.toString();
    const svgHeight = scoreSvg.getAttribute('height') || scoreSvg.clientHeight.toString();
    const viewBox = scoreSvg.getAttribute('viewBox') || `0 0 ${svgWidth} ${svgHeight}`;

    const overlay = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    overlay.setAttribute('width', svgWidth);
    overlay.setAttribute('height', svgHeight);
    overlay.setAttribute('viewBox', viewBox);
    overlay.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      pointer-events: none;
      z-index: 10;
    `;
    return overlay;
  }

  private createHybridClone(noteIndex: number): void {
    if (!this.dragState) return;
    const { affectedIndices } = this.dragState;

    const scoreSvg = this.config.container.querySelector('svg');
    if (!scoreSvg) return;

    const svgRect = scoreSvg.getBoundingClientRect();
    const overlay = this.createSvgOverlay(scoreSvg);
    const wrapperG = document.createElementNS('http://www.w3.org/2000/svg', 'g');

    // ドラッグ基準ノートのY座標を記録
    const draggedFound = this.findNoteheadText(noteIndex);
    if (!draggedFound) return;
    const draggedBBox = draggedFound.notehead.getBoundingClientRect();
    this.cloneOriginalY = draggedBBox.top + draggedBBox.height / 2 - svgRect.top;

    // 全対象ノートのクローンを作成
    for (const idx of affectedIndices) {
      const found = this.findNoteheadText(idx);
      if (!found) continue;
      const { text: originalText, notehead } = found;

      const clonedText = originalText.cloneNode(true) as SVGTextElement;
      this.resolveInheritedFontAttrs(clonedText, notehead as Element);
      clonedText.style.fill = 'rgba(255, 0, 0, 0.5)';
      clonedText.style.stroke = 'none';
      wrapperG.appendChild(clonedText);
    }

    overlay.appendChild(wrapperG);
    this.config.wrapper.appendChild(overlay);
    this.svgOverlay = overlay;
    this.clonedNoteGroup = wrapperG;
  }

  private updateHybridClone(snappedY: number): void {
    if (!this.clonedNoteGroup) return;
    const deltaY = snappedY - this.cloneOriginalY;
    this.clonedNoteGroup.setAttribute('transform', `translate(0, ${deltaY})`);
  }

  private removeHybridClone(): void {
    if (this.svgOverlay) {
      this.svgOverlay.remove();
      this.svgOverlay = null;
    }
    this.clonedNoteGroup = null;
    this.cloneOriginalY = 0;
  }
}
