/**
 * LandscapeScene — The full dump world
 *
 * Layout (2000 x 1200):
 *   Upper-Left: Pipe drops pieces from here
 *   Lower-Left: Pile zone — pieces land, vehicle picks up
 *   Lower-Right: Hilltop with processing column
 *   Camera starts zoomed in on lower-left, pans to follow vehicle
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
  VIEWPORT_HEIGHT,
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
    // Camera — world is bigger than viewport
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

    // Walls
    this.createWalls();

    // Hopper (pipe from upper-left)
    const hopperConfig: HopperConfig = { spawnInterval: 4 };
    this.hopper = new Hopper(this, hopperConfig, this.pieceRenderer);

    // Processing column (sunk into hilltop)
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

    // Crane vehicle (starts in the lower-left pile area)
    this.vehicle = new CraneVehicle(this, this.pieceRenderer, 300);

    for (const col of this.columns) {
      this.vehicle.addColumnZone(
        col.config.originX,
        col.config.originX + col.config.width,
        (piece) => col.receivePiece(piece),
      );
    }

    // Camera: start zoomed in on the lower-left (pile area)
    this.setupCamera();

    // HUD (fixed to camera)
    const instructions = this.add.text(0, 0,
      '← → drive  |  ↑↓ boom  |  SHIFT+↑↓ rope  |  SPACE grab/drop  |  scroll zoom  |  middle-drag pan', {
        fontSize: '10px', color: '#445566', fontFamily: 'monospace',
        backgroundColor: '#0d0d1a99',
        padding: { x: 6, y: 3 },
      }).setDepth(20).setScrollFactor(0).setPosition(5, VIEWPORT_HEIGHT - 18);
    void instructions;

    this.add.text(0, 0, 'T R A S H', {
      fontSize: '14px', color: '#223344', fontFamily: 'monospace',
    }).setDepth(20).setScrollFactor(0).setPosition(5, 5);
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

    // Left wall gap for chute (Y 380–580)
    const gapTop = 380;
    const gapBottom = 580;

    // Left wall — above gap
    const g = this.add.graphics();
    g.fillStyle(0x333344);
    g.fillRect(0, 0, wallThickness, gapTop);
    g.fillRect(0, gapBottom, wallThickness, LANDSCAPE_HEIGHT - gapBottom);
    g.setDepth(6);

    this.matter.add.rectangle(
      wallThickness / 2, gapTop / 2, wallThickness, gapTop,
      { isStatic: true, label: 'wall-left-above', collisionFilter: wallFilter },
    );
    this.matter.add.rectangle(
      wallThickness / 2, gapBottom + (LANDSCAPE_HEIGHT - gapBottom) / 2,
      wallThickness, LANDSCAPE_HEIGHT - gapBottom + 200,
      { isStatic: true, label: 'wall-left-below', collisionFilter: wallFilter },
    );

    // Right wall
    const g2 = this.add.graphics();
    g2.fillStyle(0x333344);
    g2.fillRect(LANDSCAPE_WIDTH - wallThickness, 0, wallThickness, LANDSCAPE_HEIGHT);
    g2.setDepth(6);

    this.matter.add.rectangle(
      LANDSCAPE_WIDTH - wallThickness / 2, LANDSCAPE_HEIGHT / 2,
      wallThickness, LANDSCAPE_HEIGHT * 2,
      { isStatic: true, label: 'wall-right', collisionFilter: wallFilter },
    );

    // Ceiling (prevent pieces flying off the top)
    this.matter.add.rectangle(
      LANDSCAPE_WIDTH / 2, -10, LANDSCAPE_WIDTH, 20,
      { isStatic: true, label: 'ceiling', collisionFilter: wallFilter },
    );
  }

  private setupCamera(): void {
    const cam = this.cameras.main;

    // Start focused on the lower-left (pile area where the action begins)
    cam.setZoom(1.0);
    cam.centerOn(300, 850);

    // Zoom with mouse wheel
    this.input.on('wheel', (
      _pointer: Phaser.Input.Pointer,
      _gameObjects: unknown[],
      _deltaX: number,
      deltaY: number,
    ) => {
      const newZoom = Phaser.Math.Clamp(cam.zoom + (deltaY > 0 ? -0.05 : 0.05), 0.35, 2.0);
      cam.setZoom(newZoom);
    });

    /**
     * LEARN: Pan by dragging anywhere on the canvas. Single finger/left
     * click drag pans the camera. This conflicts with the touch control
     * buttons, but those are DOM overlays above the canvas — they
     * intercept touches before Phaser sees them. So dragging on the
     * game area pans, while tapping buttons controls the crane.
     */
    let isPanning = false;
    let panStartX = 0;
    let panStartY = 0;
    let camStartX = 0;
    let camStartY = 0;

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      isPanning = true;
      panStartX = pointer.x;
      panStartY = pointer.y;
      camStartX = cam.scrollX;
      camStartY = cam.scrollY;
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (isPanning && pointer.isDown) {
        const dx = (panStartX - pointer.x) / cam.zoom;
        const dy = (panStartY - pointer.y) / cam.zoom;
        cam.scrollX = camStartX + dx;
        cam.scrollY = camStartY + dy;
      }
    });

    this.input.on('pointerup', () => {
      isPanning = false;
    });

    // Pinch zoom for mobile
    this.input.addPointer(1);
    let pinchDist = 0;

    this.input.on('pointerdown', () => {
      if (this.input.pointer1.isDown && this.input.pointer2.isDown) {
        isPanning = false; // Cancel pan when pinching
        pinchDist = Phaser.Math.Distance.Between(
          this.input.pointer1.x, this.input.pointer1.y,
          this.input.pointer2.x, this.input.pointer2.y,
        );
      }
    });

    this.input.on('pointermove', () => {
      if (this.input.pointer1.isDown && this.input.pointer2.isDown) {
        const newDist = Phaser.Math.Distance.Between(
          this.input.pointer1.x, this.input.pointer1.y,
          this.input.pointer2.x, this.input.pointer2.y,
        );
        if (pinchDist > 0) {
          cam.setZoom(Phaser.Math.Clamp(cam.zoom * (newDist / pinchDist), 0.35, 2.0));
        }
        pinchDist = newDist;
      }
    });
  }
}
