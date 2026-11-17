// District grouping: Prefeitura de São Paulo, Regiões/Subprefeituras/Distritos (2023).
// Known neighborhood aliases only: never infer a zone from the company name.
export const saoPauloZones = [
  { value: 'norte', label: 'Zona Norte' },
  { value: 'sul', label: 'Zona Sul' },
  { value: 'leste', label: 'Zona Leste' },
  { value: 'oeste', label: 'Zona Oeste' },
  { value: 'centro', label: 'Centro' },
] as const;
export type SaoPauloZone = typeof saoPauloZones[number]['value'];
export const normalizeLocation = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
export function isSaoPauloCity(city: string, state = '') {
  return ['SAO PAULO', 'SAOPAULO', 'SP'].includes(normalizeLocation(city)) && (!state || ['SP', 'SAO PAULO', 'ALL'].includes(normalizeLocation(state)));
}
const districts: Record<SaoPauloZone, string[]> = {
  centro: ['Bela Vista', 'Bom Retiro', 'Cambuci', 'Consolação', 'Liberdade', 'República', 'Santa Cecília', 'Sé', 'Centro', 'Centro Histórico'],
  norte: ['Cachoeirinha', 'Casa Verde', 'Limão', 'Brasilândia', 'Freguesia do Ó', 'Jaçanã', 'Tremembé', 'Anhanguera', 'Perus', 'Jaraguá', 'Pirituba', 'São Domingos', 'Mandaqui', 'Santana', 'Tucuruvi', 'Vila Guilherme', 'Vila Maria', 'Vila Medeiros', 'Vila Nova Cachoeirinha', 'Vila Nova Mazzei', 'Vila Mazzei', 'Lauzane Paulista', 'Imirim', 'Chora Menino', 'Parada Inglesa', 'Jardim São Paulo', 'Vila Gustavo', 'Jardim Brasil', 'Vila Sabrina', 'Vila Nivi', 'Vila Zatt', 'Jardim Pery', 'Jardim Peri'],
  leste: ['Aricanduva', 'Carrão', 'Vila Formosa', 'Cidade Tiradentes', 'Ermelino Matarazzo', 'Ponte Rasa', 'Guaianases', 'Lajeado', 'Itaim Paulista', 'Vila Curuçá', 'Cidade Líder', 'Itaquera', 'José Bonifácio', 'Parque do Carmo', 'Água Rasa', 'Belém', 'Brás', 'Mooca', 'Moóca', 'Pari', 'Tatuapé', 'Artur Alvim', 'Cangaíba', 'Penha', 'Vila Matilde', 'Iguatemi', 'São Mateus', 'São Rafael', 'Jardim Helena', 'São Miguel', 'São Miguel Paulista', 'Vila Jacuí', 'Sapopemba', 'São Lucas', 'Vila Prudente', 'Belenzinho', 'Vila Carrão', 'Penha de França', 'Vila Esperança', 'Vila Ré', 'Vila Dalila', 'Cidade Patriarca', 'Jardim Nordeste', 'Vila Azevedo', 'Vila Gomes Cardim', 'Vila Ema', 'Vila Alpina', 'Parque São Lucas', 'Jardim São Pedro', 'Jardim Iguatemi', 'Jardim Robru', 'Jardim Romano'],
  oeste: ['Butantã', 'Morumbi', 'Raposo Tavares', 'Rio Pequeno', 'Vila Sônia', 'Barra Funda', 'Jaguara', 'Jaguaré', 'Lapa', 'Perdizes', 'Vila Leopoldina', 'Alto de Pinheiros', 'Itaim Bibi', 'Jardim Paulista', 'Pinheiros', 'Vila Madalena', 'Vila Olímpia', 'Jardim Europa', 'Jardim América', 'Jardim Paulistano', 'Sumaré', 'Sumarezinho', 'Pompeia', 'Pompéia', 'Vila Romana', 'Alto da Lapa', 'Vila Ipojuca', 'Vila Hamburguesa', 'Vila Beatriz', 'Vila Pompéia', 'Vila Pompeia', 'Vila Butantã', 'Vila Indiana', 'Instituto de Previdência', 'Jardim Bonfiglioli'],
  sul: ['Campo Limpo', 'Capão Redondo', 'Vila Andrade', 'Cidade Dutra', 'Grajaú', 'Socorro', 'Cidade Ademar', 'Pedreira', 'Cursino', 'Ipiranga', 'Sacomã', 'Jabaquara', 'Jardim Ângela', 'Jardim São Luís', 'Marsilac', 'Parelheiros', 'Campo Belo', 'Campo Grande', 'Santo Amaro', 'Moema', 'Saúde', 'Vila Mariana', 'Brooklin', 'Brooklin Paulista', 'Brooklin Novo', 'Chácara Santo Antônio', 'Vila Clementino', 'Mirandópolis', 'Planalto Paulista', 'Indianópolis', 'Vila Nova Conceição', 'Vila Mascote', 'Vila Santa Catarina', 'Vila Guarani', 'Jardim Marajoara', 'Interlagos', 'Jardim Aeroporto', 'Jardim Prudência', 'Jardim Miriam', 'Jardim M' + "'" + 'Boi Mirim', 'Vila das Belezas', 'Jardim Ibirapuera', 'Jardim São Luiz'],
};
const neighborhoodZones = new Map<string, SaoPauloZone>();
for (const zone of saoPauloZones) {
  for (const district of districts[zone.value]) neighborhoodZones.set(normalizeLocation(district), zone.value);
}
export function getSaoPauloZone(neighborhood: string | null | undefined): SaoPauloZone | null {
  const name = normalizeLocation(neighborhood || '').replace(/^JD\.?\s+/, 'JARDIM ').replace(/^VL\.?\s+/, 'VILA ').replace(/^PQ\.?\s+/, 'PARQUE ');
  return neighborhoodZones.get(name) || null;
}
export function validSaoPauloZone(value: unknown): value is SaoPauloZone {
  return saoPauloZones.some(zone => zone.value === value);
}
export function matchesSaoPauloZone(company: { cidade?: string | null; estado?: string | null; bairro?: string | null }, zone: SaoPauloZone) {
  return isSaoPauloCity(company.cidade || '', company.estado || '') && getSaoPauloZone(company.bairro) === zone;
}