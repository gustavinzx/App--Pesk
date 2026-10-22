import type { Usuario } from '../domain/Usuario';
import {
  AtualizacaoPerfilUsuario,
  NovoPerfilUsuario,
  PerfilDuplicadoRepositoryError,
  type PerfilUsuarioRepository,
} from './ports/PerfilUsuarioRepository';

export class PerfilNaoEncontradoError extends Error {
  constructor() {
    super('Perfil de usuário não encontrado.');
    this.name = 'PerfilNaoEncontradoError';
  }
}

export class PerfilJaExisteError extends Error {
  constructor() {
    super('O perfil deste usuário já existe.');
    this.name = 'PerfilJaExisteError';
  }
}

export class NomePerfilInvalidoError extends Error {
  constructor() {
    super('Informe um nome entre 1 e 100 caracteres.');
    this.name = 'NomePerfilInvalidoError';
  }
}

export class GerenciarPerfilUsuarioService {
  constructor(
    private readonly repository: PerfilUsuarioRepository,
    private readonly now: () => Date = () => new Date()
  ) {}

  async criar(input: {
    id: string;
    email: string;
    nome: string;
  }): Promise<Usuario> {
    const nome = this.validarNome(input.nome);
    const perfil: Usuario = {
      id: input.id,
      nome,
      email: input.email,
      criadoEm: this.now().toISOString(),
    };
    try {
      const novoPerfil: NovoPerfilUsuario = { ...perfil };
      await this.repository.criar(novoPerfil);
    } catch (error) {
      if (error instanceof PerfilDuplicadoRepositoryError) {
        throw new PerfilJaExisteError();
      }
      throw error;
    }
    return perfil;
  }

  async buscar(id: string): Promise<Usuario> {
    const perfil = await this.repository.buscarPorId(id);
    if (!perfil) {
      throw new PerfilNaoEncontradoError();
    }
    return perfil;
  }

  async atualizar(id: string, nome: string, extras: { descricao?: string; fotoUrl?: string } = {}): Promise<Usuario> {
    const dados: AtualizacaoPerfilUsuario = {
      ...extras,
      nome: this.validarNome(nome),
      atualizadoEm: this.now().toISOString(),
    };
    const perfil = await this.repository.atualizar(id, dados);
    if (!perfil) {
      throw new PerfilNaoEncontradoError();
    }
    return perfil;
  }

  async excluir(id: string): Promise<void> {
    const excluido = await this.repository.excluir(id);
    if (!excluido) {
      throw new PerfilNaoEncontradoError();
    }
  }

  private validarNome(nome: string): string {
    const normalizado = nome.trim();
    if (!normalizado || normalizado.length > 100) {
      throw new NomePerfilInvalidoError();
    }
    return normalizado;
  }
}
