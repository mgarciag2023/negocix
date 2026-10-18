import { describe, expect, test } from 'bun:test';
import { isSeatingIndustrySegment, matchesSeatingIndustryName, passesSeatingIndustry, seatingIndustryTerms } from './seating-industry';

describe('Indústrias de Cadeiras e Poltronas', () => {
  test('accepts a chair-only manufacturer', () => {
    expect(matchesSeatingIndustryName({ razao_social: 'INDUSTRIA DE CADEIRAS TUBOLAR LTDA' })).toBe(true);
  });
  test('accepts a poltrona-only manufacturer', () => {
    expect(matchesSeatingIndustryName({ razao_social: 'FÁBRICA DE POLTRONAS BARBOSA LTDA' })).toBe(true);
  });
  test('preserves industry and commerce across both business names', () => {
    expect(matchesSeatingIndustryName({ nome_fantasia: 'CADEIRAS DO AMAZONAS', razao_social: 'FEITOZA INDUSTRIA DE ARTIGOS DE METAL LTDA' })).toBe(true);
  });
  test('does not accept a retailer just for selling chairs', () => {
    expect(matchesSeatingIndustryName({ razao_social: 'LOJA DE CADEIRAS E POLTRONAS LTDA' })).toBe(false);
  });
  test('does not accept chair rental or repair without manufacturing evidence', () => {
    expect(matchesSeatingIndustryName({ razao_social: 'ALUGUEL E REFORMA DE CADEIRAS LTDA' })).toBe(false);
  });
  test('does not accept generic sofa or seat manufacturers', () => {
    expect(matchesSeatingIndustryName({ razao_social: 'FABRICA DE SOFAS E ASSENTOS LTDA' })).toBe(false);
  });
  test('accepts longarina production', () => {
    expect(matchesSeatingIndustryName({ razao_social: 'FABRICA DE LONGARINAS LTDA' })).toBe(true);
  });
  test('matches singular product names as whole words', () => {
    expect(matchesSeatingIndustryName({ razao_social: 'FABRICANTE DE POLTRONA LTDA' })).toBe(true);
    expect(matchesSeatingIndustryName({ razao_social: 'INDUSTRIA CADEIRANTE LTDA' })).toBe(false);
  });
  test('does not change other segments in multi-segment results', () => {
    expect(passesSeatingIndustry({ _segment: 'Pizzarias', razao_social: 'PIZZARIA CENTRAL' })).toBe(true);
    expect(passesSeatingIndustry({ _segment: 'Indústrias de Cadeiras e Poltronas', razao_social: 'LOJA DE CADEIRAS' })).toBe(false);
  });
  test('supports accented and unaccented labels', () => {
    expect(isSeatingIndustrySegment('Indústrias de Cadeiras e Poltronas')).toBe(true);
    expect(isSeatingIndustrySegment('industrias de cadeiras e poltronas')).toBe(true);
  });
  test('retrieves singular products and production vocabulary without generic seats', () => {
    expect(seatingIndustryTerms).toContain('cadeira');
    expect(seatingIndustryTerms).toContain('fabricação de poltronas');
    expect(seatingIndustryTerms).not.toContain('assentos');
    expect(seatingIndustryTerms).not.toContain('fabrica de sofas');
  });
});