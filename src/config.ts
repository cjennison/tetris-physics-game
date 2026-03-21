/**
 * TRASH Game — Configuration
 *
 * LEARN: Centralizing config means you tweak numbers in ONE place.
 * During game dev you'll spend a LOT of time tuning these values.
 * Having them all here makes that fast.
 */
import Phaser from 'phaser';

/** Viewport (what the player sees — the camera scrolls across the landscape) */
export const VIEWPORT_WIDTH = 800;
export const VIEWPORT_HEIGHT = 800;

/** Landscape (the full world — wider than viewport, camera scrolls) */
export const LANDSCAPE_WIDTH = 2000;
export const LANDSCAPE_HEIGHT = 800;
export const GROUND_Y = 600; // Y position of ground surface

/** Physics tuning */
export const GRAVITY_Y = 2.0;

/** Board boundaries */
export const WALL_THICKNESS = 20;

/** Hopper dimensions */
export const HOPPER_X = 20;
export const HOPPER_WIDTH = 350;
export const HOPPER_HEIGHT = 500;
export const HOPPER_Y = GROUND_Y - HOPPER_HEIGHT; // Top of hopper

/** Processing column dimensions */
export const COLUMN_WIDTH = 300;
export const COLUMN_HEIGHT = 550;
export const COLUMN_START_X = 500; // X position of first column
export const COLUMN_SPACING = 100; // Gap between columns
export const COLUMN_TOP_Y = GROUND_Y - COLUMN_HEIGHT; // Top of column shaft

/** Phaser game config */
export function createGameConfig(parent: string): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    width: VIEWPORT_WIDTH,
    height: VIEWPORT_HEIGHT,
    parent,
    backgroundColor: '#1a1a2e',
    physics: {
      default: 'matter',
      matter: {
        gravity: { x: 0, y: GRAVITY_Y },
        debug: false,
        enableSleeping: false,
        positionIterations: 10,
        velocityIterations: 8,
      },
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [],
  };
}
