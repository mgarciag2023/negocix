import { describe, expect, test } from 'bun:test';
import { barSearchTerms, isBarSegment, matchesBarName, passesBarSegment } from './bar-segment.ts';

describe('bar name qualification', () => {
  for (const name of ['Bar Wilson', 'Bar Martins', 'Ventura Pub', '444 Restobar', 'Lola Restobar', 'Pier 71 – Gastropub', 'Buteco da Praia', 'Brewpub Rosa', 'Petisqueria Ferrugem', 'Choperia Central', 'Bar e Mercearia Silva']) {
    test(`accepts explicit venue: ${name}`, () => expect(matchesBarName({ nome_fantasia: name })).toBe(true));
  }
  for (const name of ['Beauty Lounge By Sara Melo', 'Bella Lounge', 'Mercado Esquina Maffei', 'Associação de Bares', 'Adega Central', 'Cervejaria Central', 'Distribuidora de Chope Bar Sul', 'Nail Bar', 'Sushi Bar', 'Juice Bar', 'Barbearia Wilson', 'Barbara Comercio', 'Publicidade Sul']) {
    test(`rejects unrelated or ambiguous name: ${name}`, () => expect(matchesBarName({ nome_fantasia: name })).toBe(false));
  }
  test('legal name can establish relevance', () => expect(matchesBarName({ nome_fantasia: 'Wilson', razao_social: 'Wilson Bar e Restaurante LTDA' })).toBe(true));
  test('CNAE candidate cannot bypass bar qualification', () => expect(passesBarSegment({ _segment: 'Bares', nome_fantasia: 'Mercado Esquina' })).toBe(false));
  test('other segments remain unchanged', () => expect(passesBarSegment({ _segment: 'Salões de Beleza', nome_fantasia: 'Nail Bar' })).toBe(true));
  test('segment comparison is exact', () => { expect(isBarSegment(' Bares ')).toBe(true); expect(isBarSegment('Sushi Bars')).toBe(false); });
  for (const term of ['bar', 'pub', 'buteco', 'restobar', 'gastropub', 'brewpub', 'chope', 'petisqueria']) {
    test(`retrieves candidates for ${term}`, () => expect(barSearchTerms.includes(term)).toBe(true));
  }
});