/**
 * MagnetBallVehicle — Crane with a long arm and magnetic wrecking ball
 *
 * LEARN: This vehicle is a variant of the crane, but with key differences:
 * - The boom arm is 50% LONGER than the hook crane (150px vs 100px)
 * - Instead of a hook at the end, there's a large magnetic ball
 * - The ball attracts metal pieces when activated (like a scrapyard magnet)
 * - The ball is heavier, making the rope swing more slowly but with more momentum
 * - Only magnetic materials (aluminum, steel, lead) are attracted
 * - Non-magnetic materials (rubber, concrete, glass) are ignored
 *
 * Real-world reference: Scrapyard electromagnetic cranes use a large
 * circular electromagnet on a cable. When energized, ferrous metals
 * stick to it. When de-energized, everything drops. The ball swings
 * on the cable like a wrecking ball.
 *
 * Controls:
 *   ← →        : Drive (spin wheels)
 *   ↑ ↓        : Rotate boom arm
 *   SHIFT+↑/↓  : Reel rope in/out
 *   SPACE       : Toggle magnet on/off
 */
import Phaser from 'phaser';
import { CollisionCategory } from '../../types';
import { type SpawnedPiece, getPieceData } from '../../pieces/PieceFactory';
import {
  VEHICLE_WIDTH,
  VEHICLE_HEIGHT,
  VEHICLE_SPEED,
  LANDSCAPE_WIDTH,
} from '../../config';
import { Terrain } from '../Terrain';
import { TouchControls } from '../../ui/TouchControls';
import { type Vehicle, type ColumnZone } from './Vehicle';

const VEHICLE_CATEGORY = 0x0010;
const WHEEL_RADIUS = 13;

/**
 * LEARN: The magnet ball is bigger and heavier than a hook. This makes the
 * rope swing more ponderously — the player has to plan their movements
 * because the ball has real momentum. The longer boom compensates by
 * giving more reach.
 */
const BALL_RADIUS = 14;
const BALL_DENSITY = 0.008;

/**
 * LEARN: Only metals respond to magnets. In TRASH, aluminum/steel/lead
 * are magnetic. Rubber, concrete, and glass are not. This creates
 * strategic choices — the magnet vehicle is great for metal-heavy areas
 * but useless for rubber/concrete piles.
 */
const NON_MAGNETIC = new Set(['rubber', 'concrete', 'glass']);
const MAGNET_RADIUS = 200;
const MAGNET_FORCE = 0.018;

export class MagnetBallVehicle implements Vehicle {
  readonly type = 'magnet-ball';
  readonly displayName = 'Magnet Crane';
  readonly icon = '🧲';

  private scene: Phaser.Scene;
  private graphics: Phaser.GameObjects.Graphics;

  /** Vehicle parts */
  private chassis: MatterJS.BodyType;
  private wheelFront: MatterJS.BodyType;
  private wheelRear: MatterJS.BodyType;

  /** Boom arm — LONGER than hook crane */
  private boomAngle = -0.3;
  private readonly BOOM_LENGTH = 150;
  private readonly BOOM_MIN_ANGLE = -1.3;
  private readonly BOOM_MAX_ANGLE = 1.3;
  private readonly BOOM_SPEED = 0.02;

  /** Rope + magnetic ball */
  private ball: MatterJS.BodyType;
  private ropeConstraint: MatterJS.ConstraintType;
  private boomTip: MatterJS.BodyType;
  private ropeLength = 80;
  private readonly ROPE_MIN = 20;
  private readonly ROPE_MAX = 180;
  private readonly ROPE_SPEED = 1.5;

  /** Magnet state */
  private magnetOn = false;
  private attractedBodies: MatterJS.BodyType[] = [];

  /** Input */
  private leftKey: Phaser.Input.Keyboard.Key | null = null;
  private rightKey: Phaser.Input.Keyboard.Key | null = null;
  private upKey: Phaser.Input.Keyboard.Key | null = null;
  private downKey: Phaser.Input.Keyboard.Key | null = null;
  private shiftKey: Phaser.Input.Keyboard.Key | null = null;
  private spaceJustPressed = false;
  private touchControls: TouchControls;

  /** Column zones */
  private columnZones: ColumnZone[] = [];

  /** HUD */
  private vehicleLabel: Phaser.GameObjects.Text | null = null;

  constructor(scene: Phaser.Scene, startX: number, touchControls: TouchControls) {
    this.scene = scene;
    this.touchControls = touchControls;
    this.graphics = scene.add.graphics();
    this.graphics.setDepth(12);

    const terrainY = Terrain.getHeightAt(startX);
    const chassisY = terrainY - WHEEL_RADIUS - VEHICLE_HEIGHT / 2 - 2;
    const collisionMask = 0x0001 | CollisionCategory.PIECE | 0x0020;

    // Chassis — same base as hook crane
    this.chassis = scene.matter.add.rectangle(
      startX, chassisY, VEHICLE_WIDTH, VEHICLE_HEIGHT,
      {
        label: 'vehicle-chassis',
        friction: 0.8, frictionStatic: 1.0, frictionAir: 0.03, density: 0.01,
        collisionFilter: { category: VEHICLE_CATEGORY, mask: collisionMask },
      },
    );

    // Wheels
    const wheelY = terrainY - WHEEL_RADIUS;
    this.wheelRear = scene.matter.add.circle(
      startX - VEHICLE_WIDTH / 3, wheelY, WHEEL_RADIUS,
      {
        label: 'vehicle-wheel',
        friction: 1.5, frictionStatic: 2.0, density: 0.006,
        collisionFilter: { category: VEHICLE_CATEGORY, mask: collisionMask },
      },
    );
    this.wheelFront = scene.matter.add.circle(
      startX + VEHICLE_WIDTH / 3, wheelY, WHEEL_RADIUS,
      {
        label: 'vehicle-wheel',
        friction: 1.5, frictionStatic: 2.0, density: 0.006,
        collisionFilter: { category: VEHICLE_CATEGORY, mask: collisionMask },
      },
    );

    // Axles
    scene.matter.add.constraint(this.chassis, this.wheelRear, 0, 0.5, {
      pointA: { x: -VEHICLE_WIDTH / 3, y: VEHICLE_HEIGHT / 2 },
      damping: 0.01, label: 'axle-rear',
    });
    scene.matter.add.constraint(this.chassis, this.wheelFront, 0, 0.5, {
      pointA: { x: VEHICLE_WIDTH / 3, y: VEHICLE_HEIGHT / 2 },
      damping: 0.01, label: 'axle-front',
    });

    // Boom tip
    const tipX = startX + Math.sin(this.boomAngle) * this.BOOM_LENGTH;
    const tipY = chassisY - VEHICLE_HEIGHT / 2 - Math.cos(this.boomAngle) * this.BOOM_LENGTH;
    this.boomTip = scene.matter.add.circle(tipX, tipY, 3, {
      isStatic: true, label: 'boom-tip',
      collisionFilter: { category: VEHICLE_CATEGORY, mask: 0 },
    });

    /**
     * LEARN: The magnetic ball is much larger and heavier than a hook.
     * It collides with terrain only (like the hook) so it can swing
     * through piece piles. The high density makes it swing slowly
     * and carry momentum — hitting a pile with a swinging magnet ball
     * sends pieces flying, even before the magnet is turned on.
     */
    this.ball = scene.matter.add.circle(tipX, tipY + this.ropeLength, BALL_RADIUS, {
      label: 'vehicle-magnet-ball', density: BALL_DENSITY, frictionAir: 0.01,
      restitution: 0.3, friction: 0.5,
      collisionFilter: { category: VEHICLE_CATEGORY, mask: 0x0001 },
    });

    // Rope — slightly looser than hook crane for more swing
    this.ropeConstraint = scene.matter.add.constraint(
      this.boomTip, this.ball, this.ropeLength, 0.5,
      { damping: 0.015, label: 'vehicle-magnet-rope' },
    );

    // Vehicle label
    this.vehicleLabel = scene.add.text(10, 10, `${this.icon} ${this.displayName}`, {
      fontSize: '14px', fontFamily: 'monospace', color: '#ffffff',
      backgroundColor: '#00000088', padding: { x: 6, y: 3 },
    }).setScrollFactor(0).setDepth(100);

    this.setupInput();
  }

  getPosition(): { x: number; y: number } {
    return { x: this.chassis.position.x, y: this.chassis.position.y };
  }

  addColumnZone(left: number, right: number, deliver: (piece: SpawnedPiece) => boolean): void {
    this.columnZones.push({ left, right, deliver });
  }

  update(): void {
    const touch = this.touchControls.getState();
    this.handleDriving(touch);
    this.handleBoom(touch);
    this.handleRope(touch);
    this.handleAction(touch);
    this.updateBoomTip();
    this.updateMagnetForces();
    this.draw();
  }

  destroy(): void {
    const bodies = [this.chassis, this.wheelFront, this.wheelRear, this.boomTip, this.ball];
    for (const body of bodies) {
      this.scene.matter.world.remove(body);
    }
    this.graphics.destroy();
    if (this.vehicleLabel) this.vehicleLabel.destroy();
  }

  private handleDriving(touch: { driveLeft: boolean; driveRight: boolean }): void {
    const speed = VEHICLE_SPEED * 0.08;
    const left = this.leftKey?.isDown || touch.driveLeft;
    const right = this.rightKey?.isDown || touch.driveRight;

    if (left) {
      this.scene.matter.body.setAngularVelocity(this.wheelRear, -speed);
      this.scene.matter.body.setAngularVelocity(this.wheelFront, -speed);
    } else if (right) {
      this.scene.matter.body.setAngularVelocity(this.wheelRear, speed);
      this.scene.matter.body.setAngularVelocity(this.wheelFront, speed);
    }

    const cx = this.chassis.position.x;
    if (cx < 40 || cx > LANDSCAPE_WIDTH - 40) {
      this.scene.matter.body.setPosition(this.chassis, {
        x: Phaser.Math.Clamp(cx, 40, LANDSCAPE_WIDTH - 40),
        y: this.chassis.position.y,
      });
    }
  }

  private handleBoom(touch: { boomUp: boolean; boomDown: boolean }): void {
    const kbBoomUp = this.upKey?.isDown && !this.shiftKey?.isDown;
    const kbBoomDown = this.downKey?.isDown && !this.shiftKey?.isDown;
    if (kbBoomUp || touch.boomUp) this.boomAngle = Math.max(this.BOOM_MIN_ANGLE, this.boomAngle - this.BOOM_SPEED);
    if (kbBoomDown || touch.boomDown) this.boomAngle = Math.min(this.BOOM_MAX_ANGLE, this.boomAngle + this.BOOM_SPEED);
  }

  private handleRope(touch: { ropeIn: boolean; ropeOut: boolean }): void {
    const kbRopeIn = this.upKey?.isDown && this.shiftKey?.isDown;
    const kbRopeOut = this.downKey?.isDown && this.shiftKey?.isDown;
    if (kbRopeIn || touch.ropeIn) this.ropeLength = Math.max(this.ROPE_MIN, this.ropeLength - this.ROPE_SPEED);
    if (kbRopeOut || touch.ropeOut) this.ropeLength = Math.min(this.ROPE_MAX, this.ropeLength + this.ROPE_SPEED);
    this.ropeConstraint.length = this.ropeLength;
  }

  private handleAction(touch: { grab: boolean }): void {
    const actionPressed = this.spaceJustPressed || touch.grab;
    this.spaceJustPressed = false;
    if (!actionPressed) return;

    this.magnetOn = !this.magnetOn;
    if (!this.magnetOn) {
      this.attractedBodies = [];
    }
  }

  /**
   * LEARN: Each frame, the magnet applies attractive forces to all nearby
   * magnetic pieces. The force is proportional to the piece's mass (so
   * heavy and light pieces accelerate equally) and falls off with distance.
   * This creates a satisfying "pull" effect where pieces drift toward
   * the ball and cluster around it.
   */
  private updateMagnetForces(): void {
    if (!this.magnetOn) return;

    const ballPos = this.ball.position;
    const vehicleBodies = new Set([this.chassis, this.wheelFront, this.wheelRear, this.boomTip, this.ball]);
    this.attractedBodies = [];

    for (const body of this.scene.matter.world.getAllBodies()) {
      if (body.isStatic) continue;
      if (!body.label?.startsWith('piece-')) continue;
      if (vehicleBodies.has(body)) continue;

      const parent = (body as MatterJS.BodyType & { parent?: MatterJS.BodyType }).parent ?? body;
      const pieceData = getPieceData(parent);
      if (pieceData && NON_MAGNETIC.has(pieceData.materialKey)) continue;

      const dx = ballPos.x - body.position.x;
      const dy = ballPos.y - body.position.y;
      const distSq = dx * dx + dy * dy;
      const dist = Math.sqrt(distSq);

      if (dist > MAGNET_RADIUS || dist < 1) continue;

      const forceMag = MAGNET_FORCE * parent.mass / Math.max(dist * 0.02, 0.5);
      const fx = (dx / dist) * forceMag;
      const fy = (dy / dist) * forceMag;

      this.scene.matter.body.applyForce(parent, parent.position, { x: fx, y: fy });
      this.attractedBodies.push(parent);
    }
  }

  private updateBoomTip(): void {
    const cx = this.chassis.position.x;
    const cy = this.chassis.position.y;
    const baseY = cy - VEHICLE_HEIGHT / 2;
    const totalAngle = this.boomAngle + this.chassis.angle;
    const tipX = cx + Math.sin(totalAngle) * this.BOOM_LENGTH;
    const tipY = baseY - Math.cos(totalAngle) * this.BOOM_LENGTH;

    this.scene.matter.body.setPosition(this.boomTip, { x: tipX, y: tipY });
    this.scene.matter.body.setVelocity(this.boomTip, { x: 0, y: 0 });
  }

  private setupInput(): void {
    if (!this.scene.input.keyboard) return;
    this.leftKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
    this.rightKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);
    this.upKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
    this.downKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
    this.shiftKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
    const spaceKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    spaceKey.on('down', () => { this.spaceJustPressed = true; });
  }

  private draw(): void {
    this.graphics.clear();
    const cx = this.chassis.position.x;
    const cy = this.chassis.position.y;
    const angle = this.chassis.angle;

    // Chassis — similar to hook crane but with blue/gray tint
    this.graphics.save();
    this.graphics.translateCanvas(cx, cy);
    this.graphics.rotateCanvas(angle);
    this.graphics.fillStyle(0x556688);
    this.graphics.fillRect(-VEHICLE_WIDTH / 2, -VEHICLE_HEIGHT / 2, VEHICLE_WIDTH, VEHICLE_HEIGHT);
    this.graphics.fillStyle(0x445577);
    this.graphics.fillRect(-VEHICLE_WIDTH / 4, -VEHICLE_HEIGHT / 2 - 6, VEHICLE_WIDTH / 2, 8);
    this.graphics.restore();

    // Wheels
    this.graphics.fillStyle(0x333333);
    this.graphics.fillCircle(this.wheelRear.position.x, this.wheelRear.position.y, WHEEL_RADIUS);
    this.graphics.fillCircle(this.wheelFront.position.x, this.wheelFront.position.y, WHEEL_RADIUS);
    this.graphics.fillStyle(0x555555);
    this.graphics.fillCircle(this.wheelRear.position.x, this.wheelRear.position.y, 3);
    this.graphics.fillCircle(this.wheelFront.position.x, this.wheelFront.position.y, 3);

    // Boom — longer, thicker, industrial blue-gray
    const baseX = cx;
    const baseY = cy - VEHICLE_HEIGHT / 2;
    const totalAngle = this.boomAngle + angle;
    const tipX = baseX + Math.sin(totalAngle) * this.BOOM_LENGTH;
    const tipY = baseY - Math.cos(totalAngle) * this.BOOM_LENGTH;

    this.graphics.lineStyle(5, 0x667788, 0.9);
    this.graphics.lineBetween(baseX, baseY, tipX, tipY);
    this.graphics.fillStyle(0x778899);
    this.graphics.fillCircle(tipX, tipY, 5);

    // Rope — thicker cable for the heavy ball
    this.graphics.lineStyle(2.5, 0x999999, 0.7);
    this.graphics.lineBetween(tipX, tipY, this.ball.position.x, this.ball.position.y);

    // Magnetic ball
    const ballX = this.ball.position.x;
    const ballY = this.ball.position.y;
    const time = this.scene.time.now;

    /**
     * LEARN: The magnet ball is drawn as a large dark circle with
     * red/blue pole markings (like a real electromagnet). When active,
     * it pulses with a glow and shows attraction lines to nearby pieces.
     * The pulsing uses sin(time) for smooth oscillation.
     */
    const pulse = this.magnetOn ? 0.8 + 0.2 * Math.sin(time * 0.006) : 1.0;

    // Ball shadow/glow when active
    if (this.magnetOn) {
      this.graphics.fillStyle(0xff4444, 0.15 * pulse);
      this.graphics.fillCircle(ballX, ballY, BALL_RADIUS + 8);
      this.graphics.fillStyle(0x4444ff, 0.1 * pulse);
      this.graphics.fillCircle(ballX, ballY, BALL_RADIUS + 16);
    }

    // Main ball body — dark metallic
    this.graphics.fillStyle(0x444455, pulse);
    this.graphics.fillCircle(ballX, ballY, BALL_RADIUS);

    // Metallic highlight
    this.graphics.fillStyle(0x666677, pulse * 0.6);
    this.graphics.fillCircle(ballX - 3, ballY - 3, BALL_RADIUS * 0.5);

    // Red/blue pole bands (horizontal stripe across the ball)
    this.graphics.lineStyle(3, 0xcc3333, pulse * 0.8);
    this.graphics.lineBetween(ballX - BALL_RADIUS + 2, ballY, ballX, ballY);
    this.graphics.lineStyle(3, 0x3333cc, pulse * 0.8);
    this.graphics.lineBetween(ballX, ballY, ballX + BALL_RADIUS - 2, ballY);

    // Ball edge ring
    this.graphics.lineStyle(1.5, this.magnetOn ? 0xaaaacc : 0x555566, pulse);
    this.graphics.strokeCircle(ballX, ballY, BALL_RADIUS);

    // Magnet field visualization — attraction lines
    if (this.magnetOn) {
      this.graphics.lineStyle(1, 0xff4444, 0.15);
      this.graphics.strokeCircle(ballX, ballY, MAGNET_RADIUS);

      for (const attracted of this.attractedBodies) {
        this.graphics.lineStyle(1, 0xff4444, 0.3);
        this.graphics.lineBetween(ballX, ballY, attracted.position.x, attracted.position.y);
      }

      // Electric field dots
      const dotCount = 6;
      for (let i = 0; i < dotCount; i++) {
        const a = (time * 0.003) + (i * Math.PI * 2 / dotCount);
        const r = BALL_RADIUS + 6 + 4 * Math.sin(time * 0.005 + i);
        const dx = Math.cos(a) * r;
        const dy = Math.sin(a) * r;
        this.graphics.fillStyle(0xff6666, 0.4 + 0.2 * Math.sin(time * 0.01 + i));
        this.graphics.fillCircle(ballX + dx, ballY + dy, 1.5);
      }
    }

    // Cable attachment point on ball (small ring at top)
    this.graphics.fillStyle(0x888899, 1);
    this.graphics.fillCircle(ballX, ballY - BALL_RADIUS + 2, 3);
  }
}
