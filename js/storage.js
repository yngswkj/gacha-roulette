// storage.js - LocalStorage管理サービス

class StorageService {
  constructor() {
    this.STORAGE_KEY = 'gacha_items_v1';
    this.SCHEMA_VERSION = '1.0';
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
    return [
      {
        id: this.generateId(),
        name: '営業部',
        isWinner: false,
        color: '#FF6B6B',
        createdAt: now,
        updatedAt: now
      },
      {
        id: this.generateId(),
        name: '開発部',
        isWinner: false,
        color: '#4ECDC4',
        createdAt: now,
        updatedAt: now
      },
      {
        id: this.generateId(),
        name: '企画部',
        isWinner: false,
        color: '#95E1D3',
        createdAt: now,
        updatedAt: now
      },
      {
        id: this.generateId(),
        name: '人事部',
        isWinner: false,
        color: '#FFE66D',
        createdAt: now,
        updatedAt: now
      },
      {
        id: this.generateId(),
        name: '総務部',
        isWinner: false,
        color: '#C77DFF',
        createdAt: now,
        updatedAt: now
      }
    ];
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
