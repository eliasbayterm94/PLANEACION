# Plan 2027 — Forest Coffee

Herramienta de planeación de campaña: cuántos contenedores salen de cada
origen, en qué mes, y contra qué meta anual por mercado.

## Arrancar

```bash
npm install
npm run dev
```

Funciona de inmediato contra `localStorage`, sin backend. Para compartir el plan
con el equipo:

1. Crear un proyecto en Supabase.
2. Correr `supabase/schema.sql` en el SQL editor.
3. Copiar `.env.example` a `.env` y llenar las dos variables.
4. Reiniciar `npm run dev`.

El indicador arriba a la derecha dice si estás en modo local o compartido.

## Cómo se captura

| Vista | Fila editable | Qué significa |
|---|---|---|
| Región | **Despacho** | contenedores que salen ese mes |
| Mercado | **Corte** | contenedores comprometidos contra ese corte |

Todo lo demás se calcula. El **Consolidado** compara origen contra destino y
marca el descuadre mes a mes.

## Modelo

```
cosecha → corte (+1) → despacho (+1) → entrega (+1)
muestras: un mes antes del corte
cortes: siempre el día 15
sin llegadas: Abr–Jul
```

Rwanda: un solo corte al cerrar cosecha, tránsito de 2 meses.
MENA y AU: un mes extra de tránsito.

Los offsets viven únicamente en `src/model.js`. Cambiarlos ahí recalcula todo.

## Desplegar

Netlify. `npm run build` → `dist/`. Configurar las variables de Supabase en el
entorno de Netlify.

Ver `CLAUDE.md` para el contexto completo y el backlog.
