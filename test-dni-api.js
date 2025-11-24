require('dotenv').config();
const axios = require('axios');

async function testDniApi() {
  const dni = '70904523';
  const apiUrl = process.env.DNI_API_URL || 'https://api.perudevs.com/api/v1/dni/complete';
  const apiKey = process.env.DNI_API_KEY || 'cGVydWRldnMucHJvZHVjdGlvbi5maXRjb2RlcnMuNjkxYTM5MjZiMzRiYmQ0MjA5ZmZlNzc3';

  console.log('🔍 Probando API de PeruDevs...\n');
  console.log('URL:', apiUrl);
  console.log('DNI:', dni);
  console.log('Key:', apiKey.substring(0, 20) + '...\n');

  try {
    const response = await axios.get(apiUrl, {
      params: { 
        document: dni,
        key: apiKey
      },
      timeout: 15000,
    });

    console.log('✅ Respuesta exitosa:\n');
    console.log(JSON.stringify(response.data, null, 2));

    if (response.data && response.data.estado) {
      const data = response.data.resultado;
      console.log('\n📋 Datos extraídos:');
      console.log('- Nombres:', data.nombre);
      console.log('- Apellido Paterno:', data.apellido_paterno);
      console.log('- Apellido Materno:', data.apellido_materno);
      console.log('- Fecha Nacimiento:', data.fecha_nacimiento || 'No disponible');
      console.log('- DNI:', dni);
    }

  } catch (error) {
    console.error('❌ Error al consultar API:', error.message);
    if (error.response) {
      console.error('Respuesta del servidor:', error.response.data);
    }
  }
}

testDniApi();
