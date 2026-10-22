import type {
  Desafio,
  Especie,
  Participacao,
  RegistroPesca,
} from '../../domain/Pescaria';

export interface NovoDesafio extends Omit<Desafio, 'status'> {
  status: 'aberto';
}

export interface AlteracaoDesafio {
  nome: string;
  inicio: string;
  fim: string;
  criteriosRanking: Desafio['criteriosRanking'];
}

export interface NovoRegistroPesca extends Omit<
  RegistroPesca,
  'fotoUrl' | 'status'
> {
  fotoUrl: string;
  fotoPath: string;
  status: 'valido';
}

export interface AlteracaoRegistroPesca {
  especieId: string;
  nomeEspecie: string;
  pesoKg: number;
  comprimentoCm?: number;
  local: string;
  dataHora: string;
  fotoUrl?: string;
  fotoPath?: string;
}

export interface PescariaRepository {
  criarDesafio(
    desafio: NovoDesafio,
    participacaoDono: Participacao
  ): Promise<void>;
  listarDesafiosDoPescador(pescadorId: string): Promise<Desafio[]>;
  buscarDesafio(id: string): Promise<Desafio | null>;
  buscarDesafioPorCodigo(codigo: string): Promise<Desafio | null>;
  atualizarDesafio(id: string, alteracoes: AlteracaoDesafio): Promise<void>;
  atualizarStatusDesafio(id: string, status: Desafio['status']): Promise<void>;
  listarParticipacoes(desafioId: string): Promise<Participacao[]>;
  buscarParticipacao(
    desafioId: string,
    pescadorId: string
  ): Promise<Participacao | null>;
  entrarNoDesafio(participacao: Participacao): Promise<void>;
  sairDoDesafio(desafioId: string, pescadorId: string): Promise<boolean>;
  criarEspecie(especie: Especie): Promise<void>;
  listarEspecies(): Promise<Especie[]>;
  buscarEspecie(id: string): Promise<Especie | null>;
  atualizarEspecie(especie: Especie): Promise<void>;
  criarRegistro(
    registro: NovoRegistroPesca,
    limiteDiario: number
  ): Promise<void>;
  listarRegistros(
    desafioId: string,
    pescadorId?: string
  ): Promise<RegistroPesca[]>;
  buscarRegistro(id: string): Promise<RegistroPesca | null>;
  atualizarRegistro(
    id: string,
    alteracoes: AlteracaoRegistroPesca,
    limiteDiario: number
  ): Promise<void>;
  excluirRegistro(id: string): Promise<void>;
  contarRegistrosNoDia(
    desafioId: string,
    pescadorId: string,
    dataHora: string,
    ignorarRegistroId?: string
  ): Promise<number>;
}

export interface FotoStoragePort {
  salvar(path: string, base64: string, contentType: string): Promise<FotoSalva>;
  excluir(pathOuUrl: string): Promise<void>;
  obter(path: string): Promise<FotoArquivo | null>;
}

export interface FotoSalva {
  url: string;
  path: string;
}

export interface FotoArquivo {
  bytes: Uint8Array;
  contentType: string;
}

export class CodigoConviteDuplicadoError extends Error {
  constructor() {
    super('Código de convite já utilizado.');
    this.name = 'CodigoConviteDuplicadoError';
  }
}
export class ParticipacaoDuplicadaError extends Error {
  constructor() {
    super('O pescador já participa deste desafio.');
    this.name = 'ParticipacaoDuplicadaError';
  }
}
export class LimiteDiarioRegistrosError extends Error {
  constructor() {
    super('Limite diário de 10 peixes atingido.');
    this.name = 'LimiteDiarioRegistrosError';
  }
}
export class DadosNaoEncontradosRepositoryError extends Error {
  constructor() {
    super('Os dados necessários não foram encontrados.');
    this.name = 'DadosNaoEncontradosRepositoryError';
  }
}
