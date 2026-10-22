import type {
  CriterioRanking,
  Desafio,
  DetalheDesafio,
  Especie,
  ItemRanking,
  Participacao,
  RegistroPesca,
  MensagemGrupo,
  PaginaMensagens,
} from '../domain/Pescaria';
import {
  CodigoConviteDuplicadoError,
  CursorMensagemInvalidoError,
  LimiteDiarioRegistrosError,
  ParticipacaoDuplicadaError,
  type AlteracaoDesafio,
  type AlteracaoRegistroPesca,
  type FotoStoragePort,
  type NovoDesafio,
  type PescariaRepository,
} from './ports/PescariaRepository';

export class ErroPescaria extends Error {
  constructor(
    message: string,
    readonly statusCode: number
  ) {
    super(message);
    this.name = 'ErroPescaria';
  }
}

const LIMITE_REGISTROS_DIA = 10;
const TAMANHO_MAXIMO_FOTO_BYTES = 4 * 1024 * 1024;
const TIPOS_FOTO_PERMITIDOS = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);
const CRITERIOS_RANKING: CriterioRanking[] = [
  'peso_total',
  'maior_peixe',
  'mais_peixes',
  'menor_tempo',
];

export interface DadosCriacaoDesafio {
  nome: string;
  inicio: string;
  fim: string | null;
  tipo?: 'desafio' | 'clube';
  descricao?: string;
  capaTema?: 'azul' | 'lima' | 'rio';
  capaBase64?: string;
  capaMimeType?: string;
  criteriosRanking?: CriterioRanking[];
}

export interface DadosRegistroPesca {
  desafioId: string;
  especieId: string;
  pesoKg: number;
  comprimentoCm?: number;
  local: string;
  dataHora: string;
  fotoBase64: string;
  fotoMimeType: string;
}

export interface DadosAtualizacaoRegistro extends Omit<
  DadosRegistroPesca,
  'desafioId' | 'fotoBase64' | 'fotoMimeType'
> {
  fotoBase64?: string;
  fotoMimeType?: string;
}

export class GerenciarPescariasService {
  constructor(
    private readonly repository: PescariaRepository,
    private readonly fotoStorage: FotoStoragePort,
    private readonly gerarId: () => string,
    private readonly gerarCodigo: () => string,
    private readonly agora: () => Date = () => new Date()
  ) {}

  async listarMensagens(desafioId: string, pescadorId: string, antes?: string): Promise<PaginaMensagens> {
    await this.obterDesafio(desafioId);
    await this.exigirParticipante(desafioId, pescadorId);
    if (antes && !/^[a-zA-Z0-9_-]{1,128}$/.test(antes)) throw new ErroPescaria('Cursor de mensagens inválido.', 400);
    try { return await this.repository.listarMensagens(desafioId, antes); }
    catch (error) { if (error instanceof CursorMensagemInvalidoError) throw new ErroPescaria(error.message, 400); throw error; }
  }

  async enviarMensagem(desafioId: string, pescadorId: string, nomePescador: string, dados: { texto?: string; fotoBase64?: string; fotoMimeType?: string }): Promise<MensagemGrupo> {
    const desafio = await this.obterDesafio(desafioId);
    await this.exigirParticipante(desafioId, pescadorId);
    if (desafio.status === 'cancelado') throw new ErroPescaria('Este grupo foi encerrado.', 409);
    const texto = dados.texto?.trim() ?? '';
    if (texto.length > 2000 || (!texto && !dados.fotoBase64)) throw new ErroPescaria('Escreva uma mensagem de até 2000 caracteres ou envie uma foto.', 400);
    if (Boolean(dados.fotoBase64) !== Boolean(dados.fotoMimeType)) throw new ErroPescaria('Informe a foto e seu tipo.', 400);
    const foto = dados.fotoBase64 && dados.fotoMimeType ? this.validarFoto(dados.fotoBase64, dados.fotoMimeType) : null;
    const mensagem: MensagemGrupo = { id: this.gerarId(), desafioId, pescadorId, nomePescador, texto, criadoEm: this.agora().toISOString() };
    let fotoPath: string | undefined;
    try {
      if (foto) {
        const salva = await this.fotoStorage.salvar(`grupos/${desafioId}/chat/${mensagem.id}`, foto.base64, foto.mimeType);
        mensagem.fotoUrl = salva.url;
        fotoPath = salva.path;
      }
      await this.repository.criarMensagem(mensagem);
      return mensagem;
    } catch (error) {
      if (fotoPath) await this.tentarExcluirFoto(fotoPath);
      throw error;
    }
  }

  async criarDesafio(
    pescadorId: string,
    dados: DadosCriacaoDesafio,
    nomePescador = pescadorId
  ): Promise<Desafio> {
    const nome = this.validarTexto(dados.nome, 'Nome do desafio', 80);
    const agora = this.agora();
    const tipo = dados.tipo ?? 'desafio';
    if (!['desafio', 'clube'].includes(tipo)) throw new ErroPescaria('Tipo de grupo inválido.', 400);
    const inicio = tipo === 'clube' ? agora : this.validarData(dados.inicio, 'Data de início');
    const fim = tipo === 'clube' ? null : this.validarData(dados.fim ?? '', 'Data de fim');
    if ((tipo === 'clube' && dados.fim !== null) || (tipo === 'desafio' && (inicio <= agora || !fim || fim <= inicio))) {
      throw new ErroPescaria(
        'O desafio deve começar no futuro e terminar depois do início.',
        400
      );
    }

    const criterios = dados.criteriosRanking ?? (dados.tipo ? ['maior_peixe'] : CRITERIOS_RANKING);
    if (
      !criterios.length ||
      criterios.some((item) => !CRITERIOS_RANKING.includes(item))
    ) {
      throw new ErroPescaria('Critérios de ranking inválidos.', 400);
    }

    if (dados.tipo && (criterios.length !== 1 || criterios[0] !== 'maior_peixe')) {
      throw new ErroPescaria('O modo disponível para novos grupos é maior peixe pescado.', 400);
    }
    const descricao = dados.descricao?.trim() ?? '';
    if (descricao.length > 500) throw new ErroPescaria('A descrição deve ter até 500 caracteres.', 400);
    const capaTema = dados.capaTema ?? 'azul';
    if (!['azul', 'lima', 'rio'].includes(capaTema)) throw new ErroPescaria('Tema de capa inválido.', 400);
    if (Boolean(dados.capaBase64) !== Boolean(dados.capaMimeType)) throw new ErroPescaria('Informe a foto de capa e seu tipo.', 400);
    const foto = dados.capaBase64 && dados.capaMimeType ? this.validarFoto(dados.capaBase64, dados.capaMimeType) : null;

    for (let tentativa = 0; tentativa < 5; tentativa += 1) {
      const desafio: NovoDesafio = {
        id: this.gerarId(),
        nome,
        codigoConvite: this.gerarCodigo().toUpperCase(),
        donoId: pescadorId,
        inicio: inicio.toISOString(),
        fim: fim?.toISOString() ?? null,
        tipo,
        descricao,
        capaTema,
        status: tipo === 'clube' ? 'ativo' : 'aberto',
        criteriosRanking: [...new Set(criterios)],
        criadoEm: agora.toISOString(),
      };
      const participacaoDono: Participacao = {
        id: pescadorId,
        desafioId: desafio.id,
        pescadorId,
        nomePescador,
        entrouEm: agora.toISOString(),
      };
      let capaPath: string | undefined;
      try {
        if (foto) {
          const capa = await this.fotoStorage.salvar(`grupos/${desafio.id}/capa`, foto.base64, foto.mimeType);
          capaPath = capa.path;
          desafio.capaUrl = capa.url;
        }
        await this.repository.criarDesafio(desafio, participacaoDono);
        return desafio;
      } catch (error) {
        if (capaPath) await this.tentarExcluirFoto(capaPath);
        if (!(error instanceof CodigoConviteDuplicadoError)) throw error;
      }
    }
    throw new ErroPescaria(
      'Não foi possível gerar um código de convite único.',
      500
    );
  }

  async listarMeusDesafios(pescadorId: string): Promise<Desafio[]> {
    const desafios = await this.repository.listarDesafiosDoPescador(pescadorId);
    const atualizados: Desafio[] = [];
    for (const desafio of desafios) {
      atualizados.push(await this.atualizarStatus(desafio));
    }
    return atualizados;
  }

  async obterDetalhe(
    desafioId: string,
    pescadorId: string
  ): Promise<DetalheDesafio> {
    const desafio = await this.obterDesafio(desafioId);
    await this.exigirParticipante(desafioId, pescadorId);
    const status = await this.atualizarStatus(desafio);
    const [participantes, registros] = await Promise.all([
      this.repository.listarParticipacoes(desafioId),
      this.repository.listarRegistros(desafioId),
    ]);
    const porPescador = new Map(participantes.map((p) => [p.pescadorId, p]));
    const registrosValidos = registros.filter((r) => r.status === 'valido');
    const totais = new Map<string, ItemRanking>();
    for (const participante of participantes) {
      totais.set(participante.pescadorId, {
        pescadorId: participante.pescadorId,
        nomePescador: participante.nomePescador,
        quantidadePeixes: 0,
        pesoTotalKg: 0,
      });
    }
    for (const registro of registrosValidos) {
      const total = totais.get(registro.pescadorId);
      if (total) {
        total.quantidadePeixes += 1;
        total.pesoTotalKg = Number(
          (total.pesoTotalKg + registro.pesoKg).toFixed(3)
        );
      }
    }
    const usaRankingPeso = status.criteriosRanking.some((criterio) =>
      ['peso_total', 'mais_peixes', 'menor_tempo'].includes(criterio)
    );
    const rankingPesoTotal = usaRankingPeso
      ? [...totais.values()].sort(
          (a, b) => {
            const compareWeight = b.pesoTotalKg - a.pesoTotalKg;
            const compareCount = b.quantidadePeixes - a.quantidadePeixes;
            if (
              status.criteriosRanking.includes('menor_tempo') &&
              compareWeight === 0 &&
              compareCount === 0
            ) {
              const earliestA = registrosValidos
                .filter((registro) => registro.pescadorId === a.pescadorId)
                .map((registro) => registro.dataHora)
                .sort()[0];
              const earliestB = registrosValidos
                .filter((registro) => registro.pescadorId === b.pescadorId)
                .map((registro) => registro.dataHora)
                .sort()[0];
              if (earliestA && earliestB) {
                return earliestA.localeCompare(earliestB);
              }
            }
            return (
              compareWeight ||
              compareCount ||
              a.pescadorId.localeCompare(b.pescadorId)
            );
          }
        )
      : [];
    const melhorRegistro = [...registrosValidos].sort(
      (a, b) =>
        b.pesoKg - a.pesoKg ||
        a.dataHora.localeCompare(b.dataHora) ||
        a.id.localeCompare(b.id)
    )[0];
    const melhorPeixe =
      status.criteriosRanking.includes('maior_peixe') && melhorRegistro
        ? {
            ...melhorRegistro,
            nomePescador:
              porPescador.get(melhorRegistro.pescadorId)?.nomePescador ??
              melhorRegistro.pescadorId,
          }
        : null;
    const melhoresPorPescador = new Map<string, RegistroPesca>();
    for (const registro of registrosValidos) {
      const atual = melhoresPorPescador.get(registro.pescadorId);
      if (!atual || registro.pesoKg > atual.pesoKg || (registro.pesoKg === atual.pesoKg && registro.dataHora < atual.dataHora)) {
        melhoresPorPescador.set(registro.pescadorId, registro);
      }
    }
    const rankingMaiorPeixe = status.criteriosRanking.includes('maior_peixe')
      ? [...totais.values()].map(item => ({
          ...item,
          maiorPeixeKg: melhoresPorPescador.get(item.pescadorId)?.pesoKg ?? 0,
        })).sort((a, b) => b.maiorPeixeKg - a.maiorPeixeKg
          || (melhoresPorPescador.get(a.pescadorId)?.dataHora ?? '').localeCompare(melhoresPorPescador.get(b.pescadorId)?.dataHora ?? '')
          || a.pescadorId.localeCompare(b.pescadorId))
      : [];
    return { ...status, participantes, rankingPesoTotal, rankingMaiorPeixe, melhorPeixe };
  }

  async atualizarDesafio(
    desafioId: string,
    pescadorId: string,
    dados: DadosCriacaoDesafio
  ): Promise<Desafio> {
    const desafio = await this.obterDesafio(desafioId);
    this.exigirDono(desafio, pescadorId);
    if (
      desafio.status !== 'aberto' ||
      this.agora() >= new Date(desafio.inicio)
    ) {
      throw new ErroPescaria(
        'Só é possível editar um desafio antes de começar.',
        409
      );
    }
    const inicio = this.validarData(dados.inicio, 'Data de início');
    const fim = this.validarData(dados.fim ?? '', 'Data de fim');
    if (inicio <= this.agora() || fim <= inicio) {
      throw new ErroPescaria(
        'O desafio deve começar no futuro e terminar depois do início.',
        400
      );
    }
    const criterios = dados.criteriosRanking ?? desafio.criteriosRanking;
    if (
      !criterios.length ||
      criterios.some((item) => !CRITERIOS_RANKING.includes(item))
    ) {
      throw new ErroPescaria('Critérios de ranking inválidos.', 400);
    }
    const alteracoes: AlteracaoDesafio = {
      nome: this.validarTexto(dados.nome, 'Nome do desafio', 80),
      inicio: inicio.toISOString(),
      fim: fim.toISOString(),
      criteriosRanking: [...new Set(criterios)],
    };
    await this.repository.atualizarDesafio(desafioId, alteracoes);
    return { ...desafio, ...alteracoes };
  }

  async cancelarDesafio(desafioId: string, pescadorId: string): Promise<void> {
    const desafio = await this.obterDesafio(desafioId);
    this.exigirDono(desafio, pescadorId);
    if (desafio.status === 'encerrado' || desafio.status === 'cancelado') {
      throw new ErroPescaria('Este desafio não pode mais ser cancelado.', 409);
    }
    await this.repository.atualizarStatusDesafio(desafioId, 'cancelado');
  }

  async entrarPorCodigo(
    codigo: string,
    pescadorId: string,
    nomePescador = pescadorId
  ): Promise<Participacao> {
    const desafio = await this.repository.buscarDesafioPorCodigo(
      codigo.trim().toUpperCase()
    );
    if (!desafio)
      throw new ErroPescaria('Código de convite não encontrado.', 404);
    const atualizado = await this.atualizarStatus(desafio);
    if (
      desafio.tipo === 'clube'
        ? atualizado.status !== 'ativo'
        : atualizado.status !== 'aberto' || this.agora() >= new Date(desafio.inicio)
    ) {
      throw new ErroPescaria(
        'Só é possível entrar em desafios abertos antes do início.',
        409
      );
    }
    if (await this.repository.buscarParticipacao(desafio.id, pescadorId)) {
      throw new ErroPescaria('Você já participa deste desafio.', 409);
    }
    const participacao: Participacao = {
      id: pescadorId,
      desafioId: desafio.id,
      pescadorId,
      nomePescador,
      entrouEm: this.agora().toISOString(),
    };
    try {
      await this.repository.entrarNoDesafio(participacao);
    } catch (error) {
      if (error instanceof ParticipacaoDuplicadaError) {
        throw new ErroPescaria('Você já participa deste desafio.', 409);
      }
      throw error;
    }
    return participacao;
  }

  async listarParticipantes(
    desafioId: string,
    pescadorId: string
  ): Promise<Participacao[]> {
    await this.exigirParticipante(desafioId, pescadorId);
    return this.repository.listarParticipacoes(desafioId);
  }

  async sairDoDesafio(desafioId: string, pescadorId: string): Promise<void> {
    const desafio = await this.obterDesafio(desafioId);
    if (
      desafio.tipo === 'clube'
        ? desafio.status !== 'ativo'
        : desafio.status !== 'aberto' || this.agora() >= new Date(desafio.inicio)
    ) {
      throw new ErroPescaria(
        'Só é possível sair antes do desafio começar.',
        409
      );
    }
    if (desafio.donoId === pescadorId) {
      throw new ErroPescaria(
        'O organizador não pode sair; cancele o desafio.',
        409
      );
    }
    const saiu = await this.repository.sairDoDesafio(desafioId, pescadorId);
    if (!saiu) throw new ErroPescaria('Participação não encontrada.', 404);
  }

  async criarEspecie(dados: {
    nome: string;
    pesoMaxReferenciaKg: number;
  }): Promise<Especie> {
    const now = this.agora().toISOString();
    const especie: Especie = {
      id: this.gerarId(),
      nome: this.validarTexto(dados.nome, 'Nome da espécie', 80),
      pesoMaxReferenciaKg: this.validarPesoMaximo(dados.pesoMaxReferenciaKg),
      ativa: true,
      criadoEm: now,
    };
    await this.repository.criarEspecie(especie);
    return especie;
  }

  async listarEspecies(): Promise<Especie[]> {
    return this.repository.listarEspecies();
  }

  async atualizarEspecie(
    especieId: string,
    dados: { nome: string; pesoMaxReferenciaKg: number; ativa: boolean }
  ): Promise<Especie> {
    const existente = await this.repository.buscarEspecie(especieId);
    if (!existente) throw new ErroPescaria('Espécie não encontrada.', 404);
    const especie: Especie = {
      ...existente,
      nome: this.validarTexto(dados.nome, 'Nome da espécie', 80),
      pesoMaxReferenciaKg: this.validarPesoMaximo(dados.pesoMaxReferenciaKg),
      ativa: dados.ativa,
      atualizadoEm: this.agora().toISOString(),
    };
    await this.repository.atualizarEspecie(especie);
    return especie;
  }

  async criarRegistro(
    pescadorId: string,
    dados: DadosRegistroPesca
  ): Promise<RegistroPesca> {
    const desafio = await this.obterDesafio(dados.desafioId);
    await this.exigirParticipante(desafio.id, pescadorId);
    const desafioAtualizado = await this.atualizarStatus(desafio);
    this.exigirDesafioAtivo(desafioAtualizado);
    const especie = await this.obterEspecieAtiva(dados.especieId);
    const dataHora = this.validarData(dados.dataHora, 'Data e hora da captura');
    this.validarDataNoDesafio(dataHora, desafioAtualizado);
    const pesoKg = this.validarPeso(dados.pesoKg, especie.pesoMaxReferenciaKg);
    const comprimentoCm = this.validarComprimento(dados.comprimentoCm);
    const local = this.validarTexto(dados.local, 'Local', 120);
    const foto = this.validarFoto(dados.fotoBase64, dados.fotoMimeType);
    if (
      (await this.repository.contarRegistrosNoDia(
        desafioAtualizado.id,
        pescadorId,
        dataHora.toISOString()
      )) >= LIMITE_REGISTROS_DIA
    ) {
      throw new ErroPescaria('Limite diário de 10 peixes atingido.', 409);
    }

    const id = this.gerarId();
    let fotoPath = `desafios/${desafioAtualizado.id}/registros/${id}`;
    const fotoSalva = await this.fotoStorage.salvar(
      fotoPath,
      foto.base64,
      foto.mimeType
    );
    fotoPath = fotoSalva.path;
    const registro = {
      id,
      desafioId: desafioAtualizado.id,
      participacaoId: pescadorId,
      pescadorId,
      especieId: especie.id,
      nomeEspecie: especie.nome,
      pesoKg,
      ...(comprimentoCm === undefined ? {} : { comprimentoCm }),
      local,
      dataHora: dataHora.toISOString(),
      fotoUrl: fotoSalva.url,
      fotoPath,
      status: 'valido' as const,
      criadoEm: this.agora().toISOString(),
    };
    try {
      await this.repository.criarRegistro(registro, LIMITE_REGISTROS_DIA);
    } catch (error) {
      await this.tentarExcluirFoto(fotoPath);
      if (error instanceof LimiteDiarioRegistrosError) {
        throw new ErroPescaria(error.message, 409);
      }
      throw error;
    }
    const { fotoPath: _, ...resposta } = registro;
    return resposta;
  }

  async listarRegistros(
    desafioId: string,
    solicitanteId: string,
    participanteId?: string
  ): Promise<RegistroPesca[]> {
    await this.exigirParticipante(desafioId, solicitanteId);
    if (participanteId)
      await this.exigirParticipante(desafioId, participanteId);
    return this.repository.listarRegistros(desafioId, participanteId);
  }

  async atualizarRegistro(
    registroId: string,
    pescadorId: string,
    dados: DadosAtualizacaoRegistro
  ): Promise<RegistroPesca> {
    const registro = await this.obterRegistro(registroId);
    this.exigirDonoRegistro(registro, pescadorId);
    const desafio = await this.obterDesafio(registro.desafioId);
    const desafioAtualizado = await this.atualizarStatus(desafio);
    this.exigirDesafioAtivo(desafioAtualizado);
    const especie = await this.obterEspecieAtiva(dados.especieId);
    const dataHora = this.validarData(dados.dataHora, 'Data e hora da captura');
    this.validarDataNoDesafio(dataHora, desafioAtualizado);
    const pesoKg = this.validarPeso(dados.pesoKg, especie.pesoMaxReferenciaKg);
    const comprimentoCm = this.validarComprimento(dados.comprimentoCm);
    const local = this.validarTexto(dados.local, 'Local', 120);
    const counted = await this.repository.contarRegistrosNoDia(
      desafio.id,
      pescadorId,
      dataHora.toISOString(),
      registro.id
    );
    if (counted >= LIMITE_REGISTROS_DIA) {
      throw new ErroPescaria('Limite diário de 10 peixes atingido.', 409);
    }

    let novoPath: string | undefined;
    let novaUrl: string | undefined;
    if (dados.fotoBase64 || dados.fotoMimeType) {
      if (!dados.fotoBase64 || !dados.fotoMimeType) {
        throw new ErroPescaria('Envie a foto e seu tipo MIME juntos.', 400);
      }
      const foto = this.validarFoto(dados.fotoBase64, dados.fotoMimeType);
      const caminhoNovo = `desafios/${desafio.id}/registros/${registro.id}-${this.gerarId()}`;
      const fotoSalva = await this.fotoStorage.salvar(
        caminhoNovo,
        foto.base64,
        foto.mimeType
      );
      novoPath = fotoSalva.path;
      novaUrl = fotoSalva.url;
    }

    const alteracoes: AlteracaoRegistroPesca = {
      especieId: especie.id,
      nomeEspecie: especie.nome,
      pesoKg,
      ...(comprimentoCm === undefined ? {} : { comprimentoCm }),
      local,
      dataHora: dataHora.toISOString(),
      ...(novaUrl && novoPath ? { fotoUrl: novaUrl, fotoPath: novoPath } : {}),
    };
    try {
      await this.repository.atualizarRegistro(
        registro.id,
        alteracoes,
        LIMITE_REGISTROS_DIA
      );
    } catch (error) {
      if (novoPath) await this.tentarExcluirFoto(novoPath);
      if (error instanceof LimiteDiarioRegistrosError) {
        throw new ErroPescaria(error.message, 409);
      }
      throw error;
    }
    if (novoPath && registro.fotoPath)
      await this.tentarExcluirFoto(registro.fotoPath);
    return {
      ...registro,
      ...alteracoes,
      ...(novaUrl ? { fotoUrl: novaUrl } : {}),
    };
  }

  async excluirRegistro(registroId: string, pescadorId: string): Promise<void> {
    const registro = await this.obterRegistro(registroId);
    this.exigirDonoRegistro(registro, pescadorId);
    const desafio = await this.obterDesafio(registro.desafioId);
    const desafioAtualizado = await this.atualizarStatus(desafio);
    this.exigirDesafioAtivo(desafioAtualizado);
    await this.repository.excluirRegistro(registro.id);
    if (registro.fotoPath) await this.tentarExcluirFoto(registro.fotoPath);
  }

  private async atualizarStatus(desafio: Desafio): Promise<Desafio> {
    if (desafio.status === 'cancelado' || desafio.status === 'encerrado')
      return desafio;
    if (desafio.tipo === 'clube') return desafio;
    const participantes = await this.repository.listarParticipacoes(desafio.id);
    const agora = this.agora();
    let status: Desafio['status'] = desafio.status;
    if (desafio.fim && agora >= new Date(desafio.fim)) status = 'encerrado';
    else if (agora >= new Date(desafio.inicio)) {
      status = participantes.length >= 2 ? 'ativo' : 'cancelado';
    }
    if (status !== desafio.status) {
      await this.repository.atualizarStatusDesafio(desafio.id, status);
      return { ...desafio, status };
    }
    return desafio;
  }

  private async obterDesafio(id: string): Promise<Desafio> {
    const desafio = await this.repository.buscarDesafio(id);
    if (!desafio) throw new ErroPescaria('Desafio não encontrado.', 404);
    return desafio;
  }

  private async obterRegistro(id: string): Promise<RegistroPesca> {
    const registro = await this.repository.buscarRegistro(id);
    if (!registro)
      throw new ErroPescaria('Registro de pesca não encontrado.', 404);
    return registro;
  }

  private async obterEspecieAtiva(id: string): Promise<Especie> {
    const especie = await this.repository.buscarEspecie(id);
    if (!especie) throw new ErroPescaria('Espécie não encontrada.', 404);
    if (!especie.ativa) throw new ErroPescaria('A espécie está inativa.', 409);
    return especie;
  }

  private async exigirParticipante(
    desafioId: string,
    pescadorId: string
  ): Promise<void> {
    if (!(await this.repository.buscarParticipacao(desafioId, pescadorId))) {
      throw new ErroPescaria(
        'É necessário participar do desafio para acessar este recurso.',
        403
      );
    }
  }

  private exigirDono(desafio: Desafio, pescadorId: string): void {
    if (desafio.donoId !== pescadorId)
      throw new ErroPescaria(
        'Apenas o organizador pode realizar esta operação.',
        403
      );
  }

  private exigirDonoRegistro(
    registro: RegistroPesca,
    pescadorId: string
  ): void {
    if (registro.pescadorId !== pescadorId)
      throw new ErroPescaria(
        'Só é possível alterar os próprios registros.',
        403
      );
  }

  private exigirDesafioAtivo(desafio: Desafio): void {
    if (
      desafio.status !== 'ativo' ||
      this.agora() < new Date(desafio.inicio) ||
      (desafio.fim !== null && this.agora() >= new Date(desafio.fim))
    ) {
      throw new ErroPescaria(
        'O registro só pode ser alterado durante um desafio ativo.',
        409
      );
    }
  }

  private validarDataNoDesafio(data: Date, desafio: Desafio): void {
    if (data < new Date(desafio.inicio) || (desafio.fim !== null && data > new Date(desafio.fim))) {
      throw new ErroPescaria(
        'A data da captura deve estar dentro do período do desafio.',
        400
      );
    }
  }

  private validarTexto(
    value: string,
    label: string,
    maxLength: number
  ): string {
    const result = value?.trim();
    if (!result || result.length > maxLength) {
      throw new ErroPescaria(
        `${label} deve ter entre 1 e ${maxLength} caracteres.`,
        400
      );
    }
    return result;
  }

  private validarData(value: string, label: string): Date {
    const date = new Date(value);
    if (!value || !Number.isFinite(date.getTime())) {
      throw new ErroPescaria(`${label} inválida. Use uma data ISO 8601.`, 400);
    }
    return date;
  }

  private validarPeso(pesoKg: number, maximo: number): number {
    if (!Number.isFinite(pesoKg) || pesoKg <= 0 || pesoKg > maximo) {
      throw new ErroPescaria(
        `O peso deve ser maior que zero e não ultrapassar ${maximo} kg.`,
        400
      );
    }
    return Math.round(pesoKg * 1000) / 1000;
  }

  private validarPesoMaximo(value: number): number {
    if (!Number.isFinite(value) || value <= 0) {
      throw new ErroPescaria(
        'O peso máximo de referência deve ser maior que zero.',
        400
      );
    }
    return value;
  }

  private validarComprimento(value?: number): number | undefined {
    if (value === undefined) return undefined;
    if (!Number.isFinite(value) || value <= 0) {
      throw new ErroPescaria('O comprimento deve ser maior que zero.', 400);
    }
    return value;
  }

  private validarFoto(base64: string, contentType: string) {
    const normalized = contentType.toLowerCase();
    const extension =
      normalized === 'image/jpeg'
        ? 'jpg'
        : normalized === 'image/png'
          ? 'png'
          : 'webp';
    const clean = base64.replace(/^data:image\/(?:jpeg|png|webp);base64,/, '');
    if (
      !TIPOS_FOTO_PERMITIDOS.has(normalized) ||
      !/^[A-Za-z0-9+/]*={0,2}$/.test(clean)
    ) {
      throw new ErroPescaria(
        'A foto deve ser JPEG, PNG ou WebP em base64.',
        400
      );
    }
    if (Math.floor((clean.length * 3) / 4) > TAMANHO_MAXIMO_FOTO_BYTES) {
      throw new ErroPescaria('A foto não pode exceder 4 MB.', 413);
    }
    return { base64: clean, mimeType: normalized, extension };
  }

  private async tentarExcluirFoto(path: string): Promise<void> {
    try {
      await this.fotoStorage.excluir(path);
    } catch {
      // Mantém o erro da operação principal; a limpeza da foto pode ser refeita.
    }
  }
}
