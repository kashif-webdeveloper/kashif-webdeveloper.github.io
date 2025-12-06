let expression = "";
let audioCtx = null;
let isDegree = true;
let memory = 0;
const resultEl = document.getElementById('result');
const historyEl = document.getElementById('history');
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('overlay');
const themeToggle = document.getElementById('theme-toggle');
const soundToggle = document.getElementById('sound-toggle');

// --- Initialization ---
window.onload = function() {
    if (localStorage.getItem('theme') === 'light') { document.body.classList.add('light-mode'); themeToggle.checked = true; }
    if (localStorage.getItem('sound') === 'on') { soundToggle.checked = true; }
    const lastRes = localStorage.getItem('lastResult');
    if(lastRes && lastRes !== "0" && lastRes !== "Error") { resultEl.innerText = lastRes; expression = lastRes; historyEl.innerText = "Restored Session"; }

    // App Shortcut Handler
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('mode') === 'sci') {
        handleNav('sci');
    }
};

// --- Settings & UI ---
function toggleTheme() {
    if (themeToggle.checked) { document.body.classList.add('light-mode'); localStorage.setItem('theme', 'light'); }
    else { document.body.classList.remove('light-mode'); localStorage.setItem('theme', 'dark'); }
}
function saveSoundPref() { localStorage.setItem('sound', soundToggle.checked ? 'on' : 'off'); }

function playSound() {
    if (!soundToggle.checked) return;
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator(); const gainNode = audioCtx.createGain();
    osc.type = 'sine'; osc.frequency.setValueAtTime(600, audioCtx.currentTime); osc.frequency.exponentialRampToValueAtTime(300, audioCtx.currentTime + 0.1);
    gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime); gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
    osc.connect(gainNode); gainNode.connect(audioCtx.destination); osc.start(); osc.stop(audioCtx.currentTime + 0.1);
}

function setAngleMode(mode) {
    isDegree = (mode === 'deg');
    showToast(`Mode set to ${isDegree ? "Degrees" : "Radians"}`);
}

// --- LOGIC: DISPLAY ---
function updateDisplay() {
    let displayExpr = expression
        .replace(/Math./g, '')
        .replace(/\*/g, '×').replace(/\//g, '÷')
        .replace(/PI/g, 'π').replace(/sqrt/g, '√');
    resultEl.innerText = displayExpr || "0";
    
    // Auto-scale font size
    const len = resultEl.innerText.length;
    if (len > 18) resultEl.style.fontSize = "22px";
    else if (len > 12) resultEl.style.fontSize = "30px";
    else resultEl.style.fontSize = "36px";
}

// --- LOGIC: INPUT HANDLING (Strict Fix for ++++) ---
function appendNum(val) {
    playSound();
    if (navigator.vibrate) navigator.vibrate(20);
    expression += val;
    updateDisplay();
}

function appendOp(op) {
    playSound();
    if (navigator.vibrate) navigator.vibrate(20);
    
    const ops = ['+', '-', '*', '/', '%', '^'];
    // Allow negative numbers at start
    if (expression === "" && op !== '-') return;
    
    let lastChar = expression.slice(-1);
    
    // STRICT CHECK: If last char is operator, REPLACE it.
    if (ops.includes(lastChar)) {
        expression = expression.slice(0, -1) + op;
    } else {
        expression += op;
    }
    updateDisplay();
}

function appendFunc(func) {
    playSound();
    // Implicit Multiplication
    const lastChar = expression.slice(-1);
    if ((!isNaN(lastChar) && lastChar !== '') || lastChar === ')') {
        expression += '*';
    }
    expression += func;
    updateDisplay();
}

function append(val) { expression += val; updateDisplay(); }

function toggleSign() {
    playSound();
    if(expression === "") return;
    if(expression.startsWith('-')) expression = expression.substring(1);
    else expression = '-' + expression;
    updateDisplay();
}

function useAns() {
    const last = localStorage.getItem('lastResult');
    if(last) appendNum(last);
}

function clearCalc() { playSound(); expression = ""; historyEl.innerText = ""; updateDisplay(); }

function del() { 
    playSound();
    if(expression.length > 0) expression = expression.slice(0, -1);
    updateDisplay();
}

// --- MATH ENGINE ---
function calculate() {
    playSound();
    if(expression === "") return;
    try {
        historyEl.innerText = expression + " =";
        
        let evalStr = expression
            .replace(/×/g, '*')
            .replace(/÷/g, '/')
            .replace(/π/g, 'Math.PI')
            .replace(/e/g, 'Math.E')
            .replace(/sin\(/g, isDegree ? 'dSin(' : 'Math.sin(')
            .replace(/cos\(/g, isDegree ? 'dCos(' : 'Math.cos(')
            .replace(/tan\(/g, isDegree ? 'dTan(' : 'Math.tan(')
            .replace(/asin\(/g, isDegree ? 'dAsin(' : 'Math.asin(')
            .replace(/acos\(/g, isDegree ? 'dAcos(' : 'Math.acos(')
            .replace(/atan\(/g, isDegree ? 'dAtan(' : 'Math.atan(')
            .replace(/ln\(/g, 'Math.log(')
            .replace(/log\(/g, 'Math.log10(')
            .replace(/sqrt\(/g, 'Math.sqrt(')
            .replace(/cbrt\(/g, 'Math.cbrt(')
            .replace(/exp\(/g, 'Math.exp(')
            .replace(/pow10\(/g, '10**')
            .replace(/\^/g, '**')
            .replace(/(\d+)!/g, 'factorial($1)');

        if(evalStr.includes("integral")) evalStr = evalStr.replace(/integral\(([^,]+),([^,]+),([^)]+)\)/g, "numericalIntegrate('$1', $2, $3)");
        if(evalStr.includes("deriv")) evalStr = evalStr.replace(/deriv\(([^,]+),([^)]+)\)/g, "numericalDerivative('$1', $2)");

        let res = eval(evalStr);
        if (!isFinite(res) || isNaN(res)) throw new Error("Math Error");
        
        if(Math.abs(res) < 1e-10 && res !== 0) res = 0;
        res = parseFloat(res.toFixed(10));
        
        resultEl.innerText = res;
        expression = res.toString();
        localStorage.setItem('lastResult', expression);
        
    } catch (err) {
        resultEl.innerText = "Error";
        showToast("Syntax Error");
    }
}

// --- HELPER MATH FUNCTIONS ---
function dSin(x) { return Math.sin(x * Math.PI / 180); }
function dCos(x) { return Math.cos(x * Math.PI / 180); }
function dTan(x) { return Math.tan(x * Math.PI / 180); }
function dAsin(x) { return Math.asin(x) * 180 / Math.PI; }
function dAcos(x) { return Math.acos(x) * 180 / Math.PI; }
function dAtan(x) { return Math.atan(x) * 180 / Math.PI; }

function factorial(n) {
    if (n < 0) return NaN;
    if (n === 0 || n === 1) return 1;
    let r = 1; for(let i=2; i<=n; i++) r *= i;
    return r;
}
function rand() { return Math.random(); }

// --- CALCULUS ---
function numericalIntegrate(funcStr, a, b) {
    const f = (x) => { let subExpr = funcStr.replace(/x/g, `(${x})`).replace(/\^/g, '**'); return eval(subExpr); };
    const n = 100; const h = (b - a) / n; let sum = f(a) + f(b);
    for(let i = 1; i < n; i++) sum += (i % 2 === 0 ? 2 : 4) * f(a + i * h);
    return (h / 3) * sum;
}
function numericalDerivative(funcStr, val) {
    const h = 0.0001;
    const f = (x) => { let subExpr = funcStr.replace(/x/g, `(${x})`).replace(/\^/g, '**'); return eval(subExpr); };
    return (f(val + h) - f(val - h)) / (2 * h);
}

// --- MEMORY ---
function memAdd() { try { memory += parseFloat(resultEl.innerText || 0); showToast("Added to Memory"); } catch(e){} }
function memSub() { try { memory -= parseFloat(resultEl.innerText || 0); showToast("Subtracted from Memory"); } catch(e){} }
function memRecall() { appendNum(memory.toString()); showToast("Memory Recalled"); }

// --- KEYBOARD SUPPORT ---
document.addEventListener('keydown', function(event) {
    const key = event.key;
    if ((key >= '0' && key <= '9') || key === '.') appendNum(key);
    else if (key === '+') appendOp('+'); 
    else if (key === '-') appendOp('-'); 
    else if (key === '*') appendOp('*');
    else if (key === '/') { event.preventDefault(); appendOp('/'); } 
    else if (key === '%') appendOp('%');
    else if (key === '^') appendOp('^');
    else if (key === 'Enter' || key === '=') calculate(); 
    else if (key === 'Backspace') del(); 
    else if (key === 'Escape') clearCalc();
});

// --- NAV ---
function openSidebar() { sidebar.classList.add('open'); overlay.classList.add('active'); }
function closeAll() { sidebar.classList.remove('open'); overlay.classList.remove('active'); document.querySelectorAll('.modal').forEach(m => m.classList.remove('active')); }
function showToast(msg) { const toast = document.getElementById('toast'); toast.innerText = msg; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 3000); }
function handleNav(action) {
    if (action === 'home') { closeAll(); switchTab('basic'); clearCalc(); window.scrollTo(0,0); } 
    else if (action === 'sci') { closeAll(); switchTab('sci'); window.scrollTo(0,0); }
    else if (action === 'settings') { closeAll(); setTimeout(() => { document.getElementById('modal-settings').classList.add('active'); overlay.classList.add('active'); }, 300); }
    else if (action === 'signin') { closeAll(); setTimeout(() => { document.getElementById('modal-signin').classList.add('active'); overlay.classList.add('active'); }, 300); }
}
function switchTab(mode) {
    const basicKeys = document.getElementById('basic-keys'); const sciKeys = document.getElementById('sci-keys');
    const tabBasic = document.getElementById('tab-basic'); const tabSci = document.getElementById('tab-sci');
    if (mode === 'basic') { basicKeys.classList.add('active'); sciKeys.classList.remove('active'); tabBasic.classList.add('active'); tabSci.classList.remove('active'); }
    else { basicKeys.classList.remove('active'); sciKeys.classList.add('active'); tabBasic.classList.remove('active'); tabSci.classList.remove('active'); }
}
