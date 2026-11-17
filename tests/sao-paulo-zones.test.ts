import { describe, expect, test } from 'bun:test';
import { getSaoPauloZone, isSaoPauloCity, matchesSaoPauloZone, validSaoPauloZone } from '../supabase/functions/_shared/sao-paulo-zones';

describe('São Paulo zone search', () => {
  test('offers zones only for São Paulo city, including SP abbreviation', () => {
    expect(isSaoPauloCity('São Paulo', 'SP')).toBe(true);
    expect(isSaoPauloCity('sp', 'SP')).toBe(true);
    expect(isSaoPauloCity('Campinas', 'SP')).toBe(false);
    expect(isSaoPauloCity('São Paulo', 'RS')).toBe(false);
  });
  test.each([['Santana', 'norte'], ['Santo Amaro', 'sul'], ['Itaquera', 'leste'], ['Pinheiros', 'oeste'], ['Sé', 'centro']])('maps %s to %s', (district, zone) => {
    expect(getSaoPauloZone(district)).toBe(zone);
  });
  test('supports accented and abbreviated neighborhood names without guessing unknown ones', () => {
    expect(getSaoPauloZone('JD. SAO LUIS')).toBe('sul');
    expect(getSaoPauloZone('VL. MARIA')).toBe('norte');
    expect(getSaoPauloZone('DESCONHECIDO')).toBe(null);
    expect(getSaoPauloZone('')).toBe(null);
  });
  test('does not include other cities or other zones', () => {
    expect(matchesSaoPauloZone({ cidade: 'SAO PAULO', estado: 'SP', bairro: 'Itaquera' }, 'leste')).toBe(true);
    expect(matchesSaoPauloZone({ cidade: 'SAO PAULO', estado: 'SP', bairro: 'Santana' }, 'leste')).toBe(false);
    expect(matchesSaoPauloZone({ cidade: 'Osasco', estado: 'SP', bairro: 'Itaquera' }, 'leste')).toBe(false);
    expect(validSaoPauloZone('leste')).toBe(true);
    expect(validSaoPauloZone('invalid')).toBe(false);
  });
});