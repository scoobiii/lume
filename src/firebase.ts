/**
 * @file firebase.ts
 * @responsibility Inicialização segura do Firebase Auth (Google) e Firestore Persistence com validação de schema e handleFirestoreError.
 * @version 1.0.0
 * @date 2026-11-15
 * @directory /src/firebase.ts
 * @signature PO Zeh Sobrinho & Senior Agile DevOps Team (AI Framework)
 */

import { initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  User,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDocFromServer,
  getFirestore,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import {
  CadNurbsRemediationPackage,
  DataCenterTier,
  DocumentVersionCommit,
  ImageAuditResponse,
  PersistedAuditSummary,
} from './types/audit';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Verifique a configuração do Firebase Firestore.');
    }
  }
}
void testConnection();

export function sanitizeFirestoreId(raw: string): string {
  const clean = raw.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 120);
  return clean || `rec-${Date.now()}`;
}

export async function signInWithGooglePopup(): Promise<User> {
  const cred = await signInWithPopup(auth, googleProvider);
  return cred.user;
}

export async function signOutFirebase(): Promise<void> {
  await signOut(auth);
}

export function observeAuthUser(cb: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, cb);
}

export async function persistVisualAuditToFirestore(
  userId: string,
  audit: ImageAuditResponse,
  patchVersion?: string,
  sourceType: 'image' | 'document' | 'url' | 'repository' = 'image'
): Promise<void> {
  const auditId = sanitizeFirestoreId(audit.auditId);
  const path = `users/${userId}/audits/${auditId}`;
  const prov = audit.provenance;
  const payload: Record<string, unknown> = {
    auditId,
    ownerId: userId,
    sourceType: prov?.sourceType ?? sourceType,
    imageLabel: (audit.imageLabel || 'evidencia').slice(0, 200),
    suppliedBy: (prov?.suppliedBy || 'Não informado').slice(0, 200),
    suppliedDate: (prov?.suppliedDate || new Date().toISOString().slice(0, 10)).slice(0, 40),
    sourceName: (prov?.sourceName || 'Upload Local').slice(0, 200),
    sourceUrl: (prov?.sourceUrl || '').slice(0, 1000),
    imageSha256: (prov?.imageSha256 || 'sha256:pending').slice(0, 120),
    tierLevel: (audit.tierLevel || 'TIER_III') as DataCenterTier,
    overallStatus: audit.overallStatus,
    looseWireAreaPercent: Number(audit.summaryMetrics.looseWireAreaPercent ?? 0),
    exposedCopperAreaPercent: Number(audit.summaryMetrics.exposedCopperAreaPercent ?? 0),
    objectsCount: Math.max(0, Math.round(audit.objects.length)),
    vucExecutionId: (audit.vucProof?.executionId || `exec-${auditId}`).slice(0, 128),
    vucProofHash: (audit.vucProof?.proofHash || 'sha256:local').slice(0, 128),
    vucVerified: Boolean(audit.vucProof?.verified),
    summaryNote: (audit.documentCrossCheck || '').slice(0, 2000),
    createdAt: serverTimestamp(),
  };
  if (patchVersion) {
    payload.patchVersion = patchVersion.slice(0, 32);
  }
  try {
    await setDoc(doc(db, 'users', userId, 'audits', auditId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function persistCommitToFirestore(
  userId: string,
  commit: DocumentVersionCommit,
  tierLevel: DataCenterTier
): Promise<void> {
  const commitId = sanitizeFirestoreId(`${commit.shortHash}-${commit.version}`);
  const path = `users/${userId}/commits/${commitId}`;
  try {
    await setDoc(doc(db, 'users', userId, 'commits', commitId), {
      commitId,
      ownerId: userId,
      version: commit.version.slice(0, 32),
      shortHash: commit.shortHash.slice(0, 32),
      branch: commit.branch.slice(0, 64),
      author: commit.author.slice(0, 160),
      message: commit.message.slice(0, 400),
      tierLevel,
      ncsResolvedCount: commit.ncsResolved.length,
      vucProofHash: (commit.vucProofHash || `sha256:${commit.hash}`).slice(0, 128),
      contentPreview: commit.content.slice(0, 40000),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function persistCadPatchToFirestore(
  userId: string,
  auditIdRaw: string,
  pkg: CadNurbsRemediationPackage
): Promise<void> {
  const auditId = sanitizeFirestoreId(auditIdRaw);
  const patchId = sanitizeFirestoreId(`patch-${auditId}-${pkg.patchVersion}`);
  const path = `users/${userId}/cadPatches/${patchId}`;
  try {
    await setDoc(doc(db, 'users', userId, 'cadPatches', patchId), {
      patchId,
      ownerId: userId,
      auditId,
      version: pkg.patchVersion.slice(0, 32),
      tierLevel: pkg.tierLevel,
      normativeStandards: pkg.normativeStandards.join(' · ').slice(0, 500),
      nurbsControlPointsCount: pkg.nurbsSummary.controlPointsTotal,
      stlTrianglesCount: pkg.binaries.stlTrianglesCount,
      cadSha256: pkg.binaries.cadSha256.slice(0, 128),
      vucProofHash: pkg.vucProof.proofHash.slice(0, 128),
      remediationSvg: pkg.remediationSvg.slice(0, 120000),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeUserAudits(
  userId: string,
  onData: (items: PersistedAuditSummary[]) => void,
  onError?: (err: unknown) => void
): () => void {
  const path = `users/${userId}/audits`;
  const q = query(collection(db, 'users', userId, 'audits'), where('ownerId', '==', userId));
  return onSnapshot(
    q,
    (snapshot) => {
      const rows = snapshot.docs.map((d) => d.data() as PersistedAuditSummary);
      rows.sort((a, b) => {
        const aSec =
          typeof (a.createdAt as { seconds?: number } | undefined)?.seconds === 'number'
            ? (a.createdAt as { seconds: number }).seconds
            : 0;
        const bSec =
          typeof (b.createdAt as { seconds?: number } | undefined)?.seconds === 'number'
            ? (b.createdAt as { seconds: number }).seconds
            : 0;
        if (bSec !== aSec) return bSec - aSec;
        return String(b.suppliedDate || '').localeCompare(String(a.suppliedDate || ''));
      });
      onData(rows);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}
