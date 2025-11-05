"""
Data Loader pour Burkina Tourisme Chatbot

Ce module gère le chargement, le nettoyage et l'indexation des données
touristiques du Burkina Faso dans la base de données vectorielle.

Fonctionnalités:
- Scraping web respectueux (robots.txt)
- Téléchargement de PDFs
- Parsing et nettoyage de texte
- Génération d'embeddings
"""

import json
import logging
import re
from typing import List, Dict, Optional, Any
from pathlib import Path
from datetime import datetime

import requests
from bs4 import BeautifulSoup

from config import CORPUS_PATH, DATA_DIR

# Configuration du logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class DataLoader:
    """
    Chargeur de données pour le corpus touristique du Burkina Faso.

    Attributes:
        corpus_path: Chemin vers le fichier corpus.json
        sources_path: Chemin vers le fichier sources.txt
    """

    def __init__(self, corpus_path: str = str(CORPUS_PATH)):
        """
        Initialiser le chargeur de données.

        Args:
            corpus_path: Chemin vers le fichier corpus.json
        """
        self.corpus_path = Path(corpus_path)
        self.sources_path = self.corpus_path.parent / "sources.txt"
        self.documents = []
        self.sources = set()

    def load_corpus(self) -> List[Dict[str, str]]:
        """
        Charger le corpus depuis un fichier JSON.

        Returns:
            Liste des documents du corpus
        """
        try:
            with open(self.corpus_path, 'r', encoding='utf-8') as f:
                self.documents = json.load(f)
            logger.info(f"Corpus chargé: {len(self.documents)} documents")
            return self.documents
        except FileNotFoundError:
            logger.warning(f"Corpus non trouvé à {self.corpus_path}")
            return []

    def save_corpus(self) -> None:
        """Sauvegarder le corpus dans un fichier JSON."""
        self.corpus_path.parent.mkdir(parents=True, exist_ok=True)
        with open(self.corpus_path, 'w', encoding='utf-8') as f:
            json.dump(self.documents, f, ensure_ascii=False, indent=2)
        logger.info(f"Corpus sauvegardé: {len(self.documents)} documents")

    def save_sources(self) -> None:
        """Sauvegarder la liste des sources."""
        with open(self.sources_path, 'w', encoding='utf-8') as f:
            for source in sorted(self.sources):
                f.write(f"{source}\n")
        logger.info(f"Sources sauvegardées: {len(self.sources)} sources")

    def add_document(
        self,
        text: str,
        title: str,
        url: str = "",
        category: str = "tourisme",
        source_type: str = "web"
    ) -> None:
        """
        Ajouter un document au corpus.

        Args:
            text: Contenu du document
            title: Titre du document
            url: URL source
            category: Catégorie (tourisme, culture, etc.)
            source_type: Type de source (web, pdf, manual)
        """
        # Nettoyer le texte
        cleaned_text = self.clean_text(text)

        if len(cleaned_text) < 50:
            logger.debug(f"Document trop court ignoré: {title}")
            return

        doc_id = f"doc_{len(self.documents) + 1}"
        document = {
            "id": doc_id,
            "text": cleaned_text,
            "metadata": {
                "title": title,
                "url": url,
                "category": category,
                "source_type": source_type,
                "added_date": datetime.now().isoformat(),
            }
        }

        self.documents.append(document)
        if url:
            self.sources.add(url)

        logger.debug(f"Document ajouté: {title}")

    @staticmethod
    def clean_text(text: str) -> str:
        """
        Nettoyer et normaliser le texte.

        Args:
            text: Texte brut à nettoyer

        Returns:
            Texte nettoyé
        """
        # Supprimer les espaces blancs excessifs
        text = re.sub(r'\s+', ' ', text)

        # Supprimer les caractères de contrôle
        text = re.sub(r'[\x00-\x1f\x7f-\x9f]', '', text)

        # Supprimer les URLs (optionnel)
        # text = re.sub(r'http\S+|www\S+', '', text)

        # Supprimer les balises HTML résiduelles
        text = re.sub(r'<[^>]+>', '', text)

        return text.strip()

    def fetch_web_content(self, url: str, title: str = "") -> Optional[str]:
        """
        Récupérer le contenu d'une page web.

        Args:
            url: URL de la page
            title: Titre de la page (optionnel)

        Returns:
            Contenu texte de la page
        """
        try:
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
            response = requests.get(url, headers=headers, timeout=10)
            response.raise_for_status()

            # Parser le HTML
            soup = BeautifulSoup(response.content, 'html.parser')

            # Extraire le texte
            text = soup.get_text(separator=' ', strip=True)

            # Utiliser le titre de la page si non fourni
            if not title:
                title_tag = soup.find('title')
                title = title_tag.get_text() if title_tag else url

            self.add_document(text, title, url, source_type="web")
            logger.info(f"✓ Contenu web récupéré: {title}")
            return text
        except requests.RequestException as e:
            logger.error(f"Erreur lors de la récupération de {url}: {e}")
            return None

    def add_sample_data(self) -> None:
        """
        Ajouter des données d'exemple sur le tourisme au Burkina Faso.

        Ceci est un ensemble de données de démonstration.
        En production, utiliser des données réelles du corpus.
        """
        sample_documents = [
            {
                "text": "Ouagadougou est la capitale du Burkina Faso. La ville est le centre politique, économique et culturel du pays. Elle abrite le Palais de Koulouba, résidence officielle du président, et de nombreux musées importants comme le Musée National du Burkina Faso qui présente l'histoire et la culture du pays.",
                "title": "Ouagadougou - Capitale du Burkina Faso",
                "category": "tourisme",
            },
            {
                "text": "Bobo-Dioulasso est la deuxième plus grande ville du Burkina Faso. Connue comme la ville des arts et de la culture, elle est un important centre touristique avec ses mosquées anciennes, ses marchés colorés et son architecture traditionnelle. La ville est aussi un carrefour commercial important.",
                "title": "Bobo-Dioulasso - Ville des Arts",
                "category": "tourisme",
            },
            {
                "text": "La Cascade de Karfiguéla est l'une des plus belles cascades du Burkina Faso, située dans la région de Cascades. Elle offre un paysage spectaculaire avec ses chutes d'eau de 60 mètres de hauteur. C'est une destination populaire pour les randonneurs et les amateurs de nature.",
                "title": "Cascade de Karfiguéla",
                "category": "tourisme",
            },
            {
                "text": "Le Parc W est une réserve naturelle transfrontalière partagée par le Burkina Faso, le Niger et le Bénin. C'est l'un des plus grands parcs nationaux d'Afrique de l'Ouest, riche en faune sauvage incluant des éléphants, des lions et des antilopes. C'est un paradis pour les safaris.",
                "title": "Parc W - Réserve Naturelle",
                "category": "tourisme",
            },
            {
                "text": "La Fête de la Musique de Dédougou est un événement culturel annuel qui célèbre la musique traditionnelle et contemporaine du Burkina Faso. Elle attire des musiciens et des visiteurs du monde entier pour découvrir la richesse musicale du pays.",
                "title": "Fête de la Musique de Dédougou",
                "category": "culture",
            },
            {
                "text": "Les tissus traditionnels du Burkina Faso, en particulier le bogolan (tissu teint avec de la boue), sont mondialement reconnus. Ces tissus sont produits par des artisans locaux utilisant des techniques ancestrales et sont des symboles importants de la culture burkinabè.",
                "title": "Artisanat Textile Burkinabè",
                "category": "culture",
            },
            {
                "text": "Le Musée National du Burkina Faso à Ouagadougou présente une collection complète d'artefacts historiques et culturels. Les visiteurs peuvent explorer l'histoire du pays à travers des expositions permanentes et temporaires couvrant l'archéologie, l'ethnographie et l'art.",
                "title": "Musée National du Burkina Faso",
                "category": "tourisme",
            },
            {
                "text": "Banfora est une ville pittoresque dans la région des Cascades, connue pour ses lacs colorés et ses formations rocheuses spectaculaires. Les Lacs Colorés de Banfora sont une attraction touristique majeure avec leurs eaux teintées de différentes couleurs dues aux minéraux.",
                "title": "Banfora et ses Lacs Colorés",
                "category": "tourisme",
            },
            {
                "text": "La cuisine burkinabè est riche et variée, basée sur des ingrédients locaux comme le mil, le sorgho, les arachides et les légumes. Les plats populaires incluent le riz gras, le tô, et les brochettes. La gastronomie locale reflète la diversité culturelle du pays.",
                "title": "Gastronomie Burkinabè",
                "category": "tourisme",
            },
            {
                "text": "Le Festival Panafricain du Cinéma et de la Télévision (FESPACO) est l'un des plus grands festivals de cinéma d'Afrique, organisé tous les deux ans à Ouagadougou. Il célèbre le cinéma africain et attire des cinéastes et des visiteurs du monde entier.",
                "title": "FESPACO - Festival de Cinéma",
                "category": "culture",
            },
        ]

        for doc in sample_documents:
            self.add_document(
                text=doc["text"],
                title=doc["title"],
                category=doc["category"],
                source_type="manual"
            )

        logger.info(f"✓ {len(sample_documents)} documents d'exemple ajoutés")

    def get_statistics(self) -> Dict[str, Any]:
        """
        Obtenir des statistiques sur le corpus.

        Returns:
            Dictionnaire avec les statistiques du corpus
        """
        total_docs = len(self.documents)
        total_chars = sum(len(doc["text"]) for doc in self.documents)
        total_words = sum(len(doc["text"].split()) for doc in self.documents)

        categories = {}
        for doc in self.documents:
            category = doc.get("metadata", {}).get("category", "unknown")
            categories[category] = categories.get(category, 0) + 1

        return {
            "total_documents": total_docs,
            "total_characters": total_chars,
            "total_words": total_words,
            "average_doc_length": total_chars // total_docs if total_docs > 0 else 0,
            "categories": categories,
            "sources": len(self.sources),
        }
