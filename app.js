// Configuración de Firebase proporcionada por el usuario
const firebaseConfig = {
    apiKey: "AIzaSyDVpaNVbN_odbvwUzLwLCJEvCcVaU58mFo",
    authDomain: "ewriter-ed922.firebaseapp.com",
    projectId: "ewriter-ed922",
    storageBucket: "ewriter-ed922.firebasestorage.app",
    messagingSenderId: "74648101150",
    appId: "1:74648101150:web:a390feefe57d65e09be90f",
    measurementId: "G-6JRYD7RS8P"
};

// Inicializar Firebase (Usando Compat API para soporte en archivo local file://)
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Estado Global
let currentUser = null;
let currentScriptId = null;
let autoSaveTimer = null;
let scriptsUnsubscribe = null;

// Elementos del DOM
const loginSection = document.getElementById('login-section');
const appSection = document.getElementById('app-section');
const loginForm = document.getElementById('login-form');
const authError = document.getElementById('auth-error');
const scriptListEl = document.getElementById('script-list');
const editorEl = document.getElementById('editor');
const scriptTitleEl = document.getElementById('script-title');
const btnSave = document.getElementById('btn-save');
const btnExportPdf = document.getElementById('btn-export-pdf');
const saveStatus = document.getElementById('save-status');

// ==================== AUTHENTICATION ====================
auth.onAuthStateChanged((user) => {
    if (user) {
        currentUser = user;
        loginSection.classList.add('hidden');
        appSection.classList.remove('hidden');
        loadScripts();
    } else {
        currentUser = null;
        currentScriptId = null;
        loginSection.classList.remove('hidden');
        appSection.classList.add('hidden');
        if (scriptsUnsubscribe) scriptsUnsubscribe();
    }
});

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    authError.textContent = '';

    try {
        await auth.signInWithEmailAndPassword(email, password);
        showToast('Sesión iniciada correctamente', 'success');
    } catch (error) {
        if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
            try {
                await auth.createUserWithEmailAndPassword(email, password);
                showToast('Cuenta creada e iniciada', 'success');
            } catch (createError) {
                authError.textContent = 'Error al crear cuenta: ' + createError.message;
            }
        } else {
            authError.textContent = 'Error al iniciar sesión: ' + error.message;
        }
    }
});

document.getElementById('btn-logout').addEventListener('click', () => {
    saveScript(); // Intentar guardar antes de salir
    auth.signOut();
});

// ==================== FIRESTORE LOGIC ====================

function loadScripts() {
    if (!currentUser) return;
    
    scriptsUnsubscribe = db.collection(`users/${currentUser.uid}/scripts`)
        .orderBy('updatedAt', 'desc')
        .onSnapshot((snapshot) => {
            scriptListEl.innerHTML = '';
            snapshot.forEach(docSnap => {
                const data = docSnap.data();
                const id = docSnap.id;
                
                const div = document.createElement('div');
                div.className = `script-item ${currentScriptId === id ? 'active' : ''}`;
                div.innerHTML = `
                    <span>${data.title || 'Sin Título'}</span>
                    <i class="fa-solid fa-trash btn-icon" style="padding:4px; font-size:0.8rem; color:#ef4444;" data-id="${id}"></i>
                `;
                
                // Cargar script
                div.addEventListener('click', (e) => {
                    if (e.target.classList.contains('fa-trash')) return;
                    openScript(id, data);
                });
                
                // Borrar script
                div.querySelector('.fa-trash').addEventListener('click', async (e) => {
                    e.stopPropagation();
                    if(confirm('¿Eliminar este guion? No se puede deshacer.')) {
                        await db.doc(`users/${currentUser.uid}/scripts/${id}`).delete();
                        if (currentScriptId === id) resetEditor();
                        showToast('Guion eliminado', 'info');
                    }
                });

                scriptListEl.appendChild(div);
            });
        });
}

document.getElementById('btn-new-script').addEventListener('click', async () => {
    if (!currentUser) return;
    
    const newRef = db.collection(`users/${currentUser.uid}/scripts`);
    const docRef = await newRef.add({
        title: 'Nuevo Guion',
        content: '<div class="slugline">INT. ESCENA - DÍA</div><div class="action">Describe la acción...</div>',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    openScript(docRef.id, { title: 'Nuevo Guion', content: '<div class="slugline">INT. ESCENA - DÍA</div><div class="action">Describe la acción...</div>' });
});

function openScript(id, data) {
    // Guardar el actual si hay uno abierto antes de cambiar
    if (currentScriptId && currentScriptId !== id) {
        saveScript();
    }
    
    currentScriptId = id;
    editorEl.contentEditable = true;
    editorEl.innerHTML = data.content || '';
    scriptTitleEl.value = data.title || '';
    scriptTitleEl.disabled = false;
    btnSave.disabled = false;
    btnExportPdf.disabled = false;
    
    // Resaltar el activo en la lista
    document.querySelectorAll('.script-item').forEach(item => item.classList.remove('active'));
    setTimeout(() => {
        const activeItem = Array.from(document.querySelectorAll('.script-item .fa-trash')).find(i => i.getAttribute('data-id') === id);
        if(activeItem) activeItem.parentElement.classList.add('active');
    }, 50);
    
    startAutoSave();
    if(window.updateStats) window.updateStats();
    showToast('Guion cargado', 'info');
}

function resetEditor() {
    currentScriptId = null;
    editorEl.contentEditable = false;
    editorEl.innerHTML = '<div style="text-align: center; color: #999; margin-top: 50px; font-family: sans-serif;">⬅️ Selecciona o crea un guion en el menú lateral.</div>';
    scriptTitleEl.value = '';
    scriptTitleEl.disabled = true;
    btnSave.disabled = true;
    btnExportPdf.disabled = true;
    stopAutoSave();
    if(window.updateStats) window.updateStats();
}

async function saveScript() {
    if (!currentUser || !currentScriptId) return;
    
    const content = editorEl.innerHTML;
    const title = scriptTitleEl.value || 'Sin Título';
    
    try {
        saveStatus.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';
        await db.doc(`users/${currentUser.uid}/scripts/${currentScriptId}`).update({
            title: title,
            content: content,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        setTimeout(() => {
            saveStatus.innerHTML = '<i class="fa-solid fa-cloud-check"></i> Guardado';
            setTimeout(() => { saveStatus.innerHTML = '<i class="fa-solid fa-cloud"></i> Autoguardado 10min'; }, 2000);
        }, 500);
        
    } catch (e) {
        showToast('Error al guardar', 'error');
        console.error(e);
    }
}

// Boton guardar manual
btnSave.addEventListener('click', () => {
    saveScript();
    showToast('Guion guardado manualmente', 'success');
});

// Botón Exportar PDF
btnExportPdf.addEventListener('click', () => {
    if (!currentScriptId) return;

    btnExportPdf.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generando...';
    btnExportPdf.disabled = true;

    // Crear clon para exportación limpia sin elementos UI
    const clone = editorEl.cloneNode(true);
    clone.style.background = "white";
    clone.style.padding = "0"; 
    clone.style.paddingLeft = "0.5in"; // Margen izquierdo adicional (1" base + 0.5" = 1.5")
    clone.style.boxShadow = "none";
    clone.style.backgroundImage = "none"; // Quitar lineas separadoras de pagina
    clone.style.width = "6.5in"; // Ancho total imprimible en Letter (8.5 - 1 - 1)

    const container = document.createElement('div');
    container.appendChild(clone);
    container.style.position = "absolute";
    container.style.top = "0";
    container.style.left = "0";
    container.style.zIndex = "-9999";
    container.style.background = "white"; // Fondo seguro
    document.body.appendChild(container);

    // FIX: Evitar que html2canvas recorte o falle por culpa del overflow: hidden del body
    const originalOverflow = document.body.style.overflow || '';
    const originalHeight = document.body.style.height || '';
    document.body.style.overflow = "visible";
    document.body.style.height = "auto";

    const title = scriptTitleEl.value || 'Guion';
    
    const opt = {
        margin:       1, // 1 pulgada en todos los bordes (Top, Right, Bottom, Left)
        filename:     `${title}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, scrollY: 0, useCORS: true }, // scrollY previene offsets, useCORS para fuentes seguras
        jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(container).save().then(() => {
        if(document.body.contains(container)) document.body.removeChild(container);
        document.body.style.overflow = originalOverflow;
        document.body.style.height = originalHeight;
        
        btnExportPdf.innerHTML = '<i class="fa-solid fa-file-pdf"></i> Exportar PDF';
        btnExportPdf.disabled = false;
        showToast('PDF Exportado correctamente', 'success');
    }).catch(e => {
        console.error("Error al exportar PDF: ", e);
        if(document.body.contains(container)) document.body.removeChild(container);
        document.body.style.overflow = originalOverflow;
        document.body.style.height = originalHeight;
        
        btnExportPdf.innerHTML = '<i class="fa-solid fa-file-pdf"></i> Exportar PDF';
        btnExportPdf.disabled = false;
        showToast('Error al exportar PDF', 'error');
    });
});

// Autoguardado cada 10 min
function startAutoSave() {
    stopAutoSave();
    autoSaveTimer = setInterval(() => {
        if(currentScriptId) saveScript();
    }, 10 * 60 * 1000); // 10 minutos
}
function stopAutoSave() {
    if (autoSaveTimer) clearInterval(autoSaveTimer);
}

// ==================== TOAST NOTIFICATIONS ====================
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = 'fa-info-circle';
    if(type === 'success') icon = 'fa-check-circle';
    if(type === 'error') icon = 'fa-exclamation-circle';
    
    toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
