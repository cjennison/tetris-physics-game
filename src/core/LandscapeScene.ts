/**
 * LandscapeScene — The dump landscape
 *
 * Left wall with pipe chute → trash pile → hilly terrain → column
 * Vehicle drives across terrain, grabs from pile, drops into column.
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
    // Camera — allow zooming out to see the full landscape
    this.cameras.main.setBounds(0, 0, LANDSCAPE_WIDTH, LANDSCAPE_HEIGHT);

    // Global piece renderer
    this.pieceRenderer = new PieceRenderer(this);

    // Background
    this.add.graphics()
      .fillStyle(0x0d0d1a)
      .fillRect(0, 0, LANDSCAPE_WIDTH, LANDSCAPE_HEIGHT)
      .setDepth(-2);

    // Terrain
    new Terrain(this);

    // Boundary walls
    this.createWalls();

    // Hopper (pipe from upper-left wall)
    const hopperConfig: HopperConfig = { spawnInterval: 4 };
    this.hopper = new Hopper(this, hopperConfig, this.pieceRenderer);

    // Processing column
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

    // Crane vehicle
    this.vehicle = new CraneVehicle(this, this.pieceRenderer, 250);

    for (const col of this.columns) {
      this.vehicle.addColumnZone(
        col.config.originX,
        col.config.originX + col.config.width,
        (piece) => col.receivePiece(piece),
      );
    }

    // Zoom controls
    this.setupZoom();

    // Instructions (fixed to camera, not world)
    const instructions = this.add.text(0, 0,
      '← → drive  |  ↑↓ boom  |  SHIFT+↑↓ rope  |  SPACE grab/drop  |  scroll = zoom', {
        fontSize: '11px', color: '#445566', fontFamily: 'monospace',
        backgroundColor: '#0d0d1a88',
        padding: { x: 6, y: 4 },
      }).setDepth(20);
    // Pin to bottom of camera viewport
    instructions.setScrollFactor(0);
    instructions.setPosition(10, this.cameras.main.height - 20);

    const title = this.add.text(0, 0, 'T R A S H', {
      fontSize: '16px', color: '#223344', fontFamily: 'monospace',
    }).setDepth(20).setScrollFactor(0).setPosition(10, 5);
    void title;
  }

  update(time: number, delta: number): void {
    this.pieceRenderer.draw();
    this.hopper.update();
    this.vehicle.update();
    for (const col of this.columns) {
      col.update(time, delta);
    }
  }

  private createWalls(): void {
    const wallThickness = 30;
    const wallFilter = { category: 0x0001, mask: 0x0002 | 0x0010 };

    /**
     * LEARN: The left wall has a GAP where the chute exits. Pieces spawn
     * off-screen and slide through this gap into the landscape. The wall
     * is split into two parts: above the chute and below the chute.
     */
    const gapTop = 200;    // Top of chute opening — generous gap
    const gapBottom = 430; // Bottom of chute opening

    // Left wall visual (with gap)
    const g = this.add.graphics();
    g.fillStyle(0x333344);
    g.fillRect(0, 0, wallThickness, gapTop);                                    // Above gap
    g.fillRect(0, gapBottom, wallThickness, LANDSCAPE_HEIGHT - gapBottom);       // Below gap
    g.setDepth(6);

    // Left wall physics — above gap
    const aboveH = gapTop;
    this.matter.add.rectangle(
      wallThickness / 2, aboveH / 2, wallThickness, aboveH,
      { isStatic: true, label: 'wall-left-above', collisionFilter: wallFilter },
    );
    // Left wall physics — below gap
    const belowH = LANDSCAPE_HEIGHT - gapBottom + 200; // Extra below screen
    this.matter.add.rectangle(
      wallThickness / 2, gapBottom + belowH / 2, wallThickness, belowH,
      { isStatic: true, label: 'wall-left-below', collisionFilter: wallFilter },
    );

    // Right wall (solid, no gap)
    const g2 = this.add.graphics();
    g2.fillStyle(0x333344);
    g2.fillRect(LANDSCAPE_WIDTH - wallThickness, 0, wallThickness, LANDSCAPE_HEIGHT);
    g2.setDepth(6);

    this.matter.add.rectangle(
      LANDSCAPE_WIDTH - wallThickness / 2, LANDSCAPE_HEIGHT / 2, wallThickness, LANDSCAPE_HEIGHT * 2,
      { isStatic: true, label: 'wall-right', collisionFilter: wallFilter },
    );
  }

  private setupZoom(): void {
    // Mouse wheel zoom
    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _gameObjects: unknown[], _deltaX: number, deltaY: number) => {
      const cam = this.cameras.main;
      const newZoom = Phaser.Math.Clamp(cam.zoom + (deltaY > 0 ? -0.05 : 0.05), 0.4, 2.0);
      cam.setZoom(newZoom);
    });

    // Pinch zoom for mobile
    this.input.addPointer(1); // Enable second pointer
    let pinchDist = 0;

    this.input.on('pointerdown', () => {
      if (this.input.pointer1.isDown && this.input.pointer2.isDown) {
        const p1 = this.input.pointer1;
        const p2 = this.input.pointer2;
        pinchDist = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);
      }
    });

    this.input.on('pointermove', () => {
      if (this.input.pointer1.isDown && this.input.pointer2.isDown) {
        const p1 = this.input.pointer1;
        const p2 = this.input.pointer2;
        const newDist = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);
        if (pinchDist > 0) {
          const scale = newDist / pinchDist;
          const cam = this.cameras.main;
          cam.setZoom(Phaser.Math.Clamp(cam.zoom * scale, 0.4, 2.0));
        }
        pinchDist = newDist;
      }
    });
  }
}
