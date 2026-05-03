// Lógica del Editor de Guiones (Formatos, Atajos y Paginación)
const pagesContainer = document.getElementById('pages-container');
const styles = ['slugline', 'action', 'character', 'parenthetical', 'dialogue', 'transition'];

const flowMap = {
    'slugline': 'action',
    'character': 'dialogue',
    'parenthetical': 'dialogue',
    'dialogue': 'action',
    'action': 'action',
    'transition': 'slugline'
};

// Variable global que rastrea exactamente en qué bloque de texto está el usuario
let currentFocusBlock = null;

// ==================== RASTREO DEL CURSOR (A PRUEBA DE FALLOS) ====================
document.addEventListener('selectionchange', () => {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return;

    let node = selection.anchorNode;
    
    // Si el usuario hace clic en un espacio vacío de la página
    if (node && node.nodeType === 1 && node.classList && node.classList.contains('page')) {
        node = node.childNodes[selection.anchorOffset] || node.lastElementChild;
    }

    // Subimos por el árbol DOM hasta encontrar el div que contiene el formato (hijo directo de .page)
    while (node && node !== pagesContainer) {
        if (node.parentElement && node.parentElement.classList && node.parentElement.classList.contains('page')) {
            currentFocusBlock = node;
            updateActiveButton(node.className);
            return;
        }
        node = node.parentElement;
    }
});

function updateActiveButton(className) {
    document.querySelectorAll('.btn-style').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-type') === className) {
            btn.classList.add('active');
        }
    });
}

// ==================== APLICAR ESTILO (BOTONES) ====================
window.applyStyle = function(className) {
    if (currentFocusBlock) {
        currentFocusBlock.className = className;
        updateActiveButton(className);
    }
};

// ==================== ZOOM ====================
const zoomSelect = document.getElementById('zoom-select');
if(zoomSelect) {
    zoomSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        pagesContainer.style.transform = `scale(${val})`;
    });
}

// ==================== LÓGICA DE TECLADO ====================
pagesContainer.addEventListener('keydown', (e) => {
    if (!currentFocusBlock) return;

    const page = currentFocusBlock.closest('.page');
    if (!page || page.contentEditable === "false") return;

    // TAB: Cambiar estilo cíclicamente
    if (e.key === 'Tab') {
        e.preventDefault();
        const currentType = currentFocusBlock.className || 'action';
        const nextIndex = (styles.indexOf(currentType) + 1) % styles.length;
        const nextType = styles[nextIndex];
        currentFocusBlock.className = nextType;
        updateActiveButton(nextType);
        return;
    }

    // ENTER: Nueva línea con lógica de flujo
    if (e.key === 'Enter') {
        e.preventDefault();
        const currentType = currentFocusBlock.className || 'action';
        const nextType = flowMap[currentType] || 'action';

        const newBlock = document.createElement('div');
        newBlock.className = nextType;
        newBlock.innerHTML = '<br>';
        
        // Insertar después del bloque actual
        currentFocusBlock.after(newBlock);

        // Mover el cursor al nuevo bloque
        const selection = window.getSelection();
        const range = document.createRange();
        range.setStart(newBlock, 0);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
        
        updateActiveButton(nextType);
        currentFocusBlock = newBlock; // Actualizar referencia local inmediatamente
        
        // Forzar chequeo de paginación
        checkPagination(page);
    }
});

// ==================== PAGINACIÓN (EL NÚCLEO) ====================
pagesContainer.addEventListener('input', (e) => {
    const page = e.target.closest('.page');
    if(page) checkPagination(page);
});

// Función para guardar y restaurar el caret
function saveCaret() {
    const selection = window.getSelection();
    if(selection.rangeCount === 0) return null;
    return { node: selection.anchorNode, offset: selection.anchorOffset };
}
function restoreCaret(caretInfo) {
    if(!caretInfo || !caretInfo.node) return;
    try {
        const selection = window.getSelection();
        const range = document.createRange();
        range.setStart(caretInfo.node, caretInfo.offset);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
    } catch(e) {}
}

window.reflowPagination = function(startPage) {
    checkPagination(startPage);
}

function checkPagination(page) {
    if(!page) return;
    // 11in = 1056px @ 96dpi.
    const pageHeight = 1056;

    // 1. DESBORDAMIENTO (Push down)
    while (page.scrollHeight > pageHeight && page.lastElementChild && page.childElementCount > 1) {
        let nextPage = page.nextElementSibling;
        if (!nextPage) {
            nextPage = document.createElement('div');
            nextPage.className = 'page';
            nextPage.contentEditable = true;
            nextPage.spellcheck = false;
            page.parentNode.insertBefore(nextPage, page.nextSibling);
        }
        
        const lastChild = page.lastElementChild;
        const caret = saveCaret();
        
        nextPage.insertBefore(lastChild, nextPage.firstChild);
        
        restoreCaret(caret);
        
        if(nextPage.scrollHeight > pageHeight) {
            checkPagination(nextPage);
        }
    }

    // 2. REFLUJO HACIA ARRIBA (Pull up)
    let nextPage = page.nextElementSibling;
    if (nextPage) {
        let firstChild = nextPage.firstElementChild;
        if (firstChild && page.scrollHeight <= pageHeight - 20) {
            const caret = saveCaret();
            page.appendChild(firstChild);
            
            // Si al traerlo desborda, lo devolvemos
            if (page.scrollHeight > pageHeight) {
                page.removeChild(firstChild);
                nextPage.insertBefore(firstChild, nextPage.firstChild);
            } else {
                restoreCaret(caret);
                checkPagination(page);
                return;
            }
        }
        
        // Eliminar página siguiente si quedó vacía
        if (nextPage.childNodes.length === 0 || (nextPage.childNodes.length === 1 && nextPage.innerHTML === '<br>')) {
            nextPage.remove();
        }
    }
}

// ==================== ESTADÍSTICAS ====================
function updateStats() {
    const pages = document.querySelectorAll('.page');
    if(pages.length > 0 && pages[0].contentEditable === "false") {
        document.getElementById('stat-pages').textContent = "0";
        document.getElementById('stat-scenes').textContent = "0";
        document.getElementById('stat-chars').textContent = "0";
        return;
    }

    const scenes = pagesContainer.querySelectorAll('.slugline').length;
    document.getElementById('stat-scenes').textContent = scenes;

    const charElements = pagesContainer.querySelectorAll('.character');
    const uniqueChars = new Set();
    charElements.forEach(el => {
        let name = el.textContent.trim().toUpperCase();
        name = name.replace(/\s*\(.*?\)/g, '').trim();
        if (name) uniqueChars.add(name);
    });
    document.getElementById('stat-chars').textContent = uniqueChars.size;

    document.getElementById('stat-pages').textContent = pages.length;
}

window.updateStats = updateStats;

const observer = new MutationObserver(() => {
    updateStats();
});
observer.observe(pagesContainer, { childList: true, subtree: true, characterData: true });
