// Renderizador, cena, céu, luzes e câmera suave. Os esportes montam seus cenários dentro de world.stage.
import * as THREE from 'three';

export class World {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 3000);
    this.camera.position.set(0, 3, 8);

    this.hemi = new THREE.HemisphereLight(0xffffff, 0x7a9a6a, 1.5);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 2.1);
    this.sun.position.set(8, 18, 6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.02;
    this.scene.add(this.sun, this.sun.target);
    this.setShadowArea(new THREE.Vector3(0, 0, 0), 30);

    // Céu em degradê
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: { top: { value: new THREE.Color('#5fb8ff') }, bottom: { value: new THREE.Color('#e6f6ff') } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float h = clamp(vP.y*1.4+0.15,0.0,1.0); gl_FragColor = vec4(mix(bottom, top, h),1.0); }',
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1500, 24, 12), this.skyMat);
    this.sky.renderOrder = -10;
    this.scene.add(this.sky);
    this.scene.fog = new THREE.Fog('#e6f6ff', 120, 900);

    this.stage = new THREE.Group();
    this.scene.add(this.stage);

    this.camPos = this.camera.position.clone();
    this.camLook = new THREE.Vector3();
    this.camGoalPos = this.camPos.clone();
    this.camGoalLook = new THREE.Vector3();
    this.camLerp = 4;
    this.shake = 0;
    this.updaters = new Set();

    addEventListener('resize', () => this.resize());
    this.resize();
  }

  resize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight, false);
  }

  setSky(top, bottom, night = false) {
    this.skyMat.uniforms.top.value.set(top);
    this.skyMat.uniforms.bottom.value.set(bottom);
    this.scene.fog.color.set(bottom);
    this.hemi.intensity = night ? 0.9 : 1.5;
    this.sun.intensity = night ? 1.3 : 2.1;
    this.sun.color.set(night ? '#c8d4ff' : '#ffffff');
  }

  setFog(near, far) { this.scene.fog.near = near; this.scene.fog.far = far; }

  setShadowArea(center, size) {
    const c = this.sun.shadow.camera;
    c.left = c.bottom = -size;
    c.right = c.top = size;
    c.near = 0.5;
    c.far = 120;
    c.updateProjectionMatrix();
    this.sun.target.position.copy(center);
    this.sun.position.copy(center).add(new THREE.Vector3(10, 30, 8));
  }

  clearStage() {
    for (const child of [...this.stage.children]) {
      this.stage.remove(child);
      child.traverse((o) => {
        o.geometry?.dispose();
        const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
        for (const m of mats) {
          if (m.userData?.cached) continue;
          m.map?.dispose();
          m.dispose();
        }
      });
    }
    this.updaters.clear();
  }

  // Câmera: define o alvo; ela se move suavemente até lá.
  setCamera(pos, look, instant = false, lerp = 4) {
    this.camGoalPos.copy(pos);
    this.camGoalLook.copy(look);
    this.camLerp = lerp;
    if (instant) {
      this.camPos.copy(pos);
      this.camLook.copy(look);
    }
  }
  addShake(v) { this.shake = Math.min(1, this.shake + v); }

  update(dt) {
    const k = 1 - Math.exp(-this.camLerp * dt);
    this.camPos.lerp(this.camGoalPos, k);
    this.camLook.lerp(this.camGoalLook, k);
    this.camera.position.copy(this.camPos);
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 2.5);
      const s = this.shake * 0.15;
      this.camera.position.x += (Math.random() - 0.5) * s;
      this.camera.position.y += (Math.random() - 0.5) * s;
    }
    this.camera.lookAt(this.camLook);
    this.sky.position.copy(this.camera.position);
    for (const fn of this.updaters) fn(dt);
  }

  render() { this.renderer.render(this.scene, this.camera); }
}
