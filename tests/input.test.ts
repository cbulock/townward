import { afterEach, expect, it, vi } from 'vitest';
import { InputController, type InputCallbacks } from '../src/game/input/InputController';
import { Camera } from '../src/render/Camera';

// This test double implements the element methods InputController uses; it never reaches a DOM renderer.
class Host extends EventTarget {
  style = { cursor: '' };
  setPointerCapture() {}
  getBoundingClientRect() {
    return { left: 0, top: 0 };
  }
}

function element(host: Host): HTMLElement {
  // Safe here: Host supplies events, pointer capture, bounds and style; no other DOM APIs are used.
  return host as unknown as HTMLElement;
}

function pointer(host: EventTarget, type: string, id = 1, x = 80, y = 90) {
  const e = new Event(type, { cancelable: true });
  Object.assign(e, {
    clientX: x,
    clientY: y,
    pointerType: 'touch',
    pointerId: id,
    button: 0,
    shiftKey: false,
  });
  host.dispatchEvent(e);
  return e;
}

afterEach(() => vi.unstubAllGlobals());

it('identifies touch at press time so relocation can wait for confirmation', () => {
  vi.stubGlobal('window', new EventTarget());
  const host = new Host();
  let source: boolean | undefined;
  const cb: InputCallbacks = {
    onPointer() {},
    onKey() {},
    onPrimaryDown: (_p, _shift, touch) => {
      source = touch;
      return true;
    },
    onPrimaryMove() {},
    onPrimaryUp() {},
    onCancel() {},
    onClick() {},
  };
  const input = new InputController(element(host), new Camera(), cb);
  const press = pointer(host, 'pointerdown');
  expect(source).toBe(true);
  expect(press.defaultPrevented).toBe(true);
  input.destroy();
});

it('viewport changes cancel the gesture and releasing afterwards cannot complete it', () => {
  const win = new EventTarget();
  vi.stubGlobal('window', win);
  const host = new Host();
  let cancels = 0;
  let finishes = 0;
  const cb: InputCallbacks = {
    onPointer() {},
    onKey() {},
    onPrimaryDown: () => true,
    onPrimaryMove() {},
    onPrimaryUp() {
      finishes++;
    },
    onCancel() {
      cancels++;
    },
    onClick() {},
  };
  const input = new InputController(element(host), new Camera(), cb);
  pointer(host, 'pointerdown');
  win.dispatchEvent(new Event('resize'));
  pointer(host, 'pointerup');
  expect(cancels).toBe(1);
  expect(finishes).toBe(0);
  input.destroy();
});

it('pinching discards a pending placement even when the first finger is only panning', () => {
  vi.stubGlobal('window', new EventTarget());
  const host = new Host();
  let pending = false;
  const input = new InputController(element(host), new Camera(), {
    onPointer() {},
    onKey() {},
    onPrimaryDown: () => !pending,
    onPrimaryMove() {},
    onPrimaryUp() {
      pending = true;
    },
    onCancel() {},
    onInterrupt() {
      pending = false;
    },
    onClick() {},
  });
  pointer(host, 'pointerdown');
  pointer(host, 'pointerup');
  expect(pending).toBe(true);
  pointer(host, 'pointerdown', 1, 100, 200);
  pointer(host, 'pointerdown', 2, 200, 200);
  expect(pending).toBe(false);
  pointer(host, 'pointerup', 2);
  pointer(host, 'pointerup', 1);
  expect(pending).toBe(false);
  input.destroy();
});

it('pinch remains navigation-only until all fingers lift, then the selected tool works again', () => {
  vi.stubGlobal('window', new EventTarget());
  const host = new Host();
  const camera = new Camera();
  camera.setScreenSize(360, 640);
  let finishes = 0;
  let hover = 0;
  const input = new InputController(element(host), camera, {
    onPointer(p) {
      if (p) hover++;
    },
    onKey() {},
    onPrimaryDown: () => true,
    onPrimaryMove() {},
    onPrimaryUp() {
      finishes++;
    },
    onCancel() {},
    onInterrupt() {},
    onClick() {},
  });
  pointer(host, 'pointerdown', 1, 100, 200);
  pointer(host, 'pointerdown', 2, 200, 200);
  pointer(host, 'pointermove', 2, 260, 200);
  camera.update(1);
  expect(camera.zoom).toBeGreaterThan(1);
  pointer(host, 'pointerup', 2, 260, 200);
  const before = hover;
  pointer(host, 'pointermove', 1, 120, 220);
  expect(hover).toBe(before);
  pointer(host, 'pointerup', 1, 120, 220);
  expect(finishes).toBe(0);
  pointer(host, 'pointerdown', 3);
  pointer(host, 'pointerup', 3);
  expect(finishes).toBe(1);
  input.destroy();
});

it('a second finger on the HUD joins the map gesture instead of activating a control', () => {
  const win = new EventTarget();
  vi.stubGlobal('window', win);
  const host = new Host();
  let interrupted = 0;
  let finishes = 0;
  const input = new InputController(element(host), new Camera(), {
    onPointer() {},
    onKey() {},
    onPrimaryDown: () => true,
    onPrimaryMove() {},
    onPrimaryUp() {
      finishes++;
    },
    onCancel() {},
    onInterrupt() {
      interrupted++;
    },
    onClick() {},
  });
  pointer(host, 'pointerdown', 1, 100, 200);
  const hudPress = pointer(win, 'pointerdown', 2, 200, 580);
  expect(hudPress.defaultPrevented).toBe(true);
  expect(interrupted).toBe(1);
  pointer(host, 'pointerup', 1);
  pointer(host, 'pointerup', 2);
  expect(finishes).toBe(0);
  input.destroy();
});
