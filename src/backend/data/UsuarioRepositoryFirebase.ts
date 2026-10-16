import {
  createUserWithEmailAndPassword,
  deleteUser,
} from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from '../config/firebase';
import {
  NovoUsuario,
  UsuarioRepository,
} from '../../core/business/ports/UsuarioRepository';

export class UsuarioRepositoryFirebase implements UsuarioRepository {
  async cadastrar(dados: NovoUsuario): Promise<{ id: string }> {
    if (!isFirebaseConfigured) {
      throw new Error(
        'Configuração do Firebase ausente ou incompleta. Crie o arquivo .env a partir de .env.example e adicione as credenciais do seu projeto Firebase Console.'
      );
    }

    let credencial;
    try {
      // 1. Cria a conta no Firebase Authentication (a senha é gerenciada exclusivamente pelo Auth)
      credencial = await createUserWithEmailAndPassword(
        auth,
        dados.email,
        dados.senha,
      );
    } catch (authError: any) {
      throw new Error(this.mapearErroAuth(authError));
    }

    const uid = credencial.user.uid;

    try {
      // 2. Salva o perfil do usuário no Cloud Firestore em usuarios/{uid}
      // NUNCA salvamos a senha no Firestore.
      await setDoc(doc(db, 'usuarios', uid), {
        nome: dados.nome,
        email: dados.email,
        criadoEm: serverTimestamp(),
      });

      return { id: uid };
    } catch (firestoreError: any) {
      // 3. Mecanismo de compensação (rollback):
      // Se a gravação no Firestore falhar, tentamos excluir a conta recém-criada
      // no Firebase Authentication para não deixar uma conta órfã no sistema.
      try {
        await deleteUser(credencial.user);
      } catch (rollbackError) {
        console.error(
          '[Pesk Rollback] Falha ao excluir usuário órfão no Firebase Auth:',
          rollbackError
        );
      }

      const mensagemErro =
        firestoreError?.message?.includes('permission-denied') ||
        firestoreError?.code === 'permission-denied'
          ? 'Permissão negada no Firestore. Verifique as regras de segurança (firestore.rules) do seu projeto.'
          : 'Não foi possível gravar os dados do seu perfil no banco. O cadastro foi revertido por segurança. Tente novamente.';

      throw new Error(mensagemErro);
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
