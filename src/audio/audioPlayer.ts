import { scheduleChord } from './synthEngine';

export class AudioPlayer {
  private audioContext: AudioContext | null = null;
  private isInitialized = false;

  async initialize() {
    if (!this.isInitialized && typeof window !== 'undefined') {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.isInitialized = true;
    }
  }

  async resume() {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  playChord(keys: string[], duration: number) {
    if (!this.audioContext) return;
    scheduleChord(this.audioContext, keys, this.audioContext.currentTime, duration);
  }
}
