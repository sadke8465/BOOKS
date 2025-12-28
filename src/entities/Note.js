// Note entity that owns mesh and particle state.
import * as THREE from "three";
import { CONFIG, PALETTE } from "../config.js";

export class Note {
  constructor({
    centerX,
    centerY,
    targetZ,
    rotationZ,
    state,
    scene,
    baseMaterial,
    raycaster,
    interactableObjects,
  }) {
    this.centerX = centerX;
    this.centerY = centerY;
    this.rotationZ = rotationZ;
    this.isSpawning = true;
    this.spawnTimer = 0;
    this.spawnDuration = state.spawnDuration;

    const noteId = state.notes.length;

    const geo = new THREE.PlaneGeometry(
      CONFIG.width,
      CONFIG.height,
      state.meshResolution,
      state.meshResolution
    );
    geo.translate(0, -CONFIG.height / 2, 0);
    const nonIndexedGeo = geo.toNonIndexed();

    const randomColor = PALETTE[Math.floor(Math.random() * PALETTE.length)];
    const material = baseMaterial.clone();
    material.color.setHex(randomColor);
    material.polygonOffset = true;
    material.polygonOffsetFactor = -1.0;
    material.polygonOffsetUnits = -(noteId + 1) * 150.0;
    material.depthWrite = true;
    material.depthTest = true;

    this.mesh = new THREE.Mesh(nonIndexedGeo, material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    scene.add(this.mesh);
    interactableObjects.push(this.mesh);

    const posAttr = nonIndexedGeo.attributes.position;
    const vertexCount = posAttr.count;

    this.particles = [];
    this.glueParticles = [];
    this.vertexMap = [];

    const uniqueMap = {};
    let pCount = 0;
    const gridW = state.meshResolution + 1;
    const cos = Math.cos(rotationZ);
    const sin = Math.sin(rotationZ);

    const potentialColliders = interactableObjects.filter((o) => o !== this.mesh);

    const tiltAngle = THREE.MathUtils.degToRad(CONFIG.note.tiltAngleDeg);
    const tiltSin = Math.sin(tiltAngle);

    for (let i = 0; i < vertexCount; i += 1) {
      const lx = parseFloat(posAttr.getX(i).toFixed(4));
      const ly = parseFloat(posAttr.getY(i).toFixed(4));
      const key = `${lx},${ly}`;

      if (uniqueMap[key] === undefined) {
        const finalX = lx * cos - ly * sin + centerX;
        const finalY = lx * sin + ly * cos + centerY;

        const isPinned = ly > -(CONFIG.height * CONFIG.glueRatio);

        let finalZ = targetZ;
        if (isPinned) {
          raycaster.set(
            new THREE.Vector3(finalX, finalY, CONFIG.note.raycastHeight),
            new THREE.Vector3(0, 0, -1)
          );
          const hits = raycaster.intersectObjects(potentialColliders);
          if (hits.length > 0) {
            finalZ = Math.max(targetZ, hits[0].point.z + state.collisionThickness);
          }
        }

        const wx = finalX;
        const wy = finalY + CONFIG.spawnOffsetY;
        const tiltOffset = isPinned ? 0 : Math.abs(ly) * tiltSin;
        const wz = finalZ + CONFIG.spawnOffsetZ + tiltOffset;

        const p = {
          pos: new THREE.Vector3(wx, wy, wz),
          oldPos: new THREE.Vector3(wx, wy, wz),
          acc: new THREE.Vector3(),
          pinned: isPinned,
          localY: Math.abs(ly) / CONFIG.height,
          noteId,
          targetX: finalX,
          targetY: finalY,
          targetZ: finalZ,
        };

        this.particles.push(p);
        state.allParticles.push(p);
        if (isPinned) this.glueParticles.push(p);
        uniqueMap[key] = pCount;
        pCount += 1;
      }
      this.vertexMap[i] = uniqueMap[key];
    }

    for (let y = 0; y < gridW; y += 1) {
      for (let x = 0; x < gridW; x += 1) {
        const idx = y * gridW + x;
        const p = this.particles[idx];
        if (!p) continue;

        const addConstraint = (p1, p2, stiff, shrink = 1.0) => {
          state.allConstraints.push({
            p1,
            p2,
            dist: p1.pos.distanceTo(p2.pos) * shrink,
            stiffness: stiff,
          });
        };

        if (x < gridW - 1) addConstraint(p, this.particles[idx + 1], 1.0);
        if (y < gridW - 1) {
          let shrink = 1.0;
          if (x === 0 || x === gridW - 1) {
            shrink = y > 1 ? 0.98 : 1.0;
          }
          addConstraint(p, this.particles[idx + gridW], 1.0, shrink);
        }

        if (x < gridW - 1 && y < gridW - 1) {
          addConstraint(p, this.particles[idx + gridW + 1], 0.95);
          addConstraint(this.particles[idx + 1], this.particles[idx + gridW], 0.95);
        }

        if (x < gridW - 2) addConstraint(p, this.particles[idx + 2], 0.85);
        if (y < gridW - 2) addConstraint(p, this.particles[idx + gridW * 2], 0.85);
      }
    }

    this.targetZ = targetZ;
    state.notes.push(this);
  }

  updateMesh() {
    const positions = this.mesh.geometry.attributes.position;
    for (let i = 0; i < positions.count; i += 1) {
      const pIdx = this.vertexMap[i];
      const p = this.particles[pIdx];
      positions.setXYZ(i, p.pos.x, p.pos.y, p.pos.z);
    }
    positions.needsUpdate = true;
    this.mesh.geometry.computeVertexNormals();
  }

  dispose(scene) {
    scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    if (Array.isArray(this.mesh.material)) {
      this.mesh.material.forEach((mat) => mat.dispose());
    } else {
      this.mesh.material.dispose();
    }
  }
}
