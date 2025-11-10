// storage.js - LocalStorage管理サービス

class StorageService {
  constructor() {
    this.STORAGE_KEY = 'gacha_items_v1';
    this.SCHEMA_VERSION = '2.0'; // 30個テンプレート対応
    this.MAX_ITEMS = 50;

    this.validateBrowserSupport();
  }

  /**
   * ブラウザのLocalStorageサポートを確認
   */
  validateBrowserSupport() {
    if (!window.localStorage) {
      throw new Error('LocalStorage is not supported');
    }
  }

  /**
   * 項目データを保存
   * @param {Array} items - 項目配列
   * @returns {boolean} 成功/失敗
   */
  saveItems(items) {
    try {
      // バリデーション
      if (!Array.isArray(items)) {
        throw new Error('Items must be an array');
      }

      if (items.length > this.MAX_ITEMS) {
        throw new Error(`Maximum ${this.MAX_ITEMS} items allowed`);
      }

      const data = {
        version: this.SCHEMA_VERSION,
        items: items.map(item => ({
          ...item,
          updatedAt: Date.now()
        })),
        lastModified: Date.now()
      };

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch (error) {
      console.error('Failed to save items:', error);
      return false;
    }
  }

  /**
   * 項目データを読み込み
   * @returns {Array} 項目配列
   */
  loadItems() {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);

      if (!data) {
        return this.getDefaultItems();
      }

      const parsed = JSON.parse(data);

      // バージョンチェック
      if (parsed.version !== this.SCHEMA_VERSION) {
        console.warn('Schema version mismatch, using default items');
        return this.getDefaultItems();
      }

      return parsed.items || [];
    } catch (error) {
      console.error('Failed to load items:', error);
      return this.getDefaultItems();
    }
  }

  /**
   * デフォルト項目を取得
   * @returns {Array} デフォルト項目配列
   */
  getDefaultItems() {
    const now = Date.now();
    const colors = [
      '#FF6B6B', '#4ECDC4', '#95E1D3', '#FFE66D', '#C77DFF',
      '#FF8C94', '#A8E6CF', '#FFD3B6', '#FFAAA5', '#B4A7D6'
    ];

    // 30個のランダムな項目名候補
    const nameTemplates = [
      '営業部', '開発部', '企画部', '人事部', '総務部',
      'マーケティング部', '経理部', '法務部', '広報部', 'デザイン部',
      'チームA', 'チームB', 'チームC', 'チームD', 'チームE',
      'プロジェクトα', 'プロジェクトβ', 'プロジェクトγ', 'プロジェクトδ', 'プロジェクトε',
      '選択肢1', '選択肢2', '選択肢3', '選択肢4', '選択肢5',
      'オプションA', 'オプションB', 'オプションC', 'オプションD', 'オプションE'
    ];

    // 配列をシャッフルして30個取得
    const shuffled = [...nameTemplates].sort(() => Math.random() - 0.5);

    return shuffled.map((name, index) => ({
      id: this.generateId(),
      name: name,
      isWinner: false,
      color: colors[index % colors.length],
      createdAt: now,
      updatedAt: now
    }));
  }

  /**
   * 全データをクリア
   * @returns {boolean} 成功/失敗
   */
  clearAll() {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
      return true;
    } catch (error) {
      console.error('Failed to clear data:', error);
      return false;
    }
  }

  /**
   * UUID v4を生成
   * @returns {string} UUID
   */
  generateId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * データのエクスポート（JSON文字列）
   * @returns {string} JSON文字列
   */
  exportData() {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      return data || JSON.stringify({ items: [] });
    } catch (error) {
      console.error('Failed to export data:', error);
      return null;
    }
  }

  /**
   * データのインポート
   * @param {string} jsonData - JSON文字列
   * @returns {boolean} 成功/失敗
   */
  importData(jsonData) {
    try {
      const data = JSON.parse(jsonData);

      if (!data.items || !Array.isArray(data.items)) {
        throw new Error('Invalid data format');
      }

      localStorage.setItem(this.STORAGE_KEY, jsonData);
      return true;
    } catch (error) {
      console.error('Failed to import data:', error);
      return false;
    }
  }
}
