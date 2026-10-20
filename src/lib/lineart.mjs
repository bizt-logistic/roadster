// Line-art engine shared by the browser (procedural fallback car) and the
// Node optimisation script (sourced glTF model).
//
// It turns triangle meshes into a "technical drawing": crease edges, open
// boundaries, a side-view silhouette and planar section cuts. The resulting
// segments are chained into continuous polylines and every vertex receives a
// `draw` time in [0, 1], so a shader can reveal the lines as if an engineer's
// pen were tracing them.
//
// Plain ESM + JSDoc so it runs unmodified in Node and in the Next.js bundle.

/**
 * @typedef {Object} TriMesh
 * @property {Float32Array} pos     world-space xyz triplets
 * @property {Uint32Array | Uint16Array | null} [idx] triangle indices
 * @property {string} [role]        free-form tag (e.g. "paint", "glass")
 */

/**
 * @typedef {Object} DrawGroup
 * @property {Float32Array[]} chains   polylines (xyz triplets)
 * @property {number} cat              category id written to the `cat` attribute
 * @property {[number, number]} window draw-time window for this group
 * @property {number} [spread]         fraction of the window used to stagger starts
 * @property {number} [maxSegments]    cap; shortest chains are dropped first
 * @property {(c: Float32Array) => number} [sortKey] higher draws earlier
 */

/** Deterministic PRNG so the drawing order is identical on every load. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function welder(eps) {
  const inv = 1 / eps;
  const map = new Map();
  const out = [];
  return {
    out,
    id(x, y, z) {
      const key = `${Math.round(x * inv)},${Math.round(y * inv)},${Math.round(z * inv)}`;
      let i = map.get(key);
      if (i === undefined) {
        i = out.length / 3;
        map.set(key, i);
        out.push(x, y, z);
      }
      return i;
    },
  };
}

/**
 * Feature edges for a set of meshes. Adjacency is computed per mesh, so seams
 * between separate meshes (paint / glass / trim) surface as boundary lines.
 *
 * @param {TriMesh[]} meshes
 * @param {{ creaseAngle?: number, view?: [number, number, number], eps?: number }} [opts]
 */
export function extractFeatureLines(meshes, opts = {}) {
  const creaseCos = Math.cos(((opts.creaseAngle ?? 32) * Math.PI) / 180);
  const view = opts.view ?? [0, 0, 1];
  const eps = opts.eps ?? 1e-4;
  const crease = [];
  const silhouette = [];
  const boundary = [];

  for (const mesh of meshes) {
    const { pos } = mesh;
    const vCount = pos.length / 3;
    const idx = mesh.idx ?? null;
    const triCount = idx ? idx.length / 3 : vCount / 3;
    const w = welder(eps);
    const remap = new Uint32Array(vCount);
    for (let i = 0; i < vCount; i++) remap[i] = w.id(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
    const wp = w.out;
    const nv = wp.length / 3;

    const fn = new Float32Array(triCount * 3);
    const fv = new Uint32Array(triCount * 3);
    const valid = new Uint8Array(triCount);
    for (let t = 0; t < triCount; t++) {
      const a = remap[idx ? idx[t * 3] : t * 3];
      const b = remap[idx ? idx[t * 3 + 1] : t * 3 + 1];
      const c = remap[idx ? idx[t * 3 + 2] : t * 3 + 2];
      if (a === b || b === c || a === c) continue;
      const ux = wp[b * 3] - wp[a * 3], uy = wp[b * 3 + 1] - wp[a * 3 + 1], uz = wp[b * 3 + 2] - wp[a * 3 + 2];
      const vx = wp[c * 3] - wp[a * 3], vy = wp[c * 3 + 1] - wp[a * 3 + 1], vz = wp[c * 3 + 2] - wp[a * 3 + 2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const len = Math.hypot(nx, ny, nz);
      if (len < 1e-12) continue;
      nx /= len; ny /= len; nz /= len;
      fn[t * 3] = nx; fn[t * 3 + 1] = ny; fn[t * 3 + 2] = nz;
      fv[t * 3] = a; fv[t * 3 + 1] = b; fv[t * 3 + 2] = c;
      valid[t] = 1;
    }

    const pushSeg = (arr, a, b) => {
      arr.push(wp[a * 3], wp[a * 3 + 1], wp[a * 3 + 2], wp[b * 3], wp[b * 3 + 1], wp[b * 3 + 2]);
    };

    const edgeFace = new Map();
    for (let t = 0; t < triCount; t++) {
      if (!valid[t]) continue;
      for (let e = 0; e < 3; e++) {
        const u = fv[t * 3 + e];
        const v = fv[t * 3 + ((e + 1) % 3)];
        const key = u < v ? u * nv + v : v * nv + u;
        const g = edgeFace.get(key);
        if (g === undefined) {
          edgeFace.set(key, t);
        } else if (g >= 0) {
          const d = fn[g * 3] * fn[t * 3] + fn[g * 3 + 1] * fn[t * 3 + 1] + fn[g * 3 + 2] * fn[t * 3 + 2];
          if (d < creaseCos) {
            pushSeg(crease, u, v);
          } else {
            const sg = fn[g * 3] * view[0] + fn[g * 3 + 1] * view[1] + fn[g * 3 + 2] * view[2];
            const st = fn[t * 3] * view[0] + fn[t * 3 + 1] * view[1] + fn[t * 3 + 2] * view[2];
            if ((sg > 0) !== (st > 0)) pushSeg(silhouette, u, v);
          }
          edgeFace.set(key, -1);
        }
      }
    }
    for (const [key, t] of edgeFace) {
      if (t < 0) continue;
      const u = Math.floor(key / nv);
      const v = key - u * nv;
      pushSeg(boundary, u, v);
    }
  }

  return {
    crease: new Float32Array(crease),
    silhouette: new Float32Array(silhouette),
    boundary: new Float32Array(boundary),
  };
}

/**
 * Planar section of meshes: axis 0 = x, 1 = y, 2 = z. Returns raw segments.
 * @param {TriMesh[]} meshes
 * @param {0|1|2} axis
 * @param {number} value
 */
export function sliceMeshes(meshes, axis, value) {
  const out = [];
  const v0 = value + 1.37e-6; // avoid exact vertex hits
  for (const { pos, idx } of meshes) {
    const triCount = idx ? idx.length / 3 : pos.length / 9;
    const p = [0, 0, 0];
    for (let t = 0; t < triCount; t++) {
      p[0] = idx ? idx[t * 3] : t * 3;
      p[1] = idx ? idx[t * 3 + 1] : t * 3 + 1;
      p[2] = idx ? idx[t * 3 + 2] : t * 3 + 2;
      const d0 = pos[p[0] * 3 + axis] - v0;
      const d1 = pos[p[1] * 3 + axis] - v0;
      const d2 = pos[p[2] * 3 + axis] - v0;
      if ((d0 > 0 && d1 > 0 && d2 > 0) || (d0 < 0 && d1 < 0 && d2 < 0)) continue;
      const d = [d0, d1, d2];
      let found = 0;
      for (let e = 0; e < 3; e++) {
        const a = e, b = (e + 1) % 3;
        if ((d[a] > 0) === (d[b] > 0)) continue;
        const s = d[a] / (d[a] - d[b]);
        const ia = p[a] * 3, ib = p[b] * 3;
        out.push(
          pos[ia] + (pos[ib] - pos[ia]) * s,
          pos[ia + 1] + (pos[ib + 1] - pos[ia + 1]) * s,
          pos[ia + 2] + (pos[ib + 2] - pos[ia + 2]) * s,
        );
        found++;
      }
      if (found !== 2) out.length -= found * 3;
    }
  }
  return new Float32Array(out);
}

/**
 * Join loose segments into continuous polylines, preferring the straightest
 * continuation at junctions so chains read like deliberate pen strokes.
 * @param {Float32Array} segs xyz,xyz per segment
 * @param {number} [eps]
 * @returns {Float32Array[]}
 */
export function chainSegments(segs, eps = 1e-4) {
  const n = segs.length / 6;
  if (!n) return [];
  const w = welder(eps);
  const sa = new Uint32Array(n);
  const sb = new Uint32Array(n);
  for (let i = 0; i < n; i++) {
    sa[i] = w.id(segs[i * 6], segs[i * 6 + 1], segs[i * 6 + 2]);
    sb[i] = w.id(segs[i * 6 + 3], segs[i * 6 + 4], segs[i * 6 + 5]);
  }
  const P = w.out;
  const np = P.length / 3;
  const deg = new Uint32Array(np + 1);
  for (let i = 0; i < n; i++) { deg[sa[i]]++; deg[sb[i]]++; }
  const start = new Uint32Array(np + 1);
  for (let i = 0; i < np; i++) start[i + 1] = start[i] + deg[i];
  const fill = start.slice();
  const adj = new Uint32Array(n * 2);
  for (let i = 0; i < n; i++) { adj[fill[sa[i]]++] = i; adj[fill[sb[i]]++] = i; }

  const used = new Uint8Array(n);
  const chains = [];
  const walk = (p0) => {
    const pts = [p0];
    let cur = p0;
    let dx = 0, dy = 0, dz = 0;
    for (;;) {
      let best = -1, bestScore = -Infinity;
      for (let k = start[cur]; k < start[cur + 1]; k++) {
        const s = adj[k];
        if (used[s]) continue;
        const o = sa[s] === cur ? sb[s] : sa[s];
        let ex = P[o * 3] - P[cur * 3], ey = P[o * 3 + 1] - P[cur * 3 + 1], ez = P[o * 3 + 2] - P[cur * 3 + 2];
        const l = Math.hypot(ex, ey, ez) || 1;
        ex /= l; ey /= l; ez /= l;
        const score = pts.length > 1 ? ex * dx + ey * dy + ez * dz : 0;
        if (score > bestScore) { bestScore = score; best = s; }
      }
      if (best < 0 || (pts.length > 1 && bestScore < -0.2)) break;
      used[best] = 1;
      const o = sa[best] === cur ? sb[best] : sa[best];
      dx = P[o * 3] - P[cur * 3]; dy = P[o * 3 + 1] - P[cur * 3 + 1]; dz = P[o * 3 + 2] - P[cur * 3 + 2];
      const l = Math.hypot(dx, dy, dz) || 1;
      dx /= l; dy /= l; dz /= l;
      pts.push(o);
      cur = o;
    }
    if (pts.length > 1) {
      const arr = new Float32Array(pts.length * 3);
      pts.forEach((p, i) => { arr[i * 3] = P[p * 3]; arr[i * 3 + 1] = P[p * 3 + 1]; arr[i * 3 + 2] = P[p * 3 + 2]; });
      chains.push(arr);
    }
  };
  // Open ends first so strokes start at a natural endpoint.
  for (let p = 0; p < np; p++) if (deg[p] === 1 || deg[p] > 2) {
    for (let k = start[p]; k < start[p + 1]; k++) if (!used[adj[k]]) walk(p);
  }
  for (let i = 0; i < n; i++) if (!used[i]) walk(sa[i]);
  return chains;
}

export function chainLength(c) {
  let len = 0;
  for (let i = 3; i < c.length; i += 3) len += Math.hypot(c[i] - c[i - 3], c[i + 1] - c[i - 2], c[i + 2] - c[i - 1]);
  return len;
}

/** Douglas–Peucker-free light decimation: drop points closer than `minStep`. */
export function simplifyChain(c, minStep) {
  if (c.length <= 6) return c;
  const out = [c[0], c[1], c[2]];
  let lx = c[0], ly = c[1], lz = c[2];
  for (let i = 3; i < c.length - 3; i += 3) {
    if (Math.hypot(c[i] - lx, c[i + 1] - ly, c[i + 2] - lz) >= minStep) {
      out.push(c[i], c[i + 1], c[i + 2]);
      lx = c[i]; ly = c[i + 1]; lz = c[i + 2];
    }
  }
  const e = c.length - 3;
  out.push(c[e], c[e + 1], c[e + 2]);
  return new Float32Array(out);
}

/**
 * Bake polylines into LineSegments buffers with a per-vertex draw time.
 * @param {DrawGroup[]} groups
 * @param {number} [seed]
 */
export function buildDrawBuffers(groups, seed = 7) {
  const rand = mulberry32(seed);
  const position = [];
  const draw = [];
  const cat = [];
  for (const g of groups) {
    const key = g.sortKey ?? chainLength;
    let items = g.chains.map((c) => ({ c, len: chainLength(c), k: key(c) })).filter((it) => it.len > 1e-5);
    items.sort((a, b) => b.k - a.k);
    if (g.maxSegments) {
      let budget = g.maxSegments;
      const kept = [];
      const byLen = [...items].sort((a, b) => b.len - a.len);
      const keep = new Set();
      for (const it of byLen) {
        const segs = it.c.length / 3 - 1;
        if (segs > budget) continue;
        budget -= segs;
        keep.add(it);
      }
      for (const it of items) if (keep.has(it)) kept.push(it);
      items = kept;
    }
    if (!items.length) continue;
    const [a, b] = g.window;
    const span = b - a;
    const spread = g.spread ?? 0.65;
    const maxLen = items.reduce((m, it) => Math.max(m, it.len), 0);
    items.forEach((it, i) => {
      const r = items.length > 1 ? i / (items.length - 1) : 0;
      const jitter = (rand() - 0.5) * 0.06 * span;
      const s = Math.min(b - 0.02 * span, Math.max(a, a + span * spread * Math.pow(r, 0.8) + jitter));
      const dur = Math.min(b - s, span * (0.12 + 0.38 * Math.sqrt(it.len / maxLen)));
      const c = it.c;
      let acc = 0;
      let prevT = s;
      for (let k = 3; k < c.length; k += 3) {
        acc += Math.hypot(c[k] - c[k - 3], c[k + 1] - c[k - 2], c[k + 2] - c[k - 1]);
        const t = s + dur * (acc / it.len);
        position.push(c[k - 3], c[k - 2], c[k - 1], c[k], c[k + 1], c[k + 2]);
        draw.push(prevT, t);
        cat.push(g.cat, g.cat);
        prevT = t;
      }
    });
  }
  return {
    position: new Float32Array(position),
    draw: new Float32Array(draw),
    cat: new Float32Array(cat),
  };
}

function concat(a, b) {
  const out = new Float32Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

/** Category ids shared by the shader and the generators. */
export const LINE_CAT = {
  SILHOUETTE: 0,
  WHEEL: 1,
  CONTOUR: 2,
  SECTION: 3,
  DETAIL: 4,
};

/**
 * High-level recipe used for both the procedural and the sourced car.
 * Expects meshes already in "car space": length along X (front = +X),
 * ground at y = 0, centred on z = 0.
 *
 * @param {{ body: TriMesh[], all: TriMesh[], wheels: {x:number,y:number,z:number,r:number,w:number}[],
 *           length: number, height: number, creaseAngle?: number, budget?: number }} input
 */
export function buildCarLineArt(input) {
  const { body, all, wheels, length, height } = input;
  const budget = input.budget ?? 90000;
  const eps = length * 2e-5;
  const feat = extractFeatureLines(all, { creaseAngle: input.creaseAngle ?? 34, view: [0, 0, 1], eps });

  const inWheel = (c) => {
    let mx = 0, my = 0, mz = 0;
    const n = c.length / 3;
    for (let i = 0; i < c.length; i += 3) { mx += c[i]; my += c[i + 1]; mz += c[i + 2]; }
    mx /= n; my /= n; mz /= n;
    return wheels.some((w) => Math.hypot(mx - w.x, my - w.y) < w.r * 1.08 && Math.abs(Math.abs(mz) - Math.abs(w.z)) < w.w * 0.9);
  };
  const minLen = length * 0.004;
  const step = length * 0.0025;
  const prep = (segs) => chainSegments(segs, eps * 4).filter((c) => chainLength(c) > minLen).map((c) => simplifyChain(c, step));

  const silAll = prep(feat.silhouette);
  const creaseAll = prep(concat(feat.crease, feat.boundary));

  // Only keep silhouette strokes on the near half (z >= -small) so the side
  // view does not double up with the far side of the car.
  const nearSide = (c) => {
    let mz = 0;
    for (let i = 2; i < c.length; i += 3) mz += c[i];
    return mz / (c.length / 3) > -0.02 * length;
  };
  const silhouette = silAll.filter((c) => nearSide(c) && !inWheel(c));
  const wheelLines = [...silAll, ...creaseAll].filter((c) => inWheel(c) && nearSide(c));
  const creases = creaseAll.filter((c) => !inWheel(c));
  const contours = creases.filter((c) => chainLength(c) > length * 0.05);
  const details = creases.filter((c) => chainLength(c) <= length * 0.05);

  // Station sections + waterlines on the body shell: the "construction" layer.
  const sections = [];
  const stations = 9;
  for (let i = 1; i < stations; i++) {
    const x = -length / 2 + (length * i) / stations;
    sections.push(...prep(sliceMeshes(body, 0, x)));
  }
  for (const f of [0.38, 0.62]) sections.push(...prep(sliceMeshes(body, 1, height * f)));
  sections.push(...prep(sliceMeshes(body, 2, 0)));

  const frontFirst = (c) => {
    let mx = 0;
    for (let i = 0; i < c.length; i += 3) mx += c[i];
    return mx / (c.length / 3);
  };

  return buildDrawBuffers([
    { chains: silhouette, cat: LINE_CAT.SILHOUETTE, window: [0.04, 0.42], spread: 0.55, maxSegments: budget * 0.2 },
    { chains: wheelLines, cat: LINE_CAT.WHEEL, window: [0.22, 0.6], spread: 0.7, maxSegments: budget * 0.2 },
    { chains: sections, cat: LINE_CAT.SECTION, window: [0.3, 0.72], spread: 0.7, maxSegments: budget * 0.15, sortKey: frontFirst },
    { chains: contours, cat: LINE_CAT.CONTOUR, window: [0.38, 0.86], spread: 0.7, maxSegments: budget * 0.25 },
    { chains: details, cat: LINE_CAT.DETAIL, window: [0.55, 1.0], spread: 0.8, maxSegments: budget * 0.2, sortKey: frontFirst },
  ]);
}
