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
