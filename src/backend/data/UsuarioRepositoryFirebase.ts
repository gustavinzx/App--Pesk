import {
  createUserWithEmailAndPassword,
  deleteUser,
  updateProfile,
} from 'firebase/auth';
import {
  NovoUsuario,
  UsuarioRepository,
} from '../../core/business/ports/UsuarioRepository';
import { auth, isFirebaseConfigured } from '../config/firebase';

export class UsuarioRepositoryFirebase implements UsuarioRepository {
  async cadastrar(dados: NovoUsuario): Promise<{ id: string }> {
    if (!isFirebaseConfigured) {
      throw new Error(
        'Configuração do Firebase ausente ou incompleta. Crie o arquivo .env a partir de .env.example e adicione as credenciais do seu projeto Firebase Console.'
      );
    }

    const apiUrl = process.env.EXPO_PUBLIC_PESK_API_URL?.trim().replace(
      /\/+$/,
      ''
    );
    if (!apiUrl) {
      throw new Error(
        'URL da API ausente. Configure EXPO_PUBLIC_PESK_API_URL no arquivo .env.'
      );
    }

    let credencial;
    try {
      // 1. Cria a conta no Firebase Authentication (a senha é gerenciada exclusivamente pelo Auth)
      credencial = await createUserWithEmailAndPassword(
        auth,
        dados.email,
        dados.senha
      );
    } catch (authError: any) {
      throw new Error(this.mapearErroAuth(authError));
    }

    try {
      // O nome do token é usado para identificar o pescador em participações e rankings.
      await updateProfile(credencial.user, { displayName: dados.nome });
      // 2. Envia o perfil à API; a identidade vem do token, nunca do corpo da requisição.
      const idToken = await credencial.user.getIdToken(true);
      const response = await fetch(`${apiUrl}/api/usuarios/me`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ nome: dados.nome }),
      });

      const responseBody = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          typeof responseBody?.error === 'string'
            ? responseBody.error
            : 'A API não conseguiu salvar o perfil do usuário.'
        );
      }

      return { id: responseBody.id || credencial.user.uid };
    } catch (apiError: any) {
      // 3. Mecanismo de compensação (rollback):
      // Se a API falhar, tentamos excluir a conta recém-criada
      // no Firebase Authentication para não deixar uma conta órfã no sistema.
      try {
        await deleteUser(credencial.user);
      } catch (rollbackError) {
        console.error(
          '[Pesk Rollback] Falha ao excluir usuário órfão no Firebase Auth:',
          rollbackError
        );
      }

      if (apiError instanceof TypeError) {
        throw new Error(
          'Não foi possível conectar à API do Pesk. Verifique se o servidor está ativo e se EXPO_PUBLIC_PESK_API_URL está correto.'
        );
      }

      throw new Error(
        `${apiError?.message || 'Não foi possível salvar o perfil.'} O cadastro foi revertido por segurança.`
      );
    }
  }

  /**
   * Converte códigos de erro técnicos do Firebase Auth em mensagens claras e amigáveis em português.
   */
  private mapearErroAuth(erro: any): string {
    const code = erro?.code || '';

    switch (code) {
      case 'auth/email-already-in-use':
        return 'Este e-mail já está cadastrado em outra conta Pesk.';
      case 'auth/invalid-email':
        return 'O endereço de e-mail informado é inválido.';
      case 'auth/operation-not-allowed':
        return 'O provedor de e-mail/senha não está ativado no Firebase Console (Authentication > Sign-in method).';
      case 'auth/weak-password':
        return 'A senha fornecida é considerada muito fraca pelo Firebase. Utilize uma combinação mais complexa.';
      case 'auth/network-request-failed':
        return 'Falha de comunicação com a rede. Verifique sua conexão com a internet e tente novamente.';
      case 'auth/too-many-requests':
        return 'Muitas tentativas consecutivas foram bloqueadas. Aguarde alguns instantes e tente novamente.';
      default:
        return (
          erro?.message ||
          'Ocorreu um erro inesperado ao criar sua conta. Tente novamente.'
        );
    }
  }
}
