import type { AudioPlayer } from './audio/audioPlayer';
import type { ScoreDocument } from './models/ScoreDocument';
import type { Timeline } from './models/Timeline';
import type { ScoreRenderer } from './rendering/ScoreRenderer';

export const showPlayhead = (playheadEl: HTMLElement, x: number): void => {
  playheadEl.style.display = 'block';
  playheadEl.style.transform = `translateX(${x}px)`;
};

export const hidePlayhead = (playheadEl: HTMLElement): void => {
  playheadEl.style.display = 'none';
};

export const playAllNotes = (
  document: ScoreDocument,
  timeline: Timeline,
  notationEl: HTMLElement,
  renderer: ScoreRenderer,
  audioPlayer: AudioPlayer,
  noteXPositions: number[],
  playheadEl: HTMLElement,
  onComplete: () => void,
): void => {
  const beatDuration = document.beatDuration;

  const scheduleAction = (action: () => void, delayMs: number): number =>
    window.setTimeout(action, delayMs);

  for (let i = 0; i < document.notes.length; i++) {
    scheduleAction(() => {
      audioPlayer.playChord(document.notes[i].keys, timeline.noteDurations[i]);
    }, timeline.noteStartTimes[i] * 1000);
  }

  const animStartTime = performance.now();
  let prevNoteIndex = -1;

  const update = () => {
    const elapsed = (performance.now() - animStartTime) / 1000;
    if (elapsed >= timeline.totalDuration) {
      renderer.renderToSVG(notationEl, document);
      hidePlayhead(playheadEl);
      onComplete();
      return;
    }

    const currentIndex = timeline.getIndexAtTime(elapsed);

    if (currentIndex !== prevNoteIndex) {
      renderer.renderToSVG(notationEl, document, currentIndex);
      prevNoteIndex = currentIndex;
    }

    const x = timeline.getPlayheadX(elapsed, noteXPositions);
    showPlayhead(playheadEl, x);
    requestAnimationFrame(update);
  };

  requestAnimationFrame(update);
};
