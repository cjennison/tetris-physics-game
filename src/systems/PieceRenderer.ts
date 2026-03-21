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

      /**
       * LEARN: Colors come from the material, not the piece shape.
       * This way an I-Block made of lead looks dark and heavy, while
       * the same shape in aluminum looks bright and light. The player
       * reads the material at a glance from the color alone.
       * Colors in tuning.json are hex strings ("0xC0C8D4") so they're
       * human-readable; we parse them to numbers here.
       */
      const fillColor = data?.material
        ? parseInt(data.material.color, 16)
        : 0xaaaaaa;
      const outlineColor = data?.material
        ? parseInt(data.material.outlineColor, 16)
        : 0xcccccc;

      /**
       * LEARN: Glass gets lower fill opacity so it looks translucent.
       * The "special" field in MaterialDefinition drives visual treatments
       * beyond just color. Future materials could have other visual effects
       * (e.g., glowing, pulsing, textured).
       */
      const isGlass = data?.material?.special === 'glass';
      const fillAlpha = isGlass ? 0.45 : 0.9;
      const outlineAlpha = isGlass ? 0.7 : 0.5;

      // Determine which parts to draw
      const parts = body.parts.length > 1 ? body.parts.slice(1) : body.parts;

      for (const part of parts) {
        const verts = part.vertices;
        if (!verts || verts.length < 3) continue;

        // Fill with material color
        this.graphics.fillStyle(fillColor, fillAlpha);
        this.graphics.beginPath();
        this.graphics.moveTo(verts[0]!.x, verts[0]!.y);
        for (let i = 1; i < verts.length; i++) {
          this.graphics.lineTo(verts[i]!.x, verts[i]!.y);
        }
        this.graphics.closePath();
        this.graphics.fillPath();

        // Outline in material's outline color
        this.graphics.lineStyle(isGlass ? 1 : 1.5, outlineColor, outlineAlpha);
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
