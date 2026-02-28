import { atom } from 'nanostores';

type SelectionState = {
  selectedNoteIndices: Set<number>;
};

export const $selection = atom<SelectionState>({ selectedNoteIndices: new Set() });

export function selectNote(index: number): void {
  $selection.set({ selectedNoteIndices: new Set([index]) });
}

export function toggleNote(index: number): void {
  const current = new Set($selection.get().selectedNoteIndices);
  if (current.has(index)) {
    current.delete(index);
  } else {
    current.add(index);
  }
  $selection.set({ selectedNoteIndices: current });
}

export function selectRange(from: number, to: number): void {
  const min = Math.min(from, to);
  const max = Math.max(from, to);
  const indices = new Set<number>();
  for (let i = min; i <= max; i++) {
    indices.add(i);
  }
  $selection.set({ selectedNoteIndices: indices });
}

export function selectMeasureNotes(indices: number[]): void {
  $selection.set({ selectedNoteIndices: new Set(indices) });
}

export function clearSelection(): void {
  if ($selection.get().selectedNoteIndices.size > 0) {
    $selection.set({ selectedNoteIndices: new Set() });
  }
}

export function adjustSelectionForInsert(insertIndex: number): void {
  const current = $selection.get().selectedNoteIndices;
  if (current.size === 0) return;
  const adjusted = new Set<number>();
  for (const idx of current) {
    adjusted.add(idx >= insertIndex ? idx + 1 : idx);
  }
  $selection.set({ selectedNoteIndices: adjusted });
}

export function adjustSelectionForRemove(removeIndex: number): void {
  const current = $selection.get().selectedNoteIndices;
  if (current.size === 0) return;
  const adjusted = new Set<number>();
  for (const idx of current) {
    if (idx === removeIndex) continue;
    adjusted.add(idx > removeIndex ? idx - 1 : idx);
  }
  $selection.set({ selectedNoteIndices: adjusted });
}
