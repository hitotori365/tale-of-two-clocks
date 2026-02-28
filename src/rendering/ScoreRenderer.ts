import { Renderer, Stave, StaveNote, Voice, Formatter, Annotation } from 'vexflow';
import type { ScoreDocument, NotePosition } from '../models/ScoreDocument';
import { getTimeSignatureAtMeasure } from '../stores/timeSignatureStore';

const FIRST_STAVE_WIDTH = 400;
const SUBSEQUENT_STAVE_WIDTH = 300;
const CLEF_STAVE_WIDTH = 400;
const STAVE_X = 10;
const STAVE_Y = 40;
export const ROW_HEIGHT = 160;
const ROW_TOP_PADDING = 40;

type MeasureLayout = {
  row: number;
  col: number;
  staveX: number;
  staveY: number;
  staveWidth: number;
  showClef: boolean;
};

function computeLayout(measureCount: number, measuresPerLine: number): MeasureLayout[] {
  const layouts: MeasureLayout[] = [];
  for (let m = 0; m < measureCount; m++) {
    const row = Math.floor(m / measuresPerLine);
    const col = m % measuresPerLine;
    const isFirstInRow = col === 0;
    const showClef = isFirstInRow;
    const staveWidth = isFirstInRow ? CLEF_STAVE_WIDTH : SUBSEQUENT_STAVE_WIDTH;
    let staveX: number;
    if (isFirstInRow) {
      staveX = STAVE_X;
    } else {
      staveX = STAVE_X + CLEF_STAVE_WIDTH + SUBSEQUENT_STAVE_WIDTH * (col - 1);
    }
    const staveY = STAVE_Y + row * ROW_HEIGHT;
    layouts.push({ row, col, staveX, staveY, staveWidth, showClef });
  }
  return layouts;
}

export function getCanvasDimensions(measureCount: number, measuresPerLine: number): { width: number; height: number } {
  const cols = Math.min(measureCount, measuresPerLine);
  let width: number;
  if (cols <= 1) {
    width = STAVE_X + CLEF_STAVE_WIDTH + 10;
  } else {
    width = STAVE_X + CLEF_STAVE_WIDTH + SUBSEQUENT_STAVE_WIDTH * (cols - 1) + 10;
  }
  const rows = Math.ceil(measureCount / measuresPerLine);
  const height = ROW_TOP_PADDING + rows * ROW_HEIGHT;
  return { width, height };
}

function durationBeatsToVexDuration(durationBeats: number, isRest?: boolean): string {
  let base: string;
  if (durationBeats === 0.5) base = 'q';
  else if (durationBeats === 1) base = 'h';
  else if (durationBeats === 2) base = 'w';
  else if (durationBeats === 0.25) base = '8';
  else if (durationBeats === 0.125) base = '16';
  else base = 'q';
  return isRest ? base + 'r' : base;
}

function createVexNotesForMeasure(document: ScoreDocument, noteIndices: number[]): StaveNote[] {
  return noteIndices.map(i => {
    const note = document.notes[i];
    const duration = durationBeatsToVexDuration(note.durationBeats, note.isRest);
    const keys = note.isRest ? ['b/4'] : note.keys;
    return new StaveNote({ keys, duration });
  });
}

function styleNote(note: StaveNote, isPlaying: boolean): StaveNote {
  const style = isPlaying
    ? { fillStyle: 'red', strokeStyle: 'red' }
    : { fillStyle: 'black', strokeStyle: 'black' };
  note.setStyle(style);
  note.setLedgerLineStyle(style);
  return note;
}

function addChordAnnotations(allVexNotes: StaveNote[], document: ScoreDocument): void {
  const beatNoteMapping = document.computeBeatNoteMapping();
  const measures = document.computeMeasureNoteIndices();

  const globalToVex = new Map<number, number>();
  let vexIdx = 0;
  for (const measure of measures) {
    for (const noteIndex of measure) {
      globalToVex.set(noteIndex, vexIdx++);
    }
  }

  for (let m = 0; m < beatNoteMapping.length; m++) {
    const measureChords = document.getMeasureChords(m);
    if (measureChords.size === 0) continue;
    for (const { beat, noteIndex } of beatNoteMapping[m]) {
      const chordText = measureChords.get(beat);
      if (!chordText) continue;
      const vi = globalToVex.get(noteIndex);
      if (vi === undefined) continue;
      const annotation = new Annotation(chordText)
        .setFont('Arial', 12, 'normal')
        .setVerticalJustification(Annotation.VerticalJustify.TOP);
      allVexNotes[vi].addModifier(annotation);
    }
  }
}

function getNotePositions(notes: StaveNote[], staveYMap: Map<number, number>): NotePosition[] {
  return notes.map((note, idx) => {
    const staveNote = note as any;
    const x = staveNote.getAbsoluteX() + (staveNote.getWidth() / 2);
    const y = staveYMap.get(idx) ?? STAVE_Y;
    return { x, y };
  });
}

export class ScoreRenderer {
  renderToSVG(
    container: HTMLElement,
    document: ScoreDocument,
    highlightIndex?: number,
    measuresPerLine: number = 4,
  ): NotePosition[] {
    container.innerHTML = '';
    const measures = document.computeMeasureNoteIndices();
    const measureCount = measures.length;
    const layouts = computeLayout(measureCount, measuresPerLine);
    const { width: canvasWidth, height: canvasHeight } = getCanvasDimensions(measureCount, measuresPerLine);

    const renderer = new Renderer(container as HTMLDivElement, Renderer.Backends.SVG);
    renderer.resize(canvasWidth, canvasHeight);
    const context = renderer.getContext();

    const allVexNotes: StaveNote[] = [];
    const staveYMap = new Map<number, number>();
    let vexNoteIdx = 0;

    for (let m = 0; m < measureCount; m++) {
      const [numBeats, beatValue] = getTimeSignatureAtMeasure(m);
      const layout = layouts[m];

      const stave = new Stave(layout.staveX, layout.staveY, layout.staveWidth);
      if (layout.showClef) {
        stave.addClef('treble');
      }
      if (m === 0) {
        stave.addTimeSignature(`${numBeats}/${beatValue}`);
      }
      stave.setContext(context).draw();

      const noteIndices = measures[m];
      const vexNotes = createVexNotesForMeasure(document, noteIndices);

      for (let i = 0; i < vexNotes.length; i++) {
        const isPlaying = highlightIndex !== undefined && noteIndices[i] === highlightIndex;
        styleNote(vexNotes[i], isPlaying);
        staveYMap.set(vexNoteIdx + i, layout.staveY);
      }

      allVexNotes.push(...vexNotes);

      const voice = new Voice({ numBeats, beatValue });
      voice.addTickables(vexNotes);
      const formatWidth = layout.staveWidth - (layout.showClef ? 80 : 30);
      new Formatter().joinVoices([voice]).format([voice], formatWidth);
      voice.draw(context, stave);

      vexNoteIdx += noteIndices.length;
    }

    addChordAnnotations(allVexNotes, document);

    return getNotePositions(allVexNotes, staveYMap);
  }

  renderToCanvas(
    document: ScoreDocument,
    highlightIndex?: number,
    measuresPerLine: number = 4,
  ): { canvas: HTMLCanvasElement; notePositions: NotePosition[] } {
    const measures = document.computeMeasureNoteIndices();
    const measureCount = measures.length;
    const layouts = computeLayout(measureCount, measuresPerLine);
    const { width: canvasWidth, height: canvasHeight } = getCanvasDimensions(measureCount, measuresPerLine);

    const canvas = window.document.createElement('canvas');
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    const ctx2d = canvas.getContext('2d')!;
    ctx2d.fillStyle = '#ffffff';
    ctx2d.fillRect(0, 0, canvasWidth, canvasHeight);

    const vfRenderer = new Renderer(canvas, Renderer.Backends.CANVAS);
    vfRenderer.resize(canvasWidth, canvasHeight);
    const vfContext = vfRenderer.getContext();

    const allVexNotes: StaveNote[] = [];
    const staveYMap = new Map<number, number>();
    let vexNoteIdx = 0;

    for (let m = 0; m < measureCount; m++) {
      const [numBeats, beatValue] = getTimeSignatureAtMeasure(m);
      const layout = layouts[m];

      const stave = new Stave(layout.staveX, layout.staveY, layout.staveWidth);
      if (layout.showClef) {
        stave.addClef('treble');
      }
      if (m === 0) {
        stave.addTimeSignature(`${numBeats}/${beatValue}`);
      }
      stave.setContext(vfContext).draw();

      const noteIndices = measures[m];
      const vexNotes = createVexNotesForMeasure(document, noteIndices);

      for (let i = 0; i < vexNotes.length; i++) {
        const isPlaying = highlightIndex !== undefined && noteIndices[i] === highlightIndex;
        styleNote(vexNotes[i], isPlaying);
        staveYMap.set(vexNoteIdx + i, layout.staveY);
      }

      allVexNotes.push(...vexNotes);

      const voice = new Voice({ numBeats, beatValue });
      voice.addTickables(vexNotes);
      const formatWidth = layout.staveWidth - (layout.showClef ? 80 : 30);
      new Formatter().joinVoices([voice]).format([voice], formatWidth);
      voice.draw(vfContext, stave);

      vexNoteIdx += noteIndices.length;
    }

    addChordAnnotations(allVexNotes, document);

    const dpiScale = canvas.width / canvasWidth;
    const notePositions = getNotePositions(allVexNotes, staveYMap).map(p => ({
      x: p.x * dpiScale,
      y: p.y * dpiScale,
    }));

    return { canvas, notePositions };
  }
}
