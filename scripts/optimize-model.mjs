#!/usr/bin/env node
// Optimise a sourced glTF/GLB car for the web and bake its line art.
//
//   npm run model:optimize -- [--src model-source] [--front=+x|-x|+z|-z]
//                             [--ratio=0.5] [--paint=Mat1,Mat2] [--glass=Mat3]
//                             [--wheels=NodeA,NodeB,...] [--inspect]
//
// Output: public/models/roadster.glb + public/models/manifest.json
//
// Pipeline: dedup → prune → weld → (simplify) → textures → WebP ≤2048 →
// normalise to car space (length on X, nose +X, ground y=0, 4.5 m long) →
// line art (feature edges, side silhouette, section cuts) → meshopt.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { registerHooks } from "node:module";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, EXTTextureWebP } from "@gltf-transform/extensions";
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";
import draco3d from "draco3dgltf";
import { buildCarLineArt } from "../src/lib/lineart.mjs";

// sharp is a native module; some locked-down Windows machines (Application
// Control / Smart App Control) refuse to load it, and glTF-Transform pulls it
// in at import time. If it cannot load, resolve "sharp" to a stub so the rest
// of the pipeline runs and texture re-encoding is simply skipped.
let sharp = null;
try {
  sharp = (await import("sharp")).default;
  await sharp({ create: { width: 1, height: 1, channels: 3, background: "#000" } }).png().toBuffer();
} catch (e) {
  sharp = null;
  console.warn(`⚠ sharp unavailable (${String(e.message ?? e).split("\n")[0]}); textures kept as-is.`);
  const stub = "data:text/javascript,export default function sharp(){throw new Error('sharp unavailable')}";
  registerHooks({
    resolve(specifier, context, next) {
      if (specifier === "sharp") return { url: stub, shortCircuit: true };
      return next(specifier, context);
    },
  });
}
const { dedup, prune, weld, simplify, meshopt, getBounds } = await import("@gltf-transform/functions");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  }),
);
const list = (v) => (typeof v === "string" && v ? v.split(",").map((s) => s.trim()) : []);

const TARGET_LENGTH = 4.5;
const MAX_TRIS = Number(args.maxTris ?? 420000);

function findSource(dir) {
  const hits = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(glb|gltf)$/i.test(e.name)) hits.push(p);
    }
  };
  if (fs.existsSync(dir)) walk(dir);
  return hits.sort((a, b) => (a.endsWith(".glb") ? -1 : 1) - (b.endsWith(".glb") ? -1 : 1))[0];
}

function mat4mul(a, b) {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
}
function apply(m, x, y, z) {
  return [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];
}

function triCount(doc) {
  let n = 0;
  for (const mesh of doc.getRoot().listMeshes()) for (const p of mesh.listPrimitives()) {
    if (p.getMode() !== 4) continue;
    const idx = p.getIndices();
    n += (idx ? idx.getCount() : p.getAttribute("POSITION").getCount()) / 3;
  }
  return Math.round(n);
}

async function main() {
  const srcDir = path.resolve(ROOT, typeof args.src === "string" ? args.src : "model-source");
  const src = findSource(srcDir);
  if (!src) {
    console.error(`No .glb/.gltf found in ${srcDir}`);
    process.exit(1);
  }
  console.log(`▸ source: ${path.relative(ROOT, src)}`);

  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({
      "draco3d.decoder": await draco3d.createDecoderModule(),
      "meshopt.decoder": MeshoptDecoder,
      "meshopt.encoder": MeshoptEncoder,
    });
  await MeshoptDecoder.ready;
  await MeshoptEncoder.ready;
  await MeshoptSimplifier.ready;

  const doc = await io.read(src);
  const root = doc.getRoot();
  const scene = root.getDefaultScene() ?? root.listScenes()[0];

  // ── inspection ──
  console.log(`▸ meshes ${root.listMeshes().length}, materials ${root.listMaterials().length}, textures ${root.listTextures().length}, tris ${triCount(doc).toLocaleString()}`);
  const matArea = new Map();
  for (const mesh of root.listMeshes()) for (const p of mesh.listPrimitives()) {
    const m = p.getMaterial();
    const key = m?.getName() || "(none)";
    const idx = p.getIndices();
    const n = (idx ? idx.getCount() : p.getAttribute("POSITION").getCount()) / 3;
    matArea.set(key, (matArea.get(key) ?? 0) + n);
  }
  if (args.inspect) {
    console.log("\nMaterials (tris · baseColor · alpha):");
    for (const m of root.listMaterials()) {
      const c = m.getBaseColorFactor().map((v) => v.toFixed(2)).join(",");
      console.log(`  ${m.getName().padEnd(36)} ${String(matArea.get(m.getName()) ?? 0).padStart(8)}  [${c}] ${m.getAlphaMode()} ${m.getBaseColorTexture() ? "tex" : ""}`);
    }
    console.log("\nNodes:");
    const walk = (n, d) => {
      const mesh = n.getMesh();
      console.log(`${"  ".repeat(d)}${n.getName() || "(node)"}${mesh ? `  [mesh ${mesh.getName()}]` : ""}`);
      n.listChildren().forEach((c) => walk(c, d + 1));
    };
    scene.listChildren().forEach((n) => walk(n, 1));
  }

  // ── geometry cleanup ──
  await doc.transform(dedup(), prune(), weld());
  const tris = triCount(doc);
  if (tris > MAX_TRIS) {
    const ratio = Number(args.ratio ?? Math.max(0.2, MAX_TRIS / tris));
    console.log(`▸ simplify ${tris.toLocaleString()} → ~${Math.round(tris * ratio).toLocaleString()} (ratio ${ratio.toFixed(2)})`);
    await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.0006, lockBorder: true }));
  }
  if (sharp) {
    // Re-encode textures to WebP ≤ 2048 px. Encoded manually (instead of
    // textureCompress) and copied out of the encoder's memory, because the
    // WebAssembly build of sharp reuses its output buffers.
    const maxSize = Number(args.texture ?? 2048);
    let before = 0, after = 0;
    for (const tex of root.listTextures()) {
      const img = tex.getImage();
      if (!img) continue;
      before += img.byteLength;
      const isNormal = root.listMaterials().some((m) => m.getNormalTexture() === tex);
      const out = await sharp(Buffer.from(img))
        .resize(maxSize, maxSize, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: isNormal ? 92 : 84, nearLossless: isNormal, effort: 4 })
        .toBuffer();
      const copy = new Uint8Array(out.byteLength);
      copy.set(out);
      if (copy[0] !== 0x52 || copy[1] !== 0x49) throw new Error("WebP encode produced an invalid file");
      tex.setImage(copy).setMimeType("image/webp");
      if (tex.getURI()) tex.setURI(tex.getURI().replace(/\.(png|jpe?g)$/i, ".webp"));
      after += copy.byteLength;
    }
    if (root.listTextures().some((t) => t.getMimeType() === "image/webp")) doc.createExtension(EXTTextureWebP).setRequired(true);
    console.log(`▸ textures ${(before / 1048576).toFixed(1)} MB → ${(after / 1048576).toFixed(1)} MB (WebP ≤ ${maxSize}px)`);
  }

  // ── normalise into car space ──
  const b = getBounds(scene);
  const size = [b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]];
  const lengthAxis = size[0] >= size[2] ? "x" : "z";
  const front = typeof args.front === "string" ? args.front : `+${lengthAxis}`;
  const s = TARGET_LENGTH / Math.max(size[0], size[2]);
  // rotation about Y mapping `front` onto +X
  const yaw = { "+x": 0, "-x": Math.PI, "+z": Math.PI / 2, "-z": -Math.PI / 2 }[front];
  if (yaw === undefined) throw new Error(`--front must be one of +x,-x,+z,-z`);
  const cx = (b.min[0] + b.max[0]) / 2, cz = (b.min[2] + b.max[2]) / 2;
  const c = Math.cos(yaw), sn = Math.sin(yaw);
  // M = S · R(yaw) · T(-cx, -minY, -cz)
  const T = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -cx, -b.min[1], -cz, 1];
  const R = [c, 0, -sn, 0, 0, 1, 0, 0, sn, 0, c, 0, 0, 0, 0, 1];
  const S = [s, 0, 0, 0, 0, s, 0, 0, 0, 0, s, 0, 0, 0, 0, 1];
  const M = mat4mul(S, mat4mul(R, T));
  const wrapper = doc.createNode("roadster-root").setMatrix(M);
  for (const child of scene.listChildren()) {
    scene.removeChild(child);
    wrapper.addChild(child);
  }
  scene.addChild(wrapper);
  const nb = getBounds(scene);
  const dims = {
    length: +(nb.max[0] - nb.min[0]).toFixed(4),
    height: +(nb.max[1] - nb.min[1]).toFixed(4),
    width: +(nb.max[2] - nb.min[2]).toFixed(4),
  };
  console.log(`▸ normalised: L ${dims.length} H ${dims.height} W ${dims.width} (front ${front}, scale ${s.toFixed(4)})`);

  // ── material roles ──
  const PAINT = /(paint|body|carpaint|car_paint|exterior|kuzov|lak)/i;
  const GLASS = /(glass|window|windshield|windscreen|steklo)/i;
  let paint = list(args.paint);
  let glass = list(args.glass);
  if (!paint.length) {
    paint = root.listMaterials().map((m) => m.getName()).filter((n) => PAINT.test(n) && !GLASS.test(n));
    if (!paint.length) {
      // largest non-transparent material by triangle count
      const best = [...matArea.entries()].sort((a, b2) => b2[1] - a[1])[0];
      if (best) paint = [best[0]];
    }
  }
  if (!glass.length) glass = root.listMaterials().filter((m) => GLASS.test(m.getName()) || m.getAlphaMode() === "BLEND").map((m) => m.getName());
  console.log(`▸ paint: ${paint.join(", ") || "-"}\n▸ glass: ${glass.join(", ") || "-"}`);

  // ── collect world-space triangles ──
  const meshesAll = [];
  const meshesBody = [];
  const wheelNames = list(args.wheels);
  const wheelBoxes = [];
  const visit = (node, parentM) => {
    const m = mat4mul(parentM, node.getMatrix());
    const mesh = node.getMesh();
    const isWheel = wheelNames.includes(node.getName());
    if (mesh) for (const p of mesh.listPrimitives()) {
      if (p.getMode() !== 4) continue;
      const pa = p.getAttribute("POSITION");
      const n = pa.getCount();
      const pos = new Float32Array(n * 3);
      const el = [0, 0, 0];
      for (let i = 0; i < n; i++) {
        pa.getElement(i, el);
        const w = apply(m, el[0], el[1], el[2]);
        pos[i * 3] = w[0]; pos[i * 3 + 1] = w[1]; pos[i * 3 + 2] = w[2];
      }
      const idx = p.getIndices() ? new Uint32Array(p.getIndices().getArray()) : null;
      const tm = { pos, idx };
      meshesAll.push(tm);
      if (paint.includes(p.getMaterial()?.getName() ?? "")) meshesBody.push(tm);
    }
    if (isWheel) {
      const box = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
      const grow = (nd, pm) => {
        const mm = mat4mul(pm, nd.getMatrix());
        const me = nd.getMesh();
        if (me) for (const p of me.listPrimitives()) {
          const pa = p.getAttribute("POSITION");
          const el = [0, 0, 0];
          for (let i = 0; i < pa.getCount(); i += 7) {
            pa.getElement(i, el);
            const w = apply(mm, el[0], el[1], el[2]);
            for (let k = 0; k < 3; k++) { box.min[k] = Math.min(box.min[k], w[k]); box.max[k] = Math.max(box.max[k], w[k]); }
          }
        }
        nd.listChildren().forEach((ch) => grow(ch, mm));
      };
      grow(node, parentM);
      wheelBoxes.push(box);
    }
    node.listChildren().forEach((ch) => visit(ch, m));
  };
  const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  scene.listChildren().forEach((n) => visit(n, I));

  let wheels = wheelBoxes.map((bx) => ({
    x: (bx.min[0] + bx.max[0]) / 2,
    y: (bx.min[1] + bx.max[1]) / 2,
    z: (bx.min[2] + bx.max[2]) / 2,
    r: (bx.max[1] - bx.min[1]) / 2,
    w: bx.max[2] - bx.min[2],
  }));
  if (!wheels.length) {
    const r = dims.height * 0.31;
    const ax = [dims.length * 0.31, -dims.length * 0.31];
    wheels = ax.flatMap((x) => [1, -1].map((sd) => ({ x, y: r, z: sd * dims.width * 0.4, r, w: dims.width * 0.14 })));
  }
  const axles = [...new Set(wheels.map((w) => +w.x.toFixed(2)))].sort((a, b2) => a - b2);
  const wheelR = wheels.reduce((m, w) => Math.max(m, w.r), 0);
  console.log(`▸ wheels: ${wheels.length}, axles ${axles.join(", ")}, r ${wheelR.toFixed(3)}`);

  // ── line art ──
  console.time("▸ line art");
  const art = buildCarLineArt({
    body: meshesBody.length ? meshesBody : meshesAll,
    all: meshesAll,
    wheels,
    length: dims.length,
    height: dims.height,
    creaseAngle: Number(args.crease ?? 38),
    budget: Number(args.budget ?? 110000),
  });
  console.timeEnd("▸ line art");
  console.log(`▸ line segments: ${(art.position.length / 6).toLocaleString()}`);

  const buffer = root.listBuffers()[0] ?? doc.createBuffer();
  const lpos = doc.createAccessor("lineart_pos").setType("VEC3").setArray(art.position).setBuffer(buffer);
  const ldraw = doc.createAccessor("lineart_draw").setType("SCALAR").setArray(art.draw).setBuffer(buffer);
  // categories stored as cat/8 so every generic attribute lives in [0, 1] and survives quantisation
  const lcat = doc.createAccessor("lineart_cat").setType("SCALAR").setArray(art.cat.map((v) => v / 8)).setBuffer(buffer);
  const prim = doc.createPrimitive().setMode(1).setAttribute("POSITION", lpos).setAttribute("_DRAW", ldraw).setAttribute("_CAT", lcat);
  const lmesh = doc.createMesh("lineart").addPrimitive(prim);
  scene.addChild(doc.createNode("lineart").setMesh(lmesh));

  // ── compress + write ──
  await doc.transform(meshopt({ encoder: MeshoptEncoder, level: "medium" }));
  const outDir = path.join(ROOT, "public", "models");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, "roadster.glb");
  await io.write(outFile, doc);
  const manifest = {
    model: "/models/roadster.glb",
    dims: { ...dims, axles, wheelR: +wheelR.toFixed(4) },
    materials: { paint, glass },
    wheelNodes: wheelNames,
    source: { file: path.basename(src), front, scale: s },
  };
  fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(`✓ wrote ${path.relative(ROOT, outFile)} (${(fs.statSync(outFile).size / 1048576).toFixed(2)} MB) + manifest.json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
