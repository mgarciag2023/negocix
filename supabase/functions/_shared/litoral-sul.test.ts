import { describe, expect, test } from 'bun:test';
import { resolveLitoralSul } from './litoral-sul';

describe('Litoral Sul SC', () => {
  test('covers exactly the five requested municipalities', () => {
    expect(resolveLitoralSul('Litoral Sul', 'SC')).toEqual({
      state: 'SC',
      cities: ['BALNEARIO RINCAO', 'JAGUARUNA', 'LAGUNA', 'IMBITUBA', 'GAROPABA'],
    });
  });
  test('includes all Imbituba and Garopaba beaches through the full municipality', () => {
    const region = resolveLitoralSul('  litoral   sul ', 'SC');
    expect(region?.cities).toContain('IMBITUBA');
    expect(region?.cities).toContain('GAROPABA');
    expect(region).not.toHaveProperty('neighborhood');
  });
  test('does not override another state or ordinary city', () => {
    expect(resolveLitoralSul('Litoral Sul', 'RS')).toBeNull();
    expect(resolveLitoralSul('Litoral Sul', null)).toBeNull();
    expect(resolveLitoralSul('Laguna', 'SC')).toBeNull();
  });
});