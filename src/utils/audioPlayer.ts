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

    keys.forEach(key => {
      const frequency = this.getFrequency(key);
      this.playNote(frequency, duration);
    });
  }

  private playNote(frequency: number, duration: number) {
    if (!this.audioContext) return;

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);

    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + duration);
  }

  private getFrequency(note: string): number {
    const noteMap: { [key: string]: number } = {
      'c/4': 261.63,
      'd/4': 293.66,
      'e/4': 329.63,
      'f/4': 349.23,
      'g/4': 392.00,
      'a/4': 440.00,
      'b/4': 493.88,
      'c/5': 523.25,
      'd/5': 587.33,
      'e/5': 659.25,
      'f/5': 698.46,
      'g/5': 783.99,
      'a/5': 880.00,
      'b/5': 987.77
    };

    return noteMap[note] || 440;
  }
}