import type { ScoreDocument } from '../models/ScoreDocument';

export type ChordInteractionConfig = {
  wrapper: HTMLElement;
  container: HTMLElement;
  clickZone: HTMLElement;
  popover: HTMLElement;
  input: HTMLInputElement;
  scoreDocument: ScoreDocument;
  getNoteXPositions: () => number[];
  isPlaybackActive: () => boolean;
};

export class ChordInteraction {
  private config: ChordInteractionConfig;
  private activeMeasureIndex: number | null = null;
  private activeBeatIndex: number | null = null;
  private beatIndicators: HTMLElement[] = [];
  private isMouseInZone = false;

  constructor(config: ChordInteractionConfig) {
    this.config = config;

    this.config.clickZone.addEventListener('mouseenter', this.onMouseEnter.bind(this));
    this.config.clickZone.addEventListener('mouseleave', this.onMouseLeave.bind(this));
    this.config.input.addEventListener('keydown', this.onInputKeyDown.bind(this));
    document.addEventListener('mousedown', this.onDocumentMouseDown.bind(this));
  }

  private onMouseEnter(): void {
    if (this.config.isPlaybackActive()) return;
    this.isMouseInZone = true;
    this.showBeatIndicators();
  }

  private onMouseLeave(): void {
    this.isMouseInZone = false;
    if (!this.isPopoverOpen()) {
      this.removeBeatIndicators();
    }
  }

  private isPopoverOpen(): boolean {
    return this.activeMeasureIndex !== null;
  }

  private showBeatIndicators(): void {
    this.removeBeatIndicators();

    const beatNoteMapping = this.config.scoreDocument.computeBeatNoteMapping();
    const xPositions = this.config.getNoteXPositions();
    if (beatNoteMapping.length === 0 || xPositions.length === 0) return;

    for (let m = 0; m < beatNoteMapping.length; m++) {
      const entries = beatNoteMapping[m];
      const measureChords = this.config.scoreDocument.getMeasureChords(m);

      for (let i = 0; i < entries.length; i++) {
        const { beat, noteIndex } = entries[i];
        const noteX = xPositions[noteIndex];

        // 拍矩形の幅を計算: 次の拍のX位置との差、または固定幅
        let width: number;
        if (i + 1 < entries.length) {
          width = xPositions[entries[i + 1].noteIndex] - noteX - 4;
        } else if (m + 1 < beatNoteMapping.length && beatNoteMapping[m + 1].length > 0) {
          width = xPositions[beatNoteMapping[m + 1][0].noteIndex] - noteX - 4;
        } else {
          width = 60;
        }
        width = Math.max(width, 30);

        const indicator = document.createElement('div');
        indicator.className = 'beat-indicator';
        indicator.style.cssText = `
          position: absolute;
          left: ${noteX - 10}px;
          top: 0;
          width: ${width}px;
          height: 100%;
          border: 1px solid transparent;
          border-radius: 4px;
          background: transparent;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          color: #888;
          transition: background 0.15s, border-color 0.15s;
          box-sizing: border-box;
        `;

        const chordText = measureChords.get(beat);
        if (chordText) {
          indicator.textContent = chordText;
          indicator.style.color = '#555';
          indicator.style.fontWeight = '500';
        }

        indicator.addEventListener('mouseenter', () => {
          indicator.style.background = 'rgba(59,130,246,0.08)';
          indicator.style.borderColor = '#93b8f7';
        });
        indicator.addEventListener('mouseleave', () => {
          indicator.style.background = 'transparent';
          indicator.style.borderColor = 'transparent';
        });

        indicator.addEventListener('click', (e) => {
          e.stopPropagation();
          this.showPopover(m, beat);
        });

        this.config.clickZone.appendChild(indicator);
        this.beatIndicators.push(indicator);
      }
    }
  }

  private removeBeatIndicators(): void {
    for (const el of this.beatIndicators) {
      el.remove();
    }
    this.beatIndicators = [];
  }

  private showPopover(measureIndex: number, beatIndex: number): void {
    this.activeMeasureIndex = measureIndex;
    this.activeBeatIndex = beatIndex;

    const beatNoteMapping = this.config.scoreDocument.computeBeatNoteMapping();
    const xPositions = this.config.getNoteXPositions();
    const entries = beatNoteMapping[measureIndex];
    const entry = entries.find(e => e.beat === beatIndex);
    const noteX = entry ? xPositions[entry.noteIndex] : xPositions[0];

    const popover = this.config.popover;
    popover.style.display = 'block';
    popover.style.left = `${noteX - 10}px`;
    popover.style.top = '0px';

    const existing = this.config.scoreDocument.getChord(measureIndex, beatIndex);
    this.config.input.value = existing ?? '';
    this.config.input.focus();
    this.config.input.select();
  }

  private hidePopover(): void {
    this.config.popover.style.display = 'none';
    this.activeMeasureIndex = null;
    this.activeBeatIndex = null;

    if (!this.isMouseInZone) {
      this.removeBeatIndicators();
    }
  }

  private commitChord(): void {
    if (this.activeMeasureIndex === null || this.activeBeatIndex === null) return;
    const value = this.config.input.value.trim();
    this.config.scoreDocument.setChord(this.activeMeasureIndex, this.activeBeatIndex, value);
    this.hidePopover();
    // コード変更後にインジケータを再表示（テキスト反映）
    if (this.isMouseInZone) {
      this.showBeatIndicators();
    }
  }

  private onInputKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Enter') {
      e.preventDefault();
      this.commitChord();
    } else if (e.key === 'Escape') {
      this.hidePopover();
    }
  }

  private onDocumentMouseDown(e: MouseEvent): void {
    if (this.activeMeasureIndex === null) return;
    if (this.config.popover.contains(e.target as Node)) return;
    this.commitChord();
  }
}
