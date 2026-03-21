/**
 * LandscapeScene — The full game world
 *
 * LEARN: One Phaser Scene, one physics world. Contains:
 * - A PIPE on the left that drops trash from the sky into a growing pile
 * - A CRANE VEHICLE the player drives left/right across the ground
 * - PROCESSING COLUMNS sunk into the ground where lasers break down trash
 *
 * Flow: pipe drops trash → pile grows → player drives to pile → grabs
 * piece → drives to column → delivers piece → column crane takes over
 */
import Phaser from 'phaser';
import { PieceRenderer } from '../systems/PieceRenderer';
import { ProcessingColumn, type ColumnConfig } from './ProcessingColumn';
import { Hopper, type HopperConfig } from '../landscape/Hopper';
import { CraneVehicle } from '../landscape/CraneVehicle';
import {
  LANDSCAPE_WIDTH,
  LANDSCAPE_HEIGHT,
  GROUND_Y,
  COLUMN_START_X,
  COLUMN_WIDTH,
  COLUMN_HEIGHT,
  COLUMN_TOP_Y,
  WALL_THICKNESS,
  PILE_RIGHT,
} from '../config';

export class LandscapeScene extends Phaser.Scene {
  private pieceRenderer!: PieceRenderer;
  private hopper!: Hopper;
  private vehicle!: CraneVehicle;
  private columns: ProcessingColumn[] = [];

  constructor() {
    super({ key: 'landscape' });
  }

  create(): void {
    // Camera — no scrolling needed, everything fits
    this.cameras.main.setBounds(0, 0, LANDSCAPE_WIDTH, LANDSCAPE_HEIGHT);

    // Global piece renderer
    this.pieceRenderer = new PieceRenderer(this);

    // Draw world
    this.drawLandscape();
    this.createGround();

    // Pipe / hopper
    const hopperConfig: HopperConfig = { spawnInterval: 4 };
    this.hopper = new Hopper(this, hopperConfig, this.pieceRenderer);

    // Processing column
    const col1Config: ColumnConfig = {
      id: 'column-1',
      originX: COLUMN_START_X,
      originY: COLUMN_TOP_Y,
      width: COLUMN_WIDTH,
      height: COLUMN_HEIGHT,
      laserCount: 5,
    };
    const col1 = new ProcessingColumn(this, col1Config, this.pieceRenderer);
    col1.create();
    this.columns.push(col1);

    // Crane vehicle
    this.vehicle = new CraneVehicle(this, this.pieceRenderer, PILE_RIGHT + 50);

    // Wire up grab callback — grabs from the pile
    this.vehicle.setGrabCallback(() => this.hopper.popPiece());

    // Wire up delivery zones — one per column
    for (const col of this.columns) {
      this.vehicle.addColumnZone(
        col.config.originX,
        col.config.originX + col.config.width,
        (piece) => col.receivePiece(piece),
      );
    }

    // Instructions
    this.add.text(LANDSCAPE_WIDTH / 2, LANDSCAPE_HEIGHT - 20,
      '← → drive   |   SPACE near pile = grab   |   SPACE over column = deliver', {
      fontSize: '11px', color: '#445566', fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(10);

    // Title
    this.add.text(LANDSCAPE_WIDTH / 2, 15, 'T R A S H', {
      fontSize: '20px', color: '#334455', fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(0);
  }

  update(time: number, delta: number): void {
    this.pieceRenderer.draw();
    this.hopper.update();
    this.vehicle.update();

    for (const col of this.columns) {
      col.update(time, delta);
    }
  }

  private drawLandscape(): void {
    const g = this.add.graphics();

    // Ground surface
    g.fillStyle(0x2a2a35);
    g.fillRect(0, GROUND_Y, LANDSCAPE_WIDTH, LANDSCAPE_HEIGHT - GROUND_Y);

    // Ground surface line
    g.lineStyle(2, 0x3a3a4a);
    g.lineBetween(0, GROUND_Y, LANDSCAPE_WIDTH, GROUND_Y);

    // Column opening visual (gap in ground)
    for (let i = 0; i < 1; i++) {
      const cx = COLUMN_START_X;
      g.fillStyle(0x151528);
      g.fillRect(cx, GROUND_Y - 3, COLUMN_WIDTH, 8);
    }

    g.setDepth(-1);
  }

  private createGround(): void {
    // Ground with a gap for the column
    const colLeft = COLUMN_START_X;
    const colRight = COLUMN_START_X + COLUMN_WIDTH;

    // Ground left of column
    if (colLeft > 0) {
      const w = colLeft;
      this.matter.add.rectangle(
        w / 2, GROUND_Y + WALL_THICKNESS / 2, w, WALL_THICKNESS,
        { isStatic: true, label: 'ground-left', collisionFilter: { category: 0x0001, mask: 0x0002 } },
      );
    }

    // Ground right of column
    const rightStart = colRight;
    const rightW = LANDSCAPE_WIDTH - rightStart;
    if (rightW > 0) {
      this.matter.add.rectangle(
        rightStart + rightW / 2, GROUND_Y + WALL_THICKNESS / 2, rightW, WALL_THICKNESS,
        { isStatic: true, label: 'ground-right', collisionFilter: { category: 0x0001, mask: 0x0002 } },
      );
    }

    // Left landscape wall (prevent pieces rolling off screen)
    this.matter.add.rectangle(
      5, GROUND_Y / 2, 10, GROUND_Y,
      { isStatic: true, label: 'wall-left', collisionFilter: { category: 0x0001, mask: 0x0002 } },
    );
  }
}
