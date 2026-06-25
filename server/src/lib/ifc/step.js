// ============================================================
// Minimal ISO-10303-21 (STEP / IFC) reader.
// Parses the DATA section into an entity map: id -> { id, type, params }.
// params is a JS array where each value is one of:
//   number | { str } | { ref:id } | { enum } | { keyword } |
//   { type, value } (inline typed value) | Array (aggregate) | null ($)
// Only what the Tekla IFC4 exports in this project use is supported.
// ============================================================

/** Decode IFC string escapes (\X2\..\X0\ UTF-16BE, \X\hh single byte). */
export function decodeIfcString(s) {
  if (s.indexOf('\\') === -1) return s;
  s = s.replace(/\\X2\\([0-9A-Fa-f]+)\\X0\\/g, (_, h) => {
    let out = '';
    for (let k = 0; k + 4 <= h.length; k += 4) out += String.fromCharCode(parseInt(h.substr(k, 4), 16));
    return out;
  });
  s = s.replace(/\\X\\([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  s = s.replace(/\\S\\(.)/g, (_, c) => String.fromCharCode(c.charCodeAt(0) + 128));
  return s;
}

/** Split the DATA body into statements on top-level ';' (string-aware). */
function splitStatements(body) {
  const out = [];
  let buf = '', inStr = false;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (inStr) {
      buf += c;
      if (c === "'") {
        if (body[i + 1] === "'") { buf += "'"; i++; } // escaped quote
        else inStr = false;
      }
      continue;
    }
    if (c === "'") { inStr = true; buf += c; continue; }
    if (c === ';') { if (buf.trim()) out.push(buf); buf = ''; continue; }
    buf += c;
  }
  if (buf.trim()) out.push(buf);
  return out;
}

/** Parse a parameter string (the contents of a (...) ) into a JS array. */
function parseParamList(s) {
  let i = 0;
  const skip = () => { while (i < s.length && /\s/.test(s[i])) i++; };
  function value() {
    skip();
    const c = s[i];
    if (c === '#') {
      let j = i + 1; while (j < s.length && /\d/.test(s[j])) j++;
      const id = Number(s.slice(i + 1, j)); i = j; return { ref: id };
    }
    if (c === "'") {
      let out = ''; i++;
      while (i < s.length) {
        if (s[i] === "'") { if (s[i + 1] === "'") { out += "'"; i += 2; continue; } i++; break; }
        out += s[i++];
      }
      return { str: decodeIfcString(out) };
    }
    if (c === '(') { i++; const arr = []; skip(); if (s[i] === ')') { i++; return arr; }
      while (true) { arr.push(value()); skip(); if (s[i] === ',') { i++; continue; } if (s[i] === ')') { i++; break; } break; }
      return arr;
    }
    if (c === '$') { i++; return null; }
    if (c === '*') { i++; return { derived: true }; }
    if (c === '.') { let j = i + 1; while (j < s.length && s[j] !== '.') j++; const e = s.slice(i + 1, j); i = j + 1; return { enum: e }; }
    if (/[A-Za-z_]/.test(c)) {
      let j = i; while (j < s.length && /[A-Za-z0-9_]/.test(s[j])) j++;
      const word = s.slice(i, j);
      if (s[j] === '(') { i = j; const inner = value(); return { type: word.toUpperCase(), value: inner }; }
      i = j; return { keyword: word };
    }
    let j = i; if (s[j] === '+' || s[j] === '-') j++;
    while (j < s.length && /[0-9.]/.test(s[j])) j++;
    if (s[j] === 'e' || s[j] === 'E') { j++; if (s[j] === '+' || s[j] === '-') j++; while (j < s.length && /[0-9]/.test(s[j])) j++; }
    const num = Number(s.slice(i, j)); i = j; return num;
  }
  const arr = [];
  skip(); if (i >= s.length) return arr;
  while (true) { arr.push(value()); skip(); if (s[i] === ',') { i++; continue; } break; }
  return arr;
}

/** Length unit -> millimetre scale factor. */
function lengthScale(entities) {
  for (const e of entities.values()) {
    if (e.type !== 'IFCSIUNIT') continue;
    const unitType = e.params[1] && e.params[1].enum;
    if (unitType !== 'LENGTHUNIT') continue;
    const prefix = e.params[2] && e.params[2].enum;   // MILLI / CENTI / null
    const name = e.params[3] && e.params[3].enum;      // METRE
    if (name === 'METRE') {
      if (prefix === 'MILLI') return 1;
      if (prefix === 'CENTI') return 10;
      if (!prefix) return 1000;
    }
  }
  return 1; // default: assume already mm
}

/** Parse a full IFC text into { entities:Map, scale }. */
export function parseStep(text) {
  const ds = text.indexOf('DATA;');
  const de = text.indexOf('ENDSEC;', ds === -1 ? 0 : ds);
  const body = text.slice(ds === -1 ? 0 : ds + 5, de === -1 ? text.length : de);
  const entities = new Map();
  for (const st of splitStatements(body)) {
    const m = st.match(/^\s*#(\d+)\s*=\s*([A-Za-z0-9_]+)\s*\(/);
    if (!m) continue;
    const open = st.indexOf('(', m[0].length - 1);
    const close = st.lastIndexOf(')');
    if (open === -1 || close === -1 || close < open) continue;
    const params = parseParamList(st.slice(open + 1, close));
    entities.set(Number(m[1]), { id: Number(m[1]), type: m[2].toUpperCase(), params });
  }
  return { entities, scale: lengthScale(entities) };
}
