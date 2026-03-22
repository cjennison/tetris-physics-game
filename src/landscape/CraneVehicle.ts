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
import { type SpawnedPiece } from '../pieces/PieceFactory';
import { PieceRenderer } from '../systems/PieceRenderer';
import {
  VEHICLE_WIDTH,
  VEHICLE_HEIGHT,
  VEHICLE_SPEED,
  LANDSCAPE_WIDTH,
} from '../config';
import { Terrain } from './Terrain';
import { TouchControls } from '../ui/TouchControls';
import { type CraneTool } from './tools/CraneTool';
import { HookTool } from './tools/HookTool';
import { MagnetTool } from './tools/MagnetTool';
import { ShovelTool } from './tools/ShovelTool';

const VEHICLE_CATEGORY = 0x0010;
const WHEEL_RADIUS = 13;

export class CraneVehicle {
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

  /**
   * LEARN: Tool system — the vehicle can equip different attachments.
   * Each tool implements CraneTool interface with its own grab/release
   * behavior. Tools are cycled with TAB (keyboard) or TOOL button (touch).
   */
  private tools: CraneTool[];
  private activeToolIndex = 0;
  private toolLabel: Phaser.GameObjects.Text | null = null;

  /** Input */
  private leftKey: Phaser.Input.Keyboard.Key | null = null;
  private rightKey: Phaser.Input.Keyboard.Key | null = null;
  private upKey: Phaser.Input.Keyboard.Key | null = null;
  private downKey: Phaser.Input.Keyboard.Key | null = null;
  private shiftKey: Phaser.Input.Keyboard.Key | null = null;
  private spaceJustPressed = false;
  private tabJustPressed = false;
  private touchControls: TouchControls;

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
        friction: 0.8,
        frictionStatic: 1.0,
        frictionAir: 0.03,
        density: 0.01,
        collisionFilter: { category: VEHICLE_CATEGORY, mask: collisionMask },
      },
    );

    // Wheels — circles that roll over terrain
    const wheelY = terrainY - WHEEL_RADIUS;
    this.wheelRear = scene.matter.add.circle(
      startX - VEHICLE_WIDTH / 3, wheelY, WHEEL_RADIUS,
      {
        label: 'vehicle-wheel',
        friction: 1.5,
        frictionStatic: 2.0,
        density: 0.006,
        collisionFilter: { category: VEHICLE_CATEGORY, mask: collisionMask },
      },
    );
    this.wheelFront = scene.matter.add.circle(
      startX + VEHICLE_WIDTH / 3, wheelY, WHEEL_RADIUS,
      {
        label: 'vehicle-wheel',
        friction: 1.5,
        frictionStatic: 2.0,
        density: 0.006,
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

    // Initialize tool system
    this.tools = [new HookTool(), new MagnetTool(), new ShovelTool()];

    // Tool label HUD — fixed position on screen
    this.toolLabel = scene.add.text(10, 10, '', {
      fontSize: '14px',
      fontFamily: 'monospace',
      color: '#ffffff',
      backgroundColor: '#00000088',
      padding: { x: 6, y: 3 },
    }).setScrollFactor(0).setDepth(100);
    this.updateToolLabel();

    this.touchControls = new TouchControls();
    this.setupInput();
  }

  /** Get the currently equipped tool */
  getActiveTool(): CraneTool {
    return this.tools[this.activeToolIndex];
  }

  /** Cycle to the next tool */
  private switchTool(): void {
    // Clean up current tool before switching
    this.getActiveTool().cleanup(this.scene);
    this.activeToolIndex = (this.activeToolIndex + 1) % this.tools.length;
    this.updateToolLabel();
  }

  private updateToolLabel(): void {
    const tool = this.getActiveTool();
    if (this.toolLabel) {
      this.toolLabel.setText(`${tool.icon} ${tool.name}`);
    }
  }

  /** Get the vehicle chassis position for camera following */
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
    this.handleToolSwitch(touch);
    this.handleAction(touch);
    this.updateBoomTip();

    // Let the active tool do per-frame work (e.g., magnet forces)
    const vehicleBodies = new Set([this.chassis, this.wheelFront, this.wheelRear, this.boomTip, this.hook]);
    this.getActiveTool().update(
      this.scene, this.hook,
      this.scene.matter.world.getAllBodies(),
      vehicleBodies,
    );

    this.draw();
  }

  private handleToolSwitch(touch: { switchTool: boolean }): void {
    if (touch.switchTool || this.tabJustPressed) {
      this.tabJustPressed = false;
      this.switchTool();
    }
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

    // Clamp to landscape
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
    const tool = this.getActiveTool();

    // For the hook tool, check if we're releasing over a column zone
    const carriedBefore = tool.getCarriedPiece();
    tool.activate(
      this.scene, this.hook,
      this.scene.matter.world.getAllBodies(),
      vehicleBodies,
    );

    // If we had a piece and now we don't, it was released — check column delivery
    if (carriedBefore && !tool.getCarriedPiece()) {
      const vx = this.chassis.position.x;
      const zone = this.columnZones.find(z => vx >= z.left && vx <= z.right);
      if (zone) zone.deliver(carriedBefore);
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
    const tabKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TAB);
    tabKey.on('down', () => { this.tabJustPressed = true; });
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

    /**
     * LEARN: Each tool draws its own visual at the hook point.
     * This delegates rendering to the tool class — the vehicle doesn't
     * need to know what a magnet or hook looks like. Adding a new tool
     * (shovel, claw) just means implementing drawTool() in the new class.
     */
    const tool = this.getActiveTool();
    const hookX = this.hook.position.x;
    const hookY = this.hook.position.y;
    tool.drawTool(this.graphics, hookX, hookY, tool.isActive(), this.scene.time.now);

    // Carry line (for hook tool — connects hook to grabbed piece)
    const carriedBody = tool.getCarriedBody();
    if (carriedBody) {
      this.graphics.lineStyle(1.5, 0x44aa44, 0.4);
      this.graphics.lineBetween(hookX, hookY, carriedBody.position.x, carriedBody.position.y);
    }

    // Magnet field visualization — attraction radius and force lines
    if (tool instanceof MagnetTool && tool.isActive()) {
      this.graphics.lineStyle(1, 0xff4444, 0.15);
      this.graphics.strokeCircle(hookX, hookY, 180);
      for (const attracted of tool.getAttractedBodies()) {
        this.graphics.lineStyle(1, 0xff4444, 0.3);
        this.graphics.lineBetween(hookX, hookY, attracted.position.x, attracted.position.y);
      }
    }
  }
}
