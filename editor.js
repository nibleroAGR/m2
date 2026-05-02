// Lógica del Editor de Guiones (Formatos y Atajos)
const editor = document.getElementById('editor');
const styles = ['slugline', 'action', 'character', 'parenthetical', 'dialogue', 'transition'];

const flowMap = {
    'slugline': 'action',
    'character': 'dialogue',
    'parenthetical': 'dialogue',
    'dialogue': 'action',
    'action': 'action',
    'transition': 'slugline'
};

// Exponer la función globalmente para que funcione en el onclick del HTML
window.applyStyle = function(className) {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    let container = selection.anchorNode;
    
    // Buscamos el DIV hijo directo del editor
    while (container && container.parentElement !== editor) {
        container = container.parentElement;
    }

    if (container && container !== editor) {
        container.className = className;
        updateActiveButton(className);
    }
    
    editor.focus();
};

// Lógica de Teclado
editor.addEventListener('keydown', (e) => {
    // Si el editor está deshabilitado (no hay guion abierto), ignorar
    if(editor.contentEditable === "false") return;

    const selection = window.getSelection();
    let currentBlock = selection.anchorNode;
    
    while (currentBlock && currentBlock.parentElement !== editor) {
        currentBlock = currentBlock.parentElement;
    }

    if (!currentBlock || currentBlock === editor) return;

    // ENTER: Nueva línea con lógica de flujo de guion
    if (e.key === 'Enter') {
        e.preventDefault();
        const currentType = currentBlock.className || 'action';
        const nextType = flowMap[currentType] || 'action';

        const newBlock = document.createElement('div');
        newBlock.className = nextType;
        newBlock.innerHTML = '<br>';
        currentBlock.after(newBlock);

        const range = document.createRange();
        range.setStart(newBlock, 0);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
        updateActiveButton(nextType);
    }

    // TAB: Cambiar estilo cíclicamente
    if (e.key === 'Tab') {
        e.preventDefault();
        const currentType = currentBlock.className || 'action';
        const nextIndex = (styles.indexOf(currentType) + 1) % styles.length;
        const nextType = styles[nextIndex];
        currentBlock.className = nextType;
        updateActiveButton(nextType);
    }
});

// Actualizar botones al hacer clic en el texto para saber en qué formato estamos
editor.addEventListener('click', () => {
    if(editor.contentEditable === "false") return;
    
    setTimeout(() => {
        const selection = window.getSelection();
        let node = selection.anchorNode;
        while (node && node.parentElement !== editor) node = node.parentElement;
        if (node) updateActiveButton(node.className);
    }, 10);
});

function updateActiveButton(className) {
    document.querySelectorAll('.btn-style').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-type') === className) {
            btn.classList.add('active');
        }
    });
}

// ==================== ESTADÍSTICAS ====================
function updateStats() {
    if(editor.contentEditable === "false") {
        document.getElementById('stat-pages').textContent = "0";
        document.getElementById('stat-scenes').textContent = "0";
        document.getElementById('stat-chars').textContent = "0";
        return;
    }

    // 1. Escenas
    const scenes = editor.querySelectorAll('.slugline').length;
    document.getElementById('stat-scenes').textContent = scenes;

    // 2. Personajes
    const charElements = editor.querySelectorAll('.character');
    const uniqueChars = new Set();
    charElements.forEach(el => {
        let name = el.textContent.trim().toUpperCase();
        // Limpiar " (CONT'D)" o " (V.O.)" para agrupar el mismo personaje
        name = name.replace(/\s*\(.*?\)/g, '').trim();
        if (name) uniqueChars.add(name);
    });
    document.getElementById('stat-chars').textContent = uniqueChars.size;

    // 3. Páginas
    // Altura de una hoja US Letter en CSS es 11 pulgadas = 11 * 96px = 1056px.
    // Usaremos scrollHeight para calcular cuántas páginas abarca el texto.
    const pageHeight = 1056; 
    let pages = Math.max(1, Math.ceil(editor.scrollHeight / pageHeight));
    
    document.getElementById('stat-pages').textContent = pages;
}

// Observar cambios en el contenido del editor para actualizar estadísticas en tiempo real
const observer = new MutationObserver(() => {
    // Usamos setTimeout o un debounce simple si queremos mejor rendimiento,
    // pero para un editor de texto suele ser lo suficientemente rápido.
    updateStats();
});

observer.observe(editor, {
    childList: true,
    subtree: true,
    characterData: true
});

// Exponer globalmente para poder llamarla desde app.js al cargar un guion
window.updateStats = updateStats;
