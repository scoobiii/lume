/**
 * @file App.tsx
 * @responsibility Orquestrador principal Lume (lume-nc-auditor) com Landing Page inicial, Git pervasivo no menu, Dashboard Recharts, Workspace-on-Demand e persistência SQLite RAID-1 + Firebase.
 * @version 3.1.0
 * @date 2026-11-15
 * @directory /src/App.tsx
 * @signature PO Zeh Sobrinho & Senior Agile DevOps Team (AI Framework)
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { User } from 'firebase/auth';
import { Moon, ShieldCheck, Sun, X } from 'lucide-react';
import { AuditDashboardView } from './components/AuditDashboardView';
import { DocumentAuditView } from './components/DocumentAuditView';
import { EvidenceIntakePanel } from './components/EvidenceIntakePanel';
import { GitVersioningView } from './components/GitVersioningView';
import { HistorySidebar } from './components/HistorySidebar';
import { LandingPageView } from './components/LandingPageView';
import { TopBar } from './components/TopBar';
import { VisionMaskInspector } from './components/VisionMaskInspector';
import {
  observeAuthUser,
  persistCadPatchToFirestore,
  persistCommitToFirestore,
  persistVisualAuditToFirestore,
  signInWithGooglePopup,
  signOutFirebase,
  subscribeUserAudits,
} from './firebase';
import {
  CadNurbsRemediationPackage,
  DataCenterTier,
  DocumentAuditResponse,
  DocumentNC,
  DocumentVersionCommit,
  EvidenceIngestionResult,
  EvidenceSourceType,
  ImageAuditResponse,
  ImageProvenance,
  PersistedAuditSummary,
  RaidStatusSummary,
  VisualAuditHistoryEntry,
  VucProofEnvelope,
  WorkspaceTab,
} from './types/audit';
import { generateGitRepoZip } from './utils/gitBundleExporter';

interface ActiveEvidenceCase {
  auditId: string;
  sourceType: EvidenceSourceType;
  title: string;
  provenance: ImageProvenance;
  tierLevel: DataCenterTier;
  originalText: string;
  documentText: string;
  findings: DocumentNC[];
  auditSummary: string;
  analysisSource: string;
  imageDataUrl: string | null;
  imageAudit: ImageAuditResponse | null;
  cadPatch: CadNurbsRemediationPackage | null;
  commits: DocumentVersionCommit[];
  vucProof: VucProofEnvelope | null;
}

function createDeterministicShortHash(seedText: string): string {
  let hash = 2166136261;
  for (let i = 0; i < seedText.length; i++) {
    hash ^= seedText.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16).padStart(7, '0').slice(0, 7);
}

function sourceTypeBadgeLabel(sourceType: EvidenceSourceType): string {
  switch (sourceType) {
    case 'image':
      return 'Imagem';
    case 'url':
      return 'URL Remota';
    case 'repository':
      return 'Repositório Git';
    default:
      return 'Documento Anexo';
  }
}

function computeCaseOverallStatus(c: ActiveEvidenceCase): 'NON_COMPLIANT' | 'PARTIAL' | 'COMPLIANT' {
  if (c.imageAudit) return c.imageAudit.overallStatus;
  const pending = c.findings.filter((f) => !f.applied);
  if (pending.some((f) => f.severity === 'CRITICAL')) return 'NON_COMPLIANT';
  if (pending.length > 0) return 'PARTIAL';
  return 'COMPLIANT';
}

export default function App() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>(WorkspaceTab.LANDING);
  const [darkMode, setDarkMode] = useState<boolean>(false);
  const [defaultTier, setDefaultTier] = useState<DataCenterTier>('TIER_III');

  const [activeCase, setActiveCase] = useState<ActiveEvidenceCase | null>(null);
  const [isAuditing, setIsAuditing] = useState<boolean>(false);
  const [exportingZip, setExportingZip] = useState<boolean>(false);

  const [raidAudits, setRaidAudits] = useState<PersistedAuditSummary[]>([]);
  const [raidStatus, setRaidStatus] = useState<RaidStatusSummary | null>(null);

  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [firebaseAudits, setFirebaseAudits] = useState<PersistedAuditSummary[]>([]);
  const [authError, setAuthError] = useState<string | null>(null);

  const [visualAuditHistory, setVisualAuditHistory] = useState<VisualAuditHistoryEntry[]>([]);

  const refreshRaidState = useCallback(async (signedIn: boolean) => {
    try {
      const [statusRes, auditsRes] = await Promise.all([
        fetch(`/api/raid/status?firebaseSignedIn=${signedIn ? 'true' : 'false'}`),
        fetch('/api/raid/audits'),
      ]);
      if (statusRes.ok) {
        const statusJson = (await statusRes.json()) as RaidStatusSummary;
        setRaidStatus(statusJson);
      }
      if (auditsRes.ok) {
        const auditsJson = (await auditsRes.json()) as { items?: PersistedAuditSummary[] };
        if (Array.isArray(auditsJson.items)) {
          setRaidAudits(auditsJson.items);
        }
      }
    } catch (err) {
      console.error('Falha ao consultar persistência SQLite RAID-1:', err);
    }
  }, []);

  useEffect(() => {
    const unsub = observeAuthUser((user) => {
      setFirebaseUser(user);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    void refreshRaidState(Boolean(firebaseUser));
  }, [firebaseUser, refreshRaidState]);

  useEffect(() => {
    if (!firebaseUser) {
      setFirebaseAudits([]);
      return;
    }
    const unsub = subscribeUserAudits(
      firebaseUser.uid,
      (rows) => setFirebaseAudits(rows),
      (err) => {
        console.error('Erro ao assinar auditorias no Firestore:', err);
      }
    );
    return () => unsub();
  }, [firebaseUser]);

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [darkMode]);

  const mergedHistoryItems = useMemo<PersistedAuditSummary[]>(() => {
    const byId = new Map<string, PersistedAuditSummary>();
    for (const item of raidAudits) {
      byId.set(item.auditId, item);
    }
    for (const fb of firebaseAudits) {
      const existing = byId.get(fb.auditId);
      if (existing) {
        byId.set(fb.auditId, { ...existing, storageOrigin: 'both' });
      } else {
        byId.set(fb.auditId, { ...fb, storageOrigin: 'firestore' });
      }
    }
    return Array.from(byId.values()).sort((a, b) =>
      String(b.suppliedDate || '').localeCompare(String(a.suppliedDate || ''))
    );
  }, [raidAudits, firebaseAudits]);

  const syncCaseToStorage = useCallback(
    async (targetCase: ActiveEvidenceCase) => {
      const payloadToSave = {
        auditId: targetCase.auditId,
        sourceType: targetCase.sourceType,
        title: targetCase.title,
        provenance: targetCase.provenance,
        tierLevel: targetCase.tierLevel,
        originalText: targetCase.originalText,
        documentText: targetCase.documentText,
        findings: targetCase.findings,
        auditSummary: targetCase.auditSummary,
        analysisSource: targetCase.analysisSource,
        imageBase64DataUrl: targetCase.imageDataUrl ?? undefined,
        imageAudit: targetCase.imageAudit ?? undefined,
        cadPatch: targetCase.cadPatch ?? undefined,
        commits: targetCase.commits,
        vucProof: targetCase.vucProof ?? undefined,
      };

      const overallStatus = computeCaseOverallStatus(targetCase);

      try {
        await fetch('/api/raid/audits', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            auditId: targetCase.auditId,
            sourceType: targetCase.sourceType,
            title: targetCase.title,
            suppliedBy: targetCase.provenance.suppliedBy,
            suppliedDate: targetCase.provenance.suppliedDate,
            sourceName: targetCase.provenance.sourceName,
            sourceUrl: targetCase.provenance.sourceUrl,
            contentSha256: targetCase.provenance.imageSha256 ?? 'sha256:local',
            tierLevel: targetCase.tierLevel,
            overallStatus,
            looseWireAreaPercent: targetCase.imageAudit?.summaryMetrics.looseWireAreaPercent ?? 0,
            exposedCopperAreaPercent:
              targetCase.imageAudit?.summaryMetrics.exposedCopperAreaPercent ?? 0,
            objectsCount:
              targetCase.imageAudit?.objects.length ?? targetCase.findings.length,
            vucExecutionId: targetCase.vucProof?.executionId ?? `exec-${targetCase.auditId}`,
            vucProofHash: targetCase.vucProof?.proofHash ?? 'sha256:local',
            vucVerified: Boolean(targetCase.vucProof?.verified),
            patchVersion: targetCase.cadPatch?.patchVersion,
            summaryNote: targetCase.auditSummary,
            payload: payloadToSave,
            firebaseSynced: Boolean(firebaseUser),
          }),
        });
      } catch (err) {
        console.error('Falha ao atualizar caso no SQLite RAID-1:', err);
      }

      if (firebaseUser) {
        try {
          const auditEnvelope: ImageAuditResponse = targetCase.imageAudit ?? {
            auditId: targetCase.auditId,
            timestamp: new Date().toISOString(),
            imageLabel: targetCase.title,
            provenance: targetCase.provenance,
            tierLevel: targetCase.tierLevel,
            imageDimensions: { width: 0, height: 0, analysisWidth: 0, analysisHeight: 0 },
            processingMs: 0,
            figureCodeInContext: null,
            contextAligned: true,
            overallStatus,
            maskOverlayPngDataUrl: '',
            objects: [],
            contextClassification: {
              expectedTopic: targetCase.title,
              detectedPanelType: sourceTypeBadgeLabel(targetCase.sourceType),
              contextAligned: true,
              figureCodeInContext: null,
              alignmentChecklist: [],
              suggestedDocumentFindings: [],
            },
            summaryMetrics: {
              looseWireAreaPercent: 0,
              exposedCopperAreaPercent: 0,
              breakerComponentsCount: 0,
              mimicDiagramCount: 0,
              orthogonalWireRatio: 1,
            },
            documentCrossCheck: targetCase.auditSummary,
            analysisSource: 'deterministic-cv-pixel-engine',
            vucProof: targetCase.vucProof ?? undefined,
          };

          await persistVisualAuditToFirestore(
            firebaseUser.uid,
            auditEnvelope,
            targetCase.cadPatch?.patchVersion,
            targetCase.sourceType
          );
          await fetch(`/api/raid/audits/${encodeURIComponent(targetCase.auditId)}/mark-synced`, {
            method: 'POST',
          });
        } catch (err) {
          console.error('Falha ao espelhar caso no Firestore:', err);
        }
      }

      await refreshRaidState(Boolean(firebaseUser));
    },
    [firebaseUser, refreshRaidState]
  );

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    try {
      await signInWithGooglePopup();
    } catch (err) {
      setAuthError(
        err instanceof Error ? err.message : 'Falha na autenticação Google com Firebase.'
      );
    }
  };

  const handleGoogleSignOut = async () => {
    setAuthError(null);
    try {
      await signOutFirebase();
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Falha ao encerrar sessão.');
    }
  };

  const appendCommitToCase = (
    currentCase: ActiveEvidenceCase,
    nextContent: string,
    resolvedCodes: string[],
    message: string,
    versionLabel: string,
    vucProofHash?: string
  ): DocumentVersionCommit => {
    const shortHash = createDeterministicShortHash(`${nextContent.length}-${Date.now()}`);
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const newCommit: DocumentVersionCommit = {
      hash: `${shortHash}a8f93c1e2d4b5a6c7e8f901234567890abcdef`,
      shortHash,
      version: versionLabel,
      branch: 'main',
      author: firebaseUser?.displayName || firebaseUser?.email || 'PO Zeh Sobrinho & AI Framework',
      date: now,
      message,
      ncsResolved: resolvedCodes,
      content: nextContent,
      vucProofHash: vucProofHash ?? currentCase.vucProof?.proofHash,
      tierLevel: currentCase.tierLevel,
    };

    if (firebaseUser) {
      void persistCommitToFirestore(firebaseUser.uid, newCommit, currentCase.tierLevel).catch(
        (err) => {
          console.error('Falha ao persistir commit no Firestore:', err);
        }
      );
    }
    return newCommit;
  };

  const pushVisualHistoryEntry = useCallback(
    (audit: ImageAuditResponse, fallbackTier: DataCenterTier) => {
      const dt = new Date(audit.timestamp || Date.now());
      const timeLabel = dt.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      const entry: VisualAuditHistoryEntry = {
        auditId: audit.auditId,
        timestamp: audit.timestamp,
        timeLabel,
        imageLabel: audit.imageLabel,
        suppliedBy: audit.provenance?.suppliedBy,
        sourceUrl: audit.provenance?.sourceUrl,
        tierLevel: audit.tierLevel ?? fallbackTier,
        looseWireAreaPercent: audit.summaryMetrics.looseWireAreaPercent,
        exposedCopperAreaPercent: audit.summaryMetrics.exposedCopperAreaPercent,
        overallStatus: audit.overallStatus,
        vucProofHash: audit.vucProof?.proofHash,
      };
      setVisualAuditHistory((prev) => {
        const filtered = prev.filter((item) => item.auditId !== entry.auditId);
        return [...filtered, entry].slice(-30);
      });
    },
    []
  );

  const handleEvidenceIngested = (result: EvidenceIngestionResult) => {
    const initialFindings: DocumentNC[] =
      result.documentAudit?.findings ??
      result.imageAudit?.contextClassification.suggestedDocumentFindings ??
      [];

    const initialSummary =
      result.documentAudit?.summary ??
      result.imageAudit?.documentCrossCheck ??
      `Evidência "${result.title}" ingerida e assinada com prova scoobiii/vuc.`;

    const initialAnalysisSource =
      result.documentAudit?.analysisSource ??
      result.imageAudit?.analysisSource ??
      'normative-rule-engine';

    const initialShortHash = createDeterministicShortHash(
      `${result.auditId}-${result.documentText.length}`
    );
    const initialCommit: DocumentVersionCommit = {
      hash: `${initialShortHash}a8f93c1e2d4b5a6c7e8f901234567890abcdef`,
      shortHash: initialShortHash,
      version: 'v1.0.0-intake',
      branch: 'main',
      author: result.provenance.suppliedBy || 'Auditor',
      date: new Date().toISOString().replace('T', ' ').slice(0, 19),
      message: `chore(intake): ingere ${sourceTypeBadgeLabel(result.sourceType)} "${result.title}"`,
      ncsResolved: [],
      content: result.documentText,
      vucProofHash: result.vucProof?.proofHash,
      tierLevel: result.tierLevel,
    };

    const nextCase: ActiveEvidenceCase = {
      auditId: result.auditId,
      sourceType: result.sourceType,
      title: result.title,
      provenance: result.provenance,
      tierLevel: result.tierLevel,
      originalText: result.documentText,
      documentText: result.documentText,
      findings: initialFindings,
      auditSummary: initialSummary,
      analysisSource: initialAnalysisSource,
      imageDataUrl: result.imageBase64DataUrl ?? null,
      imageAudit: result.imageAudit ?? null,
      cadPatch: null,
      commits: [initialCommit],
      vucProof: result.vucProof ?? null,
    };

    setDefaultTier(result.tierLevel);
    setActiveCase(nextCase);
    if (result.imageAudit) {
      pushVisualHistoryEntry(result.imageAudit, result.tierLevel);
      setActiveTab(WorkspaceTab.VISION_MASKS);
    } else {
      setActiveTab(WorkspaceTab.DOCUMENT_AUDIT);
    }

    void syncCaseToStorage(nextCase);
  };

  const handleSelectHistoryAudit = async (auditId: string) => {
    try {
      const res = await fetch(`/api/raid/audits/${encodeURIComponent(auditId)}`);
      if (res.ok) {
        const stored = (await res.json()) as Partial<ActiveEvidenceCase> &
          Partial<EvidenceIngestionResult> & {
            imageBase64DataUrl?: string;
          };

        const restoredText = stored.documentText ?? '';
        const restoredFindings =
          stored.findings ??
          stored.documentAudit?.findings ??
          stored.imageAudit?.contextClassification?.suggestedDocumentFindings ??
          [];
        const restoredSummary =
          stored.auditSummary ??
          stored.documentAudit?.summary ??
          stored.imageAudit?.documentCrossCheck ??
          'Registro restaurado da persistência SQLite RAID-1.';
        const restoredSourceType = stored.sourceType ?? 'document';
        const restoredTier = stored.tierLevel ?? 'TIER_III';
        const restoredTitle = stored.title ?? stored.imageAudit?.imageLabel ?? auditId;
        const restoredCommits: DocumentVersionCommit[] =
          Array.isArray(stored.commits) && stored.commits.length > 0
            ? stored.commits
            : [
                {
                  hash: `${createDeterministicShortHash(auditId)}00000000000000000000000000000000`,
                  shortHash: createDeterministicShortHash(auditId),
                  version: 'v1.0.0-raid1',
                  branch: 'main',
                  author: stored.provenance?.suppliedBy ?? 'Auditor',
                  date: stored.provenance?.suppliedDate ?? new Date().toISOString().slice(0, 10),
                  message: `restore(raid1): ${restoredTitle}`,
                  ncsResolved: [],
                  content: restoredText,
                  vucProofHash: stored.vucProof?.proofHash,
                  tierLevel: restoredTier,
                },
              ];

        const restoredCase: ActiveEvidenceCase = {
          auditId: stored.auditId ?? auditId,
          sourceType: restoredSourceType,
          title: restoredTitle,
          provenance: stored.provenance ?? {
            suppliedBy: 'Auditor',
            suppliedDate: new Date().toISOString().slice(0, 10),
            sourceName: restoredTitle,
            sourceUrl: 'sqlite://raid1',
            sourceType: restoredSourceType,
          },
          tierLevel: restoredTier,
          originalText: stored.originalText ?? restoredText,
          documentText: restoredText,
          findings: restoredFindings,
          auditSummary: restoredSummary,
          analysisSource:
            stored.analysisSource ??
            stored.documentAudit?.analysisSource ??
            stored.imageAudit?.analysisSource ??
            'normative-rule-engine',
          imageDataUrl: stored.imageDataUrl ?? stored.imageBase64DataUrl ?? null,
          imageAudit: stored.imageAudit ?? null,
          cadPatch: stored.cadPatch ?? null,
          commits: restoredCommits,
          vucProof: stored.vucProof ?? stored.imageAudit?.vucProof ?? null,
        };

        setActiveCase(restoredCase);
        if (restoredCase.imageAudit) {
          pushVisualHistoryEntry(restoredCase.imageAudit, restoredTier);
          setActiveTab(WorkspaceTab.VISION_MASKS);
        } else {
          setActiveTab(WorkspaceTab.DOCUMENT_AUDIT);
        }
        return;
      }

      const fbSummary = mergedHistoryItems.find((i) => i.auditId === auditId);
      if (!fbSummary) return;

      const summaryDoc = [
        `# Registro Cloud Firestore: ${fbSummary.imageLabel}`,
        `- ID: ${fbSummary.auditId}`,
        `- Tipo: ${sourceTypeBadgeLabel(fbSummary.sourceType ?? 'document')}`,
        `- Fornecido por: ${fbSummary.suppliedBy} em ${fbSummary.suppliedDate}`,
        `- Fonte / URL: ${fbSummary.sourceName} (${fbSummary.sourceUrl})`,
        `- SHA-256 Conteúdo: ${fbSummary.imageSha256}`,
        `- Classificação Tier: ${fbSummary.tierLevel.replace('_', ' ')}`,
        `- Prova VUC: ${fbSummary.vucExecutionId} · ${fbSummary.vucProofHash}`,
        '',
        fbSummary.summaryNote ?? 'Metadados restaurados do Firestore.',
      ].join('\n');

      setActiveCase({
        auditId: fbSummary.auditId,
        sourceType: fbSummary.sourceType ?? 'document',
        title: fbSummary.imageLabel,
        provenance: {
          suppliedBy: fbSummary.suppliedBy,
          suppliedDate: fbSummary.suppliedDate,
          sourceName: fbSummary.sourceName,
          sourceUrl: fbSummary.sourceUrl,
          sourceType: fbSummary.sourceType,
          imageSha256: fbSummary.imageSha256,
        },
        tierLevel: fbSummary.tierLevel,
        originalText: summaryDoc,
        documentText: summaryDoc,
        findings: [],
        auditSummary:
          fbSummary.summaryNote ?? 'Metadados da auditoria restaurados do Firestore.',
        analysisSource: 'normative-rule-engine',
        imageDataUrl: null,
        imageAudit: null,
        cadPatch: null,
        commits: [
          {
            hash: `${createDeterministicShortHash(fbSummary.auditId)}00000000000000000000000000000000`,
            shortHash: createDeterministicShortHash(fbSummary.auditId),
            version: fbSummary.patchVersion ?? 'v1.0.0-cloud',
            branch: 'main',
            author: fbSummary.suppliedBy,
            date: fbSummary.suppliedDate,
            message: `cloud(firestore): restaura sumário ${fbSummary.imageLabel}`,
            ncsResolved: [],
            content: summaryDoc,
            vucProofHash: fbSummary.vucProofHash,
            tierLevel: fbSummary.tierLevel,
          },
        ],
        vucProof: {
          executionId: fbSummary.vucExecutionId,
          requestId: fbSummary.auditId,
          inputHash: fbSummary.imageSha256,
          outputHash: fbSummary.vucProofHash,
          proofHash: fbSummary.vucProofHash,
          signature: 'firestore-stored',
          keyId: 'vuc-cloud',
          gos3SessionId: fbSummary.auditId,
          verified: fbSummary.vucVerified,
          verificationStatus: fbSummary.vucVerified ? 'VERIFIED' : 'RECORDED',
          canonicalJcsBytes: 0,
          proofObject: {},
        },
      });
      setActiveTab(WorkspaceTab.DOCUMENT_AUDIT);
    } catch (err) {
      console.error('Erro ao abrir registro do histórico:', err);
    }
  };

  const handleDeleteHistoryAudit = async (auditId: string) => {
    try {
      await fetch(`/api/raid/audits/${encodeURIComponent(auditId)}`, {
        method: 'DELETE',
      });
      if (activeCase?.auditId === auditId) {
        setActiveCase(null);
      }
      await refreshRaidState(Boolean(firebaseUser));
    } catch (err) {
      console.error('Erro ao remover auditoria do RAID-1:', err);
    }
  };

  const handleStartNewAudit = () => {
    setActiveCase(null);
    setActiveTab(WorkspaceTab.DOCUMENT_AUDIT);
  };

  const handleRunAudit = async (useAi: boolean, overrideTier?: DataCenterTier) => {
    if (!activeCase) return;
    const targetTier = overrideTier ?? activeCase.tierLevel;
    setIsAuditing(true);
    try {
      const res = await fetch('/api/nc/audit-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentText: activeCase.documentText,
          useAi,
          tierLevel: targetTier,
        }),
      });
      if (!res.ok) throw new Error('Falha ao auditar evidência');
      const data = (await res.json()) as DocumentAuditResponse;

      const updated: ActiveEvidenceCase = {
        ...activeCase,
        tierLevel: targetTier,
        findings: data.findings,
        auditSummary: data.summary,
        analysisSource: data.analysisSource,
        vucProof: data.vucProof ?? activeCase.vucProof,
      };
      setActiveCase(updated);
      void syncCaseToStorage(updated);
    } catch (err) {
      console.error(err);
    } finally {
      setIsAuditing(false);
    }
  };

  const handleChangeTierLevel = (nextTier: DataCenterTier) => {
    setDefaultTier(nextTier);
    if (!activeCase) return;
    void handleRunAudit(false, nextTier);
  };

  const handleChangeDocumentText = (nextText: string) => {
    if (!activeCase) return;
    setActiveCase({ ...activeCase, documentText: nextText });
  };

  const handleApplyFinding = (findingId: string) => {
    if (!activeCase) return;
    const target = activeCase.findings.find((f) => f.id === findingId);
    if (!target || target.applied) return;

    let nextDoc = activeCase.documentText;
    if (target.replacementBefore && nextDoc.includes(target.replacementBefore)) {
      nextDoc = nextDoc.replace(target.replacementBefore, target.replacementAfter);
    } else if (!nextDoc.includes(target.replacementAfter)) {
      nextDoc = `${nextDoc.trimEnd()}\n\n${target.replacementAfter}`;
    }

    const nextFindings = activeCase.findings.map((f) =>
      f.id === findingId ? { ...f, applied: true } : f
    );
    const resolvedTotal = nextFindings.filter((f) => f.applied).length;
    const versionLabel = `v1.${resolvedTotal}.0-nc-patch`;

    const newCommit = appendCommitToCase(
      activeCase,
      nextDoc,
      [target.code],
      `fix(nc): aplica correção ${target.code} (${target.normativeClause})`,
      versionLabel
    );

    const updated: ActiveEvidenceCase = {
      ...activeCase,
      documentText: nextDoc,
      findings: nextFindings,
      commits: [...activeCase.commits, newCommit],
    };
    setActiveCase(updated);
    void syncCaseToStorage(updated);
  };

  const handleApplyAllFindings = () => {
    if (!activeCase) return;
    const pending = activeCase.findings.filter((f) => !f.applied);
    if (pending.length === 0) return;

    let nextDoc = activeCase.documentText;
    const resolvedCodes: string[] = [];
    for (const item of pending) {
      if (item.replacementBefore && nextDoc.includes(item.replacementBefore)) {
        nextDoc = nextDoc.replace(item.replacementBefore, item.replacementAfter);
      } else if (!nextDoc.includes(item.replacementAfter)) {
        nextDoc = `${nextDoc.trimEnd()}\n\n${item.replacementAfter}`;
      }
      resolvedCodes.push(item.code);
    }

    const nextFindings = activeCase.findings.map((f) => ({ ...f, applied: true }));
    const newCommit = appendCommitToCase(
      activeCase,
      nextDoc,
      resolvedCodes,
      `feat(normative): aplica pacote completo ${activeCase.tierLevel.replace('_', ' ')}`,
      'v2.0.0-normative-compliant'
    );

    const updated: ActiveEvidenceCase = {
      ...activeCase,
      documentText: nextDoc,
      findings: nextFindings,
      auditSummary: `Todas as Não Conformidades (${activeCase.tierLevel.replace('_', ' ')}) foram corrigidas e persistidas em SQLite RAID-1.`,
      commits: [...activeCase.commits, newCommit],
    };
    setActiveCase(updated);
    void syncCaseToStorage(updated);
  };

  const handleResetOriginal = () => {
    if (!activeCase) return;
    const restoredFindings = activeCase.findings.map((f) => ({ ...f, applied: false }));
    const updated: ActiveEvidenceCase = {
      ...activeCase,
      documentText: activeCase.originalText,
      findings: restoredFindings,
      auditSummary: 'Evidência restaurada ao conteúdo original capturado na ingestão.',
    };
    setActiveCase(updated);
    void syncCaseToStorage(updated);
  };

  const handleAppendTechnicalMemo = (memo: string) => {
    if (!activeCase) return;
    const nextDoc = `${activeCase.documentText.trimEnd()}\n\n${memo}`;
    const versionLabel = `v2.0.${activeCase.commits.length}-nbr5410-memo`;
    const newCommit = appendCommitToCase(
      activeCase,
      nextDoc,
      ['NBR-5410-SIM'],
      'docs(nbr5410): anexa memorial de cálculo de demanda e queda de tensão QTA/ATS',
      versionLabel
    );
    const updated: ActiveEvidenceCase = {
      ...activeCase,
      documentText: nextDoc,
      commits: [...activeCase.commits, newCommit],
    };
    setActiveCase(updated);
    void syncCaseToStorage(updated);
  };

  const handleApplyVisualAuditToDocument = (
    audit: ImageAuditResponse,
    cadPatch?: CadNurbsRemediationPackage
  ) => {
    if (!activeCase) return;
    let nextDoc = activeCase.documentText;
    const resolvedCodes: string[] = [];
    const newFindings = audit.contextClassification?.suggestedDocumentFindings ?? [];

    for (const item of newFindings) {
      if (item.replacementBefore && nextDoc.includes(item.replacementBefore)) {
        nextDoc = nextDoc.replace(item.replacementBefore, item.replacementAfter);
      }
      resolvedCodes.push(item.code);
    }

    const prov = audit.provenance;
    const cvLines = [
      `[Laudo Determinístico & Solução CAD/NURBS (${audit.imageLabel} · ${audit.imageDimensions.width}x${audit.imageDimensions.height} px · ${(audit.tierLevel ?? activeCase.tierLevel).replace('_', ' ')})]`,
      `- Procedência: Fornecido por ${prov?.suppliedBy ?? 'N/I'} em ${prov?.suppliedDate ?? 'N/I'} · Fonte: ${prov?.sourceName ?? 'Upload Local'} (${prov?.sourceUrl ?? 'local'})`,
      `- SHA-256 Imagem Original: ${prov?.imageSha256 ?? 'N/I'}`,
      `- Painel detectado: ${audit.contextClassification.detectedPanelType}`,
      `- Fiação solta detectada: ${audit.summaryMetrics.looseWireAreaPercent}% · Cobre exposto IP2X: ${audit.summaryMetrics.exposedCopperAreaPercent}%`,
      `- Máscaras extraídas: ${audit.objects.length} zonas (${audit.processingMs} ms, motor ${audit.analysisSource})`,
    ];

    if (cadPatch) {
      cvLines.push(
        `- Patch CAD/NURBS aplicado (${cadPatch.patchVersion}): ${cadPatch.nurbsSummary.curveCount} curvas B-Spline grau ${cadPatch.nurbsSummary.degree}, ${cadPatch.binaries.stlTrianglesCount} triângulos STL, SHA-256 CAD: ${cadPatch.binaries.cadSha256}`,
        `- Prova Criptográfica scoobiii/vuc: execution_id=${cadPatch.vucProof.executionId} · proof_hash=${cadPatch.vucProof.proofHash} · status=${cadPatch.vucProof.verificationStatus}`
      );
    } else if (audit.vucProof) {
      cvLines.push(
        `- Prova scoobiii/vuc: execution_id=${audit.vucProof.executionId} · proof_hash=${audit.vucProof.proofHash}`
      );
    }

    const cvEvidenceBlock = cvLines.join('\n');
    if (!nextDoc.includes(cvEvidenceBlock)) {
      nextDoc = `${nextDoc.trimEnd()}\n\n${cvEvidenceBlock}`;
    }

    const existingCodes = new Set(activeCase.findings.map((f) => f.code));
    const appliedNew = newFindings
      .filter((f) => !existingCodes.has(f.code))
      .map((f) => ({ ...f, applied: true }));

    const versionLabel =
      cadPatch?.patchVersion ?? `v2.1.${activeCase.commits.length}-context-mask`;
    const newCommit = appendCommitToCase(
      activeCase,
      nextDoc,
      resolvedCodes.length ? resolvedCodes : ['CV-CONTEXT-MASK'],
      cadPatch
        ? `fix(cv+cad): aplica patch visual CAD/NURBS ${versionLabel} (${audit.imageLabel}) com prova VUC`
        : `fix(cv-context): aplica NCs de máscaras e contexto (${audit.imageLabel}) ao documento`,
      versionLabel,
      cadPatch?.vucProof.proofHash ?? audit.vucProof?.proofHash
    );

    const updated: ActiveEvidenceCase = {
      ...activeCase,
      documentText: nextDoc,
      findings: [...appliedNew, ...activeCase.findings],
      imageAudit: audit,
      cadPatch: cadPatch ?? activeCase.cadPatch,
      vucProof: cadPatch?.vucProof ?? audit.vucProof ?? activeCase.vucProof,
      commits: [...activeCase.commits, newCommit],
      auditSummary: `Patch ${versionLabel} (auditoria visual + solução CAD/NURBS) de "${audit.imageLabel}" aplicado e persistido em SQLite RAID-1.`,
    };

    setActiveCase(updated);
    void syncCaseToStorage(updated);

    if (!cadPatch) {
      setActiveTab(WorkspaceTab.DOCUMENT_AUDIT);
    }
  };

  const handleRecordVisualAudit = (audit: ImageAuditResponse) => {
    pushVisualHistoryEntry(audit, activeCase?.tierLevel ?? defaultTier);
    if (!activeCase) return;
    const updated: ActiveEvidenceCase = {
      ...activeCase,
      imageAudit: audit,
      provenance: audit.provenance ?? activeCase.provenance,
      vucProof: audit.vucProof ?? activeCase.vucProof,
    };
    setActiveCase(updated);
    void syncCaseToStorage(updated);
  };

  const handlePersistCadPatch = async (
    auditId: string,
    pkg: CadNurbsRemediationPackage
  ) => {
    if (firebaseUser) {
      await persistCadPatchToFirestore(firebaseUser.uid, auditId, pkg);
    }
  };

  const handleExportGitZip = async () => {
    if (!activeCase) return;
    setExportingZip(true);
    try {
      const currentVer =
        activeCase.commits[activeCase.commits.length - 1]?.version ?? 'v1.0.0';
      const blob = await generateGitRepoZip(
        activeCase.commits,
        activeCase.documentText,
        'lume-nc-auditor'
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lume-nc-auditor-${currentVer}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setExportingZip(false);
    }
  };

  const currentVersion =
    activeCase?.commits[activeCase.commits.length - 1]?.version ?? 'v1.0.0';

  return (
    <div
      id="top"
      className="min-h-screen flex flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100"
    >
      <TopBar
        activeTab={activeTab}
        hasActiveCase={Boolean(activeCase)}
        onSelectTab={setActiveTab}
        onNewEvidence={handleStartNewAudit}
        onExportGitZip={handleExportGitZip}
        exportingZip={exportingZip}
      />

      <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {activeTab === WorkspaceTab.LANDING ? (
          <LandingPageView
            auditsCount={mergedHistoryItems.length}
            raidStatus={raidStatus}
            onStartAudit={handleStartNewAudit}
            onNavigateTab={setActiveTab}
          />
        ) : (
          <div className="flex flex-col lg:flex-row gap-6 items-start">
            <HistorySidebar
              historyItems={mergedHistoryItems}
              selectedAuditId={activeCase?.auditId ?? null}
              raidStatus={raidStatus}
              firebaseUserEmail={firebaseUser?.email ?? null}
              authError={authError}
              onSelectAudit={handleSelectHistoryAudit}
              onDeleteAudit={handleDeleteHistoryAudit}
              onNewEvidence={handleStartNewAudit}
              onGoogleSignIn={handleGoogleSignIn}
              onGoogleSignOut={handleGoogleSignOut}
            />

            <div className="flex-1 min-w-0 w-full space-y-6">
              {activeTab === WorkspaceTab.GIT_VERSIONING && (
                <GitVersioningView
                  commits={activeCase?.commits ?? []}
                  currentDocument={activeCase?.documentText ?? ''}
                  raidStatus={raidStatus}
                />
              )}

              {activeTab === WorkspaceTab.DASHBOARD && (
                <AuditDashboardView
                  historyItems={mergedHistoryItems}
                  onSelectAudit={handleSelectHistoryAudit}
                  onStartNewAudit={handleStartNewAudit}
                />
              )}

              {(activeTab === WorkspaceTab.DOCUMENT_AUDIT ||
                activeTab === WorkspaceTab.VISION_MASKS) &&
                (!activeCase ? (
                  <EvidenceIntakePanel
                    defaultTier={defaultTier}
                    onIngested={handleEvidenceIngested}
                  />
                ) : (
                  <>
                    {/* Faixa enxuta de contexto ativo + botão para encerrar trabalho */}
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs dark:border-slate-800 dark:bg-slate-900">
                      <div className="flex flex-wrap items-center gap-2 text-slate-600 dark:text-slate-400 min-w-0">
                        <span className="font-semibold text-slate-900 dark:text-slate-100 truncate max-w-[260px]">
                          {activeCase.title}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{sourceTypeBadgeLabel(activeCase.sourceType)}</span>
                        <span aria-hidden="true">·</span>
                        <span>Fornecido por {activeCase.provenance.suppliedBy}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          {activeCase.provenance.suppliedDate}
                        </span>
                        {activeCase.vucProof && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="inline-flex items-center gap-1 font-mono text-emerald-700 dark:text-emerald-400">
                              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                              VUC {activeCase.vucProof.verificationStatus}
                            </span>
                          </>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={handleStartNewAudit}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Fechar Trabalho</span>
                      </button>
                    </div>

                    {activeTab === WorkspaceTab.DOCUMENT_AUDIT && (
                      <DocumentAuditView
                        caseTitle={activeCase.title}
                        sourceLabel={`${sourceTypeBadgeLabel(activeCase.sourceType)} · ${activeCase.provenance.sourceName}`}
                        documentText={activeCase.documentText}
                        originalText={activeCase.originalText}
                        findings={activeCase.findings}
                        auditSummary={activeCase.auditSummary}
                        analysisSource={activeCase.analysisSource}
                        isAuditing={isAuditing}
                        currentVersion={currentVersion}
                        tierLevel={activeCase.tierLevel}
                        latestVucProof={activeCase.vucProof}
                        onChangeTierLevel={handleChangeTierLevel}
                        onChangeDocumentText={handleChangeDocumentText}
                        onRunAudit={(useAi) => handleRunAudit(useAi)}
                        onApplyFinding={handleApplyFinding}
                        onApplyAllFindings={handleApplyAllFindings}
                        onResetOriginal={handleResetOriginal}
                        onAppendTechnicalMemo={handleAppendTechnicalMemo}
                      />
                    )}

                    {activeTab === WorkspaceTab.VISION_MASKS && (
                      <VisionMaskInspector
                        currentContextSnippet={activeCase.documentText}
                        tierLevel={activeCase.tierLevel}
                        onChangeTierLevel={handleChangeTierLevel}
                        auditHistory={visualAuditHistory}
                        initialImageDataUrl={activeCase.imageDataUrl}
                        initialImageLabel={activeCase.title}
                        initialProvenance={activeCase.provenance}
                        initialAuditResult={activeCase.imageAudit}
                        initialCadPatch={activeCase.cadPatch}
                        onRecordVisualAudit={handleRecordVisualAudit}
                        onClearVisualHistory={() => setVisualAuditHistory([])}
                        onApplyVisualAuditToDocument={handleApplyVisualAuditToDocument}
                        onPersistCadPatch={handlePersistCadPatch}
                      />
                    )}
                  </>
                ))}
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-4 px-4 py-4 text-xs text-slate-500 sm:px-6 lg:px-8 dark:text-slate-400">
          <div className="flex flex-wrap items-center gap-3">
            <span>
              Lume · lume-nc-auditor · PO Zeh Sobrinho &amp; Senior Agile DevOps Team · 2026-11-15
            </span>
            <button
              type="button"
              onClick={() => setActiveTab(WorkspaceTab.GIT_VERSIONING)}
              className="font-medium text-slate-700 hover:text-blue-700 hover:underline dark:text-slate-300 dark:hover:text-blue-400 cursor-pointer"
            >
              Git &amp; API
            </button>
          </div>
          <button
            type="button"
            onClick={() => setDarkMode((prev) => !prev)}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-900 cursor-pointer"
          >
            {darkMode ? (
              <>
                <Sun className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Tema Claro</span>
              </>
            ) : (
              <>
                <Moon className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Tema Escuro</span>
              </>
            )}
          </button>
        </div>
      </footer>
    </div>
  );
}
