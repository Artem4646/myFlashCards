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

// --- STATE ---
let curFid = null, deck = [], studyQueue = [], currentMistakes = [], idx = 0, currentMode = '', side = 'term';
let isLoginMode = true;

// --- AUTH LOGIC ---
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

function toggleAuthMode() {
    isLoginMode = !isLoginMode;
    document.getElementById('auth-title').innerText = isLoginMode ? "З поверненням!" : "Створити акаунт";
    document.getElementById('auth-submit-btn').innerText = isLoginMode ? "Увійти" : "Зареєструватися";
    document.getElementById('auth-switch-text').innerText = isLoginMode ? "Ще немає акаунта?" : "Вже є акаунт?";
    document.getElementById('auth-switch-link').innerText = isLoginMode ? "Створити" : "Увійти";
}

async function handleAuth() {
    const e = document.getElementById('email').value.trim(), p = document.getElementById('pass').value.trim();
    if (!e || !p) return alert("Заповни всі поля, будь ласка");
    try {
        if (isLoginMode) await auth.signInWithEmailAndPassword(e, p); 
        else await auth.createUserWithEmailAndPassword(e, p);
    } catch (err) { alert(err.message); }
}

// --- FOLDERS ---
async function loadFolders() {
    try {
        const snap = await db.collection('users').doc(auth.currentUser.uid).collection('folders').orderBy('createdAt', 'asc').get();
        const list = document.getElementById('folders-list');
        list.innerHTML = '';
        if (snap.empty) {
            list.innerHTML = `<div style="text-align:center; padding: 40px; color:var(--muted)">Натисни "+ Створити", щоб додати перший модуль</div>`;
            return;
        }
        snap.forEach(doc => {
            const d = doc.data();
            const dateDisplay = (d.createdAt && d.createdAt.toDate) ? d.createdAt.toDate().toLocaleDateString() : "Щойно";
            list.innerHTML += `<div class="item-row" onclick="selectFolder('${doc.id}', '${d.name.replace(/'/g, "\\'")}')">
                <div><b>${d.name}</b><div style="font-size:0.8rem; color:var(--muted)">${dateDisplay}</div></div>
                <div style="display:flex; gap:10px" onclick="event.stopPropagation()">
                    <button class="btn-icon" onclick="uiRenameFolder('${doc.id}', '${d.name.replace(/'/g, "\\'")}', event)">✏️</button>
                    <button class="btn-icon btn-danger" onclick="uiDeleteFolder('${doc.id}', '${d.name.replace(/'/g, "\\'")}', event)">🗑️</button>
                </div>
            </div>`;
        });
    } catch (err) { console.error(err); }
}

function uiAddFolder() {
    const name = prompt("Введіть назву модуля:")?.trim();
    if (name) {
        db.collection('users').doc(auth.currentUser.uid).collection('folders').add({
            name, createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }).then(() => setTimeout(loadFolders, 500));
    }
}

function uiRenameFolder(fid, old, e) {
    e.stopPropagation();
    const n = prompt("Нова назва:", old)?.trim();
    if (n && n !== old) {
        db.collection('users').doc(auth.currentUser.uid).collection('folders').doc(fid).update({name: n}).then(() => setTimeout(loadFolders, 500));
    }
}

async function uiDeleteFolder(fid, name, e) {
    e.stopPropagation();
    if (confirm(`Видалити "${name}"?`)) {
        await db.collection('users').doc(auth.currentUser.uid).collection('folders').doc(fid).delete();
        loadFolders();
    }
}

async function selectFolder(id, name) {
    curFid = id;
    document.getElementById('editor-title').innerText = name;
    document.getElementById('study-title').innerText = name;
    await loadCards();
    nav('study');
}

// --- EDITOR ---
async function loadCards() {
    if (!curFid) return;
    // Обов'язкове сортування за датою створення
    const snap = await db.collection('users').doc(auth.currentUser.uid)
        .collection('folders').doc(curFid)
        .collection('cards')
        .orderBy('createdAt', 'asc')
        .get();
    
    deck = [];
    snap.forEach(doc => deck.push({id: doc.id, ...doc.data()}));
    
    const list = document.getElementById('cards-list');
    list.innerHTML = '';
    document.querySelector('#n-editor').innerHTML = `<i>✏️</i>Слова (${deck.length})`;
    
    if (deck.length === 0) {
        list.innerHTML = `<div style="text-align:center; padding: 30px; color:var(--muted)">Модуль порожній</div>`;
        return;
    }
    deck.forEach(c => {
        list.innerHTML += `<div class="item-row">
            <div style="flex:1"><b style="color:var(--accent-solid)">${c.term}</b> → ${c.def}</div>
            <div style="display:flex; gap:8px">
                <button class="btn-icon" onclick="uiEditCard('${c.id}', '${c.term.replace(/'/g, "\\'")}', '${c.def.replace(/'/g, "\\")}')">✏️</button>
                <button class="btn-icon btn-danger" onclick="uiDeleteCard('${c.id}')">🗑️</button>
            </div>
        </div>`;
    });
}

async function addCard() {
    const t = document.getElementById('in-w'), d = document.getElementById('in-t');
    const term = t.value.trim(), def = d.value.trim();
    if (term && def && curFid) {
        await db.collection('users').doc(auth.currentUser.uid)
            .collection('folders').doc(curFid)
            .collection('cards').add({
                term: term, 
                def: def, 
                createdAt: firebase.firestore.FieldValue.serverTimestamp() // Мітка часу
            });
        t.value = ''; d.value = ''; t.focus();
        loadCards();
    }
}

function uiEditCard(id, ot, od) {
    const nt = prompt("Термін:", ot)?.trim(), nd = prompt("Переклад:", od)?.trim();
    if (nt && nd) {
        db.collection('users').doc(auth.currentUser.uid).collection('folders').doc(curFid).collection('cards').doc(id).update({term: nt, def: nd})
        .then(() => setTimeout(loadCards, 500));
    }
}

async function uiDeleteCard(id) {
    if (confirm("Видалити картку?")) {
        await db.collection('users').doc(auth.currentUser.uid).collection('folders').doc(curFid).collection('cards').doc(id).delete();
        loadCards();
    }
}

// --- NAVIGATION ---
function nav(s) {
    if (!curFid && (s === 'editor' || s === 'study')) return nav('folders');
    document.querySelectorAll('.nav-bar .nav-btn').forEach(b => b.classList.remove('active'));
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

// --- STUDY CORE ---
function setSide(s) {
    side = s;
    document.querySelectorAll('.side-option').forEach(o => o.classList.remove('active'));
    document.getElementById('s-' + s).classList.add('active');
}

function startMode(m, useMistakes = false) {
    let base = useMistakes ? [...currentMistakes] : [...deck];
    if (base.length < 1) return alert("Додай слова!");
    
    // Якщо обрано 'rand', перемішуємо. Якщо ні — йдемо за чергою з масиву deck
    studyQueue = (side === 'rand') ? [...base].sort(() => 0.5 - Math.random()) : [...base];
    
    currentMode = m; idx = 0; currentMistakes = [];
    document.getElementById('study-menu').style.display = 'none';
    document.getElementById('study-area').style.display = 'block';
    renderStep();
}

function renderStep() {
    const cont = document.getElementById('mode-container');
    if (idx >= studyQueue.length) {
        let retryBtn = currentMistakes.length > 0 ? `<button class="btn-main" style="background:var(--danger)" onclick="startMode('${currentMode}', true)">🔄 Вчити помилки (${currentMistakes.length})</button>` : '';
        cont.innerHTML = `<div style="text-align:center; padding:50px 0;">
            <span style="font-size:4rem">🎉</span><h2>Чудова робота!</h2><p>Помилок: ${currentMistakes.length}</p>
            ${retryBtn}<button class="btn-main secondary" onclick="nav('study')">До меню</button>
        </div>`;
        return;
    }

    const card = studyQueue[idx];
    let answerIsDef = (side === 'rand' || currentMode === 'test') ? Math.random() > 0.5 : (side === 'term');
    let questionText = answerIsDef ? card.term : card.def;
    let answerText = answerIsDef ? card.def : card.term;
    const safeAns = answerText.replace(/'/g, "\\'");
    const backBtn = idx > 0 ? `<button class="btn-main btn-back" onclick="prevStep()">⬅️</button>` : `<div></div>`;

    if (currentMode === 'flip') {
        cont.innerHTML = `<p style="text-align:center; color:var(--muted)">${idx+1}/${studyQueue.length}</p>
            <div class="card-scene" id="swipe-zone"><div class="card-inner" id="card-obj" onclick="this.classList.toggle('flipped')">
                <div class="card-face"><div class="card-label">Питання</div>${questionText}</div>
                <div class="card-back card-face"><div class="card-label">Відповідь</div>${answerText}</div>
            </div></div>
            <div class="study-controls">${backBtn}<div class="flip-btns">
                <button class="btn-main secondary" onclick="handleFlipResult(false)">❌</button>
                <button class="btn-main" style="background:var(--success)" onclick="handleFlipResult(true)">✅</button>
            </div></div>`;
        initSwipe();
    } else {
        let isWrite = (currentMode === 'write') || (currentMode === 'test' && Math.random() > 0.5);
        if (isWrite) {
            cont.innerHTML = `<p style="text-align:center; color:var(--muted)">${currentMode==='test'?'📝 ТЕСТ':'⌨️ Письмо'} ${idx+1}/${studyQueue.length}</p>
                <div style="background:var(--surface); padding:40px 20px; border-radius:var(--radius-lg); text-align:center; margin-bottom:20px;"><h2>${questionText}</h2></div>
                <input type="text" id="q-input" class="input-ans" placeholder="Введіть переклад..." autocomplete="off" onkeydown="if(event.key==='Enter'){event.preventDefault(); checkWrite('${safeAns}');}">
                <div class="study-controls">${backBtn}<button class="btn-main" onclick="checkWrite('${safeAns}')">Перевірити</button></div>`;
            setTimeout(() => document.getElementById('q-input')?.focus(), 200);
        } else {
            const pool = deck.map(d => answerIsDef ? d.def : d.term);
            let opts = [answerText, ...pool.filter(v => v !== answerText).sort(() => 0.5 - Math.random()).slice(0, 3)].sort(() => 0.5 - Math.random());
            cont.innerHTML = `<p style="text-align:center; color:var(--muted)">${currentMode==='test'?'📝 ТЕСТ':'🧠 Вибір'} ${idx+1}/${studyQueue.length}</p>
                <div style="background:var(--surface); padding:40px 20px; border-radius:var(--radius-lg); text-align:center; margin-bottom:20px;"><h2>${questionText}</h2></div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:20px">
                    ${opts.map(o => `<button class="btn-main secondary" onclick="checkChoice(this, '${o.replace(/'/g, "\\'")}', '${safeAns}')">${o}</button>`).join('')}
                </div><div class="study-controls">${backBtn}</div>`;
        }
    }
}

function prevStep() {
    if (idx > 0) { 
        idx--; 
        if (currentMistakes.length > 0 && currentMistakes[currentMistakes.length - 1] === studyQueue[idx]) currentMistakes.pop();
        renderStep(); 
    }
}

function checkChoice(btn, user, cor) {
    const isCor = user === cor;
    if (!isCor) currentMistakes.push(studyQueue[idx]);
    btn.style.backgroundColor = isCor ? 'var(--success)' : 'var(--danger)';
    btn.style.color = 'white';
    if (!isCor) document.querySelectorAll('#mode-container button').forEach(b => { 
        if(b.innerText === cor.replace(/\\'/g, "'")) b.style.backgroundColor = 'var(--success)'; 
    });
    setTimeout(() => { idx++; renderStep(); }, isCor ? 600 : 1200);
}

function checkWrite(cor) {
    const input = document.getElementById('q-input');
    const isCor = input.value.trim().toLowerCase() === cor.trim().toLowerCase();
    if (!isCor) { 
        currentMistakes.push(studyQueue[idx]); 
        input.value = "Правильно: " + cor; 
    }
    input.classList.add(isCor ? 'correct' : 'wrong');
    setTimeout(() => { idx++; renderStep(); }, isCor ? 600 : 1500);
}

function handleFlipResult(known) {
    if (!known) currentMistakes.push(studyQueue[idx]);
    const card = document.getElementById('card-obj');
    if (card) {
        card.style.transform = `translateX(${known ? 400 : -400}px) rotate(${known ? 30 : -30}deg) ${card.classList.contains('flipped')?'rotateY(180deg)':''}`;
        card.style.opacity = '0';
    }
    setTimeout(() => { idx++; renderStep(); }, 400);
}

function initSwipe() {
    const zone = document.getElementById('swipe-zone'), card = document.getElementById('card-obj');
    if (!zone || !card) return;
    let sX, sY, sT;
    zone.ontouchstart = e => { sX = e.touches[0].clientX; sY = e.touches[0].clientY; sT = Date.now(); card.style.transition = '0s'; };
    zone.ontouchmove = e => { 
        let x = e.touches[0].clientX - sX, y = e.touches[0].clientY - sY;
        if (Math.abs(x) > Math.abs(y)) { e.preventDefault(); card.style.transform = `translateX(${x}px) rotate(${x/20}deg) ${card.classList.contains('flipped')?'rotateY(180deg)':''}`; }
    };
    zone.ontouchend = e => {
        let dX = e.changedTouches[0].clientX - sX, dT = Date.now() - sT;
        if (dT < 250 && Math.abs(dX) < 10) { card.style.transition = '0.6s'; card.classList.toggle('flipped'); return; }
        if (Math.abs(dX) > 120) handleFlipResult(dX > 0);
        else { card.style.transition = '0.4s'; card.style.transform = card.classList.contains('flipped') ? 'rotateY(180deg)' : ''; }
    };
}

function toggleTheme() {
    document.body.classList.toggle('light-theme');
    localStorage.setItem('theme', document.body.classList.contains('light-theme') ? 'light' : 'dark');
}
if (localStorage.getItem('theme') === 'light') document.body.classList.add('light-theme');
