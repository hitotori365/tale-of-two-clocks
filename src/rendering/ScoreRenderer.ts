import { Renderer, Stave, StaveNote, Voice, Formatter, Annotation } from 'vexflow';
import type { ScoreDocument } from '../models/ScoreDocument';
import { getTimeSignatureAtMeasure } from '../stores/timeSignatureStore';

const FIRST_STAVE_WIDTH = 400;
const SUBSEQUENT_STAVE_WIDTH = 300;
const STAVE_X = 10;
const STAVE_Y = 40;
const CANVAS_HEIGHT = 200;

function getCanvasWidth(measureCount: number): number {
  if (measureCount <= 1) return STAVE_X + FIRST_STAVE_WIDTH + 10;
  return STAVE_X + FIRST_STAVE_WIDTH + SUBSEQUENT_STAVE_WIDTH * (measureCount - 1) + 10;
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

  // Build a map from global note index to vexNote index (which is sequential)
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

function getNoteXPositions(notes: StaveNote[]): number[] {
  return notes.map(note => {
    const staveNote = note as any;
    return staveNote.getAbsoluteX() + (staveNote.getWidth() / 2);
  });
}

export class ScoreRenderer {
  renderToSVG(
    container: HTMLElement,
    document: ScoreDocument,
    highlightIndex?: number,
  ): number[] {
    container.innerHTML = '';
    const measures = document.computeMeasureNoteIndices();
    const measureCount = measures.length;
    const canvasWidth = getCanvasWidth(measureCount);

    const renderer = new Renderer(container as HTMLDivElement, Renderer.Backends.SVG);
    renderer.resize(canvasWidth, CANVAS_HEIGHT);
    const context = renderer.getContext();

    const allVexNotes: StaveNote[] = [];
    let globalIdx = 0;

    for (let m = 0; m < measureCount; m++) {
      const [numBeats, beatValue] = getTimeSignatureAtMeasure(m);
      const staveWidth = m === 0 ? FIRST_STAVE_WIDTH : SUBSEQUENT_STAVE_WIDTH;
      const staveX = m === 0 ? STAVE_X : STAVE_X + FIRST_STAVE_WIDTH + SUBSEQUENT_STAVE_WIDTH * (m - 1);

      const stave = new Stave(staveX, STAVE_Y, staveWidth);
      if (m === 0) {
        stave.addClef('treble').addTimeSignature(`${numBeats}/${beatValue}`);
      }
      stave.setContext(context).draw();

      const noteIndices = measures[m];
      const vexNotes = createVexNotesForMeasure(document, noteIndices);

      // Style notes
      for (let i = 0; i < vexNotes.length; i++) {
        const isPlaying = highlightIndex !== undefined && noteIndices[i] === highlightIndex;
        styleNote(vexNotes[i], isPlaying);
      }

      allVexNotes.push(...vexNotes);

      const voice = new Voice({ numBeats, beatValue });
      voice.addTickables(vexNotes);
      const formatWidth = staveWidth - (m === 0 ? 80 : 30);
      new Formatter().joinVoices([voice]).format([voice], formatWidth);
      voice.draw(context, stave);

      globalIdx += noteIndices.length;
    }

    addChordAnnotations(allVexNotes, document);

    return getNoteXPositions(allVexNotes);
  }

  renderToCanvas(
    document: ScoreDocument,
    highlightIndex?: number,
  ): { canvas: HTMLCanvasElement; xPositions: number[] } {
    const measures = document.computeMeasureNoteIndices();
    const measureCount = measures.length;
    const canvasWidth = getCanvasWidth(measureCount);

    const canvas = window.document.createElement('canvas');
    canvas.width = canvasWidth;
    canvas.height = CANVAS_HEIGHT;

    const ctx2d = canvas.getContext('2d')!;
    ctx2d.fillStyle = '#ffffff';
    ctx2d.fillRect(0, 0, canvasWidth, CANVAS_HEIGHT);

    const vfRenderer = new Renderer(canvas, Renderer.Backends.CANVAS);
    vfRenderer.resize(canvasWidth, CANVAS_HEIGHT);
    const vfContext = vfRenderer.getContext();

    const allVexNotes: StaveNote[] = [];

    for (let m = 0; m < measureCount; m++) {
      const [numBeats, beatValue] = getTimeSignatureAtMeasure(m);
      const staveWidth = m === 0 ? FIRST_STAVE_WIDTH : SUBSEQUENT_STAVE_WIDTH;
      const staveX = m === 0 ? STAVE_X : STAVE_X + FIRST_STAVE_WIDTH + SUBSEQUENT_STAVE_WIDTH * (m - 1);

      const stave = new Stave(staveX, STAVE_Y, staveWidth);
      if (m === 0) {
        stave.addClef('treble').addTimeSignature(`${numBeats}/${beatValue}`);
      }
      stave.setContext(vfContext).draw();

      const noteIndices = measures[m];
      const vexNotes = createVexNotesForMeasure(document, noteIndices);

      for (let i = 0; i < vexNotes.length; i++) {
        const isPlaying = highlightIndex !== undefined && noteIndices[i] === highlightIndex;
        styleNote(vexNotes[i], isPlaying);
      }

      allVexNotes.push(...vexNotes);

      const voice = new Voice({ numBeats, beatValue });
      voice.addTickables(vexNotes);
      const formatWidth = staveWidth - (m === 0 ? 80 : 30);
      new Formatter().joinVoices([voice]).format([voice], formatWidth);
      voice.draw(vfContext, stave);
    }

    addChordAnnotations(allVexNotes, document);

    const dpiScale = canvas.width / canvasWidth;
    const xPositions = getNoteXPositions(allVexNotes).map(x => x * dpiScale);

    return { canvas, xPositions };
  }
}
