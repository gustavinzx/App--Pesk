/**
 * Teste de arquitetura em camadas (equivalente ao ArchUnit do Java).
 *
 * Lê os imports de todos os arquivos de src/, classifica cada arquivo em uma
 * camada pelo caminho e falha se algum import violar as regras de dependência.
 * Não precisa de biblioteca extra: roda no Jest que o projeto já usa (npm test).
 */
import * as fs from 'fs';
import * as path from 'path';

/* ───────────── Camadas ───────────── */

type Layer =
  | 'domain'      // src/core/domain
  | 'business'    // src/core/business (serviços + portas)
  | 'http'        // src/backend/server (apresentação da API), exceto server.ts
  | 'composition' // src/backend/server/server.ts (monta as implementações)
  | 'data'        // src/backend/data (adaptadores Firestore / storage)
  | 'auth'        // src/backend/auth
  | 'config'      // src/backend/config
  | 'backendTest' // src/backend/test (repositório em memória)
  | 'frontend'    // src/frontend
  | 'app';        // src/app (rotas do Expo Router)

const LAYER_BY_PREFIX: [string, Layer][] = [
  ['src/core/domain/', 'domain'],
  ['src/core/business/', 'business'],
  ['src/backend/server/server.ts', 'composition'],
  ['src/backend/server/', 'http'],
  ['src/backend/data/', 'data'],
  ['src/backend/auth/', 'auth'],
  ['src/backend/config/', 'config'],
  ['src/backend/test/', 'backendTest'],
  ['src/frontend/', 'frontend'],
  ['src/app/', 'app'],
];

/** Quem pode depender de quem. Tudo que não está aqui é proibido. */
const ALLOWED: Record<Layer, Layer[]> = {
  domain: ['domain'],
  business: ['business', 'domain'],
  http: ['http', 'business', 'domain'],
  composition: ['composition', 'http', 'data', 'auth', 'config', 'business', 'domain'],
  data: ['data', 'config', 'business', 'domain'],
  auth: ['auth', 'config', 'business', 'domain'],
  config: ['config'],
  backendTest: ['backendTest', 'business', 'domain'],
  frontend: ['frontend', 'business', 'domain'],
  app: ['app', 'frontend'],
};

/**
 * Dívida técnica conhecida: o frontend importa código de cliente Firebase que
 * hoje mora em src/backend. Está listada para o teste passar, mas qualquer
 * NOVA violação falha. Se um item sair do código, o teste cobra a remoção daqui.
 * Solução definitiva: mover esses arquivos para src/frontend.
 */
const KNOWN_DEBT = new Set([]);

/** Pacotes que só o servidor pode usar. */
const SERVER_ONLY_PACKAGES = [/^firebase-admin(\/|$)/, /^fastify$/, /^@fastify\//, /^@google-cloud\//];
/** O app nunca grava direto no Firestore: só via API. */
const CLIENT_FORBIDDEN_PACKAGES = [/^firebase\/firestore$/, ...SERVER_ONLY_PACKAGES];
/** Domínio e negócio devem ser puros: sem framework, banco ou UI. */
const PURE_FORBIDDEN_PACKAGES = [
  ...SERVER_ONLY_PACKAGES,
  /^firebase(\/|$)/,
  /^react(-native)?(\/|$)/,
  /^expo(-|\/|$)/,
  /^@expo\//,
];

/* ───────────── Leitura do grafo de imports ───────────── */

export interface Edge {
  from: string;     // arquivo de origem (relativo à raiz, com /)
  to: string | null; // arquivo de destino, quando é import relativo
  spec: string;     // texto do import
}

const ROOT = path.resolve(__dirname, '..');
const EXTS = ['.ts', '.tsx', '.js', '.jsx'];
const IGNORED_DIRS = new Set(['node_modules', 'dist', '.expo', 'local-data', '.git']);
const IMPORT_RE =
  /(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\sfrom\s+)?['"]([^'"]+)['"]|require\(\s*['"]([^'"]+)['"]\s*\)|import\(\s*['"]([^'"]+)['"]\s*\)/g;

const posix = (p: string) => p.split(path.sep).join('/');
const isTestFile = (f: string) => /\.(test|spec)\.[jt]sx?$/.test(f) || f.includes('/__tests__/');

function listSources(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    if (IGNORED_DIRS.has(entry.name)) return [];
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listSources(full);
    return EXTS.includes(path.extname(entry.name)) && !entry.name.endsWith('.d.ts') ? [full] : [];
  });
}

function resolveRelative(fromFile: string, spec: string): string | null {
  const base = path.resolve(path.dirname(fromFile), spec);
  const candidates = [base, ...EXTS.map(e => base + e), ...EXTS.map(e => path.join(base, 'index' + e))];
  const hit = candidates.find(c => fs.existsSync(c) && fs.statSync(c).isFile());
  return hit ? posix(path.relative(ROOT, hit)) : null;
}

export function collectGraph(): { files: string[]; edges: Edge[] } {
  const sources: string[] = [];
  const edges: Edge[] = [];
  for (const file of listSources(path.join(ROOT, 'src'))) {
    const rel = posix(path.relative(ROOT, file));
    if (isTestFile(rel)) continue;
    sources.push(rel);
    const code = fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    for (const m of code.matchAll(IMPORT_RE)) {
      const spec = m[1] ?? m[2] ?? m[3];
      edges.push({ from: rel, spec, to: spec.startsWith('.') ? resolveRelative(file, spec) : null });
    }
  }
  return { files: sources, edges };
}

/* ───────────── Regras (funções puras, testáveis) ───────────── */

export const layerOf = (file: string): Layer | null =>
  LAYER_BY_PREFIX.find(([prefix]) => file.startsWith(prefix))?.[1] ?? null;

const label = (e: Edge) => `${e.from} -> ${e.to ?? e.spec}`;

/** Import relativo que cruza para uma camada não permitida. */
export function layerViolations(edges: Edge[]): Edge[] {
  return edges.filter(e => {
    if (!e.to) return false;
    const a = layerOf(e.from);
    const b = layerOf(e.to);
    if (!a || !b) return false;
    return !ALLOWED[a].includes(b);
  });
}

/** Import de pacote externo proibido para a camada. */
export function packageViolations(edges: Edge[], layers: Layer[], forbidden: RegExp[]): Edge[] {
  return edges.filter(e => {
    if (e.to || e.spec.startsWith('.')) return false;
    const a = layerOf(e.from);
    return !!a && layers.includes(a) && forbidden.some(re => re.test(e.spec));
  });
}

/** Ciclos entre arquivos (A -> B -> A). */
export function findCycles(edges: Edge[]): string[][] {
  const graph = new Map<string, string[]>();
  for (const e of edges) if (e.to) graph.set(e.from, [...(graph.get(e.from) ?? []), e.to]);
  const cycles: string[][] = [];
  const state = new Map<string, 1 | 2>();
  const stack: string[] = [];
  const visit = (node: string) => {
    state.set(node, 1);
    stack.push(node);
    for (const next of graph.get(node) ?? []) {
      if (state.get(next) === 1) cycles.push([...stack.slice(stack.indexOf(next)), next]);
      else if (!state.has(next)) visit(next);
    }
    stack.pop();
    state.set(node, 2);
  };
  for (const node of graph.keys()) if (!state.has(node)) visit(node);
  return cycles;
}

/* ───────────── Testes ───────────── */

describe('Arquitetura em camadas do Pesk', () => {
  const { files, edges } = collectGraph();

  it('encontra arquivos em todas as camadas (o teste não está vazio)', () => {
    const found = new Set(files.map(layerOf));
    for (const layer of ['domain', 'business', 'http', 'data', 'frontend', 'app'] as Layer[]) {
      expect(found).toContain(layer);
    }
  });

  it('todo arquivo de src/ pertence a alguma camada conhecida', () => {
    const orphans = files.filter(f => !layerOf(f));
    expect(orphans).toEqual([]);
  });

  describe('regras de dependência entre camadas', () => {
    it('domínio não depende de nenhuma outra camada', () => {
      const bad = layerViolations(edges).filter(e => layerOf(e.from) === 'domain');
      expect(bad.map(label)).toEqual([]);
    });

    it('negócio depende só do domínio (nunca de backend, frontend ou app)', () => {
      const bad = layerViolations(edges).filter(e => layerOf(e.from) === 'business');
      expect(bad.map(label)).toEqual([]);
    });

    it('apresentação HTTP nunca acessa a camada de dados nem o Firestore', () => {
      const bad = layerViolations(edges).filter(e => layerOf(e.from) === 'http');
      expect(bad.map(label)).toEqual([]);
      const pkgs = packageViolations(edges, ['http'], [/^firebase(-admin)?(\/|$)/, /^@google-cloud\//]);
      expect(pkgs.map(label)).toEqual([]);
    });

    it('adaptadores de dados não dependem da API HTTP nem do frontend', () => {
      const bad = layerViolations(edges).filter(e => ['data', 'auth', 'config'].includes(layerOf(e.from) ?? ''));
      expect(bad.map(label)).toEqual([]);
    });

    it('rotas do Expo (src/app) só conhecem o frontend', () => {
      const bad = layerViolations(edges).filter(e => layerOf(e.from) === 'app');
      expect(bad.map(label)).toEqual([]);
    });

    it('frontend não depende de servidor, exceto a dívida técnica listada', () => {
      const bad = layerViolations(edges)
        .filter(e => layerOf(e.from) === 'frontend')
      expect(bad.map(label)).toEqual([]);
    });

    it('a dívida técnica listada ainda existe (se saiu do código, remova da lista)', () => {
      const current = new Set(layerViolations(edges).map(label));
      const stale = [...KNOWN_DEBT].filter(item => !current.has(item));
      expect(stale).toEqual([]);
    });

    it('nenhuma outra camada depende da composição (server.ts é o ponto de montagem)', () => {
      const bad = edges.filter(e => e.to && layerOf(e.to) === 'composition' && layerOf(e.from) !== 'composition');
      expect(bad.map(label)).toEqual([]);
    });
  });

  describe('regras de pacotes externos', () => {
    it('domínio e negócio são puros (sem Firebase, Fastify, React ou Expo)', () => {
      expect(packageViolations(edges, ['domain', 'business'], PURE_FORBIDDEN_PACKAGES).map(label)).toEqual([]);
    });

    it('Firebase Admin e Fastify existem só no servidor', () => {
      const bad = packageViolations(edges, ['frontend', 'app'], CLIENT_FORBIDDEN_PACKAGES);
      expect(bad.map(label)).toEqual([]);
    });

    it('o cliente não grava direto no Firestore (só via API)', () => {
      const bad = packageViolations(edges, ['frontend', 'app', 'config'], [/^firebase\/firestore$/]);
      expect(bad.map(label)).toEqual([]);
    });
  });

  it('não há dependências circulares entre arquivos', () => {
    expect(findCycles(edges).map(c => c.join(' -> '))).toEqual([]);
  });
});

/* ───────────── Prova de que o detector funciona ───────────── */

describe('o detector realmente pega violações (grafo fictício)', () => {
  const fake = (from: string, to: string | null, spec = to ?? 'x'): Edge => ({ from, to, spec });

  it('acusa a apresentação HTTP importando o repositório Firestore', () => {
    const edges = [fake('src/backend/server/app.ts', 'src/backend/data/PescariaRepositoryFirestore.ts')];
    expect(layerViolations(edges)).toHaveLength(1);
  });

  it('acusa o domínio importando firebase-admin', () => {
    const edges = [fake('src/core/domain/Pescaria.ts', null, 'firebase-admin/firestore')];
    expect(packageViolations(edges, ['domain'], PURE_FORBIDDEN_PACKAGES)).toHaveLength(1);
  });

  it('acusa negócio importando dados', () => {
    const edges = [fake('src/core/business/GerenciarPescariasService.ts', 'src/backend/data/LocalFotoStorage.ts')];
    expect(layerViolations(edges)).toHaveLength(1);
  });

  it('aceita o sentido correto: dados implementando a porta do negócio', () => {
    const edges = [fake('src/backend/data/PescariaRepositoryFirestore.ts', 'src/core/business/ports/PescariaRepository.ts')];
    expect(layerViolations(edges)).toHaveLength(0);
  });

  it('acusa ciclo A -> B -> A', () => {
    const edges = [fake('src/frontend/a.ts', 'src/frontend/b.ts'), fake('src/frontend/b.ts', 'src/frontend/a.ts')];
    expect(findCycles(edges)).toHaveLength(1);
  });
});
