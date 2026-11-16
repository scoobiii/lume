/**
 * @file HistorySidebar.tsx
 * @responsibility Barra lateral de histórico persistido em SQLite RAID-1 + Firebase Firestore, com filtro rápido, seleção de trabalho e autenticação Google opcional.
 * @version 1.0.0
 * @date 2026-11-15
 * @directory /src/components/HistorySidebar.tsx
 * @signature PO Zeh Sobrinho & Senior Agile DevOps Team (AI Framework)
 */

import React, { useMemo, useState } from 'react';
import {
  Database,
  FileText,
  FolderGit2,
  Globe,
  HardDrive,
  Image as ImageIcon,
  LogIn,
  LogOut,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import {
  EvidenceSourceType,
  PersistedAuditSummary,
  RaidStatusSummary,
} from '../types/audit';

interface HistorySidebarProps {
  historyItems: PersistedAuditSummary[];
  selectedAuditId: string | null;
  raidStatus: RaidStatusSummary | null;
  firebaseUserEmail: string | null;
  authError: string | null;
  onSelectAudit: (auditId: string) => void;
  onDeleteAudit: (auditId: string) => void;
  onNewEvidence: () => void;
  onGoogleSignIn: () => void;
  onGoogleSignOut: () => void;
}

function sourceTypeLabel(st?: EvidenceSourceType): string {
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

function SourceIcon({ type }: { type?: EvidenceSourceType }) {
  switch (type) {
    case 'image':
      return <ImageIcon className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden="true" />;
    case 'url':
      return <Globe className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden="true" />;
    case 'repository':
      return <FolderGit2 className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden="true" />;
    default:
      return <FileText className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden="true" />;
  }
}

export const HistorySidebar: React.FC<HistorySidebarProps> = ({
  historyItems,
  selectedAuditId,
  raidStatus,
  firebaseUserEmail,
  authError,
  onSelectAudit,
  onDeleteAudit,
  onNewEvidence,
  onGoogleSignIn,
  onGoogleSignOut,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return historyItems;
    return historyItems.filter(
      (item) =>
        item.imageLabel.toLowerCase().includes(q) ||
        item.suppliedBy.toLowerCase().includes(q) ||
        item.sourceName.toLowerCase().includes(q) ||
        item.sourceUrl.toLowerCase().includes(q)
    );
  }, [historyItems, searchTerm]);

  return (
    <aside
      aria-label="Histórico de evidências e persistência"
      className="w-full lg:w-[272px] shrink-0 space-y-4"
    >
      <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <h2 className="font-display text-xs font-semibold text-slate-900 dark:text-slate-100">
            Histórico de Auditorias
          </h2>
          <button
            type="button"
            onClick={onNewEvidence}
            className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 cursor-pointer whitespace-nowrap shrink-0"
          >
            <Plus className="h-3 w-3" aria-hidden="true" />
            <span>Nova</span>
          </button>
        </div>

        <div className="border-b border-slate-200 p-2.5 dark:border-slate-800">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400"
              aria-hidden="true"
            />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filtrar histórico..."
              aria-label="Filtrar histórico de auditorias"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>
        </div>

        <div className="max-h-[420px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/70">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              {historyItems.length === 0
                ? 'Nenhuma evidência salva ainda. Envie um arquivo, imagem, URL ou repositório para iniciar.'
                : 'Nenhum registro correspondente ao filtro.'}
            </div>
          ) : (
            filtered.map((item) => {
              const isSelected = selectedAuditId === item.auditId;
              return (
                <div
                  key={item.auditId}
                  className={`group flex items-start justify-between gap-2 px-3.5 py-3 transition-colors ${
                    isSelected
                      ? 'bg-blue-50/80 dark:bg-blue-950/40'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onSelectAudit(item.auditId)}
                    className="flex-1 min-w-0 text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5">
                      <SourceIcon type={item.sourceType} />
                      <span className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100">
                        {item.imageLabel}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                      <span>{sourceTypeLabel(item.sourceType)}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">{item.suppliedDate}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono">
                        {item.storageOrigin === 'both' ? 'RAID+Cloud' : 'RAID-1'}
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => onDeleteAudit(item.auditId)}
                    aria-label={`Remover ${item.imageLabel}`}
                    className="rounded p-1 text-slate-400 opacity-70 hover:bg-slate-200/60 hover:text-red-600 hover:opacity-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Armazenamento RAID-1 SQLite + Firebase */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 text-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
          <HardDrive className="h-4 w-4 text-blue-600" aria-hidden="true" />
          <span>Persistência RAID-1 &amp; Cloud</span>
        </div>

        <div className="space-y-1 text-[11px] text-slate-600 dark:text-slate-400 font-mono tabular-nums">
          <div className="flex justify-between">
            <span>SQLite Espelho A:</span>
            <span className="text-slate-900 dark:text-slate-200">
              {raidStatus?.mirrorAHealthy ? `${raidStatus.recordsMirrorA} reg` : 'Offline'}
            </span>
          </div>
          <div className="flex justify-between">
            <span>SQLite Espelho B:</span>
            <span className="text-slate-900 dark:text-slate-200">
              {raidStatus?.mirrorBHealthy ? `${raidStatus.recordsMirrorB} reg` : 'Offline'}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Modo Ativo:</span>
            <span className="text-slate-900 dark:text-slate-200">
              {firebaseUserEmail ? 'RAID-1 + Firebase' : 'RAID-1 Local'}
            </span>
          </div>
        </div>

        {authError && (
          <div className="text-[11px] text-red-600 dark:text-red-400">{authError}</div>
        )}

        <div className="border-t border-slate-100 pt-3 dark:border-slate-800">
          {firebaseUserEmail ? (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-700 dark:text-slate-300 truncate">
                <Database className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
                <span className="truncate">{firebaseUserEmail}</span>
              </div>
              <button
                type="button"
                onClick={onGoogleSignOut}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Desconectar Google</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onGoogleSignIn}
              className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
            >
              <LogIn className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Conectar Firebase (Google)</span>
            </button>
          )}
        </div>
      </div>
    </aside>
  );
};
