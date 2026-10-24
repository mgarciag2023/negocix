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
  return /^(bares|bar|pubs?)$/.test(normalize(segment));
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