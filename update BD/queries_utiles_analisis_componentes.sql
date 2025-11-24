-- =====================================================
-- QUERIES ÚTILES - Análisis con Componentes (Nuevo Modelo)
-- =====================================================

-- 1. OBTENER ANÁLISIS CON SUS COMPONENTES
-- =====================================================
SELECT 
    a.id,
    a.nombre,
    a.descripcion,
    a.sinonimia,
    a.activo,
    a.componentes_ids,
    COALESCE(
        json_agg(
            json_build_object(
                'id', c.id,
                'nombre', c.nombre,
                'valor_referencial', c.valor_referencial,
                'unidad_medida', c.unidad_medida,
                'area', json_build_object('id', ar.id, 'nombre', ar.nombre),
                'metodo', json_build_object('id', m.id, 'nombre', m.nombre),
                'orden', c.orden,
                'activo', c.activo
            ) ORDER BY 
                array_position(a.componentes_ids, c.id), -- Mantener orden del array
                c.nombre
        ) FILTER (WHERE c.id IS NOT NULL),
        '[]'::json
    ) as componentes
FROM analisis a
LEFT JOIN LATERAL unnest(a.componentes_ids) WITH ORDINALITY AS comp_id ON true
LEFT JOIN componentes c ON c.id = comp_id AND c.activo = true
LEFT JOIN areas ar ON c.area_id = ar.id
LEFT JOIN metodos m ON c.metodo_id = m.id
WHERE a.id = $1  -- Reemplazar con el ID del análisis
GROUP BY a.id;


-- 2. OBTENER TODOS LOS ANÁLISIS (Lista)
-- =====================================================
SELECT 
    a.id,
    a.nombre,
    a.descripcion,
    a.sinonimia,
    a.activo,
    a.created_at,
    a.updated_at,
    COALESCE(array_length(a.componentes_ids, 1), 0) as total_componentes
FROM analisis a
ORDER BY a.nombre ASC;


-- 3. AGREGAR COMPONENTE A UN ANÁLISIS
-- =====================================================
-- Agregar un componente al final
UPDATE analisis 
SET componentes_ids = array_append(componentes_ids, <COMPONENTE_ID>)
WHERE id = <ANALISIS_ID>;

-- Agregar múltiples componentes
UPDATE analisis 
SET componentes_ids = componentes_ids || ARRAY[<ID1>, <ID2>, <ID3>]
WHERE id = <ANALISIS_ID>;


-- 4. ELIMINAR COMPONENTE DE UN ANÁLISIS
-- =====================================================
UPDATE analisis 
SET componentes_ids = array_remove(componentes_ids, <COMPONENTE_ID>)
WHERE id = <ANALISIS_ID>;


-- 5. REEMPLAZAR TODOS LOS COMPONENTES DE UN ANÁLISIS
-- =====================================================
UPDATE analisis 
SET componentes_ids = ARRAY[<ID1>, <ID2>, <ID3>]
WHERE id = <ANALISIS_ID>;


-- 6. VERIFICAR QUÉ ANÁLISIS USAN UN COMPONENTE
-- =====================================================
SELECT 
    a.id,
    a.nombre,
    a.componentes_ids
FROM analisis a
WHERE <COMPONENTE_ID> = ANY(a.componentes_ids);


-- 7. BUSCAR COMPONENTES QUE NO ESTÁN ASIGNADOS A NINGÚN ANÁLISIS
-- =====================================================
SELECT c.*
FROM componentes c
WHERE NOT EXISTS (
    SELECT 1 FROM analisis a 
    WHERE c.id = ANY(a.componentes_ids)
)
AND c.activo = true;


-- 8. CREAR ANÁLISIS CON COMPONENTES
-- =====================================================
WITH nuevo_analisis AS (
    INSERT INTO analisis (nombre, descripcion, sinonimia, componentes_ids)
    VALUES (
        'Hemograma Completo',
        'Análisis de sangre completo',
        ARRAY['Hemograma', 'CBC', 'Conteo Sanguíneo'],
        ARRAY[1, 2, 3, 4]  -- IDs de componentes existentes
    )
    RETURNING *
)
SELECT * FROM nuevo_analisis;


-- 9. ACTUALIZAR ANÁLISIS Y SUS COMPONENTES
-- =====================================================
UPDATE analisis
SET 
    nombre = 'Nuevo Nombre',
    descripcion = 'Nueva descripción',
    componentes_ids = ARRAY[5, 6, 7],  -- Nuevos componentes
    updated_at = CURRENT_TIMESTAMP
WHERE id = <ANALISIS_ID>
RETURNING *;


-- 10. OBTENER ESTADÍSTICAS
-- =====================================================
SELECT 
    COUNT(DISTINCT a.id) as total_analisis,
    COUNT(DISTINCT comp_id) as total_componentes_usados,
    AVG(array_length(a.componentes_ids, 1)) as promedio_componentes_por_analisis,
    MAX(array_length(a.componentes_ids, 1)) as max_componentes_en_analisis
FROM analisis a
LEFT JOIN LATERAL unnest(a.componentes_ids) AS comp_id ON true;


-- 11. COMPONENTES MÁS USADOS
-- =====================================================
SELECT 
    c.id,
    c.nombre,
    COUNT(a.id) as veces_usado,
    array_agg(a.nombre ORDER BY a.nombre) as usado_en_analisis
FROM componentes c
LEFT JOIN analisis a ON c.id = ANY(a.componentes_ids)
WHERE c.activo = true
GROUP BY c.id, c.nombre
ORDER BY veces_usado DESC
LIMIT 20;


-- 12. REORDENAR COMPONENTES EN UN ANÁLISIS
-- =====================================================
-- Cambiar el orden moviendo un componente a una posición específica
UPDATE analisis
SET componentes_ids = (
    SELECT array_agg(id ORDER BY new_order)
    FROM (
        SELECT 
            id,
            CASE 
                WHEN id = <COMPONENTE_ID> THEN <NUEVA_POSICION>
                WHEN position_array >= <NUEVA_POSICION> AND id != <COMPONENTE_ID> 
                    THEN position_array + 1
                ELSE position_array
            END as new_order
        FROM unnest(componentes_ids) WITH ORDINALITY AS t(id, position_array)
    ) reordered
)
WHERE id = <ANALISIS_ID>;
