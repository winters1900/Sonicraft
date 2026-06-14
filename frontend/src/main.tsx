import React from 'react';
import ReactDOM from 'react-dom/client';
import LandingPage from './pages/LandingPage';
import StudioApp from './pages/StudioApp';
import './styles.css';

const isStudio = window.location.pathname.startsWith('/app');

document.body.classList.add(isStudio ? 'route-studio' : 'route-landing');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isStudio ? <StudioApp /> : <LandingPage />}
  </React.StrictMode>,
);
