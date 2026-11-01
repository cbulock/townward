import { buildingMarks } from '../atlas/buildings';
import type { BuildingRotation, FrameMark, MarkKind } from '../atlas/core';
import type { ViewRef } from '../Renderer';
import { buildingOrigin } from '../view/placement';

/** A mark of one kind in world pixels (view space). */
export interface WorldMark {
  readonly x: number;
  readonly y: number;
  readonly building: number;
  readonly mark: FrameMark;
}

/** Every finished building's marks of a kind, in world pixels (rescanned now and then by callers). */
export function collectMarks(viewRef: ViewRef, kind: MarkKind): WorldMark[] {
  const ground = viewRef.ground;
  const r = viewRef.current.r;
  const out: WorldMark[] = [];
  for (const b of ground.buildings.values()) {
    if (b.construction > 0 || b.abandoned) continue;
    const marks = buildingMarks(b.def, b.variant, r as BuildingRotation);
    if (marks.length === 0) continue;
    let origin: { x: number; y: number } | null = null;
    for (const m of marks) {
      if (m.kind !== kind) continue;
      origin ??= buildingOrigin(ground, b, r);
      out.push({ x: origin.x + m.x, y: origin.y + m.y, building: b.id, mark: m });
    }
  }
  return out;
}
