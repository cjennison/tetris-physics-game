/**
 * Hopper — Ejects trash pieces from a hole in the left wall
 *
 * No chute, no ramp — pieces simply pop out of a hole in the wall
 * with a bit of horizontal velocity and fall to the ground below.
 * Simple and clean.
 */
import Phaser from 'phaser';
import { PieceFactory, type SpawnedPiece, getPieceData } from '../pieces/PieceFactory';
import { PieceRenderer } from '../systems/PieceRenderer';
import { PILE_LEFT, PILE_RIGHT } from '../config';
import { Terrain } from './Terrain';

/** Where pieces eject from */
const EJECT_X = 40;    // Just past the left wall
const EJECT_Y = 500;   // Upper-left area
const EJECT_VX = 3;    // Horizontal velocity (rightward)
const EJECT_VY = 0.5;  // Slight downward

export interface HopperConfig {
  spawnInterval: number;
}

export class Hopper {
  private scene: Phaser.Scene;
  private config: HopperConfig;
  private factory: PieceFactory;
  private renderer: PieceRenderer;
  private lastSpawnTime = 0;
  private countText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, config: HopperConfig, renderer: PieceRenderer) {
    this.scene = scene;
    this.config = config;
    this.factory = new PieceFactory(scene);
    this.renderer = renderer;

    // Draw the wall hole
    const g = scene.add.graphics();
    g.fillStyle(0x222233);
    g.fillRect(0, EJECT_Y - 40, 45, 80); // Dark opening in the wall
    g.lineStyle(2, 0x444455);
    g.strokeRect(0, EJECT_Y - 40, 45, 80);
    g.setDepth(7);

    this.countText = scene.add.text(EJECT_X + 30, EJECT_Y - 50, '', {
      fontSize: '11px', color: '#ff8844', fontFamily: 'monospace',
    }).setDepth(10);
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
    const terrainY = Terrain.getHeightAt(150);
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
    const terrainY = Terrain.getHeightAt(150);
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
    const spawned = this.factory.spawnPiece(EJECT_X, EJECT_Y);
    // Eject rightward with slight randomness
    this.scene.matter.body.setVelocity(spawned.body, {
      x: EJECT_VX + Math.random() * 1.5,
      y: EJECT_VY + Math.random() * 0.5,
    });
    this.renderer.addBody(spawned.body);
  }
}
