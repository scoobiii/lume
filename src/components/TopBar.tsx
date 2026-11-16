/**
 * @file TopBar.tsx
 * @responsibility Barra superior pervasiva em 3 zonas estritas (marca única Lume, links concisos incluindo Git sempre acessível e ação primária contextual).
 * @version 3.1.0
 * @date 2026-11-15
 * @directory /src/components/TopBar.tsx
 * @signature PO Zeh Sobrinho & Senior Agile DevOps Team (AI Framework)
 */

import React, { useState } from 'react';
import { Download, Menu, Plus, X } from 'lucide-react';
import { WorkspaceTab } from '../types/audit';

interface TopBarProps {
  activeTab: WorkspaceTab;
  hasActiveCase: boolean;
  onSelectTab: (tab: WorkspaceTab) => void;
  onNewEvidence: () => void;
  onExportGitZip: () => void;
  exportingZip: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  hasActiveCase,
  onSelectTab,
  onNewEvidence,
  onExportGitZip,
  exportingZip,
}) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems: Array<{ id: WorkspaceTab; label: string }> = hasActiveCase
    ? [
        { id: WorkspaceTab.LANDING, label: 'Início' },
        { id: WorkspaceTab.DOCUMENT_AUDIT, label: 'Auditoria' },
        { id: WorkspaceTab.VISION_MASKS, label: 'Visão & CAD' },
        { id: WorkspaceTab.DASHBOARD, label: 'Dashboard' },
        { id: WorkspaceTab.GIT_VERSIONING, label: 'Git & API' },
      ]
    : [
        { id: WorkspaceTab.LANDING, label: 'Início' },
        { id: WorkspaceTab.DOCUMENT_AUDIT, label: 'Auditar' },
        { id: WorkspaceTab.DASHBOARD, label: 'Dashboard' },
        { id: WorkspaceTab.GIT_VERSIONING, label: 'Git & API' },
      ];

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-950/95">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center justify-between gap-8 px-4 sm:px-6 lg:px-8">
        {/* Zona 1: Brand Wordmark único */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            onSelectTab(WorkspaceTab.LANDING);
          }}
          className="font-display text-base font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded"
        >
          Lume
        </a>

        {/* Zona 2: Links concisos e pervasivos */}
        <nav aria-label="Navegação principal" className="hidden md:flex items-center gap-6">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`relative py-4 text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                  isActive
                    ? 'text-blue-700 dark:text-blue-400'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
              >
                {item.label}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 bottom-0 h-0.5 bg-blue-700 dark:bg-blue-400"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zona 3: 1 Ação primária */}
        <div className="flex items-center gap-3 shrink-0">
          {hasActiveCase ? (
            <button
              type="button"
              onClick={onExportGitZip}
              disabled={exportingZip}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-60 dark:bg-blue-600 dark:hover:bg-blue-500 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{exportingZip ? 'Empacotando...' : 'Exportar Git .zip'}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                onNewEvidence();
                onSelectTab(WorkspaceTab.DOCUMENT_AUDIT);
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-600 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Nova Evidência</span>
            </button>
          )}

          <button
            type="button"
            aria-label={mobileOpen ? 'Fechar menu' : 'Abrir menu'}
            onClick={() => setMobileOpen((prev) => !prev)}
            className="inline-flex md:hidden items-center justify-center rounded-lg border border-slate-200 p-2 text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-900"
          >
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <nav
          aria-label="Navegação móvel"
          className="border-t border-slate-200 bg-white px-4 py-3 md:hidden dark:border-slate-800 dark:bg-slate-950"
        >
          <div className="flex flex-col gap-1">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onSelectTab(item.id);
                    setMobileOpen(false);
                  }}
                  className={`rounded-md px-3 py-2 text-left text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                      : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </nav>
      )}
    </header>
  );
};
