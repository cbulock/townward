import type { Camera } from '../../render/Camera';

/** Keyboard pan speed in screen pixels per second (independent of zoom). */
const KEY_PAN_SPEED = 900;
const EDGE_PAN_SPEED = 750;
const EDGE_MARGIN = 14;
/** How far the pointer must move before a press becomes a drag. */
const DRAG_THRESHOLD = 4;
const KEY_ZOOM_STEP = 1.25;

const PAN_KEYS: Record<string, [number, number]> = {
  KeyW: [0, -1],
  ArrowUp: [0, -1],
  KeyS: [0, 1],
  ArrowDown: [0, 1],
  KeyA: [-1, 0],
  ArrowLeft: [-1, 0],
  KeyD: [1, 0],
  ArrowRight: [1, 0],
};

export interface ScreenPoint {
  x: number;
  y: number;
}

export interface InputCallbacks {
  /** Pointer moved over the map (screen coords, CSS px relative to canvas), or left it (null). */
  onPointer: (screen: ScreenPoint | null) => void;
  onKey: (code: string) => void;
  /** Left button pressed. Return true if the active tool takes the drag; false lets it pan the camera. */
  onPrimaryDown: (screen: ScreenPoint, shift: boolean) => boolean;
  onPrimaryMove: (screen: ScreenPoint, shift: boolean) => void;
  onPrimaryUp: (screen: ScreenPoint, shift: boolean) => void;
  /** Right click without dragging: cancel the current tool action. */
  onCancel: () => void;
}

/**
 * Translates raw DOM input into camera motion, tool drags and pointer updates.
 * Right/middle drag always pans; left drag goes to the active tool, or pans if there is none.
 */
export class InputController {
  edgeScroll = true;
  private readonly held = new Set<string>();
  private drag: {
    id: number;
    button: number;
    lastX: number;
    lastY: number;
    startX: number;
    startY: number;
    moved: boolean;
  } | null = null;
  /** Pointer id of an in-progress tool drag. */
  private toolPointer: number | null = null;
  private pointer: { x: number; y: number } | null = null;
  private trackpadUntil = 0;
  private readonly cleanup: (() => void)[] = [];

  constructor(
    private readonly el: HTMLElement,
    private readonly camera: Camera,
    private readonly cb: InputCallbacks,
  ) {
    this.listen(el, 'pointerdown', this.onPointerDown);
    this.listen(el, 'pointermove', this.onPointerMove);
    this.listen(el, 'pointerup', this.onPointerUp);
    this.listen(el, 'pointercancel', this.onPointerUp);
    this.listen(el, 'pointerleave', this.onPointerLeave);
    this.listen(el, 'wheel', this.onWheel, { passive: false });
    this.listen(el, 'contextmenu', (e: Event) => e.preventDefault());
    this.listen(window, 'keydown', this.onKeyDown);
    this.listen(window, 'keyup', this.onKeyUp);
    this.listen(window, 'blur', () => this.held.clear());
  }

  private listen<E extends Event>(
    target: EventTarget,
    type: string,
    fn: (e: E) => void,
    opts?: AddEventListenerOptions,
  ) {
    const handler = fn as EventListener;
    target.addEventListener(type, handler, opts);
    this.cleanup.push(() => target.removeEventListener(type, handler, opts));
  }

  private local(e: { clientX: number; clientY: number }) {
    const r = this.el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private onPointerDown = (e: PointerEvent) => {
    const p = this.local(e);
    this.el.setPointerCapture(e.pointerId);
    if (e.button === 0 && this.cb.onPrimaryDown(p, e.shiftKey)) {
      this.toolPointer = e.pointerId;
      return;
    }
    this.drag = { id: e.pointerId, button: e.button, lastX: p.x, lastY: p.y, startX: p.x, startY: p.y, moved: false };
  };

  private onPointerMove = (e: PointerEvent) => {
    const p = this.local(e);
    this.pointer = p;
    if (this.toolPointer === e.pointerId) {
      this.cb.onPointer(p);
      this.cb.onPrimaryMove(p, e.shiftKey);
      return;
    }
    const d = this.drag;
    if (d && d.id === e.pointerId) {
      if (!d.moved && Math.hypot(p.x - d.startX, p.y - d.startY) > DRAG_THRESHOLD) {
        d.moved = true;
        this.el.style.cursor = 'grabbing';
      }
      if (d.moved) this.camera.dragBy(p.x - d.lastX, p.y - d.lastY);
      d.lastX = p.x;
      d.lastY = p.y;
    }
    this.cb.onPointer(p);
  };

  private onPointerUp = (e: PointerEvent) => {
    if (this.toolPointer === e.pointerId) {
      this.toolPointer = null;
      if (e.type === 'pointercancel') this.cb.onCancel();
      else this.cb.onPrimaryUp(this.local(e), e.shiftKey);
      return;
    }
    if (this.drag?.id === e.pointerId) {
      if (this.drag.button === 2 && !this.drag.moved) this.cb.onCancel();
      this.drag = null;
      this.el.style.cursor = '';
    }
  };

  private onPointerLeave = () => {
    if (this.drag || this.toolPointer !== null) return; // captured; keep tracking
    this.pointer = null;
    this.cb.onPointer(null);
  };

  /**
   * Mouse wheel zooms. Trackpads: pinch arrives as ctrl+wheel (zoom), two-finger
   * scroll arrives as wheel with deltaX (pan). Once we see horizontal motion we
   * treat the next ~300ms of wheel events as trackpad pans.
   */
  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const p = this.local(e);
    const scale = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
    const dx = e.deltaX * scale;
    const dy = e.deltaY * scale;
    const now = performance.now();

    if (e.ctrlKey) {
      this.camera.zoomAt(Math.exp(-dy * 0.01), p.x, p.y);
      return;
    }
    if (dx !== 0) this.trackpadUntil = now + 300;
    if (now < this.trackpadUntil) {
      this.camera.dragBy(-dx, -dy);
      return;
    }
    this.camera.zoomAt(Math.exp(-dy * 0.0015), p.x, p.y);
  };

  private onKeyDown = (e: KeyboardEvent) => {
    if (isTyping(e)) return;
    if (PAN_KEYS[e.code]) {
      this.held.add(e.code);
      e.preventDefault();
      return;
    }
    const center = { x: this.camera.screenW / 2, y: this.camera.screenH / 2 };
    if (e.code === 'Equal' || e.code === 'NumpadAdd') {
      this.camera.zoomAt(KEY_ZOOM_STEP, center.x, center.y);
    } else if (e.code === 'Minus' || e.code === 'NumpadSubtract') {
      this.camera.zoomAt(1 / KEY_ZOOM_STEP, center.x, center.y);
    } else if (!e.repeat) {
      this.cb.onKey(e.code);
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.held.delete(e.code);
  };

  /** Continuous input (held keys, edge scroll). Call once per frame. */
  update(dt: number) {
    let vx = 0;
    let vy = 0;
    for (const code of this.held) {
      const [x, y] = PAN_KEYS[code];
      vx += x;
      vy += y;
    }
    if (vx || vy) {
      const len = Math.hypot(vx, vy);
      this.camera.panBy((vx / len) * KEY_PAN_SPEED * dt, (vy / len) * KEY_PAN_SPEED * dt);
    }

    const p = this.pointer;
    if (this.edgeScroll && p && !this.drag && this.toolPointer === null && document.hasFocus()) {
      let ex = 0;
      let ey = 0;
      if (p.x < EDGE_MARGIN) ex = -1;
      else if (p.x > this.camera.screenW - EDGE_MARGIN) ex = 1;
      if (p.y < EDGE_MARGIN) ey = -1;
      else if (p.y > this.camera.screenH - EDGE_MARGIN) ey = 1;
      if (ex || ey) this.camera.panBy(ex * EDGE_PAN_SPEED * dt, ey * EDGE_PAN_SPEED * dt);
    }

    // Camera may have moved under a stationary pointer: re-report so hover stays correct.
    if (p) this.cb.onPointer(p);
  }

  destroy() {
    this.cleanup.forEach((fn) => fn());
    this.cleanup.length = 0;
  }
}

function isTyping(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
}
