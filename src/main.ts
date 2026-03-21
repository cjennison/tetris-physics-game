/**
 * TRASH — Entry Point
 *
 * LEARN: This is the boot file. It creates the Phaser.Game instance
 * and hands off to the GameManager, which orchestrates everything.
 * In game dev, you want the entry point to be as thin as possible.
 */
import Phaser from 'phaser';
import { createGameConfig } from './config';
import { GameManager } from './core/GameManager';
import { installTestAPI } from './core/TestAPI';

const config = createGameConfig('game-container');
const game = new Phaser.Game(config);

// GameManager is the orchestrator — it creates/destroys game board instances
const manager = new GameManager(game);

// Start with a single human-controlled board
manager.addBoard({
  id: 'player-1',
  x: 0,
  y: 0,
  width: 480,
  height: 800,
  laserCount: 8,
  controller: 'human',
});

// Expose for debugging in browser console
(window as unknown as Record<string, unknown>).__TRASH = { game, manager };

// Install test API for Playwright-driven automated testing
installTestAPI(manager);
