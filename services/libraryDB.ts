
import { LibraryDocument, CodeType, LibraryVisibility } from '../types';

const DB_NAME = 'CodeScoutLibraryDB';
const STORE_NAME = 'documents';
const DB_VERSION = 2; // Incremented version for schema changes

// Helper to open DB
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('country', 'country', { unique: false });
        store.createIndex('city', 'city', { unique: false });
        store.createIndex('codeType', 'codeType', { unique: false });
        store.createIndex('visibility', 'visibility', { unique: false });
      } else {
        // Migration for v2: ensure visibility index exists
        const store = (event.target as IDBOpenDBRequest).transaction!.objectStore(STORE_NAME);
        if (!store.indexNames.contains('visibility')) {
          store.createIndex('visibility', 'visibility', { unique: false });
        }
      }
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
};

export const libraryDB = {
  addDocument: async (doc: LibraryDocument): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      // Ensure default visibility if missing (migration safety)
      if (!doc.visibility) doc.visibility = 'PRIVATE';
      
      const request = store.put(doc);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  getAllDocuments: async (visibility?: LibraryVisibility): Promise<LibraryDocument[]> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        let docs = request.result as LibraryDocument[];
        
        // Safety: filter out highly reported items
        docs = docs.filter(d => (d.reportCount || 0) < 5);

        if (visibility) {
            docs = docs.filter(d => d.visibility === visibility);
        }
        
        // Sort by newest first
        resolve(docs.sort((a, b) => b.dateUploaded - a.dateUploaded));
      };
      request.onerror = () => reject(request.error);
    });
  },

  // Mock API Endpoint: DELETE /api/library/items/:id
  deleteDocument: async (id: string): Promise<{ ok: boolean }> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => resolve({ ok: true });
      request.onerror = () => reject(request.error);
    });
  },

  reportDocument: async (id: string): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const getRequest = store.get(id);

        getRequest.onsuccess = () => {
            const doc = getRequest.result as LibraryDocument;
            if (doc) {
                doc.reportCount = (doc.reportCount || 0) + 1;
                store.put(doc);
                resolve();
            } else {
                reject("Document not found");
            }
        };
        getRequest.onerror = () => reject(getRequest.error);
    });
  },

  // Used by the Analysis Engine
  findRelevantDocuments: async (country: string, city: string): Promise<LibraryDocument[]> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => {
            const allDocs = request.result as LibraryDocument[];
            const queryCountry = country.toLowerCase().trim();
            const queryCity = city.toLowerCase().trim();

            const relevant = allDocs.filter(doc => {
                 // Filter out blocked items
                if ((doc.reportCount || 0) >= 5) return false;

                const docCountry = doc.country.toLowerCase().trim();
                const docCity = doc.city?.toLowerCase().trim();

                // Country mismatch? Skip.
                if (docCountry && docCountry !== queryCountry) return false;

                // If doc is specific to a city, it must match the query city
                if (docCity && docCity !== queryCity) return false;

                return true;
            });
            
            // Prioritize PRIVATE docs first, then PUBLIC
            relevant.sort((a, b) => {
                if (a.visibility === 'PRIVATE' && b.visibility === 'PUBLIC') return -1;
                if (a.visibility === 'PUBLIC' && b.visibility === 'PRIVATE') return 1;
                return b.dateUploaded - a.dateUploaded;
            });

            resolve(relevant);
        };
        request.onerror = () => reject(request.error);
    });
  }
};
