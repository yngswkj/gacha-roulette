// gacha3DMachine.js - 3Dガチャマシンアニメーション制御

class Gacha3DMachine {
  constructor(animationManager, physicsEngine) {
    this.animationManager = animationManager;
    this.physics = physicsEngine;
    this.sceneElements = null;
    this.winner = null;
  }

  /**
   * 3Dガチャマシンアニメーション全体を実行
   * @param {Array} eligibleItems - 抽選対象項目
   * @returns {Object} 当選項目
   */
  async start(eligibleItems) {
    if (!eligibleItems || eligibleItems.length === 0) {
      throw new Error('No eligible items for lottery');
    }

    try {
      // 3Dシーンを生成
      this.sceneElements = this.animationManager.show3DGachaScene();

      // DOMレンダリングを待つ
      await this.animationManager.sleep(100);

      // フェーズ0: 機械出現（1.5秒 - CSS animation）
      await this.phase0_machineAppear();

      // フェーズ1: ハンドル回転（3秒）
      await this.phase1_turnHandle();

      // フェーズ2: ドーム内シャッフル（5秒）
      await this.phase2_domeShuffle(eligibleItems);

      // フェーズ3: カプセル落下（2秒）
      await this.phase3_capsuleDrop();

      // フェーズ4: カプセル開封（3秒）
      await this.phase4_capsuleOpen();

      return this.winner;

    } catch (error) {
      console.error('3D Gacha Machine error:', error);
      throw error;
    }
  }

  /**
   * フェーズ0: 機械出現アニメーション
   */
  async phase0_machineAppear() {
    this.animationManager.update3DMessage('ガチャマシンが起動しています...');
    // CSS animation (machine-appear) が自動で実行される
    await this.animationManager.sleep(1500);
  }

  /**
   * フェーズ1: ハンドル回転（3回転）
   */
  async phase1_turnHandle() {
    this.animationManager.update3DMessage('ハンドルを回しています...');

    const handle = this.sceneElements.handle;
    handle.classList.add('turning');

    // 回転開始から0.5秒後に機械をシェイク
    await this.animationManager.sleep(500);
    this.sceneElements.machine.classList.add('shaking');

    // 残り2.5秒待つ
    await this.animationManager.sleep(2500);

    // シェイク停止
    this.sceneElements.machine.classList.remove('shaking');
    handle.classList.remove('turning');
  }

  /**
   * フェーズ2: ドーム内シャッフル（Matter.js使用）
   */
  async phase2_domeShuffle(eligibleItems) {
    this.animationManager.update3DMessage('カプセルをシャッフル中...');

    // ドーム内のキャンバスを取得
    const canvas = this.sceneElements.domeCanvas;

    // 物理エンジンを初期化
    this.physics.initEngine(canvas);

    // 小さなコンテナを作成（ドーム内部サイズ）
    this.createDomeContainer(canvas.width, canvas.height);

    // カプセル投入
    await this.dropCapsulesInDome(eligibleItems, canvas.width, canvas.height);
    await this.animationManager.sleep(1000);

    // 激しいシャッフル（3段階）
    await this.shuffleInDome();

    // ランダムに1つ選出
    this.winner = eligibleItems[Math.floor(Math.random() * eligibleItems.length)];
    const selectedCapsule = this.physics.capsules.find(
      cap => cap.itemData.id === this.winner.id
    );

    if (selectedCapsule) {
      // 選ばれたカプセルを光らせる
      selectedCapsule.render.fillStyle = '#FFD700';
      selectedCapsule.render.lineWidth = 4;

      // 他のカプセルを透明に
      this.physics.capsules.forEach(cap => {
        if (cap !== selectedCapsule) {
          cap.render.opacity = 0.3;
        }
      });

      await this.animationManager.sleep(1500);
    }

    // 物理エンジン停止
    this.physics.cleanup();
  }

  /**
   * ドーム用の小さなコンテナを作成
   */
  createDomeContainer(width, height) {
    const { Bodies, World } = Matter;
    const wallThickness = 30;

    // 円形コンテナ（近似）
    const ground = Bodies.rectangle(width / 2, height - 15, width * 0.9, wallThickness, {
      isStatic: true,
      render: { fillStyle: 'transparent' }
    });

    const leftWall = Bodies.rectangle(width * 0.1, height / 2, wallThickness, height * 0.8, {
      isStatic: true,
      render: { fillStyle: 'transparent' }
    });

    const rightWall = Bodies.rectangle(width * 0.9, height / 2, wallThickness, height * 0.8, {
      isStatic: true,
      render: { fillStyle: 'transparent' }
    });

    World.add(this.physics.world, [ground, leftWall, rightWall]);
  }

  /**
   * ドーム内にカプセルを投入
   */
  async dropCapsulesInDome(items, canvasWidth, canvasHeight) {
    const { Bodies, World } = Matter;
    this.physics.capsules = [];

    // ドームサイズに合わせた小さなカプセル
    const capsuleRadius = Math.min(canvasWidth, canvasHeight) * 0.08;

    const cols = Math.ceil(Math.sqrt(items.length));
    const spacing = capsuleRadius * 2.2;
    const totalWidth = cols * spacing;
    const startX = (canvasWidth - totalWidth) / 2 + spacing / 2;

    items.forEach((item, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const x = startX + col * spacing + (Math.random() - 0.5) * 10;
      const y = 50 + row * spacing + (Math.random() - 0.5) * 10;

      const capsule = Bodies.circle(x, y, capsuleRadius, {
        restitution: 0.7,
        friction: 0.05,
        density: 0.002,
        render: {
          fillStyle: item.color,
          strokeStyle: '#ffffff',
          lineWidth: 2
        }
      });

      capsule.itemData = item;
      this.physics.capsules.push(capsule);
      World.add(this.physics.world, capsule);
    });
  }

  /**
   * ドーム内でシャッフル（簡略版）
   */
  async shuffleInDome() {
    const { Body } = Matter;

    // 激しい振動（3回）
    for (let i = 0; i < 3; i++) {
      this.physics.capsules.forEach(capsule => {
        const forceY = -0.1;
        const forceX = (Math.random() - 0.5) * 0.08;
        Body.applyForce(capsule, capsule.position, { x: forceX, y: forceY });
      });
      await this.animationManager.sleep(300);
    }

    // 左右の波（4回）
    for (let i = 0; i < 4; i++) {
      const direction = i % 2 === 0 ? 1 : -1;
      this.physics.capsules.forEach(capsule => {
        const forceX = direction * 0.08;
        Body.applyForce(capsule, capsule.position, { x: forceX, y: 0 });
      });
      await this.animationManager.sleep(250);
    }

    // 落ち着く時間
    await this.animationManager.sleep(800);
  }

  /**
   * フェーズ3: カプセル落下
   */
  async phase3_capsuleDrop() {
    this.animationManager.update3DMessage('当選カプセルが出ます！');

    // DOM要素として当選カプセルを作成
    const capsuleElement = document.createElement('div');
    capsuleElement.className = 'winning-capsule';
    capsuleElement.style.backgroundColor = this.winner.color;

    this.sceneElements.container.appendChild(capsuleElement);

    // CSS animation（capsule-drop）が自動で実行される
    await this.animationManager.sleep(2000);
  }

  /**
   * フェーズ4: カプセル開封
   */
  async phase4_capsuleOpen() {
    this.animationManager.update3DMessage('カプセルを開封中...');

    const capsuleElement = this.sceneElements.container.querySelector('.winning-capsule');
    capsuleElement.classList.add('opening');

    await this.animationManager.sleep(1500);

    // 項目名を表示
    const nameElement = document.createElement('div');
    nameElement.className = 'capsule-item-name';
    nameElement.textContent = this.winner.name;
    this.sceneElements.container.appendChild(nameElement);

    // フェードイン
    await this.animationManager.sleep(100);
    nameElement.classList.add('show');

    await this.animationManager.sleep(2000);
  }

  /**
   * クリーンアップ
   */
  cleanup() {
    if (this.physics) {
      this.physics.cleanup();
    }
    this.sceneElements = null;
    this.winner = null;
  }
}
