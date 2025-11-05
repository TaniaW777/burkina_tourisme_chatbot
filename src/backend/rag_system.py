"""
Système RAG (Retrieval-Augmented Generation) pour Burkina Tourisme Chatbot

Ce module implémente le pipeline complet RAG:
1. Embeddings: Transformation du texte en vecteurs avec Sentence-Transformers
2. Base de données vectorielle: Stockage et recherche avec ChromaDB
3. LLM: Génération de réponses avec un modèle open source

Technologies utilisées:
- sentence-transformers: Embeddings multilingues
- chromadb: Base de données vectorielle
- transformers: Modèles LLM
"""

import json
import logging
import os
from typing import List, Dict, Tuple, Optional, Any
from pathlib import Path

import chromadb
from chromadb.config import Settings
from sentence_transformers import SentenceTransformer
from transformers import pipeline, AutoTokenizer, AutoModelForCausalLM
import torch

from config import (
    EMBEDDING_MODEL,
    CHROMA_DB_PATH_STR,
    LLM_MODEL,
    CORPUS_PATH,
    RAG_CONFIG,
    LLM_GENERATION_CONFIG,
)

# Configuration du logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class RAGSystem:
    """
    Système RAG complet pour le chatbot touristique du Burkina Faso.

    Attributes:
        embedding_model: Modèle Sentence-Transformers pour les embeddings
        chroma_client: Client ChromaDB pour la base de données vectorielle
        collection: Collection ChromaDB pour stocker les documents
        llm_pipeline: Pipeline de génération de texte
    """

    def __init__(self):
        """Initialiser le système RAG avec tous les composants."""
        logger.info("Initialisation du système RAG...")

        # Initialiser le modèle d'embeddings
        logger.info(f"Chargement du modèle d'embeddings: {EMBEDDING_MODEL}")
        self.embedding_model = SentenceTransformer(EMBEDDING_MODEL)

        # Initialiser ChromaDB (mise à jour pour la nouvelle configuration)
        logger.info(f"Initialisation de ChromaDB à: {CHROMA_DB_PATH_STR}")
        self.db_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
                                    "data", "chroma_db")

        # Créer le dossier s'il n'existe pas
        os.makedirs(self.db_path, exist_ok=True)

        try:
            # Configuration mise à jour de ChromaDB
            self.chroma_client = chromadb.PersistentClient(
                path=self.db_path,
                settings=Settings(
                    anonymized_telemetry=False,
                    allow_reset=True,
                    is_persistent=True
                )
            )
            logger.info(f"ChromaDB initialisé avec succès à: {self.db_path}")

            # Création ou récupération de la collection
            self.collection = self.chroma_client.get_or_create_collection(
                name="burkina_tourisme",
                metadata={"hnsw:space": "cosine"}
            )

        except Exception as e:
            logger.error(
                f"Erreur lors de l'initialisation de ChromaDB: {str(e)}")
            raise

        # Initialiser le pipeline LLM
        logger.info(f"Initialisation du pipeline LLM: {LLM_MODEL}")
        self._init_llm_pipeline()

        logger.info("Système RAG initialisé avec succès")

    def _init_llm_pipeline(self):
        """
        Initialiser le pipeline LLM.

        Utilise Hugging Face transformers pour charger un modèle LLM open source.
        Pour la production, considérer Ollama ou un serveur LLM local.
        """
        try:
            # Essayer de charger un modèle léger pour les tests
            # En production, utiliser Ollama ou un serveur LLM dédié
            device = 0 if torch.cuda.is_available() else -1

            self.llm_pipeline = pipeline(
                "text-generation",
                model="gpt2",  # Modèle léger pour les tests
                device=device,
                torch_dtype=torch.float32 if device == -1 else torch.float16,
            )
            logger.info("Pipeline LLM initialisé avec GPT-2 (modèle léger)")
        except Exception as e:
            logger.warning(f"Erreur lors du chargement du LLM: {e}")
            logger.info(
                "Utilisation d'une génération simple basée sur les templates")
            self.llm_pipeline = None

    def add_documents(self, documents: List[Dict[str, str]]) -> None:
        """
        Ajouter des documents à la base de données vectorielle.

        Args:
            documents: Liste de dictionnaires avec 'id', 'text', 'metadata'
        """
        logger.info(
            f"Ajout de {len(documents)} documents à la base de données...")

        texts = [doc["text"] for doc in documents]
        ids = [doc["id"] for doc in documents]
        metadatas = [doc.get("metadata", {}) for doc in documents]

        # Générer les embeddings
        embeddings = self.embedding_model.encode(texts, show_progress_bar=True)

        # Ajouter à ChromaDB
        self.collection.add(
            ids=ids,
            embeddings=embeddings.tolist(),
            metadatas=metadatas,
            documents=texts,
        )

        logger.info(f"✓ {len(documents)} documents ajoutés avec succès")

    def retrieve_documents(
        self,
        query: str,
        top_k: Optional[int] = None
    ) -> List[Dict[str, str]]:
        """
        Récupérer les documents les plus pertinents pour une requête.

        Args:
            query: Question ou requête de l'utilisateur
            top_k: Nombre de documents à récupérer (par défaut: RAG_CONFIG['top_k'])

        Returns:
            Liste des documents pertinents avec scores de similarité
        """
        if top_k is None:
            top_k = RAG_CONFIG["top_k"]

        # Générer l'embedding de la requête
        query_embedding = self.embedding_model.encode([query])[0]

        # Rechercher les documents similaires
        results = self.collection.query(
            query_embeddings=[query_embedding.tolist()],
            n_results=top_k,
        )

        # Formater les résultats
        retrieved_docs = []
        if results["ids"] and len(results["ids"]) > 0:
            for i, doc_id in enumerate(results["ids"][0]):
                distance = results["distances"][0][i] if results["distances"] else 0
                similarity = 1 - distance  # Convertir la distance en similarité

                # Filtrer par seuil de similarité
                if similarity >= RAG_CONFIG["similarity_threshold"]:
                    retrieved_docs.append({
                        "id": doc_id,
                        "text": results["documents"][0][i],
                        "metadata": results["metadatas"][0][i],
                        "similarity": float(similarity),
                    })

        logger.info(f"Documents récupérés: {len(retrieved_docs)}/{top_k}")
        return retrieved_docs

    def generate_response(
        self,
        query: str,
        context_docs: List[Dict[str, str]]
    ) -> Dict[str, Any]:
        """
        Générer une réponse basée sur la requête et les documents de contexte.

        Args:
            query: Question de l'utilisateur
            context_docs: Documents pertinents récupérés

        Returns:
            Dictionnaire avec 'response' et 'sources'
        """
        # Construire le contexte
        context = self._build_context(context_docs)

        # Générer la réponse
        if self.llm_pipeline:
            response = self._generate_with_llm(query, context)
        else:
            response = self._generate_with_template(query, context)

        # Extraire les sources
        sources = [
            {
                "title": doc.get("metadata", {}).get("title", "Source"),
                "url": doc.get("metadata", {}).get("url", ""),
                "similarity": doc.get("similarity", 0),
            }
            for doc in context_docs
        ]

        return {
            "response": response,
            "sources": sources,
            "context_used": len(context_docs) > 0,
        }

    def _build_context(self, docs: List[Dict[str, str]]) -> str:
        """Construire une chaîne de contexte à partir des documents."""
        if not docs:
            return ""

        context_parts = []
        for i, doc in enumerate(docs, 1):
            context_parts.append(f"Document {i}:\n{doc['text']}")

        return "\n\n".join(context_parts)

    def _generate_with_llm(self, query: str, context: str) -> str:
        """Générer une réponse avec le pipeline LLM."""
        try:
            prompt = f"""Contexte:
{context}

Question: {query}

Réponse basée sur le contexte:"""

            output = self.llm_pipeline(
                prompt,
                max_length=RAG_CONFIG.get("max_tokens", 512),
                num_return_sequences=1,
                temperature=LLM_GENERATION_CONFIG.get("temperature", 0.7),
                top_p=LLM_GENERATION_CONFIG.get("top_p", 0.9),
            )

            response = output[0]["generated_text"].replace(prompt, "").strip()
            return response
        except Exception as e:
            logger.error(f"Erreur lors de la génération LLM: {e}")
            return self._generate_with_template(query, context)

    def _generate_with_template(self, query: str, context: str) -> str:
        """Générer une réponse simple basée sur des templates."""
        if not context:
            return self._generate_fallback_response(query)

        # Réponse simple basée sur le contexte
        return f"Basé sur les informations disponibles: {context[:200]}..."

    def _generate_fallback_response(self, query: str) -> str:
        """Générer une réponse de secours pour les questions sans contexte."""
        # Réponses générales pour les questions conversationnelles
        general_responses = {
            "bonjour": "Bonjour! Je suis votre assistant touristique pour le Burkina Faso. Comment puis-je vous aider?",
            "salut": "Salut! Bienvenue. Je suis ici pour répondre à vos questions sur le tourisme au Burkina Faso.",
            "merci": "De rien! N'hésitez pas à me poser d'autres questions.",
            "au revoir": "Au revoir! Bon voyage au Burkina Faso!",
        }

        query_lower = query.lower().strip()
        for key, response in general_responses.items():
            if key in query_lower:
                return response

        return "Je ne dispose pas d'informations spécifiques sur ce sujet. Pouvez-vous poser une question relative au tourisme au Burkina Faso?"

    def chat(self, query: str) -> Dict[str, Any]:
        """
        Effectuer un cycle complet de chat RAG.

        Pipeline:
        1. Récupérer les documents pertinents
        2. Générer une réponse basée sur le contexte
        3. Retourner la réponse avec les sources

        Args:
            query: Question de l'utilisateur

        Returns:
            Dictionnaire avec 'response', 'sources', 'context_used'
        """
        logger.info(f"Traitement de la requête: {query}")

        # Étape 1: Récupération (Retrieval)
        retrieved_docs = self.retrieve_documents(query)

        # Étape 2: Génération (Generation)
        result = self.generate_response(query, retrieved_docs)

        # Ajouter des métadonnées
        result["query"] = query
        result["num_sources"] = len(retrieved_docs)

        logger.info(f"Réponse générée avec {len(retrieved_docs)} sources")
        return result

    def load_corpus(self, corpus_path: str = str(CORPUS_PATH)) -> None:
        """
        Charger le corpus de données depuis un fichier JSON.

        Format attendu:
        [
            {
                "id": "doc_1",
                "text": "Contenu du document...",
                "metadata": {
                    "title": "Titre",
                    "url": "https://...",
                    "category": "tourisme"
                }
            },
            ...
        ]

        Args:
            corpus_path: Chemin vers le fichier corpus.json
        """
        try:
            with open(corpus_path, 'r', encoding='utf-8') as f:
                documents = json.load(f)

            logger.info(f"Corpus chargé: {len(documents)} documents")
            self.add_documents(documents)
        except FileNotFoundError:
            logger.warning(f"Corpus non trouvé à {corpus_path}")
        except json.JSONDecodeError:
            logger.error(f"Erreur de décodage JSON dans {corpus_path}")

    def clear_database(self) -> None:
        """Vider la base de données vectorielle."""
        try:
            self.chroma_client.delete_collection(name="burkina_tourisme")
            self.collection = self.chroma_client.create_collection(
                name="burkina_tourisme",
                metadata={"hnsw:space": "cosine"}
            )
            logger.info("Base de données vidée avec succès")
        except Exception as e:
            logger.error(f"Erreur lors du vidage de la base de données: {e}")
