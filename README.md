# ViteLab Backend - Sistema de Laboratorio Clínico (LIMS)

API REST desarrollada con Node.js, Express y TypeScript para la gestión integral de laboratorios clínicos. Incluye módulos de órdenes de atención, ingreso y aprobación de resultados, catálogo de análisis, tarifarios, integración con WhatsApp (Baileys), inteligencia artificial (Google Gemini) y control de accesos granular basado en roles y permisos.

---

## Tecnologías

- **Runtime:** Node.js 20+
- **Framework:** Express 5 + TypeScript
- **Base de Datos:** PostgreSQL
- **WebSockets:** Socket.io (tiempo real)
- **Autenticación:** JWT (Access + Refresh tokens) & bcrypt
- **Integraciones:** WhatsApp Web (Baileys), Google Gemini AI, PeruDevs (DNI)
- **Documentación:** Swagger / OpenAPI 3.0 (`/api-docs`)

---

## Variables de Entorno

Copia el archivo `.env.example` a `.env` y configura tus credenciales:

```bash
cp .env.example .env
```

---

## Métodos de Despliegue

### 1. Despliegue Local (Desarrollo / Producción)

#### Prerrequisitos:
- Node.js 20+ y npm instalados.
- Instancia de PostgreSQL activa con la base de datos `vitelab_db` creada y el script `database.sql` ejecutado.

#### Pasos:
```bash
# 1. Instalar dependencias
npm install

# 2. Iniciar en modo desarrollo (Hot Reload con ts-node-dev)
npm run dev

# 3. O compilar TypeScript y ejecutar en producción
npm run build
npm start
```
* **Acceso API:** `http://localhost:3000`
* **Documentación Swagger:** `http://localhost:3000/api-docs`
* **Healthcheck:** `http://localhost:3000/health`

---

### 2. Despliegue con Docker (Contenedor Individual)

El proyecto incluye un `Dockerfile` optimizado multi-stage (builder + deps + runner) con usuario no-root para seguridad.

#### Pasos:
```bash
# 1. Construir la imagen Docker
docker build -t vitelab-back .

# 2. Ejecutar el contenedor montando los volúmenes persistentes
docker run -d \
  --name vitelab-back \
  -p 3000:3000 \
  --env-file .env \
  -v $(pwd)/uploads:/app/uploads \
  -v $(pwd)/whatsapp_auth:/app/whatsapp_auth \
  --restart unless-stopped \
  vitelab-back
```
> **Nota:** Los volúmenes montados (`uploads` y `whatsapp_auth`) garantizan que las firmas médicas, logos institucionales y la sesión de WhatsApp Web persistan tras reiniciar el contenedor.

---

### 3. Despliegue con Docker Compose (Stack Completo)

Desde la raíz del repositorio general (`ViteLab`), el archivo `docker-compose.yml` orquesta de forma conjunta el Backend y el Frontend en una misma red:

```bash
# 1. Construir y levantar todos los contenedores en segundo plano
docker compose up -d --build

# 2. Consultar logs del backend en tiempo real
docker compose logs -f backend

# 3. Detener y remover contenedores
docker compose down
```

* **Backend API:** `http://localhost:3000`
* **Frontend Web:** `http://localhost:8080`
* **Red interna:** `vitelab-network` (los contenedores se comunican entre sí por nombre de servicio).

---

### 4. Despliegue en Entornos Gratuitos (Demo en la Nube: Render + Neon)

Para demostraciones públicas 24/7 sin costo y sin necesidad de mantener encendida tu máquina local:

#### A. Base de Datos en Neon.tech (PostgreSQL Serverless Gratuito):
1. Regístrate en [Neon.tech](https://neon.tech) y crea un proyecto llamado `vitelab-db`.
2. En la pestaña **SQL Editor** de Neon, ejecuta tu script `database.sql` o restaura tu backup:
   ```bash
   psql "TU_DATABASE_URL_DE_NEON" < database.sql
   ```
3. Copia tu cadena de conexión `DATABASE_URL` (que incluye `?sslmode=require`).

#### B. API Backend en Render.com (Web Service Gratuito):
1. Regístrate en [Render.com](https://render.com) y conecta tu repositorio `ViteLab_Back`.
2. Haz clic en **New + > Web Service** y selecciona el repositorio.
3. Parámetros de configuración:
   - **Environment / Runtime:** `Node`
   - **Branch:** `main` (o `Deploy_Vercel`)
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Plan:** `Free`
4. En la sección **Environment Variables**, define:
   - `DATABASE_URL` = *(Cadena de conexión de Neon)*
   - `NODE_ENV` = `production`
   - `JWT_ACCESS_SECRET` = `tu_secreto_access`
   - `JWT_REFRESH_SECRET` = `tu_secreto_refresh`
   - `CORS_ORIGIN` = `*` (o la URL de tu frontend en Vercel)
   - `GEMINI_API_KEY` = `tu_api_key_de_gemini`
   - `DNI_API_KEY` = `tu_api_key_perudevs`
5. Haz clic en **Deploy Web Service**.

> Render te otorgará una URL pública HTTPS directa (ejemplo: `https://vitelab-api.onrender.com`).
