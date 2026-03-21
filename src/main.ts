/**
 * TRASH — Entry Point
 *
 * LEARN: This boot file creates the Phaser.Game and launches the
 * LandscapeScene — the single scene containing the full game world
 * (hopper, ground, processing columns, and eventually crane vehicles).
 */
import decomp from 'poly-decomp';
import Phaser from 'phaser';
import { createGameConfig } from './config';
import { LandscapeScene } from './core/LandscapeScene';

// Register poly-decomp for concave shape decomposition
(window as unknown as Record<string, unknown>).decomp = decomp;

const config = createGameConfig('game-container');
const game = new Phaser.Game(config);

// Launch the landscape scene
const landscape = new LandscapeScene();
game.scene.add('landscape', landscape, true);

// Expose for debugging
(window as unknown as Record<string, unknown>).__TRASH = { game, landscape };
