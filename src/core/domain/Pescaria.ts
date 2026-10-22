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
  fim: string | null;
  tipo?: 'desafio' | 'clube';
  descricao?: string;
  capaTema?: 'azul' | 'lima' | 'rio';
  capaUrl?: string;
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
}

export interface MensagemGrupo {
  id: string;
  desafioId: string;
  pescadorId: string;
  nomePescador: string;
  texto: string;
  fotoUrl?: string;
  criadoEm: string;
}

export interface PaginaMensagens {
  mensagens: MensagemGrupo[];
  proximoCursor: string | null;
}

export interface DetalheDesafio extends Desafio {
  participantes: Participacao[];
  rankingPesoTotal: ItemRanking[];
  rankingMaiorPeixe: (ItemRanking & { maiorPeixeKg: number })[];
  melhorPeixe: (RegistroPesca & { nomePescador: string }) | null;
}
