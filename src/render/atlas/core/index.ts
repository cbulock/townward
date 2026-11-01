/** Shared painting kit: projection, orientation, faces, colour and light (D-066). */
export { IsoFrame, type Box, type Face, type FrameMark, type MarkKind, type Rng } from './iso';
export { BUILDING_ROTATIONS, Orient, type BuildingRotation, type Side } from './orient';
export { boxOut, faceRef, floorOut, inFront, onFace, pOn, solidOut, wallOn, type FaceRef, type Prop } from './faces';
export { alpha, mix, parseColor, shade, warm } from './color';
export { blobShadow, castShadow, contactShadow, faceTone, flatTone, litBox, litWall, occlusion, rimLight, topTone } from './light';
