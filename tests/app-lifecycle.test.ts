import { expect, it } from 'vitest';
import { AppLifecycle } from '../src/app/mobile/AppLifecycle';

it('backgrounding pauses once and restores the previous speed and sound', () => {
  const state = { speed: 3, muted: false, cancels: 0, saves: 0 };
  const lifecycle = new AppLifecycle({
    get speed() {
      return state.speed;
    },
    get muted() {
      return state.muted;
    },
    setSpeed(v) {
      state.speed = v;
    },
    setMuted(v) {
      state.muted = v;
    },
    cancelInteraction() {
      state.cancels++;
    },
    save() {
      state.saves++;
    },
  });
  lifecycle.setActive(false);
  lifecycle.setActive(false);
  expect(state).toEqual({ speed: 0, muted: true, cancels: 1, saves: 1 });
  lifecycle.setActive(true);
  expect(state.speed).toBe(3);
  expect(state.muted).toBe(false);
});

it('a paused and muted city stays paused and muted on return', () => {
  const state = { speed: 0, muted: true };
  const lifecycle = new AppLifecycle({
    get speed() {
      return state.speed;
    },
    get muted() {
      return state.muted;
    },
    setSpeed(v) {
      state.speed = v;
    },
    setMuted(v) {
      state.muted = v;
    },
    cancelInteraction() {},
    save() {},
  });
  lifecycle.setActive(false);
  lifecycle.setActive(true);
  expect(state).toEqual({ speed: 0, muted: true });
});
