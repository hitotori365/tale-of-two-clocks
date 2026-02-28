import type { ScoreDocument, NotePosition } from '../models/ScoreDocument';
import { yToNearestPitch, pitchToY, snapY } from './pitchMap';
import { ROW_HEIGHT } from '../rendering/ScoreRenderer';

const STAVE_Y_BASE = 40; // pitchMapはこの値を前提としている

export type NoteInteractionConfig = {
  wrapper: HTMLElement;
  container: HTMLElement;
  scoreDocument: ScoreDocument;
  getNotePositions: () => NotePosition[];
  isPlaybackActive: () => boolean;
};

type DragState = {
  noteIndex: number;
  originalKey: string;
  startY: number;
  rowOffset: number; // staveY - STAVE_Y_BASE
};

const HIT_TOLERANCE_X = 20;
const HIT_TOLERANCE_Y = 20;

export class NoteInteraction {
  private config: NoteInteractionConfig;
  private dragState: DragState | null = null;

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

    this.config.container.addEventListener('mousedown', this.onMouseDown.bind(this));
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

    const svgX = this.getSvgX(e.clientX);
    const svgY = this.getSvgY(e.clientY);
    const noteIndex = this.findNoteAtPosition(svgX, svgY);

    if (noteIndex === null) return;

    e.preventDefault();

    const positions = this.config.getNotePositions();
    const rowOffset = positions[noteIndex].y - STAVE_Y_BASE;
    const originalKey = this.config.scoreDocument.notes[noteIndex].keys[0];

    this.dragState = {
      noteIndex,
      originalKey,
      startY: svgY,
      rowOffset,
    };

    this.createHybridClone(noteIndex);

    this.config.container.style.cursor = 'grabbing';
    document.addEventListener('mousemove', this.boundMouseMove);
    document.addEventListener('mouseup', this.boundMouseUp);
  }

  private onMouseMove(e: MouseEvent): void {
    if (!this.dragState) return;

    const svgY = this.getSvgY(e.clientY);
    // rowOffsetを引いてpitchMap座標系に変換
    const snappedY = snapY(svgY - this.dragState.rowOffset);

    this.updateHybridClone(snappedY + this.dragState.rowOffset);
  }

  private onMouseUp(e: MouseEvent): void {
    if (!this.dragState) return;

    const svgY = this.getSvgY(e.clientY);
    // rowOffsetを引いてpitchMap座標系に変換
    const newKey = yToNearestPitch(svgY - this.dragState.rowOffset);
    const { noteIndex, originalKey } = this.dragState;

    this.removeHybridClone();
    if (newKey !== originalKey) {
      this.config.scoreDocument.setNoteKeys(noteIndex, [newKey]);
    }

    this.dragState = null;
    this.config.container.style.cursor = '';
    document.removeEventListener('mousemove', this.boundMouseMove);
    document.removeEventListener('mouseup', this.boundMouseUp);
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
    const found = this.findNoteheadText(noteIndex);
    if (!found) return;
    const { text: originalText, notehead, scoreSvg } = found;

    // <text>要素をクローンし、フォント属性を明示的に解決
    const clonedText = originalText.cloneNode(true) as SVGTextElement;
    this.resolveInheritedFontAttrs(clonedText, notehead as Element);
    clonedText.style.fill = 'rgba(255, 0, 0, 0.5)';
    clonedText.style.stroke = 'none';

    // 元のノートヘッドの位置を取得
    const headBBox = notehead.getBoundingClientRect();
    const svgRect = scoreSvg.getBoundingClientRect();
    this.cloneOriginalY = headBBox.top + headBBox.height / 2 - svgRect.top;

    // オーバーレイ作成
    const overlay = this.createSvgOverlay(scoreSvg);
    const wrapperG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    wrapperG.appendChild(clonedText);
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
