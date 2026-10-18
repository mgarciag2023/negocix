// Shared by search and segment monitoring: candidates stay product-specific.
export const seatingIndustryTerms = Array.from(new Set([
  'cadeira', 'cadeiras', 'poltrona', 'poltronas', 'cadeiraria', 'longarina', 'longarinas',
  'cadeiras tubulares', 'cadeiras ergonomicas', 'cadeiras ergonômicas',
  ...['fabrica', 'fábrica', 'industria', 'indústria', 'fabricante', 'fabricacao', 'fabricação', 'producao', 'produção']
    .flatMap(intent => ['cadeiras', 'poltronas', 'longarinas'].map(product => `${intent} de ${product}`)),
]));

export function isSeatingIndustrySegment(segment: string): boolean {
  return normalize(segment) === 'industrias de cadeiras e poltronas';
}

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

// Do not infer production from a broad furniture CNAE or a product name alone.
export function matchesSeatingIndustryName(company: { nome_fantasia?: string | null; razao_social?: string | null }): boolean {
  const name = normalize(`${company.nome_fantasia || ''} ${company.razao_social || ''}`);
  const product = /\b(cadeiras?|poltronas?|cadeiraria|longarinas?)\b/.test(name);
  const manufacturing = /\b(industrias?|industrial|fabricas?|fabricantes?|fabricacao|manufatura|producao)\b/.test(name);
  return product && manufacturing;
}

export function passesSeatingIndustry(company: { _segment?: string; nome_fantasia?: string | null; razao_social?: string | null }): boolean {
  return !isSeatingIndustrySegment(company._segment || '') || matchesSeatingIndustryName(company);
}