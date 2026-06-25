// ============================================================
// IFC geometry kernel — builds world-space triangle soup (mm) for an
// element from IfcExtrudedAreaSolid + IfcPolygonalFaceSet bodies and
// the IfcLocalPlacement / IfcAxis2Placement3D transform chain.
// Output per element: flat Float array [x,y,z, x,y,z, ...] (9 per triangle).
// ============================================================

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function norm(a) { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }

const IDENT = { o: [0, 0, 0], x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };
const tPoint = (f, p) => add(f.o, add(mul(f.x, p[0]), add(mul(f.y, p[1]), mul(f.z, p[2]))));
const tDir = (f, v) => add(mul(f.x, v[0]), add(mul(f.y, v[1]), mul(f.z, v[2])));
function compose(parent, child) {
  return { o: tPoint(parent, child.o), x: tDir(parent, child.x), y: tDir(parent, child.y), z: tDir(parent, child.z) };
}

export function makeKernel(entities, scale) {
  const E = (ref) => (ref && ref.ref != null ? entities.get(ref.ref) : null);
  const point = (ref) => { const e = E(ref); const p = e ? e.params[0] : [0, 0, 0]; return [(p[0] || 0) * scale, (p[1] || 0) * scale, (p[2] || 0) * scale]; };
  const dir = (ref) => { const e = E(ref); if (!e) return [0, 0, 1]; const d = e.params[0]; return [d[0] || 0, d[1] || 0, d[2] || 0]; };

  function axisFrame(ref) {
    const e = E(ref);
    if (!e || e.type !== 'IFCAXIS2PLACEMENT3D') return IDENT;
    const o = point(e.params[0]);
    const z = e.params[1] ? norm(dir(e.params[1])) : [0, 0, 1];
    let rx = e.params[2] ? dir(e.params[2]) : [1, 0, 0];
    let x = norm(sub(rx, mul(z, dot(z, rx))));
    if (!isFinite(x[0]) || Math.hypot(x[0], x[1], x[2]) < 1e-6) x = Math.abs(z[0]) < 0.9 ? norm(cross([1, 0, 0], z)) : norm(cross([0, 1, 0], z));
    const y = cross(z, x);
    return { o, x, y, z };
  }

  function placement(ref) {
    const e = E(ref);
    if (!e) return IDENT;
    if (e.type === 'IFCLOCALPLACEMENT') {
      const parent = e.params[0] ? placement(e.params[0]) : IDENT;
      const child = axisFrame(e.params[1]);
      return compose(parent, child);
    }
    if (e.type === 'IFCAXIS2PLACEMENT3D') return axisFrame(ref);
    return IDENT;
  }

  // ---- 2D profile (IfcArbitraryClosedProfileDef -> polygon) ----
  function profile(ref) {
    const e = E(ref);
    if (!e) return [];
    if (e.type === 'IFCARBITRARYCLOSEDPROFILEDEF' || e.type === 'IFCARBITRARYPROFILEDEFWITHVOIDS') {
      const curve = E(e.params[2]);
      if (!curve) return [];
      if (curve.type === 'IFCINDEXEDPOLYCURVE') {
        const ptsEnt = E(curve.params[0]);
        const pts = (ptsEnt ? ptsEnt.params[0] : []).map(p => [(p[0] || 0) * scale, (p[1] || 0) * scale]);
        const segs = curve.params[1];
        if (Array.isArray(segs) && segs.length) {
          // Each segment is an IfcLineIndex or IfcArcIndex (1-based indices).
          // Consecutive segments share an endpoint; arcs carry a mid point.
          const idx = [];
          for (const s of segs) {
            let arr = s && s.value ? s.value[0] : (Array.isArray(s) ? s : null);
            if (!arr || !arr.length) continue;
            if (s && s.type === 'IFCARCINDEX' && arr.length >= 3) arr = [arr[0], arr[arr.length - 1]]; // arc -> chord
            for (const k of arr) { if (idx.length && idx[idx.length - 1] === k) continue; idx.push(k); }
          }
          if (idx.length > 1 && idx[0] === idx[idx.length - 1]) idx.pop();
          const loop = idx.map(k => pts[k - 1]).filter(Boolean);
          return dedupeClose(loop);
        }
        return dedupeClose(pts);
      }
      if (curve.type === 'IFCPOLYLINE') {
        const loop = curve.params[0].map(r => { const p = E(r).params[0]; return [(p[0] || 0) * scale, (p[1] || 0) * scale]; });
        return dedupeClose(loop);
      }
    }
    if (e.type === 'IFCRECTANGLEPROFILEDEF') {
      const xd = (e.params[3] || 0) * scale / 2, yd = (e.params[4] || 0) * scale / 2;
      return [[-xd, -yd], [xd, -yd], [xd, yd], [-xd, yd]];
    }
    return [];
  }
  function dedupeClose(loop) {
    if (loop.length > 1) { const a = loop[0], b = loop[loop.length - 1]; if (Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6) loop = loop.slice(0, -1); }
    return loop;
  }

  // ---- builders return triangles in element-local space ----
  function extruded(solid, tris) {
    const prof = profile(solid.params[0]);
    if (prof.length < 3) return;
    const pos = axisFrame(solid.params[1]);
    const d = dir(solid.params[2]);
    const depth = (solid.params[3] || 0) * scale;
    const ext = mul(d, depth);
    const base = prof.map(p => tPoint(pos, [p[0], p[1], 0]));
    const top = prof.map(p => tPoint(pos, add([p[0], p[1], 0], ext)));
    const n = prof.length;
    // side walls
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      pushTri(tris, base[i], base[j], top[j]);
      pushTri(tris, base[i], top[j], top[i]);
    }
    // caps (fan; profiles here are convex)
    for (let i = 1; i < n - 1; i++) {
      pushTri(tris, base[0], base[i + 1], base[i]);
      pushTri(tris, top[0], top[i], top[i + 1]);
    }
  }

  function faceSet(fs, tris) {
    const coordsEnt = E(fs.params[0]);
    const coords = (coordsEnt ? coordsEnt.params[0] : []).map(p => [(p[0] || 0) * scale, (p[1] || 0) * scale, (p[2] || 0) * scale]);
    const pn = Array.isArray(fs.params[3]) ? fs.params[3] : null;
    const faces = fs.params[2] || [];
    for (const fref of faces) {
      const fe = E(fref);
      if (!fe) continue;
      const idxList = fe.params[0];
      if (!Array.isArray(idxList)) continue;
      const verts = idxList.map(k => coords[(pn ? pn[k - 1] : k) - 1]).filter(Boolean);
      for (let i = 1; i < verts.length - 1; i++) pushTri(tris, verts[0], verts[i], verts[i + 1]);
    }
  }

  // ---- element body triangles in world space ----
  function elementTriangles(element) {
    const rep = E(element.params[6]);
    if (!rep || !rep.params[2]) return [];
    const tris = [];
    const frame = placement(element.params[5]);
    for (const srRef of rep.params[2]) {
      const sr = E(srRef);
      if (!sr || sr.type !== 'IFCSHAPEREPRESENTATION') continue;
      const ident = sr.params[1] && sr.params[1].str;
      if (ident && ident !== 'Body') continue;          // only solid body geometry
      for (const itRef of (sr.params[3] || [])) {
        const it = E(itRef);
        if (!it) continue;
        if (it.type === 'IFCEXTRUDEDAREASOLID') extruded(it, tris);
        else if (it.type === 'IFCPOLYGONALFACESET') faceSet(it, tris);
        else if (it.type === 'IFCFACETEDBREP') facetedBrep(it, tris);
      }
    }
    // apply element placement -> world
    const out = new Array(tris.length);
    for (let i = 0; i < tris.length; i += 3) {
      const w = tPoint(frame, [tris[i], tris[i + 1], tris[i + 2]]);
      out[i] = w[0]; out[i + 1] = w[1]; out[i + 2] = w[2];
    }
    return out;
  }

  function facetedBrep(brep, tris) {
    const shell = E(brep.params[0]);
    if (!shell) return;
    for (const fref of (shell.params[0] || [])) {
      const face = E(fref); if (!face) continue;
      for (const bref of (face.params[0] || [])) {
        const bound = E(bref); if (!bound) continue;
        const loopRef = bound.params[0]; const loop = E(loopRef); if (!loop) continue;
        const verts = (loop.params[0] || []).map(r => point(r));
        for (let i = 1; i < verts.length - 1; i++) pushTri(tris, verts[0], verts[i], verts[i + 1]);
      }
    }
  }

  return { elementTriangles, placement };
}

function pushTri(arr, a, b, c) { arr.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]); }

/** Axis-aligned bbox of a flat vertex array -> { min, max, span }. */
export function bbox(verts) {
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < verts.length; i += 3) for (let k = 0; k < 3; k++) {
    const v = verts[i + k]; if (v < mn[k]) mn[k] = v; if (v > mx[k]) mx[k] = v;
  }
  if (!isFinite(mn[0])) return { min: [0, 0, 0], max: [0, 0, 0], span: [0, 0, 0] };
  return { min: mn, max: mx, span: [mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]] };
}

/** Translate a flat vertex array in place by -offset. */
export function recenter(verts, offset) {
  for (let i = 0; i < verts.length; i += 3) { verts[i] -= offset[0]; verts[i + 1] -= offset[1]; verts[i + 2] -= offset[2]; }
  return verts;
}
