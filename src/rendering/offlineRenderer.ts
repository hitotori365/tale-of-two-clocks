import type { Timeline } from '../models/Timeline';
import type { NotePosition } from '../models/ScoreDocument';
import { ROW_HEIGHT } from './ScoreRenderer';

export class OfflineRenderer {
  private _canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private baseImages: ImageBitmap[] = [];

  constructor(width: number, height: number) {
    this._canvas = document.createElement('canvas');
    this._canvas.width = width;
    this._canvas.height = height;
    this.ctx = this._canvas.getContext('2d')!;
  }

  async initialize(baseCanvases: HTMLCanvasElement[]): Promise<void> {
    this.baseImages = await Promise.all(
      baseCanvases.map(c => createImageBitmap(c)),
    );
  }

  renderFrame(
    elapsedSeconds: number,
    notePositions: NotePosition[],
    timeline: Timeline,
  ): void {
    const { ctx, _canvas: canvas } = this;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (elapsedSeconds < 0 || elapsedSeconds >= timeline.totalDuration) return;

    const currentIndex = timeline.getIndexAtTime(elapsedSeconds);

    if (this.baseImages[currentIndex]) {
      ctx.drawImage(this.baseImages[currentIndex], 0, 0);
    }

    const pos = timeline.getPlayheadPosition(elapsedSeconds, notePositions);
    this.drawPlayhead(pos.x, pos.y, ROW_HEIGHT);
  }

  private drawPlayhead(x: number, y: number, rowHeight: number): void {
    const { ctx } = this;
    const top = y;
    const height = rowHeight;

    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.roundRect(x + 2, top, 4, height, 2);
    ctx.fill();

    const gradient = ctx.createLinearGradient(0, top, 0, top + height);
    gradient.addColorStop(0, '#FF4444');
    gradient.addColorStop(0.5, '#FF0000');
    gradient.addColorStop(1, '#CC0000');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.roundRect(x, top, 3, height, 1);
    ctx.fill();
  }

  get canvas(): HTMLCanvasElement {
    return this._canvas;
  }
}
