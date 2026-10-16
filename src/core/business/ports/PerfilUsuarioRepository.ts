import { Usuario } from '../../domain/Usuario';

export interface NovoPerfilUsuario {
  id: string;
  nome: string;
  email: string;
  criadoEm: string;
}

export interface AtualizacaoPerfilUsuario {
  nome: string;
  atualizadoEm: string;
}

export interface PerfilUsuarioRepository {
  criar(perfil: NovoPerfilUsuario): Promise<void>;
  buscarPorId(id: string): Promise<Usuario | null>;
  atualizar(
    id: string,
    dados: AtualizacaoPerfilUsuario
  ): Promise<Usuario | null>;
  excluir(id: string): Promise<boolean>;
}

export class PerfilDuplicadoRepositoryError extends Error {
  constructor() {
    super('Perfil de usuário já cadastrado.');
    this.name = 'PerfilDuplicadoRepositoryError';
  }
}
