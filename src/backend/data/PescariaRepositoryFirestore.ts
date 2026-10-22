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
    const conviteRef = desafioRef
      .collection('convites')
      .doc(desafio.codigoConvite);
    await this.firestore.runTransaction(async (transaction) => {
      const [conviteExistente, desafioExistente] = await Promise.all([
        transaction.get(conviteRef),
        transaction.get(desafioRef),
      ]);
      if (conviteExistente.exists || desafioExistente.exists) {
        throw new CodigoConviteDuplicadoError();
      }
      transaction.create(desafioRef, this.serializarDesafio(desafio));
      transaction.create(conviteRef, {
        codigo: desafio.codigoConvite,
        criadoEm: Timestamp.fromDate(new Date(desafio.criadoEm)),
      });
      transaction.create(
        desafioRef.collection('participacoes').doc(participacaoDono.pescadorId),
        {
          pescadorId: participacaoDono.pescadorId,
          nomePescador: participacaoDono.nomePescador,
          dataEntrada: Timestamp.fromDate(new Date(participacaoDono.entrouEm)),
        }
      );
    });
  }

  async listarDesafiosDoPescador(pescadorId: string): Promise<Desafio[]> {
    // Avoid a collection-group query: the existing database stores each
    // participation under desafios/{id}/participacoes/{pescadorId}.
    const snapshot = await this.firestore.collection('desafios').get();
    const result: Desafio[] = [];
    for (const document of snapshot.docs) {
      const data = document.data();
      const isOwner = String(data.donoId ?? '') === pescadorId;
      const participation = isOwner
        ? null
        : await document.ref
            .collection('participacoes')
            .doc(pescadorId)
            .get();
      if (
        isOwner ||
        (participation?.exists &&
          !this.participacaoEncerrada(participation.data() ?? {}))
      ) {
        result.push(await this.mapearDesafioComConvite(document.id, data));
      }
    }
    return result.sort((a, b) =>
      a.inicio.localeCompare(b.inicio)
    );
  }

  async buscarDesafio(id: string): Promise<Desafio | null> {
    const snapshot = await this.firestore.collection('desafios').doc(id).get();
    return snapshot.exists
      ? this.mapearDesafioComConvite(snapshot.id, snapshot.data() ?? {})
      : null;
  }

  async buscarDesafioPorCodigo(codigo: string): Promise<Desafio | null> {
    const snapshot = await this.firestore.collection('desafios').get();
    for (const document of snapshot.docs) {
      const invitations = await document.ref.collection('convites').get();
      const invitation = invitations.docs.find(
        (item) =>
          item.id.toLocaleUpperCase('pt-BR') === codigo.toLocaleUpperCase('pt-BR') ||
          String(item.get('codigo') ?? item.get('codigoConvite') ?? '')
            .toLocaleUpperCase('pt-BR') === codigo.toLocaleUpperCase('pt-BR')
      );
      if (invitation) {
        return this.mapearDesafioComConvite(
          document.id,
          document.data()
        );
      }

      // Backward compatibility with older challenge docs that held the code inline.
      if (String(document.get('codigoConvite') ?? '') === codigo) {
        return this.mapearDesafioComConvite(
          document.id,
          document.data()
        );
      }
    }
    return null;
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
        this.mapearStatus(data.status) !== 'aberto' ||
        Date.now() >= this.dateValue(data.inicioEm ?? data.inicio)
      ) {
        throw new Error('Este desafio não pode mais ser editado.');
      }
      transaction.update(ref, {
        nome: alteracoes.nome,
        inicioEm: Timestamp.fromDate(new Date(alteracoes.inicio)),
        fimEm: Timestamp.fromDate(new Date(alteracoes.fim)),
        criteriosRanking: this.serializarCriteriosRanking(
          alteracoes.criteriosRanking,
          data.criteriosRanking
        ),
        atualizadoEm: FieldValue.serverTimestamp(),
      });
    });
  }

  async atualizarStatusDesafio(
    id: string,
    status: Desafio['status']
  ): Promise<void> {
    await this.firestore.collection('desafios').doc(id).update({
      status: this.serializarStatus(status),
      atualizadoEm: FieldValue.serverTimestamp(),
    });
  }

  async listarParticipacoes(desafioId: string): Promise<Participacao[]> {
    const snapshot = await this.firestore
      .collection('desafios')
      .doc(desafioId)
      .collection('participacoes')
      .get();
    return snapshot.docs
      .filter((doc) => !this.participacaoEncerrada(doc.data()))
      .map((doc) => this.mapearParticipacao(desafioId, doc.id, doc.data()));
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
    return snapshot.exists && !this.participacaoEncerrada(snapshot.data() ?? {})
      ? this.mapearParticipacao(
          desafioId,
          snapshot.id,
          snapshot.data() ?? {}
        )
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
        this.mapearStatus(desafio.data()?.status) !== 'aberto' ||
        Date.now() >= this.dateValue(
          desafio.data()?.inicioEm ?? desafio.data()?.inicio
        )
      ) {
        throw new Error('Este desafio não está aberto para participantes.');
      }
      const novoDocumento = {
        pescadorId: participacao.pescadorId,
        nomePescador: participacao.nomePescador,
        dataEntrada: Timestamp.fromDate(new Date(participacao.entrouEm)),
        saiuEm: null,
      };
      if (existente.exists) {
        if (!this.participacaoEncerrada(existente.data() ?? {})) {
          throw new ParticipacaoDuplicadaError();
        }
        transaction.update(participanteRef, novoDocumento);
      } else {
        transaction.create(participanteRef, novoDocumento);
      }
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
        this.mapearStatus(challenge.data()?.status) !== 'aberto' ||
        Date.now() >= this.dateValue(
          challenge.data()?.inicioEm ?? challenge.data()?.inicio
        )
      ) {
        throw new Error('A saída só é permitida antes do desafio começar.');
      }
      transaction.update(participationRef, {
        saiuEm: FieldValue.serverTimestamp(),
      });
      return true;
    });
  }

  async criarEspecie(especie: Especie): Promise<void> {
    await this.firestore
      .collection('espécie')
      .doc(especie.id)
      .create({
        nome: especie.nome,
        pesoMaximoGramas: Math.round(especie.pesoMaxReferenciaKg * 1000),
        ativa: especie.ativa,
        criadoEm: Timestamp.fromDate(new Date(especie.criadoEm)),
      });
  }

  async listarEspecies(): Promise<Especie[]> {
    const snapshot = await this.firestore
      .collection('espécie')
      .orderBy('nome')
      .get();
    return snapshot.docs.map((doc) => this.mapearEspecie(doc.id, doc.data()));
  }

  async buscarEspecie(id: string): Promise<Especie | null> {
    const snapshot = await this.firestore.collection('espécie').doc(id).get();
    return snapshot.exists
      ? this.mapearEspecie(snapshot.id, snapshot.data() ?? {})
      : null;
  }

  async atualizarEspecie(especie: Especie): Promise<void> {
    const ref = this.firestore.collection('espécie').doc(especie.id);
    await ref.update({
      nome: especie.nome,
      pesoMaximoGramas: Math.round(especie.pesoMaxReferenciaKg * 1000),
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
      .collection('espécie')
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
      if (
        !speciesData.ativa ||
        this.mapearStatus(challengeData.status) !== 'ativo'
      ) {
        throw new Error('Desafio inativo ou espécie indisponível.');
      }
      if (
        this.contarCapturasDoDia(daily.docs, registro.pescadorId, registro.dataHora) >=
        limiteDiario
      ) {
        throw new LimiteDiarioRegistrosError();
      }
      transaction.create(ref, this.serializarRegistro(registro));
    });
  }

  async listarRegistros(
    desafioId: string,
    pescadorId?: string
  ): Promise<RegistroPesca[]> {
    const query: Query = this.firestore
      .collection('registros_pesca')
      .where('desafioId', '==', desafioId);
    const snapshot = await query.get();
    return snapshot.docs
      .filter(
        (doc) =>
          !pescadorId || String(doc.get('pescadorId') ?? '') === pescadorId
      )
      .map((doc) => this.mapearRegistro(doc.id, doc.data()))
      .sort((a, b) => a.dataHora.localeCompare(b.dataHora));
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
      if (
        this.contarCapturasDoDia(
          daily.docs,
          String(current.pescadorId),
          alteracoes.dataHora,
          id
        ) >= limiteDiario
      ) {
        throw new LimiteDiarioRegistrosError();
      }
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
    return this.contarCapturasDoDia(
      snapshot.docs,
      pescadorId,
      dataHora,
      ignorarRegistroId
    );
  }

  private queryRegistrosDia(
    desafioId: string,
    _pescadorId: string,
    _dataHora: string
  ): Query {
    // Query only by the parent's challenge ID (single-field index). Participant
    // and UTC day filtering is done in-process to avoid a composite index that
    // this Firebase project doesn't currently have permission to create.
    return this.firestore
      .collection('registros_pesca')
      .where('desafioId', '==', desafioId);
  }

  private contarCapturasDoDia(
    documents: Array<{ id: string; data: () => FirebaseFirestore.DocumentData | undefined }>,
    pescadorId: string,
    dataHora: string,
    ignorarRegistroId?: string
  ): number {
    const date = new Date(dataHora);
    const start = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
    const end = start + 24 * 60 * 60 * 1000;
    return documents.filter((document) => {
      if (document.id === ignorarRegistroId) return false;
      const data = document.data() ?? {};
      const value = data.dataHora;
      const capturedAt = value instanceof Timestamp
        ? value.toMillis()
        : value instanceof Date
          ? value.getTime()
          : typeof value === 'string'
            ? new Date(value).getTime()
            : Number.NaN;
      return (
        String(data.pescadorId ?? '') === pescadorId &&
        capturedAt >= start &&
        capturedAt < end
      );
    }).length;
  }

  private serializarDesafio(desafio: NovoDesafio) {
    return {
      nome: desafio.nome,
      donoId: desafio.donoId,
      inicioEm: Timestamp.fromDate(new Date(desafio.inicio)),
      fimEm: Timestamp.fromDate(new Date(desafio.fim)),
      status: this.serializarStatus(desafio.status),
      criteriosRanking: this.serializarCriteriosRanking(
        desafio.criteriosRanking
      ),
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

  private async mapearDesafioComConvite(
    id: string,
    data: Record<string, unknown>
  ): Promise<Desafio> {
    let codigoConvite = String(data.codigoConvite ?? '');
    if (!codigoConvite) {
      const convites = await this.firestore
        .collection('desafios')
        .doc(id)
        .collection('convites')
        .limit(1)
        .get();
      const convite = convites.docs[0];
      if (convite) {
        codigoConvite = String(
          convite.get('codigo') ?? convite.get('codigoConvite') ?? convite.id
        );
      }
    }
    return {
      id,
      nome: String(data.nome ?? ''),
      codigoConvite,
      donoId: String(data.donoId ?? ''),
      inicio: this.iso(data.inicioEm ?? data.inicio),
      fim: this.iso(data.fimEm ?? data.fim),
      status: this.mapearStatus(data.status),
      criteriosRanking: this.mapearCriteriosRanking(data.criteriosRanking),
      criadoEm: this.iso(data.criadoEm),
    };
  }

  private mapearEspecie(id: string, data: Record<string, unknown>): Especie {
    return {
      id,
      nome: String(data.nome ?? ''),
      pesoMaxReferenciaKg: Number(
        data.pesoMaxReferenciaKg ??
          (typeof data.pesoMaximoGramas === 'number'
            ? data.pesoMaximoGramas / 1000
            : 0)
      ),
      ativa: Boolean(data.ativa),
      criadoEm: this.iso(data.criadoEm),
      ...(data.atualizadoEm
        ? { atualizadoEm: this.iso(data.atualizadoEm) }
        : {}),
    };
  }

  private mapearParticipacao(
    desafioId: string,
    id: string,
    data: Record<string, unknown>
  ): Participacao {
    const pescadorId = String(data.pescadorId ?? id);
    return {
      id,
      desafioId,
      pescadorId,
      nomePescador: String(data.nomePescador ?? data.nome ?? pescadorId),
      entrouEm: this.iso(
        data.dataEntrada ?? data.entrouEm ?? data.criadoEm
      ),
    };
  }

  private participacaoEncerrada(data: Record<string, unknown>): boolean {
    return (data.saiuEm !== undefined && data.saiuEm !== null) ||
      (data.dataSaida !== undefined && data.dataSaida !== null);
  }

  private mapearStatus(value: unknown): Desafio['status'] {
    const status = String(value ?? '').toLocaleLowerCase('pt-BR');
    if (status === 'aberto') return 'aberto';
    if (status === 'ativo') return 'ativo';
    if (status === 'encerrado') return 'encerrado';
    if (status === 'cancelado') return 'cancelado';
    return 'aberto';
  }

  private serializarStatus(status: Desafio['status']): string {
    return status.toLocaleUpperCase('pt-BR');
  }

  private mapearCriterio(value: string): Desafio['criteriosRanking'][number] | null {
    const normalized = value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase();
    if (['PESO_TOTAL', 'MAIOR_PESO_TOTAL'].includes(normalized)) {
      return 'peso_total';
    }
    if (['MAIS_PEIXES', 'MAIS_PESCADOS'].includes(normalized)) {
      return 'mais_peixes';
    }
    if (['MENOR_TEMPO', 'INICIO_ATE_PRIMEIRO_REGISTRO_VALIDO'].includes(normalized)) {
      return 'menor_tempo';
    }
    if (['MAIOR_PEIXE', 'MELHOR_PEIXE'].includes(normalized)) {
      return 'maior_peixe';
    }
    return null;
  }

  private mapearCriteriosRanking(value: unknown): Desafio['criteriosRanking'] {
    const values = Array.isArray(value) ? value.map(String) : [];
    const criteria = new Set(values
      .map((item) => this.mapearCriterio(item))
      .filter(
        (item): item is Desafio['criteriosRanking'][number] => item !== null
      ));
    return criteria.size ? [...criteria] : ['peso_total', 'maior_peixe'];
  }

  private serializarCriteriosRanking(
    value: Desafio['criteriosRanking'],
    existentes?: unknown
  ): unknown[] {
    const values = Array.isArray(existentes) ? [...existentes] : [];
    const preserved = values.filter(
      (item) => typeof item !== 'string' || this.mapearCriterio(item) === null
    );
    const stored: string[] = [];
    if (value.includes('peso_total')) stored.push('PESO_TOTAL');
    if (value.includes('mais_peixes')) stored.push('MAIS_PEIXES');
    if (value.includes('menor_tempo')) {
      stored.push('INICIO_ATE_PRIMEIRO_REGISTRO_VALIDO');
    }
    if (value.includes('maior_peixe')) stored.push('MAIOR_PEIXE');
    return [...preserved, ...stored];
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
