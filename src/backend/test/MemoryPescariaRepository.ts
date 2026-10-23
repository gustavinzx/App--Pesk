import {
  CodigoConviteDuplicadoError,
  CursorMensagemInvalidoError,
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
  MensagemGrupo,
  PaginaMensagens,
} from '../../core/domain/Pescaria.js';

export class MemoryPescariaRepository implements PescariaRepository {
  readonly mensagens = new Map<string, MensagemGrupo>();

  async criarMensagem(mensagem: MensagemGrupo): Promise<void> { this.mensagens.set(mensagem.id, { ...mensagem }); }

  async listarMensagens(desafioId: string, antes?: string): Promise<PaginaMensagens> {
    const sorted = [...this.mensagens.values()].filter(item => item.desafioId === desafioId).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm) || b.id.localeCompare(a.id));
    const index = antes ? sorted.findIndex(item => item.id === antes) : -1;
    if (antes && index < 0) throw new CursorMensagemInvalidoError();
    const remaining = sorted.slice(index + 1);
    const page = remaining.slice(0, 50);
    return { mensagens: [...page].reverse(), proximoCursor: remaining.length > 50 ? page[page.length - 1].id : null };
  }
  readonly desafios = new Map<string, Desafio>();
  readonly especies = new Map<string, Especie>();
  readonly registros = new Map<string, RegistroPesca>();
  private readonly participacoes = new Map<string, Participacao>();

  async criarDesafio(
    desafio: NovoDesafio,
    participacaoDono: Participacao
  ): Promise<void> {
    if (
      [...this.desafios.values()].some(
        (item) => item.codigoConvite === desafio.codigoConvite
      )
    ) {
      throw new CodigoConviteDuplicadoError();
    }
    this.desafios.set(desafio.id, { ...desafio });
    this.participacoes.set(this.key(desafio.id, participacaoDono.pescadorId), {
      ...participacaoDono,
    });
  }

  async listarDesafiosDoPescador(pescadorId: string): Promise<Desafio[]> {
    return [...this.desafios.values()].filter(
      (desafio) =>
        desafio.donoId === pescadorId ||
        this.participacoes.has(this.key(desafio.id, pescadorId))
    );
  }

  async buscarDesafio(id: string): Promise<Desafio | null> {
    return this.desafios.get(id) ?? null;
  }

  async buscarDesafioPorCodigo(codigo: string): Promise<Desafio | null> {
    return (
      [...this.desafios.values()].find(
        (item) => item.codigoConvite === codigo
      ) ?? null
    );
  }

  async atualizarDesafio(id: string, changes: AlteracaoDesafio): Promise<void> {
    const item = this.desafios.get(id);
    if (item) this.desafios.set(id, { ...item, ...changes });
  }

  async atualizarStatusDesafio(
    id: string,
    status: Desafio['status']
  ): Promise<void> {
    const item = this.desafios.get(id);
    if (item) this.desafios.set(id, { ...item, status });
  }

  async listarParticipacoes(desafioId: string): Promise<Participacao[]> {
    return [...this.participacoes.values()].filter(
      (item) => item.desafioId === desafioId
    );
  }

  async buscarParticipacao(
    desafioId: string,
    pescadorId: string
  ): Promise<Participacao | null> {
    return this.participacoes.get(this.key(desafioId, pescadorId)) ?? null;
  }

  async entrarNoDesafio(participacao: Participacao): Promise<void> {
    const key = this.key(participacao.desafioId, participacao.pescadorId);
    if (this.participacoes.has(key)) throw new ParticipacaoDuplicadaError();
    this.participacoes.set(key, { ...participacao });
  }

  async sairDoDesafio(desafioId: string, pescadorId: string): Promise<boolean> {
    return this.participacoes.delete(this.key(desafioId, pescadorId));
  }

  async criarEspecie(especie: Especie): Promise<void> {
    this.especies.set(especie.id, { ...especie });
  }

  async listarEspecies(): Promise<Especie[]> {
    return [...this.especies.values()].sort((a, b) =>
      a.nome.localeCompare(b.nome)
    );
  }

  async buscarEspecie(id: string): Promise<Especie | null> {
    return this.especies.get(id) ?? null;
  }

  async atualizarEspecie(especie: Especie): Promise<void> {
    this.especies.set(especie.id, { ...especie });
  }

  async criarRegistro(
    registro: NovoRegistroPesca,
    limiteDiario: number
  ): Promise<void> {
    if (
      (await this.contarRegistrosNoDia(
        registro.desafioId,
        registro.pescadorId,
        registro.dataHora
      )) >= limiteDiario
    ) {
      throw new LimiteDiarioRegistrosError();
    }
    this.registros.set(registro.id, { ...registro });
  }

  async listarRegistros(
    desafioId: string,
    pescadorId?: string
  ): Promise<RegistroPesca[]> {
    return [...this.registros.values()].filter(
      (registro) =>
        registro.desafioId === desafioId &&
        (!pescadorId || registro.pescadorId === pescadorId)
    );
  }

  async buscarRegistro(id: string): Promise<RegistroPesca | null> {
    return this.registros.get(id) ?? null;
  }

  async atualizarRegistro(
    id: string,
    changes: AlteracaoRegistroPesca,
    limiteDiario: number
  ): Promise<void> {
    const registro = this.registros.get(id);
    if (!registro) return;
    if (
      (await this.contarRegistrosNoDia(
        registro.desafioId,
        registro.pescadorId,
        changes.dataHora,
        id
      )) >= limiteDiario
    ) {
      throw new LimiteDiarioRegistrosError();
    }
    this.registros.set(id, { ...registro, ...changes });
  }

  async excluirRegistro(id: string): Promise<void> {
    this.registros.delete(id);
  }

  async contarRegistrosNoDia(
    desafioId: string,
    pescadorId: string,
    dataHora: string,
    ignorarRegistroId?: string
  ): Promise<number> {
    const date = new Date(dataHora);
    return [...this.registros.values()].filter((registro) => {
      const capturedAt = new Date(registro.dataHora);
      return (
        registro.id !== ignorarRegistroId &&
        registro.desafioId === desafioId &&
        registro.pescadorId === pescadorId &&
        capturedAt.getUTCFullYear() === date.getUTCFullYear() &&
        capturedAt.getUTCMonth() === date.getUTCMonth() &&
        capturedAt.getUTCDate() === date.getUTCDate()
      );
    }).length;
  }

  private key(desafioId: string, pescadorId: string): string {
    return `${desafioId}:${pescadorId}`;
  }
}
