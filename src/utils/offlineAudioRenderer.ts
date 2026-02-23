import { getFrequency } from './noteFrequencies';
import type { Note } from './scoreConfig';

/**
 * OfflineAudioContextを使って音声をAudioBufferにレンダリングする。
 * audioPlayer.tsのplayChord/playNoteと同じロジック（sine波 + exponential decay）を使用。
 */
export async function renderAudioOffline(
  notes: Note[],
  beatDuration: number,
  sampleRate = 44100,
): Promise<AudioBuffer> {
  // 各音符の開始時刻を計算
  const noteStartTimes: number[] = [];
  let time = 0;
  for (const note of notes) {
    noteStartTimes.push(time);
    time += note.duration * beatDuration;
  }
  const totalDuration = time;

  const offlineCtx = new OfflineAudioContext(2, Math.ceil(totalDuration * sampleRate), sampleRate);

  // audioPlayer.tsのplayChord/playNoteと同じロジックで各音をスケジュール
  for (let i = 0; i < notes.length; i++) {
    const startTime = noteStartTimes[i];
    const dur = notes[i].duration * beatDuration;

    for (const key of notes[i].keys) {
      const frequency = getFrequency(key);

      const oscillator = offlineCtx.createOscillator();
      const gainNode = offlineCtx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(offlineCtx.destination);

      oscillator.frequency.value = frequency;
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.3, startTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + dur);

      oscillator.start(startTime);
      oscillator.stop(startTime + dur);
    }
  }

  return offlineCtx.startRendering();
}
