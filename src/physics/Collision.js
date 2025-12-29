// Collision helpers for particle/edge collisions and stacking discipline.
import { CONFIG } from "../config.js";

const EPS = 1e-6;

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

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function updatePenetration(p, amount) {
  if (amount > p.penetration) {
    p.penetration = amount;
  }
}

function resolveParticleParticle(p1, p2, options, hitParticles) {
  const dx = p2.pos.x - p1.pos.x;
  const dy = p2.pos.y - p1.pos.y;
  const dz = p2.pos.z - p1.pos.z;
  const minDist = p1.radius + p2.radius + options.slop;
  const distSq = dx * dx + dy * dy + dz * dz;
  if (distSq >= minDist * minDist) return 0;

  const dist = Math.sqrt(distSq) || EPS;
  const nx = dx / dist;
  const ny = dy / dist;
  const nz = dz / dist;
  const penetration = minDist - dist;

  let w1 = p1.pinned ? 0 : 1;
  let w2 = p2.pinned ? 0 : 1;

  if (options.layerBias && p1.noteId !== p2.noteId) {
    const lower = p1.depthIndex < p2.depthIndex ? p1 : p2;
    const upper = lower === p1 ? p2 : p1;
    if (lower === p1) {
      w1 *= options.lowerLayerWeight;
      w2 *= options.upperLayerWeight;
    } else {
      w1 *= options.upperLayerWeight;
      w2 *= options.lowerLayerWeight;
    }
    if (upper.pos.z < lower.pos.z + options.thickness) {
      const lift = lower.pos.z + options.thickness - upper.pos.z;
      if (!upper.pinned) {
        upper.pos.z += lift;
      }
    }
  }

  const total = w1 + w2;
  if (total <= EPS) return 0;

  const push1 = (penetration * w1) / total;
  const push2 = (penetration * w2) / total;

  if (!p1.pinned) {
    p1.pos.x -= nx * push1;
    p1.pos.y -= ny * push1;
    p1.pos.z -= nz * push1;
  }
  if (!p2.pinned) {
    p2.pos.x += nx * push2;
    p2.pos.y += ny * push2;
    p2.pos.z += nz * push2;
  }

  updatePenetration(p1, penetration);
  updatePenetration(p2, penetration);
  hitParticles.add(p1);
  hitParticles.add(p2);

  return penetration;
}

function resolveParticleEdge(p, edge, options, hitParticles) {
  if (edge.lastQueryId === p.id) return 0;
  edge.lastQueryId = p.id;

  if (edge.p1 === p || edge.p2 === p) return 0;
  if (p.neighbors && (p.neighbors.has(edge.p1) || p.neighbors.has(edge.p2))) {
    return 0;
  }

  const ax = edge.p1.pos.x;
  const ay = edge.p1.pos.y;
  const az = edge.p1.pos.z;
  const bx = edge.p2.pos.x;
  const by = edge.p2.pos.y;
  const bz = edge.p2.pos.z;

  const abx = bx - ax;
  const aby = by - ay;
  const abz = bz - az;

  const apx = p.pos.x - ax;
  const apy = p.pos.y - ay;
  const apz = p.pos.z - az;

  const abLenSq = abx * abx + aby * aby + abz * abz;
  const t = abLenSq <= EPS ? 0 : clamp01((apx * abx + apy * aby + apz * abz) / abLenSq);

  const cx = ax + abx * t;
  const cy = ay + aby * t;
  const cz = az + abz * t;

  const dx = p.pos.x - cx;
  const dy = p.pos.y - cy;
  const dz = p.pos.z - cz;
  const minDist = p.radius + edge.radius + options.slop;
  const distSq = dx * dx + dy * dy + dz * dz;
  if (distSq >= minDist * minDist) return 0;

  const dist = Math.sqrt(distSq) || EPS;
  const nx = dx / dist;
  const ny = dy / dist;
  const nz = dz / dist;
  const penetration = minDist - dist;

  let wP = p.pinned ? 0 : 1;
  let wE1 = edge.p1.pinned ? 0 : 0.5;
  let wE2 = edge.p2.pinned ? 0 : 0.5;

  if (options.layerBias && p.noteId !== edge.noteId) {
    const edgeIsLower = edge.noteId < p.noteId;
    if (edgeIsLower) {
      wP *= options.upperLayerWeight;
      wE1 *= options.lowerLayerWeight;
      wE2 *= options.lowerLayerWeight;
      if (p.pos.z < Math.max(edge.p1.pos.z, edge.p2.pos.z) + options.thickness) {
        p.pos.z = Math.max(edge.p1.pos.z, edge.p2.pos.z) + options.thickness;
      }
    } else {
      wP *= options.lowerLayerWeight;
      wE1 *= options.upperLayerWeight;
      wE2 *= options.upperLayerWeight;
      if (edge.p1.pos.z < p.pos.z + options.thickness && !edge.p1.pinned) {
        edge.p1.pos.z = p.pos.z + options.thickness;
      }
      if (edge.p2.pos.z < p.pos.z + options.thickness && !edge.p2.pinned) {
        edge.p2.pos.z = p.pos.z + options.thickness;
      }
    }
  }

  const total = wP + wE1 + wE2;
  if (total <= EPS) return 0;

  const pushP = (penetration * wP) / total;
  const pushE1 = (penetration * wE1) / total;
  const pushE2 = (penetration * wE2) / total;

  if (!p.pinned) {
    p.pos.x += nx * pushP;
    p.pos.y += ny * pushP;
    p.pos.z += nz * pushP;
  }
  if (!edge.p1.pinned) {
    edge.p1.pos.x -= nx * pushE1;
    edge.p1.pos.y -= ny * pushE1;
    edge.p1.pos.z -= nz * pushE1;
  }
  if (!edge.p2.pinned) {
    edge.p2.pos.x -= nx * pushE2;
    edge.p2.pos.y -= ny * pushE2;
    edge.p2.pos.z -= nz * pushE2;
  }

  updatePenetration(p, penetration);
  updatePenetration(edge.p1, penetration);
  updatePenetration(edge.p2, penetration);
  hitParticles.add(p);
  hitParticles.add(edge.p1);
  hitParticles.add(edge.p2);

  return penetration;
}

function buildSpatialHash(spatialHash, particles, edges, radius) {
  spatialHash.clear();
  for (let i = 0; i < particles.length; i += 1) {
    spatialHash.insertParticle(particles[i]);
  }
  for (let i = 0; i < edges.length; i += 1) {
    spatialHash.insertEdge(edges[i], radius);
  }
}

function collisionPass({
  particles,
  edges,
  spatialHash,
  thickness,
  radius,
  slop,
  layerBias,
}) {
  buildSpatialHash(spatialHash, particles, edges, radius + slop);

  const neighbors = [];
  const edgeNeighbors = [];
  const hitParticles = new Set();
  let maxPenetration = 0;

  for (let i = 0; i < particles.length; i += 1) {
    const p = particles[i];
    neighbors.length = 0;
    edgeNeighbors.length = 0;
    spatialHash.queryParticlesAt(p.pos.x, p.pos.y, neighbors);
    spatialHash.queryEdgesAt(p.pos.x, p.pos.y, edgeNeighbors);

    for (let j = 0; j < neighbors.length; j += 1) {
      const other = neighbors[j];
      if (other === p) continue;
      if (layerBias && p.noteId === other.noteId) continue;
      if (!layerBias && p.noteId !== other.noteId) continue;
      if (!layerBias && p.neighbors && p.neighbors.has(other)) continue;
      if (other.id < p.id) continue;
      maxPenetration = Math.max(
        maxPenetration,
        resolveParticleParticle(
          p,
          other,
          {
            slop,
            thickness,
            layerBias,
            lowerLayerWeight: CONFIG.collisions.lowerLayerWeight,
            upperLayerWeight: CONFIG.collisions.upperLayerWeight,
          },
          hitParticles
        )
      );
    }

    for (let j = 0; j < edgeNeighbors.length; j += 1) {
      const edge = edgeNeighbors[j];
      if (layerBias && edge.noteId === p.noteId) continue;
      if (!layerBias && edge.noteId !== p.noteId) continue;
      maxPenetration = Math.max(
        maxPenetration,
        resolveParticleEdge(
          p,
          edge,
          {
            slop,
            thickness,
            layerBias,
            lowerLayerWeight: CONFIG.collisions.lowerLayerWeight,
            upperLayerWeight: CONFIG.collisions.upperLayerWeight,
          },
          hitParticles
        )
      );
    }
  }

  return { maxPenetration, hitParticles };
}

export function resetPenetrations(particles) {
  for (let i = 0; i < particles.length; i += 1) {
    particles[i].penetration = 0;
  }
}

export function resolveSelfCollisions(particles, edges, spatialHash, thickness) {
  return collisionPass({
    particles,
    edges,
    spatialHash,
    thickness,
    radius: CONFIG.collisionRadius,
    slop: CONFIG.collisions.slop,
    layerBias: false,
  });
}

export function resolveInterMeshCollisions(particles, edges, spatialHash, thickness) {
  return collisionPass({
    particles,
    edges,
    spatialHash,
    thickness,
    radius: CONFIG.collisionRadius,
    slop: CONFIG.collisions.slop,
    layerBias: true,
  });
}

export function resolveFinalCollisions(particles, edges, spatialHash, thickness) {
  const selfResult = collisionPass({
    particles,
    edges,
    spatialHash,
    thickness,
    radius: CONFIG.collisionRadius,
    slop: 0,
    layerBias: false,
  });
  const interResult = collisionPass({
    particles,
    edges,
    spatialHash,
    thickness,
    radius: CONFIG.collisionRadius,
    slop: 0,
    layerBias: true,
  });

  const hitParticles = new Set([...selfResult.hitParticles, ...interResult.hitParticles]);
  return {
    maxPenetration: Math.max(selfResult.maxPenetration, interResult.maxPenetration),
    hitParticles,
  };
}
