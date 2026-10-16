import { randomBytes, randomUUID } from 'node:crypto';

const CARACTERES_CODIGO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function gerarId(): string {
  return randomUUID();
}

export function gerarCodigoConvite(): string {
  const bytes = randomBytes(6);
  return Array.from(
    bytes,
    (byte) => CARACTERES_CODIGO[byte % CARACTERES_CODIGO.length]
  ).join('');
}
