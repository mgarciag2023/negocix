/** Full municipalities: their beaches remain included without a neighborhood filter. */
export function resolveLitoralSul(city: string | null, state: string | null): { state: string; cities: string[] } | null {
  const normalized = (city || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toUpperCase();
  if (normalized !== 'LITORAL SUL' || state?.toUpperCase() !== 'SC') return null;
  return {
    state: 'SC',
    cities: ['BALNEARIO RINCAO', 'JAGUARUNA', 'LAGUNA', 'IMBITUBA', 'GAROPABA'],
  };
}