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
    let curFid = null, deck = [], studyQueue = [], mistakes = [], currentMistakes = [], idx = 0, currentMode = '',
        side = 'term', startX = 0;
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
            if (isLoginMode) await auth.signInWithEmailAndPassword(e, p); else await auth.createUserWithEmailAndPassword(e, p);
        } catch (err) {
            alert(err.message);
        }
    }

    // --- FOLDERS ---
    async function loadFolders() {
        // Додаємо try-catch, щоб одна помилка не "вішала" весь додаток
        try {
            const snap = await db.collection('users').doc(auth.currentUser.uid).collection('folders').orderBy('createdAt', 'desc').get();
            const list = document.getElementById('folders-list');
            list.innerHTML = '';

            if (snap.empty) {
                list.innerHTML = `<div style="text-align:center; padding: 40px; color:var(--muted)">Натисни "+ Створити", щоб додати перший модуль</div>`;
                return;
            }

            snap.forEach(doc => {
                const d = doc.data();

                // ПЕРЕВІРКА ДАТИ: Якщо метод toDate існує — малюємо дату, якщо ні — пишемо "Щойно"
                const dateDisplay = (d.createdAt && d.createdAt.toDate)
                    ? d.createdAt.toDate().toLocaleDateString()
                    : "Створення...";

                list.innerHTML += `<div class="item-row" onclick="selectFolder('${doc.id}', '${d.name.replace(/'/g, "\\'")}')">
                <div>
                    <b style="font-size:1.1rem">${d.name}</b>
                    <div style="font-size:0.8rem; color:var(--muted); margin-top:4px">${dateDisplay}</div>
                </div>
                <div style="display:flex; gap:10px" onclick="event.stopPropagation()">
                    <button class="btn-icon" onclick="uiRenameFolder('${doc.id}', '${d.name.replace(/'/g, "\\'")}', event)">✏️</button>
                    <button class="btn-icon btn-danger" onclick="uiDeleteFolder('${doc.id}', '${d.name.replace(/'/g, "\\'")}', event)">🗑️</button>
                </div>
            </div>`;
            });
        } catch (err) {
            console.error("Помилка при завантаженні папок:", err);
        }
    }

    function uiAddFolder() {
        const name = prompt("Введіть назву модуля:")?.trim();
        if (name) {
            db.collection('users').doc(auth.currentUser.uid).collection('folders').add({
                name, createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            setTimeout(loadFolders, 500);
        }
    }

    function uiRenameFolder(fid, oldName, e) {
        e.stopPropagation();
        const newName = prompt("Нова назва модуля:", oldName)?.trim();
        if (newName && newName !== oldName) {
            db.collection('users').doc(auth.currentUser.uid).collection('folders').doc(fid).update({name: newName});
            setTimeout(loadFolders, 500);
        }
    }

    async function uiDeleteFolder(fid, name, e) {
        e.stopPropagation();
        if (confirm(`Справді видалити модуль "${name}"? Усі слова в ньому зникнуть.`)) {
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
        const snap = await db.collection('users').doc(auth.currentUser.uid).collection('folders').doc(curFid).collection('cards').get();
        deck = [];
        snap.forEach(doc => deck.push({id: doc.id, ...doc.data()}));
        const list = document.getElementById('cards-list');
        list.innerHTML = '';

        const count = deck.length;
        document.querySelector('#n-editor').innerHTML = `<i>✏️</i>Слова (${count})`;

        if (deck.length === 0) {
            list.innerHTML = `<div style="text-align:center; padding: 30px; color:var(--muted)">У цьому модулі ще немає слів. Додай перше!</div>`;
            return;
        }

        deck.forEach(c => {
            list.innerHTML += `<div class="item-row">
                <div style="flex:1; font-weight:500"><b style="color:var(--accent-solid)">${c.term}</b> <span style="color:var(--muted); margin: 0 8px">→</span> ${c.def}</div>
                <div style="display:flex; gap:8px" onclick="event.stopPropagation()">
                    <button class="btn-icon" style="width:35px; height:35px; font-size:0.9rem" onclick="uiEditCard('${c.id}', '${c.term.replace(/'/g, "\\'")}', '${c.def.replace(/'/g, "\\")}')">✏️</button>
                    <button class="btn-icon btn-danger" style="width:35px; height:35px; font-size:0.9rem" onclick="uiDeleteCard('${c.id}')">🗑️</button>
                </div>
            </div>`;
        });
    }

    async function addCard() {
        const t = document.getElementById('in-w'), d = document.getElementById('in-t');
        const term = t.value.trim(), def = d.value.trim();
        if (term && def && curFid) {
            await db.collection('users').doc(auth.currentUser.uid).collection('folders').doc(curFid).collection('cards').add({
                term,
                def
            });
            t.value = '';
            d.value = '';
            t.focus();
            loadCards();
        } else {
            alert("Заповни обидва поля");
        }
    }

    function uiEditCard(cid, oldT, oldD) {
        const nt = prompt("Редагувати термін:", oldT)?.trim();
        const nd = prompt("Редагувати переклад:", oldD)?.trim();
        if (nt && nd) {
            db.collection('users').doc(auth.currentUser.uid).collection('folders').doc(curFid).collection('cards').doc(cid).update({
                term: nt,
                def: nd
            });
            setTimeout(loadCards, 500);
        }
    }

    async function uiDeleteCard(cid) {
        if (confirm("Видалити цю картку?")) {
            await db.collection('users').doc(auth.currentUser.uid).collection('folders').doc(curFid).collection('cards').doc(cid).delete();
            loadCards();
        }
    }

    // --- NAVIGATION ---
    function nav(s) {
        if (!curFid && (s === 'editor' || s === 'study')) return nav('folders');

        // Update Active State in Nav Bar
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
        studyQueue = useMistakes ? [...currentMistakes] : [...deck].sort(() => 0.5 - Math.random());
        if (studyQueue.length < 1) return alert("Додай хоча б одне слово в модуль!");
        currentMode = m;
        idx = 0;
        currentMistakes = [];
        document.getElementById('study-menu').style.display = 'none';
        document.getElementById('study-area').style.display = 'block';
        renderStep();
    }

    function renderStep() {
    const cont = document.getElementById('mode-container');
    if (idx >= studyQueue.length) {
        let retryBtn = '';
        if (currentMistakes.length > 0) {
            retryBtn = `<button class="btn-main" style="margin-top:15px; background:var(--danger)" onclick="startMode('${currentMode}', true)">🔄 Вчити помилки (${currentMistakes.length})</button>`;
        }
        cont.innerHTML = `<div style="text-align:center; padding:50px 0; animation: modalIn 0.4s ease;">
        <span style="font-size:4rem">🎉</span>
        <h2 style="margin-top:20px">Чудова робота!</h2>
        <p>Раунд завершено. Помилок: ${currentMistakes.length}</p>
        ${retryBtn}
        <button class="btn-main secondary" style="margin-top:15px" onclick="nav('study')">До меню навчання</button></div>`;
        return;
    }

    const card = studyQueue[idx];
    
    // 1. ВИЗНАЧАЄМО СТОРОНУ (Рандом сторін для кожного кроку)
    let answerIsDef;
    if (side === 'rand' || currentMode === 'test') {
        answerIsDef = Math.random() > 0.5;
    } else {
        answerIsDef = (side === 'term'); 
    }

    let questionText = answerIsDef ? card.term : card.def;
    let answerText = answerIsDef ? card.def : card.term;
    
    // Екрануємо лапки для безпечного використання в HTML атрибутах
    const safeAnswer = answerText.replace(/'/g, "\\'");

    const backBtn = idx > 0 ? `<button class="btn-main btn-back" onclick="prevStep()">⬅️</button>` : `<div></div>`;

    // 2. ЛОГІКА РЕЖИМІВ
    if (currentMode === 'flip') {
        cont.innerHTML = `
        <p style="text-align:center; color:var(--muted); margin-bottom:15px; font-weight:600">${idx + 1} / ${studyQueue.length}</p>
        <div class="card-scene" id="swipe-zone">
            <div class="card-inner" id="card-obj" onclick="if(window.innerWidth > 768) this.classList.toggle('flipped')">
                <div class="card-face"><div class="card-label">Питання</div>${questionText}</div>
                <div class="card-back card-face"><div class="card-label">Відповідь</div>${answerText}</div>
            </div>
        </div>
        <div class="study-controls">
            ${backBtn}
            <div class="flip-btns" style="display:flex; gap:10px;">
                <button class="btn-main secondary" style="color:var(--danger); flex:1" onclick="handleFlipResult(false)">❌</button>
                <button class="btn-main" style="background:var(--success); flex:1" onclick="handleFlipResult(true)">✅</button>
            </div>
        </div>`;
        initSwipe();

    } else {
        // Визначаємо тип завдання: Письмо чи Вибір
        let isWriteType = (currentMode === 'write') || (currentMode === 'test' && Math.random() > 0.5);

        if (isWriteType) {
            // ФОРМАТ: ПИСЬМО
            const safeAnswer = answerText.replace(/'/g, "\\'"); // Екрануємо лапки

            cont.innerHTML = `
            <p style="text-align:center; color:var(--muted); margin-bottom:10px; font-weight:600">
                ${currentMode === 'test' ? '📝 ТЕСТ: Письмо' : '⌨️ Письмо'} (${idx + 1} / ${studyQueue.length})
            </p>
            <div style="background:var(--surface); padding:40px 20px; border-radius:var(--radius-lg); border:1px solid var(--border); text-align:center; margin-bottom:20px;">
                <h2 style="font-size:2rem">${questionText}</h2>
            </div>
            <div class="input-group">
                <input type="text" id="q-input" class="input-ans" 
                       placeholder="Введіть переклад..." 
                       autocomplete="off"
                       onkeydown="if(event.key === 'Enter') { event.preventDefault(); checkWrite('${safeAnswer}'); }">
            </div>
            <div class="study-controls">
                ${backBtn}
                <button class="btn-main" onclick="checkWrite('${safeAnswer}')">Перевірити</button>
            </div>`;
            
            // Фокусуємося на полі введення
            setTimeout(() => {
                const input = document.getElementById('q-input');
                if (input) input.focus();
            }, 200);

        } else {
            // ФОРМАТ: ВИБІР ВАРІАНТІВ (однією мовою)
            const pool = deck.map(d => answerIsDef ? d.def : d.term);
            let others = pool.filter(v => v !== answerText);
            let opts = [answerText, ...others.sort(() => 0.5 - Math.random()).slice(0, 3)].sort(() => 0.5 - Math.random());

            cont.innerHTML = `
            <p style="text-align:center; color:var(--muted); margin-bottom:10px; font-weight:600">
                ${currentMode === 'test' ? '📝 ТЕСТ: Вибір' : '🧠 Вибір'} (${idx + 1} / ${studyQueue.length})
            </p>
            <div style="background:var(--surface); padding:40px 20px; border-radius:var(--radius-lg); border:1px solid var(--border); text-align:center; margin-bottom:20px;">
                <h2 style="font-size:2rem">${questionText}</h2>
            </div>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; margin-bottom:20px">
                ${opts.map(o => `
                    <button class="btn-main secondary" onclick="checkChoice(this, '${o.replace(/'/g, "\\'")}', '${safeAnswer}')">
                        ${o}
                    </button>
                `).join('')}
            </div>
            <div class="study-controls">
                ${backBtn}
                <div style="flex:1"></div>
            </div>`;
        }
    }
}

    function prevStep() {
        if (idx > 0) {
            idx--;
            // Видаляємо останню помилку з масиву, якщо ми повернулися назад
            // (це необов'язково, але логічно: якщо користувач повернувся, він хоче перездати)
            if (currentMistakes.length > 0 && currentMistakes[currentMistakes.length - 1] === studyQueue[idx]) {
                currentMistakes.pop();
            }
            renderStep();
        }
    }

    // --- STUDY INTERACTIONS ---
    function checkChoice(btn, user, cor) {
        if (user === cor) {
            btn.style.backgroundColor = 'var(--success)';
            btn.style.color = 'white';
            btn.style.borderColor = 'var(--success)';
            setTimeout(() => {
                idx++;
                renderStep();
            }, 600);
        } else {
            currentMistakes.push(studyQueue[idx]);
            btn.style.backgroundColor = 'var(--danger)';
            btn.style.color = 'white';
            btn.style.borderColor = 'var(--danger)';

            // Підсвічуємо правильну відповідь
            document.querySelectorAll('#mode-container .btn-main').forEach(b => {
                if (b.innerText === cor) {
                    b.style.backgroundColor = 'var(--success)';
                    b.style.color = 'white';
                    b.style.borderColor = 'var(--success)';
                }
            });
            setTimeout(() => {
                idx++;
                renderStep();
            }, 1200);
        }
    }

    function checkWrite(cor) {
        const input = document.getElementById('q-input');
        const val = input.value.trim();
        if (val.toLowerCase() === cor.trim().toLowerCase()) {
            input.classList.add('correct'); // Переконайтеся, що в CSS є клас .correct { border-color: var(--success); }
            setTimeout(() => {
                idx++;
                renderStep();
            }, 600);
        } else {
            currentMistakes.push(studyQueue[idx]);
            input.classList.add('wrong');
            input.value = `Помилка. Правильно: ${cor}`;
            setTimeout(() => {
                idx++;
                renderStep();
            }, 1500);
        }
    }

    // --- FLIP CARD ACTIONS ---
    function handleFlipResult(known) {
        if (!known) currentMistakes.push(studyQueue[idx]);
        const card = document.getElementById('card-obj');
        if (!card) return;

        card.style.transition = '0.5s cubic-bezier(0.55, 0, 1, 0.45)';
        card.style.transform = `translateX(${known ? 400 : -400}px) rotate(${known ? 30 : -30}deg) ${card.classList.contains('flipped') ? 'rotateY(180deg)' : ''}`;
        card.style.opacity = '0';

        setTimeout(() => {
            idx++;
            renderStep();
        }, 400);
    }

    // --- MOBILE SWIPE & FLIP ---
    function initSwipe() {
        const zone = document.getElementById('swipe-zone'), card = document.getElementById('card-obj');
        if (!zone || !card) return;

        let startTime, startX, startY;

        zone.ontouchstart = e => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            startTime = new Date().getTime();
            card.style.transition = '0s';
        };

        zone.ontouchmove = e => {
            let x = e.touches[0].clientX - startX;
            let y = e.touches[0].clientY - startY;

            // Запобігаємо скролу сторінки, коли рухаємо картку
            if (Math.abs(x) > Math.abs(y)) {
                e.preventDefault();
                let rotY = card.classList.contains('flipped') ? 'rotateY(180deg)' : '';
                card.style.transform = `translateX(${x}px) rotate(${x / 20}deg) ${rotY}`;
            }
        };

        zone.ontouchend = e => {
            let distX = e.changedTouches[0].clientX - startX;
            let distY = e.changedTouches[0].clientY - startY;
            let elapsed = new Date().getTime() - startTime;

            // Логіка визначення тапу (кліку) на мобільному
            if (elapsed < 250 && Math.abs(distX) < 10 && Math.abs(distY) < 10) {
                card.style.transition = '0.6s cubic-bezier(0.34, 1.56, 0.64, 1)';
                card.classList.toggle('flipped');
                return;
            }

            // Логіка свайпу
            if (Math.abs(distX) > 120) {
                handleFlipResult(distX > 0);
            } else {
                // Return to center
                card.style.transition = '0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
                card.style.transform = card.classList.contains('flipped') ? 'rotateY(180deg)' : '';
            }
        };
    }

    // --- UTILS ---
    function openPopup(t, b, cb) {
        document.getElementById('m-title').innerText = t;
        document.getElementById('m-body').innerText = b;
        const btns = document.getElementById('m-btns');
        btns.innerHTML = '';
        const btn = document.createElement('button');
        btn.className = "btn-main";
        btn.innerText = "Зрозуміло";
        btn.onclick = () => {
            if (cb) cb();
            document.getElementById('modal-overlay').style.display = 'none';
        };
        btns.appendChild(btn);
        document.getElementById('modal-overlay').style.display = 'flex';
    }

    function toggleTheme() {
        document.body.classList.toggle('light-theme');
        localStorage.setItem('theme', document.body.classList.contains('light-theme') ? 'light' : 'dark');
    }

    // Load saved theme
    if (localStorage.getItem('theme') === 'light') document.body.classList.add('light-theme');
