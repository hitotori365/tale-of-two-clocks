# データフロー

## ファイル依存関係

```
index.astro
├── scoreConfig.ts
│   └── vexflow (StaveNote)
├── notationRenderer.ts
│   ├── scoreConfig.ts
│   └── vexflow (Renderer, Stave, Voice, Formatter)
├── playback.ts
│   ├── audioPlayer.ts
│   ├── scoreConfig.ts
│   └── notationRenderer.ts
├── audioPlayer.ts
│   └── noteFrequencies.ts
└── videoExporter.ts
    ├── offlineRenderer.ts
    ├── offlineAudioRenderer.ts
    │   └── noteFrequencies.ts
    ├── scoreConfig.ts
    └── mediabunny
```

## 共有データ型

```
scoreConfig.ts が定義する共通データ:
  - Note型        { keys: string[], duration: number }
  - TEMPO         120 (BPM)
  - BEAT_DURATION 0.5秒 (= 60 / TEMPO)
  - CANVAS_WIDTH  500
  - CANVAS_HEIGHT 200
  - STAVE_CONFIG  { x: 10, y: 40, width: 400 }

noteFrequencies.ts が定義する共通データ:
  - noteMap       音名 ("c/4" 等) → 周波数 (Hz) のマッピング
```

## パス1: 初期化・楽譜描画

```
window.load イベント
  │
  ▼
initialize()                          [index.astro]
  │
  ├─ createNoteData()                 [scoreConfig.ts]
  │    └→ Note[] (keys + duration)
  │
  ├─ createVexNotes()                 [scoreConfig.ts]
  │    └→ StaveNote[] (VexFlow用)
  │
  └─ renderNotation(container, vexNotes)  [notationRenderer.ts]
       │
       ├─ container.innerHTML = ""    (前回の描画をクリア)
       ├─ initializeVexFlow(container)
       │    ├─ new Renderer(container, SVG)
       │    ├─ renderer.resize(500, 200)
       │    ├─ new Stave(10, 40, 400)
       │    │    └─ addClef("treble") + addTimeSignature("4/4")
       │    └→ { renderer, context, stave }
       │
       ├─ styleAllNotes(vexNotes)     (全音符を黒スタイルに)
       ├─ drawNotes(vexFlow, styledNotes)
       │    ├─ new Voice({ 4/4 })
       │    ├─ voice.addTickables(notes)
       │    ├─ Formatter.format([voice], 350)
       │    └─ voice.draw(context, stave)
       │
       └─ getNoteXPositions(styledNotes)
            └→ number[] (各音符の中心X座標)
```

**出力**: DOM上にSVG楽譜が描画され、`noteXPositions`が取得される

## パス2: リアルタイム再生

```
「再生」ボタン click
  │
  ▼
audioPlayer.initialize()              [audioPlayer.ts]
  └─ new AudioContext()
audioPlayer.resume()
  └─ AudioContext.resume()  (suspended対策)
  │
  ▼
playAllNotes(notes, notationEl, audioPlayer, noteXPositions, playheadEl, onComplete)
                                      [playback.ts]
  │
  ├─ 音符開始時刻の事前計算
  │    note[0]: 0.00秒
  │    note[1]: 0.25秒  (= 0.5 × 0.5)
  │    note[2]: 0.50秒
  │    note[3]: 0.75秒
  │    totalDuration: 1.00秒
  │
  ├─ 音声スケジューリング (setTimeout)
  │    各音符に対して:
  │    setTimeout(() => {
  │      audioPlayer.playChord(keys, duration)  [audioPlayer.ts]
  │        └─ keys.forEach(key => playNote(freq, dur))
  │             ├─ OscillatorNode (sine波, 指定周波数)
  │             ├─ GainNode (0.3 → 0.01 exponential減衰)
  │             └─ → AudioContext.destination (スピーカー)
  │    }, noteStartTime * 1000);
  │
  └─ アニメーションループ (requestAnimationFrame)
       │
       loop:
       ├─ elapsed = (performance.now() - start) / 1000
       ├─ currentIndex を計算 (どの音符を再生中か)
       │
       ├─ 音符色の更新 (インデックス変更時のみ)
       │    renderNotation(notationEl, createVexNotes(), currentIndex)
       │      └─ styleAllNotes(vexNotes, playingIndex)
       │           └─ 再生中の音符: 赤 / それ以外: 黒
       │    ※ StaveNoteは使い捨て → 毎回createVexNotes()で新規作成
       │
       ├─ プレイヘッド位置の補間計算
       │    progress = (elapsed - noteStart) / noteDur
       │    x = currentX + (nextX - currentX) × progress
       │
       └─ showPlayhead(playheadEl, x)
            └─ CSS transform: translateX(x px)
```

**データの流れ**:
```
scoreConfig (Note[])
  → playback.ts (タイミング計算)
    → audioPlayer.ts (音声出力)
    → notationRenderer.ts (SVG再描画 + 色変更)
    → playheadEl (CSS transform アニメーション)
```

## パス3: 動画エクスポート

```
「MP4で保存」or「MOVで保存」ボタン click
  │
  ▼
handleExport(format)                  [index.astro]
  │
  ├─ ① 音符ハイライト済みCanvasの事前生成
  │    for (i = 0; i < notes.length; i++):
  │      renderNotationToCanvas(i)    [notationRenderer.ts]
  │        ├─ canvas = document.createElement('canvas')
  │        ├─ 白背景描画
  │        ├─ VexFlow Canvasバックエンドで楽譜描画
  │        │    ├─ new Renderer(canvas, CANVAS)
  │        │    ├─ Stave + Voice + Formatter (SVGパスと同じ)
  │        │    └─ styleAllNotes(notes, i)  (i番目を赤くハイライト)
  │        ├─ DPIスケーリング補正
  │        │    dpiScale = canvas.width / CANVAS_WIDTH
  │        │    xPositions = getAbsoluteX() × dpiScale
  │        └→ { canvas, xPositions }
  │
  │    └→ baseCanvases[4枚] + canvasNoteXPositions
  │
  └─ ② exportVideo(options)           [videoExporter.ts]
       │
       ├─ renderAudioOffline(notes, beatDuration)
       │                              [offlineAudioRenderer.ts]
       │    ├─ 各音符の開始時刻計算
       │    ├─ new OfflineAudioContext(2ch, samples, 44100)
       │    ├─ 各音符に対して:
       │    │    ├─ OscillatorNode (sine波)
       │    │    ├─ GainNode (0.3 → 0.01 exponential減衰)
       │    │    └─ → offlineCtx.destination
       │    └─ offlineCtx.startRendering()
       │         └→ AudioBuffer (PCMデータ)
       │
       ├─ new OfflineRenderer(width, height)
       │                              [offlineRenderer.ts]
       │    ├─ H.264用に偶数サイズ補正
       │    └─ renderer.initialize(baseCanvases)
       │         └─ createImageBitmap() でキャッシュ
       │
       ├─ Mediabunny Output 構築     [mediabunny]
       │    ├─ OutputFormat: Mp4OutputFormat or MovOutputFormat
       │    ├─ VideoTrack: CanvasSource (H.264/AVC)
       │    └─ AudioTrack: AudioBufferSource
       │         ├─ MP4 → AAC
       │         └─ MOV → PCM (pcm-f32)
       │
       ├─ フレームループ (30fps)
       │    for (frame = 0; frame < totalFrames; frame++):
       │      ├─ elapsed = frame / fps
       │      ├─ renderer.renderFrame(elapsed, ...)
       │      │    ├─ currentIndex計算 (playback.tsと同じロジック)
       │      │    ├─ baseImages[currentIndex]を描画
       │      │    ├─ プレイヘッドX座標を線形補間
       │      │    └─ drawPlayhead(x)  (赤グラデーション)
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
scoreConfig (Note[])
  → notationRenderer.ts (Canvas描画 × 音符数)
    → offlineRenderer.ts (ImageBitmapキャッシュ → フレーム生成)
  → offlineAudioRenderer.ts (OfflineAudioContext → AudioBuffer)
    → videoExporter.ts (mediabunny エンコード)
      → Blob → ファイルダウンロード
```

## リアルタイム再生 vs 動画エクスポートの対比

| 項目 | リアルタイム再生 | 動画エクスポート |
|------|-----------------|-----------------|
| 楽譜レンダラー | VexFlow SVGバックエンド | VexFlow Canvasバックエンド |
| 描画先 | DOM (#notation) | オフスクリーンCanvas |
| 音声エンジン | AudioContext (リアルタイム) | OfflineAudioContext (非リアルタイム) |
| 音声出力 | スピーカー | AudioBuffer → ファイル |
| タイミング制御 | setTimeout + requestAnimationFrame | フレームループ (1/fps刻み) |
| プレイヘッド | CSS transform (HTML要素) | Canvas描画 (drawPlayhead) |
| 音符ハイライト | SVG再描画 (毎フレーム判定) | 事前生成Canvas切り替え |
| 時間基準 | performance.now() | frame × frameDuration |

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
