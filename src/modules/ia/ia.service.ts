import { GoogleGenerativeAI } from '@google/generative-ai';
import pool from '../../config/database';

// Interfaz para los datos de la orden con resultados
interface ResultadoParaIA {
  componente_nombre: string;
  resultado_valor: string;
  unidad_medida: string | null;
  valores_referenciales: string[];
}

interface AnalisisParaIA {
  analisis_nombre: string;
  componentes: ResultadoParaIA[];
}

interface OrdenParaIA {
  id: number;
  numero_atencion: string;
  paciente_nombres: string;
  paciente_apellidos: string;
  paciente_genero: string;
  paciente_edad: number;
  analisis: AnalisisParaIA[];
}

class IAService {
  private genAI: GoogleGenerativeAI | null = null;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
    } else {
      console.warn('⚠️ GEMINI_API_KEY no configurada. La interpretación IA no estará disponible.');
    }
  }

  /**
   * Genera una interpretación de los resultados usando Gemini AI
   */
  async generarInterpretacion(ordenData: OrdenParaIA, reintentos = 3): Promise<string> {
    if (!this.genAI) {
      throw new Error('Servicio de IA no disponible. Configure GEMINI_API_KEY.');
    }

    // Lista de modelos de TEXTO disponibles en tu cuenta
    const modelos = [
      'gemini-2.5-flash-lite',
      'gemini-2.5-flash'
    ];

    let lastError: any = null;

    for (const modelName of modelos) {
      try {
        console.log(`🤖 Intentando con modelo: ${modelName}`);
        const model = this.genAI.getGenerativeModel({ model: modelName });

        // Formatear los resultados para el prompt
        const resultadosFormateados = this.formatearResultadosParaPrompt(ordenData);

        const prompt = `
Actúa como un sistema experto de laboratorio clínico.
Genera un párrafo de interpretación para el paciente basado en estos resultados de laboratorio:

DATOS DEL PACIENTE:
- Nombre: ${ordenData.paciente_nombres} ${ordenData.paciente_apellidos}
- Sexo: ${ordenData.paciente_genero === 'M' ? 'Masculino' : 'Femenino'}
- Edad: ${ordenData.paciente_edad} años

RESULTADOS DE LABORATORIO:
${resultadosFormateados}

INSTRUCCIONES PARA EL FORMATO DE IMPRESIÓN:
1. Escribe en tercera persona, tono profesional pero empático.
2. Comienza con "El paciente presenta..." o similar.
3. Si todos los resultados están dentro de los rangos normales, indica: "Los resultados del perfil analizado se encuentran dentro de los rangos fisiológicos esperados."
4. Si hay valores fuera de rango, menciónalos brevemente sin alarmar, sugiriendo consultar con su médico.
5. NO uses formato Markdown (negritas, títulos, asteriscos), solo texto plano limpio para imprimir en PDF.
6. NO incluyas recomendaciones médicas específicas ni diagnósticos.
7. Máximo 100 palabras.
8. Finaliza indicando que estos resultados deben ser evaluados por su médico tratante.
        `.trim();

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const texto = response.text();

        console.log(`✅ Interpretación generada exitosamente con ${modelName}`);
        // Limpiar cualquier formato Markdown que pueda haber quedado
        return this.limpiarTexto(texto);

      } catch (error: any) {
        console.error(`❌ Error con modelo ${modelName}:`, error?.message || error);
        lastError = error;
        
        // Si es error 404 (modelo no encontrado), probar el siguiente
        if (error?.status === 404) {
          continue;
        }
        
        // Si es error de cuota (429), esperar y reintentar
        if (error?.status === 429 && reintentos > 0) {
          console.log(`⏳ Cuota excedida. Reintentando en 60 segundos... (${reintentos} intentos restantes)`);
          await this.sleep(60000);
          return this.generarInterpretacion(ordenData, reintentos - 1);
        }
        
        // Para otros errores, probar siguiente modelo
        continue;
      }
    }
    
    // Si ningún modelo funcionó
    console.error('❌ Ningún modelo de Gemini disponible:', lastError);
    throw new Error('No se pudo generar la interpretación de resultados. Ningún modelo disponible.');
  }

  /**
   * Helper para esperar
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Formatea los resultados en texto legible para el prompt
   */
  private formatearResultadosParaPrompt(orden: OrdenParaIA): string {
    const lineas: string[] = [];

    for (const analisis of orden.analisis) {
      lineas.push(`\n[${analisis.analisis_nombre}]`);
      
      for (const comp of analisis.componentes) {
        const rangoStr = comp.valores_referenciales.length > 0 
          ? `(Rango: ${comp.valores_referenciales.join(', ')})` 
          : '';
        const unidad = comp.unidad_medida || '';
        lineas.push(`- ${comp.componente_nombre}: ${comp.resultado_valor} ${unidad} ${rangoStr}`);
      }
    }

    return lineas.join('\n');
  }

  /**
   * Limpia el texto de cualquier formato Markdown
   */
  private limpiarTexto(texto: string): string {
    return texto
      .replace(/\*\*/g, '')      // Remover negritas **
      .replace(/\*/g, '')        // Remover asteriscos *
      .replace(/#{1,6}\s/g, '')  // Remover headers #
      .replace(/`/g, '')         // Remover backticks
      .replace(/\n{3,}/g, '\n\n') // Máximo 2 saltos de línea
      .trim();
  }

  /**
   * Guarda la interpretación en la base de datos
   */
  async guardarInterpretacion(ordenId: number, interpretacion: string): Promise<void> {
    try {
      await pool.query(
        `UPDATE ordenes SET interpretacion_ia = $1, updated_at = NOW() WHERE id = $2`,
        [interpretacion, ordenId]
      );
      console.log(`✅ Interpretación IA guardada para orden ${ordenId}`);
    } catch (error) {
      console.error(`Error al guardar interpretación para orden ${ordenId}:`, error);
      throw error;
    }
  }

  /**
   * Proceso completo: genera y guarda la interpretación
   */
  async procesarInterpretacion(ordenData: OrdenParaIA): Promise<void> {
    try {
      console.log(`🤖 Generando interpretación IA para orden ${ordenData.id}...`);
      const interpretacion = await this.generarInterpretacion(ordenData);
      await this.guardarInterpretacion(ordenData.id, interpretacion);
    } catch (error) {
      console.error(`Error en procesarInterpretacion para orden ${ordenData.id}:`, error);
      // No lanzamos el error para que no afecte el flujo principal
    }
  }
}

export const iaService = new IAService();
export type { OrdenParaIA, AnalisisParaIA, ResultadoParaIA };
