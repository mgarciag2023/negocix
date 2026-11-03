import { describe, expect, test } from 'bun:test';
import { AUTOMATIC_QUERY_INTERVAL_MS, cachedAutomaticQuery } from '../src/lib/automatic-query-cache';

const storage = () => {
  const entries = new Map<string, string>();
  return { getItem: (key: string) => entries.get(key) ?? null, setItem: (key: string, value: string) => { entries.set(key, value); } };
};
describe('automatic queries', () => {
  test('refreshes only at the three-day boundary, not before it', async () => {
    expect(AUTOMATIC_QUERY_INTERVAL_MS).toBe(259200000);
    const store = storage(); let calls = 0; let time = 1000;
    const fetcher = async () => ++calls;
    await cachedAutomaticQuery(store, 'owner', 'metrics', fetcher, false, () => time);
    time += 259200000 - 1;
    expect((await cachedAutomaticQuery(store, 'owner', 'metrics', fetcher, false, () => time)).data).toBe(1);
    expect(calls).toBe(1);
    time += 1;
    expect((await cachedAutomaticQuery(store, 'owner', 'metrics', fetcher, false, () => time)).data).toBe(2);
  });
  test('manual refresh bypasses the automatic interval', async () => {
    const store = storage(); let calls = 0;
    const fetcher = async () => ++calls;
    await cachedAutomaticQuery(store, 'owner', 'metrics', fetcher);
    await cachedAutomaticQuery(store, 'owner', 'metrics', fetcher, true);
    expect(calls).toBe(2);
  });
  test('never shares cached data between accounts', async () => {
    const store = storage();
    await cachedAutomaticQuery(store, 'a', 'metrics', async () => 'a');
    expect((await cachedAutomaticQuery(store, 'b', 'metrics', async () => 'b')).data).toBe('b');
  });
  test('deduplicates concurrent automatic calls', async () => {
    const store = storage(); let calls = 0;
    await Promise.all([1, 2].map(() => cachedAutomaticQuery(store, 'owner', 'metrics', async () => ++calls)));
    expect(calls).toBe(1);
  });
  test('failed fetch does not start a three-day cooldown', async () => {
    const store = storage();
    await expect(cachedAutomaticQuery(store, 'owner', 'metrics', async () => { throw new Error('offline'); })).rejects.toThrow('offline');
    expect((await cachedAutomaticQuery(store, 'owner', 'metrics', async () => 'recovered')).data).toBe('recovered');
  });
});