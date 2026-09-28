import { and, eq } from 'drizzle-orm';
import { almacenLotes, almacenProductos } from '../../../db';
import { AlmacenError } from './almacen.errors';

export interface DatosLote {
  numero_lote?: string | null;
  marca?: string | null;
  fecha_vencimiento?: string | null;
  fecha_fabricacion?: string | null;
}

export async function resolverOCrearLote(
  tx: any,
  productoId: number,
  datos: DatosLote
): Promise<number> {
  const [prod] = await tx
    .select({
      id: almacenProductos.id,
      nombre: almacenProductos.nombre,
      controla_lote: almacenProductos.controla_lote,
      controla_vencimiento: almacenProductos.controla_vencimiento,
    })
    .from(almacenProductos)
    .where(eq(almacenProductos.id, productoId));

  if (!prod) {
    throw new AlmacenError(`El producto ID ${productoId} no existe`, 404);
  }

  const numLote = datos.numero_lote?.trim() || null;
  const fVenc = datos.fecha_vencimiento?.trim() || null;
  const marca = datos.marca?.trim() || null;
  const fFab = datos.fecha_fabricacion?.trim() || null;

  if (prod.controla_lote && !numLote) {
    throw new AlmacenError(
      `El producto "${prod.nombre}" exige indicar número de lote`,
      400,
      'LOTE_REQUERIDO'
    );
  }

  if (prod.controla_vencimiento && !fVenc) {
    throw new AlmacenError(
      `El producto "${prod.nombre}" exige indicar fecha de vencimiento`,
      400,
      'VENCIMIENTO_REQUERIDO'
    );
  }

  // Buscar si ya existe este lote para el producto
  if (numLote) {
    const existentes = await tx
      .select()
      .from(almacenLotes)
      .where(and(eq(almacenLotes.producto_id, productoId), eq(almacenLotes.numero_lote, numLote)));

    if (existentes.length > 0) {
      const mismo = existentes.find(
        (l: any) =>
          (l.fecha_vencimiento || null) === fVenc &&
          (l.marca || null) === marca
      );
      if (mismo) {
        return mismo.id;
      }
      // Si el mismo número de lote tiene otra fecha de vencimiento distinta, avisar conflicto
      const vencDistinto = existentes.find(
        (l: any) => (l.fecha_vencimiento || null) !== fVenc
      );
      if (vencDistinto) {
        throw new AlmacenError(
          `El lote "${numLote}" para "${prod.nombre}" ya existe con otra fecha de vencimiento (${vencDistinto.fecha_vencimiento})`,
          409,
          'CONFLICTO_LOTE'
        );
      }
    }
  } else {
    // Lote genérico (sin número de lote)
    const [generico] = await tx
      .select()
      .from(almacenLotes)
      .where(
        and(
          eq(almacenLotes.producto_id, productoId),
          datos.marca ? eq(almacenLotes.marca, marca!) : eq(almacenLotes.marca, ''),
          fVenc ? eq(almacenLotes.fecha_vencimiento, fVenc) : eq(almacenLotes.fecha_vencimiento, null as any)
        )
      );
    if (generico) {
      return generico.id;
    }
  }

  // Crear nuevo lote
  const [nuevo] = await tx
    .insert(almacenLotes)
    .values({
      producto_id: productoId,
      numero_lote: numLote,
      marca,
      fecha_vencimiento: fVenc,
      fecha_fabricacion: fFab,
    })
    .returning({ id: almacenLotes.id });

  return nuevo.id;
}
