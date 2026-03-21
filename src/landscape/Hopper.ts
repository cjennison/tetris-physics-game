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
const CHUTE_EXIT_X = 80;    // Where pieces come out (X)
const CHUTE_EXIT_Y = 320;   // Where pieces come out (Y)
const CHUTE_ANGLE = 0.55;   // Angle of the chute (radians, tilted right)
const CHUTE_LENGTH = 220;   // Full ramp length (extends off-screen left)
/** Spawn point — top of the ramp, off-screen behind the left wall */
const SPAWN_X = CHUTE_EXIT_X - Math.cos(CHUTE_ANGLE) * CHUTE_LENGTH;
const SPAWN_Y = CHUTE_EXIT_Y - Math.sin(CHUTE_ANGLE) * CHUTE_LENGTH;

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
    /**
     * LEARN: Pieces spawn off-screen at the top of the ramp (behind the
     * left wall) and slide down the chute under gravity. The player sees
     * them emerge from the wall and tumble onto the pile — no popping
     * into existence.
     */
    const spawned = this.factory.spawnPiece(SPAWN_X, SPAWN_Y);

    // Give a small nudge along the ramp direction to start sliding
    this.scene.matter.body.setVelocity(spawned.body, {
      x: Math.cos(CHUTE_ANGLE) * 2,
      y: Math.sin(CHUTE_ANGLE) * 1,
    });

    this.renderer.addBody(spawned.body);
  }

  /** Create the chute ramp — long angled surface from off-screen to the exit */
  private createChutePhysics(): void {
    // Bottom ramp — extends from off-screen through the wall to the exit
    const rampMidX = (SPAWN_X + CHUTE_EXIT_X) / 2;
    const rampMidY = (SPAWN_Y + CHUTE_EXIT_Y) / 2;

    this.scene.matter.add.rectangle(
      rampMidX, rampMidY, CHUTE_LENGTH + 20, 10,
      {
        isStatic: true,
        angle: CHUTE_ANGLE,
        label: 'chute-ramp-bottom',
        friction: 0.2,
        collisionFilter: { category: 0x0001, mask: 0x0002 },
      },
    );

    // Top wall of chute — keeps pieces from flying off the ramp
    this.scene.matter.add.rectangle(
      rampMidX - Math.sin(CHUTE_ANGLE) * 35,
      rampMidY + Math.cos(CHUTE_ANGLE) * 35,
      CHUTE_LENGTH + 20, 8,
      {
        isStatic: true,
        angle: CHUTE_ANGLE,
        label: 'chute-ramp-top',
        friction: 0.1,
        collisionFilter: { category: 0x0001, mask: 0x0002 },
      },
    );
  }

  private drawChute(): void {
    const g = this.scene.add.graphics();

    const wallX = 30;
    const chuteWidth = 45;
    // Compute where the ramp meets the left wall
    const wallMeetY = CHUTE_EXIT_Y - Math.tan(CHUTE_ANGLE) * (CHUTE_EXIT_X - wallX);

    // Chute body — angled channel from wall to exit
    // Bottom edge (ramp surface)
    g.lineStyle(2, 0x555566);
    g.lineBetween(wallX, wallMeetY + chuteWidth / 2, CHUTE_EXIT_X + 15, CHUTE_EXIT_Y + chuteWidth / 2);
    // Top edge
    g.lineBetween(wallX, wallMeetY - chuteWidth / 2, CHUTE_EXIT_X + 15, CHUTE_EXIT_Y - chuteWidth / 2);

    // Fill
    g.fillStyle(0x3a3a4a, 0.5);
    g.beginPath();
    g.moveTo(wallX, wallMeetY - chuteWidth / 2);
    g.lineTo(CHUTE_EXIT_X + 15, CHUTE_EXIT_Y - chuteWidth / 2);
    g.lineTo(CHUTE_EXIT_X + 15, CHUTE_EXIT_Y + chuteWidth / 2);
    g.lineTo(wallX, wallMeetY + chuteWidth / 2);
    g.closePath();
    g.fillPath();

    // Wall cover — hides the part of the chute behind the wall
    g.fillStyle(0x333344);
    g.fillRect(0, 0, wallX + 2, wallMeetY + chuteWidth);

    // Opening lip at the exit
    g.fillStyle(0x555566);
    g.fillRect(CHUTE_EXIT_X + 10, CHUTE_EXIT_Y - chuteWidth / 2 - 3, 8, chuteWidth + 6);

    g.setDepth(7);
  }
}
