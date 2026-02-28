# データフロー

## ファイル依存関係

```
index.astro
├── models/ScoreDocument.ts
│   └── stores/timeSignatureStore.ts
├── models/Timeline.ts
│   └── models/ScoreDocument.ts
├── models/UndoManager.ts
│   └── models/ScoreDocument.ts
├── rendering/ScoreRenderer.ts
│   ├── models/ScoreDocument.ts
│   ├── stores/timeSignatureStore.ts
│   └── vexflow (Renderer, Stave, StaveNote, Voice, Formatter, Annotation)
├── playback.ts
│   ├── models/ScoreDocument.ts
│   ├── models/Timeline.ts
│   ├── rendering/ScoreRenderer.ts
│   └── audio/audioPlayer.ts
├── audio/audioPlayer.ts
│   └── audio/synthEngine.ts
│       └── audio/noteFrequencies.ts
├── rendering/videoExporter.ts
│   ├── rendering/offlineRenderer.ts
│   │   ├── models/Timeline.ts
│   │   └── rendering/ScoreRenderer.ts (ROW_HEIGHT)
│   ├── audio/offlineAudioRenderer.ts
│   │   ├── audio/synthEngine.ts
│   │   ├── models/ScoreDocument.ts
│   │   └── models/Timeline.ts
│   ├── models/ScoreDocument.ts
│   ├── models/Timeline.ts
│   └── mediabunny
├── interaction/NoteInteraction.ts
│   ├── models/ScoreDocument.ts
│   ├── interaction/pitchMap.ts
│   ├── rendering/ScoreRenderer.ts (ROW_HEIGHT)
│   └── stores/selectionStore.ts
├── interaction/ChordInteraction.ts
│   └── models/ScoreDocument.ts
├── interaction/KeyboardHandler.ts
│   ├── models/ScoreDocument.ts
│   ├── models/UndoManager.ts
│   └── stores/selectionStore.ts
├── stores/timeSignatureStore.ts (nanostores)
└── stores/selectionStore.ts (nanostores)
```

## 共有データ型

```
ScoreDocument.ts が定義する共通データ:
  - NoteData型     { id: string, keys: string[], durationBeats: number, isRest?: boolean }
  - NotePosition型 { x: number, y: number }
  - ScoreMetadata型 { tempo: number, timeSignature: [number, number] }
  - beatDuration   getter (60 / tempo)

Timeline.ts が定義する共通データ:
  - noteStartTimes  number[] (各音符の開始時刻 秒)
  - noteDurations   number[] (各音符の長さ 秒)
  - totalDuration   number   (楽曲全体の長さ 秒)

ScoreRenderer.ts が定義する定数:
  - ROW_HEIGHT       160
  - STAVE_X          10
  - STAVE_Y          40
  - getCanvasDimensions(measureCount, measuresPerLine) → { width, height }

synthEngine.ts が定義する共通設定:
  - SYNTH_CONFIG     { waveform: 'sine', attackGain: 0.3, releaseGain: 0.01 }

noteFrequencies.ts が定義する共通データ:
  - getFrequency()   音名 ("c/4" 等) → 周波数 (Hz)

stores:
  - $timeSignatures  atom<TimeSignatureEntry[]> (小節ごとの拍子)
  - $selection       atom<SelectionState>       (選択中のノートインデックス)
```

## パス1: 初期化・楽譜描画

```
window.load イベント
  │
  ▼
initialize() → initScorePanel(wrapper)   [index.astro]
  │
  ├─ ScoreDocument.createDefault()       [ScoreDocument.ts]
  │    └→ ScoreDocument (notes: NoteData[], metadata, chords)
  │
  ├─ new UndoManager(scoreDocument)      [UndoManager.ts]
  │    └─ scoreDocument.setUndoManager(undoManager)
  │
  ├─ new ScoreRenderer()                 [ScoreRenderer.ts]
  │
  ├─ renderer.renderToSVG(container, scoreDocument, undefined, measuresPerLine)
  │    │
  │    ├─ container.innerHTML = ""       (前回の描画をクリア)
  │    ├─ 小節ごとにループ:
  │    │    ├─ new Renderer(container, SVG)
  │    │    ├─ new Stave(x, y, width)
  │    │    │    └─ addClef("treble") + addTimeSignature (先頭行のみ)
  │    │    ├─ createVexNotesForMeasure() → StaveNote[]
  │    │    │    └─ styleNote() (highlightIndex: 赤 / それ以外: 黒)
  │    │    │    └─ addChordAnnotations() (コード名をAnnotationで付与)
  │    │    ├─ new Voice → addTickables → Formatter.format → voice.draw
  │    │    └─ getNotePositions() → NotePosition[] (x, y座標)
  │    │
  │    └→ NotePosition[] (全音符の座標)
  │
  ├─ new NoteInteraction(config)         [NoteInteraction.ts]
  │    └─ ドラッグ&ドロップ、選択のイベントリスナー登録
  │
  ├─ new ChordInteraction(config)        [ChordInteraction.ts]
  │    └─ コード入力ポップオーバーのイベントリスナー登録
  │
  ├─ new KeyboardHandler(scoreDocument, undoManager)  [KeyboardHandler.ts]
  │    └─ Undo/Redo、矢印キー移動のリスナー登録
  │
  └─ イベント購読:
       ├─ scoreDocument.on('change', rerender)
       ├─ $timeSignatures.subscribe(rerender)
       └─ $selection.subscribe(rerender)
```

**出力**: DOM上にSVG楽譜が描画され、`notePositions: NotePosition[]` が取得される

## パス2: リアルタイム再生

```
「再生」ボタン click
  │
  ▼
audioPlayer.initialize()                 [audioPlayer.ts]
  └─ new AudioContext()
audioPlayer.resume()
  └─ AudioContext.resume()  (suspended対策)
  │
  ▼
new Timeline(scoreDocument)              [Timeline.ts]
  └─ noteStartTimes[], noteDurations[], totalDuration を事前計算
  │
  ▼
playAllNotes(document, timeline, notationEl, renderer, audioPlayer,
             notePositions, playheadEl, measuresPerLine, onComplete)
                                         [playback.ts]
  │
  ├─ 音声スケジューリング (setTimeout)
  │    各音符に対して:
  │    setTimeout(() => {
  │      audioPlayer.playChord(keys, duration)     [audioPlayer.ts]
  │        └─ scheduleChord(audioContext, keys, 0, duration)  [synthEngine.ts]
  │             └─ keys.forEach(key => scheduleNote(ctx, freq, start, dur))
  │                  ├─ OscillatorNode (sine波, 指定周波数)
  │                  ├─ GainNode (0.3 → 0.01 exponential減衰)
  │                  └─ → AudioContext.destination (スピーカー)
  │    }, timeline.noteStartTimes[i] * 1000);
  │
  └─ アニメーションループ (requestAnimationFrame)
       │
       loop:
       ├─ elapsed = (performance.now() - start) / 1000
       ├─ currentIndex = timeline.getIndexAtTime(elapsed)
       │
       ├─ 音符色の更新 (インデックス変更時のみ)
       │    renderer.renderToSVG(notationEl, document, currentIndex, measuresPerLine)
       │    ※ StaveNoteは使い捨て → 毎回 createVexNotesForMeasure() で新規作成
       │
       ├─ プレイヘッド位置の補間計算
       │    { x, y } = timeline.getPlayheadPosition(elapsed, notePositions)
       │
       └─ showPlayhead(playheadEl, x, y)
            └─ CSS transform: translate(x px, y px)
```

**データの流れ**:
```
ScoreDocument (NoteData[])
  → Timeline (タイミング事前計算)
    → audioPlayer.ts → synthEngine.ts (音声出力)
    → ScoreRenderer.renderToSVG() (SVG再描画 + 色変更)
    → playheadEl (CSS transform アニメーション)
```

## パス3: 編集操作

```
ドラッグ&ドロップ (音程変更)             [NoteInteraction.ts]
  │
  ├─ mousedown: ヒットテスト (notePositions から対象ノートを特定)
  ├─ mousemove: yToNearestPitch(svgY) → 最寄りの音程を計算  [pitchMap.ts]
  └─ mouseup:
       ├─ scoreDocument.setNoteKeys(index, [newKey])  [ScoreDocument.ts]
       │    └─ undoManager.saveSnapshot() → emit('change')
       └─ → rerender (SVG再描画)

コード入力                               [ChordInteraction.ts]
  │
  ├─ click-zone hover: 拍矩形ハイライト
  ├─ click: ポップオーバー表示
  └─ input確定:
       ├─ scoreDocument.setChord(measureIndex, beatIndex, chord)
       └─ → rerender

キーボードショートカット                  [KeyboardHandler.ts]
  │
  ├─ Ctrl+Z: undoManager.undo() → rerender
  ├─ Ctrl+Shift+Z: undoManager.redo() → rerender
  ├─ ←/→: selectNote(前/次のインデックス)
  └─ Escape: clearSelection()

選択操作                                  [NoteInteraction.ts → selectionStore.ts]
  │
  ├─ click: selectNote(index)
  ├─ Ctrl+click: toggleNote(index)
  ├─ Shift+click: selectRange(from, to)
  └─ → $selection 変更 → rerender (選択ノートに青枠)
```

**データの流れ**:
```
ユーザー操作 (マウス/キーボード)
  → interaction層 (イベント処理)
    → ScoreDocument (データ変更) + selectionStore (選択変更)
      → emit('change') / subscribe()
        → ScoreRenderer.renderToSVG() (SVG再描画)
```

## パス4: 動画エクスポート

```
「MP4で保存」or「MOVで保存」ボタン click
  │
  ▼
handleExport(format)                     [index.astro]
  │
  ├─ ① 音符ハイライト済みCanvasの事前生成
  │    for (i = 0; i < notes.length; i++):
  │      renderer.renderToCanvas(document, i, measuresPerLine)  [ScoreRenderer.ts]
  │        ├─ canvas = document.createElement('canvas')
  │        ├─ 白背景描画
  │        ├─ VexFlow Canvasバックエンドで楽譜描画
  │        │    ├─ new Renderer(canvas, CANVAS)
  │        │    ├─ 小節ごとに Stave + Voice + Formatter (SVGパスと同じロジック)
  │        │    └─ styleNote(i)  (i番目を赤くハイライト)
  │        ├─ DPIスケーリング補正
  │        │    dpiScale = canvas.width / logicalWidth
  │        │    notePositions = getAbsoluteX/Y() × dpiScale
  │        └→ { canvas, notePositions }
  │
  │    └→ baseCanvases[音符数] + notePositions
  │
  └─ ② exportVideo(options)              [videoExporter.ts]
       │
       ├─ renderAudioOffline(document, timeline)
       │                                 [offlineAudioRenderer.ts]
       │    ├─ Timeline から noteStartTimes, noteDurations を取得
       │    ├─ new OfflineAudioContext(2ch, samples, 44100)
       │    ├─ 各音符に対して:
       │    │    scheduleChord(offlineCtx, keys, startTime, duration)
       │    │                            [synthEngine.ts]
       │    │    ├─ OscillatorNode (sine波)
       │    │    ├─ GainNode (0.3 → 0.01 exponential減衰)
       │    │    └─ → offlineCtx.destination
       │    └─ offlineCtx.startRendering()
       │         └→ AudioBuffer (PCMデータ)
       │
       ├─ new OfflineRenderer(width, height)
       │                                 [offlineRenderer.ts]
       │    ├─ H.264用に偶数サイズ補正
       │    └─ renderer.initialize(baseCanvases)
       │         └─ createImageBitmap() でキャッシュ
       │
       ├─ Mediabunny Output 構築        [mediabunny]
       │    ├─ OutputFormat: Mp4OutputFormat or MovOutputFormat
       │    ├─ VideoTrack: CanvasSource (H.264/AVC)
       │    └─ AudioTrack: AudioBufferSource
       │         ├─ MP4 → AAC
       │         └─ MOV → PCM (pcm-f32)
       │
       ├─ フレームループ (30fps)
       │    for (frame = 0; frame < totalFrames; frame++):
       │      ├─ elapsed = frame / fps
       │      ├─ renderer.renderFrame(elapsed, notePositions, timeline)
       │      │                          [offlineRenderer.ts]
       │      │    ├─ timeline.getIndexAtTime(elapsed) → currentIndex
       │      │    ├─ baseImages[currentIndex]を描画
       │      │    ├─ timeline.getPlayheadPosition(elapsed, notePositions) → { x, y }
       │      │    └─ drawPlayhead(x, y, ROW_HEIGHT)  (赤グラデーション)
       │      ├─ videoSource.add(elapsed, frameDuration)
       │      └─ onProgress() → UI進捗バー更新
       │
       ├─ audioSource.add(audioBuffer) (音声トラック追加)
       ├─ output.finalize()
       │
       └─ Blob → <a>.click() でダウンロード
            ├─ MP4: video/mp4
            └─ MOV: video/quicktime
```

**データの流れ**:
```
ScoreDocument (NoteData[])
  → ScoreRenderer.renderToCanvas() (Canvas描画 × 音符数)
    → OfflineRenderer (ImageBitmapキャッシュ → フレーム生成)
  → Timeline → offlineAudioRenderer.ts → synthEngine.ts (AudioBuffer生成)
    → videoExporter.ts (mediabunny エンコード)
      → Blob → ファイルダウンロード
```

## リアルタイム再生 vs 動画エクスポートの対比

| 項目 | リアルタイム再生 | 動画エクスポート |
|------|-----------------|-----------------|
| 楽譜レンダラー | VexFlow SVGバックエンド | VexFlow Canvasバックエンド |
| 描画先 | DOM (container) | オフスクリーンCanvas |
| 音声エンジン | AudioContext (リアルタイム) | OfflineAudioContext (非リアルタイム) |
| 音声合成 | synthEngine.scheduleChord (共通) | synthEngine.scheduleChord (共通) |
| 音声出力 | スピーカー | AudioBuffer → ファイル |
| タイミング計算 | Timeline (共通) | Timeline (共通) |
| タイミング制御 | setTimeout + requestAnimationFrame | フレームループ (1/fps刻み) |
| プレイヘッド | CSS transform (HTML要素) | Canvas描画 (drawPlayhead) |
| プレイヘッド座標 | timeline.getPlayheadPosition (共通) | timeline.getPlayheadPosition (共通) |
| 音符ハイライト | SVG再描画 (毎フレーム判定) | 事前生成Canvas切り替え |
| 時間基準 | performance.now() | frame × frameDuration |

## Undo/Redo フロー

```
ScoreDocument 変更操作
  │
  ├─ setNoteKeys() / setChord() / addLine() / removeLine()
  │    └─ undoManager.saveSnapshot()     (変更前の状態を保存)
  │         └─ スナップショット: { notes: NoteData[], chords: Map }
  │
  ▼
Ctrl+Z (undo)                            [KeyboardHandler.ts]
  └─ undoManager.undo()                  [UndoManager.ts]
       ├─ 現在の状態を redo スタックに push
       ├─ undo スタックから pop → restore()
       │    └─ scoreDocument.notes/chords を復元
       └─ scoreDocument.emit('change') → rerender

Ctrl+Shift+Z (redo)
  └─ undoManager.redo()  (逆方向に同じ処理)
```

## 初期化タイミング

```
ブラウザ読み込み
  │
  ├─ HTML パース
  ├─ CSS (Tailwind v4) 読み込み
  │    └─ Vite devモードでは JS経由で動的注入
  ├─ window.load イベント発火
  │    └─ requestAnimationFrame
  │         └─ initialize()  ← CSS確実に適用後
  │
  └─ ※ DOMContentLoaded では Tailwind CSS未適用の可能性あり
```
