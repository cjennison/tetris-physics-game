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
import { type SpawnedPiece } from '../../pieces/PieceFactory';

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

      const dx = hookPos.x - body.position.x;
      const dy = hookPos.y - body.position.y;
      const distSq = dx * dx + dy * dy;
      const dist = Math.sqrt(distSq);

      if (dist > MAGNET_RADIUS || dist < 1) continue;

      /**
       * LEARN: Force = MAGNET_FORCE / distance — linear falloff.
       * True magnetism is inverse-square, but linear feels better
       * in a game because pieces at the edge still move noticeably.
       * We normalize the direction vector (dx/dist, dy/dist) and
       * scale by the force magnitude.
       */
      const forceMag = MAGNET_FORCE / Math.max(dist * 0.02, 0.5);
      const fx = (dx / dist) * forceMag;
      const fy = (dy / dist) * forceMag;

      // Apply force at the body's center of mass
      const parent = (body as MatterJS.BodyType & { parent?: MatterJS.BodyType }).parent ?? body;
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

  cleanup(): void {
    this.magnetOn = false;
    this.attractedBodies = [];
  }
}
