// Candidate retrieval is broader than qualification: ambiguous beverage names
// may retrieve candidates, but never establish bar relevance on their own.
export const barSearchTerms = [
  'bar', 'bares', 'pub', 'pubs', 'boteco', 'buteco', 'botequim', 'butiquim',
  'restobar', 'gastrobar', 'gastro bar', 'gastropub', 'brewpub',
  'choperia', 'chopperia', 'choparia', 'chope', 'chopp',
  'petisqueria', 'petisqueira', 'petiscaria', 'drinkeria', 'whiskeria',
  'taberna', 'tasca', 'beerhouse', 'beer house', 'wine bar', 'beer bar',
  'bar e restaurante', 'bar e lanchonete', 'bar e mercearia',
  'cervejaria', 'lounge', 'adega',
];

const normalize = (value: string) => value.normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export function isBarSegment(segment: string): boolean {
  return /^(bares|bar)$/.test(normalize(segment));
}

type BarCompany = {
  _segment?: string;
  nome_fantasia?: string | null;
  razao_social?: string | null;
};

export function matchesBarName(company: BarCompany): boolean {
  const name = normalize(`${company.nome_fantasia || ''} ${company.razao_social || ''}`);
  // An association, supplier or beauty/food "bar" is not a drinking venue.
  if (/\b(associacao|sindicato|federacao|instituto|distribuidor\w*|atacad\w*|fabricacao|fabricante\w*)\b/.test(name)) return false;
  if (/\b(beauty|beleza|salao|estetica|barbearia|cabeleireir\w*|nails?|unhas|cosmeticos?|sobrancelhas)\b/.test(name)) return false;
  if (/\b(sushi|sucos?|juice|smoothies?|acai|salad|saladas?|cereal|cereais|proteina|protein|chocolate)\s+bars?\b|\bbar\s+(?:de\s+)?(sucos?|sushi|saladas?|unhas|sobrancelhas)\b/.test(name)) return false;
  return /\b(bar|bares|pubs?|botecos?|butecos?|botequim|botequins|butiquim|butiquins|restobars?|gastrobars?|gastropubs?|brewpubs?|choperias?|chopperias?|choparias?|petisquerias?|petisqueiras?|petiscarias?|drinkerias?|whiskerias?|tabernas?|tascas?|beerhouses?)\b|\bgastro\s+bar\b|\bbeer\s+house\b/.test(name);
}

export function passesBarSegment(company: BarCompany): boolean {
  return !isBarSegment(company._segment || '') || matchesBarName(company);
}

// Merge only matching venue/location pairs, never shared names across cities
// or shared accountant phone numbers across different addresses.
export function deduplicateBars<T extends BarCompany & {
  endereco?: string | null; cidade?: string | null; estado?: string | null;
  telefone_1?: string | null; telefone_2?: string | null;
}>(companies: T[]): T[] {
  const names = new Set<string>();
  const phones = new Set<string>();
  return companies.filter(company => {
    if (!isBarSegment(company._segment || '')) return true;
    const address = normalize(company.endereco || '');
    const city = normalize(company.cidade || '');
    if (!address || !city) return true;
    const location = `${normalize(company.estado || '')}|${city}|${address}`;
    const name = normalize(company.nome_fantasia || company.razao_social || '');
    const nameKey = name ? `${location}|${name}` : '';
    const phoneKeys = [company.telefone_1, company.telefone_2]
      .map(phone => (phone || '').replace(/\D/g, ''))
      .filter(phone => phone.length >= 10)
      .map(phone => `${location}|${phone.slice(-10)}`);
    if ((nameKey && names.has(nameKey)) || phoneKeys.some(key => phones.has(key))) return false;
    if (nameKey) names.add(nameKey);
    phoneKeys.forEach(key => phones.add(key));
    return true;
  });
}