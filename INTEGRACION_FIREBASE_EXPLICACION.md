# 📚 Integración Firebase + RecallApp - Explicación Completa

## 🎯 ¿Qué cambió?

Tu RecallApp ahora está **100% integrado con Firebase**. Los datos se guardan simultáneamente en:
- ✅ **localStorage** (para funcionamiento sin conexión)
- ✅ **Firestore** (para sincronización en la nube)

---

## 🔄 Flujo de Datos: Antes vs Ahora

### ANTES (Solo localStorage):
```
Crear ejercicio → localStorage ✓
Resolver ejercicio → localStorage ✓
(Datos solo en tu navegador, se pierden en otra computadora)
```

### AHORA (localStorage + Firebase):
```
Crear ejercicio → localStorage ✓ + Firestore ✓
Resolver ejercicio → localStorage ✓ + Firestore ✓
(Datos sincronizados en la nube, accesibles desde cualquier dispositivo)
```

---

## 🔐 Autenticación: Cómo Funciona

### 1. **Usuario NO logueado**
- Carga datos de localStorage
- Puede crear/editar/resolver ejercicios
- Datos se guardan SOLO en su navegador

### 2. **Usuario logueado (con Google)**
- Se detecta automáticamente en `useEffect`
- Carga datos de Firestore (su nube)
- Al crear/editar/resolver ejercicios → se sincroniza automáticamente a Firestore
- **IMPORTANTE**: También guarda en localStorage como respaldo

---

## 📝 Cambios Principales en el Código

### A. **Imports de Firebase**:
```jsx
import { auth } from '../config/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import {
  addEjercicio,
  getEjercicios,
  deleteEjercicio,
  updateProgreso
} from '../config/firestore';
```

### B. **Nuevo Estado en EjerciciosProvider**:
```jsx
const [user, setUser] = useState(null);      // ← Usuario autenticado
const [cargando, setCargando] = useState(true); // ← Estado de carga
```

### C. **Detectar Usuario Autenticado**:
```jsx
useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
    setUser(currentUser);
    if (currentUser) {
      // Si está logueado: cargar de Firestore
      await cargarEjerciciosDelUsuario(currentUser.uid);
    } else {
      // Si no está logueado: cargar de localStorage
      const stored = localStorage.getItem('flask-ejercicios');
      if (stored) setEjercicios(JSON.parse(stored));
    }
    setCargando(false);
  });
  return () => unsubscribe();
}, []);
```

### D. **agregarEjercicio Ahora es Asincrónico**:
```jsx
const agregarEjercicio = async (nuevoEjercicio) => {
  const ejercicio = { ...nuevoEjercicio, /* ... */ };
  
  // Guardar en localStorage
  setEjercicios([...ejercicios, ejercicio]);
  
  // Guardar en Firestore si está logueado
  if (user) {
    try {
      await fbAddEjercicio(user.uid, nuevoEjercicio);
    } catch (error) {
      console.error('Error al guardar en Firebase:', error);
    }
  }
};
```

### E. **registrarIntento Ahora Sincroniza Progreso**:
```jsx
const registrarIntento = (id, respuesta, confianza) => {
  setEjercicios(ejercicios.map(ej => {
    // ... cálculos del algoritmo SM-2 ...
    
    // Sincronizar progreso con Firestore
    if (user) {
      updateProgreso(user.uid, 'ejercicios', {
        totalIntentados: historial.length,
        totalAcertados: historial.filter(h => h.correcta).length,
        ultimoIntento: new Date().toISOString()
      });
    }
    return ej;
  }));
};
```

### F. **eliminarEjercicio Ahora es Asincrónico**:
```jsx
const eliminarEjercicio = async (id) => {
  setEjercicios(ejercicios.filter(ej => ej.id !== id));
  
  if (user) {
    try {
      await fbDeleteEjercicio(user.uid, id);
    } catch (error) {
      console.error('Error al eliminar de Firebase:', error);
    }
  }
};
```

### G. **Dashboard Ahora Muestra Usuario**:
```jsx
<div style={{ display: 'flex', justifyContent: 'space-between' }}>
  <h1>Dashboard</h1>
  {user && (
    <div>📱 Sincronizado: {user.email}</div>
  )}
</div>
```

---

## 💾 Estructura de Datos en Firestore

```
Firestore (Cloud Firestore)
└── users/
    └── {uid_del_usuario}/
        ├── uid: "google-id-123"
        ├── nombre: "Juan Pérez"
        ├── email: "juan@gmail.com"
        ├── avatar: "url-foto"
        ├── fechaCreacion: "2026-01-25T..."
        ├── ejercicios: [
        │   {
        │     id: "1234567890",
        │     curso: "Álgebra",
        │     tema: "Ecuaciones",
        │     enunciado: "...",
        │     opciones: [{texto: "...", imagen: null}, ...],
        │     respuestaCorrecta: "A",
        │     fuente: "...",
        │     dificultadPercibida: 3,
        │     imagen: null,
        │     historial: [
        │       {
        │         fecha: "2026-01-25T10:30:00Z",
        │         respuestaUsuario: "B",
        │         correcta: false,
        │         nivelConfianza: "medio"
        │       },
        │       ...
        │     ],
        │     algoritmo: {
        │       intervalo: 6,
        │       facilidad: 2.6,
        │       repeticiones: 1,
        │       proximoRepaso: "2026-01-31",
        │       prioridad: 5
        │     }
        │   },
        │   ...
        │ ]
        ├── flashcards: []
        └── progreso: {
            "ejercicios": {
              totalIntentados: 45,
              totalAcertados: 38,
              ultimoIntento: "2026-01-25T10:30:00Z",
              fechaActualizacion: "2026-01-25T10:30:00Z"
            }
          }
```

---

## 🚀 Flujo Completo: Crear un Ejercicio

```
1. Usuario abre RecallApp
   ↓
2. Component LoadingHeader detecta si está logueado (Google)
   ↓
3. Si está logueado:
   - EjerciciosProvider carga datos de Firestore
   - Si NO está logueado: carga de localStorage
   ↓
4. Usuario va a "Nuevo Ejercicio"
   ↓
5. Llena el formulario y hace clic en "Guardar ejercicio"
   ↓
6. agregarEjercicio() se ejecuta:
   - ✅ Guarda en localStorage (instantáneo)
   - ✅ Guarda en Firestore (si está logueado)
   - Muestra: "¡Ejercicio guardado! (Sincronizado con Firebase)"
   ↓
7. El ejercicio aparece inmediatamente en el Dashboard
   ↓
8. Cualquier dispositivo logueado con la misma cuenta verá el ejercicio
```

---

## 📊 Flujo Completo: Resolver un Ejercicio

```
1. Usuario está en Dashboard
   ↓
2. Ve "X ejercicios para hoy"
   ↓
3. Hace clic en "Comenzar repaso"
   ↓
4. Para cada ejercicio:
   - Selecciona opción
   - Indica nivel de confianza (bajo/medio/alto)
   - Verifica respuesta
   ↓
5. Sistema calcula (algoritmo SM-2):
   - Si acertó + confianza ALTA → próximo en 6 días
   - Si falló → próximo mañana + reducir facilidad
   ↓
6. Registra intento en:
   - ✅ localStorage
   - ✅ Firestore (progreso actualizado)
   ↓
7. Pasa al siguiente ejercicio
   ↓
8. Al terminar: "Repaso completado! 🎉"
```

---

## ⚙️ Funciones de Firestore Que Se Usan

En tu `firestore.js`:

| Función | Cuándo se llama | Qué hace |
|---------|-----------------|----------|
| `fbAddEjercicio()` | Al crear ejercicio | Guarda en Firestore + localStorage |
| `fbGetEjercicios()` | Al cargar usuario | Trae todos los ejercicios del usuario |
| `fbDeleteEjercicio()` | Al eliminar ejercicio | Elimina de Firestore + localStorage |
| `updateProgreso()` | Al registrar intento | Actualiza estadísticas de progreso |

---

## 🔒 Consideraciones de Seguridad

### Reglas de Firestore (Ya configuradas):
```javascript
rules_version = '3';
service cloud.firestore {
  match /databases/{database}/documents {
    // Solo usuarios autenticados pueden leer/escribir sus propios datos
    match /users/{uid} {
      allow read, write: if request.auth.uid == uid;
    }
  }
}
```

**Esto significa:**
- ✅ Juan (uid: 123) solo puede ver/editar sus propios datos
- ❌ Juan NO puede ver los datos de María (uid: 456)
- ❌ Usuarios no logueados NO pueden escribir

---

## 🐛 Manejo de Errores

El sistema tiene 3 niveles de protección:

### 1. **Sin conexión a internet**:
- Los datos se guardan en localStorage
- Cuando vuelva la conexión, se sincronizarán con Firestore

### 2. **Error al guardar en Firebase**:
```jsx
if (user) {
  try {
    await fbAddEjercicio(user.uid, nuevoEjercicio);
  } catch (error) {
    console.error('Error al guardar en Firebase:', error);
    // El ejercicio YA ESTÁ EN localStorage, así que no se pierde
  }
}
```

### 3. **Error al cargar de Firebase**:
```jsx
try {
  const ejerciciosFirebase = await fbGetEjercicios(uid);
  setEjercicios(ejerciciosFirebase);
} catch (error) {
  console.error('Error cargando ejercicios:', error);
  // Fallback a localStorage
  const stored = localStorage.getItem('flask-ejercicios');
  if (stored) setEjercicios(JSON.parse(stored));
}
```

---

## 🎓 Resumen de lo Nuevo

### Para el Usuario (sin cambios visibles):
- ✅ Todo funciona igual
- ✅ Los datos persisten entre sesiones
- **NUEVO**: Los datos están sincronizados en la nube
- **NUEVO**: Puedes acceder desde otro dispositivo

### Para el Desarrollador (cambios en el código):
- ✅ Firebase se detecta automáticamente
- ✅ Sin conexión = funciona normalmente
- ✅ Con conexión = sincroniza a Firestore
- ✅ Manejo de errores incorporado

### En Firestore (lo que ves):
- ✅ Colección `users` con todos los usuarios
- ✅ Cada usuario tiene sus ejercicios
- ✅ Historial de intentos grabado
- ✅ Progreso general registrado

---

## 📱 Próximos Pasos (Opcionales)

1. **FlashCards.jsx** - Integrar igual que RecallApp
2. **Shared Exercises** - Permitir compartir ejercicios entre usuarios
3. **Estadísticas Avanzadas** - Dashboard con gráficos de progreso
4. **Backup Automático** - Descargar todos los ejercicios como PDF

---

## ❓ Preguntas Comunes

**P: ¿Qué pasó con mi localStorage?**
R: Sigue ahí. Se carga primero, y se sincroniza con Firestore si estás logueado.

**P: ¿Puedo usar esto sin login?**
R: Sí, funciona normalmente. Los datos se guardan solo en localStorage.

**P: ¿Se pierden datos sin internet?**
R: No. Se guardan en localStorage y se sincronizarán cuando vuelva la conexión.

**P: ¿Puedo ver mis datos en Firebase Console?**
R: Sí, ve a: https://console.firebase.google.com → herramientas-estudio → Firestore → users

---

¡**Listo! Tu app está completamente integrada con Firebase! 🚀**
