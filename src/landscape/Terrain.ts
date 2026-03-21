/**
 * Terrain — Hilly ground surface for the dump landscape
 *
 * LEARN: Instead of a flat ground, we create a bumpy terrain using
 * Matter.js fromVertices with a polygon that traces the ground profile.
 * The vehicle drives over these hills. The terrain has:
 * - A low area on the left where the pipe drops trash
 * - A hill rising toward the right
 * - A plateau/hilltop where the processing column is dug in
 *
 * The terrain is defined as a series of (x, y) points that trace the
 * surface. We create a thick polygon from these by extending down to
 * a flat bottom, creating a solid ground body.
 */
import Phaser from 'phaser';
import { LANDSCAPE_WIDTH, LANDSCAPE_HEIGHT } from '../config';

/** The terrain surface profile — (x, y) points from left to right */
export const TERRAIN_POINTS: Array<{ x: number; y: number }> = [
  { x: 0,    y: 520 },    // Left edge — low dump area
  { x: 80,   y: 525 },    // Slight dip under the pipe
  { x: 180,  y: 515 },    // Pile area
  { x: 280,  y: 500 },    // Start rising
  { x: 360,  y: 470 },    // Hill begins
  { x: 440,  y: 430 },    // Steep section
  { x: 500,  y: 410 },    // Approaching column
  { x: 540,  y: 395 },    // Just before column gap
  // --- GAP for column (540 to 740) ---
  { x: 740,  y: 395 },    // After column gap
  { x: 800,  y: 405 },    // Slight rise after column
  { x: 900,  y: 420 },    // Gentle slope down
  { x: 1000, y: 440 },    // Continues down
  { x: 1100, y: 450 },    // Far right area
  { x: 1200, y: 455 },    // Right edge
];

/** Column gap boundaries */
export const COLUMN_GAP_LEFT = 540;
export const COLUMN_GAP_RIGHT = 740;
export const COLUMN_GROUND_Y = 395; // Y at the column gap edges

export class Terrain {
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.createPhysicsBodies();
    this.draw();
  }

  /**
   * Create terrain physics — split into segments with a gap for the column.
   *
   * LEARN: Matter.js fromVertices works best with convex shapes. For a
   * long bumpy terrain, we split it into two chunks (left of column gap,
   * right of column gap). Each chunk is a polygon: surface points on top,
   * straight bottom edge.
   */
  private createPhysicsBodies(): void {
    const collisionFilter = { category: 0x0001, mask: 0x0002 | 0x0010 };
    const bottom = LANDSCAPE_HEIGHT + 50; // Well below visible area

    // Left terrain (points before the column gap)
    const leftPoints = TERRAIN_POINTS.filter(p => p.x <= COLUMN_GAP_LEFT);
    if (leftPoints.length >= 2) {
      this.createTerrainBody(leftPoints, bottom, collisionFilter);
    }

    // Right terrain (points after the column gap)
    const rightPoints = TERRAIN_POINTS.filter(p => p.x >= COLUMN_GAP_RIGHT);
    if (rightPoints.length >= 2) {
      this.createTerrainBody(rightPoints, bottom, collisionFilter);
    }
  }

  private createTerrainBody(
    surfacePoints: Array<{ x: number; y: number }>,
    bottom: number,
    collisionFilter: { category: number; mask: number },
  ): void {
    // Build a closed polygon: surface left→right, then bottom right→left
    const verts: Array<{ x: number; y: number }> = [];

    // Surface points
    for (const p of surfacePoints) {
      verts.push({ x: p.x, y: p.y });
    }

    // Bottom edge (right to left)
    const lastX = surfacePoints[surfacePoints.length - 1]!.x;
    const firstX = surfacePoints[0]!.x;
    verts.push({ x: lastX, y: bottom });
    verts.push({ x: firstX, y: bottom });

    // Compute centroid for positioning
    let cx = 0, cy = 0;
    for (const v of verts) { cx += v.x; cy += v.y; }
    cx /= verts.length;
    cy /= verts.length;

    // Convert to local coords
    const localVerts = verts.map(v => ({ x: v.x - cx, y: v.y - cy }));

    this.scene.matter.add.fromVertices(
      cx, cy, [localVerts],
      {
        isStatic: true,
        label: 'terrain',
        friction: 0.8,
        collisionFilter,
      },
      true,
    );
  }

  /** Draw the terrain visually */
  private draw(): void {
    const g = this.scene.add.graphics();

    // Fill below the terrain surface
    g.fillStyle(0x2a2a35);
    g.beginPath();
    g.moveTo(TERRAIN_POINTS[0]!.x, TERRAIN_POINTS[0]!.y);
    for (let i = 1; i < TERRAIN_POINTS.length; i++) {
      // Skip the gap — draw it as a straight line across
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
      // Don't draw the line across the column gap
      if (a.x <= COLUMN_GAP_LEFT && b.x >= COLUMN_GAP_RIGHT) continue;
      g.lineBetween(a.x, a.y, b.x, b.y);
    }

    // Column gap edges (vertical lines down from surface)
    g.lineStyle(2, 0x444466);
    g.lineBetween(COLUMN_GAP_LEFT, COLUMN_GROUND_Y, COLUMN_GAP_LEFT, COLUMN_GROUND_Y + 400);
    g.lineBetween(COLUMN_GAP_RIGHT, COLUMN_GROUND_Y, COLUMN_GAP_RIGHT, COLUMN_GROUND_Y + 400);

    g.setDepth(-1);
  }

  /** Get the Y position of the terrain at a given X (for vehicle positioning) */
  static getHeightAt(x: number): number {
    // Find the two points that bracket this X
    for (let i = 0; i < TERRAIN_POINTS.length - 1; i++) {
      const a = TERRAIN_POINTS[i]!;
      const b = TERRAIN_POINTS[i + 1]!;
      if (x >= a.x && x <= b.x) {
        // Linear interpolation
        const t = (x - a.x) / (b.x - a.x);
        return a.y + t * (b.y - a.y);
      }
    }
    // Fallback
    return TERRAIN_POINTS[TERRAIN_POINTS.length - 1]!.y;
  }
}
