/**
 * TRASH Game — Configuration
 *
 * LEARN: Centralizing config means you tweak numbers in ONE place.
 * During game dev you'll spend a LOT of time tuning these values.
 * Having them all here makes that fast.
 */
import Phaser from 'phaser';

/** Viewport */
export const VIEWPORT_WIDTH = 1200;
export const VIEWPORT_HEIGHT = 700;

/** Landscape */
export const LANDSCAPE_WIDTH = 1200;
export const LANDSCAPE_HEIGHT = 700;
export const GROUND_Y = 500; // Ground surface Y

/** Physics tuning */
export const GRAVITY_Y = 2.0;

/** Board boundaries */
export const WALL_THICKNESS = 15;

/** Pipe (drops trash onto the ground from above) */
export const PIPE_X = 80;  // Center X of the pipe opening
export const PIPE_Y = 50;  // Y of pipe opening (top of screen)
export const PIPE_WIDTH = 80;

/** Trash pile zone (where pieces land from the pipe) */
export const PILE_LEFT = 20;
export const PILE_RIGHT = 250;

/** Processing column dimensions */
export const COLUMN_WIDTH = 200;
export const COLUMN_HEIGHT = 400;
export const COLUMN_START_X = 500; // X position of first column
export const COLUMN_SPACING = 80;
export const COLUMN_TOP_Y = GROUND_Y - COLUMN_HEIGHT;

/** Crane vehicle */
export const VEHICLE_Y = GROUND_Y - 25; // Drives just above ground
export const VEHICLE_WIDTH = 50;
export const VEHICLE_HEIGHT = 30;
export const VEHICLE_SPEED = 3;

/** Phaser game config */
export function createGameConfig(parent: string): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    width: VIEWPORT_WIDTH,
    height: VIEWPORT_HEIGHT,
    parent,
    backgroundColor: '#0d0d1a',
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
