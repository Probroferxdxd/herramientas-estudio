import React, { createContext, useContext, useState, useEffect } from 'react';
import { PlusCircle, Brain, BarChart3, BookOpen, Calendar, TrendingUp } from 'lucide-react';
import ToolTemplate from "../template/ToolTemplate.jsx";
import "../index.css"
import "../styles/RecallApp.css"

// ============ CONTEXT ============
const EjerciciosContext = createContext();

function EjerciciosProvider({ children }) {
    const [ejercicios, setEjercicios] = useState([]);
    const [vistaActual, setVistaActual] = useState('dashboard');

    // Cargar desde localStorage
    useEffect(() => {
        const stored = localStorage.getItem('flask-ejercicios');
        if (stored) {
            setEjercicios(JSON.parse(stored));
        }
    }, []);

    // Guardar en localStorage
    useEffect(() => {
        if (ejercicios.length > 0) {
            localStorage.setItem('flask-ejercicios', JSON.stringify(ejercicios));
        }
    }, [ejercicios]);

    const agregarEjercicio = (nuevoEjercicio) => {
        const ejercicio = {
            ...nuevoEjercicio,
            id: Date.now().toString(),
            historial: [],
            algoritmo: {
                intervalo: 1,
                facilidad: 2.5,
                repeticiones: 0,
                proximoRepaso: new Date().toISOString().split('T')[0],
                prioridad: 5
            }
        };
        setEjercicios([...ejercicios, ejercicio]);
    };

    const registrarIntento = (id, respuesta, confianza) => {
        setEjercicios(ejercicios.map(ej => {
            if (ej.id !== id) return ej;

            const correcta = respuesta === ej.respuestaCorrecta;
            const nuevoIntento = {
                fecha: new Date().toISOString(),
                respuestaUsuario: respuesta,
                correcta,
                nivelConfianza: confianza
            };

            const historial = [...ej.historial, nuevoIntento];

            // Calcular próximo repaso
            let { intervalo, facilidad, repeticiones } = ej.algoritmo;

            if (correcta && confianza === 'alto') {
                facilidad += 0.1;
                repeticiones++;
            } else if (!correcta) {
                facilidad = Math.max(1.3, facilidad - 0.2);
                repeticiones = 0;
            }

            if (repeticiones === 0) {
                intervalo = 1;
            } else if (repeticiones === 1) {
                intervalo = 6;
            } else {
                intervalo = Math.round(intervalo * facilidad);
            }

            // Prioridad por errores recientes
            const erroresRecientes = historial.slice(-3).filter(h => !h.correcta).length;
            const prioridad = erroresRecientes >= 2 ? 10 : 5;
            if (erroresRecientes >= 2) intervalo = Math.min(intervalo, 2);

            const proximoRepaso = new Date(Date.now() + intervalo * 24 * 60 * 60 * 1000)
                .toISOString().split('T')[0];

            return {
                ...ej,
                historial,
                algoritmo: { intervalo, facilidad, repeticiones, proximoRepaso, prioridad }
            };
        }));
    };

    const obtenerEjerciciosHoy = () => {
        const hoy = new Date().toISOString().split('T')[0];
        return ejercicios
            .filter(ej => ej.algoritmo.proximoRepaso <= hoy)
            .sort((a, b) => b.algoritmo.prioridad - a.algoritmo.prioridad)
            .slice(0, 20);
    };

    return (
        <EjerciciosContext.Provider value={{
            ejercicios,
            vistaActual,
            setVistaActual,
            agregarEjercicio,
            registrarIntento,
            obtenerEjerciciosHoy
        }}>
            <div className="recall-app-container">
                {children}
            </div>
        </EjerciciosContext.Provider>
    );
}

const useEjercicios = () => useContext(EjerciciosContext);

// ============ COMPONENTES ============

function Dashboard() {
    const { ejercicios, obtenerEjerciciosHoy, setVistaActual } = useEjercicios();
    const ejerciciosHoy = obtenerEjerciciosHoy();

    const stats = {
        total: ejercicios.length,
        pendientes: ejerciciosHoy.length,
        dominados: ejercicios.filter(ej => ej.algoritmo.repeticiones >= 3).length,
        tasaAcierto: ejercicios.length > 0
            ? Math.round(ejercicios.reduce((acc, ej) => {
                const aciertos = ej.historial.filter(h => h.correcta).length;
                return acc + (ej.historial.length > 0 ? aciertos / ej.historial.length : 0);
            }, 0) / ejercicios.length * 100)
            : 0
    };

    return (
        <div className="dashboard-container">
            <h1 className="dashboard-title">Dashboard</h1>

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
    const { agregarEjercicio, setVistaActual } = useEjercicios();
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
        alert('¡Ejercicio guardado!');
    };

    const handleImagen = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = () => {
            setForm({ ...form, imagen: reader.result });
        };
        reader.readAsDataURL(file);
    };

    const handleRemoveImage = () => {
        setForm({ ...form, imagen: null });
    };

    const handleOpcionImagen = (indice, e) => {
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
    const { obtenerEjerciciosHoy, registrarIntento, setVistaActual } = useEjercicios();
    const ejerciciosHoy = obtenerEjerciciosHoy();
    const [indiceActual, setIndiceActual] = useState(0);
    const [respuestaSeleccionada, setRespuestaSeleccionada] = useState('');
    const [confianza, setConfianza] = useState('medio');
    const [mostrarResultado, setMostrarResultado] = useState(false);

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

    const handleSubmit = () => {
        if (!respuestaSeleccionada) return;
        setMostrarResultado(true);
    };

    const handleSiguiente = () => {
        registrarIntento(ejercicioActual.id, respuestaSeleccionada, confianza);

        if (indiceActual < ejerciciosHoy.length - 1) {
            setIndiceActual(indiceActual + 1);
            setRespuestaSeleccionada('');
            setConfianza('medio');
            setMostrarResultado(false);
        } else {
            alert('¡Repaso completado! 🎉');
            setVistaActual('dashboard');
        }
    };

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

function Navigation() {
    const { vistaActual, setVistaActual } = useEjercicios();

    const botones = [
        { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
        { id: 'ingresar', label: 'Nuevo ejercicio', icon: PlusCircle },
        { id: 'resolver', label: 'Repasar', icon: Brain }
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
    return(
        <ToolTemplate className={"recall-app"}>
            <App />
        </ToolTemplate>
    )
}

function RenderVista() {
    const { vistaActual } = useEjercicios();

    switch (vistaActual) {
        case 'dashboard': return <Dashboard />;
        case 'ingresar': return <IngresarEjercicio />;
        case 'resolver': return <ResolverEjercicio />;
        default: return <Dashboard />;
    }
}