/**
 * @file EvidenceIntakePanel.tsx
 * @responsibility Tela inicial limpa exibida apenas quando nenhuma evidência está ativa — permite fornecer Imagem, Documento Anexo, URL ou Repositório Git com procedência.
 * @version 1.0.0
 * @date 2026-11-15
 * @directory /src/components/EvidenceIntakePanel.tsx
 * @signature PO Zeh Sobrinho & Senior Agile DevOps Team (AI Framework)
 */

import React, { useState } from 'react';
import {
  FileText,
  FolderGit2,
  Globe,
  Image as ImageIcon,
  Loader2,
  Upload,
} from 'lucide-react';
import {
  DataCenterTier,
  EvidenceIngestionResult,
  EvidenceSourceType,
} from '../types/audit';

interface EvidenceIntakePanelProps {
  defaultTier: DataCenterTier;
  onIngested: (result: EvidenceIngestionResult) => void;
}

export const EvidenceIntakePanel: React.FC<EvidenceIntakePanelProps> = ({
  defaultTier,
  onIngested,
}) => {
  const [sourceType, setSourceType] = useState<EvidenceSourceType>('image');
  const [tierLevel, setTierLevel] = useState<DataCenterTier>(defaultTier);
  const [suppliedBy, setSuppliedBy] = useState<string>('');
  const [suppliedDate, setSuppliedDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [sourceName, setSourceName] = useState<string>('');
  const [sourceUrl, setSourceUrl] = useState<string>('');

  const [fileName, setFileName] = useState<string>('');
  const [imageBase64, setImageBase64] = useState<string>('');
  const [mimeType, setMimeType] = useState<string>('image/png');
  const [documentText, setDocumentText] = useState<string>('');
  const [targetUrl, setTargetUrl] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleImageSelected = (file: File) => {
    setErrorMsg(null);
    setFileName(file.name);
    if (!sourceName.trim()) setSourceName(file.name);
    setMimeType(file.type || 'image/jpeg');
    const reader = new FileReader();
    reader.onload = async () => {
      const rawUrl = String(reader.result ?? '');
      setImageBase64(rawUrl);
      await submitIngestion({
        overrideType: 'image',
        overrideImageBase64: rawUrl,
        overrideMime: file.type || 'image/png',
        overrideFileName: file.name,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleDocFileSelected = (file: File) => {
    setErrorMsg(null);
    setFileName(file.name);
    if (!sourceName.trim()) setSourceName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setDocumentText(String(reader.result ?? ''));
    };
    reader.readAsText(file);
  };

  const submitIngestion = async (opts?: {
    overrideType?: EvidenceSourceType;
    overrideImageBase64?: string;
    overrideMime?: string;
    overrideFileName?: string;
  }) => {
    const activeType = opts?.overrideType ?? sourceType;
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/evidence/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceType: activeType,
          tierLevel,
          useAi: false,
          fileName: opts?.overrideFileName ?? (fileName || undefined),
          imageBase64: opts?.overrideImageBase64 ?? (imageBase64 || undefined),
          mimeType: opts?.overrideMime ?? mimeType,
          documentText: documentText || undefined,
          targetUrl: targetUrl.trim() || undefined,
          provenance: {
            suppliedBy: suppliedBy.trim() || 'Auditor / Usuário',
            suppliedDate,
            sourceName: sourceName.trim() || opts?.overrideFileName || fileName || targetUrl || 'Submissão Local',
            sourceUrl: sourceUrl.trim() || targetUrl.trim() || 'upload://local',
            sourceType: activeType,
          },
        }),
      });
      const json = (await res.json()) as EvidenceIngestionResult & { error?: string };
      if (!res.ok) {
        throw new Error(json.error ?? `Erro HTTP ${res.status}`);
      }
      onIngested(json);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Falha ao processar a evidência.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section aria-labelledby="intake-heading" className="max-w-3xl space-y-6">
      <div className="space-y-2">
        <h1
          id="intake-heading"
          className="font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-slate-100"
          style={{ textWrap: 'balance' }}
        >
          Forneça uma evidência para iniciar a auditoria
        </h1>
        <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
          Nenhum arquivo, URL ou repositório foi selecionado. Envie uma nova evidência abaixo ou selecione um registro no histórico lateral para retomar o trabalho.
        </p>
      </div>

      {/* Seletor de Tipo de Evidência */}
      <div className="inline-flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1 dark:border-slate-800 dark:bg-slate-900">
        {(
          [
            { id: 'image', label: 'Imagem', icon: ImageIcon },
            { id: 'document', label: 'Documento Anexo', icon: FileText },
            { id: 'url', label: 'URL Remota', icon: Globe },
            { id: 'repository', label: 'Repositório Git', icon: FolderGit2 },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const active = sourceType === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setSourceType(tab.id);
                setErrorMsg(null);
              }}
              className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                active
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-5 dark:border-slate-800 dark:bg-slate-900">
        {/* Entrada específica por tipo */}
        {sourceType === 'image' && (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f && f.type.startsWith('image/')) handleImageSelected(f);
            }}
            className="rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-10 text-center space-y-3 dark:border-slate-700 dark:bg-slate-950"
          >
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
              {isSubmitting ? (
                <Loader2 className="h-5 w-5 animate-spin text-blue-600" aria-hidden="true" />
              ) : (
                <Upload className="h-5 w-5" aria-hidden="true" />
              )}
            </div>
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {isSubmitting ? 'Processando pixels e gerando prova VUC...' : 'Selecione ou arraste uma imagem real (.jpg, .png, .webp)'}
            </div>
            <label className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-600 cursor-pointer">
              <Upload className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Escolher Arquivo de Imagem</span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleImageSelected(f);
                }}
                className="sr-only"
              />
            </label>
          </div>
        )}

        {sourceType === 'document' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Anexe um arquivo (.txt, .md, .json, .html, .csv, .log) ou cole o texto abaixo:
              </span>
              <label className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 cursor-pointer">
                <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{fileName ? `Anexo: ${fileName}` : 'Anexar Documento'}</span>
                <input
                  type="file"
                  accept=".txt,.md,.json,.csv,.html,.xml,.log,.yaml,.yml,.tex,.ts,.js,.py"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleDocFileSelected(f);
                  }}
                  className="sr-only"
                />
              </label>
            </div>
            <textarea
              value={documentText}
              onChange={(e) => setDocumentText(e.target.value)}
              rows={7}
              placeholder="Cole aqui o conteúdo técnico, memorial descritivo, log ou especificação para auditar..."
              className="w-full rounded-lg border border-slate-300 bg-slate-50 p-3 font-mono text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>
        )}

        {sourceType === 'url' && (
          <label className="block space-y-1.5 text-xs">
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              URL da Página, Documento Técnico ou Imagem Remota
            </span>
            <input
              type="url"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              placeholder="https://exemplo.com/especificacao-tecnica.html"
              className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3.5 py-2 font-mono text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </label>
        )}

        {sourceType === 'repository' && (
          <label className="block space-y-1.5 text-xs">
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              URL do Repositório Git / GitHub Público
            </span>
            <input
              type="url"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              placeholder="https://github.com/organizacao/repositorio"
              className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3.5 py-2 font-mono text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </label>
        )}

        {/* Procedência documental + Tier */}
        <div className="grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2 lg:grid-cols-4 dark:border-slate-800">
          <label className="space-y-1 text-xs">
            <span className="text-slate-600 dark:text-slate-400">Quem Forneceu</span>
            <input
              type="text"
              value={suppliedBy}
              onChange={(e) => setSuppliedBy(e.target.value)}
              placeholder="Nome ou equipe"
              className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </label>
          <label className="space-y-1 text-xs">
            <span className="text-slate-600 dark:text-slate-400">Data</span>
            <input
              type="date"
              value={suppliedDate}
              onChange={(e) => setSuppliedDate(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 font-mono text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </label>
          <label className="space-y-1 text-xs">
            <span className="text-slate-600 dark:text-slate-400">Nome da Fonte</span>
            <input
              type="text"
              value={sourceName}
              onChange={(e) => setSourceName(e.target.value)}
              placeholder="Ex.: Relatório Q3"
              className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </label>
          <label className="space-y-1 text-xs">
            <span className="text-slate-600 dark:text-slate-400">Classificação Tier</span>
            <select
              value={tierLevel}
              onChange={(e) => setTierLevel(e.target.value as DataCenterTier)}
              className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 font-mono text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              <option value="TIER_I">Tier I</option>
              <option value="TIER_II">Tier II</option>
              <option value="TIER_III">Tier III</option>
              <option value="TIER_IV">Tier IV</option>
            </select>
          </label>
        </div>

        {errorMsg && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
          >
            {errorMsg}
          </div>
        )}

        {sourceType !== 'image' && (
          <div className="flex justify-end">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => submitIngestion()}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 text-xs font-semibold text-white hover:bg-blue-600 disabled:opacity-60 cursor-pointer whitespace-nowrap"
            >
              {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
              <span>
                {isSubmitting ? 'Auditando & Gravando em RAID-1...' : 'Executar Auditoria'}
              </span>
            </button>
          </div>
        )}
      </div>
    </section>
  );
};
