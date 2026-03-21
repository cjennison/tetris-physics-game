/**
 * LandscapeScene — The dump landscape
 *
 * LEARN: The landscape is a hilly terrain like a garbage dump.
 * - Left (low area): Pipe drops trash into a growing pile
 * - Middle: Hilly terrain the crane vehicle drives across
 * - Right (hilltop): Processing column sunk into the ground
 *
 * The vehicle drives over the bumpy terrain, grabs pieces from the
 * pile, carries them uphill, and drops them into the column.
 */
import Phaser from 'phaser';
import { PieceRenderer } from '../systems/PieceRenderer';
import { ProcessingColumn, type ColumnConfig } from './ProcessingColumn';
import { Hopper, type HopperConfig } from '../landscape/Hopper';
import { CraneVehicle } from '../landscape/CraneVehicle';
import { Terrain, COLUMN_GAP_LEFT, COLUMN_GAP_RIGHT, COLUMN_GROUND_Y } from '../landscape/Terrain';
import {
  LANDSCAPE_WIDTH,
  LANDSCAPE_HEIGHT,
  COLUMN_HEIGHT,
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
    this.cameras.main.setBounds(0, 0, LANDSCAPE_WIDTH, LANDSCAPE_HEIGHT);

    // Global piece renderer
    this.pieceRenderer = new PieceRenderer(this);

    // Background
    this.add.graphics()
      .fillStyle(0x0d0d1a)
      .fillRect(0, 0, LANDSCAPE_WIDTH, LANDSCAPE_HEIGHT)
      .setDepth(-2);

    // Create terrain (hilly ground with column gap)
    new Terrain(this);

    // Pipe / hopper — drops trash on the left (low area)
    const hopperConfig: HopperConfig = { spawnInterval: 4 };
    this.hopper = new Hopper(this, hopperConfig, this.pieceRenderer);

    // Processing column — sunk into the hilltop at the gap
    const columnWidth = COLUMN_GAP_RIGHT - COLUMN_GAP_LEFT;
    const col1Config: ColumnConfig = {
      id: 'column-1',
      originX: COLUMN_GAP_LEFT,
      originY: COLUMN_GROUND_Y,
      width: columnWidth,
      height: COLUMN_HEIGHT,
      laserCount: 5,
    };
    const col1 = new ProcessingColumn(this, col1Config, this.pieceRenderer);
    col1.create();
    this.columns.push(col1);

    // Crane vehicle — starts in the low area near the pile
    this.vehicle = new CraneVehicle(this, this.pieceRenderer, 250);

    // Wire up column delivery zones
    for (const col of this.columns) {
      this.vehicle.addColumnZone(
        col.config.originX,
        col.config.originX + col.config.width,
        (piece) => col.receivePiece(piece),
      );
    }

    // Instructions
    this.add.text(LANDSCAPE_WIDTH / 2, LANDSCAPE_HEIGHT - 15,
      '← → drive   |   SPACE = grab / drop', {
        fontSize: '11px', color: '#445566', fontFamily: 'monospace',
      }).setOrigin(0.5).setDepth(10);

    this.add.text(LANDSCAPE_WIDTH / 2, 12, 'T R A S H', {
      fontSize: '18px', color: '#223344', fontFamily: 'monospace',
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
}
