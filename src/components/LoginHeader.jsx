import { useState, useEffect } from 'react';
import { auth } from '../config/firebase';
import {
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { LogOut, LogIn, AlertCircle } from 'lucide-react';
import { createUserProfile, cargarDatosDeFirestore, sincronizarTodosLosData } from '../config/firestore';
import '../styles/LoginHeader.css';

export default function LoginHeader() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const [firebaseError, setFirebaseError] = useState(false);

  const googleProvider = new GoogleAuthProvider();

  useEffect(() => {
    if (!auth) {
      setFirebaseError(true);
      setLoading(false);
      return;
    }

    try {
      const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
        if (currentUser) {
          // Crear perfil si no existe
          await createUserProfile(currentUser.uid, currentUser);
          // Cargar datos del usuario desde Firestore
          await cargarDatosDeFirestore(currentUser.uid);
        }
        setUser(currentUser);
        setLoading(false);
      });

      return () => unsubscribe();
    } catch (error) {
      console.error('Error al configurar autenticación:', error);
      setFirebaseError(true);
      setLoading(false);
    }
  }, []);

  const handleGoogleLogin = async () => {
    if (!auth) {
      alert('Firebase no está configurado. Por favor, añade tus credenciales en .env.local');
      return;
    }

    try {
      const result = await signInWithPopup(auth, googleProvider);
      // Sincronizar datos locales a Firestore
      if (result.user) {
        await sincronizarTodosLosData(result.user.uid);
      }
      setShowMenu(false);
    } catch (error) {
      console.error('Error al iniciar sesión:', error);
      alert('Error al iniciar sesión: ' + error.message);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setShowMenu(false);
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  if (loading) {
    return <div className="login-header"></div>;
  }

  if (firebaseError) {
    return (
      <div className="login-header">
        <div className="firebase-error" title="Firebase no configurado">
          <AlertCircle size={18} />
        </div>
      </div>
    );
  }

  return (
    <div className="login-header">
      {!user ? (
        <button className="login-btn" onClick={handleGoogleLogin}>
          <LogIn size={18} />
          <span>Iniciar sesión</span>
        </button>
      ) : (
        <div className="user-menu">
          <button
            className="user-btn"
            onClick={() => setShowMenu(!showMenu)}
            title={user.email}
          >
            {user.photoURL ? (
              <img src={user.photoURL} alt="Avatar" className="user-avatar" />
            ) : (
              <div className="user-avatar-placeholder">
                {user.displayName?.charAt(0) || user.email?.charAt(0)}
              </div>
            )}
            <span>{user.displayName || user.email}</span>
          </button>

          {showMenu && (
            <div className="dropdown-menu">
              <div className="user-info">
                <p className="user-email">{user.email}</p>
              </div>
              <button className="logout-btn" onClick={handleLogout}>
                <LogOut size={16} />
                <span>Cerrar sesión</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
