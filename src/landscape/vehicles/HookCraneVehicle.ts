/**
 * HookCraneVehicle — Mobile crane with boom arm, rope, and hook
 *
 * LEARN: This is the original crane vehicle, now isolated as one of three
 * vehicle types. It has a chassis on wheels, a rotating boom arm, a rope
 * dangling from the boom tip, and a hook that grabs one piece at a time.
 *
 * Controls:
 *   ← →        : Drive (spin wheels)
 *   ↑ ↓        : Rotate boom arm
 *   SHIFT+↑/↓  : Reel rope in/out
 *   SPACE       : Grab / release piece
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
const GRAB_RADIUS = 45;

export class HookCraneVehicle implements Vehicle {
  readonly type = 'hook-crane';
  readonly displayName = 'Hook Crane';
  readonly icon = '🪝';

  private scene: Phaser.Scene;
  private graphics: Phaser.GameObjects.Graphics;

  /** Vehicle parts */
  private chassis: MatterJS.BodyType;
  private wheelFront: MatterJS.BodyType;
  private wheelRear: MatterJS.BodyType;

  /** Boom arm */
  private boomAngle = -0.3;
  private readonly BOOM_LENGTH = 100;
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

  /** Hook grab state */
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

    // Chassis
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

    // Axle constraints
    scene.matter.add.constraint(this.chassis, this.wheelRear, 0, 0.5, {
      pointA: { x: -VEHICLE_WIDTH / 3, y: VEHICLE_HEIGHT / 2 },
      damping: 0.01, label: 'axle-rear',
    });
    scene.matter.add.constraint(this.chassis, this.wheelFront, 0, 0.5, {
      pointA: { x: VEHICLE_WIDTH / 3, y: VEHICLE_HEIGHT / 2 },
      damping: 0.01, label: 'axle-front',
    });

    // Boom tip (invisible anchor)
    const tipX = startX + Math.sin(this.boomAngle) * this.BOOM_LENGTH;
    const tipY = chassisY - VEHICLE_HEIGHT / 2 - Math.cos(this.boomAngle) * this.BOOM_LENGTH;
    this.boomTip = scene.matter.add.circle(tipX, tipY, 3, {
      isStatic: true, label: 'boom-tip',
      collisionFilter: { category: VEHICLE_CATEGORY, mask: 0 },
    });

    // Hook — collides with terrain only, passes through pieces
    this.hook = scene.matter.add.circle(tipX, tipY + this.ropeLength, 6, {
      label: 'vehicle-hook', density: 0.003, frictionAir: 0.02,
      restitution: 0.1, friction: 0.5,
      collisionFilter: { category: VEHICLE_CATEGORY, mask: 0x0001 },
    });

    // Rope constraint
    this.ropeConstraint = scene.matter.add.constraint(
      this.boomTip, this.hook, this.ropeLength, 0.7,
      { damping: 0.02, label: 'vehicle-rope' },
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
    this.draw();
  }

  destroy(): void {
    // Release any carried piece
    this.releaseCarried();

    // Remove physics bodies
    const bodies = [this.chassis, this.wheelFront, this.wheelRear, this.boomTip, this.hook];
    for (const body of bodies) {
      this.scene.matter.world.remove(body);
    }

    // Remove graphics and HUD
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

    const vehicleBodies = new Set([this.chassis, this.wheelFront, this.wheelRear, this.boomTip, this.hook]);

    if (!this.carriedPiece) {
      // Try to grab nearest piece
      const hookPos = this.hook.position;
      let closest: MatterJS.BodyType | null = null;
      let closestDist = GRAB_RADIUS;

      for (const body of this.scene.matter.world.getAllBodies()) {
        if (body.isStatic) continue;
        if (!body.label?.startsWith('piece-')) continue;
        if (vehicleBodies.has(body)) continue;
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
            { damping: 0.05, label: 'hook-carry' },
          );
        }
      }
    } else {
      // Release — check column delivery
      const vx = this.chassis.position.x;
      const zone = this.columnZones.find(z => vx >= z.left && vx <= z.right);
      if (zone && this.carriedPiece) zone.deliver(this.carriedPiece);
      this.releaseCarried();
    }
  }

  private releaseCarried(): void {
    if (this.carryConstraint) {
      this.scene.matter.world.removeConstraint(this.carryConstraint);
      this.carryConstraint = null;
    }
    this.carriedPiece = null;
    this.carriedBody = null;
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
    const hookX = this.hook.position.x;
    const hookY = this.hook.position.y;
    const hookActive = this.carriedPiece !== null;
    const hookColor = hookActive ? 0x44aa44 : 0xcccccc;

    this.graphics.lineStyle(3, hookColor, 0.9);
    this.graphics.lineBetween(hookX, hookY - 4, hookX, hookY + 4);
    this.graphics.lineStyle(2.5, hookColor, 0.9);
    this.graphics.beginPath();
    this.graphics.arc(hookX - 3, hookY + 4, 6, 0, Math.PI, false);
    this.graphics.strokePath();
    this.graphics.fillStyle(hookColor, 1);
    this.graphics.fillTriangle(hookX - 9, hookY + 4, hookX - 10, hookY - 1, hookX - 7, hookY + 2);
    this.graphics.lineStyle(1.5, 0x999999, 0.6);
    this.graphics.lineBetween(hookX - 1, hookY + 1, hookX + 2, hookY + 6);

    // Carry line
    if (this.carriedBody) {
      this.graphics.lineStyle(1.5, 0x44aa44, 0.4);
      this.graphics.lineBetween(hookX, hookY, this.carriedBody.position.x, this.carriedBody.position.y);
    }
  }
}
