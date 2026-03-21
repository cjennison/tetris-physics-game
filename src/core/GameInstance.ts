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
  // Kept alive for DOM side effects (toggle with ` key)
  private devConsole: DevConsole | undefined;

  // Active piece tracking
  private activePiece: SpawnedPiece | null = null;

  /**
   * LEARN: Settling detection uses a "frame counter" pattern.
   * Instead of checking if velocity is zero on ONE frame (too noisy —
   * physics bodies jitter), we check if velocity has been below a
   * threshold for N consecutive frames. This filters out brief pauses
   * during bouncing.
   */
  private settleCounter = 0;

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

    // Always update rendering
    this.pieceRenderer.draw();

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

      case 'settling':
        this.handleSettling();
        break;

      case 'laser_check':
        // Lasers not implemented yet — skip to spawning
        this.setState('spawning');
        break;

      case 'game_over':
        // Nothing to update
        break;
    }

    // Update status display
    this.stateText.setText(this.state.toUpperCase());
  }

  /** SPAWNING: Create a new piece and attach it to the crane */
  private handleSpawning(): void {
    const spawned = this.pieceFactory.spawnPiece(
      this.boardConfig.width / 2,
      TUNING.crane.railY + 50,
    );

    this.activePiece = spawned;
    this.pieceRenderer.addBody(spawned.body);
    this.craneSystem.attachPiece(spawned.body, spawned.material);
    this.settleCounter = 0;

    // Show material label so the player knows what they're working with
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
    this.craneSystem.update(actions);

    if (actions.drop) {
      const droppedBody = this.craneSystem.dropPiece();
      if (droppedBody) {
        this.events.emit(EventBus.PIECE_DROPPED);
        this.setState('dropping');
      }
    }
  }

  /** DROPPING: Piece is falling. Watch for it to start settling. */
  private handleDropping(): void {
    // Keep updating crane position (visual only — no piece attached)
    const actions = this.inputSystem.getActions();
    this.craneSystem.update(actions);

    if (!this.activePiece) {
      this.setState('spawning');
      return;
    }

    /**
     * LEARN: We check speed (magnitude of velocity vector) rather than
     * individual x/y components. A piece sliding sideways at high speed
     * shouldn't count as "settled" even if its Y velocity is low.
     */
    const vel = this.activePiece.body.velocity;
    const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);

    if (speed < TUNING.settling.velocityThreshold) {
      this.setState('settling');
    }
  }

  /**
   * SETTLING: Piece velocity is low. Wait for it to stay low for
   * N consecutive frames before declaring it settled.
   */
  private handleSettling(): void {
    const actions = this.inputSystem.getActions();
    this.craneSystem.update(actions);

    if (!this.activePiece) {
      this.setState('spawning');
      return;
    }

    const vel = this.activePiece.body.velocity;
    const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);

    if (speed < TUNING.settling.velocityThreshold) {
      this.settleCounter++;
      if (this.settleCounter >= TUNING.settling.frameCount) {
        // Piece is settled — check for game over, then move on
        if (this.checkGameOver()) {
          this.setState('game_over');
        } else {
          this.events.emit(EventBus.PIECE_SETTLED);
          this.activePiece = null;
          this.setState('laser_check');
        }
      }
    } else {
      // Piece started moving again (bounced) — go back to dropping
      this.settleCounter = 0;
      this.setState('dropping');
    }
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
      collisionFilter: { category: 0x0001, mask: 0x0002 },
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
      collisionFilter: { category: 0x0001, mask: 0x0002 },
    });

    // Right wall
    this.matter.add.rectangle(w - WALL_THICKNESS / 2, wallCenterY, WALL_THICKNESS, wallHeight, {
      isStatic: true,
      label: 'wall-right',
      collisionFilter: { category: 0x0001, mask: 0x0002 },
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

    // Laser line guides (faint)
    const railY = TUNING.crane.railY;
    const playHeight = this.boardConfig.height - WALL_THICKNESS - railY;
    const spacing = playHeight / (this.boardConfig.laserCount + 1);
    this.wallGraphics.lineStyle(1, 0xff4444, 0.15);
    for (let i = 1; i <= this.boardConfig.laserCount; i++) {
      const y = railY + spacing * i;
      this.wallGraphics.lineBetween(WALL_THICKNESS, y, w - WALL_THICKNESS, y);
    }

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
