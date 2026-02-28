import { atom } from 'nanostores';

export type TimeSignatureEntry = {
  measureIndex: number;
  timeSignature: [number, number];
};

const DEFAULT_ENTRIES: TimeSignatureEntry[] = [
  { measureIndex: 0, timeSignature: [4, 4] },
];

export const $timeSignatures = atom<TimeSignatureEntry[]>(DEFAULT_ENTRIES);

export function resetTimeSignatures(): void {
  $timeSignatures.set([...DEFAULT_ENTRIES.map(e => ({ ...e, timeSignature: [...e.timeSignature] as [number, number] }))]);
}

export function setTimeSignature(measureIndex: number, timeSignature: [number, number]): void {
  const entries = $timeSignatures.get().filter(e => e.measureIndex !== measureIndex);
  entries.push({ measureIndex, timeSignature });
  entries.sort((a, b) => a.measureIndex - b.measureIndex);
  $timeSignatures.set(entries);
}

export function getTimeSignatureAtMeasure(measureIndex: number): [number, number] {
  const entries = $timeSignatures.get();
  let result: [number, number] = [4, 4];
  for (const entry of entries) {
    if (entry.measureIndex <= measureIndex) {
      result = entry.timeSignature;
    } else {
      break;
    }
  }
  return result;
}
