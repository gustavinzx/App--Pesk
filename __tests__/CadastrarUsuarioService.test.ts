import {
  CadastrarUsuarioService,
  ErroValidacao,
} from '../src/core/business/CadastrarUsuarioService';
import { UsuarioRepository } from '../src/core/business/ports/UsuarioRepository';

describe('CadastrarUsuarioService', () => {
  let repository: jest.Mocked<UsuarioRepository>;
  let service: CadastrarUsuarioService;

  beforeEach(() => {
    repository = {
      cadastrar: jest.fn().mockResolvedValue({ id: 'usuario-123' }),
    };
    service = new CadastrarUsuarioService(repository);
  });

  it('normaliza nome e e-mail antes de cadastrar e envia dados corretos ao repositório', async () => {
    const resultado = await service.executar({
      nome: '  Ana Silva  ',
      email: ' ANA@PESK.COM ',
      senha: 'senhaSegura123',
      confirmacaoSenha: 'senhaSegura123',
    });

    expect(resultado).toEqual({ id: 'usuario-123' });
    expect(repository.cadastrar).toHaveBeenCalledTimes(1);
    expect(repository.cadastrar).toHaveBeenCalledWith({
      nome: 'Ana Silva',
      email: 'ana@pesk.com',
      senha: 'senhaSegura123',
    });
  });

  it('rejeita nome vazio sem chamar o repositório', async () => {
    await expect(
      service.executar({
        nome: '   ',
        email: 'ana@pesk.com',
        senha: 'senhaSegura123',
        confirmacaoSenha: 'senhaSegura123',
      }),
    ).rejects.toThrow('Informe seu nome completo.');

    expect(repository.cadastrar).not.toHaveBeenCalled();
  });

  it('rejeita e-mail ausente ou vazio', async () => {
    await expect(
      service.executar({
        nome: 'Ana Silva',
        email: '   ',
        senha: 'senhaSegura123',
        confirmacaoSenha: 'senhaSegura123',
      }),
    ).rejects.toThrow('Informe seu e-mail.');

    expect(repository.cadastrar).not.toHaveBeenCalled();
  });

  it('rejeita e-mail em formato inválido', async () => {
    await expect(
      service.executar({
        nome: 'Ana Silva',
        email: 'email-invalido-sem-arroba',
        senha: 'senhaSegura123',
        confirmacaoSenha: 'senhaSegura123',
      }),
    ).rejects.toThrow('Informe um e-mail válido.');

    expect(repository.cadastrar).not.toHaveBeenCalled();
  });

  it('rejeita senha vazia', async () => {
    await expect(
      service.executar({
        nome: 'Ana Silva',
        email: 'ana@pesk.com',
        senha: '',
        confirmacaoSenha: '',
      }),
    ).rejects.toThrow('Informe uma senha.');

    expect(repository.cadastrar).not.toHaveBeenCalled();
  });

  it('rejeita senha menor que 6 caracteres', async () => {
    await expect(
      service.executar({
        nome: 'Ana Silva',
        email: 'ana@pesk.com',
        senha: '12345',
        confirmacaoSenha: '12345',
      }),
    ).rejects.toThrow('A senha deve ter pelo menos 6 caracteres.');

    expect(repository.cadastrar).not.toHaveBeenCalled();
  });

  it('rejeita confirmação de senha vazia', async () => {
    await expect(
      service.executar({
        nome: 'Ana Silva',
        email: 'ana@pesk.com',
        senha: 'senhaSegura123',
        confirmacaoSenha: '',
      }),
    ).rejects.toThrow('Confirme sua senha.');

    expect(repository.cadastrar).not.toHaveBeenCalled();
  });

  it('rejeita quando confirmação de senha é diferente da senha', async () => {
    await expect(
      service.executar({
        nome: 'Ana Silva',
        email: 'ana@pesk.com',
        senha: 'senhaSegura123',
        confirmacaoSenha: 'senhaDiferente456',
      }),
    ).rejects.toThrow('As senhas não coincidem.');

    expect(repository.cadastrar).not.toHaveBeenCalled();
  });

  it('lança instância de ErroValidacao para erros de regras de negócio', async () => {
    await expect(
      service.executar({
        nome: '',
        email: 'ana@pesk.com',
        senha: 'senhaSegura123',
        confirmacaoSenha: 'senhaSegura123',
      }),
    ).rejects.toBeInstanceOf(ErroValidacao);
  });

  it('propaga erro do repositório caso o cadastro falhe na camada de dados', async () => {
    repository.cadastrar.mockRejectedValueOnce(
      new Error('Este e-mail já está cadastrado em outra conta.'),
    );

    await expect(
      service.executar({
        nome: 'Ana Silva',
        email: 'ana@pesk.com',
        senha: 'senhaSegura123',
        confirmacaoSenha: 'senhaSegura123',
      }),
    ).rejects.toThrow('Este e-mail já está cadastrado em outra conta.');
  });
});
