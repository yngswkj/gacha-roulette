// gachaPhysics.js - Matter.js物理演算エンジン
class GachaPhysicsEngine {
  constructor(uiController) {
    this.ui = uiController;
    this.animationManager = new AnimationManager();
    this.engine = null;
    this.world = null;
    this.render = null;
    this.runner = null;
    this.capsules = [];
    this.isRunning = false;
  }

  // 物理エンジンの初期化
  initEngine(canvas) {
    if (typeof Matter === 'undefined') {
      console.error('Matter.js is not loaded!');
      throw new Error('Matter.js library is not loaded');
    }

    const { Engine, Render, World, Bodies, Runner } = Matter;

    this.engine = Engine.create({
      gravity: { x: 0, y: 1 }
    });
    this.world = this.engine.world;

    this.render = Render.create({
      canvas: canvas,
      engine: this.engine,
      options: {
        width: canvas.width,
        height: canvas.height,
        wireframes: false,
        background: '#0f0f23'
      }
    });

    this.runner = Runner.create();

    // Runnerを開始（物理エンジンの更新）
    Runner.run(this.runner, this.engine);

    // 手動レンダリングループを開始（Matter.js v0.19.0 対応）
    const self = this;
    (function render() {
      // Matter.js v0.19.0では個別にレンダリング関数を呼ぶ必要がある
      const context = self.render.context;
      const engine = self.render.engine;
      const options = self.render.options;

      // 背景をクリア
      context.fillStyle = options.background || '#0f0f23';
      context.fillRect(0, 0, self.render.canvas.width, self.render.canvas.height);

      // ボディを描画
      Matter.Render.bodies(self.render, self.world.bodies, context);

      self.render.frameRequestId = requestAnimationFrame(render);
    })();
  }

  // 抽選開始
  async start(eligibleItems) {
    if (this.isRunning) {
      this.ui.toast('抽選が既に実行中です', 'warning');
      return;
    }

    if (eligibleItems.length === 0) {
      this.ui.toast('未抽選の項目がありません', 'error');
      return;
    }

    this.isRunning = true;

    try {
      // 物理演算オーバーレイを表示
      const { overlay, canvas, message } = this.animationManager.showPhysicsOverlay();

      // DOMレンダリングを待つ（重要！）
      await new Promise(resolve => requestAnimationFrame(resolve));
      await new Promise(resolve => setTimeout(resolve, 100));

      // 物理エンジン初期化
      this.initEngine(canvas);

      // 5フェーズの抽選演出
      await this.runPhysicsAnimation(eligibleItems, canvas);

      // ランダムに当選項目を選出
      const winner = eligibleItems[Math.floor(Math.random() * eligibleItems.length)];

      // 物理エンジンを停止
      this.cleanup();

      // オーバーレイを削除
      this.animationManager.hidePhysicsOverlay();

      // 結果画面を表示
      this.ui.showResult(winner);

      // 紙吹雪エフェクト
      this.animationManager.createConfetti();

      this.isRunning = false;

    } catch (error) {
      console.error('Physics lottery error:', error);
      this.cleanup();
      this.animationManager.hidePhysicsOverlay();
      this.ui.toast('抽選中にエラーが発生しました', 'error');
      this.ui.switchTab('manage');
      this.isRunning = false;
    }
  }

  // 5フェーズの物理アニメーション
  async runPhysicsAnimation(eligibleItems, canvas) {
    const { Bodies, Render, Runner } = Matter;

    // コンテナの作成
    this.createContainer(canvas.width, canvas.height);

    // フェーズ1: カプセル投入（2.5秒 - ボールが大きくなったので落下を少し長く）
    this.animationManager.updatePhysicsMessage('カプセルを投入中...');
    await this.phase1_dropCapsules(eligibleItems, canvas.width);
    await this.animationManager.sleep(2500);

    // フェーズ2: シャッフル（0秒 - phase2_shuffle内で独自に時間管理）
    await this.phase2_shuffle();

    // フェーズ3: 抽出（2.5秒）
    this.animationManager.updatePhysicsMessage('当選カプセルを選出中...');
    const selectedCapsule = await this.phase3_extract();
    await this.animationManager.sleep(2500);

    // フェーズ4: 転がる（2秒）
    this.animationManager.updatePhysicsMessage('カプセルが転がっています...');
    await this.phase4_roll(selectedCapsule, canvas.width, canvas.height);
    await this.animationManager.sleep(2000);

    // フェーズ5: 停止・表示準備（0.5秒）
    this.animationManager.updatePhysicsMessage('結果を表示します！');
    await this.animationManager.sleep(500);
  }

  // コンテナ（壁）の作成
  createContainer(width, height) {
    const { Bodies, World } = Matter;
    const wallThickness = 50;

    const ground = Bodies.rectangle(width / 2, height - 25, width, wallThickness, {
      isStatic: true,
      render: {
        fillStyle: '#4ECDC4',
        strokeStyle: '#ffffff',
        lineWidth: 2
      }
    });

    const leftWall = Bodies.rectangle(25, height / 2, wallThickness, height, {
      isStatic: true,
      render: {
        fillStyle: '#4ECDC4',
        strokeStyle: '#ffffff',
        lineWidth: 2
      }
    });

    const rightWall = Bodies.rectangle(width - 25, height / 2, wallThickness, height, {
      isStatic: true,
      render: {
        fillStyle: '#4ECDC4',
        strokeStyle: '#ffffff',
        lineWidth: 2
      }
    });

    // 天井を削除してカプセルが上から落下できるようにする
    World.add(this.world, [ground, leftWall, rightWall]);
  }

  // フェーズ1: カプセル投入
  async phase1_dropCapsules(items, canvasWidth) {
    const { Bodies, World } = Matter;
    this.capsules = [];

    // ボールサイズをキャンバスサイズと項目数に応じて動的計算
    const canvasHeight = this.render.canvas.height;
    const baseRadius = Math.min(canvasWidth, canvasHeight) * 0.06; // 6%のサイズ
    // 項目数が多い場合はさらに小さく調整
    const capsuleRadius = items.length > 20 ? baseRadius * 0.9 : baseRadius;

    // ガチャガチャのように密集した配置
    const cols = Math.ceil(Math.sqrt(items.length));
    const spacing = capsuleRadius * 2.5;
    const totalWidth = cols * spacing;
    const startX = (canvasWidth - totalWidth) / 2 + spacing / 2;

    items.forEach((item, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const x = startX + col * spacing + (Math.random() - 0.5) * 20;
      const y = 80 + row * spacing + (Math.random() - 0.5) * 20;

      const capsule = Bodies.circle(x, y, capsuleRadius, {
        restitution: 0.8, // より弾むように
        friction: 0.05,
        density: 0.003, // 重量感を増加
        render: {
          fillStyle: item.color,
          strokeStyle: '#ffffff',
          lineWidth: 3 // 線を太く
        }
      });

      capsule.itemData = item; // アイテムデータを紐付け
      this.capsules.push(capsule);
      World.add(this.world, capsule);
    });
  }

  // フェーズ2: シャッフル（3段階の激しいシャッフル）
  async phase2_shuffle() {
    const { Body } = Matter;

    // 第1段階: 激しい上下振動（重力反転）
    this.animationManager.updatePhysicsMessage('激しくシャッフル中...');
    for (let i = 0; i < 5; i++) {
      this.capsules.forEach(capsule => {
        const forceY = -0.15; // 強い上向きの力
        const forceX = (Math.random() - 0.5) * 0.1;
        Body.applyForce(capsule, capsule.position, { x: forceX, y: forceY });
        Body.setAngularVelocity(capsule, (Math.random() - 0.5) * 0.5); // 回転
      });
      await this.animationManager.sleep(250);
    }

    // 第2段階: 左右の波（交互に強い力）
    this.animationManager.updatePhysicsMessage('カプセルを混ぜています...');
    for (let i = 0; i < 6; i++) {
      const direction = i % 2 === 0 ? 1 : -1;
      this.capsules.forEach(capsule => {
        const forceX = direction * 0.12;
        const forceY = (Math.random() - 0.5) * 0.08;
        Body.applyForce(capsule, capsule.position, { x: forceX, y: forceY });
        Body.setAngularVelocity(capsule, direction * 0.3);
      });
      await this.animationManager.sleep(200);
    }

    // 第3段階: ランダム爆発
    this.animationManager.updatePhysicsMessage('最終シャッフル...');
    for (let i = 0; i < 8; i++) {
      this.capsules.forEach(capsule => {
        const angle = Math.random() * Math.PI * 2;
        const magnitude = 0.05 + Math.random() * 0.1;
        const forceX = Math.cos(angle) * magnitude;
        const forceY = Math.sin(angle) * magnitude;
        Body.applyForce(capsule, capsule.position, { x: forceX, y: forceY });
        Body.setAngularVelocity(capsule, (Math.random() - 0.5) * 0.6);
      });
      await this.animationManager.sleep(180);
    }

    // シャッフル後の落ち着き時間
    await this.animationManager.sleep(800);
  }

  // フェーズ3: 抽出
  async phase3_extract() {
    // ランダムに1つのカプセルを選出
    const selectedCapsule = this.capsules[Math.floor(Math.random() * this.capsules.length)];

    // 選ばれたカプセルを光らせる
    selectedCapsule.render.fillStyle = '#FFD700'; // ゴールド
    selectedCapsule.render.lineWidth = 4;

    // 他のカプセルを透明に
    this.capsules.forEach(capsule => {
      if (capsule !== selectedCapsule) {
        capsule.render.opacity = 0.3;
      }
    });

    return selectedCapsule;
  }

  // フェーズ4: 転がる
  async phase4_roll(capsule, canvasWidth, canvasHeight) {
    const { Body } = Matter;

    // 右下に向かって転がす力を加える
    Body.setVelocity(capsule, { x: 5, y: -3 });
    Body.setAngularVelocity(capsule, 0.2);
  }

  // クリーンアップ
  cleanup() {
    if (this.runner) {
      Matter.Runner.stop(this.runner);
    }
    if (this.render) {
      Matter.Render.stop(this.render);
    }
    if (this.world) {
      Matter.World.clear(this.world);
    }
    if (this.engine) {
      Matter.Engine.clear(this.engine);
    }
    this.capsules = [];
  }
}
