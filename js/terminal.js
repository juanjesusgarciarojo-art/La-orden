export function initTerminalEvents() {
    startLiveFeed();
}

function startLiveFeed() {
    const feedContainer = document.getElementById('live-feed');
    if (!feedContainer) return;

    // Evitar mltiples intervalos si se carga la vista varias veces
    if (window.liveFeedInterval) {
        clearTimeout(window.liveFeedInterval);
    }
    
    // Limpiar si hay ms de 30 para empezar limpio
    if (feedContainer.children.length > 30) feedContainer.innerHTML = '';

    const EVENT_TYPES = [
        "ENCRIPTACIN INICIADA",
        "COORDENADAS ALCANZADAS",
        "PAQUETE INTERCEPTADO",
        "NUEVO ACTIVO REGISTRADO",
        "CANAL SEGURO ESTABLECIDO",
        "ALERTA DE SEGURIDAD L2",
        "DESCARGA AUTORIZADA"
    ];

    const LOCATIONS = ["[MADRID]", "[BERLN]", "[MOSC]", "[TOKIO]", "[LONDRES]", "[REA 51]", "[SITIO-19]"];

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

        // Limitar a mximo 30 mensajes para no petar la memoria
        if (feedContainer.children.length > 30) {
            feedContainer.removeChild(feedContainer.lastChild);
        }

        // Programar el siguiente
        window.liveFeedInterval = setTimeout(generateFeedItem, Math.random() * 4000 + 1000); // 1 a 5 seg
    }

    generateFeedItem();
}
