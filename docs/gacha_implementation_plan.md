# チーム抽選ガチャガチャ - 要件定義書・実装計画書

作成日: 2025年11月3日

---

## 📋 要件定義書

### 1. 機能要件

#### 1.1 チーム管理機能
- ✅ チームの追加（チーム名入力）
- ✅ チームの削除
- ✅ チーム名の編集
- ✅ 当選/未当選ステータスの手動切り替え
- ✅ 全チーム一括リセット（全て未当選に戻す）
- ✅ LocalStorageでデータ永続化

#### 1.2 抽選機能
- ✅ 未当選チームのみを抽選対象とする
- ✅ ランダムに1チームを選出
- ✅ 当選したチームは自動的に「当選済み」にマーク

#### 1.3 表示機能
- ✅ チーム一覧をカード形式で表示
- ✅ 当選済みチームはグレーアウト表示
- ✅ 未当選チーム数の表示

#### 1.4 ガチャガチャ演出

**フェーズ1: カプセル投入（2秒）**
- 各チームのカプセルが上から落下
- 重力で自然に積み重なる
- 効果音: カラカラ

**フェーズ2: シャッフル（3秒）**
- 容器が激しく揺れる
- カプセルが跳ね回る
- 効果音: ガシャガシャ

**フェーズ3: 取り出し（2秒）**
- 底に穴が開く
- 1個だけカプセルが落ちる
- スローモーション演出

**フェーズ4: 転がり出し（1.5秒）**
- カプセルがスロープを転がる
- トレイに到着

**フェーズ5: 開封演出（2秒）**
- カプセルが左右に開く
- 中からチーム名が飛び出す
- 紙吹雪エフェクト
- 効果音: ファンファーレ

### 2. 非機能要件

#### 2.1 表示要件
- **プロジェクター投影対応**
  - 大きなフォント（最小24px以上）
  - 高コントラスト配色
  - 遠くから見やすいUI

#### 2.2 パフォーマンス
- 60FPS以上の滑らかなアニメーション
- 演出の総時間: 約10-11秒

#### 2.3 ブラウザ対応
- Chrome/Edge（最新版）
- Firefox（最新版）
- Safari（最新版）

#### 2.4 データ永続化
- LocalStorageを使用
- キー: `gacha_teams`
- 形式: JSON

---

## 🏗️ 実装計画

### Phase 1: 基本構造（30分）

#### ファイル構成
```
/home/claude/
├── index.html          # メインHTML
├── style.css           # スタイルシート
├── app.js              # メインアプリケーションロジック
├── gacha.js            # Matter.js ガチャ演出
└── storage.js          # LocalStorage管理
```

#### データ構造
```javascript
// チームデータ
{
  id: 'uuid',
  name: 'チーム名',
  isWinner: false,  // 当選済みフラグ
  color: '#FF6B6B'  // カプセルの色
}

// LocalStorage保存形式
{
  teams: [
    { id: '1', name: '営業', isWinner: false, color: '#FF6B6B' },
    { id: '2', name: '開発', isWinner: true, color: '#4ECDC4' },
    ...
  ]
}
```

---

### Phase 2: UI実装（1時間）

#### 画面遷移
```
[メイン画面]
    ↓ 抽選開始ボタン
[ガチャ演出画面] (10秒)
    ↓ 自動遷移
[結果画面]
    ↓ 戻るボタン
[メイン画面]
```

#### コンポーネント

**1. メイン画面**
```
- タイトル
- 抽選ボタン（大）
- チーム一覧グリッド
  └─ チームカード × N
      ├─ チーム名
      ├─ ステータスバッジ
      ├─ 編集ボタン
      └─ 削除ボタン
- チーム追加ボタン
- リセットボタン
```

**2. ガチャ画面**
```
- タイトル
- Canvasエリア（Matter.js描画）
- フェーズテキスト表示
```

**3. 結果画面**
```
- 当選タイトル
- カプセル開封アニメーション
- 当選チーム名
- 紙吹雪エフェクト
- 戻るボタン
```

---

### Phase 3: Matter.js 物理演算（2時間）

#### Matter.jsセットアップ
```javascript
// エンジン作成
const engine = Engine.create();
const world = engine.world;

// レンダラー作成
const render = Render.create({
  canvas: document.getElementById('gacha-canvas'),
  engine: engine,
  options: {
    width: 800,
    height: 600,
    wireframes: false,
    background: '#1a1a2e'
  }
});
```

#### 物理オブジェクト

**1. カプセル（Bodies.circle）**
```javascript
{
  radius: 35,
  restitution: 0.8,    // 反発係数
  friction: 0.05,      // 摩擦
  frictionAir: 0.01,   // 空気抵抗
  density: 0.04        // 密度
}
```

**2. 容器（Bodies.rectangle）**
```javascript
// 床
{ x: 400, y: 550, width: 700, height: 40 }

// 左壁
{ x: 50, y: 300, width: 40, height: 500 }

// 右壁
{ x: 750, y: 300, width: 40, height: 500 }

// 天井（初期は閉じている）
{ x: 400, y: 50, width: 700, height: 40 }
```

**3. 取り出し口（センサー）**
```javascript
{
  x: 400,
  y: 540,
  width: 80,
  height: 20,
  isSensor: true  // 衝突判定のみ、物理的影響なし
}
```

**4. スロープ**
```javascript
{
  x: 500,
  y: 600,
  width: 300,
  height: 20,
  angle: Math.PI / 12  // 15度傾斜
}
```

#### アニメーションフェーズ

**フェーズ1: 投入**
```javascript
function dropCapsules(teams) {
  teams.forEach((team, i) => {
    setTimeout(() => {
      const capsule = createCapsule(team);
      World.add(world, capsule);
    }, i * 200);  // 時間差で投入
  });
}
```

**フェーズ2: シャッフル**
```javascript
function shuffleCapsules() {
  const interval = setInterval(() => {
    // 容器を揺らす
    shakeContainer();
    
    // カプセルにランダムな力
    capsules.forEach(capsule => {
      Body.applyForce(capsule, capsule.position, {
        x: (Math.random() - 0.5) * 0.08,
        y: (Math.random() - 0.5) * 0.08
      });
    });
  }, 50);
  
  setTimeout(() => clearInterval(interval), 3000);
}
```

**フェーズ3: 取り出し**
```javascript
function openExit() {
  // 床に穴を開ける（センサーを有効化）
  exitSensor.isSensor = true;
  
  // 衝突検知
  Events.on(engine, 'collisionStart', (event) => {
    const winner = detectWinner(event.pairs);
    if (winner) {
      selectWinner(winner);
    }
  });
}
```

**フェーズ4: スローモーション**
```javascript
function slowMotion(capsule) {
  // 時間を遅くする
  engine.timing.timeScale = 0.3;
  
  // カプセルにスポットライト
  capsule.render.strokeStyle = '#FFD700';
  capsule.render.lineWidth = 5;
}
```

---

### Phase 4: CSS アニメーション（1時間）

#### カプセル開封
```css
@keyframes capsule-open {
  0% {
    transform: translateX(0) rotateY(0deg);
  }
  100% {
    transform: translateX(-100px) rotateY(-90deg);
  }
}

.capsule-left {
  animation: capsule-open 0.8s ease-out forwards;
}

.capsule-right {
  animation: capsule-open 0.8s ease-out forwards;
  animation-direction: reverse;
}
```

#### チーム名登場
```css
@keyframes winner-appear {
  0% {
    transform: scale(0) translateY(50px);
    opacity: 0;
  }
  50% {
    transform: scale(1.3) translateY(-10px);
  }
  100% {
    transform: scale(1) translateY(0);
    opacity: 1;
  }
}
```

#### 紙吹雪
```css
@keyframes confetti-fall {
  0% {
    transform: translateY(-100vh) rotate(0deg);
    opacity: 1;
  }
  100% {
    transform: translateY(100vh) rotate(720deg);
    opacity: 0;
  }
}
```

---

### Phase 5: 効果音（30分）

#### Web Audio API による生成音
```javascript
const audioContext = new AudioContext();

// カプセル落下音（短いビープ）
function playDropSound() {
  const oscillator = audioContext.createOscillator();
  oscillator.frequency.value = 800;
  oscillator.connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + 0.1);
}

// 衝突音
function playBounceSound() {
  const oscillator = audioContext.createOscillator();
  oscillator.frequency.value = 400;
  oscillator.connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + 0.05);
}

// ファンファーレ（シンプル版）
function playFanfare() {
  [523, 659, 784, 1047].forEach((freq, i) => {
    setTimeout(() => {
      const osc = audioContext.createOscillator();
      osc.frequency.value = freq;
      osc.connect(audioContext.destination);
      osc.start();
      osc.stop(audioContext.currentTime + 0.3);
    }, i * 200);
  });
}
```

---

### Phase 6: LocalStorage管理（30分）

```javascript
// storage.js
const STORAGE_KEY = 'gacha_teams';

// 保存
function saveTeams(teams) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(teams));
}

// 読み込み
function loadTeams() {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : getDefaultTeams();
}

// デフォルトチーム
function getDefaultTeams() {
  return [
    { id: '1', name: '営業チーム', isWinner: false, color: '#FF6B6B' },
    { id: '2', name: '開発チーム', isWinner: false, color: '#4ECDC4' },
    { id: '3', name: '企画チーム', isWinner: false, color: '#95E1D3' },
    { id: '4', name: '人事チーム', isWinner: false, color: '#FFE66D' },
    { id: '5', name: '総務チーム', isWinner: false, color: '#C77DFF' }
  ];
}
```

---

## 🎨 デザイン仕様

### カラーパレット
```css
:root {
  --primary: #FF6B6B;
  --secondary: #4ECDC4;
  --background: #0f0f23;
  --surface: #1a1a2e;
  --text: #ffffff;
  --text-secondary: #a0a0b0;
  --winner: #FFD700;
  --loser: #505060;
  
  /* カプセルカラー */
  --capsule-1: #FF6B6B;
  --capsule-2: #4ECDC4;
  --capsule-3: #95E1D3;
  --capsule-4: #FFE66D;
  --capsule-5: #C77DFF;
}
```

### タイポグラフィ
```css
/* プロジェクター用大きめサイズ */
h1 { font-size: 72px; }
h2 { font-size: 48px; }
.button { font-size: 36px; }
.team-name { font-size: 28px; }
```

---

## ⏱️ タイムライン

```
0:00 - 抽選開始ボタン押下
0:00 - フェーズ1開始: カプセル投入
0:02 - フェーズ2開始: シャッフル
0:05 - フェーズ3開始: 取り出し口オープン
0:07 - フェーズ4開始: 当選カプセル転がる
0:08 - フェーズ5開始: カプセル開封
0:10 - 結果画面へ遷移
```

---

## 🧪 テストケース

### 1. チーム管理
- [ ] チーム追加が正常に動作する
- [ ] チーム削除が正常に動作する
- [ ] チーム名編集が正常に動作する
- [ ] ステータス切り替えが正常に動作する
- [ ] リセットで全チームが未当選になる

### 2. 抽選機能
- [ ] 未当選チームが0の場合エラー表示
- [ ] 未当選チームのみが抽選対象
- [ ] 当選したチームが自動でマークされる
- [ ] 抽選結果がLocalStorageに保存される

### 3. 物理演算
- [ ] カプセルが自然に落下する
- [ ] 壁との衝突が正しく動作する
- [ ] スローモーションが動作する
- [ ] 取り出し口からカプセルが出る

### 4. 演出
- [ ] カプセル開封アニメーションが動作
- [ ] 紙吹雪が表示される
- [ ] 効果音が再生される（オプション）

---

## 📚 使用技術

### コアライブラリ
- **Matter.js** (v0.19.0)
  - 2D物理演算エンジン
  - CDN: `https://cdnjs.cloudflare.com/ajax/libs/matter-js/0.19.0/matter.min.js`

### ブラウザAPI
- LocalStorage (データ永続化)
- Web Audio API (効果音)
- Canvas API (Matter.js描画)

### 言語・マークアップ
- HTML5
- CSS3 (Animations, Transforms, Grid/Flexbox)
- Vanilla JavaScript (ES6+)

---

## 🚀 開発手順

1. **環境準備**
   - ファイル構成の作成
   - Matter.js CDNの読み込み

2. **Phase 1-2: 基本UI実装**
   - HTML構造
   - CSS スタイリング
   - 画面遷移ロジック

3. **Phase 3: 物理演算実装**
   - Matter.jsセットアップ
   - カプセル・容器の作成
   - 各フェーズのアニメーション

4. **Phase 4: CSS演出**
   - カプセル開封アニメーション
   - 紙吹雪エフェクト
   - トランジション

5. **Phase 5-6: 機能実装**
   - チーム管理ロジック
   - LocalStorage連携
   - 効果音実装

6. **テスト・調整**
   - 各テストケースの確認
   - パフォーマンス最適化
   - プロジェクター表示確認

---

## 📝 注意事項

### プロジェクター投影時の考慮点
- フォントサイズは大きめに設定
- 高コントラストな配色
- アニメーション速度は遅めに（見逃さないように）
- 遠くからでも見やすいUI

### ブラウザ互換性
- Web Audio APIは初回クリック後に有効化
- LocalStorageの容量制限（通常5-10MB）
- Matter.jsはモダンブラウザのみ対応

### パフォーマンス
- カプセル数は最大20個程度推奨
- 物理演算のステップ数を調整してFPS維持
- 不要なオブジェクトは適宜削除

---

## 🔧 将来の拡張案

- [ ] チーム人数による重み付け抽選
- [ ] 抽選履歴の記録・表示
- [ ] 複数の演出パターン選択
- [ ] カスタムカプセルデザイン
- [ ] 音声ファイルのカスタマイズ
- [ ] エクスポート/インポート機能
- [ ] ダークモード/ライトモード切替

---

**プロジェクト開始日**: 2025年11月3日  
**予想完成日**: 2025年11月3日  
**推定開発時間**: 5.5時間
