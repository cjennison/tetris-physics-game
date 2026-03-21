/**
 * Terrain — Hilly dump landscape
 *
 * LEARN: The terrain uses Bodies.fromVertices for each section — one
 * left of the column gap, one right. Each body is a polygon that traces
 * the terrain surface on top and extends deep below. This guarantees
 * the physics surface matches the visual surface exactly.
 *
 * The trick: fromVertices shifts bodies to their centroid, so we
 * create the body, check where Matter placed it, then reposition
 * it to where we actually want it.
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
    this.createTerrainBodies();
    this.draw();
  }

  private createTerrainBodies(): void {
    const collisionFilter = { category: 0x0001, mask: 0x0002 | 0x0010 };
    const bottom = LANDSCAPE_HEIGHT + 100;

    // Split terrain points into left-of-gap and right-of-gap
    const leftPoints = TERRAIN_POINTS.filter(p => p.x <= COLUMN_GAP_LEFT);
    const rightPoints = TERRAIN_POINTS.filter(p => p.x >= COLUMN_GAP_RIGHT);

    if (leftPoints.length >= 2) {
      this.createSection(leftPoints, bottom, collisionFilter);
    }
    if (rightPoints.length >= 2) {
      this.createSection(rightPoints, bottom, collisionFilter);
    }
  }

  /**
   * Create a terrain section from surface points.
   *
   * LEARN: We build a polygon: surface points left→right, then bottom
   * edge right→left. fromVertices() shifts the body to its centroid,
   * so we compute where we WANT the centroid to be, create the body,
   * then correct the position offset.
   */
  private createSection(
    points: Array<{ x: number; y: number }>,
    bottom: number,
    collisionFilter: { category: number; mask: number },
  ): void {
    // Build closed polygon vertices
    const verts: Array<{ x: number; y: number }> = [];
    for (const p of points) verts.push({ x: p.x, y: p.y });
    verts.push({ x: points[points.length - 1]!.x, y: bottom });
    verts.push({ x: points[0]!.x, y: bottom });

    // Compute the centroid of our desired polygon
    let cx = 0, cy = 0;
    for (const v of verts) { cx += v.x; cy += v.y; }
    cx /= verts.length;
    cy /= verts.length;

    // Convert to local coords for fromVertices
    const localVerts = verts.map(v => ({ x: v.x - cx, y: v.y - cy }));

    const body = this.scene.matter.add.fromVertices(
      cx, cy, [localVerts],
      {
        isStatic: true,
        label: 'terrain',
        friction: 0.8,
        collisionFilter,
      },
      true,
    );

    // fromVertices places the body at the centroid of the DECOMPOSED shape,
    // which may differ from our computed centroid. Correct the offset.
    const actualX = body.position.x;
    const actualY = body.position.y;
    const offsetX = cx - actualX;
    const offsetY = cy - actualY;

    if (Math.abs(offsetX) > 1 || Math.abs(offsetY) > 1) {
      this.scene.matter.body.setPosition(body, {
        x: actualX + offsetX,
        y: actualY + offsetY,
      });
    }
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
