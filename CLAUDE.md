# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

楽譜（VexFlow SVG）と音声（Web Audio API）を同期再生し、MP4/MOV動画としてエクスポートできるAstroアプリケーション。日本語プロジェクト。

## Commands

```bash
npm run dev       # 開発サーバー起動 (http://localhost:4321)
npm run build     # 本番ビルド (./dist/)
npm run preview   # ビルド結果のプレビュー
```

テストはなし。

## Architecture

3層アーキテクチャ: **ドキュメントモデル → ブリッジ層 → レンダリング**

**リアルタイム再生パス**: `index.astro` → ScoreDocument + Timeline → ScoreRenderer (SVG) + AudioPlayer (Web Audio API) + playback (requestAnimationFrame)

**動画エクスポートパス**: `index.astro` → ScoreDocument + Timeline → ScoreRenderer (Canvas) → OfflineRenderer (フレーム生成) + OfflineAudioRenderer (OfflineAudioContext) → videoExporter (mediabunny エンコード) → Blob ダウンロード

### モデル層 (`src/models/`)
- `ScoreDocument.ts` — 楽曲データモデル。音符データ・メタデータを保持。将来のファイル読込・GUI編集の対象
- `Timeline.ts` — タイミング計算の統合。noteStartTimes・プレイヘッド補間を一元管理

### 音声層 (`src/audio/`)
- `synthEngine.ts` — 音声合成共通ロジック（sine波 + exponentialRamp）。scheduleNote/scheduleChord
- `audioPlayer.ts` — リアルタイム再生。AudioContextラッパー、synthEngine利用
- `offlineAudioRenderer.ts` — オフライン音声レンダリング。OfflineAudioContext + synthEngine利用
- `noteFrequencies.ts` — 音名→周波数マップ

### 描画層 (`src/rendering/`)
- `ScoreRenderer.ts` — VexFlowブリッジ。renderToSVG（リアルタイム表示）/ renderToCanvas（エクスポート）
- `offlineRenderer.ts` — Canvas上でフレームごとの楽譜+プレイヘッドを描画。Timeline利用
- `videoExporter.ts` — mediabunnyでMP4/MOVエンコード・ダウンロード

### オーケストレーション
- `src/playback.ts` — 再生制御。Timeline + ScoreRenderer + AudioPlayerを連携
- `src/pages/index.astro` — UIオーケストレーション。ScoreDocument・Timeline生成、各モジュールへの受け渡し

## Key Gotchas

- **VexFlow StaveNoteは使い捨て**: Voiceに追加すると再利用不可。ScoreRenderer内部で描画のたびに新規作成する
- **Tailwind v4 preflight vs VexFlow SVG**: Tailwindの`svg { display: block }`等がVexFlowのSVGを壊す。`global.css`でオーバーライド済み
- **初期化タイミング**: Vite devモードではTailwind CSSがJS経由で動的注入されるため、`load`イベント + `requestAnimationFrame`で初期化する（`DOMContentLoaded`では早すぎる）
- **H.264は偶数サイズ必須**: Canvasの幅・高さを偶数に揃える処理が`videoExporter.ts`にある
- **DPIスケーリング**: VexFlow Canvas rendererはdevicePixelRatioでcanvasを拡大する。X座標は`dpiScale = canvas.width / CANVAS_WIDTH`で補正
- **MOV vs MP4**: MOVはPCM音声(`pcm-f32`)、MP4はAAC。MOVでは`fastStart`オプション不可
- **AudioContextのsuspend**: ブラウザはユーザー操作なしでAudioContextを停止する。`audioPlayer.resume()`で対処
