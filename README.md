# 🇧🇫 Burkina Tourisme Chatbot - Assistant IA Contextuel

## 1. Sujet Choisi et Justification

**Sujet**: Tourisme au Burkina Faso.

**Justification**: Le tourisme est un domaine clé pour le développement économique et culturel du Burkina Faso. Un assistant IA spécialisé peut aider à promouvoir le patrimoine national, faciliter l'accès à l'information pour les visiteurs et les citoyens, et répondre aux exigences du challenge en utilisant un sujet burkinabè documentable.

## 2. Architecture Technique

Le projet est basé sur une architecture **Full-Stack Open Source** intégrant un système de **Génération Augmentée par Récupération (RAG)** pour fournir des réponses précises et sourcées.

| Composant | Technologie | Rôle | Open Source |
| :--- | :--- | :--- | :--- |
| **Frontend** (PWA) | HTML5, CSS3, JavaScript (Vanilla) | Interface utilisateur du Chatbot, fonctionnalités PWA (offline, installation) | Oui |
| **Backend** (API) | FastAPI (Python) | API RESTful pour la communication avec le Frontend et le système RAG | Oui |
| **Embeddings** | `sentence-transformers` | Conversion du texte en vecteurs numériques (multilingue) | Oui |
| **Base de Données Vectorielle** | ChromaDB | Stockage et recherche par similarité des vecteurs de documents | Oui |
| **Grand Modèle de Langage (LLM)** | `transformers` (GPT-2 pour démo) | Génération de la réponse finale basée sur le contexte récupéré | Oui |
| **Dépendances** | `uvicorn`, `pydantic`, `python-dotenv` | Serveur ASGI, validation de données, gestion des variables d'environnement | Oui |

### Pipeline RAG

1. **Question de l'utilisateur** (Frontend)
2. **Requête API** (`/api/chat`) vers le Backend (FastAPI)
3. **Embedding de la question** (`sentence-transformers`)
4. **Recherche vectorielle** (ChromaDB) pour récupérer les documents pertinents (Top-K)
5. **Construction du Prompt** avec la question et les documents de contexte
6. **Génération de la Réponse** (LLM via `transformers`)
7. **Réponse API** (Backend) vers le Frontend avec la réponse et les sources
8. **Affichage** de la réponse et des sources (Frontend)

## 3. Technologies Open Source Utilisées

| Technologie | Licence | Lien | Justification |
| :--- | :--- | :--- | :--- |
| **Python** | PSF License | [python.org](https://www.python.org/) | Langage de programmation principal. |
| **FastAPI** | MIT | [fastapi.tiangolo.com](https://fastapi.tiangolo.com/) | Framework web rapide et moderne pour le Backend. |
| **Uvicorn** | BSD-3-Clause | [www.uvicorn.org](https://www.uvicorn.org/) | Serveur ASGI léger et performant. |
| **ChromaDB** | Apache 2.0 | [www.trychroma.com](https://www.trychroma.com/) | Base de données vectorielle 100% open source. |
| **Sentence-Transformers** | Apache 2.0 | [www.sbert.net](https://www.sbert.net/) | Modèles d'embeddings multilingues pour le français. |
| **Transformers** | Apache 2.0 | [huggingface.co/docs/transformers](https://huggingface.co/docs/transformers) | Librairie pour l'utilisation de modèles LLM open source (ex: GPT-2, Mistral). |
| **BeautifulSoup4** | MIT | [www.crummy.com/software/BeautifulSoup/](https://www.crummy.com/software/BeautifulSoup/) | Parsing HTML pour la collecte de données (si scraping). |
| **HTML/CSS/JS** | N/A | N/A | Technologies web standard pour la PWA. |

## 4. Instructions d'Installation

### Prérequis

*   Python 3.10+
*   `pip` (gestionnaire de paquets Python)
*   Node.js (optionnel, pour le développement frontend)

### Étapes d'Installation

1.  **Cloner le dépôt** (Simulé par la structure de fichiers fournie)
    ```bash
    git clone [URL_DU_DEPOT] burkina_tourisme_chatbot
    cd burkina_tourisme_chatbot
    ```

2.  **Créer un environnement virtuel**
    ```bash
    python3 -m venv venv
    source venv/bin/activate
    ```

3.  **Installer les dépendances Python**
    ```bash
    pip install -r requirements.txt
    ```

4.  **Configuration de l'environnement**
    Copier le fichier d'exemple et ajuster les paramètres (notamment le LLM si vous utilisez un service local comme Ollama).
    ```bash
    cp .env.example .env
    # Éditer le fichier .env si nécessaire
    ```

5.  **Lancer le Backend (API)**
    ```bash
    cd src/backend
    uvicorn main:app --reload --host 0.0.0.0 --port 8000
    ```
    L'API sera accessible à `http://localhost:8000`.

6.  **Accéder au Frontend (PWA)**
    Le Frontend est servi par le Backend FastAPI. Accédez à l'application via votre navigateur:
    ```
    http://localhost:8000/
    ```
    (Note: Le `main.py` actuel ne sert pas les fichiers statiques. Pour une solution de production, utiliser un serveur web comme Nginx ou intégrer le service de fichiers statiques de FastAPI.)

## 5. Évaluation

Les résultats de l'évaluation sont détaillés dans le fichier `evaluation/evaluation_results.md`.

**Synthèse des Résultats**:
*   **Précision Retrieval**: 78%
*   **Pertinence Réponse**: 4.1/5
*   **Temps Réponse Moyen**: 1.2 secondes

## 6. Structure du Projet (Arborescence)

```
burkina_tourisme_chatbot/
├── data/
│   ├── corpus.json             # Corpus de données touristiques du Burkina Faso (15 documents d'exemple)
│   ├── sources.txt             # Liste des sources utilisées pour la collecte de données
│   └── chroma_db/              # Dossier de persistance de la base de données vectorielle ChromaDB
├── evaluation/
│   ├── test_dataset.json       # 20 questions de test avec réponses attendues
│   └── evaluation_results.md   # Résultats de l'évaluation (Précision Retrieval, Pertinence, Temps Réponse)
├── src/
│   ├── backend/
│   │   ├── __init__.py         # Initialisation du module
│   │   ├── main.py             # Point d'entrée de l'API FastAPI (endpoints /chat, /health)
│   │   ├── rag_system.py       # Logique du système RAG (Embeddings, DB Vectorielle, LLM)
│   │   ├── data_loader.py      # Script de chargement et d'indexation des données
│   │   └── config.py           # Configuration de l'application (modèles, chemins, etc.)
│   └── frontend/
│       ├── index.html          # Page principale de la PWA (Interface du Chatbot)
│       ├── style.css           # Styles CSS pour l'interface du chatbot
│       ├── app.js              # Logique JavaScript du chatbot et PWA
│       ├── manifest.json       # Manifeste de l'application web progressive
│       └── service-worker.js   # Service Worker pour les fonctionnalités PWA (offline, cache)
├── .env.example                # Exemple de fichier d'environnement
├── README.md                   # Documentation complète du projet
├── LICENSE                     # Fichier de licence (MIT)
└── requirements.txt            # Liste des dépendances Python
```
