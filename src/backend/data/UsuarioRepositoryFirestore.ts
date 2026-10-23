import type { Firestore } from 'firebase-admin/firestore';
import { Timestamp } from 'firebase-admin/firestore';
import {
  PerfilDuplicadoRepositoryError,
  type AtualizacaoPerfilUsuario,
  type NovoPerfilUsuario,
  type PerfilUsuarioRepository,
} from '../../core/business/ports/PerfilUsuarioRepository.js';
import type { Usuario } from '../../core/domain/Usuario.js';

export class UsuarioRepositoryFirestore implements PerfilUsuarioRepository {
  constructor(private readonly firestore: Firestore) {}

  async criar(perfil: NovoPerfilUsuario): Promise<void> {
    const ref = this.firestore.collection('usuarios').doc(perfil.id);
    await this.firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (snapshot.exists) {
        throw new PerfilDuplicadoRepositoryError();
      }
      transaction.create(ref, {
        nome: perfil.nome,
        email: perfil.email,
        criadoEm: Timestamp.fromDate(new Date(perfil.criadoEm)),
      });
    });
  }

  async buscarPorId(id: string): Promise<Usuario | null> {
    const snapshot = await this.firestore.collection('usuarios').doc(id).get();
    if (!snapshot.exists) {
      return null;
    }
    return this.mapearUsuario(snapshot.id, snapshot.data() ?? {});
  }

  async atualizar(
    id: string,
    dados: AtualizacaoPerfilUsuario
  ): Promise<Usuario | null> {
    const ref = this.firestore.collection('usuarios').doc(id);
    return this.firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) {
        return null;
      }
      transaction.update(ref, {
        ...dados,
        nome: dados.nome,
        atualizadoEm: Timestamp.fromDate(new Date(dados.atualizadoEm)),
      });
      return this.mapearUsuario(snapshot.id, {
        ...snapshot.data(),
        ...dados,
        nome: dados.nome,
        atualizadoEm: Timestamp.fromDate(new Date(dados.atualizadoEm)),
      });
    });
  }

  async excluir(id: string): Promise<boolean> {
    const ref = this.firestore.collection('usuarios').doc(id);
    return this.firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) {
        return false;
      }
      transaction.delete(ref);
      return true;
    });
  }

  private mapearUsuario(id: string, data: Record<string, unknown>): Usuario {
    return {
      id,
      nome: String(data.nome ?? ''),
      descricao: String(data.descricao ?? ''),
      fotoUrl: String(data.fotoUrl ?? ''),
      email: String(data.email ?? ''),
      criadoEm: this.toISOString(data.criadoEm),
      ...(data.atualizadoEm
        ? { atualizadoEm: this.toISOString(data.atualizadoEm) }
        : {}),
    };
  }

  private toISOString(value: unknown): string {
    if (value instanceof Timestamp) {
      return value.toDate().toISOString();
    }
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (typeof value === 'string') {
      return value;
    }
    if (value && typeof value === 'object' && 'toDate' in value) {
      const date = (value as { toDate: () => Date }).toDate();
      return date.toISOString();
    }
    throw new Error('O perfil contém um timestamp inválido no Firestore.');
  }
}
