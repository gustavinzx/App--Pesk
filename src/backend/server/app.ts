import cors from '@fastify/cors';
import Fastify, {
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
} from 'fastify';
import {
  GerenciarPerfilUsuarioService,
  NomePerfilInvalidoError,
  PerfilJaExisteError,
  PerfilNaoEncontradoError,
} from '../../core/business/GerenciarPerfilUsuarioService.js';
import {
  ErroPescaria,
  GerenciarPescariasService,
} from '../../core/business/GerenciarPescariasService.js';
import type { FotoStoragePort } from '../../core/business/ports/PescariaRepository.js';
import type {
  UsuarioAutenticado,
  VerificadorToken,
} from '../../core/business/ports/VerificadorToken.js';
import type { CriterioRanking } from '../../core/domain/Pescaria.js';

declare module 'fastify' {
  interface FastifyRequest {
    usuarioAutenticado: UsuarioAutenticado | null;
  }
}

export interface ApiDependencies {
  verificadorToken: VerificadorToken;
  gerenciarPerfil: GerenciarPerfilUsuarioService;
  gerenciarPescarias: GerenciarPescariasService;
  fotoStorage: FotoStoragePort;
}

interface CreateProfileBody {
  nome: string;
}

interface DesafioBody {
  nome: string;
  inicio: string;
  fim: string;
  criteriosRanking?: CriterioRanking[];
}

interface EntrarDesafioBody {
  codigoConvite: string;
}

interface EspecieBody {
  nome: string;
  pesoMaxReferenciaKg: number;
}

interface AtualizarEspecieBody extends EspecieBody {
  ativa: boolean;
}

interface RegistroBody {
  especieId: string;
  pesoKg: number;
  comprimentoCm?: number;
  local: string;
  dataHora: string;
  fotoBase64: string;
  fotoMimeType: string;
}

interface AtualizarRegistroBody extends Omit<
  RegistroBody,
  'fotoBase64' | 'fotoMimeType'
> {
  fotoBase64?: string;
  fotoMimeType?: string;
}

const schemaNome = {
  type: 'object',
  additionalProperties: false,
  required: ['nome'],
  properties: {
    nome: {
      type: 'string',
      minLength: 1,
      maxLength: 100,
      pattern: '.*\\S.*',
    },
  },
} as const;

const schemaDesafio = {
  type: 'object',
  additionalProperties: false,
  required: ['nome', 'inicio', 'fim'],
  properties: {
    nome: { type: 'string', minLength: 1, maxLength: 80, pattern: '.*\\S.*' },
    inicio: { type: 'string', minLength: 1 },
    fim: { type: 'string', minLength: 1 },
    criteriosRanking: {
      type: 'array',
      minItems: 1,
      uniqueItems: true,
      items: {
        type: 'string',
        enum: ['peso_total', 'maior_peixe', 'mais_peixes', 'menor_tempo'],
      },
    },
  },
} as const;

const schemaRegistro = {
  type: 'object',
  additionalProperties: false,
  required: [
    'especieId',
    'pesoKg',
    'local',
    'dataHora',
    'fotoBase64',
    'fotoMimeType',
  ],
  properties: {
    especieId: { type: 'string', minLength: 1 },
    pesoKg: { type: 'number', exclusiveMinimum: 0 },
    comprimentoCm: { type: 'number', exclusiveMinimum: 0 },
    local: { type: 'string', minLength: 1, maxLength: 120 },
    dataHora: { type: 'string', minLength: 1 },
    fotoBase64: { type: 'string', minLength: 1 },
    fotoMimeType: {
      type: 'string',
      enum: ['image/jpeg', 'image/png', 'image/webp'],
    },
  },
} as const;

const schemaAtualizarRegistro = {
  ...schemaRegistro,
  required: ['especieId', 'pesoKg', 'local', 'dataHora'],
} as const;

const schemaEspecie = {
  type: 'object',
  additionalProperties: false,
  required: ['nome', 'pesoMaxReferenciaKg'],
  properties: {
    nome: { type: 'string', minLength: 1, maxLength: 80, pattern: '.*\\S.*' },
    pesoMaxReferenciaKg: { type: 'number', exclusiveMinimum: 0 },
  },
} as const;

function registroPublico<T extends { fotoPath?: string }>(registro: T) {
  const { fotoPath: _fotoPath, ...publico } = registro;
  return publico;
}

function responderErro(
  error: unknown,
  reply: FastifyReply,
  request: FastifyRequest
) {
  const firestoreError = error as { code?: string | number; message?: string };
  if (
    firestoreError?.code === 9 ||
    firestoreError?.code === '9' ||
    firestoreError?.code === 'FAILED_PRECONDITION'
  ) {
    request.log.error({ err: error }, 'Firestore requires an index or precondition');
    return reply.code(503).send({
      error:
        'O Firestore recusou a consulta por falta de índice/configuração. Confira o log do backend para ver o detalhe.',
    });
  }
  if (error instanceof ErroPescaria) {
    return reply.code(error.statusCode).send({ error: error.message });
  }
  if (error instanceof PerfilNaoEncontradoError) {
    return reply.code(404).send({ error: error.message });
  }
  if (error instanceof PerfilJaExisteError) {
    return reply.code(409).send({ error: error.message });
  }
  if (error instanceof NomePerfilInvalidoError) {
    return reply.code(400).send({ error: error.message });
  }
  request.log.error({ err: error }, 'Application request failed');
  return reply.code(500).send({ error: 'Ocorreu um erro interno.' });
}

export async function buildServer(
  dependencies: ApiDependencies,
  options: { corsOrigins?: string[]; logger?: boolean } = {}
): Promise<FastifyInstance> {
  const server = Fastify({
    logger: options.logger ?? true,
    bodyLimit: 7 * 1024 * 1024,
    ajv: { customOptions: { removeAdditional: false } },
  });

  await server.register(cors, {
    origin: options.corsOrigins?.length ? options.corsOrigins : false,
  });
  server.decorateRequest('usuarioAutenticado', null);

  const autenticar = async (request: FastifyRequest, reply: FastifyReply) => {
    const tokenMatch = request.headers.authorization?.match(/^Bearer\s+(.+)$/i);
    if (!tokenMatch) {
      return reply
        .code(401)
        .send({ error: 'Token de autenticação obrigatório.' });
    }
    try {
      request.usuarioAutenticado =
        await dependencies.verificadorToken.verificar(tokenMatch[1]);
    } catch {
      return reply.code(401).send({ error: 'Token de autenticação inválido.' });
    }
  };

  server.get('/health', async () => ({ status: 'ok' }));

  server.get<{ Params: { '*': string } }>(
    '/uploads/*',
    async (request, reply) => {
      try {
        const foto = await dependencies.fotoStorage.obter(request.params['*']);
        if (!foto)
          return reply.code(404).send({ error: 'Foto não encontrada.' });
        return reply
          .header('Cache-Control', 'public, max-age=3600')
          .type(foto.contentType)
          .send(Buffer.from(foto.bytes));
      } catch (error) {
        return responderErro(error, reply, request);
      }
    }
  );

  server.post<{ Body: CreateProfileBody }>(
    '/api/usuarios/me',
    { schema: { body: schemaNome }, preHandler: autenticar },
    async (request, reply) => {
      const user = request.usuarioAutenticado!;
      try {
        const perfil = await dependencies.gerenciarPerfil.criar({
          id: user.uid,
          email: user.email,
          nome: request.body.nome,
        });
        return reply.code(201).send(perfil);
      } catch (error) {
        return responderErro(error, reply, request);
      }
    }
  );

  server.get(
    '/api/usuarios/me',
    { preHandler: autenticar },
    async (request, reply) => {
      const user = request.usuarioAutenticado!;
      try {
        return await dependencies.gerenciarPerfil.buscar(user.uid);
      } catch (error) {
        return responderErro(error, reply, request);
      }
    }
  );

  server.patch<{ Body: CreateProfileBody }>(
    '/api/usuarios/me',
    { schema: { body: schemaNome }, preHandler: autenticar },
    async (request, reply) => {
      const user = request.usuarioAutenticado!;
      try {
        return await dependencies.gerenciarPerfil.atualizar(
          user.uid,
          request.body.nome
        );
      } catch (error) {
        return responderErro(error, reply, request);
      }
    }
  );

  server.delete(
    '/api/usuarios/me',
    { preHandler: autenticar },
    async (request, reply) => {
      const user = request.usuarioAutenticado!;
      try {
        await dependencies.gerenciarPerfil.excluir(user.uid);
        return reply.code(204).send();
      } catch (error) {
        return responderErro(error, reply, request);
      }
    }
  );

  server.post<{ Body: DesafioBody }>(
    '/api/desafios',
    { schema: { body: schemaDesafio }, preHandler: autenticar },
    async (request, reply) => {
      try {
        const desafio = await dependencies.gerenciarPescarias.criarDesafio(
          request.usuarioAutenticado!.uid,
          request.body,
          request.usuarioAutenticado!.nome ?? request.usuarioAutenticado!.email
        );
        return reply.code(201).send(desafio);
      } catch (error) {
        return responderErro(error, reply, request);
      }
    }
  );

  server.get(
    '/api/desafios',
    { preHandler: autenticar },
    async (request, reply) => {
      try {
        return await dependencies.gerenciarPescarias.listarMeusDesafios(
          request.usuarioAutenticado!.uid
        );
      } catch (error) {
        return responderErro(error, reply, request);
      }
    }
  );

  server.post<{ Body: EntrarDesafioBody }>(
    '/api/desafios/entrar',
    {
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['codigoConvite'],
          properties: {
            codigoConvite: { type: 'string', minLength: 1, maxLength: 12 },
          },
        },
      },
      preHandler: autenticar,
    },
    async (request, reply) => {
      try {
        const participacao =
          await dependencies.gerenciarPescarias.entrarPorCodigo(
            request.body.codigoConvite,
            request.usuarioAutenticado!.uid,
            request.usuarioAutenticado!.nome ??
              request.usuarioAutenticado!.email
          );
        return reply.code(201).send(participacao);
      } catch (error) {
        return responderErro(error, reply, request);
      }
    }
  );

  server.get<{ Params: { desafioId: string } }>(
    '/api/desafios/:desafioId',
    { preHandler: autenticar },
    async (request, reply) => {
      try {
        return await dependencies.gerenciarPescarias.obterDetalhe(
          request.params.desafioId,
          request.usuarioAutenticado!.uid
        );
      } catch (error) {
        return responderErro(error, reply, request);
      }
    }
  );

  server.patch<{ Params: { desafioId: string }; Body: DesafioBody }>(
    '/api/desafios/:desafioId',
    { schema: { body: schemaDesafio }, preHandler: autenticar },
    async (request, reply) => {
      try {
        return await dependencies.gerenciarPescarias.atualizarDesafio(
          request.params.desafioId,
          request.usuarioAutenticado!.uid,
          request.body
        );
      } catch (error) {
        return responderErro(error, reply, request);
      }
    }
  );

  server.post<{ Params: { desafioId: string } }>(
    '/api/desafios/:desafioId/cancelar',
    { preHandler: autenticar },
    async (request, reply) => {
      try {
        await dependencies.gerenciarPescarias.cancelarDesafio(
          request.params.desafioId,
          request.usuarioAutenticado!.uid
        );
        return reply.code(204).send();
      } catch (error) {
        return responderErro(error, reply, request);
      }
    }
  );

  server.get<{ Params: { desafioId: string } }>(
    '/api/desafios/:desafioId/participantes',
    { preHandler: autenticar },
    async (request, reply) => {
      try {
        return await dependencies.gerenciarPescarias.listarParticipantes(
          request.params.desafioId,
          request.usuarioAutenticado!.uid
        );
      } catch (error) {
        return responderErro(error, reply, request);
      }
    }
  );

  server.delete<{ Params: { desafioId: string } }>(
    '/api/desafios/:desafioId/participantes/me',
    { preHandler: autenticar },
    async (request, reply) => {
      try {
        await dependencies.gerenciarPescarias.sairDoDesafio(
          request.params.desafioId,
          request.usuarioAutenticado!.uid
        );
        return reply.code(204).send();
      } catch (error) {
        return responderErro(error, reply, request);
      }
    }
  );

  server.get(
    '/api/especies',
    { preHandler: autenticar },
    async (request, reply) => {
      try {
        return await dependencies.gerenciarPescarias.listarEspecies();
      } catch (error) {
        return responderErro(error, reply, request);
      }
    }
  );

  server.post<{ Body: EspecieBody }>(
    '/api/especies',
    { schema: { body: schemaEspecie }, preHandler: autenticar },
    async (request, reply) => {
      try {
        const especie = await dependencies.gerenciarPescarias.criarEspecie(
          request.body
        );
        return reply.code(201).send(especie);
      } catch (error) {
        return responderErro(error, reply, request);
      }
    }
  );

  server.patch<{ Params: { especieId: string }; Body: AtualizarEspecieBody }>(
    '/api/especies/:especieId',
    {
      schema: {
        body: {
          ...schemaEspecie,
          required: ['nome', 'pesoMaxReferenciaKg', 'ativa'],
          properties: {
            ...schemaEspecie.properties,
            ativa: { type: 'boolean' },
          },
        },
      },
      preHandler: autenticar,
    },
    async (request, reply) => {
      try {
        return await dependencies.gerenciarPescarias.atualizarEspecie(
          request.params.especieId,
          request.body
        );
      } catch (error) {
        return responderErro(error, reply, request);
      }
    }
  );

  server.post<{ Params: { desafioId: string }; Body: RegistroBody }>(
    '/api/desafios/:desafioId/registros',
    { schema: { body: schemaRegistro }, preHandler: autenticar },
    async (request, reply) => {
      try {
        const registro = await dependencies.gerenciarPescarias.criarRegistro(
          request.usuarioAutenticado!.uid,
          { ...request.body, desafioId: request.params.desafioId }
        );
        return reply.code(201).send(registroPublico(registro));
      } catch (error) {
        return responderErro(error, reply, request);
      }
    }
  );

  server.get<{
    Params: { desafioId: string };
    Querystring: { participanteId?: string };
  }>(
    '/api/desafios/:desafioId/registros',
    { preHandler: autenticar },
    async (request, reply) => {
      try {
        const registros = await dependencies.gerenciarPescarias.listarRegistros(
          request.params.desafioId,
          request.usuarioAutenticado!.uid,
          request.query.participanteId
        );
        return registros.map(registroPublico);
      } catch (error) {
        return responderErro(error, reply, request);
      }
    }
  );

  server.patch<{ Params: { registroId: string }; Body: AtualizarRegistroBody }>(
    '/api/registros/:registroId',
    { schema: { body: schemaAtualizarRegistro }, preHandler: autenticar },
    async (request, reply) => {
      try {
        const registro =
          await dependencies.gerenciarPescarias.atualizarRegistro(
            request.params.registroId,
            request.usuarioAutenticado!.uid,
            request.body
          );
        return registroPublico(registro);
      } catch (error) {
        return responderErro(error, reply, request);
      }
    }
  );

  server.delete<{ Params: { registroId: string } }>(
    '/api/registros/:registroId',
    { preHandler: autenticar },
    async (request, reply) => {
      try {
        await dependencies.gerenciarPescarias.excluirRegistro(
          request.params.registroId,
          request.usuarioAutenticado!.uid
        );
        return reply.code(204).send();
      } catch (error) {
        return responderErro(error, reply, request);
      }
    }
  );

  return server;
}
