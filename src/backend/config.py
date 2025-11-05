"""
Configuration de l'application Burkina Tourisme Chatbot

Ce module gère toutes les configurations de l'application, incluant
les chemins, les modèles, et les paramètres du système RAG.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# Charger les variables d'environnement
load_dotenv()

# Chemins
BASE_DIR = Path(__file__).resolve().parent.parent.parent
DATA_DIR = BASE_DIR / "data"
CORPUS_PATH = DATA_DIR / "corpus.json"
CHROMA_DB_PATH = DATA_DIR / "chroma_db"

# Configuration de l'application
APP_NAME = os.getenv("APP_NAME", "Burkina Tourisme Chatbot")
APP_VERSION = os.getenv("APP_VERSION", "1.0.0")
DEBUG = os.getenv("DEBUG", "False").lower() == "true"

# Configuration du serveur
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", 8000))

# Configuration du modèle d'embeddings (Sentence-Transformers)
# Modèle multilingue léger qui supporte le français et d'autres langues
EMBEDDING_MODEL = os.getenv(
    "EMBEDDING_MODEL",
    "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
)

# Configuration de la base de données vectorielle (ChromaDB)
CHROMA_DB_PATH_STR = os.getenv("CHROMA_DB_PATH", str(CHROMA_DB_PATH))

# Configuration du LLM (Ollama ou autre service LLM local)
# Pour cette implémentation, nous utilisons une API locale ou Hugging Face Inference
LLM_MODEL = os.getenv("LLM_MODEL", "mistral-7b")
LLM_API_URL = os.getenv("LLM_API_URL", "http://localhost:8001/v1")
LLM_API_KEY = os.getenv("LLM_API_KEY", "sk-default-key")

# Configuration CORS
CORS_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:8000",
    "http://localhost:5173",
    "http://127.0.0.1:8000",
    "http://127.0.0.1:3000",
]

# Configuration du RAG
RAG_CONFIG = {
    "chunk_size": 500,  # Taille des chunks de texte
    "chunk_overlap": 50,  # Chevauchement entre les chunks
    "top_k": 5,  # Nombre de documents à récupérer
    "similarity_threshold": 0.3,  # Seuil de similarité minimum
}

# Configuration des paramètres de génération du LLM
LLM_GENERATION_CONFIG = {
    "max_tokens": 512,
    "temperature": 0.7,
    "top_p": 0.9,
    "top_k": 50,
}

# Créer les répertoires nécessaires
DATA_DIR.mkdir(parents=True, exist_ok=True)
Path(CHROMA_DB_PATH_STR).mkdir(parents=True, exist_ok=True)
