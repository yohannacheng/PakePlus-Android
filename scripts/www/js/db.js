// 数据库操作模块
import { CONFIG } from './config.js';

let db = null;

// 初始化IndexedDB
function initDB() {
  // 如果已经初始化且数据库未关闭，直接返回
  if (db && !db.closed) {
    console.log('IndexedDB已初始化，跳过重复初始化');
    return Promise.resolve(db);
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(CONFIG.DB_NAME, CONFIG.DB_VERSION);
    let timeoutId = null;

    // 添加超时保护（5秒）
    timeoutId = setTimeout(() => {
      console.warn('IndexedDB初始化超时，使用localStorage');
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      db = null; // 标记为未初始化
      resolve(null); // 返回null而不是reject，让系统继续运行
    }, 5000);

    request.onerror = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      console.error('IndexedDB打开失败:', request.error);
      db = null;
      resolve(null); // 返回null而不是reject
    };

    request.onsuccess = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      db = request.result;
      // 监听数据库意外关闭
      db.onclose = () => {
        console.warn('IndexedDB连接被意外关闭');
        db = null;
      };
      // 监听版本变更导致连接关闭
      db.onversionchange = () => {
        console.warn('IndexedDB版本变更，关闭当前连接');
        db.close();
        db = null;
      };
      console.log('IndexedDB初始化成功');
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = event.target.result;
      if (!database.objectStoreNames.contains(CONFIG.STORE_STICKERS)) {
        database.createObjectStore(CONFIG.STORE_STICKERS);
      }
      if (!database.objectStoreNames.contains(CONFIG.STORE_BACKGROUNDS)) {
        database.createObjectStore(CONFIG.STORE_BACKGROUNDS);
      }
      if (!database.objectStoreNames.contains(CONFIG.STORE_BACKUP)) {
        database.createObjectStore(CONFIG.STORE_BACKUP);
      }
      if (!database.objectStoreNames.contains(CONFIG.STORE_STATE)) {
        database.createObjectStore(CONFIG.STORE_STATE);
      }
      // 添加图片存储
      if (!database.objectStoreNames.contains(CONFIG.STORE_IMAGES)) {
        database.createObjectStore(CONFIG.STORE_IMAGES);
      }
    };
  });
}

// 保存数据到IndexedDB
function saveToDB(storeName, data) {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('IndexedDB未初始化'));
      return;
    }

    try {
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(data, 'data');

      request.onsuccess = () => resolve();
      request.onerror = () => {
        const error = request.error || new Error('IndexedDB写入失败（未知错误）');
        console.error('saveToDB失败 - storeName:', storeName, 'error:', error);
        reject(error);
      };

      transaction.onerror = () => {
        const error = transaction.error || new Error('IndexedDB事务失败（未知错误）');
        console.error('saveToDB事务失败 - storeName:', storeName, 'error:', error);
        reject(error);
      };

      transaction.onabort = () => {
        const error = transaction.error || new Error('IndexedDB事务被中止');
        console.error('saveToDB事务中止 - storeName:', storeName, 'error:', error);
        reject(error);
      };
    } catch (err) {
      console.error('saveToDB异常 - storeName:', storeName, 'error:', err);
      reject(err);
    }
  });
}

// 从IndexedDB读取数据
function loadFromDB(storeName) {
  return new Promise((resolve, reject) => {
    if (!db) {
      resolve(null); // 返回null而不是reject
      return;
    }

    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.get('data');

    // 添加超时保护（3秒）
    const timeoutId = setTimeout(() => {
      console.warn(`从${storeName}加载数据超时`);
      resolve(null);
    }, 3000);

    request.onsuccess = () => {
      clearTimeout(timeoutId);
      resolve(request.result);
    };

    request.onerror = () => {
      clearTimeout(timeoutId);
      resolve(null); // 返回null而不是reject
    };
  });
}

// 清空IndexedDB中的数据
function clearDBStore(storeName) {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('IndexedDB未初始化'));
      return;
    }

    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// 保存图片到IndexedDB
function saveImage(imageId, imageData) {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('IndexedDB未初始化'));
      return;
    }

    const transaction = db.transaction([CONFIG.STORE_IMAGES], 'readwrite');
    const store = transaction.objectStore(CONFIG.STORE_IMAGES);
    const request = store.put(imageData, imageId);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// 从IndexedDB读取图片
function loadImage(imageId) {
  return new Promise((resolve, reject) => {
    if (!db) {
      resolve(null);
      return;
    }

    const transaction = db.transaction([CONFIG.STORE_IMAGES], 'readonly');
    const store = transaction.objectStore(CONFIG.STORE_IMAGES);
    const request = store.get(imageId);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// 删除图片
function deleteImage(imageId) {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('IndexedDB未初始化'));
      return;
    }

    const transaction = db.transaction([CONFIG.STORE_IMAGES], 'readwrite');
    const store = transaction.objectStore(CONFIG.STORE_IMAGES);
    const request = store.delete(imageId);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// 导出函数
export { initDB, saveToDB, loadFromDB, clearDBStore, saveImage, loadImage, deleteImage };
