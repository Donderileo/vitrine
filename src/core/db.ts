import Database from "better-sqlite3";
import path from "node:path";
import { customAlphabet } from "nanoid";
import { config } from "./config";
import type { CostEntry, ProjectInput, ProjectState } from "./types";

const db = new Database(path.join(config.dataDir, "vitrine.db"));
db.pragma("journal_mode = WAL");
db.pragma("busy_timeout = 5000");

// owner_id is already here so adding login later is just filling it in.
db.exec(`
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL DEFAULT 'local',
  name TEXT NOT NULL,
  input TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT '{"scenes":{},"voice":{},"outputs":{}}',
  status TEXT NOT NULL DEFAULT 'queued',  -- queued | running | done | error
  stage TEXT,
  error TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL, ts INTEGER NOT NULL, msg TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS costs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL, ts INTEGER NOT NULL,
  stage TEXT NOT NULL, provider TEXT NOT NULL, usd REAL NOT NULL, note TEXT
);
`);

// Product number shown in the video ("Produto #12") and on the links page.
try { db.exec(`ALTER TABLE projects ADD COLUMN num INTEGER`); } catch { /* already there */ }

export const newId = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 10);

export type ProjectRow = {
  id: string; owner_id: string; name: string; input: ProjectInput; state: ProjectState;
  num: number | null; status: string; stage: string | null; error: string | null; created_at: number; updated_at: number;
};

function parse(r: any): ProjectRow {
  return { ...r, input: JSON.parse(r.input), state: JSON.parse(r.state) };
}

export const projects = {
  create(id: string, input: ProjectInput, ownerId = "local") {
    const now = Date.now();
    db.prepare(`INSERT INTO projects (id, owner_id, name, input, created_at, updated_at, num)
      VALUES (?,?,?,?,?,?,(SELECT COALESCE(MAX(num),0)+1 FROM projects))`)
      .run(id, ownerId, input.name, JSON.stringify(input), now, now);
  },
  get(id: string): ProjectRow | undefined {
    const r = db.prepare(`SELECT * FROM projects WHERE id = ?`).get(id);
    return r ? parse(r) : undefined;
  },
  list(ownerId = "local"): ProjectRow[] {
    return db.prepare(`SELECT * FROM projects WHERE owner_id = ? ORDER BY created_at DESC`).all(ownerId).map(parse);
  },
  /** Atomically claim the oldest queued project (safe with several workers). */
  claimNext(): ProjectRow | undefined {
    const tx = db.transaction(() => {
      const r: any = db.prepare(`SELECT id FROM projects WHERE status = 'queued' ORDER BY created_at LIMIT 1`).get();
      if (!r) return undefined;
      db.prepare(`UPDATE projects SET status='running', error=NULL, updated_at=? WHERE id=?`).run(Date.now(), r.id);
      return r.id as string;
    });
    const id = tx();
    return id ? this.get(id) : undefined;
  },
  saveState(id: string, state: ProjectState) {
    db.prepare(`UPDATE projects SET state=?, updated_at=? WHERE id=?`).run(JSON.stringify(state), Date.now(), id);
  },
  setStatus(id: string, status: string, extra: { stage?: string | null; error?: string | null } = {}) {
    db.prepare(`UPDATE projects SET status=?, stage=COALESCE(?, stage), error=?, updated_at=? WHERE id=?`)
      .run(status, extra.stage ?? null, extra.error ?? null, Date.now(), id);
  },
  setStage(id: string, stage: string) {
    db.prepare(`UPDATE projects SET stage=?, updated_at=? WHERE id=?`).run(stage, Date.now(), id);
  },
  /** Re-queue a project. reset=true wipes generated state (pays again for everything). */
  requeue(id: string, reset = false) {
    if (reset) db.prepare(`UPDATE projects SET state='{"scenes":{},"voice":{},"outputs":{}}' WHERE id=?`).run(id);
    db.prepare(`UPDATE projects SET status='queued', error=NULL, updated_at=? WHERE id=?`).run(Date.now(), id);
  },
  /** Save an (optionally edited) script, mark it approved and send the project back to the queue. */
  approveScript(id: string, state: ProjectState) {
    db.prepare(`UPDATE projects SET state=?, status='queued', error=NULL, updated_at=? WHERE id=?`)
      .run(JSON.stringify({ ...state, scriptApproved: true }), Date.now(), id);
  },
  /** Projects stuck in 'running' after a worker crash go back to the queue. */
  recoverStale() {
    return db.prepare(`UPDATE projects SET status='queued' WHERE status='running'`).run().changes;
  },
};

export const logs = {
  add(projectId: string, msg: string) {
    db.prepare(`INSERT INTO logs (project_id, ts, msg) VALUES (?,?,?)`).run(projectId, Date.now(), msg);
  },
  list(projectId: string, limit = 200): { ts: number; msg: string }[] {
    return db.prepare(`SELECT ts, msg FROM logs WHERE project_id=? ORDER BY id DESC LIMIT ?`).all(projectId, limit) as any;
  },
};

export const costs = {
  add(projectId: string, c: CostEntry) {
    db.prepare(`INSERT INTO costs (project_id, ts, stage, provider, usd, note) VALUES (?,?,?,?,?,?)`)
      .run(projectId, Date.now(), c.stage, c.provider, c.usd, c.note ?? null);
  },
  list(projectId: string): { ts: number; stage: string; provider: string; usd: number; note: string | null }[] {
    return db.prepare(`SELECT ts, stage, provider, usd, note FROM costs WHERE project_id=? ORDER BY id`).all(projectId) as any;
  },
  totals(): Record<string, number> {
    const rows = db.prepare(`SELECT project_id, SUM(usd) usd FROM costs GROUP BY project_id`).all() as any[];
    return Object.fromEntries(rows.map((r) => [r.project_id, r.usd]));
  },
  summary(projectId: string): { total: number; byStage: { stage: string; usd: number }[] } {
    const byStage = db.prepare(`SELECT stage, SUM(usd) usd FROM costs WHERE project_id=? GROUP BY stage`).all(projectId) as any[];
    return { total: byStage.reduce((a, r) => a + r.usd, 0), byStage };
  },
};
