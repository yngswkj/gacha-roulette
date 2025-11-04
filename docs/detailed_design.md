# チーム抽選ガチャガチャ - 詳細設計書

作成日: 2025年11月3日
バージョン: 1.0

---

## 📑 目次

1. [アーキテクチャ設計](#1-アーキテクチャ設計)
2. [モジュール設計](#2-モジュール設計)
3. [データフロー設計](#3-データフロー設計)
4. [物理演算エンジン設計](#4-物理演算エンジン設計)
5. [UIコンポーネント設計](#5-uiコンポーネント設計)
6. [アニメーション・演出設計](#6-アニメーション演出設計)
7. [エラーハンドリング設計](#7-エラーハンドリング設計)
8. [パフォーマンス最適化](#8-パフォーマンス最適化)
9. [実装詳細](#9-実装詳細)

---

## 1. アーキテクチャ設計

### 1.1 システム全体構成

```
┌─────────────────────────────────────────────────────┐
│                   Application Layer                  │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────┐ │
│  │  MainScreen  │  │ GachaScreen  │  │ResultScreen│ │
│  └──────┬───────┘  └──────┬───────┘  └─────┬─────┘ │
│         │                 │                 │        │
├─────────┴─────────────────┴─────────────────┴────────┤
│                   Business Logic Layer               │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────┐ │
│  │ TeamManager  │  │GachaOrchest. │  │AnimationMgr│ │
│  └──────┬───────┘  └──────┬───────┘  └─────┬─────┘ │
│         │                 │                 │        │
├─────────┴─────────────────┴─────────────────┴────────┤
│                    Service Layer                     │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────┐ │
│  │StorageService│  │PhysicsEngine │  │ AudioMgr  │ │
│  └──────────────┘  └──────────────┘  └───────────┘ │
└─────────────────────────────────────────────────────┘
```

### 1.2 レイヤー責務

#### Application Layer (View)
- ユーザーインターフェースの描画
- ユーザー入力の受付
- 画面遷移の制御

#### Business Logic Layer
- チームデータの管理・操作
- 抽選ロジックの実行
- アニメーションシーケンスの制御

#### Service Layer
- データ永続化（LocalStorage）
- 物理演算（Matter.js）
- 効果音再生（Web Audio API）

### 1.3 モジュール依存関係

```
app.js (Main Controller)
  ├─> storage.js (Storage Service)
  ├─> teamManager.js (Team Business Logic)
  ├─> gachaOrchestrator.js (Gacha Orchestration)
  │     ├─> gacha.js (Physics Engine)
  │     ├─> audioManager.js (Audio Service)
  │     └─> animationManager.js (Animation Control)
  └─> uiController.js (UI Management)
```

---

## 2. モジュール設計

### 2.1 storage.js - データ永続化モジュール

#### 責務
- LocalStorageへのデータ保存/読み込み
- データ整合性の保証
- マイグレーション対応

#### インターフェース

```javascript
class StorageService {
  /**
   * チームデータを保存
   * @param {Team[]} teams - チーム配列
   * @returns {boolean} 成功/失敗
   */
  saveTeams(teams)

  /**
   * チームデータを読み込み
   * @returns {Team[]} チーム配列
   */
  loadTeams()

  /**
   * 全データをクリア
   * @returns {boolean} 成功/失敗
   */
  clearAll()

  /**
   * データのエクスポート（JSON）
   * @returns {string} JSON文字列
   */
  exportData()

  /**
   * データのインポート（JSON）
   * @param {string} jsonData - JSON文字列
   * @returns {boolean} 成功/失敗
   */
  importData(jsonData)
}
```

#### データスキーマ

```typescript
interface Team {
  id: string;              // UUID v4
  name: string;            // チーム名（1-50文字）
  isWinner: boolean;       // 当選済みフラグ
  color: string;           // HEX色コード (#RRGGBB)
  createdAt: number;       // Unix timestamp (ms)
  updatedAt: number;       // Unix timestamp (ms)
}

interface StorageData {
  version: string;         // スキーマバージョン "1.0"
  teams: Team[];
  lastModified: number;    // Unix timestamp (ms)
}
```

#### 実装詳細

```javascript
const STORAGE_KEY = 'gacha_teams_v1';
const SCHEMA_VERSION = '1.0';
const MAX_TEAMS = 50;

class StorageService {
  constructor() {
    this.validateBrowserSupport();
  }

  validateBrowserSupport() {
    if (!window.localStorage) {
      throw new Error('LocalStorage is not supported');
    }
  }

  saveTeams(teams) {
    try {
      // バリデーション
      if (!Array.isArray(teams)) {
        throw new Error('Teams must be an array');
      }

      if (teams.length > MAX_TEAMS) {
        throw new Error(`Maximum ${MAX_TEAMS} teams allowed`);
      }

      const data = {
        version: SCHEMA_VERSION,
        teams: teams.map(team => ({
          ...team,
          updatedAt: Date.now()
        })),
        lastModified: Date.now()
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch (error) {
      console.error('Failed to save teams:', error);
      return false;
    }
  }

  loadTeams() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);

      if (!data) {
        return this.getDefaultTeams();
      }

      const parsed = JSON.parse(data);

      // バージョンチェック
      if (parsed.version !== SCHEMA_VERSION) {
        return this.migrateData(parsed);
      }

      return parsed.teams || [];
    } catch (error) {
      console.error('Failed to load teams:', error);
      return this.getDefaultTeams();
    }
  }

  getDefaultTeams() {
    return [
      {
        id: this.generateId(),
        name: '営業チーム',
        isWinner: false,
        color: '#FF6B6B',
        createdAt: Date.now(),
        updatedAt: Date.now()
      },
      {
        id: this.generateId(),
        name: '開発チーム',
        isWinner: false,
        color: '#4ECDC4',
        createdAt: Date.now(),
        updatedAt: Date.now()
      },
      {
        id: this.generateId(),
        name: '企画チーム',
        isWinner: false,
        color: '#95E1D3',
        createdAt: Date.now(),
        updatedAt: Date.now()
      },
      {
        id: this.generateId(),
        name: '人事チーム',
        isWinner: false,
        color: '#FFE66D',
        createdAt: Date.now(),
        updatedAt: Date.now()
      },
      {
        id: this.generateId(),
        name: '総務チーム',
        isWinner: false,
        color: '#C77DFF',
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
    ];
  }

  generateId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  migrateData(oldData) {
    // 将来のバージョンアップ対応
    console.warn('Data migration needed');
    return this.getDefaultTeams();
  }
}
```

### 2.2 teamManager.js - チーム管理モジュール

#### 責務
- チームのCRUD操作
- 抽選対象チームの選定
- 当選処理

#### インターフェース

```javascript
class TeamManager {
  /**
   * コンストラクタ
   * @param {StorageService} storage - ストレージサービス
   */
  constructor(storage)

  /**
   * 全チームを取得
   * @returns {Team[]} チーム配列
   */
  getAllTeams()

  /**
   * チームを追加
   * @param {string} name - チーム名
   * @param {string} color - カプセル色
   * @returns {Team} 追加されたチーム
   */
  addTeam(name, color)

  /**
   * チームを更新
   * @param {string} id - チームID
   * @param {Partial<Team>} updates - 更新内容
   * @returns {Team} 更新されたチーム
   */
  updateTeam(id, updates)

  /**
   * チームを削除
   * @param {string} id - チームID
   * @returns {boolean} 成功/失敗
   */
  deleteTeam(id)

  /**
   * 未当選チームを取得
   * @returns {Team[]} 未当選チーム配列
   */
  getEligibleTeams()

  /**
   * チームを当選済みにマーク
   * @param {string} id - チームID
   * @returns {Team} 更新されたチーム
   */
  markAsWinner(id)

  /**
   * 全チームをリセット（未当選に戻す）
   * @returns {boolean} 成功/失敗
   */
  resetAllTeams()

  /**
   * ランダムな色を生成
   * @returns {string} HEX色コード
   */
  generateRandomColor()
}
```

#### 実装詳細

```javascript
const COLOR_PALETTE = [
  '#FF6B6B', '#4ECDC4', '#95E1D3', '#FFE66D', '#C77DFF',
  '#FF8C94', '#A8E6CF', '#FFD3B6', '#FFAAA5', '#B4A7D6',
  '#FF9AA2', '#FFB7B2', '#FFDAC1', '#E2F0CB', '#B5EAD7'
];

class TeamManager {
  constructor(storage) {
    this.storage = storage;
    this.teams = storage.loadTeams();
    this.eventListeners = new Map();
  }

  getAllTeams() {
    return [...this.teams]; // 防御的コピー
  }

  addTeam(name, color = null) {
    // バリデーション
    if (!name || name.trim().length === 0) {
      throw new Error('Team name cannot be empty');
    }

    if (name.length > 50) {
      throw new Error('Team name too long (max 50 characters)');
    }

    // 重複チェック
    if (this.teams.some(t => t.name === name.trim())) {
      throw new Error('Team name already exists');
    }

    const newTeam = {
      id: this.storage.generateId(),
      name: name.trim(),
      isWinner: false,
      color: color || this.generateRandomColor(),
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    this.teams.push(newTeam);
    this.persist();
    this.emit('teamAdded', newTeam);

    return newTeam;
  }

  updateTeam(id, updates) {
    const index = this.teams.findIndex(t => t.id === id);

    if (index === -1) {
      throw new Error('Team not found');
    }

    const team = this.teams[index];
    const updatedTeam = {
      ...team,
      ...updates,
      id: team.id, // IDは変更不可
      createdAt: team.createdAt, // 作成日時は変更不可
      updatedAt: Date.now()
    };

    this.teams[index] = updatedTeam;
    this.persist();
    this.emit('teamUpdated', updatedTeam);

    return updatedTeam;
  }

  deleteTeam(id) {
    const index = this.teams.findIndex(t => t.id === id);

    if (index === -1) {
      return false;
    }

    const deletedTeam = this.teams[index];
    this.teams.splice(index, 1);
    this.persist();
    this.emit('teamDeleted', deletedTeam);

    return true;
  }

  getEligibleTeams() {
    return this.teams.filter(t => !t.isWinner);
  }

  markAsWinner(id) {
    return this.updateTeam(id, { isWinner: true });
  }

  resetAllTeams() {
    this.teams = this.teams.map(team => ({
      ...team,
      isWinner: false,
      updatedAt: Date.now()
    }));

    this.persist();
    this.emit('allTeamsReset');

    return true;
  }

  generateRandomColor() {
    // 既存チームで使われていない色を優先
    const usedColors = new Set(this.teams.map(t => t.color));
    const availableColors = COLOR_PALETTE.filter(c => !usedColors.has(c));

    if (availableColors.length > 0) {
      return availableColors[Math.floor(Math.random() * availableColors.length)];
    }

    // 全色使用済みの場合、ランダムに生成
    return '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
  }

  persist() {
    this.storage.saveTeams(this.teams);
  }

  // イベントエミッター
  on(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(callback);
  }

  emit(event, data) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => callback(data));
    }
  }
}
```

---

## 3. データフロー設計

### 3.1 状態管理

```javascript
// アプリケーション全体の状態
const AppState = {
  // 画面状態
  currentScreen: 'main', // 'main' | 'gacha' | 'result'

  // チームデータ
  teams: [],

  // 抽選状態
  gachaState: {
    isRunning: false,
    currentPhase: null, // null | 'drop' | 'shuffle' | 'extract' | 'roll' | 'reveal'
    selectedTeam: null,
    progress: 0 // 0-100
  },

  // UI状態
  ui: {
    isEditMode: false,
    selectedTeamId: null,
    showSettings: false
  }
};
```

### 3.2 イベントフロー

```
[ユーザー操作]
     ↓
[UIイベントハンドラ]
     ↓
[ビジネスロジック実行]
     ↓
[状態更新]
     ↓
[ストレージ保存]
     ↓
[UI再描画]
```

### 3.3 抽選フロー

```
1. 抽選開始ボタンクリック
   ↓
2. 未当選チェック（0件ならエラー）
   ↓
3. 画面遷移（main → gacha）
   ↓
4. 物理エンジン初期化
   ↓
5. フェーズ1: カプセル投入（2秒）
   - カプセルオブジェクト生成
   - 時間差で落下アニメーション
   - 効果音再生
   ↓
6. フェーズ2: シャッフル（3秒）
   - 容器揺らしアニメーション
   - カプセルに力を加える
   - 効果音再生
   ↓
7. フェーズ3: 取り出し（2秒）
   - 底の穴を開く
   - 当選カプセル選定
   - スローモーション開始
   ↓
8. フェーズ4: 転がり（1.5秒）
   - スロープを転がる
   - トレイ到着
   ↓
9. フェーズ5: 開封（2秒）
   - 画面遷移（gacha → result）
   - カプセル開封アニメーション
   - チーム名表示
   - 紙吹雪エフェクト
   - ファンファーレ
   ↓
10. 当選チームをマーク
   ↓
11. ストレージ保存
```

---

## 4. 物理演算エンジン設計

### 4.1 gacha.js - 物理演算モジュール

#### 責務
- Matter.jsエンジンの初期化・管理
- 物理オブジェクトの生成・操作
- 衝突検知・イベント処理
- アニメーションフェーズの実行

#### クラス設計

```javascript
class GachaPhysicsEngine {
  constructor(canvasElement, config = {})

  // 初期化
  initialize(teams)

  // アニメーション制御
  startAnimation()
  pauseAnimation()
  resumeAnimation()
  stopAnimation()

  // フェーズ実行
  async executePhase1_Drop()
  async executePhase2_Shuffle()
  async executePhase3_Extract()
  async executePhase4_Roll()

  // 物理オブジェクト生成
  createCapsule(team, x, y)
  createContainer()
  createSlope()
  createTray()

  // ユーティリティ
  cleanup()
  setTimeScale(scale)
  highlightCapsule(capsule)
}
```

#### 物理パラメータ詳細

```javascript
const PHYSICS_CONFIG = {
  // エンジン設定
  engine: {
    gravity: {
      x: 0,
      y: 1.0 // 地球の重力
    },
    enableSleeping: false,
    timing: {
      timeScale: 1.0
    }
  },

  // レンダラー設定
  render: {
    width: 800,
    height: 600,
    wireframes: false,
    background: 'transparent',
    pixelRatio: window.devicePixelRatio || 1
  },

  // カプセル設定
  capsule: {
    radius: 35,
    restitution: 0.8,    // 反発係数（0-1）高いほど弾む
    friction: 0.05,      // 摩擦係数（0-1）
    frictionAir: 0.01,   // 空気抵抗（0-1）
    density: 0.04,       // 密度
    slop: 0.05,          // 貫通許容値
    render: {
      fillStyle: '#FF6B6B',
      strokeStyle: '#000',
      lineWidth: 2
    }
  },

  // 容器設定
  container: {
    floor: {
      x: 400,
      y: 550,
      width: 700,
      height: 40,
      isStatic: true,
      render: {
        fillStyle: '#2a2a3e'
      }
    },
    leftWall: {
      x: 50,
      y: 300,
      width: 40,
      height: 500,
      isStatic: true
    },
    rightWall: {
      x: 750,
      y: 300,
      width: 40,
      height: 500,
      isStatic: true
    }
  },

  // 取り出し口設定
  exitSensor: {
    x: 400,
    y: 540,
    width: 80,
    height: 20,
    isSensor: true,
    isStatic: true,
    render: {
      fillStyle: '#FFD700',
      opacity: 0.5
    }
  },

  // スロープ設定
  slope: {
    x: 500,
    y: 600,
    width: 300,
    height: 20,
    angle: Math.PI / 12, // 15度
    isStatic: true,
    friction: 0.001 // 低摩擦でスムーズに転がる
  },

  // トレイ設定
  tray: {
    x: 650,
    y: 650,
    width: 100,
    height: 60,
    isStatic: true
  }
};
```

#### フェーズ実装詳細

```javascript
class GachaPhysicsEngine {
  constructor(canvas, config = PHYSICS_CONFIG) {
    this.canvas = canvas;
    this.config = config;
    this.engine = null;
    this.render = null;
    this.runner = null;
    this.capsules = [];
    this.container = {};
    this.selectedCapsule = null;
    this.eventHandlers = new Map();
  }

  initialize(teams) {
    // エンジン作成
    this.engine = Matter.Engine.create({
      gravity: this.config.engine.gravity,
      enableSleeping: this.config.engine.enableSleeping
    });

    // レンダラー作成
    this.render = Matter.Render.create({
      canvas: this.canvas,
      engine: this.engine,
      options: this.config.render
    });

    // ランナー作成
    this.runner = Matter.Runner.create();

    // 容器作成
    this.createContainer();

    // チームからカプセル生成（初期位置は画面外上部）
    teams.forEach((team, index) => {
      const capsule = this.createCapsule(
        team,
        100 + (index * 60), // X位置を分散
        -100 - (index * 70)  // Y位置を時間差用に分散
      );
      this.capsules.push(capsule);
    });

    // レンダリング開始
    Matter.Render.run(this.render);
    Matter.Runner.run(this.runner, this.engine);
  }

  createCapsule(team, x, y) {
    const capsule = Matter.Bodies.circle(x, y, this.config.capsule.radius, {
      restitution: this.config.capsule.restitution,
      friction: this.config.capsule.friction,
      frictionAir: this.config.capsule.frictionAir,
      density: this.config.capsule.density,
      render: {
        ...this.config.capsule.render,
        fillStyle: team.color
      },
      label: `capsule_${team.id}`,
      teamData: team // カスタムデータ
    });

    return capsule;
  }

  createContainer() {
    const { floor, leftWall, rightWall } = this.config.container;

    this.container.floor = Matter.Bodies.rectangle(
      floor.x, floor.y, floor.width, floor.height,
      { isStatic: true, render: floor.render }
    );

    this.container.leftWall = Matter.Bodies.rectangle(
      leftWall.x, leftWall.y, leftWall.width, leftWall.height,
      { isStatic: true, render: leftWall.render }
    );

    this.container.rightWall = Matter.Bodies.rectangle(
      rightWall.x, rightWall.y, rightWall.width, rightWall.height,
      { isStatic: true, render: rightWall.render }
    );

    Matter.World.add(this.engine.world, [
      this.container.floor,
      this.container.leftWall,
      this.container.rightWall
    ]);
  }

  async executePhase1_Drop() {
    return new Promise((resolve) => {
      // カプセルを時間差で投入
      this.capsules.forEach((capsule, index) => {
        setTimeout(() => {
          Matter.World.add(this.engine.world, capsule);
          this.emit('capsuleDropped', { capsule, index });
        }, index * 200); // 200ms間隔
      });

      // 全カプセル落下完了まで待機
      setTimeout(resolve, 2000);
    });
  }

  async executePhase2_Shuffle() {
    return new Promise((resolve) => {
      const interval = setInterval(() => {
        // 容器を揺らす（壁を微小移動）
        this.shakeContainer();

        // カプセルにランダムな力を加える
        this.capsules.forEach(capsule => {
          Matter.Body.applyForce(capsule, capsule.position, {
            x: (Math.random() - 0.5) * 0.08,
            y: (Math.random() - 0.5) * 0.08
          });
        });
      }, 50);

      setTimeout(() => {
        clearInterval(interval);
        this.resetContainerPosition();
        resolve();
      }, 3000);
    });
  }

  async executePhase3_Extract() {
    return new Promise((resolve) => {
      // 底に穴を開ける（センサー追加）
      const exitSensor = Matter.Bodies.rectangle(
        this.config.exitSensor.x,
        this.config.exitSensor.y,
        this.config.exitSensor.width,
        this.config.exitSensor.height,
        {
          isSensor: true,
          isStatic: true,
          render: this.config.exitSensor.render,
          label: 'exitSensor'
        }
      );

      Matter.World.add(this.engine.world, exitSensor);

      // 衝突検知
      const collisionHandler = (event) => {
        event.pairs.forEach(pair => {
          const { bodyA, bodyB } = pair;

          if (bodyA.label === 'exitSensor' || bodyB.label === 'exitSensor') {
            const capsule = bodyA.label.startsWith('capsule') ? bodyA : bodyB;

            if (!this.selectedCapsule && this.capsules.includes(capsule)) {
              this.selectedCapsule = capsule;
              this.highlightCapsule(capsule);
              this.setTimeScale(0.3); // スローモーション
              this.emit('winnerSelected', capsule.teamData);

              setTimeout(() => {
                Matter.Events.off(this.engine, 'collisionStart', collisionHandler);
                resolve(capsule.teamData);
              }, 1000);
            }
          }
        });
      };

      Matter.Events.on(this.engine, 'collisionStart', collisionHandler);

      // タイムアウト処理（念のため）
      setTimeout(() => {
        if (!this.selectedCapsule) {
          // ランダムに選出
          const randomCapsule = this.capsules[
            Math.floor(Math.random() * this.capsules.length)
          ];
          this.selectedCapsule = randomCapsule;
          Matter.Events.off(this.engine, 'collisionStart', collisionHandler);
          resolve(randomCapsule.teamData);
        }
      }, 5000);
    });
  }

  async executePhase4_Roll() {
    return new Promise((resolve) => {
      // スロープとトレイを追加
      const slope = this.createSlope();
      const tray = this.createTray();

      Matter.World.add(this.engine.world, [slope, tray]);

      // 選択されたカプセルをスロープに移動
      Matter.Body.setPosition(this.selectedCapsule, {
        x: 450,
        y: 580
      });

      // 通常速度に戻す
      this.setTimeScale(1.0);

      // トレイ到着を待つ
      setTimeout(resolve, 1500);
    });
  }

  shakeContainer() {
    const shakeAmount = 5;

    Matter.Body.translate(this.container.leftWall, {
      x: (Math.random() - 0.5) * shakeAmount,
      y: 0
    });

    Matter.Body.translate(this.container.rightWall, {
      x: (Math.random() - 0.5) * shakeAmount,
      y: 0
    });
  }

  resetContainerPosition() {
    Matter.Body.setPosition(this.container.leftWall, {
      x: this.config.container.leftWall.x,
      y: this.config.container.leftWall.y
    });

    Matter.Body.setPosition(this.container.rightWall, {
      x: this.config.container.rightWall.x,
      y: this.config.container.rightWall.y
    });
  }

  highlightCapsule(capsule) {
    capsule.render.strokeStyle = '#FFD700';
    capsule.render.lineWidth = 5;
  }

  setTimeScale(scale) {
    this.engine.timing.timeScale = scale;
  }

  createSlope() {
    return Matter.Bodies.rectangle(
      this.config.slope.x,
      this.config.slope.y,
      this.config.slope.width,
      this.config.slope.height,
      {
        isStatic: true,
        angle: this.config.slope.angle,
        friction: this.config.slope.friction
      }
    );
  }

  createTray() {
    return Matter.Bodies.rectangle(
      this.config.tray.x,
      this.config.tray.y,
      this.config.tray.width,
      this.config.tray.height,
      {
        isStatic: true
      }
    );
  }

  cleanup() {
    if (this.runner) {
      Matter.Runner.stop(this.runner);
    }
    if (this.render) {
      Matter.Render.stop(this.render);
    }
    if (this.engine) {
      Matter.World.clear(this.engine.world);
      Matter.Engine.clear(this.engine);
    }
    this.capsules = [];
    this.selectedCapsule = null;
  }

  on(event, callback) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event).push(callback);
  }

  emit(event, data) {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(callback => callback(data));
    }
  }
}
```

---

## 5. UIコンポーネント設計

### 5.1 画面構成

#### メイン画面 (MainScreen)

```html
<div id="main-screen" class="screen active">
  <!-- ヘッダー -->
  <header class="header">
    <h1 class="title">チーム抽選ガチャガチャ</h1>
    <div class="stats">
      <span class="stat-item">
        <span class="stat-label">未当選:</span>
        <span class="stat-value" id="eligible-count">5</span>
      </span>
      <span class="stat-item">
        <span class="stat-label">総チーム数:</span>
        <span class="stat-value" id="total-count">5</span>
      </span>
    </div>
  </header>

  <!-- 抽選ボタン -->
  <div class="action-area">
    <button id="start-gacha-btn" class="btn-primary btn-large">
      抽選開始
    </button>
  </div>

  <!-- チーム一覧 -->
  <section class="teams-section">
    <div class="section-header">
      <h2>チーム一覧</h2>
      <button id="add-team-btn" class="btn-secondary">
        + チーム追加
      </button>
    </div>

    <div id="teams-grid" class="teams-grid">
      <!-- チームカードが動的生成される -->
    </div>
  </section>

  <!-- フッター -->
  <footer class="footer">
    <button id="reset-all-btn" class="btn-danger btn-small">
      全チームリセット
    </button>
    <button id="settings-btn" class="btn-secondary btn-small">
      設定
    </button>
  </footer>
</div>
```

#### チームカードコンポーネント

```html
<div class="team-card" data-team-id="{id}">
  <div class="team-card-header">
    <div class="capsule-preview" style="background-color: {color}"></div>
    <span class="team-status {status-class}">
      {status-text}
    </span>
  </div>

  <div class="team-card-body">
    <h3 class="team-name">{team-name}</h3>
  </div>

  <div class="team-card-actions">
    <button class="btn-icon edit-btn" data-action="edit">
      ✏️
    </button>
    <button class="btn-icon toggle-btn" data-action="toggle">
      🔄
    </button>
    <button class="btn-icon delete-btn" data-action="delete">
      🗑️
    </button>
  </div>
</div>
```

#### ガチャ画面 (GachaScreen)

```html
<div id="gacha-screen" class="screen">
  <header class="gacha-header">
    <h1>抽選中...</h1>
  </header>

  <div class="gacha-container">
    <!-- Matter.js Canvas -->
    <canvas id="gacha-canvas"></canvas>

    <!-- フェーズ表示 -->
    <div class="phase-indicator">
      <div class="phase-text" id="phase-text">カプセル投入中...</div>
      <div class="progress-bar">
        <div class="progress-fill" id="progress-fill"></div>
      </div>
    </div>
  </div>
</div>
```

#### 結果画面 (ResultScreen)

```html
<div id="result-screen" class="screen">
  <header class="result-header">
    <h1 class="result-title">🎉 当選チーム 🎉</h1>
  </header>

  <div class="result-container">
    <!-- カプセル開封アニメーション -->
    <div class="capsule-reveal">
      <div class="capsule-half capsule-left" id="capsule-left"></div>
      <div class="capsule-half capsule-right" id="capsule-right"></div>
      <div class="winner-name" id="winner-name">
        <!-- チーム名が表示される -->
      </div>
    </div>

    <!-- 紙吹雪エフェクト -->
    <div id="confetti-container" class="confetti-container">
      <!-- 紙吹雪が動的生成される -->
    </div>
  </div>

  <footer class="result-footer">
    <button id="back-to-main-btn" class="btn-primary btn-large">
      メイン画面に戻る
    </button>
  </footer>
</div>
```

### 5.2 uiController.js - UI管理モジュール

```javascript
class UIController {
  constructor(teamManager, gachaOrchestrator) {
    this.teamManager = teamManager;
    this.gachaOrchestrator = gachaOrchestrator;
    this.currentScreen = 'main';
    this.initializeEventListeners();
  }

  initializeEventListeners() {
    // メイン画面
    document.getElementById('start-gacha-btn')
      .addEventListener('click', () => this.handleStartGacha());

    document.getElementById('add-team-btn')
      .addEventListener('click', () => this.handleAddTeam());

    document.getElementById('reset-all-btn')
      .addEventListener('click', () => this.handleResetAll());

    // チームカード（イベント委譲）
    document.getElementById('teams-grid')
      .addEventListener('click', (e) => this.handleTeamCardAction(e));

    // 結果画面
    document.getElementById('back-to-main-btn')
      .addEventListener('click', () => this.navigateTo('main'));

    // チーム管理イベント
    this.teamManager.on('teamAdded', () => this.renderTeams());
    this.teamManager.on('teamUpdated', () => this.renderTeams());
    this.teamManager.on('teamDeleted', () => this.renderTeams());
    this.teamManager.on('allTeamsReset', () => this.renderTeams());
  }

  renderTeams() {
    const grid = document.getElementById('teams-grid');
    const teams = this.teamManager.getAllTeams();

    grid.innerHTML = teams.map(team => this.createTeamCard(team)).join('');

    // 統計更新
    this.updateStats();
  }

  createTeamCard(team) {
    const statusClass = team.isWinner ? 'status-winner' : 'status-eligible';
    const statusText = team.isWinner ? '当選済み' : '未当選';

    return `
      <div class="team-card ${team.isWinner ? 'winner' : ''}"
           data-team-id="${team.id}">
        <div class="team-card-header">
          <div class="capsule-preview"
               style="background-color: ${team.color}"></div>
          <span class="team-status ${statusClass}">${statusText}</span>
        </div>
        <div class="team-card-body">
          <h3 class="team-name">${this.escapeHtml(team.name)}</h3>
        </div>
        <div class="team-card-actions">
          <button class="btn-icon edit-btn"
                  data-action="edit"
                  title="編集">✏️</button>
          <button class="btn-icon toggle-btn"
                  data-action="toggle"
                  title="ステータス切替">🔄</button>
          <button class="btn-icon delete-btn"
                  data-action="delete"
                  title="削除">🗑️</button>
        </div>
      </div>
    `;
  }

  handleTeamCardAction(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    const card = btn.closest('.team-card');
    const teamId = card.dataset.teamId;
    const action = btn.dataset.action;

    switch (action) {
      case 'edit':
        this.handleEditTeam(teamId);
        break;
      case 'toggle':
        this.handleToggleStatus(teamId);
        break;
      case 'delete':
        this.handleDeleteTeam(teamId);
        break;
    }
  }

  handleStartGacha() {
    const eligibleTeams = this.teamManager.getEligibleTeams();

    if (eligibleTeams.length === 0) {
      this.showError('未当選のチームがありません');
      return;
    }

    this.navigateTo('gacha');
    this.gachaOrchestrator.startGacha(eligibleTeams);
  }

  handleAddTeam() {
    const name = prompt('チーム名を入力してください:');

    if (!name) return;

    try {
      this.teamManager.addTeam(name);
      this.showSuccess('チームを追加しました');
    } catch (error) {
      this.showError(error.message);
    }
  }

  handleEditTeam(teamId) {
    const team = this.teamManager.getAllTeams().find(t => t.id === teamId);
    const newName = prompt('新しいチーム名を入力してください:', team.name);

    if (!newName || newName === team.name) return;

    try {
      this.teamManager.updateTeam(teamId, { name: newName });
      this.showSuccess('チーム名を更新しました');
    } catch (error) {
      this.showError(error.message);
    }
  }

  handleToggleStatus(teamId) {
    const team = this.teamManager.getAllTeams().find(t => t.id === teamId);

    try {
      this.teamManager.updateTeam(teamId, { isWinner: !team.isWinner });
    } catch (error) {
      this.showError(error.message);
    }
  }

  handleDeleteTeam(teamId) {
    if (!confirm('本当に削除しますか?')) return;

    try {
      this.teamManager.deleteTeam(teamId);
      this.showSuccess('チームを削除しました');
    } catch (error) {
      this.showError(error.message);
    }
  }

  handleResetAll() {
    if (!confirm('全チームを未当選にリセットしますか?')) return;

    this.teamManager.resetAllTeams();
    this.showSuccess('全チームをリセットしました');
  }

  navigateTo(screenName) {
    // 現在の画面を非表示
    document.querySelectorAll('.screen').forEach(screen => {
      screen.classList.remove('active');
    });

    // 指定画面を表示
    document.getElementById(`${screenName}-screen`).classList.add('active');
    this.currentScreen = screenName;
  }

  updateStats() {
    const teams = this.teamManager.getAllTeams();
    const eligible = this.teamManager.getEligibleTeams();

    document.getElementById('total-count').textContent = teams.length;
    document.getElementById('eligible-count').textContent = eligible.length;

    // 抽選ボタンの有効/無効
    const startBtn = document.getElementById('start-gacha-btn');
    startBtn.disabled = eligible.length === 0;
  }

  showError(message) {
    // トースト通知を表示
    this.showToast(message, 'error');
  }

  showSuccess(message) {
    this.showToast(message, 'success');
  }

  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    document.body.appendChild(toast);

    // アニメーション後に削除
    setTimeout(() => {
      toast.classList.add('show');
    }, 10);

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
```

---

## 6. アニメーション・演出設計

### 6.1 gachaOrchestrator.js - 演出統括モジュール

```javascript
class GachaOrchestrator {
  constructor(physicsEngine, animationManager, audioManager, teamManager, uiController) {
    this.physics = physicsEngine;
    this.animation = animationManager;
    this.audio = audioManager;
    this.teamManager = teamManager;
    this.ui = uiController;
    this.isRunning = false;
  }

  async startGacha(eligibleTeams) {
    if (this.isRunning) return;

    this.isRunning = true;

    try {
      // 1. 物理エンジン初期化
      this.physics.initialize(eligibleTeams);

      // 2. フェーズ1: カプセル投入（2秒）
      this.updatePhaseText('カプセル投入中...');
      this.audio.playDropSound();
      await this.physics.executePhase1_Drop();
      await this.sleep(500);

      // 3. フェーズ2: シャッフル（3秒）
      this.updatePhaseText('シャッフル中...');
      this.audio.playShuffleSound();
      await this.physics.executePhase2_Shuffle();
      await this.sleep(500);

      // 4. フェーズ3: 取り出し（2秒）
      this.updatePhaseText('抽選中...');
      this.audio.playExtractionSound();
      const winner = await this.physics.executePhase3_Extract();
      await this.sleep(500);

      // 5. フェーズ4: 転がり（1.5秒）
      this.updatePhaseText('当選カプセル取り出し中...');
      this.audio.playRollSound();
      await this.physics.executePhase4_Roll();

      // 6. 物理エンジンクリーンアップ
      this.physics.cleanup();

      // 7. 結果画面へ遷移
      this.ui.navigateTo('result');

      // 8. フェーズ5: 開封演出（2秒）
      await this.animation.playCapsuleReveal(winner);

      // 9. チームを当選済みにマーク
      this.teamManager.markAsWinner(winner.id);

      // 10. 完了
      this.isRunning = false;

    } catch (error) {
      console.error('Gacha error:', error);
      this.ui.showError('抽選中にエラーが発生しました');
      this.physics.cleanup();
      this.ui.navigateTo('main');
      this.isRunning = false;
    }
  }

  updatePhaseText(text) {
    const phaseElement = document.getElementById('phase-text');
    if (phaseElement) {
      phaseElement.textContent = text;
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### 6.2 animationManager.js - CSS アニメーション管理

```javascript
class AnimationManager {
  constructor() {
    this.confettiCount = 100;
  }

  async playCapsuleReveal(winner) {
    // カプセル色設定
    const capsuleLeft = document.getElementById('capsule-left');
    const capsuleRight = document.getElementById('capsule-right');

    capsuleLeft.style.backgroundColor = winner.color;
    capsuleRight.style.backgroundColor = winner.color;

    // 開封アニメーション開始
    await this.sleep(500);
    capsuleLeft.classList.add('open');
    capsuleRight.classList.add('open');

    // チーム名表示
    await this.sleep(800);
    const winnerName = document.getElementById('winner-name');
    winnerName.textContent = winner.name;
    winnerName.classList.add('reveal');

    // ファンファーレ
    const audioManager = new AudioManager();
    audioManager.playFanfare();

    // 紙吹雪
    this.createConfetti();

    await this.sleep(2000);
  }

  createConfetti() {
    const container = document.getElementById('confetti-container');
    container.innerHTML = ''; // クリア

    const colors = ['#FF6B6B', '#4ECDC4', '#95E1D3', '#FFE66D', '#C77DFF'];

    for (let i = 0; i < this.confettiCount; i++) {
      const confetti = document.createElement('div');
      confetti.className = 'confetti';

      // ランダムな位置・色・サイズ
      confetti.style.left = Math.random() * 100 + '%';
      confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      confetti.style.width = (Math.random() * 10 + 5) + 'px';
      confetti.style.height = confetti.style.width;
      confetti.style.animationDelay = (Math.random() * 3) + 's';
      confetti.style.animationDuration = (Math.random() * 3 + 2) + 's';

      container.appendChild(confetti);
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### 6.3 audioManager.js - 効果音管理

```javascript
class AudioManager {
  constructor() {
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    this.masterGain = this.audioContext.createGain();
    this.masterGain.connect(this.audioContext.destination);
    this.masterGain.gain.value = 0.3; // 音量30%
  }

  playDropSound() {
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(400, this.audioContext.currentTime + 0.1);

    gainNode.gain.setValueAtTime(0.2, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);

    oscillator.connect(gainNode);
    gainNode.connect(this.masterGain);

    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + 0.1);
  }

  playShuffleSound() {
    // ホワイトノイズでシャッフル音を再現
    const bufferSize = this.audioContext.sampleRate * 3; // 3秒
    const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const output = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      output[i] = (Math.random() * 2 - 1) * 0.1; // ノイズ生成
    }

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.masterGain);
    source.start();
  }

  playExtractionSound() {
    // 低音のゴロゴロ音
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(100, this.audioContext.currentTime);

    gainNode.gain.setValueAtTime(0.15, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 2);

    oscillator.connect(gainNode);
    gainNode.connect(this.masterGain);

    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + 2);
  }

  playRollSound() {
    // 転がる音（減衰する連続音）
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(200, this.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(150, this.audioContext.currentTime + 1.5);

    gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 1.5);

    oscillator.connect(gainNode);
    gainNode.connect(this.masterGain);

    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + 1.5);
  }

  playFanfare() {
    // ファンファーレ（C-E-G-C）
    const notes = [
      { freq: 523, duration: 0.3 }, // C5
      { freq: 659, duration: 0.3 }, // E5
      { freq: 784, duration: 0.3 }, // G5
      { freq: 1047, duration: 0.5 } // C6
    ];

    notes.forEach((note, i) => {
      setTimeout(() => {
        this.playNote(note.freq, note.duration);
      }, i * 200);
    });
  }

  playNote(frequency, duration) {
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);

    gainNode.gain.setValueAtTime(0.2, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);

    oscillator.connect(gainNode);
    gainNode.connect(this.masterGain);

    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + duration);
  }

  setVolume(volume) {
    // 0-1の範囲
    this.masterGain.gain.value = Math.max(0, Math.min(1, volume));
  }
}
```

---

## 7. エラーハンドリング設計

### 7.1 エラー分類

```javascript
class GachaError extends Error {
  constructor(message, code, recoverable = false) {
    super(message);
    this.name = 'GachaError';
    this.code = code;
    this.recoverable = recoverable;
  }
}

// エラーコード定義
const ERROR_CODES = {
  // ストレージエラー
  STORAGE_NOT_SUPPORTED: 'E001',
  STORAGE_QUOTA_EXCEEDED: 'E002',
  STORAGE_CORRUPT_DATA: 'E003',

  // チーム管理エラー
  TEAM_NAME_EMPTY: 'E101',
  TEAM_NAME_TOO_LONG: 'E102',
  TEAM_NAME_DUPLICATE: 'E103',
  TEAM_NOT_FOUND: 'E104',
  MAX_TEAMS_EXCEEDED: 'E105',

  // 抽選エラー
  NO_ELIGIBLE_TEAMS: 'E201',
  GACHA_ALREADY_RUNNING: 'E202',
  PHYSICS_ENGINE_ERROR: 'E203',

  // ブラウザ互換性エラー
  WEB_AUDIO_NOT_SUPPORTED: 'E301',
  CANVAS_NOT_SUPPORTED: 'E302'
};
```

### 7.2 エラーハンドリング戦略

```javascript
class ErrorHandler {
  static handle(error) {
    console.error('Error:', error);

    if (error instanceof GachaError) {
      return this.handleGachaError(error);
    }

    // 予期しないエラー
    return this.handleUnexpectedError(error);
  }

  static handleGachaError(error) {
    const messages = {
      [ERROR_CODES.STORAGE_NOT_SUPPORTED]:
        'お使いのブラウザはデータ保存に対応していません',
      [ERROR_CODES.STORAGE_QUOTA_EXCEEDED]:
        'ストレージ容量が不足しています',
      [ERROR_CODES.TEAM_NAME_EMPTY]:
        'チーム名を入力してください',
      [ERROR_CODES.TEAM_NAME_TOO_LONG]:
        'チーム名は50文字以内で入力してください',
      [ERROR_CODES.TEAM_NAME_DUPLICATE]:
        'そのチーム名は既に存在します',
      [ERROR_CODES.MAX_TEAMS_EXCEEDED]:
        `チームは最大${MAX_TEAMS}個までです`,
      [ERROR_CODES.NO_ELIGIBLE_TEAMS]:
        '未当選のチームがありません',
      [ERROR_CODES.GACHA_ALREADY_RUNNING]:
        '抽選が既に実行中です'
    };

    const message = messages[error.code] || error.message;

    return {
      message,
      recoverable: error.recoverable,
      action: this.getRecoveryAction(error.code)
    };
  }

  static handleUnexpectedError(error) {
    return {
      message: '予期しないエラーが発生しました',
      recoverable: false,
      action: 'ページを再読み込みしてください'
    };
  }

  static getRecoveryAction(code) {
    const actions = {
      [ERROR_CODES.STORAGE_QUOTA_EXCEEDED]:
        '不要なチームを削除してください',
      [ERROR_CODES.NO_ELIGIBLE_TEAMS]:
        '「全チームリセット」ボタンをクリックしてください',
      [ERROR_CODES.MAX_TEAMS_EXCEEDED]:
        'チームを削除してから追加してください'
    };

    return actions[code] || null;
  }
}
```

---

## 8. パフォーマンス最適化

### 8.1 最適化戦略

#### レンダリング最適化

```javascript
const PERFORMANCE_CONFIG = {
  // Matter.js最適化
  physics: {
    positionIterations: 6,  // デフォルトより少なく
    velocityIterations: 4,  // デフォルトより少なく
    enableSleeping: true,   // 静止オブジェクトをスリープ
    constraintIterations: 2
  },

  // レンダリング最適化
  render: {
    pixelRatio: Math.min(window.devicePixelRatio, 2), // 最大2倍まで
    hasBounds: true,
    showAngleIndicator: false,
    showIds: false,
    showVertexNumbers: false
  },

  // カプセル数制限
  maxCapsules: 20,

  // アニメーションFPS
  targetFPS: 60
};
```

#### メモリ管理

```javascript
class ResourceManager {
  constructor() {
    this.resources = new Map();
  }

  register(key, resource, cleanup) {
    this.resources.set(key, { resource, cleanup });
  }

  cleanup(key) {
    const entry = this.resources.get(key);
    if (entry) {
      entry.cleanup(entry.resource);
      this.resources.delete(key);
    }
  }

  cleanupAll() {
    this.resources.forEach((entry, key) => {
      entry.cleanup(entry.resource);
    });
    this.resources.clear();
  }
}

// 使用例
const resourceManager = new ResourceManager();

// 物理エンジン登録
resourceManager.register('physicsEngine', physicsEngine, (engine) => {
  engine.cleanup();
});

// オーディオコンテキスト登録
resourceManager.register('audioContext', audioContext, (ctx) => {
  ctx.close();
});
```

#### DOM操作の最適化

```javascript
class DOMOptimizer {
  static batchUpdate(updates) {
    // DOM更新を一括実行
    requestAnimationFrame(() => {
      updates.forEach(update => update());
    });
  }

  static debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  static throttle(func, limit) {
    let inThrottle;
    return function(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }
}
```

---

## 9. 実装詳細

### 9.1 ファイル構成（最終版）

```
gacha-roulette/
├── index.html
├── css/
│   ├── style.css
│   ├── animations.css
│   └── responsive.css
├── js/
│   ├── app.js                    # メインアプリケーション
│   ├── storage.js                # ストレージサービス
│   ├── teamManager.js            # チーム管理
│   ├── gachaOrchestrator.js      # 演出統括
│   ├── gacha.js                  # 物理演算エンジン
│   ├── animationManager.js       # アニメーション管理
│   ├── audioManager.js           # 音声管理
│   ├── uiController.js           # UI制御
│   ├── errorHandler.js           # エラーハンドリング
│   └── utils.js                  # ユーティリティ
├── assets/
│   └── (将来的に音声ファイルなど)
└── docs/
    ├── gacha_implementation_plan.md
    └── detailed_design.md
```

### 9.2 app.js - メインアプリケーション

```javascript
// app.js - アプリケーションエントリーポイント

class GachaApp {
  constructor() {
    this.storage = null;
    this.teamManager = null;
    this.uiController = null;
    this.gachaOrchestrator = null;
  }

  async initialize() {
    try {
      // サービス初期化
      this.storage = new StorageService();
      this.teamManager = new TeamManager(this.storage);

      // UI初期化（後で物理エンジンなどを渡す）
      this.uiController = new UIController(this.teamManager, null);

      // 初回レンダリング
      this.uiController.renderTeams();

      console.log('App initialized successfully');
    } catch (error) {
      const handled = ErrorHandler.handle(error);
      alert(handled.message);

      if (!handled.recoverable) {
        console.error('Fatal error:', error);
      }
    }
  }

  initializeGachaOrchestrator() {
    // 遅延初期化（ガチャ実行時）
    const canvas = document.getElementById('gacha-canvas');
    const physicsEngine = new GachaPhysicsEngine(canvas);
    const animationManager = new AnimationManager();
    const audioManager = new AudioManager();

    this.gachaOrchestrator = new GachaOrchestrator(
      physicsEngine,
      animationManager,
      audioManager,
      this.teamManager,
      this.uiController
    );

    // UIコントローラーに設定
    this.uiController.gachaOrchestrator = this.gachaOrchestrator;
  }
}

// アプリケーション起動
document.addEventListener('DOMContentLoaded', () => {
  const app = new GachaApp();
  app.initialize();

  // グローバルに公開（デバッグ用）
  window.gachaApp = app;
});
```

### 9.3 index.html 構造（概要）

```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>チーム抽選ガチャガチャ</title>
  <link rel="stylesheet" href="css/style.css">
  <link rel="stylesheet" href="css/animations.css">
</head>
<body>
  <!-- メイン画面 -->
  <div id="main-screen" class="screen active">
    <!-- ... -->
  </div>

  <!-- ガチャ画面 -->
  <div id="gacha-screen" class="screen">
    <canvas id="gacha-canvas"></canvas>
    <!-- ... -->
  </div>

  <!-- 結果画面 -->
  <div id="result-screen" class="screen">
    <!-- ... -->
  </div>

  <!-- Matter.js -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/matter-js/0.19.0/matter.min.js"></script>

  <!-- アプリケーションスクリプト -->
  <script src="js/utils.js"></script>
  <script src="js/errorHandler.js"></script>
  <script src="js/storage.js"></script>
  <script src="js/teamManager.js"></script>
  <script src="js/audioManager.js"></script>
  <script src="js/animationManager.js"></script>
  <script src="js/gacha.js"></script>
  <script src="js/gachaOrchestrator.js"></script>
  <script src="js/uiController.js"></script>
  <script src="js/app.js"></script>
</body>
</html>
```

---

## 10. 実装チェックリスト

### Phase 1: 基本構造
- [ ] ファイル構成の作成
- [ ] HTML基本構造
- [ ] CSS基本スタイル
- [ ] Matter.js CDN読み込み

### Phase 2: データ層
- [ ] StorageService実装
- [ ] TeamManager実装
- [ ] データスキーマ定義
- [ ] LocalStorage動作確認

### Phase 3: UI層
- [ ] 画面レイアウト実装
- [ ] チームカードコンポーネント
- [ ] UIController実装
- [ ] 画面遷移ロジック

### Phase 4: 物理演算
- [ ] GachaPhysicsEngine実装
- [ ] カプセル・容器生成
- [ ] フェーズ1-4実装
- [ ] 衝突検知テスト

### Phase 5: 演出
- [ ] AnimationManager実装
- [ ] CSSアニメーション定義
- [ ] AudioManager実装
- [ ] GachaOrchestrator統合

### Phase 6: エラーハンドリング
- [ ] ErrorHandler実装
- [ ] バリデーション追加
- [ ] エラー表示UI

### Phase 7: 最適化
- [ ] パフォーマンスチューニング
- [ ] メモリリーク対策
- [ ] レスポンシブ対応

### Phase 8: テスト
- [ ] 全機能の動作確認
- [ ] エッジケーステスト
- [ ] ブラウザ互換性確認

---

## 11. まとめ

この詳細設計書では、以下の内容を定義しました:

1. **アーキテクチャ**: 3層レイヤー構造（View / Logic / Service）
2. **モジュール設計**: 8つの主要モジュールとそのインターフェース
3. **データフロー**: 状態管理とイベント駆動アーキテクチャ
4. **物理演算**: Matter.jsを使用した詳細な物理パラメータ
5. **UI設計**: コンポーネントベースの再利用可能な構造
6. **アニメーション**: CSS + JavaScript のハイブリッド演出
7. **エラーハンドリング**: 堅牢なエラー分類と回復戦略
8. **パフォーマンス**: レンダリング・メモリ最適化手法

この設計に基づいて実装を進めることで、保守性・拡張性の高いアプリケーションを構築できます。
