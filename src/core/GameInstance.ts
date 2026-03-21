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
 *
 * LEARN: A state machine is the #1 pattern in game dev. Every game loop
 * asks "what state am I in?" and runs different logic accordingly.
 * Without one, you get spaghetti of boolean flags like isDropping, isSettled,
 * hasSpawned — impossible to debug. With a state machine, you always know
 * exactly what the game is doing.
 */
import Phaser from 'phaser';
import { BoardConfig, GameState } from '../types';
import { EventBus } from './EventBus';
import { CraneSystem } from '../systems/CraneSystem';
import { InputSystem } from '../systems/InputSystem';
import { PieceRenderer } from '../systems/PieceRenderer';
import { SpecialMaterialSystem } from '../systems/SpecialMaterialSystem';
import { glassCollisionHandler } from '../systems/handlers/GlassHandler';
import { concreteCollisionHandler } from '../systems/handlers/ConcreteHandler';
import { LaserSystem } from '../systems/LaserSystem';
import { PieceFactory, type SpawnedPiece } from '../pieces/PieceFactory';
import { DevConsole } from '../ui/DevConsole';
import { TUNING } from '../tuning';
import {
  WALL_THICKNESS,
  GAME_HEIGHT,
} from '../config';

export class GameInstance extends Phaser.Scene {
  public boardConfig: BoardConfig;
  public events: EventBus;
  private state: GameState = 'spawning';

  // Systems
  private craneSystem!: CraneSystem;
  private inputSystem!: InputSystem;
  private pieceRenderer!: PieceRenderer;
  private pieceFactory!: PieceFactory;
  private specialMaterials!: SpecialMaterialSystem;
  private laserSystem!: LaserSystem;
  // Kept alive for DOM side effects (toggle with ` key)
  private devConsole: DevConsole | undefined;

  // Active piece tracking
  private activePiece: SpawnedPiece | null = null;

  /** Timestamp when the piece was dropped — used for the settle timer */
  private dropTime = 0;

  // Wall graphics (drawn once, not every frame)
  private wallGraphics!: Phaser.GameObjects.Graphics;

  // Status text
  private stateText!: Phaser.GameObjects.Text;
  private materialText!: Phaser.GameObjects.Text;

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

    // Draw static visuals (walls, laser guides)
    this.drawStaticElements();

    // Initialize systems
    this.craneSystem = new CraneSystem(this, this.boardConfig.width);
    this.inputSystem = new InputSystem(this, this.boardConfig.width);
    this.pieceRenderer = new PieceRenderer(this);
    this.pieceFactory = new PieceFactory(this);

    /**
     * LEARN: Special materials register handlers that fire on collision.
     * To add a new special material: 1) add it to tuning.json with a
     * "special" field, 2) write a handler in systems/handlers/, and
     * 3) register it here. The SpecialMaterialSystem does the rest.
     */
    this.specialMaterials = new SpecialMaterialSystem(this, this.pieceRenderer);
    this.specialMaterials.registerHandler('glass', glassCollisionHandler);
    this.specialMaterials.registerHandler('concrete', concreteCollisionHandler);

    // Laser system — horizontal lines that destroy pieces at 90%+ coverage
    this.laserSystem = new LaserSystem(
      this,
      this.events,
      this.pieceRenderer,
      this.boardConfig.width,
      this.boardConfig.height,
      this.boardConfig.laserCount,
    );

    // Status display
    this.stateText = this.add.text(this.boardConfig.width / 2, 15, '', {
      fontSize: '12px',
      color: '#666688',
      fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(10);

    // Dev console — toggle with ` key
    this.devConsole = new DevConsole(this.pieceFactory);

    // Material indicator
    this.materialText = this.add.text(this.boardConfig.width / 2, GAME_HEIGHT - 35, '', {
      fontSize: '14px',
      color: '#aaaaaa',
      fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(10);

    // Start the game
    this.setState('spawning');
  }

  update(_time: number, _delta: number): void {
    // Reset per-frame tracking for special materials
    this.specialMaterials.resetFrame();

    // Always update rendering and lasers
    this.pieceRenderer.draw();
    this.laserSystem.update();

    // State-specific logic
    switch (this.state) {
      case 'spawning':
        this.handleSpawning();
        break;

      case 'swinging':
        this.handleSwinging();
        break;

      case 'dropping':
        this.handleDropping();
        break;

      case 'laser_check':
        // Lasers run continuously in update(), this state just transitions
        this.setState('spawning');
        break;

      case 'game_over':
        // Nothing to update
        break;
    }

    // Update status display
    this.stateText.setText(this.state.toUpperCase());
  }

  /**
   * SPAWNING: Wait for the hook area to be clear, then create a new piece.
   *
   * LEARN: After a shatter (especially wall-smash), debris may be flying
   * near the crane hook. If we spawn a piece immediately, it overlaps
   * with the debris and can trigger another shatter. Instead, we check
   * every frame: "is the hook area clear?" If not, we keep the crane
   * swinging empty and wait. The hook keeps swinging naturally, and the
   * player sees the rope moving without a piece — visual feedback that
   * the game is waiting for space to clear.
   */
  private handleSpawning(): void {
    // Keep the crane moving even while waiting to spawn
    const actions = this.inputSystem.getActions();
    if (this.testCraneTarget !== null && this.testCraneTarget >= 0) {
      actions.horizontalTarget = this.testCraneTarget;
    }
    this.craneSystem.update(actions);

    // Wait until the hook area is clear
    if (!this.craneSystem.isHookAreaClear()) {
      this.stateText.setText('WAITING...');
      return;
    }

    const spawned = this.pieceFactory.spawnPiece(
      this.boardConfig.width / 2,
      TUNING.crane.railY + 50,
    );

    this.activePiece = spawned;
    this.pieceRenderer.addBody(spawned.body);
    this.craneSystem.attachPiece(spawned.body, spawned.material);

    this.materialText.setText(`${spawned.material.label} ${spawned.definition.name}`);

    this.events.emit(EventBus.PIECE_SPAWNED, {
      name: spawned.definition.name,
      material: spawned.materialKey,
    });
    this.setState('swinging');
  }

  /**
   * SWINGING: Player controls the crane, piece swings on rope.
   *
   * LEARN: This is the main "gameplay" state. Input drives the crane,
   * physics drives the piece. The player is timing their drop to land
   * the piece where they want. The pendulum makes this skill-based —
   * you can't just move directly over and drop, you have to account
   * for the swing.
   */
  private handleSwinging(): void {
    const actions = this.inputSystem.getActions();
    // Test API can override crane position (persists until cleared with -1)
    if (this.testCraneTarget !== null && this.testCraneTarget >= 0) {
      actions.horizontalTarget = this.testCraneTarget;
    }
    this.craneSystem.update(actions);

    // If the piece shattered while on the rope (e.g., swung into a wall),
    // the crane auto-detaches. Move straight to spawning the next piece.
    if (!this.craneSystem.hasAttachedPiece()) {
      this.activePiece = null;
      this.setState('laser_check');
      return;
    }

    if (actions.drop) {
      const droppedBody = this.craneSystem.dropPiece();
      if (droppedBody) {
        this.dropTime = Date.now();
        this.events.emit(EventBus.PIECE_DROPPED);
        this.setState('dropping');
      }
    }
  }

  /**
   * DROPPING: Piece is falling. After 1 second, move to next piece.
   *
   * LEARN: Instead of tracking velocity and waiting for the piece to
   * fully stop (which can take ages with bouncing rubber or sliding
   * shards), we use a simple timer. 1 second is enough for the piece
   * to land and the player to see where it went, but fast enough to
   * keep the game feeling snappy. The piece continues settling
   * physically in the background — it doesn't freeze.
   */
  private handleDropping(): void {
    const actions = this.inputSystem.getActions();
    if (this.testCraneTarget !== null && this.testCraneTarget >= 0) {
      actions.horizontalTarget = this.testCraneTarget;
    }
    this.craneSystem.update(actions);

    // If the piece was destroyed (glass shatter), move on immediately
    if (this.activePiece && this.isBodyDestroyed(this.activePiece.body)) {
      this.activePiece = null;
      this.setState('laser_check');
      return;
    }

    // After 1 second, move to next piece
    const elapsed = Date.now() - this.dropTime;
    if (elapsed >= 1000) {
      if (this.checkGameOver()) {
        this.setState('game_over');
      } else {
        this.events.emit(EventBus.PIECE_SETTLED);
        this.activePiece = null;
        this.setState('laser_check');
      }
    }
  }

  // --- Test API helpers (called by TestAPI.ts) ---

  /** Get the PieceFactory for setting forced shapes/materials */
  getFactory(): PieceFactory { return this.pieceFactory; }

  /** Programmatically drop the current piece */
  testDrop(): void {
    if (this.state === 'swinging') {
      this.craneSystem.dropPiece();
      this.dropTime = Date.now();
      this.events.emit(EventBus.PIECE_DROPPED);
      this.setState('dropping');
    }
  }

  /** Programmatically set the crane target (0-1) for the next update */
  private testCraneTarget: number | null = null;
  testMoveCrane(x: number): void {
    this.testCraneTarget = x;
  }

  /** Get info about the active piece */
  getActivePieceInfo(): { shape: string; material: string } | null {
    if (!this.activePiece) return null;
    return {
      shape: this.activePiece.definition.name,
      material: this.activePiece.materialKey,
    };
  }

  /** Get the crane's current X position (normalized 0-1) */
  getCraneX(): number {
    const left = WALL_THICKNESS;
    const right = this.boardConfig.width - WALL_THICKNESS;
    return (this.craneSystem.getTrolleyX() - left) / (right - left);
  }

  /** Check if a body has been removed from the physics world (e.g., glass shattered) */
  private isBodyDestroyed(body: MatterJS.BodyType): boolean {
    return !this.matter.world.getAllBodies().includes(body);
  }

  /**
   * Check if any piece body overlaps the crane rail Y position.
   * If so, the pile is too high and the game is over.
   */
  private checkGameOver(): boolean {
    const bodies = this.matter.world.getAllBodies();
    for (const body of bodies) {
      if (body.isStatic) continue;
      if (body.label?.startsWith('piece-')) {
        if (body.bounds.min.y < TUNING.crane.railY + 20) {
          return true;
        }
      }
    }
    return false;
  }

  /** Transition the game state machine */
  setState(newState: GameState): void {
    const prev = this.state;
    this.state = newState;
    this.events.emit(EventBus.STATE_CHANGED, { prev, next: newState });

    if (newState === 'game_over') {
      this.showGameOver();
    }
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
      collisionFilter: { category: 0x0001, mask: 0x0002 | 0x0004 },
    });

    /**
     * LEARN: The side walls extend well above the visible board (extra 200px)
     * to prevent pieces from swinging out over the top of the walls while
     * hanging from the crane rope. Without this, a big pendulum arc could
     * carry a piece outside the play area.
     */
    const wallHeight = h + 200;
    const wallCenterY = (h - 200) / 2;

    // Left wall
    this.matter.add.rectangle(WALL_THICKNESS / 2, wallCenterY, WALL_THICKNESS, wallHeight, {
      isStatic: true,
      label: 'wall-left',
      collisionFilter: { category: 0x0001, mask: 0x0002 | 0x0004 },
    });

    // Right wall
    this.matter.add.rectangle(w - WALL_THICKNESS / 2, wallCenterY, WALL_THICKNESS, wallHeight, {
      isStatic: true,
      label: 'wall-right',
      collisionFilter: { category: 0x0001, mask: 0x0002 | 0x0004 },
    });
  }

  /** Draw walls and laser guides (static — drawn once in create) */
  private drawStaticElements(): void {
    this.wallGraphics = this.add.graphics();
    const w = this.boardConfig.width;

    // Walls
    this.wallGraphics.fillStyle(0x333355);
    this.wallGraphics.fillRect(0, this.boardConfig.height - WALL_THICKNESS, w, WALL_THICKNESS);
    this.wallGraphics.fillRect(0, 0, WALL_THICKNESS, this.boardConfig.height);
    this.wallGraphics.fillRect(w - WALL_THICKNESS, 0, WALL_THICKNESS, this.boardConfig.height);

    // Laser lines are now drawn by LaserSystem (dynamic based on coverage)

    // Depth behind pieces
    this.wallGraphics.setDepth(0);
  }

  /** Show game over overlay */
  private showGameOver(): void {
    const w = this.boardConfig.width;
    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.7);
    overlay.fillRect(0, 0, w, GAME_HEIGHT);
    overlay.setDepth(20);

    this.add.text(w / 2, GAME_HEIGHT / 2 - 30, 'GAME OVER', {
      fontSize: '36px',
      color: '#ff4444',
      fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(21);

    this.add.text(w / 2, GAME_HEIGHT / 2 + 20, 'Tap or press SPACE to restart', {
      fontSize: '14px',
      color: '#888888',
      fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(21);

    // Restart on input
    const restartHandler = () => {
      this.devConsole?.destroy();
      this.scene.restart();
    };
    this.input.keyboard?.once('keydown-SPACE', restartHandler);
    this.input.once('pointerdown', restartHandler);
  }
}
