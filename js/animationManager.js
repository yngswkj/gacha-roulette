// animationManager.js - CSS/DOM アニメーション管理
class AnimationManager {
  constructor() {
    this.currentAnimation = null;
  }

  // 抽選実行中のオーバーレイを表示
  showPhysicsOverlay(container) {
    const overlay = document.createElement('div');
    overlay.id = 'physics-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.95);
      z-index: 9999;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    `;

    const canvas = document.createElement('canvas');
    canvas.id = 'physics-canvas';
    canvas.width = 1200;
    canvas.height = 800;
    canvas.style.cssText = `
      border: 4px solid var(--primary);
      border-radius: 16px;
      box-shadow: 0 0 40px rgba(255, 107, 107, 0.5);
      max-width: 90vw;
      max-height: 70vh;
    `;

    const message = document.createElement('div');
    message.id = 'physics-message';
    message.style.cssText = `
      font-size: 48px;
      color: var(--text-primary);
      margin-top: 30px;
      font-weight: bold;
      text-align: center;
    `;
    message.textContent = 'カプセルを投入中...';

    overlay.appendChild(canvas);
    overlay.appendChild(message);
    document.body.appendChild(overlay);

    return { overlay, canvas, message };
  }

  // オーバーレイを削除
  hidePhysicsOverlay() {
    const overlay = document.getElementById('physics-overlay');
    if (overlay) {
      overlay.remove();
    }
  }

  // メッセージを更新
  updatePhysicsMessage(text) {
    const message = document.getElementById('physics-message');
    if (message) {
      message.textContent = text;
    }
  }

  // カプセル開封アニメーション（DOM要素）
  async animateCapsuleOpen(capsuleElement, itemName, color) {
    return new Promise((resolve) => {
      capsuleElement.style.background = color;
      capsuleElement.style.animation = 'capsule-shake 0.5s ease-in-out 3';

      setTimeout(() => {
        capsuleElement.style.animation = 'capsule-open 0.8s ease-out forwards';
        setTimeout(() => {
          resolve();
        }, 800);
      }, 1500);
    });
  }

  // 結果表示のフェードイン
  async fadeInResult(element) {
    return new Promise((resolve) => {
      element.style.opacity = '0';
      element.style.transform = 'scale(0.8)';

      setTimeout(() => {
        element.style.transition = 'all 0.6s ease-out';
        element.style.opacity = '1';
        element.style.transform = 'scale(1)';
        setTimeout(resolve, 600);
      }, 100);
    });
  }

  // パーティクルエフェクト（紙吹雪）
  createConfetti() {
    const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#95E1D3', '#FFE66D'];
    const confettiCount = 50;

    for (let i = 0; i < confettiCount; i++) {
      const confetti = document.createElement('div');
      confetti.style.cssText = `
        position: fixed;
        width: 10px;
        height: 10px;
        background: ${colors[Math.floor(Math.random() * colors.length)]};
        top: -10px;
        left: ${Math.random() * 100}vw;
        opacity: 1;
        transform: rotate(${Math.random() * 360}deg);
        pointer-events: none;
        z-index: 10000;
      `;

      document.body.appendChild(confetti);

      const duration = 2000 + Math.random() * 1000;
      const endY = window.innerHeight + 20;
      const endX = parseFloat(confetti.style.left) + (Math.random() - 0.5) * 200;

      confetti.animate([
        { transform: 'translateY(0) rotate(0deg)', opacity: 1 },
        { transform: `translateY(${endY}px) translateX(${endX - parseFloat(confetti.style.left)}px) rotate(${360 + Math.random() * 360}deg)`, opacity: 0 }
      ], {
        duration: duration,
        easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'
      }).onfinish = () => confetti.remove();
    }
  }

  // 画面シェイク
  shakeScreen() {
    document.body.style.animation = 'screen-shake 0.5s ease-in-out';
    setTimeout(() => {
      document.body.style.animation = '';
    }, 500);
  }

  // スリープユーティリティ
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
