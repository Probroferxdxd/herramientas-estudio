import {Link, Outlet, Route, Routes} from 'react-router-dom';
import Home from './assets/Home';
import FlashCards from './assets/FlashCards.jsx';
import RecallApp from "./assets/RecallApp.jsx";
import LoginHeader from './components/LoginHeader';

export function Back() {
    return (
        <>
            <button>
                <Link to="/">Inicio</Link>
            </button>
        </>
    );
}

export default function App() {
    return (
        <div className="container">
            <LoginHeader />
            <Routes>
                <Route path="/" index element={<Home />} />
                <Route path="/about" element={<FlashCards />} />
                <Route path="/recall-app" element={<RecallApp />} />
                <Route path="*" element={<h1>404 - No encontrado g</h1>} /> {/* Ruta para no encontradas */}
            </Routes>
        </div>
    );
}

