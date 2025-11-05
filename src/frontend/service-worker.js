/**
 * Service Worker pour Burkina Tourisme Chatbot
 * 
 * Gère:
 * - Mise en cache des ressources
 * - Fonctionnement hors ligne
 * - Synchronisation en arrière-plan
 * - Notifications push
 */

const CACHE_NAME = 'burkina-tourisme-v1';
const RUNTIME_CACHE = 'burkina-tourisme-runtime';
const API_CACHE = 'burkina-tourisme-api';

// Ressources essentielles à mettre en cache
const ESSENTIAL_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/manifest.json',
];

/**
 * Événement d'installation du Service Worker
 * Mettre en cache les ressources essentielles
 */
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installation en cours...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Mise en cache des ressources essentielles');
        return cache.addAll(ESSENTIAL_ASSETS);
      })
      .then(() => self.skipWaiting())
      .catch((error) => {
        console.error('[Service Worker] Erreur lors de l\'installation:', error);
      })
  );
});

/**
 * Événement d'activation du Service Worker
 * Nettoyer les anciens caches
 */
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activation en cours...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME && 
                cacheName !== RUNTIME_CACHE && 
                cacheName !== API_CACHE) {
              console.log('[Service Worker] Suppression du cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

/**
 * Événement de récupération (Fetch)
 * Stratégie: Cache First pour les assets, Network First pour l'API
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorer les requêtes non-GET
  if (request.method !== 'GET') {
    return;
  }

  // Stratégie pour les requêtes API
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstStrategy(request));
    return;
  }

  // Stratégie pour les assets statiques
  event.respondWith(cacheFirstStrategy(request));
});

/**
 * Stratégie Network First
 * Essayer le réseau d'abord, puis le cache en cas d'échec
 */
async function networkFirstStrategy(request) {
  try {
    const response = await fetch(request);
    
    // Mettre en cache les réponses réussies
    if (response.ok) {
      const cache = await caches.open(API_CACHE);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    console.log('[Service Worker] Requête réseau échouée, utilisation du cache');
    
    // Retourner la réponse en cache si disponible
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Retourner une réponse d'erreur hors ligne
    return new Response(
      JSON.stringify({
        error: 'Vous êtes hors ligne',
        message: 'Veuillez vérifier votre connexion Internet',
      }),
      {
        status: 503,
        statusText: 'Service Unavailable',
        headers: new Headers({
          'Content-Type': 'application/json',
        }),
      }
    );
  }
}

/**
 * Stratégie Cache First
 * Utiliser le cache d'abord, puis le réseau
 */
async function cacheFirstStrategy(request) {
  // Chercher dans le cache
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const response = await fetch(request);
    
    // Mettre en cache les réponses réussies
    if (response.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    console.error('[Service Worker] Erreur de récupération:', error);
    
    // Retourner une page hors ligne si disponible
    const offlinePage = await caches.match('/');
    if (offlinePage) {
      return offlinePage;
    }
    
    return new Response('Ressource non disponible', { status: 404 });
  }
}

/**
 * Événement de message
 * Communiquer avec le client
 */
self.addEventListener('message', (event) => {
  console.log('[Service Worker] Message reçu:', event.data);
  
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data.type === 'CLEAR_CACHE') {
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => caches.delete(cacheName))
      );
    });
  }
});

/**
 * Événement de synchronisation en arrière-plan
 * Synchroniser les messages en attente quand la connexion est rétablie
 */
self.addEventListener('sync', (event) => {
  console.log('[Service Worker] Synchronisation en arrière-plan:', event.tag);
  
  if (event.tag === 'sync-messages') {
    event.waitUntil(syncPendingMessages());
  }
});

/**
 * Synchroniser les messages en attente
 */
async function syncPendingMessages() {
  try {
    // Récupérer les messages en attente du stockage local
    const db = await openIndexedDB();
    const pendingMessages = await getPendingMessages(db);
    
    // Envoyer les messages au serveur
    for (const message of pendingMessages) {
      try {
        await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(message),
        });
        
        // Supprimer le message après l'envoi réussi
        await deletePendingMessage(db, message.id);
      } catch (error) {
        console.error('Erreur lors de l\'envoi du message:', error);
      }
    }
  } catch (error) {
    console.error('Erreur lors de la synchronisation:', error);
  }
}

/**
 * Ouvrir la base de données IndexedDB
 */
function openIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('BurkinaTourismeDB', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('pendingMessages')) {
        db.createObjectStore('pendingMessages', { keyPath: 'id' });
      }
    };
  });
}

/**
 * Récupérer les messages en attente
 */
function getPendingMessages(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['pendingMessages'], 'readonly');
    const store = transaction.objectStore('pendingMessages');
    const request = store.getAll();
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

/**
 * Supprimer un message en attente
 */
function deletePendingMessage(db, messageId) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['pendingMessages'], 'readwrite');
    const store = transaction.objectStore('pendingMessages');
    const request = store.delete(messageId);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

/**
 * Événement de notification push
 */
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Notification push reçue');
  
  if (event.data) {
    const data = event.data.json();
    
    event.waitUntil(
      self.registration.showNotification('Burkina Tourisme', {
        body: data.message || 'Nouvelle notification',
        icon: '/manifest.json',
        badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect fill="%231a472a" width="96" height="96"/><text x="48" y="60" font-size="40" text-anchor="middle">🇧🇫</text></svg>',
        tag: 'notification',
        requireInteraction: false,
      })
    );
  }
});

/**
 * Événement de clic sur notification
 */
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification cliquée');
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      // Chercher un client ouvert
      for (const client of clientList) {
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      // Ouvrir une nouvelle fenêtre si aucune n'est ouverte
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});

console.log('[Service Worker] Chargé et prêt');
