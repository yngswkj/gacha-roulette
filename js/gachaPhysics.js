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

    console.log('[DEBUG] Canvas element:', canvas);
    console.log('[DEBUG] Canvas dimensions:', canvas.width, 'x', canvas.height);
    console.log('[DEBUG] Canvas in DOM:', document.body.contains(canvas));

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
        wireframes: true,  // 一時的にワイヤーフレームモードで確認
        background: '#0f0f23'
      }
    });

    console.log('[DEBUG] Render created:', this.render);
    console.log('[DEBUG] Render.canvas:', this.render.canvas);
    console.log('[DEBUG] Render.context:', this.render.context);

    this.runner = Runner.create();

    // Runnerを開始（物理エンジンの更新）
    Runner.run(this.runner, this.engine);

    // 手動レンダリングループを開始（Matter.js v0.19.0 対応）
    let frameCount = 0;
    const self = this;
    (function render() {
      if (frameCount < 5) {
        console.log(`[DEBUG] Render frame ${frameCount}, bodies:`, self.world.bodies.length);
      }
      frameCount++;

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

    console.log('[DEBUG] Rendering loop started');
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

    // フェーズ1: カプセル投入（2秒）
    this.animationManager.updatePhysicsMessage('カプセルを投入中...');
    await this.phase1_dropCapsules(eligibleItems, canvas.width);
    await this.animationManager.sleep(2000);

    // フェーズ2: シャッフル（3秒）
    this.animationManager.updatePhysicsMessage('カプセルをシャッフル中...');
    await this.phase2_shuffle();
    await this.animationManager.sleep(3000);

    // フェーズ3: 抽出（2秒）
    this.animationManager.updatePhysicsMessage('当選カプセルを選出中...');
    const selectedCapsule = await this.phase3_extract();
    await this.animationManager.sleep(2000);

    // フェーズ4: 転がる（1.5秒）
    this.animationManager.updatePhysicsMessage('カプセルが転がっています...');
    await this.phase4_roll(selectedCapsule, canvas.width, canvas.height);
    await this.animationManager.sleep(1500);

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

    const ceiling = Bodies.rectangle(width / 2, 25, width, wallThickness, {
      isStatic: true,
      render: {
        fillStyle: '#4ECDC4',
        strokeStyle: '#ffffff',
        lineWidth: 2
      }
    });

    World.add(this.world, [ground, leftWall, rightWall, ceiling]);
  }

  // フェーズ1: カプセル投入
  async phase1_dropCapsules(items, canvasWidth) {
    const { Bodies, World } = Matter;
    this.capsules = [];

    const capsuleRadius = 30;
    const spacing = 80;
    const startX = (canvasWidth - items.length * spacing) / 2;

    items.forEach((item, index) => {
      const x = startX + index * spacing + spacing / 2;
      const y = -50 - index * 20; // 高さをずらして投入

      const capsule = Bodies.circle(x, y, capsuleRadius, {
        restitution: 0.6,
        friction: 0.05,
        density: 0.001,
        render: {
          fillStyle: item.color,
          strokeStyle: '#ffffff',
          lineWidth: 2
        }
      });

      capsule.itemData = item; // アイテムデータを紐付け
      this.capsules.push(capsule);
      World.add(this.world, capsule);
    });
  }

  // フェーズ2: シャッフル
  async phase2_shuffle() {
    const { Body } = Matter;

    // ランダムな力を加えてシャッフル
    for (let i = 0; i < 10; i++) {
      this.capsules.forEach(capsule => {
        const forceX = (Math.random() - 0.5) * 0.03;
        const forceY = (Math.random() - 0.5) * 0.02;
        Body.applyForce(capsule, capsule.position, { x: forceX, y: forceY });
      });
      await this.animationManager.sleep(300);
    }
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
