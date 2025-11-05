"""
API FastAPI pour Burkina Tourisme Chatbot

Cette API expose les fonctionnalités du chatbot assistant touristique
spécialisé sur le Burkina Faso via des endpoints REST.

Endpoints:
- POST /api/chat: Envoyer une question et recevoir une réponse
- GET /api/health: Vérifier l'état de l'API
- POST /api/init: Initialiser la base de données avec le corpus
"""

import logging
import sys
import asyncio
import re
from pathlib import Path
from typing import List, Dict, Optional, Any

from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, HTTPException, BackgroundTasks

sys.path.append(str(Path(__file__).resolve().parent.parent.parent))
try:
    from src.backend.config import (
        APP_NAME,
        APP_VERSION,
        HOST,
        PORT,
        CORS_ORIGINS,
        CORPUS_PATH,
    )
    from src.backend.rag_system import RAGSystem
    from src.backend.data_loader import DataLoader
    from src.backend.chat_service import ChatService
except Exception:
    try:
        from config import (
            APP_NAME,
            APP_VERSION,
            HOST,
            PORT,
            CORS_ORIGINS,
            CORPUS_PATH,
        )
        from rag_system import RAGSystem
        from data_loader import DataLoader
        from chat_service import ChatService
    except Exception:
        from backend.config import (
            APP_NAME,
            APP_VERSION,
            HOST,
            PORT,
            CORS_ORIGINS,
            CORPUS_PATH,
        )
        from backend.rag_system import RAGSystem
        from backend.data_loader import DataLoader
        from backend.chat_service import ChatService

# Configuration du logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("backend")

# Variables globales
rag_system = None
data_loader = None
chat_service = None

# --- Créer l'application AVANT tout handler/décorateur ---
app = FastAPI(
    title=APP_NAME,
    version=APP_VERSION,
    description="Assistant IA contextuel pour le tourisme au Burkina Faso",
)

# Configurer CORS immédiatement après la création de l'app
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Modèles Pydantic pour les requêtes/réponses


class ChatRequest(BaseModel):
    """Modèle pour une requête de chat."""
    query: str
    top_k: Optional[int] = 5


class ChatResponse(BaseModel):
    """Modèle pour une réponse de chat."""
    response: str
    message: str
    sources: List[Dict[str, Any]]
    context_used: bool
    query: str
    num_sources: int


class HealthResponse(BaseModel):
    """Modèle pour la réponse de santé."""
    status: str
    version: str
    rag_initialized: bool


class InitResponse(BaseModel):
    """Modèle pour la réponse d'initialisation."""
    status: str
    documents_loaded: int
    message: str


DATA_FILE = Path(__file__).resolve().parents[2] / "data" / "sources.txt"


# Handlers startup / shutdown
@app.on_event("startup")
async def startup_event():
    logger.info("Startup: initialisation des sources.")
    try:
        text = DATA_FILE.read_text(encoding="utf-8")
        sources = [line.strip() for line in text.splitlines() if line.strip()]
        logger.info(
            f"{len(sources)} lignes de sources chargées depuis {DATA_FILE}")
    except Exception:
        logger.exception(
            "Impossible de lire le fichier de sources, démarrage sans sources.")
        sources = []
    app.state.sources = sources


@app.on_event("shutdown")
async def shutdown_event():
    logger.info("Shutdown: nettoyage des ressources si nécessaire.")


def find_relevant_snippets(query: str, sources: list[str], max_results: int = 5):
    # Extraire mots de >=3 lettres pour la recherche simple
    words = [w.lower() for w in re.findall(r"\w{3,}", query)]
    results = []
    for line in sources:
        lw = line.lower()
        if any(w in lw for w in words):
            results.append(line)
            if len(results) >= max_results:
                break
    return results


# Endpoints
@app.get("/api/health", response_model=HealthResponse)
async def health_check():
    """
    Vérifier l'état de l'API et du système RAG.

    Returns:
        État de l'API et du système RAG
    """
    return HealthResponse(
        status="healthy" if rag_system else "initializing",
        version=APP_VERSION,
        rag_initialized=rag_system is not None,
    )


@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Traiter une question et retourner une réponse du chatbot.

    Pipeline RAG:
    1. Récupérer les documents pertinents (Retrieval)
    2. Générer une réponse basée sur le contexte (Generation)
    3. Retourner la réponse avec les sources

    Args:
        request: Requête contenant la question

    Returns:
        Réponse du chatbot avec sources

    Raises:
        HTTPException: Si le système RAG n'est pas initialisé
    """
    try:
        # Valider la requête
        if not request.query or len(request.query.strip()) == 0:
            raise HTTPException(
                status_code=400,
                detail="La requête ne peut pas être vide"
            )

        query = request.query.strip()

        # Si le système RAG est initialisé, déléguer au rag_system
        if rag_system:
            try:
                result = rag_system.chat(query)
                response_text = result.get("response", "")
                sources = result.get("sources", [])
                context_used = result.get("context_used", False)
                num_sources = result.get("num_sources", len(sources))
                rag_fallback = False
            except Exception as e:
                logger.exception(
                    "Erreur RAG, bascule vers recherche locale: %s", e)
                rag_fallback = True
        else:
            rag_fallback = True

        # Fallback : recherche simple dans app.state.sources
        if rag_fallback:
            sources_lines = getattr(app.state, "sources", []) or []
            snippets = find_relevant_snippets(
                query, sources_lines, max_results=request.top_k or 5)
            if snippets:
                response_text = "Informations trouvées :\n\n" + \
                    "\n".join(snippets)
                sources = [{"text": s} for s in snippets]
                context_used = False
                num_sources = len(snippets)
            else:
                response_text = (
                    "Désolé, je n'ai pas trouvé d'information précise dans mes sources pour votre question.\n"
                    "Essayez de reformuler avec des mots-clés (ex: 'Banfora', 'FESPACO', 'hébergement Ouagadougou')."
                )
                sources = []
                context_used = False
                num_sources = 0

        # Retourner les deux clés 'response' et 'message' pour compatibilité frontend
        return ChatResponse(
            response=response_text,
            message=response_text,
            sources=sources,
            context_used=context_used,
            query=query,
            num_sources=num_sources,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur lors du traitement de la requête: {e}")
        raise HTTPException(
            status_code=500,
            detail="Erreur lors du traitement de la requête"
        )


@app.post("/api/init", response_model=InitResponse)
async def initialize_corpus(background_tasks: BackgroundTasks):
    """
    Initialiser la base de données avec le corpus de données.

    Cette endpoint charge les données d'exemple et les indexe
    dans la base de données vectorielle.

    Returns:
        Nombre de documents chargés
    """
    if not rag_system or not data_loader:
        raise HTTPException(
            status_code=503,
            detail="Le système n'est pas initialisé"
        )

    try:
        # Vider la base de données existante
        rag_system.clear_database()

        # Ajouter les données d'exemple
        data_loader.add_sample_data()
        data_loader.save_corpus()

        # Charger le corpus
        rag_system.load_corpus(str(CORPUS_PATH))

        stats = data_loader.get_statistics()

        return InitResponse(
            status="success",
            documents_loaded=stats["total_documents"],
            message=f"Corpus initialisé avec {stats['total_documents']} documents"
        )
    except Exception as e:
        logger.error(f"Erreur lors de l'initialisation: {e}")
        raise HTTPException(
            status_code=500,
            detail="Erreur lors de l'initialisation du corpus"
        )


@app.get("/api/stats")
async def get_statistics():
    """
    Obtenir les statistiques du corpus.

    Returns:
        Statistiques du corpus (nombre de documents, mots, catégories, etc.)
    """
    if not data_loader:
        raise HTTPException(
            status_code=503,
            detail="Le système n'est pas initialisé"
        )

    return data_loader.get_statistics()


@app.get("/")
async def root():
    """Endpoint racine avec informations sur l'API."""
    return {
        "name": APP_NAME,
        "version": APP_VERSION,
        "description": "Assistant IA contextuel pour le tourisme au Burkina Faso",
        "endpoints": {
            "health": "/api/health",
            "chat": "/api/chat",
            "init": "/api/init",
            "stats": "/api/stats",
            "docs": "/docs",
        }
    }


# Lorsque vous lancez le module directement, laissez uvicorn gérer l'app (aucun lifespan spécial)
if __name__ == "__main__":
    import uvicorn

    try:
        uvicorn.run(
            "src.backend.main:app",
            host=HOST,
            port=PORT,
            reload=True,
            log_level="info",
        )
    except KeyboardInterrupt:
        logger.info(
            "Arrêt demandé par l'utilisateur (KeyboardInterrupt). Fermeture propre.")
