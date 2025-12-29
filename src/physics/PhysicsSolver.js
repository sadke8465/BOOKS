// Physics solver responsible for stepping Verlet integration and constraints.
import * as THREE from "three";
import { CONFIG } from "../config.js";
import { enforceStackOrder, resolveCollisions } from "./Collision.js";

export class PhysicsSolver {
  constructor(state, spatialHash, scene) {
    this.state = state;
    this.spatialHash = spatialHash;
    this.scene = scene;
  }

  easeOutCubic(x) {
    return 1 - Math.pow(1 - x, 3);
  }

  step() {
    const totalDt = CONFIG.physics.fixedDt;
    const { state } = this;

    state.windTime += totalDt * state.windSpeed;

    const swell =
      Math.sin(state.windTime * CONFIG.wind.swellFreq) +
      Math.cos(state.windTime * CONFIG.wind.swellAltFreq);
    const turb =
      Math.sin(state.windTime * CONFIG.wind.turbFreq) * CONFIG.wind.turbScale;
    let rawIntensity = (swell + turb + CONFIG.wind.intensityBias) * CONFIG.wind.intensityScale;
    if (rawIntensity < CONFIG.wind.intensityMin) {
      rawIntensity = CONFIG.wind.intensityMin;
    }
    const finalIntensity = rawIntensity * state.windMultiplier;

    const windX = state.windDirX * CONFIG.wind.baseX;
    const windY = state.windDirY * CONFIG.wind.baseY;
    const windZ = CONFIG.wind.baseZ + Math.abs(state.windDirX) * CONFIG.wind.zDirBoost;

    const globalWind = new THREE.Vector3(
      windX + windX * finalIntensity,
      windY + windY * finalIntensity,
      windZ + finalIntensity * CONFIG.wind.zIntensityBoost
    );

    this.computeWindOcclusion();

    state.notes.forEach((note) => {
      if (note.isSpawning) {
        note.spawnTimer += totalDt;
        let progress = note.spawnTimer / note.spawnDuration;

        if (progress >= 1.0) {
          progress = 1.0;
          note.isSpawning = false;
        }

        const t = this.easeOutCubic(progress);
        const currentOffsetY = THREE.MathUtils.lerp(CONFIG.spawnOffsetY, 0, t);
        const currentOffsetZ = THREE.MathUtils.lerp(CONFIG.spawnOffsetZ, 0, t);

        note.glueParticles.forEach((p) => {
          p.pos.y = p.targetY + currentOffsetY;
          p.pos.z = p.targetZ + currentOffsetZ;
          p.oldPos.copy(p.pos);
          p.isSpawning = note.isSpawning;
        });
      } else if (note.spawnTimer > 0) {
        note.glueParticles.forEach((p) => {
          p.isSpawning = false;
        });
      }
    });

    const dt = totalDt / CONFIG.substeps;

    for (let s = 0; s < CONFIG.substeps; s += 1) {
      for (let i = 0; i < state.allParticles.length; i += 1) {
        const p = state.allParticles[i];

        if (p.pinned) {
          if (!p.isSpawning) {
            p.pos.set(p.targetX, p.targetY, p.targetZ);
          }
          p.oldPos.copy(p.pos);
          p.acc.set(0, 0, 0);
          continue;
        }

        p.acc.add(state.gravity);

        if (p.restPos) {
          const restForce = p.restPos.clone().sub(p.pos);
          restForce.multiplyScalar(CONFIG.note.restStrength);
          p.acc.add(restForce);
        }

        const windShield = p.windShield ?? 0;
        const windScale = 1 - windShield * CONFIG.wind.occlusionStrength;

        const uniquePhase =
          p.noteId * CONFIG.wind.phaseNote +
          p.pos.x * CONFIG.wind.phaseX +
          p.pos.y * CONFIG.wind.phaseY;
        const noiseX =
          Math.sin(
            state.windTime * state.flutterFreq * CONFIG.wind.noiseXFreq + uniquePhase
          ) *
          CONFIG.wind.noiseX;
        const noiseY =
          Math.cos(
            state.windTime * state.flutterFreq * CONFIG.wind.noiseYFreq + uniquePhase
          ) *
          CONFIG.wind.noiseY;
        const noiseZ =
          Math.sin(
            state.windTime * state.flutterFreq * CONFIG.wind.noiseZFreq +
              p.pos.z * CONFIG.wind.noiseZPosScale
          ) *
          CONFIG.wind.noiseZ;

        const leverage = p.localY * p.localY;
        p.acc.x += (globalWind.x + noiseX) * leverage * windScale;
        p.acc.y += (globalWind.y + noiseY) * leverage * windScale;
        p.acc.z += (globalWind.z + noiseZ) * leverage * windScale;

        if (p.pos.z > CONFIG.physics.floorZ) {
          p.acc.z -= (p.pos.z - CONFIG.physics.floorZ) * CONFIG.physics.floorRepulsion;
        }

        const vel = p.pos.clone().sub(p.oldPos).multiplyScalar(state.friction);
        if (vel.length() > CONFIG.maxSubstepVelocity) {
          vel.setLength(CONFIG.maxSubstepVelocity);
        }

        p.oldPos.copy(p.pos);
        p.pos.add(vel.add(p.acc.multiplyScalar(dt * dt)));
        p.acc.set(0, 0, 0);

        if (p.pos.z < 0) {
          p.pos.z = 0;
          p.oldPos.z =
            p.pos.z - (p.pos.z - p.oldPos.z) * CONFIG.physics.boundaryDampen;
        }
      }

      if (s % CONFIG.physics.stackInterval === 0) {
        enforceStackOrder(state.allParticles, this.spatialHash, state.collisionThickness);
      }

      for (let iter = 0; iter < CONFIG.physics.constraintIterations; iter += 1) {
        for (let i = 0; i < state.allConstraints.length; i += 1) {
          const c = state.allConstraints[i];
          const diff = c.p2.pos.clone().sub(c.p1.pos);
          const dist = diff.length();
          if (dist === 0) continue;

          const stiff = c.stiffness * state.paperStiffness;
          const correction =
            ((dist - c.dist) / dist) * CONFIG.physics.constraintCorrection * stiff;
          const offset = diff.multiplyScalar(correction);

          const m1 = c.p1.pinned ? 0 : 0.5;
          const m2 = c.p2.pinned ? 0 : 0.5;

          if (!c.p1.pinned) c.p1.pos.add(offset.clone().multiplyScalar(m1));
          if (!c.p2.pinned) c.p2.pos.sub(offset.clone().multiplyScalar(m2));
        }
      }

      if (s % CONFIG.physics.collisionInterval === 0) {
        for (let iter = 0; iter < CONFIG.physics.collisionIterations; iter += 1) {
          resolveCollisions(state.allParticles, this.spatialHash, state.collisionThickness);
        }
      }

      this.applyRestDamping(state);
    }

    this.updateDebugGrid();
  }

  computeWindOcclusion() {
    const { state, spatialHash } = this;
    const effectiveRadius = CONFIG.collisionRadius * CONFIG.wind.occlusionRadiusScale;
    const falloff = state.collisionThickness * CONFIG.wind.occlusionFalloff;

    spatialHash.clear();
    for (let i = 0; i < state.allParticles.length; i += 1) {
      spatialHash.insert(state.allParticles[i]);
    }

    const neighbors = [];

    for (let i = 0; i < state.allParticles.length; i += 1) {
      const p = state.allParticles[i];
      p.windShield = 0;
      neighbors.length = 0;
      spatialHash.query(p, neighbors);

      for (let j = 0; j < neighbors.length; j += 1) {
        const other = neighbors[j];
        if (other === p) continue;
        if (other.noteId === p.noteId) continue;
        if (other.noteId < p.noteId) continue;

        const dx = other.pos.x - p.pos.x;
        const dy = other.pos.y - p.pos.y;
        if (Math.abs(dx) > effectiveRadius || Math.abs(dy) > effectiveRadius) {
          continue;
        }

        const distSq = dx * dx + dy * dy;
        if (distSq > effectiveRadius * effectiveRadius) continue;

        const zGap = other.pos.z - p.pos.z;
        if (zGap <= 0) continue;

        const localShield = falloff <= 0 ? 1 : Math.max(0, 1 - zGap / falloff);
        if (localShield > p.windShield) {
          p.windShield = localShield;
        }
      }
    }
  }

  applyRestDamping(state) {
    const sleepVelSq = CONFIG.physics.sleepVelocity * CONFIG.physics.sleepVelocity;
    for (let i = 0; i < state.allParticles.length; i += 1) {
      const p = state.allParticles[i];
      if (p.pinned) continue;

      const vel = p.pos.clone().sub(p.oldPos);
      const velSq = vel.lengthSq();

      if (velSq < sleepVelSq) {
        p.oldPos.copy(p.pos);
        continue;
      }

      vel.multiplyScalar(CONFIG.physics.velocityDamping);
      p.oldPos.copy(p.pos.clone().sub(vel));
    }
  }

  updateDebugGrid() {
    const { state } = this;
    if (!state.debugMode) return;

    if (
      !state.debugPointsMesh ||
      state.debugPointsMesh.geometry.attributes.position.count !== state.allParticles.length
    ) {
      if (state.debugPointsMesh) {
        this.scene.remove(state.debugPointsMesh);
        state.debugPointsMesh.geometry.dispose();
      }

      const geometry = new THREE.BufferGeometry();
      const pos = new Float32Array(state.allParticles.length * 3);
      const col = new Float32Array(state.allParticles.length * 3);

      const cRed = new THREE.Color(0xff0000);
      const cGreen = new THREE.Color(0x00ff00);

      for (let i = 0; i < state.allParticles.length; i += 1) {
        const p = state.allParticles[i];
        const c = p.pinned ? cRed : cGreen;
        col[i * 3] = c.r;
        col[i * 3 + 1] = c.g;
        col[i * 3 + 2] = c.b;
      }

      geometry.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      geometry.setAttribute("color", new THREE.BufferAttribute(col, 3));

      const material = new THREE.PointsMaterial({
        size: CONFIG.debug.pointSize,
        vertexColors: true,
        sizeAttenuation: false,
        depthTest: false,
        depthWrite: false,
      });

      state.debugPointsMesh = new THREE.Points(geometry, material);
      state.debugPointsMesh.renderOrder = 999;
      this.scene.add(state.debugPointsMesh);
    }

    const posAttr = state.debugPointsMesh.geometry.attributes.position;
    const colAttr = state.debugPointsMesh.geometry.attributes.color;
    const cRed = new THREE.Color(0xff0000);
    const cGreen = new THREE.Color(0x00ff00);

    for (let i = 0; i < state.allParticles.length; i += 1) {
      const p = state.allParticles[i];
      posAttr.setXYZ(i, p.pos.x, p.pos.y, p.pos.z + CONFIG.debug.zOffset);

      const c = p.pinned ? cRed : cGreen;
      colAttr.setXYZ(i, c.r, c.g, c.b);
    }
    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
  }

  clearDebugPoints() {
    const { state } = this;
    if (state.debugPointsMesh) {
      this.scene.remove(state.debugPointsMesh);
      state.debugPointsMesh.geometry.dispose();
      state.debugPointsMesh = null;
    }
  }
}
