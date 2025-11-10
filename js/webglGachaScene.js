// webglGachaScene.js - Three.js + cannon-es based gacha animation
class WebGLGachaScene {
  constructor(animationManager) {
    this.animationManager = animationManager;
    this.overlay = null;
    this.statusEl = null;
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.clock = null;
    this.animationId = null;
    this.resizeHandler = null;
    this.world = null;
    this.capsules = [];
    this.handleMesh = null;
    this.baseGroup = null;
    this.winnerCapsule = null;
    this.frontWall = null;
    this.running = false;
  }

  async play(items) {
    if (typeof THREE === 'undefined' || typeof CANNON === 'undefined') {
      throw new Error('WebGL dependencies are not loaded');
    }
    this.setupOverlay();
    this.setupScene();
    this.setupPhysics();
    this.buildMachine();
    this.spawnCapsules(items);
    this.running = true;
    this.startLoop();

    this.setStatus('ハンドルを回しています...');
    await this.animateHandlePull();
    this.setStatus('カプセルをシャッフル中...');
    await this.shuffleCapsules();
    const winner = this.selectWinner();
    this.setStatus(`抽選中...「${winner.itemData.name}」をチェック`);
    await this.highlightWinner(winner);
    this.setStatus('カプセルを排出しています...');
    await this.launchWinner();
    this.setStatus('結果を表示します');
    await this.animationManager.sleep(800);

    this.running = false;
    this.teardown();
    return winner.itemData;
  }

  setupOverlay() {
    this.overlay = document.createElement('div');
    this.overlay.className = 'webgl-overlay';

    this.statusEl = document.createElement('div');
    this.statusEl.className = 'webgl-status';
    this.statusEl.textContent = '起動中...';

    this.overlay.appendChild(this.statusEl);
    document.body.appendChild(this.overlay);
  }

  setupScene() {
    this.renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.overlay.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x060613);
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    this.camera.position.set(0, 5, 14);
    this.camera.lookAt(0, 3, 0);

    const ambient = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambient);

    const keyLight = new THREE.SpotLight(0xfff0e0, 1.4, 0, Math.PI / 5, 0.3, 2);
    keyLight.position.set(6, 10, 6);
    keyLight.target.position.set(0, 2, 0);
    this.scene.add(keyLight);
    this.scene.add(keyLight.target);

    const rimLight = new THREE.SpotLight(0x80d9ff, 0.8, 0, Math.PI / 4, 0.4, 2);
    rimLight.position.set(-6, 9, -4);
    rimLight.target.position.set(0, 2, 0);
    this.scene.add(rimLight);
    this.scene.add(rimLight.target);

    this.clock = new THREE.Clock();
    this.handleResize();
    this.resizeHandler = () => this.handleResize();
    window.addEventListener('resize', this.resizeHandler);
  }

  setupPhysics() {
    this.world = new CANNON.World();
    this.world.gravity.set(0, -9.82, 0);
    this.world.broadphase = new CANNON.NaiveBroadphase();
    this.world.solver.iterations = 10;
    this.world.allowSleep = true;

    const groundShape = new CANNON.Box(new CANNON.Vec3(5, 0.5, 5));
    const ground = new CANNON.Body({ mass: 0, shape: groundShape });
    ground.position.set(0, -0.5, 0);
    this.world.addBody(ground);

    const wallHeight = 5;
    const backWall = new CANNON.Body({
      mass: 0,
      shape: new CANNON.Box(new CANNON.Vec3(5, wallHeight / 2, 0.3))
    });
    backWall.position.set(0, wallHeight / 2, -5);
    this.world.addBody(backWall);

    this.frontWall = new CANNON.Body({
      mass: 0,
      shape: new CANNON.Box(new CANNON.Vec3(5, wallHeight / 2, 0.3))
    });
    this.frontWall.position.set(0, wallHeight / 2, 5);
    this.world.addBody(this.frontWall);

    const leftWall = new CANNON.Body({
      mass: 0,
      shape: new CANNON.Box(new CANNON.Vec3(0.3, wallHeight / 2, 5))
    });
    leftWall.position.set(-5, wallHeight / 2, 0);
    this.world.addBody(leftWall);

    const rightWall = new CANNON.Body({
      mass: 0,
      shape: new CANNON.Box(new CANNON.Vec3(0.3, wallHeight / 2, 5))
    });
    rightWall.position.set(5, wallHeight / 2, 0);
    this.world.addBody(rightWall);
  }

  buildMachine() {
    this.baseGroup = new THREE.Group();
    const platformGeometry = new THREE.CylinderGeometry(6, 6, 1, 48);
    const platformMaterial = new THREE.MeshStandardMaterial({
      color: 0x242446,
      metalness: 0.4,
      roughness: 0.3
    });
    const base = new THREE.Mesh(platformGeometry, platformMaterial);
    base.position.y = -0.5;
    this.baseGroup.add(base);

    const glassGeometry = new THREE.SphereGeometry(5.2, 64, 64, 0, Math.PI * 2, 0, Math.PI / 1.2);
    const glassMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x88f0ff,
      emissive: 0x0,
      metalness: 0,
      roughness: 0,
      transmission: 0.9,
      thickness: 0.4,
      opacity: 0.35,
      transparent: true
    });
    const dome = new THREE.Mesh(glassGeometry, glassMaterial);
    dome.position.y = 2.5;
    this.baseGroup.add(dome);

    const outletGeometry = new THREE.BoxGeometry(2.5, 1, 1.5);
    const outletMaterial = new THREE.MeshStandardMaterial({
      color: 0xff6b6b,
      emissive: 0x120000,
      metalness: 0.5,
      roughness: 0.2
    });
    const outlet = new THREE.Mesh(outletGeometry, outletMaterial);
    outlet.position.set(0, 0.5, 5.5);
    this.baseGroup.add(outlet);

    const handleGeometry = new THREE.CylinderGeometry(0.15, 0.15, 3.5, 32);
    const handleMaterial = new THREE.MeshStandardMaterial({
      color: 0xfcd144,
      metalness: 0.8,
      roughness: 0.2
    });
    this.handleMesh = new THREE.Mesh(handleGeometry, handleMaterial);
    this.handleMesh.rotation.z = Math.PI / 2;
    this.handleMesh.position.set(5, 3.5, 0);
    this.baseGroup.add(this.handleMesh);

    const knobGeometry = new THREE.SphereGeometry(0.8, 32, 32);
    const knobMaterial = new THREE.MeshStandardMaterial({
      color: 0xff4e8b,
      metalness: 0.6,
      roughness: 0.3
    });
    const knob = new THREE.Mesh(knobGeometry, knobMaterial);
    knob.position.set(6.5, 3.5, 0);
    this.baseGroup.add(knob);

    this.scene.add(this.baseGroup);
  }

  spawnCapsules(items) {
    const radius = 0.45;
    const geometry = new THREE.SphereGeometry(radius, 32, 32);
    items.forEach((item, index) => {
      const color = item.color || '#4ECDC4';
      const material = new THREE.MeshStandardMaterial({
        color,
        emissive: 0x111111,
        metalness: 0.3,
        roughness: 0.35
      });
      const mesh = new THREE.Mesh(geometry, material);
      this.scene.add(mesh);

      const body = new CANNON.Body({
        mass: 0.35,
        shape: new CANNON.Sphere(radius),
        material: new CANNON.Material('capsule')
      });
      const angle = (index / items.length) * Math.PI * 2;
      body.position.set(Math.cos(angle) * 2, 3 + Math.random(), Math.sin(angle) * 2);
      body.linearDamping = 0.31;
      body.angularDamping = 0.3;
      body.itemData = item;
      this.world.addBody(body);

      this.capsules.push({ mesh, body, itemData: item });
    });
  }

  startLoop() {
    const step = () => {
      if (!this.running) return;
      const delta = Math.min(this.clock.getDelta(), 0.033);
      this.world.step(1 / 60, delta, 5);
      this.capsules.forEach(capsule => {
        const { mesh, body } = capsule;
        mesh.position.copy(body.position);
        mesh.quaternion.copy(body.quaternion);
      });
      this.renderer.render(this.scene, this.camera);
      this.animationId = requestAnimationFrame(step);
    };
    this.animationId = requestAnimationFrame(step);
  }

  async animateHandlePull() {
    await this.animateValue(0, Math.PI, 1100, value => {
      if (this.handleMesh) {
        this.handleMesh.rotation.y = value;
      }
    });
  }

  async shuffleCapsules() {
    for (let i = 0; i < 6; i++) {
      this.capsules.forEach(({ body }) => {
        const force = new CANNON.Vec3(
          (Math.random() - 0.5) * 6,
          Math.random() * 8,
          (Math.random() - 0.5) * 6
        );
        body.applyImpulse(force, body.position);
      });
      await this.animationManager.sleep(280);
    }
  }

  selectWinner() {
    const index = Math.floor(Math.random() * this.capsules.length);
    this.winnerCapsule = this.capsules[index];
    return this.winnerCapsule;
  }

  async highlightWinner(capsule) {
    capsule.mesh.material.emissive = new THREE.Color(0xffd700);
    capsule.mesh.material.color = new THREE.Color(0xfff3a0);
    await this.animationManager.sleep(1200);
  }

  async launchWinner() {
    if (!this.winnerCapsule) return;
    if (this.frontWall) {
      this.world.removeBody(this.frontWall);
      this.frontWall = null;
    }
    const { body } = this.winnerCapsule;
    body.mass = 1;
    body.updateMassProperties();
    body.applyImpulse(new CANNON.Vec3(0, 6, 18), body.position);

    await this.waitForCondition(() => body.position.z > 6.5 || body.position.y < -1, 5000);
  }

  async animateValue(from, to, duration, onUpdate) {
    const start = performance.now();
    return new Promise(resolve => {
      const tick = now => {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = progress < 0.5
          ? 2 * progress * progress
          : -1 + (4 - 2 * progress) * progress;
        onUpdate(from + (to - from) * eased);
        if (progress < 1) {
          requestAnimationFrame(tick);
        } else {
          resolve();
        }
      };
      requestAnimationFrame(tick);
    });
  }

  waitForCondition(predicate, timeout = 4000) {
    const start = performance.now();
    return new Promise((resolve, reject) => {
      const check = () => {
        if (predicate()) {
          resolve();
          return;
        }
        if (performance.now() - start > timeout) {
          resolve();
          return;
        }
        requestAnimationFrame(check);
      };
      check();
    });
  }

  setStatus(message) {
    if (this.statusEl) {
      this.statusEl.textContent = message;
    }
  }

  handleResize() {
    if (!this.renderer || !this.camera) return;
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.renderer.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  teardown() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    this.running = false;
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
      this.resizeHandler = null;
    }
    if (this.renderer) {
      this.renderer.dispose();
    }
    this.capsules.forEach(({ mesh }) => {
      if (mesh.parent) {
        mesh.parent.remove(mesh);
      }
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) mesh.material.dispose();
    });
    this.capsules = [];
    if (this.baseGroup) {
      this.scene.remove(this.baseGroup);
    }
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
  }
}

window.WebGLGachaScene = WebGLGachaScene;
