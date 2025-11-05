import React, { Suspense, lazy } from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'

console.log('Frontend: démarrage de main.jsx')

// Lazy import du composant principal pour mieux gérer les erreurs d'import
const TourismAssistantContainer = lazy(() => import('./components/TourismAssistant'));

// Simple fallback pendant le chargement
function LoadingFallback() {
    return (
        <div style={{ padding: 20, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
            Chargement de l'interface...
        </div>
    );
}

// Error boundary pour capturer et afficher les erreurs runtime/import
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { error: null };
    }

    static getDerivedStateFromError(error) {
        return { error };
    }

    componentDidCatch(error, info) {
        console.error('ErrorBoundary capturé:', error, info);
    }

    render() {
        if (this.state.error) {
            return (
                <div style={{ padding: 20, color: '#b91c1c', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                    <h2>Erreur lors du chargement du frontend</h2>
                    <pre style={{ whiteSpace: 'pre-wrap' }}>{this.state.error?.message || String(this.state.error)}</pre>
                    <p>Vérifiez la console du navigateur (F12) et le terminal où tourne "npm run dev".</p>
                </div>
            );
        }
        return this.props.children;
    }
}

// Render principal avec logs
try {
    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(
        <React.StrictMode>
            <ErrorBoundary>
                <Suspense fallback={<LoadingFallback />}>
                    <TourismAssistantContainer />
                </Suspense>
            </ErrorBoundary>
        </React.StrictMode>
    );
    console.log('Frontend: rendu initialisé');
} catch (e) {
    // Afficher erreur si le rendu échoue complètement
    console.error('Frontend: échec du rendu initial', e);
    document.body.innerHTML = `<div style="padding:20px">Erreur critique du frontend: ${e.message}</div>`;
}
