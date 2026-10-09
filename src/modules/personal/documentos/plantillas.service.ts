import { eq, desc, and, sql } from 'drizzle-orm';
import { db, personalPlantillasDocumentos, configuracionSistema } from '../../../db';
import type { PlantillaDocumento, CrearPlantillaDTO, ActualizarPlantillaDTO } from './plantillas.types';

export class PlantillasService {
  async getAll(): Promise<PlantillaDocumento[]> {
    const rows = await db
      .select()
      .from(personalPlantillasDocumentos)
      .orderBy(desc(personalPlantillasDocumentos.id));

    return rows as any;
  }

  async getById(id: number): Promise<PlantillaDocumento | null> {
    const [row] = await db
      .select()
      .from(personalPlantillasDocumentos)
      .where(eq(personalPlantillasDocumentos.id, id));

    return (row as any) || null;
  }

  async getByTipo(tipo: string): Promise<PlantillaDocumento | null> {
    const [row] = await db
      .select()
      .from(personalPlantillasDocumentos)
      .where(
        and(
          eq(personalPlantillasDocumentos.tipo_documento, tipo),
          eq(personalPlantillasDocumentos.activo, true)
        )
      );

    return (row as any) || null;
  }

  async create(data: CrearPlantillaDTO): Promise<PlantillaDocumento> {
    const [inserted] = await db
      .insert(personalPlantillasDocumentos)
      .values({
        tipo_documento: data.tipo_documento.trim().toUpperCase(),
        nombre: data.nombre.trim(),
        titulo_documento: data.titulo_documento.trim().toUpperCase(),
        cuerpo_template: data.cuerpo_template.trim(),
        parrafo_cierre: data.parrafo_cierre?.trim() || null,
        ciudad_defecto: data.ciudad_defecto?.trim() || 'LIMA',
        mostrar_logo: data.mostrar_logo !== undefined ? data.mostrar_logo : true,
        firmante_nombre: data.firmante_nombre?.trim() || null,
        firmante_cargo: data.firmante_cargo?.trim() || null,
        firmante_firma_url: data.firmante_firma_url || null,
        activo: data.activo !== undefined ? data.activo : true,
      })
      .returning();

    return inserted as any;
  }

  async update(id: number, data: ActualizarPlantillaDTO): Promise<PlantillaDocumento | null> {
    const updatePayload: Record<string, any> = {
      updated_at: sql`CURRENT_TIMESTAMP`,
    };

    if (data.nombre !== undefined) updatePayload.nombre = data.nombre.trim();
    if (data.titulo_documento !== undefined) updatePayload.titulo_documento = data.titulo_documento.trim().toUpperCase();
    if (data.cuerpo_template !== undefined) updatePayload.cuerpo_template = data.cuerpo_template.trim();
    if (data.parrafo_cierre !== undefined) updatePayload.parrafo_cierre = data.parrafo_cierre?.trim() || null;
    if (data.ciudad_defecto !== undefined) updatePayload.ciudad_defecto = data.ciudad_defecto?.trim() || 'LIMA';
    if (data.mostrar_logo !== undefined) updatePayload.mostrar_logo = data.mostrar_logo;
    if (data.firmante_nombre !== undefined) updatePayload.firmante_nombre = data.firmante_nombre?.trim() || null;
    if (data.firmante_cargo !== undefined) updatePayload.firmante_cargo = data.firmante_cargo?.trim() || null;
    if (data.firmante_firma_url !== undefined) updatePayload.firmante_firma_url = data.firmante_firma_url || null;
    if (data.activo !== undefined) updatePayload.activo = data.activo;

    const [updated] = await db
      .update(personalPlantillasDocumentos)
      .set(updatePayload)
      .where(eq(personalPlantillasDocumentos.id, id))
      .returning();

    return (updated as any) || null;
  }

  async delete(id: number): Promise<boolean> {
    const rows = await db
      .delete(personalPlantillasDocumentos)
      .where(eq(personalPlantillasDocumentos.id, id))
      .returning({ id: personalPlantillasDocumentos.id });

    return rows.length > 0;
  }

  /**
   * Reemplaza variables en un texto plantilla {variable} o {{variable}}
   */
  interpolarVariables(texto: string, variables: Record<string, string>): string {
    if (!texto) return '';
    let resultado = texto;
    for (const [clave, valor] of Object.entries(variables)) {
      const regex1 = new RegExp(`\\{${clave}\\}`, 'gi');
      const regex2 = new RegExp(`\\{\\{${clave}\\}\\}`, 'gi');
      resultado = resultado.replace(regex1, valor || '').replace(regex2, valor || '');
    }
    return resultado;
  }
}

export const plantillasService = new PlantillasService();
