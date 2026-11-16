/**
 * @file LooseWireHistoryChart.tsx
 * @responsibility Componente de visualização de dados com Recharts para série histórica de porcentagem de área de fios soltos e cobre exposto nas auditorias visuais.
 * @version 1.0.0
 * @date 2026-11-15
 * @directory /src/components/LooseWireHistoryChart.tsx
 * @signature PO Zeh Sobrinho & Senior Agile DevOps Team (AI Framework)
 */

import React, { useMemo, useState } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3, Trash2 } from 'lucide-react';
import { VisualAuditHistoryEntry } from '../types/audit';

interface LooseWireHistoryChartProps {
  history: VisualAuditHistoryEntry[];
  onClearHistory: () => void;
}

interface ChartPoint extends VisualAuditHistoryEntry {
  indexLabel: string;
}

export const LooseWireHistoryChart: React.FC<LooseWireHistoryChartProps> = ({
  history,
  onClearHistory,
}) => {
  const [showCopperSeries, setShowCopperSeries] = useState<boolean>(true);

  const chartData: ChartPoint[] = useMemo(
    () =>
      history.map((item, idx) => ({
        ...item,
        indexLabel: `#${idx + 1} · ${item.timeLabel}`,
      })),
    [history]
  );

  const stats = useMemo(() => {
    if (history.length === 0) {
      return { latest: 0, average: 0, peak: 0 };
    }
    const latest = history[history.length - 1].looseWireAreaPercent;
    const sum = history.reduce((acc, item) => acc + item.looseWireAreaPercent, 0);
    const peak = Math.max(...history.map((item) => item.looseWireAreaPercent));
    return {
      latest,
      average: Number((sum / history.length).toFixed(2)),
      peak,
    };
  }, [history]);

  return (
    <section
      aria-labelledby="loose-wire-chart-heading"
      className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 overflow-hidden"
    >
      <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
            <BarChart3 className="h-4 w-4 text-blue-600" aria-hidden="true" />
            <h2 id="loose-wire-chart-heading" className="font-display">
              Histórico de Porcentagem de Área de Fios Soltos
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Série real acumulada por inspeção em pixels RGBA (ABNT NBR 5410 §6.2.11 · alvo ≤ 0,20%).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={showCopperSeries}
              onChange={(e) => setShowCopperSeries(e.target.checked)}
              className="rounded border-slate-300 text-amber-600"
            />
            <span>Exibir Cobre Exposto (%)</span>
          </label>

          {history.length > 0 && (
            <button
              type="button"
              onClick={onClearHistory}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Limpar Histórico</span>
            </button>
          )}
        </div>
      </div>

      {history.length === 0 ? (
        <div className="p-8 text-center space-y-1.5">
          <div className="text-sm font-medium text-slate-800 dark:text-slate-200">
            Nenhuma auditoria visual registrada nesta série ainda
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            Carregue ou reanalise fotografias de painéis acima para registrar medições reais de porcentagem de área de fios soltos ao longo do tempo.
          </p>
        </div>
      ) : (
        <div className="p-5 space-y-5">
          {/* Métricas resumo em linha única */}
          <div className="grid grid-cols-2 gap-4 border-b border-slate-100 pb-4 sm:grid-cols-4 dark:border-slate-800">
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Inspeções Reais</div>
              <div className="font-mono text-xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                {history.length}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Última Medição</div>
              <div className="font-mono text-xl font-semibold tabular-nums text-red-700 dark:text-red-400">
                {stats.latest.toFixed(2)}%
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Média da Série</div>
              <div className="font-mono text-xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                {stats.average.toFixed(2)}%
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Pico Detectado</div>
              <div className="font-mono text-xl font-semibold tabular-nums text-amber-700 dark:text-amber-400">
                {stats.peak.toFixed(2)}%
              </div>
            </div>
          </div>

          {/* Gráfico Recharts Responsivo */}
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={chartData}
                margin={{ top: 10, right: 16, left: 0, bottom: 4 }}
              >
                <defs>
                  <linearGradient id="looseWireAreaFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#DC2626" stopOpacity={0.22} />
                    <stop offset="95%" stopColor="#DC2626" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#CBD5E1"
                  strokeOpacity={0.45}
                  vertical={false}
                />
                <XAxis
                  dataKey="indexLabel"
                  tick={{ fontSize: 11, fill: '#64748B' }}
                  tickLine={false}
                  axisLine={{ stroke: '#CBD5E1' }}
                />
                <YAxis
                  unit="%"
                  tick={{ fontSize: 11, fill: '#64748B' }}
                  tickLine={false}
                  axisLine={false}
                  width={48}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || payload.length === 0) return null;
                    const point = payload[0].payload as ChartPoint;
                    return (
                      <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs shadow-sm dark:border-slate-700 dark:bg-slate-950">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">
                          {point.imageLabel}
                        </div>
                        <div className="font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                          {point.timeLabel}
                        </div>
                        <div className="mt-2 space-y-1 font-mono tabular-nums">
                          <div className="flex items-center justify-between gap-4 text-red-700 dark:text-red-400">
                            <span>Fios soltos:</span>
                            <span className="font-semibold">
                              {point.looseWireAreaPercent.toFixed(2)}%
                            </span>
                          </div>
                          {showCopperSeries && (
                            <div className="flex items-center justify-between gap-4 text-amber-700 dark:text-amber-400">
                              <span>Cobre exposto:</span>
                              <span className="font-semibold">
                                {point.exposedCopperAreaPercent.toFixed(2)}%
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }}
                />
                <ReferenceLine
                  y={0.2}
                  stroke="#16A34A"
                  strokeDasharray="4 4"
                  label={{
                    value: 'Limite 0,20%',
                    position: 'insideTopRight',
                    fill: '#16A34A',
                    fontSize: 11,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="looseWireAreaPercent"
                  name="Fios soltos (%)"
                  stroke="#DC2626"
                  strokeWidth={2}
                  fill="url(#looseWireAreaFill)"
                  dot={{ r: 4, fill: '#DC2626', strokeWidth: 0 }}
                  activeDot={{ r: 6 }}
                />
                {showCopperSeries && (
                  <Line
                    type="monotone"
                    dataKey="exposedCopperAreaPercent"
                    name="Cobre exposto (%)"
                    stroke="#D97706"
                    strokeWidth={2}
                    dot={{ r: 3, fill: '#D97706', strokeWidth: 0 }}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </section>
  );
};
