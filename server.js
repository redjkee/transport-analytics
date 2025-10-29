const express = require('express');
const multer = require('multer');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5000;

// CORS middleware
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    next();
});

// Middleware
app.use(express.static('public'));
app.use(express.json());

// Настройка загрузки файлов
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = 'uploads';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir);
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

// РЕАЛЬНАЯ ОБРАБОТКА С PYTHON
app.post('/api/process-invoices', upload.array('files'), (req, res) => {
    console.log('📨 Получены файлы для обработки:', req.files.map(f => f.originalname));
    
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ 
            success: false,
            error: 'Файлы не загружены' 
        });
    }

    // Запускаем Python скрипт
    console.log('🐍 Запускаем Python скрипт...');
    
    // Используем python3 для Linux
    const pythonExecutable = 'python3';
    
    // Создаем аргументы: python3 invoice_parser.py file1.xlsx file2.xlsx
    const args = ['invoice_parser.py', ...req.files.map(f => f.path)];
    
    const pythonProcess = spawn(pythonExecutable, args);
    
    let resultData = '';
    let errorData = '';

    pythonProcess.stdout.on('data', (data) => {
        resultData += data.toString();
        console.log('Python stdout:', data.toString());
    });

    pythonProcess.stderr.on('data', (data) => {
        errorData += data.toString();
        console.error('Python stderr:', data.toString());
    });

    pythonProcess.on('close', (code) => {
        console.log(`Python процесс завершился с кодом: ${code}`);
        
        // Очищаем файлы в любом случае
        req.files.forEach(file => {
            try {
                if (fs.existsSync(file.path)) {
                    fs.unlinkSync(file.path);
                }
            } catch (e) {
                console.error('Ошибка удаления файла:', e);
            }
        });

        if (code === 0) {
            try {
                const result = JSON.parse(resultData);
                res.json(result);
            } catch (e) {
                console.error('Ошибка парсинга JSON:', e);
                res.status(500).json({
                    success: false,
                    error: 'Ошибка парсинга результата',
                    details: resultData
                });
            }
        } else {
            console.error('Python ошибка:', errorData);
            res.status(500).json({
                success: false,
                error: 'Ошибка выполнения Python скрипта',
                details: errorData
            });
        }
    });
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        service: 'Transport Analytics API',
        timestamp: new Date().toISOString()
    });
});

// Serve frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 Transport Analytics Server запущен: http://localhost:${PORT}`);
    console.log(`📊 Frontend: http://localhost:${PORT}`);
    console.log(`❤️  Health: http://localhost:${PORT}/api/health`);
});
