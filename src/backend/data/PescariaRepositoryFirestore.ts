import {
  FieldValue,
  Timestamp,
  type Firestore,
  type Query,
} from 'firebase-admin/firestore';
import {
  CodigoConviteDuplicadoError,
  LimiteDiarioRegistrosError,
  ParticipacaoDuplicadaError,
  type AlteracaoDesafio,
  type AlteracaoRegistroPesca,
  type NovoDesafio,
  type NovoRegistroPesca,
  type PescariaRepository,
} from '../../core/business/ports/PescariaRepository.js';
import type {
  Desafio,
  Especie,
  Participacao,
  RegistroPesca,
} from '../../core/domain/Pescaria.js';

export class PescariaRepositoryFirestore implements PescariaRepository {
  constructor(private readonly firestore: Firestore) {}

  async criarDesafio(
    desafio: NovoDesafio,
    participacaoDono: Participacao
  ): Promise<void> {
    const desafioRef = this.firestore.collection('desafios').doc(desafio.id);
    const codigoQuery = this.firestore
      .collection('desafios')
      .where('codigoConvite', '==', desafio.codigoConvite)
      .limit(1);
    await this.firestore.runTransaction(async (transaction) => {
      const [codigoSnapshot, existente] = await Promise.all([
        transaction.get(codigoQuery),
        transaction.get(desafioRef),
      ]);
      if (!codigoSnapshot.empty || existente.exists) {
        throw new CodigoConviteDuplicadoError();
      }
      transaction.create(desafioRef, this.serializarDesafio(desafio));
      transaction.create(
        desafioRef.collection('participacoes').doc(participacaoDono.pescadorId),
        participacaoDono
      );
    });
  }

  async listarDesafiosDoPescador(pescadorId: string): Promise<Desafio[]> {
    const [organizados, participacoes] = await Promise.all([
      this.firestore
        .collection('desafios')
        .where('donoId', '==', pescadorId)
        .get(),
      this.firestore
        .collectionGroup('participacoes')
        .where('pescadorId', '==', pescadorId)
        .get(),
    ]);
    const ids = new Set<string>();
    const result = new Map<string, Desafio>();
    for (const document of organizados.docs) {
      const desafio = this.mapearDesafio(document.id, document.data());
      ids.add(desafio.id);
      result.set(desafio.id, desafio);
    }
    for (const participation of participacoes.docs) {
      const desafioId = participation.ref.parent.parent?.id;
      if (!desafioId || ids.has(desafioId)) continue;
      const snapshot = await this.firestore
        .collection('desafios')
        .doc(desafioId)
        .get();
      if (snapshot.exists)
        result.set(
          desafioId,
          this.mapearDesafio(snapshot.id, snapshot.data() ?? {})
        );
    }
    return [...result.values()].sort((a, b) =>
      a.inicio.localeCompare(b.inicio)
    );
  }

  async buscarDesafio(id: string): Promise<Desafio | null> {
    const snapshot = await this.firestore.collection('desafios').doc(id).get();
    return snapshot.exists
      ? this.mapearDesafio(snapshot.id, snapshot.data() ?? {})
      : null;
  }

  async buscarDesafioPorCodigo(codigo: string): Promise<Desafio | null> {
    const snapshot = await this.firestore
      .collection('desafios')
      .where('codigoConvite', '==', codigo)
      .limit(1)
      .get();
    const doc = snapshot.docs[0];
    return doc ? this.mapearDesafio(doc.id, doc.data()) : null;
  }

  async atualizarDesafio(
    id: string,
    alteracoes: AlteracaoDesafio
  ): Promise<void> {
    const ref = this.firestore.collection('desafios').doc(id);
    await this.firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) throw new Error('Desafio não encontrado.');
      const data = snapshot.data() ?? {};
      if (
        data.status !== 'aberto' ||
        Date.now() >= this.dateValue(data.inicio)
      ) {
        throw new Error('Este desafio não pode mais ser editado.');
      }
      transaction.update(ref, {
        ...alteracoes,
        inicio: Timestamp.fromDate(new Date(alteracoes.inicio)),
        fim: Timestamp.fromDate(new Date(alteracoes.fim)),
        atualizadoEm: FieldValue.serverTimestamp(),
      });
    });
  }

  async atualizarStatusDesafio(
    id: string,
    status: Desafio['status']
  ): Promise<void> {
    await this.firestore.collection('desafios').doc(id).update({
      status,
      atualizadoEm: FieldValue.serverTimestamp(),
    });
  }

  async listarParticipacoes(desafioId: string): Promise<Participacao[]> {
    const snapshot = await this.firestore
      .collection('desafios')
      .doc(desafioId)
      .collection('participacoes')
      .get();
    return snapshot.docs.map(
      (doc) => ({ ...doc.data(), id: doc.id }) as Participacao
    );
  }

  async buscarParticipacao(
    desafioId: string,
    pescadorId: string
  ): Promise<Participacao | null> {
    const snapshot = await this.firestore
      .collection('desafios')
      .doc(desafioId)
      .collection('participacoes')
      .doc(pescadorId)
      .get();
    return snapshot.exists
      ? ({ ...snapshot.data(), id: snapshot.id } as Participacao)
      : null;
  }

  async entrarNoDesafio(participacao: Participacao): Promise<void> {
    const desafioRef = this.firestore
      .collection('desafios')
      .doc(participacao.desafioId);
    const participanteRef = desafioRef
      .collection('participacoes')
      .doc(participacao.pescadorId);
    await this.firestore.runTransaction(async (transaction) => {
      const [desafio, existente] = await Promise.all([
        transaction.get(desafioRef),
        transaction.get(participanteRef),
      ]);
      if (
        !desafio.exists ||
        desafio.data()?.status !== 'aberto' ||
        Date.now() >= this.dateValue(desafio.data()?.inicio)
      ) {
        throw new Error('Este desafio não está aberto para participantes.');
      }
      if (existente.exists) throw new ParticipacaoDuplicadaError();
      transaction.create(participanteRef, participacao);
    });
  }

  async sairDoDesafio(desafioId: string, pescadorId: string): Promise<boolean> {
    const challengeRef = this.firestore.collection('desafios').doc(desafioId);
    const participationRef = challengeRef
      .collection('participacoes')
      .doc(pescadorId);
    return this.firestore.runTransaction(async (transaction) => {
      const [challenge, participation] = await Promise.all([
        transaction.get(challengeRef),
        transaction.get(participationRef),
      ]);
      if (!challenge.exists || !participation.exists) return false;
      if (
        challenge.data()?.status !== 'aberto' ||
        Date.now() >= this.dateValue(challenge.data()?.inicio)
      ) {
        throw new Error('A saída só é permitida antes do desafio começar.');
      }
      transaction.delete(participationRef);
      return true;
    });
  }

  async criarEspecie(especie: Especie): Promise<void> {
    await this.firestore
      .collection('especies')
      .doc(especie.id)
      .create({
        ...especie,
        criadoEm: Timestamp.fromDate(new Date(especie.criadoEm)),
      });
  }

  async listarEspecies(): Promise<Especie[]> {
    const snapshot = await this.firestore
      .collection('especies')
      .orderBy('nome')
      .get();
    return snapshot.docs.map((doc) => this.mapearEspecie(doc.id, doc.data()));
  }

  async buscarEspecie(id: string): Promise<Especie | null> {
    const snapshot = await this.firestore.collection('especies').doc(id).get();
    return snapshot.exists
      ? this.mapearEspecie(snapshot.id, snapshot.data() ?? {})
      : null;
  }

  async atualizarEspecie(especie: Especie): Promise<void> {
    const ref = this.firestore.collection('especies').doc(especie.id);
    await ref.update({
      nome: especie.nome,
      pesoMaxReferenciaKg: especie.pesoMaxReferenciaKg,
      ativa: especie.ativa,
      atualizadoEm: Timestamp.fromDate(
        new Date(especie.atualizadoEm ?? new Date().toISOString())
      ),
    });
  }

  async criarRegistro(
    registro: NovoRegistroPesca,
    limiteDiario: number
  ): Promise<void> {
    const ref = this.firestore.collection('registros_pesca').doc(registro.id);
    const desafioRef = this.firestore
      .collection('desafios')
      .doc(registro.desafioId);
    const participacaoRef = desafioRef
      .collection('participacoes')
      .doc(registro.pescadorId);
    const especieRef = this.firestore
      .collection('especies')
      .doc(registro.especieId);
    const queryDia = this.queryRegistrosDia(
      registro.desafioId,
      registro.pescadorId,
      registro.dataHora
    );
    await this.firestore.runTransaction(async (transaction) => {
      const [challenge, participation, species, daily] = await Promise.all([
        transaction.get(desafioRef),
        transaction.get(participacaoRef),
        transaction.get(especieRef),
        transaction.get(queryDia),
      ]);
      if (!challenge.exists || !participation.exists || !species.exists) {
        throw new Error('Desafio, participação ou espécie não encontrado.');
      }
      const speciesData = species.data() ?? {};
      const challengeData = challenge.data() ?? {};
      if (!speciesData.ativa || challengeData.status !== 'ativo') {
        throw new Error('Desafio inativo ou espécie indisponível.');
      }
      if (daily.size >= limiteDiario) throw new LimiteDiarioRegistrosError();
      transaction.create(ref, this.serializarRegistro(registro));
    });
  }

  async listarRegistros(
    desafioId: string,
    pescadorId?: string
  ): Promise<RegistroPesca[]> {
    let query: Query = this.firestore
      .collection('registros_pesca')
      .where('desafioId', '==', desafioId);
    if (pescadorId) query = query.where('pescadorId', '==', pescadorId);
    const snapshot = await query.orderBy('dataHora', 'asc').get();
    return snapshot.docs.map((doc) => this.mapearRegistro(doc.id, doc.data()));
  }

  async buscarRegistro(id: string): Promise<RegistroPesca | null> {
    const snapshot = await this.firestore
      .collection('registros_pesca')
      .doc(id)
      .get();
    return snapshot.exists
      ? this.mapearRegistro(snapshot.id, snapshot.data() ?? {})
      : null;
  }

  async atualizarRegistro(
    id: string,
    alteracoes: AlteracaoRegistroPesca,
    limiteDiario: number
  ): Promise<void> {
    const ref = this.firestore.collection('registros_pesca').doc(id);
    await this.firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists)
        throw new Error('Registro de pesca não encontrado.');
      const current = snapshot.data() ?? {};
      const queryDia = this.queryRegistrosDia(
        String(current.desafioId),
        String(current.pescadorId),
        alteracoes.dataHora
      );
      const daily = await transaction.get(queryDia);
      if (daily.size >= limiteDiario) throw new LimiteDiarioRegistrosError();
      const updateData: Record<string, unknown> = {
        ...alteracoes,
        dataHora: Timestamp.fromDate(new Date(alteracoes.dataHora)),
        atualizadoEm: FieldValue.serverTimestamp(),
      };
      if (alteracoes.fotoPath) updateData.fotoPath = alteracoes.fotoPath;
      if (alteracoes.fotoUrl) updateData.fotoUrl = alteracoes.fotoUrl;
      transaction.update(ref, updateData);
    });
  }

  async excluirRegistro(id: string): Promise<void> {
    await this.firestore.collection('registros_pesca').doc(id).delete();
  }

  async contarRegistrosNoDia(
    desafioId: string,
    pescadorId: string,
    dataHora: string,
    ignorarRegistroId?: string
  ): Promise<number> {
    const snapshot = await this.queryRegistrosDia(
      desafioId,
      pescadorId,
      dataHora
    ).get();
    return snapshot.docs.filter((document) => document.id !== ignorarRegistroId)
      .length;
  }

  private queryRegistrosDia(
    desafioId: string,
    pescadorId: string,
    dataHora: string
  ): Query {
    const date = new Date(dataHora);
    const inicio = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
    );
    const fim = new Date(inicio.getTime() + 24 * 60 * 60 * 1000);
    let query: Query = this.firestore
      .collection('registros_pesca')
      .where('desafioId', '==', desafioId)
      .where('pescadorId', '==', pescadorId)
      .where('dataHora', '>=', Timestamp.fromDate(inicio))
      .where('dataHora', '<', Timestamp.fromDate(fim));
    return query;
  }

  private serializarDesafio(desafio: NovoDesafio) {
    return {
      ...desafio,
      inicio: Timestamp.fromDate(new Date(desafio.inicio)),
      fim: Timestamp.fromDate(new Date(desafio.fim)),
      criadoEm: Timestamp.fromDate(new Date(desafio.criadoEm)),
    };
  }

  private serializarRegistro(registro: NovoRegistroPesca) {
    return {
      ...registro,
      dataHora: Timestamp.fromDate(new Date(registro.dataHora)),
      criadoEm: Timestamp.fromDate(new Date(registro.criadoEm)),
    };
  }

  private mapearDesafio(id: string, data: Record<string, unknown>): Desafio {
    return {
      id,
      nome: String(data.nome ?? ''),
      codigoConvite: String(data.codigoConvite ?? ''),
      donoId: String(data.donoId ?? ''),
      inicio: this.iso(data.inicio),
      fim: this.iso(data.fim),
      status: data.status as Desafio['status'],
      criteriosRanking: (data.criteriosRanking ?? [
        'peso_total',
        'maior_peixe',
      ]) as Desafio['criteriosRanking'],
      criadoEm: this.iso(data.criadoEm),
    };
  }

  private mapearEspecie(id: string, data: Record<string, unknown>): Especie {
    return {
      id,
      nome: String(data.nome ?? ''),
      pesoMaxReferenciaKg: Number(data.pesoMaxReferenciaKg ?? 0),
      ativa: Boolean(data.ativa),
      criadoEm: this.iso(data.criadoEm),
      ...(data.atualizadoEm
        ? { atualizadoEm: this.iso(data.atualizadoEm) }
        : {}),
    };
  }

  private mapearRegistro(
    id: string,
    data: Record<string, unknown>
  ): RegistroPesca {
    return {
      id,
      desafioId: String(data.desafioId ?? ''),
      participacaoId: String(data.participacaoId ?? ''),
      pescadorId: String(data.pescadorId ?? ''),
      especieId: String(data.especieId ?? ''),
      nomeEspecie: String(data.nomeEspecie ?? ''),
      pesoKg: Number(data.pesoKg ?? 0),
      ...(data.comprimentoCm === undefined
        ? {}
        : { comprimentoCm: Number(data.comprimentoCm) }),
      local: String(data.local ?? ''),
      dataHora: this.iso(data.dataHora),
      fotoUrl: String(data.fotoUrl ?? ''),
      ...(data.fotoPath ? { fotoPath: String(data.fotoPath) } : {}),
      status: data.status as RegistroPesca['status'],
      criadoEm: this.iso(data.criadoEm),
    };
  }

  private iso(value: unknown): string {
    if (value instanceof Timestamp) return value.toDate().toISOString();
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'string') return value;
    if (value && typeof value === 'object' && 'toDate' in value) {
      return (value as { toDate: () => Date }).toDate().toISOString();
    }
    throw new Error('Documento do Firestore contém uma data inválida.');
  }

  private dateValue(value: unknown): number {
    if (value instanceof Timestamp) return value.toMillis();
    if (value instanceof Date) return value.getTime();
    if (typeof value === 'string') return new Date(value).getTime();
    return Number.NaN;
  }
}
