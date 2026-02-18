type Note = { keys: string[]; duration: number };

/**
 * 事前にCanvasに描画された楽譜をベースに、
 * プレイヘッド付きのフレームを生成する。
 */
export class OfflineRenderer {
  private _canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private baseImage: ImageBitmap | null = null;

  constructor(width: number, height: number) {
    this._canvas = document.createElement('canvas');
    this._canvas.width = width;
    this._canvas.height = height;
    this.ctx = this._canvas.getContext('2d')!;
  }

  /**
   * 描画済みCanvasをベース画像としてキャッシュする。
   * ImageBitmapに変換して保持（高速な描画が可能）。
   */
  async initialize(baseCanvas: HTMLCanvasElement): Promise<void> {
    this.baseImage = await createImageBitmap(baseCanvas);
  }

  /**
   * 指定した経過時間に対応するフレームをCanvasに描画する。
   * index.astroのplayAllNotesと同じ補間ロジックでプレイヘッド位置を計算。
   */
  renderFrame(
    elapsedSeconds: number,
    noteXPositions: number[],
    notes: Note[],
    beatDuration: number,
  ): void {
    const { ctx, _canvas: canvas } = this;

    // 背景クリア（白）
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // ベース画像（楽譜）を描画
    if (this.baseImage) {
      ctx.drawImage(this.baseImage, 0, 0);
    }

    // 各音符の開始時刻を計算
    const noteStartTimes: number[] = [];
    let time = 0;
    for (const note of notes) {
      noteStartTimes.push(time);
      time += note.duration * beatDuration;
    }
    const totalDuration = time;

    if (elapsedSeconds < 0 || elapsedSeconds >= totalDuration) return;

    // 現在どの音符か（playAllNotesと同じロジック）
    let currentIndex = 0;
    for (let i = notes.length - 1; i >= 0; i--) {
      if (elapsedSeconds >= noteStartTimes[i]) {
        currentIndex = i;
        break;
      }
    }

    // 線形補間でプレイヘッドX座標を計算
    const noteStart = noteStartTimes[currentIndex];
    const noteDur = notes[currentIndex].duration * beatDuration;
    const progress = (elapsedSeconds - noteStart) / noteDur;

    const currentX = noteXPositions[currentIndex];
    const nextX = currentIndex < noteXPositions.length - 1
      ? noteXPositions[currentIndex + 1]
      : currentX + 50;
    const x = currentX + (nextX - currentX) * Math.min(progress, 1);

    // プレイヘッドを描画
    this.drawPlayhead(x, canvas.height);
  }

  private drawPlayhead(x: number, height: number): void {
    const { ctx } = this;

    // 影
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.roundRect(x + 2, 0, 4, height, 2);
    ctx.fill();

    // メインライン（赤グラデーション）
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#FF4444');
    gradient.addColorStop(0.5, '#FF0000');
    gradient.addColorStop(1, '#CC0000');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.roundRect(x, 0, 3, height, 1);
    ctx.fill();
  }

  get canvas(): HTMLCanvasElement {
    return this._canvas;
  }
}
