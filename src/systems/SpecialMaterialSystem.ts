/**
 * SpecialMaterialSystem — Dispatches collision events to material-specific handlers
 *
 * LEARN: This is the "Strategy pattern" in action. Instead of a giant
 * if/else chain checking each material type, we register handler functions
 * keyed by material name. When a collision happens, we look up the handler
 * and call it. To add a new special material, you just register a new handler
 * — no changes to this file needed.
 *
 * Why a separate system? Collision handling is expensive. We listen to
 * Matter.js collision events ONCE here, filter for pieces, check if the
 * material has a special handler, and only then do the expensive work.
 * Without this, every system would need its own collision listener.
 */
import Phaser from 'phaser';
import { getPieceData, type PieceUserData } from '../pieces/PieceFactory';
import { PieceRenderer } from './PieceRenderer';

/** Info passed to a material's collision handler */
export interface CollisionInfo {
  /** The piece body that collided */
  body: MatterJS.BodyType;
  /** The game data attached to the piece */
  data: PieceUserData;
  /** The other body it collided with */
  otherBody: MatterJS.BodyType;
  /** World-space collision point */
  contactPoint: { x: number; y: number };
  /** Collision normal (direction of impact) */
  normal: { x: number; y: number };
  /** Approximate impact force (depth * velocity) */
  impactForce: number;
}

/**
 * A handler function for a special material.
 * Returns an array of new bodies that replace the original (or empty to do nothing).
 */
export type MaterialCollisionHandler = (
  info: CollisionInfo,
  scene: Phaser.Scene,
  renderer: PieceRenderer,
) => MatterJS.BodyType[];

export class SpecialMaterialSystem {
  private scene: Phaser.Scene;
  private renderer: PieceRenderer;
  private handlers: Map<string, MaterialCollisionHandler> = new Map();

  /**
   * LEARN: We track which bodies have already been processed this frame
   * to prevent double-handling. Matter.js can fire multiple collision
   * events for the same body pair in a single physics step (one per
   * contact point). Without this guard, glass could try to shatter twice.
   */
  private processedThisFrame: Set<number> = new Set();

  constructor(scene: Phaser.Scene, renderer: PieceRenderer) {
    this.scene = scene;
    this.renderer = renderer;
    this.setupCollisionListener();
  }

  /** Register a handler for a material key (e.g., "glass") */
  registerHandler(materialKey: string, handler: MaterialCollisionHandler): void {
    this.handlers.set(materialKey, handler);
  }

  /** Clear the per-frame dedup set — call at the start of each update() */
  resetFrame(): void {
    this.processedThisFrame.clear();
  }

  /**
   * LEARN: Matter.js fires 'collisionstart' when two bodies first touch.
   * Each event contains pairs of colliding bodies. We check both sides
   * of each pair — body A might be glass hitting a wall, or a wall
   * being hit by glass. Either way we want to handle it.
   *
   * We use 'collisionstart' (not 'collisionactive') because we only
   * want to trigger once per impact, not every frame bodies are touching.
   */
  private setupCollisionListener(): void {
    this.scene.matter.world.on(
      'collisionstart',
      (event: { pairs: Array<{ bodyA: MatterJS.BodyType; bodyB: MatterJS.BodyType; collision: MatterJS.ICollisionData }> }) => {
        for (const pair of event.pairs) {
          this.handlePair(pair.bodyA, pair.bodyB, pair.collision);
          this.handlePair(pair.bodyB, pair.bodyA, pair.collision);
        }
      },
    );
  }

  private handlePair(
    body: MatterJS.BodyType,
    otherBody: MatterJS.BodyType,
    collision: MatterJS.ICollisionData,
  ): void {
    // Skip if already processed this frame
    if (this.processedThisFrame.has(body.id)) return;

    // Get piece data — skip if not a piece or no material
    const data = getPieceData(body);
    if (!data) return;

    // Check if this material has a special handler
    const handler = this.handlers.get(data.materialKey);
    if (!handler) return;

    /**
     * LEARN: Impact force approximation. Matter.js doesn't directly give
     * us "force" from a collision, but we can estimate it from:
     * - collision.depth: how far the bodies overlapped (penetration depth)
     * - body velocity: how fast the body was moving at impact
     *
     * Multiplying these gives a rough "impact energy" — enough to decide
     * if glass should shatter (high impact) or just clink (low impact).
     */
    const vel = body.velocity;
    const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);
    const impactForce = (collision.depth ?? 0) * speed;

    const supports = collision.supports ?? [];
    const contactPoint = supports.length > 0
      ? { x: supports[0]!.x, y: supports[0]!.y }
      : { x: body.position.x, y: body.position.y };

    const normal = collision.normal
      ? { x: collision.normal.x, y: collision.normal.y }
      : { x: 0, y: -1 };

    // Mark as processed before handling (handler might destroy the body)
    this.processedThisFrame.add(body.id);

    const newBodies = handler(
      { body, data, otherBody, contactPoint, normal, impactForce },
      this.scene,
      this.renderer,
    );

    // If handler returned new bodies, track them for rendering
    for (const newBody of newBodies) {
      this.renderer.addBody(newBody);
    }
  }
}
