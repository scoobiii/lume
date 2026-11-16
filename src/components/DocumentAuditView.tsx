/**
 * @file DocumentAuditView.tsx
 * @responsibility Interface de auditoria de Não Conformidade (NC) normativa/documental, aplicação de patches corretivos e visualização de diff versionado.
 * @version 1.0.0
 * @date 2026-11-15
 * @directory /src/components/DocumentAuditView.tsx
 * @signature PO Zeh Sobrinho & Senior Agile DevOps Team (AI Framework)
 */

import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calculator,
  Check,
  CheckCircle2,
  FileDiff,
  FileText,
  GitCommit,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
} from 'lucide-react';
import { DATA_CENTER_TIER_SPECS } from '../data/senaiQtaCorpus';
import {
  DataCenterTier,
  DocumentNC,
  NCSeverity,
  VucProofEnvelope,
} from '../types/audit';
import { QtaLoadSimulator } from './QtaLoadSimulator';

interface DocumentAuditViewProps {
  caseTitle: string;
  sourceLabel: string;
  documentText: string;
  originalText: string;
  findings: DocumentNC[];
  auditSummary: string;
  analysisSource: string;
  isAuditing: boolean;
  currentVersion: string;
  tierLevel: DataCenterTier;
  latestVucProof?: VucProofEnvelope | null;
  onChangeTierLevel: (tier: DataCenterTier) => void;
  onChangeDocumentText: (next: string) => void;
  onRunAudit: (useAi: boolean) => void;
  onApplyFinding: (findingId: string) => void;
  onApplyAllFindings: () => void;
  onResetOriginal: () => void;
  onAppendTechnicalMemo?: (memo: string) => void;
}

type DocViewMode = 'findings' | 'diff' | 'editor' | 'simulator';

function severityLabel(sev: NCSeverity): { text: string; colorClass: string } {
  switch (sev) {
    case NCSeverity.CRITICAL:
      return {
        text: 'Crítica',
        colorClass: 'text-red-700 dark:text-red-400',
      };
    case NCSeverity.MAJOR:
      return {
        text: 'Maior',
        colorClass: 'text-amber-700 dark:text-amber-400',
      };
    case NCSeverity.MINOR:
      return {
        text: 'Menor',
        colorClass: 'text-slate-600 dark:text-slate-400',
      };
    default:
      return {
        text: 'Conforme',
        colorClass: 'text-emerald-700 dark:text-emerald-400',
      };
  }
}

export const DocumentAuditView: React.FC<DocumentAuditViewProps> = ({
  caseTitle,
  sourceLabel,
  documentText,
  originalText,
  findings,
  auditSummary,
  analysisSource,
  isAuditing,
  currentVersion,
  tierLevel,
  latestVucProof,
  onChangeTierLevel,
  onChangeDocumentText,
  onRunAudit,
  onApplyFinding,
  onApplyAllFindings,
  onResetOriginal,
  onAppendTechnicalMemo,
}) => {
  const [viewMode, setViewMode] = useState<DocViewMode>('findings');
  const [severityFilter, setSeverityFilter] = useState<'ALL' | NCSeverity>('ALL');
  const [useAiEngine, setUseAiEngine] = useState(false);
  const tierSpec = DATA_CENTER_TIER_SPECS[tierLevel];

  const pendingCount = useMemo(
    () => findings.filter((f) => !f.applied).length,
    [findings]
  );
  const resolvedCount = useMemo(
    () => findings.filter((f) => f.applied).length,
    [findings]
  );

  const filteredFindings = useMemo(() => {
    if (severityFilter === 'ALL') return findings;
    return findings.filter((f) => f.severity === severityFilter);
  }, [findings, severityFilter]);

  const diffLines = useMemo(() => {
    const origLines = originalText.split('\n');
    const currLines = documentText.split('\n');
    const maxLen = Math.max(origLines.length, currLines.length);
    const rows: Array<{
      lineNumber: number;
      before: string;
      after: string;
      changed: boolean;
    }> = [];
    for (let i = 0; i < maxLen; i++) {
      const b = origLines[i] ?? '';
      const a = currLines[i] ?? '';
      rows.push({
        lineNumber: i + 1,
        before: b,
        after: a,
        changed: b !== a,
      });
    }
    return rows;
  }, [originalText, documentText]);

  return (
    <section aria-labelledby="doc-audit-heading" className="space-y-6">
      {/* Cabeçalho contextual da página */}
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 lg:flex-row lg:items-end lg:justify-between dark:border-slate-800">
        <div className="max-w-3xl space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>{sourceLabel}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{currentVersion}</span>
            <span aria-hidden="true">·</span>
            <span>NBR 5410 · NR-10 · ABNT NBR 14724 · ANSI/TIA-942</span>
          </div>
          <h1
            id="doc-audit-heading"
            className="font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-slate-100"
            style={{ textWrap: 'balance' }}
          >
            {caseTitle}
          </h1>
          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            {auditSummary}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={useAiEngine}
              onChange={(e) => setUseAiEngine(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
            />
            <span>Motor Semântico Gemini + Regras ABNT</span>
          </label>

          <button
            type="button"
            onClick={() => onRunAudit(useAiEngine)}
            disabled={isAuditing}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isAuditing ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            <span>{isAuditing ? 'Auditando...' : 'Reexecutar Auditoria'}</span>
          </button>

          <button
            type="button"
            onClick={onApplyAllFindings}
            disabled={pendingCount === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-600 dark:hover:bg-blue-500 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Corrigir Todas ({pendingCount})</span>
          </button>
        </div>
      </div>

      {/* Faixa de métricas em linha horizontal sem aninhamento de cartões */}
      <div className="grid grid-cols-2 gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="space-y-1">
          <div className="text-xs text-slate-500 dark:text-slate-400">NCs Pendentes</div>
          <div className="font-mono text-2xl font-semibold tabular-nums text-red-700 dark:text-red-400">
            {pendingCount}
          </div>
        </div>
        <div className="space-y-1">
          <div className="text-xs text-slate-500 dark:text-slate-400">NCs Corrigidas</div>
          <div className="font-mono text-2xl font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
            {resolvedCount}
          </div>
        </div>
        <div className="space-y-1">
          <div className="text-xs text-slate-500 dark:text-slate-400">Versão Atual</div>
          <div className="font-mono text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-100">
            {currentVersion}
          </div>
        </div>
        <div className="space-y-1">
          <div className="text-xs text-slate-500 dark:text-slate-400">Motor Ativo</div>
          <div className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
            {analysisSource === 'gemini-4-hydrogen'
              ? 'Gemini Multimodal + ABNT'
              : 'Motor Normativo ABNT/TIA-942'}
          </div>
        </div>
      </div>

      {/* Seletor Data Center Tier I, II, III e IV (Elétrica · Infra · Segurança) */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
              Classificação Normativa Data Center · ANSI/TIA-942 &amp; Uptime Tier I–IV
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {tierSpec.availability} · {tierSpec.redundancy} · {tierSpec.spofTolerance}
            </div>
          </div>
          <div className="inline-flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1 border border-slate-200 dark:bg-slate-950 dark:border-slate-800">
            {(['TIER_I', 'TIER_II', 'TIER_III', 'TIER_IV'] as DataCenterTier[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => onChangeTierLevel(t)}
                className={`rounded-md px-3 py-1.5 font-mono text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
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

        <div className="grid gap-4 border-t border-slate-100 pt-3 md:grid-cols-3 text-xs dark:border-slate-800">
          <div>
            <div className="font-semibold text-slate-800 dark:text-slate-200 mb-1">
              Elétrica ({tierLevel.replace('_', ' ')})
            </div>
            <ul className="space-y-1 text-slate-600 dark:text-slate-400 list-disc pl-4">
              {tierSpec.electricalRequirements.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div>
            <div className="font-semibold text-slate-800 dark:text-slate-200 mb-1">
              Infraestrutura Crítica
            </div>
            <ul className="space-y-1 text-slate-600 dark:text-slate-400 list-disc pl-4">
              {tierSpec.infraRequirements.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div>
            <div className="font-semibold text-slate-800 dark:text-slate-200 mb-1">
              Segurança NR-10 / NFPA 70E
            </div>
            <ul className="space-y-1 text-slate-600 dark:text-slate-400 list-disc pl-4">
              {tierSpec.safetyRequirements.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>

        {latestVucProof && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 font-mono text-xs text-slate-600 dark:border-slate-800 dark:text-slate-400">
            <span>
              scoobiii/vuc Proof: <strong className="text-emerald-700 dark:text-emerald-400">{latestVucProof.verificationStatus}</strong> · {latestVucProof.executionId}
            </span>
            <span className="truncate max-w-md">
              proof_hash: {latestVucProof.proofHash}
            </span>
          </div>
        )}
      </div>

      {/* Toolbar de alternância de visão e filtros */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 self-start">
          <button
            type="button"
            onClick={() => setViewMode('findings')}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              viewMode === 'findings'
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Achados NC ({findings.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('diff')}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              viewMode === 'diff'
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <FileDiff className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Git Diff Lado a Lado</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('editor')}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              viewMode === 'editor'
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <FileText className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Documento Editável</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('simulator')}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              viewMode === 'simulator'
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <Calculator className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Simulador de Carga (NBR 5410)</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {viewMode === 'findings' && (
            <div className="inline-flex items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              {(['ALL', NCSeverity.CRITICAL, NCSeverity.MAJOR, NCSeverity.MINOR] as const).map(
                (sev) => (
                  <button
                    key={sev}
                    type="button"
                    onClick={() => setSeverityFilter(sev)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      severityFilter === sev
                        ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100'
                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                    }`}
                  >
                    {sev === 'ALL'
                      ? 'Todas'
                      : sev === NCSeverity.CRITICAL
                        ? 'Críticas'
                        : sev === NCSeverity.MAJOR
                          ? 'Maiores'
                          : 'Menores'}
                  </button>
                )
              )}
            </div>
          )}

          <button
            type="button"
            onClick={onResetOriginal}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Restaurar Original (v1.0.0)</span>
          </button>
        </div>
      </div>

      {/* Conteúdo principal por modo */}
      {viewMode === 'findings' && (
        <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
          {filteredFindings.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
              Nenhuma Não Conformidade encontrada para o filtro selecionado.
            </div>
          ) : (
            filteredFindings.map((nc) => {
              const sev = severityLabel(nc.severity);
              return (
                <article key={nc.id} className="p-5 sm:p-6 space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                          {nc.code}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className={`font-semibold ${sev.colorClass}`}>
                          {nc.applied ? 'Corrigida' : `Severidade: ${sev.text}`}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{nc.normativeClause}</span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">{nc.lineRange}</span>
                      </div>
                      <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
                        {nc.title}
                      </h2>
                    </div>

                    <button
                      type="button"
                      onClick={() => onApplyFinding(nc.id)}
                      disabled={nc.applied}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        nc.applied
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 cursor-default'
                          : 'bg-slate-900 text-white hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500'
                      }`}
                    >
                      {nc.applied ? (
                        <>
                          <Check className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Patch Versionado</span>
                        </>
                      ) : (
                        <>
                          <GitCommit className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Aplicar Correção</span>
                        </>
                      )}
                    </button>
                  </div>

                  <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                    {nc.description}
                  </p>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-950">
                      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-red-700 dark:text-red-400">
                        <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Trecho Original (Não Conforme)</span>
                      </div>
                      <pre className="whitespace-pre-wrap font-mono text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                        {nc.replacementBefore}
                      </pre>
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-950">
                      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Correção Normativa Proposta</span>
                      </div>
                      <pre className="whitespace-pre-wrap font-mono text-xs text-slate-800 dark:text-slate-200 leading-relaxed">
                        {nc.replacementAfter}
                      </pre>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      )}

      {viewMode === 'diff' && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="grid grid-cols-1 border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-700 md:grid-cols-2 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
            <div>Original · v1.0.0-raw-scorm</div>
            <div>Corrigido · {currentVersion}</div>
          </div>
          <div className="max-h-[560px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/70">
            {diffLines.map((row) => (
              <div
                key={row.lineNumber}
                className={`grid grid-cols-1 md:grid-cols-2 text-xs font-mono ${
                  row.changed
                    ? 'bg-amber-50/40 dark:bg-amber-950/20'
                    : ''
                }`}
              >
                <div className="flex gap-3 border-b md:border-b-0 md:border-r border-slate-200 px-3 py-1.5 dark:border-slate-800">
                  <span className="w-7 shrink-0 select-none text-right tabular-nums text-slate-400">
                    {row.lineNumber}
                  </span>
                  <span
                    className={`whitespace-pre-wrap break-words ${
                      row.changed
                        ? 'text-red-800 dark:text-red-300'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {row.before || ' '}
                  </span>
                </div>
                <div className="flex gap-3 px-3 py-1.5">
                  <span className="w-7 shrink-0 select-none text-right tabular-nums text-slate-400">
                    {row.lineNumber}
                  </span>
                  <span
                    className={`whitespace-pre-wrap break-words ${
                      row.changed
                        ? 'text-emerald-800 dark:text-emerald-300 font-medium'
                        : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {row.after || ' '}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {viewMode === 'editor' && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>
              Cole outro documento técnico ou edite diretamente e clique em{' '}
              <strong className="text-slate-800 dark:text-slate-200">Reexecutar Auditoria</strong>.
            </span>
            <span className="font-mono tabular-nums">{documentText.length} caracteres</span>
          </div>
          <textarea
            value={documentText}
            onChange={(e) => onChangeDocumentText(e.target.value)}
            rows={20}
            aria-label="Editor do documento técnico para auditoria NC"
            className="w-full rounded-lg border border-slate-300 bg-slate-50 p-4 font-mono text-xs leading-relaxed text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </div>
      )}

      {viewMode === 'simulator' && (
        <QtaLoadSimulator onAppendTechnicalMemo={onAppendTechnicalMemo} />
      )}
    </section>
  );
};
