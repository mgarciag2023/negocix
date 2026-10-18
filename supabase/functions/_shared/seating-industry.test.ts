import { describe, expect, test } from 'bun:test';
import { hasValidSeatingPhone, isSeatingIndustrySegment, matchesSeatingIndustryName, passesSeatingIndustry, seatingIndustryTerms } from './seating-industry';

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
  test('includes sofa manufacturers in the approved upholstery scope', () => {
    expect(matchesSeatingIndustryName({ razao_social: 'FABRICA DE SOFAS E ASSENTOS LTDA' })).toBe(true);
  });
  test('includes furniture manufacturing without an explicit chair product', () => {
    expect(matchesSeatingIndustryName({ razao_social: 'INDÚSTRIA E COMÉRCIO DE MÓVEIS LTDA' })).toBe(true);
  });
  test('includes upholstery manufacturing across both names', () => {
    expect(matchesSeatingIndustryName({ nome_fantasia: 'ESTOFADOS CENTRAL', razao_social: 'CENTRAL FABRICACAO LTDA' })).toBe(true);
  });
  test('includes furniture named mobiliario', () => {
    expect(matchesSeatingIndustryName({ razao_social: 'FABRICA DE MOBILIARIO LTDA' })).toBe(true);
  });
  test('rejects furniture stores without manufacturing evidence', () => {
    expect(matchesSeatingIndustryName({ razao_social: 'LOJA E REVENDA DE MOVEIS E ESTOFADOS LTDA' })).toBe(false);
  });
  test('rejects upholstery repair without manufacturing evidence', () => {
    expect(matchesSeatingIndustryName({ razao_social: 'REFORMA E CONSERTO DE SOFAS LTDA' })).toBe(false);
  });
  test('still rejects generic seat manufacturing without an approved product', () => {
    expect(matchesSeatingIndustryName({ razao_social: 'FABRICA DE ASSENTOS LTDA' })).toBe(false);
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
  test('rejects incomplete numbers and nonexistent area codes', () => {
    expect(hasValidSeatingPhone('999999999')).toBe(false);
    expect(hasValidSeatingPhone('(00) 3333-4444')).toBe(false);
    expect(hasValidSeatingPhone('(11) 3333-4444')).toBe(true);
    expect(hasValidSeatingPhone('+55 11 99999-8888')).toBe(true);
  });
  test('allows a valid second phone but rejects manufacturers without usable phones', () => {
    const company = { _segment: 'Indústrias de Cadeiras e Poltronas', razao_social: 'FABRICA DE CADEIRAS LTDA', telefone_1: '999999999' };
    expect(passesSeatingIndustry(company)).toBe(false);
    expect(passesSeatingIndustry({ ...company, telefone_2: '(11) 3333-4444' })).toBe(true);
  });
  test('retrieves singular products and production vocabulary without generic seats', () => {
    expect(seatingIndustryTerms).toContain('cadeira');
    expect(seatingIndustryTerms).toContain('fabricação de poltronas');
    expect(seatingIndustryTerms).not.toContain('assentos');
    expect(seatingIndustryTerms).toContain('fabrica de sofas');
    expect(seatingIndustryTerms).toContain('industria de móveis');
    expect(seatingIndustryTerms).toContain('fabricacao de estofados');
  });
});