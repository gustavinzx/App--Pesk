import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve, sep } from 'node:path';
import type { FotoStoragePort } from '../../core/business/ports/PescariaRepository.js';

const EXTENSAO_POR_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

export class LocalFotoStorage implements FotoStoragePort {
  constructor(
    private readonly diretorioFotos: string,
    private readonly urlBase: string
  ) {}

  async salvar(
    caminhoRelativo: string,
    base64: string,
    contentType: string
  ): Promise<{ url: string; path: string }> {
    const extensao = EXTENSAO_POR_MIME[contentType];
    if (!extensao) throw new Error('Formato de foto não suportado.');

    const caminhoSeguro = caminhoRelativo
      .split(/[\\/]+/)
      .filter((segmento) => segmento && segmento !== '.' && segmento !== '..')
      .map((segmento) => basename(segmento))
      .join(sep);
    const destino = resolve(this.diretorioFotos, caminhoSeguro);
    const raiz = resolve(this.diretorioFotos) + sep;
    if (!destino.startsWith(raiz)) {
      throw new Error('Caminho de foto inválido.');
    }

    const destinoComExtensao = `${destino}${extensao}`;
    const bytes = Buffer.from(base64, 'base64');
    const destinoFinal = destinoComExtensao.replace(
      /\.(jpg|png|webp)$/,
      `-${randomUUID()}.$1`
    );
    await mkdir(dirname(destinoFinal), { recursive: true });
    await writeFile(destinoFinal, bytes, { flag: 'wx' });

    const nomePublico = destinoFinal.slice(raiz.length).split(sep).join('/');
    return {
      url: `${this.urlBase.replace(/\/$/, '')}/${nomePublico
        .split('/')
        .map(encodeURIComponent)
        .join('/')}`,
      path: nomePublico,
    };
  }

  async excluir(caminho: string): Promise<void> {
    await rm(this.destinoSeguro(this.caminhoRelativo(caminho)), {
      force: true,
    });
  }

  async obter(
    caminho: string
  ): Promise<{ bytes: Uint8Array; contentType: string } | null> {
    const destino = this.destinoSeguro(this.caminhoRelativo(caminho));
    try {
      const bytes = await readFile(destino);
      const extensao = destino.slice(destino.lastIndexOf('.')).toLowerCase();
      const contentType = Object.entries(EXTENSAO_POR_MIME).find(
        ([, value]) => value === extensao
      )?.[0];
      return contentType ? { bytes, contentType } : null;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  }

  private caminhoRelativo(caminho: string): string {
    if (/^https?:\/\//i.test(caminho)) {
      const parsed = new URL(caminho);
      const base = new URL(this.urlBase);
      const basePath = base.pathname.replace(/\/$/, '');
      if (
        parsed.origin !== base.origin ||
        !parsed.pathname.startsWith(`${basePath}/`)
      ) {
        throw new Error('A URL não pertence ao armazenamento local de fotos.');
      }
      return decodeURIComponent(parsed.pathname.slice(basePath.length + 1));
    }
    return caminho.replace(/^\/+/, '');
  }

  private destinoSeguro(relativo: string): string {
    const caminhoSeguro = relativo
      .split(/[\\/]+/)
      .filter((segmento) => segmento && segmento !== '.' && segmento !== '..')
      .map((segmento) => basename(segmento))
      .join(sep);
    const raiz = resolve(this.diretorioFotos);
    const destino = resolve(raiz, caminhoSeguro);
    if (!destino.startsWith(`${raiz}${sep}`)) {
      throw new Error('Caminho de foto inválido.');
    }
    return destino;
  }
}
