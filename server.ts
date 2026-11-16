/**
 * @file server.ts
 * @responsibility Servidor Express full-stack (porta 3000) com ingestão generalizada de evidências (/api/evidence/ingest), persistência SQLite RAID-1 (/api/raid/*), MCP, CAD/NURBS, VUC e Vite middleware.
 * @version 3.0.0
 * @date 2026-11-15
 * @directory /server.ts
 * @signature PO Zeh Sobrinho & Senior Agile DevOps Team (AI Framework)
 */

import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import { generateRemediationCadAndVisualPatch } from './server/cadNurbsEngine';
import { ingestEvidenceSource } from './server/evidenceIngestor';
import { runDocumentAudit, runImageMaskAudit } from './server/ncEngine';
import {
  deleteRaidAudit,
  getRaidAuditPayload,
  getRaidStatus,
  listRaidAudits,
  markAuditFirebaseSynced,
  saveAuditToRaid,
} from './server/raidPersistence';
import {
  QTA_OPEN_SOURCE_MCP_TOOLS,
  verifyProvidedVucProof,
} from './server/vucGovernance';

const PORT = 3000;

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);
  app.use(express.json({ limit: '25mb' }));

  // Healthcheck
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'lume-nc-auditor-api',
      version: '3.1.0',
      cvEngine: 'deterministic-pixel-hsv-sobel-ccl',
      raidEngine: 'node-sqlite-raid1-mirrored',
      timestamp: new Date().toISOString(),
    });
  });

  // OpenAPI 3.1 Specification for Evidence & NC API
  app.get('/api/nc/openapi.json', (_req, res) => {
    res.json({
      openapi: '3.1.0',
      info: {
        title: 'Lume API (lume-nc-auditor) · Auditoria Generalizada & Persistência RAID-1',
        version: '3.1.0',
        description:
          'API REST real para ingestão e auditoria de evidências (Imagem, Documento Anexo, URL Remota e Repositório Git), persistência SQLite RAID-1 espelhada + Firebase, CAD/NURBS e provas criptográficas scoobiii/vuc.',
      },
      paths: {
        '/api/evidence/ingest': {
          post: {
            summary: 'Ingere e audita evidência de Imagem, Documento, URL ou Repositório Git gravando em SQLite RAID-1',
          },
        },
        '/api/raid/status': { get: { summary: 'Status dos espelhos RAID-1 SQLite (A+B), chaves e Firebase' } },
        '/api/raid/audits': {
          get: { summary: 'Lista histórico completo de auditorias persistidas em SQLite RAID-1' },
          post: { summary: 'Salva ou atualiza caso em andamento nos espelhos SQLite RAID-1' },
        },
        '/api/nc/audit-document': {
          post: { summary: 'Audita texto técnico e gera patches de correção versionados' },
        },
        '/api/nc/detect-masks': {
          post: { summary: 'Segmentação pixel-a-pixel real em imagens de painéis/evidências' },
        },
        '/api/nc/remediate-image': {
          post: { summary: 'Gera planta visual corrigida e binários CAD NURBS (IGES, DXF, STL binário)' },
        },
        '/api/mcp/tools': { get: { summary: 'Catálogo MCP JSON-RPC 2.0 + scoobiii/vuc' } },
      },
    });
  });

  // Unified Evidence Ingestion (Image | Document | URL | Git Repository) + Auto-Save to SQLite RAID-1
  app.post('/api/evidence/ingest', async (req, res) => {
    try {
      const {
        sourceType = 'document',
        tierLevel = 'TIER_III',
        useAi = false,
        provenance,
        imageBase64,
        mimeType,
        fileName,
        documentText,
        targetUrl,
      } = req.body ?? {};

      const ingested = await ingestEvidenceSource({
        sourceType,
        tierLevel,
        useAi: Boolean(useAi),
        provenance,
        imageBase64,
        mimeType,
        fileName,
        documentText,
        targetUrl,
      });

      const findingsCount = ingested.documentAudit?.findings.length ?? ingested.imageAudit?.objects.length ?? 0;
      const criticalCount = ingested.documentAudit?.criticalCount ?? 0;
      const overallStatus =
        ingested.imageAudit?.overallStatus ??
        (criticalCount > 0 ? 'NON_COMPLIANT' : findingsCount > 0 ? 'PARTIAL' : 'COMPLIANT');

      saveAuditToRaid({
        auditId: ingested.auditId,
        sourceType: ingested.sourceType,
        title: ingested.title,
        suppliedBy: ingested.provenance.suppliedBy,
        suppliedDate: ingested.provenance.suppliedDate,
        sourceName: ingested.provenance.sourceName,
        sourceUrl: ingested.provenance.sourceUrl,
        contentSha256: ingested.provenance.imageSha256 ?? 'sha256:pending',
        tierLevel: ingested.tierLevel,
        overallStatus,
        looseWireAreaPercent: ingested.imageAudit?.summaryMetrics.looseWireAreaPercent ?? 0,
        exposedCopperAreaPercent: ingested.imageAudit?.summaryMetrics.exposedCopperAreaPercent ?? 0,
        objectsCount: findingsCount,
        vucExecutionId: ingested.vucProof?.executionId ?? `exec-${ingested.auditId}`,
        vucProofHash: ingested.vucProof?.proofHash ?? 'sha256:pending',
        vucVerified: Boolean(ingested.vucProof?.verified),
        summaryNote: ingested.documentAudit?.summary ?? ingested.imageAudit?.documentCrossCheck ?? '',
        payload: ingested as unknown as Record<string, unknown>,
      });

      return res.json({ ...ingested, raidRecordSaved: true });
    } catch (error) {
      console.error('Erro em /api/evidence/ingest:', error);
      return res.status(400).json({
        error: error instanceof Error ? error.message : 'Falha na ingestão da evidência.',
      });
    }
  });

  // SQLite RAID-1 Persistence & Sync endpoints
  app.get('/api/raid/status', (req, res) => {
    const firebaseActive = req.query.firebaseSignedIn === 'true';
    return res.json(getRaidStatus(firebaseActive));
  });

  app.get('/api/raid/audits', (_req, res) => {
    return res.json({ items: listRaidAudits() });
  });

  app.get('/api/raid/audits/:id', (req, res) => {
    const payload = getRaidAuditPayload(req.params.id);
    if (!payload) {
      return res.status(404).json({ error: 'Registro não encontrado no RAID-1 SQLite.' });
    }
    return res.json(payload);
  });

  app.post('/api/raid/audits', (req, res) => {
    try {
      const body = req.body ?? {};
      if (!body.auditId || !body.payload) {
        return res.status(400).json({ error: 'Campos "auditId" e "payload" são obrigatórios.' });
      }
      const status = saveAuditToRaid(body);
      return res.json({ saved: true, ...status });
    } catch (error) {
      return res.status(500).json({
        error: error instanceof Error ? error.message : 'Falha ao persistir em RAID-1 SQLite.',
      });
    }
  });

  app.post('/api/raid/audits/:id/mark-synced', (req, res) => {
    const ok = markAuditFirebaseSynced(req.params.id);
    return res.json({ updated: ok });
  });

  app.delete('/api/raid/audits/:id', (req, res) => {
    deleteRaidAudit(req.params.id);
    return res.json({ deleted: true });
  });

  // Documental & Normative NC Audit endpoint (with Tier I-IV + scoobiii/vuc ExecutionProof)
  app.post('/api/nc/audit-document', async (req, res) => {
    try {
      const { documentText, useAi = false, tierLevel = 'TIER_III' } = req.body ?? {};
      if (typeof documentText !== 'string' || !documentText.trim()) {
        return res.status(400).json({ error: 'Campo "documentText" é obrigatório.' });
      }
      const result = await runDocumentAudit(documentText, Boolean(useAi), tierLevel);
      return res.json(result);
    } catch (error) {
      console.error('Erro em /api/nc/audit-document:', error);
      return res.status(500).json({ error: 'Falha ao executar auditoria documental.' });
    }
  });

  // Real Deterministic Pixel Computer Vision Mask Detection endpoint (NO MOCKS, NO LLM GUESSING)
  app.post('/api/nc/detect-masks', async (req, res) => {
    try {
      const {
        imageBase64,
        mimeType,
        imageLabel,
        contextText,
        externalEndpointUrl,
        provenance,
        tierLevel = 'TIER_III',
      } = req.body ?? {};
      if (typeof imageBase64 !== 'string' || !imageBase64.trim()) {
        return res.status(400).json({
          error:
            'Envie uma imagem real no campo "imageBase64" (JPEG ou PNG). Nenhum dado simulado ou mock é aceito.',
        });
      }
      const result = await runImageMaskAudit({
        imageBase64,
        mimeType,
        imageLabel,
        contextText,
        externalEndpointUrl,
        provenance,
        tierLevel,
      });
      return res.json(result);
    } catch (error) {
      console.error('Erro em /api/nc/detect-masks:', error);
      return res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : 'Falha ao decodificar ou processar os pixels da imagem.',
      });
    }
  });

  // Versioned Patch Image Remediation + CAD/NURBS Engineering Binaries (IGES, DXF, Binary STL)
  app.post('/api/nc/remediate-image', async (req, res) => {
    try {
      const {
        tierLevel = 'TIER_III',
        patchVersion = 'v2.2.0-cad-patch',
        imageLabel = 'Painel Auditado',
        provenance,
        detectedObjects = [],
        externalImageGenUrl,
      } = req.body ?? {};

      const pkg = await generateRemediationCadAndVisualPatch({
        tierLevel,
        patchVersion,
        imageLabel,
        provenance,
        detectedObjects,
        externalImageGenUrl,
      });
      return res.json(pkg);
    } catch (error) {
      console.error('Erro em /api/nc/remediate-image:', error);
      return res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : 'Falha ao gerar solução visual e binários CAD/NURBS.',
      });
    }
  });

  // Independent Cryptographic Verifier (scoobiii/vuc ExecutionProof v1)
  app.post('/api/nc/vuc/verify', async (req, res) => {
    try {
      const { proof } = req.body ?? {};
      if (!proof || typeof proof !== 'object') {
        return res.status(400).json({ error: 'Campo "proof" (ExecutionProof v1) é obrigatório.' });
      }
      const verification = await verifyProvidedVucProof(proof);
      return res.json(verification);
    } catch (error) {
      return res.status(500).json({
        error: error instanceof Error ? error.message : 'Falha na verificação VUC.',
      });
    }
  });

  // Open-Source MCP Tools Catalog & JSON-RPC 2.0 Endpoint
  app.get('/api/mcp/tools', (_req, res) => {
    res.json({
      protocol: 'Model Context Protocol (MCP) · JSON-RPC 2.0',
      governance: '@vucfoundation/vuc (scoobiii/vuc)',
      tools: QTA_OPEN_SOURCE_MCP_TOOLS,
    });
  });

  app.post('/api/mcp/rpc', async (req, res) => {
    const { jsonrpc = '2.0', id = 1, method, params = {} } = req.body ?? {};
    try {
      if (method === 'tools/list') {
        return res.json({ jsonrpc, id, result: { tools: QTA_OPEN_SOURCE_MCP_TOOLS } });
      }
      if (method === 'tools/call') {
        const toolName = params?.name;
        const args = params?.arguments ?? {};
        if (toolName === 'qta.normative.audit_tier') {
          const out = await runDocumentAudit(
            String(args.documentText ?? ''),
            false,
            args.tierLevel ?? 'TIER_III'
          );
          return res.json({ jsonrpc, id, result: out });
        }
        if (toolName === 'qta.cv.detect_masks') {
          const out = await runImageMaskAudit({
            imageBase64: String(args.imageBase64 ?? ''),
            imageLabel: args.imageLabel,
            contextText: args.contextText,
            tierLevel: args.tierLevel ?? 'TIER_III',
          });
          return res.json({ jsonrpc, id, result: out });
        }
        if (toolName === 'qta.cad.nurbs_patch') {
          const out = await generateRemediationCadAndVisualPatch({
            tierLevel: args.tierLevel ?? 'TIER_III',
            patchVersion: args.patchVersion ?? 'v2.2.0-mcp',
            imageLabel: args.imageLabel ?? 'Evidencia-MCP-Panel',
            detectedObjects: args.detectedObjects ?? [],
          });
          return res.json({ jsonrpc, id, result: out });
        }
        if (toolName === 'vortex.verify') {
          const out = await verifyProvidedVucProof(args.proof ?? args.execution_proof ?? {});
          return res.json({ jsonrpc, id, result: out });
        }
        return res.status(404).json({
          jsonrpc,
          id,
          error: { code: -32601, message: `Ferramenta MCP não encontrada: ${toolName}` },
        });
      }
      return res.status(400).json({
        jsonrpc,
        id,
        error: { code: -32600, message: `Método JSON-RPC não suportado: ${method}` },
      });
    } catch (error) {
      return res.status(500).json({
        jsonrpc,
        id,
        error: {
          code: -32000,
          message: error instanceof Error ? error.message : 'Erro interno MCP.',
        },
      });
    }
  });

  // Git Project Tree inspection endpoint
  app.get('/api/git/tree', (_req, res) => {
    const projectFiles = [
      { path: 'server.ts', role: 'Express + API /api/evidence/*, /api/raid/*, /api/nc/*, /api/mcp/*', version: '3.0.0' },
      { path: 'server/evidenceIngestor.ts', role: 'Ingestor generalizado (Imagem, Documento, URL, Repositório Git)', version: '1.0.0' },
      { path: 'server/raidPersistence.ts', role: 'Persistência SQLite RAID-1 espelhada (Mirror A + B) com auto-cura SHA-256', version: '1.0.0' },
      { path: 'server/ncEngine.ts', role: 'Motor de auditoria NC normativa Tier I–IV & governança documental', version: '2.2.0' },
      { path: 'server/cvMaskEngine.ts', role: 'Motor CV determinístico em pixels RGBA (HSV, Sobel, CCL, PNG Mask)', version: '2.0.0' },
      { path: 'server/cadNurbsEngine.ts', role: 'Motor CAD/NURBS (Cox-de Boor, IGES 126, DXF, STL binário) & patch visual', version: '1.0.0' },
      { path: 'server/vucGovernance.ts', role: 'Provas criptográficas Ed25519 + RFC 8785 JCS + MCP JSON-RPC (scoobiii/vuc)', version: '1.0.2' },
      { path: 'src/App.tsx', role: 'Orquestrador Lume com Landing Page, Dashboard Recharts, Workspace-on-Demand e Git pervasivo', version: '3.1.0' },
      { path: 'src/components/LandingPageView.tsx', role: 'Landing Page principal do Lume com proposta arquitetural e fluxos de auditoria', version: '1.0.0' },
      { path: 'src/components/AuditDashboardView.tsx', role: 'Dashboard Recharts (Não Conformidades por Tier em Rosca e Tendência Temporal em Linha)', version: '1.0.0' },
      { path: 'src/components/EvidenceIntakePanel.tsx', role: 'Portal limpo de ingestão de evidências (Imagem, Documento, URL, Repo)', version: '1.0.0' },
      { path: 'src/components/HistorySidebar.tsx', role: 'Sidebar do histórico persistido (SQLite RAID-1 + Firestore) e status de sync', version: '1.0.0' },
      { path: 'src/components/DocumentAuditView.tsx', role: 'Auditor documental, Diff Lado a Lado & Patch Automático', version: '1.1.0' },
      { path: 'src/components/VisionMaskInspector.tsx', role: 'Inspetor de Máscaras em Pixels, Procedência & Solução CAD/NURBS', version: '2.2.0' },
      { path: 'src/components/GitVersioningView.tsx', role: 'Histórico Git, Backlog Scrum & Testador OpenAPI pervasivo', version: '3.1.0' },
      { path: 'src/utils/gitBundleExporter.ts', role: 'Exportador standalone Git .zip do caso auditado', version: '3.1.0' },
      { path: 'src/firebase.ts', role: 'SDK Firebase Auth (Google) + Firestore Persistence com RAID sync', version: '1.1.0' },
      { path: 'firebase-blueprint.json', role: 'Schema Blueprint IR para coleções Firestore', version: '1.1.0' },
      { path: 'firestore.rules', role: 'Regras de segurança Zero-Trust validadas via ESLint', version: '1.1.0' },
      { path: 'README.md', role: 'Documentação completa do repositório lume-nc-auditor', version: '3.1.0' },
      { path: 'Dockerfile', role: 'Build Docker multi-stage Node 22 Alpine para produção', version: '1.0.0' },
    ];
    res.json({
      repository: 'lume-nc-auditor',
      defaultBranch: 'main',
      po: 'Zeh Sobrinho',
      team: 'Senior Agile DevOps Team (AI Framework)',
      files: projectFiles,
    });
  });

  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        ws: { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexHtml = path.join(distDir, 'index.html');
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send('Build not found.');
      }
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`[Evidencia-NC Studio] Servidor ativo em http://0.0.0.0:${PORT}`);
  });
}

startServer();
