import {
  NovoUsuario,
  UsuarioRepository,
} from './ports/UsuarioRepository';

export class ErroValidacao extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ErroValidacao';
  }
}

export interface DadosCadastroUsuario {
  nome: string;
  email: string;
  senha: string;
  confirmacaoSenha: string;
}

export class CadastrarUsuarioService {
  constructor(private readonly repository: UsuarioRepository) {}

  async executar(dados: DadosCadastroUsuario): Promise<{ id: string }> {
    const nome = dados.nome ? dados.nome.trim() : '';
    const email = dados.email ? dados.email.trim().toLowerCase() : '';
    const senha = dados.senha || '';
    const confirmacaoSenha = dados.confirmacaoSenha || '';

    if (!nome) {
      throw new ErroValidacao('Informe seu nome completo.');
    }

    if (!email) {
      throw new ErroValidacao('Informe seu e-mail.');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new ErroValidacao('Informe um e-mail válido.');
    }

    if (!senha) {
      throw new ErroValidacao('Informe uma senha.');
    }

    if (senha.length < 6) {
      throw new ErroValidacao('A senha deve ter pelo menos 6 caracteres.');
    }

    if (!confirmacaoSenha) {
      throw new ErroValidacao('Confirme sua senha.');
    }

    if (senha !== confirmacaoSenha) {
      throw new ErroValidacao('As senhas não coincidem.');
    }

    const novoUsuario: NovoUsuario = {
      nome,
      email,
      senha,
    };

    return this.repository.cadastrar(novoUsuario);
  }
}
