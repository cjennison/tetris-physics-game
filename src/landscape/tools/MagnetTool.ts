/**
 * MagnetTool — Electromagnetic crane attachment that attracts nearby pieces
 *
 * LEARN: Unlike the hook which grabs one piece with a constraint, the magnet
 * applies a continuous attractive force to ALL pieces within its radius.
 * This uses Matter.js Body.applyForce() each frame — the force falls off
 * with distance (inverse square law, like real magnetism).
 *
 * Toggle on/off with the action button. When on, pieces drift toward the
 * magnet. When off, they fall naturally. The magnet doesn't "hold" pieces
 * rigidly — they cluster around the hook point but can still be knocked loose.
 */
import Phaser from 'phaser';
import { type CraneTool } from './CraneTool';
import { type SpawnedPiece, getPieceData } from '../../pieces/PieceFactory';

/**
 * LEARN: Only metals are magnetic. Rubber, concrete, and glass don't
 * respond to magnets in real life, so we skip them. This set defines
 * which materials the magnet ignores.
 */
const NON_MAGNETIC = new Set(['rubber', 'concrete', 'glass']);

const MAGNET_RADIUS = 180;
const MAGNET_FORCE = 0.015;

export class MagnetTool implements CraneTool {
  readonly name = 'Magnet';
  readonly color = 0xff4444;
  readonly icon = '🧲';

  private magnetOn = false;
  private attractedBodies: MatterJS.BodyType[] = [];

  activate(): void {
    /**
     * LEARN: The magnet toggles on/off instead of grab/release.
     * When toggled on, the update() loop handles the physics.
     */
    this.magnetOn = !this.magnetOn;
    if (!this.magnetOn) {
      this.attractedBodies = [];
    }
  }

  update(
    scene: Phaser.Scene,
    hookBody: MatterJS.BodyType,
    allBodies: MatterJS.BodyType[],
    vehicleBodies: Set<MatterJS.BodyType>,
  ): void {
    if (!this.magnetOn) return;

    const hookPos = hookBody.position;
    this.attractedBodies = [];

    for (const body of allBodies) {
      if (body.isStatic) continue;
      if (!body.label?.startsWith('piece-')) continue;
      if (vehicleBodies.has(body)) continue;

      // Skip non-magnetic materials
      const parent = (body as MatterJS.BodyType & { parent?: MatterJS.BodyType }).parent ?? body;
      const pieceData = getPieceData(parent);
      if (pieceData && NON_MAGNETIC.has(pieceData.materialKey)) continue;

      const dx = hookPos.x - body.position.x;
      const dy = hookPos.y - body.position.y;
      const distSq = dx * dx + dy * dy;
      const dist = Math.sqrt(distSq);

      if (dist > MAGNET_RADIUS || dist < 1) continue;

      /**
       * LEARN: Force = MAGNET_FORCE * mass / distance — mass-normalized.
       * Without mass scaling, heavy pieces (lead, density=0.008) barely
       * budge while light pieces (aluminum, 0.0015) fly. Multiplying by
       * mass makes F=ma give roughly equal acceleration regardless of
       * material weight. Non-magnetic materials (rubber, concrete, glass)
       * are skipped via the material check above.
       */
      const forceMag = MAGNET_FORCE * parent.mass / Math.max(dist * 0.02, 0.5);
      const fx = (dx / dist) * forceMag;
      const fy = (dy / dist) * forceMag;

      // Apply force at the body's center of mass
      scene.matter.body.applyForce(parent, parent.position, { x: fx, y: fy });
      this.attractedBodies.push(parent);
    }
  }

  getCarriedPiece(): SpawnedPiece | null {
    // Magnet doesn't "carry" a specific piece — it attracts many
    return null;
  }

  getCarriedBody(): MatterJS.BodyType | null {
    return null;
  }

  /** Returns the bodies currently being attracted (for visual effects) */
  getAttractedBodies(): MatterJS.BodyType[] {
    return this.attractedBodies;
  }

  isActive(): boolean {
    return this.magnetOn;
  }

  /**
   * LEARN: The magnet draws as a horseshoe/U-shape in red and blue
   * (the two poles). When active, it pulses with a glow effect and
   * shows small spark particles near the poles. The pulsing uses
   * Math.sin(time) for a smooth oscillation — a common "juice" trick.
   */
  drawTool(
    graphics: Phaser.GameObjects.Graphics,
    hookX: number,
    hookY: number,
    active: boolean,
    time: number,
  ): void {
    const pulse = active ? 0.7 + 0.3 * Math.sin(time * 0.006) : 0.8;

    // Horseshoe magnet body — U shape drawn as two vertical bars + connecting arc
    const w = 12;   // total width of the U
    const h = 14;   // height of the legs
    const t = 3.5;  // thickness of the bars

    // Left leg (north pole — red)
    graphics.fillStyle(0xdd3333, pulse);
    graphics.fillRect(hookX - w / 2, hookY - 2, t, h);

    // Right leg (south pole — blue)
    graphics.fillStyle(0x3333dd, pulse);
    graphics.fillRect(hookX + w / 2 - t, hookY - 2, t, h);

    // Connecting arc at top (gray metal)
    graphics.lineStyle(t, 0x888888, pulse);
    graphics.beginPath();
    graphics.arc(hookX, hookY - 2, w / 2 - t / 2, Math.PI, 0, false);
    graphics.strokePath();

    // Pole tips — bright colored ends at the bottom of each leg
    graphics.fillStyle(0xff5555, pulse);
    graphics.fillRect(hookX - w / 2 - 1, hookY + h - 4, t + 2, 3);
    graphics.fillStyle(0x5555ff, pulse);
    graphics.fillRect(hookX + w / 2 - t - 1, hookY + h - 4, t + 2, 3);

    // Active effects — electric sparks between poles
    if (active) {
      const sparkAlpha = 0.4 + 0.4 * Math.sin(time * 0.015);

      // Spark arc between poles
      graphics.lineStyle(1, 0xffff44, sparkAlpha);
      const midY = hookY + h - 2;
      const sparkOffsetX = 3 * Math.sin(time * 0.008);
      const sparkOffsetY = 2 * Math.cos(time * 0.012);
      graphics.lineBetween(
        hookX - w / 2 + 1, midY,
        hookX + sparkOffsetX, midY + sparkOffsetY - 3,
      );
      graphics.lineBetween(
        hookX + sparkOffsetX, midY + sparkOffsetY - 3,
        hookX + w / 2 - 1, midY,
      );

      // Small field dots radiating outward
      const dotCount = 4;
      for (let i = 0; i < dotCount; i++) {
        const angle = (time * 0.003) + (i * Math.PI * 2 / dotCount);
        const radius = 10 + 5 * Math.sin(time * 0.005 + i);
        const dx = Math.cos(angle) * radius;
        const dy = Math.sin(angle) * radius + h / 2;
        graphics.fillStyle(0xff6666, 0.3 + 0.2 * Math.sin(time * 0.01 + i));
        graphics.fillCircle(hookX + dx, hookY + dy, 1.5);
      }
    }
  }

  cleanup(): void {
    this.magnetOn = false;
    this.attractedBodies = [];
  }
}
