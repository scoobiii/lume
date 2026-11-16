/**
 * @file evidenceIngestor.ts
 * @responsibility Ingestor unificado de evidências (Imagem, Documento Anexo, URL Remota e Repositório Git/GitHub) com auditoria normativa generalizada, hash SHA-256 e prova scoobiii/vuc.
 * @version 1.0.0
 * @date 2026-11-15
 * @directory /server/evidenceIngestor.ts
 * @signature PO Zeh Sobrinho & Senior Agile DevOps Team (AI Framework)
 */

import net from 'node:net';
import {
  DataCenterTier,
  DocumentNC,
  EvidenceIngestionResult,
  EvidenceSourceType,
  ImageProvenance,
  NCCategory,
  NCSeverity,
} from '../src/types/audit';
import { runDocumentAudit, runImageMaskAudit } from './ncEngine';
import { computeCanonicalSha256, runGovernedWithVucProof } from './vucGovernance';

function assertSafeRemoteUrl(rawUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new Error('URL inválida. Informe uma URL completa iniciando com http:// ou https://.');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Somente protocolos HTTP e HTTPS são permitidos.');
  }
  const host = parsed.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host === '0.0.0.0' ||
    host.endsWith('.local') ||
    host === '169.254.169.254'
  ) {
    throw new Error('Endereços internos/loopback não são permitidos na coleta remota.');
  }
  if (net.isIPv4(host)) {
    const parts = host.split('.').map(Number);
    if (
      parts[0] === 10 ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
      (parts[0] === 192 && parts[1] === 168) ||
      parts[0] === 127
    ) {
      throw new Error('Faixa de IP privado bloqueada por política SSRF.');
    }
  }
  return parsed;
}

function htmlToReadableText(html: string): { title: string; text: string; imgsWithoutAlt: number } {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : 'Página Web Auditada';
  const imgTags = [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);
  const imgsWithoutAlt = imgTags.filter((tag) => !/\balt\s*=\s*["'][^"']+["']/i.test(tag)).length;

  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<\/(p|div|h[1-6]|li|tr|section|article|br)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { title, text: cleaned.slice(0, 60000), imgsWithoutAlt };
}

function parseGitHubRepoUrl(rawUrl: string): { owner: string; repo: string } | null {
  try {
    const u = new URL(rawUrl.trim());
    if (!u.hostname.toLowerCase().includes('github.com')) return null;
    const parts = u.pathname.replace(/^\/+|\/+$/g, '').replace(/\.git$/, '').split('/');
    if (parts.length < 2) return null;
    return { owner: parts[0], repo: parts[1] };
  } catch {
    return null;
  }
}

export async function ingestEvidenceSource(params: {
  sourceType: EvidenceSourceType;
  tierLevel?: DataCenterTier;
  useAi?: boolean;
  provenance?: Partial<ImageProvenance>;
  imageBase64?: string;
  mimeType?: string;
  fileName?: string;
  documentText?: string;
  targetUrl?: string;
}): Promise<EvidenceIngestionResult> {
  const tierLevel: DataCenterTier = params.tierLevel ?? 'TIER_III';
  const useAi = Boolean(params.useAi);
  const today = new Date().toISOString().slice(0, 10);

  const baseProvenance: ImageProvenance = {
    suppliedBy: params.provenance?.suppliedBy?.trim() || 'Auditor / Usuário',
    suppliedDate: params.provenance?.suppliedDate?.trim() || today,
    sourceName: params.provenance?.sourceName?.trim() || params.fileName || 'Submissão Direta',
    sourceUrl: params.provenance?.sourceUrl?.trim() || params.targetUrl?.trim() || 'upload://local',
    sourceType: params.sourceType,
  };

  // 1. Direct Image Upload
  if (params.sourceType === 'image') {
    if (!params.imageBase64) {
      throw new Error('Envie um arquivo de imagem (.jpg, .png, .webp) para auditar.');
    }
    const label = params.fileName?.trim() || baseProvenance.sourceName || 'Evidência Visual';
    const imageAudit = await runImageMaskAudit({
      imageBase64: params.imageBase64,
      mimeType: params.mimeType ?? 'image/png',
      imageLabel: label,
      contextText: params.documentText ?? '',
      provenance: baseProvenance,
      tierLevel,
    });

    const summaryDoc = [
      `Relatório de Evidência Visual: ${label}`,
      `Fornecido por: ${imageAudit.provenance?.suppliedBy} em ${imageAudit.provenance?.suppliedDate}`,
      `Fonte / URL: ${imageAudit.provenance?.sourceName} (${imageAudit.provenance?.sourceUrl})`,
      `SHA-256: ${imageAudit.provenance?.imageSha256}`,
      `Classificação Tier: ${tierLevel.replace('_', ' ')}`,
      '',
      imageAudit.documentCrossCheck,
    ].join('\n');

    return {
      auditId: imageAudit.auditId,
      sourceType: 'image',
      title: label,
      provenance: imageAudit.provenance ?? baseProvenance,
      tierLevel,
      documentText: summaryDoc,
      imageBase64DataUrl: params.imageBase64,
      imageAudit,
      vucProof: imageAudit.vucProof,
    };
  }

  // 2. Attached Document or Pasted Text
  if (params.sourceType === 'document') {
    const rawText = (params.documentText ?? '').trim();
    if (!rawText) {
      throw new Error('Forneça um arquivo anexo ou cole o conteúdo textual do documento.');
    }
    const cleanText =
      /<html|<body|<div/i.test(rawText) ? htmlToReadableText(rawText).text : rawText;
    const sha = await computeCanonicalSha256(cleanText);
    const title = params.fileName?.trim() || baseProvenance.sourceName || 'Documento Técnico';
    const docAudit = await runDocumentAudit(cleanText, useAi, tierLevel);

    return {
      auditId: docAudit.auditId,
      sourceType: 'document',
      title,
      provenance: { ...baseProvenance, imageSha256: sha, sourceType: 'document' },
      tierLevel,
      documentText: cleanText,
      documentAudit: docAudit,
      vucProof: docAudit.vucProof,
    };
  }

  // 3. Remote URL (Auto-detects Image vs HTML/Text/JSON)
  if (params.sourceType === 'url') {
    const urlObj = assertSafeRemoteUrl(params.targetUrl ?? baseProvenance.sourceUrl);
    const response = await fetch(urlObj.toString(), {
      headers: { 'User-Agent': 'Evidencia-NC-Auditor/3.0' },
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) {
      throw new Error(`Falha ao acessar URL remota: HTTP ${response.status} (${response.statusText}).`);
    }
    const contentType = (response.headers.get('content-type') || 'text/plain').toLowerCase();
    const arrBuf = await response.arrayBuffer();
    const buf = Buffer.from(arrBuf);
    if (buf.byteLength === 0) {
      throw new Error('A URL remota retornou conteúdo vazio.');
    }

    if (contentType.startsWith('image/')) {
      const mimeType = contentType.split(';')[0].trim();
      const b64 = `data:${mimeType};base64,${buf.toString('base64')}`;
      const label = urlObj.pathname.split('/').pop() || urlObj.hostname;
      const imageAudit = await runImageMaskAudit({
        imageBase64: b64,
        mimeType,
        imageLabel: label,
        contextText: params.documentText ?? '',
        provenance: {
          ...baseProvenance,
          sourceName: urlObj.hostname,
          sourceUrl: urlObj.toString(),
          sourceType: 'url',
        },
        tierLevel,
      });

      return {
        auditId: imageAudit.auditId,
        sourceType: 'url',
        title: `${label} (${urlObj.hostname})`,
        provenance: imageAudit.provenance ?? baseProvenance,
        tierLevel,
        documentText: imageAudit.documentCrossCheck,
        imageBase64DataUrl: b64,
        imageAudit,
        vucProof: imageAudit.vucProof,
      };
    }

    const rawBody = buf.toString('utf8');
    let extractedTitle = urlObj.hostname + urlObj.pathname;
    let extractedText = rawBody.slice(0, 60000);
    let extraWcagNc: DocumentNC | null = null;

    if (contentType.includes('text/html') || /<html/i.test(rawBody)) {
      const parsed = htmlToReadableText(rawBody);
      extractedTitle = parsed.title || extractedTitle;
      extractedText = parsed.text;
      if (parsed.imgsWithoutAlt > 0) {
        extraWcagNc = {
          id: `nc-url-alt-${Date.now()}`,
          code: 'NC-URL-ALT',
          title: `${parsed.imgsWithoutAlt} imagem(ns) sem atributo Alt descritivo na URL`,
          category: NCCategory.ACCESSIBILITY_ALT,
          severity: NCSeverity.MAJOR,
          normativeClause: 'WCAG 2.1 SC 1.1.1 & ABNT NBR 14724',
          excerpt: `<img ...> (${parsed.imgsWithoutAlt} ocorrências sem alt)`,
          lineRange: 'DOM HTML Remoto',
          description: `A página ${urlObj.toString()} contém ${parsed.imgsWithoutAlt} elemento(s) <img> sem descrição alternativa (alt).`,
          recommendation: 'Adicionar texto alternativo descritivo e numeração Fig. XX às figuras.',
          replacementBefore: extractedText.slice(0, Math.min(80, extractedText.length)),
          replacementAfter: `${extractedText.slice(0, Math.min(80, extractedText.length))}\n[Nota WCAG/ABNT: Padronizar atributo alt e código Fig. XX nas figuras.]`,
          applied: false,
        };
      }
    }

    const docAudit = await runDocumentAudit(extractedText, useAi, tierLevel);
    if (extraWcagNc) {
      docAudit.findings = [extraWcagNc, ...docAudit.findings];
      docAudit.totalFindings = docAudit.findings.length;
      docAudit.majorCount = docAudit.findings.filter((f) => f.severity === NCSeverity.MAJOR).length;
    }

    const sha = await computeCanonicalSha256(buf.toString('base64'));
    return {
      auditId: docAudit.auditId,
      sourceType: 'url',
      title: extractedTitle,
      provenance: {
        ...baseProvenance,
        sourceName: urlObj.hostname,
        sourceUrl: urlObj.toString(),
        sourceType: 'url',
        imageSha256: sha,
      },
      tierLevel,
      documentText: extractedText,
      documentAudit: docAudit,
      vucProof: docAudit.vucProof,
    };
  }

  // 4. Git / GitHub Repository Audit (Real Public API / Raw Tree without API Key)
  const repoUrl = assertSafeRemoteUrl(params.targetUrl ?? baseProvenance.sourceUrl);
  const gh = parseGitHubRepoUrl(repoUrl.toString());
  if (!gh) {
    throw new Error('Informe uma URL de repositório GitHub válida (ex.: https://github.com/owner/repo).');
  }

  const ghHeaders = {
    'User-Agent': 'Evidencia-NC-Auditor/3.0',
    Accept: 'application/vnd.github+json',
  };

  const repoMetaRes = await fetch(`https://api.github.com/repos/${gh.owner}/${gh.repo}`, {
    headers: ghHeaders,
    signal: AbortSignal.timeout(10000),
  });
  if (!repoMetaRes.ok) {
    throw new Error(
      `Falha ao consultar repositório ${gh.owner}/${gh.repo}: HTTP ${repoMetaRes.status}. Verifique se o repositório é público.`
    );
  }
  const repoJson = (await repoMetaRes.json()) as {
    full_name: string;
    description?: string;
    default_branch: string;
    stargazers_count?: number;
    license?: { spdx_id?: string; name?: string } | null;
  };

  const branch = repoJson.default_branch || 'main';
  const treeRes = await fetch(
    `https://api.github.com/repos/${gh.owner}/${gh.repo}/git/trees/${branch}?recursive=1`,
    { headers: ghHeaders, signal: AbortSignal.timeout(10000) }
  );
  const treeJson = treeRes.ok
    ? ((await treeRes.json()) as { tree?: Array<{ path: string; type: string; size?: number }> })
    : { tree: [] };
  const files = (treeJson.tree ?? []).filter((t) => t.type === 'blob').map((t) => t.path);

  // Fetch README if present
  let readmeText = '';
  const readmePath = files.find((f) => /^readme\.md$/i.test(f));
  if (readmePath) {
    const rawReadme = await fetch(
      `https://raw.githubusercontent.com/${gh.owner}/${gh.repo}/${branch}/${readmePath}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (rawReadme.ok) {
      readmeText = (await rawReadme.text()).slice(0, 12000);
    }
  }

  const hasLicense = Boolean(repoJson.license?.spdx_id && repoJson.license.spdx_id !== 'NOASSERTION');
  const hasTests = files.some((f) => /test|spec|__tests__/i.test(f));
  const hasCi = files.some((f) => f.startsWith('.github/workflows/'));
  const hasDockerfile = files.some((f) => /dockerfile/i.test(f));
  const exposedEnvFiles = files.filter((f) => /(^|\/)\.env(\.local|\.prod)?$/i.test(f));

  const repoFindings: DocumentNC[] = [];
  if (!readmePath) {
    repoFindings.push({
      id: `nc-repo-readme-${Date.now()}`,
      code: 'NC-REPO-001',
      title: 'Ausência de README.md Documentando Instalação e Evidências',
      category: NCCategory.DOCUMENTAL_REFERENCE,
      severity: NCSeverity.CRITICAL,
      normativeClause: 'ABNT NBR ISO/IEC 26514 · Governança de Engenharia',
      excerpt: 'Raiz do repositório sem README.md',
      lineRange: 'Raiz / Tree',
      description: `O repositório ${repoJson.full_name} não possui arquivo README.md versionado.`,
      recommendation: 'Adicionar README.md com arquitetura, requisitos, instalação e execução de testes.',
      replacementBefore: 'Repositório sem README.md',
      replacementAfter: '# README.md\nDocumentação técnica de instalação, arquitetura e auditoria adicionada.',
      applied: false,
    });
  }
  if (!hasLicense) {
    repoFindings.push({
      id: `nc-repo-lic-${Date.now()}`,
      code: 'NC-REPO-002',
      title: 'Ausência de Licença Open-Source / Propriedade Declarada',
      category: NCCategory.REPOSITORY_GOVERNANCE,
      severity: NCSeverity.MAJOR,
      normativeClause: 'SPDX / Compliance Open-Source',
      excerpt: 'license: null',
      lineRange: 'Raiz / LICENSE',
      description: 'Repositório sem arquivo LICENSE detectado via SPDX.',
      recommendation: 'Definir arquivo LICENSE (ex.: MIT ou Apache-2.0) na raiz.',
      replacementBefore: 'license: não definida',
      replacementAfter: 'LICENSE: SPDX MIT / Apache-2.0 declarada.',
      applied: false,
    });
  }
  if (exposedEnvFiles.length > 0) {
    repoFindings.push({
      id: `nc-repo-env-${Date.now()}`,
      code: 'NC-REPO-SEC-003',
      title: 'Arquivo .env Versionado no Histórico do Repositório',
      category: NCCategory.SAFETY_NR10,
      severity: NCSeverity.CRITICAL,
      normativeClause: 'OWASP Secrets Management / CIS Benchmark',
      excerpt: exposedEnvFiles.join(', '),
      lineRange: exposedEnvFiles[0],
      description: 'Arquivos .env com potenciais credenciais estão rastreados no Git.',
      recommendation: 'Remover do Git, adicionar ao .gitignore e usar somente .env.example sem segredos.',
      replacementBefore: exposedEnvFiles.join(', '),
      replacementAfter: '.env.example (variáveis sem segredos) + .gitignore',
      applied: false,
    });
  }
  if (!hasCi || !hasTests) {
    repoFindings.push({
      id: `nc-repo-ci-${Date.now()}`,
      code: 'NC-REPO-004',
      title: !hasCi ? 'Pipeline CI/CD Ausente (.github/workflows)' : 'Suíte Automatizada de Testes Ausente',
      category: NCCategory.INFRA_TIER,
      severity: NCSeverity.MAJOR,
      normativeClause: 'DevOps Continuous Verification / ISO 25010',
      excerpt: `hasCi=${hasCi}, hasTests=${hasTests}, hasDockerfile=${hasDockerfile}`,
      lineRange: '.github/workflows',
      description: 'Repositório sem verificação contínua automatizada ou cobertura de testes detectada na árvore.',
      recommendation: 'Configurar workflow CI e testes automatizados bloqueantes no push/PR.',
      replacementBefore: `CI=${hasCi} Tests=${hasTests}`,
      replacementAfter: 'Workflow CI + suíte de testes unitários/contrato habilitados.',
      applied: false,
    });
  }

  const compiledRepoReport = [
    `# Auditoria de Repositório Git: ${repoJson.full_name}`,
    `- URL: ${repoUrl.toString()}`,
    `- Branch padrão: ${branch} · Total de arquivos: ${files.length}`,
    `- Licença: ${repoJson.license?.spdx_id ?? 'Nenhuma'} · CI: ${hasCi ? 'Sim' : 'Não'} · Testes: ${hasTests ? 'Sim' : 'Não'} · Dockerfile: ${hasDockerfile ? 'Sim' : 'Não'}`,
    `- Descrição: ${repoJson.description ?? 'Não informada'}`,
    '',
    '## Amostra de Arquivos da Árvore',
    ...files.slice(0, 40).map((f) => `- ${f}`),
    '',
    '## Conteúdo README.md (Extrato)',
    readmeText || '(Nenhum README encontrado)',
  ].join('\n');

  const repoSha = await computeCanonicalSha256({ repo: repoJson.full_name, branch, files: files.slice(0, 200) });

  const { data: repoAuditData, vucProof } = await runGovernedWithVucProof({
    operation: 'execute',
    resourcePath: 'server/evidenceIngestor.ts#repository',
    inputSummary: {
      repoFullName: repoJson.full_name,
      branch,
      filesCount: files.length,
      repoSha,
      tierLevel,
    },
    executor: async () => {
      const textAudit = await runDocumentAudit(compiledRepoReport, useAi, tierLevel);
      const mergedFindings = [...repoFindings, ...textAudit.findings];
      return {
        ...textAudit,
        auditId: `aud-repo-${Date.now()}`,
        documentTitle: `Repositório ${repoJson.full_name} (${branch})`,
        totalFindings: mergedFindings.length,
        criticalCount: mergedFindings.filter((f) => f.severity === NCSeverity.CRITICAL).length,
        majorCount: mergedFindings.filter((f) => f.severity === NCSeverity.MAJOR).length,
        minorCount: mergedFindings.filter((f) => f.severity === NCSeverity.MINOR).length,
        findings: mergedFindings,
        summary: `Auditoria do repositório ${repoJson.full_name} (${files.length} arquivos): ${mergedFindings.length} NCs detectadas.`,
      } as unknown as Record<string, unknown>;
    },
  });

  const finalAudit = repoAuditData as unknown as import('../src/types/audit').DocumentAuditResponse;
  finalAudit.vucProof = vucProof;

  return {
    auditId: finalAudit.auditId,
    sourceType: 'repository',
    title: repoJson.full_name,
    provenance: {
      ...baseProvenance,
      sourceName: repoJson.full_name,
      sourceUrl: repoUrl.toString(),
      sourceType: 'repository',
      imageSha256: repoSha,
    },
    tierLevel,
    documentText: compiledRepoReport,
    documentAudit: finalAudit,
    repositoryMeta: {
      repoFullName: repoJson.full_name,
      defaultBranch: branch,
      stars: repoJson.stargazers_count,
      license: repoJson.license?.spdx_id ?? undefined,
      filesInspected: files.slice(0, 60),
    },
    vucProof,
  };
}
