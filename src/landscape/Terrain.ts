/**
 * Terrain — Hilly dump landscape
 *
 * LEARN: After multiple failed approaches (rotated rectangles, fromVertices
 * with centroid correction), the most reliable method is the simplest:
 * use Phaser's built-in matter.add.fromPhysicsEditor-style approach with
 * many small FLAT static rectangles stacked like stairs to approximate
 * the terrain slope. Each rectangle is axis-aligned (no rotation) and
 * positioned at exact coordinates. Boring but bulletproof.
 *
 * We sample the terrain curve at 10px intervals and place a thin
 * rectangle at each sample point. The visual is drawn with the smooth
 * curve, while physics uses the staircase approximation (invisible at
 * 10px resolution).
 */
import Phaser from 'phaser';
import { LANDSCAPE_WIDTH, LANDSCAPE_HEIGHT } from '../config';

export const TERRAIN_POINTS: Array<{ x: number; y: number }> = [
  { x: 0,    y: 520 },
  { x: 80,   y: 530 },
  { x: 160,  y: 520 },
  { x: 260,  y: 505 },
  { x: 350,  y: 475 },
  { x: 430,  y: 440 },
  { x: 500,  y: 415 },
  { x: 540,  y: 400 },
  // --- Column gap 540–740 ---
  { x: 740,  y: 400 },
  { x: 800,  y: 410 },
  { x: 900,  y: 430 },
  { x: 1000, y: 445 },
  { x: 1100, y: 455 },
  { x: 1200, y: 460 },
];

export const COLUMN_GAP_LEFT = 540;
export const COLUMN_GAP_RIGHT = 740;
export const COLUMN_GROUND_Y = 400;

export class Terrain {
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.createPhysicsStaircase();
    this.draw();
  }

  /**
   * Create terrain as a dense staircase of flat rectangles.
   * Each rectangle is 10px wide, positioned at the terrain height.
   * No rotation — just axis-aligned boxes. Simple and reliable.
   */
  private createPhysicsStaircase(): void {
    const collisionFilter = { category: 0x0001, mask: 0x0002 | 0x0010 };
    const step = 10; // Sample every 10px
    const depth = 300; // How deep each block extends below the surface

    for (let x = 0; x < LANDSCAPE_WIDTH; x += step) {
      // Skip the column gap
      if (x >= COLUMN_GAP_LEFT && x < COLUMN_GAP_RIGHT) continue;

      const surfaceY = Terrain.getHeightAt(x + step / 2);

      this.scene.matter.add.rectangle(
        x + step / 2,           // Center X
        surfaceY + depth / 2,   // Center Y (surface + half depth)
        step + 1,               // Width (+1 for overlap, no gaps)
        depth,                  // Height
        {
          isStatic: true,
          label: 'terrain',
          friction: 0.8,
          collisionFilter,
        },
      );
    }

    // Bridge over column gap (vehicle only)
    const bridgeWidth = COLUMN_GAP_RIGHT - COLUMN_GAP_LEFT + 20;
    this.scene.matter.add.rectangle(
      (COLUMN_GAP_LEFT + COLUMN_GAP_RIGHT) / 2,
      COLUMN_GROUND_Y + 5,
      bridgeWidth, 15,
      {
        isStatic: true, label: 'column-bridge', friction: 0.8,
        collisionFilter: { category: 0x0020, mask: 0x0010 },
      },
    );
  }

  private draw(): void {
    const g = this.scene.add.graphics();

    // Fill below terrain
    g.fillStyle(0x2a2a35);
    g.beginPath();
    g.moveTo(TERRAIN_POINTS[0]!.x, TERRAIN_POINTS[0]!.y);
    for (let i = 1; i < TERRAIN_POINTS.length; i++) {
      g.lineTo(TERRAIN_POINTS[i]!.x, TERRAIN_POINTS[i]!.y);
    }
    g.lineTo(LANDSCAPE_WIDTH, LANDSCAPE_HEIGHT);
    g.lineTo(0, LANDSCAPE_HEIGHT);
    g.closePath();
    g.fillPath();

    // Surface line
    g.lineStyle(2, 0x3a3a4a);
    for (let i = 0; i < TERRAIN_POINTS.length - 1; i++) {
      const a = TERRAIN_POINTS[i]!;
      const b = TERRAIN_POINTS[i + 1]!;
      if (a.x <= COLUMN_GAP_LEFT && b.x >= COLUMN_GAP_RIGHT) continue;
      g.lineBetween(a.x, a.y, b.x, b.y);
    }

    // Column gap edges
    g.lineStyle(2, 0x444466);
    g.lineBetween(COLUMN_GAP_LEFT, COLUMN_GROUND_Y, COLUMN_GAP_LEFT, COLUMN_GROUND_Y + 300);
    g.lineBetween(COLUMN_GAP_RIGHT, COLUMN_GROUND_Y, COLUMN_GAP_RIGHT, COLUMN_GROUND_Y + 300);

    g.setDepth(-1);
  }

  /** Get terrain height at a given X by interpolating between points */
  static getHeightAt(x: number): number {
    for (let i = 0; i < TERRAIN_POINTS.length - 1; i++) {
      const a = TERRAIN_POINTS[i]!;
      const b = TERRAIN_POINTS[i + 1]!;
      if (x >= a.x && x <= b.x) {
        const t = (x - a.x) / (b.x - a.x);
        return a.y + t * (b.y - a.y);
      }
    }
    return TERRAIN_POINTS[TERRAIN_POINTS.length - 1]!.y;
  }
}
