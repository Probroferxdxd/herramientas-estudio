import { db } from './firebase';
import { 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  arrayUnion,
  arrayRemove
} from 'firebase/firestore';

// ==================== SINCRONIZACIÓN GENERAL ====================

/**
 * Sincroniza datos de localStorage a Firestore SOLO si tiene sentido
 * NUNCA sobrescribe Firestore con datos vacíos
 * - Si Firestore tiene datos → NO sincronizar (Firestore es source of truth)
 * - Si Firestore está vacío y localStorage tiene datos → sincronizar
 * - Si ambos están vacíos → no hacer nada
 * @param {string} uid - ID del usuario
 */
export const sincronizarTodosLosData = async (uid) => {
  try {
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    
    const ejerciciosLocal = JSON.parse(localStorage.getItem('flask-ejercicios')) || [];
    const flashcardsLocal = JSON.parse(localStorage.getItem('flashcards')) || [];
    const progresoLocal = JSON.parse(localStorage.getItem('progreso')) || {};
    
    // Si Firestore ya tiene datos, NUNCA sobrescribir
    if (userSnap.exists() && userSnap.data().ejercicios && userSnap.data().ejercicios.length > 0) {
      console.log('✅ Firestore tiene datos (source of truth), no sincronizando localStorage vacío');
      return;
    }
    
    // Si Firestore está vacío pero localStorage tiene datos → sincronizar
    if (ejerciciosLocal.length > 0 || Object.keys(flashcardsLocal).length > 0) {
      await setDoc(userRef, {
        ejercicios: ejerciciosLocal,
        flashcards: flashcardsLocal,
        progreso: progresoLocal,
        fechaSincronizacion: new Date().toISOString()
      }, { merge: true });
      console.log('✅ Datos locales sincronizados a Firestore (Firestore estaba vacío)');
    } else {
      console.log('✅ Sin datos para sincronizar (ambos vacíos)');
    }
  } catch (error) {
    console.error('Error sincronizando datos:', error);
    throw error;
  }
};

/**
 * Fuerza la restauración de datos desde Firestore al localStorage
 * Sobrescribe localStorage con datos de Firestore (uso en recuperación de emergencia)
 * @param {string} uid - ID del usuario
 */
export const restaurarDesdeFirestore = async (uid) => {
  try {
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      const datos = userSnap.data();
      
      if (datos.ejercicios) {
        localStorage.setItem('flask-ejercicios', JSON.stringify(datos.ejercicios));
        console.log('✅ Ejercicios restaurados desde Firestore:', datos.ejercicios.length);
      }
      if (datos.flashcards) {
        localStorage.setItem('flashcards', JSON.stringify(datos.flashcards));
      }
      if (datos.progreso) {
        localStorage.setItem('progreso', JSON.stringify(datos.progreso));
      }
      
      return datos;
    }
  } catch (error) {
    console.error('Error restaurando datos:', error);
    throw error;
  }
};

/**
 * Carga todos los datos de Firestore al localStorage
 * @param {string} uid - ID del usuario
 */
export const cargarDatosDeFirestore = async (uid) => {
  try {
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      const datos = userSnap.data();
      
      if (datos.ejercicios) {
        localStorage.setItem('flask-ejercicios', JSON.stringify(datos.ejercicios));
      }
      if (datos.flashcards) {
        localStorage.setItem('flashcards', JSON.stringify(datos.flashcards));
      }
      if (datos.progreso) {
        localStorage.setItem('progreso', JSON.stringify(datos.progreso));
      }

      console.log('✅ Datos cargados de Firestore');
    }
  } catch (error) {
    console.error('Error cargando datos de Firestore:', error);
    throw error;
  }
};

// ==================== USUARIOS ====================

/**
 * Crea el perfil del usuario en Firestore
 * @param {string} uid - ID del usuario
 * @param {object} userData - Datos del usuario
 */
export const createUserProfile = async (uid, userData) => {
  try {
    const userRef = doc(db, 'users', uid);
    await setDoc(userRef, {
      uid,
      nombre: userData.displayName || '',
      email: userData.email || '',
      avatar: userData.photoURL || '',
      fechaCreacion: new Date().toISOString(),
      ejercicios: [],
      flashcards: [],
      progreso: {}
    }, { merge: true });
    
    console.log('✅ Perfil de usuario creado');
  } catch (error) {
    console.error('Error creando perfil:', error);
    throw error;
  }
};

/**
 * Obtiene el perfil del usuario de Firestore
 * @param {string} uid - ID del usuario
 */
export const getUserProfile = async (uid) => {
  try {
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    return userSnap.exists() ? userSnap.data() : null;
  } catch (error) {
    console.error('Error obteniendo perfil:', error);
    throw error;
  }
};

// ==================== EJERCICIOS ====================

/**
 * Añade un ejercicio a Firestore y localStorage
 * @param {string} uid - ID del usuario
 * @param {object} ejercicio - Datos del ejercicio
 */
export const addEjercicio = async (uid, ejercicio) => {
  try {
    const ejercicioConId = {
      id: Date.now().toString(),
      ...ejercicio,
      fechaCreacion: new Date().toISOString()
    };

    // Guardar en localStorage
    const ejerciciosLocal = JSON.parse(localStorage.getItem('flask-ejercicios')) || [];
    ejerciciosLocal.push(ejercicioConId);
    localStorage.setItem('flask-ejercicios', JSON.stringify(ejerciciosLocal));

    // Guardar en Firestore
    if (uid) {
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, {
        ejercicios: arrayUnion(ejercicioConId)
      });
    }

    console.log('✅ Ejercicio añadido');
    return ejercicioConId;
  } catch (error) {
    console.error('Error añadiendo ejercicio:', error);
    throw error;
  }
};

/**
 * Obtiene los ejercicios - Firestore es source of truth cuando hay uid
 * @param {string} uid - ID del usuario (opcional)
 */
export const getEjercicios = async (uid = null) => {
  try {
    // Si hay uid, SIEMPRE obtener de Firestore (es source of truth)
    if (uid) {
      const userRef = doc(db, 'users', uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists() && userSnap.data().ejercicios) {
        return userSnap.data().ejercicios;
      }
    }
    
    // Si no hay uid o Firestore está vacío, usar localStorage
    return JSON.parse(localStorage.getItem('flask-ejercicios')) || [];
  } catch (error) {
    console.error('Error obteniendo ejercicios:', error);
    return JSON.parse(localStorage.getItem('flask-ejercicios')) || [];
  }
};

/**
 * Elimina un ejercicio
 * @param {string} uid - ID del usuario
 * @param {string} ejercicioId - ID del ejercicio
 */
export const deleteEjercicio = async (uid, ejercicioId) => {
  try {
    // Eliminar de localStorage
    const ejerciciosLocal = JSON.parse(localStorage.getItem('flask-ejercicios')) || [];
    const ejercicioAEliminar = ejerciciosLocal.find(e => e.id === ejercicioId);
    
    if (ejercicioAEliminar) {
      const ejerciciosFiltrados = ejerciciosLocal.filter(e => e.id !== ejercicioId);
      localStorage.setItem('flask-ejercicios', JSON.stringify(ejerciciosFiltrados));

      // Eliminar de Firestore
      if (uid) {
        const userRef = doc(db, 'users', uid);
        await updateDoc(userRef, {
          ejercicios: arrayRemove(ejercicioAEliminar)
        });
      }
    }

    console.log('✅ Ejercicio eliminado');
  } catch (error) {
    console.error('Error eliminando ejercicio:', error);
    throw error;
  }
};

// ==================== FLASHCARDS ====================

/**
 * Añade una flashcard a Firestore y localStorage
 * @param {string} uid - ID del usuario
 * @param {object} flashcard - Datos de la flashcard
 */
export const addFlashcard = async (uid, flashcard) => {
  try {
    const flashcardConId = {
      id: Date.now().toString(),
      ...flashcard,
      fechaCreacion: new Date().toISOString(),
      vistas: 0,
      acertadas: 0
    };

    // Guardar en localStorage
    const flashcardsLocal = JSON.parse(localStorage.getItem('flashcards')) || [];
    flashcardsLocal.push(flashcardConId);
    localStorage.setItem('flashcards', JSON.stringify(flashcardsLocal));

    // Guardar en Firestore
    if (uid) {
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, {
        flashcards: arrayUnion(flashcardConId)
      });
    }

    console.log('✅ Flashcard añadida');
    return flashcardConId;
  } catch (error) {
    console.error('Error añadiendo flashcard:', error);
    throw error;
  }
};

/**
 * Obtiene las flashcards del localStorage y Firestore
 * @param {string} uid - ID del usuario (opcional)
 */
export const getFlashcards = async (uid = null) => {
  try {
    // Primero intenta del localStorage
    const flashcardsLocal = JSON.parse(localStorage.getItem('flashcards')) || [];
    
    // Si hay uid, sincroniza con Firestore
    if (uid) {
      const userRef = doc(db, 'users', uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists() && userSnap.data().flashcards) {
        return userSnap.data().flashcards;
      }
    }
    
    return flashcardsLocal;
  } catch (error) {
    console.error('Error obteniendo flashcards:', error);
    return JSON.parse(localStorage.getItem('flashcards')) || [];
  }
};

/**
 * Actualiza estadísticas de una flashcard
 * @param {string} uid - ID del usuario
 * @param {string} flashcardId - ID de la flashcard
 * @param {boolean} acertada - Si fue acertada
 */
export const updateFlashcardStats = async (uid, flashcardId, acertada) => {
  try {
    // Actualizar en localStorage
    const flashcardsLocal = JSON.parse(localStorage.getItem('flashcards')) || [];
    const index = flashcardsLocal.findIndex(f => f.id === flashcardId);
    
    if (index !== -1) {
      flashcardsLocal[index].vistas += 1;
      if (acertada) flashcardsLocal[index].acertadas += 1;
      localStorage.setItem('flashcards', JSON.stringify(flashcardsLocal));

      // Actualizar en Firestore
      if (uid) {
        const userRef = doc(db, 'users', uid);
        const userSnap = await getDoc(userRef);
        const flashcards = userSnap.data().flashcards || [];
        const fbIndex = flashcards.findIndex(f => f.id === flashcardId);
        
        if (fbIndex !== -1) {
          flashcards[fbIndex] = flashcardsLocal[index];
          await updateDoc(userRef, { flashcards });
        }
      }
    }

    console.log('✅ Stats de flashcard actualizadas');
  } catch (error) {
    console.error('Error actualizando stats:', error);
    throw error;
  }
};

/**
 * Elimina una flashcard
 * @param {string} uid - ID del usuario
 * @param {string} flashcardId - ID de la flashcard
 */
export const deleteFlashcard = async (uid, flashcardId) => {
  try {
    // Eliminar de localStorage
    const flashcardsLocal = JSON.parse(localStorage.getItem('flashcards')) || [];
    const flashcardAEliminar = flashcardsLocal.find(f => f.id === flashcardId);
    
    if (flashcardAEliminar) {
      const flashcardsFiltradas = flashcardsLocal.filter(f => f.id !== flashcardId);
      localStorage.setItem('flashcards', JSON.stringify(flashcardsFiltradas));

      // Eliminar de Firestore
      if (uid) {
        const userRef = doc(db, 'users', uid);
        await updateDoc(userRef, {
          flashcards: arrayRemove(flashcardAEliminar)
        });
      }
    }

    console.log('✅ Flashcard eliminada');
  } catch (error) {
    console.error('Error eliminando flashcard:', error);
    throw error;
  }
};

// ==================== PROGRESO ====================

/**
 * Actualiza el progreso en localStorage y Firestore
 * @param {string} uid - ID del usuario
 * @param {string} categoria - Categoría de progreso
 * @param {object} datos - Datos del progreso
 */
export const updateProgreso = async (uid, categoria, datos) => {
  try {
    // Actualizar en localStorage
    const progresoLocal = JSON.parse(localStorage.getItem('progreso')) || {};
    progresoLocal[categoria] = {
      ...datos,
      fechaActualizacion: new Date().toISOString()
    };
    localStorage.setItem('progreso', JSON.stringify(progresoLocal));

    // Actualizar en Firestore
    if (uid) {
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, {
        [`progreso.${categoria}`]: progresoLocal[categoria]
      });
    }

    console.log('✅ Progreso actualizado');
  } catch (error) {
    console.error('Error actualizando progreso:', error);
    throw error;
  }
};

/**
 * Obtiene el progreso del localStorage y Firestore
 * @param {string} uid - ID del usuario (opcional)
 */
export const getProgreso = async (uid = null) => {
  try {
    // Primero intenta del localStorage
    const progresoLocal = JSON.parse(localStorage.getItem('progreso')) || {};
    
    // Si hay uid, sincroniza con Firestore
    if (uid) {
      const userRef = doc(db, 'users', uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists() && userSnap.data().progreso) {
        return userSnap.data().progreso;
      }
    }
    
    return progresoLocal;
  } catch (error) {
    console.error('Error obteniendo progreso:', error);
    return JSON.parse(localStorage.getItem('progreso')) || {};
  }
};

/**
 * Obtiene una categoría específica del progreso
 * @param {string} uid - ID del usuario
 * @param {string} categoria - Nombre de la categoría
 */
export const getProgresoCategoria = async (uid, categoria) => {
  try {
    const progreso = await getProgreso(uid);
    return progreso[categoria] || null;
  } catch (error) {
    console.error('Error obteniendo progreso de categoría:', error);
    throw error;
  }
};
