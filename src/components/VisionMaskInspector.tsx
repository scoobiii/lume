/**
 * @file VisionMaskInspector.tsx
 * @responsibility Inspetor real de imagens com procedência documental (fornecedor/data/fonte/URL), máscaras em pixels RGBA, provas scoobiii/vuc, patch corretivo visual + CAD/NURBS (IGES/DXF/STL) e histórico Firestore/Recharts.
 * @version 2.2.0
 * @date 2026-11-15
 * @directory /src/components/VisionMaskInspector.tsx
 * @signature PO Zeh Sobrinho & Senior Agile DevOps Team (AI Framework)
 */

import React, { useMemo, useState } from 'react';
import {
  AlertOctagon,
  Box,
  CheckCircle2,
  Download,
  Eye,
  GitCommit,
  ImagePlus,
  Layers,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  XCircle,
} from 'lucide-react';
import {
  CadNurbsRemediationPackage,
  DataCenterTier,
  DetectedObjectMask,
  ImageAuditResponse,
  ImageProvenance,
  NCSeverity,
  VisualAuditHistoryEntry,
} from '../types/audit';
import { LooseWireHistoryChart } from './LooseWireHistoryChart';

interface VisionMaskInspectorProps {
  currentContextSnippet: string;
  tierLevel: DataCenterTier;
  onChangeTierLevel: (tier: DataCenterTier) => void;
  auditHistory: VisualAuditHistoryEntry[];
  initialImageDataUrl?: string | null;
  initialImageLabel?: string;
  initialProvenance?: ImageProvenance;
  initialAuditResult?: ImageAuditResponse | null;
  initialCadPatch?: CadNurbsRemediationPackage | null;
  onRecordVisualAudit: (audit: ImageAuditResponse) => void;
  onClearVisualHistory: () => void;
  onApplyVisualAuditToDocument: (
    audit: ImageAuditResponse,
    cadPatch?: CadNurbsRemediationPackage
  ) => void;
  onPersistCadPatch?: (auditId: string, pkg: CadNurbsRemediationPackage) => Promise<void>;
}

function getMaskColors(severity: NCSeverity) {
  switch (severity) {
    case NCSeverity.CRITICAL:
      return { stroke: '#DC2626', fill: 'rgba(220, 38, 38, 0.16)', label: 'Crítica' };
    case NCSeverity.MAJOR:
      return { stroke: '#D97706', fill: 'rgba(217, 119, 6, 0.16)', label: 'Maior' };
    case NCSeverity.MINOR:
      return { stroke: '#7C3AED', fill: 'rgba(124, 58, 237, 0.14)', label: 'Contextual' };
    default:
      return { stroke: '#16A34A', fill: 'rgba(22, 163, 74, 0.14)', label: 'Conforme' };
  }
}

async function normalizeImageForServerPng(dataUrl: string): Promise<{
  pngDataUrl: string;
  mimeType: string;
}> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const maxSide = 1280;
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve({ pngDataUrl: dataUrl, mimeType: 'image/jpeg' });
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      resolve({ pngDataUrl: canvas.toDataURL('image/png'), mimeType: 'image/png' });
    };
    img.onerror = () => resolve({ pngDataUrl: dataUrl, mimeType: 'image/jpeg' });
    img.src = dataUrl;
  });
}

function downloadTextBlob(content: string, filename: string, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function downloadBase64Binary(base64: string, filename: string, mime = 'application/octet-stream') {
  const binStr = atob(base64);
  const bytes = new Uint8Array(binStr.length);
  for (let i = 0; i < binStr.length; i++) {
    bytes[i] = binStr.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function downloadSvgAsPng(svgString: string, filename: string) {
  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const svgUrl = URL.createObjectURL(svgBlob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = svgUrl;
    });
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 800;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(img, 0, 0, 1200, 800);
      const pngUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = pngUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

export const VisionMaskInspector: React.FC<VisionMaskInspectorProps> = ({
  currentContextSnippet,
  tierLevel,
  onChangeTierLevel,
  auditHistory,
  initialImageDataUrl = null,
  initialImageLabel = '',
  initialProvenance,
  initialAuditResult = null,
  initialCadPatch = null,
  onRecordVisualAudit,
  onClearVisualHistory,
  onApplyVisualAuditToDocument,
  onPersistCadPatch,
}) => {
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(initialImageDataUrl);
  const [imageName, setImageName] = useState<string>(initialImageLabel);
  const [externalEndpointUrl, setExternalEndpointUrl] = useState<string>('');
  const [externalImageGenUrl, setExternalImageGenUrl] = useState<string>('');

  const [provenance, setProvenance] = useState<ImageProvenance>(
    initialProvenance ?? {
      suppliedBy: 'Auditor / Engenharia',
      suppliedDate: new Date().toISOString().slice(0, 10),
      sourceName: initialImageLabel || 'Evidência Visual',
      sourceUrl: 'upload://local',
    }
  );

  const [auditResult, setAuditResult] = useState<ImageAuditResponse | null>(initialAuditResult);
  const [selectedMaskId, setSelectedMaskId] = useState<string | null>(
    initialAuditResult?.objects[0]?.id ?? null
  );
  const [cadPatchPkg, setCadPatchPkg] = useState<CadNurbsRemediationPackage | null>(initialCadPatch);
  const [isRemediating, setIsRemediating] = useState(false);
  const [vucVerifyResult, setVucVerifyResult] = useState<string | null>(null);

  React.useEffect(() => {
    setImageDataUrl(initialImageDataUrl);
    setImageName(initialImageLabel);
    if (initialProvenance) setProvenance(initialProvenance);
    setAuditResult(initialAuditResult);
    setSelectedMaskId(initialAuditResult?.objects[0]?.id ?? null);
    setCadPatchPkg(initialCadPatch);
  }, [initialImageDataUrl, initialImageLabel, initialProvenance, initialAuditResult, initialCadPatch]);

  const [showPixelMaskPng, setShowPixelMaskPng] = useState(true);
  const [showPolygons, setShowPolygons] = useState(true);
  const [showBoxes, setShowBoxes] = useState(false);
  const [onlyNonConformities, setOnlyNonConformities] = useState(false);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const runRealPixelAnalysis = async (rawDataUrl: string, fileName: string) => {
    setIsAnalyzing(true);
    setErrorMsg(null);
    setCadPatchPkg(null);
    setVucVerifyResult(null);
    try {
      const normalized = await normalizeImageForServerPng(rawDataUrl);
      const res = await fetch('/api/nc/detect-masks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: normalized.pngDataUrl,
          mimeType: normalized.mimeType,
          imageLabel: fileName,
          contextText: currentContextSnippet,
          externalEndpointUrl: externalEndpointUrl.trim() || undefined,
          provenance,
          tierLevel,
        }),
      });

      if (!res.ok) {
        const errJson = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errJson.error ?? `Erro HTTP ${res.status}`);
      }

      const data = (await res.json()) as ImageAuditResponse;
      setAuditResult(data);
      setSelectedMaskId(data.objects[0]?.id ?? null);
      onRecordVisualAudit(data);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Falha na segmentação de pixels da imagem.'
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleApplyPatchToImageAndDocument = async () => {
    if (!auditResult) return;
    setIsRemediating(true);
    setErrorMsg(null);
    try {
      const patchVersion = `v2.2.${auditHistory.length}-cad-patch`;
      const res = await fetch('/api/nc/remediate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tierLevel,
          patchVersion,
          imageLabel: auditResult.imageLabel,
          provenance: auditResult.provenance ?? provenance,
          detectedObjects: auditResult.objects,
          externalImageGenUrl: externalImageGenUrl.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const errJson = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errJson.error ?? `Erro HTTP ${res.status}`);
      }
      const pkg = (await res.json()) as CadNurbsRemediationPackage;
      setCadPatchPkg(pkg);
      if (onPersistCadPatch) {
        await onPersistCadPatch(auditResult.auditId, pkg);
      }
      onApplyVisualAuditToDocument(auditResult, pkg);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Falha ao gerar solução visual e CAD NURBS.'
      );
    } finally {
      setIsRemediating(false);
    }
  };

  const handleVerifyVucProof = async () => {
    const proofObj = cadPatchPkg?.vucProof?.proofObject ?? auditResult?.vucProof?.proofObject;
    if (!proofObj) return;
    try {
      const res = await fetch('/api/nc/vuc/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proof: proofObj }),
      });
      const json = (await res.json()) as { status?: string; valid?: boolean; verified_at?: string };
      setVucVerifyResult(
        `${json.status ?? 'VERIFIED'} · valid=${String(json.valid)} (${json.verified_at ?? ''})`
      );
    } catch (err) {
      setVucVerifyResult(err instanceof Error ? err.message : 'Falha na verificação');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processSelectedFile(file);
  };

  const processSelectedFile = (file: File) => {
    setErrorMsg(null);
    setImageName(file.name);
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = String(reader.result ?? '');
      setImageDataUrl(dataUrl);
      setAuditResult(null);
      setCadPatchPkg(null);
      await runRealPixelAnalysis(dataUrl, file.name);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      processSelectedFile(file);
    }
  };

  const handleClear = () => {
    setImageDataUrl(null);
    setImageName('');
    setAuditResult(null);
    setCadPatchPkg(null);
    setSelectedMaskId(null);
    setVucVerifyResult(null);
    setErrorMsg(null);
  };

  const visibleObjects = useMemo(() => {
    if (!auditResult) return [];
    if (!onlyNonConformities) return auditResult.objects;
    return auditResult.objects.filter((o) => o.severity !== NCSeverity.COMPLIANT);
  }, [auditResult, onlyNonConformities]);

  const selectedObject: DetectedObjectMask | null = useMemo(
    () => visibleObjects.find((o) => o.id === selectedMaskId) ?? visibleObjects[0] ?? null,
    [visibleObjects, selectedMaskId]
  );

  return (
    <section aria-labelledby="vision-heading" className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 lg:flex-row lg:items-end lg:justify-between dark:border-slate-800">
        <div className="max-w-3xl space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>MCP Object &amp; Context Mask</span>
            <span aria-hidden="true">·</span>
            <span>CAD NURBS IGES/DXF/STL</span>
            <span aria-hidden="true">·</span>
            <span>scoobiii/vuc Ed25519 Proof</span>
          </div>
          <h1
            id="vision-heading"
            className="font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-slate-100"
            style={{ textWrap: 'balance' }}
          >
            Inspeção Visual, Procedência Documental &amp; Solução CAD/NURBS
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Registre quem forneceu a imagem (data, fonte e URL), execute segmentação real pixel-a-pixel com prova criptográfica <span className="font-mono">scoobiii/vuc</span> e aplique o patch versionado diretamente na imagem gerando planta normativa e binários CAD/NURBS ({tierLevel.replace('_', ' ')}).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <label className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-500 whitespace-nowrap shrink-0 cursor-pointer">
            <Upload className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{imageDataUrl ? 'Trocar Foto Real' : 'Carregar Foto Real (.jpg/.png)'}</span>
            <input type="file" accept="image/*" onChange={handleFileChange} className="sr-only" />
          </label>

          {imageDataUrl && (
            <>
              <button
                type="button"
                onClick={() => runRealPixelAnalysis(imageDataUrl, imageName)}
                disabled={isAnalyzing}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <ScanSearch className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{isAnalyzing ? 'Processando Pixels...' : 'Reanalisar Pixels'}</span>
              </button>

              <button
                type="button"
                onClick={handleClear}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Limpar</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Formulário de Procedência da Imagem + Tier Data Center + Endpoints Open-Source */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
              Documentação de Procedência da Imagem &amp; Nível Data Center
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Persistida no Firestore e vinculada ao hash SHA-256 da prova de execução VUC.
            </p>
          </div>
          <div className="inline-flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1 border border-slate-200 dark:bg-slate-950 dark:border-slate-800">
            {(['TIER_I', 'TIER_II', 'TIER_III', 'TIER_IV'] as DataCenterTier[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => onChangeTierLevel(t)}
                className={`rounded-md px-2.5 py-1 font-mono text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  tierLevel === t
                    ? 'bg-slate-900 text-white dark:bg-blue-600'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
              >
                {t.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1 text-xs">
            <span className="font-medium text-slate-700 dark:text-slate-300">
              Quem Forneceu (Autor / Responsável)
            </span>
            <input
              type="text"
              value={provenance.suppliedBy}
              onChange={(e) => setProvenance((p) => ({ ...p, suppliedBy: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </label>

          <label className="space-y-1 text-xs">
            <span className="font-medium text-slate-700 dark:text-slate-300">
              Data do Fornecimento / Coleta
            </span>
            <input
              type="date"
              value={provenance.suppliedDate}
              onChange={(e) => setProvenance((p) => ({ ...p, suppliedDate: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 font-mono text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </label>

          <label className="space-y-1 text-xs">
            <span className="font-medium text-slate-700 dark:text-slate-300">
              Fonte / Sistema de Origem
            </span>
            <input
              type="text"
              value={provenance.sourceName}
              onChange={(e) => setProvenance((p) => ({ ...p, sourceName: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </label>

          <label className="space-y-1 text-xs">
            <span className="font-medium text-slate-700 dark:text-slate-300">
              URL da Fonte Original
            </span>
            <input
              type="url"
              value={provenance.sourceUrl}
              onChange={(e) => setProvenance((p) => ({ ...p, sourceUrl: e.target.value }))}
              placeholder="https://..."
              className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 font-mono text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </label>
        </div>

        <div className="grid gap-3 border-t border-slate-100 pt-3 sm:grid-cols-2 dark:border-slate-800">
          <label className="space-y-1 text-xs">
            <span className="text-slate-600 dark:text-slate-400">
              Endpoint Opcional Open-Source CV/MCP (OpenCV / Grounded-SAM2)
            </span>
            <input
              type="url"
              value={externalEndpointUrl}
              onChange={(e) => setExternalEndpointUrl(e.target.value)}
              placeholder="Opcional: https://servidor-cv/api/nc/detect-masks"
              className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 font-mono text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </label>

          <label className="space-y-1 text-xs">
            <span className="text-slate-600 dark:text-slate-400">
              Endpoint Opcional Open-Source Gerador Visual (ComfyUI / Diffusers)
            </span>
            <input
              type="url"
              value={externalImageGenUrl}
              onChange={(e) => setExternalImageGenUrl(e.target.value)}
              placeholder="Opcional: https://servidor-comfyui/generate-compliant"
              className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 font-mono text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </label>
        </div>
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
        >
          {errorMsg}
        </div>
      )}

      {!imageDataUrl && (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className="rounded-xl border-2 border-dashed border-slate-300 bg-white p-12 text-center dark:border-slate-700 dark:bg-slate-900 space-y-4"
        >
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
            <ImagePlus className="h-6 w-6" aria-hidden="true" />
          </div>
          <div className="space-y-1 max-w-lg mx-auto">
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
              Arraste ou selecione a imagem real do painel (ex.: img12.jpg)
            </h2>
            <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              A API analisará os pixels originais, assinará a execução com <span className="font-mono">scoobiii/vuc</span>, registrará procedência no Firestore e habilitará a geração da solução visual + CAD/NURBS.
            </p>
          </div>
          <div>
            <label className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 cursor-pointer">
              <Upload className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Selecionar Imagem (img12.jpg / PNG / WebP)</span>
              <input type="file" accept="image/*" onChange={handleFileChange} className="sr-only" />
            </label>
          </div>
        </div>
      )}

      {imageDataUrl && (
        <div className="space-y-6">
          {auditResult && (
            <div className="grid grid-cols-2 gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-5 dark:border-slate-800 dark:bg-slate-900">
              <div className="space-y-1">
                <div className="text-xs text-slate-500 dark:text-slate-400">Resolução Real</div>
                <div className="font-mono text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                  {auditResult.imageDimensions.width} × {auditResult.imageDimensions.height} px
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-slate-500 dark:text-slate-400">Fiação Exposta</div>
                <div className="font-mono text-lg font-semibold tabular-nums text-red-700 dark:text-red-400">
                  {auditResult.summaryMetrics.looseWireAreaPercent}%
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-slate-500 dark:text-slate-400">Cobre Exposto (IP2X)</div>
                <div className="font-mono text-lg font-semibold tabular-nums text-amber-700 dark:text-amber-400">
                  {auditResult.summaryMetrics.exposedCopperAreaPercent}%
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-slate-500 dark:text-slate-400">Ortogonalidade</div>
                <div className="font-mono text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                  {Math.round(auditResult.summaryMetrics.orthogonalWireRatio * 100)}%
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-slate-500 dark:text-slate-400">SHA-256 Imagem</div>
                <div className="font-mono text-xs font-semibold truncate text-slate-700 dark:text-slate-300">
                  {auditResult.provenance?.imageSha256 ?? 'calculando'}
                </div>
              </div>
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-12 items-start">
            <div className="lg:col-span-7 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex flex-wrap items-center gap-4 text-xs">
                  <label className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showPixelMaskPng}
                      onChange={(e) => setShowPixelMaskPng(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600"
                    />
                    <Layers className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Máscara PNG (Pixels)</span>
                  </label>

                  <label className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showPolygons}
                      onChange={(e) => setShowPolygons(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600"
                    />
                    <span>Contornos Convexos</span>
                  </label>

                  <label className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showBoxes}
                      onChange={(e) => setShowBoxes(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600"
                    />
                    <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Bounding Boxes</span>
                  </label>

                  <label className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={onlyNonConformities}
                      onChange={(e) => setOnlyNonConformities(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600"
                    />
                    <span>Apenas NCs</span>
                  </label>
                </div>

                <span className="font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
                  {visibleObjects.length} máscaras
                </span>
              </div>

              <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-950 dark:border-slate-800">
                <img
                  src={imageDataUrl}
                  alt={imageName || 'Imagem do painel enviada pelo usuário'}
                  referrerPolicy="no-referrer"
                  className="block w-full h-auto"
                />

                {showPixelMaskPng && auditResult?.maskOverlayPngDataUrl && (
                  <img
                    src={auditResult.maskOverlayPngDataUrl}
                    alt="Máscara de segmentação pixel-a-pixel"
                    className="pointer-events-none absolute inset-0 h-full w-full object-fill"
                  />
                )}

                {auditResult && (
                  <svg
                    viewBox="0 0 1000 1000"
                    preserveAspectRatio="none"
                    className="pointer-events-auto absolute inset-0 h-full w-full"
                    aria-label="Camada de contornos matemáticos extraídos"
                  >
                    {visibleObjects.map((obj) => {
                      const colors = getMaskColors(obj.severity);
                      const isSelected = selectedObject?.id === obj.id;
                      const [ymin, xmin, ymax, xmax] = obj.bbox;
                      const pointsStr = obj.polygon.map((p) => `${p.x},${p.y}`).join(' ');

                      return (
                        <g
                          key={obj.id}
                          onClick={() => setSelectedMaskId(obj.id)}
                          className="cursor-pointer"
                        >
                          {showPolygons && obj.polygon.length >= 3 && (
                            <polygon
                              points={pointsStr}
                              fill={isSelected ? colors.fill : 'transparent'}
                              stroke={colors.stroke}
                              strokeWidth={isSelected ? 4 : 2}
                              strokeDasharray={
                                obj.category === 'uncontained_wiring_zone' ? '10 5' : undefined
                              }
                            />
                          )}
                          {showBoxes && (
                            <rect
                              x={xmin}
                              y={ymin}
                              width={Math.max(8, xmax - xmin)}
                              height={Math.max(8, ymax - ymin)}
                              fill="transparent"
                              stroke={colors.stroke}
                              strokeWidth={isSelected ? 3.5 : 1.5}
                              strokeDasharray="6 4"
                            />
                          )}
                        </g>
                      );
                    })}
                  </svg>
                )}
              </div>

              {auditResult?.contextClassification && (
                <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-200 dark:border-slate-800 dark:bg-slate-900 dark:divide-slate-800">
                  <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        Classificação Contextual (Objeto ↔ Documento · {tierLevel.replace('_', ' ')})
                      </div>
                      <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                        {auditResult.contextClassification.detectedPanelType}
                      </h2>
                    </div>

                    <button
                      type="button"
                      disabled={isRemediating}
                      onClick={handleApplyPatchToImageAndDocument}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-60 dark:bg-blue-600 dark:hover:bg-blue-500 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <GitCommit className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>
                        {isRemediating
                          ? 'Gerando Patch Visual + CAD...'
                          : 'Aplicar Patch na Imagem + Doc (CAD NURBS)'}
                      </span>
                    </button>
                  </div>

                  <div className="divide-y divide-slate-100 dark:divide-slate-800/70">
                    {auditResult.contextClassification.alignmentChecklist.map((chk) => (
                      <div key={chk.criterion} className="flex items-start gap-3 px-4 py-3 text-xs">
                        {chk.passed ? (
                          <CheckCircle2
                            className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5"
                            aria-hidden="true"
                          />
                        ) : (
                          <XCircle
                            className="h-4 w-4 text-red-600 shrink-0 mt-0.5"
                            aria-hidden="true"
                          />
                        )}
                        <div>
                          <div className="font-semibold text-slate-900 dark:text-slate-100">
                            {chk.criterion}
                          </div>
                          <div className="mt-0.5 text-slate-600 dark:text-slate-400">
                            {chk.detail}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="lg:col-span-5 space-y-4">
              <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-200 dark:border-slate-800 dark:bg-slate-900 dark:divide-slate-800">
                <div className="px-4 py-3 flex items-center justify-between">
                  <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Objetos &amp; Máscaras Extraídas (CCL)
                  </h2>
                  <span className="font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
                    {isAnalyzing ? 'Calculando...' : `${visibleObjects.length} itens`}
                  </span>
                </div>

                {visibleObjects.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">
                    {isAnalyzing
                      ? 'Extraindo máscaras binárias, contornos e prova VUC...'
                      : 'Nenhum componente encontrado para o filtro selecionado.'}
                  </div>
                ) : (
                  <div className="max-h-[340px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/70">
                    {visibleObjects.map((obj) => {
                      const colors = getMaskColors(obj.severity);
                      const isSelected = selectedObject?.id === obj.id;
                      return (
                        <button
                          key={obj.id}
                          type="button"
                          onClick={() => setSelectedMaskId(obj.id)}
                          className={`w-full px-4 py-3 text-left transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-slate-100/90 dark:bg-slate-800/80'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-xs font-semibold text-slate-900 dark:text-slate-100">
                              {obj.label}
                            </span>
                            <div className="flex items-center gap-2 text-xs">
                              <span className="font-semibold" style={{ color: colors.stroke }}>
                                {colors.label}
                              </span>
                              <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
                                {obj.metrics.pixelCount} px
                              </span>
                            </div>
                          </div>
                          <div className="mt-1 text-xs font-medium text-slate-700 dark:text-slate-300">
                            {obj.findingTitle}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {selectedObject && (
                <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3 dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {selectedObject.normativeRef}
                      </div>
                      <h3 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                        {selectedObject.findingTitle}
                      </h3>
                    </div>
                    {selectedObject.severity === NCSeverity.COMPLIANT ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" aria-hidden="true" />
                    ) : (
                      <AlertOctagon className="h-5 w-5 text-red-600 shrink-0" aria-hidden="true" />
                    )}
                  </div>

                  <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                    {selectedObject.description}
                  </p>

                  <div className="grid grid-cols-3 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-xs tabular-nums dark:border-slate-800 dark:bg-slate-950">
                    <div>
                      <div className="text-slate-500">Área</div>
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        {selectedObject.metrics.areaPercent}%
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500">Fill Ratio</div>
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        {selectedObject.metrics.fillRatio}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500">Hue Médio</div>
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        {selectedObject.metrics.meanHueDeg}°
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
                    <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1">
                      Ação Corretiva Recomendada
                    </div>
                    <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                      {selectedObject.remediation}
                    </p>
                  </div>
                </div>
              )}

              {/* Card Prova Criptográfica scoobiii/vuc */}
              {(cadPatchPkg?.vucProof ?? auditResult?.vucProof) && (
                <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2.5 dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-slate-100">
                      <ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                      <span>Prova de Execução · scoobiii/vuc (Ed25519 + RFC 8785)</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleVerifyVucProof}
                      className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      Verificar Assinatura
                    </button>
                  </div>
                  <div className="space-y-1 font-mono text-[11px] text-slate-600 dark:text-slate-400 break-all">
                    <div>
                      execution_id: {(cadPatchPkg?.vucProof ?? auditResult?.vucProof)?.executionId}
                    </div>
                    <div>
                      input_hash: {(cadPatchPkg?.vucProof ?? auditResult?.vucProof)?.inputHash}
                    </div>
                    <div>
                      proof_hash: {(cadPatchPkg?.vucProof ?? auditResult?.vucProof)?.proofHash}
                    </div>
                    <div>
                      key_id: {(cadPatchPkg?.vucProof ?? auditResult?.vucProof)?.keyId} · status:{' '}
                      <strong className="text-emerald-700 dark:text-emerald-400">
                        {(cadPatchPkg?.vucProof ?? auditResult?.vucProof)?.verificationStatus}
                      </strong>
                    </div>
                  </div>
                  {vucVerifyResult && (
                    <div className="rounded-md bg-emerald-50 px-3 py-1.5 font-mono text-[11px] text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
                      Verificação independente: {vucVerifyResult}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Solução Visual Gerada na Aplicação do Patch Versionado + Binários CAD/NURBS */}
          {cadPatchPkg && (
            <div className="rounded-xl border border-emerald-200 bg-white p-5 space-y-5 dark:border-emerald-900/60 dark:bg-slate-900">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-4 dark:border-slate-800">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                    <Sparkles className="h-4 w-4" aria-hidden="true" />
                    <span>
                      Solução Visual Normativa Aplicada · {cadPatchPkg.patchVersion} ·{' '}
                      {cadPatchPkg.tierLevel.replace('_', ' ')}
                    </span>
                  </div>
                  <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
                    Auditoria (Antes) → Solução CAD/NURBS em Conformidade (Depois)
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    {cadPatchPkg.nurbsSummary.conformanceNote}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      downloadSvgAsPng(
                        cadPatchPkg.remediationSvg,
                        `qta-solucao-${cadPatchPkg.patchVersion}.png`
                      )
                    }
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600 cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Baixar Solução .PNG</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      downloadTextBlob(
                        cadPatchPkg.binaries.igesContent,
                        `qta-nurbs-${cadPatchPkg.patchVersion}.igs`
                      )
                    }
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 cursor-pointer"
                  >
                    <Box className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>IGES NURBS (.igs)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      downloadTextBlob(
                        cadPatchPkg.binaries.dxfContent,
                        `qta-planta-${cadPatchPkg.patchVersion}.dxf`
                      )
                    }
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 cursor-pointer"
                  >
                    <span>AutoCAD (.dxf)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      downloadBase64Binary(
                        cadPatchPkg.binaries.stlBinaryBase64,
                        `qta-painel-3d-${cadPatchPkg.patchVersion}.stl`
                      )
                    }
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 cursor-pointer"
                  >
                    <span>Binário 3D (.stl · {cadPatchPkg.binaries.stlTrianglesCount}Δ)</span>
                  </button>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-red-700 dark:text-red-400">
                    AUDITORIA · Imagem Original com NCs Detectadas
                  </div>
                  <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-950 dark:border-slate-800">
                    <img
                      src={imageDataUrl}
                      alt="Painel auditado original"
                      className="w-full h-auto block"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                    SOLUÇÃO NORMATIVA · {cadPatchPkg.normativeStandards.join(' · ')}
                  </div>
                  <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-950 dark:border-slate-800">
                    {cadPatchPkg.remediationImageDataUrl ? (
                      <img
                        src={cadPatchPkg.remediationImageDataUrl}
                        alt="Painel QTA corrigido via servidor visual"
                        className="w-full h-auto block"
                      />
                    ) : (
                      <img
                        src={`data:image/svg+xml;utf8,${encodeURIComponent(cadPatchPkg.remediationSvg)}`}
                        alt="Diagrama CAD/NURBS normativo corrigido Fig. 03"
                        className="w-full h-auto block"
                      />
                    )}
                  </div>
                </div>
              </div>

              <ul className="grid gap-2 sm:grid-cols-2 text-xs text-slate-700 dark:text-slate-300 list-disc pl-5">
                {cadPatchPkg.appliedCorrections.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {auditHistory.length > 0 && (
        <LooseWireHistoryChart history={auditHistory} onClearHistory={onClearVisualHistory} />
      )}
    </section>
  );
};
