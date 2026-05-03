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

// ==================== APLICAR ESTILO ====================
window.applyStyle = function(className) {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    let container = selection.anchorNode;
    
    // Si selection está en el page (espacio vacío)
    if (container.nodeType === 1 && container.classList.contains('page')) {
        container = container.childNodes[selection.anchorOffset] || container.lastElementChild;
    }

    // Buscamos el DIV hijo directo de una .page
    while (container && (!container.parentElement || !container.parentElement.classList.contains('page'))) {
        container = container.parentElement;
        if(!container) return; // Fuera del editor
    }

    if (container && container.parentElement.classList.contains('page')) {
        container.className = className;
        updateActiveButton(className);
        container.parentElement.focus(); // Devolver foco a la página
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
    const page = e.target.closest('.page');
    if (!page || page.contentEditable === "false") return;

    const selection = window.getSelection();
    let currentBlock = selection.anchorNode;
    
    if (currentBlock.nodeType === 1 && currentBlock.classList.contains('page')) {
        currentBlock = currentBlock.childNodes[selection.anchorOffset] || currentBlock.lastElementChild;
    }

    while (currentBlock && currentBlock.parentElement !== page) {
        currentBlock = currentBlock.parentElement;
    }

    if (!currentBlock || currentBlock === page) return;

    // ENTER: Nueva línea con lógica de flujo
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
        
        // Forzar chequeo de paginación
        checkPagination(page);
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

// ==================== PAGINACIÓN (EL NÚCLEO) ====================
pagesContainer.addEventListener('input', (e) => {
    const page = e.target.closest('.page');
    if(page) checkPagination(page);
});

// Función para guardar y restaurar el caret (básico)
function saveCaret(node) {
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
    // 11in = 1056px @ 96dpi. Usamos 1056px como altura máxima real
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
        const caret = saveCaret(lastChild);
        
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
        if (firstChild && page.scrollHeight <= pageHeight - 20) { // Margen de seguridad
            const caret = saveCaret(firstChild);
            page.appendChild(firstChild);
            
            // Si al traerlo desborda, lo devolvemos
            if (page.scrollHeight > pageHeight) {
                page.removeChild(firstChild);
                nextPage.insertBefore(firstChild, nextPage.firstChild);
            } else {
                restoreCaret(caret);
                // Puede que haya espacio para traer más
                checkPagination(page);
                return; // el loop se encarga de todo
            }
        }
        
        // Eliminar página siguiente si quedó vacía
        if (nextPage.childNodes.length === 0 || (nextPage.childNodes.length === 1 && nextPage.innerHTML === '<br>')) {
            nextPage.remove();
        }
    }
}

// ==================== UI & ESTADÍSTICAS ====================
pagesContainer.addEventListener('click', () => {
    setTimeout(() => {
        const selection = window.getSelection();
        let node = selection.anchorNode;
        
        if (node && node.nodeType === 1 && node.classList.contains('page')) {
            node = node.childNodes[selection.anchorOffset] || node.lastElementChild;
        }

        while (node && (!node.parentElement || !node.parentElement.classList.contains('page'))) {
            node = node.parentElement;
            if(!node) return;
        }
        if (node && node.className) updateActiveButton(node.className);
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
