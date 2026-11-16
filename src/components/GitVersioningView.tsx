/**
 * @file GitVersioningView.tsx
 * @responsibility Visualizador de histórico de commits Git, estrutura de diretórios com cabeçalhos DevOps, Sprint Backlog Scrum e testador interativo da API REST /api/nc/*.
 * @version 1.0.0
 * @date 2026-11-15
 * @directory /src/components/GitVersioningView.tsx
 * @signature PO Zeh Sobrinho & Senior Agile DevOps Team (AI Framework)
 */

import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Code2,
  FolderGit2,
  GitBranch,
  GitCommit,
  Play,
  Terminal,
} from 'lucide-react';
import { SCRUM_BACKLOG_STORIES } from '../data/senaiQtaCorpus';
import { DocumentVersionCommit } from '../types/audit';

interface GitVersioningViewProps {
  commits: DocumentVersionCommit[];
  currentDocument: string;
  raidStatus?: import('../types/audit').RaidStatusSummary | null;
}

interface RepoFileNode {
  path: string;
  role: string;
  version: string;
}

export const GitVersioningView: React.FC<GitVersioningViewProps> = ({
  commits,
  currentDocument,
  raidStatus,
}) => {
  const [selectedCommitHash, setSelectedCommitHash] = useState<string>(
    commits[commits.length - 1]?.hash ?? ''
  );
  const [repoFiles, setRepoFiles] = useState<RepoFileNode[]>([]);
  const [loadingTree, setLoadingTree] = useState<boolean>(true);
  const [apiEndpoint, setApiEndpoint] = useState<
    | '/api/raid/status'
    | '/api/raid/audits'
    | '/api/nc/audit-document'
    | '/api/nc/detect-masks'
    | '/api/nc/remediate-image'
    | '/api/mcp/tools'
    | '/api/nc/openapi.json'
  >('/api/raid/status');
  const [apiResponse, setApiResponse] = useState<string>('');
  const [testingApi, setTestingApi] = useState<boolean>(false);

  useEffect(() => {
    let active = true;
    fetch('/api/git/tree')
      .then((r) => r.json())
      .then((data: { files?: RepoFileNode[] }) => {
        if (active && Array.isArray(data.files)) {
          setRepoFiles(data.files);
        }
      })
      .catch(() => {
        if (active) setRepoFiles([]);
      })
      .finally(() => {
        if (active) setLoadingTree(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (commits.length > 0) {
      setSelectedCommitHash(commits[commits.length - 1].hash);
    }
  }, [commits]);

  const activeCommit =
    commits.find((c) => c.hash === selectedCommitHash) ?? commits[commits.length - 1];

  const [apiTestImageB64, setApiTestImageB64] = useState<string>('');

  const handleApiTestFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setApiTestImageB64(String(reader.result ?? ''));
    reader.readAsDataURL(file);
  };

  const handleRunApiTest = async () => {
    setTestingApi(true);
    setApiResponse('');
    try {
      let res: Response;
      if (
        apiEndpoint === '/api/nc/openapi.json' ||
        apiEndpoint === '/api/mcp/tools' ||
        apiEndpoint === '/api/raid/status' ||
        apiEndpoint === '/api/raid/audits'
      ) {
        res = await fetch(apiEndpoint);
      } else if (apiEndpoint === '/api/nc/remediate-image') {
        res = await fetch('/api/nc/remediate-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tierLevel: 'TIER_III',
            patchVersion: 'v2.2.0-cad-test',
            imageLabel: 'QTA-Test-Panel',
            detectedObjects: [],
          }),
        });
      } else if (apiEndpoint === '/api/nc/detect-masks') {
        if (!apiTestImageB64) {
          setApiResponse(
            JSON.stringify(
              {
                error:
                  'Selecione uma imagem real (.jpg ou .png) acima para testar POST /api/nc/detect-masks. Nenhum mock é utilizado.',
              },
              null,
              2
            )
          );
          setTestingApi(false);
          return;
        }
        res = await fetch('/api/nc/detect-masks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: apiTestImageB64,
            contextText: currentDocument.slice(0, 600),
          }),
        });
      } else {
        res = await fetch('/api/nc/audit-document', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            documentText: currentDocument.slice(0, 1800),
            useAi: false,
          }),
        });
      }
      const json = await res.json();
      setApiResponse(JSON.stringify(json, null, 2));
    } catch (err) {
      setApiResponse(
        JSON.stringify(
          { error: err instanceof Error ? err.message : 'Erro na requisição' },
          null,
          2
        )
      );
    } finally {
      setTestingApi(false);
    }
  };

  return (
    <section aria-labelledby="git-heading" className="space-y-8">
      <div className="border-b border-slate-200 pb-6 dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span>Repositório: lume-nc-auditor</span>
          <span aria-hidden="true">·</span>
          <span>Branch principal: main</span>
          <span aria-hidden="true">·</span>
          <span>Persistência: {raidStatus?.raidMode ?? 'SQLITE_RAID1_LOCAL'}</span>
          <span aria-hidden="true">·</span>
          <span>PO: Zeh Sobrinho &amp; Senior Agile DevOps Team</span>
        </div>
        <h1
          id="git-heading"
          className="mt-2 font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-slate-100"
          style={{ textWrap: 'balance' }}
        >
          Versionamento Git, SQLite RAID-1, Scrum &amp; API REST
        </h1>
      </div>

      {/* Linha 1: Histórico de Commits + Snapshot do Commit */}
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-5 rounded-xl border border-slate-200 bg-white divide-y divide-slate-200 dark:border-slate-800 dark:bg-slate-900 dark:divide-slate-800">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              <GitBranch className="h-4 w-4 text-blue-600" aria-hidden="true" />
              <span>Histórico de Commits ({commits.length})</span>
            </div>
            <span className="font-mono text-xs text-slate-500 dark:text-slate-400">main</span>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800/70">
            {[...commits].reverse().map((commit) => {
              const selected = commit.hash === activeCommit?.hash;
              return (
                <button
                  key={commit.hash}
                  type="button"
                  onClick={() => setSelectedCommitHash(commit.hash)}
                  className={`w-full px-4 py-3.5 text-left transition-colors cursor-pointer ${
                    selected
                      ? 'bg-blue-50/70 dark:bg-blue-950/30'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-mono font-semibold text-blue-700 dark:text-blue-400">
                      {commit.shortHash} · {commit.version}
                    </span>
                    <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
                      {commit.date}
                    </span>
                  </div>
                  <div className="mt-1 text-xs font-medium text-slate-900 dark:text-slate-100">
                    {commit.message}
                  </div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {commit.author}
                    {commit.ncsResolved.length > 0 &&
                      ` · Resolveu: ${commit.ncsResolved.join(', ')}`}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-7 rounded-xl border border-slate-200 bg-white overflow-hidden dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-center gap-2 font-mono text-slate-800 dark:text-slate-200">
              <GitCommit className="h-4 w-4 text-slate-500" aria-hidden="true" />
              <span>docs/senai_alimentacao_energia.md @ {activeCommit?.shortHash}</span>
            </div>
            <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
              {activeCommit?.content.split('\n').length ?? 0} linhas
            </span>
          </div>
          <pre className="max-h-96 overflow-auto p-4 font-mono text-xs leading-relaxed text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
            {activeCommit?.content ?? ''}
          </pre>
        </div>
      </div>

      {/* Linha 2: Estrutura Git com Cabeçalhos & Testador API REST */}
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-6 rounded-xl border border-slate-200 bg-white overflow-hidden dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              <FolderGit2 className="h-4 w-4 text-blue-600" aria-hidden="true" />
              <span>Estrutura do Projeto Git (Arquivos com Cabeçalho)</span>
            </div>
            <span className="font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
              {repoFiles.length} módulos
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Arquivo</th>
                  <th className="px-4 py-2.5 font-semibold">Responsabilidade</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Versão</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                {loadingTree ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-slate-500">
                      Carregando árvore do repositório...
                    </td>
                  </tr>
                ) : (
                  repoFiles.map((file) => (
                    <tr
                      key={file.path}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    >
                      <td className="px-4 py-2.5 font-mono text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {file.path}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400">
                        {file.role}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-500 dark:text-slate-400">
                        {file.version}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="lg:col-span-6 rounded-xl border border-slate-200 bg-white p-4 space-y-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              <Terminal className="h-4 w-4 text-blue-600" aria-hidden="true" />
              <span>Testador Live da API de Não Conformidades</span>
            </div>

            <button
              type="button"
              onClick={handleRunApiTest}
              disabled={testingApi}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-blue-600 dark:hover:bg-blue-500 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Play className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{testingApi ? 'Executando...' : 'Executar Chamada'}</span>
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5 rounded-lg bg-slate-100 p-1 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            {(
              [
                '/api/raid/status',
                '/api/raid/audits',
                '/api/nc/audit-document',
                '/api/nc/detect-masks',
                '/api/nc/remediate-image',
                '/api/mcp/tools',
                '/api/nc/openapi.json',
              ] as const
            ).map((ep) => (
              <button
                key={ep}
                type="button"
                onClick={() => setApiEndpoint(ep)}
                className={`rounded-md px-2.5 py-1.5 font-mono text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  apiEndpoint === ep
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                {ep}
              </button>
            ))}
          </div>

          {apiEndpoint === '/api/nc/detect-masks' && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-950">
              <span className="text-slate-600 dark:text-slate-400">
                {apiTestImageB64
                  ? 'Imagem real carregada em memória para o teste POST.'
                  : 'Anexe uma foto real (.jpg/.png) para enviar à API:'}
              </span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleApiTestFile}
                className="text-xs text-slate-700 dark:text-slate-300 file:mr-2 file:rounded file:border-0 file:bg-slate-900 file:px-2.5 file:py-1 file:text-xs file:font-semibold file:text-white dark:file:bg-blue-600 cursor-pointer"
              />
            </div>
          )}

          <pre className="h-64 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-xs text-slate-800 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
            {apiResponse ||
              'Clique em "Executar Chamada" para inspecionar o payload JSON real retornado pelo servidor Express.'}
          </pre>
        </div>
      </div>

      {/* Linha 3: Scrum Sprint Backlog */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
            <Code2 className="h-4 w-4 text-blue-600" aria-hidden="true" />
            <span>Scrum Sprint Backlog & Definition of Done (DoD)</span>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            PO: Zeh Sobrinho · 26 Story Points entregues
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
              <tr>
                <th className="px-4 py-2.5 font-semibold">ID</th>
                <th className="px-4 py-2.5 font-semibold">Épico</th>
                <th className="px-4 py-2.5 font-semibold">História de Usuário / Critério de Aceite</th>
                <th className="px-4 py-2.5 font-semibold">Responsável</th>
                <th className="px-4 py-2.5 text-right font-semibold">Pts</th>
                <th className="px-4 py-2.5 text-right font-semibold">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {SCRUM_BACKLOG_STORIES.map((story) => (
                <tr key={story.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-3 font-mono font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                    {story.id}
                  </td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                    {story.epic}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900 dark:text-slate-100">
                      {story.title}
                    </div>
                    <div className="mt-0.5 text-slate-500 dark:text-slate-400">
                      {story.acceptanceCriteria}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                    {story.owner}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-900 dark:text-slate-100">
                    {story.points}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <span className="inline-flex items-center gap-1 font-medium text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Concluído</span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};
