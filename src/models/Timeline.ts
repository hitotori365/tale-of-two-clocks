import type { ScoreDocument, NotePosition } from './ScoreDocument';

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

  getPlayheadPosition(elapsedSeconds: number, notePositions: NotePosition[]): NotePosition {
    const currentIndex = this.getIndexAtTime(elapsedSeconds);
    const noteStart = this.noteStartTimes[currentIndex];
    const noteDur = this.noteDurations[currentIndex];
    const progress = (elapsedSeconds - noteStart) / noteDur;

    const current = notePositions[currentIndex];
    const next = currentIndex < notePositions.length - 1
      ? notePositions[currentIndex + 1]
      : { x: current.x + 50, y: current.y };

    // 同一行内: X補間
    if (current.y === next.y) {
      return {
        x: current.x + (next.x - current.x) * Math.min(progress, 1),
        y: current.y,
      };
    }

    // 行またぎ: 現在行の末尾まで進んでからジャンプ
    if (progress < 1) {
      return {
        x: current.x + 50 * Math.min(progress, 1),
        y: current.y,
      };
    }
    return { x: next.x, y: next.y };
  }
}
