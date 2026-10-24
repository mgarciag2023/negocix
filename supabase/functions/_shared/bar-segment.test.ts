import { describe, expect, test } from 'bun:test';
import { barSearchTerms, isBarSegment, matchesBarName, passesBarSegment, deduplicateBars } from './bar-segment.ts';

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
  const venue = { _segment: 'Bares', nome_fantasia: 'Bar Executivo Bandidas', endereco: 'Rua Antonio Da Silva Fernandes, 1227', cidade: 'Laguna', estado: 'SC', telefone_1: '48984217578' };
  test('merges the same bar at the same address despite different phones', () => expect(deduplicateBars([venue, { ...venue, telefone_1: '48991274077' }])).toHaveLength(1));
  test('merges matching phone and address despite different legal names', () => expect(deduplicateBars([venue, { ...venue, nome_fantasia: 'Outra Razao Bar' }])).toHaveLength(1));
  test('preserves matching names in different cities', () => expect(deduplicateBars([venue, { ...venue, cidade: 'Garopaba' }])).toHaveLength(2));
  test('shared phone at different addresses does not prove duplication', () => expect(deduplicateBars([venue, { ...venue, endereco: 'Rua Central, 20' }])).toHaveLength(2));
  for (const term of ['bar', 'pub', 'buteco', 'restobar', 'gastropub', 'brewpub', 'chope', 'petisqueria']) {
    test(`retrieves candidates for ${term}`, () => expect(barSearchTerms.includes(term)).toBe(true));
  }
});