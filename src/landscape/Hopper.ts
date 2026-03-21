/**
 * Hopper — Pipe chute from the upper-left wall
 *
 * LEARN: The hopper is now a chute/pipe emerging from the left wall
 * at an angle. Pieces slide out of the chute and tumble down onto
 * the ground, forming a growing pile. This looks like a real dump
 * where trucks dump from a ramp above.
 */
import Phaser from 'phaser';
import { PieceFactory, type SpawnedPiece, getPieceData } from '../pieces/PieceFactory';
import { PieceRenderer } from '../systems/PieceRenderer';
import { PILE_LEFT, PILE_RIGHT } from '../config';
import { Terrain } from './Terrain';

/** Chute configuration */
const CHUTE_EXIT_X = 60;   // Where pieces come out (X)
const CHUTE_EXIT_Y = 280;  // Where pieces come out (Y)
const CHUTE_ANGLE = 0.5;   // Angle of the chute (radians, tilted right)

export interface HopperConfig {
  spawnInterval: number;
}

export class Hopper {
  private scene: Phaser.Scene;
  private config: HopperConfig;
  private factory: PieceFactory;
  private renderer: PieceRenderer;
  private graphics: Phaser.GameObjects.Graphics;
  private lastSpawnTime = 0;
  private countText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, config: HopperConfig, renderer: PieceRenderer) {
    this.scene = scene;
    this.config = config;
    this.factory = new PieceFactory(scene);
    this.renderer = renderer;
    this.graphics = scene.add.graphics();
    this.graphics.setDepth(8);

    this.drawChute();
    this.createChutePhysics();

    this.countText = scene.add.text(CHUTE_EXIT_X + 40, CHUTE_EXIT_Y + 20, '', {
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
    this.countText.setText(count > 0 ? `pile: ${count}` : '');
  }

  popPiece(): SpawnedPiece | null {
    const terrainY = Terrain.getHeightAt(120);
    const bodies = this.scene.matter.world.getAllBodies();
    let topmost: MatterJS.BodyType | null = null;
    let topY = Infinity;

    for (const body of bodies) {
      if (body.isStatic) continue;
      if (!body.label?.startsWith('piece-')) continue;
      if (body.position.x >= PILE_LEFT && body.position.x <= PILE_RIGHT &&
          body.position.y < terrainY) {
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

    this.renderer.removeBody(parent);
    this.scene.matter.world.remove(parent);

    this.factory.setForcedShape(data.name.replace('-sliced', '').replace('-shard', ''));
    this.factory.setForcedMaterial(data.materialKey);
    const spawned = this.factory.spawnPiece(0, 0);
    this.factory.setForcedShape(null);
    this.factory.setForcedMaterial(null);
    return spawned;
  }

  getPileCount(): number {
    const terrainY = Terrain.getHeightAt(120);
    let count = 0;
    for (const body of this.scene.matter.world.getAllBodies()) {
      if (body.isStatic) continue;
      if (!body.label?.startsWith('piece-')) continue;
      if (body.position.x >= PILE_LEFT && body.position.x <= PILE_RIGHT &&
          body.position.y < terrainY) {
        count++;
      }
    }
    return count;
  }

  private spawnPiece(): void {
    // Spawn at the chute exit with a slight rightward velocity (slides out)
    const x = CHUTE_EXIT_X;
    const y = CHUTE_EXIT_Y;
    const spawned = this.factory.spawnPiece(x, y);

    // Give it velocity matching the chute angle so it slides out
    this.scene.matter.body.setVelocity(spawned.body, {
      x: Math.cos(CHUTE_ANGLE) * 3,
      y: Math.sin(CHUTE_ANGLE) * 2,
    });

    this.renderer.addBody(spawned.body);
  }

  /** Create physics walls for the chute so pieces slide along it */
  private createChutePhysics(): void {
    // Chute bottom ramp — angled surface pieces slide on
    const rampLength = 120;
    const rampMidX = 30 + Math.cos(CHUTE_ANGLE) * rampLength / 2;
    const rampMidY = CHUTE_EXIT_Y - 30 + Math.sin(CHUTE_ANGLE) * rampLength / 2;

    this.scene.matter.add.rectangle(
      rampMidX, rampMidY, rampLength, 10,
      {
        isStatic: true,
        angle: CHUTE_ANGLE,
        label: 'chute-ramp',
        friction: 0.3,
        collisionFilter: { category: 0x0001, mask: 0x0002 },
      },
    );
  }

  private drawChute(): void {
    const g = this.scene.add.graphics();

    // Chute body — comes from the left wall at an angle
    const wallX = 30; // Left wall thickness
    const startY = 100;
    const endX = CHUTE_EXIT_X + 60;
    const endY = CHUTE_EXIT_Y;
    const chuteWidth = 50;

    // Upper edge
    g.lineStyle(3, 0x555566);
    g.lineBetween(wallX, startY, endX, endY - chuteWidth / 2);
    // Lower edge (ramp)
    g.lineBetween(wallX, startY + chuteWidth, endX, endY + chuteWidth / 2);

    // Fill
    g.fillStyle(0x3a3a4a, 0.6);
    g.beginPath();
    g.moveTo(wallX, startY);
    g.lineTo(endX, endY - chuteWidth / 2);
    g.lineTo(endX, endY + chuteWidth / 2);
    g.lineTo(wallX, startY + chuteWidth);
    g.closePath();
    g.fillPath();

    // Wall backing (solid rectangle on the left wall where chute exits)
    g.fillStyle(0x444455);
    g.fillRect(0, startY - 10, wallX + 5, chuteWidth + 20);

    // Opening lip
    g.fillStyle(0x666677);
    g.fillRect(endX - 5, endY - chuteWidth / 2 - 3, 10, chuteWidth + 6);

    g.setDepth(7);
  }
}
