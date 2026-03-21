/**
 * TRASH Game — Shared Type Definitions
 *
 * LEARN: In game dev, you define your data shapes upfront so every system
 * agrees on what a "piece", "action", or "board config" looks like.
 * This prevents bugs where one system expects { x, y } and another sends { pos }.
 */

/** Actions that can be performed on a game board — by human OR AI */
export interface GameActions {
  /** Target X position for the crane (0.0 = left edge, 1.0 = right edge) */
  horizontalTarget: number;
  /** True on the frame the player wants to drop the piece */
  drop: boolean;
}

/** Configuration for a single game board instance */
export interface BoardConfig {
  /** Board ID — unique per instance */
  id: string;
  /** Viewport position (pixels from left of canvas) */
  x: number;
  /** Viewport position (pixels from top of canvas) */
  y: number;
  /** Board width in pixels */
  width: number;
  /** Board height in pixels */
  height: number;
  /** Number of laser lines */
  laserCount: number;
  /** Who controls this board */
  controller: 'human' | 'ai';
}

/** The state machine for a single game board */
export type GameState =
  | 'waiting'     // Waiting for a piece to be delivered
  | 'spawning'    // Legacy — treated as waiting
  | 'swinging'    // Player controlling crane, piece swinging
  | 'dropping'    // Piece released, falling
  | 'settling'    // Legacy — not used (1s timer instead)
  | 'laser_check' // Checking laser coverage
  | 'game_over';  // Pile reached crane height

/** A piece shape definition — vertices in local coordinates */
export interface PieceDefinition {
  /** Display name (e.g., "T-Block", "L-Block") */
  name: string;
  /** Flat vertex array [x1,y1, x2,y2, ...] — counter-clockwise winding */
  vertices: number[];
  /** Color for rendering */
  color: number;
}

/**
 * Material properties — affects how a piece behaves physically.
 *
 * LEARN: In real physics, material determines density, friction, and bounciness.
 * In TRASH, materials also affect the crane rope behavior. A heavy lead piece
 * barely swings because the rope is stiffer and more damped. A light aluminum
 * piece swings wildly. This adds a layer of strategy — you need different
 * timing for different materials.
 */
export interface MaterialDefinition {
  label: string;
  /** Fill color as hex string "0xRRGGBB" — parsed to number at runtime */
  color: string;
  /** Outline color as hex string "0xRRGGBB" */
  outlineColor: string;
  density: number;
  restitution: number;
  friction: number;
  frictionStatic: number;
  /** Air resistance — slows pieces during fall and reduces spinning */
  frictionAir: number;
  /** Overrides crane rope stiffness for this material */
  ropeStiffness: number;
  /** Overrides crane rope damping for this material */
  ropeDamping: number;
  /** Display weight (1-10 scale, for UI) */
  weight: number;
  /** Optional: marks this as a special material with custom behavior (e.g., "glass") */
  special?: string;
}

/** Collision categories — bit flags for Matter.js filtering */
export const CollisionCategory = {
  WALL:   0x0001,
  PIECE:  0x0002,
  CRANE:  0x0004,
  SENSOR: 0x0008,
} as const;
