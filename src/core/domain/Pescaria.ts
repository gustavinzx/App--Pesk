export type StatusDesafio = 'aberto' | 'ativo' | 'encerrado' | 'cancelado';
export type StatusRegistroPesca = 'valido' | 'contestado' | 'anulado';
export type CriterioRanking =
  | 'peso_total'
  | 'maior_peixe'
  | 'mais_peixes'
  | 'menor_tempo';

export interface Desafio {
  id: string;
  nome: string;
  codigoConvite: string;
  donoId: string;
  inicio: string;
  fim: string;
  status: StatusDesafio;
  criteriosRanking: CriterioRanking[];
  criadoEm: string;
}

export interface Participacao {
  id: string;
  desafioId: string;
  pescadorId: string;
  nomePescador: string;
  entrouEm: string;
}

export interface Especie {
  id: string;
  nome: string;
  pesoMaxReferenciaKg: number;
  ativa: boolean;
  criadoEm: string;
  atualizadoEm?: string;
}

export interface RegistroPesca {
  id: string;
  desafioId: string;
  participacaoId: string;
  pescadorId: string;
  especieId: string;
  nomeEspecie: string;
  pesoKg: number;
  comprimentoCm?: number;
  local: string;
  dataHora: string;
  fotoUrl: string;
  /** Internal Storage object path; API responses must omit this field. */
  fotoPath?: string;
  status: StatusRegistroPesca;
  criadoEm: string;
}

export interface ItemRanking {
  pescadorId: string;
  nomePescador: string;
  quantidadePeixes: number;
  pesoTotalKg: number;
  maiorPeixeKg: number | null;
  tempoAtePrimeiraCapturaMs: number | null;
}

export interface DetalheDesafio extends Desafio {
  participantes: Participacao[];
  ranking: ItemRanking[];
  rankingPesoTotal: ItemRanking[];
  melhorPeixe: (RegistroPesca & { nomePescador: string }) | null;
}
