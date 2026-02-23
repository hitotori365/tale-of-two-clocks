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

export function getFrequency(note: string): number {
  return noteMap[note] || 440;
}
