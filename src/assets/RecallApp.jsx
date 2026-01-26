import React, { createContext, useContext, useState, useEffect } from 'react';
import { PlusCircle, Brain, BarChart3, BookOpen, Calendar, TrendingUp } from 'lucide-react';
import { auth } from '../config/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import {
  addEjercicio as fbAddEjercicio,
  getEjercicios as fbGetEjercicios,
  deleteEjercicio as fbDeleteEjercicio,
  updateProgreso,
  sincronizarTodosLosData
} from '../config/firestore';
import ToolTemplate from "../template/ToolTemplate.jsx";
import "../index.css"
import "../styles/RecallApp.css"

// ============ CONTEXT ============
// Contexto de React para compartir estado global de ejercicios entre componentes
const EjerciciosContext = createContext();

// Proveedor de contexto: centraliza lógica de gestión de ejercicios
// Maneja persistencia en localStorage Y Firebase + algoritmo de repaso espaciado (SM-2)
function EjerciciosProvider({ children }) {
    const [ejercicios, setEjercicios] = useState([]); // Lista completa de ejercicios
    const [vistaActual, setVistaActual] = useState('dashboard'); // Vista actualmente mostrada
    const [user, setUser] = useState(null); // Usuario autenticado con Firebase
    const [cargando, setCargando] = useState(true); // Indica si se están cargando datos

    // Detectar cambios de autenticación y cargar datos accordingly
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);
            if (currentUser) {
                // Si está logueado: cargar datos de Firestore
                await cargarEjerciciosDelUsuario(currentUser.uid);
            } else {
                // Si no está logueado: cargar del localStorage
                const stored = localStorage.getItem('flask-ejercicios');
                if (stored) {
                    setEjercicios(JSON.parse(stored));
                }
            }
            setCargando(false);
        });

        return () => unsubscribe();
    }, []);

    // Cargar ejercicios del usuario desde Firestore
    const cargarEjerciciosDelUsuario = async (uid) => {
        try {
            // Primero sincroniza cualquier dato local a Firestore
            await sincronizarTodosLosData(uid);
            
            // Luego carga los datos de Firestore
            const ejerciciosFirebase = await fbGetEjercicios(uid);
            setEjercicios(ejerciciosFirebase);
            
            // Guardar en localStorage como backup
            localStorage.setItem('flask-ejercicios', JSON.stringify(ejerciciosFirebase));
            console.log('✅ Datos sincronizados y cargados correctamente');
        } catch (error) {
            console.error('Error cargando ejercicios:', error);
            // Fallback a localStorage si hay error
            const stored = localStorage.getItem('flask-ejercicios');
            if (stored) setEjercicios(JSON.parse(stored));
        }
    };

    // Guarda en localStorage cada vez que la lista de ejercicios cambia
    // Permite que los datos persistan entre sesiones del navegador
    useEffect(() => {
        if (ejercicios.length > 0) {
            localStorage.setItem('flask-ejercicios', JSON.stringify(ejercicios));
        }
    }, [ejercicios]);

    // Agrega un nuevo ejercicio inicializando el algoritmo de repetición espaciada
    const agregarEjercicio = async (nuevoEjercicio) => {
        const ejercicio = {
            ...nuevoEjercicio,
            id: Date.now().toString(), // ID único basado en timestamp
            historial: [], // Registro de todos los intentos del usuario
            // Algoritmo SM-2 para optimizar retención mediante repetición espaciada
            algoritmo: {
                intervalo: 1, // Días hasta el próximo repaso
                facilidad: 2.5, // Factor de dificultad (aumenta si responde bien)
                repeticiones: 0, // Cuántas veces lo ha respondido correctamente seguidas
                proximoRepaso: new Date().toISOString().split('T')[0], // Fecha del próximo repaso
                prioridad: 5 // Urgencia (1-10, más alto = más urgente)
            }
        };

        // Guardar en localStorage
        const nuevosEjercicios = [...ejercicios, ejercicio];
        setEjercicios(nuevosEjercicios);

        // Guardar en Firestore si está logueado
        if (user) {
            try {
                await fbAddEjercicio(user.uid, nuevoEjercicio);
            } catch (error) {
                console.error('Error al guardar en Firebase:', error);
            }
        }
    };

    // Registra un intento de respuesta y ajusta el algoritmo SM-2
    const registrarIntento = (id, respuesta, confianza) => {
        setEjercicios(ejercicios.map(ej => {
            if (ej.id !== id) return ej;

            // Verifica si la respuesta es correcta
            const correcta = respuesta === ej.respuestaCorrecta;
            // Crea registro del intento con metadatos
            const nuevoIntento = {
                fecha: new Date().toISOString(),
                respuestaUsuario: respuesta,
                correcta,
                nivelConfianza: confianza // bajo/medio/alto - confianza del usuario
            };

            // Añade intento al historial
            const historial = [...ej.historial, nuevoIntento];

            // Ajusta parámetros del algoritmo SM-2 según la respuesta
            let { intervalo, facilidad, repeticiones } = ej.algoritmo;

            // Si responde bien con alta confianza: aumenta facilidad y repeticiones
            // Si falla: resetea progreso y reduce facilidad
            if (correcta && confianza === 'alto') {
                facilidad += 0.1; // Aumenta factor (intervalo más largo)
                repeticiones++; // Suma acierto
            } else if (!correcta) {
                facilidad = Math.max(1.3, facilidad - 0.2); // Penaliza (mínimo 1.3)
                repeticiones = 0; // Reinicia contador
            }

            // Calcula nuevo intervalo: aumenta exponencialmente con aciertos
            if (repeticiones === 0) {
                intervalo = 1; // Primer intento: 1 día
            } else if (repeticiones === 1) {
                intervalo = 6; // Segundo intento: 6 días
            } else {
                intervalo = Math.round(intervalo * facilidad); // Siguiente: intervalo × facilidad
            }

            // Si ha fallado 2+ veces recientemente: prioridad máxima
            const erroresRecientes = historial.slice(-3).filter(h => !h.correcta).length;
            const prioridad = erroresRecientes >= 2 ? 10 : 5;
            if (erroresRecientes >= 2) intervalo = Math.min(intervalo, 2); // Fuerza revisión en 2 días

            const proximoRepaso = new Date(Date.now() + intervalo * 24 * 60 * 60 * 1000)
                .toISOString().split('T')[0];

            // Registrar progreso en Firestore si está logueado
            if (user) {
                updateProgreso(user.uid, 'ejercicios', {
                    totalIntentados: historial.length,
                    totalAcertados: historial.filter(h => h.correcta).length,
                    ultimoIntento: new Date().toISOString()
                }).catch(err => console.error('Error al actualizar progreso:', err));
            }

            return {
                ...ej,
                historial,
                algoritmo: { intervalo, facilidad, repeticiones, proximoRepaso, prioridad }
            };
        }));
    };

    // Obtiene ejercicios pendientes para hoy, ordenados por prioridad (máx 20)
    const obtenerEjerciciosHoy = () => {
        const hoy = new Date().toISOString().split('T')[0];
        return ejercicios
            .filter(ej => ej.algoritmo.proximoRepaso <= hoy) // Solo los vencidos
            .sort((a, b) => b.algoritmo.prioridad - a.algoritmo.prioridad) // Ordena por urgencia
            .slice(0, 20); // Máximo 20 para evitar sobrecarga
    };

    // Elimina un ejercicio por ID
    const eliminarEjercicio = async (id) => {
        setEjercicios(ejercicios.filter(ej => ej.id !== id));

        // Eliminar de Firestore si está logueado
        if (user) {
            try {
                await fbDeleteEjercicio(user.uid, id);
            } catch (error) {
                console.error('Error al eliminar de Firebase:', error);
            }
        }
    };

    // Actualiza los datos de un ejercicio (usado en la vista de gestión)
    const actualizarEjercicio = (id, datosActualizados) => {
        setEjercicios(ejercicios.map(ej => 
            ej.id === id ? { ...ej, ...datosActualizados } : ej
        ));
    };

    return (
        <EjerciciosContext.Provider value={{
            ejercicios,
            vistaActual,
            setVistaActual,
            agregarEjercicio,
            registrarIntento,
            obtenerEjerciciosHoy,
            eliminarEjercicio,
            actualizarEjercicio,
            user,
            cargando
        }}>
            <div className="recall-app-container">
                {children}
            </div>
        </EjerciciosContext.Provider>
    );
}

// Hook personalizado: permite acceder al contexto desde cualquier componente
const useEjercicios = () => useContext(EjerciciosContext);

// ============ COMPONENTES ============
// Diferentes vistas y componentes de la aplicación

// VISTA 1: DASHBOARD - Muestra estadísticas generales y ejercicios pendientes
function Dashboard() {
    const { ejercicios, obtenerEjerciciosHoy, setVistaActual, user, cargando } = useEjercicios();
    const ejerciciosHoy = obtenerEjerciciosHoy();

    if (cargando) {
        return (
            <div className="dashboard-container">
                <p style={{ textAlign: 'center', color: '#6b7280' }}>Cargando datos...</p>
            </div>
        );
    }

    // Calcula estadísticas para mostrar en tarjetas del dashboard
    const stats = {
        total: ejercicios.length, // Total de ejercicios creados
        pendientes: ejerciciosHoy.length, // Ejercicios pendientes para hoy
        dominados: ejercicios.filter(ej => ej.algoritmo.repeticiones >= 3).length, // 3+ aciertos consecutivos
        tasaAcierto: ejercicios.length > 0 // Porcentaje global de aciertos
            ? Math.round(ejercicios.reduce((acc, ej) => {
                const aciertos = ej.historial.filter(h => h.correcta).length;
                return acc + (ej.historial.length > 0 ? aciertos / ej.historial.length : 0);
            }, 0) / ejercicios.length * 100)
            : 0
    };

    return (
        <div className="dashboard-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h1 className="dashboard-title">Dashboard</h1>
                {user && (
                    <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                        📱 Sincronizado: {user.email}
                    </div>
                )}
            </div>

            <div className="stats-grid">
                <StatCard icon={BookOpen} label="Total ejercicios" value={stats.total} color="blue" />
                <StatCard icon={Calendar} label="Para hoy" value={stats.pendientes} color="orange" />
                <StatCard icon={Brain} label="Dominados" value={stats.dominados} color="green" />
                <StatCard icon={TrendingUp} label="Tasa acierto" value={`${stats.tasaAcierto}%`} color="purple" />
            </div>

            <div className="ejercicios-hoy-section">
                <h2 className="ejercicios-hoy-title">Ejercicios para hoy</h2>
                {ejerciciosHoy.length === 0 ? (
                    <p style={{ color: '#6b7280' }}>¡No tienes ejercicios pendientes para hoy! 🎉</p>
                ) : (
                    <div className="ejercicios-hoy-list">
                        {ejerciciosHoy.slice(0, 5).map(ej => (
                            <div key={ej.id} className="ejercicio-item">
                                <div className="ejercicio-info">
                                    <p className="ejercicio-curso">{ej.curso} - {ej.tema}</p>
                                    <p className="ejercicio-enunciado">{ej.enunciado.substring(0, 60)}...</p>
                                </div>
                                <span className={`ejercicio-priority-badge ${ej.algoritmo.prioridad >= 8 ? 'high' : 'medium'}`}>
                                    Prioridad {ej.algoritmo.prioridad}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
                {ejerciciosHoy.length > 0 && (
                    <button
                        onClick={() => setVistaActual('resolver')}
                        className="btn-comenzar"
                    >
                        Comenzar repaso
                    </button>
                )}
            </div>
        </div>
    );
}

function StatCard({ icon: Icon, label, value, color }) {
    // Componente reutilizable para mostrar estadísticas con icono
    return (
        <div className={`stat-card ${color}`}>
            <div className="stat-card-icon-container">
                <Icon size={20} />
                <p className="stat-card-label">{label}</p>
            </div>
            <p className="stat-card-value">{value}</p>
        </div>
    );
}

function IngresarEjercicio() {
    // VISTA 2: Formulario para agregar nuevos ejercicios
    // Permite capturar: curso, tema, enunciado, opciones, imagen, etc.
    const { agregarEjercicio, setVistaActual, user } = useEjercicios();
    const [form, setForm] = useState({
        curso: '',
        tema: '',
        enunciado: '',
        tipo: 'opcion_multiple',
        opciones: [
            { texto: '', imagen: null },
            { texto: '', imagen: null },
            { texto: '', imagen: null },
            { texto: '', imagen: null },
            { texto: '', imagen: null }
        ],
        respuestaCorrecta: '',
        fuente: '',
        dificultadPercibida: 3,
        imagen: null
    });

    // Valida que estén completos los campos obligatorios y guarda el ejercicio
    const handleSubmit = () => {
        if (!form.curso || !form.tema || !form.enunciado || !form.respuestaCorrecta) {
            alert('Por favor completa los campos obligatorios');
            return;
        }
        agregarEjercicio(form);
        setForm({
            curso: '',
            tema: '',
            enunciado: '',
            tipo: 'opcion_multiple',
            opciones: [
                { texto: '', imagen: null },
                { texto: '', imagen: null },
                { texto: '', imagen: null },
                { texto: '', imagen: null },
                { texto: '', imagen: null }
            ],
            respuestaCorrecta: '',
            fuente: '',
            dificultadPercibida: 3,
            imagen: null
        });
        alert(`¡Ejercicio guardado!${user ? ' (Sincronizado con Firebase)' : ''}`);
    };

    const handleImagen = (e) => {
        // Carga imagen del enunciado convertida a base64
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = () => {
            setForm({ ...form, imagen: reader.result });
        };
        reader.readAsDataURL(file);
    };

    const handleRemoveImage = () => {
        // Elimina la imagen del enunciado
        setForm({ ...form, imagen: null });
    };

    const handleOpcionImagen = (indice, e) => {
        // Carga imagen para una opción específica
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = () => {
            const newOps = [...form.opciones];
            newOps[indice] = { ...newOps[indice], imagen: reader.result };
            setForm({ ...form, opciones: newOps });
        };
        reader.readAsDataURL(file);
    };

    const handleRemoveOpcionImage = (indice) => {
        // Elimina la imagen de una opción
        const newOps = [...form.opciones];
        newOps[indice] = { ...newOps[indice], imagen: null };
        setForm({ ...form, opciones: newOps });
    };

    return (
        <div className="ingreso-ejercicio-container">
            <h1 className="ingreso-title">Ingresar nuevo ejercicio</h1>

            <div className="form-card">
                <div className="form-group form-grid-2col">
                    <div>
                        <label className="form-label">Curso *</label>
                        <input
                            type="text"
                            value={form.curso}
                            onChange={(e) => setForm({...form, curso: e.target.value})}
                            placeholder="Ej: Álgebra"
                            className="form-input"
                        />
                    </div>
                    <div>
                        <label className="form-label">Tema *</label>
                        <input
                            type="text"
                            value={form.tema}
                            onChange={(e) => setForm({...form, tema: e.target.value})}
                            placeholder="Ej: Ecuaciones cuadráticas"
                            className="form-input"
                        />
                    </div>
                </div>

                <div className="form-group">
                    <label className="form-label">Enunciado del problema *</label>
                    <textarea
                        value={form.enunciado}
                        onChange={(e) => setForm({...form, enunciado: e.target.value})}
                        placeholder="Copia aquí el problema de tu libro..."
                        className="form-textarea"
                    />
                </div>

                <div className="form-group opciones-container">
                    <label className="form-label">Opciones (A-E)</label>
                    {form.opciones.map((op, i) => (
                        <div key={i} className="opcion-item">
                            <div className="opcion-text-input">
                                <input
                                    type="text"
                                    value={op.texto}
                                    onChange={(e) => {
                                        const newOps = [...form.opciones];
                                        newOps[i] = { ...newOps[i], texto: e.target.value };
                                        setForm({...form, opciones: newOps});
                                    }}
                                    placeholder={`Opción ${String.fromCharCode(65 + i)}`}
                                    className="form-input opcion-input"
                                />
                            </div>
                            <div className="opcion-image-upload">
                                <label htmlFor={`opcion-file-${i}`} className="opcion-image-label">
                                    <span className="opcion-image-icon">🖼️</span>
                                    <span className="opcion-image-text">Imagen</span>
                                </label>
                                <input
                                    id={`opcion-file-${i}`}
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => handleOpcionImagen(i, e)}
                                    className="file-input-hidden"
                                />
                                {op.imagen && (
                                    <div className="opcion-image-preview">
                                        <img src={op.imagen} alt={`Opción ${String.fromCharCode(65 + i)}`} />
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveOpcionImage(i)}
                                            className="opcion-image-remove"
                                            title="Eliminar imagen"
                                        >
                                            ×
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="form-group form-grid-2col">
                    <div>
                        <label className="form-label">Respuesta correcta *</label>
                        <select
                            value={form.respuestaCorrecta}
                            onChange={(e) => setForm({...form, respuestaCorrecta: e.target.value})}
                            className="form-select"
                        >
                            <option value="">Seleccionar...</option>
                            <option value="A">A</option>
                            <option value="B">B</option>
                            <option value="C">C</option>
                            <option value="D">D</option>
                            <option value="E">E</option>
                        </select>
                    </div>
                    <div>
                        <label className="form-label">Dificultad (1-5)</label>
                        <div className="dificultad-container">
                            <input
                                type="range"
                                min="1"
                                max="5"
                                value={form.dificultadPercibida}
                                onChange={(e) => setForm({...form, dificultadPercibida: parseInt(e.target.value)})}
                                className="dificultad-range"
                            />
                            <span className="dificultad-label">Nivel: {form.dificultadPercibida}</span>
                        </div>
                    </div>
                </div>

                <div className="form-group">
                    <label className="form-label">Fuente</label>
                    <input
                        type="text"
                        value={form.fuente}
                        onChange={(e) => setForm({...form, fuente: e.target.value})}
                        placeholder="Ej: Lumbreras Álgebra p.234"
                        className="form-input"
                    />
                </div>
                
                <div className="form-group">
                    <label className="form-label">Imagen del ejercicio (opcional)</label>
                    <div className="file-input-wrapper">
                        <label htmlFor="file-input" className="file-input-label">
                            <span className="file-input-icon">📸</span>
                            <span className="file-input-text">Selecciona una imagen</span>
                            <span className="file-input-hint">Arrastra o haz clic para cargar</span>
                        </label>
                        <input
                            id="file-input"
                            type="file"
                            accept="image/*"
                            onChange={handleImagen}
                            className="file-input-hidden"
                        />
                    </div>

                    {form.imagen && (
                        <div className="file-input-preview-container">
                            <div className="file-input-preview-title">Vista previa</div>
                            <div className="file-input-preview">
                                <img
                                    src={form.imagen}
                                    alt="Vista previa"
                                />
                                <button
                                    type="button"
                                    onClick={handleRemoveImage}
                                    className="file-input-remove-btn"
                                    title="Eliminar imagen"
                                >
                                    ×
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="form-buttons">
                    <button
                        onClick={handleSubmit}
                        className="btn-primary"
                    >
                        Guardar ejercicio
                    </button>
                    <button
                        onClick={() => setVistaActual('dashboard')}
                        className="btn-secondary"
                    >
                        Cancelar
                    </button>
                </div>
            </div>
        </div>
    );
}

function ResolverEjercicio() {
    // VISTA 3: Interfaz para resolver ejercicios del día
    // Muestra ejercicios pendientes, captura respuesta y confianza del usuario
    const { obtenerEjerciciosHoy, registrarIntento, setVistaActual } = useEjercicios();
    const ejerciciosHoy = obtenerEjerciciosHoy();
    const [indiceActual, setIndiceActual] = useState(0);
    const [respuestaSeleccionada, setRespuestaSeleccionada] = useState('');
    const [confianza, setConfianza] = useState('medio');
    const [mostrarResultado, setMostrarResultado] = useState(false);

    // Si no hay ejercicios pendientes, muestra mensaje
    if (ejerciciosHoy.length === 0) {
        return (
            <div className="sin-ejercicios">
                <p className="sin-ejercicios-texto">¡No hay ejercicios para repasar hoy!</p>
                <button
                    onClick={() => setVistaActual('dashboard')}
                    className="btn-volver"
                >
                    Volver al dashboard
                </button>
            </div>
        );
    }

    const ejercicioActual = ejerciciosHoy[indiceActual];

    // Valida respuesta y muestra el resultado
    const handleSubmit = () => {
        if (!respuestaSeleccionada) return;
        setMostrarResultado(true);
    };

    // Registra el intento y avanza al siguiente ejercicio
    const handleSiguiente = () => {
        registrarIntento(ejercicioActual.id, respuestaSeleccionada, confianza);

        if (indiceActual < ejerciciosHoy.length - 1) {
            // Reinicia estado para siguiente ejercicio
            setIndiceActual(indiceActual + 1);
            setRespuestaSeleccionada('');
            setConfianza('medio');
            setMostrarResultado(false);
        } else {
            // Completa el repaso
            alert('¡Repaso completado! 🎉');
            setVistaActual('dashboard');
        }
    };

    // Determina si la respuesta fue correcta
    const esCorrecta = respuestaSeleccionada === ejercicioActual.respuestaCorrecta;

    return (
        <div className="resolver-container">
            <div className="resolver-header">
                <h2 className="resolver-title">Repaso diario</h2>
                <span className="resolver-counter">
                    {indiceActual + 1} / {ejerciciosHoy.length}
                </span>
            </div>

            <div className="ejercicio-card">
                <div style={{ marginBottom: '1rem' }}>
                    <span className="ejercicio-meta">{ejercicioActual.curso} - {ejercicioActual.tema}</span>
                    <h3 className="ejercicio-enunciado-title">{ejercicioActual.enunciado}</h3>
                    {ejercicioActual.imagen && (
                        <img
                            src={ejercicioActual.imagen}
                            alt="Ejercicio"
                            className="ejercicio-imagen"
                        />
                    )}
                </div>

                <div className="opciones-list">
                    {ejercicioActual.opciones.map((opcion, i) => {
                        const letra = String.fromCharCode(65 + i);
                        const seleccionada = respuestaSeleccionada === letra;
                        const esRespuestaCorrecta = ejercicioActual.respuestaCorrecta === letra;

                        let btnClass = 'option-button';
                        if (mostrarResultado) {
                            if (esRespuestaCorrecta) btnClass += ' correct';
                            else if (seleccionada) btnClass += ' incorrect';
                        } else if (seleccionada) {
                            btnClass += ' selected';
                        }

                        return (
                            <button
                                key={i}
                                onClick={() => !mostrarResultado && setRespuestaSeleccionada(letra)}
                                disabled={mostrarResultado}
                                className={btnClass}
                            >
                                <div className="option-content">
                                    <strong>{letra})</strong>
                                    <div className="option-text-image">
                                        <span>{typeof opcion === 'string' ? opcion : opcion.texto}</span>
                                        {opcion.imagen && (
                                            <img src={opcion.imagen} alt={`Opción ${letra}`} className="option-image" />
                                        )}
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>

                {!mostrarResultado ? (
                    <div className="resultado-section">
                        <div className="confianza-section">
                            <label className="confianza-label">¿Qué tan seguro estás?</label>
                            <div className="confianza-buttons">
                                {['bajo', 'medio', 'alto'].map(nivel => (
                                    <button
                                        key={nivel}
                                        onClick={() => setConfianza(nivel)}
                                        className={`confianza-btn ${confianza === nivel ? 'active' : ''}`}
                                    >
                                        {nivel.charAt(0).toUpperCase() + nivel.slice(1)}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <button
                            onClick={handleSubmit}
                            disabled={!respuestaSeleccionada}
                            className="btn-verificar"
                        >
                            Verificar respuesta
                        </button>
                    </div>
                ) : (
                    <div className="resultado-section">
                        <div className={`resultado-box ${esCorrecta ? 'correcto' : 'incorrecto'}`}>
                            <p>
                                {esCorrecta ? '✅ ¡Correcto!' : `❌ Incorrecto. La respuesta era ${ejercicioActual.respuestaCorrecta}`}
                            </p>
                        </div>

                        <button
                            onClick={handleSiguiente}
                            className="btn-siguiente"
                        >
                            Siguiente ejercicio
                        </button>
                    </div>
                )}
            </div>

            <div className="ejercicio-footer">
                <p>Fuente: {ejercicioActual.fuente}</p>
                <p>Intentos previos: {ejercicioActual.historial.length}</p>
            </div>
        </div>
    );
}

function GestionarEjercicios() {
    // VISTA 4: Interfaz para gestionar ejercicios (editar/eliminar)
    // Permite filtrar por curso y modificar los ejercicios creados
    const { ejercicios, eliminarEjercicio, actualizarEjercicio, setVistaActual } = useEjercicios();
    const [filtro, setFiltro] = useState('todos');
    const [ejercicioEditando, setEjercicioEditando] = useState(null);
    const [formEdicion, setFormEdicion] = useState({});

    // Filtra ejercicios según el curso seleccionado
    const ejerciciosFiltrados = ejercicios.filter(ej => {
        if (filtro === 'todos') return true;
        return ej.curso === filtro;
    });

    // Obtiene lista única de cursos para el filtro
    const cursos = [...new Set(ejercicios.map(ej => ej.curso))];

    // Inicia modo edición para un ejercicio
    const handleEditar = (ejercicio) => {
        setEjercicioEditando(ejercicio.id);
        setFormEdicion({ ...ejercicio });
    };

    // Guarda los cambios del ejercicio editado
    const handleGuardarEdicion = () => {
        actualizarEjercicio(ejercicioEditando, formEdicion);
        setEjercicioEditando(null);
        setFormEdicion({});
        alert('Ejercicio actualizado correctamente');
    };

    // Cancela la edición actual
    const handleCancelarEdicion = () => {
        setEjercicioEditando(null);
        setFormEdicion({});
    };

    // Elimina un ejercicio previa confirmación
    const handleEliminar = (id) => {
        if (window.confirm('¿Estás seguro de que quieres eliminar este ejercicio?')) {
            eliminarEjercicio(id);
            alert('Ejercicio eliminado correctamente');
        }
    };

    return (
        <div className="gestionar-ejercicios-container">
            <h1 className="gestionar-title">Gestionar ejercicios</h1>

            <div className="filtro-container">
                <label className="filtro-label">Filtrar por curso:</label>
                <select 
                    value={filtro} 
                    onChange={(e) => setFiltro(e.target.value)}
                    className="filtro-select"
                >
                    <option value="todos">Todos</option>
                    {cursos.map(curso => (
                        <option key={curso} value={curso}>{curso}</option>
                    ))}
                </select>
                <p className="total-ejercicios">Total: {ejerciciosFiltrados.length} ejercicios</p>
            </div>

            {ejerciciosFiltrados.length === 0 ? (
                <div className="sin-ejercicios">
                    <p className="sin-ejercicios-texto">No hay ejercicios para mostrar</p>
                    <button
                        onClick={() => setVistaActual('ingresar')}
                        className="btn-primary"
                    >
                        Agregar nuevo ejercicio
                    </button>
                </div>
            ) : (
                <div className="ejercicios-gestion-list">
                    {ejerciciosFiltrados.map(ej => (
                        <div 
                            key={ej.id} 
                            className={`ejercicio-gestion-card ${ejercicioEditando === ej.id ? 'editando' : ''}`}
                        >
                            {ejercicioEditando === ej.id ? (
                                <div className="edicion-form">
                                    <div className="form-group">
                                        <label className="form-label">Curso</label>
                                        <input
                                            type="text"
                                            value={formEdicion.curso}
                                            onChange={(e) => setFormEdicion({...formEdicion, curso: e.target.value})}
                                            className="form-input"
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label">Tema</label>
                                        <input
                                            type="text"
                                            value={formEdicion.tema}
                                            onChange={(e) => setFormEdicion({...formEdicion, tema: e.target.value})}
                                            className="form-input"
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label">Enunciado</label>
                                        <textarea
                                            value={formEdicion.enunciado}
                                            onChange={(e) => setFormEdicion({...formEdicion, enunciado: e.target.value})}
                                            className="form-textarea"
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label">Respuesta correcta</label>
                                        <select
                                            value={formEdicion.respuestaCorrecta}
                                            onChange={(e) => setFormEdicion({...formEdicion, respuestaCorrecta: e.target.value})}
                                            className="form-select"
                                        >
                                            <option value="A">A</option>
                                            <option value="B">B</option>
                                            <option value="C">C</option>
                                            <option value="D">D</option>
                                            <option value="E">E</option>
                                        </select>
                                    </div>

                                    <div className="edicion-buttons">
                                        <button
                                            onClick={handleGuardarEdicion}
                                            className="btn-primary"
                                        >
                                            Guardar cambios
                                        </button>
                                        <button
                                            onClick={handleCancelarEdicion}
                                            className="btn-secondary"
                                        >
                                            Cancelar
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="ejercicio-gestion-content">
                                    <div className="ejercicio-gestion-header">
                                        <div className="ejercicio-gestion-info">
                                            <p className="ejercicio-gestion-meta">{ej.curso} • {ej.tema}</p>
                                            <p className="ejercicio-gestion-enunciado">{ej.enunciado.substring(0, 80)}{ej.enunciado.length > 80 ? '...' : ''}</p>
                                        </div>
                                        <div className="ejercicio-gestion-stats">
                                            <span className="stat-badge">Intentos: {ej.historial.length}</span>
                                            <span className={`stat-badge ${ej.algoritmo.repeticiones >= 3 ? 'dominado' : ''}`}>
                                                Repeticiones: {ej.algoritmo.repeticiones}
                                            </span>
                                            <span className="stat-badge">Próximo: {ej.algoritmo.proximoRepaso}</span>
                                        </div>
                                    </div>

                                    <div className="ejercicio-gestion-buttons">
                                        <button
                                            onClick={() => handleEditar(ej)}
                                            className="btn-editar"
                                            title="Editar ejercicio"
                                        >
                                            ✏️ Editar
                                        </button>
                                        <button
                                            onClick={() => handleEliminar(ej.id)}
                                            className="btn-eliminar"
                                            title="Eliminar ejercicio"
                                        >
                                            🗑️ Eliminar
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            <div className="form-buttons" style={{ marginTop: '2rem' }}>
                <button
                    onClick={() => setVistaActual('dashboard')}
                    className="btn-secondary"
                >
                    Volver al dashboard
                </button>
            </div>
        </div>
    );
}

function Navigation() {
    // Componente de navegación: botones para cambiar entre vistas
    const { vistaActual, setVistaActual } = useEjercicios();

    const botones = [
        { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
        { id: 'ingresar', label: 'Nuevo ejercicio', icon: PlusCircle },
        { id: 'resolver', label: 'Repasar', icon: Brain },
        { id: 'gestionar', label: 'Gestionar', icon: BookOpen }
    ];

    return (
        <nav>
            <div className="max-w-7xl px-4">
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                    {botones.map(({ id, label, icon: Icon }) => (
                        <button
                            key={id}
                            onClick={() => setVistaActual(id)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                padding: '0.75rem 1rem',
                                borderBottomWidth: '2px',
                                borderBottomColor: vistaActual === id ? '#2563eb' : 'transparent',
                                color: vistaActual === id ? '#2563eb' : '#4b5563',
                                backgroundColor: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                transition: 'color 0.3s ease, border-color 0.3s ease'
                            }}
                            onMouseEnter={(e) => {
                                if (vistaActual !== id) e.target.style.color = '#111827';
                            }}
                            onMouseLeave={(e) => {
                                if (vistaActual !== id) e.target.style.color = '#4b5563';
                            }}
                        >
                            <Icon size={18} />
                            {label}
                        </button>
                    ))}
                </div>
            </div>
        </nav>
    );
}

// ============ APP PRINCIPAL ============
// Componente raíz: envuelve todo con el proveedor de contexto
function App() {
    return (
        <EjerciciosProvider>
            <div>
                <div className="header-recall-app">
                    <div className="header-content">
                        <h1>Flask - Retención de Conocimiento</h1>
                        <p>Sistema de repaso espaciado para examen UNI</p>
                    </div>
                </div>

                <Navigation />

                <main className="max-w-7xl px-4 py-6">
                    <RenderVista />
                </main>
            </div>
        </EjerciciosProvider>
    );
}

export default function RecallApp() {
    // Componente de exportación final: envuelve en ToolTemplate
    return(
        <ToolTemplate className={"recall-app"}>
            <App />
        </ToolTemplate>
    )
}

function RenderVista() {
    // Componente de enrutamiento: muestra la vista correcta según vistaActual
    const { vistaActual } = useEjercicios();

    switch (vistaActual) {
        case 'dashboard': return <Dashboard />;
        case 'ingresar': return <IngresarEjercicio />;
        case 'resolver': return <ResolverEjercicio />;
        case 'gestionar': return <GestionarEjercicios />;
        default: return <Dashboard />;
    }
}