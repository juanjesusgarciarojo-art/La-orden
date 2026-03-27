import { db } from '../firebase.js';
import { collection, query, orderBy, limit, onSnapshot, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const GROUP_ID = "grupo_activo";

export function initChatEvents() {
    console.log("Inicializando Canal del Cuartel General...");
    const chatInput = document.getElementById('chat-input-text');
    const btnEnviar = document.getElementById('btn-enviar-chat');
    const messagesContainer = document.getElementById('chat-messages');
    const commModal = document.getElementById('comm-alert-modal');
    const btnIrAChat = document.getElementById('btn-ir-a-chat');
    const alertSound = document.getElementById('comm-alert-sound');

    if (!chatInput || !messagesContainer) return;

    // 1. Escuchar mensajes en tiempo real
    const messagesRef = collection(db, "grupos", GROUP_ID, "mensajes");
    const q = query(messagesRef, orderBy("timestamp", "asc"), limit(50));

    let initialLoad = true;

    onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
                const msg = change.doc.data();
                appendMessage(msg);

                // Si es un mensaje nuevo (no la carga inicial) y es del HQ
                if (!initialLoad && msg.sender === "HQ") {
                    notificarNuevoMensaje();
                }
            }
        });
        initialLoad = false;
        scrollToBottom();
    });

    // 2. Enviar mensajes
    async function enviarMensaje() {
        const text = chatInput.value.trim();
        if (!text) return;

        chatInput.value = "";
        btnEnviar.disabled = true;

        try {
            await addDoc(messagesRef, {
                text: text,
                sender: "AGENTE",
                timestamp: serverTimestamp()
            });
            console.log("Mensaje enviado a HQ");
        } catch (err) {
            console.error("Error al enviar mensaje:", err);
        } finally {
            btnEnviar.disabled = false;
            chatInput.focus();
        }
    }

    btnEnviar.addEventListener('click', enviarMensaje);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') enviarMensaje();
    });

    // 3. Notificaciones
    function notificarNuevoMensaje() {
        // Sonido
        if (alertSound) {
            alertSound.currentTime = 0;
            alertSound.play().catch(() => { });
        }

        // Modal de aviso
        if (commModal) {
            commModal.classList.remove('hidden-tab');
            commModal.style.display = 'block';
        }
    }

    if (btnIrAChat) {
        btnIrAChat.addEventListener('click', () => {
            if (commModal) {
                commModal.classList.add('hidden-tab');
                commModal.style.display = 'none';
            }
            // Ir a la pestaa de comunicaciones
            const btnComm = document.querySelector('.nav-btn[data-tab="comunicaciones"]');
            if (btnComm) btnComm.click();
        });
    }

    // Funciones auxiliares
    function appendMessage(msg) {
        const msgDiv = document.createElement('div');
        msgDiv.style.marginBottom = '15px';
        msgDiv.style.lineHeight = '1.4';

        const time = msg.timestamp ? new Date(msg.timestamp.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "--:--";

        if (msg.sender === "HQ") {
            msgDiv.innerHTML = `
                <div style="color: #888; font-size: 0.75rem; margin-bottom: 3px;">[${time}] CUARTEL GENERAL:</div>
                <div style="color: #ff3333; background: rgba(255, 51, 51, 0.1); padding: 8px; border-left: 2px solid #ff3333;">${msg.text}</div>
            `;
        } else {
            msgDiv.innerHTML = `
                <div style="color: #888; font-size: 0.75rem; margin-bottom: 3px; text-align: right;">[${time}] AGENTE:</div>
                <div style="color: #00ffcc; background: rgba(0, 255, 204, 0.05); padding: 8px; border-right: 2px solid #00ffcc; text-align: right;">${msg.text}</div>
            `;
        }

        messagesContainer.appendChild(msgDiv);
        scrollToBottom();
    }

    function scrollToBottom() {
        if(messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }
}
