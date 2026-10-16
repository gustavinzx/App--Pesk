export interface NovoUsuario {
  nome: string;
  email: string;
  senha: string;
}

export interface UsuarioRepository {
  cadastrar(dados: NovoUsuario): Promise<{ id: string }>;
}
