/**
 * CraneSystem — Trolley movement, rope constraint, pendulum physics
 *
 * LEARN: This is the core "feel" system of TRASH. The crane is a horizontal
 * trolley at the top of the board. A physics constraint (rope) connects it
 * to the active piece. When the trolley moves, the piece swings like a
 * pendulum because of inertia.
 *
 * Key physics concept: A Matter.js Constraint is like a spring connecting
 * two bodies. By making it fairly stiff (0.9) with very low damping (0.005),
 * the piece swings freely but doesn't stretch away from the trolley.
 * When the player drops, we simply REMOVE the constraint — the piece keeps
 * whatever velocity it had from swinging, plus gravity pulls it down.
 *
 * The trolley itself is a "static" body — it doesn't respond to forces.
 * We move it directly by setting its position. This is called a "kinematic"
 * body in game dev terms (moves by code, not by physics).
 */
import Phaser from 'phaser';
import {
  CRANE_RAIL_Y,
  CRANE_LERP,
  ROPE_LENGTH,
  ROPE_STIFFNESS,
  ROPE_DAMPING,
  WALL_THICKNESS,
} from '../config';
import { GameActions, CollisionCategory } from '../types';

export class CraneSystem {
  private scene: Phaser.Scene;

  /** The trolley — a static body that slides along the rail */
  private trolley: MatterJS.BodyType;

  /** The rope — a physics constraint between trolley and piece */
  private rope: MatterJS.ConstraintType | null = null;

  /** The body currently attached to the rope */
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

    // Create the trolley body — static so physics doesn't move it
    this.trolley = scene.matter.add.rectangle(
      this.trolleyX,
      CRANE_RAIL_Y,
      30,
      10,
      {
        isStatic: true,
        label: 'crane-trolley',
        collisionFilter: {
          category: CollisionCategory.CRANE,
          mask: 0, // Collides with nothing
        },
      },
    );

    this.graphics = scene.add.graphics();
  }

  /**
   * Attach a piece body to the crane rope.
   *
   * LEARN: Matter.Constraint creates a spring-like connection between two
   * bodies (or a body and a fixed point). The key parameters:
   * - stiffness: How rigid (1 = rigid rod, 0 = very stretchy)
   * - damping: How quickly oscillation dies (0 = swings forever)
   * - length: Rest length of the constraint
   *
   * We set the piece's initial position to directly below the trolley,
   * then create the constraint. The piece will hang straight down until
   * the trolley starts moving.
   */
  attachPiece(body: MatterJS.BodyType): void {
    // Position the piece below the trolley
    this.scene.matter.body.setPosition(body, {
      x: this.trolleyX,
      y: CRANE_RAIL_Y + ROPE_LENGTH,
    });

    // Zero out any existing velocity
    this.scene.matter.body.setVelocity(body, { x: 0, y: 0 });
    this.scene.matter.body.setAngularVelocity(body, 0);

    // Create the rope constraint
    this.rope = this.scene.matter.add.constraint(
      this.trolley,
      body,
      ROPE_LENGTH,
      ROPE_STIFFNESS,
      {
        damping: ROPE_DAMPING,
        label: 'crane-rope',
      },
    );

    this.attachedBody = body;
  }

  /**
   * Drop the piece — remove the constraint, let physics take over.
   *
   * LEARN: When we remove the constraint, the piece retains its current
   * velocity vector. If it was swinging right, it continues moving right
   * AND starts falling due to gravity. This creates satisfying arcing
   * trajectories that reward timing skill.
   */
  dropPiece(): MatterJS.BodyType | null {
    if (!this.rope || !this.attachedBody) return null;

    const body = this.attachedBody;

    // Remove the rope — piece keeps its velocity
    this.scene.matter.world.removeConstraint(this.rope);
    this.rope = null;
    this.attachedBody = null;

    return body;
  }

  /**
   * Update crane position from input actions.
   *
   * LEARN: Lerp (linear interpolation) is the single most useful function
   * in game dev. Instead of teleporting to the target, we move a fraction
   * of the remaining distance each frame. This creates smooth, responsive
   * movement with natural acceleration and deceleration.
   *
   * Formula: current += (target - current) * lerpFactor
   *
   * With CRANE_LERP = 0.12, the trolley covers 12% of the remaining
   * distance each frame. Fast at first, slowing as it approaches the target.
   * This also amplifies the pendulum effect — the piece has inertia and
   * can't keep up with the trolley's quick starts.
   */
  update(actions: GameActions): void {
    // Map normalized 0-1 to pixel coordinates within play area
    const targetX = this.playLeft + actions.horizontalTarget * (this.playRight - this.playLeft);

    // Lerp toward target
    this.trolleyX += (targetX - this.trolleyX) * CRANE_LERP;

    // Clamp to play area
    this.trolleyX = Phaser.Math.Clamp(this.trolleyX, this.playLeft, this.playRight);

    // Move the static body (kinematic movement)
    this.scene.matter.body.setPosition(this.trolley, {
      x: this.trolleyX,
      y: CRANE_RAIL_Y,
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

  /** Draw the crane trolley, rail, and rope */
  private draw(): void {
    this.graphics.clear();

    // Rail
    this.graphics.lineStyle(2, 0x88aaff, 0.8);
    this.graphics.lineBetween(
      this.playLeft, CRANE_RAIL_Y,
      this.playRight, CRANE_RAIL_Y,
    );

    // Trolley
    this.graphics.fillStyle(0x88aaff);
    this.graphics.fillRect(this.trolleyX - 15, CRANE_RAIL_Y - 5, 30, 10);

    // Rope (line from trolley to attached piece)
    if (this.attachedBody) {
      this.graphics.lineStyle(2, 0xcccccc, 0.6);
      this.graphics.lineBetween(
        this.trolleyX,
        CRANE_RAIL_Y,
        this.attachedBody.position.x,
        this.attachedBody.position.y,
      );
    }
  }
}
