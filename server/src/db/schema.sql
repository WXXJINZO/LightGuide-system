-- LightGuide — on-site steel-assembly laser projection system
-- SQLite schema. foreign_keys = ON, WAL (set on the connection).
--
-- Domain model (V4, 5-step on-site workflow):
--   projects 1───∞ component_files            (office-prepared cloud project → many 构件文件)
--   component_files 1───∞ parts               (构件材料清单 / BOM rows: primary + secondary)
--   component_files 1───∞ secondary_parts     (次零件: stiffeners etc. with face/position/geometry)
--   component_files 1───∞ target_points       (12 编码靶标点 per H-beam, V3 §11.1)
--   projects 1───∞ sessions                   (a worker opening a project = one on-site session)
--   sessions 1───∞ slots                      (fixed 6 工位; binding + pose + check + projection state)
--   sessions 1───∞ face_progress              (per-slot per-face assembly completion log)

PRAGMA foreign_keys = ON;

-- ── 工程 / Project ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projects (
  id                  INTEGER PRIMARY KEY,
  name                TEXT    NOT NULL,            -- 工程名称
  code                TEXT    NOT NULL,            -- 工程编号 / 批次号  e.g. A-001
  total_components    INTEGER NOT NULL DEFAULT 0,  -- 构件总数
  prepared_components INTEGER NOT NULL DEFAULT 0,  -- 已准备构件数量
  prepared_by         TEXT    NOT NULL DEFAULT '', -- 编制人
  prepared_at         TEXT    NOT NULL DEFAULT '', -- 编制时间 (ISO date)
  status              TEXT    NOT NULL DEFAULT 'available'
                      CHECK (status IN ('available','pending','expired')),
  created_at          TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ── 构件文件 / Component (projection programming) file ─────────────────────────
CREATE TABLE IF NOT EXISTS component_files (
  id                 INTEGER PRIMARY KEY,
  project_id         INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  mark               TEXT    NOT NULL,             -- 构件编号  e.g. GZ-101
  spec               TEXT    NOT NULL DEFAULT '',  -- H-beam section spec  e.g. H400×200×8×13
  length_mm          REAL    NOT NULL DEFAULT 0,   -- 构件长度 (mm)
  ifc_name           TEXT    NOT NULL DEFAULT '',  -- source IFC/STEP/STP filename
  kind               TEXT    NOT NULL DEFAULT 'beam', -- 柱/梁/支撑 column|beam|brace (V3 §13)
  total_weight       REAL    NOT NULL DEFAULT 0,   -- 装配总重 (kg)
  -- H-beam cross-section + length for the CAD viewer to build geometry:
  --   { h, b, tw, tf, length }  (mm)
  hbeam_json         TEXT    NOT NULL DEFAULT '{}',
  -- Deterministic per-beam geometric deviation used by the registration step (mm),
  -- plus an out-of-tolerance demo value (V3 §13 dev · devAlarm).
  nominal_deviation  REAL    NOT NULL DEFAULT 0,
  dev_alarm          REAL    NOT NULL DEFAULT 0,
  source_format      TEXT    NOT NULL DEFAULT 'synthetic', -- ifc|step|synthetic (provenance)
  sort_order         INTEGER NOT NULL DEFAULT 0,
  created_at         TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_component_files_project ON component_files(project_id);

-- ── 构件材料清单 / Bill of Materials rows ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS parts (
  id           INTEGER PRIMARY KEY,
  component_id INTEGER NOT NULL REFERENCES component_files(id) ON DELETE CASCADE,
  part_id      TEXT    NOT NULL,                 -- PART ID  e.g. AM25, PL10-1
  spec         TEXT    NOT NULL DEFAULT '',      -- SPECIFICATION  e.g. HN800×300×14×26 / PL14
  length_mm    REAL    NOT NULL DEFAULT 0,       -- LENGTH (mm)
  material     TEXT    NOT NULL DEFAULT '',      -- MATERIAL  e.g. Q355C
  unit_kg      REAL    NOT NULL DEFAULT 0,       -- UNIT KG
  qty          INTEGER NOT NULL DEFAULT 1,       -- QTY
  is_primary   INTEGER NOT NULL DEFAULT 0,       -- PRIMARY tag (主零件)
  sort_order   INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_parts_component ON parts(component_id);

-- ── 次零件 / Secondary parts (projection targets) ──────────────────────────────
CREATE TABLE IF NOT EXISTS secondary_parts (
  id           INTEGER PRIMARY KEY,
  component_id INTEGER NOT NULL REFERENCES component_files(id) ON DELETE CASCADE,
  number       TEXT    NOT NULL,                 -- 次零件编号  e.g. PL10-1
  type         TEXT    NOT NULL DEFAULT 'stiffener'
               CHECK (type IN ('stiffener','connection_plate','diaphragm','other')),
  face         TEXT    NOT NULL DEFAULT 'top_flange'
               CHECK (face IN ('top_flange','bottom_flange','left_web','right_web')),
  position_mm  REAL    NOT NULL DEFAULT 0,        -- 近端位置 / near: X station nearest X=0 (mm)
  -- part dimensions (V3 §13): { w, h, t } = width × height × thickness (mm).
  -- The green footprint = w (across, centred in flange width) × t (along length);
  -- the thumbnail profile = w × h with the long edge scaled to ⅔ flange-face width.
  size_json    TEXT    NOT NULL DEFAULT '{}',
  -- hole pattern grid for the thumbnail (V3 §13): { rows, cols }  (0 = none).
  hole_json    TEXT    NOT NULL DEFAULT '{}',
  sort_order   INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_secondary_component ON secondary_parts(component_id);

-- ── 编码靶标点 / Coded target points (12 per beam, V3 §11.1) ───────────────────
CREATE TABLE IF NOT EXISTS target_points (
  id           INTEGER PRIMARY KEY,
  component_id INTEGER NOT NULL REFERENCES component_files(id) ON DELETE CASCADE,
  idx          INTEGER NOT NULL,                 -- 0..11 (V3 §11.1 — 12 targets)
  edge         TEXT    NOT NULL                  -- which edge it clamps onto
               CHECK (edge IN ('long_a','long_b','head','tail')),
  station_mm   REAL    NOT NULL DEFAULT 0        -- position along the beam length (mm)
);
CREATE INDEX IF NOT EXISTS idx_targets_component ON target_points(component_id);

-- ── 作业会话 / On-site session (one per project open) ──────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
  id               INTEGER PRIMARY KEY,
  project_id       INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  current_step     INTEGER NOT NULL DEFAULT 1,    -- 1..5 workflow step
  projection_state TEXT    NOT NULL DEFAULT 'idle'
                   CHECK (projection_state IN ('idle','projecting','paused')),
  created_at       TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ── 工位 / Work slot (6 per session) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS slots (
  id                INTEGER PRIMARY KEY,
  session_id        INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  slot_no           INTEGER NOT NULL,             -- 1..6
  component_id      INTEGER REFERENCES component_files(id) ON DELETE SET NULL, -- bound file (nullable)
  -- pose (manual): head/tail direction + current assembly face
  pose_set          INTEGER NOT NULL DEFAULT 0,
  head_tail         TEXT    NOT NULL DEFAULT 'normal'
                    CHECK (head_tail IN ('normal','reversed')),
  assembly_face     TEXT    NOT NULL DEFAULT 'top_flange'
                    CHECK (assembly_face IN ('top_flange','bottom_flange','left_web','right_web')),
  -- edge registration / deviation check
  checked           INTEGER NOT NULL DEFAULT 0,
  max_deviation     REAL    NOT NULL DEFAULT 0,    -- mm
  check_result      TEXT    NOT NULL DEFAULT 'pending'
                    CHECK (check_result IN ('pending','pass','near','out')),
  -- projection lifecycle for this slot's current face
  projection_status TEXT    NOT NULL DEFAULT 'idle'
                    CHECK (projection_status IN ('idle','ready','projecting','paused','completed')),
  UNIQUE(session_id, slot_no)
);
CREATE INDEX IF NOT EXISTS idx_slots_session ON slots(session_id);

-- ── 装配面进度 / Per-slot per-face completion log ──────────────────────────────
CREATE TABLE IF NOT EXISTS face_progress (
  id           INTEGER PRIMARY KEY,
  session_id   INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  slot_no      INTEGER NOT NULL,
  face         TEXT    NOT NULL
               CHECK (face IN ('top_flange','bottom_flange','left_web','right_web')),
  status       TEXT    NOT NULL DEFAULT 'completed'
               CHECK (status IN ('pending','preparing','completed')),
  completed_at TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(session_id, slot_no, face)
);
CREATE INDEX IF NOT EXISTS idx_face_progress_session ON face_progress(session_id);
