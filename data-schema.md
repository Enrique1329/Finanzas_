# Arquitectura de Datos — Paso 1

## Estructura en LocalStorage

Se usarán 2 claves principales en LocalStorage:

### 1. `gastos_app_transacciones`
```json
[
  {
    "id": "txn_1719500000000",
    "tipo": "gasto",
    "monto": 25.50,
    "categoriaId": "cat_comida",
    "fecha": "2026-06-28",
    "nota": "Almuerzo con cliente",
    "creadoEn": "2026-06-28T14:32:00.000Z"
  },
  {
    "id": "txn_1719500050000",
    "tipo": "ingreso",
    "monto": 500.00,
    "categoriaId": "cat_salario",
    "fecha": "2026-06-25",
    "nota": "Pago quincenal",
    "creadoEn": "2026-06-25T09:00:00.000Z"
  }
]
```

**Campos:**
| Campo | Tipo | Validación |
|---|---|---|
| `id` | string | Generado automáticamente (timestamp + random) |
| `tipo` | "gasto" \| "ingreso" | Requerido |
| `monto` | number | Requerido, > 0 (no se permiten negativos ni cero) |
| `categoriaId` | string | Requerido, debe existir en categorías |
| `fecha` | string (ISO date) | Requerido, no puede ser vacío |
| `nota` | string | Opcional, máx 100 caracteres |
| `creadoEn` | string (ISO datetime) | Generado automáticamente |

### 2. `gastos_app_categorias`
```json
[
  { "id": "cat_comida", "nombre": "Comida", "color": "#F59E0B", "icono": "🍔" },
  { "id": "cat_transporte", "nombre": "Transporte", "color": "#3B82F6", "icono": "🚗" },
  { "id": "cat_salario", "nombre": "Salario", "color": "#10A37F", "icono": "💼" },
  { "id": "cat_entretenimiento", "nombre": "Entretenimiento", "color": "#8B5CF6", "icono": "🎮" },
  { "id": "cat_otros", "nombre": "Otros", "color": "#6B7280", "icono": "📦" }
]
```

Estas categorías iniciales se cargan por defecto la primera vez que se abre la app (si LocalStorage está vacío). El usuario podrá agregar/editar/eliminar categorías en el Paso correspondiente.

## Reglas de negocio clave
- **Saldo total** = suma de todos los `ingreso.monto` − suma de todos los `gasto.monto`.
- **Validación de formulario:** monto debe ser numérico y `> 0`; fecha y categoría no pueden estar vacías.
- **Eliminación de categoría:** si tiene transacciones asociadas, se reasignan a `cat_otros` (evita perder historial).
