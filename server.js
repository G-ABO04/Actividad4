// app mesero/server.js

// --- 1. Módulos de Node.js y Electron ---
const { app, BrowserWindow } = require('electron'); 
const express = require('express'); // <-- CORRECCIÓN FINAL: Para definir 'express'
const fs = require('fs');
const path = require('path');
const cors = require('cors');

// --- 2. Configuración de la Base de Datos Compartida ---
const TEMPLATE_FILE = 'database-template.json';
const SHARED_DB_NAME = 'restaurante_nice2_shared_data.json';
let DB_FILE; 


// --- 3. Funciones de Lectura/Escritura Adaptadas ---

function readDB() {
    if (!DB_FILE) {
        return { users: [], menu: [], orders: [], activeOrders: {} };
    }
    try {
        const data = fs.readFileSync(DB_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error leyendo la DB compartida:', error.message);
        return { users: [], menu: [], orders: [], activeOrders: {} };
    }
}

function saveDB(data) {
    if (!DB_FILE) return; 
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// --- 4. Inicialización de la Base de Datos Compartida ---

function initializeDatabase() {
    DB_FILE = path.join(app.getPath('userData'), SHARED_DB_NAME); 
    const templatePath = path.join(__dirname, TEMPLATE_FILE);

    if (!fs.existsSync(DB_FILE)) {
        console.log('Base de datos compartida no encontrada. Inicializando desde plantilla...');
        try {
            const userDataDir = path.dirname(DB_FILE);
            if (!fs.existsSync(userDataDir)) {
                fs.mkdirSync(userDataDir, { recursive: true });
            }
            fs.copyFileSync(templatePath, DB_FILE);
            console.log('Base de datos inicializada correctamente en:', DB_FILE);
        } catch (error) {
            console.error('Error al inicializar la base de datos:', error);
        }
    } else {
        console.log('Base de datos compartida encontrada en:', DB_FILE);
    }
}


// --- 5. Lógica del Servidor Express ---
const api = express();
const PORT = 3001; // <-- PUERTO DIFERENTE PARA EL MESERO (CORRECCIÓN EADDRINUSE)

api.use(cors());
api.use(express.json());

// --- RUTAS DE LA API (Usando 'api') ---

// Obtener todos los datos de un recurso
api.get('/api/:resource', (req, res) => { 
    const db = readDB();
    const resource = req.params.resource;
    if (db[resource] !== undefined) {
        res.json(db[resource]);
    } else {
        res.status(404).json({ error: 'Recurso no encontrado' });
    }
});

// Obtener item específico
api.get('/api/:resource/:id', (req, res) => { 
    const db = readDB();
    const resource = req.params.resource;
    const id = req.params.id;
    if (db[resource] !== undefined) {
        if (Array.isArray(db[resource])) {
            const item = db[resource].find(item => item.id == id);
            if (item) {
                res.json(item);
            } else {
                res.status(404).json({ error: 'Item no encontrado' });
            }
        } else {
            res.json(db[resource]);
        }
    } else {
        res.status(404).json({ error: 'Recurso no encontrado' });
    }
});

// Crear nuevo item
api.post('/api/:resource', (req, res) => { 
    const db = readDB();
    const resource = req.params.resource;
    const newItem = req.body;
    if (db[resource] !== undefined) {
        if (Array.isArray(db[resource])) {
            newItem.id = db[resource].length > 0 
                ? Math.max(...db[resource].map(i => i.id)) + 1 
                : 1;
            db[resource].push(newItem);
        } else if (typeof db[resource] === 'object') {
            db[resource] = { ...db[resource], ...newItem };
        }
        saveDB(db);
        res.json(newItem);
    } else {
        res.status(404).json({ error: 'Recurso no encontrado' });
    }
});

// Actualizar item
api.put('/api/:resource/:id', (req, res) => { 
    const db = readDB();
    const resource = req.params.resource;
    const id = parseInt(req.params.id);
    const updatedData = req.body;
    if (db[resource] !== undefined) {
        if (Array.isArray(db[resource])) {
            const index = db[resource].findIndex(item => item.id === id);
            if (index !== -1) {
                db[resource][index] = { ...db[resource][index], ...updatedData };
                saveDB(db);
                res.json(db[resource][index]);
            } else {
                res.status(404).json({ error: 'Item no encontrado' });
            }
        } else {
            db[resource] = { ...db[resource], ...updatedData };
            saveDB(db);
            res.json(db[resource]);
        }
    } else {
        res.status(404).json({ error: 'Recurso no encontrado' });
    }
});

// Eliminar item
api.delete('/api/:resource/:id', (req, res) => { 
    const db = readDB();
    const resource = req.params.resource;
    const id = parseInt(req.params.id);
    if (db[resource] !== undefined && Array.isArray(db[resource])) {
        db[resource] = db[resource].filter(item => item.id !== id);
        saveDB(db);
        res.json({ success: true, message: 'Item eliminado' });
    } else {
        res.status(404).json({ error: 'Recurso no encontrado o no es un array' });
    }
});

// Actualizar activeOrders completo
api.put('/api/activeOrders', (req, res) => { 
    const db = readDB();
    db.activeOrders = req.body;
    saveDB(db);
    res.json(db.activeOrders);
});


// --- 6. Creación de la Ventana de Electron ---

function createWindow() {
  const win = new BrowserWindow({
    width: 800, 
    height: 600,
    webPreferences: {
        nodeIntegration: true, 
        contextIsolation: false 
    }
  });

  win.loadFile('Mesero.html'); 
}

// --- 7. Arranque de la Aplicación ---

// Escucha del servidor Express
api.listen(PORT, () => {
    console.log(`🚀 Servidor API (Mesero) corriendo en http://localhost:${PORT}`);
});


// Inicio de Electron y la lógica de la BD
app.whenReady().then(() => {
    initializeDatabase(); 
    createWindow();       

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});