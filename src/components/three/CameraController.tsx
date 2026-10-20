"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { rig, domSync, type CamState, type PanelCam } from "@/lib/rig";

// Owns the render loop (priority 1 disables R3F's automatic render).
//   • positions the hero camera from the spherical rig values
//   • keeps projected DOM labels and the vertical red wake in sync
//   • in the showcase, renders the same scene through three cameras into
//     scissored viewports whose rectangles match DOM panels underneath

const D2R = Math.PI / 180;
const UP = new THREE.Vector3(0, 1, 0);

type Rect = { x: number; y: number; w: number; h: number };

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const seg = (t: number, a: number, b: number) => ease(clamp01((t - a) / (b - a)));
const lerpRect = (a: Rect, b: Rect, t: number): Rect => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
  w: a.w + (b.w - a.w) * t,
  h: a.h + (b.h - a.h) * t,
});

export function panelLayout(w: number, h: number): Rect[] {
  if (w / h >= 0.9) {
    const top = h * 0.2, bottom = h * 0.1, margin = Math.max(24, w * 0.045), gap = Math.max(10, w * 0.012);
    const pw = (w - margin * 2 - gap * 2) / 3;
    return [0, 1, 2].map((i) => ({ x: margin + i * (pw + gap), y: top, w: pw, h: h - top - bottom }));
  }
  const top = Math.max(128, h * 0.17), bottom = h * 0.04, margin = 16, gap = 10;
  const ph = (h - top - bottom - gap * 2) / 3;
  return [0, 1, 2].map((i) => ({ x: margin, y: top + i * (ph + gap), w: w - margin * 2, h: ph }));
}

/** Panel rectangles for the current split / un-split progress. */
export function showcaseRects(w: number, h: number) {
  const full: Rect = { x: 0, y: 0, w, h };
  const target = panelLayout(w, h);
  const p = rig.split, q = rig.splitOut;
  const shrink = seg(p, 0, 0.6) * (1 - seg(q, 0.35, 1));
  const r0 = lerpRect(full, target[0], shrink);
  const slide = (i: number, inA: number, inB: number, outA: number, outB: number) => {
    const k = seg(p, inA, inB) * (1 - seg(q, outA, outB));
    const r = target[i];
    const off = (1 - k) * (h - r.y + 40);
    return { rect: { ...r, y: r.y + off }, visible: k > 0.001 };
  };
  return {
    shrink,
    rects: [
      { rect: r0, visible: true },
      slide(1, 0.25, 0.8, 0.15, 0.65),
      slide(2, 0.4, 1.0, 0.0, 0.5),
    ],
  };
}

function applySpherical(
  cam: THREE.PerspectiveCamera,
  s: { az: number; el: number; dist: number; fov: number; ty: number; tx?: number; tz?: number },
  aspect: number,
  refAspect: number,
  target: THREE.Vector3,
) {
  const az = s.az * D2R;
  const el = Math.min(89.6, Math.max(-89, s.el)) * D2R;
  // Width-limited framing on narrow screens; the softer exponent on very
  // tall (phone) viewports lets the car fill more of the width.
  const ratio = Math.max(1, refAspect / aspect);
  const fit = Math.pow(ratio, ratio > 2.2 ? 0.84 : 0.92);
  const d = s.dist * fit;
  target.set(s.tx ?? 0, s.ty, s.tz ?? 0);
  cam.position.set(
    target.x + d * Math.cos(el) * Math.sin(az),
    target.y + d * Math.sin(el),
    target.z + d * Math.cos(el) * Math.cos(az),
  );
  // Blend the up-vector towards the horizontal look direction near top-down
  // so the plan view keeps a stable orientation (no gimbal flip).
  const k = THREE.MathUtils.smoothstep(s.el, 55, 89);
  cam.up.set(-Math.sin(az) * k, 1 - k, -Math.cos(az) * k).normalize();
  if (cam.up.lengthSq() < 1e-6) cam.up.copy(UP);
  cam.lookAt(target);
  cam.fov = s.fov;
  cam.aspect = aspect;
}

export function CameraController() {
  const tmp = useMemo(
    () => ({
      target: new THREE.Vector3(),
      v: new THREE.Vector3(),
      panelCams: [0, 1, 2].map(() => new THREE.PerspectiveCamera(26, 1, 0.1, 200)),
    }),
    [],
  );

  useFrame((state) => {
    const { gl, scene, size } = state;
    const camera = state.camera as THREE.PerspectiveCamera;
    const W = size.width, H = size.height;
    const aspect = W / Math.max(1, H);
    const portrait = aspect < 0.9;

    // ── hero camera ──
    const c: CamState = rig.cam;
    // Side/three-quarter views are width-limited; the nose-up plan view is
    // height-limited, so the reference aspect relaxes as the camera cranes up.
    const heroRef = THREE.MathUtils.lerp(1.55, 0.6, THREE.MathUtils.smoothstep(c.el, 60, 89));
    applySpherical(camera, c, aspect, heroRef, tmp.target);
    const sx = portrait ? c.sx * 0.15 : c.sx;
    const sy = c.sy;
    if (Math.abs(sx) > 1e-4 || Math.abs(sy) > 1e-4) camera.setViewOffset(W, H, -sx * W, sy * H, W, H);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();

    // ── projected labels + red wake ──
    const car = domSync.car;
    if (car) {
      for (const l of domSync.labels) {
        tmp.v.set(l.anchor[0], l.anchor[1], l.anchor[2]).applyMatrix4(car.matrixWorld).project(camera);
        const x = (tmp.v.x * 0.5 + 0.5) * W;
        const y = (-tmp.v.y * 0.5 + 0.5) * H;
        l.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      }
      if (domSync.wake) {
        tmp.v.set(-domSync.carLength * 0.5 + 0.35, 0.4, 0).applyMatrix4(car.matrixWorld).project(camera);
        const y = (-tmp.v.y * 0.5 + 0.5) * H;
        rig.tailY = y;
        domSync.wake.style.setProperty("--wake", `${Math.max(0, Math.min(H, y)).toFixed(1)}px`);
      }
    }

    // ── render ──
    const splitActive = rig.split > 0.0005 && rig.splitOut < 0.9995;
    gl.setClearColor(0x000000, 0);
    if (!splitActive) {
      gl.setScissorTest(false);
      gl.setViewport(0, 0, W, H);
      gl.clear();
      gl.render(scene, camera);
      for (const el of domSync.panels) el.style.visibility = "hidden";
      return;
    }

    const { rects, shrink } = showcaseRects(W, H);
    gl.setScissorTest(true);
    gl.setViewport(0, 0, W, H);
    gl.setScissor(0, 0, W, H);
    gl.clear();

    rects.forEach(({ rect, visible }, i) => {
      const el = domSync.panels[i];
      if (el) {
        el.style.visibility = visible ? "visible" : "hidden";
        el.style.transform = `translate3d(${rect.x}px, ${rect.y}px, 0)`;
        el.style.width = `${rect.w}px`;
        el.style.height = `${rect.h}px`;
        if (i === 0) el.style.opacity = String(shrink);
      }
      if (!visible) return;
      const glY = H - rect.y - rect.h;
      gl.setViewport(rect.x, glY, rect.w, rect.h);
      gl.setScissor(rect.x, glY, rect.w, rect.h);
      const a = rect.w / Math.max(1, rect.h);
      const pc = tmp.panelCams[i];
      if (i === 0) {
        applySpherical(pc, c, a, heroRef, tmp.target);
      } else {
        const s: PanelCam = rig.panels[i];
        applySpherical(pc, s, a, portrait ? 2.0 : 1.55, tmp.target);
      }
      pc.updateProjectionMatrix();
      gl.render(scene, pc);
    });
    gl.setScissorTest(false);
  }, 1);

  return null;
}
