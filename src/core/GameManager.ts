/**
 * GameManager — Orchestrates multiple game board instances
 *
 * LEARN: This is the "god object" pattern done right. It doesn't DO gameplay,
 * it just manages the lifecycle of game boards. Each board is a separate
 * Phaser Scene with its own physics world, input, and rendering.
 *
 * Why scenes? Phaser scenes are isolated — bodies in scene A can't collide
 * with bodies in scene B. Perfect for running multiple game boards.
 */
import Phaser from 'phaser';
import { BoardConfig } from '../types';
import { GameInstance } from './GameInstance';

export class GameManager {
  private game: Phaser.Game;
  private instances: Map<string, GameInstance> = new Map();

  constructor(game: Phaser.Game) {
    this.game = game;
  }

  /** Create and launch a new game board */
  addBoard(config: BoardConfig): GameInstance {
    const instance = new GameInstance(config);
    this.instances.set(config.id, instance);

    // Add the scene to Phaser and start it
    this.game.scene.add(config.id, instance, true);

    return instance;
  }

  /** Remove a game board */
  removeBoard(id: string): void {
    const instance = this.instances.get(id);
    if (instance) {
      this.game.scene.remove(id);
      this.instances.delete(id);
    }
  }

  /** Get a board by ID */
  getBoard(id: string): GameInstance | undefined {
    return this.instances.get(id);
  }

  /** Get all active boards */
  getAllBoards(): GameInstance[] {
    return Array.from(this.instances.values());
  }
}
