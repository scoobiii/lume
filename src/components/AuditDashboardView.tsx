/**
 * @file AuditDashboardView.tsx
 * @responsibility Dashboard analítico em Recharts exibindo 'Não Conformidades por Tier' (Gráfico de Rosca) e 'Tendência de Conformidade ao longo do tempo' (Gráfico de Linha) a partir do histórico persistido em SQLite RAID-1 e Firebase.
 * @version 1.0.0
 * @date 2026-11-15
 * @directory /src/components/AuditDashboardView.tsx
 * @signature PO Zeh Sobrinho & Senior Agile DevOps Team (AI Framework)
 */

import React, { useMemo, useState } from 'react';
import { BarChart3, Plus, ShieldCheck } from 'lucide-react';
import {
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  DataCenterTier,
  EvidenceSourceType,
  PersistedAuditSummary,
} from '../types/audit';

interface AuditDashboardViewProps {
  historyItems: PersistedAuditSummary[];
  onSelectAudit: (auditId: string) => void;
  onStartNewAudit: () => void;
}

const TIER_COLORS: Record<DataCenterTier, string> = {
  TIER_I: '#0284C7',
  TIER_II: '#1E40AF',
  TIER_III: '#D97706',
  TIER_IV: '#DC2626',
};

const TIER_LABELS: Record<DataCenterTier, string> = {
  TIER_I: 'Tier I',
  TIER_II: 'Tier II',
  TIER_III: 'Tier III',
  TIER_IV: 'Tier IV',
};

function computeComplianceScore(item: PersistedAuditSummary): number {
  if (item.overallStatus === 'COMPLIANT') return 100;
  if (item.overallStatus === 'PARTIAL') {
    const penalty = Math.min(35, Math.round(item.looseWireAreaPercent * 1.5 + item.objectsCount * 3));
    return Math.max(55, 88 - penalty);
  }
  const penalty = Math.round(
    item.looseWireAreaPercent * 2.2 +
      item.exposedCopperAreaPercent * 3 +
      item.objectsCount * 6
  );
  return Math.max(12, Math.min(48, 52 - penalty));
}

function sourceLabel(st?: EvidenceSourceType): string {
  switch (st) {
    case 'image':
      return 'Imagem';
    case 'url':
      return 'URL';
    case 'repository':
      return 'Repositório';
    default:
      return 'Documento';
  }
}

export const AuditDashboardView: React.FC<AuditDashboardViewProps> = ({
  historyItems,
  onSelectAudit,
  onStartNewAudit,
}) => {
  const [sourceFilter, setSourceFilter] = useState<'ALL' | EvidenceSourceType>('ALL');

  const filteredItems = useMemo(() => {
    if (sourceFilter === 'ALL') return historyItems;
    return historyItems.filter((item) => (item.sourceType ?? 'document') === sourceFilter);
  }, [historyItems, sourceFilter]);

  const kpis = useMemo(() => {
    const total = filteredItems.length;
    if (total === 0) {
      return { total: 0, complianceRate: 0, totalNcs: 0, vucVerifiedCount: 0 };
    }
    const avgScore =
      filteredItems.reduce((acc, item) => acc + computeComplianceScore(item), 0) / total;
    const totalNcs = filteredItems.reduce((acc, item) => {
      if (item.overallStatus === 'COMPLIANT') return acc;
      return acc + Math.max(1, item.objectsCount);
    }, 0);
    const vucVerifiedCount = filteredItems.filter((i) => i.vucVerified).length;
    return {
      total,
      complianceRate: Math.round(avgScore),
      totalNcs,
      vucVerifiedCount,
    };
  }, [filteredItems]);

  // Dados para Gráfico de Rosca: "Não Conformidades por Tier"
  const tierDonutData = useMemo(() => {
    const counts: Record<DataCenterTier, number> = {
      TIER_I: 0,
      TIER_II: 0,
      TIER_III: 0,
      TIER_IV: 0,
    };
    for (const item of filteredItems) {
      if (item.overallStatus === 'COMPLIANT') continue;
      const t = item.tierLevel || 'TIER_III';
      counts[t] = (counts[t] || 0) + Math.max(1, item.objectsCount);
    }
    return (Object.keys(counts) as DataCenterTier[])
      .map((tier) => ({
        tier,
        name: TIER_LABELS[tier],
        value: counts[tier],
        color: TIER_COLORS[tier],
      }))
      .filter((d) => d.value > 0);
  }, [filteredItems]);

  const totalDonutNcs = useMemo(
    () => tierDonutData.reduce((acc, d) => acc + d.value, 0),
    [tierDonutData]
  );

  // Dados para Gráfico de Linha: "Tendência de Conformidade ao longo do tempo"
  const complianceTrendData = useMemo(() => {
    const ordered = [...filteredItems].sort((a, b) =>
      String(a.suppliedDate || '').localeCompare(String(b.suppliedDate || ''))
    );
    return ordered.map((item, idx) => ({
      index: idx + 1,
      dateLabel: `${item.suppliedDate || 'N/I'} (#${idx + 1})`,
      shortLabel: item.imageLabel.slice(0, 18),
      conformidade: computeComplianceScore(item),
      exposicaoFios: Number((item.looseWireAreaPercent || 0).toFixed(2)),
      tier: TIER_LABELS[item.tierLevel || 'TIER_III'],
    }));
  }, [filteredItems]);

  if (historyItems.length === 0) {
    return (
      <section aria-labelledby="dashboard-empty-heading" className="space-y-6">
        <div className="border-b border-slate-200 pb-5 dark:border-slate-800">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Recharts Analytics · SQLite RAID-1 + Firebase Firestore
          </div>
          <h1
            id="dashboard-empty-heading"
            className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100"
          >
            Dashboard de Conformidade &amp; Tendências
          </h1>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center space-y-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
            <BarChart3 className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="mx-auto max-w-md space-y-1.5">
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
              Nenhuma auditoria registrada ainda
            </h2>
            <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              Os gráficos de <strong className="font-semibold">Não Conformidades por Tier</strong> e{' '}
              <strong className="font-semibold">Tendência de Conformidade ao longo do tempo</strong> serão exibidos automaticamente com dados reais assim que você auditar sua primeira imagem, documento, URL ou repositório Git.
            </p>
          </div>
          <div>
            <button
              type="button"
              onClick={onStartNewAudit}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-600 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Enviar Primeira Evidência</span>
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="dashboard-heading" className="space-y-6">
      {/* Cabeçalho + Filtro de Canal */}
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between dark:border-slate-800">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>Recharts Analytics</span>
            <span aria-hidden="true">·</span>
            <span>Histórico SQLite RAID-1 + Firebase Firestore</span>
          </div>
          <h1
            id="dashboard-heading"
            className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100"
          >
            Dashboard de Auditorias &amp; Conformidade
          </h1>
        </div>

        <div
          role="group"
          aria-label="Filtrar métricas por tipo de evidência"
          className="inline-flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1 dark:border-slate-800 dark:bg-slate-900 self-start"
        >
          {(
            [
              { id: 'ALL', label: 'Todas' },
              { id: 'image', label: 'Imagens' },
              { id: 'document', label: 'Documentos' },
              { id: 'url', label: 'URLs' },
              { id: 'repository', label: 'Repositórios' },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setSourceFilter(opt.id)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                sourceFilter === opt.id
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Faixa de KPIs Tabulares */}
      <div className="grid grid-cols-2 gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="space-y-1">
          <div className="text-xs text-slate-500 dark:text-slate-400">Auditorias Registradas</div>
          <div className="font-mono text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">
            {kpis.total}
          </div>
        </div>
        <div className="space-y-1">
          <div className="text-xs text-slate-500 dark:text-slate-400">Conformidade Média</div>
          <div className="font-mono text-2xl font-semibold tabular-nums text-blue-700 dark:text-blue-400">
            {kpis.complianceRate}%
          </div>
        </div>
        <div className="space-y-1">
          <div className="text-xs text-slate-500 dark:text-slate-400">Não Conformidades</div>
          <div className="font-mono text-2xl font-semibold tabular-nums text-red-700 dark:text-red-400">
            {kpis.totalNcs}
          </div>
        </div>
        <div className="space-y-1">
          <div className="text-xs text-slate-500 dark:text-slate-400">Provas VUC Verificadas</div>
          <div className="font-mono text-2xl font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
            {kpis.vucVerifiedCount}/{kpis.total}
          </div>
        </div>
      </div>

      {/* Linha dos Gráficos Recharts: Rosca + Linha */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Gráfico de Rosca: Não Conformidades por Tier */}
        <div className="lg:col-span-5 rounded-xl border border-slate-200 bg-white p-5 space-y-4 dark:border-slate-800 dark:bg-slate-900">
          <div>
            <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
              Não Conformidades por Tier
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Distribuição de achados pendentes segundo classificação ANSI/TIA-942
            </p>
          </div>

          {tierDonutData.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center text-center text-xs text-slate-500 dark:text-slate-400">
              <ShieldCheck className="mb-2 h-6 w-6 text-emerald-600" aria-hidden="true" />
              <span>Nenhuma Não Conformidade ativa no filtro selecionado.</span>
            </div>
          ) : (
            <div className="relative h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={tierDonutData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={58}
                    outerRadius={90}
                    paddingAngle={3}
                    strokeWidth={1}
                  >
                    {tierDonutData.map((entry) => (
                      <Cell key={entry.tier} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: unknown, name: unknown) => [
                      `${String(val)} NC(s)`,
                      String(name),
                    ]}
                    contentStyle={{
                      fontSize: '12px',
                      borderRadius: '8px',
                      borderColor: '#CBD5E1',
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={28}
                    iconType="circle"
                    wrapperStyle={{ fontSize: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pb-6">
                <span className="font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
                  {totalDonutNcs}
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">NCs totais</span>
              </div>
            </div>
          )}
        </div>

        {/* Gráfico de Linha: Tendência de Conformidade ao longo do tempo */}
        <div className="lg:col-span-7 rounded-xl border border-slate-200 bg-white p-5 space-y-4 dark:border-slate-800 dark:bg-slate-900">
          <div>
            <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
              Tendência de Conformidade ao longo do tempo
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Evolução do índice de conformidade (%) e percentual de fiação exposta por auditoria
            </p>
          </div>

          {complianceTrendData.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-xs text-slate-500 dark:text-slate-400">
              Nenhum registro disponível para o filtro atual.
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={complianceTrendData}
                  margin={{ top: 8, right: 16, left: -12, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis
                    dataKey="dateLabel"
                    tick={{ fontSize: 11, fill: '#64748B' }}
                    tickMargin={6}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontSize: 11, fill: '#64748B' }}
                    unit="%"
                  />
                  <Tooltip
                    formatter={(val: unknown, name: unknown) => [
                      `${String(val)}%`,
                      name === 'conformidade' ? 'Conformidade' : 'Exposição Fiação',
                    ]}
                    labelFormatter={(label: unknown, payload) => {
                      const row = payload?.[0]?.payload as
                        | { shortLabel?: string; tier?: string }
                        | undefined;
                      return row
                        ? `${String(label)} · ${row.shortLabel} (${row.tier})`
                        : String(label);
                    }}
                    contentStyle={{
                      fontSize: '12px',
                      borderRadius: '8px',
                      borderColor: '#CBD5E1',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Line
                    type="monotone"
                    dataKey="conformidade"
                    name="Conformidade (%)"
                    stroke="#1E40AF"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: '#1E40AF' }}
                    activeDot={{ r: 6 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="exposicaoFios"
                    name="Fiação Exposta (%)"
                    stroke="#DC2626"
                    strokeWidth={2}
                    strokeDasharray="4 3"
                    dot={{ r: 3, fill: '#DC2626' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Tabela Compacta do Histórico Auditado */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
            Registros Consolidados ({filteredItems.length})
          </h2>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Clique em uma linha para abrir na área de trabalho
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Evidência</th>
                <th className="px-4 py-2.5 font-semibold">Tipo</th>
                <th className="px-4 py-2.5 font-semibold">Tier</th>
                <th className="px-4 py-2.5 font-semibold">Data</th>
                <th className="px-4 py-2.5 text-right font-semibold">Conformidade</th>
                <th className="px-4 py-2.5 text-right font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {filteredItems.map((item) => {
                const score = computeComplianceScore(item);
                return (
                  <tr
                    key={item.auditId}
                    onClick={() => onSelectAudit(item.auditId)}
                    className="h-10 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  >
                    <td className="px-4 py-2 font-medium text-slate-900 dark:text-slate-100 max-w-[260px] truncate">
                      {item.imageLabel}
                    </td>
                    <td className="px-4 py-2 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {sourceLabel(item.sourceType)}
                    </td>
                    <td className="px-4 py-2 font-mono tabular-nums text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {TIER_LABELS[item.tierLevel || 'TIER_III']}
                    </td>
                    <td className="px-4 py-2 font-mono tabular-nums text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {item.suppliedDate}
                    </td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                      {score}%
                    </td>
                    <td className="px-4 py-2 text-right whitespace-nowrap font-semibold">
                      <span
                        className={
                          item.overallStatus === 'COMPLIANT'
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : item.overallStatus === 'PARTIAL'
                              ? 'text-amber-700 dark:text-amber-400'
                              : 'text-red-700 dark:text-red-400'
                        }
                      >
                        {item.overallStatus === 'COMPLIANT'
                          ? 'Conforme'
                          : item.overallStatus === 'PARTIAL'
                            ? 'Parcial'
                            : 'Não Conforme'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};
