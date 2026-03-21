/**
 * Hopper — The incoming trash container
 *
 * LEARN: The hopper is where trucks dump trash. It fills up over time
 * on a timer. The player must grab pieces from the hopper and deliver
 * them to processing columns before it overflows.
 *
 * The hopper is a physical container in the shared Matter.js world —
 * pieces pile up inside it with real physics. When the player transfers
 * a piece, we grab the topmost body and move it to the target column.
 */
import Phaser from 'phaser';
import { PieceFactory, type SpawnedPiece, getPieceData } from '../pieces/PieceFactory';
import { PieceRenderer } from '../systems/PieceRenderer';
import { WALL_THICKNESS } from '../config';

export interface HopperConfig {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Seconds between new piece spawns */
  spawnInterval: number;
}

export class Hopper {
  private scene: Phaser.Scene;
  private config: HopperConfig;
  private factory: PieceFactory;
  private renderer: PieceRenderer;
  private graphics: Phaser.GameObjects.Graphics;

  private lastSpawnTime = 0;
  private capacityText!: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, config: HopperConfig, renderer: PieceRenderer) {
    this.scene = scene;
    this.config = config;
    this.factory = new PieceFactory(scene);
    this.renderer = renderer;
    this.graphics = scene.add.graphics();
    this.graphics.setDepth(1);

    this.createWalls();
    this.drawStatic();

    scene.add.text(
      config.x + config.width / 2, config.y - 15,
      'HOPPER', {
        fontSize: '14px', color: '#ff8844', fontFamily: 'monospace',
      },
    ).setOrigin(0.5).setDepth(10);

    this.capacityText = scene.add.text(
      config.x + config.width / 2, config.y + config.height + 15,
      '', {
        fontSize: '11px', color: '#888888', fontFamily: 'monospace',
      },
    ).setOrigin(0.5).setDepth(10);
  }

  update(): void {
    const now = Date.now();
    if (now - this.lastSpawnTime >= this.config.spawnInterval * 1000) {
      this.spawnPiece();
      this.lastSpawnTime = now;
    }

    const count = this.getPieceCount();
    this.capacityText.setText(`${count} pieces`);

    this.drawCapacityBar();
  }

  /** Grab the topmost piece from the hopper and return it for delivery */
  popPiece(): SpawnedPiece | null {
    const bodies = this.scene.matter.world.getAllBodies();
    let topmost: MatterJS.BodyType | null = null;
    let topY = Infinity;

    for (const body of bodies) {
      if (body.isStatic) continue;
      if (!body.label?.startsWith('piece-')) continue;

      // Check if this piece is inside the hopper bounds
      const inHopper =
        body.position.x > this.config.x &&
        body.position.x < this.config.x + this.config.width &&
        body.position.y > this.config.y &&
        body.position.y < this.config.y + this.config.height;

      if (inHopper && body.position.y < topY) {
        topY = body.position.y;
        topmost = body;
      }
    }

    if (!topmost) return null;

    // Resolve to parent for compound bodies
    const parent = (topmost as MatterJS.BodyType & { parent?: MatterJS.BodyType }).parent ?? topmost;
    const data = getPieceData(parent);
    if (!data) return null;

    // Remove from renderer (column will re-add it)
    this.renderer.removeBody(parent);
    // Remove from physics world (column will re-create positioning)
    this.scene.matter.world.remove(parent);

    // Create a fresh piece with the same shape and material — simpler than
    // trying to transfer a body between positions
    this.factory.setForcedShape(data.name);
    this.factory.setForcedMaterial(data.materialKey);
    const spawned = this.factory.spawnPiece(0, 0); // position doesn't matter, column will place it
    this.factory.setForcedShape(null);
    this.factory.setForcedMaterial(null);

    return spawned;
  }

  getPieceCount(): number {
    const bodies = this.scene.matter.world.getAllBodies();
    let count = 0;
    for (const body of bodies) {
      if (body.isStatic) continue;
      if (!body.label?.startsWith('piece-')) continue;
      if (body.position.x > this.config.x &&
          body.position.x < this.config.x + this.config.width) {
        count++;
      }
    }
    return count;
  }

  private spawnPiece(): void {
    // Spawn at random X within hopper, just above the top
    const x = this.config.x + WALL_THICKNESS + Math.random() * (this.config.width - WALL_THICKNESS * 2);
    const y = this.config.y + 30;

    const spawned = this.factory.spawnPiece(x, y);
    this.renderer.addBody(spawned.body);
  }

  private createWalls(): void {
    const { x, y, width, height } = this.config;
    const t = WALL_THICKNESS;

    // Floor
    this.scene.matter.add.rectangle(
      x + width / 2, y + height - t / 2, width, t,
      { isStatic: true, label: 'hopper-floor', collisionFilter: { category: 0x0001, mask: 0x0002 } },
    );
    // Left wall
    this.scene.matter.add.rectangle(
      x + t / 2, y + height / 2, t, height,
      { isStatic: true, label: 'hopper-wall-left', collisionFilter: { category: 0x0001, mask: 0x0002 } },
    );
    // Right wall
    this.scene.matter.add.rectangle(
      x + width - t / 2, y + height / 2, t, height,
      { isStatic: true, label: 'hopper-wall-right', collisionFilter: { category: 0x0001, mask: 0x0002 } },
    );
  }

  private drawStatic(): void {
    const { x, y, width, height } = this.config;
    const g = this.scene.add.graphics();

    // Hopper background
    g.fillStyle(0x1a1520);
    g.fillRect(x, y, width, height);

    // Walls
    g.fillStyle(0x554433);
    g.fillRect(x, y + height - WALL_THICKNESS, width, WALL_THICKNESS);
    g.fillRect(x, y, WALL_THICKNESS, height);
    g.fillRect(x + width - WALL_THICKNESS, y, WALL_THICKNESS, height);

    g.setDepth(0);
  }

  private drawCapacityBar(): void {
    this.graphics.clear();
    const count = this.getPieceCount();
    const maxCapacity = 15; // Visual max for the bar
    const fill = Math.min(1, count / maxCapacity);

    const barX = this.config.x + this.config.width + 5;
    const barY = this.config.y;
    const barW = 8;
    const barH = this.config.height;

    // Background
    this.graphics.fillStyle(0x222222);
    this.graphics.fillRect(barX, barY, barW, barH);

    // Fill (bottom to top, green→yellow→red)
    const fillH = barH * fill;
    const color = fill < 0.5 ? 0x44aa44 : fill < 0.8 ? 0xaaaa44 : 0xaa4444;
    this.graphics.fillStyle(color, 0.8);
    this.graphics.fillRect(barX, barY + barH - fillH, barW, fillH);
  }
}
