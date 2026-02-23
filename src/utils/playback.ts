import type { AudioPlayer } from "./audioPlayer";
import { type Note, BEAT_DURATION, createVexNotes } from "./scoreConfig";
import { renderNotation } from "./notationRenderer";

export const showPlayhead = (playheadEl: HTMLElement, x: number): void => {
  playheadEl.style.display = 'block';
  playheadEl.style.transform = `translateX(${x}px)`;
};

export const hidePlayhead = (playheadEl: HTMLElement): void => {
  playheadEl.style.display = 'none';
};

export const playAllNotes = (
  notes: Note[],
  notationEl: HTMLElement,
  audioPlayer: AudioPlayer,
  noteXPositions: number[],
  playheadEl: HTMLElement,
  onComplete: () => void,
): void => {
  // 各音符の開始時刻(秒)を事前計算
  const noteStartTimes: number[] = [];
  let time = 0;
  for (const note of notes) {
    noteStartTimes.push(time);
    time += note.duration * BEAT_DURATION;
  }
  const totalDuration = time;

  // 遅延実行のスケジューリング
  const scheduleAction = (action: () => void, delayMs: number): number =>
    window.setTimeout(action, delayMs);

  // 音声の発音をスケジュール
  for (let i = 0; i < notes.length; i++) {
    scheduleAction(() => {
      audioPlayer.playChord(notes[i].keys, notes[i].duration * BEAT_DURATION);
    }, noteStartTimes[i] * 1000);
  }

  // アニメーションループ
  const animStartTime = performance.now();
  let prevNoteIndex = -1;

  const update = () => {
    const elapsed = (performance.now() - animStartTime) / 1000;
    if (elapsed >= totalDuration) {
      // 全音符を黒に戻す（再描画）
      renderNotation(notationEl, createVexNotes());
      hidePlayhead(playheadEl);
      onComplete();
      return;
    }

    // 現在どの音符か
    let currentIndex = 0;
    for (let i = notes.length - 1; i >= 0; i--) {
      if (elapsed >= noteStartTimes[i]) {
        currentIndex = i;
        break;
      }
    }

    // 音符の色を更新（インデックスが変わったときだけ再描画）
    if (currentIndex !== prevNoteIndex) {
      renderNotation(notationEl, createVexNotes(), currentIndex);
      prevNoteIndex = currentIndex;
    }

    const noteStart = noteStartTimes[currentIndex];
    const noteDur = notes[currentIndex].duration * BEAT_DURATION;
    const progress = (elapsed - noteStart) / noteDur;

    const currentX = noteXPositions[currentIndex];
    const nextX = currentIndex < noteXPositions.length - 1
      ? noteXPositions[currentIndex + 1]
      : currentX + 50;
    const x = currentX + (nextX - currentX) * Math.min(progress, 1);

    showPlayhead(playheadEl, x);
    requestAnimationFrame(update);
  };

  requestAnimationFrame(update);
};
