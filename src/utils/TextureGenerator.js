// Utility for generating the paper texture.
import * as THREE from "three";
import { CONFIG } from "../config.js";

export function createPaperTexture() {
  const size = CONFIG.paper.textureSize;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);

  const glueH = size * CONFIG.glueRatio;
  ctx.fillStyle = CONFIG.paper.glueShade;
  ctx.fillRect(0, 0, size, glueH);

  ctx.fillStyle = CONFIG.paper.speckleShade;
  for (let i = 0; i < CONFIG.paper.noiseCount; i += 1) {
    ctx.fillRect(
      Math.random() * size,
      Math.random() * size,
      CONFIG.paper.noiseSize,
      CONFIG.paper.noiseSize
    );
  }

  ctx.strokeStyle = CONFIG.paper.lineColor;
  ctx.lineWidth = CONFIG.paper.lineWidth;
  for (let i = 0; i < 3; i += 1) {
    ctx.beginPath();
    ctx.moveTo(size * 0.2, size * (0.4 + i * 0.2));
    ctx.lineTo(size * 0.8, size * (0.4 + i * 0.2));
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
