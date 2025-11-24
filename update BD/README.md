# Actualización Base de Datos - ViteLab

## 📋 Cambio: Relación Análisis-Componentes

### 🎯 Objetivo
Cambiar el modelo de datos para que:
- Los **componentes** sean entidades independientes (sin `analisis_id`)
- Los **análisis** tengan un array `componentes_ids` con los IDs de componentes asociados
- Permitir que un componente pueda ser usado por múltiples análisis

### 📂 Archivos

1. **001_cambio_relacion_analisis_componentes.sql**
   - Script principal de migración
   - ⚠️ EJECUTAR ESTE PRIMERO

2. **queries_utiles_analisis_componentes.sql**
   - Queries de referencia para trabajar con el nuevo modelo
   - No ejecutar, solo consultar

3. **ROLLBACK_001_cambio_relacion_analisis_componentes.sql**
   - Script para revertir los cambios
   - Solo usar en caso de problemas

### 🚀 Instrucciones de Ejecución

#### Opción 1: PostgreSQL CLI (psql)
```bash
psql -U postgres -d vitelab_db -f "001_cambio_relacion_analisis_componentes.sql"
```

#### Opción 2: pgAdmin o DBeaver
1. Abrir el archivo `001_cambio_relacion_analisis_componentes.sql`
2. Copiar todo el contenido
3. Ejecutar en una ventana de query
4. Verificar que el output muestre "COMMIT"

#### Opción 3: VS Code con extensión PostgreSQL
1. Conectarse a la base de datos
2. Abrir el archivo SQL
3. Ejecutar (Ctrl+Shift+E o botón "Run Query")

### ✅ Verificación Post-Migración

Ejecuta esta query para verificar:

```sql
-- Verificar que la columna componentes_ids existe
SELECT 
    column_name, 
    data_type, 
    column_default
FROM information_schema.columns
WHERE table_name = 'analisis' 
  AND column_name = 'componentes_ids';

-- Verificar análisis con componentes
SELECT 
    a.id,
    a.nombre,
    a.componentes_ids,
    array_length(a.componentes_ids, 1) as total_componentes
FROM analisis a
WHERE a.componentes_ids IS NOT NULL
LIMIT 10;
```

### 📊 Antes vs Después

#### ANTES:
```
analisis (id, nombre, descripcion, ...)
    ↓ (1:N)
componentes (id, analisis_id, nombre, ...)
```

#### DESPUÉS:
```
analisis (id, nombre, descripcion, componentes_ids[], ...)
    
componentes (id, nombre, ...) [sin analisis_id]
```

### 🔄 Cambios en el Backend

Después de ejecutar el SQL, actualizar:

1. **analisis.types.ts**
   ```typescript
   interface Analisis {
     componentes_ids: number[];
   }
   ```

2. **analisis.service.ts**
   - Cambiar queries para usar `componentes_ids`
   - Ejemplo: `WHERE c.id = ANY($1)` con `componentes_ids`

3. **componentes.types.ts**
   - Eliminar `analisis_id` de la interfaz

### ⚠️ Importante

- ✅ El script hace MIGRACIÓN de datos automática
- ✅ Los datos existentes se preservan
- ✅ La columna `analisis_id` se deja nullable (puedes eliminarla después)
- ⚠️ Hacer BACKUP antes de ejecutar
- ⚠️ Probar primero en ambiente de desarrollo

### 🆘 En caso de problemas

Si algo sale mal:
1. Ejecutar `ROLLBACK_001_cambio_relacion_analisis_componentes.sql`
2. Restaurar desde backup
3. Revisar logs de error

### 📞 Soporte

Para dudas sobre las queries, consultar:
- `queries_utiles_analisis_componentes.sql`
- Documentación PostgreSQL: https://www.postgresql.org/docs/current/arrays.html
