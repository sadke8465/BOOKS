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

  insert(particle) {
    const k = this.key(particle.pos.x, particle.pos.y);
    if (!this.grid.has(k)) {
      this.grid.set(k, []);
    }
    this.grid.get(k).push(particle);
  }

  query(particle, out) {
    const cx = Math.floor(particle.pos.x / this.cellSize);
    const cy = Math.floor(particle.pos.y / this.cellSize);
    for (let x = -1; x <= 1; x += 1) {
      for (let y = -1; y <= 1; y += 1) {
        const cell = this.grid.get(`${cx + x},${cy + y}`);
        if (cell) {
          for (let i = 0; i < cell.length; i += 1) {
            out.push(cell[i]);
          }
        }
      }
    }
  }
}
