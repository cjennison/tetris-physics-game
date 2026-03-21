/**
 * TouchControls — On-screen virtual buttons for mobile crane operation
 *
 * LEARN: Mobile games need virtual controls since there's no keyboard.
 * We create DOM buttons overlaid on the game canvas. DOM buttons are
 * easier to style and more reliable for touch than Phaser game objects
 * (no issues with camera zoom/scroll affecting touch coordinates).
 *
 * Layout:
 *   Left side: Drive buttons (← →)
 *   Right side: Boom buttons (↑ ↓) and Rope buttons (reel ↑↓)
 *   Center bottom: GRAB/DROP button
 */

export interface TouchState {
  driveLeft: boolean;
  driveRight: boolean;
  boomUp: boolean;
  boomDown: boolean;
  ropeIn: boolean;
  ropeOut: boolean;
  grab: boolean; // one-shot
}

export class TouchControls {
  private container: HTMLDivElement;
  private state: TouchState = {
    driveLeft: false, driveRight: false,
    boomUp: false, boomDown: false,
    ropeIn: false, ropeOut: false,
    grab: false,
  };

  /** Only show on touch devices */
  private isTouchDevice: boolean;

  constructor() {
    this.isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    this.container = this.createDOM();
    document.body.appendChild(this.container);

    if (!this.isTouchDevice) {
      this.container.style.display = 'none';
    }
  }

  /** Read and reset one-shot inputs */
  getState(): TouchState {
    const s = { ...this.state };
    this.state.grab = false; // Reset one-shot
    return s;
  }

  private createDOM(): HTMLDivElement {
    const container = document.createElement('div');
    container.id = 'touch-controls';
    container.style.cssText = `
      position: fixed; bottom: 0; left: 0; right: 0;
      height: 140px; z-index: 9998;
      display: flex; justify-content: space-between; align-items: flex-end;
      padding: 8px 12px; pointer-events: none;
      user-select: none; -webkit-user-select: none;
    `;

    // Left side — drive buttons
    const leftGroup = this.createGroup();
    leftGroup.appendChild(this.createButton('◀', 'driveLeft', 60, 55));
    leftGroup.appendChild(this.createButton('▶', 'driveRight', 60, 55));
    container.appendChild(leftGroup);

    // Center — grab/drop
    const centerGroup = this.createGroup();
    centerGroup.style.alignItems = 'center';
    const grabBtn = this.createButton('GRAB', 'grab', 80, 50, true);
    grabBtn.style.background = '#446644';
    centerGroup.appendChild(grabBtn);
    container.appendChild(centerGroup);

    // Right side — boom and rope
    const rightGroup = this.createGroup();
    rightGroup.style.flexDirection = 'column';
    rightGroup.style.gap = '4px';

    const boomRow = this.createGroup();
    boomRow.appendChild(this.createLabel('BOOM'));
    boomRow.appendChild(this.createButton('▲', 'boomUp', 50, 45));
    boomRow.appendChild(this.createButton('▼', 'boomDown', 50, 45));
    rightGroup.appendChild(boomRow);

    const ropeRow = this.createGroup();
    ropeRow.appendChild(this.createLabel('ROPE'));
    ropeRow.appendChild(this.createButton('▲', 'ropeIn', 50, 45));
    ropeRow.appendChild(this.createButton('▼', 'ropeOut', 50, 45));
    rightGroup.appendChild(ropeRow);

    container.appendChild(rightGroup);

    return container;
  }

  private createGroup(): HTMLDivElement {
    const div = document.createElement('div');
    div.style.cssText = 'display: flex; gap: 6px; pointer-events: auto;';
    return div;
  }

  private createLabel(text: string): HTMLSpanElement {
    const span = document.createElement('span');
    span.textContent = text;
    span.style.cssText = `
      color: #888; font-family: monospace; font-size: 10px;
      display: flex; align-items: center; width: 35px;
    `;
    return span;
  }

  private createButton(
    label: string,
    stateKey: keyof TouchState,
    width: number,
    height: number,
    oneShot = false,
  ): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.style.cssText = `
      width: ${width}px; height: ${height}px;
      background: rgba(80, 80, 100, 0.7);
      color: #ddd; border: 1px solid rgba(120, 120, 140, 0.5);
      border-radius: 8px; font-family: monospace; font-size: 16px;
      pointer-events: auto; touch-action: none;
      -webkit-user-select: none; user-select: none;
    `;

    if (oneShot) {
      btn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.state[stateKey] = true;
        btn.style.background = 'rgba(100, 150, 100, 0.8)';
        setTimeout(() => { btn.style.background = '#446644'; }, 150);
      });
      btn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        this.state[stateKey] = true;
      });
    } else {
      // Held buttons — active while touching
      const activate = (e: Event) => {
        e.preventDefault();
        (this.state as unknown as Record<string, boolean>)[stateKey] = true;
        btn.style.background = 'rgba(100, 100, 140, 0.9)';
      };
      const deactivate = () => {
        (this.state as unknown as Record<string, boolean>)[stateKey] = false;
        btn.style.background = 'rgba(80, 80, 100, 0.7)';
      };

      btn.addEventListener('touchstart', activate);
      btn.addEventListener('touchend', deactivate);
      btn.addEventListener('touchcancel', deactivate);
      btn.addEventListener('mousedown', activate);
      btn.addEventListener('mouseup', deactivate);
      btn.addEventListener('mouseleave', deactivate);
    }

    return btn;
  }

  destroy(): void {
    this.container.remove();
  }
}
