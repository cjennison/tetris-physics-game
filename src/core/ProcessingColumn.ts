/**
 * ProcessingColumn — A single trash processing shaft within the landscape
 *
 * LEARN: This was previously GameInstance (a Phaser Scene). Now it's a plain
 * class that lives inside the LandscapeScene. It receives a reference to the
 * parent scene and an origin position (where the column sits in the landscape).
 * All coordinates are offset by originX/originY.
 *
 * The column no longer spawns its own pieces. Instead, pieces are delivered
 * to it via receivePiece() — called by the transfer mechanic or crane vehicle.
 *
 * STATE MACHINE:
 *   WAITING → SWINGING → DROPPING → LASER_CHECK → WAITING
 *   (waiting for piece delivery)
 */
import Phaser from 'phaser';
import { GameState } from '../types';
import { EventBus } from './EventBus';
import { CraneSystem } from '../systems/CraneSystem';
import { InputSystem } from '../systems/InputSystem';
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
  private craneSystem!: CraneSystem;
  private inputSystem!: InputSystem;
  private pieceRenderer: PieceRenderer;
  private specialMaterials!: SpecialMaterialSystem;
  private laserSystem!: LaserSystem;

  // Active piece tracking
  private activePiece: SpawnedPiece | null = null;
  private dropTime = 0;

  // Visuals
  private wallGraphics!: Phaser.GameObjects.Graphics;
  private stateText!: Phaser.GameObjects.Text;
  private materialText!: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, config: ColumnConfig, renderer: PieceRenderer) {
    this.scene = scene;
    this.config = config;
    this.events = new EventBus();
    this.pieceRenderer = renderer;
  }

  create(): void {
    this.createWalls();
    this.drawStaticElements();

    // Systems — all receive the parent scene + origin offset
    this.craneSystem = new CraneSystem(
      this.scene, this.config.width, this.config.originX, this.config.originY,
    );
    this.inputSystem = new InputSystem(
      this.scene, this.config.width, this.config.originX,
    );

    this.specialMaterials = new SpecialMaterialSystem(this.scene, this.pieceRenderer);
    this.specialMaterials.registerHandler('glass', glassCollisionHandler);
    this.specialMaterials.registerHandler('concrete', concreteCollisionHandler);

    this.laserSystem = new LaserSystem(
      this.scene, this.events, this.pieceRenderer,
      this.config.width, this.config.height, this.config.laserCount,
      this.config.originX, this.config.originY,
    );

    // Status text
    const cx = this.config.originX + this.config.width / 2;
    this.stateText = this.scene.add.text(cx, this.config.originY + 15, '', {
      fontSize: '12px', color: '#666688', fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(10);

    this.materialText = this.scene.add.text(
      cx, this.config.originY + this.config.height - 15, '', {
        fontSize: '11px', color: '#aaaaaa', fontFamily: 'monospace',
      },
    ).setOrigin(0.5).setDepth(10);

    this.setState('waiting');
  }

  update(_time: number, _delta: number): void {
    this.specialMaterials.resetFrame();
    this.laserSystem.update();

    switch (this.state) {
      case 'waiting':
        this.handleWaiting();
        break;
      case 'swinging':
        this.handleSwinging();
        break;
      case 'dropping':
        this.handleDropping();
        break;
      case 'laser_check':
        this.setState('waiting');
        break;
      case 'spawning':
        // Legacy — treat as waiting
        this.setState('waiting');
        break;
      case 'game_over':
        break;
    }

    this.stateText.setText(this.state === 'waiting' ? 'READY' : this.state.toUpperCase());
  }

  /**
   * Receive a piece from the hopper/crane vehicle.
   * Returns false if the column isn't ready (not in waiting state or hook blocked).
   */
  receivePiece(piece: SpawnedPiece): boolean {
    if (this.state !== 'waiting') return false;
    if (!this.craneSystem.isHookAreaClear()) return false;

    this.activePiece = piece;
    this.pieceRenderer.addBody(piece.body);
    this.craneSystem.attachPiece(piece.body, piece.material);

    this.materialText.setText(`${piece.material.label} ${piece.definition.name}`);
    this.events.emit(EventBus.PIECE_SPAWNED, {
      name: piece.definition.name,
      material: piece.materialKey,
    });
    this.setState('swinging');
    return true;
  }

  /** Is this column ready to accept a piece? */
  isReady(): boolean {
    return this.state === 'waiting' && this.craneSystem.isHookAreaClear();
  }

  getState(): GameState { return this.state; }

  private handleWaiting(): void {
    const actions = this.inputSystem.getActions();
    this.craneSystem.update(actions);
  }

  private handleSwinging(): void {
    const actions = this.inputSystem.getActions();
    this.craneSystem.update(actions);

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

  private handleDropping(): void {
    const actions = this.inputSystem.getActions();
    this.craneSystem.update(actions);

    if (this.activePiece && this.isBodyDestroyed(this.activePiece.body)) {
      this.activePiece = null;
      this.setState('laser_check');
      return;
    }

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

  private createWalls(): void {
    const ox = this.config.originX;
    const oy = this.config.originY;
    const w = this.config.width;
    const h = this.config.height;

    // Floor
    this.scene.matter.add.rectangle(
      ox + w / 2, oy + h - WALL_THICKNESS / 2, w, WALL_THICKNESS,
      { isStatic: true, label: 'column-floor', collisionFilter: { category: 0x0001, mask: 0x0002 | 0x0004 } },
    );

    // Side walls (extend above column for crane containment)
    const wallHeight = h + 200;
    const wallCenterY = oy + (h - 200) / 2;

    this.scene.matter.add.rectangle(
      ox + WALL_THICKNESS / 2, wallCenterY, WALL_THICKNESS, wallHeight,
      { isStatic: true, label: 'column-wall-left', collisionFilter: { category: 0x0001, mask: 0x0002 | 0x0004 } },
    );
    this.scene.matter.add.rectangle(
      ox + w - WALL_THICKNESS / 2, wallCenterY, WALL_THICKNESS, wallHeight,
      { isStatic: true, label: 'column-wall-right', collisionFilter: { category: 0x0001, mask: 0x0002 | 0x0004 } },
    );
  }

  private drawStaticElements(): void {
    this.wallGraphics = this.scene.add.graphics();
    const ox = this.config.originX;
    const oy = this.config.originY;
    const w = this.config.width;
    const h = this.config.height;

    // Column shaft background (slightly lighter than landscape)
    this.wallGraphics.fillStyle(0x151528);
    this.wallGraphics.fillRect(ox, oy, w, h);

    // Walls
    this.wallGraphics.fillStyle(0x333355);
    this.wallGraphics.fillRect(ox, oy + h - WALL_THICKNESS, w, WALL_THICKNESS);
    this.wallGraphics.fillRect(ox, oy, WALL_THICKNESS, h);
    this.wallGraphics.fillRect(ox + w - WALL_THICKNESS, oy, WALL_THICKNESS, h);

    // Column opening rim (at ground level)
    this.wallGraphics.fillStyle(0x444466);
    this.wallGraphics.fillRect(ox - 5, oy - 5, w + 10, 10);

    this.wallGraphics.setDepth(0);
  }
}
