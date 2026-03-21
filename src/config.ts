/**
 * TRASH Game — Configuration
 */
import Phaser from 'phaser';

/** Viewport (what the player sees — camera shows a portion of the landscape) */
export const VIEWPORT_WIDTH = 1000;
export const VIEWPORT_HEIGHT = 700;

/** Landscape (full world — much bigger than viewport, camera pans/zooms) */
export const LANDSCAPE_WIDTH = 2000;
export const LANDSCAPE_HEIGHT = 1200;

/** Physics tuning */
export const GRAVITY_Y = 2.0;

/** Board boundaries */
export const WALL_THICKNESS = 15;

/** Pipe (drops trash from upper-left wall area) */
export const PIPE_X = 100;
export const PIPE_Y = 300;
export const PIPE_WIDTH = 80;

/** Trash pile zone (lower-left where pieces land) */
export const PILE_LEFT = 30;
export const PILE_RIGHT = 400;

/** Processing column dimensions */
export const COLUMN_HEIGHT = 300;

/** Crane vehicle */
export const VEHICLE_WIDTH = 65;
export const VEHICLE_HEIGHT = 32;
export const VEHICLE_SPEED = 8;

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
