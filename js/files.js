import { db } from '../firebase.js';
import { doc, updateDoc, serverTimestamp, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const GROUP_ID = "grupo_activo";

export function initFilesEvents() {
    setupMision1Events();
    setupMisionEnergiaEvents();
    setupQRScannerEvents();
    setupMisionInmersionEvents();
}

// --- OPERACIN INMERSIN: DESBLOQUEO AUTOMTICO ---
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

    // Funcin global para que Ascenso pueda llamarla
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

    // Botn para entrar al contenido de la misin
    if (btnAbrir && gridArchivos && inmersionContent) {
        btnAbrir.addEventListener('click', () => {
            gridArchivos.classList.add('hidden-tab');
            inmersionContent.classList.remove('hidden-tab');
        });
    }

    // Botn de volver al grid
    if (btnVolver && gridArchivos && inmersionContent) {
        btnVolver.addEventListener('click', () => {
            inmersionContent.classList.add('hidden-tab');
            gridArchivos.classList.remove('hidden-tab');
        });
    }
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

    // Frmula Haversine para calcular distancia en GPS
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
                statusGps.innerText = "ERROR: SU DISPOSITIVO NO SOPORTA GEOLOCALIZACIN.";
                statusGps.style.color = "#ff3333";
                return;
            }

            statusGps.innerText = "TRIANGULANDO POSICIN GPS... ESPERE.";
            statusGps.style.color = "#ffaa00";
            btnVerificarGps.disabled = true;

            // --- MODO PRUEBAS: Salto directo para evitar errores de permisos en navegadores ---
            const MODO_PRUEBAS = true;
            if (MODO_PRUEBAS) {
                setTimeout(() => {
                    statusGps.innerText = "SEAL VLIDA (BYPASS DE PRUEBAS ACTIVO)";
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

                    // MODO PRUEBAS: Aceptamos siempre la ubicacin (comentar true || para produccin)
                    if (true || distance <= MAX_DISTANCE_METERS) {
                        statusGps.innerText = "SEAL VLIDA. DESBLOQUEANDO SIGUIENTE FASE...";
                        statusGps.style.color = "#33ff33";

                        // Guardar para que si recargan no tengan que volver a escanearlo
                        localStorage.setItem('mision1_completada', 'true');

                        setTimeout(() => {
                            mostrarRecompensaMision1();
                        }, 1500);

                    } else {
                        // Distancia demasiado grande
                        statusGps.innerText = `FALLO: SE ENCUENTRA A ${Math.round(distance)} METROS DEL OBJETIVO. n (Precisin del GPS actual: ${Math.round(accuracy)}m)`;
                        statusGps.style.color = "#ff3333";
                        btnVerificarGps.disabled = false;
                    }
                },
                (error) => {
                    btnVerificarGps.disabled = false;
                    switch (error.code) {
                        case error.PERMISSION_DENIED:
                            statusGps.innerText = "DENEGADO: NO HA DADO PERMISO DE UBICACIN.";
                            break;
                        case error.POSITION_UNAVAILABLE:
                            statusGps.innerText = "ERROR: LA INFORMACIN DE UBICACIN NO EST DISPONIBLE.";
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

        // Autocomprobar si ya la haba hecho y recarg la pgina
        if (localStorage.getItem('mision1_completada') === 'true') {
            mostrarRecompensaMision1();
        }
    }

    function mostrarRecompensaMision1() {
        if (btnVerificarGps) btnVerificarGps.style.display = 'none';
        if (statusGps) statusGps.style.display = 'none';

        // Mostrar el vdeo de youtube
        const videoContainer = document.getElementById('mision-1-video-container');
        if (videoContainer) videoContainer.style.display = 'block';

        // Si ya introdujeron el cdigo final anteriormente
        if (localStorage.getItem('mision1_finalizada') === 'true') {
            if (misionSuccess) misionSuccess.classList.remove('hidden-tab');
            return;
        }

        // Si solo han llegado al sitio, pedir cdigo final
        const finishPanel = document.getElementById('mision-1-finish-panel');
        if (finishPanel) finishPanel.classList.remove('hidden-tab');
    }

    // Lgica para el cdigo de finalizacin "ALTURA"
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

                // Sonido de xito
                const granted = document.getElementById('access-granted-sound');
                granted?.play().catch(() => { });

                // Ocultar panel rojo y mostrar xito final
                if (finishPanel) finishPanel.classList.add('hidden-tab');
                if (misionSuccess) misionSuccess.classList.remove('hidden-tab');

                // Desbloquear automticamente la Operacin Inmersin
                if (window.desbloquearInmersion) window.desbloquearInmersion();

                // Actualizar barra de progreso
                if (window.calcularProgreso) window.calcularProgreso();

            } else {
                const denied = document.getElementById('access-denied-sound');
                denied?.play().catch(() => { });
                if (errorFinal) {
                    errorFinal.textContent = " CDIGO DE CIERRE INVLIDO";
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

// --- MISIN EXTRA: ENERGA ---
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
            // Verificar si ya est completada localmente
            if (localStorage.getItem('mision_energia_completada')) {
                statusEnergia.innerText = "ERROR: ESTE SUMINISTRO YA HA SIDO RECLAMADO POR EL EQUIPO.";
                statusEnergia.style.color = "#ffaa00";
                return;
            }

            const code = inputCodigo.value.trim().toUpperCase();
            if (!code) return;

            const CODIGO_CORRECTO = "BATERIA"; // <- Cdigo de prueba/ejemplo

            if (code !== CODIGO_CORRECTO) {
                statusEnergia.innerText = "CDIGO DE SUMINISTRO INVLIDO O CORRUPTO.";
                statusEnergia.style.color = "#ff3333";

                const deniedSound = document.getElementById('access-denied-sound');
                deniedSound?.play().catch(() => { });
                return;
            }

            statusEnergia.innerText = "VERIFICANDO SERIE... VALIDANDO...";
            statusEnergia.style.color = "#ffaa00";
            btnReclamar.disabled = true;

            try {
                // Registrar el reclamo en firestore y aadir 10 minutos al timer_end_time
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

                    // Disparar evento para reiniciar el UI del Timer (el que este escuchando)
                    window.dispatchEvent(new Event('reloadTimer'));
                }

                localStorage.setItem('mision_energia_completada', 'true');

                const grantedSound = document.getElementById('access-granted-sound');
                grantedSound?.play().catch(() => { });

                setTimeout(() => {
                    inputCodigo.style.display = "none";
                    btnReclamar.style.display = "none";
                    statusEnergia.innerHTML = "<b>SUMINISTRO AUTORIZADO! TIEMPO DE OPERACIN RECALCULADO (+10 MINS).</b>";
                    statusEnergia.style.color = "#33ff33";
                }, 1500);

            } catch (err) {
                console.error(err);
                statusEnergia.innerText = "ERROR DE CONEXIN AL REPORTAR EL SUMINISTRO.";
                statusEnergia.style.color = "#ff3333";
                btnReclamar.disabled = false;
            }
        });

        if (localStorage.getItem('mision_energia_completada') === 'true') {
            if (inputCodigo) inputCodigo.style.display = "none";
            if (btnReclamar) btnReclamar.style.display = "none";
            if (statusEnergia) {
                statusEnergia.innerHTML = "<b>SUMINISTRO AUTORIZADO! TIEMPO DE OPERACIN RECALCULADO.</b>";
                statusEnergia.style.color = "#33ff33";
            }
        }
    }
}

// --- ESCNER QR DE INFORMACIN ---
function setupQRScannerEvents() {
    console.log("Inicializando eventos del Escner QR...");
    const btnAbrir = document.getElementById('btn-abrir-qr');
    const btnVolver = document.getElementById('btn-volver-archivos-qr');
    const gridArchivos = document.getElementById('archivos-grid');
    const qrContent = document.getElementById('mision-qr-content');
    const scanStatus = document.getElementById('qr-scan-status');
    const resultPanel = document.getElementById('qr-result-panel');
    const unknownPanel = document.getElementById('qr-unknown-panel');
    const resultText = document.getElementById('qr-result-text');
    const unknownText = document.getElementById('qr-unknown-text');

    if (!btnAbrir) console.warn("ALERTA: No se encontr el botn btn-abrir-qr");
    if (!qrContent) console.error("ERROR: No se encontr el contenedor mision-qr-content");

    let html5QrCode = null;

    const QR_DATABASE = {
        "operacionenigma1": {
            titulo: "INTELIGENCIA ALFA",
            pista: "[PISTA DEL QR 1  EDITA ESTE TEXTO CON LA PISTA REAL QUE QUIERAS MOSTRAR A LOS AGENTES]"
        },
        "operacionenigma2": {
            titulo: "INTELIGENCIA BRAVO",
            pista: "[PISTA DEL QR 2  EDITA ESTE TEXTO CON LA PISTA REAL QUE QUIERAS MOSTRAR A LOS AGENTES]"
        },
        "operacionenigma3": {
            titulo: "INTELIGENCIA CHARLIE",
            pista: "[PISTA DEL QR 3  EDITA ESTE TEXTO CON LA PISTA REAL QUE QUIERAS MOSTRAR A LOS AGENTES]"
        }
    };

    function iniciarEscaner() {
        resultPanel.classList.add('hidden-tab');
        unknownPanel.classList.add('hidden-tab');

        if (!html5QrCode) {
            // Check globals
            if(window.Html5Qrcode) {
                html5QrCode = new window.Html5Qrcode("qr-reader");
            } else {
                scanStatus.textContent = "ERROR: LIBRERA DE ESCNER NO ENCONTRADA.";
                scanStatus.style.color = "#ff3333";
                return;
            }
        }

        scanStatus.textContent = "CMARA ACTIVA  APUNTE AL CDIGO QR";
        scanStatus.style.color = "#00aaff";

        html5QrCode.start(
            { facingMode: "environment" }, // Usa la cmara trasera del mvil
            { fps: 10, qrbox: { width: 250, height: 250 } },
            (decodedText) => {
                // QR detectado  parar escner
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
                    // QR reconocido  mostrar pista
                    const grantedSound = document.getElementById('access-granted-sound');
                    grantedSound?.play().catch(() => { });

                    // Guardar en localStorage para el progreso
                    localStorage.setItem(`qr_${codigo}`, 'true');
                    if (window.calcularProgreso) window.calcularProgreso();

                    scanStatus.textContent = " CDIGO RECONOCIDO";
                    scanStatus.style.color = "#33ff33";

                    resultText.innerHTML = `<b style="color:#00aaff;">[${datos.titulo}]</b><br><br>${datos.pista}`;
                    resultPanel.classList.remove('hidden-tab');
                } else {
                    // QR no reconocido
                    const deniedSound = document.getElementById('access-denied-sound');
                    deniedSound?.play().catch(() => { });

                    scanStatus.textContent = " CDIGO NO RECONOCIDO";
                    scanStatus.style.color = "#ff3333";

                    unknownText.textContent = `SECUENCIA DETECTADA: "${decodedText}"  NO FIGURE EN LOS ARCHIVOS DE LA ORDEN.`;
                    unknownPanel.classList.remove('hidden-tab');
                }
            },
            () => { } // Error silencioso mientras busca
        ).catch((err) => {
            scanStatus.textContent = "ERROR: NO SE PUEDE ACCEDER A LA CMARA. REVISE LOS PERMISOS.";
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
            console.log("Click en Abrir Escner DETECTADO");
            // Mostrar primero la advertencia de aptitudes
            if (warningModal) {
                console.log("Mostrando modal de advertencia...");
                warningModal.classList.remove('hidden-tab');
                warningModal.style.display = 'flex';
                warningModal.style.zIndex = '10001'; // Forzar encima de todo
            } else {
                procederAbrirScanner();
            }
        });
    }

    if (btnAceptarWarning) {
        btnAceptarWarning.addEventListener('click', () => {
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
            // Primero UI rpida
            qrContent.classList.add('hidden-tab');
            gridArchivos.classList.remove('hidden-tab');
            // Luego intentar detener cmara de fondo
            detenerEscaner();
        });
    }

    // Botones para reescanear
    document.getElementById('btn-reescanear')?.addEventListener('click', iniciarEscaner);
    document.getElementById('btn-reescanear-error')?.addEventListener('click', iniciarEscaner);
}
