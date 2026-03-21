/**
 * DevConsole — In-game developer console for testing and tuning
 *
 * LEARN: Every serious game project has a dev console. It lets you
 * bypass normal gameplay to test specific scenarios quickly — "what
 * happens when I drop 5 glass I-Blocks in a row?" Without this,
 * you'd have to play normally and hope random chance gives you what
 * you need. Dev consoles save massive amounts of testing time.
 *
 * Toggle with backtick (`) key. The console renders as a DOM overlay
 * on top of the Phaser canvas so it can use standard HTML form elements
 * (dropdowns, buttons) which are much easier to use on mobile than
 * trying to build a UI inside the game canvas.
 */
import { PieceFactory } from '../pieces/PieceFactory';
import { PIECE_DEFINITIONS } from '../pieces/PieceDefinitions';
import { getAllMaterialKeys } from '../tuning';

export class DevConsole {
  private container: HTMLDivElement;
  private visible = false;
  private factory: PieceFactory;

  private shapeSelect!: HTMLSelectElement;
  private materialSelect!: HTMLSelectElement;
  private statusLine!: HTMLDivElement;

  constructor(factory: PieceFactory) {
    this.factory = factory;
    this.container = this.createDOM();
    document.body.appendChild(this.container);
    this.setupKeyboardToggle();
  }

  private createDOM(): HTMLDivElement {
    const container = document.createElement('div');
    container.id = 'dev-console';
    container.style.cssText = `
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: rgba(0, 0, 0, 0.92);
      color: #e0e0e0;
      font-family: monospace;
      font-size: 13px;
      padding: 10px 14px;
      z-index: 9999;
      display: none;
      border-top: 1px solid #444;
    `;

    // Title bar
    const title = document.createElement('div');
    title.style.cssText = 'color: #88aaff; margin-bottom: 8px; font-size: 11px; letter-spacing: 1px;';
    title.textContent = 'DEV CONSOLE — press ` to toggle';
    container.appendChild(title);

    // Controls row
    const row = document.createElement('div');
    row.style.cssText = 'display: flex; gap: 10px; align-items: center; flex-wrap: wrap;';
    container.appendChild(row);

    // Shape selector
    row.appendChild(this.createLabel('Shape:'));
    this.shapeSelect = this.createSelect(
      [{ value: '', label: 'Random' }, ...PIECE_DEFINITIONS.map(d => ({ value: d.name, label: d.name }))],
    );
    this.shapeSelect.addEventListener('change', () => {
      const val = this.shapeSelect.value || null;
      this.factory.setForcedShape(val);
      this.updateStatus();
    });
    row.appendChild(this.shapeSelect);

    // Material selector
    row.appendChild(this.createLabel('Material:'));
    const materialKeys = getAllMaterialKeys();
    this.materialSelect = this.createSelect(
      [{ value: '', label: 'Random' }, ...materialKeys.map(k => ({ value: k, label: k.charAt(0).toUpperCase() + k.slice(1) }))],
    );
    this.materialSelect.addEventListener('change', () => {
      const val = this.materialSelect.value || null;
      this.factory.setForcedMaterial(val);
      this.updateStatus();
    });
    row.appendChild(this.materialSelect);

    // Reset button
    const resetBtn = document.createElement('button');
    resetBtn.textContent = 'Reset';
    resetBtn.style.cssText = `
      background: #333;
      color: #ccc;
      border: 1px solid #555;
      padding: 4px 12px;
      font-family: monospace;
      font-size: 12px;
      cursor: pointer;
      border-radius: 3px;
    `;
    resetBtn.addEventListener('click', () => {
      this.shapeSelect.value = '';
      this.materialSelect.value = '';
      this.factory.setForcedShape(null);
      this.factory.setForcedMaterial(null);
      this.updateStatus();
    });
    row.appendChild(resetBtn);

    // Status line
    this.statusLine = document.createElement('div');
    this.statusLine.style.cssText = 'color: #666; font-size: 11px; margin-top: 6px;';
    container.appendChild(this.statusLine);
    this.updateStatus();

    return container;
  }

  private createLabel(text: string): HTMLSpanElement {
    const label = document.createElement('span');
    label.textContent = text;
    label.style.cssText = 'color: #999; font-size: 12px;';
    return label;
  }

  private createSelect(options: Array<{ value: string; label: string }>): HTMLSelectElement {
    const select = document.createElement('select');
    select.style.cssText = `
      background: #222;
      color: #e0e0e0;
      border: 1px solid #555;
      padding: 4px 8px;
      font-family: monospace;
      font-size: 12px;
      border-radius: 3px;
    `;
    for (const opt of options) {
      const el = document.createElement('option');
      el.value = opt.value;
      el.textContent = opt.label;
      select.appendChild(el);
    }
    return select;
  }

  private setupKeyboardToggle(): void {
    document.addEventListener('keydown', (e) => {
      if (e.key === '`' || e.key === '~') {
        e.preventDefault();
        this.toggle();
      }
    });
  }

  toggle(): void {
    this.visible = !this.visible;
    this.container.style.display = this.visible ? 'block' : 'none';
  }

  private updateStatus(): void {
    const shape = this.factory.getForcedShape();
    const material = this.factory.getForcedMaterial();
    const parts: string[] = [];
    if (shape) parts.push(`shape=${shape}`);
    if (material) parts.push(`material=${material}`);
    this.statusLine.textContent = parts.length > 0
      ? `Next piece: ${parts.join(', ')}`
      : 'Next piece: random';
  }

  destroy(): void {
    this.container.remove();
  }
}
