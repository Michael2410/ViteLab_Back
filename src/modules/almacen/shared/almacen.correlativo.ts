import { sql } from 'drizzle-orm';
import type { DB } from '../../../db';
import { almacenCorrelativos } from '../../../db';

export type TipoCorrelativo = 'ING' | 'DES' | 'CON' | 'DEV' | 'PED' | 'TRA' | 'AJU' | 'OC';

export async function obtenerSiguienteCorrelativo(
  tx: any,
  tipo: TipoCorrelativo,
  sedeId: number,
  fechaNegocio: string
): Promise<string> {
  // Extraer año de la fecha de negocio (YYYY-MM-DD)
  const anio = parseInt(fechaNegocio.slice(0, 4), 10) || new Date().getFullYear();

  // UPSERT atómico en correlativos
  const [row] = await tx
    .insert(almacenCorrelativos)
    .values({
      tipo,
      sede_id: sedeId,
      anio,
      ultimo: 1,
    })
    .onConflictDoUpdate({
      target: [almacenCorrelativos.tipo, almacenCorrelativos.sede_id, almacenCorrelativos.anio],
      set: {
        ultimo: sql`${almacenCorrelativos.ultimo} + 1`,
      },
    })
    .returning({ ultimo: almacenCorrelativos.ultimo });

  const sedeStr = String(sedeId).padStart(2, '0');
  const numStr = String(row.ultimo).padStart(6, '0');
  return `${tipo}-${sedeStr}-${anio}-${numStr}`;
}
