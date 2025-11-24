import axios from 'axios';
import type { ApiDniResponse } from './ordenes.types';

/**
 * Servicio para consultar datos de DNI desde API externa (PeruDevs)
 * API: https://api.perudevs.com
 */
export class DniApiService {
  private apiUrl: string;
  private apiKey: string;

  constructor() {
    // Configurar desde variables de entorno
    this.apiUrl = process.env.DNI_API_URL || 'https://api.perudevs.com/api/v1/dni/complete';
    this.apiKey = process.env.DNI_API_KEY || 'cGVydWRldnMucHJvZHVjdGlvbi5maXRjb2RlcnMuNjkxYTM5MjZiMzRiYmQ0MjA5ZmZlNzc3';
  }

  /**
   * Consultar datos de persona por DNI usando PeruDevs API
   */
  async consultarDni(dni: string): Promise<ApiDniResponse> {
    try {
      // Validar DNI
      if (!/^\d{8}$/.test(dni)) {
        return {
          success: false,
          message: 'DNI inválido. Debe contener 8 dígitos.',
        };
      }

      console.log(`🔍 Consultando DNI: ${dni} en PeruDevs API...`);

      // Hacer request a API de PeruDevs
      const response = await axios.get(this.apiUrl, {
        params: { 
          document: dni,
          key: this.apiKey
        },
        timeout: 15000, // 15 segundos
      });

      console.log('✅ Respuesta de PeruDevs:', response.data);

      // Procesar respuesta de PeruDevs
      // La API devuelve: { estado: bool, resultado: { nombres, apellido_paterno, apellido_materno, ... } }
      if (response.data && response.data.estado) {
        const data = response.data.resultado;
        
        return {
          success: true,
          data: {
            dni: dni,
            nombres: data.nombres || '',
            apellidoPaterno: data.apellido_paterno || '',
            apellidoMaterno: data.apellido_materno || '',
            fechaNacimiento: data.fecha_nacimiento || null,
          },
        };
      }

      return {
        success: false,
        message: response.data.mensaje || 'No se encontraron datos para el DNI proporcionado.',
      };

    } catch (error: any) {
      console.error('❌ Error al consultar API DNI:', error.message);

      // Si la API no está disponible, devolver datos mock para desarrollo
      if (process.env.NODE_ENV === 'development') {
        console.log('⚠️ Usando datos de prueba (desarrollo)');
        return this.getMockData(dni);
      }

      return {
        success: false,
        message: error.response?.data?.mensaje || 'Error al consultar DNI. Intente nuevamente.',
      };
    }
  }

  /**
   * Datos de prueba para desarrollo (cuando no hay API configurada)
   */
  private getMockData(dni: string): ApiDniResponse {
    // Generar datos aleatorios basados en el DNI
    const nombres = ['Juan Carlos', 'María Elena', 'Luis Alberto', 'Ana Patricia', 'Jorge Luis'];
    const apellidosP = ['García', 'Rodríguez', 'López', 'Martínez', 'Pérez'];
    const apellidosM = ['Silva', 'Torres', 'Flores', 'Castro', 'Ramos'];

    const index = parseInt(dni.substring(0, 1)) % 5;

    return {
      success: true,
      data: {
        dni: dni,
        nombres: nombres[index],
        apellidoPaterno: apellidosP[index],
        apellidoMaterno: apellidosM[index],
        fechaNacimiento: '1990-01-15',
      },
    };
  }
}

export const dniApiService = new DniApiService();
