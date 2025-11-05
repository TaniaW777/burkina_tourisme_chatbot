/**
 * Application Burkina Tourisme Chatbot
 * 
 * Logique du chatbot et gestion PWA
 * - Communication avec l'API backend
 * - Gestion des messages
 * - Stockage local (IndexedDB)
 * - Service Worker et fonctionnalités offline
 */

// Configuration
const CONFIG = {
  API_BASE_URL: process.env.API_BASE_URL || 'http://localhost:8000',
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000,
};

// État global de l'application
const appState = {
  messages: [],
  isLoading: false,
  isOnline: navigator.onLine,
  db: null,
  pendingMessages: [],
};

/**
 * Initialiser l'application
 */
async function initApp() {
  console.log('Initialisation de l\'application...');
  
  // Enregistrer le Service Worker
  await registerServiceWorker();
  
  // Initialiser IndexedDB
  await initIndexedDB();
  
  // Configurer les écouteurs d'événements
  setupEventListeners();
  
  // Charger les messages sauvegardés
  await loadSavedMessages();
  
  // Vérifier la connexion
  updateOnlineStatus();
  
  // Initialiser le corpus
  await initializeCorpus();
  
  console.log('Application initialisée');
}

/**
 * Enregistrer le Service Worker
 */
async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    console.warn('Service Worker non supporté');
    return;
  }
  
  try {
    const registration = await navigator.serviceWorker.register('/service-worker.js', {
      scope: '/',
    });
    
    console.log('Service Worker enregistré:', registration);
    
    // Vérifier les mises à jour
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          showUpdateNotification();
        }
      });
    });
  } catch (error) {
    console.error('Erreur lors de l\'enregistrement du Service Worker:', error);
  }
}

/**
 * Initialiser IndexedDB
 */
async function initIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('BurkinaTourismeDB', 1);
    
    request.onerror = () => {
      console.error('Erreur IndexedDB:', request.error);
      reject(request.error);
    };
    
    request.onsuccess = () => {
      appState.db = request.result;
      console.log('IndexedDB initialisé');
      resolve();
    };
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Créer les object stores
      if (!db.objectStoreNames.contains('messages')) {
        const messageStore = db.createObjectStore('messages', { keyPath: 'id', autoIncrement: true });
        messageStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
      
      if (!db.objectStoreNames.contains('pendingMessages')) {
        db.createObjectStore('pendingMessages', { keyPath: 'id', autoIncrement: true });
      }
    };
  });
}

/**
 * Configurer les écouteurs d'événements
 */
function setupEventListeners() {
  const inputField = document.getElementById('messageInput');
  const sendButton = document.getElementById('sendButton');
  
  // Bouton d'envoi
  sendButton.addEventListener('click', handleSendMessage);
  
  // Entrée au clavier
  inputField.addEventListener('keypress', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  });
  
  // Redimensionnement automatique de la zone de texte
  inputField.addEventListener('input', () => {
    inputField.style.height = 'auto';
    inputField.style.height = Math.min(inputField.scrollHeight, 120) + 'px';
  });
  
  // Événements de connectivité
  window.addEventListener('online', () => {
    appState.isOnline = true;
    updateOnlineStatus();
    syncPendingMessages();
  });
  
  window.addEventListener('offline', () => {
    appState.isOnline = false;
    updateOnlineStatus();
  });
  
  // Boutons d'action
  const clearButton = document.getElementById('clearButton');
  if (clearButton) {
    clearButton.addEventListener('click', clearChat);
  }
}

/**
 * Gérer l'envoi de message
 */
async function handleSendMessage() {
  const inputField = document.getElementById('messageInput');
  const message = inputField.value.trim();
  
  if (!message) return;
  
  // Ajouter le message utilisateur
  addMessage(message, 'user');
  inputField.value = '';
  inputField.style.height = 'auto';
  
  // Sauvegarder le message
  await saveMessage(message, 'user');
  
  // Afficher l'indicateur de saisie
  showTypingIndicator();
  
  // Envoyer la requête
  if (appState.isOnline) {
    await sendChatRequest(message);
  } else {
    // Sauvegarder pour synchronisation ultérieure
    await savePendingMessage(message);
    addMessage('Vous êtes hors ligne. Votre message sera envoyé quand la connexion sera rétablie.', 'bot');
  }
}

/**
 * Envoyer une requête de chat à l'API
 */
async function sendChatRequest(query, retryCount = 0) {
  try {
    const response = await fetch(`${CONFIG.API_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });
    
    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Supprimer l'indicateur de saisie
    removeTypingIndicator();
    
    // Ajouter la réponse
    addMessage(data.response, 'bot', data.sources);
    
    // Sauvegarder la réponse
    await saveMessage(data.response, 'bot', data.sources);
  } catch (error) {
    console.error('Erreur lors de la requête:', error);
    removeTypingIndicator();
    
    if (retryCount < CONFIG.MAX_RETRIES) {
      console.log(`Nouvelle tentative (${retryCount + 1}/${CONFIG.MAX_RETRIES})...`);
      await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY));
      await sendChatRequest(query, retryCount + 1);
    } else {
      addMessage('Erreur: Impossible de se connecter au serveur. Veuillez vérifier votre connexion.', 'bot');
    }
  }
}

/**
 * Ajouter un message à l'interface
 */
function addMessage(text, sender, sources = []) {
  const messagesContainer = document.getElementById('messagesContainer');
  
  const messageElement = document.createElement('div');
  messageElement.className = `message ${sender}`;
  
  const contentElement = document.createElement('div');
  contentElement.className = 'message-content';
  contentElement.textContent = text;
  
  messageElement.appendChild(contentElement);
  
  // Ajouter les sources si disponibles
  if (sources && sources.length > 0) {
    const sourcesElement = document.createElement('div');
    sourcesElement.className = 'message-sources';
    sourcesElement.innerHTML = '<strong>Sources:</strong>';
    
    sources.forEach((source) => {
      const sourceItem = document.createElement('div');
      sourceItem.className = 'source-item';
      sourceItem.innerHTML = `
        <div class="source-title">${escapeHtml(source.title)}</div>
        ${source.url ? `<div><a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">Lien</a></div>` : ''}
        ${source.similarity ? `<div class="source-similarity">Similarité: ${(source.similarity * 100).toFixed(0)}%</div>` : ''}
      `;
      sourcesElement.appendChild(sourceItem);
    });
    
    contentElement.appendChild(sourcesElement);
  }
  
  messagesContainer.appendChild(messageElement);
  
  // Scroller vers le bas
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

/**
 * Afficher l'indicateur de saisie
 */
function showTypingIndicator() {
  const messagesContainer = document.getElementById('messagesContainer');
  
  const typingElement = document.createElement('div');
  typingElement.id = 'typingIndicator';
  typingElement.className = 'message bot';
  typingElement.innerHTML = `
    <div class="message-content">
      <div class="typing-indicator">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    </div>
  `;
  
  messagesContainer.appendChild(typingElement);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

/**
 * Supprimer l'indicateur de saisie
 */
function removeTypingIndicator() {
  const typingElement = document.getElementById('typingIndicator');
  if (typingElement) {
    typingElement.remove();
  }
}

/**
 * Sauvegarder un message dans IndexedDB
 */
async function saveMessage(text, sender, sources = []) {
  if (!appState.db) return;
  
  return new Promise((resolve, reject) => {
    const transaction = appState.db.transaction(['messages'], 'readwrite');
    const store = transaction.objectStore('messages');
    
    const message = {
      text,
      sender,
      sources,
      timestamp: Date.now(),
    };
    
    const request = store.add(message);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

/**
 * Charger les messages sauvegardés
 */
async function loadSavedMessages() {
  if (!appState.db) return;
  
  return new Promise((resolve, reject) => {
    const transaction = appState.db.transaction(['messages'], 'readonly');
    const store = transaction.objectStore('messages');
    const index = store.index('timestamp');
    const request = index.getAll();
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const messages = request.result;
      messages.forEach((msg) => {
        addMessage(msg.text, msg.sender, msg.sources);
      });
      appState.messages = messages;
      resolve();
    };
  });
}

/**
 * Sauvegarder un message en attente
 */
async function savePendingMessage(query) {
  if (!appState.db) return;
  
  return new Promise((resolve, reject) => {
    const transaction = appState.db.transaction(['pendingMessages'], 'readwrite');
    const store = transaction.objectStore('pendingMessages');
    
    const message = {
      query,
      timestamp: Date.now(),
    };
    
    const request = store.add(message);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

/**
 * Synchroniser les messages en attente
 */
async function syncPendingMessages() {
  if (!appState.db) return;
  
  return new Promise((resolve, reject) => {
    const transaction = appState.db.transaction(['pendingMessages'], 'readonly');
    const store = transaction.objectStore('pendingMessages');
    const request = store.getAll();
    
    request.onerror = () => reject(request.error);
    request.onsuccess = async () => {
      const pendingMessages = request.result;
      
      for (const msg of pendingMessages) {
        await sendChatRequest(msg.query);
        
        // Supprimer le message après l'envoi
        const deleteTransaction = appState.db.transaction(['pendingMessages'], 'readwrite');
        const deleteStore = deleteTransaction.objectStore('pendingMessages');
        deleteStore.delete(msg.id);
      }
      
      resolve();
    };
  });
}

/**
 * Mettre à jour le statut en ligne/hors ligne
 */
function updateOnlineStatus() {
  const header = document.querySelector('.header');
  
  if (appState.isOnline) {
    header.style.borderBottom = 'none';
    console.log('Connecté');
  } else {
    header.style.borderBottom = '3px solid var(--color-secondary)';
    console.log('Hors ligne');
  }
}

/**
 * Initialiser le corpus
 */
async function initializeCorpus() {
  try {
    const response = await fetch(`${CONFIG.API_BASE_URL}/api/init`, {
      method: 'POST',
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('Corpus initialisé:', data);
    }
  } catch (error) {
    console.warn('Erreur lors de l\'initialisation du corpus:', error);
  }
}

/**
 * Effacer la conversation
 */
async function clearChat() {
  if (!confirm('Êtes-vous sûr de vouloir effacer la conversation?')) return;
  
  // Effacer les messages de l'interface
  const messagesContainer = document.getElementById('messagesContainer');
  messagesContainer.innerHTML = '';
  
  // Effacer les messages de IndexedDB
  if (appState.db) {
    const transaction = appState.db.transaction(['messages'], 'readwrite');
    const store = transaction.objectStore('messages');
    store.clear();
  }
  
  appState.messages = [];
}

/**
 * Afficher une notification de mise à jour
 */
function showUpdateNotification() {
  const notification = document.createElement('div');
  notification.className = 'notification update-notification';
  notification.innerHTML = `
    <div>Une nouvelle version est disponible</div>
    <button onclick="location.reload()">Mettre à jour</button>
  `;
  document.body.appendChild(notification);
}

/**
 * Échapper les caractères HTML
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Vérifier le support des fonctionnalités
 */
function checkFeatureSupport() {
  const features = {
    serviceWorker: 'serviceWorker' in navigator,
    indexedDB: !!window.indexedDB,
    notification: 'Notification' in window,
    vibration: 'vibrate' in navigator,
    share: 'share' in navigator,
  };
  
  console.log('Support des fonctionnalités:', features);
  return features;
}

/**
 * Partager l'application
 */
async function shareApp() {
  if (!navigator.share) {
    alert('Partage non supporté sur ce navigateur');
    return;
  }
  
  try {
    await navigator.share({
      title: 'Burkina Tourisme Chatbot',
      text: 'Découvrez les merveilles du Burkina Faso avec notre assistant IA!',
      url: window.location.href,
    });
  } catch (error) {
    console.error('Erreur lors du partage:', error);
  }
}

/**
 * Demander la permission de notification
 */
async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    console.warn('Notifications non supportées');
    return;
  }
  
  if (Notification.permission === 'granted') {
    return;
  }
  
  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      console.log('Notifications activées');
    }
  }
}

/**
 * Envoyer une notification
 */
function sendNotification(title, options = {}) {
  if (Notification.permission === 'granted') {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'SHOW_NOTIFICATION',
        title,
        options,
      });
    } else {
      new Notification(title, options);
    }
  }
}

// Initialiser l'application au chargement
document.addEventListener('DOMContentLoaded', initApp);

// Exporter les fonctions pour utilisation globale
window.appFunctions = {
  clearChat,
  shareApp,
  requestNotificationPermission,
  sendNotification,
  checkFeatureSupport,
};
