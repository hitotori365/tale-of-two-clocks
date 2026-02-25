import type { ScoreDocument } from '../models/ScoreDocument';
import { yToNearestPitch, pitchToY, snapY } from './pitchMap';

export type NoteInteractionConfig = {
  wrapper: HTMLElement;
  container: HTMLElement;
  scoreDocument: ScoreDocument;
  getNoteXPositions: () => number[];
  isPlaybackActive: () => boolean;
};

type DragState = {
  noteIndex: number;
  originalKey: string;
  startY: number;
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
    const xPositions = this.config.getNoteXPositions();
    let bestIndex = -1;
    let bestDist = Infinity;

    for (let i = 0; i < xPositions.length; i++) {
      const dist = Math.abs(svgX - xPositions[i]);
      if (dist < bestDist) {
        bestDist = dist;
        bestIndex = i;
      }
    }

    if (bestIndex === -1 || bestDist > HIT_TOLERANCE_X) return null;

    // Y位置の検証: 現在の音符のY座標と比較
    const currentKey = this.config.scoreDocument.notes[bestIndex].keys[0];
    const noteY = pitchToY(currentKey);
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

    const originalKey = this.config.scoreDocument.notes[noteIndex].keys[0];

    this.dragState = {
      noteIndex,
      originalKey,
      startY: svgY,
    };

    this.createHybridClone(noteIndex);

    this.config.container.style.cursor = 'grabbing';
    document.addEventListener('mousemove', this.boundMouseMove);
    document.addEventListener('mouseup', this.boundMouseUp);
  }

  private onMouseMove(e: MouseEvent): void {
    if (!this.dragState) return;

    const svgY = this.getSvgY(e.clientY);
    const snappedY = snapY(svgY);

    this.updateHybridClone(snappedY);
  }

  private onMouseUp(e: MouseEvent): void {
    if (!this.dragState) return;

    const svgY = this.getSvgY(e.clientY);
    const newKey = yToNearestPitch(svgY);
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

  /** 祖先<g>チェーンからフォント属性を収集して<text>に明示的に設定する */
  private resolveInheritedFontAttrs(textEl: SVGTextElement, ancestor: Element): void {
    const fontAttrs = ['font-family', 'font-size', 'font-weight', 'font-style'] as const;
    for (const attr of fontAttrs) {
      if (!textEl.hasAttribute(attr)) {
        // 祖先を辿って最初に見つかった値を使う
        let node: Element | null = ancestor;
        while (node) {
          const val = node.getAttribute(attr);
          if (val) {
            textEl.setAttribute(attr, val);
            break;
          }
          node = node.parentElement;
        }
      }
    }
  }

  private createHybridClone(noteIndex: number): void {
    const scoreSvg = this.config.container.querySelector('svg');
    if (!scoreSvg) return;

    // VexFlowが描画した .vf-stavenote を全て取得し、noteIndex番目を選ぶ
    const staveNotes = scoreSvg.querySelectorAll('.vf-stavenote');
    const targetNote = staveNotes[noteIndex];
    if (!targetNote) return;

    // .vf-notehead 内の <text> 要素を取得（音符グリフ本体）
    const notehead = targetNote.querySelector('.vf-notehead');
    if (!notehead) return;

    const originalText = notehead.querySelector('text');
    if (!originalText) return;

    // <text>要素をクローンし、フォント属性を明示的に解決
    const clonedText = originalText.cloneNode(true) as SVGTextElement;
    this.resolveInheritedFontAttrs(clonedText, notehead as Element);

    // 赤色半透明 + stroke:none（グリフ輪郭を描画しない）
    clonedText.style.fill = 'rgba(255, 0, 0, 0.5)';
    clonedText.style.stroke = 'none';

    // 元のノートヘッドの位置を取得
    const headBBox = notehead.getBoundingClientRect();
    const svgRect = scoreSvg.getBoundingClientRect();
    this.cloneOriginalY = headBBox.top + headBBox.height / 2 - svgRect.top;

    // SVGオーバーレイを作成（score SVGと同サイズ、position:absolute）
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

    // ラッパーグループ（translateで移動する対象）
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
