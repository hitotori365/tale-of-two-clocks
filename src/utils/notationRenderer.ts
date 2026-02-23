import { Renderer, Stave, StaveNote, Voice, Formatter } from "vexflow";
import { CANVAS_WIDTH, CANVAS_HEIGHT, STAVE_CONFIG, createVexNotes } from "./scoreConfig";

export type VexFlowContext = {
  renderer: Renderer;
  context: any;
  stave: Stave;
};

export const styleNote = (note: StaveNote, isPlaying: boolean): StaveNote => {
  const style = isPlaying
    ? { fillStyle: "red", strokeStyle: "red" }
    : { fillStyle: "black", strokeStyle: "black" };
  note.setStyle(style);
  note.setLedgerLineStyle(style);
  return note;
};

export const styleAllNotes = (
  notes: StaveNote[],
  playingIndex?: number,
): StaveNote[] =>
  notes.map((note, index) => styleNote(note, index === playingIndex));

export const initializeVexFlow = (container: HTMLElement): VexFlowContext => {
  const renderer = new Renderer(container as HTMLDivElement, Renderer.Backends.SVG);
  renderer.resize(CANVAS_WIDTH, CANVAS_HEIGHT);
  const context = renderer.getContext();

  const stave = new Stave(
    STAVE_CONFIG.x,
    STAVE_CONFIG.y,
    STAVE_CONFIG.width,
  );
  stave.addClef("treble").addTimeSignature("4/4");
  stave.setContext(context).draw();

  return { renderer, context, stave };
};

export const drawNotes = (vexFlow: VexFlowContext, notes: StaveNote[]): void => {
  const voice = new Voice({ numBeats: 4, beatValue: 4 });
  voice.addTickables(notes);

  new Formatter().joinVoices([voice]).format([voice], 350);
  voice.draw(vexFlow.context, vexFlow.stave);
};

export const getNoteXPositions = (notes: StaveNote[]): number[] => {
  return notes.map(note => {
    const staveNote = note as any;
    return staveNote.getAbsoluteX() + (staveNote.getWidth() / 2);
  });
};

export const renderNotation = (
  container: HTMLElement,
  vexNotes: StaveNote[],
  playingIndex?: number,
): number[] => {
  container.innerHTML = "";
  const vexFlow = initializeVexFlow(container);
  const styledNotes = styleAllNotes(vexNotes, playingIndex);
  drawNotes(vexFlow, styledNotes);
  return getNoteXPositions(styledNotes);
};

export const renderNotationToCanvas = (playingIndex?: number): { canvas: HTMLCanvasElement; xPositions: number[] } => {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;

  // 白背景を先に描画
  const ctx2d = canvas.getContext('2d')!;
  ctx2d.fillStyle = '#ffffff';
  ctx2d.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // VexFlowのCanvasバックエンドで描画
  const vfRenderer = new Renderer(canvas, Renderer.Backends.CANVAS);
  vfRenderer.resize(CANVAS_WIDTH, CANVAS_HEIGHT);
  const vfContext = vfRenderer.getContext();

  const stave = new Stave(STAVE_CONFIG.x, STAVE_CONFIG.y, STAVE_CONFIG.width);
  stave.addClef("treble").addTimeSignature("4/4");
  stave.setContext(vfContext).draw();

  // エクスポート用に新しいStaveNoteを作成（StaveNoteは一度Voiceに入れると再利用不可）
  const exportNotes = createVexNotes();
  const styledNotes = styleAllNotes(exportNotes, playingIndex);
  const voice = new Voice({ numBeats: 4, beatValue: 4 });
  voice.addTickables(styledNotes);
  new Formatter().joinVoices([voice]).format([voice], 350);
  voice.draw(vfContext, stave);

  // Canvas描画から直接X座標を取得
  // VexFlowのCanvas rendererはdevicePixelRatioでcanvasサイズを拡大するが、
  // getAbsoluteX()は論理座標を返すため、実際のピクセル座標に変換が必要
  const dpiScale = canvas.width / CANVAS_WIDTH;
  const xPositions = getNoteXPositions(styledNotes).map(x => x * dpiScale);

  return { canvas, xPositions };
};
