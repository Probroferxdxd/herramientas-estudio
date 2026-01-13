# 📚 Documentación del Código - Flask App

## 📋 Tabla de Contenidos
1. [Estructura General](#estructura-general)
2. [Contexto (Context)](#contexto-context)
3. [Componentes](#componentes)
4. [Algoritmo de Repetición Espaciada](#algoritmo-de-repetición-espaciada)
5. [Flujo de Datos](#flujo-de-datos)

---

## Estructura General

```
RecallApp.jsx
├── Imports y configuración
├── EjerciciosContext (Contexto Global)
├── EjerciciosProvider (Proveedor de Contexto)
├── useEjercicios Hook (Acceso al contexto)
├── Componentes de UI
│   ├── Dashboard
│   ├── StatCard
│   ├── IngresarEjercicio
│   ├── ResolverEjercicio
│   ├── GestionarEjercicios
│   └── Navigation
├── App Principal
└── RenderVista (Enrutador)
```

---

## Contexto (Context)

### EjerciciosContext
- **Propósito**: Crear un contexto global para compartir estado entre componentes
- **Contenido**: Lista de ejercicios, vista actual, funciones de gestión

### EjerciciosProvider
**Responsabilidades principales:**

1. **Gestión de Estado**
   - `ejercicios[]` - Array con todos los ejercicios
   - `vistaActual` - String indicando qué vista mostrar

2. **Persistencia en LocalStorage**
   - Carga ejercicios al montar: `useEffect` con array vacío
   - Guarda cambios automáticamente: `useEffect` que observa `ejercicios`

3. **Funciones Principales**

#### `agregarEjercicio(nuevoEjercicio)`
- Añade nuevo ejercicio con ID único (timestamp)
- Inicializa propiedades requeridas
- Inicializa algoritmo SM-2 con valores por defecto
- Estructura del ejercicio:
```javascript
{
    id: string,
    curso: string,
    tema: string,
    enunciado: string,
    opciones: [{texto, imagen}, ...],
    respuestaCorrecta: string,
    fuente: string,
    dificultadPercibida: number,
    imagen: null/base64,
    historial: [], // Intentos del usuario
    algoritmo: {
        intervalo: number,
        facilidad: number,
        repeticiones: number,
        proximoRepaso: date,
        prioridad: number
    }
}
```

#### `registrarIntento(id, respuesta, confianza)`
- Registra cada intento del usuario
- Aplica algoritmo SM-2 para ajustar próximo repaso
- Guarda metadatos: respuesta, correcta, confianza, fecha
- Ajusta prioridad según errores recientes

#### `obtenerEjerciciosHoy()`
- Filtra ejercicios vencidos (proximoRepaso <= hoy)
- Ordena por prioridad descendente
- Retorna máximo 20 ejercicios
- Usada en Dashboard y ResolverEjercicio

#### `eliminarEjercicio(id)`
- Elimina un ejercicio de la lista
- Usado en la vista Gestionar

#### `actualizarEjercicio(id, datosActualizados)`
- Actualiza propiedades de un ejercicio
- Merge de datos: mantiene datos existentes + actualiza campos
- Usado en la vista Gestionar

### useEjercicios Hook
- Hook personalizado para acceder al contexto
- Simplifica uso: `const { ejercicios } = useEjercicios()`
- Disponible en cualquier componente dentro del Provider

---

## Componentes

### 1. Dashboard
**Propósito**: Mostrar estadísticas y resumen de ejercicios

**Contenido**:
- **Tarjetas de estadísticas** usando `StatCard`:
  - Total ejercicios
  - Pendientes hoy
  - Dominados (3+ aciertos consecutivos)
  - Tasa de acierto global (%)
- **Lista de ejercicios para hoy**: Primeros 5 con prioridad

**Funcionalidad**:
- Botón "Comenzar repaso" que lleva a ResolverEjercicio

---

### 2. StatCard
**Propósito**: Componente reutilizable para mostrar estadísticas

**Props**:
- `icon` - Componente de Lucide React
- `label` - Texto descriptivo
- `value` - Valor a mostrar
- `color` - Clase CSS para color (blue, orange, green, purple)

---

### 3. IngresarEjercicio
**Propósito**: Formulario para agregar nuevos ejercicios

**Campos del formulario**:
- Curso * (obligatorio)
- Tema * (obligatorio)
- Enunciado * (obligatorio, textarea)
- Tipo (opción múltiple)
- 5 Opciones (A-E) con texto e imagen opcional
- Respuesta correcta * (select A-E)
- Dificultad percibida (rango 1-5)
- Fuente (referencia del libro/página)
- Imagen del ejercicio (carga base64)

**Funcionalidad**:
- Validación de campos obligatorios
- Carga de imágenes (enunciado y opciones)
- Previsualización de imágenes
- Botones eliminar imagen

---

### 4. ResolverEjercicio
**Propósito**: Interfaz para resolver ejercicios del día

**Características**:
- Muestra ejercicio actual con contador (ej: 3/20)
- Imagen del enunciado si existe
- 5 botones para seleccionar opción
- Indicador de confianza (bajo/medio/alto)
- Botón "Verificar respuesta"
- Resultado con retroalimentación (correcto/incorrecto)
- Avance automático al siguiente

**Flujo**:
1. Selecciona respuesta → Elige confianza → Verifica
2. Ve resultado → Botón "Siguiente"
3. Se registra intento y ajusta algoritmo
4. Al terminar todos, vuelve a Dashboard

---

### 5. GestionarEjercicios
**Propósito**: Gestionar (editar/eliminar) ejercicios existentes

**Características**:
- **Filtro por curso**: Dropdown para filtrar
- **Contador**: Total de ejercicios filtrados
- **Tarjetas de ejercicio** mostrando:
  - Curso y tema
  - Enunciado (preview 80 caracteres)
  - Intentos realizados
  - Repeticiones (con badge especial si ≥3 "dominado")
  - Próximo repaso
  - Botones Editar y Eliminar

**Modo Edición**:
- Formulario para editar: Curso, Tema, Enunciado, Respuesta
- Botones: Guardar cambios / Cancelar
- Confirmación al eliminar

---

### 6. Navigation
**Propósito**: Navegación entre vistas

**Botones**:
- Dashboard (BarChart3 icon)
- Nuevo ejercicio (PlusCircle icon)
- Repasar (Brain icon)
- Gestionar (BookOpen icon)

**Styling**:
- Subrayado en azul para vista activa
- Cambio de color en hover
- Diseño responsive

---

### 7. App Principal
**Propósito**: Componente raíz que envuelve todo

**Estructura**:
- Header con títulos
- Navigation
- Main con RenderVista
- Todo envuelto en EjerciciosProvider

---

### 8. RenderVista
**Propósito**: Enrutador condicional de vistas

**Lógica**:
- Switch según `vistaActual`
- Renderiza componente correspondiente
- Default: Dashboard

---

## Algoritmo de Repetición Espaciada

### ¿Qué es?
Algoritmo SM-2 para optimizar memorización mediante intervalos de tiempo crecientes.

### Parámetros del Algoritmo

```javascript
algoritmo: {
    intervalo,      // Días hasta próximo repaso (1, 6, después multiplica)
    facilidad,      // Factor de dificultad (1.3 - 2.6+)
    repeticiones,   // Cuántas veces acertó seguidas
    proximoRepaso,  // Fecha del próximo repaso
    prioridad       // Urgencia 1-10 (5 normal, 10 crítica)
}
```

### Cálculo del Próximo Repaso

**Si responde BIEN + confianza ALTA**:
- `facilidad += 0.1` (aprender es más fácil)
- `repeticiones++` (suma acierto)

**Si responde MAL**:
- `facilidad = max(1.3, facilidad - 0.2)` (penaliza)
- `repeticiones = 0` (reinicia contador)

**Cálculo de intervalo**:
- Repetición 0: `intervalo = 1` (1 día)
- Repetición 1: `intervalo = 6` (6 días)
- Repetición 2+: `intervalo = intervalo × facilidad`

### Prioridad por Errores Recientes
- Si ha fallado ≥2 veces en últimos 3 intentos:
  - `prioridad = 10` (máxima)
  - `intervalo = min(intervalo, 2)` (fuerza revisión en 2 días)
- Sino: `prioridad = 5` (normal)

### Ejemplo Práctico
```
Día 1: Acierta con alta confianza
  - facilidad: 2.5 → 2.6
  - repeticiones: 0 → 1
  - intervalo: 1 → 6
  - Próximo: 6 días

Día 7: Acierta con alta confianza
  - facilidad: 2.6 → 2.7
  - repeticiones: 1 → 2
  - intervalo: 6 → 16 (6 × 2.7)
  - Próximo: 16 días

Día 8: Falla
  - facilidad: 2.7 → 2.5
  - repeticiones: 2 → 0
  - intervalo: 16 → 1
  - PRIORIDAD ALTA (próximos 3 intentos bajo observación)
```

---

## Flujo de Datos

### Agregar Ejercicio
```
Usuario → IngresarEjercicio → handleSubmit()
  ↓
agregarEjercicio(nuevoEjercicio)
  ↓
setEjercicios([...ejercicios, ejercicio_nuevo])
  ↓
useEffect detecta cambio → localStorage.setItem()
  ↓
Ejercicio guardado persistentemente
```

### Resolver Ejercicio
```
ResolverEjercicio → handleSiguiente()
  ↓
registrarIntento(id, respuesta, confianza)
  ↓
Aplica algoritmo SM-2 y actualiza parámetros
  ↓
setEjercicios() actualiza el ejercicio
  ↓
localStorage actualiza automáticamente
```

### Mostrar Ejercicios del Día
```
Dashboard/ResolverEjercicio → obtenerEjerciciosHoy()
  ↓
Filter: proximoRepaso <= hoy
  ↓
Sort: por prioridad descendente
  ↓
Slice: máximo 20 ejercicios
  ↓
Muestra en interfaz
```

### Editar Ejercicio
```
GestionarEjercicios → handleEditar(ejercicio)
  ↓
Abre formulario con datos actuales
  ↓
handleGuardarEdicion()
  ↓
actualizarEjercicio(id, datosActualizados)
  ↓
setEjercicios() con datos mergeados
  ↓
localStorage actualiza
```

---

## Almacenamiento

### LocalStorage
- **Clave**: `'flask-ejercicios'`
- **Formato**: JSON string
- **Contenido**: Array de todos los ejercicios

### Operaciones
- **Carga**: Al montar EjerciciosProvider
- **Guardado**: Cada vez que `ejercicios` cambia
- **Persistencia**: Entre sesiones del navegador

---

## Componentes de UI Utilizados

### De Lucide React (Icons)
- `PlusCircle` - Agregar
- `Brain` - Repasar
- `BarChart3` - Dashboard
- `BookOpen` - Gestionar
- `Calendar` - Fecha
- `TrendingUp` - Tasa

### Hooks de React
- `useState` - Manejo de estado local
- `useContext` - Acceso a contexto
- `useEffect` - Efectos secundarios
- `createContext` - Crear contexto

---

## Estilos CSS

Todos los estilos están en `src/styles/RecallApp.css`:
- `.dashboard-container` - Contenedor del dashboard
- `.stat-card` - Tarjetas de estadísticas
- `.form-*` - Elementos de formulario
- `.resolver-container` - Interfaz de resolución
- `.ejercicio-gestion-*` - Elementos de gestión
- `.opciones-list` - Lista de opciones
- `.btn-*` - Botones varios

---

## Notas Importantes

1. **ID Único**: Usa `Date.now().toString()` - simple pero puede colisionar en casos raros
2. **Imágenes**: Se guardan como base64 en localStorage (aumenta tamaño)
3. **Máximo 20 ejercicios/día**: Evita sobrecarga
4. **Algoritmo SM-2**: Adaptado del original para ser más reactivo
5. **Responsive**: Diseño mobile-friendly con breakpoints CSS

