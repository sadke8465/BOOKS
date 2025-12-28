// Mutable runtime state shared across modules.
import * as THREE from "three";
import { CONFIG } from "./config.js";

export const WorldState = {
  allParticles: [],
  allConstraints: [],
  notes: [],
  interactableObjects: [],
  gravity: new THREE.Vector3(0, -5, 0),
  friction: 0.92,
  windMultiplier: 1.0,
  windSpeed: 1.0,
  windDirX: 0.8,
  windDirY: 0.4,
  paperStiffness: 1.2,
  flutterFreq: 10.0,
  windTime: 0,
  debugMode: false,
  debugPointsMesh: null,
  meshResolution: CONFIG.segs,
  collisionThickness: CONFIG.collisionThickness,
  spawnDuration: CONFIG.spawnDuration,
  cameraTarget: new THREE.Vector3(0, 0, 0),
};
