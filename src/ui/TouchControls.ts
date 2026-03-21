/**
 * TouchControls — Landscape-optimized virtual controls
 *
 * Layout for landscape phone (held sideways):
 *
 *   LEFT SIDE (D-pad):          RIGHT SIDE:
 *        [BOOM ▲]               [ROPE ▲]
 *   [◀]          [▶]           [GRAB/DROP]
 *        [BOOM ▼]               [ROPE ▼]
 *
 * Left D-pad: drive left/right + boom up/down
 * Right side: rope in/out + grab/drop button
 */

export interface TouchState {
  driveLeft: boolean;
  driveRight: boolean;
  boomUp: boolean;
  boomDown: boolean;
  ropeIn: boolean;
  ropeOut: boolean;
  grab: boolean;
}

export class TouchControls {
  private container: HTMLDivElement;
  private state: TouchState = {
    driveLeft: false, driveRight: false,
    boomUp: false, boomDown: false,
    ropeIn: false, ropeOut: false,
    grab: false,
  };

  private isTouchDevice: boolean;

  constructor() {
    this.isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    this.container = this.createDOM();
    document.body.appendChild(this.container);

    if (!this.isTouchDevice) {
      this.container.style.display = 'none';
    }
  }

  getState(): TouchState {
    const s = { ...this.state };
    this.state.grab = false;
    return s;
  }

  private createDOM(): HTMLDivElement {
    const container = document.createElement('div');
    container.id = 'touch-controls';
    container.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      z-index: 9998; pointer-events: none;
      user-select: none; -webkit-user-select: none;
    `;

    // Left D-pad — drive + boom
    const leftPad = document.createElement('div');
    leftPad.style.cssText = `
      position: absolute; bottom: 20px; left: 15px;
      display: grid; grid-template-columns: 55px 55px 55px;
      grid-template-rows: 55px 55px 55px; gap: 4px;
      pointer-events: auto;
    `;

    // Row 1: empty, boom up, empty
    leftPad.appendChild(this.createEmpty());
    leftPad.appendChild(this.createBtn('▲', 'boomUp', '#4455aa'));
    leftPad.appendChild(this.createEmpty());

    // Row 2: drive left, center label, drive right
    leftPad.appendChild(this.createBtn('◀', 'driveLeft', '#556677'));
    const center = document.createElement('div');
    center.style.cssText = 'display:flex;align-items:center;justify-content:center;color:#555;font-size:8px;font-family:monospace;';
    center.textContent = 'D-PAD';
    leftPad.appendChild(center);
    leftPad.appendChild(this.createBtn('▶', 'driveRight', '#556677'));

    // Row 3: empty, boom down, empty
    leftPad.appendChild(this.createEmpty());
    leftPad.appendChild(this.createBtn('▼', 'boomDown', '#4455aa'));
    leftPad.appendChild(this.createEmpty());

    container.appendChild(leftPad);

    // Right side — rope + grab
    const rightPad = document.createElement('div');
    rightPad.style.cssText = `
      position: absolute; bottom: 20px; right: 15px;
      display: flex; flex-direction: column; gap: 6px; align-items: center;
      pointer-events: auto;
    `;

    rightPad.appendChild(this.createBtn('REEL ▲', 'ropeIn', '#557755', 70, 48));
    rightPad.appendChild(this.createBtn('GRAB', 'grab', '#448844', 70, 55, true));
    rightPad.appendChild(this.createBtn('REEL ▼', 'ropeOut', '#557755', 70, 48));

    container.appendChild(rightPad);

    return container;
  }

  private createEmpty(): HTMLDivElement {
    const div = document.createElement('div');
    return div;
  }

  private createBtn(
    label: string,
    stateKey: keyof TouchState,
    bg: string,
    width = 55,
    height = 55,
    oneShot = false,
  ): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.style.cssText = `
      width: ${width}px; height: ${height}px;
      background: ${bg}aa; color: #ddd;
      border: 1px solid ${bg}; border-radius: 10px;
      font-family: monospace; font-size: ${label.length > 3 ? '11' : '18'}px;
      pointer-events: auto; touch-action: none;
      -webkit-user-select: none; user-select: none;
    `;

    if (oneShot) {
      const fire = (e: Event) => {
        e.preventDefault();
        this.state[stateKey] = true;
        btn.style.opacity = '0.5';
        setTimeout(() => { btn.style.opacity = '1'; }, 150);
      };
      btn.addEventListener('touchstart', fire);
      btn.addEventListener('mousedown', fire);
    } else {
      const on = (e: Event) => {
        e.preventDefault();
        (this.state as unknown as Record<string, boolean>)[stateKey] = true;
        btn.style.opacity = '0.6';
      };
      const off = () => {
        (this.state as unknown as Record<string, boolean>)[stateKey] = false;
        btn.style.opacity = '1';
      };
      btn.addEventListener('touchstart', on);
      btn.addEventListener('touchend', off);
      btn.addEventListener('touchcancel', off);
      btn.addEventListener('mousedown', on);
      btn.addEventListener('mouseup', off);
      btn.addEventListener('mouseleave', off);
    }

    return btn;
  }

  destroy(): void {
    this.container.remove();
  }
}
