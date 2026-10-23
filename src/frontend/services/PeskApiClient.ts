import { getIdToken } from 'firebase/auth';
import { auth } from '../config/firebase';

const apiBaseUrl = (process.env.EXPO_PUBLIC_PESK_API_URL ?? '')
  .trim()
  .replace(/\/$/, '');

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface DesafioDto {
  id: string;
  nome: string;
  codigoConvite: string;
  inicio: string;
  fim: string | null;
  tipo?: 'desafio' | 'clube';
  descricao?: string;
  capaTema?: 'azul' | 'lima' | 'rio';
  capaUrl?: string;
  status: 'aberto' | 'ativo' | 'encerrado' | 'cancelado';
  donoId: string;
}

export interface EspecieDto {
  id: string;
  nome: string;
  pesoMaxReferenciaKg: number;
  ativa: boolean;
}

export interface ParticipacaoDto {
  id: string;
  pescadorId: string;
  nomePescador: string;
  entrouEm: string;
}

export interface RegistroDto {
  id: string;
  desafioId: string;
  pescadorId: string;
  especieId: string;
  nomeEspecie: string;
  pesoKg: number;
  local: string;
  dataHora: string;
  comprimentoCm?: number;
  fotoUrl: string;
  status: 'valido' | 'contestado' | 'anulado';
}

export interface DesafioDetalheDto extends DesafioDto {
  rankingMaiorPeixe?: { pescadorId: string; nomePescador: string; quantidadePeixes: number; pesoTotalKg: number; maiorPeixeKg: number }[];
  participantes: ParticipacaoDto[];
  ranking: {
    pescadorId: string;
    nomePescador: string;
    quantidadePeixes: number;
    pesoTotalKg: number;
    maiorPeixeKg: number | null;
    tempoAtePrimeiraCapturaMs: number | null;
  }[];
  rankingPesoTotal: {
    pescadorId: string;
    nomePescador: string;
    quantidadePeixes: number;
    pesoTotalKg: number;
    maiorPeixeKg?: number | null;
    tempoAtePrimeiraCapturaMs?: number | null;
  }[];
  melhorPeixe: (RegistroDto & { nomePescador: string }) | null;
}

export interface MensagemGrupoDto {
  id: string;
  desafioId: string;
  pescadorId: string;
  nomePescador: string;
  texto: string;
  fotoUrl?: string;
  criadoEm: string;
}

export interface PaginaMensagensDto { mensagens: MensagemGrupoDto[]; proximoCursor: string | null }

export interface PerfilDto { id: string; nome: string; descricao?: string; fotoUrl?: string }

export class PeskApiClient {
  async perfil(): Promise<PerfilDto> { return this.request('/api/usuarios/me'); }
  async salvarPerfil(dados: { nome: string; descricao: string; fotoBase64?: string; fotoMimeType?: string }): Promise<PerfilDto> { return this.request('/api/usuarios/me', { method: 'PATCH', body: JSON.stringify(dados) }); }
  async listarMensagens(id: string, antes?: string): Promise<PaginaMensagensDto> {
    return this.request(`/api/desafios/${encodeURIComponent(id)}/mensagens${antes ? '?antes=' + encodeURIComponent(antes) : ''}`);
  }
  async enviarMensagem(id: string, dados: { texto: string; fotoBase64?: string; fotoMimeType?: string }): Promise<MensagemGrupoDto> {
    return this.request(`/api/desafios/${encodeURIComponent(id)}/mensagens`, { method: 'POST', body: JSON.stringify(dados) });
  }
  async sairGrupo(id: string): Promise<void> {
    return this.request(`/api/desafios/${encodeURIComponent(id)}/participantes/me`, { method: 'DELETE' });
  }
  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    if (!apiBaseUrl) {
      throw new Error('Configure EXPO_PUBLIC_PESK_API_URL no .env da raiz.');
    }
    const user = auth.currentUser;
    if (!user) throw new Error('Faça login para acessar as competições.');
    const token = await getIdToken(user);
    let response: Response;
    try {
      response = await fetch(`${apiBaseUrl}${path}`, {
        ...options,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(options.body ? { 'Content-Type': 'application/json' } : {}),
          ...options.headers,
        },
      });
    } catch {
      throw new Error(
        `Não foi possível conectar a ${apiBaseUrl}. Verifique se o backend está ligado e se a URL do .env é acessível pelo dispositivo.`
      );
    }

    if (response.status === 204) return undefined as T;
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new ApiError(
        typeof body?.error === 'string'
          ? body.error
          : 'A API retornou um erro.',
        response.status
      );
    }
    return body as T;
  }

  async listarEspecies(): Promise<EspecieDto[]> {
    return this.request('/api/especies');
  }

  async atualizarDesafio(
    id: string,
    input: { nome: string; inicio: string; fim: string }
  ): Promise<DesafioDto> {
    return this.request(`/api/desafios/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  }

  async cancelarDesafio(id: string): Promise<void> {
    await this.request(`/api/desafios/${encodeURIComponent(id)}/cancelar`, {
      method: 'POST',
    });
  }

  async criarEspecie(input: {
    nome: string;
    pesoMaxReferenciaKg: number;
  }): Promise<EspecieDto> {
    return this.request('/api/especies', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async atualizarEspecie(
    id: string,
    input: { nome: string; pesoMaxReferenciaKg: number; ativa: boolean }
  ): Promise<EspecieDto> {
    return this.request(`/api/especies/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  }

  async listarDesafios(): Promise<DesafioDto[]> {
    return this.request('/api/desafios');
  }

  async criarDesafio(input: {
    nome: string;
    inicio: string;
    fim: string;
  }): Promise<DesafioDto> {
    return this.request('/api/desafios', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async criarGrupo(input: {
    nome: string;
    descricao: string;
    tipo: 'desafio' | 'clube';
    inicio: string;
    fim: string | null;
    capaTema: 'azul' | 'lima' | 'rio';
    capaBase64?: string;
    capaMimeType?: string;
    criteriosRanking: ['maior_peixe'];
  }): Promise<DesafioDto> {
    return this.request('/api/desafios', { method: 'POST', body: JSON.stringify(input) });
  }

  async entrarDesafio(codigoConvite: string): Promise<void> {
    await this.request('/api/desafios/entrar', {
      method: 'POST',
      body: JSON.stringify({ codigoConvite }),
    });
  }

  async detalheDesafio(id: string): Promise<DesafioDetalheDto> {
    return this.request(`/api/desafios/${encodeURIComponent(id)}`);
  }

  async criarRegistro(
    desafioId: string,
    input: {
      especieId: string;
      pesoKg: number;
      comprimentoCm?: number;
      local: string;
      dataHora: string;
      fotoBase64: string;
      fotoMimeType: string;
    }
  ): Promise<RegistroDto> {
    return this.request(
      `/api/desafios/${encodeURIComponent(desafioId)}/registros`,
      { method: 'POST', body: JSON.stringify(input) }
    );
  }

  async listarRegistros(desafioId: string): Promise<RegistroDto[]> {
    return this.request(
      `/api/desafios/${encodeURIComponent(desafioId)}/registros`
    );
  }

  async atualizarRegistro(
    id: string,
    input: {
      especieId: string;
      pesoKg: number;
      comprimentoCm?: number;
      local: string;
      dataHora: string;
    }
  ): Promise<RegistroDto> {
    return this.request(`/api/registros/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  }

  async excluirRegistro(id: string): Promise<void> {
    await this.request(`/api/registros/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  }
}
