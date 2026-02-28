import { scheduleChord } from './synthEngine';
import type { ScoreDocument } from '../models/ScoreDocument';
import type { Timeline } from '../models/Timeline';

export async function renderAudioOffline(
  document: ScoreDocument,
  timeline: Timeline,
  sampleRate = 44100,
): Promise<AudioBuffer> {
  const offlineCtx = new OfflineAudioContext(
    2,
    Math.ceil(timeline.totalDuration * sampleRate),
    sampleRate,
  );

  for (let i = 0; i < document.notes.length; i++) {
    if (document.notes[i].isRest) continue;
    scheduleChord(
      offlineCtx,
      document.notes[i].keys,
      timeline.noteStartTimes[i],
      timeline.noteDurations[i],
    );
  }

  return offlineCtx.startRendering();
}
