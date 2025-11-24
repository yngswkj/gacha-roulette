// uiController.js - UI制御とタブ管理
class UIController {
  constructor(itemManager) {
    this.itemManager = itemManager;
    this.currentTab = 'manage';
    this.lottery = null;
    this.init();
  }

  init() {
    // タブ切替
    document.querySelectorAll('.tab-button').forEach(btn => {
      btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
    });

    // 管理タブ
    document.getElementById('add-item-btn').addEventListener('click', () => this.addItem());
    document.getElementById('delete-all-btn').addEventListener('click', () => this.deleteAll());
    document.getElementById('reset-all-btn').addEventListener('click', () => this.resetAll());
    document.getElementById('items-grid').addEventListener('click', (e) => this.handleCardAction(e));

    // 確認タブ
    document.getElementById('goto-lottery-btn').addEventListener('click', () => this.switchTab('lottery'));

    // 抽選タブ
    document.getElementById('start-lottery-btn').addEventListener('click', () => this.startLottery());
    document.getElementById('back-to-manage-btn').addEventListener('click', () => this.switchTab('manage'));
    document.getElementById('lottery-again-btn').addEventListener('click', () => this.lotteryAgain());

    // 履歴モーダル
    document.getElementById('show-history-btn').addEventListener('click', () => this.showHistory());
    document.getElementById('close-history-btn').addEventListener('click', () => this.closeHistory());
    document.getElementById('history-modal').addEventListener('click', (e) => {
      if (e.target.id === 'history-modal') this.closeHistory();
    });

    // 設定モーダル
    this.settingsBtn = document.getElementById('settings-btn');
    this.settingsModal = document.getElementById('settings-modal');
    this.closeSettingsBtn = document.getElementById('close-settings-btn');
    this.speedSlider = document.getElementById('speed-slider');
    this.frictionSlider = document.getElementById('friction-slider');
    this.speedValue = document.getElementById('speed-value');
    this.frictionValue = document.getElementById('friction-value');

    if (this.settingsBtn) {
      this.settingsBtn.addEventListener('click', () => this.showSettings());
      this.closeSettingsBtn.addEventListener('click', () => this.closeSettings());
      this.settingsModal.addEventListener('click', (e) => {
        if (e.target === this.settingsModal) this.closeSettings();
      });

      this.speedSlider.addEventListener('input', (e) => {
        this.speedValue.textContent = e.target.value;
        this.saveSettings();
      });

      this.frictionSlider.addEventListener('input', (e) => {
        this.frictionValue.textContent = e.target.value;
        this.saveSettings();
      });
    }

    // スキップボタン
    document.getElementById('skip-animation-btn').addEventListener('click', () => {
      if (this.lottery && typeof this.lottery.skip === 'function') {
        this.lottery.skip();
      }
    });

    // イベント
    ['itemAdded', 'itemUpdated', 'itemDeleted', 'allItemsReset', 'allItemsDeleted'].forEach(event => {
      this.itemManager.on(event, () => this.renderItems());
    });

    this.loadSettings();
  }

  loadSettings() {
    const savedSettings = localStorage.getItem('gacha_settings');
    const settings = savedSettings ? JSON.parse(savedSettings) : { speed: 8.0, friction: 0.1 };

    if (this.speedSlider) {
      this.speedSlider.value = settings.speed;
      this.frictionSlider.value = settings.friction;
      this.speedValue.textContent = settings.speed;
      this.frictionValue.textContent = settings.friction;
    }

    // Apply initial settings if lottery engine is ready
    // We might need to wait for lottery to be initialized in app.js
    // app.js sets uiController.lottery AFTER uiController init.
    // So we can't set it here immediately if lottery is null.
    // But saveSettings will work later.
  }

  saveSettings() {
    const settings = {
      speed: parseFloat(this.speedSlider.value),
      friction: parseFloat(this.frictionSlider.value)
    };
    localStorage.setItem('gacha_settings', JSON.stringify(settings));

    if (this.lottery && this.lottery.scene) {
      this.lottery.scene.setParameters(settings);
    }
  }

  showSettings() {
    this.settingsModal.classList.add('active');
  }

  closeSettings() {
    this.settingsModal.classList.remove('active');
  }

  showHistory() {
    const winners = this.itemManager.getAllItems().filter(item => item.isWinner).sort((a, b) => b.updatedAt - a.updatedAt);
    const list = document.getElementById('history-list');

    if (winners.length === 0) {
      list.innerHTML = '<p style="text-align:center;color:var(--color-text-secondary)">当選履歴がありません</p>';
    } else {
      list.innerHTML = winners.map(item => `
        <div class="history-item">
          <div class="capsule-preview" style="background-color:${item.color};width:32px;height:32px;"></div>
          <div class="history-info">
            <div class="history-name">${this.escape(item.name)}</div>
            <div class="history-date">${new Date(item.updatedAt).toLocaleString()}</div>
          </div>
        </div>
      `).join('');
    }

    document.getElementById('history-modal').classList.add('active');
  }

  closeHistory() {
    document.getElementById('history-modal').classList.remove('active');
  }

  switchTab(tab) {
    document.querySelectorAll('.tab-button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById(`${tab}-tab`).classList.add('active');
    this.currentTab = tab;

    if (tab === 'confirm') this.renderEligible();
    if (tab === 'lottery') this.setLotteryState('ready');
  }

  renderItems() {
    const items = this.itemManager.getAllItems();
    const grid = document.getElementById('items-grid');

    if (items.length === 0) {
      grid.innerHTML = '<p style="font-size:28px;text-align:center;color:var(--color-text-secondary);grid-column:1/-1">項目が登録されていません</p>';
    } else {
      grid.innerHTML = items.map(item => `
        <div class="item-card ${item.isWinner ? 'winner' : ''}" data-item-id="${item.id}">
          <div class="item-card-header">
            <div class="capsule-preview" style="background-color:${item.color}"></div>
            <span class="item-status status-${item.isWinner ? 'winner' : 'eligible'}">${item.isWinner ? '抽選済み' : '未抽選'}</span>
          </div>
          <div class="item-card-body">
            <h3 class="item-name">${this.escape(item.name)}</h3>
          </div>
          <div class="item-card-actions">
            <button class="btn-icon" data-action="edit">✏️</button>
            <button class="btn-icon" data-action="toggle">🔄</button>
            <button class="btn-icon" data-action="delete">🗑️</button>
          </div>
        </div>
      `).join('');
    }
    this.updateStats();
  }

  renderEligible() {
    const eligible = this.itemManager.getEligibleItems();
    document.getElementById('confirm-eligible-count').textContent = eligible.length;

    const list = document.getElementById('eligible-items-list');
    if (eligible.length === 0) {
      list.innerHTML = '<p style="font-size:32px;text-align:center;color:var(--color-text-secondary)">未抽選の項目がありません</p>';
      document.getElementById('goto-lottery-btn').disabled = true;
    } else {
      list.innerHTML = eligible.map(item => `
        <div class="eligible-item">
          <div class="capsule-preview" style="background-color:${item.color}"></div>
          <span class="item-name">${this.escape(item.name)}</span>
        </div>
      `).join('');
      document.getElementById('goto-lottery-btn').disabled = false;
    }
  }

  handleCardAction(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    const id = btn.closest('.item-card').dataset.itemId;
    const action = btn.dataset.action;

    if (action === 'edit') {
      const item = this.itemManager.getAllItems().find(i => i.id === id);
      const name = prompt('新しい項目名:', item.name);
      if (name && name !== item.name) {
        try { this.itemManager.updateItem(id, { name }); this.toast('更新しました', 'success'); }
        catch (e) { this.toast(e.message, 'error'); }
      }
    } else if (action === 'toggle') {
      const item = this.itemManager.getAllItems().find(i => i.id === id);
      this.itemManager.updateItem(id, { isWinner: !item.isWinner });
    } else if (action === 'delete') {
      if (confirm('削除しますか?')) {
        this.itemManager.deleteItem(id);
        this.toast('削除しました', 'success');
      }
    }
  }

  addItem() {
    const name = prompt('項目名を入力:');
    if (!name) return;
    try { this.itemManager.addItem(name); this.toast('追加しました', 'success'); }
    catch (e) { this.toast(e.message, 'error'); }
  }

  deleteAll() {
    if (confirm('本当に全項目を削除しますか?\nこの操作は取り消せません。')) {
      this.itemManager.deleteAllItems();
      this.toast('全項目を削除しました', 'success');
    }
  }

  resetAll() {
    if (confirm('全項目をリセット しますか?')) {
      this.itemManager.resetAllItems();
      this.toast('リセットしました', 'success');
    }
  }

  startLottery() {
    const eligible = this.itemManager.getEligibleItems();

    if (eligible.length === 0) {
      this.toast('未抽選の項目がありません', 'error');
      return;
    }

    if (this.lottery) {
      this.lottery.start(eligible);
      // Apply settings just in case
      this.saveSettings();
    } else {
      console.error('[ERROR] this.lottery is null or undefined!');
    }
  }

  lotteryAgain() {
    const eligible = this.itemManager.getEligibleItems();
    if (eligible.length === 0) {
      this.toast('未抽選の項目がありません', 'error');
      this.switchTab('manage');
    } else {
      this.setLotteryState('ready');
    }
  }

  setLotteryState(state) {
    document.querySelectorAll('.lottery-state').forEach(el => el.classList.remove('active'));
    document.getElementById(`lottery-${state}`).classList.add('active');

    if (state === 'ready') {
      const eligible = this.itemManager.getEligibleItems();
      document.getElementById('lottery-eligible-count').textContent = eligible.length;
      document.getElementById('start-lottery-btn').disabled = eligible.length === 0;
    }
  }

  showResult(winner) {
    this.setLotteryState('result');
    document.getElementById('result-capsule').style.backgroundColor = winner.color;
    document.getElementById('winner-name').textContent = winner.name;
    this.itemManager.markAsWinner(winner.id);
  }

  updateStats() {
    const items = this.itemManager.getAllItems();
    const eligible = this.itemManager.getEligibleItems();
    document.getElementById('total-count').textContent = items.length;
    document.getElementById('eligible-count').textContent = eligible.length;
  }

  toast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.getElementById('toast-container').appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 3000);
  }

  escape(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
