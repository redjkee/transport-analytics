// Глобальные переменные
let selectedFiles = [];

// Инициализация
document.addEventListener('DOMContentLoaded', function() {
    initializeDragAndDrop();
    setupFileInput();
    console.log('🚀 Transport Analytics frontend loaded');
});

// Настройка drag and drop
function initializeDragAndDrop() {
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');

    // Обработчики для drag and drop
    uploadArea.addEventListener('dragover', function(e) {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });

    uploadArea.addEventListener('dragleave', function() {
        uploadArea.classList.remove('dragover');
    });

    uploadArea.addEventListener('drop', function(e) {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        
        const files = e.dataTransfer.files;
        handleSelectedFiles(files);
    });

    // Клик по области загрузки
    uploadArea.addEventListener('click', function() {
        fileInput.click();
    });
}

// Настройка input для файлов
function setupFileInput() {
    const fileInput = document.getElementById('fileInput');
    
    fileInput.addEventListener('change', function() {
        handleSelectedFiles(this.files);
    });
}

// Обработка выбранных файлов
function handleSelectedFiles(files) {
    const validFiles = Array.from(files).filter(file => {
        const isValid = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
        if (!isValid) {
            showError(`Файл "${file.name}" не является Excel файлом`);
        }
        return isValid;
    });

    selectedFiles = [...selectedFiles, ...validFiles];
    updateFileList();
    updateProcessButton();
}

// Обновление списка файлов
function updateFileList() {
    const fileList = document.getElementById('fileList');
    
    if (selectedFiles.length === 0) {
        fileList.innerHTML = '';
        return;
    }

    fileList.innerHTML = selectedFiles.map(file => `
        <div class="file-item">
            <span class="file-name">${file.name}</span>
            <span class="file-size">${formatFileSize(file.size)}</span>
        </div>
    `).join('');
}

// Форматирование размера файла
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Обновление состояния кнопки обработки
function updateProcessButton() {
    const processBtn = document.getElementById('processBtn');
    processBtn.disabled = selectedFiles.length === 0;
}

// Показать ошибку
function showError(message) {
    const errorSection = document.getElementById('errorSection');
    const errorMessage = document.getElementById('errorMessage');
    
    errorMessage.textContent = message;
    errorSection.style.display = 'block';
    
    // Автоскрытие через 5 секунд
    setTimeout(() => {
        errorSection.style.display = 'none';
    }, 5000);
}

// Скрыть ошибку
function hideError() {
    const errorSection = document.getElementById('errorSection');
    errorSection.style.display = 'none';
}

// Основная функция обработки файлов
async function processFiles() {
    if (selectedFiles.length === 0) {
        showError('Пожалуйста, выберите файлы для обработки');
        return;
    }

    // Показываем прогресс
    showProgress();
    hideError();
    hideResults();

    const processBtn = document.getElementById('processBtn');
    processBtn.disabled = true;

    try {
        // Создаем FormData для отправки файлов
        const formData = new FormData();
        selectedFiles.forEach(file => {
            formData.append('files', file);
        });

        // Отправляем запрос на сервер
        updateProgress('Отправка файлов на сервер...', 30);
        
        const response = await fetch('/api/process-invoices', {
            method: 'POST',
            body: formData
        });

        updateProgress('Обработка Excel файлов...', 60);

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Ошибка сервера');
        }

        updateProgress('Формирование отчета...', 90);

        if (result.success) {
            // Показываем результаты
            displayResults(result);
            updateProgress('Готово!', 100);
            
            // Очищаем файлы после успешной обработки
            setTimeout(() => {
                selectedFiles = [];
                updateFileList();
                updateProcessButton();
                hideProgress();
            }, 2000);
            
        } else {
            throw new Error(result.error || 'Ошибка обработки');
        }

    } catch (error) {
        console.error('Ошибка обработки:', error);
        showError(`Ошибка: ${error.message}`);
        hideProgress();
        processBtn.disabled = false;
    }
}

// Показать прогресс бар
function showProgress() {
    const progressSection = document.getElementById('progressSection');
    progressSection.style.display = 'block';
}

// Скрыть прогресс бар
function hideProgress() {
    const progressSection = document.getElementById('progressSection');
    progressSection.style.display = 'none';
}

// Обновить прогресс
function updateProgress(text, percent) {
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    
    progressFill.style.width = percent + '%';
    progressText.textContent = text;
}

// Показать результаты
function displayResults(result) {
    const resultsSection = document.getElementById('resultsSection');
    const statsGrid = document.getElementById('statsGrid');
    const tableBody = document.getElementById('tableBody');

    // Обновляем статистику
    statsGrid.innerHTML = `
        <div class="stat-card">
            <div class="stat-value">${result.statistics.total_records}</div>
            <div class="stat-label">Всего записей</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${formatCurrency(result.statistics.total_amount)}</div>
            <div class="stat-label">Общая сумма</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${result.statistics.unique_cars}</div>
            <div class="stat-label">Автомобилей</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${result.statistics.unique_drivers}</div>
            <div class="stat-label">Водителей</div>
        </div>
    `;

    // Заполняем таблицу
    tableBody.innerHTML = result.data.map(item => `
        <tr>
            <td>${item.Дата}</td>
            <td title="${item.Маршрут}">${truncateText(item.Маршрут, 50)}</td>
            <td>${item.Водитель}</td>
            <td>${item.Гос_номер}</td>
            <td>${formatCurrency(item.Стоимость)}</td>
            <td>${item.Источник}</td>
        </tr>
    `).join('');

    // Показываем секцию результатов
    resultsSection.style.display = 'block';

    // Прокручиваем к результатам
    resultsSection.scrollIntoView({ behavior: 'smooth' });
}

// Скрыть результаты
function hideResults() {
    const resultsSection = document.getElementById('resultsSection');
    resultsSection.style.display = 'none';
}

// Форматирование валюты
function formatCurrency(amount) {
    return new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        currency: 'RUB',
        minimumFractionDigits: 0
    }).format(amount);
}

// Обрезка длинного текста
function truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

// Глобальные функции для отладки
window.clearFiles = function() {
    selectedFiles = [];
    updateFileList();
    updateProcessButton();
    hideResults();
    hideError();
};

window.getFileCount = function() {
    return selectedFiles.length;
};
