// Mdulo de Interfaz de Usuario (UI)
import { initFilesEvents } from './files.js';
import { initChatEvents } from './chat.js';
import { initTerminalEvents } from './terminal.js';

export async function loadView(viewName) {
    const mainContent = document.getElementById('main-content');
    
    try {
        const response = await fetch(`views/${viewName}.html`);
        if (!response.ok) throw new Error("Error loading view: " + viewName);
        
        const html = await response.text();
        mainContent.innerHTML = html;
        
        // Ejecutar inicializadores especficos segn la vista cargada
        if (viewName === 'archivos') {
            initFilesEvents();
        } else if (viewName === 'cuartel') {
            initChatEvents();
        } else if (viewName === 'redglobal') {
            initTerminalEvents();
        } else if (viewName === 'panel') {
            // Eventos del panel
            const btnProceder = document.getElementById('btn-ver-archivos-dash');
            if (btnProceder) {
                btnProceder.addEventListener('click', () => {
                    document.querySelector('.nav-btn[data-tab="archivos"]')?.click();
                });
            }
        }
        
    } catch (error) {
        console.error("No se pudo cargar la vista:", error);
        mainContent.innerHTML = `<h3 style='color:red;'> ERROR TCTICO: Vista ${viewName}.html inaccesible.</h3>`;
    }
}

export function initTabs() {
    const navButtons = document.querySelectorAll('.nav-btn[data-tab]');
    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Resaltar botn activo
            navButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Cargar vista HTML correspondiente
            const tabName = btn.getAttribute('data-tab');
            if (tabName === 'dashboard') loadView('panel');
            if (tabName === 'archivos') loadView('archivos');
            if (tabName === 'comunicaciones') loadView('cuartel');
            if (tabName === 'red-global') loadView('redglobal');
        });
    });
}
