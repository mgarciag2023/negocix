// Shared by search and monitoring; includes the user-approved furniture scope.
export const seatingIndustryTerms = Array.from(new Set([
  'cadeira', 'cadeiras', 'poltrona', 'poltronas', 'cadeiraria', 'longarina', 'longarinas',
  'cadeiras tubulares', 'cadeiras ergonomicas', 'cadeiras ergonômicas',
  ...['fabrica', 'fábrica', 'industria', 'indústria', 'fabricante', 'fabricacao', 'fabricação', 'producao', 'produção']
    .flatMap(intent => ['cadeiras', 'poltronas', 'longarinas', 'moveis', 'móveis', 'estofados', 'sofas', 'sofás', 'mobiliario', 'mobiliário'].map(product => `${intent} de ${product}`)),
  'manufatura de moveis', 'manufatura de estofados',
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
  const product = /\b(cadeiras?|poltronas?|cadeiraria|longarinas?|moveis|movel|mobiliarios?|estofados?|sofas?)\b/.test(name);
  const manufacturing = /\b(industrias?|industrial|fabricas?|fabricantes?|fabricacao|manufatura|producao)\b/.test(name);
  return product && manufacturing;
}

export function hasValidSeatingPhone(phone: string | null | undefined): boolean {
  let digits = (phone || '').replace(/\D/g, '');
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) digits = digits.slice(2);
  const ddds = new Set(['11','12','13','14','15','16','17','18','19','21','22','24','27','28','31','32','33','34','35','37','38','41','42','43','44','45','46','47','48','49','51','53','54','55','61','62','63','64','65','66','67','68','69','71','73','74','75','77','79','81','82','83','84','85','86','87','88','89','91','92','93','94','95','96','97','98','99']);
  return ddds.has(digits.slice(0, 2)) && (/^\d{2}[2-5]\d{7}$/.test(digits) || /^\d{2}9\d{8}$/.test(digits));
}

export function passesSeatingIndustry(company: { _segment?: string; nome_fantasia?: string | null; razao_social?: string | null; telefone_1?: string | null; telefone_2?: string | null }): boolean {
  return !isSeatingIndustrySegment(company._segment || '') || (matchesSeatingIndustryName(company) &&
    (hasValidSeatingPhone(company.telefone_1) || hasValidSeatingPhone(company.telefone_2)));
}