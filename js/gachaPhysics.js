// gachaPhysics.js - WebGL based lottery orchestrator
class GachaPhysicsEngine {
  constructor(uiController) {
    this.ui = uiController;
    this.animationManager = new AnimationManager();
    this.scene = null;
    this.isRunning = false;
  }

  async start(eligibleItems) {
    if (this.isRunning) {
      this.ui.toast('抽選は既に進行中です', 'warning');
      return;
    }

    if (!eligibleItems || eligibleItems.length === 0) {
      this.ui.toast('抽選対象がありません', 'error');
      return;
    }

    this.isRunning = true;

    try {
      this.scene = new WebGLGachaScene(this.animationManager);
      const winner = await this.scene.play(eligibleItems);
      this.scene = null;

      this.ui.showResult(winner);
      this.animationManager.createConfetti();
    } catch (error) {
      console.error('WebGL lottery error:', error);
      if (this.scene) {
        this.scene.teardown();
        this.scene = null;
      }
      this.ui.toast('3D抽選の描画に失敗しました', 'error');
      this.ui.switchTab('manage');
    } finally {
      this.isRunning = false;
    }
  }
}
