// lottery.js - 抽選機能（簡易版）
class SimpleLottery {
  constructor(uiController) {
    this.ui = uiController;
    this.isRunning = false;
  }

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
      // 抽選中状態に
      this.ui.setLotteryState('running');

      // 抽選演出（3秒）
      await this.playAnimation();

      // ランダムに当選項目を選出
      const winner = eligibleItems[Math.floor(Math.random() * eligibleItems.length)];

      // 結果画面を表示
      this.ui.showResult(winner);

      this.isRunning = false;

    } catch (error) {
      console.error('Lottery error:', error);
      this.ui.toast('抽選中にエラーが発生しました', 'error');
      this.ui.switchTab('manage');
      this.isRunning = false;
    }
  }

  async playAnimation() {
    const messages = [
      '抽選しています...',
      'カプセルをシャッフル中...',
      '当選項目を選出中...',
      '結果を表示します！'
    ];

    const messageElement = document.getElementById('lottery-message');

    for (let i = 0; i < messages.length; i++) {
      messageElement.textContent = messages[i];
      await this.sleep(800);
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
