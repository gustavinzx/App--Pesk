import assert from 'node:assert/strict';
import test from 'node:test';
import { GerenciarPerfilUsuarioService } from '../../core/business/GerenciarPerfilUsuarioService.js';
import { GerenciarPescariasService } from '../../core/business/GerenciarPescariasService.js';
import type {
  AtualizacaoPerfilUsuario,
  NovoPerfilUsuario,
  PerfilUsuarioRepository,
} from '../../core/business/ports/PerfilUsuarioRepository.js';
import { PerfilDuplicadoRepositoryError } from '../../core/business/ports/PerfilUsuarioRepository.js';
import type { Usuario } from '../../core/domain/Usuario.js';
import { MemoryPescariaRepository } from '../test/MemoryPescariaRepository.js';
import { buildServer } from './app.js';

const validUser = { uid: 'firebase-uid-123', email: 'ana@pesk.com' };

class MemoriaPerfilRepository implements PerfilUsuarioRepository {
  private readonly perfis = new Map<string, Usuario>();

  async criar(perfil: NovoPerfilUsuario): Promise<void> {
    if (this.perfis.has(perfil.id)) throw new PerfilDuplicadoRepositoryError();
    this.perfis.set(perfil.id, { ...perfil });
  }

  async buscarPorId(id: string): Promise<Usuario | null> {
    return this.perfis.get(id) ?? null;
  }

  async atualizar(
    id: string,
    dados: AtualizacaoPerfilUsuario
  ): Promise<Usuario | null> {
    const perfil = this.perfis.get(id);
    if (!perfil) return null;
    const atualizado = { ...perfil, ...dados };
    this.perfis.set(id, atualizado);
    return atualizado;
  }

  async excluir(id: string): Promise<boolean> {
    return this.perfis.delete(id);
  }
}

async function createTestServer(options: { tokenValido?: boolean } = {}) {
  const repository = new MemoriaPerfilRepository();
  const gerenciarPerfil = new GerenciarPerfilUsuarioService(repository);
  const pescariaRepository = new MemoryPescariaRepository();
  const fotoStorage = {
    async salvar(path: string) {
      return {
        url: `http://localhost:3000/uploads/${path}.jpg`,
        path: `${path}.jpg`,
      };
    },
    async excluir() {},
    async obter() {
      return { bytes: new Uint8Array([1, 2, 3]), contentType: 'image/jpeg' };
    },
  };
  let agora = new Date('2026-10-16T12:00:00.000Z');
  const gerenciarPescarias = new GerenciarPescariasService(
    pescariaRepository,
    fotoStorage,
    (() => {
      let value = 0;
      return () => `id-${++value}`;
    })(),
    (() => { let value = 0; return () => 'INVITE' + ++value; })(),
    () => agora
  );
  const usuarios = {
    'valid-token': validUser,
    'owner-token': { uid: 'owner-uid', email: 'owner@pesk.com' },
    'guest-token': { uid: 'guest-uid', email: 'guest@pesk.com' },
  };
  const server = await buildServer(
    {
      verificadorToken: {
        async verificar(token) {
          if (!options.tokenValido || !(token in usuarios)) {
            throw new Error('invalid token');
          }
          return usuarios[token as keyof typeof usuarios];
        },
      },
      gerenciarPerfil,
      gerenciarPescarias,
      fotoStorage,
    },
    { logger: false }
  );
  return {
    server,
    repository,
    pescariaRepository,
    setNow(value: string) {
      agora = new Date(value);
    },
  };
}

const authHeader = { authorization: 'Bearer valid-token' };

test('health endpoint reports the API as ready', async () => {
  const { server } = await createTestServer();
  try {
    const response = await server.inject({ method: 'GET', url: '/health' });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { status: 'ok' });
  } finally {
    await server.close();
  }
});

test('challenge API rejects Firestore display labels as request criteria', async () => {
  const { server } = await createTestServer({ tokenValido: true });
  try {
    const response = await server.inject({
      method: 'POST',
      url: '/api/desafios',
      headers: { authorization: 'Bearer owner-token' },
      payload: {
        nome: 'Desafio com critérios do Firestore',
        inicio: '2026-10-23T10:00:00.000Z',
        fim: '2026-10-24T10:00:00.000Z',
        criteriosRanking: ['MAIS_PEIXES', 'MENOR_TEMPO'],
      },
    });

    assert.equal(response.statusCode, 400);
  } finally {
    await server.close();
  }
});

test('local uploaded photos are returned by the public photo route', async () => {
  const { server } = await createTestServer({ tokenValido: true });
  try {
    const response = await server.inject({
      method: 'GET',
      url: '/uploads/desafios/teste/captura.jpg',
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.headers['content-type'], 'image/jpeg');
    assert.deepEqual([...response.rawPayload], [1, 2, 3]);
  } finally {
    await server.close();
  }
});

test('profile CRUD works through HTTP and uses the authenticated UID', async () => {
  const { server } = await createTestServer({ tokenValido: true });
  try {
    const create = await server.inject({
      method: 'POST',
      url: '/api/usuarios/me',
      headers: authHeader,
      payload: { nome: '  Ana Silva  ' },
    });
    assert.equal(create.statusCode, 201);
    const created = create.json<Usuario>();
    assert.equal(created.id, validUser.uid);
    assert.equal(created.nome, 'Ana Silva');
    assert.equal(created.email, validUser.email);
    assert.ok(created.criadoEm);

    const duplicate = await server.inject({
      method: 'POST',
      url: '/api/usuarios/me',
      headers: authHeader,
      payload: { nome: 'Outro nome' },
    });
    assert.equal(duplicate.statusCode, 409);

    const read = await server.inject({
      method: 'GET',
      url: '/api/usuarios/me',
      headers: authHeader,
    });
    assert.equal(read.statusCode, 200);
    assert.deepEqual(read.json(), created);

    const update = await server.inject({
      method: 'PATCH',
      url: '/api/usuarios/me',
      headers: authHeader,
      payload: { nome: 'Ana Costa' },
    });
    assert.equal(update.statusCode, 200);
    assert.equal(update.json<Usuario>().nome, 'Ana Costa');
    assert.equal(update.json<Usuario>().criadoEm, created.criadoEm);
    assert.ok(update.json<Usuario>().atualizadoEm);

    const remove = await server.inject({
      method: 'DELETE',
      url: '/api/usuarios/me',
      headers: authHeader,
    });
    assert.equal(remove.statusCode, 204);

    const missingAfterDelete = await server.inject({
      method: 'GET',
      url: '/api/usuarios/me',
      headers: authHeader,
    });
    assert.equal(missingAfterDelete.statusCode, 404);
  } finally {
    await server.close();
  }
});

test('all profile routes reject missing and invalid Firebase tokens', async () => {
  const { server } = await createTestServer();
  try {
    const requests = [
      { method: 'POST' as const, payload: { nome: 'Ana' } },
      { method: 'GET' as const },
      { method: 'PATCH' as const, payload: { nome: 'Ana' } },
      { method: 'DELETE' as const },
    ];
    for (const request of requests) {
      const response = await server.inject({
        method: request.method,
        url: '/api/usuarios/me',
        ...(request.payload ? { payload: request.payload } : {}),
      });
      assert.equal(response.statusCode, 401);
    }

    const invalidToken = await server.inject({
      method: 'GET',
      url: '/api/usuarios/me',
      headers: { authorization: 'Bearer invalid-token' },
    });
    assert.equal(invalidToken.statusCode, 401);
  } finally {
    await server.close();
  }
});

test('profile endpoints reject invalid fields and client-supplied identity', async () => {
  const { server } = await createTestServer({ tokenValido: true });

  try {
    const blankName = await server.inject({
      method: 'POST',
      url: '/api/usuarios/me',
      headers: authHeader,
      payload: { nome: '   ' },
    });
    assert.equal(blankName.statusCode, 400);

    const unexpectedField = await server.inject({
      method: 'POST',
      url: '/api/usuarios/me',
      headers: authHeader,
      payload: {
        nome: 'Ana Silva',
        id: 'spoofed-id',
        email: 'fake@example.com',
      },
    });
    assert.equal(unexpectedField.statusCode, 400);
  } finally {
    await server.close();
  }
});

test('competition and capture CRUD follows business rules and calculates ranking', async () => {
  const { server, setNow } = await createTestServer({ tokenValido: true });
  const ownerHeader = { authorization: 'Bearer owner-token' };
  const guestHeader = { authorization: 'Bearer guest-token' };
  try {
    const createCompetition = await server.inject({
      method: 'POST',
      url: '/api/desafios',
      headers: ownerHeader,
      payload: {
        nome: 'Desafio da Represa',
        inicio: '2026-10-17T00:00:00.000Z',
        fim: '2026-10-20T23:59:59.000Z',
      },
    });
    assert.equal(createCompetition.statusCode, 201);
    const challenge = createCompetition.json<{
      id: string;
      codigoConvite: string;
      status: string;
    }>();
    assert.equal(challenge.status, 'aberto');

    const join = await server.inject({
      method: 'POST',
      url: '/api/desafios/entrar',
      headers: guestHeader,
      payload: { codigoConvite: challenge.codigoConvite },
    });
    assert.equal(join.statusCode, 201);

    const species = await server.inject({
      method: 'POST',
      url: '/api/especies',
      headers: ownerHeader,
      payload: { nome: 'Tucunaré', pesoMaxReferenciaKg: 20 },
    });
    assert.equal(species.statusCode, 201);
    const fish = species.json<{ id: string }>();

    setNow('2026-10-18T12:00:00.000Z');
    const createCapture = await server.inject({
      method: 'POST',
      url: `/api/desafios/${challenge.id}/registros`,
      headers: ownerHeader,
      payload: {
        especieId: fish.id,
        pesoKg: 4.2,
        comprimentoCm: 63,
        local: 'Represa do grupo',
        dataHora: '2026-10-18T10:00:00.000Z',
        fotoBase64: 'YWJj',
        fotoMimeType: 'image/jpeg',
      },
    });
    assert.equal(createCapture.statusCode, 201);
    const capture = createCapture.json<{
      id: string;
      fotoUrl: string;
      status: string;
    }>();
    assert.equal(capture.status, 'valido');
    assert.match(capture.fotoUrl, /^http:\/\/localhost:3000\/uploads\//);

    const detail = await server.inject({
      method: 'GET',
      url: `/api/desafios/${challenge.id}`,
      headers: guestHeader,
    });
    assert.equal(detail.statusCode, 200);
    const ranking = detail.json<{
      status: string;
      participantes: unknown[];
      rankingPesoTotal: Array<{ pescadorId: string; pesoTotalKg: number }>;
      melhorPeixe: { pescadorId: string; pesoKg: number };
    }>();
    assert.equal(ranking.status, 'ativo');
    assert.equal(ranking.participantes.length, 2);
    assert.equal(ranking.rankingPesoTotal[0].pescadorId, 'owner-uid');
    assert.equal(ranking.rankingPesoTotal[0].pesoTotalKg, 4.2);
    assert.equal(ranking.melhorPeixe.pesoKg, 4.2);

    const forbiddenUpdate = await server.inject({
      method: 'PATCH',
      url: `/api/registros/${capture.id}`,
      headers: guestHeader,
      payload: {
        especieId: fish.id,
        pesoKg: 5,
        local: 'Outro local',
        dataHora: '2026-10-18T11:00:00.000Z',
      },
    });
    assert.equal(forbiddenUpdate.statusCode, 403);

    const updateCapture = await server.inject({
      method: 'PATCH',
      url: `/api/registros/${capture.id}`,
      headers: ownerHeader,
      payload: {
        especieId: fish.id,
        pesoKg: 5,
        local: 'Outro local',
        dataHora: '2026-10-18T11:00:00.000Z',
      },
    });
    assert.equal(updateCapture.statusCode, 200);
    assert.equal(updateCapture.json<{ pesoKg: number }>().pesoKg, 5);

    const deleteCapture = await server.inject({
      method: 'DELETE',
      url: `/api/registros/${capture.id}`,
      headers: ownerHeader,
    });
    assert.equal(deleteCapture.statusCode, 204);
  } finally {
    await server.close();
  }
});

test('capture creation enforces reference weight and the daily limit', async () => {
  const { server, setNow } = await createTestServer({ tokenValido: true });
  const ownerHeader = { authorization: 'Bearer owner-token' };
  const guestHeader = { authorization: 'Bearer guest-token' };
  try {
    const challengeResponse = await server.inject({
      method: 'POST',
      url: '/api/desafios',
      headers: ownerHeader,
      payload: {
        nome: 'Desafio de teste',
        inicio: '2026-10-17T00:00:00.000Z',
        fim: '2026-10-20T23:59:59.000Z',
      },
    });
    const challenge = challengeResponse.json<{
      id: string;
      codigoConvite: string;
    }>();
    await server.inject({
      method: 'POST',
      url: '/api/desafios/entrar',
      headers: guestHeader,
      payload: { codigoConvite: challenge.codigoConvite },
    });
    const speciesResponse = await server.inject({
      method: 'POST',
      url: '/api/especies',
      headers: ownerHeader,
      payload: { nome: 'Traíra', pesoMaxReferenciaKg: 3 },
    });
    const species = speciesResponse.json<{ id: string }>();
    setNow('2026-10-18T12:00:00.000Z');

    const basePayload = {
      especieId: species.id,
      local: 'Lago',
      dataHora: '2026-10-18T10:00:00.000Z',
      fotoBase64: 'YWJj',
      fotoMimeType: 'image/jpeg',
    };
    const aboveReference = await server.inject({
      method: 'POST',
      url: `/api/desafios/${challenge.id}/registros`,
      headers: ownerHeader,
      payload: { ...basePayload, pesoKg: 3.1 },
    });
    assert.equal(aboveReference.statusCode, 400);

    for (let index = 0; index < 10; index += 1) {
      const response = await server.inject({
        method: 'POST',
        url: `/api/desafios/${challenge.id}/registros`,
        headers: ownerHeader,
        payload: { ...basePayload, pesoKg: 1 + index / 10 },
      });
      assert.equal(response.statusCode, 201);
    }
    const overDailyLimit = await server.inject({
      method: 'POST',
      url: `/api/desafios/${challenge.id}/registros`,
      headers: ownerHeader,
      payload: { ...basePayload, pesoKg: 2 },
    });
    assert.equal(overDailyLimit.statusCode, 409);
  } finally {
    await server.close();
  }
});

test('new groups persist metadata, cover, and only the largest-fish mode', async () => {
  const { server } = await createTestServer({ tokenValido: true });
  const headers = { authorization: 'Bearer owner-token' };
  try {
    const payload = { tipo: 'desafio', nome: 'Turma do rio', descricao: 'Nossa pescaria', capaTema: 'rio', inicio: '2026-10-17T09:00:00.000Z', fim: '2026-10-20T23:59:59.000Z', criteriosRanking: ['maior_peixe'], capaBase64: 'YWJj', capaMimeType: 'image/jpeg' };
    const response = await server.inject({ method: 'POST', url: '/api/desafios', headers, payload });
    assert.equal(response.statusCode, 201);
    const group = response.json();
    assert.equal(group.tipo, 'desafio');
    assert.equal(group.descricao, 'Nossa pescaria');
    assert.equal(group.capaTema, 'rio');
    assert.match(group.capaUrl, /\/grupos\/.+\/capa/);
    assert.deepEqual(group.criteriosRanking, ['maior_peixe']);
    const detail = await server.inject({ method: 'GET', url: '/api/desafios/' + group.id, headers });
    assert.equal(detail.json().descricao, 'Nossa pescaria');
    assert.equal(detail.json().rankingMaiorPeixe[0].maiorPeixeKg, 0);
    assert.deepEqual(detail.json().rankingPesoTotal, []);
  } finally { await server.close(); }
});

test('group validation rejects unsupported scoring, invalid dates, and incomplete covers', async () => {
  const { server } = await createTestServer({ tokenValido: true });
  const headers = { authorization: 'Bearer owner-token' };
  const base = { tipo: 'desafio', nome: 'Grupo inválido', inicio: '2026-10-17T09:00:00.000Z', fim: '2026-10-20T23:59:59.000Z', criteriosRanking: ['maior_peixe'] };
  try {
    for (const changes of [
      { criteriosRanking: ['peso_total'] },
      { fim: null },
      { fim: '2026-10-16T00:00:00.000Z' },
      { tipo: 'clube' },
      { descricao: 'x'.repeat(501) },
      { capaBase64: 'YWJj' },
      { capaTema: 'inexistente' },
    ]) {
      const result = await server.inject({ method: 'POST', url: '/api/desafios', headers, payload: { ...base, ...changes } });
      assert.equal(result.statusCode, 400, JSON.stringify(changes));
    }
  } finally { await server.close(); }
});

test('clubs remain active with one member and allow joining and capturing without an end date', async () => {
  const { server, setNow } = await createTestServer({ tokenValido: true });
  const owner = { authorization: 'Bearer owner-token' };
  try {
    const response = await server.inject({ method: 'POST', url: '/api/desafios', headers: owner, payload: { tipo: 'clube', nome: 'Clube do lago', descricao: '', inicio: '2026-10-16T12:00:00.000Z', fim: null, criteriosRanking: ['maior_peixe'] } });
    assert.equal(response.statusCode, 201);
    const club = response.json();
    assert.equal(club.fim, null);
    assert.equal(club.status, 'ativo');
    const species = (await server.inject({ method: 'POST', url: '/api/especies', headers: owner, payload: { nome: 'Tucunaré', pesoMaxReferenciaKg: 20 } })).json();
    setNow('2028-10-16T12:00:00.000Z');
    const list = await server.inject({ method: 'GET', url: '/api/desafios', headers: owner });
    assert.equal(list.json()[0].status, 'ativo');
    const capture = await server.inject({ method: 'POST', url: '/api/desafios/' + club.id + '/registros', headers: owner, payload: { especieId: species.id, pesoKg: 3, local: 'Lago', dataHora: '2028-10-16T11:00:00.000Z', fotoBase64: 'YWJj', fotoMimeType: 'image/jpeg' } });
    assert.equal(capture.statusCode, 201);
    const join = await server.inject({ method: 'POST', url: '/api/desafios/entrar', headers: { authorization: 'Bearer guest-token' }, payload: { codigoConvite: club.codigoConvite } });
    assert.equal(join.statusCode, 201);
  } finally { await server.close(); }
});

test('largest-fish ranking uses one capture per fisher, breaks ties by capture time, and excludes contested fish', async () => {
  const { server, setNow, pescariaRepository } = await createTestServer({ tokenValido: true });
  const owner = { authorization: 'Bearer owner-token' };
  const guest = { authorization: 'Bearer guest-token' };
  try {
    const club = (await server.inject({ method: 'POST', url: '/api/desafios', headers: owner, payload: { tipo: 'clube', nome: 'Ranking', inicio: '2026-10-16T12:00:00.000Z', fim: null, criteriosRanking: ['maior_peixe'] } })).json();
    await server.inject({ method: 'POST', url: '/api/desafios/entrar', headers: guest, payload: { codigoConvite: club.codigoConvite } });
    const species = (await server.inject({ method: 'POST', url: '/api/especies', headers: owner, payload: { nome: 'Dourado', pesoMaxReferenciaKg: 20 } })).json();
    setNow('2026-10-17T12:00:00.000Z');
    async function capture(headers: typeof owner, weight: number, time: string) {
      const result = await server.inject({ method: 'POST', url: '/api/desafios/' + club.id + '/registros', headers, payload: { especieId: species.id, pesoKg: weight, local: 'Rio', dataHora: time, fotoBase64: 'YWJj', fotoMimeType: 'image/jpeg' } });
      assert.equal(result.statusCode, 201);
      return result.json();
    }
    await capture(owner, 5, '2026-10-17T08:00:00.000Z');
    await capture(owner, 5, '2026-10-17T09:00:00.000Z');
    const largest = await capture(guest, 7, '2026-10-17T10:00:00.000Z');
    let detail = (await server.inject({ method: 'GET', url: '/api/desafios/' + club.id, headers: owner })).json();
    assert.equal(detail.rankingMaiorPeixe[0].pescadorId, 'guest-uid');
    assert.equal(detail.rankingMaiorPeixe[0].maiorPeixeKg, 7);
    await capture(owner, 7, '2026-10-17T11:00:00.000Z');
    detail = (await server.inject({ method: 'GET', url: '/api/desafios/' + club.id, headers: owner })).json();
    assert.equal(detail.rankingMaiorPeixe[0].pescadorId, 'guest-uid');
    const record = pescariaRepository.registros.get(largest.id)!;
    pescariaRepository.registros.set(largest.id, { ...record, status: 'contestado' });
    detail = (await server.inject({ method: 'GET', url: '/api/desafios/' + club.id, headers: owner })).json();
    assert.equal(detail.rankingMaiorPeixe[0].pescadorId, 'owner-uid');
    assert.equal(detail.melhorPeixe.pescadorId, 'owner-uid');
    assert.deepEqual(detail.rankingPesoTotal, []);
  } finally { await server.close(); }
});

test('cover uploads are cleaned up if group persistence fails', async () => {
  class FailingRepository extends MemoryPescariaRepository {
    override async criarDesafio(): Promise<void> { throw new Error('database unavailable'); }
  }
  const deleted: string[] = [];
  const service = new GerenciarPescariasService(
    new FailingRepository(),
    {
      async salvar(path: string) { return { url: 'http://localhost/uploads/' + path, path }; },
      async excluir(path: string) { deleted.push(path); },
      async obter() { return null; },
    },
    () => 'group-id',
    () => 'CODE',
    () => new Date('2026-10-16T12:00:00.000Z')
  );
  await assert.rejects(() => service.criarDesafio('owner', {
    tipo: 'clube', nome: 'Clube', inicio: '2026-10-16T12:00:00.000Z', fim: null,
    criteriosRanking: ['maior_peixe'], capaBase64: 'YWJj', capaMimeType: 'image/jpeg',
  }), /database unavailable/);
  assert.deepEqual(deleted, ['grupos/group-id/capa']);
});

async function createChatClub(server: Awaited<ReturnType<typeof createTestServer>>['server'], name = 'Clube do chat') {
  const response = await server.inject({ method: 'POST', url: '/api/desafios', headers: { authorization: 'Bearer owner-token' }, payload: { nome: name, tipo: 'clube', inicio: '2026-10-16T12:00:00.000Z', fim: null, criteriosRanking: ['maior_peixe'] } });
  assert.equal(response.statusCode, 201);
  return response.json<{ id: string; codigoConvite: string }>();
}

test('group chat restricts access to members and derives authors from authentication', async () => {
  const { server } = await createTestServer({ tokenValido: true });
  const owner = { authorization: 'Bearer owner-token' };
  const guest = { authorization: 'Bearer guest-token' };
  try {
    const group = await createChatClub(server);
    const url = '/api/desafios/' + group.id + '/mensagens';
    assert.equal((await server.inject({ method: 'GET', url })).statusCode, 401);
    assert.equal((await server.inject({ method: 'GET', url, headers: guest })).statusCode, 403);
    assert.equal((await server.inject({ method: 'POST', url, headers: guest, payload: { texto: 'Não participo' } })).statusCode, 403);
    assert.equal((await server.inject({ method: 'POST', url, headers: owner, payload: { texto: 'Oi', pescadorId: 'guest-uid' } })).statusCode, 400);
    const send = await server.inject({ method: 'POST', url, headers: owner, payload: { texto: '  Olá, pescadores!  ' } });
    assert.equal(send.statusCode, 201);
    assert.equal(send.json().texto, 'Olá, pescadores!');
    assert.equal(send.json().pescadorId, 'owner-uid');
    assert.equal(send.json().nomePescador, 'owner@pesk.com');
    const history = await server.inject({ method: 'GET', url, headers: owner });
    assert.equal(history.json().mensagens.length, 1);
    assert.equal(history.json().mensagens[0].id, send.json().id);
    assert.equal(history.json().proximoCursor, null);
  } finally { await server.close(); }
});

test('group chat validates text, photos, and closed groups', async () => {
  const { server } = await createTestServer({ tokenValido: true });
  const headers = { authorization: 'Bearer owner-token' };
  try {
    const group = await createChatClub(server);
    const url = '/api/desafios/' + group.id + '/mensagens';
    for (const payload of [{}, { texto: ' ' }, { texto: 'x'.repeat(2001) }, { fotoBase64: 'YWJj' }, { fotoMimeType: 'image/jpeg' }, { fotoBase64: 'bad bytes!', fotoMimeType: 'image/jpeg' }]) {
      assert.equal((await server.inject({ method: 'POST', url, headers, payload })).statusCode, 400);
    }
    const photo = await server.inject({ method: 'POST', url, headers, payload: { texto: 'Meu peixe', fotoBase64: 'YWJj', fotoMimeType: 'image/jpeg' } });
    assert.equal(photo.statusCode, 201);
    assert.match(photo.json().fotoUrl, /\/chat\//);
    assert.equal('fotoBase64' in photo.json(), false);
    await server.inject({ method: 'POST', url: '/api/desafios/' + group.id + '/cancelar', headers });
    assert.equal((await server.inject({ method: 'POST', url, headers, payload: { texto: 'Grupo encerrado' } })).statusCode, 409);
  } finally { await server.close(); }
});

test('chat history paginates without duplicates and stays isolated between groups', async () => {
  const { server, setNow } = await createTestServer({ tokenValido: true });
  const headers = { authorization: 'Bearer owner-token' };
  try {
    const a = await createChatClub(server, 'Grupo A');
    const b = await createChatClub(server, 'Grupo B');
    const url = '/api/desafios/' + a.id + '/mensagens';
    for (let i = 0; i < 55; i++) {
      setNow(new Date(Date.UTC(2026, 9, 16, 13, 0, i)).toISOString());
      const response = await server.inject({ method: 'POST', url, headers, payload: { texto: 'Mensagem ' + i } });
      assert.equal(response.statusCode, 201);
    }
    const privateMessage = (await server.inject({ method: 'POST', url: '/api/desafios/' + b.id + '/mensagens', headers, payload: { texto: 'Somente grupo B' } })).json();
    const first = (await server.inject({ method: 'GET', url, headers })).json();
    assert.equal(first.mensagens.length, 50);
    assert.equal(first.mensagens[0].texto, 'Mensagem 5');
    assert.equal(first.mensagens[49].texto, 'Mensagem 54');
    const second = (await server.inject({ method: 'GET', url: url + '?antes=' + first.proximoCursor, headers })).json();
    assert.equal(second.mensagens.length, 5);
    assert.equal(second.proximoCursor, null);
    assert.equal(new Set([...first.mensagens, ...second.mensagens].map(item => item.id)).size, 55);
    assert.equal((await server.inject({ method: 'GET', url: url + '?antes=' + privateMessage.id, headers })).statusCode, 400);
  } finally { await server.close(); }
});

test('leaving a club removes it from the member directory and revokes chat access', async () => {
  const { server } = await createTestServer({ tokenValido: true });
  const owner = { authorization: 'Bearer owner-token' };
  const guest = { authorization: 'Bearer guest-token' };
  try {
    const group = await createChatClub(server);
    await server.inject({ method: 'POST', url: '/api/desafios/entrar', headers: guest, payload: { codigoConvite: group.codigoConvite } });
    assert.equal((await server.inject({ method: 'GET', url: '/api/desafios', headers: guest })).json().length, 1);
    assert.equal((await server.inject({ method: 'DELETE', url: '/api/desafios/' + group.id + '/participantes/me', headers: owner })).statusCode, 409);
    assert.equal((await server.inject({ method: 'DELETE', url: '/api/desafios/' + group.id + '/participantes/me', headers: guest })).statusCode, 204);
    assert.equal((await server.inject({ method: 'GET', url: '/api/desafios', headers: guest })).json().length, 0);
    assert.equal((await server.inject({ method: 'GET', url: '/api/desafios/' + group.id + '/mensagens', headers: guest })).statusCode, 403);
    assert.equal((await server.inject({ method: 'POST', url: '/api/desafios/' + group.id + '/mensagens', headers: guest, payload: { texto: 'Saí' } })).statusCode, 403);
  } finally { await server.close(); }
});

test('chat photo uploads are removed if message persistence fails', async () => {
  class FailingMessages extends MemoryPescariaRepository {
    override async criarMensagem(): Promise<void> { throw new Error('message persistence failed'); }
  }
  const deleted: string[] = [];
  const repository = new FailingMessages();
  let count = 0;
  const service = new GerenciarPescariasService(repository, {
    async salvar(path: string) { return { url: 'http://localhost/' + path, path }; },
    async excluir(path: string) { deleted.push(path); }, async obter() { return null; },
  }, () => 'msg-' + ++count, () => 'CODE', () => new Date('2026-10-16T12:00:00.000Z'));
  const group = await service.criarDesafio('owner', { tipo: 'clube', nome: 'Clube', inicio: '2026-10-16T12:00:00.000Z', fim: null });
  await assert.rejects(() => service.enviarMensagem(group.id, 'owner', 'Pescador', { texto: '', fotoBase64: 'YWJj', fotoMimeType: 'image/jpeg' }), /message persistence failed/);
  assert.equal(deleted.length, 1);
  assert.match(deleted[0], /\/chat\//);
});
