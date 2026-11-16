<!--
  @file README.md
  @responsibility Documentação completa do projeto Lume (lume-nc-auditor): instalação, SQLite RAID-1 + Firebase, Dashboard Recharts, Visão Computacional, CAD NURBS, scoobiii/vuc e Docker.
  @version 3.1.0
  @date 2026-11-15
  @directory /README.md
  @signature PO Zeh Sobrinho & Senior Agile DevOps Team (AI Framework)
-->

# `lume-nc-auditor` · Lume

> **Repositório Git:** `lume-nc-auditor`  
> **Product Owner:** Zeh Sobrinho · **Engineering:** Senior Agile DevOps Team (AI Framework)  
> **Normas Aplicadas:** ABNT NBR 5410 · NR-10 · IEC 60947-6-1 · IEC 61439-2 · ABNT NBR 14724 · ANSI/TIA-942 · WCAG 2.1

**Lume** é uma plataforma full-stack (`Express` + `React 19` + `Vite 8` + `Tailwind CSS v4` + `Recharts` + `node:sqlite` + `Firebase`) para auditoria normativa e documental sob demanda (**Workspace-on-Demand**):

1. **Landing Page & Navegação Pervasiva**: tela inicial editorial no preview apresentando o fluxo arquitetural, com acesso contínuo via barra superior a **Início**, **Auditar**, **Dashboard** e **Git & API**.
2. **Ingestão Generalizada de Evidências (`POST /api/evidence/ingest`)**: aceita **Imagem** (`.jpg`, `.png`, `.webp`), **Documento Anexo** (`.txt`, `.md`, `.json`, `.html`, `.csv`, `.log`), **URL Remota** (com proteção SSRF e detecção automática de imagem vs HTML) e **Repositório Git/GitHub público**.
3. **Dashboard Analítico Recharts (`AuditDashboardView`)**: exibe métricas reais agregadas do histórico persistido com **Não Conformidades por Tier** (*Gráfico de Rosca*) e **Tendência de Conformidade ao longo do tempo** (*Gráfico de Linha*).
4. **Persistência SQLite em RAID-1 Espelhado + Firebase Firestore**: gravação simultânea em dois espelhos SQLite nativos (`data/raid_mirror_a` e `data/raid_mirror_b`) com checksum SHA-256 e auto-cura automática, operando **100% sem API Key** e replicando no Firestore quando autenticado.
5. **Visão Computacional Determinística & CAD/NURBS**: máscaras pixel-a-pixel (`HSV + Sobel 3x3 + CCL + Fecho Convexo`), planta corrigida `Fig. 03`, exportação `IGES 126`, `DXF R2000`, `STL` binário 3D e provas criptográficas **`scoobiii/vuc`** (`Ed25519 + RFC 8785 JCS`) + MCP JSON-RPC 2.0.

---

## 1. Pré-requisitos do Ambiente

### Execução Local (Host)
- **Node.js:** `>= 22.13` LTS com suporte nativo a `node:sqlite` (testado em `v22.23.2`)
- **npm:** `>= 10.x`
- **curl** (opcional, para smoke tests HTTP nos endpoints `/api/*`)

### Execução Containerizada (Docker)
- **Docker Engine:** `>= 24.x`
- **Docker Compose v2:** `>= 2.20` (`docker compose`)

---

## 2. Instalação e Configuração

```bash
# 1. Clonar o repositório
git clone <URL_DO_REPOSITORIO> lume-nc-auditor
cd lume-nc-auditor

# 2. Configurar variáveis de ambiente
cp .env.example .env

# 3. Instalar dependências (frontend + backend)
npm install
```

### Variáveis de Ambiente (`.env`)
| Variável | Obrigatória | Padrão | Descrição |
| :--- | :--- | :--- | :--- |
| `PORT` | Não | `3000` | Porta HTTP do servidor Express + Vite |
| `NODE_ENV` | Não | `development` | `development` (Vite middleware) ou `production` (serve `/dist`) |
| `DISABLE_HMR` | Não | `true` | Desabilita reload automático durante edições automatizadas |
| `GEMINI_API_KEY` | Não | — | Opcional. Na ausência da chave, toda auditoria determinística, visão computacional em pixels, CAD/NURBS, provas VUC e persistência **SQLite RAID-1** funcionam integralmente. |
| `RAID_DISK_A_DIR` | Não | `./data/raid_mirror_a` | Diretório do Espelho A do banco SQLite RAID-1 |
| `RAID_DISK_B_DIR` | Não | `./data/raid_mirror_b` | Diretório do Espelho B do banco SQLite RAID-1 |
| `APP_URL` | Não | `http://localhost:3000` | URL base publicada da aplicação |

---

## 3. Verificação de Dependências e Build

```bash
# Verificar runtime Node.js e módulo nativo node:sqlite
node -v && node -e "import('node:sqlite').then(() => console.log('SQLITE_NATIVO_OK'))"

# Validar importação dos módulos principais
node -e "Promise.all(['express','vite','dotenv','jpeg-js','pngjs','jszip','recharts','@google/genai','@vucfoundation/vuc'].map(m => import(m))).then(() => console.log('DEPENDENCIAS_OK'))"

# Typecheck estrito TypeScript
npm run lint

# Build de produção Vite (/dist)
npm run build
```

---

## 4. Execução Local e via Docker

### Desenvolvimento e Produção Local
```bash
# Desenvolvimento (Express + Vite Middleware na porta 3000)
npm run dev

# Produção local
npm run build
NODE_ENV=production ./node_modules/.bin/tsx server.ts
```

### Docker Compose (com volumes persistentes RAID-1)
```bash
docker compose up --build -d
curl -s http://127.0.0.1:3000/api/health
docker compose down
```

---

## 5. API REST e Governança (`/api/*`)

- `GET /api/health` — Status do serviço `lume-nc-auditor-api`, motor CV e SQLite RAID-1
- `POST /api/evidence/ingest` — Ingestão e auditoria unificada (`image`, `document`, `url`, `repository`)
- `GET /api/raid/status` — Saúde dos espelhos `Mirror A` e `Mirror B`, contagem de registros e auto-cura
- `GET /api/raid/audits` · `GET /api/raid/audits/:id` · `POST /api/raid/audits` · `DELETE /api/raid/audits/:id`
- `POST /api/nc/audit-document` — Auditoria normativa/documental com classificação Data Center Tier I–IV
- `POST /api/nc/detect-masks` — Máscaras determinísticas em pixels RGBA + saída PNG transparente
- `POST /api/nc/remediate-image` — Patch visual e binários CAD/NURBS (`IGES`, `DXF`, `STL` binário)
- `POST /api/nc/vuc/verify` · `GET /api/mcp/tools` · `POST /api/mcp/rpc` · `GET /api/git/tree` · `GET /api/nc/openapi.json`
