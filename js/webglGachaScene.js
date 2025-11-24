// webglGachaScene.js - High-fidelity Three.js + cannon-es based gacha animation
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
    this.drumBody = null;
    this.drumMesh = null;
    this.gateBody = null; // Physics gate
    this.winnerCapsule = null;
    this.running = false;
    this.skipping = false;
    this.particles = [];
    this.drumAngle = 0;
    this.targetSpeed = 0;
    this.currentSpeed = 0;
    this.isEjecting = false;
    this.innerLight = null;
    this.params = {
      speed: 8.0,
      friction: 0.1
    };
  }

  setParameters(params) {
    this.params = { ...this.params, ...params };
    if (this.world) {
      this.updatePhysicsMaterial();
    }
    // If currently rotating at high speed (not ejecting, not stopped), update target speed immediately
    if (this.running && !this.isEjecting && this.targetSpeed > 2.0) {
      this.targetSpeed = this.params.speed;
    }
  }

  updatePhysicsMaterial() {
    if (!this.world) return;

    // Update contact material friction
    // We need to find the contact material between wall and capsule
    // In setupPhysics we added it. We can iterate or store a reference.
    // For simplicity, let's just update all contact materials or rebuild if needed.
    // Cannon.js allows updating material properties on the fly.

    const contactMat = this.world.contactmaterials[0]; // We only have one
    if (contactMat) {
      contactMat.friction = this.params.friction;
    }
  }

  skip() {
    this.skipping = true;
  }

  async play(items) {
    if (typeof THREE === 'undefined' || typeof CANNON === 'undefined') {
      throw new Error('WebGL dependencies are not loaded');
    }
    this.skipping = false;
    this.winnerCapsule = null;
    this.isEjecting = false;
    this.drumAngle = 0;
    this.currentSpeed = 0;
    this.targetSpeed = 0;

    this.setupOverlay();
    this.setupScene();
    this.setupPhysics();
    this.buildMachine();
    this.spawnCapsules(items);
    this.running = true;
    this.startLoop();

    // Phase 1: Start Rotation
    this.setStatus('抽選を開始します...');
    await this.wait(500);

    this.setStatus('回しています...');
    this.targetSpeed = this.params.speed; // Use param

    // Mix for a while
    await this.wait(2500);

    // Phase 2: Slow down and Open Gate
    if (!this.skipping) {
      this.setStatus('カプセルを選出中...');
      this.targetSpeed = 2.0;
      this.isEjecting = true;

      // Open the gate to let one fall
      this.openGate();

      // Wait for a winner
      const winner = await this.waitForWinner();
      this.winnerCapsule = winner;
    } else {
      this.winnerCapsule = this.capsules[Math.floor(Math.random() * this.capsules.length)];
    }

    // Phase 3: Result
    this.targetSpeed = 0;
    this.setStatus(`当選: ${this.winnerCapsule.itemData.name}`);

    if (!this.skipping) {
      await this.highlightWinner(this.winnerCapsule);
    }

    this.spawnConfetti(this.winnerCapsule.mesh.position);
    await this.wait(1000);

    this.running = false;
    this.teardown();
    return this.winnerCapsule.itemData;
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
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2; // Brighter
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.overlay.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    // Brighter, more vibrant background
    this.scene.background = new THREE.Color(0x1a1a2e);
    this.scene.fog = new THREE.FogExp2(0x1a1a2e, 0.015);

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    this.camera.position.set(0, 5, 18);
    this.camera.lookAt(0, 0, 0);

    // --- Lighting Setup ---
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambient);

    const spotLight = new THREE.SpotLight(0xfff0dd, 1.5);
    spotLight.position.set(10, 15, 10);
    spotLight.angle = Math.PI / 4;
    spotLight.penumbra = 0.5;
    spotLight.castShadow = true;
    spotLight.shadow.mapSize.width = 2048;
    spotLight.shadow.mapSize.height = 2048;
    this.scene.add(spotLight);

    const fillLight = new THREE.PointLight(0x88ccff, 0.8);
    fillLight.position.set(-10, 5, 5);
    this.scene.add(fillLight);

    // Inner Light (Inside the drum to illuminate capsules)
    this.innerLight = new THREE.PointLight(0xffaa00, 5.0, 20);
    this.innerLight.position.set(0, 0, 0);
    this.scene.add(this.innerLight);

    this.clock = new THREE.Clock();
    this.handleResize();
    this.resizeHandler = () => this.handleResize();
    window.addEventListener('resize', this.resizeHandler);
  }

  setupPhysics() {
    this.world = new CANNON.World();
    this.world.gravity.set(0, -15, 0); // Stronger gravity for snappier movement
    this.world.broadphase = new CANNON.NaiveBroadphase();
    this.world.solver.iterations = 20; // More iterations for stability
    this.world.defaultContactMaterial.friction = 0.1; // Low friction for rolling
    this.world.defaultContactMaterial.restitution = 0.3; // Less bouncy

    // Materials
    const wallMat = new CANNON.Material('wall');
    const capsuleMat = new CANNON.Material('capsule');

    const wallCapsuleContact = new CANNON.ContactMaterial(wallMat, capsuleMat, {
      friction: this.params.friction,
      restitution: 0.2
    });
    this.world.addContactMaterial(wallCapsuleContact);

    // Ground (Catch tray area)
    const groundShape = new CANNON.Box(new CANNON.Vec3(10, 0.5, 10));
    const ground = new CANNON.Body({ mass: 0, material: wallMat });
    ground.position.set(0, -4.5, 0);
    this.world.addBody(ground);
  }

  buildMachine() {
    // --- Visuals ---
    const drumGroup = new THREE.Group();

    // Materials
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0xFFD700, // Gold
      roughness: 0.2,
      metalness: 0.9,
      envMapIntensity: 1.5
    });

    const glassMat = new THREE.MeshStandardMaterial({
      color: 0xaaccff,
      roughness: 0.0,
      metalness: 0.1,
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide,
      depthWrite: false
    });

    // Drum Dimensions
    const radius = 4.0;
    const width = 3.0;
    const sides = 8;
    const jointRadius = 0.15;
    const barRadius = 0.08;

    // Helper to create a bar between two points
    const createBar = (p1, p2) => {
      const vec = new THREE.Vector3().subVectors(p2, p1);
      const len = vec.length();
      const geo = new THREE.CylinderGeometry(barRadius, barRadius, len, 16);
      geo.translate(0, len / 2, 0);
      geo.rotateX(Math.PI / 2);
      const mesh = new THREE.Mesh(geo, frameMat);
      mesh.position.copy(p1);
      mesh.lookAt(p2);
      return mesh;
    };

    // Calculate Vertices
    const frontVertices = [];
    const backVertices = [];

    for (let i = 0; i < sides; i++) {
      const angle = (i / sides) * Math.PI * 2 + Math.PI / 8; // Offset to have flat bottom
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;

      frontVertices.push(new THREE.Vector3(x, y, width / 2));
      backVertices.push(new THREE.Vector3(x, y, -width / 2));
    }

    // Build Frame Structure
    for (let i = 0; i < sides; i++) {
      const p1 = frontVertices[i];
      const p2 = frontVertices[(i + 1) % sides];
      const p3 = backVertices[i];
      const p4 = backVertices[(i + 1) % sides];

      // 1. Joints (Spheres)
      const jointGeo = new THREE.SphereGeometry(jointRadius, 16, 16);
      const j1 = new THREE.Mesh(jointGeo, frameMat); j1.position.copy(p1); drumGroup.add(j1);
      const j3 = new THREE.Mesh(jointGeo, frameMat); j3.position.copy(p3); drumGroup.add(j3);

      // 2. Edges (Bars)
      // Front Rim
      drumGroup.add(createBar(p1, p2));
      // Back Rim
      drumGroup.add(createBar(p3, p4));
      // Cross Bar (Front to Back)
      drumGroup.add(createBar(p1, p3));

      // 3. Glass Panels
      // Skip panel for the hole (let's say index 0 is the hole)
      if (i !== 0) {
        // Center of the panel
        const center = new THREE.Vector3().addVectors(p1, p2).add(p3).add(p4).multiplyScalar(0.25);
        const panelWidth = p1.distanceTo(p2);
        const panelGeo = new THREE.BoxGeometry(panelWidth, width, 0.05);
        const panel = new THREE.Mesh(panelGeo, glassMat);

        panel.position.copy(center);
        // Rotate to face outward
        const normal = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5).normalize();
        panel.lookAt(center.clone().add(normal));
        // Adjust orientation because BoxGeometry is axis-aligned
        // We want width along the rim, height along Z? No, Box is X,Y,Z
        // Our panel is positioned. lookAt makes Z axis point to target.
        // We want the flat face (Z) to point outward.

        drumGroup.add(panel);
      }
    }

    this.drumMesh = drumGroup;
    this.scene.add(this.drumMesh);

    // Base Stand
    const standGeo = new THREE.BoxGeometry(8, 1, 5);
    const standMat = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.8 });
    const stand = new THREE.Mesh(standGeo, standMat);
    stand.position.y = -4.5; // Lowered slightly
    stand.receiveShadow = true;
    this.scene.add(stand);

    // Catch Tray
    const trayGeo = new THREE.BoxGeometry(4, 0.5, 4);
    const trayMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.5 });
    const tray = new THREE.Mesh(trayGeo, trayMat);
    tray.position.set(0, -4.2, 0);
    this.scene.add(tray);

    // --- Physics ---
    this.drumBody = new CANNON.Body({
      mass: 0,
      type: CANNON.Body.KINEMATIC,
      position: new CANNON.Vec3(0, 0, 0)
    });

    // Re-calculate side length for physics
    const sideLen = frontVertices[0].distanceTo(frontVertices[1]);
    const physicsThickness = 1.0;
    const plateShape = new CANNON.Box(new CANNON.Vec3(sideLen / 2, physicsThickness / 2, width / 2));

    for (let i = 0; i < sides; i++) {
      if (i === 0) continue; // Hole

      const angle = (i / sides) * Math.PI * 2 + Math.PI / 8;
      const dist = radius;

      const q = new CANNON.Quaternion();
      q.setFromAxisAngle(new CANNON.Vec3(0, 0, 1), angle + Math.PI / 2); // Normal points out

      // Position is midpoint of the face
      const x = Math.cos(angle) * dist;
      const y = Math.sin(angle) * dist;

      this.drumBody.addShape(plateShape, new CANNON.Vec3(x, y, 0), q);
    }

    // Side walls
    const sideWallShape = new CANNON.Box(new CANNON.Vec3(radius, radius, 0.5));
    this.drumBody.addShape(sideWallShape, new CANNON.Vec3(0, 0, width / 2 + 0.5));
    this.drumBody.addShape(sideWallShape, new CANNON.Vec3(0, 0, -width / 2 - 0.5));

    // Internal Baffles
    const baffleShape = new CANNON.Box(new CANNON.Vec3(1.2, 0.1, width / 2));
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2 + Math.PI / 8 + 0.5; // Offset
      const dist = radius * 0.7;
      const q = new CANNON.Quaternion();
      q.setFromAxisAngle(new CANNON.Vec3(0, 0, 1), angle + Math.PI / 2 + 0.5);
      this.drumBody.addShape(baffleShape, new CANNON.Vec3(Math.cos(angle) * dist, Math.sin(angle) * dist, 0), q);
    }

    this.world.addBody(this.drumBody);

    // --- Gate Mechanism ---
    this.gateBody = new CANNON.Body({
      mass: 0,
      type: CANNON.Body.KINEMATIC,
      position: new CANNON.Vec3(0, 0, 0)
    });

    // Gate covers the hole (index 0)
    // Angle for index 0 is Math.PI/8
    const gateAngle = Math.PI / 8;
    const gateDist = radius;
    const gateShape = new CANNON.Box(new CANNON.Vec3(sideLen / 2, 0.2, width / 2));

    const gateQ = new CANNON.Quaternion();
    gateQ.setFromAxisAngle(new CANNON.Vec3(0, 0, 1), gateAngle + Math.PI / 2);

    // Add shape with offset relative to body center (0,0,0)
    this.gateBody.addShape(gateShape, new CANNON.Vec3(Math.cos(gateAngle) * gateDist, Math.sin(gateAngle) * gateDist, 0), gateQ);

    this.world.addBody(this.gateBody);
  }

  openGate() {
    if (this.gateBody) {
      this.world.removeBody(this.gateBody);
      this.gateBody = null;
    }
  }

  spawnCapsules(items) {
    const radius = 0.45;

    items.forEach((item, index) => {
      const group = new THREE.Group();

      const topGeo = new THREE.SphereGeometry(radius, 24, 24, 0, Math.PI * 2, 0, Math.PI / 2);
      const bottomGeo = new THREE.SphereGeometry(radius, 24, 24, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);

      const color = item.color || '#4ECDC4';
      const topMat = new THREE.MeshPhysicalMaterial({
        color: color,
        metalness: 0.3,
        roughness: 0.2,
        clearcoat: 0.8
      });
      const bottomMat = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        metalness: 0.1,
        roughness: 0.2
      });

      const topMesh = new THREE.Mesh(topGeo, topMat);
      const bottomMesh = new THREE.Mesh(bottomGeo, bottomMat);

      group.add(topMesh);
      group.add(bottomMesh);
      this.scene.add(group);

      const body = new CANNON.Body({
        mass: 1,
        shape: new CANNON.Sphere(radius),
        material: new CANNON.Material('capsule')
      });

      body.position.set(
        (Math.random() - 0.5) * 3,
        (Math.random() - 0.5) * 3,
        (Math.random() - 0.5) * 1
      );

      body.linearDamping = 0.1;
      body.angularDamping = 0.1;
      body.itemData = item;
      this.world.addBody(body);

      this.capsules.push({ mesh: group, body, itemData: item });
    });
  }

  startLoop() {
    const step = () => {
      if (!this.running) return;
      const delta = Math.min(this.clock.getDelta(), 0.05);

      // Update Drum Rotation
      if (this.currentSpeed !== this.targetSpeed) {
        this.currentSpeed += (this.targetSpeed - this.currentSpeed) * 3.0 * delta;
      }

      this.drumAngle += this.currentSpeed * delta;

      // Sync Drum Physics
      const q = new CANNON.Quaternion();
      q.setFromAxisAngle(new CANNON.Vec3(0, 0, 1), this.drumAngle);
      this.drumBody.quaternion.copy(q);

      // Sync Gate Physics (if exists)
      if (this.gateBody) {
        this.gateBody.quaternion.copy(q);
        // Need to rotate position offset? No, body is at 0,0,0, shape is offset.
        // Just rotation is enough if pivot is 0,0,0
      }

      // Sync Visuals
      this.drumMesh.rotation.z = this.drumAngle;

      // Camera Effect: Slight zoom/sway
      if (this.camera) {
        const time = Date.now() * 0.001;
        this.camera.position.y = 5 + Math.sin(time * 0.5) * 0.2;
        this.camera.lookAt(0, 0, 0);
      }

      // Physics Step (Sub-stepping for stability)
      this.world.step(1 / 60, delta, 10);

      this.capsules.forEach(capsule => {
        const { mesh, body } = capsule;
        mesh.position.copy(body.position);
        mesh.quaternion.copy(body.quaternion);

        // Z-constraint
        if (body.position.z > 2.2) { body.position.z = 2.2; body.velocity.z *= -0.5; }
        if (body.position.z < -2.2) { body.position.z = -2.2; body.velocity.z *= -0.5; }
      });

      this.updateParticles(delta);

      this.renderer.render(this.scene, this.camera);
      this.animationId = requestAnimationFrame(step);
    };
    this.animationId = requestAnimationFrame(step);
  }

  async waitForWinner() {
    return new Promise(resolve => {
      const checkInterval = setInterval(() => {
        if (!this.running || this.skipping) {
          clearInterval(checkInterval);
          resolve(null);
          return;
        }

        const winner = this.capsules.find(c => c.body.position.y < -3.0);
        if (winner) {
          clearInterval(checkInterval);
          resolve(winner);
        }
      }, 50);
    });
  }

  async highlightWinner(capsule) {
    // Zoom in on winner
    const startPos = this.camera.position.clone();
    const targetPos = new THREE.Vector3(0, -2, 8);

    await this.animateValue(0, 1, 800, t => {
      this.camera.position.lerpVectors(startPos, targetPos, t);
      this.camera.lookAt(0, -3, 0);
    });
  }

  // ... (rest of methods: spawnConfetti, updateParticles, wait, animateValue, setStatus, handleResize, teardown)
  // Re-implementing helpers to ensure they are present

  spawnConfetti(position) {
    const particleCount = 150;
    const geometry = new THREE.BufferGeometry();
    const positions = [];
    const velocities = [];
    const colors = [];
    const colorPalette = [new THREE.Color(0xffd700), new THREE.Color(0xff0000), new THREE.Color(0xffffff)];

    for (let i = 0; i < particleCount; i++) {
      positions.push(position.x, position.y, position.z);
      const theta = Math.random() * Math.PI * 2;
      const speed = 3 + Math.random() * 5;
      velocities.push(speed * Math.cos(theta), speed * Math.sin(theta) + 5, (Math.random() - 0.5) * 4);
      const color = colorPalette[Math.floor(Math.random() * colorPalette.length)];
      colors.push(color.r, color.g, color.b);
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const material = new THREE.PointsMaterial({ size: 0.1, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending });
    const particles = new THREE.Points(geometry, material);
    this.scene.add(particles);
    this.particles.push({ mesh: particles, velocities: velocities, age: 0 });
  }

  updateParticles(delta) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.age += delta;
      if (p.age > 2.0) {
        this.scene.remove(p.mesh);
        this.particles.splice(i, 1);
        continue;
      }
      const positions = p.mesh.geometry.attributes.position.array;
      for (let j = 0; j < p.velocities.length / 3; j++) {
        p.velocities[j * 3 + 1] -= 9.8 * delta;
        positions[j * 3] += p.velocities[j * 3] * delta;
        positions[j * 3 + 1] += p.velocities[j * 3 + 1] * delta;
        positions[j * 3 + 2] += p.velocities[j * 3 + 2] * delta;
      }
      p.mesh.geometry.attributes.position.needsUpdate = true;
    }
  }

  async wait(ms) {
    if (this.skipping) return;
    return new Promise(resolve => {
      const start = performance.now();
      const check = () => {
        if (this.skipping || performance.now() - start >= ms) {
          resolve(); return;
        }
        requestAnimationFrame(check);
      };
      check();
    });
  }

  async animateValue(from, to, duration, onUpdate) {
    if (this.skipping) { onUpdate(to); return; }
    const start = performance.now();
    return new Promise(resolve => {
      const tick = now => {
        if (!this.running) { resolve(); return; }
        if (this.skipping) { onUpdate(to); resolve(); return; }
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = progress < 0.5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress;
        onUpdate(from + (to - from) * eased);
        if (progress < 1) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });
  }

  setStatus(message) {
    if (this.statusEl) {
      this.statusEl.textContent = message;
      this.statusEl.classList.remove('pop');
      void this.statusEl.offsetWidth;
      this.statusEl.classList.add('pop');
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
    if (this.resizeHandler) window.removeEventListener('resize', this.resizeHandler);
    if (this.renderer) this.renderer.dispose();
    this.capsules.forEach(({ mesh }) => this.scene.remove(mesh));
    this.capsules = [];
    if (this.drumMesh) this.scene.remove(this.drumMesh);
    if (this.overlay) this.overlay.remove();
  }
}

window.WebGLGachaScene = WebGLGachaScene;
