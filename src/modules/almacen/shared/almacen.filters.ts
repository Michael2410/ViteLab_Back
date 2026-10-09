import { z } from 'zod';
import { inArray, eq, type SQL } from 'drizzle-orm';

/**
 * Zod helper para aceptar string individual, array de strings o string separado por comas
 */
export const zMultiString = () =>
  z.preprocess((val) => {
    if (val === undefined || val === null || val === '') return undefined;
    if (Array.isArray(val)) {
      const arr = val.map(String).map((s) => s.trim()).filter(Boolean);
      return arr.length > 0 ? arr : undefined;
    }
    if (typeof val === 'string') {
      const arr = val.split(',').map((s) => s.trim()).filter(Boolean);
      return arr.length > 0 ? arr : undefined;
    }
    const str = String(val).trim();
    return str ? [str] : undefined;
  }, z.array(z.string()).optional());

/**
 * Zod helper para aceptar número individual, array de números o string de números separados por comas
 */
export const zMultiNumber = () =>
  z.preprocess((val) => {
    if (val === undefined || val === null || val === '') return undefined;
    if (Array.isArray(val)) {
      const nums = val.map(Number).filter((n) => !isNaN(n));
      return nums.length > 0 ? nums : undefined;
    }
    if (typeof val === 'string') {
      const nums = val.split(',').map((s) => Number(s.trim())).filter((n) => !isNaN(n));
      return nums.length > 0 ? nums : undefined;
    }
    const num = Number(val);
    return !isNaN(num) ? [num] : undefined;
  }, z.array(z.number()).optional());

/**
 * Helper para construir condición Drizzle soportando 1 valor (eq) o múltiples (inArray)
 */
export function buildMultiFilter<T>(column: any, values?: T[]): SQL | undefined {
  if (!values || values.length === 0) return undefined;
  if (values.length === 1) return eq(column, values[0]);
  return inArray(column, values);
}
