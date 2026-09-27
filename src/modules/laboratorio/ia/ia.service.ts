import { GoogleGenerativeAI } from '@google/generative-ai';
import { eq, sql } from 'drizzle-orm';
import { db, ordenes } from '../../../db';

// Interfaz para los datos de la orden con resultados
interface ResultadoParaIA {
  componente_nombre: string;
  resultado_valor: string;
  unidad_medida: string | null;
  valores_referenciales: string[];
}

interface AnalisisParaIA {
  analisis_id?: number;
  analisis_nombre: string;
  componentes: ResultadoParaIA[];
}

interface OrdenParaIA {
  id?: number;
  orden_id?: number;
  numero_atencion?: string;
  paciente_nombres?: string;
  paciente_apellidos?: string;
  paciente_genero?: string;
  paciente_edad?: number;
  paciente?: {
    nombres: string;
    apellidos: string;
    edad: number;
    genero: string;
  };
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

    const modelos = [
      'gemini-2.5-flash-lite',
      'gemini-2.5-flash',
    ];

    let lastError: any = null;

    const pacienteNombre = ordenData.paciente
      ? `${ordenData.paciente.nombres} ${ordenData.paciente.apellidos}`
      : `${ordenData.paciente_nombres || ''} ${ordenData.paciente_apellidos || ''}`.trim();
    const pacienteGenero = ordenData.paciente
      ? ordenData.paciente.genero
      : ordenData.paciente_genero || 'M';
    const pacienteEdad = ordenData.paciente
      ? ordenData.paciente.edad
      : ordenData.paciente_edad || 30;

    for (const modelName of modelos) {
      try {
        console.log(`🤖 Intentando con modelo: ${modelName}`);
        const model = this.genAI.getGenerativeModel({ model: modelName });

        const resultadosFormateados = this.formatearResultadosParaPrompt(ordenData);

        const prompt = `
ROL:
Actúa como un Asistente de Reportes de Laboratorio. Tu única función es transformar datos numéricos en un resumen descriptivo textual. NO eres un médico y NO debes diagnosticar.

DATOS DEL PACIENTE:
- Nombre: ${pacienteNombre}
- Sexo: ${pacienteGenero === 'M' ? 'Masculino' : 'Femenino'}
- Edad: ${pacienteEdad} años

RESULTADOS DE LABORATORIO (Con indicación de estado):
${resultadosFormateados}

REGLAS ESTRICTAS DE SEGURIDAD (Critical Safety Rails):
1. PROHIBIDO DIAGNOSTICAR: Nunca uses palabras como "anemia", "diabetes", "infección", "insuficiencia", "hepatitis", "cáncer", "riesgo", "sugiere" o "indica".
2. LENGUAJE NEUTRO: Usa exclusivamente términos de posición: "superior al rango de referencia", "inferior al rango de referencia", "dentro de los parámetros esperados".
3. NO ALARMISTA: Evita adjetivos como "peligroso", "preocupante", "severo", "crítico". Usa "significativamente fuera de rango" si la desviación es grande.

INSTRUCCIONES DE FORMATO:
1. Escribe en un solo párrafo continuo.
2. Usa tercera persona (ej. "Se observa...", "El reporte muestra...").
3. Solo Texto Plano (Sin markdown, sin negritas, sin viñetas).
4. Máximo 80 palabras (Sé conciso).

LÓGICA DE GENERACIÓN:
- CASO A (Todo Normal): Si todos los valores están dentro del rango, escribe: "Los resultados de los análisis realizados se encuentran dentro de los intervalos de referencia biológica estándar para el sexo y edad del paciente."
- CASO B (Valores Fuera de Rango): Lista los parámetros fuera de rango agrupándolos (ej. "se observan valores por fuera del límite superior en [NombreExamen1] y [NombreExamen2], así como valores inferiores al rango en [NombreExamen3]").

CIERRE OBLIGATORIO:
Finaliza siempre con la frase exacta: "Estos resultados son datos técnicos que requieren la interpretación clínica integral de su médico tratante."
`.trim();

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const texto = response.text();

        console.log(`✅ Interpretación generada exitosamente con ${modelName}`);
        return this.limpiarTexto(texto);
      } catch (error: any) {
        console.error(`❌ Error con modelo ${modelName}:`, error?.message || error);
        lastError = error;

        if (error?.status === 404) {
          continue;
        }

        if (error?.status === 429 && reintentos > 0) {
          console.log(
            `⏳ Cuota excedida. Reintentando en 60 segundos... (${reintentos} intentos restantes)`
          );
          await this.sleep(60000);
          return this.generarInterpretacion(ordenData, reintentos - 1);
        }

        continue;
      }
    }

    console.error('❌ Ningún modelo de Gemini disponible:', lastError);
    throw new Error(
      'No se pudo generar la interpretación de resultados. Ningún modelo disponible.'
    );
  }

  async interpretarResultados(ordenData: any): Promise<string> {
    return this.generarInterpretacion(ordenData);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private formatearResultadosParaPrompt(orden: OrdenParaIA): string {
    const lineas: string[] = [];

    for (const analisis of orden.analisis) {
      lineas.push(`\n[${analisis.analisis_nombre}]`);

      for (const comp of analisis.componentes) {
        const rangoStr =
          comp.valores_referenciales && comp.valores_referenciales.length > 0
            ? `(Rango: ${comp.valores_referenciales.join(', ')})`
            : '';
        const unidad = comp.unidad_medida || '';
        lineas.push(`- ${comp.componente_nombre}: ${comp.resultado_valor} ${unidad} ${rangoStr}`);
      }
    }

    return lineas.join('\n');
  }

  private limpiarTexto(texto: string): string {
    return texto
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/#{1,6}\s/g, '')
      .replace(/`/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  async guardarInterpretacion(ordenId: number, interpretacion: string): Promise<void> {
    try {
      await db
        .update(ordenes)
        .set({
          interpretacion_ia: interpretacion,
          updated_at: sql`CURRENT_TIMESTAMP` as any,
        })
        .where(eq(ordenes.id, ordenId));
      console.log(`✅ Interpretación IA guardada para orden ${ordenId}`);
    } catch (error) {
      console.error(`Error al guardar interpretación para orden ${ordenId}:`, error);
      throw error;
    }
  }

  async procesarInterpretacion(ordenData: OrdenParaIA): Promise<void> {
    try {
      const targetId = ordenData.id || ordenData.orden_id;
      if (!targetId) return;
      console.log(`🤖 Generando interpretación IA para orden ${targetId}...`);
      const interpretacion = await this.generarInterpretacion(ordenData);
      await this.guardarInterpretacion(targetId, interpretacion);
    } catch (error) {
      console.error(
        `Error en procesarInterpretacion para orden ${ordenData.id || ordenData.orden_id}:`,
        error
      );
    }
  }

  async generarCondicionesPreanaliticas(
    data: PreanaliticaDatosInput,
    reintentos = 3
  ): Promise<string> {
    if (!this.genAI) {
      throw new Error('Servicio de IA no disponible. Configure GEMINI_API_KEY.');
    }

    const modelos = [
      'gemini-1.5-flash',
      'gemini-2.0-flash',
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite',
    ];

    const sexoTexto = data.paciente_genero === 'M' ? 'Masculino' : 'Femenino';
    const esPediatrico = data.paciente_edad < 12;
    const esLactante = data.paciente_edad <= 2;

    const prompt = `
ROL:
Actúa como un Especialista en Medicina de Laboratorio Clínico y Fase Pre-Analítica. Tu función es consolidar de forma clara, profesional y rigurosa las indicaciones preparatorias para el paciente antes de la toma de muestra.

DATOS DEL PACIENTE:
- Sexo: ${sexoTexto}
- Edad: ${data.paciente_edad} años ${esPediatrico ? '(Paciente Pediátrico)' : esLactante ? '(Lactante)' : ''}

EXÁMENES SOLICITADOS:
${data.analisis_nombres.map((a) => `- ${a}`).join('\n')}

REGLAS DE GENERACIÓN CLÍNICA:
1. ADAPTACIÓN POR EDAD:
   - Si el paciente es lactante (<=2 años) o pediátrico (<12 años), ajusta el ayuno según guías pediátricas (2-4 horas en lactantes, 4-6 horas en niños pequeños) para prevenir deshidratación e hipoglucemia.
   - Si es adulto, el ayuno estándar para glucosa/lípidos es de 8 a 12 horas (máximo 14 horas).
2. ADAPTACIÓN POR SEXO Y EXAMEN:
   - Para exámenes masculinos específicos (ej. PSA, Antígeno Prostático): incluir abstención sexual, andar en bicicleta o manipulación prostática por 48h antes.
   - Para muestras de orina femeninas: indicar aseo genital de adelante hacia atrás con agua y jabón neutro, y evitar recolección durante la menstruación a menos que el médico lo indique.
3. FORMATO Y ESTILO:
   - Organiza la respuesta en viñetas claras con emojis representativos (⏱️ Ayuno, 🧪 Muestra de Orina/Heces, 🍷 Dieta/Hábitos, 💊 Medicamentos, ⚠️ Indicaciones Especiales).
   - Usa un tono claro, empático y estructurado para entregar al paciente en recepción o ticket.
   - Sé conciso y directo (máximo 140 palabras).
`.trim();

    let lastError: any = null;

    for (const modelName of modelos) {
      try {
        console.log(`🤖 Generando condiciones pre-analíticas con modelo: ${modelName}`);
        const model = this.genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const texto = response.text();

        console.log(`✅ Condiciones pre-analíticas generadas con ${modelName}`);
        return this.limpiarTexto(texto);
      } catch (error: any) {
        console.error(
          `❌ Error al generar condiciones pre-analíticas con ${modelName}:`,
          error?.message || error
        );
        lastError = error;

        if (error?.status === 404) continue;

        if (error?.status === 429 && reintentos > 0) {
          console.log(
            `⏳ Cuota excedida. Reintentando en 60 segundos... (${reintentos} intentos restantes)`
          );
          await this.sleep(60000);
          return this.generarCondicionesPreanaliticas(data, reintentos - 1);
        }

        continue;
      }
    }

    console.error('❌ Ningún modelo de Gemini disponible para pre-analítica:', lastError);
    throw new Error(
      'No se pudo generar las condiciones pre-analíticas. Ningún modelo disponible.'
    );
  }

  async guardarCondicionesPreanaliticas(ordenId: number, condiciones: string): Promise<void> {
    try {
      await db
        .update(ordenes)
        .set({
          condiciones_preanaliticas: condiciones,
          updated_at: sql`CURRENT_TIMESTAMP` as any,
        })
        .where(eq(ordenes.id, ordenId));
      console.log(`✅ Condiciones pre-analíticas IA guardadas para orden ${ordenId}`);
    } catch (error) {
      console.error(`Error al guardar condiciones pre-analíticas para orden ${ordenId}:`, error);
      throw error;
    }
  }

  async procesarCondicionesPreanaliticas(
    ordenId: number,
    data: PreanaliticaDatosInput
  ): Promise<string> {
    try {
      console.log(`🤖 Generando condiciones pre-analíticas IA para orden ${ordenId}...`);
      const condiciones = await this.generarCondicionesPreanaliticas(data);
      await this.guardarCondicionesPreanaliticas(ordenId, condiciones);
      return condiciones;
    } catch (error) {
      console.error(
        `Error en procesarCondicionesPreanaliticas para orden ${ordenId}:`,
        error
      );
      return '';
    }
  }
}

export interface PreanaliticaDatosInput {
  paciente_genero: string;
  paciente_edad: number;
  analisis_nombres: string[];
}

export const iaService = new IAService();
export type { OrdenParaIA, AnalisisParaIA, ResultadoParaIA };
