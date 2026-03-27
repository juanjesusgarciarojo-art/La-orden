console.log("DEBUG: app.js se esta ejecutando...");
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

// IMPORT MODULES
import { loadView, initTabs } from './js/ui.js';

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
const INSTRUCTION_TEXT = "INGRESE LA CONTRASEA:";
const COORDENADAS_REUNION = "4038'29.6\"N 309'41.0\"W";
const MAPS_URL = "https://www.google.com/maps/search/?api=1&query=40.641556,-3.161389";
let groupListener = null;

// INIT
init();

async function init() {
    try {
        console.log("SISTEMA: Iniciando secuencia MS-DOS...");
        
        // Verificar si ya complet la fase 2
        if (localStorage.getItem('fase2_desbloqueada') === 'true') {
            showAgencyInterface(true);
            return;
        }

        // Verificar si ya est validado
        const savedUser = localStorage.getItem('agente_validado');

        if (savedUser) {
            const userData = JSON.parse(savedUser);
            mostrarExito(userData);
            return;
        }

        // Efecto typewriter
        if (headerLine) await typeWriter(HEADER_TEXT, headerLine, 30);
        await new Promise(r => setTimeout(r, 500));
        if (instructionLine) await typeWriter(INSTRUCTION_TEXT, instructionLine, 30);

        setTimeout(() => {
            if (inputContainer) inputContainer.classList.add('visible');
            if (footerContainer) footerContainer.classList.add('visible');
            if (codeInput) codeInput.focus();
        }, 300);

        escucharPausaGlobal();
    } catch (error) {
        console.error("ERROR CRITICO EN INICIALIZACION:", error);
        if (messageArea) {
            messageArea.textContent = "SISTEMA: ERROR CRITICO EN INICIALIZACION. REVISAR CONSOLA.";
        }
    }
}

function escucharPausaGlobal() {
    const pauseOverlay = document.getElementById('pause-overlay');
    const siren = document.getElementById('pause-siren-sound');
    const groupRef = doc(db, "grupos", GROUP_ID);

    onSnapshot(groupRef, (snapshot) => {
        if (!snapshot.exists()) {
            console.warn("SISTEMA: No se encontro el documento del grupo 'grupo_activo'.");
            return;
        }
        const data = snapshot.data();

        if (data.pausado) {
            if (pauseOverlay) pauseOverlay.style.display = "flex";
            siren?.play().catch(() => { });
        } else {
            if (pauseOverlay) pauseOverlay.style.display = "none";
            if (siren) {
                siren.pause();
                siren.currentTime = 0;
            }

            // Si hay un tiempo_inicio y estamos en la interfaz de agencia
            if (data.tiempo_inicio && localStorage.getItem('fase2_desbloqueada') === 'true') {
                updateLocalEndTime(data.tiempo_inicio);
            }
        }
    }, (error) => {
        console.error("ERROR DE FIREBASE (Pausa):", error);
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

if (btnReset) {
    btnReset.addEventListener('click', () => {
        if (confirm("REALIZAR REINICIO DE EMERGENCIA DEL SISTEMA?")) {
            codeInput.value = "RESET";
            handleVerify();
        }
    });
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

    // Lgica para cdigo de grupo si estamos en esa fase
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
            // Un zumbido o sonido de error (puedes aadir un .mp3 de buzz)
            deniedSound?.play().catch(() => { });
            messageArea.textContent = "ERROR: CDIGO YA EN USO";
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
 * Funcin que encapsula el xito de validacin
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

        messageArea.textContent = "RECEPCIN DE COORDENADAS COMPLETA";
        messageArea.style.color = "#ffff33";

        const mensajeFinal = `SI HAS RECIBIDO ESTO, ES PORQUE ALGUIEN CREE QUE ERES UN MIEMBRO POTENCIAL PARA LA ORGANIZACIN.\n\nPERO TEN CUIDADO: SE HAN DETECTADO TOPOS EN EL SECTOR.\n\nLOCALIZACIN DETECTADA:\n${COORDENADAS_REUNION}\n\nDIA: <span style="color:#ff3333; font-weight:bold;">${citaDia}</span>\nHORA: <span style="color:#ff3333; font-weight:bold;">${citaHora}</span>\n\nPOR FAVOR, BUSQUEN UN LUGAR PARA SENTARSE Y PNGANSE CMODOS HASTA QUE SE RENA TODO EL EQUIPO.\n\nNO ESTABLEZCA CONTACTO CON DESCONOCIDOS. LA ORDEN OS OBSERVA.`;
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
        externalLink.innerHTML = "[  ENLAZAR CON NAVEGACIN CIVIL EXTERNA ]";

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

        // Botn de "He llegado"
        const confirmBtn = document.createElement('button');
        confirmBtn.className = "dos-btn btn-arrived";
        confirmBtn.style.marginTop = "20px";
        confirmBtn.textContent = "ESTOY EN EL PUNTO DE ENCUENTRO";
        confirmBtn.onclick = () => marcarLlegada(userData.codigo_individual);
        instructionLine.appendChild(document.createElement('br'));
        instructionLine.appendChild(confirmBtn);

        messageArea.textContent = "SISTEMA ENCRIPTADO. CIERRE LA SESIN AL SALIR.";
    }, 1500);
}

async function marcarLlegada(userCode) {
    messageArea.textContent = "REGISTRANDO POSICIN...";

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
    headerLine.innerHTML = "SISTEMA DE GESTIN DE ESCUADRN";
    instructionLine.innerHTML = "COMPROBANDO ESTADO DEL EQUIPO...<br>ESPERE A QUE TODOS LOS AGENTES LLEGUEN AL PUNTO.";

    const membersRef = collection(db, "grupos", GROUP_ID, "integrantes");

    // Escuchar cambios en tiempo real
    groupListener = onSnapshot(membersRef, (snapshot) => {
        const total = snapshot.size;
        const llegaron = snapshot.docs.filter(d => d.data().llegado).length;

        messageArea.textContent = `AGENTES EN POSICIN: ${llegaron} / ${total}`;

        if (llegaron === total && total > 0) {
            // TODOS LLEGARON!
            groupListener(); // Detener escucha
            pedirCodigoGrupo();
        }
    });
}

async function pedirCodigoGrupo() {
    await typeWriter("TODOS LOS AGENTES SE ENCUENTRAN EN POSICIN.\nHA SUPERADO LA PRIMERA PRUEBA DE MUCHAS.\n\nESTABLECIENDO CONEXIN SEGURA... TRANSMISIN ENTRANTE:", instructionLine, 40);

    // Contenedor del vdeo
    const videoContainer = document.createElement('div');
    videoContainer.className = "video-container";
    videoContainer.style.marginTop = "20px";
    videoContainer.style.marginBottom = "20px";
    videoContainer.style.opacity = "0";
    videoContainer.style.transition = "opacity 2s";

    // Ponemos un vdeo de prueba de YouTube
    // Puedes cambiar la ID "dQw4w9WgXcQ" por la ID del vdeo final
    videoContainer.innerHTML = `<iframe width="100%" height="315" style="max-width: 560px; border: 1px solid var(--text-color);" src="https://www.youtube.com/embed/dQw4w9WgXcQ" title="Transmisin La Orden" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;

    instructionLine.appendChild(videoContainer);

    // Animacin de aparicin del vdeo
    setTimeout(() => {
        videoContainer.style.opacity = "1";
    }, 500);

    // Esperar un par de segundos antes de pedir el cdigo
    await new Promise(r => setTimeout(r, 2000));

    const promptTextContainer = document.createElement('div');
    promptTextContainer.style.marginTop = "20px";
    promptTextContainer.style.color = "#ffff33"; // Texto en amarillo para llamar la atencin
    instructionLine.appendChild(promptTextContainer);

    await typeWriter("INTRODUZCA LA CLAVE DE ESCUADRN REVELADA EN EL VDEO PARA CONTINUAR:", promptTextContainer, 40);

    inputContainer.style.display = "flex";
    inputContainer.classList.add('visible'); // <-- Reparacin de opacidad
    codeInput.value = "";
    codeInput.disabled = false;
    btnVerify.disabled = false;
    codeInput.classList.add('highlight-code-input');
    btnVerify.classList.add('highlight-code-input'); // Botn tambin en amarillo
    btnVerify.style.color = "#000"; // Letras del botn en negro para resaltar sobre fondo amarillo
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

        // Reproducir sonido de xito
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
        messageArea.textContent = "CLAVE DE ESCUADRN INVLIDA";
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

    // 1 Comprobar que el grupo est activo
    const groupRef = doc(db, "grupos", GROUP_ID);
    const groupSnap = await getDoc(groupRef);

    if (!groupSnap.exists()) return "ERROR";

    const groupData = groupSnap.data();

    if (!groupData.activo) return "INACTIVE";

    // 2 Buscar el cdigo en integrantes
    const membersRef = collection(db, "grupos", GROUP_ID, "integrantes");
    const q = query(membersRef, where("codigo_individual", "==", code));
    const snapshot = await getDocs(q);

    if (snapshot.empty) return "NOT_FOUND";

    const memberDoc = snapshot.docs[0];
    const memberData = memberDoc.data();

    if (memberData.validado) return "USED";

    // 3 Marcar como validado
    await updateDoc(memberDoc.ref, {
        validado: true
    });

    return {
        status: "SUCCESS",
        data: memberData
    };
}

/**
 * Funcin que escribe texto letra a letra con sonido
 */
async function typeWriter(text, element, speed) {
    element.innerHTML = "";

    // Creamos un contenedor temporal para parsear el HTML y los saltos de lnea
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = text.replace(/\n/g, '<br>');

    const playTypingSound = () => {
        if (typingSound) {
            typingSound.currentTime = 0;
            typingSound.volume = 0.2;
            typingSound.play().catch(() => { });
        }
    };

    // Funcin recursiva para procesar los nodos (texto y etiquetas)
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
                    // Si no es un salto de lnea, procesamos su contenido recursivamente
                    await typeNode(child, newTag);
                }
            }
        }
    }

    await typeNode(tempDiv, element);
}

/**
 * Funcin que transiciona del MS-DOS al entorno de la Agencia.
 * @param {boolean} skipAnimation Si es true, omite la carga y va directo a la interfaz
 */
async function showAgencyInterface(skipAnimation = false) {
    const dosContainer = document.getElementById('dos-container');
    const loadingContainer = document.getElementById('loading-container');
    const agencyContainer = document.getElementById('agency-container');

    // Ocultar MS-DOS
    dosContainer.classList.add('hidden');

    if (skipAnimation) {
        // Directo al panel de agencia
        agencyContainer.classList.remove('hidden');
        document.body.style.background = '#000000'; // Quita el scanline
        
        // Inicializar Navegacin de Tabs Dinmica y Cargar Dashboard
        initTabs();
        await loadView('panel');
        
        // Iniciar el temporizador y widgets
        initTimer();
        setupAgencyWidgets();
        return;
    }

    // Pantalla de carga
    loadingContainer.classList.remove('hidden');
    document.body.style.background = '#000';

    // Esperar a terminar la carga
    setTimeout(async () => {
        loadingContainer.classList.add('hidden');
        agencyContainer.classList.remove('hidden');

        // Configurar Tabs y Cargar Dashboard
        initTabs();
        await loadView('panel');

        // Animacin del texto de bienvenida
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

        // Iniciar el temporizador y widgets
        initTimer();
        setupAgencyWidgets();
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
            const MAX_OVERTIME = 2 * 60 * 60 * 1000; // 2 horas extras mximo

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
            timerElement.style.color = "#ffaa00"; // un tono clido o naranja para indicar overtime
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
 * Funcin para cerrar la partida en Firebase
 */
async function finalizarMision() {
    // Pedir contrasea para finalizar
    const password = prompt("ATENCIN: CDIGO DE FINALIZACIN REQUERIDO.\nPor favor, introduzca el cdigo de finalizacin de misin:");

    if (password === null) return; // Si cancela

    const typedCode = password.trim().toUpperCase();
    if (!typedCode) {
        alert("CDIGO INVLIDO.");
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

        // Comprobar la contrasea final. 
        // Si el admin puso un 'codigo_final' en firebase, usarlo, si no, uno por defecto de seguridad
        const expectedCode = groupData.codigo_final ? groupData.codigo_final.toUpperCase() : "ENIGMA_2026";

        if (typedCode !== expectedCode) {
            // Sonido de error si queremos o solo alerta visual
            const deniedSound = document.getElementById('access-denied-sound');
            deniedSound?.play().catch(() => { });
            alert("ACCESO DENEGADO. Cdigo de finalizacin incorrecto.");
            return;
        }

        // Si es correcto, marcamos finalizacin
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

        alert("TRANSMISIN CERRADA CON XITO.\nBuen trabajo, equipo. La Orden os saluda.");
        btnFinalizar.disabled = true;
        btnFinalizar.style.opacity = "0.5";
        btnFinalizar.innerText = "MISIN FINALIZADA";

    } catch (e) {
        console.error(e);
        alert("ERROR AL FINALIZAR LA MISIN.");
    }
}

// --- AGENCY WIDGETS ---
function setupAgencyWidgets() {
    if (window.calcularProgreso) window.calcularProgreso();

    function randomizeAgents() {
        const agentEl = document.getElementById('connected-agents');
        if (agentEl) {
            agentEl.innerText = Math.floor(Math.random() * (450 - 320 + 1) + 320);
        }
        setTimeout(randomizeAgents, Math.random() * 8000 + 4000);
    }
    randomizeAgents();
    startRadarCoords();
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
            slot.el.textContent = randCoord();
            slot.el.classList.add('visible');
            setTimeout(() => {
                slot.el.classList.remove('visible');
            }, slot.duration * 0.75);
            setTimeout(cycle, slot.duration + Math.random() * 1000);
        }
        setTimeout(cycle, slot.delay);
    });
}

window.calcularProgreso = function calcularProgreso() {
    const fill = document.getElementById('op-progress-fill');
    const pct = document.getElementById('op-progress-pct');
    const statusEl = document.getElementById('op-progress-status');
    const codeEl = document.getElementById('op-progress-code');
    if (!fill || !pct) return;

    const hitos = [
        { key: 'fase2_desbloqueada', peso: 10, label: 'ACCESO NIVEL 2' },
        { key: 'mision1_completada', peso: 10, label: 'UBICACIN VERIFICADA' },
        { key: 'mision1_finalizada', peso: 15, label: 'ASCENSO COMPLETADO' },
        { key: 'inmersion_desbloqueada', peso: 10, label: 'NIVEL INMERSIN' },
        { key: 'mision_energia_completada', peso: 10, label: 'SUMINISTRO ACTIVO' },
        { key: 'qr_operacionenigma1', peso: 10, label: 'INTEL ALFA' },
        { key: 'qr_operacionenigma2', peso: 10, label: 'INTEL BRAVO' },
        { key: 'qr_operacionenigma3', peso: 10, label: 'INTEL CHARLIE' },
        { key: 'mision_final_completada', peso: 15, label: 'OPERACIN FINALIZADA' },
    ];

    let totalPeso = 0;
    let ultimoHito = 'ACCESO ESTABLECIDO';

    hitos.forEach(h => {
        if (localStorage.getItem(h.key) === 'true') {
            totalPeso += h.peso;
            ultimoHito = h.label;
        }
    });

    totalPeso = Math.min(totalPeso, 100);
    fill.style.width = totalPeso + '%';
    pct.textContent = totalPeso + '% COMPLETO';

    if (totalPeso === 0) {
        statusEl.textContent = 'SIN DATOS RECUPERADOS';
    } else if (totalPeso < 30) {
        statusEl.textContent = ` LTIMO: ${ultimoHito}`;
    } else if (totalPeso < 70) {
        statusEl.textContent = ` ${ultimoHito}  CONTINUAR`;
    } else if (totalPeso < 100) {
        statusEl.textContent = ` ${ultimoHito}  FASE CRTICA`;
    } else {
        statusEl.textContent = ' PROTOCOLO COMPLETADO';
    }

    const codigos = ['', 'E-7', 'E-74', 'ENI', 'ENIG', 'EN1GM'];
    const idx = Math.min(Math.floor((totalPeso / 100) * codigos.length), codigos.length - 1);
    if (codeEl) codeEl.textContent = codigos[idx];
}

window.addEventListener('reloadTimer', () => {
    if (window.agencyInterval) clearInterval(window.agencyInterval);
    initTimer();
});
