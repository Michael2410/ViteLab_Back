# 🧪 ViteLab Backend - Sistema de Laboratorio Clínico (LIMS)

API REST para el sistema de gestión de laboratorio clínico ViteLab.

## 🚀 Tecnologías

- **Node.js** + **Express** + **TypeScript**
- **PostgreSQL** (base de datos)
- **Zod** (validación de schemas)
- **JWT** (autenticación con access + refresh tokens)
- **bcrypt** (hash de contraseñas)
- **Swagger/OpenAPI** (documentación)
- **Nodemailer** (envío de emails)

## 📁 Estructura del Proyecto

```
src/
├── config/
│   └── database.ts          # Configuración de PostgreSQL
├── middleware/
│   └── auth.middleware.ts   # Middlewares de autenticación
├── modules/
│   └── auth/                # Módulo de autenticación
│       ├── auth.controller.ts
│       ├── auth.service.ts
│       ├── auth.routes.ts
│       ├── auth.schema.ts
│       └── auth.types.ts
├── types/
│   └── api.types.ts         # Tipos globales
├── utils/
│   └── response.utils.ts    # Helpers de respuesta
├── app.ts                   # Configuración de Express
└── server.ts                # Punto de entrada
```

## 🔧 Instalación

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar PostgreSQL

Ejecutar el archivo `database.sql` en PostgreSQL:

```bash
psql -U postgres -d postgres -f database.sql
```

Esto creará:
- ✅ Base de datos `vitelab_db`
- ✅ Todas las tablas con relaciones
- ✅ Datos iniciales (roles, permisos, usuario admin)

### 3. Configurar variables de entorno

Copia `.env.example` a `.env` y configura tus credenciales:

```bash
cp .env.example .env
```

Edita `.env`:
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=vitelab_db
DB_USER=postgres
DB_PASSWORD=tu_password
```

### 4. Iniciar servidor en desarrollo

```bash
npm run dev
```

El servidor se ejecutará en: http://localhost:3000

## 📚 Documentación API (Swagger)

Una vez iniciado el servidor, accede a:

**http://localhost:3000/api-docs**

## 🔐 Autenticación

### Usuario por defecto

Al ejecutar `database.sql`, se crea un usuario administrador:

- **Usuario**: `admin`
- **Contraseña**: `admin123`
- **Rol**: `SUPER_ADMIN`

### Flujo de autenticación

1. **Login**: `POST /api/auth/login`
   - Retorna `accessToken` (15 min) y `refreshToken` (7 días)

2. **Proteger rutas**: Agregar header:
   ```
   Authorization: Bearer {accessToken}
   ```

3. **Renovar token**: `POST /api/auth/refresh`
   - Enviar `refreshToken` para obtener nuevos tokens

4. **Logout**: `POST /api/auth/logout`

## 🛣️ Rutas Disponibles

### Auth & Users

| Método | Ruta | Descripción | Autenticación |
|--------|------|-------------|---------------|
| POST | `/api/auth/login` | Login | ❌ |
| POST | `/api/auth/refresh` | Renovar token | ❌ |
| POST | `/api/auth/logout` | Logout | ✅ |
| GET | `/api/auth/me` | Obtener usuario actual con permisos | ✅ |
| GET | `/api/auth/users` | Listar usuarios | ✅ |
| GET | `/api/auth/users/:id` | Obtener usuario por ID | ✅ |
| POST | `/api/auth/users` | Crear usuario | ✅ |
| PUT | `/api/auth/users/:id` | Actualizar usuario | ✅ |
| DELETE | `/api/auth/users/:id` | Eliminar usuario | ✅ |

## 🔒 Sistema de Permisos

El sistema implementa permisos granulares por módulo/submodulo/acción.

Ejemplo:
```typescript
// Requiere permiso específico
router.get('/users', 
  authenticateToken, 
  requirePermissions(['auth.users.read']), 
  controller.getAllUsers
);
```

### Permisos disponibles

- `auth.users.*` - Gestión de usuarios
- `auth.roles.*` - Gestión de roles
- `orders.*` - Gestión de órdenes
- `results.*` - Gestión de resultados
- `catalogs.*` - Gestión de catálogos
- `tariffs.*` - Gestión de tarifarios
- `settings.*` - Configuración del sistema

## 📦 Scripts NPM

```bash
npm run dev      # Iniciar en modo desarrollo (hot reload)
npm run build    # Compilar TypeScript a JavaScript
npm start        # Iniciar servidor en producción
```

## 🗄️ Base de Datos

### Tablas principales

- `usuarios`, `roles`, `permisos`, `roles_permisos`
- `pacientes`, `ordenes`, `orden_analisis`, `resultados`
- `analisis`, `componentes`
- `tarifarios`, `tarifario_precios`, `convenios`
- `sedes`, `tipos_cliente`, `areas`, `metodos`
- `configuracion_sistema`

### Estados de Orden

1. **REGISTRADA** - Orden creada
2. **CON_RESULTADOS** - Resultados ingresados
3. **APROBADA** - Resultados aprobados (puede generar PDF)

## 🧪 Testing

```bash
# Próximamente
npm test
```

## 📝 Próximos Módulos

- ✅ Auth (Completado)
- ⏳ Orders (Órdenes de atención)
- ⏳ Results (Ingreso y aprobación de resultados)
- ⏳ Catalogs (Análisis, componentes, áreas, métodos, convenios)
- ⏳ Tariffs (Tarifarios y precios)
- ⏳ Settings (Configuración general del sistema)

## 👨‍💻 Desarrollo

Desarrollado con ❤️ para ViteLab
