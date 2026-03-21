/**
 * GameInstance — A single self-contained game board
 *
 * LEARN: This is a Phaser Scene. In Phaser, a "scene" is like a screen
 * or level — it has its own physics world, camera, input, and update loop.
 * We use one scene per game board so multiple boards can run independently.
 *
 * This class owns all the "systems" (crane, pieces, lasers, scoring, input).
 * Each system handles one aspect of gameplay. The GameInstance just coordinates
 * them and manages the game state machine.
 *
 * STATE MACHINE:
 *   SPAWNING → SWINGING → DROPPING → SETTLING → LASER_CHECK → SPAWNING
 *                                                     ↓
 *                                                 GAME_OVER
 */
import Phaser from 'phaser';
import { BoardConfig, GameState } from '../types';
import { EventBus } from './EventBus';
import {
  CRANE_RAIL_Y,
  WALL_THICKNESS,
  GAME_HEIGHT,
} from '../config';

export class GameInstance extends Phaser.Scene {
  public boardConfig: BoardConfig;
  public events: EventBus;
  private state: GameState = 'spawning';

  constructor(config: BoardConfig) {
    super({ key: config.id });
    this.boardConfig = config;
    this.events = new EventBus();
  }

  create(): void {
    // Set up the camera viewport for this board
    this.cameras.main.setViewport(
      this.boardConfig.x,
      this.boardConfig.y,
      this.boardConfig.width,
      this.boardConfig.height,
    );

    // Create boundary walls
    this.createWalls();

    // Draw a placeholder UI to confirm everything is working
    this.drawPlaceholder();

    // Start the game loop
    this.setState('spawning');
  }

  update(_time: number, _delta: number): void {
    // Systems will be wired here in Phase 2+
    // For now, just confirm the scene is ticking
  }

  /** Transition the game state machine */
  setState(newState: GameState): void {
    const prev = this.state;
    this.state = newState;
    this.events.emit(EventBus.STATE_CHANGED, { prev, next: newState });
  }

  getState(): GameState {
    return this.state;
  }

  /** Create the floor and side walls using Matter.js static bodies */
  private createWalls(): void {
    const w = this.boardConfig.width;
    const h = this.boardConfig.height;

    // Floor
    this.matter.add.rectangle(w / 2, h - WALL_THICKNESS / 2, w, WALL_THICKNESS, {
      isStatic: true,
      label: 'floor',
    });

    // Left wall
    this.matter.add.rectangle(WALL_THICKNESS / 2, h / 2, WALL_THICKNESS, h, {
      isStatic: true,
      label: 'wall-left',
    });

    // Right wall
    this.matter.add.rectangle(w - WALL_THICKNESS / 2, h / 2, WALL_THICKNESS, h, {
      isStatic: true,
      label: 'wall-right',
    });
  }

  /** Temporary visual to confirm the scene is running */
  private drawPlaceholder(): void {
    const g = this.add.graphics();
    const w = this.boardConfig.width;

    // Draw walls
    g.fillStyle(0x333355);
    g.fillRect(0, this.boardConfig.height - WALL_THICKNESS, w, WALL_THICKNESS); // floor
    g.fillRect(0, 0, WALL_THICKNESS, this.boardConfig.height); // left
    g.fillRect(w - WALL_THICKNESS, 0, WALL_THICKNESS, this.boardConfig.height); // right

    // Draw crane rail
    g.lineStyle(2, 0x88aaff);
    g.lineBetween(WALL_THICKNESS, CRANE_RAIL_Y, w - WALL_THICKNESS, CRANE_RAIL_Y);

    // Draw laser line indicators
    const playHeight = this.boardConfig.height - WALL_THICKNESS - CRANE_RAIL_Y;
    const spacing = playHeight / (this.boardConfig.laserCount + 1);
    g.lineStyle(1, 0xff4444, 0.3);
    for (let i = 1; i <= this.boardConfig.laserCount; i++) {
      const y = CRANE_RAIL_Y + spacing * i;
      g.lineBetween(WALL_THICKNESS, y, w - WALL_THICKNESS, y);
    }

    // Title text
    this.add.text(w / 2, GAME_HEIGHT / 2 - 40, 'TRASH', {
      fontSize: '48px',
      color: '#ffffff',
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.add.text(w / 2, GAME_HEIGHT / 2 + 10, 'Phase 1 — Skeleton', {
      fontSize: '16px',
      color: '#888888',
      fontFamily: 'monospace',
    }).setOrigin(0.5);
  }
}
