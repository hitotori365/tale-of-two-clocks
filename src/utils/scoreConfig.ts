import { StaveNote } from "vexflow";

export type Note = { keys: string[]; duration: number };

export const TEMPO = 120;
export const BEAT_DURATION = 60 / TEMPO;
export const CANVAS_WIDTH = 500;
export const CANVAS_HEIGHT = 200;
export const STAVE_CONFIG = { x: 10, y: 40, width: 400 };

export const createNoteData = (): Note[] => [
  { keys: ["c/4"], duration: 0.5 },
  { keys: ["d/4"], duration: 0.5 },
  { keys: ["e/4"], duration: 0.5 },
  { keys: ["f/4"], duration: 0.5 },
];

export const createVexNotes = (): StaveNote[] => [
  new StaveNote({ keys: ["c/4"], duration: "q" }),
  new StaveNote({ keys: ["d/4"], duration: "q" }),
  new StaveNote({ keys: ["e/4"], duration: "q" }),
  new StaveNote({ keys: ["f/4"], duration: "q" }),
];
