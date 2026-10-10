/* =====================================================================
   PROJECT MEOW MEOW — script.js
   Plain JavaScript, no libraries.

   Sections:
   0. SETTINGS you may edit (WhatsApp number)
   1. Helpers
   2. Ambient decorations (petals, floating hearts)
   3. Music
   4. Scene navigation
   5. Scene 1 — Opening (petal burst)
   6. Scene 2 — Envelope
   7. Scene 3 — Letter reveal
   8. Scene 4 — Stamp
   9. Scene 5 — Notebook
   9b. Scene 6 — Forgive-o-Meter
  10. Scene 7 — Promise & replay
  11. Tiny surprises (hearts)
  12. Start-up
   ===================================================================== */
'use strict';

/* ---------------------------------------------------------------------
   0. SETTINGS YOU MAY EDIT
   ---------------------------------------------------------------------
   OPTIONAL: to let Cutu send her note to you on WhatsApp, put YOUR phone
   number here, in international format, DIGITS ONLY.
     India example:  91 + your 10-digit number  ->  '919876543210'
     (no +, no spaces, no dashes, no leading zeros)
   Leave it as '' and the WhatsApp button stays hidden; the note is then
   only kept on the page and is never sent anywhere.
   --------------------------------------------------------------------- */
const MEOW_WHATSAPP_NUMBER = '';

/* ---------------------------------------------------------------------
   1. HELPERS
   --------------------------------------------------------------------- */
const $  = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
const prefersReducedMotion = () => reducedMotionQuery.matches;

// Waits a while. With reduced motion we never wait long.
const sleep = (ms) => new Promise((resolve) => {
  setTimeout(resolve, prefersReducedMotion() ? Math.min(ms, 150) : ms);
});

const HEART_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#i-heart"/></svg>';

// Elements
const scenes = {};
$$('.scene').forEach((el) => { scenes[Number(el.dataset.scene)] = el; });

const el = {
  begin:      $('#btn-begin'),
  orb:        $('#orb'),
  envelope:   $('#envelope'),
  letter:     $('#letter'),
  skipLetter: $('#btn-skip-letter'),
  letterNext: $('#btn-letter-next'),
  certificate:$('#certificate'),
  stamp:      $('#btn-stamp'),
  stampStatus:$('#stamp-status'),
  deptNext:   $('#btn-dept-next'),
  note:       $('#note'),
  saveNote:   $('#btn-save-note'),
  noteSkip:   $('#btn-note-skip'),
  noteStatus: $('#note-status'),
  whatsapp:   $('#btn-whatsapp'),
  pencil:     $('#pencil'),
  replay:     $('#btn-replay'),
  musicBtn:   $('#music-btn'),
  bgm:        $('#bgm'),
  toast:      $('#toast'),
};

/* ---------------------------------------------------------------------
   2. AMBIENT DECORATIONS
   A small number of petals/hearts keeps the page smooth on phones.
   --------------------------------------------------------------------- */
function rand(min, max) { return min + Math.random() * (max - min); }

function createPetals() {
  const layer = $('#petals');
  const count = window.innerWidth < 500 ? 9 : 14;
  for (let i = 0; i < count; i++) {
    const dur = rand(12, 22);
    const petal = document.createElement('span');
    petal.className = 'petal';
    petal.style.setProperty('--x', rand(0, 98).toFixed(1) + '%');
    petal.style.setProperty('--s', rand(11, 20).toFixed(0) + 'px');
    petal.style.setProperty('--dur', dur.toFixed(1) + 's');
    petal.style.setProperty('--delay', (-rand(0, dur)).toFixed(1) + 's'); // negative = already mid-fall
    petal.style.setProperty('--sway', rand(-70, 70).toFixed(0) + 'px');
    layer.appendChild(petal);
  }
}

function createFloatingHearts() {
  const layer = $('#floaters');
  const count = window.innerWidth < 500 ? 4 : 7;
  for (let i = 0; i < count; i++) {
    const dur = rand(16, 26);
    const heart = document.createElement('span');
    heart.className = 'float-heart';
    heart.innerHTML = HEART_SVG;
    heart.style.setProperty('--x', rand(4, 94).toFixed(1) + '%');
    heart.style.setProperty('--s', rand(14, 26).toFixed(0) + 'px');
    heart.style.setProperty('--dur', dur.toFixed(1) + 's');
    heart.style.setProperty('--delay', (-rand(0, dur)).toFixed(1) + 's');
    layer.appendChild(heart);
  }
}

/* ---------------------------------------------------------------------
   3. MUSIC  (one <audio> element for the whole story, so it never restarts)
   --------------------------------------------------------------------- */
let musicFailed = false;
let toastTimer = null;

function showToast(message, ms = 3800) {
  el.toast.textContent = message;
  el.toast.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toast.classList.remove('is-visible'), ms);
}

function updateMusicUI() {
  const playing = !el.bgm.paused && !musicFailed;
  el.musicBtn.classList.toggle('is-playing', playing);
  el.musicBtn.setAttribute('aria-pressed', String(playing));
  el.musicBtn.setAttribute('aria-label', playing ? 'Pause music' : 'Play music');
}

function markMusicUnavailable() {
  musicFailed = true;
  el.musicBtn.classList.add('is-unavailable');
  updateMusicUI();
}

function startMusic() {
  if (musicFailed || !el.bgm.paused) return;
  const attempt = el.bgm.play();
  if (attempt && typeof attempt.catch === 'function') {
    attempt.catch((err) => {
      if (err && err.name === 'NotAllowedError') {
        showToast('Your browser blocked the music. Tap the music button to start it.');
      } else {
        markMusicUnavailable();
        showToast('Music file not found. The story works fine without it. 🐾');
      }
      updateMusicUI();
    });
  }
}

function toggleMusic() {
  if (musicFailed || el.bgm.error) {
    showToast('No music yet. Add a file named song.mp3 next to index.html.');
    return;
  }
  if (el.bgm.paused) {
    startMusic();
  } else {
    el.bgm.pause();
  }
}

/* ---------------------------------------------------------------------
   4. SCENE NAVIGATION
   runId changes on every scene change. Any waiting animation sequence checks
   it, so an old sequence can never act after the story has moved on.
   --------------------------------------------------------------------- */
let currentScene = 1;
let runId = 0;

const sceneHooks = {
  1: onEnterScene1,
  2: onEnterScene2,
  3: onEnterScene3,
  4: onEnterScene4,
  5: onEnterScene5,
  6: onEnterScene6,
  7: onEnterScene7,
};

function goTo(number) {
  const next = scenes[number];
  if (!next) return;

  runId += 1;
  const id = runId;

  const prev = scenes[currentScene];
  if (prev && prev !== next) {
    prev.classList.remove('is-active');
    prev.inert = true;
    prev.setAttribute('aria-hidden', 'true');
  }

  next.inert = false;
  next.removeAttribute('aria-hidden');
  next.scrollTop = 0;
  next.classList.add('is-active');
  currentScene = number;

  const focusTarget = $('[data-focus]', next);
  if (focusTarget) focusTarget.focus({ preventScroll: true });

  sceneHooks[number](id);
}

/* ---------------------------------------------------------------------
   5. SCENE 1 — OPENING
   --------------------------------------------------------------------- */
let storyStarted = false;

function onEnterScene1() {
  storyStarted = false;
  scenes[1].classList.remove('is-opening');
  el.begin.disabled = false;
  $('#burst-petals').replaceChildren();
}

// Petals drift in from all around, gather in the middle, then a "breeze" carries them away.
async function playPetalBurst() {
  const layer = $('#burst-petals');
  layer.replaceChildren();
  if (prefersReducedMotion()) { await sleep(400); return; }

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const radius = Math.max(vw, vh) * 0.65;
  const count = vw < 500 ? 14 : 20;
  const running = [];

  for (let i = 0; i < count; i++) {
    const petal = document.createElement('span');
    petal.className = 'burst-petal';
    layer.appendChild(petal);

    const angle = Math.random() * Math.PI * 2;
    const startX = Math.cos(angle) * radius;
    const startY = Math.sin(angle) * radius;
    const gatherX = rand(-40, 40);
    const gatherY = rand(-40, 40);
    const endX = vw * 0.75 + rand(0, 120);
    const endY = rand(-0.45, 0.45) * vh;
    const spin = rand(0, 360);

    const animation = petal.animate([
      { transform: `translate(${startX}px, ${startY}px) rotate(${spin}deg) scale(.6)`, opacity: 0 },
      { opacity: 1, offset: 0.18 },
      { transform: `translate(${gatherX}px, ${gatherY}px) rotate(${spin + 200}deg) scale(1)`, opacity: 1, offset: 0.5 },
      { transform: `translate(${endX}px, ${endY}px) rotate(${spin + 520}deg) scale(.8)`, opacity: 0 },
    ], {
      duration: rand(2300, 2700),
      delay: rand(0, 300),
      easing: 'ease-in-out',
      fill: 'forwards',
    });
    running.push(animation.finished.catch(() => {}));
  }

  await Promise.all(running);
  layer.replaceChildren();
}

async function beginStory() {
  if (storyStarted) return;
  storyStarted = true;
  el.begin.disabled = true;
  const id = runId;

  startMusic(); // must happen inside the tap so the browser allows it
  scenes[1].classList.add('is-opening');

  await playPetalBurst();
  if (id !== runId) return;
  goTo(2);
}

/* ---------------------------------------------------------------------
   6. SCENE 2 — TEDDY & ENVELOPE
   --------------------------------------------------------------------- */
let envelopeOpened = false;

async function onEnterScene2(id) {
  envelopeOpened = false;
  el.envelope.classList.remove('is-open', 'is-ready');
  el.envelope.disabled = true;

  await sleep(2700); // teddy walks in, envelope is delivered
  if (id !== runId) return;

  el.envelope.disabled = false;
  el.envelope.classList.add('is-ready');
}

async function openEnvelope() {
  if (envelopeOpened || el.envelope.disabled) return;
  envelopeOpened = true;
  const id = runId;

  el.envelope.classList.remove('is-ready');
  el.envelope.classList.add('is-open');

  await sleep(1800); // flap opens, letter rises
  if (id !== runId) return;
  goTo(3);
}

/* ---------------------------------------------------------------------
   7. SCENE 3 — LETTER REVEAL
   --------------------------------------------------------------------- */
let letterSkipped = false;

function finishLetter() {
  $$('.reveal', el.letter).forEach((line) => line.classList.add('is-visible'));
  el.skipLetter.hidden = true;
  el.letterNext.hidden = false;
}

async function onEnterScene3(id) {
  letterSkipped = false;
  const lines = $$('.reveal', el.letter);
  lines.forEach((line) => line.classList.remove('is-visible'));
  el.skipLetter.hidden = false;
  el.letterNext.hidden = true;

  if (prefersReducedMotion()) { finishLetter(); return; }

  await sleep(1200); // paper unfolds first

  for (const line of lines) {
    if (id !== runId) return;
    if (letterSkipped) break;

    line.classList.add('is-visible');
    line.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    const words = line.textContent.trim().split(/\s+/).length;
    await sleep(Math.min(500 + words * 55, 1800)); // short lines go quickly
  }

  if (id !== runId) return;
  finishLetter();
}

function skipLetter() {
  if (el.skipLetter.hidden) return;
  letterSkipped = true;
  finishLetter();
}

/* ---------------------------------------------------------------------
   8. SCENE 4 — FORGIVENESS DEPARTMENT
   --------------------------------------------------------------------- */
function onEnterScene4() {
  el.certificate.classList.remove('is-stamped');
  el.stamp.textContent = 'Tap to stamp';
  el.stampStatus.textContent = '';
}

function stampCertificate() {
  if (el.certificate.classList.contains('is-stamped')) return;
  el.certificate.classList.add('is-stamped');
  el.stamp.textContent = 'Stamped ✓';
  el.stampStatus.textContent = 'Stamped: ask first, then listen well.';
  const rect = el.certificate.getBoundingClientRect();
  burstHearts(rect.right - 70, rect.bottom - 90, 6);
}

/* ---------------------------------------------------------------------
   9. SCENE 5 — NOTEBOOK
   Be honest: the note is NOT sent anywhere automatically.
   --------------------------------------------------------------------- */
const whatsappConfigured = /^\d{8,15}$/.test(MEOW_WHATSAPP_NUMBER);
let savedNote = '';
let pencilTimer = null;

function onEnterScene5() {
  el.whatsapp.hidden = true;
  el.noteSkip.textContent = 'Maybe later';
}

function saveNote() {
  const text = el.note.value.trim();
  if (!text) {
    el.noteStatus.textContent = "Nothing written yet. That's okay, you can skip this part whenever you like.";
    return;
  }
  savedNote = text;
  el.noteSkip.textContent = 'Continue';

  if (whatsappConfigured) {
    el.noteStatus.textContent = 'Saved on this page only. It has NOT been sent. You can send it with the button below if you want to.';
    el.whatsapp.hidden = false;
  } else {
    el.noteStatus.textContent = 'Saved on this page only. It has not been sent to anyone.';
  }
}

function sendViaWhatsapp() {
  if (!whatsappConfigured) return;
  const text = (el.note.value.trim() || savedNote);
  if (!text) {
    el.noteStatus.textContent = 'Write something first, then you can send it.';
    return;
  }
  const message = 'Hi Meow Meow, there is something I want you to understand:\n\n' + text;
  const url = 'https://wa.me/' + MEOW_WHATSAPP_NUMBER + '?text=' + encodeURIComponent(message);
  window.open(url, '_blank', 'noopener');
  el.noteStatus.textContent = 'WhatsApp opened. Your message is only sent if you press send there.';
}

function wigglePencil() {
  el.pencil.classList.add('is-writing');
  clearTimeout(pencilTimer);
  pencilTimer = setTimeout(() => el.pencil.classList.remove('is-writing'), 400);
}

/* ---------------------------------------------------------------------
   9b. SCENE 6 — FORGIVE-O-METER
   Purely playful and optional: nothing is stored or sent. Edit the words here.
   --------------------------------------------------------------------- */
const METER_STEPS = [
  { pct: 10,  mood: 'cry',   text: 'Sorry madam jii… 😭' },
  { pct: 30,  mood: 'cry',   text: 'Sorry, Tishu… 🥺' },
  { pct: 70,  mood: 'pout',  text: "Only 70%? Hmm… you don't love me? 🥺 (teasing! Take all the time you need.)" },
  { pct: 120, mood: 'happy', text: 'Thank you, Cutu! 💗' },
];
const METER_IDLE_TEXT = "Psst, Cutu… tap the button and let's check the meter. 🐾";

const meter = {
  card:  $('#meter-card'),
  track: $('#meter-track'),
  fill:  $('#meter-fill'),
  value: $('#meter-value'),
  panda: $('#panda'),
  bubble:$('#panda-bubble'),
  tap:   $('#btn-meter-tap'),
  next:  $('#btn-meter-next'),
  skip:  $('#btn-meter-skip'),
};
let meterStep = 0;
let meterShown = 0;
let meterFrame = 0;

function paintMeter(value) {
  meterShown = value;
  meter.value.textContent = Math.round(value) + '%';
  meter.fill.style.width = Math.min(value, 100) + '%';
}

function animateMeterTo(target) {
  cancelAnimationFrame(meterFrame);
  meter.track.setAttribute('aria-valuenow', String(target));
  if (prefersReducedMotion()) { paintMeter(target); return; }

  const from = meterShown;
  const duration = 900;
  const start = performance.now();
  const tick = (now) => {
    const t = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    paintMeter(from + (target - from) * eased);
    if (t < 1) meterFrame = requestAnimationFrame(tick);
  };
  meterFrame = requestAnimationFrame(tick);
}

function onEnterScene6() {
  meterStep = 0;
  cancelAnimationFrame(meterFrame);
  paintMeter(0);
  meter.track.setAttribute('aria-valuenow', '0');
  meter.card.classList.remove('is-over');
  meter.panda.dataset.mood = 'idle';
  meter.bubble.textContent = METER_IDLE_TEXT;
  meter.tap.hidden = false;
  meter.tap.textContent = 'Tap the meter';
  meter.next.hidden = true;
}

async function tapMeter() {
  if (meterStep >= METER_STEPS.length) return;
  const id = runId;
  const step = METER_STEPS[meterStep];
  meterStep += 1;

  animateMeterTo(step.pct);
  meter.panda.dataset.mood = step.mood;
  meter.bubble.textContent = step.text;
  meter.panda.classList.remove('pop');
  void meter.panda.getBoundingClientRect(); // restart the pop animation
  meter.panda.classList.add('pop');

  if (meterStep >= METER_STEPS.length) {
    meter.card.classList.add('is-over');
    meter.tap.hidden = true;
    meter.next.hidden = false;
    meter.next.focus({ preventScroll: true });
    await sleep(900);
    if (id !== runId) return;
    const rect = meter.card.getBoundingClientRect();
    burstHearts(rect.left + rect.width / 2, rect.top + rect.height / 2, 10);
  } else {
    meter.tap.textContent = 'Tap again';
  }
}

/* ---------------------------------------------------------------------
   10. SCENE 7 — PROMISE & REPLAY
   --------------------------------------------------------------------- */
async function onEnterScene7(id) {
  await sleep(1400);
  if (id !== runId) return;
  burstHearts(window.innerWidth / 2, window.innerHeight * 0.3, 8);
}

function replayStory() {
  // Reset everything the story changed. The music is left alone on purpose.
  el.note.value = '';
  savedNote = '';
  el.noteStatus.textContent = '';
  el.whatsapp.hidden = true;
  $('#burst-hearts').replaceChildren();
  goTo(1);
}

/* ---------------------------------------------------------------------
   11. TINY SURPRISES
   --------------------------------------------------------------------- */
function burstHearts(x, y, count = 8) {
  const layer = $('#burst-hearts');
  if (layer.childElementCount > 40) return; // keep it light

  for (let i = 0; i < count; i++) {
    const heart = document.createElement('span');
    heart.className = 'burst-heart';
    heart.innerHTML = HEART_SVG;
    heart.style.left = x + 'px';
    heart.style.top = y + 'px';
    layer.appendChild(heart);

    if (prefersReducedMotion()) {
      heart.style.opacity = '1';
      setTimeout(() => heart.remove(), 900);
      continue;
    }

    const dx = rand(-90, 90);
    const dy = -rand(60, 170);
    const size = rand(0.8, 1.5);
    const animation = heart.animate([
      { transform: 'translate(-50%, -50%) scale(.4)', opacity: 0 },
      { opacity: 1, offset: 0.2 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(${size})`, opacity: 0 },
    ], { duration: rand(1300, 1900), easing: 'cubic-bezier(.22,.8,.3,1)', fill: 'forwards' });
    animation.onfinish = () => heart.remove();
    animation.oncancel = () => heart.remove();
  }
}

// One listener handles every tappable "surprise" (teddies, hidden heart).
function handleSurpriseClick(event) {
  const target = event.target.closest('[data-surprise]');
  if (!target) return;

  const rect = target.getBoundingClientRect();
  burstHearts(rect.left + rect.width / 2, rect.top + rect.height / 3, 7);

  const svg = $('svg.teddy', target);
  if (svg && !prefersReducedMotion()) {
    svg.classList.remove('wiggle');
    void svg.getBoundingClientRect(); // restart the animation
    svg.classList.add('wiggle');
  }
  if (target.dataset.secretMsg) showToast(target.dataset.secretMsg);
}

/* ---------------------------------------------------------------------
   12. START-UP  (every listener is added exactly once, here)
   --------------------------------------------------------------------- */
function init() {
  createPetals();
  createFloatingHearts();

  // Only scene 1 is reachable at the start
  Object.keys(scenes).forEach((n) => {
    if (Number(n) !== 1) { scenes[n].inert = true; scenes[n].setAttribute('aria-hidden', 'true'); }
  });

  // Music
  el.musicBtn.addEventListener('click', toggleMusic);
  el.bgm.addEventListener('play', updateMusicUI);
  el.bgm.addEventListener('pause', updateMusicUI);
  el.bgm.addEventListener('error', markMusicUnavailable);
  el.bgm.volume = 0.7;
  updateMusicUI();

  // Scene 1
  el.begin.addEventListener('click', beginStory);
  el.orb.addEventListener('click', beginStory);

  // Scene 2
  el.envelope.addEventListener('click', openEnvelope);

  // Scene 3
  el.skipLetter.addEventListener('click', skipLetter);
  el.letterNext.addEventListener('click', () => goTo(4));
  el.letter.addEventListener('click', (event) => {
    if (!event.target.closest('button')) skipLetter(); // tap the paper to reveal everything
  });

  // Scene 4
  el.stamp.addEventListener('click', stampCertificate);
  el.deptNext.addEventListener('click', () => goTo(5));

  // Scene 5
  el.saveNote.addEventListener('click', saveNote);
  el.noteSkip.addEventListener('click', () => goTo(6)); // goes to the Forgive-o-Meter
  el.whatsapp.addEventListener('click', sendViaWhatsapp);
  el.note.addEventListener('input', wigglePencil);

  // Scene 6 (Forgive-o-Meter)
  meter.tap.addEventListener('click', tapMeter);
  meter.next.addEventListener('click', () => goTo(7));
  meter.skip.addEventListener('click', () => goTo(7));

  // Scene 7 (Promise)
  el.replay.addEventListener('click', replayStory);

  // Hidden surprises
  document.addEventListener('click', handleSurpriseClick);
}

init();