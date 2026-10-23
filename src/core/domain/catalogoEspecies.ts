import type { Especie } from './Pescaria.js';
// Limite técnico de entrada, não um máximo biológico da espécie.
export const CATALOGO_ESPECIES: Especie[] = [
  ['tucunare', 'Tucunaré'], ['tilapia', 'Tilápia'], ['traira', 'Traíra'],
  ['dourado', 'Dourado'], ['pacu', 'Pacu'], ['tambaqui', 'Tambaqui'],
  ['pintado', 'Pintado'], ['pirarara', 'Pirarara'], ['robalo', 'Robalo'], ['corvina', 'Corvina'],
].map(([id, nome]) => ({ id: 'catalogo-' + id, nome, ativa: true, pesoMaxReferenciaKg: 1000, criadoEm: '2026-10-22T00:00:00.000Z' }));
