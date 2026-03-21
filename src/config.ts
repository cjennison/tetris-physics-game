/**
 * TRASH Game — Configuration
 *
 * LEARN: Centralizing config means you tweak numbers in ONE place.
 * During game dev you'll spend a LOT of time tuning these values.
 * Having them all here makes that fast.
 */
import Phaser from 'phaser';

/** Game canvas dimensions */
export const GAME_WIDTH = 480;
export const GAME_HEIGHT = 800;

/** Physics tuning */
export const GRAVITY_Y = 2.0;
export const CONSTRAINT_ITERATIONS = 4; // Higher = more stable constraints

/** Crane tuning */
export const CRANE_RAIL_Y = 40;         // Y position of the crane rail
export const ROPE_LENGTH = 100;          // Pixel length of the rope
export const ROPE_STIFFNESS = 0.9;       // 0-1, how rigid the rope is
export const ROPE_DAMPING = 0.005;       // Low = more swing
export const CRANE_LERP = 0.12;          // How fast crane follows input (0-1)

/** Laser tuning */
export const LASER_BAND_HEIGHT = 30;     // Height of each laser band in pixels
export const LASER_COVERAGE_THRESHOLD = 0.90; // 90% coverage to fire
export const LASER_COOLDOWN_MS = 2000;   // 2 seconds between laser fires
export const LASER_LINE_SPACING = 80;    // Pixels between laser lines

/** Piece tuning */
export const PIECE_SCALE = 25;           // Scale factor for piece vertex coords
export const MIN_FRAGMENT_AREA = 100;    // Minimum area for sliced fragments
export const SETTLE_VELOCITY = 0.3;      // Below this = piece is settled
export const SETTLE_FRAMES = 30;         // Frames below threshold to count as settled

/** Board boundaries */
export const WALL_THICKNESS = 20;

/** Phaser game config factory — creates config for a given parent element */
export function createGameConfig(parent: string): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    parent,
    backgroundColor: '#1a1a2e',
    physics: {
      default: 'matter',
      matter: {
        gravity: { x: 0, y: GRAVITY_Y },
        debug: false,
        enableSleeping: false,
        /**
         * LEARN: positionIterations and velocityIterations control how
         * many times per frame the physics engine resolves overlaps and
         * velocities. Higher = more accurate stacking (bodies don't
         * sink through each other) but more CPU. Default is 6/4.
         * We bump to 10/8 for solid, heavy-feeling stacks.
         */
        positionIterations: 10,
        velocityIterations: 8,
      },
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [], // Scenes added dynamically by GameManager
  };
}
