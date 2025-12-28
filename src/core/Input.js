// Input handler for spawning notes via raycasting.
import * as THREE from "three";
import { CONFIG } from "../config.js";
import { checkGlueOverlap } from "../physics/Collision.js";

export class InputHandler {
  constructor({ renderer, camera, state, uiRoot, onSpawn }) {
    this.renderer = renderer;
    this.camera = camera;
    this.state = state;
    this.uiRoot = uiRoot;
    this.onSpawn = onSpawn;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleTouchStart = this.handleTouchStart.bind(this);

    renderer.domElement.addEventListener("mousedown", this.handleMouseDown);
    renderer.domElement.addEventListener("touchstart", this.handleTouchStart, {
      passive: false,
    });
  }

  isClickOnUI(clientX, clientY) {
    const rect = this.uiRoot.getBoundingClientRect();
    if (
      clientX >= rect.left &&
      clientX <= rect.right &&
      clientY >= rect.top &&
      clientY <= rect.bottom &&
      !this.uiRoot.classList.contains("minimized")
    ) {
      if (clientY > rect.top + 50) return true;
    }
    return false;
  }

  handleMouseDown(event) {
    if (event.target.closest("#ui")) return;
    this.handleInput(event.clientX, event.clientY);
  }

  handleTouchStart(event) {
    if (event.target.closest("#ui")) return;
    event.preventDefault();
    if (event.touches.length > 0) {
      this.handleInput(event.touches[0].clientX, event.touches[0].clientY);
    }
  }

  handleInput(clientX, clientY) {
    if (this.isClickOnUI(clientX, clientY)) return;

    this.mouse.x = (clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(clientY / window.innerHeight) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(
      this.state.interactableObjects
    );

    if (intersects.length > 0) {
      const hit = intersects[0];
      let spawnX = hit.point.x;
      let spawnY = hit.point.y;

      let attempts = 0;
      while (checkGlueOverlap(spawnX, spawnY, this.state.notes) && attempts < 5) {
        spawnY -= CONFIG.height * CONFIG.glueRatio * CONFIG.spawnOverlapOffset;
        attempts += 1;
      }

      const logicalZ =
        this.state.notes.length * CONFIG.stackStep + CONFIG.stackBaseOffset;
      const angle = THREE.MathUtils.degToRad(
        Math.random() * CONFIG.note.randomRotationDeg * 2 - CONFIG.note.randomRotationDeg
      );

      this.onSpawn({
        x: spawnX,
        y: spawnY,
        z: logicalZ,
        angle,
      });
    }
  }

  dispose() {
    this.renderer.domElement.removeEventListener("mousedown", this.handleMouseDown);
    this.renderer.domElement.removeEventListener("touchstart", this.handleTouchStart);
  }
}
