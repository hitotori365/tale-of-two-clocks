import { Renderer, Stave, StaveNote, Voice, Formatter } from 'vexflow';
import type { ScoreDocument } from '../models/ScoreDocument';

const CANVAS_WIDTH = 500;
const CANVAS_HEIGHT = 200;
const STAVE_CONFIG = { x: 10, y: 40, width: 400 };

function durationBeatsToVexDuration(durationBeats: number): string {
  if (durationBeats === 0.5) return 'q';
  if (durationBeats === 1) return 'h';
  if (durationBeats === 2) return 'w';
  if (durationBeats === 0.25) return '8';
  if (durationBeats === 0.125) return '16';
  return 'q';
}

function createVexNotes(document: ScoreDocument): StaveNote[] {
  return document.notes.map(note =>
    new StaveNote({
      keys: note.keys,
      duration: durationBeatsToVexDuration(note.durationBeats),
    }),
  );
}

function styleNote(note: StaveNote, isPlaying: boolean): StaveNote {
  const style = isPlaying
    ? { fillStyle: 'red', strokeStyle: 'red' }
    : { fillStyle: 'black', strokeStyle: 'black' };
  note.setStyle(style);
  note.setLedgerLineStyle(style);
  return note;
}

function styleAllNotes(notes: StaveNote[], playingIndex?: number): StaveNote[] {
  return notes.map((note, index) => styleNote(note, index === playingIndex));
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
    const renderer = new Renderer(container as HTMLDivElement, Renderer.Backends.SVG);
    renderer.resize(CANVAS_WIDTH, CANVAS_HEIGHT);
    const context = renderer.getContext();

    const stave = new Stave(STAVE_CONFIG.x, STAVE_CONFIG.y, STAVE_CONFIG.width);
    const [numBeats, beatValue] = document.metadata.timeSignature;
    stave.addClef('treble').addTimeSignature(`${numBeats}/${beatValue}`);
    stave.setContext(context).draw();

    const vexNotes = createVexNotes(document);
    const styledNotes = styleAllNotes(vexNotes, highlightIndex);

    const voice = new Voice({ numBeats, beatValue });
    voice.addTickables(styledNotes);
    new Formatter().joinVoices([voice]).format([voice], 350);
    voice.draw(context, stave);

    return getNoteXPositions(styledNotes);
  }

  renderToCanvas(
    document: ScoreDocument,
    highlightIndex?: number,
  ): { canvas: HTMLCanvasElement; xPositions: number[] } {
    const canvas = window.document.createElement('canvas');
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    const ctx2d = canvas.getContext('2d')!;
    ctx2d.fillStyle = '#ffffff';
    ctx2d.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const vfRenderer = new Renderer(canvas, Renderer.Backends.CANVAS);
    vfRenderer.resize(CANVAS_WIDTH, CANVAS_HEIGHT);
    const vfContext = vfRenderer.getContext();

    const stave = new Stave(STAVE_CONFIG.x, STAVE_CONFIG.y, STAVE_CONFIG.width);
    const [numBeats, beatValue] = document.metadata.timeSignature;
    stave.addClef('treble').addTimeSignature(`${numBeats}/${beatValue}`);
    stave.setContext(vfContext).draw();

    const vexNotes = createVexNotes(document);
    const styledNotes = styleAllNotes(vexNotes, highlightIndex);

    const voice = new Voice({ numBeats, beatValue });
    voice.addTickables(styledNotes);
    new Formatter().joinVoices([voice]).format([voice], 350);
    voice.draw(vfContext, stave);

    const dpiScale = canvas.width / CANVAS_WIDTH;
    const xPositions = getNoteXPositions(styledNotes).map(x => x * dpiScale);

    return { canvas, xPositions };
  }
}
