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
    () => 'INVITE1',
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
