/**
 * @file ncEngine.ts
 * @responsibility Motor server-side de auditoria de Não Conformidades (NC) normativas (Tier I-IV), procedência documental, visão determinística e assinatura scoobiii/vuc.
 * @version 2.2.0
 * @date 2026-11-15
 * @directory /server/ncEngine.ts
 * @signature PO Zeh Sobrinho & Senior Agile DevOps Team (AI Framework)
 */

import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { BASELINE_DOCUMENT_NCS, getTierNormativeRules } from '../src/data/senaiQtaCorpus';
import {
  DataCenterTier,
  DocumentAuditResponse,
  DocumentNC,
  ImageAuditResponse,
  ImageProvenance,
  NCCategory,
  NCSeverity,
} from '../src/types/audit';
import { analyzePanelImagePixels } from './cvMaskEngine';
import { computeCanonicalSha256, runGovernedWithVucProof } from './vucGovernance';

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim() === '') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function deterministicDocumentAudit(
  text: string,
  tierLevel: DataCenterTier = 'TIER_III'
): DocumentAuditResponse {
  const findings: DocumentNC[] = [];
  let corrected = text;

  const isSenaiCorpus =
    text.includes('Quadro de transferência automática') || text.includes('imagem ilustrativa');

  if (isSenaiCorpus) {
    for (const rule of BASELINE_DOCUMENT_NCS) {
      if (text.includes(rule.replacementBefore)) {
        findings.push({ ...rule, applied: false });
        corrected = corrected.replace(rule.replacementBefore, rule.replacementAfter);
      }
    }
  }

  // Evaluate Data Center Tier I-IV Electrical, Infra & Safety NCs when content covers electrical/DC facilities
  const isElectricalOrDc =
    /qta|ats|qgbt|quadro|data center|ups|gerador|transformador|barramento|nr-?10|nbr\s*5410|elétric|eletric|tia-?942|tier\s*[iv1-4]/i.test(
      text
    );

  if (isElectricalOrDc) {
    const tierRules = getTierNormativeRules(tierLevel);
    for (const tierRule of tierRules) {
      if (!text.includes(tierRule.replacementAfter)) {
        const hasBefore = tierRule.replacementBefore && text.includes(tierRule.replacementBefore);
        findings.push({ ...tierRule, applied: false });
        if (hasBefore) {
          corrected = corrected.replace(tierRule.replacementBefore, tierRule.replacementAfter);
        } else {
          corrected = `${corrected.trimEnd()}\n\n${tierRule.replacementAfter}`;
        }
      }
    }
  }

  // Generalized TODO / FIXME / TBD unresolved draft placeholders check
  const todoMatch = text.match(/\b(TODO|FIXME|TBD|XXX)\b[^\n]*/);
  if (todoMatch) {
    findings.push({
      id: `nc-todo-${Date.now()}`,
      code: 'NC-DOC-TODO',
      title: 'Marcador Pendente / Rascunho Não Resolvido no Documento',
      category: NCCategory.DOCUMENTAL_REFERENCE,
      severity: NCSeverity.MAJOR,
      normativeClause: 'ABNT NBR 14724 · Controle Editorial',
      excerpt: todoMatch[0].slice(0, 120),
      lineRange: 'Documento submetido',
      description: `A evidência contém pendência explícita ("${todoMatch[0].slice(0, 60)}") que invalida liberação técnica final.`,
      recommendation: 'Resolver o item pendente e remover marcadores provisórios antes da publicação.',
      replacementBefore: todoMatch[0],
      replacementAfter: '[Item validado e consolidado para emissão final.]',
      applied: false,
    });
    corrected = corrected.replace(todoMatch[0], '[Item validado e consolidado para emissão final.]');
  }

  const genericImgMatches = [...text.matchAll(/imagem ilustrativa|a imagem acima|figura abaixo/gi)];
  if (genericImgMatches.length > 0 && !findings.some((f) => f.category === NCCategory.DOCUMENTAL_REFERENCE)) {
    findings.push({
      id: `nc-gen-${Date.now()}-1`,
      code: 'NC-DOC-101',
      title: 'Referência Visual Genérica Sem Código Identificador (Fig. XX)',
      category: NCCategory.DOCUMENTAL_REFERENCE,
      severity: NCSeverity.CRITICAL,
      normativeClause: 'ABNT NBR 14724 §5.8',
      excerpt: genericImgMatches[0][0],
      lineRange: 'Documento completo',
      description:
        'O texto menciona figura ou imagem de forma genérica ("imagem ilustrativa" / "imagem acima") sem código identificador formal e legenda numerada.',
      recommendation:
        'Atribuir código sequencial (ex.: Fig. 01) na legenda e referenciar explicitamente no corpo do texto ("conforme Fig. 01").',
      replacementBefore: genericImgMatches[0][0],
      replacementAfter: '[Fig. 01 — Ilustração Técnica Padronizada (conforme ABNT NBR 14724)]',
      applied: false,
    });
    corrected = corrected.replace(
      genericImgMatches[0][0],
      '[Fig. 01 — Ilustração Técnica Padronizada (conforme ABNT NBR 14724)]'
    );
  }

  if (/\bque\s+que\b/i.test(text) && !findings.some((f) => f.code === 'NC-TYPO-005')) {
    findings.push({
      id: `nc-gen-${Date.now()}-2`,
      code: 'NC-TYPO-102',
      title: 'Duplicação Lexical Detectada ("que que")',
      category: NCCategory.TYPO_TERMINOLOGY,
      severity: NCSeverity.MINOR,
      normativeClause: 'Revisão Editorial Técnica',
      excerpt: 'que que',
      lineRange: 'Texto submetido',
      description: 'Repetição acidental do pronome relativo "que" na sentença.',
      recommendation: 'Remover a palavra duplicada.',
      replacementBefore: 'que que',
      replacementAfter: 'que',
      applied: false,
    });
    corrected = corrected.replace(/\bque\s+que\b/gi, 'que');
  }

  if (
    /qta|ats|quadro/i.test(text) &&
    !/nbr\s*5410|nr-?10|iec\s*60947/i.test(text) &&
    !findings.some((f) => f.code === 'NC-NORM-002')
  ) {
    findings.push({
      id: `nc-gen-${Date.now()}-3`,
      code: 'NC-NORM-103',
      title: 'Ausência de Citação às Normas NBR 5410 / NR-10 / IEC 60947-6-1',
      category: NCCategory.NORMATIVE_ELECTRICAL,
      severity: NCSeverity.MAJOR,
      normativeClause: 'ABNT NBR 5410 & NR-10',
      excerpt: 'Quadro / QTA / ATS sem base normativa explícita',
      lineRange: 'Documento técnico',
      description:
        'O trecho técnico descreve quadros de transferência automática sem referenciar requisitos mínimos de organização de condutores em canaletas, amarração e segurança NR-10.',
      recommendation:
        'Adicionar nota normativa citando ABNT NBR 5410, NR-10 e IEC 60947-6-1.',
      replacementBefore: text.slice(0, Math.min(text.length, 80)),
      replacementAfter: `${text.slice(0, Math.min(text.length, 80))}\n[Nota Normativa: Em conformidade com ABNT NBR 5410, NR-10 e IEC 60947-6-1.]`,
      applied: false,
    });
  }

  return {
    auditId: `aud-doc-${Date.now()}`,
    timestamp: new Date().toISOString(),
    documentTitle: isElectricalOrDc
      ? `Auditoria Normativa (${tierLevel.replace('_', ' ')})`
      : 'Auditoria Documental & Governança de Evidência',
    tierLevel,
    totalFindings: findings.length,
    criticalCount: findings.filter((f) => f.severity === NCSeverity.CRITICAL).length,
    majorCount: findings.filter((f) => f.severity === NCSeverity.MAJOR).length,
    minorCount: findings.filter((f) => f.severity === NCSeverity.MINOR).length,
    findings,
    correctedDocument: corrected,
    summary:
      findings.length > 0
        ? `Foram detectadas ${findings.length} NCs (${tierLevel.replace('_', ' ')}): ${findings.filter((f) => f.severity === NCSeverity.CRITICAL).length} críticas e ${findings.filter((f) => f.severity === NCSeverity.MAJOR).length} maiores.`
        : `Evidência em conformidade (${tierLevel.replace('_', ' ')} · ABNT/Normas).`,
    analysisSource: 'normative-rule-engine',
  };
}

export async function runDocumentAudit(
  documentText: string,
  useAi = false,
  tierLevel: DataCenterTier = 'TIER_III'
): Promise<DocumentAuditResponse> {
  const documentSha256 = await computeCanonicalSha256(documentText);
  const { data, vucProof } = await runGovernedWithVucProof({
    operation: 'execute',
    resourcePath: 'server/ncEngine.ts#runDocumentAudit',
    inputSummary: {
      documentLength: documentText.length,
      documentSha256,
      useAi,
      tierLevel,
    },
    executor: async () => {
      const baseline = deterministicDocumentAudit(documentText, tierLevel);
      const ai = useAi ? getGeminiClient() : null;
      if (!ai) {
        return baseline as unknown as Record<string, unknown>;
      }

      try {
        const response = await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: `Analise o seguinte texto técnico de engenharia elétrica / Data Center (${tierLevel}) quanto a Não Conformidades (NC) normativas (ABNT NBR 5410, NR-10, IEC 60947-6-1, IEC 61439-2, ANSI/TIA-942), documentais (ABNT NBR 14724) e segurança.

Texto para auditoria:
"""
${documentText}
"""

Retorne uma lista objetiva de NCs em JSON estruturado, garantindo que replacementBefore seja um trecho exato existente no texto original.`,
          config: {
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                summary: { type: Type.STRING },
                findings: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      code: { type: Type.STRING },
                      title: { type: Type.STRING },
                      category: { type: Type.STRING },
                      severity: { type: Type.STRING },
                      normativeClause: { type: Type.STRING },
                      excerpt: { type: Type.STRING },
                      lineRange: { type: Type.STRING },
                      description: { type: Type.STRING },
                      recommendation: { type: Type.STRING },
                      replacementBefore: { type: Type.STRING },
                      replacementAfter: { type: Type.STRING },
                    },
                    required: [
                      'code',
                      'title',
                      'severity',
                      'normativeClause',
                      'description',
                      'recommendation',
                      'replacementBefore',
                      'replacementAfter',
                    ],
                  },
                },
              },
              required: ['summary', 'findings'],
            },
          },
        });

        const parsed = JSON.parse((response.text ?? '{}').trim()) as {
          summary?: string;
          findings?: Array<Partial<DocumentNC>>;
        };

        if (!Array.isArray(parsed.findings) || parsed.findings.length === 0) {
          return baseline as unknown as Record<string, unknown>;
        }

        let corrected = documentText;
        const mappedFindings: DocumentNC[] = parsed.findings.map((item, idx) => {
          const before = item.replacementBefore ?? '';
          const after = item.replacementAfter ?? before;
          if (before && corrected.includes(before)) {
            corrected = corrected.replace(before, after);
          }

          const rawSev = (item.severity ?? 'MAJOR').toUpperCase();
          const severity =
            rawSev === 'CRITICAL'
              ? NCSeverity.CRITICAL
              : rawSev === 'MINOR'
                ? NCSeverity.MINOR
                : NCSeverity.MAJOR;

          const rawCat = (item.category ?? 'DOCUMENTAL_REFERENCE').toUpperCase();
          const category = Object.values(NCCategory).includes(rawCat as NCCategory)
            ? (rawCat as NCCategory)
            : NCCategory.DOCUMENTAL_REFERENCE;

          return {
            id: `nc-ai-${idx + 1}`,
            code: item.code ?? `NC-AI-00${idx + 1}`,
            title: item.title ?? 'Não Conformidade Detectada',
            category,
            severity,
            normativeClause: item.normativeClause ?? 'ABNT NBR 5410 / NBR 14724',
            excerpt: item.excerpt ?? before.slice(0, 120),
            lineRange: item.lineRange ?? 'Trecho auditado',
            description: item.description ?? '',
            recommendation: item.recommendation ?? '',
            replacementBefore: before,
            replacementAfter: after,
            applied: false,
          };
        });

        const merged = [...mappedFindings, ...baseline.findings];
        return {
          auditId: `aud-doc-${Date.now()}`,
          timestamp: new Date().toISOString(),
          documentTitle: baseline.documentTitle,
          tierLevel,
          totalFindings: merged.length,
          criticalCount: merged.filter((f) => f.severity === NCSeverity.CRITICAL).length,
          majorCount: merged.filter((f) => f.severity === NCSeverity.MAJOR).length,
          minorCount: merged.filter((f) => f.severity === NCSeverity.MINOR).length,
          findings: merged,
          correctedDocument: corrected,
          summary: parsed.summary ?? baseline.summary,
          analysisSource: 'gemini-4-hydrogen',
        } as unknown as Record<string, unknown>;
      } catch (err) {
        console.warn('[ncEngine] Fallback para motor determinístico:', err);
        return baseline as unknown as Record<string, unknown>;
      }
    },
  });

  return {
    ...(data as unknown as DocumentAuditResponse),
    vucProof,
  };
}

export async function runImageMaskAudit(params: {
  imageBase64: string;
  mimeType?: string;
  imageLabel?: string;
  contextText?: string;
  externalEndpointUrl?: string;
  provenance?: ImageProvenance;
  tierLevel?: DataCenterTier;
}): Promise<ImageAuditResponse> {
  const {
    imageBase64,
    mimeType = 'image/jpeg',
    imageLabel = 'Painel Enviado',
    contextText = '',
    externalEndpointUrl,
    provenance,
    tierLevel = 'TIER_III',
  } = params;

  if (!imageBase64 || imageBase64.trim().length < 32) {
    throw new Error('Imagem real em base64 é obrigatória. Nenhum dado simulado permitido.');
  }

  const imageSha256 = await computeCanonicalSha256(imageBase64);
  const fullProvenance: ImageProvenance = {
    suppliedBy: provenance?.suppliedBy?.trim() || 'Engenharia / Upload Direto',
    suppliedDate: provenance?.suppliedDate?.trim() || new Date().toISOString().slice(0, 10),
    sourceName: provenance?.sourceName?.trim() || imageLabel,
    sourceUrl: provenance?.sourceUrl?.trim() || 'local://upload',
    imageSha256,
  };

  const { data, vucProof } = await runGovernedWithVucProof({
    operation: 'execute',
    resourcePath: 'server/cvMaskEngine.ts#analyzePanelImagePixels',
    inputSummary: {
      imageLabel,
      imageSha256,
      mimeType,
      tierLevel,
      suppliedBy: fullProvenance.suppliedBy,
      suppliedDate: fullProvenance.suppliedDate,
      sourceUrl: fullProvenance.sourceUrl,
      externalEndpointConfigured: Boolean(externalEndpointUrl),
    },
    executor: async () => {
      if (externalEndpointUrl && /^https?:\/\//i.test(externalEndpointUrl.trim())) {
        const cleanB64 = imageBase64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');
        const buffer = Buffer.from(cleanB64, 'base64');
        const form = new FormData();
        form.append('image', new Blob([buffer], { type: mimeType }), 'panel.jpg');
        form.append('context_text', contextText);

        const extRes = await fetch(externalEndpointUrl.trim(), {
          method: 'POST',
          body: form,
        });
        if (!extRes.ok) {
          throw new Error(
            `Endpoint externo retornou HTTP ${extRes.status} (${extRes.statusText}).`
          );
        }
        const extJson = (await extRes.json()) as ImageAuditResponse;
        return {
          ...extJson,
          provenance: fullProvenance,
          tierLevel,
          analysisSource: 'external-open-cv-endpoint',
        } as unknown as Record<string, unknown>;
      }

      const cvOut = await analyzePanelImagePixels({
        imageBase64,
        mimeType,
        imageLabel,
        contextText,
      });

      return {
        ...cvOut,
        provenance: fullProvenance,
        tierLevel,
      } as unknown as Record<string, unknown>;
    },
  });

  return {
    ...(data as unknown as ImageAuditResponse),
    vucProof,
  };
}
