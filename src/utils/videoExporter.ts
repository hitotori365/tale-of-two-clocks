import {
  Output,
  BufferTarget,
  Mp4OutputFormat,
  MovOutputFormat,
  CanvasSource,
  AudioBufferSource,
  QUALITY_HIGH,
} from 'mediabunny';
import { OfflineRenderer } from './offlineRenderer';
import { renderAudioOffline } from './offlineAudioRenderer';

type Note = { keys: string[]; duration: number };

export type ExportFormat = 'mp4' | 'mov';

export type ExportOptions = {
  format: ExportFormat;
  baseCanvases: HTMLCanvasElement[];
  notes: Note[];
  noteXPositions: number[];
  beatDuration: number;
  fps?: number;
  onProgress?: (progress: number) => void;
};

export async function exportVideo(options: ExportOptions): Promise<void> {
  const {
    format,
    baseCanvases,
    notes,
    noteXPositions,
    beatDuration,
    fps = 30,
    onProgress,
  } = options;

  // 総再生時間を計算
  let totalDuration = 0;
  for (const note of notes) {
    totalDuration += note.duration * beatDuration;
  }

  // 1. オフライン音声レンダリング
  const audioBuffer = await renderAudioOffline(notes, beatDuration);

  // 2. オフライン映像レンダラーを初期化（H.264は偶数サイズを要求）
  const firstCanvas = baseCanvases[0];
  const width = firstCanvas.width % 2 === 0 ? firstCanvas.width : firstCanvas.width + 1;
  const height = firstCanvas.height % 2 === 0 ? firstCanvas.height : firstCanvas.height + 1;
  const renderer = new OfflineRenderer(width, height);
  await renderer.initialize(baseCanvases);

  // 3. Mediabunny Outputを作成
  const outputFormat = format === 'mov'
    ? new MovOutputFormat()
    : new Mp4OutputFormat({ fastStart: 'in-memory' });

  const target = new BufferTarget();
  const output = new Output({ format: outputFormat, target });

  // 4. トラックを追加
  const videoSource = new CanvasSource(renderer.canvas, {
    codec: 'avc',
    bitrate: QUALITY_HIGH,
  });
  output.addVideoTrack(videoSource);

  // MOVはPCM音声（ビルトインエンコーダー）、MP4はAAC
  const audioSource = new AudioBufferSource(
    format === 'mov'
      ? { codec: 'pcm-f32' as any }
      : { codec: 'aac', bitrate: QUALITY_HIGH },
  );
  output.addAudioTrack(audioSource);

  await output.start();

  // 5. フレームループ
  const totalFrames = Math.ceil(totalDuration * fps);
  const frameDuration = 1 / fps;

  for (let frame = 0; frame < totalFrames; frame++) {
    const elapsed = frame * frameDuration;
    renderer.renderFrame(elapsed, noteXPositions, notes, beatDuration);
    await videoSource.add(elapsed, frameDuration);

    if (onProgress) {
      onProgress((frame + 1) / totalFrames);
    }
  }

  videoSource.close();

  // 6. 音声を追加
  await audioSource.add(audioBuffer);
  audioSource.close();

  // 7. ファイナライズしてダウンロード
  await output.finalize();

  const buffer = target.buffer!;
  const ext = format === 'mov' ? 'mov' : 'mp4';
  const mimeType = format === 'mov' ? 'video/quicktime' : 'video/mp4';
  const blob = new Blob([buffer], { type: mimeType });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `score.${ext}`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/**
 * WebCodecs APIがサポートされているかチェック
 */
export function isWebCodecsSupported(): boolean {
  return typeof VideoEncoder !== 'undefined' && typeof AudioEncoder !== 'undefined';
}
