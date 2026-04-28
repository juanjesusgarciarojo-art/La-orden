/* ============================================================
   OPERACIÓN ENIGMA — script.js
   Funcionalidad: Nav, Scroll, Reveal, Ranking, Formulario
   ============================================================ */

'use strict';

// ── 1. NAVEGACIÓN ──────────────────────────────────────────

const navbar    = document.getElementById('navbar');
const hamburger = document.getElementById('hamburger');
const navLinks  = document.getElementById('navLinks');

window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 60);
});

hamburger.addEventListener('click', () => {
  navLinks.classList.toggle('open');
  hamburger.classList.toggle('active');
});

navLinks.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    navLinks.classList.remove('open');
    hamburger.classList.remove('active');
  });
});

// ── 2. REVEAL ON SCROLL ────────────────────────────────────

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.12 }
);

document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

// ── 3. NAVEGACIÓN SUAVE CON OFFSET ─────────────────────────

document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    const target = document.querySelector(this.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    const offset = 70;
    const top = target.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: 'smooth' });
  });
});

// ── 4. RANKING DATA ────────────────────────────────────────
// Datos de muestra — puedes conectar con Firebase más adelante

const rankingData = [
  { pos: 1, equipo: 'Escuadrón Alfa',    tiempo: '00:47:12', puntos: 2850, estado: 'Misión completada' },
  { pos: 2, equipo: 'Los Intocables',    tiempo: '00:53:39', puntos: 2610, estado: 'Misión completada' },
  { pos: 3, equipo: 'Team Delta',        tiempo: '01:01:05', puntos: 2390, estado: 'Misión completada' },
  { pos: 4, equipo: 'Agentes del Caos',  tiempo: '01:08:22', puntos: 2100, estado: 'Misión completada' },
  { pos: 5, equipo: 'La Resistencia',    tiempo: '01:15:47', puntos: 1870, estado: 'Misión completada' },
  { pos: 6, equipo: 'Operación Roja',    tiempo: '01:22:01', puntos: 1650, estado: 'Tiempo agotado'    },
];

const posClasses = { 1: 'cyan-accent', 2: 'cyan-dim', 3: 'cyan-dim' };

function renderRanking() {
  const tbody = document.getElementById('ranking-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  rankingData.forEach(row => {
    const tr = document.createElement('tr');
    const posClass = posClasses[row.pos] || '';
    const medal = row.pos === 1 ? '🥇' : row.pos === 2 ? '🥈' : row.pos === 3 ? '🥉' : '';
    const estadoColor = row.estado.includes('agotado')
      ? 'color:var(--red-alert)'
      : 'color:var(--cyan)';

    tr.innerHTML = `
      <td><span class="rank-pos ${posClass}">${medal || row.pos}</span></td>
      <td><span class="rank-name">${row.equipo}</span></td>
      <td>${row.tiempo}</td>
      <td><span class="rank-badge">${row.puntos} pts</span></td>
      <td style="${estadoColor}; font-family:var(--font-type); font-size:0.75rem; letter-spacing:0.08em;">${row.estado}</td>
    `;
    tbody.appendChild(tr);
  });
}

// Inicialización de Firebase vía objeto Global (Compat) para entorno local
const firebaseConfig = {
  apiKey: "AIzaSyDC93yT8bBGZvzz6TTjngY7rTX-vgT-rTw",
  authDomain: "el-reto-de-tu-vida.firebaseapp.com",
  projectId: "el-reto-de-tu-vida",
  storageBucket: "el-reto-de-tu-vida.firebasestorage.app",
  messagingSenderId: "436879361667",
  appId: "1:436879361667:web:94dffea44b14787d057db6"
};

// Evitar la múltiple inicialización
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const dbDesc = firebase.firestore();

const form    = document.getElementById('contacto-form');
const success = document.getElementById('form-success');

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const nombre  = form.nombre.value.trim();
  const email   = form.email.value.trim();
  const mensaje = form.mensaje.value.trim();

  if (!nombre || !email || !mensaje) {
    shakeForm();
    return;
  }

  if (!isValidEmail(email)) {
    form.email.style.borderColor = 'var(--red-alert)';
    setTimeout(() => form.email.style.borderColor = '', 2000);
    return;
  }

  const btn = document.getElementById('btn-enviar');
  const originalText = btn.textContent;
  btn.textContent = 'TRANSMITIENDO...';
  btn.disabled = true;

  try {
    console.log("Intentando conectar con La Orden...");
    // GUARDAR EN FIREBASE
    await dbDesc.collection("contactos").add({
      nombre: nombre,
      email: email,
      mensaje: mensaje,
      visto: false,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });

    console.log("Transmisión exitosa.");
    form.reset();
    form.style.display = 'none';
    success.style.display = 'block';
  } catch (error) {
    console.error("Error crítico de transmisión:", error);
    alert("ERROR DE CONEXIÓN: " + error.message);
    btn.textContent = 'FALLO EN ENLACE';
    btn.style.background = 'var(--red-alert)';
    setTimeout(() => {
        btn.textContent = originalText;
        btn.disabled = false;
        btn.style.background = '';
    }, 3000);
  }
});

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function shakeForm() {
  form.style.animation = 'none';
  form.offsetHeight; // reflow
  form.style.animation = 'shake 0.4s ease';
  setTimeout(() => form.style.animation = '', 500);
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Shake keyframe (inyectado dinámicamente)
const style = document.createElement('style');
style.textContent = `
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    20% { transform: translateX(-8px); }
    40% { transform: translateX(8px); }
    60% { transform: translateX(-5px); }
    80% { transform: translateX(5px); }
  }
`;
document.head.appendChild(style);

// ── 6. PARALLAX SUTIL EN HERO BG ──────────────────────────

const heroBg = document.querySelector('.hero-bg');
if (heroBg) {
  window.addEventListener('scroll', () => {
    const scrollY = window.scrollY;
    if (scrollY < window.innerHeight) {
      heroBg.style.transform = `scale(1.05) translateY(${scrollY * 0.25}px)`;
    }
  }, { passive: true });
}

// ── 7. TYPING EFFECT EN HERO PRETITLE ─────────────────────

(function typewriterEffect() {
  const el = document.querySelector('.hero-pretitle');
  if (!el) return;
  const text = el.textContent;
  el.textContent = '';
  el.style.opacity = '1';
  let i = 0;
  const timer = setInterval(() => {
    el.textContent += text[i];
    i++;
    if (i >= text.length) clearInterval(timer);
  }, 45);
})();

// ── 8. HIGHLIGHT ACTIVO EN NAV ─────────────────────────────

const sections = document.querySelectorAll('section[id]');

const navObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.getAttribute('id');
        document.querySelectorAll('.nav-links a').forEach(a => {
          a.style.color = a.getAttribute('href') === `#${id}`
            ? 'var(--cyan)'
            : '';
        });
      }
    });
  },
  { rootMargin: '-40% 0px -55% 0px' }
);

sections.forEach(section => navObserver.observe(section));

// ── FIN ────────────────────────────────────────────────────
// Para integrar Firebase:
// 1. import { initializeApp } from "firebase/app";
// 2. import { getFirestore, addDoc, collection } from "firebase/firestore";
// 3. Conectar ranking con colección "partidas"
// 4. Conectar formulario con colección "contactos"
