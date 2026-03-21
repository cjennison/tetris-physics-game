/**
 * LandscapeScene — The top-level scene containing the full game world
 *
 * LEARN: This is the ONE Phaser Scene for the entire game. It contains:
 * - The hopper (left side, fills with incoming trash)
 * - The ground plane (connects hopper to columns)
 * - Processing columns (vertical shafts with lasers)
 * - Eventually: crane vehicles driving across the ground
 *
 * Everything shares a single Matter.js physics world, so pieces can
 * physically travel from the hopper to columns without cross-world
 * transfer hacks. The camera can pan across the landscape.
 */
import Phaser from 'phaser';
import { PieceRenderer } from '../systems/PieceRenderer';
import { ProcessingColumn, type ColumnConfig } from './ProcessingColumn';
import { Hopper, type HopperConfig } from '../landscape/Hopper';
import {
  LANDSCAPE_WIDTH,
  LANDSCAPE_HEIGHT,
  GROUND_Y,
  HOPPER_X,
  HOPPER_WIDTH,
  HOPPER_HEIGHT,
  HOPPER_Y,
  COLUMN_START_X,
  COLUMN_WIDTH,
  COLUMN_HEIGHT,
  COLUMN_TOP_Y,
  WALL_THICKNESS,
} from '../config';

export class LandscapeScene extends Phaser.Scene {
  private pieceRenderer!: PieceRenderer;
  private hopper!: Hopper;
  private columns: ProcessingColumn[] = [];
  private groundGraphics!: Phaser.GameObjects.Graphics;

  constructor() {
    super({ key: 'landscape' });
  }

  create(): void {
    // Camera bounds — landscape is wider than viewport
    this.cameras.main.setBounds(0, 0, LANDSCAPE_WIDTH, LANDSCAPE_HEIGHT);

    // Global piece renderer — draws ALL pieces in the shared world
    this.pieceRenderer = new PieceRenderer(this);

    // Draw the landscape
    this.drawLandscape();

    // Create ground physics
    this.createGround();

    // Create the hopper
    const hopperConfig: HopperConfig = {
      x: HOPPER_X,
      y: HOPPER_Y,
      width: HOPPER_WIDTH,
      height: HOPPER_HEIGHT,
      spawnInterval: 5, // New piece every 5 seconds
    };
    this.hopper = new Hopper(this, hopperConfig, this.pieceRenderer);

    // Create first processing column
    const col1Config: ColumnConfig = {
      id: 'column-1',
      originX: COLUMN_START_X,
      originY: COLUMN_TOP_Y,
      width: COLUMN_WIDTH,
      height: COLUMN_HEIGHT,
      laserCount: 6,
    };
    const col1 = new ProcessingColumn(this, col1Config, this.pieceRenderer);
    col1.create();
    this.columns.push(col1);

    // Transfer button — send piece from hopper to column
    this.createTransferButton(col1);

    // Camera controls
    this.setupCamera();

    // Title
    this.add.text(LANDSCAPE_WIDTH / 2, 15, 'T R A S H', {
      fontSize: '18px', color: '#334455', fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(0);
  }

  update(time: number, delta: number): void {
    this.pieceRenderer.draw();
    this.hopper.update();

    for (const col of this.columns) {
      col.update(time, delta);
    }
  }

  private drawLandscape(): void {
    this.groundGraphics = this.add.graphics();

    // Sky/background
    this.groundGraphics.fillStyle(0x0d0d1a);
    this.groundGraphics.fillRect(0, 0, LANDSCAPE_WIDTH, LANDSCAPE_HEIGHT);

    // Ground surface
    this.groundGraphics.fillStyle(0x2a2a35);
    this.groundGraphics.fillRect(0, GROUND_Y, LANDSCAPE_WIDTH, LANDSCAPE_HEIGHT - GROUND_Y);

    // Ground surface line
    this.groundGraphics.lineStyle(2, 0x3a3a4a);
    this.groundGraphics.lineBetween(0, GROUND_Y, LANDSCAPE_WIDTH, GROUND_Y);

    this.groundGraphics.setDepth(-1);
  }

  private createGround(): void {
    // Ground is a series of static bodies with gaps for columns
    // For now: one solid ground across the full width
    // Columns have their own floors below ground
    this.matter.add.rectangle(
      LANDSCAPE_WIDTH / 2, GROUND_Y + WALL_THICKNESS / 2,
      LANDSCAPE_WIDTH, WALL_THICKNESS,
      {
        isStatic: true,
        label: 'ground',
        collisionFilter: { category: 0x0001, mask: 0x0002 },
      },
    );
  }

  private createTransferButton(column: ProcessingColumn): void {
    // "SEND" button between hopper and column
    const btnX = (HOPPER_X + HOPPER_WIDTH + COLUMN_START_X) / 2;
    const btnY = GROUND_Y - 40;

    const btn = this.add.text(btnX, btnY, '▶ SEND', {
      fontSize: '16px',
      color: '#ffffff',
      fontFamily: 'monospace',
      backgroundColor: '#445566',
      padding: { x: 12, y: 8 },
    }).setOrigin(0.5).setDepth(15).setInteractive({ useHandCursor: true });

    btn.on('pointerover', () => btn.setStyle({ backgroundColor: '#556677' }));
    btn.on('pointerout', () => btn.setStyle({ backgroundColor: '#445566' }));

    btn.on('pointerdown', () => {
      if (!column.isReady()) {
        btn.setStyle({ backgroundColor: '#664444' });
        this.time.delayedCall(300, () => btn.setStyle({ backgroundColor: '#445566' }));
        return;
      }

      const piece = this.hopper.popPiece();
      if (!piece) {
        btn.setStyle({ backgroundColor: '#664444' });
        this.time.delayedCall(300, () => btn.setStyle({ backgroundColor: '#445566' }));
        return;
      }

      column.receivePiece(piece);
      btn.setStyle({ backgroundColor: '#446644' });
      this.time.delayedCall(300, () => btn.setStyle({ backgroundColor: '#445566' }));
    });
  }

  private setupCamera(): void {
    // For now, center the camera to show hopper + first column
    const centerX = (HOPPER_X + COLUMN_START_X + COLUMN_WIDTH) / 2;
    this.cameras.main.centerOn(centerX, LANDSCAPE_HEIGHT / 2);

    // A/D keys to pan (when we have a wider landscape)
    if (this.input.keyboard) {
      const keyA = this.input.keyboard.addKey('A');
      const keyD = this.input.keyboard.addKey('D');

      this.events.on('update', () => {
        if (keyA.isDown) {
          this.cameras.main.scrollX -= 5;
        }
        if (keyD.isDown) {
          this.cameras.main.scrollX += 5;
        }
      });
    }
  }
}
