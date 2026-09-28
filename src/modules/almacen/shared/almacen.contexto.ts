import type { Request, Response, NextFunction } from 'express';
import { eq } from 'drizzle-orm';
import { db, usuarios, usuariosSedes, rolesPermisos, permisos } from '../../../db';
import { AlmacenError } from './almacen.errors';

export interface ContextoAlmacen {
  userId: number;
  personalId: number | null;
  sedeIds: number[];
  todasLasSedes: boolean; // permiso almacen.stock.read_all
  permisos: Set<string>;
}

export const cargarContextoAlmacen = async (req: Request, res: Response, next: NextFunction) => {
  const { userId, rolId } = req.user!;
  const [filasUsuario, filasPermisos] = await Promise.all([
    db
      .select({ personalId: usuarios.personal_id, sedeId: usuariosSedes.sede_id })
      .from(usuarios)
      .leftJoin(usuariosSedes, eq(usuariosSedes.usuario_id, usuarios.id))
      .where(eq(usuarios.id, userId)),
    db
      .select({ codigo: permisos.codigo })
      .from(rolesPermisos)
      .innerJoin(permisos, eq(rolesPermisos.permiso_id, permisos.id))
      .where(eq(rolesPermisos.rol_id, rolId)),
  ]);
  const setPermisos = new Set(filasPermisos.map((p) => p.codigo));
  const ctx: ContextoAlmacen = {
    userId,
    personalId: filasUsuario[0]?.personalId ?? null,
    sedeIds: filasUsuario.map((f) => f.sedeId).filter((id): id is number => id !== null),
    todasLasSedes: setPermisos.has('almacen.stock.read_all'),
    permisos: setPermisos,
  };
  res.locals.almacen = ctx;
  next();
};

export const contexto = (res: Response): ContextoAlmacen => res.locals.almacen as ContextoAlmacen;

/** Escrituras: falla en cerrado. */
export const assertSedeAccess = (ctx: ContextoAlmacen, sedeId: number): void => {
  if (ctx.todasLasSedes || ctx.sedeIds.includes(sedeId)) return;
  throw new AlmacenError('No tiene acceso a la sede indicada', 403, 'SEDE_NO_PERMITIDA');
};

/** Listados: undefined = todas las sedes; [] = ninguna -> el service devuelve lista vacía sin consultar. */
export const sedesVisibles = (ctx: ContextoAlmacen): number[] | undefined =>
  ctx.todasLasSedes ? undefined : ctx.sedeIds;

export const exigirPersonal = (ctx: ContextoAlmacen): number => {
  if (ctx.personalId === null) {
    throw new AlmacenError('Su usuario no está vinculado a una ficha de personal', 403, 'SIN_PERSONAL');
  }
  return ctx.personalId;
};

export const tienePermiso = (ctx: ContextoAlmacen, codigo: string): boolean => ctx.permisos.has(codigo);
