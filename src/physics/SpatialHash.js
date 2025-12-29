// Spatial hash helper for broad-phase particle queries.
export class SpatialHash {
  constructor(cellSize) {
    this.cellSize = cellSize;
    this.grid = new Map();
  }

  key(x, y) {
    return `${Math.floor(x / this.cellSize)},${Math.floor(y / this.cellSize)}`;
  }

  clear() {
    this.grid.clear();
  }

  ensureCell(key) {
    if (!this.grid.has(key)) {
      this.grid.set(key, { particles: [], edges: [] });
    }
    return this.grid.get(key);
  }

  insertParticle(particle) {
    const k = this.key(particle.pos.x, particle.pos.y);
    this.ensureCell(k).particles.push(particle);
  }

  insertEdge(edge, radius) {
    const minX = Math.min(edge.p1.pos.x, edge.p2.pos.x) - radius;
    const maxX = Math.max(edge.p1.pos.x, edge.p2.pos.x) + radius;
    const minY = Math.min(edge.p1.pos.y, edge.p2.pos.y) - radius;
    const maxY = Math.max(edge.p1.pos.y, edge.p2.pos.y) + radius;

    const minCellX = Math.floor(minX / this.cellSize);
    const maxCellX = Math.floor(maxX / this.cellSize);
    const minCellY = Math.floor(minY / this.cellSize);
    const maxCellY = Math.floor(maxY / this.cellSize);

    for (let x = minCellX; x <= maxCellX; x += 1) {
      for (let y = minCellY; y <= maxCellY; y += 1) {
        this.ensureCell(`${x},${y}`).edges.push(edge);
      }
    }
  }

  queryParticlesAt(x, y, out) {
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);
    for (let x = -1; x <= 1; x += 1) {
      for (let y = -1; y <= 1; y += 1) {
        const cell = this.grid.get(`${cx + x},${cy + y}`);
        if (cell && cell.particles.length) {
          out.push(...cell.particles);
        }
      }
    }
  }

  queryEdgesAt(x, y, out) {
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);
    for (let x = -1; x <= 1; x += 1) {
      for (let y = -1; y <= 1; y += 1) {
        const cell = this.grid.get(`${cx + x},${cy + y}`);
        if (cell && cell.edges.length) {
          out.push(...cell.edges);
        }
      }
    }
  }
}
