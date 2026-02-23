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
import { renderAudioOffline } from '../audio/offlineAudioRenderer';
import type { ScoreDocument } from '../models/ScoreDocument';
import type { Timeline } from '../models/Timeline';

export type ExportFormat = 'mp4' | 'mov';

export type ExportOptions = {
  format: ExportFormat;
  document: ScoreDocument;
  timeline: Timeline;
  baseCanvases: HTMLCanvasElement[];
  noteXPositions: number[];
  fps?: number;
  onProgress?: (progress: number) => void;
};

export async function exportVideo(options: ExportOptions): Promise<void> {
  const {
    format,
    document,
    timeline,
    baseCanvases,
    noteXPositions,
    fps = 30,
    onProgress,
  } = options;

  const audioBuffer = await renderAudioOffline(document, timeline);

  const firstCanvas = baseCanvases[0];
  const width = firstCanvas.width % 2 === 0 ? firstCanvas.width : firstCanvas.width + 1;
  const height = firstCanvas.height % 2 === 0 ? firstCanvas.height : firstCanvas.height + 1;
  const renderer = new OfflineRenderer(width, height);
  await renderer.initialize(baseCanvases);

  const outputFormat = format === 'mov'
    ? new MovOutputFormat()
    : new Mp4OutputFormat({ fastStart: 'in-memory' });

  const target = new BufferTarget();
  const output = new Output({ format: outputFormat, target });

  const videoSource = new CanvasSource(renderer.canvas, {
    codec: 'avc',
    bitrate: QUALITY_HIGH,
  });
  output.addVideoTrack(videoSource);

  const audioSource = new AudioBufferSource(
    format === 'mov'
      ? { codec: 'pcm-f32' as any }
      : { codec: 'aac', bitrate: QUALITY_HIGH },
  );
  output.addAudioTrack(audioSource);

  await output.start();

  const totalFrames = Math.ceil(timeline.totalDuration * fps);
  const frameDuration = 1 / fps;

  for (let frame = 0; frame < totalFrames; frame++) {
    const elapsed = frame * frameDuration;
    renderer.renderFrame(elapsed, noteXPositions, timeline);
    await videoSource.add(elapsed, frameDuration);

    if (onProgress) {
      onProgress((frame + 1) / totalFrames);
    }
  }

  videoSource.close();

  await audioSource.add(audioBuffer);
  audioSource.close();

  await output.finalize();

  const buffer = target.buffer!;
  const ext = format === 'mov' ? 'mov' : 'mp4';
  const mimeType = format === 'mov' ? 'video/quicktime' : 'video/mp4';
  const blob = new Blob([buffer], { type: mimeType });

  const url = URL.createObjectURL(blob);
  const a = window.document.createElement('a');
  a.href = url;
  a.download = `score.${ext}`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export function isWebCodecsSupported(): boolean {
  return typeof VideoEncoder !== 'undefined' && typeof AudioEncoder !== 'undefined';
}
