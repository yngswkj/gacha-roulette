// itemManager.js - 項目管理ロジック

class ItemManager {
  constructor(storage) {
    this.storage = storage;
    this.items = storage.loadItems();
    this.eventListeners = new Map();

    this.COLOR_PALETTE = [
      '#FF6B6B', '#4ECDC4', '#95E1D3', '#FFE66D', '#C77DFF',
      '#FF8C94', '#A8E6CF', '#FFD3B6', '#FFAAA5', '#B4A7D6'
    ];
  }

  getAllItems() {
    return [...this.items];
  }

  addItem(name, color = null) {
    if (!name || name.trim().length === 0) throw new Error('項目名を入力してください');
    if (name.length > 50) throw new Error('項目名は50文字以内で入力してください');
    if (this.items.some(t => t.name === name.trim())) throw new Error('その項目名は既に存在します');
    if (this.items.length >= this.storage.MAX_ITEMS) throw new Error(`項目は最大${this.storage.MAX_ITEMS}個までです`);

    const newItem = {
      id: this.storage.generateId(),
      name: name.trim(),
      isWinner: false,
      color: color || this.generateRandomColor(),
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    this.items.push(newItem);
    this.persist();
    this.emit('itemAdded', newItem);
    return newItem;
  }

  updateItem(id, updates) {
    const index = this.items.findIndex(t => t.id === id);
    if (index === -1) throw new Error('項目が見つかりません');

    const item = this.items[index];
    if (updates.name && updates.name !== item.name) {
      if (this.items.some(t => t.id !== id && t.name === updates.name.trim())) {
        throw new Error('その項目名は既に存在します');
      }
    }

    const updatedItem = { ...item, ...updates, id: item.id, createdAt: item.createdAt, updatedAt: Date.now() };
    this.items[index] = updatedItem;
    this.persist();
    this.emit('itemUpdated', updatedItem);
    return updatedItem;
  }

  deleteItem(id) {
    const index = this.items.findIndex(t => t.id === id);
    if (index === -1) return false;

    const deletedItem = this.items[index];
    this.items.splice(index, 1);
    this.persist();
    this.emit('itemDeleted', deletedItem);
    return true;
  }

  getEligibleItems() {
    return this.items.filter(t => !t.isWinner);
  }

  markAsWinner(id) {
    return this.updateItem(id, { isWinner: true });
  }

  resetAllItems() {
    this.items = this.items.map(item => ({ ...item, isWinner: false, updatedAt: Date.now() }));
    this.persist();
    this.emit('allItemsReset');
    return true;
  }

  generateRandomColor() {
    const usedColors = new Set(this.items.map(t => t.color));
    const availableColors = this.COLOR_PALETTE.filter(c => !usedColors.has(c));
    if (availableColors.length > 0) {
      return availableColors[Math.floor(Math.random() * availableColors.length)];
    }
    return '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
  }

  persist() {
    this.storage.saveItems(this.items);
  }

  on(event, callback) {
    if (!this.eventListeners.has(event)) this.eventListeners.set(event, []);
    this.eventListeners.get(event).push(callback);
  }

  emit(event, data) {
    const listeners = this.eventListeners.get(event);
    if (listeners) listeners.forEach(callback => callback(data));
  }
}
