/**
 * Terrain — Hilly dump landscape
 *
 * LEARN: The terrain is defined as a series of surface points. For
 * physics, we create a chain of thin static rectangles along each
 * segment of the surface. This is more reliable than fromVertices()
 * which can shift bodies to their center of mass, causing visual
 * mismatch. Each segment is a rotated rectangle matching the slope.
 */
import Phaser from 'phaser';
import { LANDSCAPE_WIDTH, LANDSCAPE_HEIGHT } from '../config';

/** Terrain surface profile — left to right */
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
    this.createPhysicsSegments();
    this.draw();
  }

  /**
   * Create terrain as a chain of rotated static rectangles.
   * Each segment connects two adjacent terrain points.
   */
  private createPhysicsSegments(): void {
    const collisionFilter = { category: 0x0001, mask: 0x0002 | 0x0010 };
    const thickness = 30;

    /**
     * LEARN: An invisible bridge spans the column gap. It uses a special
     * collision category (0x0020) that ONLY the vehicle collides with.
     * Pieces (category 0x0002) ignore it completely and fall through
     * into the column. The vehicle drives right over the column opening.
     */
    const bridgeCategory = 0x0020; // Vehicle-only bridge
    const bridgeWidth = COLUMN_GAP_RIGHT - COLUMN_GAP_LEFT + 20; // Slight overlap
    this.scene.matter.add.rectangle(
      (COLUMN_GAP_LEFT + COLUMN_GAP_RIGHT) / 2,
      COLUMN_GROUND_Y + 5, // Just below the surface line
      bridgeWidth,
      15, // Thin
      {
        isStatic: true,
        label: 'column-bridge',
        friction: 0.8,
        collisionFilter: {
          category: bridgeCategory,
          mask: 0x0010, // Only collides with vehicle
        },
      },
    );

    for (let i = 0; i < TERRAIN_POINTS.length - 1; i++) {
      const a = TERRAIN_POINTS[i]!;
      const b = TERRAIN_POINTS[i + 1]!;

      // Skip the column gap
      if (a.x <= COLUMN_GAP_LEFT && b.x >= COLUMN_GAP_RIGHT) continue;
      if (a.x >= COLUMN_GAP_LEFT && a.x < COLUMN_GAP_RIGHT) continue;

      const midX = (a.x + b.x) / 2;
      const midY = (a.y + b.y) / 2;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const length = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);

      // Position the rectangle so its TOP surface aligns with the terrain line.
      // The rectangle center needs to be offset downward by half the thickness,
      // perpendicular to the segment slope (not just straight down).
      const perpX = -Math.sin(angle + Math.PI / 2) * (thickness / 2);
      const perpY = Math.cos(angle + Math.PI / 2) * (thickness / 2);
      const seg = this.scene.matter.add.rectangle(
        midX + perpX, midY + perpY,
        length + 4, thickness,
        {
          isStatic: true,
          angle,
          label: 'terrain',
          friction: 0.8,
          collisionFilter,
        },
      );
      // Prevent rotation (it's static, but just in case)
      void seg;
    }
  }

  /** Draw the terrain — fill and surface line */
  private draw(): void {
    const g = this.scene.add.graphics();

    // Fill below terrain surface
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
      // Don't draw across the column gap
      if (a.x <= COLUMN_GAP_LEFT && b.x >= COLUMN_GAP_RIGHT) continue;
      g.lineBetween(a.x, a.y, b.x, b.y);
    }

    // Column gap edges
    g.lineStyle(2, 0x444466);
    g.lineBetween(COLUMN_GAP_LEFT, COLUMN_GROUND_Y, COLUMN_GAP_LEFT, COLUMN_GROUND_Y + 400);
    g.lineBetween(COLUMN_GAP_RIGHT, COLUMN_GROUND_Y, COLUMN_GAP_RIGHT, COLUMN_GROUND_Y + 400);

    g.setDepth(-1);
  }

  /** Get terrain height at a given X position */
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
