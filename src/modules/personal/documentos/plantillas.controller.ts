import type { Request, Response } from 'express';
import { plantillasService } from './plantillas.service';

export class PlantillasController {
  async getAll(_req: Request, res: Response): Promise<void> {
    try {
      const plantillas = await plantillasService.getAll();
      res.json({
        success: true,
        data: plantillas,
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        message: err.message || 'Error al obtener plantillas de documentos',
      });
    }
  }

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ success: false, message: 'ID inválido' });
        return;
      }

      const plantilla = await plantillasService.getById(id);
      if (!plantilla) {
        res.status(404).json({ success: false, message: 'Plantilla no encontrada' });
        return;
      }

      res.json({
        success: true,
        data: plantilla,
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        message: err.message || 'Error al obtener plantilla',
      });
    }
  }

  async getByTipo(req: Request, res: Response): Promise<void> {
    try {
      const tipo = req.params.tipo;
      const plantilla = await plantillasService.getByTipo(tipo);
      if (!plantilla) {
        res.status(404).json({ success: false, message: `No hay plantilla activa para el tipo ${tipo}` });
        return;
      }

      res.json({
        success: true,
        data: plantilla,
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        message: err.message || 'Error al obtener plantilla por tipo',
      });
    }
  }

  async create(req: Request, res: Response): Promise<void> {
    try {
      const { tipo_documento, nombre, titulo_documento, cuerpo_template } = req.body;
      if (!tipo_documento || !nombre || !titulo_documento || !cuerpo_template) {
        res.status(400).json({
          success: false,
          message: 'Los campos tipo_documento, nombre, titulo_documento y cuerpo_template son obligatorios',
        });
        return;
      }

      const nueva = await plantillasService.create(req.body);
      res.status(201).json({
        success: true,
        message: 'Plantilla creada exitosamente',
        data: nueva,
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        message: err.message || 'Error al crear plantilla',
      });
    }
  }

  async update(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ success: false, message: 'ID inválido' });
        return;
      }

      const actualizada = await plantillasService.update(id, req.body);
      if (!actualizada) {
        res.status(404).json({ success: false, message: 'Plantilla no encontrada' });
        return;
      }

      res.json({
        success: true,
        message: 'Plantilla actualizada exitosamente',
        data: actualizada,
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        message: err.message || 'Error al actualizar plantilla',
      });
    }
  }

  async delete(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ success: false, message: 'ID inválido' });
        return;
      }

      const eliminada = await plantillasService.delete(id);
      if (!eliminada) {
        res.status(404).json({ success: false, message: 'Plantilla no encontrada' });
        return;
      }

      res.json({
        success: true,
        message: 'Plantilla eliminada exitosamente',
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        message: err.message || 'Error al eliminar plantilla',
      });
    }
  }
}

export const plantillasController = new PlantillasController();
