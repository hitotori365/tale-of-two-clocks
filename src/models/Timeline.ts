import type { ScoreDocument } from './ScoreDocument';

export class Timeline {
  readonly noteStartTimes: number[];
  readonly noteDurations: number[];
  readonly totalDuration: number;

  constructor(document: ScoreDocument) {
    const beatDuration = document.beatDuration;
    const startTimes: number[] = [];
    const durations: number[] = [];
    let time = 0;
    for (const note of document.notes) {
      startTimes.push(time);
      const dur = note.durationBeats * beatDuration;
      durations.push(dur);
      time += dur;
    }
    this.noteStartTimes = startTimes;
    this.noteDurations = durations;
    this.totalDuration = time;
  }

  getIndexAtTime(elapsedSeconds: number): number {
    let index = 0;
    for (let i = this.noteStartTimes.length - 1; i >= 0; i--) {
      if (elapsedSeconds >= this.noteStartTimes[i]) {
        index = i;
        break;
      }
    }
    return index;
  }

  getPlayheadX(elapsedSeconds: number, noteXPositions: number[]): number {
    const currentIndex = this.getIndexAtTime(elapsedSeconds);
    const noteStart = this.noteStartTimes[currentIndex];
    const noteDur = this.noteDurations[currentIndex];
    const progress = (elapsedSeconds - noteStart) / noteDur;

    const currentX = noteXPositions[currentIndex];
    const nextX = currentIndex < noteXPositions.length - 1
      ? noteXPositions[currentIndex + 1]
      : currentX + 50;
    return currentX + (nextX - currentX) * Math.min(progress, 1);
  }
}
