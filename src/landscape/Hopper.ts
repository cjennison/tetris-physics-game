/**
 * Hopper — A pipe from the sky that drops trash onto a growing pile
 *
 * LEARN: The hopper is now a pipe — a visual tube at the top-left of
 * the screen. Every N seconds, a new trash piece falls out of the pipe
 * and lands on the ground, forming a growing pile. The pile is open —
 * pieces sit on the ground with physics, not inside a container.
 *
 * The player drives a crane vehicle to the pile, grabs a piece, and
 * carries it to a processing column. If the pile grows too big, pieces
 * start rolling across the landscape and blocking things.
 */
import Phaser from 'phaser';
import { PieceFactory, type SpawnedPiece, getPieceData } from '../pieces/PieceFactory';
import { PieceRenderer } from '../systems/PieceRenderer';
import { PIPE_X, PIPE_Y, PIPE_WIDTH, PILE_LEFT, PILE_RIGHT } from '../config';
import { Terrain } from './Terrain';

export interface HopperConfig {
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
  private countText!: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, config: HopperConfig, renderer: PieceRenderer) {
    this.scene = scene;
    this.config = config;
    this.factory = new PieceFactory(scene);
    this.renderer = renderer;
    this.graphics = scene.add.graphics();
    this.graphics.setDepth(8);

    this.drawPipe();

    this.countText = scene.add.text(PIPE_X, Terrain.getHeightAt(PIPE_X) - 10, '', {
      fontSize: '11px', color: '#ff8844', fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(10);
  }

  update(): void {
    const now = Date.now();
    if (now - this.lastSpawnTime >= this.config.spawnInterval * 1000) {
      this.spawnPiece();
      this.lastSpawnTime = now;
    }

    const count = this.getPileCount();
    this.countText.setText(count > 0 ? `${count}` : '');
  }

  /**
   * Grab the topmost piece from the pile near the pipe.
   * Returns a fresh SpawnedPiece with the same shape/material.
   */
  popPiece(): SpawnedPiece | null {
    const bodies = this.scene.matter.world.getAllBodies();
    let topmost: MatterJS.BodyType | null = null;
    let topY = Infinity;

    for (const body of bodies) {
      if (body.isStatic) continue;
      if (!body.label?.startsWith('piece-')) continue;

      // Check if this piece is in the pile zone
      if (body.position.x >= PILE_LEFT && body.position.x <= PILE_RIGHT &&
          body.position.y < Terrain.getHeightAt(PIPE_X)) {
        if (body.position.y < topY) {
          topY = body.position.y;
          topmost = body;
        }
      }
    }

    if (!topmost) return null;

    const parent = (topmost as MatterJS.BodyType & { parent?: MatterJS.BodyType }).parent ?? topmost;
    const data = getPieceData(parent);
    if (!data) return null;

    // Remove the original body
    this.renderer.removeBody(parent);
    this.scene.matter.world.remove(parent);

    // Create a fresh piece with same shape/material
    this.factory.setForcedShape(data.name.replace('-sliced', '').replace('-shard', ''));
    this.factory.setForcedMaterial(data.materialKey);
    const spawned = this.factory.spawnPiece(0, 0);
    this.factory.setForcedShape(null);
    this.factory.setForcedMaterial(null);

    return spawned;
  }

  getPileCount(): number {
    let count = 0;
    for (const body of this.scene.matter.world.getAllBodies()) {
      if (body.isStatic) continue;
      if (!body.label?.startsWith('piece-')) continue;
      if (body.position.x >= PILE_LEFT && body.position.x <= PILE_RIGHT &&
          body.position.y < Terrain.getHeightAt(PIPE_X)) {
        count++;
      }
    }
    return count;
  }

  private spawnPiece(): void {
    // Drop from the pipe with slight random X offset
    const x = PIPE_X + (Math.random() - 0.5) * (PIPE_WIDTH * 0.5);
    const y = PIPE_Y + 20;

    const spawned = this.factory.spawnPiece(x, y);
    this.renderer.addBody(spawned.body);
  }

  private drawPipe(): void {
    const g = this.scene.add.graphics();
    const halfW = PIPE_WIDTH / 2;

    // Pipe body (comes from off-screen top)
    g.fillStyle(0x555566);
    g.fillRect(PIPE_X - halfW, 0, PIPE_WIDTH, PIPE_Y + 30);

    // Pipe opening (wider flare at the bottom)
    g.fillStyle(0x666677);
    g.fillRect(PIPE_X - halfW - 8, PIPE_Y + 20, PIPE_WIDTH + 16, 15);

    // Pipe label
    this.scene.add.text(PIPE_X, PIPE_Y + 50, 'INCOMING', {
      fontSize: '10px', color: '#666677', fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(10);

    g.setDepth(7);
  }
}
