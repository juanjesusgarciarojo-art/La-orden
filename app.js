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
    serverTimestamp
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

        await typeWriter(`BIENVENIDO, SEÑOR ${nombre.toUpperCase()}`, headerLine, 50);
        await new Promise(r => setTimeout(r, 800));

        messageArea.textContent = "RECEPCIÓN DE COORDENADAS COMPLETA";
        messageArea.style.color = "#ffff33";

        const mensajeFinal = `SI HAS RECIBIDO ESTO, ES PORQUE ALGUIEN CREE QUE ERES UN MIEMBRO POTENCIAL PARA LA ORGANIZACIÓN.\n\nPERO TEN CUIDADO: SE HAN DETECTADO TOPOS EN EL SECTOR.\n\nLOCALIZACIÓN DETECTADA:\n${COORDENADAS_REUNION}\n\nPOR FAVOR, BUSQUEN UN LUGAR PARA SENTARSE Y PÓNGANSE CÓMODOS HASTA QUE SE REÚNA TODO EL EQUIPO.\n\nNO ESTABLEZCA CONTACTO CON DESCONOCIDOS. LA ORDEN OS OBSERVA.`;
        await typeWriter(mensajeFinal, instructionLine, 40);

        const mapLink = document.createElement('a');
        mapLink.href = MAPS_URL;
        mapLink.target = "_self";
        mapLink.className = "dos-link";
        mapLink.innerHTML = "<br>[ ABRIR ENLACE DE NAVEGACIÓN ]";
        instructionLine.appendChild(mapLink);

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
    instructionLine.appendChild(promptTextContainer);

    await typeWriter("INTRODUZCA LA CLAVE DE ESCUADRÓN REVELADA EN EL VÍDEO PARA CONTINUAR:", promptTextContainer, 40);

    inputContainer.style.display = "flex";
    codeInput.value = "";
    codeInput.disabled = false;
    btnVerify.disabled = false;
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
    let i = 0;
    element.innerHTML = "";

    // Función interna para reproducir sonido de teclado con variaciones
    const playTypingSound = () => {
        if (typingSound) {
            typingSound.currentTime = 0;
            typingSound.volume = 0.2;
            typingSound.play().catch(() => { });
        }
    };

    return new Promise((resolve) => {
        function type() {
            if (i < text.length) {
                // Reemplazar saltos de línea por <br>
                if (text.charAt(i) === '\n') {
                    element.innerHTML += '<br>';
                } else {
                    element.innerHTML += text.charAt(i);
                }

                // No sonar en los espacios para que sea más natural
                if (text.charAt(i) !== " ") playTypingSound();

                i++;
                setTimeout(type, speed + (Math.random() * 20)); // Añadimos un poco de aleatoriedad al ritmo
            } else {
                resolve();
            }
        }
        type();
    });
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

    // Inicialiazr Mision 1
    setupMision1Events();

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

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const userLat = position.coords.latitude;
                    const userLng = position.coords.longitude;
                    const accuracy = position.coords.accuracy;

                    const distance = getDistanceFromLatLonInM(userLat, userLng, TARGET_LAT, TARGET_LNG);

                    if (distance <= MAX_DISTANCE_METERS) {
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
        if (misionSuccess) misionSuccess.classList.remove('hidden-tab');
    }
}

// Inicializar eventos de UI
setupAgencyEvents();
