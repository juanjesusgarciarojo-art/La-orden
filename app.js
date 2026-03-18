// IMPORT FIREBASE
import { db } from './firebase.js';
import {
    collection,
    query,
    where,
    getDocs,
    doc,
    getDoc,
    updateDoc,
    onSnapshot,
    serverTimestamp,
    addDoc,
    orderBy,
    limit
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// DOM Elements
const headerLine = document.getElementById('header-line');
const instructionLine = document.getElementById('instruction-line');
const inputContainer = document.getElementById('input-container');
const footerContainer = document.getElementById('footer-container');
const codeInput = document.getElementById('code-input');
const btnVerify = document.getElementById('btn-verify');
const btnReset = document.getElementById('btn-reset');
const messageArea = document.getElementById('message-area');
const btnFinalizar = document.getElementById('btn-finalizar');

// Audio
const grantedSound = document.getElementById('access-granted-sound');
const deniedSound = document.getElementById('access-denied-sound');
const typingSound = document.getElementById('typing-sound');

// CONSTANTS
const GROUP_ID = "grupo_activo";
const HEADER_TEXT = "C:\\MS-DOS\\SECURITY> INGRESO AL SISTEMA";
const INSTRUCTION_TEXT = "INGRESE LA CONTRASEÑA:";
const COORDENADAS_REUNION = "40°38'29.6\"N 3°09'41.0\"W";
const MAPS_URL = "https://www.google.com/maps/search/?api=1&query=40.641556,-3.161389";
let groupListener = null; // Para detener la escucha si es necesario

// INIT
init();

async function init() {
    // Verificar si ya completó la fase 2
    if (localStorage.getItem('fase2_desbloqueada') === 'true') {
        showAgencyInterface(true);
        return;
    }

    // Verificar si ya está validado en este navegador (Paso 1)
    const savedUser = localStorage.getItem('agente_validado');

    if (savedUser) {
        const userData = JSON.parse(savedUser);
        mostrarExito(userData);
        return;
    }

    // Efecto de inicio letra a letra (Estilo MS-DOS)
    await typeWriter(HEADER_TEXT, headerLine, 30);
    await new Promise(r => setTimeout(r, 500));
    await typeWriter(INSTRUCTION_TEXT, instructionLine, 30);

    // Hacer visible el input
    setTimeout(() => {
        inputContainer.classList.add('visible');
        footerContainer.classList.add('visible');
        codeInput.focus();
    }, 300);

    // Iniciar escucha de pausa global
    escucharPausaGlobal();
}

/**
 * Escucha el estado de pausa desde Firebase
 */
function escucharPausaGlobal() {
    const pauseOverlay = document.getElementById('pause-overlay');
    const siren = document.getElementById('pause-siren-sound');
    const groupRef = doc(db, "grupos", GROUP_ID);

    onSnapshot(groupRef, (snapshot) => {
        if (!snapshot.exists()) return;
        const data = snapshot.data();

        if (data.pausado) {
            pauseOverlay.style.display = "flex";
            siren?.play().catch(() => { });
        } else {
            pauseOverlay.style.display = "none";
            if (siren) {
                siren.pause();
                siren.currentTime = 0;
            }

            // Si hay un tiempo_inicio y estamos en la interfaz de agencia, 
            if (data.tiempo_inicio && localStorage.getItem('fase2_desbloqueada') === 'true') {
                updateLocalEndTime(data.tiempo_inicio);
            }
        }
    });

    // Configurar canal de emergencia durante la pausa
    setupPauseChat();
}

function setupPauseChat() {
    const pauseInput = document.getElementById('pause-chat-input');
    const btnPauseSend = document.getElementById('btn-pause-send');
    const pauseMsgContainer = document.getElementById('pause-chat-messages');

    btnPauseSend?.addEventListener('click', async () => {
        const text = pauseInput.value.trim();
        if (text) {
            try {
                const messagesRef = collection(db, "grupos", GROUP_ID, "mensajes");
                await addDoc(messagesRef, {
                    text: text,
                    sender: "AGENTE",
                    timestamp: serverTimestamp()
                });
                pauseInput.value = "";
            } catch (e) { console.error(e); }
        }
    });

    pauseInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') btnPauseSend.click();
    });

    // Escuchar mensajes solo para el mini-chat de pausa
    const messagesRef = collection(db, "grupos", GROUP_ID, "mensajes");
    const q = query(messagesRef, orderBy("timestamp", "asc"), limit(20));

    onSnapshot(q, (snapshot) => {
        if (!pauseMsgContainer) return;
        pauseMsgContainer.innerHTML = "";
        snapshot.forEach((doc) => {
            const m = doc.data();
            const div = document.createElement('div');
            div.style.marginBottom = "8px";
            div.style.lineHeight = "1.2";
            const color = m.sender === "HQ" ? "#ffff33" : "#00ffcc";
            const sender = m.sender === "HQ" ? "HQ" : "AGENTE";
            div.innerHTML = `<span style="color:${color}; font-weight:bold;">[${sender}]</span> ${m.text}`;
            pauseMsgContainer.appendChild(div);
        });
        pauseMsgContainer.scrollTop = pauseMsgContainer.scrollHeight;
    });
}

function updateLocalEndTime(firebaseTimestamp) {
    const startTime = firebaseTimestamp.toDate().getTime();
    const TOTAL_TIME = 2 * 60 * 60 * 1000;
    const newEndTime = startTime + TOTAL_TIME;
    localStorage.setItem('timer_end_time', newEndTime.toString());
}

// VERIFY EVENTS
btnVerify.addEventListener('click', handleVerify);
codeInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleVerify();
});

if (btnFinalizar) {
    btnFinalizar.addEventListener('click', finalizarMision);
}

async function handleVerify() {

    const code = codeInput.value.trim().toUpperCase();
    if (!code) return;

    // COMANDO SECRETO PARA DESARROLLADOR: RESET
    if (code === "RESET") {
        messageArea.textContent = "INICIANDO RESET DE EMERGENCIA...";
        messageArea.style.color = "#ffff33";
        localStorage.clear();
        // Asegurarnos de limpiar todo
        localStorage.removeItem('fase_espera');
        localStorage.removeItem('fase2_desbloqueada');
        localStorage.removeItem('agente_validado');
        localStorage.removeItem('timer_end_time');

        try {
            const membersRef = collection(db, "grupos", GROUP_ID, "integrantes");
            const snapshot = await getDocs(membersRef);
            const batchPromises = snapshot.docs.map(memberDoc =>
                updateDoc(memberDoc.ref, { validado: false, llegado: false })
            );
            await Promise.all(batchPromises);

            messageArea.textContent = "SISTEMA REINICIADO. RECARGANDO...";
            setTimeout(() => location.reload(), 1500);
        } catch (err) {
            console.error(err);
            messageArea.textContent = "ERROR EN RESET DE BASE DE DATOS";
        }
        return;
    }

    // Lógica para código de grupo si estamos en esa fase
    if (localStorage.getItem('fase_espera') === 'true') {
        handleGroupCode(code);
        return;
    }

    messageArea.textContent = "VERIFICANDO...";
    codeInput.disabled = true;
    btnVerify.disabled = true;

    try {
        const result = await validateCode(code);

        if (result.status === "SUCCESS") {
            // Guardar en persistencia local
            localStorage.setItem('agente_validado', JSON.stringify(result.data));
            mostrarExito(result.data);

        } else if (result === "USED") {
            // Un zumbido o sonido de error (puedes añadir un .mp3 de buzz)
            deniedSound?.play().catch(() => { });
            messageArea.textContent = "ERROR: CÓDIGO YA EN USO";
            messageArea.style.color = "#ff3333";
            resetInput();

        } else if (result === "INACTIVE") {

            messageArea.textContent = "GRUPO NO ACTIVO";
            messageArea.style.color = "#ff3333";
            resetInput();

        } else {
            deniedSound?.play().catch(() => { });
            messageArea.textContent = "ACCESO DENEGADO";
            messageArea.style.color = "#ff3333";
            resetInput();
        }

    } catch (e) {
        console.error(e);
        messageArea.textContent = "ERROR DE CONEXION";
        resetInput();
    }
}

/**
 * Función que encapsula el éxito de validación
 */
async function mostrarExito(userData) {
    inputContainer.style.display = "none";
    messageArea.textContent = "ACCESO AUTORIZADO";
    messageArea.style.color = "#33ff33";

    // Limpiar para el efecto
    headerLine.innerHTML = "";
    instructionLine.innerHTML = "";

    const nombre = userData.nombre || "AGENTE";

    setTimeout(async () => {
        messageArea.textContent = "INICIANDO DESENCRIPTADO...";

        // Obtener datos de la cita desde Firestore
        let citaDia = "FECHA RESTRINGIDA";
        let citaHora = "HORA RESTRINGIDA";
        try {
            const groupRef = doc(db, "grupos", GROUP_ID);
            const groupSnap = await getDoc(groupRef);
            if (groupSnap.exists()) {
                const data = groupSnap.data();
                if (data.cita_dia) citaDia = data.cita_dia;
                if (data.cita_hora) citaHora = data.cita_hora;
            }
        } catch (err) { console.error("Error al recuperar datos de la cita", err); }

        await typeWriter(`BIENVENIDO RECLUTA ${nombre.toUpperCase()}`, headerLine, 50);
        await new Promise(r => setTimeout(r, 800));

        messageArea.textContent = "RECEPCIÓN DE COORDENADAS COMPLETA";
        messageArea.style.color = "#ffff33";

        const mensajeFinal = `SI HAS RECIBIDO ESTO, ES PORQUE ALGUIEN CREE QUE ERES UN MIEMBRO POTENCIAL PARA LA ORGANIZACIÓN.\n\nPERO TEN CUIDADO: SE HAN DETECTADO TOPOS EN EL SECTOR.\n\nLOCALIZACIÓN DETECTADA:\n${COORDENADAS_REUNION}\n\nDIA: <span style="color:#ff3333; font-weight:bold;">${citaDia}</span>\nHORA: <span style="color:#ff3333; font-weight:bold;">${citaHora}</span>\n\nPOR FAVOR, BUSQUEN UN LUGAR PARA SENTARSE Y PÓNGANSE CÓMODOS HASTA QUE SE REÚNA TODO EL EQUIPO.\n\nNO ESTABLEZCA CONTACTO CON DESCONOCIDOS. LA ORDEN OS OBSERVA.`;
        await typeWriter(mensajeFinal, instructionLine, 40);

        instructionLine.appendChild(document.createElement('br'));

        const buttonContainer = document.createElement('div');
        buttonContainer.style.marginTop = "20px";
        buttonContainer.style.marginBottom = "20px";
        buttonContainer.style.display = "flex";
        buttonContainer.style.flexDirection = "column";
        buttonContainer.style.gap = "15px";

        const mapToggle = document.createElement('span');
        mapToggle.className = "dos-link";
        mapToggle.style.cursor = "pointer";
        mapToggle.innerHTML = "[ VER MAPA SATELITAL DE LA ORDEN ]";

        const externalLink = document.createElement('a');
        externalLink.className = "dos-link";
        externalLink.style.color = "#ff3333";
        externalLink.style.textDecoration = "none";
        externalLink.href = "https://www.google.com/maps/search/?api=1&query=40.641556,-3.161389";
        externalLink.target = "_blank";
        externalLink.innerHTML = "[ ⚠️ ENLAZAR CON NAVEGACIÓN CIVIL EXTERNA ]";

        buttonContainer.appendChild(mapToggle);
        buttonContainer.appendChild(externalLink);

        const mapContainer = document.createElement('div');
        mapContainer.style.display = "none";
        mapContainer.style.marginTop = "15px";
        mapContainer.style.border = "1px solid #ffff33";
        mapContainer.style.width = "100%";
        mapContainer.style.maxWidth = "600px";

        const mapIframe = document.createElement('iframe');
        // Enlace especial de embed para evitar problemas de cross-origin
        mapIframe.src = "https://maps.google.com/maps?q=40.641556,-3.161389&t=&z=16&ie=UTF8&iwloc=&output=embed";
        mapIframe.width = "100%";
        mapIframe.height = "350";
        mapIframe.style.border = "none";
        mapIframe.allowFullscreen = "";
        mapIframe.loading = "lazy";

        mapContainer.appendChild(mapIframe);

        mapToggle.onclick = () => {
            if (mapContainer.style.display === "none") {
                mapContainer.style.display = "block";
                mapToggle.innerHTML = "[ OCULTAR MAPA SATELITAL ]";
            } else {
                mapContainer.style.display = "none";
                mapToggle.innerHTML = "[ VER MAPA SATELITAL DE LA ORDEN ]";
            }
        };

        instructionLine.appendChild(buttonContainer);
        instructionLine.appendChild(mapContainer);

        // Botón de "He llegado"
        const confirmBtn = document.createElement('button');
        confirmBtn.className = "dos-btn btn-arrived";
        confirmBtn.style.marginTop = "20px";
        confirmBtn.textContent = "ESTOY EN EL PUNTO DE ENCUENTRO";
        confirmBtn.onclick = () => marcarLlegada(userData.codigo_individual);
        instructionLine.appendChild(document.createElement('br'));
        instructionLine.appendChild(confirmBtn);

        messageArea.textContent = "SISTEMA ENCRIPTADO. CIERRE LA SESIÓN AL SALIR.";
    }, 1500);
}

async function marcarLlegada(userCode) {
    messageArea.textContent = "REGISTRANDO POSICIÓN...";

    // Buscar el integrante otra vez para actualizarlo
    const membersRef = collection(db, "grupos", GROUP_ID, "integrantes");
    const q = query(membersRef, where("codigo_individual", "==", userCode));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
        await updateDoc(snapshot.docs[0].ref, { llegado: true });
        localStorage.setItem('fase_espera', 'true');
        iniciarEsperaGrupal();
    }
}

function iniciarEsperaGrupal() {
    inputContainer.style.display = "none";
    headerLine.innerHTML = "SISTEMA DE GESTIÓN DE ESCUADRÓN";
    instructionLine.innerHTML = "COMPROBANDO ESTADO DEL EQUIPO...<br>ESPERE A QUE TODOS LOS AGENTES LLEGUEN AL PUNTO.";

    const membersRef = collection(db, "grupos", GROUP_ID, "integrantes");

    // Escuchar cambios en tiempo real
    groupListener = onSnapshot(membersRef, (snapshot) => {
        const total = snapshot.size;
        const llegaron = snapshot.docs.filter(d => d.data().llegado).length;

        messageArea.textContent = `AGENTES EN POSICIÓN: ${llegaron} / ${total}`;

        if (llegaron === total && total > 0) {
            // ¡TODOS LLEGARON!
            groupListener(); // Detener escucha
            pedirCodigoGrupo();
        }
    });
}

async function pedirCodigoGrupo() {
    await typeWriter("TODOS LOS AGENTES SE ENCUENTRAN EN POSICIÓN.\nHA SUPERADO LA PRIMERA PRUEBA DE MUCHAS.\n\nESTABLECIENDO CONEXIÓN SEGURA... TRANSMISIÓN ENTRANTE:", instructionLine, 40);

    // Contenedor del vídeo
    const videoContainer = document.createElement('div');
    videoContainer.className = "video-container";
    videoContainer.style.marginTop = "20px";
    videoContainer.style.marginBottom = "20px";
    videoContainer.style.opacity = "0";
    videoContainer.style.transition = "opacity 2s";

    // Ponemos un vídeo de prueba de YouTube
    // Puedes cambiar la ID "dQw4w9WgXcQ" por la ID del vídeo final
    videoContainer.innerHTML = `<iframe width="100%" height="315" style="max-width: 560px; border: 1px solid var(--text-color);" src="https://www.youtube.com/embed/dQw4w9WgXcQ" title="Transmisión La Orden" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;

    instructionLine.appendChild(videoContainer);

    // Animación de aparición del vídeo
    setTimeout(() => {
        videoContainer.style.opacity = "1";
    }, 500);

    // Esperar un par de segundos antes de pedir el código
    await new Promise(r => setTimeout(r, 2000));

    const promptTextContainer = document.createElement('div');
    promptTextContainer.style.marginTop = "20px";
    promptTextContainer.style.color = "#ffff33"; // Texto en amarillo para llamar la atención
    instructionLine.appendChild(promptTextContainer);

    await typeWriter("INTRODUZCA LA CLAVE DE ESCUADRÓN REVELADA EN EL VÍDEO PARA CONTINUAR:", promptTextContainer, 40);

    inputContainer.style.display = "flex";
    inputContainer.classList.add('visible'); // <-- Reparación de opacidad
    codeInput.value = "";
    codeInput.disabled = false;
    btnVerify.disabled = false;
    codeInput.classList.add('highlight-code-input');
    btnVerify.classList.add('highlight-code-input'); // Botón también en amarillo
    btnVerify.style.color = "#000"; // Letras del botón en negro para resaltar sobre fondo amarillo
    btnVerify.style.backgroundColor = "#ffff33";
    codeInput.focus();
}

async function handleGroupCode(code) {
    const groupRef = doc(db, "grupos", GROUP_ID);
    const snap = await getDoc(groupRef);
    const groupData = snap.data();

    if (code === groupData.codigo_grupo) {
        inputContainer.style.display = "none";
        messageArea.textContent = "ESCANEANDO CLAVE... OK";
        messageArea.style.color = "#33ff33";

        // Reproducir sonido de éxito
        const grantedSound = document.getElementById('access-granted-sound');
        grantedSound?.play().catch(() => { });

        // Registrar inicio de la partida en Firebase
        if (!groupData.tiempo_inicio) {
            await updateDoc(groupRef, {
                tiempo_inicio: serverTimestamp()
            });
        }

        // Guardar que la fase 2 ha sido desbloqueada localmente
        localStorage.setItem('fase2_desbloqueada', 'true');

        setTimeout(() => {
            showAgencyInterface();
        }, 1500);

    } else {
        deniedSound?.play().catch(() => { });
        messageArea.textContent = "CLAVE DE ESCUADRÓN INVÁLIDA";
        messageArea.style.color = "#ff3333";
        codeInput.value = "";
    }
}

function resetInput() {
    setTimeout(() => {
        codeInput.disabled = false;
        btnVerify.disabled = false;
        codeInput.value = "";
        codeInput.focus();
        messageArea.textContent = "";
    }, 1500);
}

async function validateCode(code) {

    // 1️⃣ Comprobar que el grupo está activo
    const groupRef = doc(db, "grupos", GROUP_ID);
    const groupSnap = await getDoc(groupRef);

    if (!groupSnap.exists()) return "ERROR";

    const groupData = groupSnap.data();

    if (!groupData.activo) return "INACTIVE";

    // 2️⃣ Buscar el código en integrantes
    const membersRef = collection(db, "grupos", GROUP_ID, "integrantes");
    const q = query(membersRef, where("codigo_individual", "==", code));
    const snapshot = await getDocs(q);

    if (snapshot.empty) return "NOT_FOUND";

    const memberDoc = snapshot.docs[0];
    const memberData = memberDoc.data();

    if (memberData.validado) return "USED";

    // 3️⃣ Marcar como validado
    await updateDoc(memberDoc.ref, {
        validado: true
    });

    return {
        status: "SUCCESS",
        data: memberData
    };
}

/**
 * Función que escribe texto letra a letra con sonido
 */
async function typeWriter(text, element, speed) {
    element.innerHTML = "";

    // Creamos un contenedor temporal para parsear el HTML y los saltos de línea
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = text.replace(/\n/g, '<br>');

    const playTypingSound = () => {
        if (typingSound) {
            typingSound.currentTime = 0;
            typingSound.volume = 0.2;
            typingSound.play().catch(() => { });
        }
    };

    // Función recursiva para procesar los nodos (texto y etiquetas)
    async function typeNode(sourceNode, targetNode) {
        const children = Array.from(sourceNode.childNodes);

        for (let child of children) {
            if (child.nodeType === Node.TEXT_NODE) {
                // Si es un nodo de texto, escribimos letra a letra
                const chars = Array.from(child.textContent);
                for (let char of chars) {
                    const textNode = document.createTextNode(char);
                    targetNode.appendChild(textNode);
                    if (char !== " " && char !== "\n") playTypingSound();
                    await new Promise(resolve => setTimeout(resolve, speed + (Math.random() * 15)));
                }
            } else if (child.nodeType === Node.ELEMENT_NODE) {
                // Si es una etiqueta (br, span, etc.), la creamos y seguimos dentro
                const newTag = document.createElement(child.tagName);

                // Copiamos atributos (style, class, etc.)
                Array.from(child.attributes).forEach(attr => {
                    newTag.setAttribute(attr.name, attr.value);
                });

                targetNode.appendChild(newTag);

                if (child.tagName !== 'BR') {
                    // Si no es un salto de línea, procesamos su contenido recursivamente
                    await typeNode(child, newTag);
                }
            }
        }
    }

    await typeNode(tempDiv, element);
}

/**
 * Función que transiciona del MS-DOS al entorno de la Agencia.
 * @param {boolean} skipAnimation Si es true, omite la carga y va directo a la interfaz
 */
function showAgencyInterface(skipAnimation = false) {
    const dosContainer = document.getElementById('dos-container');
    const loadingContainer = document.getElementById('loading-container');
    const agencyContainer = document.getElementById('agency-container');

    // Obtener el nombre del agente del localStorage
    const savedUser = localStorage.getItem('agente_validado');
    let agentName = "AGENTE";
    if (savedUser) {
        try {
            const userData = JSON.parse(savedUser);
            if (userData.nombre) agentName = userData.nombre.toUpperCase();
        } catch (e) { }
    }

    // Ocultar MS-DOS
    dosContainer.classList.add('hidden');

    if (skipAnimation) {
        // Directo al panel de agencia
        agencyContainer.classList.remove('hidden');
        document.body.style.background = '#000000'; // Quita el scanline si aplica o ajusta el fondo

        // Asignar el nombre si saltamos la animación
        const welcomeText = document.getElementById('agency-welcome');
        if (welcomeText) welcomeText.innerText = `BIENVENIDOS, RECLUTAS`;

        // Iniciar el temporizador
        initTimer();

        return;
    }

    // Pantalla de carga
    loadingContainer.classList.remove('hidden');
    document.body.style.background = '#000';

    // Esperar los 5 segundos de carga de la barra (definida en CSS)
    setTimeout(() => {
        loadingContainer.classList.add('hidden');
        agencyContainer.classList.remove('hidden');

        // Typing effect en la bienvenida si queremos (opcional)
        const welcomeText = document.getElementById('agency-welcome');
        if (welcomeText) {
            const finalTxt = `BIENVENIDOS, RECLUTAS`;
            welcomeText.innerText = "";
            let i = 0;
            const t = setInterval(() => {
                welcomeText.innerText += finalTxt.charAt(i);
                i++;
                if (i >= finalTxt.length) clearInterval(t);
            }, 50);
        }

        // Iniciar el temporizador al acabar la carga
        initTimer();
    }, 5000);
}

/**
 * Inicializa y actualiza el temporizador de 2 horas.
 */
function initTimer() {
    const timerElement = document.getElementById('countdown-timer');
    if (!timerElement) return;

    // Calcular el tiempo
    const TOTAL_TIME = 2 * 60 * 60 * 1000; // 2 horas en milisegundos
    let endTime = localStorage.getItem('timer_end_time');

    if (!endTime) {
        endTime = Date.now() + TOTAL_TIME;
        localStorage.setItem('timer_end_time', endTime.toString());
    } else {
        endTime = parseInt(endTime, 10);
    }

    function updateTimer() {
        const now = Date.now();
        const diff = endTime - now;

        if (diff <= 0) {
            // Tiempo original expirado: empieza a sumar (tiempo en positivo)
            const overTime = Math.abs(diff);
            const MAX_OVERTIME = 2 * 60 * 60 * 1000; // 2 horas extras máximo

            if (overTime >= MAX_OVERTIME) {
                timerElement.innerText = "+02:00:00";
                return; // Detener conteo visual
            }

            const oh = Math.floor(overTime / (1000 * 60 * 60));
            const om = Math.floor((overTime % (1000 * 60 * 60)) / (1000 * 60));
            const os = Math.floor((overTime % (1000 * 60)) / 1000);

            const plusH = oh < 10 ? "0" + oh : oh;
            const plusM = om < 10 ? "0" + om : om;
            const plusS = os < 10 ? "0" + os : os;

            timerElement.innerText = `+${plusH}:${plusM}:${plusS}`;
            timerElement.style.color = "#ffaa00"; // un tono cálido o naranja para indicar overtime
            timerElement.style.textShadow = "0 0 8px rgba(255, 170, 0, 0.6)";
            return;
        }

        // Cuenta regresiva normal
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        const h = hours < 10 ? "0" + hours : hours;
        const m = minutes < 10 ? "0" + minutes : minutes;
        const s = seconds < 10 ? "0" + seconds : seconds;

        timerElement.innerText = `${h}:${m}:${s}`;
    }

    // Ejecutar inmediatamente y luego cada segundo
    updateTimer();
    // Guardar referencia si hace falta cancelar
    window.agencyInterval = setInterval(updateTimer, 1000);
}

/**
 * Función para cerrar la partida en Firebase
 */
async function finalizarMision() {
    // Pedir contraseña para finalizar
    const password = prompt("ATENCIÓN: CÓDIGO DE FINALIZACIÓN REQUERIDO.\nPor favor, introduzca el código de finalización de misión:");

    if (password === null) return; // Si cancela

    const typedCode = password.trim().toUpperCase();
    if (!typedCode) {
        alert("CÓDIGO INVÁLIDO.");
        return;
    }

    try {
        const groupRef = doc(db, "grupos", GROUP_ID);
        const groupSnap = await getDoc(groupRef);

        if (!groupSnap.exists()) {
            alert("ERROR: NO SE ENCUENTRA SU GRUPO.");
            return;
        }

        const groupData = groupSnap.data();

        // Comprobar la contraseña final. 
        // Si el admin puso un 'codigo_final' en firebase, usarlo, si no, uno por defecto de seguridad
        const expectedCode = groupData.codigo_final ? groupData.codigo_final.toUpperCase() : "ENIGMA_2026";

        if (typedCode !== expectedCode) {
            // Sonido de error si queremos o solo alerta visual
            const deniedSound = document.getElementById('access-denied-sound');
            deniedSound?.play().catch(() => { });
            alert("ACCESO DENEGADO. Código de finalización incorrecto.");
            return;
        }

        // Si es correcto, marcamos finalización
        if (!groupData.tiempo_fin) {
            await updateDoc(groupRef, {
                tiempo_fin: serverTimestamp()
            });
        }

        if (window.agencyInterval) clearInterval(window.agencyInterval);

        const timerElement = document.getElementById('countdown-timer');
        if (timerElement) {
            timerElement.innerText = "COMPLETADO";
            timerElement.style.color = "#33ff33";
            timerElement.style.textShadow = "0 0 8px rgba(51, 255, 51, 0.6)";
        }

        alert("TRANSMISIÓN CERRADA CON ÉXITO.\nBuen trabajo, equipo. La Orden os saluda.");
        btnFinalizar.disabled = true;
        btnFinalizar.style.opacity = "0.5";
        btnFinalizar.innerText = "MISIÓN FINALIZADA";

    } catch (e) {
        console.error(e);
        alert("ERROR AL CONECTAR CON LOS SERVIDORES DE LA ORDEN.");
    }
}

// --- AGENCY UI LOGIC ---

function setupAgencyEvents() {
    // Nav Tabs Logic
    const navButtons = document.querySelectorAll('.nav-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    navButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = btn.getAttribute('data-tab');

            // Actualizar botones
            navButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Actualizar pestañas
            tabContents.forEach(tab => {
                if (tab.id === 'tab-' + target) {
                    tab.classList.remove('hidden-tab');
                    tab.classList.add('active-tab');
                } else {
                    tab.classList.add('hidden-tab');
                    tab.classList.remove('active-tab');
                }
            });
        });
    });

    // Proceder a archivos en dashboard
    const btnProceder = document.getElementById('btn-ver-archivos-dash');
    if (btnProceder) {
        btnProceder.addEventListener('click', () => {
            const btnArchivos = document.querySelector('.nav-btn[data-tab="archivos"]');
            if (btnArchivos) btnArchivos.click();
        });
    }

    // Inicialiazr Misiones
    setupMision1Events();
    setupMisionEnergiaEvents();
    setupQRScannerEvents();
    setupMisionInmersionEvents();
    setupChatEvents();

    // Inicializar barra de progreso
    calcularProgreso();

    // Live Feed Generation
    startLiveFeed();

    // Simular número de agentes variable
    function randomizeAgents() {
        const agentEl = document.getElementById('connected-agents');
        if (agentEl) {
            agentEl.innerText = Math.floor(Math.random() * (450 - 320 + 1) + 320);
        }
        setTimeout(randomizeAgents, Math.random() * 8000 + 4000);
    }
    randomizeAgents();

    // Iniciar coordenadas animadas del radar
    startRadarCoords();
}

// --- OPERACIÓN INMERSIÓN: DESBLOQUEO AUTOMÁTICO ---
function setupMisionInmersionEvents() {
    const cardInmersion = document.getElementById('card-inmersion');
    const lockArea = document.getElementById('inmersion-lock-area');
    const btnAbrir = document.getElementById('btn-abrir-inmersion');
    const iconEl = document.getElementById('icon-inmersion');
    const statusEl = document.getElementById('status-inmersion');
    const titleEl = document.getElementById('title-inmersion');
    const gridArchivos = document.getElementById('archivos-grid');
    const inmersionContent = document.getElementById('mision-inmersion-content');
    const btnVolver = document.getElementById('btn-volver-archivos-inmersion');

    // Función global para que Ascenso pueda llamarla
    window.desbloquearInmersion = function () {
        if (!lockArea || !btnAbrir || !iconEl || !statusEl) return;

        localStorage.setItem('inmersion_desbloqueada', 'true');

        lockArea.classList.add('hidden-tab');
        btnAbrir.classList.remove('hidden-tab');
        iconEl.innerHTML = '&#128275;'; // Candado abierto
        statusEl.textContent = 'DESENCRIPTADO';
        statusEl.style.color = '#bf66ff';
        if (titleEl) titleEl.style.color = '#bf66ff';
        if (cardInmersion) {
            cardInmersion.style.borderColor = '#bf66ff';
        }

        if (window.calcularProgreso) window.calcularProgreso();
    };

    // Auto-desbloquear si ya fue desbloqueada anteriormente
    if (localStorage.getItem('inmersion_desbloqueada') === 'true') {
        window.desbloquearInmersion();
    }

    // Botón para entrar al contenido de la misión
    if (btnAbrir && gridArchivos && inmersionContent) {
        btnAbrir.addEventListener('click', () => {
            gridArchivos.classList.add('hidden-tab');
            inmersionContent.classList.remove('hidden-tab');
        });
    }

    // Botón de volver al grid
    if (btnVolver && gridArchivos && inmersionContent) {
        btnVolver.addEventListener('click', () => {
            inmersionContent.classList.add('hidden-tab');
            gridArchivos.classList.remove('hidden-tab');
        });
    }
}

function startRadarCoords() {
    const slots = [
        { el: document.getElementById('rc1'), delay: 500, duration: 2000 },
        { el: document.getElementById('rc2'), delay: 1200, duration: 2000 },
        { el: document.getElementById('rc3'), delay: 2500, duration: 2000 },
    ];

    function randCoord() {
        const lat = (38 + Math.random() * 5).toFixed(4);
        const lng = (-5 + Math.random() * -2).toFixed(4);
        const alt = Math.floor(Math.random() * 900 + 100);
        return `${lat}N ${lng}W /${alt}m`;
    }

    slots.forEach(slot => {
        if (!slot.el) return;

        function cycle() {
            // Actualizar texto y hacerlo visible
            slot.el.textContent = randCoord();
            slot.el.classList.add('visible');

            // Desvanecerlo después de un rato
            setTimeout(() => {
                slot.el.classList.remove('visible');
            }, slot.duration * 0.75);

            // Repetir con pequeña variación aleatoria
            setTimeout(cycle, slot.duration + Math.random() * 1000);
        }

        // Arrancar con el delay correspondiente a su punto
        setTimeout(cycle, slot.delay);
    });
}

function startLiveFeed() {
    const feedContainer = document.getElementById('live-feed');
    if (!feedContainer) return;

    const EVENT_TYPES = [
        "ENCRIPTACIÓN INICIADA",
        "COORDENADAS ALCANZADAS",
        "PAQUETE INTERCEPTADO",
        "NUEVO ACTIVO REGISTRADO",
        "CANAL SEGURO ESTABLECIDO",
        "ALERTA DE SEGURIDAD L2",
        "DESCARGA AUTORIZADA"
    ];

    const LOCATIONS = ["[MADRID]", "[BERLÍN]", "[MOSCÚ]", "[TOKIO]", "[LONDRES]", "[ÁREA 51]", "[SITIO-19]"];

    function generateFeedItem() {
        const now = new Date();
        const time = `[${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}]`;

        const type = EVENT_TYPES[Math.floor(Math.random() * EVENT_TYPES.length)];
        const loc = LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)];
        const agentId = `AGENTE ${Math.floor(Math.random() * 90) + 10}`;

        const div = document.createElement('div');
        div.className = 'feed-item';
        div.innerHTML = `
            <span class="feed-timestamp">${time}</span>
            <span class="feed-code">${agentId} ></span>
            <span>${type} ${loc}</span>
        `;

        feedContainer.prepend(div);

        // Limitar a máximo 30 mensajes para no petar la memoria
        if (feedContainer.children.length > 30) {
            feedContainer.removeChild(feedContainer.lastChild);
        }

        // Programar el siguiente
        setTimeout(generateFeedItem, Math.random() * 4000 + 1000); // 1 a 5 seg
    }

    generateFeedItem();
}

// --- MISION 1: GEOLOCALIZACION ---
function setupMision1Events() {
    const btnAbrir = document.getElementById('btn-abrir-mision1');
    const btnVolver = document.getElementById('btn-volver-archivos');
    const gridArchivos = document.getElementById('archivos-grid');
    const mision1Content = document.getElementById('mision-1-content');

    if (btnAbrir && gridArchivos && mision1Content) {
        btnAbrir.addEventListener('click', () => {
            gridArchivos.classList.add('hidden-tab');
            mision1Content.classList.remove('hidden-tab');
        });
    }

    if (btnVolver && gridArchivos && mision1Content) {
        btnVolver.addEventListener('click', () => {
            mision1Content.classList.add('hidden-tab');
            gridArchivos.classList.remove('hidden-tab');
        });
    }

    const btnVerificarGps = document.getElementById('btn-verificar-gps');
    const statusGps = document.getElementById('gps-status');
    const misionSuccess = document.getElementById('mision-1-success');

    // Coordenadas objetivo (las proporcionadas)
    const TARGET_LAT = 40.65523456059397;
    const TARGET_LNG = -3.1762954287264553;
    const MAX_DISTANCE_METERS = 30; // 30 metros de radio de error

    // Fórmula Haversine para calcular distancia en GPS
    function getDistanceFromLatLonInM(lat1, lon1, lat2, lon2) {
        const R = 6371e3; // Radio de la tierra en metros
        const dLat = deg2rad(lat2 - lat1);
        const dLon = deg2rad(lon2 - lon1);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const d = R * c;
        return d;
    }

    function deg2rad(deg) {
        return deg * (Math.PI / 180);
    }

    if (btnVerificarGps) {
        btnVerificarGps.addEventListener('click', () => {
            // Verificar si el estado anterior ya estaba validado (si recarga)
            if (localStorage.getItem('mision1_completada')) {
                mostrarRecompensaMision1();
                return;
            }

            if (!navigator.geolocation) {
                statusGps.innerText = "ERROR: SU DISPOSITIVO NO SOPORTA GEOLOCALIZACIÓN.";
                statusGps.style.color = "#ff3333";
                return;
            }

            statusGps.innerText = "TRIANGULANDO POSICIÓN GPS... ESPERE.";
            statusGps.style.color = "#ffaa00";
            btnVerificarGps.disabled = true;

            // --- MODO PRUEBAS: Salto directo para evitar errores de permisos en navegadores ---
            const MODO_PRUEBAS = true;
            if (MODO_PRUEBAS) {
                setTimeout(() => {
                    statusGps.innerText = "SEÑAL VÁLIDA (BYPASS DE PRUEBAS ACTIVO)";
                    statusGps.style.color = "#33ff33";
                    localStorage.setItem('mision1_completada', 'true');
                    setTimeout(() => mostrarRecompensaMision1(), 1000);
                }, 1500);
                return;
            }

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const userLat = position.coords.latitude;
                    const userLng = position.coords.longitude;
                    const accuracy = position.coords.accuracy;

                    const distance = getDistanceFromLatLonInM(userLat, userLng, TARGET_LAT, TARGET_LNG);

                    // MODO PRUEBAS: Aceptamos siempre la ubicación (comentar true || para producción)
                    if (true || distance <= MAX_DISTANCE_METERS) {
                        statusGps.innerText = "SEÑAL VÁLIDA. DESBLOQUEANDO SIGUIENTE FASE...";
                        statusGps.style.color = "#33ff33";

                        // Guardar para que si recargan no tengan que volver a escanearlo
                        localStorage.setItem('mision1_completada', 'true');

                        setTimeout(() => {
                            mostrarRecompensaMision1();
                        }, 1500);

                    } else {
                        // Distancia demasiado grande
                        statusGps.innerText = `FALLO: SE ENCUENTRA A ${Math.round(distance)} METROS DEL OBJETIVO. \n (Precisión del GPS actual: ${Math.round(accuracy)}m)`;
                        statusGps.style.color = "#ff3333";
                        btnVerificarGps.disabled = false;
                    }
                },
                (error) => {
                    btnVerificarGps.disabled = false;
                    switch (error.code) {
                        case error.PERMISSION_DENIED:
                            statusGps.innerText = "DENEGADO: NO HA DADO PERMISO DE UBICACIÓN.";
                            break;
                        case error.POSITION_UNAVAILABLE:
                            statusGps.innerText = "ERROR: LA INFORMACIÓN DE UBICACIÓN NO ESTÁ DISPONIBLE.";
                            break;
                        case error.TIMEOUT:
                            statusGps.innerText = "ERROR: TIEMPO DE RESPUESTA AGOTADO. INTENTE DE NUEVO AL AIRE LIBRE.";
                            break;
                        default:
                            statusGps.innerText = "ERROR DESCONOCIDO AL ESCANEAR EL GPS.";
                            break;
                    }
                    statusGps.style.color = "#ff3333";
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                }
            );
        });

        // Autocomprobar si ya la había hecho y recargó la página
        if (localStorage.getItem('mision1_completada') === 'true') {
            mostrarRecompensaMision1();
        }
    }

    function mostrarRecompensaMision1() {
        if (btnVerificarGps) btnVerificarGps.style.display = 'none';
        if (statusGps) statusGps.style.display = 'none';

        // Mostrar el vídeo de youtube
        const videoContainer = document.getElementById('mision-1-video-container');
        if (videoContainer) videoContainer.style.display = 'block';

        // Si ya introdujeron el código final anteriormente
        if (localStorage.getItem('mision1_finalizada') === 'true') {
            if (misionSuccess) misionSuccess.classList.remove('hidden-tab');
            return;
        }

        // Si solo han llegado al sitio, pedir código final
        const finishPanel = document.getElementById('mision-1-finish-panel');
        if (finishPanel) finishPanel.classList.remove('hidden-tab');
    }

    // Lógica para el código de finalización "ALTURA"
    const btnConfirmarFinal = document.getElementById('btn-confirmar-finalizar-ascenso');
    const inputFinal = document.getElementById('codigo-finalizar-ascenso');
    const errorFinal = document.getElementById('error-finalizar-ascenso');
    const finishPanel = document.getElementById('mision-1-finish-panel');

    if (btnConfirmarFinal) {
        btnConfirmarFinal.addEventListener('click', () => {
            const codigo = inputFinal?.value.trim().toUpperCase();
            if (codigo === "ALTURA") {
                localStorage.setItem('mision1_finalizada', 'true');

                // Notificar a Mando Central (Firestore)
                const groupRef = doc(db, "grupos", GROUP_ID);
                updateDoc(groupRef, {
                    mision1_fin: serverTimestamp()
                }).catch(err => console.error("Error notificando fin mision 1:", err));

                // Sonido de éxito
                const granted = document.getElementById('access-granted-sound');
                granted?.play().catch(() => { });

                // Ocultar panel rojo y mostrar éxito final
                if (finishPanel) finishPanel.classList.add('hidden-tab');
                if (misionSuccess) misionSuccess.classList.remove('hidden-tab');

                // Desbloquear automáticamente la Operación Inmersión
                if (window.desbloquearInmersion) window.desbloquearInmersion();

                // Actualizar barra de progreso
                if (window.calcularProgreso) window.calcularProgreso();

                // OPCIONAL: Podríamos disparar el desbloqueo de Inmersión automáticamente aquí
                // pero según pediste, el código está en el panel de éxito.
            } else {
                const denied = document.getElementById('access-denied-sound');
                denied?.play().catch(() => { });
                if (errorFinal) {
                    errorFinal.textContent = "✘ CÓDIGO DE CIERRE INVÁLIDO";
                    setTimeout(() => { errorFinal.textContent = ""; }, 2500);
                }
            }
        });
    }

    if (inputFinal) {
        inputFinal.addEventListener('keypress', e => {
            if (e.key === 'Enter') btnConfirmarFinal?.click();
        });
    }
}

// --- MISIÓN EXTRA: ENERGÍA ---
function setupMisionEnergiaEvents() {
    const btnAbrir = document.getElementById('btn-abrir-mision-energia');
    const btnVolver = document.getElementById('btn-volver-archivos-energia');
    const gridArchivos = document.getElementById('archivos-grid');
    const misionEnergiaContent = document.getElementById('mision-energia-content');

    const btnReclamar = document.getElementById('btn-reclamar-energia');
    const inputCodigo = document.getElementById('codigo-energia');
    const statusEnergia = document.getElementById('energia-status');

    if (btnAbrir && gridArchivos && misionEnergiaContent) {
        btnAbrir.addEventListener('click', () => {
            gridArchivos.classList.add('hidden-tab');
            misionEnergiaContent.classList.remove('hidden-tab');
        });
    }

    if (btnVolver && gridArchivos && misionEnergiaContent) {
        btnVolver.addEventListener('click', () => {
            misionEnergiaContent.classList.add('hidden-tab');
            gridArchivos.classList.remove('hidden-tab');
        });
    }

    if (btnReclamar) {
        btnReclamar.addEventListener('click', async () => {
            // Verificar si ya está completada localmente
            if (localStorage.getItem('mision_energia_completada')) {
                statusEnergia.innerText = "ERROR: ESTE SUMINISTRO YA HA SIDO RECLAMADO POR EL EQUIPO.";
                statusEnergia.style.color = "#ffaa00";
                return;
            }

            const code = inputCodigo.value.trim().toUpperCase();
            if (!code) return;

            // Suponemos que la contraseña correcta para obtener la batería extra es 'BATERIA' o algo que configures. 
            // Para asegurar la rejugabilidad puedes conectarlo a una constante o a firebase, pero lo haré duro aquí para facilidad.
            const CODIGO_CORRECTO = "BATERIA"; // <- Código de prueba/ejemplo

            if (code !== CODIGO_CORRECTO) {
                statusEnergia.innerText = "CÓDIGO DE SUMINISTRO INVÁLIDO O CORRUPTO.";
                statusEnergia.style.color = "#ff3333";

                const deniedSound = document.getElementById('access-denied-sound');
                deniedSound?.play().catch(() => { });
                return;
            }

            statusEnergia.innerText = "VERIFICANDO SERIE... VALIDANDO...";
            statusEnergia.style.color = "#ffaa00";
            btnReclamar.disabled = true;

            try {
                // Registrar el reclamo en firestore y añadir 10 minutos al timer_end_time
                const groupRef = doc(db, "grupos", GROUP_ID);
                const snap = await getDoc(groupRef);
                const groupData = snap.data();

                if (!groupData.energia_reclamada) {
                    await updateDoc(groupRef, {
                        energia_reclamada: true
                    });
                }

                // Actualizar el temporizador sumando 10 minutos (600000 milisegundos)
                const TIEMPO_EXTRA_MS = 10 * 60 * 1000;
                let currentEndTime = localStorage.getItem('timer_end_time');
                if (currentEndTime) {
                    const newEndTime = parseInt(currentEndTime, 10) + TIEMPO_EXTRA_MS;
                    localStorage.setItem('timer_end_time', newEndTime.toString());

                    // Asegurar que actualizamos el intervalo si es necesario
                    if (window.agencyInterval) {
                        clearInterval(window.agencyInterval);
                        initTimer();
                    }
                }

                localStorage.setItem('mision_energia_completada', 'true');

                const grantedSound = document.getElementById('access-granted-sound');
                grantedSound?.play().catch(() => { });

                setTimeout(() => {
                    inputCodigo.style.display = "none";
                    btnReclamar.style.display = "none";
                    statusEnergia.innerHTML = "<b>¡SUMINISTRO AUTORIZADO! TIEMPO DE OPERACIÓN RECALCULADO (+10 MINS).</b>";
                    statusEnergia.style.color = "#33ff33";
                }, 1500);

            } catch (err) {
                console.error(err);
                statusEnergia.innerText = "ERROR DE CONEXIÓN AL REPORTAR EL SUMINISTRO.";
                statusEnergia.style.color = "#ff3333";
                btnReclamar.disabled = false;
            }
        });

        // Autocomprobar si ya recargó y estaba completada
        if (localStorage.getItem('mision_energia_completada') === 'true') {
            if (inputCodigo) inputCodigo.style.display = "none";
            if (btnReclamar) btnReclamar.style.display = "none";
            if (statusEnergia) {
                statusEnergia.innerHTML = "<b>¡SUMINISTRO AUTORIZADO! TIEMPO DE OPERACIÓN RECALCULADO.</b>";
                statusEnergia.style.color = "#33ff33";
            }
        }
    }
}

// --- ESCÁNER QR DE INFORMACIÓN ---
function setupQRScannerEvents() {
    console.log("Inicializando eventos del Escáner QR...");
    const btnAbrir = document.getElementById('btn-abrir-qr');
    const btnVolver = document.getElementById('btn-volver-archivos-qr');
    const gridArchivos = document.getElementById('archivos-grid');
    const qrContent = document.getElementById('mision-qr-content');
    const scanStatus = document.getElementById('qr-scan-status');
    const resultPanel = document.getElementById('qr-result-panel');
    const unknownPanel = document.getElementById('qr-unknown-panel');
    const resultText = document.getElementById('qr-result-text');
    const unknownText = document.getElementById('qr-unknown-text');

    if (!btnAbrir) console.warn("ALERTA: No se encontró el botón btn-abrir-qr");
    if (!qrContent) console.error("ERROR: No se encontró el contenedor mision-qr-content");

    let html5QrCode = null;

    // =====================================================
    // TABLA DE CÓDIGOS QR Y SUS PISTAS
    // Para editar las pistas, modifica únicamente el campo "pista" de cada entrada.
    // Para añadir más QR, duplica una entrada y cambia "codigo" y "pista".
    // =====================================================
    const QR_DATABASE = {
        "operacionenigma1": {
            titulo: "INTELIGENCIA ALFA",
            pista: "[PISTA DEL QR 1 — EDITA ESTE TEXTO CON LA PISTA REAL QUE QUIERAS MOSTRAR A LOS AGENTES]"
        },
        "operacionenigma2": {
            titulo: "INTELIGENCIA BRAVO",
            pista: "[PISTA DEL QR 2 — EDITA ESTE TEXTO CON LA PISTA REAL QUE QUIERAS MOSTRAR A LOS AGENTES]"
        },
        "operacionenigma3": {
            titulo: "INTELIGENCIA CHARLIE",
            pista: "[PISTA DEL QR 3 — EDITA ESTE TEXTO CON LA PISTA REAL QUE QUIERAS MOSTRAR A LOS AGENTES]"
        }
    };

    function iniciarEscaner() {
        resultPanel.classList.add('hidden-tab');
        unknownPanel.classList.add('hidden-tab');

        if (!html5QrCode) {
            html5QrCode = new Html5Qrcode("qr-reader");
        }

        scanStatus.textContent = "CÁMARA ACTIVA — APUNTE AL CÓDIGO QR";
        scanStatus.style.color = "#00aaff";

        html5QrCode.start(
            { facingMode: "environment" }, // Usa la cámara trasera del móvil
            { fps: 10, qrbox: { width: 250, height: 250 } },
            (decodedText) => {
                // QR detectado — parar escáner
                html5QrCode.stop().catch(() => { });

                const codigo = decodedText.trim().toLowerCase();
                
                if (codigo === "operacionenigma1") {
                    window.location.href = "operacionenigma1.html";
                    return;
                }
                if (codigo === "operacionenigma2") {
                    window.location.href = "operacionenigma2.html";
                    return;
                }
                if (codigo === "operacionenigma3") {
                    window.location.href = "operacionenigma3.html";
                    return;
                }

                const datos = QR_DATABASE[codigo];

                if (datos) {
                    // QR reconocido — mostrar pista
                    const grantedSound = document.getElementById('access-granted-sound');
                    grantedSound?.play().catch(() => { });

                    // Guardar en localStorage para el progreso
                    localStorage.setItem(`qr_${codigo}`, 'true');
                    if (window.calcularProgreso) window.calcularProgreso();

                    scanStatus.textContent = "✔ CÓDIGO RECONOCIDO";
                    scanStatus.style.color = "#33ff33";

                    resultText.innerHTML = `<b style="color:#00aaff;">[${datos.titulo}]</b><br><br>${datos.pista}`;
                    resultPanel.classList.remove('hidden-tab');
                } else {
                    // QR no reconocido
                    const deniedSound = document.getElementById('access-denied-sound');
                    deniedSound?.play().catch(() => { });

                    scanStatus.textContent = "✘ CÓDIGO NO RECONOCIDO";
                    scanStatus.style.color = "#ff3333";

                    unknownText.textContent = `SECUENCIA DETECTADA: "${decodedText}" — NO FIGURE EN LOS ARCHIVOS DE LA ORDEN.`;
                    unknownPanel.classList.remove('hidden-tab');
                }
            },
            () => { } // Error silencioso mientras busca
        ).catch((err) => {
            scanStatus.textContent = "ERROR: NO SE PUEDE ACCEDER A LA CÁMARA. REVISE LOS PERMISOS.";
            scanStatus.style.color = "#ff3333";
            console.error(err);
        });
    }

    function detenerEscaner() {
        if (html5QrCode) {
            html5QrCode.stop().catch(() => { });
        }
    }

    const warningModal = document.getElementById('qr-warning-modal');
    const btnAceptarWarning = document.getElementById('btn-aceptar-qr-warning');

    if (btnAbrir && gridArchivos && qrContent) {
        btnAbrir.addEventListener('click', (e) => {
            e.preventDefault();
            console.log("Click en Abrir Escáner DETECTADO");
            // Mostrar primero la advertencia de aptitudes
            if (warningModal) {
                console.log("Mostrando modal de advertencia...");
                warningModal.classList.remove('hidden-tab');
                warningModal.style.display = 'flex';
                warningModal.style.zIndex = '10001'; // Forzar encima de todo
            } else {
                console.warn("Modal de advertencia no encontrado, abriendo escáner directo");
                procederAbrirScanner();
            }
        });
    }

    if (btnAceptarWarning) {
        btnAceptarWarning.addEventListener('click', () => {
            console.log("Advertencia aceptada por el agente.");
            if (warningModal) {
                warningModal.classList.add('hidden-tab');
                warningModal.style.display = 'none';
            }
            procederAbrirScanner();
        });
    }

    function procederAbrirScanner() {
        gridArchivos.classList.add('hidden-tab');
        qrContent.classList.remove('hidden-tab');
        iniciarEscaner();
    }

    if (btnVolver && gridArchivos && qrContent) {
        btnVolver.addEventListener('click', () => {
            console.log("Regresando a archivos desde QR...");
            // Primero UI rápida
            qrContent.classList.add('hidden-tab');
            gridArchivos.classList.remove('hidden-tab');
            // Luego intentar detener cámara de fondo
            detenerEscaner();
        });
    }

    // Botones para reescanear
    document.getElementById('btn-reescanear')?.addEventListener('click', iniciarEscaner);
    document.getElementById('btn-reescanear-error')?.addEventListener('click', iniciarEscaner);
}

// --- BARRA DE PROGRESO DE OPERACIÓN ---
function calcularProgreso() {
    const fill = document.getElementById('op-progress-fill');
    const pct = document.getElementById('op-progress-pct');
    const statusEl = document.getElementById('op-progress-status');
    const codeEl = document.getElementById('op-progress-code');
    if (!fill || !pct) return;

    // Cada hito tiene un peso. Total = 100%
    const hitos = [
        { key: 'fase2_desbloqueada', peso: 10, label: 'ACCESO NIVEL 2' },
        { key: 'mision1_completada', peso: 10, label: 'UBICACIÓN VERIFICADA' },
        { key: 'mision1_finalizada', peso: 15, label: 'ASCENSO COMPLETADO' },
        { key: 'inmersion_desbloqueada', peso: 10, label: 'NIVEL INMERSIÓN' },
        { key: 'mision_energia_completada', peso: 10, label: 'SUMINISTRO ACTIVO' },
        { key: 'qr_operacionenigma1', peso: 10, label: 'INTEL ALFA' },
        { key: 'qr_operacionenigma2', peso: 10, label: 'INTEL BRAVO' },
        { key: 'qr_operacionenigma3', peso: 10, label: 'INTEL CHARLIE' },
        { key: 'mision_final_completada', peso: 15, label: 'OPERACIÓN FINALIZADA' },
    ];

    let totalPeso = 0;
    let ultimoHito = 'ACCESO ESTABLECIDO';

    hitos.forEach(h => {
        if (localStorage.getItem(h.key) === 'true') {
            totalPeso += h.peso;
            ultimoHito = h.label;
        }
    });

    // Asegurar que el acceso a la agencia siempre cuenta
    totalPeso = Math.min(totalPeso, 100);

    // Actualizar barra
    fill.style.width = totalPeso + '%';
    pct.textContent = totalPeso + '%';

    // Color dinámico según progreso
    fill.classList.remove('danger', 'complete');
    if (totalPeso >= 100) {
        fill.classList.add('complete');
        pct.style.color = '#33ff33';
    } else if (totalPeso >= 60) {
        pct.style.color = '#ffaa00';
    } else {
        pct.style.color = '#00ffcc';
    }

    // Texto de estado críptico
    if (totalPeso === 0) {
        statusEl.textContent = 'SIN DATOS RECUPERADOS';
    } else if (totalPeso < 30) {
        statusEl.textContent = `▸ ÚLTIMO: ${ultimoHito}`;
    } else if (totalPeso < 70) {
        statusEl.textContent = `▸ ${ultimoHito} · CONTINUAR`;
    } else if (totalPeso < 100) {
        statusEl.textContent = `▸ ${ultimoHito} · FASE CRÍTICA`;
    } else {
        statusEl.textContent = '▸ PROTOCOLO COMPLETADO';
    }

    // Código críptico falso que cambia con el progreso
    const codigos = ['███', 'E-7█', 'E-74', 'ENϟI', 'ENIG', 'EN1GM'];
    const idx = Math.min(Math.floor((totalPeso / 100) * codigos.length), codigos.length - 1);
    if (codeEl) codeEl.textContent = codigos[idx];
}

// Exportar para que la llamen otros módulos
window.calcularProgreso = calcularProgreso;

// Inicializar eventos de UI
setupAgencyEvents();

// --- SISTEMA DE COMUNICACIONES HQ (CHAT) ---
function setupChatEvents() {
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
            // Ir a la pestaña de comunicaciones
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
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
}
