/**
 * ProcessingColumn — A trash processing shaft below ground level
 *
 * LEARN: The column is a vertical shaft sunk into the ground. Pieces
 * are dropped in from above by the crane vehicle — they fall under
 * gravity and pile up inside. Lasers scan horizontal bands and slice
 * pieces when coverage reaches 90%.
 *
 * No internal crane or hook — the vehicle drops pieces directly into
 * the column opening. The column just manages walls, lasers, and
 * special material handlers.
 *
 * STATE MACHINE (simplified):
 *   WAITING → DROPPING → LASER_CHECK → WAITING
 */
import Phaser from 'phaser';
import { GameState } from '../types';
import { EventBus } from './EventBus';
import { PieceRenderer } from '../systems/PieceRenderer';
import { SpecialMaterialSystem } from '../systems/SpecialMaterialSystem';
import { glassCollisionHandler } from '../systems/handlers/GlassHandler';
import { concreteCollisionHandler } from '../systems/handlers/ConcreteHandler';
import { LaserSystem } from '../systems/LaserSystem';
import { type SpawnedPiece } from '../pieces/PieceFactory';
import { WALL_THICKNESS } from '../config';

export interface ColumnConfig {
  id: string;
  originX: number;
  originY: number;
  width: number;
  height: number;
  laserCount: number;
}

export class ProcessingColumn {
  public config: ColumnConfig;
  public events: EventBus;
  private scene: Phaser.Scene;
  private state: GameState = 'waiting';

  // Systems
  private pieceRenderer: PieceRenderer;
  private specialMaterials!: SpecialMaterialSystem;
  private laserSystem!: LaserSystem;

  // Active piece tracking
  private activePiece: SpawnedPiece | null = null;
  private dropTime = 0;

  // Visuals
  private wallGraphics!: Phaser.GameObjects.Graphics;
  private stateText!: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, config: ColumnConfig, renderer: PieceRenderer) {
    this.scene = scene;
    this.config = config;
    this.events = new EventBus();
    this.pieceRenderer = renderer;
  }

  create(): void {
    this.createWalls();
    this.drawStaticElements();

    this.specialMaterials = new SpecialMaterialSystem(this.scene, this.pieceRenderer);
    this.specialMaterials.registerHandler('glass', glassCollisionHandler);
    this.specialMaterials.registerHandler('concrete', concreteCollisionHandler);

    this.laserSystem = new LaserSystem(
      this.scene, this.events, this.pieceRenderer,
      this.config.width, this.config.height, this.config.laserCount,
      this.config.originX, this.config.originY,
    );

    const cx = this.config.originX + this.config.width / 2;
    this.stateText = this.scene.add.text(cx, this.config.originY + 15, '', {
      fontSize: '11px', color: '#666688', fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(10);

    // Column label above the opening
    this.scene.add.text(cx, this.config.originY - 15, this.config.id.toUpperCase(), {
      fontSize: '10px', color: '#556677', fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(10);

    this.setState('waiting');
  }

  update(_time: number, _delta: number): void {
    this.specialMaterials.resetFrame();
    this.laserSystem.update();

    switch (this.state) {
      case 'waiting':
        // Idle — waiting for vehicle to drop a piece
        break;
      case 'dropping':
        this.handleDropping();
        break;
      case 'laser_check':
        this.setState('waiting');
        break;
      default:
        break;
    }

    this.stateText.setText(this.state === 'waiting' ? '' : this.state.toUpperCase());
  }

  /**
   * Receive a piece dropped from the crane vehicle.
   * The piece body is already in the physics world at the drop position.
   * We just track it and wait for it to settle.
   */
  /**
   * Receive a piece that's being dropped into the column.
   * The piece body is already falling from the vehicle — we just
   * track it for settling detection and laser interaction.
   */
  receivePiece(piece: SpawnedPiece): boolean {
    if (this.state !== 'waiting') return false;

    this.activePiece = piece;
    // Body is already in the renderer from when the vehicle grabbed it
    this.dropTime = Date.now();
    this.events.emit(EventBus.PIECE_DROPPED);
    this.setState('dropping');
    return true;
  }

  /** Is this column ready to accept a piece? */
  isReady(): boolean {
    return this.state === 'waiting';
  }

  /** Get the column opening center X */
  getOpeningX(): number {
    return this.config.originX + this.config.width / 2;
  }

  getState(): GameState { return this.state; }

  private handleDropping(): void {
    if (this.activePiece && this.isBodyDestroyed(this.activePiece.body)) {
      this.activePiece = null;
      this.setState('laser_check');
      return;
    }

    // After 1 second, ready for next piece
    if (Date.now() - this.dropTime >= 1000) {
      this.events.emit(EventBus.PIECE_SETTLED);
      this.activePiece = null;
      this.setState('laser_check');
    }
  }

  private isBodyDestroyed(body: MatterJS.BodyType): boolean {
    return !this.scene.matter.world.getAllBodies().includes(body);
  }

  setState(newState: GameState): void {
    this.state = newState;
    this.events.emit(EventBus.STATE_CHANGED, { next: newState });
  }

  /** Create column walls — below ground level */
  private createWalls(): void {
    const ox = this.config.originX;
    const oy = this.config.originY;
    const w = this.config.width;
    const h = this.config.height;

    // Floor
    this.scene.matter.add.rectangle(
      ox + w / 2, oy + h - WALL_THICKNESS / 2, w, WALL_THICKNESS,
      { isStatic: true, label: 'column-floor', collisionFilter: { category: 0x0001, mask: 0x0002 } },
    );

    // Side walls — extend from below ground to just above ground surface
    // so pieces can fall in from above but can't escape sideways
    const wallTop = oy - 10; // Slightly above column top (below ground)
    const wallH = h + 10;
    const wallCenterY = wallTop + wallH / 2;

    this.scene.matter.add.rectangle(
      ox + WALL_THICKNESS / 2, wallCenterY, WALL_THICKNESS, wallH,
      { isStatic: true, label: 'column-wall-left', collisionFilter: { category: 0x0001, mask: 0x0002 } },
    );
    this.scene.matter.add.rectangle(
      ox + w - WALL_THICKNESS / 2, wallCenterY, WALL_THICKNESS, wallH,
      { isStatic: true, label: 'column-wall-right', collisionFilter: { category: 0x0001, mask: 0x0002 } },
    );
  }

  /** Draw the column shaft visual */
  private drawStaticElements(): void {
    this.wallGraphics = this.scene.add.graphics();
    const ox = this.config.originX;
    const oy = this.config.originY;
    const w = this.config.width;
    const h = this.config.height;

    // Column shaft background
    this.wallGraphics.fillStyle(0x101020);
    this.wallGraphics.fillRect(ox, oy, w, h);

    // Walls
    this.wallGraphics.fillStyle(0x2a2a44);
    this.wallGraphics.fillRect(ox, oy + h - WALL_THICKNESS, w, WALL_THICKNESS); // floor
    this.wallGraphics.fillRect(ox, oy, WALL_THICKNESS, h); // left
    this.wallGraphics.fillRect(ox + w - WALL_THICKNESS, oy, WALL_THICKNESS, h); // right

    // Column opening rim at ground level
    this.wallGraphics.fillStyle(0x444466);
    this.wallGraphics.fillRect(ox - 3, oy - 4, w + 6, 6);

    this.wallGraphics.setDepth(0);
  }
}
