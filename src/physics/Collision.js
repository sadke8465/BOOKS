// Collision helpers for sticky note stacking and overlap checks.
import { CONFIG } from "../config.js";

export function checkGlueOverlap(x, y, notes) {
  const glueH = CONFIG.height * CONFIG.glueRatio;
  const halfW = CONFIG.width / 2;

  for (let i = 0; i < notes.length; i += 1) {
    const note = notes[i];
    const dx = x - note.centerX;
    const dy = y - note.centerY;
    const cos = Math.cos(-note.rotationZ);
    const sin = Math.sin(-note.rotationZ);
    const localX = dx * cos - dy * sin;
    const localY = dx * sin + dy * cos;

    if (
      localX >= -halfW &&
      localX <= halfW &&
      localY <= CONFIG.glueOverlapPadding &&
      localY >= -(glueH + CONFIG.glueOverlapPadding)
    ) {
      return true;
    }
  }
  return false;
}

export function enforceStackOrder(allParticles, spatialHash, collisionThickness) {
  spatialHash.clear();
  for (let i = 0; i < allParticles.length; i += 1) {
    spatialHash.insert(allParticles[i]);
  }

  const neighbors = [];

  for (let i = 0; i < allParticles.length; i += 1) {
    const p1 = allParticles[i];
    neighbors.length = 0;
    spatialHash.query(p1, neighbors);

    for (let j = 0; j < neighbors.length; j += 1) {
      const p2 = neighbors[j];
      if (p1 === p2) continue;
      if (p1.noteId === p2.noteId) continue;

      const dx = p2.pos.x - p1.pos.x;
      const dy = p2.pos.y - p1.pos.y;

      if (
        Math.abs(dx) > CONFIG.collisionRadius ||
        Math.abs(dy) > CONFIG.collisionRadius
      ) {
        continue;
      }

      const distSq = dx * dx + dy * dy;
      if (distSq < CONFIG.collisionRadius * CONFIG.collisionRadius) {
        let pBottom;
        let pTop;
        if (p1.noteId < p2.noteId) {
          pBottom = p1;
          pTop = p2;
        } else {
          pBottom = p2;
          pTop = p1;
        }

        const currentZGap = pTop.pos.z - pBottom.pos.z;
        const minGap = collisionThickness;

        if (currentZGap < minGap) {
          const penetration = minGap - currentZGap;

          if (pBottom.pinned) {
            pTop.pos.z += penetration;
          } else if (pTop.pinned) {
            pBottom.pos.z -= penetration;
          } else {
            pBottom.pos.z -= penetration * CONFIG.collisions.stackBottomScale;
            pTop.pos.z += penetration * CONFIG.collisions.stackTopScale;
          }

          if (pBottom.pos.z < 0) pBottom.pos.z = 0;
        }
      }
    }
  }
}

export function resolveCollisions(allParticles, spatialHash, collisionThickness) {
  spatialHash.clear();
  for (let i = 0; i < allParticles.length; i += 1) {
    spatialHash.insert(allParticles[i]);
  }

  const neighbors = [];
  for (let i = 0; i < allParticles.length; i += 1) {
    const p1 = allParticles[i];
    neighbors.length = 0;
    spatialHash.query(p1, neighbors);

    for (let j = 0; j < neighbors.length; j += 1) {
      const p2 = neighbors[j];
      if (p1 === p2) continue;
      if (p1.noteId === p2.noteId) continue;

      const dx = p2.pos.x - p1.pos.x;
      const dy = p2.pos.y - p1.pos.y;
      if (
        Math.abs(dx) > CONFIG.collisionRadius ||
        Math.abs(dy) > CONFIG.collisionRadius
      ) {
        continue;
      }

      const distSq = dx * dx + dy * dy;
      if (distSq < CONFIG.collisionRadius * CONFIG.collisionRadius) {
        let pOld;
        let pNew;
        if (p1.noteId < p2.noteId) {
          pOld = p1;
          pNew = p2;
        } else {
          pOld = p2;
          pNew = p1;
        }

        const currentZDiff = pNew.pos.z - pOld.pos.z;

        if (currentZDiff < collisionThickness) {
          const penetration = collisionThickness - currentZDiff;

          if (pOld.pinned && pNew.pinned) {
            pNew.pos.z += penetration * CONFIG.collisions.pinnedPinnedBoost;
          } else if (pOld.pinned) {
            pNew.pos.z += penetration * CONFIG.collisions.pinnedPush;
          } else if (pNew.pinned) {
            pOld.pos.z -= penetration * CONFIG.collisions.pinnedPush;
          } else {
            pNew.pos.z += penetration * CONFIG.collisions.freeNewScale;
            pOld.pos.z -= penetration * CONFIG.collisions.freeOldScale;
          }

          if (pOld.pos.z < 0) pOld.pos.z = 0;
          if (pNew.pos.z < 0) pNew.pos.z = 0;

          if (pOld.pinned) pOld.pos.z = pOld.targetZ;
          if (pNew.pinned) pNew.pos.z = pNew.targetZ;
        }
      }
    }
  }
}
