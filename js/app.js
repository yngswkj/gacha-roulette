// app.js - メインアプリケーション
class GachaApp {
  constructor() {
    this.storage = null;
    this.itemManager = null;
    this.uiController = null;
    this.lottery = null;
  }

  async initialize() {
    try {
      console.log('Initializing Gacha App...');

      // サービス初期化
      this.storage = new StorageService();
      this.itemManager = new ItemManager(this.storage);
      this.uiController = new UIController(this.itemManager);

      // 抽選機能初期化（物理エンジン版を使用）
      this.lottery = new GachaPhysicsEngine(this.uiController);
      this.uiController.lottery = this.lottery;

      // 初回レンダリング
      this.uiController.renderItems();

      console.log('App initialized successfully!');
      console.log(`Total items: ${this.itemManager.getAllItems().length}`);
      console.log(`Eligible items: ${this.itemManager.getEligibleItems().length}`);

      // デバッグ用にグローバルに公開
      window.gachaApp = this;

    } catch (error) {
      console.error('Failed to initialize app:', error);
      alert('アプリケーションの初期化に失敗しました: ' + error.message);
    }
  }

  debug() {
    console.log('=== Gacha App Debug Info ===');
    console.log('Items:', this.itemManager.getAllItems());
    console.log('Eligible items:', this.itemManager.getEligibleItems());
    console.log('Current tab:', this.uiController.currentTab);
    console.log('Storage data:', this.storage.exportData());
  }

  resetData() {
    if (confirm('全てのデータを削除してデフォルトに戻しますか?')) {
      this.storage.clearAll();
      window.location.reload();
    }
  }
}

// アプリケーション起動
document.addEventListener('DOMContentLoaded', () => {
  const app = new GachaApp();
  app.initialize();
});
