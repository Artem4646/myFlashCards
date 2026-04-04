// --- FIREBASE CONFIG ---
const firebaseConfig = {
    apiKey: "AIzaSyDmgEKwNIUnXrvUsn6OTzjWBI_MIegPCHk",
    authDomain: "pet-project-90af1.firebaseapp.com",
    projectId: "pet-project-90af1",
    storageBucket: "pet-project-90af1.firebasestorage.app",
    messagingSenderId: "408900485418",
    appId: "1:408900485418:web:450d1665212044352e9e53"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth(), db = firebase.firestore();

let curFid = null, deck = [], studyQueue = [], currentMistakes = [], idx = 0, currentMode = '', side = 'term';
let isLoginMode = true;

// --- AUTH ---
auth.onAuthStateChanged(user => {
    if (user) {
        document.getElementById('nav-container').style.display = 'flex';
        document.getElementById('logout-btn').style.display = 'flex';
        nav('folders');
    } else {
        document.getElementById('nav-container').style.display = 'none';
        document.getElementById('logout-btn').style.display = 'none';
        showScreen('scr-auth');
    }
});

async function handleAuth() {
    const e = document.getElementById('email').value.trim(), p = document.getElementById('pass').value.trim();
    if (!e || !p) return alert("Заповни поля");
    try {
        if (isLoginMode) await auth.signInWithEmailAndPassword(e, p);
        else await auth.createUserWithEmailAndPassword(e, p);
    } catch (err) { alert(err.message); }
}

function toggleAuthMode() {
    isLoginMode = !isLoginMode;
    document.getElementById('auth-title').innerText = isLoginMode ? "З поверненням!" : "Створити акаунт";
    document.getElementById('auth-submit-btn').innerText = isLoginMode ? "Увійти" : "Зареєструватися";
}

// --- NAVIGATION ---
function nav(s) {
    if (!curFid && (s === 'editor' || s === 'study')) return nav('folders');
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('n-' + s)?.classList.add('active');
    showScreen('scr-' + s);
    if (s === 'folders') loadFolders();
    if (s === 'editor') loadCards();
    if (s === 'study') {
        document.getElementById('study-menu').style.display = 'block';
        document.getElementById('study-area').style.display = 'none';
    }
}

function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    window.scrollTo(0, 0);
}

// --- FOLDERS & CARDS (Firebase) ---
async function loadFolders() {
    const snap = await db.collection('users').doc(auth.currentUser.uid).collection('folders').orderBy('createdAt', 'asc').get();
    const list = document.getElementById('folders-list');
    list.innerHTML = '';
    snap.forEach(doc => {
        const d = doc.data();
        list.innerHTML += `<div class="item-row" onclick="selectFolder('${doc.id}', '${d.name.replace(/'/g, "\\'")}')">
            <b>${d.name}</b>
            <button class="btn-icon btn-danger" onclick="uiDeleteFolder('${doc.id}', event)">🗑️</button>
        </div>`;
    });
}

function uiAddFolder() {
    const name = prompt("Назва модуля:");
    if (name) db.collection('users').doc(auth.currentUser.uid).collection('folders').add({
        name, createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(loadFolders);
}

async function selectFolder(id, name) {
    curFid = id;
    document.getElementById('study-title').innerText = name;
    await loadCards();
    nav('study');
}

async function loadCards() {
    const snap = await db.collection('users').doc(auth.currentUser.uid).collection('folders').doc(curFid).collection('cards').get();
    deck = [];
    snap.forEach(doc => deck.push({id: doc.id, ...doc.data()}));
    const list = document.getElementById('cards-list');
    list.innerHTML = deck.length ? '' : 'Порожньо';
    deck.forEach(c => {
        list.innerHTML += `<div class="item-row"><span>${c.term} - ${c.def}</span><button onclick="uiDeleteCard('${c.id}')">🗑️</button></div>`;
    });
}

async function addCard() {
    const t = document.getElementById('in-w'), d = document.getElementById('in-t');
    if (t.value && d.value) {
        await db.collection('users').doc(auth.currentUser.uid).collection('folders').doc(curFid).collection('cards').add({
            term: t.value.trim(), def: d.value.trim(), createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        t.value = ''; d.value = ''; t.focus(); loadCards();
    }
}

// --- STUDY LOGIC ---
function setSide(s) {
    side = s;
    document.querySelectorAll('.side-option').forEach(o => o.classList.remove('active'));
    document.getElementById('s-' + s).classList.add('active');
}

function startMode(m, useMistakes = false) {
    let base = useMistakes ? [...currentMistakes] : [...deck];
    if (base.length < 1) return alert("Додай слова!");
    studyQueue = (side === 'rand') ? [...base].sort(() => 0.5 - Math.random()) : [...base];
    currentMode = m; idx = 0; currentMistakes = [];
    document.getElementById('study-menu').style.display = 'none';
    document.getElementById('study-area').style.display = 'block';
    renderStep();
}

function speak(text) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US'; u.rate = 0.9;
    window.speechSynthesis.speak(u);
}

function renderStep() {
    const cont = document.getElementById('mode-container');
    if (idx >= studyQueue.length) {
        cont.innerHTML = `<div style="text-align:center; padding:40px;"><h2>🎉 Готово!</h2><button class="btn-main" onclick="nav('study')">В меню</button></div>`;
        return;
    }

    const card = studyQueue[idx];
    let isTermFirst = (side === 'rand') ? Math.random() > 0.5 : (side === 'term');
    const voiceBtn = `<button class="btn-icon voice-btn" onclick="event.stopPropagation(); speak('${card.term.replace(/'/g, "\\'")}');">🔊</button>`;

    if (currentMode === 'flip') {
        cont.innerHTML = `
            <div class="card-scene" id="swipe-zone">
                <div class="card-inner" id="card-obj">
                    <div class="card-face">${isTermFirst ? card.term + voiceBtn : card.def}</div>
                    <div class="card-back card-face">${!isTermFirst ? card.term + voiceBtn : card.def}</div>
                </div>
            </div>
            <div style="display:flex; gap:10px;">
                <button class="btn-main wrong-btn" onclick="handleFlipResult(false)">Не знаю</button>
                <button class="btn-main" style="background:var(--success)" onclick="handleFlipResult(true)">Знаю</button>
            </div>`;
        initSwipe();
    } else if (currentMode === 'learn') {
        let q = isTermFirst ? card.term + voiceBtn : card.def;
        let cor = isTermFirst ? card.def : card.term;
        let pool = deck.map(d => isTermFirst ? d.def : d.term);
        let opts = [cor, ...pool.filter(v => v !== cor).sort(() => 0.5 - Math.random()).slice(0, 3)].sort(() => 0.5 - Math.random());

        cont.innerHTML = `<div class="editor-box"><h2>${q}</h2></div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                ${opts.map(o => `<button class="btn-main secondary" onclick="checkChoice(this, '${o.replace(/'/g, "\\'")}', '${cor.replace(/'/g, "\\")}')">${o}</button>`).join('')}
            </div>`;
    }
}

function checkChoice(btn, user, cor) {
    const isCor = user === cor;
    if (!isCor) currentMistakes.push(studyQueue[idx]);
    btn.style.background = isCor ? 'var(--success)' : 'var(--danger)';
    btn.style.color = 'white';
    setTimeout(() => { idx++; renderStep(); }, 700);
}

function handleFlipResult(known) {
    if (!known) currentMistakes.push(studyQueue[idx]);
    const card = document.getElementById('card-obj');
    if (card) {
        card.style.transition = '0.4s';
        card.style.transform = `translateX(${known ? 500 : -500}px) rotate(${known ? 20 : -20}deg)`;
        card.style.opacity = '0';
    }
    setTimeout(() => { idx++; renderStep(); }, 300);
}

function initSwipe() {
    const zone = document.getElementById('swipe-zone'), card = document.getElementById('card-obj');
    if (!zone || !card) return;
    let sX, sT;

    // Клік для ПК
    zone.onclick = (e) => {
        if (e.target.closest('.voice-btn')) return;
        card.classList.toggle('flipped');
    };

    // Свайпи для мобільних
    zone.ontouchstart = e => {
        if (e.target.closest('.voice-btn')) return;
        sX = e.touches[0].clientX; sT = Date.now();
        card.style.transition = '0s';
    };

    zone.ontouchend = e => {
        let dX = e.changedTouches[0].clientX - sX, dT = Date.now() - sT;
        card.style.transition = '0.6s';
        if (Math.abs(dX) > 100) handleFlipResult(dX > 0);
        else card.style.transform = card.classList.contains('flipped') ? 'rotateY(180deg)' : '';
    };
}
