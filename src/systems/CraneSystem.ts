/**
 * CraneSystem — Trolley, rope, hook, and piece attachment
 *
 * LEARN: The crane has 3 permanent parts and 1 temporary connection:
 *
 *   Trolley (static) --[rope]--> Hook (dynamic) --[clip]--> Piece
 *   \_________permanent__________/  \____temporary____/
 *
 * The TROLLEY slides along the rail (kinematic — moved by code).
 * The ROPE is a constraint connecting the trolley to the HOOK.
 * The HOOK is a tiny dynamic body that swings freely on the rope.
 * The CLIP is a short, stiff constraint connecting the hook to the piece.
 *
 * When a piece is dropped or destroyed (glass shatter), only the CLIP
 * is removed. The hook stays on the rope, swinging naturally. This means:
 * - The rope visually keeps swinging after glass shatters on a wall
 * - The hook's momentum carries into the next piece when one is attached
 * - The rope is its own persistent entity, not tied to any specific piece
 */
import Phaser from 'phaser';
import {
  WALL_THICKNESS,
} from '../config';
import { TUNING } from '../tuning';
import { GameActions, MaterialDefinition, CollisionCategory } from '../types';

export class CraneSystem {
  private scene: Phaser.Scene;

  /** The trolley — a static body that slides along the rail */
  private trolley: MatterJS.BodyType;

  /**
   * The hook — a tiny dynamic body at the end of the rope.
   * This is permanent and always exists while the crane is alive.
   */
  private hook: MatterJS.BodyType;

  /** The rope — permanent constraint between trolley and hook */
  private rope: MatterJS.ConstraintType;

  /** The clip — temporary constraint between hook and piece (null when no piece attached) */
  private clip: MatterJS.ConstraintType | null = null;

  /** The body currently clipped to the hook */
  private attachedBody: MatterJS.BodyType | null = null;

  /** Current trolley X position (pixels) */
  private trolleyX: number;

  /** Graphics for rendering the crane visuals */
  private graphics: Phaser.GameObjects.Graphics;

  /** Play area bounds */
  private playLeft: number;
  private playRight: number;

  constructor(scene: Phaser.Scene, boardWidth: number) {
    this.scene = scene;
    this.playLeft = WALL_THICKNESS;
    this.playRight = boardWidth - WALL_THICKNESS;
    this.trolleyX = boardWidth / 2;

    const railY = TUNING.crane.railY;
    const ropeLength = TUNING.crane.ropeLength;

    // Create the trolley body — static, moves by code
    this.trolley = scene.matter.add.rectangle(
      this.trolleyX,
      railY,
      30,
      10,
      {
        isStatic: true,
        label: 'crane-trolley',
        collisionFilter: {
          category: CollisionCategory.CRANE,
          mask: 0,
        },
      },
    );

    // Create the hook — tiny dynamic body at rope end
    this.hook = scene.matter.add.circle(
      this.trolleyX,
      railY + ropeLength,
      3, // tiny radius
      {
        label: 'crane-hook',
        density: 0.004,
        frictionAir: 0.01,
        collisionFilter: {
          category: CollisionCategory.CRANE,
          mask: 0, // Hook doesn't collide with anything
        },
      },
    );

    // Create the permanent rope: trolley → hook
    this.rope = scene.matter.add.constraint(
      this.trolley,
      this.hook,
      ropeLength,
      TUNING.crane.ropeStiffness,
      {
        damping: TUNING.crane.ropeDamping,
        label: 'crane-rope',
      },
    );

    this.graphics = scene.add.graphics();
  }

  /**
   * Attach a piece to the hook via a short, stiff clip constraint.
   *
   * LEARN: The clip is much shorter and stiffer than the rope. It
   * acts like a carabiner — rigidly connecting the piece to the hook
   * so they move as one unit. Material-specific rope tuning now affects
   * the ROPE (trolley→hook), not the clip, because the rope is what
   * determines the pendulum feel.
   */
  attachPiece(body: MatterJS.BodyType, material?: MaterialDefinition): void {
    // Detach any existing piece first
    if (this.clip) {
      this.scene.matter.world.removeConstraint(this.clip);
      this.clip = null;
      this.attachedBody = null;
    }

    // Update rope tuning based on material
    const ropeStiffness = material?.ropeStiffness ?? TUNING.crane.ropeStiffness;
    const ropeDamping = material?.ropeDamping ?? TUNING.crane.ropeDamping;
    this.rope.stiffness = ropeStiffness;
    this.rope.damping = ropeDamping;

    // Position the piece at the hook
    this.scene.matter.body.setPosition(body, {
      x: this.hook.position.x,
      y: this.hook.position.y + 15, // Slightly below the hook
    });

    // Match the hook's velocity so the piece doesn't jerk
    this.scene.matter.body.setVelocity(body, {
      x: this.hook.velocity.x,
      y: this.hook.velocity.y,
    });
    this.scene.matter.body.setAngularVelocity(body, 0);

    // Create the clip: hook → piece (short, very stiff)
    this.clip = this.scene.matter.add.constraint(
      this.hook,
      body,
      5,    // Very short — piece hangs right on the hook
      0.95, // Very stiff — piece and hook move as one
      {
        damping: 0.1,
        label: 'crane-clip',
      },
    );

    this.attachedBody = body;
  }

  /**
   * Drop the piece — remove the clip, let physics take over.
   * The hook stays on the rope and keeps swinging.
   */
  dropPiece(): MatterJS.BodyType | null {
    if (!this.clip || !this.attachedBody) return null;

    const body = this.attachedBody;

    // Remove the clip — piece keeps its velocity, hook keeps swinging
    this.scene.matter.world.removeConstraint(this.clip);
    this.clip = null;
    this.attachedBody = null;

    return body;
  }

  update(actions: GameActions): void {
    // If the attached piece was destroyed (e.g., glass shattered),
    // clean up the clip. The hook and rope stay intact.
    if (this.attachedBody && !this.scene.matter.world.getAllBodies().includes(this.attachedBody)) {
      if (this.clip) {
        this.scene.matter.world.removeConstraint(this.clip);
        this.clip = null;
      }
      this.attachedBody = null;
    }

    // Map normalized 0-1 to pixel coordinates within play area
    const targetX = this.playLeft + actions.horizontalTarget * (this.playRight - this.playLeft);

    // Lerp toward target
    this.trolleyX += (targetX - this.trolleyX) * TUNING.crane.lerpSpeed;

    // Clamp to play area
    this.trolleyX = Phaser.Math.Clamp(this.trolleyX, this.playLeft, this.playRight);

    // Move the static trolley
    this.scene.matter.body.setPosition(this.trolley, {
      x: this.trolleyX,
      y: TUNING.crane.railY,
    });
    this.scene.matter.body.setVelocity(this.trolley, { x: 0, y: 0 });

    // Redraw visuals
    this.draw();
  }

  /** Is a piece currently attached? */
  hasAttachedPiece(): boolean {
    return this.attachedBody !== null;
  }

  /** Get trolley X position */
  getTrolleyX(): number {
    return this.trolleyX;
  }

  /** Draw the crane trolley, rail, rope, and hook */
  private draw(): void {
    this.graphics.clear();

    const railY = TUNING.crane.railY;

    // Rail
    this.graphics.lineStyle(2, 0x88aaff, 0.8);
    this.graphics.lineBetween(
      this.playLeft, railY,
      this.playRight, railY,
    );

    // Trolley
    this.graphics.fillStyle(0x88aaff);
    this.graphics.fillRect(this.trolleyX - 15, railY - 5, 30, 10);

    // Rope: always drawn from trolley to hook (hook always exists)
    this.graphics.lineStyle(2, 0xcccccc, 0.6);
    this.graphics.lineBetween(
      this.trolleyX,
      railY,
      this.hook.position.x,
      this.hook.position.y,
    );

    // Hook dot
    this.graphics.fillStyle(0xcccccc);
    this.graphics.fillCircle(this.hook.position.x, this.hook.position.y, 3);

    // Clip line from hook to piece (if attached)
    if (this.attachedBody) {
      this.graphics.lineStyle(1, 0x999999, 0.4);
      this.graphics.lineBetween(
        this.hook.position.x,
        this.hook.position.y,
        this.attachedBody.position.x,
        this.attachedBody.position.y,
      );
    }
  }
}
