// Helpers para aplicar overrides editáveis sobre o catálogo hardcoded.
import { categoryTerms } from "./category-terms.ts";

export function normalizeKey(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

export function baseTermsFor(label: string): string[] {
  const key = normalizeKey(label.split(",")[0]);
  if (categoryTerms[key]) return categoryTerms[key];
  const found = Object.keys(categoryTerms).find(k => k === key || k.includes(key) || key.includes(k));
  return found ? categoryTerms[found] : [key];
}

export interface OverrideRow {
  segment_key: string;
  added_terms: string[];
  removed_terms: string[];
}

export function mergeWithOverride(base: string[], ov?: OverrideRow | null): string[] {
  if (!ov) return base;
  const removed = new Set((ov.removed_terms || []).map(t => t.toLowerCase().trim()));
  const merged = new Set<string>();
  for (const t of base) if (!removed.has(t.toLowerCase().trim())) merged.add(t);
  for (const t of (ov.added_terms || [])) {
    const tn = t.trim();
    if (tn && !removed.has(tn.toLowerCase())) merged.add(tn);
  }
  return Array.from(merged);
}

// Pre-carrega TODOS os overrides em um Map para usar em loop sem N+1 queries.
export async function loadAllOverrides(admin: any): Promise<Map<string, OverrideRow>> {
  const map = new Map<string, OverrideRow>();
  try {
    const { data } = await admin.from("segment_overrides").select("segment_key, added_terms, removed_terms");
    for (const r of (data || [])) map.set(r.segment_key, r);
  } catch (_) { /* ignore */ }
  return map;
}

export function effectiveTermsFor(label: string, overrides: Map<string, OverrideRow>): string[] {
  const base = baseTermsFor(label);
  const key = normalizeKey(label.split(",")[0]);
  const ov = overrides.get(key);
  return mergeWithOverride(base, ov);
}
