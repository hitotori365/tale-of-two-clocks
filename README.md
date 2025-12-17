# Web Audio APIとVexFlowで実現する楽譜と音の完璧な同期：先読みスケジューリングの実装

## はじめに

Web上で楽譜を表示しながら音を再生する際、最も難しい課題の一つが「視覚的な楽譜と聴覚的な音の正確な同期」です。本記事では、VexFlow（楽譜描画ライブラリ）とWeb Audio APIを使用して、JavaScriptの先読みスケジューリング技術により、この同期を実現する方法を解説します。

## 技術スタック

- **VexFlow**: SVGベースの楽譜描画ライブラリ
- **Web Audio API**: ブラウザ上での音声合成・再生
- **TypeScript**: 型安全性を確保
- **Astro**: モダンなWebフレームワーク

## 課題：なぜ同期が難しいのか？

JavaScriptのタイミング処理には以下の問題があります：

1. **`setTimeout`の精度問題**: ミリ秒単位の精度はあるが、ブラウザの負荷により遅延が発生
2. **描画と音声再生のタイミングずれ**: DOM操作とAudio APIの処理時間の違い
3. **ユーザー操作による遅延**: クリックイベントから実際の処理開始までのラグ

## 解決策：先読みスケジューリング

### 1. 音符データの構造化

```typescript
type Note = { keys: string[], duration: number };

const createNoteData = (): Note[] => [
  { keys: ["c/4"], duration: 0.5 },  // 8分音符
  { keys: ["d/4"], duration: 0.5 },
  { keys: ["e/4"], duration: 0.5 },
  { keys: ["f/4"], duration: 0.5 }
];
```

各音符に再生時間（duration）を持たせ、楽譜上の視覚的表現と音の長さを対応させます。

### 2. 累積的な遅延計算

最も重要な部分は、各音符の開始時刻を累積的に計算することです：

```typescript
const scheduleNotePlay = (
  note: Note,
  index: number,
  delay: number,
  audioPlayer: AudioPlayer,
  onNoteStart: (index: number) => void
): number => {
  // 現在の累積遅延時間で音符をスケジュール
  scheduleAction(() => {
    onNoteStart(index);  // 視覚的なハイライト
    audioPlayer.playChord(note.keys, note.duration * BEAT_DURATION);  // 音の再生
  }, delay * 1000);
  
  // 次の音符のための累積遅延を返す
  return delay + (note.duration * BEAT_DURATION);
};
```

### 3. reduceによる連鎖的スケジューリング

```typescript
const playAllNotes = (
  notes: Note[],
  audioPlayer: AudioPlayer,
  onNoteStart: (index: number) => void,
  onComplete: () => void
): void => {
  // reduceで各音符の開始時刻を累積計算
  const totalDelay = notes.reduce(
    (delay, note, index) => 
      scheduleNotePlay(note, index, delay, audioPlayer, onNoteStart),
    0  // 初期遅延は0
  );
  
  // 全体の再生完了をスケジュール
  scheduleAction(onComplete, totalDelay * 1000);
};
```

この実装の巧妙な点は、`reduce`を使って各音符の開始時刻を連鎖的に計算していることです。前の音符の終了時刻が次の音符の開始時刻となります。

### 4. 視覚的フィードバックの同期

音符がハイライトされるタイミングも、同じスケジューリングシステムで管理します：

```typescript
playAllNotes(
  notes,
  audioPlayer,
  (index) => renderNotation(notationEl, vexNotes, index),  // ハイライト更新
  () => {
    renderNotation(notationEl, vexNotes);  // ハイライト解除
    updateButton(playButton, "再生", false);
  }
);
```

## 実装のポイント

### 1. タイミングの事前計算

すべての音符の再生タイミングを事前に計算し、一度にスケジュールすることで、処理中の遅延を最小化します。

### 2. 関数型アプローチ

純粋関数を使用することで、タイミング計算のロジックをテスト可能かつ予測可能にします：

```typescript
// 純粋関数：副作用なし、同じ入力に対して常に同じ出力
const styleNote = (note: StaveNote, isPlaying: boolean): StaveNote => {
  const style = isPlaying 
    ? { fillStyle: "red", strokeStyle: "red" }
    : { fillStyle: "black", strokeStyle: "black" };
  note.setStyle(style);
  return note;
};
```

### 3. Web Audio APIの活用

Web Audio APIは、JavaScriptの通常のタイマーよりも高精度なタイミング制御を提供します。これが楽譜と音の同期において重要な役割を果たします。

#### AudioContextの高精度タイミング

```typescript
class AudioPlayer {
  private audioContext: AudioContext | null = null;
  
  async initialize() {
    if (!this.isInitialized && typeof window !== 'undefined') {
      // AudioContextは高精度タイマーを内蔵
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.isInitialized = true;
    }
  }
  
  playChord(keys: string[], duration: number) {
    if (!this.audioContext) return;
    
    keys.forEach(key => {
      // 各音符に対してオシレーターを作成
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      // 音の接続：オシレーター → ゲイン → 出力
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      // 周波数を設定（例：c/4 = 261.63Hz）
      oscillator.frequency.value = this.getFrequency(key);
      oscillator.type = 'sine';  // 正弦波でクリアな音色
      
      // 音量のエンベロープ設定
      const now = this.audioContext.currentTime;
      gainNode.gain.setValueAtTime(0.3, now);  // 初期音量
      // 指数関数的に減衰（より自然な音の減衰）
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration);
      
      // 高精度タイミングでの再生スケジュール
      oscillator.start(now);  // 即座に開始
      oscillator.stop(now + duration);  // 正確な時刻で停止
    });
  }
}
```

#### なぜAudioContextのタイミングが重要なのか

1. **マイクロ秒精度**: `audioContext.currentTime`は、AudioContextが作成されてからの経過時間を高精度（通常はマイクロ秒単位）で提供します。

2. **ハードウェア同期**: AudioContextの時間は、実際のオーディオハードウェアのクロックと同期しているため、音の再生タイミングが極めて正確です。

3. **スレッドセーフ**: Web Audio APIは別スレッドで動作するため、メインスレッドのブロッキングの影響を受けません。

#### setTimeoutとの違い

```typescript
// ❌ 従来の方法：精度が低い
setTimeout(() => {
  playSound();  // 実際の実行時刻は保証されない
}, 1000);

// ✅ Web Audio APIの方法：高精度
const when = audioContext.currentTime + 1.0;
oscillator.start(when);  // 正確に1秒後に再生
```

#### 音のエンベロープによる自然な表現

```typescript
// 音量の時間変化を定義
gainNode.gain.setValueAtTime(0.3, now);  // アタック
gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration);  // ディケイ
```

これにより、急激なカットオフによる「プチッ」というノイズを防ぎ、より楽器らしい自然な音の減衰を実現しています。

#### 複数音の同時再生（和音）

```typescript
playChord(keys: string[], duration: number) {
  // forEachで各音を独立したオシレーターで再生
  // すべての音が同じcurrentTimeを基準にするため、完璧に同期
  keys.forEach(key => {
    // 各音符は独立したオシレーターとゲインノードを持つ
    // これにより、和音の各構成音が干渉せずに再生される
  });
}
```

## パフォーマンス最適化

1. **DOM操作の最小化**: 楽譜の再描画は必要な時のみ実行
2. **メモリ管理**: 音源（Oscillator）は使用後自動的に破棄
3. **非同期処理**: Audio APIの初期化は非同期で実行

## まとめ

先読みスケジューリングを使用することで、以下を実現できました：

1. **正確な同期**: 視覚と聴覚の完璧なタイミング
2. **スケーラビリティ**: 音符数が増えても同じロジックで対応可能
3. **保守性**: 関数型アプローチによる明確な責任分離

この技術は、音楽教育アプリケーション、楽譜プレーヤー、作曲ツールなど、様々な用途に応用できます。

## 今後の拡張可能性

- **可変テンポ**: ritardandoやaccelerandoの実装
- **複数パート**: 和音や複数の楽器の同時再生
- **インタラクティブ機能**: 特定の音符をクリックして再生
- **録音機能**: ユーザーの演奏と楽譜の同期

Web技術の進化により、ブラウザ上でもデスクトップアプリケーションに匹敵する音楽体験が実現可能になってきています。先読みスケジューリングは、その実現のための重要な技術の一つです。


```sh
npm create astro@latest -- --template basics
```

> 🧑‍🚀 **Seasoned astronaut?** Delete this file. Have fun!

## 🚀 Project Structure

Inside of your Astro project, you'll see the following folders and files:

```text
/
├── public/
│   └── favicon.svg
├── src
│   ├── assets
│   │   └── astro.svg
│   ├── components
│   │   └── Welcome.astro
│   ├── layouts
│   │   └── Layout.astro
│   └── pages
│       └── index.astro
└── package.json
```

To learn more about the folder structure of an Astro project, refer to [our guide on project structure](https://docs.astro.build/en/basics/project-structure/).

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `npm install`             | Installs dependencies                            |
| `npm run dev`             | Starts local dev server at `localhost:4321`      |
| `npm run build`           | Build your production site to `./dist/`          |
| `npm run preview`         | Preview your build locally, before deploying     |
| `npm run astro ...`       | Run CLI commands like `astro add`, `astro check` |
| `npm run astro -- --help` | Get help using the Astro CLI                     |

## 👀 Want to learn more?

Feel free to check [our documentation](https://docs.astro.build) or jump into our [Discord server](https://astro.build/chat).
