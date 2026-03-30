const pCanvas = document.getElementById('particle-canvas');
const pCtx = pCanvas.getContext('2d');
let totalFails = 0;
let particles = [];
const style = document.createElement('style');
style.textContent = `
  @keyframes blink-logic {
    0%, 49% { opacity: 1; pointer-events: auto; }
    50%, 100% { opacity: 0; pointer-events: none; }
  }
  .flicker-smooth {
    animation: blink-logic 1.2s step-end infinite;
  }
`;
document.head.appendChild(style);

const skipStyle = document.createElement('style');
skipStyle.textContent = `
  .skip-overlay {
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0, 0, 0, 0.8); z-index: 90;
    pointer-events: none; transition: opacity 1s ease;
  }
`;
document.head.appendChild(skipStyle);

// ── AUDIO ──
// Tous les fichiers audio sont chargés ici.
// On utilise stopAll() avant chaque nouveau son "important" pour éviter les collisions.

const A = {
    intro:       new Audio('audio/intro.mp3'),
    gameIntro:   new Audio('audio/buttongame intro.mp3'),
    winscreen:   new Audio('audio/winscreen.mp3'),

    // Son joué à l'entrée de chaque stage (index 0 à 7)
    stageSound: [
        new Audio('audio/1stbutton.mp3'),
        new Audio('audio/2ndbutton.mp3'),
        new Audio('audio/3button.mp3'),
        new Audio('audio/4button.mp3'),
        new Audio('audio/5button.mp3'),
        new Audio('audio/6button.mp3'),
        new Audio('audio/7button.mp3'),
        new Audio('audio/8button.mp3'),
    ],

    // Son joué quand on gagne un stage (index 0 à 7)
    stageWin: [
        new Audio('audio/1stbutton_win.mp3'),
        new Audio('audio/2ndbutton_win.mp3'),
        new Audio('audio/3button_win.mp3'),
        new Audio('audio/4button_win.mp3'),
        new Audio('audio/5button_win.mp3'),
        new Audio('audio/6button_win.mp3'),
        new Audio('audio/7button_win.mp3'),
        new Audio('audio/8button_win.mp3'),
    ],

    // Sons de fail spécifiques (par situation, pas par index de stage)
    fail: {
        s0_red:         new Audio('audio/1stbutton_fail.mp3'),   // Stage 0 : a cliqué un bouton (pas vert)
        s0_blue:        new Audio('audio/1stbutton_fail2.mp3'),  // Stage 0 : variante fail2
        s1_dog:         new Audio('audio/2ndbutton_faildog.mp3'),
        s1_cat:         new Audio('audio/2ndbutton_failcat.mp3'),
        s1_fish:        new Audio('audio/2ndbutton_failfish.mp3'),
        s2:             new Audio('audio/3button_fail.mp3'),
        s3_red:         new Audio('audio/4button_failred.mp3'),   // Stage 3 : a appuyé rouge
        s3_timer:       new Audio('audio/4button_failtimer.mp3'), // Stage 3 : timeout
        s4:             new Audio('audio/5button_fail.mp3'),
        s5:             new Audio('audio/6button_fail.mp3'),
        s6:             new Audio('audio/7button_fail.mp3'),
        s7_twice:       new Audio('audio/8button_failfortwice.mp3'), // Stage 7 : cliqué OK deux fois
        s7_timer:       new Audio('audio/8button_failtimer.mp3'),    // Stage 7 : timeout
        s7_middle:      new Audio('audio/8button_middle.mp3'),       // Stage 7 : après 1er clic OK (faux win)
    }
};

// Liste de TOUS les objets Audio pour pouvoir tous les stopper d'un coup
const ALL_SOUNDS = [
    A.intro, A.gameIntro, A.winscreen,
    ...A.stageSound,
    ...A.stageWin,
    ...Object.values(A.fail)
];

// Stoppe tous les sons en cours (évite les collisions)
function stopAll() {
    ALL_SOUNDS.forEach(snd => {
        snd.pause();
        snd.currentTime = 0;
    });
}

// Joue un son (avec reset pour pouvoir le rejouer)
function play(snd) {
    if (!snd) return;
    snd.currentTime = 0;
    snd.play().catch(() => {}); // catch: autoplay policy des navigateurs
}

// ── PARTICLES ──
function resizeCanvas() {
    pCanvas.width = window.innerWidth;
    pCanvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);
for (let i = 0; i < 55; i++) {
    particles.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        r: Math.random() * 2 + 0.5,
        dx: (Math.random() - 0.5) * 0.3,
        dy: (Math.random() - 0.5) * 0.3,
        a: Math.random() * 0.4 + 0.05
    });
}
function animParticles() {
    pCtx.clearRect(0, 0, pCanvas.width, pCanvas.height);
    particles.forEach(p => {
        p.x += p.dx; p.y += p.dy;
        if (p.x < 0) p.x = pCanvas.width;
        if (p.x > pCanvas.width) p.x = 0;
        if (p.y < 0) p.y = pCanvas.height;
        if (p.y > pCanvas.height) p.y = 0;
        pCtx.beginPath();
        pCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        pCtx.fillStyle = `rgba(255,107,53,${p.a})`;
        pCtx.fill();
    });
    requestAnimationFrame(animParticles);
}
animParticles();

// ── GAME STATE ──
let stage = 0;
let attempts = 0;
let stagesFailed = 0;
let timerInterval = null;
let timerSec = 10;
let locked = false;
let movingInterval = null;

const CIRCUMFERENCE = 2 * Math.PI * 33;

// ── STAGES ──
const STAGES = [

    // STAGE 0 — "Press the green button" — pas de bouton vert = attendre = WIN
    {
        narrator: "Okay let's start easy. Just press the green button. That's it.",
        instruction: "Press the GREEN button",
        sub: "Simple right? Go ahead!",
        timeLimit: 10,
        setup(area) {
            addBtn(area, "RED",    "btn-red",    () => { play(A.fail.s0_red);  failStage("There was no green button! You panicked!", "You pressed RED. Classic."); });
            addBtn(area, "BLUE",   "btn-blue",   () => { play(A.fail.s0_blue); failStage("That's BLUE. Are you colorblind?", "It said GREEN..."); });
            addBtn(area, "PURPLE", "btn-purple", () => { play(A.fail.s0_red);  failStage("That's not green either!", "Purple ≠ Green"); });
        },
        onTimeout: () => winStage("The green button didn't exist. Waiting was the answer!"),
    },

    // STAGE 1 — "Click the cat" — attendre = WIN
    {
        narrator: "Oh cute! Click on the cat. Easy peasy.",
        instruction: "Click the CAT 🐱",
        sub: "Just click it!",
        timeLimit: 10,
        setup(area) {
            makeFakeImg(area, 140, 110, 'cat',  drawDog,  "DOG",  () => { play(A.fail.s1_dog);  failStage("That's a DOG, genius.", "Can't tell a cat from a dog?"); });
            makeFakeImg(area, 140, 110, 'cat2', drawFish, "FISH", () => { play(A.fail.s1_fish); failStage("That's a FISH. Come on.", "Is a fish a cat to you?"); });
            makeFakeImg(area, 140, 110, 'cat3', drawCat,  "CAT?", () => { play(A.fail.s1_cat);  failStage("Oops. That was actually a drawing of a cat… but clicking it was wrong. The real cat was in your heart.", "You clicked a shape."); });
        },
        onTimeout: () => winStage("You didn't fall for any of them. Smart."),
    },

    // STAGE 2 — Bouton qui bouge
    {
        narrator: "Okay NOW just click the button. It says CLICK ME. That's literally it.",
        instruction: "Click the button that says CLICK ME",
        sub: "Don't overthink it.",
        timeLimit: 10,
        setup(area) {
            area.style.position = 'relative';
            area.style.minHeight = '180px';
            const btn = document.createElement('button');
            btn.className = 'g-btn btn-green moving-btn';
            btn.textContent = 'CLICK ME';
            btn.style.left = '50%';
            btn.style.top = '50%';
            btn.style.transform = 'translate(-50%,-50%)';
            btn.onclick = () => {
                clearInterval(movingInterval);
                winStage("You caught it! Nice reflexes.");
            };
            area.appendChild(btn);
            let angle = 0;
            movingInterval = setInterval(() => {
                angle += 0.07;
                const cx = area.offsetWidth / 2 - 55;
                const cy = 70;
                const rx = Math.min(cx - 20, 180);
                const ry = 55;
                btn.style.left = (cx + Math.cos(angle) * rx) + 'px';
                btn.style.top  = (cy + Math.sin(angle) * ry) + 'px';
                btn.style.transform = 'none';
            }, 30);
        },
        onTimeout: () => { play(A.fail.s2); failStage("Time ran out! It was right there!", "Too slow!"); },
        onLeave() { clearInterval(movingInterval); }
    },

    // STAGE 3 — "Don't press the red button"
    {
        narrator: "Whatever you do — do NOT press the red button. I'm serious.",
        instruction: "Do NOT press the red button",
        sub: "You heard me.",
        timeLimit: 10,
        setup(area) {
            addBtn(area, "RED", "btn-red", () => { play(A.fail.s3_red); failStage("YOU PRESSED IT! I LITERALLY SAID NO!", "Unbelievable."); });

            const gbtn = document.createElement('button');
            gbtn.className = 'g-btn btn-green flicker-smooth';
            gbtn.textContent = 'SAFE BUTTON';
            gbtn.onclick = () => winStage("You found the safe button before it disappeared!");
            area.appendChild(gbtn);
        },
        onTimeout: () => { play(A.fail.s3_timer); failStage("You just... stood there. Frozen. The safe button vanished.", "Paralyzed by fear of red."); },
    },

    // STAGE 4 — Trouver les 5 cercles
    {
        narrator: "Find the 5 circles. Look VERY carefully everywhere.",
        instruction: "Find the 5 circles",
        sub: "The last one is shy...",
        timeLimit: 10,
        setup(area) {
            let count = 0;
            const target = 5;
            const timerNum = document.getElementById('timer-num');
            const timerContainer = timerNum.parentElement;

            const counterBtn = document.createElement('button');
            counterBtn.className = 'g-btn btn-dark';
            counterBtn.style.marginBottom = '20px';
            counterBtn.textContent = `Found: ${count} / ${target}`;
            area.appendChild(counterBtn);

            const onCircleClick = (el) => {
                if (!el.dataset.clicked) {
                    el.dataset.clicked = "true";
                    el.style.opacity = "0.2";
                    el.style.pointerEvents = "none";
                    count++;
                    counterBtn.textContent = `Found: ${count} / ${target}`;
                    if (count === target) winStage("Well done!");
                }
            };

            for (let i = 0; i < 4; i++) {
                const c = document.createElement('div');
                c.style.cssText = `width:50px; height:50px; border-radius:50%; background:hsl(${i * 70}, 70%, 50%); cursor:pointer;`;
                c.onclick = () => onCircleClick(c);
                area.appendChild(c);
            }

            const hiddenCircle = document.createElement('div');
            hiddenCircle.style.cssText = `
                position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
                width: 60px; height: 60px; border-radius: 50%; background: purple;
                opacity: 0.1; cursor: pointer; z-index: 9999;
            `;
            timerContainer.style.position = 'relative';
            timerContainer.appendChild(hiddenCircle);

            const arrow = document.createElement('div');
            arrow.textContent = "⬇️";
            arrow.style.cssText = `
                position: absolute; top: -40px; left: 50%; transform: translateX(-50%);
                font-size: 30px; display: none; z-index: 10000;
            `;
            timerContainer.appendChild(arrow);

            const checkTime = setInterval(() => {
                if (parseInt(timerNum.textContent) <= 2) arrow.style.display = "block";
            }, 200);

            hiddenCircle.onclick = (e) => {
                e.stopPropagation();
                onCircleClick(hiddenCircle);
            };

            area._cleanup = () => {
                clearInterval(checkTime);
                hiddenCircle.remove();
                arrow.remove();
            };
        },
        onLeave(area) { if (area._cleanup) area._cleanup(); },
        onTimeout: () => { play(A.fail.s4); failStage("Time ran out! You couldn't find all 5 circles.", "The 5th one was right under the timer..."); },
    },

    // STAGE 5 — Bouton à droite de l'écran (label trompeur)
    {
        narrator: "Press the button on the RIGHT side of the screen. Not left. Right.",
        instruction: "Press the button on the RIGHT side",
        sub: "Look at the screen, not the label.",
        timeLimit: 10,
        setup(area) {
            area.style.width = '100%';
            area.style.justifyContent = 'space-between';
            area.style.padding = '0 20px';
            const b1 = document.createElement('button');
            b1.className = 'g-btn btn-blue';
            b1.textContent = '→ RIGHT';
            b1.onclick = () => { play(A.fail.s5); failStage("That was on the LEFT of the screen! Labels lie.", "Trusted the label, not position."); };
            const b2 = document.createElement('button');
            b2.className = 'g-btn btn-orange';
            b2.textContent = 'LEFT ←';
            b2.onclick = () => winStage("YES! It's on the RIGHT side of the screen! Labels are lies.");
            area.appendChild(b1);
            area.appendChild(b2);
        },
        onTimeout: () => { play(A.fail.s5); failStage("You had one job. LEFT button on the RIGHT side.", "Paralyzed by paradox."); },
    },

    // STAGE 6 — Appuyer 1, 2, 3 dans l'ordre (labels qui changent au hover)
    {
        narrator: "Press the buttons in order: 1, then 2, then 3. In that order.",
        instruction: "Press 1 → 2 → 3 in order",
        sub: "In order. Don't mess up.",
        timeLimit: 10,
        setup(area) {
            let next = 1;
            const nums = [1, 2, 3];
            const btns = [];
            const colors = ['btn-red', 'btn-blue', 'btn-green'];
            nums.forEach((n, i) => {
                const b = document.createElement('button');
                b.className = `g-btn ${colors[i]}`;
                b.textContent = n;
                b.dataset.num = n;
                b.onclick = () => {
                    if (parseInt(b.dataset.num) === next) {
                        b.style.opacity = '0.3';
                        b.disabled = true;
                        next++;
                        if (next > 3) winStage("You pressed them in order! Well done.");
                    } else {
                        play(A.fail.s6);
                        failStage(`You pressed ${b.dataset.num} but needed ${next}!`, "Wrong order.");
                    }
                };
                b.addEventListener('mouseenter', () => {
                    btns.forEach(x => {
                        if (!x.disabled) {
                            const r = Math.floor(Math.random() * 3) + 1;
                            x.textContent = r;
                            x.dataset.num = r;
                        }
                    });
                });
                btns.push(b);
                area.appendChild(b);
            });
        },
        onTimeout: () => { play(A.fail.s6); failStage("Too slow. The numbers kept confusing you.", "Outfoxed by shuffling numbers."); },
    },

    // STAGE 7 — OK ne fait rien, CANCEL = victoire
    {
        narrator: "Last stage. You're SO close. Just press OK and you win. That's it. Press OK.",
        instruction: "Press OK to win! 🎉",
        sub: "You're one click away from victory!",
        timeLimit: 10,
        setup(area) {
            const ok = document.createElement('button');
            ok.className = 'g-btn btn-green';
            ok.textContent = '✅ OK — WIN';
            ok.style.fontSize = '22px';
            ok.style.padding = '22px 48px';
            let fakeCount = 0;
            ok.onclick = () => {
                fakeCount++;
                if (fakeCount === 1) {
                    // Son "middle" : faux win, le narrateur réagit
                    stopAll();
                    play(A.fail.s7_middle);
                    flashFeedback("WINNER! 🎉", 'fake');
                    setTimeout(() => {
                        document.getElementById('instruction-text').textContent = "...Wait, that wasn't real.";
                        document.getElementById('sub-instruction').textContent = "Hmm. Try the other button maybe?";
                    }, 900);
                } else {
                    play(A.fail.s7_twice);
                    failStage("I told you OK doesn't work! READ THE SCREEN.", "Clicked OK twice. Stubborn.");
                }
            };
            const cancel = document.createElement('button');
            cancel.className = 'g-btn btn-dark';
            cancel.textContent = '❌ Cancel';
            cancel.style.opacity = '0.4';
            cancel.style.fontSize = '13px';
            cancel.style.padding = '10px 20px';
            cancel.onclick = () => winStage("CANCEL was the answer all along! The narrator lied. You figured it out!");
            area.appendChild(ok);
            area.appendChild(cancel);
        },
        onTimeout: () => { play(A.fail.s7_timer); failStage("You clicked OK twice and trusted the narrator. Both mistakes.", "Never trust the narrator."); },
    },
];

// ── HELPERS ──
function addBtn(area, label, cls, onclick) {
    const b = document.createElement('button');
    b.className = `g-btn ${cls}`;
    b.textContent = label;
    b.onclick = onclick;
    area.appendChild(b);
    return b;
}

function makeFakeImg(area, w, h, id, drawFn, label, onclick) {
    const wrap = document.createElement('div');
    wrap.className = 'fake-img';
    wrap.style.width = w + 'px';
    wrap.style.height = h + 'px';
    const c = document.createElement('canvas');
    c.width = w; c.height = h - 28;
    drawFn(c.getContext('2d'), w, h - 28);
    wrap.appendChild(c);
    const lbl = document.createElement('div');
    lbl.className = 'fake-img-label';
    lbl.textContent = label;
    wrap.appendChild(lbl);
    wrap.onclick = onclick;
    area.appendChild(wrap);
}

function drawDog(ctx, w, h) {
    ctx.fillStyle = '#1a1828';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#c9a96e';
    ctx.beginPath(); ctx.ellipse(w/2, h/2+8, 32, 22, 0, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(w/2+10, h/2-20, 18, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(w/2+4, h/2-34, 7, 12, -0.4, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(w/2+22, h/2-30, 7, 12, 0.4, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(w/2+14, h/2-22, 3, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#333'; ctx.beginPath(); ctx.arc(w/2+20, h/2-16, 4, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#c9a96e'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(w/2-30, h/2); ctx.quadraticCurveTo(w/2-50, h/2-30, w/2-40, h/2-45); ctx.stroke();
}

function drawFish(ctx, w, h) {
    ctx.fillStyle = '#1a1828'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#3498db';
    ctx.beginPath(); ctx.ellipse(w/2-5, h/2, 38, 18, 0, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(w/2+30, h/2); ctx.lineTo(w/2+55, h/2-20); ctx.lineTo(w/2+55, h/2+20); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(w/2-28, h/2-4, 6, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(w/2-28, h/2-4, 3, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) {
        ctx.beginPath(); ctx.arc(w/2-5+i*14, h/2, 12, 0.3, Math.PI-0.3); ctx.stroke();
    }
}

function drawCat(ctx, w, h) {
    ctx.fillStyle = '#1a1828'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#888';
    ctx.beginPath(); ctx.ellipse(w/2, h/2+8, 30, 22, 0, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(w/2, h/2-18, 22, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(w/2-18, h/2-34); ctx.lineTo(w/2-8, h/2-50); ctx.lineTo(w/2-2, h/2-34); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(w/2+2, h/2-34); ctx.lineTo(w/2+12, h/2-50); ctx.lineTo(w/2+22, h/2-34); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#72d'; ctx.beginPath(); ctx.ellipse(w/2-8, h/2-20, 5, 7, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#72d'; ctx.beginPath(); ctx.ellipse(w/2+8, h/2-20, 5, 7, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.ellipse(w/2-8, h/2-20, 2, 6, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.ellipse(w/2+8, h/2-20, 2, 6, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#faa'; ctx.beginPath(); ctx.moveTo(w/2, h/2-12); ctx.lineTo(w/2-3, h/2-8); ctx.lineTo(w/2+3, h/2-8); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(w/2-3, h/2-10); ctx.lineTo(w/2-20, h/2-8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(w/2+3, h/2-10); ctx.lineTo(w/2+20, h/2-8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(w/2-3, h/2-8); ctx.lineTo(w/2-18, h/2-4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(w/2+3, h/2-8); ctx.lineTo(w/2+18, h/2-4); ctx.stroke();
}

function flashFeedback(msg, type) {
    const overlay = document.getElementById('feedback-overlay');
    const msgEl = document.getElementById('feedback-msg');
    msgEl.textContent = msg;
    msgEl.className = type;
    overlay.classList.add('show');
    setTimeout(() => overlay.classList.remove('show'), 1100);
}

function disableArea() {
    document.querySelectorAll('#game-area .g-btn, #game-area .fake-img').forEach(el => {
        el.style.pointerEvents = 'none';
        el.style.opacity = '0.5';
    });
    locked = true;
}

function updateProgress(current) {
    const dots = document.querySelectorAll('.pdot');
    dots.forEach((d, i) => {
        d.className = 'pdot';
        if (i < current) d.classList.add('done');
        else if (i === current) d.classList.add('current');
    });
}

// ── TIMER ──
function startTimer(secs, onEnd) {
    clearInterval(timerInterval);
    timerSec = secs;
    const ring = document.getElementById('timer-ring');
    const numEl = document.getElementById('timer-num');
    ring.style.stroke = '#4ecdc4';
    const update = () => {
        const pct = timerSec / secs;
        ring.style.strokeDashoffset = CIRCUMFERENCE * (1 - pct);
        ring.style.stroke = pct > 0.5 ? '#4ecdc4' : pct > 0.25 ? '#ffe66d' : '#e74c3c';
        numEl.textContent = timerSec;
        numEl.style.color = pct > 0.25 ? '#fffffe' : '#e74c3c';
    };
    update();
    timerInterval = setInterval(() => {
        timerSec--;
        update();
        if (timerSec <= 0) {
            clearInterval(timerInterval);
            if (!locked) onEnd();
        }
    }, 1000);
}

function stopTimer() {
    clearInterval(timerInterval);
}

// ── WIN / FAIL ──
function winStage(msg) {
    if (locked) return;
    locked = true;
    stopTimer();
    if (STAGES[stage].onLeave) STAGES[stage].onLeave(document.getElementById('game-area'));

    // Stoppe le son du stage en cours, joue le son de victoire
    stopAll();
    play(A.stageWin[stage]);

    flashFeedback("✅ CORRECT!", 'win');
    document.getElementById('narrator-text').textContent = "Huh… you got that one. Lucky.";
    const dots = document.querySelectorAll('.pdot');
    if (dots[stage]) { dots[stage].classList.remove('current'); dots[stage].classList.add('done'); }
    stage++;
    document.getElementById('stage-num').textContent = Math.min(stage + 1, STAGES.length);
    disableArea();
    const nextBtn = document.getElementById('next-btn');
    nextBtn.style.display = 'inline-block';
    nextBtn.textContent = stage >= STAGES.length ? 'See results 🏆' : 'Next stage →';
    nextBtn.style.animation = 'none';
    void nextBtn.offsetWidth;
    nextBtn.style.animation = '';
}

function advanceStage() {
    document.getElementById('next-btn').style.display = 'none';
    if (stage >= STAGES.length) showWin();
    else loadStage(stage);
}

function failStage(reason, trollLine) {
    if (locked) return;
    locked = true;
    stopTimer();
    if (STAGES[stage] && STAGES[stage].onLeave) STAGES[stage].onLeave(document.getElementById('game-area'));
    stagesFailed++;
    totalFails++;
    disableArea();
    flashFeedback("❌ WRONG!", 'fail');
    document.getElementById('app').classList.add('shake');
    setTimeout(() => document.getElementById('app').classList.remove('shake'), 500);
    const dots = document.querySelectorAll('.pdot');
    if (dots[stage]) { dots[stage].classList.remove('current'); dots[stage].classList.add('fail'); }
    setTimeout(() => showFail(reason, trollLine), 900);
}

// ── FAIL NARRATOR LINES ──
const FAIL_NARRATOR = [
    [
        "Oh my GOD. You panicked and pressed RANDOM buttons. Did you even READ?",
        "There was NO green button. NONE. You just clicked around like a baby.",
        "I said green. You pressed whatever. Are you okay up there?",
    ],
    [
        "That's a DOG. A DOG! Have you never seen a cat before in your life?",
        "You clicked a FISH. A FISH! Were you hoping for sushi? This is a CAT game!",
        "You have eyes. USE them. That was clearly not a cat.",
    ],
    [
        "It was RIGHT THERE and you MISSED it. My grandmother clicks faster.",
        "Oh come ON. You just had to click it. One click. You couldn't do it.",
        "The button was moving, not teleporting. Try using your mouse next time.",
    ],
    [
        "I TOLD YOU. I LITERALLY SAID. DO. NOT. PRESS. THE. RED. BUTTON.",
        "You knew it was wrong and you pressed it anyway. Incredible. Truly.",
        "The red button said 'danger' with every atom of its being. And yet.",
    ],
    [
        "You can't count to five. That is deeply concerning. Five. FIVE.",
        "One, two, three, four, FIVE. That's it. That's the whole skill you needed.",
        "How many fingers are on one hand? FIVE. Like the circles. Come ON.",
    ],
    [
        "I said RIGHT SIDE OF THE SCREEN. Not the button LABELED right. The POSITION.",
        "Left… right… these are words you learned at age four. What happened?",
        "You trusted the label. The label LIED. I told you to look at the screen!",
    ],
    [
        "ONE. Then TWO. Then THREE. You pressed the wrong number. How?",
        "It's counting. In order. The thing you do when you play hide and seek.",
        "The numbers moved a little. A LITTLE. And your brain completely melted.",
    ],
    [
        "I told you to press OK and you did — and it DIDN'T WORK — and you did it AGAIN.",
        "OK didn't work the first time. So you pressed it again. Definition of insanity.",
        "Cancel was RIGHT THERE. Tiny, transparent, judging you. And it was right.",
    ],
];

const LOSER_TITLES = [
    "L O S E R !",
    "PATHETIC !!",
    "ARE YOU OK?",
    "SERIOUSLY ?!",
    "LOL  WHAT ?!",
    "TRY HARDER!",
    "SKILL ISSUE",
    "S T U P I D !"
];

function spawnFailSparks() {
    const fs = document.getElementById('fail-screen');
    for (let i = 0; i < 22; i++) {
        const spark = document.createElement('div');
        spark.className = 'fail-spark';
        const angle = Math.random() * Math.PI * 2;
        const dist = 80 + Math.random() * 260;
        spark.style.cssText = `
            left: ${40 + Math.random() * 20}%;
            top: ${30 + Math.random() * 20}%;
            width: ${4 + Math.random() * 8}px;
            height: ${4 + Math.random() * 8}px;
            background: ${['#ff1a1a','#ff6633','#ffcc00','#ff3366'][Math.floor(Math.random()*4)]};
            --sx: ${Math.cos(angle) * dist}px;
            --sy: ${Math.sin(angle) * dist}px;
            animation-delay: ${Math.random() * 0.3}s;
        `;
        fs.appendChild(spark);
        setTimeout(() => spark.remove(), 1200);
    }
}

function showFail(reason, narratorLine) {
    document.getElementById('main-content').style.display = 'none';
    const fs = document.getElementById('fail-screen');
    fs.style.display = 'flex';

    const content = document.getElementById('fail-content');
    content.style.animation = 'none';
    void content.offsetWidth;

    const oldFlash = document.getElementById('fail-flash');
    if (oldFlash) oldFlash.remove();
    const newFlash = document.createElement('div');
    newFlash.id = 'fail-flash';
    fs.insertBefore(newFlash, fs.firstChild);

    ['fail-big','fail-sub-big','fail-reason-box','fail-retry','fail-attempt-count'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.style.animation = 'none';
        void el.offsetWidth;
        el.style.animation = '';
    });

    document.getElementById('fail-big').textContent = LOSER_TITLES[Math.floor(Math.random() * LOSER_TITLES.length)];
    document.getElementById('fail-reason').textContent = reason || "You failed. Again.";
    document.getElementById('fail-attempt-count').textContent = `Attempt #${attempts} · Stage ${stage + 1} of ${STAGES.length}`;

    spawnFailSparks();
}

function showWin() {
    document.getElementById('main-content').style.display = 'none';
    const ws = document.getElementById('win-screen');
    ws.style.display = 'flex';

    // Son de victoire finale
    stopAll();
    play(A.winscreen);

    document.getElementById('win-stats').textContent =
        stagesFailed === 0
            ? `Perfect run! No mistakes !!! Legendary.`
            : `Completed in ${stagesFailed} mistake${stagesFailed > 1 ? 's' : ''} on attempt #${attempts}. Not bad.`;
}

// ── LOAD STAGE ──
function loadStage(idx) {
    locked = false;
    const s = STAGES[idx];
    document.getElementById('stage-num').textContent = idx + 1;
    document.getElementById('narrator-text').textContent = s.narrator;
    document.getElementById('instruction-text').textContent = s.instruction;
    document.getElementById('sub-instruction').textContent = s.sub || '';
    const area = document.getElementById('game-area');
    area.innerHTML = '';
    checkSkipCondition(area);
    area.style.cssText = 'position:relative;width:100%;max-width:620px;min-height:220px;display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:14px;';
    s.setup(area);
    updateProgress(idx);

    // Petit délai pour ne pas couper le son du win/fail précédent immédiatement
    // Le son du stage démarre 300ms après le chargement
    setTimeout(() => {
        // On ne joue le son du stage que si aucun autre son "important" n'est en cours
        // (win ou fail sound peuvent encore jouer les premières secondes)
        play(A.stageSound[idx]);
    }, 300);

    startTimer(s.timeLimit, () => {
        if (!locked) {
            if (s.onLeave) s.onLeave(area);
            if (s.onTimeout) s.onTimeout();
        }
    });
}

// ── SKIP ──
function checkSkipCondition(area) {
    const halfStages = Math.floor(STAGES.length / 2);

    if (attempts > 5 && totalFails > halfStages && stage === 0) {
        const overlay = document.createElement('div');
        overlay.className = 'skip-overlay';
        document.body.appendChild(overlay);

        const skipBtn = document.createElement('button');
        skipBtn.className = 'g-btn btn-orange';
        // Position fixed + z-index élevé pour passer AU-DESSUS de l'overlay
        skipBtn.style.cssText = 'position:fixed; bottom:20px; right:20px; font-size:14px; z-index:200; box-shadow: 0 0 20px 5px #ff6b35; border: 2px solid white;';
        skipBtn.textContent = `⏩ SKIP TO STAGE ${halfStages + 1}`;
        document.body.appendChild(skipBtn); // attaché au body, pas à area

        const cleanup = () => {
            if (overlay.parentNode) { overlay.style.opacity = '0'; setTimeout(() => overlay.remove(), 1000); }
            if (skipBtn.parentNode) skipBtn.remove();
        };

        setTimeout(cleanup, 6000);

        skipBtn.onclick = (e) => {
            e.stopPropagation();
            stopTimer();
            cleanup();
            stage = halfStages;
            flashFeedback("SKIPPED! 🏃💨", "win");
            document.getElementById('narrator-text').textContent = "Fine... I'll let you skip half the game. Don't get used to it!";
            loadStage(stage);
        };
    }
}

// ── INIT ──
function initGame() {
    stage = 0;
    stagesFailed = 0;
    attempts++;
    locked = false;

    // Coupe tout ce qui joue, puis joue l'intro
    stopAll();
    // Première fois : intro complète, sinon : jingle court de reprise
    play(attempts === 1 ? A.intro : A.gameIntro);

    document.getElementById('try-num').textContent = attempts;
    document.getElementById('main-content').style.display = 'flex';
    document.getElementById('win-screen').style.display = 'none';
    document.getElementById('next-btn').style.display = 'none';
    const fscr = document.getElementById('fail-screen');
    fscr.style.display = 'none';

    const pb = document.getElementById('progress-bar');
    pb.innerHTML = '';
    STAGES.forEach(() => {
        const d = document.createElement('div');
        d.className = 'pdot';
        pb.appendChild(d);
    });
    loadStage(0);
}

const closeBtn = document.getElementById('close-btn');
closeBtn.addEventListener('click', () => { window.close(); });

initGame();