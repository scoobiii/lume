/**
 * @file raidPersistence.ts
 * @responsibility Motor de persistência SQLite RAID-1 espelhado (Mirror A + Mirror B) em node:sqlite com verificação SHA-256, auto-cura e replicação com Firebase na ausência de API key.
 * @version 1.0.0
 * @date 2026-11-15
 * @directory /server/raidPersistence.ts
 * @signature PO Zeh Sobrinho & Senior Agile DevOps Team (AI Framework)
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type {
  DataCenterTier,
  EvidenceSourceType,
  PersistedAuditSummary,
  RaidStatusSummary,
} from '../src/types/audit';

interface StoredAuditRow {
  audit_id: string;
  source_type: string;
  title: string;
  supplied_by: string;
  supplied_date: string;
  source_name: string;
  source_url: string;
  content_sha256: string;
  tier_level: string;
  overall_status: string;
  loose_wire_percent: number;
  exposed_copper_percent: number;
  objects_count: number;
  vuc_execution_id: string;
  vuc_proof_hash: string;
  vuc_verified: number;
  patch_version: string | null;
  summary_note: string | null;
  payload_json: string;
  row_checksum: string;
  firebase_synced: number;
  created_at: string;
  updated_at: string;
}

const MIRROR_A_DIR = process.env.RAID_DISK_A_DIR || path.join(process.cwd(), 'data', 'raid_mirror_a');
const MIRROR_B_DIR = process.env.RAID_DISK_B_DIR || path.join(process.cwd(), 'data', 'raid_mirror_b');
const MIRROR_A_PATH = path.join(MIRROR_A_DIR, 'evidencia_audit.sqlite');
const MIRROR_B_PATH = path.join(MIRROR_B_DIR, 'evidencia_audit.sqlite');

function computeRowChecksum(payloadJson: string, auditId: string, updatedAt: string): string {
  return crypto
    .createHash('sha256')
    .update(`${auditId}|${updatedAt}|${payloadJson}`)
    .digest('hex');
}

function initSchema(db: DatabaseSync) {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = FULL;
    CREATE TABLE IF NOT EXISTS evidence_audits (
      audit_id TEXT PRIMARY KEY,
      source_type TEXT NOT NULL,
      title TEXT NOT NULL,
      supplied_by TEXT NOT NULL,
      supplied_date TEXT NOT NULL,
      source_name TEXT NOT NULL,
      source_url TEXT NOT NULL,
      content_sha256 TEXT NOT NULL,
      tier_level TEXT NOT NULL,
      overall_status TEXT NOT NULL,
      loose_wire_percent REAL NOT NULL DEFAULT 0,
      exposed_copper_percent REAL NOT NULL DEFAULT 0,
      objects_count INTEGER NOT NULL DEFAULT 0,
      vuc_execution_id TEXT NOT NULL,
      vuc_proof_hash TEXT NOT NULL,
      vuc_verified INTEGER NOT NULL DEFAULT 0,
      patch_version TEXT,
      summary_note TEXT,
      payload_json TEXT NOT NULL,
      row_checksum TEXT NOT NULL,
      firebase_synced INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
}

let dbA: DatabaseSync | null = null;
let dbB: DatabaseSync | null = null;
let totalHealed = 0;

function openMirror(filePath: string): DatabaseSync | null {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const db = new DatabaseSync(filePath);
    initSchema(db);
    return db;
  } catch (err) {
    console.error(`[RAID] Falha ao abrir espelho ${filePath}:`, err);
    return null;
  }
}

function ensureMirrors() {
  if (!dbA) dbA = openMirror(MIRROR_A_PATH);
  if (!dbB) dbB = openMirror(MIRROR_B_PATH);
}

function isRowIntact(row: StoredAuditRow | undefined): row is StoredAuditRow {
  if (!row) return false;
  const expected = computeRowChecksum(row.payload_json, row.audit_id, row.updated_at);
  return expected === row.row_checksum;
}

function upsertRow(db: DatabaseSync, row: StoredAuditRow) {
  const stmt = db.prepare(`
    INSERT INTO evidence_audits (
      audit_id, source_type, title, supplied_by, supplied_date, source_name,
      source_url, content_sha256, tier_level, overall_status,
      loose_wire_percent, exposed_copper_percent, objects_count,
      vuc_execution_id, vuc_proof_hash, vuc_verified, patch_version,
      summary_note, payload_json, row_checksum, firebase_synced,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(audit_id) DO UPDATE SET
      source_type = excluded.source_type,
      title = excluded.title,
      supplied_by = excluded.supplied_by,
      supplied_date = excluded.supplied_date,
      source_name = excluded.source_name,
      source_url = excluded.source_url,
      content_sha256 = excluded.content_sha256,
      tier_level = excluded.tier_level,
      overall_status = excluded.overall_status,
      loose_wire_percent = excluded.loose_wire_percent,
      exposed_copper_percent = excluded.exposed_copper_percent,
      objects_count = excluded.objects_count,
      vuc_execution_id = excluded.vuc_execution_id,
      vuc_proof_hash = excluded.vuc_proof_hash,
      vuc_verified = excluded.vuc_verified,
      patch_version = excluded.patch_version,
      summary_note = excluded.summary_note,
      payload_json = excluded.payload_json,
      row_checksum = excluded.row_checksum,
      firebase_synced = excluded.firebase_synced,
      updated_at = excluded.updated_at
  `);
  stmt.run(
    row.audit_id,
    row.source_type,
    row.title,
    row.supplied_by,
    row.supplied_date,
    row.source_name,
    row.source_url,
    row.content_sha256,
    row.tier_level,
    row.overall_status,
    row.loose_wire_percent,
    row.exposed_copper_percent,
    row.objects_count,
    row.vuc_execution_id,
    row.vuc_proof_hash,
    row.vuc_verified,
    row.patch_version,
    row.summary_note,
    row.payload_json,
    row.row_checksum,
    row.firebase_synced,
    row.created_at,
    row.updated_at
  );
}

export interface SaveAuditInput {
  auditId: string;
  sourceType: EvidenceSourceType;
  title: string;
  suppliedBy: string;
  suppliedDate: string;
  sourceName: string;
  sourceUrl: string;
  contentSha256: string;
  tierLevel: DataCenterTier;
  overallStatus: 'NON_COMPLIANT' | 'PARTIAL' | 'COMPLIANT';
  looseWireAreaPercent?: number;
  exposedCopperAreaPercent?: number;
  objectsCount?: number;
  vucExecutionId?: string;
  vucProofHash?: string;
  vucVerified?: boolean;
  patchVersion?: string;
  summaryNote?: string;
  payload: Record<string, unknown>;
  firebaseSynced?: boolean;
}

export function saveAuditToRaid(input: SaveAuditInput): {
  writtenA: boolean;
  writtenB: boolean;
  rowChecksum: string;
} {
  ensureMirrors();
  const now = new Date().toISOString();
  const payloadJson = JSON.stringify(input.payload);
  const rowChecksum = computeRowChecksum(payloadJson, input.auditId, now);

  const row: StoredAuditRow = {
    audit_id: input.auditId,
    source_type: input.sourceType,
    title: input.title,
    supplied_by: input.suppliedBy,
    supplied_date: input.suppliedDate,
    source_name: input.sourceName,
    source_url: input.sourceUrl,
    content_sha256: input.contentSha256,
    tier_level: input.tierLevel,
    overall_status: input.overallStatus,
    loose_wire_percent: Number(input.looseWireAreaPercent ?? 0),
    exposed_copper_percent: Number(input.exposedCopperAreaPercent ?? 0),
    objects_count: Math.round(input.objectsCount ?? 0),
    vuc_execution_id: input.vucExecutionId ?? `exec-${input.auditId}`,
    vuc_proof_hash: input.vucProofHash ?? `sha256:${rowChecksum}`,
    vuc_verified: input.vucVerified ? 1 : 0,
    patch_version: input.patchVersion ?? null,
    summary_note: input.summaryNote ?? null,
    payload_json: payloadJson,
    row_checksum: rowChecksum,
    firebase_synced: input.firebaseSynced ? 1 : 0,
    created_at: now,
    updated_at: now,
  };

  let writtenA = false;
  let writtenB = false;

  if (dbA) {
    try {
      upsertRow(dbA, row);
      writtenA = true;
    } catch (err) {
      console.error('[RAID-A] Erro ao gravar:', err);
    }
  }
  if (dbB) {
    try {
      upsertRow(dbB, row);
      writtenB = true;
    } catch (err) {
      console.error('[RAID-B] Erro ao gravar:', err);
    }
  }

  return { writtenA, writtenB, rowChecksum };
}

export function listRaidAudits(): PersistedAuditSummary[] {
  ensureMirrors();
  const mapA = new Map<string, StoredAuditRow>();
  const mapB = new Map<string, StoredAuditRow>();

  if (dbA) {
    const rowsA = dbA.prepare('SELECT * FROM evidence_audits ORDER BY updated_at DESC').all() as unknown as StoredAuditRow[];
    for (const r of rowsA) mapA.set(r.audit_id, r);
  }
  if (dbB) {
    const rowsB = dbB.prepare('SELECT * FROM evidence_audits ORDER BY updated_at DESC').all() as unknown as StoredAuditRow[];
    for (const r of rowsB) mapB.set(r.audit_id, r);
  }

  const allIds = new Set([...mapA.keys(), ...mapB.keys()]);
  const merged: StoredAuditRow[] = [];

  for (const id of allIds) {
    const a = mapA.get(id);
    const b = mapB.get(id);
    const aOk = isRowIntact(a);
    const bOk = isRowIntact(b);

    if (aOk && !bOk && dbB) {
      upsertRow(dbB, a);
      totalHealed++;
      merged.push(a);
    } else if (bOk && !aOk && dbA) {
      upsertRow(dbA, b);
      totalHealed++;
      merged.push(b);
    } else if (aOk && bOk) {
      merged.push(a.updated_at >= b.updated_at ? a : b);
    } else if (a) {
      merged.push(a);
    } else if (b) {
      merged.push(b);
    }
  }

  merged.sort((x, y) => y.updated_at.localeCompare(x.updated_at));

  return merged.map((r) => ({
    auditId: r.audit_id,
    ownerId: 'sqlite-raid1-local',
    sourceType: r.source_type as EvidenceSourceType,
    imageLabel: r.title,
    suppliedBy: r.supplied_by,
    suppliedDate: r.supplied_date,
    sourceName: r.source_name,
    sourceUrl: r.source_url,
    imageSha256: r.content_sha256,
    tierLevel: r.tier_level as DataCenterTier,
    overallStatus: r.overall_status as 'NON_COMPLIANT' | 'PARTIAL' | 'COMPLIANT',
    looseWireAreaPercent: r.loose_wire_percent,
    exposedCopperAreaPercent: r.exposed_copper_percent,
    objectsCount: r.objects_count,
    vucExecutionId: r.vuc_execution_id,
    vucProofHash: r.vuc_proof_hash,
    vucVerified: r.vuc_verified === 1,
    patchVersion: r.patch_version ?? undefined,
    summaryNote: r.summary_note ?? undefined,
    storageOrigin: r.firebase_synced === 1 ? 'both' : 'sqlite_raid',
    createdAt: r.created_at,
  }));
}

export function getRaidAuditPayload(auditId: string): Record<string, unknown> | null {
  ensureMirrors();
  const a = dbA
    ? (dbA.prepare('SELECT * FROM evidence_audits WHERE audit_id = ?').get(auditId) as StoredAuditRow | undefined)
    : undefined;
  const b = dbB
    ? (dbB.prepare('SELECT * FROM evidence_audits WHERE audit_id = ?').get(auditId) as StoredAuditRow | undefined)
    : undefined;

  const chosen = isRowIntact(a) ? a : isRowIntact(b) ? b : a ?? b;
  if (!chosen) return null;

  if (chosen === b && !isRowIntact(a) && dbA) {
    upsertRow(dbA, b);
    totalHealed++;
  } else if (chosen === a && !isRowIntact(b) && dbB) {
    upsertRow(dbB, a);
    totalHealed++;
  }

  try {
    return JSON.parse(chosen.payload_json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function markAuditFirebaseSynced(auditId: string): boolean {
  ensureMirrors();
  let updated = false;
  if (dbA) {
    const info = dbA.prepare('UPDATE evidence_audits SET firebase_synced = 1 WHERE audit_id = ?').run(auditId);
    if (info.changes > 0) updated = true;
  }
  if (dbB) {
    const info = dbB.prepare('UPDATE evidence_audits SET firebase_synced = 1 WHERE audit_id = ?').run(auditId);
    if (info.changes > 0) updated = true;
  }
  return updated;
}

export function deleteRaidAudit(auditId: string): void {
  ensureMirrors();
  dbA?.prepare('DELETE FROM evidence_audits WHERE audit_id = ?').run(auditId);
  dbB?.prepare('DELETE FROM evidence_audits WHERE audit_id = ?').run(auditId);
}

export function getRaidStatus(firebaseActive: boolean): RaidStatusSummary {
  ensureMirrors();
  let countA = 0;
  let countB = 0;
  if (dbA) {
    const row = dbA.prepare('SELECT COUNT(*) AS cnt FROM evidence_audits').get() as { cnt: number };
    countA = row?.cnt ?? 0;
  }
  if (dbB) {
    const row = dbB.prepare('SELECT COUNT(*) AS cnt FROM evidence_audits').get() as { cnt: number };
    countB = row?.cnt ?? 0;
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  const hasGeminiApiKey = Boolean(
    geminiKey && geminiKey.trim() !== '' && geminiKey !== 'MY_GEMINI_API_KEY'
  );

  return {
    raidMode: firebaseActive ? 'SQLITE_RAID1_PLUS_FIREBASE' : 'SQLITE_RAID1_LOCAL',
    mirrorAHealthy: Boolean(dbA),
    mirrorBHealthy: Boolean(dbB),
    mirrorAPath: MIRROR_A_PATH,
    mirrorBPath: MIRROR_B_PATH,
    recordsMirrorA: countA,
    recordsMirrorB: countB,
    healedCount: totalHealed,
    hasGeminiApiKey,
    firebaseConfigured: fs.existsSync(path.join(process.cwd(), 'firebase-applet-config.json')),
  };
}
