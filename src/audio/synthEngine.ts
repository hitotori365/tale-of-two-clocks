import { getFrequency } from './noteFrequencies';

export const SYNTH_CONFIG = {
  waveform: 'sine' as OscillatorType,
  attackGain: 0.3,
  releaseGain: 0.01,
};

export function scheduleNote(
  ctx: BaseAudioContext,
  frequency: number,
  startTime: number,
  duration: number,
): void {
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator.frequency.value = frequency;
  oscillator.type = SYNTH_CONFIG.waveform;

  gainNode.gain.setValueAtTime(SYNTH_CONFIG.attackGain, startTime);
  gainNode.gain.exponentialRampToValueAtTime(SYNTH_CONFIG.releaseGain, startTime + duration);

  oscillator.start(startTime);
  oscillator.stop(startTime + duration);
}

export function scheduleChord(
  ctx: BaseAudioContext,
  keys: string[],
  startTime: number,
  duration: number,
): void {
  for (const key of keys) {
    scheduleNote(ctx, getFrequency(key), startTime, duration);
  }
}
