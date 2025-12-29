import * as THREE from "three";
import { CONFIG } from "./config.js";
import { WorldState } from "./state.js";
import { createScene } from "./core/SceneSetup.js";
import { InputHandler } from "./core/Input.js";
import { PhysicsSolver } from "./physics/PhysicsSolver.js";
import { SpatialHash } from "./physics/SpatialHash.js";
import { UIManager } from "./ui/UIManager.js";
import { Note } from "./entities/Note.js";

const { scene, camera, renderer, wall, baseNoteMaterial } = createScene();
WorldState.interactableObjects = [wall];

const raycaster = new THREE.Raycaster();
const spatialHash = new SpatialHash(CONFIG.spatialCellSize);
const solver = new PhysicsSolver(WorldState, spatialHash, scene);

const uiManager = new UIManager({
  state: WorldState,
  camera,
  onClear: () => {
    WorldState.notes.forEach((note) => note.dispose(scene));
    WorldState.notes = [];
    WorldState.allParticles = [];
    WorldState.allConstraints = [];
    WorldState.allEdges = [];
    WorldState.interactableObjects = [wall];
    WorldState.nextParticleId = 0;
    WorldState.nextEdgeId = 0;
    WorldState.paused = false;
    WorldState.stepOnce = false;
    WorldState.violationDetected = false;
    spatialHash.clear();
    solver.clearDebugPoints();
    uiManager.setNotesCount(0);
  },
  onDebugToggle: () => {
    if (!WorldState.debugMode && !WorldState.debugHeatmap && !WorldState.debugShowRadius) {
      solver.clearDebugPoints();
    }
  },
  onPauseToggle: () => {},
  onStep: () => {},
});

function spawnNote({ x, y, z, angle }) {
  new Note({
    centerX: x,
    centerY: y,
    targetZ: z,
    rotationZ: angle,
    state: WorldState,
    scene,
    baseMaterial: baseNoteMaterial,
    raycaster,
    interactableObjects: WorldState.interactableObjects,
  });
  uiManager.setNotesCount(WorldState.notes.length);
}

new InputHandler({
  renderer,
  camera,
  state: WorldState,
  uiRoot: document.getElementById("ui"),
  onSpawn: spawnNote,
});

document.body.appendChild(renderer.domElement);

function animate() {
  requestAnimationFrame(animate);
  solver.step();
  WorldState.notes.forEach((note) => note.updateMesh());
  renderer.render(scene, camera);
}

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

camera.lookAt(WorldState.cameraTarget);

spawnNote({ x: 0, y: 0, z: CONFIG.stackBaseOffset, angle: 0 });

animate();
