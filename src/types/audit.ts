/**
 * @file audit.ts
 * @responsibility Contratos de tipos e enumerações para auditoria generalizada de evidências (Imagem, Documento Anexo, URL e Repositório Git), persistência SQLite RAID-1 + Firebase, CAD NURBS e provas scoobiii/vuc.
 * @version 3.0.0
 * @date 2026-11-15
 * @directory /src/types/audit.ts
 * @signature PO Zeh Sobrinho & Senior Agile DevOps Team (AI Framework)
 */

export type EvidenceSourceType = 'image' | 'document' | 'url' | 'repository';

export enum NCSeverity {
  CRITICAL = 'CRITICAL',
  MAJOR = 'MAJOR',
  MINOR = 'MINOR',
  COMPLIANT = 'COMPLIANT',
}

export enum NCCategory {
  NORMATIVE_ELECTRICAL = 'NORMATIVE_ELECTRICAL',
  DOCUMENTAL_REFERENCE = 'DOCUMENTAL_REFERENCE',
  VISUAL_WIRING = 'VISUAL_WIRING',
  TYPO_TERMINOLOGY = 'TYPO_TERMINOLOGY',
  ACCESSIBILITY_ALT = 'ACCESSIBILITY_ALT',
  INFRA_TIER = 'INFRA_TIER',
  SAFETY_NR10 = 'SAFETY_NR10',
  REPOSITORY_GOVERNANCE = 'REPOSITORY_GOVERNANCE',
}

export enum WorkspaceTab {
  LANDING = 'landing',
  DOCUMENT_AUDIT = 'workspace',
  VISION_MASKS = 'vision',
  DASHBOARD = 'dashboard',
  GIT_VERSIONING = 'git',
}

export type DataCenterTier = 'TIER_I' | 'TIER_II' | 'TIER_III' | 'TIER_IV';

export interface DataCenterTierSpec {
  id: DataCenterTier;
  label: string;
  availability: string;
  redundancy: string;
  spofTolerance: string;
  electricalRequirements: string[];
  infraRequirements: string[];
  safetyRequirements: string[];
  normativeRefs: string[];
}

export interface ImageProvenance {
  suppliedBy: string;
  suppliedDate: string;
  sourceName: string;
  sourceUrl: string;
  sourceType?: EvidenceSourceType;
  imageSha256?: string;
}

export interface VucProofEnvelope {
  executionId: string;
  requestId: string;
  inputHash: string;
  outputHash: string;
  proofHash: string;
  signature: string;
  keyId: string;
  gos3SessionId: string;
  verified: boolean;
  verificationStatus: string;
  canonicalJcsBytes: number;
  proofObject: Record<string, unknown>;
}

export interface DocumentNC {
  id: string;
  code: string;
  title: string;
  category: NCCategory;
  severity: NCSeverity;
  normativeClause: string;
  excerpt: string;
  lineRange: string;
  description: string;
  recommendation: string;
  replacementBefore: string;
  replacementAfter: string;
  applied: boolean;
}

export interface DocumentAuditResponse {
  auditId: string;
  timestamp: string;
  documentTitle: string;
  tierLevel?: DataCenterTier;
  totalFindings: number;
  criticalCount: number;
  majorCount: number;
  minorCount: number;
  findings: DocumentNC[];
  correctedDocument: string;
  summary: string;
  analysisSource: 'gemini-4-hydrogen' | 'normative-rule-engine';
  vucProof?: VucProofEnvelope;
}

export interface MaskPoint {
  x: number; // 0..1000 normalized
  y: number; // 0..1000 normalized
}

export type MaskObjectCategory =
  | 'loose_wire'
  | 'uncontained_wiring_zone'
  | 'exposed_copper_busbar'
  | 'hazard_label'
  | 'circuit_breaker_block'
  | 'mimic_diagram';

export interface PixelMetrics {
  pixelCount: number;
  areaPercent: number;
  fillRatio: number; // pixelCount / bboxArea
  aspectRatio: number;
  meanHueDeg: number;
  meanSaturation: number;
  edgeDensity: number;
}

export interface DetectedObjectMask {
  id: string;
  label: string;
  category: MaskObjectCategory;
  severity: NCSeverity;
  bbox: [number, number, number, number]; // [ymin, xmin, ymax, xmax] normalized 0..1000
  polygon: MaskPoint[]; // real convex-hull contour vertices normalized 0..1000
  metrics: PixelMetrics;
  normativeRef: string;
  findingTitle: string;
  description: string;
  remediation: string;
}

export interface ContextClassificationResult {
  expectedTopic: string;
  detectedPanelType: string;
  contextAligned: boolean;
  figureCodeInContext: string | null;
  alignmentChecklist: Array<{
    criterion: string;
    passed: boolean;
    detail: string;
  }>;
  suggestedDocumentFindings: DocumentNC[];
}

export interface ImageAuditResponse {
  auditId: string;
  timestamp: string;
  imageLabel: string;
  provenance?: ImageProvenance;
  tierLevel?: DataCenterTier;
  imageDimensions: {
    width: number;
    height: number;
    analysisWidth: number;
    analysisHeight: number;
  };
  processingMs: number;
  figureCodeInContext: string | null;
  contextAligned: boolean;
  overallStatus: 'NON_COMPLIANT' | 'PARTIAL' | 'COMPLIANT';
  maskOverlayPngDataUrl: string;
  objects: DetectedObjectMask[];
  contextClassification: ContextClassificationResult;
  summaryMetrics: {
    looseWireAreaPercent: number;
    exposedCopperAreaPercent: number;
    breakerComponentsCount: number;
    mimicDiagramCount: number;
    orthogonalWireRatio: number;
  };
  documentCrossCheck: string;
  analysisSource: 'deterministic-cv-pixel-engine' | 'external-open-cv-endpoint';
  vucProof?: VucProofEnvelope;
}

export interface CadNurbsRemediationPackage {
  patchVersion: string;
  tierLevel: DataCenterTier;
  normativeStandards: string[];
  remediationSvg: string;
  remediationImageDataUrl?: string;
  nurbsSummary: {
    degree: number;
    curveCount: number;
    controlPointsTotal: number;
    minBendRadiusMm: number;
    conformanceNote: string;
  };
  binaries: {
    igesContent: string;
    dxfContent: string;
    stlBinaryBase64: string;
    stlTrianglesCount: number;
    cadSha256: string;
  };
  appliedCorrections: string[];
  vucProof: VucProofEnvelope;
}

export interface VisualAuditHistoryEntry {
  auditId: string;
  timestamp: string;
  timeLabel: string;
  imageLabel: string;
  suppliedBy?: string;
  sourceUrl?: string;
  tierLevel?: DataCenterTier;
  looseWireAreaPercent: number;
  exposedCopperAreaPercent: number;
  overallStatus: 'NON_COMPLIANT' | 'PARTIAL' | 'COMPLIANT';
  vucProofHash?: string;
}

export interface PersistedAuditSummary {
  auditId: string;
  ownerId: string;
  sourceType?: EvidenceSourceType;
  imageLabel: string;
  suppliedBy: string;
  suppliedDate: string;
  sourceName: string;
  sourceUrl: string;
  imageSha256: string;
  tierLevel: DataCenterTier;
  overallStatus: 'NON_COMPLIANT' | 'PARTIAL' | 'COMPLIANT';
  looseWireAreaPercent: number;
  exposedCopperAreaPercent: number;
  objectsCount: number;
  vucExecutionId: string;
  vucProofHash: string;
  vucVerified: boolean;
  patchVersion?: string;
  summaryNote?: string;
  storageOrigin?: 'sqlite_raid' | 'firestore' | 'both';
  createdAt?: unknown;
}

export interface DocumentVersionCommit {
  hash: string;
  shortHash: string;
  version: string;
  branch: string;
  author: string;
  date: string;
  message: string;
  ncsResolved: string[];
  content: string;
  vucProofHash?: string;
  tierLevel?: DataCenterTier;
}

export interface ScrumStory {
  id: string;
  epic: string;
  title: string;
  points: number;
  status: 'DONE' | 'IN_REVIEW' | 'READY';
  owner: string;
  acceptanceCriteria: string;
}

export interface RaidStatusSummary {
  raidMode: 'SQLITE_RAID1_LOCAL' | 'SQLITE_RAID1_PLUS_FIREBASE';
  mirrorAHealthy: boolean;
  mirrorBHealthy: boolean;
  mirrorAPath: string;
  mirrorBPath: string;
  recordsMirrorA: number;
  recordsMirrorB: number;
  healedCount: number;
  hasGeminiApiKey: boolean;
  firebaseConfigured: boolean;
}

export interface EvidenceIngestionResult {
  auditId: string;
  sourceType: EvidenceSourceType;
  title: string;
  provenance: ImageProvenance;
  tierLevel: DataCenterTier;
  documentText: string;
  documentAudit?: DocumentAuditResponse;
  imageBase64DataUrl?: string;
  imageAudit?: ImageAuditResponse;
  repositoryMeta?: {
    repoFullName: string;
    defaultBranch: string;
    stars?: number;
    license?: string;
    filesInspected: string[];
  };
  vucProof?: VucProofEnvelope;
  raidRecordSaved?: boolean;
}
