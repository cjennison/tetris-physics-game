/**
 * PieceRenderer — Draws piece bodies using Phaser Graphics
 *
 * LEARN: In a physics-based game, the visual representation must follow
 * the physics body every frame. Unlike sprite-based games where you
 * set a position once, here we redraw every piece every frame based
 * on its current physics body position and rotation.
 *
 * Matter.js bodies store their shape as an array of vertices (body.vertices).
 * For compound bodies (concave shapes that were auto-decomposed), the
 * vertices are spread across body.parts[]. We iterate all parts and
 * draw each one as a filled polygon.
 *
 * This is separate from the game systems because it's purely visual —
 * it doesn't affect physics or game logic. Keeping rendering separate
 * means we can swap rendering strategies later (e.g., cached textures
 * instead of live drawing) without touching gameplay code.
 */
import Phaser from 'phaser';
import { getPieceData } from '../pieces/PieceFactory';

export class PieceRenderer {
  private graphics: Phaser.GameObjects.Graphics;

  /** All piece bodies we're tracking for rendering */
  private bodies: Set<MatterJS.BodyType> = new Set();

  constructor(scene: Phaser.Scene) {
    this.graphics = scene.add.graphics();
    // Render on top of walls but below UI
    this.graphics.setDepth(5);
  }

  /** Start tracking a body for rendering */
  addBody(body: MatterJS.BodyType): void {
    this.bodies.add(body);
  }

  /** Stop tracking a body (e.g., when destroyed by laser) */
  removeBody(body: MatterJS.BodyType): void {
    this.bodies.delete(body);
  }

  /**
   * Redraw all pieces. Called every frame from GameInstance.update().
   *
   * LEARN: body.parts[0] is the parent body (the whole compound shape).
   * body.parts[1..n] are the convex sub-parts that Matter decomposed.
   * For simple convex shapes, parts has just one element (the body itself).
   * We skip parts[0] if there are sub-parts to avoid drawing the outline
   * of the full compound shape AND each sub-part.
   */
  draw(): void {
    this.graphics.clear();

    for (const body of this.bodies) {
      const data = getPieceData(body);
      const color = data?.color ?? 0xaaaaaa;

      // Determine which parts to draw
      const parts = body.parts.length > 1 ? body.parts.slice(1) : body.parts;

      for (const part of parts) {
        const verts = part.vertices;
        if (!verts || verts.length < 3) continue;

        // Fill
        this.graphics.fillStyle(color, 0.85);
        this.graphics.beginPath();
        this.graphics.moveTo(verts[0]!.x, verts[0]!.y);
        for (let i = 1; i < verts.length; i++) {
          this.graphics.lineTo(verts[i]!.x, verts[i]!.y);
        }
        this.graphics.closePath();
        this.graphics.fillPath();

        // Outline for visual definition
        this.graphics.lineStyle(1.5, 0xffffff, 0.3);
        this.graphics.beginPath();
        this.graphics.moveTo(verts[0]!.x, verts[0]!.y);
        for (let i = 1; i < verts.length; i++) {
          this.graphics.lineTo(verts[i]!.x, verts[i]!.y);
        }
        this.graphics.closePath();
        this.graphics.strokePath();
      }
    }
  }
}
