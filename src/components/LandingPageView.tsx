/**
 * @file LandingPageView.tsx
 * @responsibility Landing Page principal do Lume (lume-nc-auditor) no preview inicial com hierarquia editorial, capacidades reais e acesso direto à auditoria, Dashboard e Git.
 * @version 1.0.0
 * @date 2026-11-15
 * @directory /src/components/LandingPageView.tsx
 * @signature PO Zeh Sobrinho & Senior Agile DevOps Team (AI Framework)
 */

import React, { useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  FileText,
  FolderGit2,
  Globe,
  HardDrive,
  Image as ImageIcon,
  Layers,
  ShieldCheck,
} from 'lucide-react';
import heroSwitchgearImg from '../assets/images/hero_lume_engineering_1794796547347.jpg';
import { RaidStatusSummary, WorkspaceTab } from '../types/audit';

interface LandingPageViewProps {
  auditsCount: number;
  raidStatus: RaidStatusSummary | null;
  onStartAudit: () => void;
  onNavigateTab: (tab: WorkspaceTab) => void;
}

export const LandingPageView: React.FC<LandingPageViewProps> = ({
  auditsCount,
  raidStatus,
  onStartAudit,
  onNavigateTab,
}) => {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <div className="space-y-12 py-2">
      {/* Bloco 1: Hero Split (Proposição + Visual Arquitetural 16:9) */}
      <section aria-labelledby="lume-hero-heading" className="space-y-6">
        <div className="grid gap-8 lg:grid-cols-12 items-stretch">
          <div className="lg:col-span-6 flex flex-col justify-between space-y-6 py-2">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span>Repositório lume-nc-auditor</span>
                <span aria-hidden="true">·</span>
                <span>ABNT NBR 5410 · NR-10 · ANSI/TIA-942</span>
                <span aria-hidden="true">·</span>
                <span>SQLite RAID-1 + Firebase</span>
              </div>

              <h1
                id="lume-hero-heading"
                className="font-display font-bold tracking-tight text-slate-900 dark:text-slate-100 leading-[1.12]"
                style={{ fontSize: 'clamp(2.25rem, 3.8vw, 3.25rem)', textWrap: 'balance' }}
              >
                Auditoria normativa de evidências com prova criptográfica
              </h1>

              <p className="max-w-xl text-base leading-relaxed text-slate-600 dark:text-slate-400">
                O Lume inspeciona imagens de painéis elétricos, documentos técnicos, páginas HTML remotas e repositórios Git sem depender de inferência alucinada de modelos ou API keys externas. Cada laudo gera máscaras reais em pixels, solução CAD/NURBS e assinatura Ed25519 persistida em RAID-1 espelhado.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <button
                type="button"
                onClick={onStartAudit}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-600 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              >
                <span>Iniciar Auditoria</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={() => onNavigateTab(WorkspaceTab.DASHBOARD)}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <BarChart3 className="h-4 w-4 text-slate-500" aria-hidden="true" />
                <span>Ver Dashboard</span>
              </button>

              <button
                type="button"
                onClick={() => onNavigateTab(WorkspaceTab.GIT_VERSIONING)}
                className="inline-flex items-center gap-1.5 px-2 py-2 text-sm font-medium text-slate-700 underline-offset-4 hover:text-blue-700 hover:underline dark:text-slate-300 dark:hover:text-blue-400 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <FolderGit2 className="h-4 w-4" aria-hidden="true" />
                <span>Explorar Git &amp; API</span>
              </button>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="relative h-full min-h-[280px] overflow-hidden rounded-xl border border-slate-200 bg-slate-900 dark:border-slate-800">
              {!imgFailed ? (
                <img
                  src={heroSwitchgearImg}
                  alt="Sala elétrica de alta disponibilidade com quadros em aço escovado e barramentos protegidos em policarbonato"
                  referrerPolicy="no-referrer"
                  onError={() => setImgFailed(true)}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-8 text-center">
                  <div className="space-y-2">
                    <Layers className="mx-auto h-8 w-8 text-blue-400" aria-hidden="true" />
                    <div className="font-display text-sm font-semibold text-white">
                      Lume · Engenharia Normativa &amp; Visão Determinística
                    </div>
                  </div>
                </div>
              )}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/85 via-slate-950/35 to-transparent p-5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-200 font-mono tabular-nums">
                  <span>Motor CV: HSV + Sobel 3×3 + CCL</span>
                  <span>Padrão: TIA-942 Tier I–IV · NBR 5410 · NR-10</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Faixa de capacidades em linha completa abaixo do Hero Split */}
        <div className="grid grid-cols-1 divide-y sm:grid-cols-2 sm:divide-y-0 sm:divide-x lg:grid-cols-4 divide-slate-200 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
          <div className="p-5 space-y-1.5">
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              01. Ingestão Multi-Fonte
            </div>
            <div className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
              4 formatos reais de entrada
            </div>
            <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              Imagem, documento anexo, URL remota com proteção SSRF e repositório GitHub público.
            </p>
          </div>

          <div className="p-5 space-y-1.5">
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              02. Persistência SQLite RAID-1
            </div>
            <div className="font-mono text-base font-semibold tabular-nums text-slate-900 dark:text-slate-100">
              {raidStatus
                ? `${raidStatus.recordsMirrorA} A / ${raidStatus.recordsMirrorB} B espelhos`
                : `${auditsCount} auditorias salvas`}
            </div>
            <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              Gravação dupla com checksum SHA-256 e auto-cura local sem API key + sync Firebase.
            </p>
          </div>

          <div className="p-5 space-y-1.5">
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              03. Engenharia CAD/NURBS
            </div>
            <div className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
              IGES 126 · DXF · STL 3D
            </div>
            <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              Ao aplicar patch versionado, gera planta corrigida em conformidade e binários CAD reais.
            </p>
          </div>

          <div className="p-5 space-y-1.5">
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              04. Prova scoobiii/vuc
            </div>
            <div className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
              Ed25519 + RFC 8785 JCS
            </div>
            <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              Hash determinístico de entrada e saída verificável via endpoint MCP JSON-RPC 2.0.
            </p>
          </div>
        </div>
      </section>

      {/* Bloco 2: Bento Assimétrico de Canais de Evidência & Governança */}
      <section aria-labelledby="lume-channels-heading" className="space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between border-b border-slate-200 pb-4 dark:border-slate-800">
          <div>
            <h2
              id="lume-channels-heading"
              className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100"
            >
              Fluxo operacional sob demanda
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              A área de trabalho permanece limpa até que você forneça uma evidência ou abra um histórico salvo.
            </p>
          </div>
          <button
            type="button"
            onClick={onStartAudit}
            className="text-xs font-semibold text-blue-700 hover:underline dark:text-blue-400 whitespace-nowrap shrink-0 cursor-pointer"
          >
            Abrir portal de ingestão →
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-7 rounded-xl border border-slate-200 bg-white p-6 space-y-5 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">
              Canais suportados pelo motor Lume
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 border-t border-slate-100 pt-3 dark:border-slate-800">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-slate-100">
                  <ImageIcon className="h-4 w-4 text-blue-700 dark:text-blue-400" aria-hidden="true" />
                  <span>Inspeção Visual em Pixels</span>
                </div>
                <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  Detecta fiação solta, barramento de cobre sem proteção IP2X, disjuntores e etiquetas com máscaras PNG exatas.
                </p>
              </div>

              <div className="space-y-1.5 border-t border-slate-100 pt-3 dark:border-slate-800">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-slate-100">
                  <FileText className="h-4 w-4 text-blue-700 dark:text-blue-400" aria-hidden="true" />
                  <span>Documentação &amp; Memoriais</span>
                </div>
                <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  Avalia arquivos anexados ou textos técnicos contra NBR 14724, NBR 5410, NR-10 e TIA-942 com Diff lado a lado.
                </p>
              </div>

              <div className="space-y-1.5 border-t border-slate-100 pt-3 dark:border-slate-800">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-slate-100">
                  <Globe className="h-4 w-4 text-blue-700 dark:text-blue-400" aria-hidden="true" />
                  <span>URL Remota Auditável</span>
                </div>
                <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  Coleta segura de páginas HTML ou imagens hospedadas, verificando inclusive acessibilidade WCAG 2.1 em tags de imagem.
                </p>
              </div>

              <div className="space-y-1.5 border-t border-slate-100 pt-3 dark:border-slate-800">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-slate-100">
                  <FolderGit2 className="h-4 w-4 text-blue-700 dark:text-blue-400" aria-hidden="true" />
                  <span>Repositório Git / GitHub</span>
                </div>
                <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  Verifica árvore recursiva, presença de README, licença SPDX, vazamento de arquivos .env, testes e workflows CI.
                </p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 rounded-xl border border-slate-200 bg-white p-6 flex flex-col justify-between space-y-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-slate-100">
                <HardDrive className="h-4 w-4 text-blue-700 dark:text-blue-400" aria-hidden="true" />
                <span>Arquitetura Resiliente Sem API Key</span>
              </div>
              <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                Na ausência de chaves de API externas ou conexão cloud, o Lume persiste integralmente todas as auditorias e commits em dois bancos SQLite espelhados em RAID-1, com sincronização transparente para o Firebase Firestore quando autenticado.
              </p>
            </div>

            <div className="space-y-2 border-t border-slate-100 pt-4 text-xs dark:border-slate-800">
              <div className="flex items-center justify-between font-mono tabular-nums">
                <span className="text-slate-500 dark:text-slate-400">Espelhos SQLite RAID-1:</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {raidStatus?.mirrorAHealthy && raidStatus?.mirrorBHealthy
                    ? 'Mirror A + Mirror B saudáveis'
                    : 'Inicializando espelhos'}
                </span>
              </div>
              <div className="flex items-center justify-between font-mono tabular-nums">
                <span className="text-slate-500 dark:text-slate-400">Registros persistidos:</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {auditsCount}
                </span>
              </div>
              <div className="flex items-center justify-between font-mono tabular-nums">
                <span className="text-slate-500 dark:text-slate-400">Governança de execução:</span>
                <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400">
                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>scoobiii/vuc ativo</span>
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 pt-1">
              <button
                type="button"
                onClick={() => onNavigateTab(WorkspaceTab.DASHBOARD)}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer whitespace-nowrap"
              >
                <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Dashboard Recharts</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigateTab(WorkspaceTab.GIT_VERSIONING)}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer whitespace-nowrap"
              >
                <FolderGit2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Página Git &amp; API</span>
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
