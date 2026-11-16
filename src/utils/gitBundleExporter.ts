/**
 * @file gitBundleExporter.ts
 * @responsibility Gerador client-side de pacote Git versionado (.zip) contendo documento corrigido, histórico de commits e laudo de conformidade.
 * @version 3.0.0
 * @date 2026-11-15
 * @directory /src/utils/gitBundleExporter.ts
 * @signature PO Zeh Sobrinho & Senior Agile DevOps Team (AI Framework)
 */

import JSZip from 'jszip';
import { DocumentVersionCommit } from '../types/audit';

export async function generateGitRepoZip(
  commits: DocumentVersionCommit[],
  latestDocument: string,
  projectName = 'lume-nc-auditor'
): Promise<Blob> {
  const zip = new JSZip();

  zip.file(
    'README.md',
    `# ${projectName}\n\n` +
      `Auditoria de Evidências & Não Conformidades Normativas (Imagem, Documento, URL e Repositório).\n` +
      `Persistência SQLite RAID-1 + Firebase Firestore · Governança criptográfica scoobiii/vuc.\n\n` +
      `- Versão exportada: ${commits[commits.length - 1]?.version ?? 'v1.0.0'}\n` +
      `- Commits registrados: ${commits.length}\n`
  );

  zip.file('docs/evidencia_auditada_atual.md', latestDocument);
  zip.file('git_history.json', JSON.stringify(commits, null, 2));

  const patchesFolder = zip.folder('patches');
  commits.forEach((c, idx) => {
    patchesFolder?.file(
      `${String(idx + 1).padStart(2, '0')}_${c.shortHash}_${c.version}.md`,
      `# Commit ${c.hash}\n# Author: ${c.author}\n# Date: ${c.date}\n# Message: ${c.message}\n# VUC Proof Hash: ${c.vucProofHash ?? 'N/A'}\n\n${c.content}`
    );
  });

  return zip.generateAsync({ type: 'blob' });
}
