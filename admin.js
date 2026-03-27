// IMPORT FIREBASE
import { db } from './firebase.js';
import {
    collection,
    query,
    where,
    getDocs,
    onSnapshot,
    addDoc,
    serverTimestamp,
    orderBy,
    limit,
    deleteDoc,
    doc,
    updateDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// CONFIGURACIÓN DE SEGURIDAD
const ADMIN_PASSWORD = "mediokilo"; // 🔑 Contraseña actualizada

// DOM ELEMENTS - LOGIN
const loginOverlay = document.getElementById('admin-login-overlay');
const adminPassInput = document.getElementById('admin-pass-input');
const btnAdminLogin = document.getElementById('btn-admin-login');
const loginErrMsg = document.getElementById('login-err-msg');
const mainHeader = document.getElementById('main-admin-header');
const mainLayout = document.getElementById('main-admin-layout');

// DOM Elements
const agentsList = document.getElementById('agents-list');
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const btnResetMessages = document.getElementById('btn-reset-messages');
const btnSendChat = document.getElementById('btn-send-chat');
const inputAgentName = document.getElementById('new-agent-name');
const inputAgentCode = document.getElementById('new-agent-code');
const btnAddAgent = document.getElementById('btn-add-agent');
const btnFullReset = document.getElementById('btn-full-reset');
const missionStatusText = document.getElementById('mission-status-text');
const missionStartTimeEl = document.getElementById('mission-start-time');
const missionTimerEl = document.getElementById('mission-timer');
const btnTogglePause = document.getElementById('btn-toggle-pause');

// CONSTANTES
const GROUP_ID = "grupo_activo"; // Mismo ID que en app.js

// --- INICIALIZACIÓN DE SEGURIDAD ---
function initSecurity() {
    const isAuthenticated = sessionStorage.getItem('admin_auth') === 'true';

    if (isAuthenticated) {
        showAdminPanel();
    } else {
        // If not authenticated, ensure login overlay is visible and main content is hidden
        if (loginOverlay) loginOverlay.style.display = 'flex';
        if (mainHeader) mainHeader.style.display = 'none';
        if (mainLayout) mainLayout.style.display = 'none';
    }

    if (btnAdminLogin) {
        btnAdminLogin.addEventListener('click', handleAdminLogin);
        adminPassInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleAdminLogin();
        });
    }
}

function handleAdminLogin() {
    const pass = adminPassInput.value.trim().toLowerCase();
    if (pass === ADMIN_PASSWORD.toLowerCase()) {
        sessionStorage.setItem('admin_auth', 'true');
        showAdminPanel();
    } else {
        if (loginErrMsg) loginErrMsg.style.display = 'block';
        if (adminPassInput) {
            adminPassInput.value = "";
            adminPassInput.focus();
            // Feedback visual de error
            adminPassInput.style.borderColor = "#ff3333";
            setTimeout(() => adminPassInput.style.borderColor = "", 1000);
        }
    }
}

function showAdminPanel() {
    if (loginOverlay) loginOverlay.style.display = 'none';
    if (mainHeader) mainHeader.style.display = 'flex';
    if (mainLayout) mainLayout.style.display = 'flex';

    // Iniciar las escuchas una vez autenticado
    initAdmin();
}

window.cerrarSesionAdmin = function () {
    sessionStorage.removeItem('admin_auth');
    location.reload();
};

// Arrancar con seguridad
initSecurity();

/**
 * Función principal que arranca las escuchas de Firebase
 */
function initAdmin() {
    console.log("Iniciando Mando Central...");
    escucharAgentes();
    escucharChat();
    escucharEstadoMision();
    configurarEventosGrupales(); // Assuming this function exists and should be called
}

/**
 * 1. ESCUCHAR AGENTES (Integrantes de la Operación)
 */
function escucharAgentes() {
    const agentsRef = collection(db, "grupos", GROUP_ID, "integrantes");

    // onSnapshot para cambios en tiempo real
    onSnapshot(agentsRef, (snapshot) => {
        agentsList.innerHTML = ""; // Limpiar lista

        let agentsCount = 0;
        let validadosCount = 0;
        let llegadosCount = 0;

        if (snapshot.empty) {
            agentsList.innerHTML = `<div style="color: #ffaa00;">NO SE DETECTAN AGENTES REGISTRADOS EN EL SISTEMA.</div>
                                    <div style="color: #aaa; font-size: 0.85rem; margin-top: 5px;">*Asegúrese de que el archivo load_users.js se ha ejecutado o han ingresado manualmente.</div>`;
            return;
        }

        snapshot.forEach((doc) => {
            agentsCount++;
            const data = doc.data();

            // Contadores de progreso general
            if (data.validado) validadosCount++;
            if (data.llegado) llegadosCount++;

            // Crear tarjeta de Agente
            const card = document.createElement('div');
            card.className = "agent-card";

            // Clases de estado (Color)
            const connStatusClass = data.validado ? "status-ok" : "status-err";
            const connStatusText = data.validado ? "AUTENTICADO Y ACTIVO" : "DESCONECTADO";

            const arriveStatusClass = data.llegado ? "status-ok" : "status-warn";
            const arriveStatusText = data.llegado ? "EN POSICIÓN" : "EN MOVIMIENTO / DESCONOCIDO";

            card.innerHTML = `
                <div class="agent-info">AGENTE: <span style="color:#00aaff;">${data.nombre || 'DESCONOCIDO'}</span></div>
                <div class="agent-code" style="display:flex; justify-content:space-between; align-items:center;">
                    <span>ID-ACCESO: ${data.codigo_individual || 'N/A'}</span>
                    <button class="admin-btn small-btn" style="border:none; color:#00aaff;" onclick="editarCodigoAgente('${doc.id}', '${data.codigo_individual}')">✎ Editar ID</button>
                </div>
                <hr style="border: 0; border-top: 1px dashed rgba(255,255,255,0.2); margin: 10px 0;">
                <div class="agent-status" style="margin-bottom: 10px;">
                    <div class="status-row">
                        <span>ESTADO DE RED:</span>
                        <span class="${connStatusClass}">${connStatusText}</span>
                    </div>
                    <div class="status-row">
                        <span>PUNTO DE REUNIÓN:</span>
                        <span class="${arriveStatusClass}">${arriveStatusText}</span>
                    </div>
                </div>
                <!-- Mini controles del agente -->
                <div style="display:flex; gap:5px; flex-wrap:wrap;">
                    <button class="admin-btn small-btn" onclick="toggleValidado('${doc.id}', ${data.validado})">${data.validado ? '🚫 Desactivar Red' : '✅ Forzar Red'}</button>
                    <button class="admin-btn small-btn" onclick="toggleLlegado('${doc.id}', ${data.llegado})">${data.llegado ? '🏃 Marcar Ausente' : '🚩 Marcar Presente'}</button>
                    <button class="admin-btn small-btn" style="border-color:#ff3333; color:#ff3333; max-width: 40px;" onclick="eliminarAgente('${doc.id}', '${data.nombre}')">X</button>
                </div>
            `;
            agentsList.appendChild(card);
        });

        // Sumario Superior Opcional
        const sumario = document.createElement('div');
        sumario.style.background = "rgba(255,170,0,0.1)";
        sumario.style.padding = "10px";
        sumario.style.marginBottom = "15px";
        sumario.style.border = "1px solid rgba(255,170,0,0.5)";
        sumario.style.color = "#ffaa00";
        sumario.style.fontWeight = "bold";
        sumario.style.textAlign = "center";
        sumario.innerHTML = `
            TOTAL: ${agentsCount} | VALIDADOS: ${validadosCount} | EN POSICIÓN: ${llegadosCount}
        `;
        agentsList.insertBefore(sumario, agentsList.firstChild);
    });
}

/**
 * 2. ESCUCHAR ESTADO GLOBAL (Clave grupal, tiempo, etc)
 */
function escucharEstadoMision() {
    const groupRef = doc(db, "grupos", GROUP_ID);

    onSnapshot(groupRef, (snapshot) => {
        if (!snapshot.exists()) return;
        const data = snapshot.data();

        // 1. Mostrar estado de la clave grupal e interfaz de pausa
        if (data.pausado) {
            missionStatusText.textContent = "⚠️ OPERACIÓN EN PAUSA";
            missionStatusText.style.color = "#ffaa00";
            btnTogglePause.style.display = "block"; // Asegurar que sea visible
            btnTogglePause.innerHTML = "▶️ REANUDAR OPERACIÓN";
            btnTogglePause.style.borderColor = "#33ff33";
            btnTogglePause.style.color = "#33ff33";

            // Detener contador visual
            if (timerInterval) clearInterval(timerInterval);
            missionTimerEl.style.color = "#888";
        } else {
            missionStatusText.style.color = "#33ff33";
            btnTogglePause.style.display = "block"; // Asegurar que sea visible
            btnTogglePause.innerHTML = "⏸️ PAUSAR OPERACIÓN";
            btnTogglePause.style.borderColor = "#ffff33";
            btnTogglePause.style.color = "#ffff33";

            // Si hay tiempo de inicio, mostrar que está en curso
            if (data.tiempo_inicio) {
                missionStatusText.textContent = "OPERÁCIÓN EN CURSO";
                iniciarContadorAdmin(data.tiempo_inicio);
            } else {
                missionStatusText.textContent = "ESPERANDO CLAVE DE ESCUADRÓN...";
                missionStatusText.style.color = "#ffff33";
                missionTimerEl.innerText = "00:00:00";
                missionTimerEl.style.color = "#ff3333";
            }
        }

        if (data.tiempo_inicio) {
            const start = data.tiempo_inicio.toDate();
            missionStartTimeEl.textContent = `INICIADO: ${start.toLocaleTimeString()}`;

            // Actualizar LOG de misiones
            document.getElementById('val-mision-inicio').textContent = start.toLocaleTimeString();
            document.getElementById('val-mision-inicio').style.color = "#33ff33";

            // Misión 1: Ascenso
            if (data.mision1_fin) {
                const m1End = data.mision1_fin.toDate();
                document.getElementById('val-mision-1').textContent = `FINALIZADA (${m1End.toLocaleTimeString()})`;
                document.getElementById('val-mision-1').style.color = "#33ff33";
                document.getElementById('label-mision-1').style.color = "#33ff33";

                // Si la 1 ha terminado, la 2 está en curso
                if (!data.mision2_fin) {
                    document.getElementById('val-mision-2').textContent = "EN CURSO...";
                    document.getElementById('val-mision-2').style.color = "#ffff33";
                    document.getElementById('label-mision-2').style.color = "#ffff33";
                }
            } else {
                document.getElementById('val-mision-1').textContent = "EN CURSO...";
                document.getElementById('val-mision-1').style.color = "#ffff33";
                document.getElementById('label-mision-1').style.color = "#ffff33";
            }

            // Fin de Operación
            if (data.tiempo_fin) {
                const end = data.tiempo_fin.toDate();
                document.getElementById('val-mision-final').textContent = end.toLocaleTimeString();
                document.getElementById('val-mision-final').style.color = "#33ff33";
            }

        } else {
            missionStartTimeEl.textContent = "TIEMPO: --:--:--";
        }

        // --- SINCRONIZAR CONFIGURACIÓN DE CITA ---
        const inputDia = document.getElementById('cfg-cita-dia');
        const inputHora = document.getElementById('cfg-cita-hora');

        if (inputDia && document.activeElement !== inputDia) {
            inputDia.value = data.cita_dia || "";
        }
        if (inputHora && document.activeElement !== inputHora) {
            inputHora.value = data.cita_hora || "";
        }

    });
}

let timerInterval = null;
function iniciarContadorAdmin(firebaseTimestamp) {
    if (timerInterval) clearInterval(timerInterval);

    const startTime = firebaseTimestamp.toDate().getTime();
    const TOTAL_TIME = 2 * 60 * 60 * 1000; // 2 horas (igual que en app.js)
    const endTime = startTime + TOTAL_TIME;

    function updateAdminTimer() {
        const now = Date.now();
        const diff = endTime - now;

        if (diff <= 0) {
            // Overtime
            const overTime = Math.abs(diff);
            const oh = Math.floor(overTime / (1000 * 60 * 60));
            const om = Math.floor((overTime % (1000 * 60 * 60)) / (1000 * 60));
            const os = Math.floor((overTime % (1000 * 60)) / 1000);

            const pH = oh < 10 ? "0" + oh : oh;
            const pM = om < 10 ? "0" + om : om;
            const pS = os < 10 ? "0" + os : os;

            missionTimerEl.innerText = `+${pH}:${pM}:${pS}`;
            missionTimerEl.style.color = "#ffaa00";
        } else {
            const h = Math.floor(diff / (1000 * 60 * 60));
            const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const s = Math.floor((diff % (1000 * 60)) / 1000);

            const fH = h < 10 ? "0" + h : h;
            const fM = m < 10 ? "0" + m : m;
            const fS = s < 10 ? "0" + s : s;

            missionTimerEl.innerText = `${fH}:${fM}:${fS}`;
            missionTimerEl.style.color = "#ff3333";
        }
    }

    updateAdminTimer();
    timerInterval = setInterval(updateAdminTimer, 1000);
}

/**
 * 2. ESCUCHAR Y GESTIONAR CHAT "ENLACE HQ"
 */
function escucharChat() {
    const messagesRef = collection(db, "grupos", GROUP_ID, "mensajes");
    const q = query(messagesRef, orderBy("timestamp", "asc"), limit(100));

    onSnapshot(q, (snapshot) => {
        chatMessages.innerHTML = ""; // Limpiamos para evitar duplicados en render

        if (snapshot.empty) {
            chatMessages.innerHTML = '<div class="msg-sys">[ CANAL DE COMUNICACIÓN LIMPIO — ESPERANDO TRANSMISIONES ]</div>';
            return;
        }

        snapshot.forEach((doc) => {
            const data = doc.data();
            appendMessage(data);
        });

        scrollToBottom();
    });
}

function appendMessage(msg) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `msg-wrapper ${msg.sender === "HQ" ? 'msg-hq' : 'msg-agent'}`;

    const time = msg.timestamp ? new Date(msg.timestamp.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "--:--";
    const senderName = msg.sender === "HQ" ? "MANDO CENTRAL (TÚ)" : `AGENTE DE CAMPO`;

    msgDiv.innerHTML = `
        <div class="msg-header">[${time}] ${senderName}</div>
        <div class="msg-content">${msg.text}</div>
    `;

    chatMessages.appendChild(msgDiv);
}

function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

/**
 * 3. ENVIAR MENSAJES DESDE HQ
 */
async function enviarMensaje() {
    const text = chatInput.value.trim();
    if (!text) return;

    chatInput.value = "";
    btnSendChat.disabled = true;

    try {
        const messagesRef = collection(db, "grupos", GROUP_ID, "mensajes");
        await addDoc(messagesRef, {
            text: text,
            sender: "HQ", // MUY IMPORTANTE: Esto dispara la alarma ROJA en los móviles
            timestamp: serverTimestamp()
        });
        console.log("Mensaje de HQ enviado con éxito.");
    } catch (err) {
        console.error("Error enviando mensaje: ", err);
        alert("ERROR: No se pudo conectar con los agentes.");
    } finally {
        btnSendChat.disabled = false;
        chatInput.focus();
    }
}

btnSendChat.addEventListener('click', enviarMensaje);
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') enviarMensaje();
});

/**
 * 4. EVENTOS ADICIONALES DEL ADMIN
 */
function configurarEventosGrupales() {
    // Botón para borrar el chat
    btnResetMessages.addEventListener('click', async () => {
        const confirmacion = confirm("⚠️ ¿ESTÁ SEGURO?\n\nEsto borrará todo el historial de chat para todos los dispositivos conectados de los agentes.\nEsta acción no se puede deshacer.");
        if (!confirmacion) return;

        console.log("Iniciando purga de la base de datos de mensajes...");
        const messagesRef = collection(db, "grupos", GROUP_ID, "mensajes");

        try {
            const snapshot = await getDocs(messagesRef);
            const deletePromises = snapshot.docs.map(docSnapshot => deleteDoc(docSnapshot.ref));
            await Promise.all(deletePromises);
            console.log("Chat limpiado exitosamente.");
        } catch (error) {
            console.error("Error limpiando chat:", error);
            alert("Ocurrió un error al limpiar los mensajes.");
        }
    });

    // Añadir nuevo agente manualmente
    if (btnAddAgent) {
        btnAddAgent.addEventListener('click', async () => {
            const nombre = inputAgentName.value.trim().toUpperCase();
            const codigo = inputAgentCode.value.trim().toUpperCase();

            if (!nombre || !codigo) {
                alert("Por favor, introduzca al menos un Nombre y un Código de acceso válido.");
                return;
            }

            try {
                const agentsRef = collection(db, "grupos", GROUP_ID, "integrantes");
                await addDoc(agentsRef, {
                    nombre: nombre,
                    codigo_individual: codigo,
                    validado: false,
                    llegado: false
                });

                inputAgentName.value = "";
                inputAgentCode.value = "";
                console.log(`Nuevo agente creado: ${nombre}`);
            } catch (err) {
                console.error("Error al crear agente:", err);
                alert("Ocurrió un error al añadir al agente de campo.");
            }
        });
    }

    // BOTÓN GUARDAR CITA (DÍA/HORA)
    const btnSaveCita = document.getElementById('btn-save-cita');
    const inputCitaDia = document.getElementById('cfg-cita-dia');
    const inputCitaHora = document.getElementById('cfg-cita-hora');

    if (btnSaveCita) {
        btnSaveCita.addEventListener('click', async () => {
            const dia = inputCitaDia.value.trim().toUpperCase();
            const hora = inputCitaHora.value.trim().toUpperCase();

            try {
                const groupRef = doc(db, "grupos", GROUP_ID);
                await updateDoc(groupRef, {
                    cita_dia: dia,
                    cita_hora: hora
                });
                alert("DATOS DE CITA ACTUALIZADOS CORRECTAMENTE.");
            } catch (err) {
                console.error("Error al guardar cita:", err);
                alert("Error al actualizar los datos de la cita.");
            }
        });
    }

    // BOTÓN DE PAUSA
    if (btnTogglePause) {
        btnTogglePause.addEventListener('click', async () => {
            const groupRef = doc(db, "grupos", GROUP_ID);
            const snap = await getDocs(query(collection(db, "grupos"), where("__name__", "==", GROUP_ID)));
            if (snap.empty) return;

            const data = snap.docs[0].data();
            const isPausado = data.pausado || false;

            if (!isPausado) {
                // PAUSAR: Guardar momento de pausa
                await updateDoc(groupRef, {
                    pausado: true,
                    pausa_inicio: serverTimestamp()
                });
                console.log("Misión PAUSADA.");
            } else {
                // REANUDAR: Ajustar tiempo_inicio sumando la duración de la pausa solo si existe
                let updates = {
                    pausado: false,
                    pausa_inicio: null
                };

                if (data.tiempo_inicio) {
                    const now = Date.now();
                    const pausaInicio = (data.pausa_inicio ? data.pausa_inicio.toDate().getTime() : now);
                    const duracionPausa = now - pausaInicio;
                    const nuevoInicio = new Date(data.tiempo_inicio.toDate().getTime() + duracionPausa);
                    updates.tiempo_inicio = nuevoInicio;
                }

                await updateDoc(groupRef, updates);
                console.log("Misión REANUDADA.");
            }
        });
    }

    // BOTÓN DE RESET TOTAL
    if (btnFullReset) {
        btnFullReset.addEventListener('click', async () => {
            const confirm1 = confirm("⚠️ ¿ESTÁ SEGURO?\n\nEsta acción es irreversible y afectará a todos los jugadores en tiempo real:\n\n1. Se borrará el historial de chat.\n2. Todos los jugadores volverán a la pantalla de login.\n3. El contador de tiempo se pondrá a cero.\n\n¿Desea proceder?");
            if (!confirm1) return;

            const confirm2 = confirm("☢️ CONFIRMACIÓN FINAL\n\n¿Está totalmente seguro de resetear la Operación?");
            if (!confirm2) return;

            console.log("Iniciando PURGA TOTAL del sistema...");

            try {
                // 1. Borrar mensajes
                const messagesRef = collection(db, "grupos", GROUP_ID, "mensajes");
                const msgSnap = await getDocs(messagesRef);
                const msgPromises = msgSnap.docs.map(d => deleteDoc(d.ref));
                await Promise.all(msgPromises);
                console.log("- Chat borrado.");

                // 2. Resetear integrantes (validado = false, llegado = false)
                const membersRef = collection(db, "grupos", GROUP_ID, "integrantes");
                const memSnap = await getDocs(membersRef);
                const memPromises = memSnap.docs.map(d =>
                    updateDoc(d.ref, { validado: false, llegado: false })
                );
                await Promise.all(memPromises);
                console.log("- Agentes reseteados.");

                // 3. Resetear grupo (borrar tiempos y marcar activo y NO pausado)
                const groupRef = doc(db, "grupos", GROUP_ID);
                await updateDoc(groupRef, {
                    tiempo_inicio: null,
                    tiempo_fin: null,
                    mision1_fin: null,
                    pausado: false,
                    pausa_inicio: null,
                    activo: true
                });
                console.log("- Tiempos de misión borrados.");

                // 4. Detener contador local del admin si existe
                if (timerInterval) {
                    clearInterval(timerInterval);
                    timerInterval = null;
                    missionTimerEl.innerText = "00:00:00";
                    missionTimerEl.style.color = "#ff3333";
                }

                alert("SISTEMA PURGADO CON ÉXITO.\nTodos los agentes han sido expulsados a la pantalla de inicio.");

            } catch (err) {
                console.error("Error en purga total:", err);
                alert("ERROR CRÍTICO: No se pudo completar la purga total.");
            }
        });
    }
}

/**
 * 5. FUNCIONES GLOBALES PARA LOS BOTONES INLINE DE LA LISTA
 */
window.toggleValidado = async function (docId, currentValue) {
    try {
        const docRef = doc(db, "grupos", GROUP_ID, "integrantes", docId);
        await updateDoc(docRef, { validado: !currentValue });
    } catch (err) {
        console.error("Error actualizando validado", err);
    }
};

window.toggleLlegado = async function (docId, currentValue) {
    try {
        const docRef = doc(db, "grupos", GROUP_ID, "integrantes", docId);
        await updateDoc(docRef, { llegado: !currentValue });
    } catch (err) {
        console.error("Error actualizando llegado", err);
    }
};

window.editarCodigoAgente = async function (docId, currentCode) {
    const newCode = prompt("Introduzca el nuevo código de acceso para este agente:", currentCode);
    if (newCode !== null && newCode.trim() !== "") {
        try {
            const docRef = doc(db, "grupos", GROUP_ID, "integrantes", docId);
            await updateDoc(docRef, { codigo_individual: newCode.trim().toUpperCase() });
        } catch (err) {
            console.error("Error actualizando código", err);
        }
    }
};

window.eliminarAgente = async function (docId, name) {
    if (confirm(`¿ESTÁ SEGURO?\n\nVa a eliminar el expediente del agente: ${name || 'Desconocido'}.\nEsto no se puede deshacer.`)) {
        try {
            const docRef = doc(db, "grupos", GROUP_ID, "integrantes", docId);
            await deleteDoc(docRef);
        } catch (err) {
            console.error("Error eliminando agente", err);
        }
    }
};
