export interface Usuario {
  id: string;
  nome: string;
  descricao?: string;
  fotoUrl?: string;
  email: string;
  criadoEm: string;
  atualizadoEm?: string;
}
