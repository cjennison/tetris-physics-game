/**
 * Terrain — Hilly dump landscape (bottom half of the world)
 *
 * The terrain spans the bottom of the landscape. Upper half is sky/air.
 * Hopper drops pieces from upper-left, they fall to the lower-left
 * pile area. Terrain rises from left to right, with the processing
 * column sunk into the hilltop on the right side.
 *
 * Physics: staircase of flat rectangles every 10px (bulletproof).
 */
import Phaser from 'phaser';
import { LANDSCAPE_WIDTH, LANDSCAPE_HEIGHT } from '../config';

/** Terrain surface profile — defines the ground from left to right */
export const TERRAIN_POINTS: Array<{ x: number; y: number }> = [
  { x: 0,    y: 950 },    // Far left — low area (pile zone)
  { x: 100,  y: 960 },    // Slight dip
  { x: 250,  y: 950 },    // Pile area
  { x: 400,  y: 930 },    // Start rising
  { x: 550,  y: 890 },    // Hill begins
  { x: 700,  y: 840 },    // Steeper
  { x: 850,  y: 790 },    // Approaching column
  { x: 950,  y: 760 },    // Just before column gap
  // --- Column gap 950–1200 ---
  { x: 1200, y: 760 },    // After column gap
  { x: 1350, y: 775 },    // Gentle slope right of column
  { x: 1500, y: 800 },    // Continues
  { x: 1700, y: 830 },    // Far right plateau
  { x: 2000, y: 850 },    // Right edge
];

export const COLUMN_GAP_LEFT = 950;
export const COLUMN_GAP_RIGHT = 1200;
export const COLUMN_GROUND_Y = 760;

export class Terrain {
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.createPhysicsStaircase();
    this.draw();
  }

  private createPhysicsStaircase(): void {
    const collisionFilter = { category: 0x0001, mask: 0x0002 | 0x0010 };
    const step = 10;
    const depth = 400;

    for (let x = 0; x < LANDSCAPE_WIDTH; x += step) {
      if (x >= COLUMN_GAP_LEFT && x < COLUMN_GAP_RIGHT) continue;

      const surfaceY = Terrain.getHeightAt(x + step / 2);

      this.scene.matter.add.rectangle(
        x + step / 2,
        surfaceY + depth / 2,
        step + 1,
        depth,
        { isStatic: true, label: 'terrain', friction: 0.8, collisionFilter },
      );
    }

    // Bridge over column gap (vehicle only)
    this.scene.matter.add.rectangle(
      (COLUMN_GAP_LEFT + COLUMN_GAP_RIGHT) / 2,
      COLUMN_GROUND_Y + 5,
      COLUMN_GAP_RIGHT - COLUMN_GAP_LEFT + 20, 15,
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
    g.lineBetween(COLUMN_GAP_LEFT, COLUMN_GROUND_Y, COLUMN_GAP_LEFT, COLUMN_GROUND_Y + 350);
    g.lineBetween(COLUMN_GAP_RIGHT, COLUMN_GROUND_Y, COLUMN_GAP_RIGHT, COLUMN_GROUND_Y + 350);

    g.setDepth(-1);
  }

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
