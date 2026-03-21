/**
 * CraneVehicle — Mobile crane with real wheels and rotating boom
 *
 * LEARN: The vehicle has real physics wheels — circle bodies connected
 * to the chassis with constraints. Circles roll smoothly over bumpy
 * terrain (rectangles get stuck on edges). The wheels are driven by
 * applying angular velocity (like spinning a motor).
 *
 * Controls:
 *   ← →        : Drive (spin wheels)
 *   ↑ ↓        : Rotate boom arm
 *   SHIFT+↑/↓  : Reel rope in/out
 *   SPACE       : Grab / release
 */
import Phaser from 'phaser';
import { CollisionCategory } from '../types';
import { type SpawnedPiece, getPieceData } from '../pieces/PieceFactory';
import { PieceRenderer } from '../systems/PieceRenderer';
import {
  VEHICLE_WIDTH,
  VEHICLE_HEIGHT,
  VEHICLE_SPEED,
  LANDSCAPE_WIDTH,
} from '../config';
import { Terrain } from './Terrain';

const VEHICLE_CATEGORY = 0x0010;
const WHEEL_RADIUS = 10;

export class CraneVehicle {
  private scene: Phaser.Scene;
  private graphics: Phaser.GameObjects.Graphics;

  /** Vehicle parts */
  private chassis: MatterJS.BodyType;
  private wheelFront: MatterJS.BodyType;
  private wheelRear: MatterJS.BodyType;

  /** Boom arm */
  private boomAngle = -0.3;
  private readonly BOOM_LENGTH = 80;
  private readonly BOOM_MIN_ANGLE = -1.3;
  private readonly BOOM_MAX_ANGLE = 1.3;
  private readonly BOOM_SPEED = 0.025;

  /** Rope */
  private hook: MatterJS.BodyType;
  private ropeConstraint: MatterJS.ConstraintType;
  private boomTip: MatterJS.BodyType;
  private ropeLength = 60;
  private readonly ROPE_MIN = 10;
  private readonly ROPE_MAX = 140;
  private readonly ROPE_SPEED = 2;

  /** Carried piece */
  private carriedPiece: SpawnedPiece | null = null;
  private carriedBody: MatterJS.BodyType | null = null;
  private carryConstraint: MatterJS.ConstraintType | null = null;

  /** Input */
  private leftKey: Phaser.Input.Keyboard.Key | null = null;
  private rightKey: Phaser.Input.Keyboard.Key | null = null;
  private upKey: Phaser.Input.Keyboard.Key | null = null;
  private downKey: Phaser.Input.Keyboard.Key | null = null;
  private shiftKey: Phaser.Input.Keyboard.Key | null = null;
  private spaceJustPressed = false;

  /** Column zones */
  private columnZones: Array<{
    left: number; right: number;
    deliver: (piece: SpawnedPiece) => boolean;
  }> = [];

  constructor(scene: Phaser.Scene, _renderer: PieceRenderer, startX: number) {
    this.scene = scene;
    this.graphics = scene.add.graphics();
    this.graphics.setDepth(12);

    const terrainY = Terrain.getHeightAt(startX);
    const chassisY = terrainY - WHEEL_RADIUS - VEHICLE_HEIGHT / 2 - 2;
    // Vehicle collides with: terrain (0x0001), pieces (0x0002), and bridge (0x0020)
    const collisionMask = 0x0001 | CollisionCategory.PIECE | 0x0020;

    // Chassis — raised above wheels
    this.chassis = scene.matter.add.rectangle(
      startX, chassisY, VEHICLE_WIDTH, VEHICLE_HEIGHT,
      {
        label: 'vehicle-chassis',
        friction: 0.3,
        density: 0.008,
        collisionFilter: { category: VEHICLE_CATEGORY, mask: collisionMask },
      },
    );

    // Wheels — circles that roll over terrain
    const wheelY = terrainY - WHEEL_RADIUS;
    this.wheelRear = scene.matter.add.circle(
      startX - VEHICLE_WIDTH / 3, wheelY, WHEEL_RADIUS,
      {
        label: 'vehicle-wheel',
        friction: 0.95,
        frictionStatic: 1.0,
        density: 0.005,
        collisionFilter: { category: VEHICLE_CATEGORY, mask: collisionMask },
      },
    );
    this.wheelFront = scene.matter.add.circle(
      startX + VEHICLE_WIDTH / 3, wheelY, WHEEL_RADIUS,
      {
        label: 'vehicle-wheel',
        friction: 0.95,
        frictionStatic: 1.0,
        density: 0.005,
        collisionFilter: { category: VEHICLE_CATEGORY, mask: collisionMask },
      },
    );

    // Connect wheels to chassis with constraints (axles)
    scene.matter.add.constraint(this.chassis, this.wheelRear, 0, 0.5, {
      pointA: { x: -VEHICLE_WIDTH / 3, y: VEHICLE_HEIGHT / 2 },
      damping: 0.01,
      label: 'axle-rear',
    });
    scene.matter.add.constraint(this.chassis, this.wheelFront, 0, 0.5, {
      pointA: { x: VEHICLE_WIDTH / 3, y: VEHICLE_HEIGHT / 2 },
      damping: 0.01,
      label: 'axle-front',
    });

    // Boom tip (invisible, repositioned each frame)
    const tipX = startX + Math.sin(this.boomAngle) * this.BOOM_LENGTH;
    const tipY = chassisY - VEHICLE_HEIGHT / 2 - Math.cos(this.boomAngle) * this.BOOM_LENGTH;
    this.boomTip = scene.matter.add.circle(tipX, tipY, 3, {
      isStatic: true, label: 'boom-tip',
      collisionFilter: { category: VEHICLE_CATEGORY, mask: 0 },
    });

    // Hook — collides with terrain/ground only, NOT pieces.
    // Passes through the pile so you can lower it onto a piece and grab.
    this.hook = scene.matter.add.circle(tipX, tipY + this.ropeLength, 6, {
      label: 'vehicle-hook', density: 0.003, frictionAir: 0.02,
      restitution: 0.1,
      friction: 0.5,
      collisionFilter: {
        category: VEHICLE_CATEGORY,
        mask: 0x0001, // Terrain only — passes through pieces
      },
    });

    // Rope
    this.ropeConstraint = scene.matter.add.constraint(
      this.boomTip, this.hook, this.ropeLength, 0.7,
      { damping: 0.02, label: 'vehicle-rope' },
    );

    this.setupInput();
  }

  addColumnZone(left: number, right: number, deliver: (piece: SpawnedPiece) => boolean): void {
    this.columnZones.push({ left, right, deliver });
  }

  update(): void {
    this.handleDriving();
    this.handleBoom();
    this.handleRope();
    this.handleAction();
    this.updateBoomTip();
    this.draw();
  }

  private handleDriving(): void {
    if (!this.leftKey || !this.rightKey) return;

    /**
     * LEARN: Instead of applying force to the chassis, we spin the wheels
     * by setting their angular velocity. This is like a motor — the wheels
     * push against the terrain via friction and the vehicle moves. This
     * works much better on slopes than chassis-force because the wheels
     * grip the terrain surface regardless of angle.
     */
    const speed = VEHICLE_SPEED * 0.08;
    if (this.leftKey.isDown) {
      this.scene.matter.body.setAngularVelocity(this.wheelRear, -speed);
      this.scene.matter.body.setAngularVelocity(this.wheelFront, -speed);
    } else if (this.rightKey.isDown) {
      this.scene.matter.body.setAngularVelocity(this.wheelRear, speed);
      this.scene.matter.body.setAngularVelocity(this.wheelFront, speed);
    }

    // Clamp to landscape
    const cx = this.chassis.position.x;
    if (cx < 40 || cx > LANDSCAPE_WIDTH - 40) {
      this.scene.matter.body.setPosition(this.chassis, {
        x: Phaser.Math.Clamp(cx, 40, LANDSCAPE_WIDTH - 40),
        y: this.chassis.position.y,
      });
    }
  }

  private handleBoom(): void {
    if (!this.upKey || !this.downKey || !this.shiftKey) return;
    if (this.shiftKey.isDown) return;
    if (this.upKey.isDown) this.boomAngle = Math.max(this.BOOM_MIN_ANGLE, this.boomAngle - this.BOOM_SPEED);
    if (this.downKey.isDown) this.boomAngle = Math.min(this.BOOM_MAX_ANGLE, this.boomAngle + this.BOOM_SPEED);
  }

  private handleRope(): void {
    if (!this.upKey || !this.downKey || !this.shiftKey) return;
    if (!this.shiftKey.isDown) return;
    if (this.upKey.isDown) this.ropeLength = Math.max(this.ROPE_MIN, this.ropeLength - this.ROPE_SPEED);
    if (this.downKey.isDown) this.ropeLength = Math.min(this.ROPE_MAX, this.ropeLength + this.ROPE_SPEED);
    this.ropeConstraint.length = this.ropeLength;
  }

  private handleAction(): void {
    if (!this.spaceJustPressed) return;
    this.spaceJustPressed = false;

    if (!this.carriedPiece) {
      const hookPos = this.hook.position;
      let closest: MatterJS.BodyType | null = null;
      let closestDist = 45;

      for (const body of this.scene.matter.world.getAllBodies()) {
        if (body.isStatic) continue;
        if (!body.label?.startsWith('piece-')) continue;
        if (body === this.hook || body === this.chassis ||
            body === this.wheelFront || body === this.wheelRear || body === this.boomTip) continue;
        const dx = body.position.x - hookPos.x;
        const dy = body.position.y - hookPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < closestDist) { closestDist = dist; closest = body; }
      }

      if (closest) {
        const parent = (closest as MatterJS.BodyType & { parent?: MatterJS.BodyType }).parent ?? closest;
        const data = getPieceData(parent);
        if (data) {
          this.carriedBody = parent;
          this.carriedPiece = {
            body: parent,
            definition: { name: data.name, vertices: data.originalVertices, color: data.color },
            materialKey: data.materialKey,
            material: data.material,
          };
          this.carryConstraint = this.scene.matter.add.constraint(
            this.hook, parent, 8, 0.8,
            { damping: 0.05, label: 'vehicle-carry' },
          );
        }
      }
    } else {
      if (this.carryConstraint) {
        this.scene.matter.world.removeConstraint(this.carryConstraint);
        this.carryConstraint = null;
      }
      const vx = this.chassis.position.x;
      const zone = this.columnZones.find(z => vx >= z.left && vx <= z.right);
      if (zone && this.carriedPiece) zone.deliver(this.carriedPiece);
      this.carriedPiece = null;
      this.carriedBody = null;
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

    // Chassis
    this.graphics.save();
    this.graphics.translateCanvas(cx, cy);
    this.graphics.rotateCanvas(angle);
    this.graphics.fillStyle(0xaa8833);
    this.graphics.fillRect(-VEHICLE_WIDTH / 2, -VEHICLE_HEIGHT / 2, VEHICLE_WIDTH, VEHICLE_HEIGHT);
    this.graphics.fillStyle(0x887733);
    this.graphics.fillRect(-VEHICLE_WIDTH / 4, -VEHICLE_HEIGHT / 2 - 6, VEHICLE_WIDTH / 2, 8);
    this.graphics.restore();

    // Wheels
    this.graphics.fillStyle(0x333333);
    this.graphics.fillCircle(this.wheelRear.position.x, this.wheelRear.position.y, WHEEL_RADIUS);
    this.graphics.fillCircle(this.wheelFront.position.x, this.wheelFront.position.y, WHEEL_RADIUS);
    // Wheel hubs
    this.graphics.fillStyle(0x555555);
    this.graphics.fillCircle(this.wheelRear.position.x, this.wheelRear.position.y, 3);
    this.graphics.fillCircle(this.wheelFront.position.x, this.wheelFront.position.y, 3);

    // Boom
    const baseX = cx;
    const baseY = cy - VEHICLE_HEIGHT / 2;
    const totalAngle = this.boomAngle + angle;
    const tipX = baseX + Math.sin(totalAngle) * this.BOOM_LENGTH;
    const tipY = baseY - Math.cos(totalAngle) * this.BOOM_LENGTH;

    this.graphics.lineStyle(4, 0xbb9944, 0.9);
    this.graphics.lineBetween(baseX, baseY, tipX, tipY);
    this.graphics.fillStyle(0xddbb55);
    this.graphics.fillCircle(tipX, tipY, 4);

    // Rope
    this.graphics.lineStyle(1.5, 0xcccccc, 0.6);
    this.graphics.lineBetween(tipX, tipY, this.hook.position.x, this.hook.position.y);

    // Hook
    this.graphics.fillStyle(this.carriedPiece ? 0x44aa44 : 0xcccccc);
    this.graphics.fillCircle(this.hook.position.x, this.hook.position.y, 4);

    // Carry line
    if (this.carriedBody) {
      this.graphics.lineStyle(1.5, 0x44aa44, 0.4);
      this.graphics.lineBetween(
        this.hook.position.x, this.hook.position.y,
        this.carriedBody.position.x, this.carriedBody.position.y,
      );
    }
  }
}
