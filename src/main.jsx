// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom'; // Importa BrowserRouter
import App from './App';
import './index.css';

// Detectar el entorno y usar el basename correcto
// GitHub Pages: /herramientas-estudio/
// Firebase Hosting: /
// Desarrollo local: /
const getBasename = () => {
  const currentUrl = window.location.href;
  if (currentUrl.includes('github.io')) {
    return '/herramientas-estudio/';
  }
  return '/';
};

const basename = getBasename();

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <BrowserRouter basename={basename}>
            <App />
        </BrowserRouter>
    </React.StrictMode>,
);