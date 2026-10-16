import { CadastrarUsuarioService } from '../../core/business/CadastrarUsuarioService';
import { UsuarioRepositoryFirebase } from '../../backend/data/UsuarioRepositoryFirebase';

/**
 * Composition Root / Factory para instanciar o serviço de cadastro
 * conectando as abstrações do Core (Negócio) à implementação do Backend (Firebase).
 */
export function makeCadastrarUsuarioService(): CadastrarUsuarioService {
  const repository = new UsuarioRepositoryFirebase();
  return new CadastrarUsuarioService(repository);
}
