// Scene setup for Three.js renderer, camera, and lights.
import * as THREE from "three";
import { CONFIG } from "../config.js";
import { createPaperTexture } from "../utils/TextureGenerator.js";

export function createScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xebebeb);

  const camera = new THREE.PerspectiveCamera(
    CONFIG.camera.fov,
    window.innerWidth / window.innerHeight,
    CONFIG.camera.near,
    CONFIG.camera.far
  );
  camera.position.set(0, 0, CONFIG.camera.defaultZ);

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    logarithmicDepthBuffer: true,
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(5, 5, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.radius = 4;
  sun.shadow.bias = -0.0001;
  scene.add(sun);

  const paperTexture = createPaperTexture();
  const wallMaterial = new THREE.MeshStandardMaterial({
    color: CONFIG.wall.color,
    roughness: 1.0,
  });

  const baseNoteMaterial = new THREE.MeshStandardMaterial({
    map: paperTexture,
    side: THREE.DoubleSide,
    roughness: 0.9,
    metalness: 0.0,
    flatShading: true,
    color: 0xffffff,
  });

  const wall = new THREE.Mesh(
    new THREE.PlaneGeometry(CONFIG.wall.size, CONFIG.wall.size),
    wallMaterial
  );
  wall.position.z = CONFIG.wall.z;
  wall.receiveShadow = true;
  scene.add(wall);

  return {
    scene,
    camera,
    renderer,
    wall,
    baseNoteMaterial,
  };
}
