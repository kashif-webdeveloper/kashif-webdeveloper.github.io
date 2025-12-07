/**
 * KASHIF PRO CALCULATOR - ULTIMATE QUANTUM ENGINE v15.0
 * - Architecture: AST Parser + Recursion Guard + Hybrid Math
 * - Features: Smart DEL, Input Lock, Auto-Scientific BigInt
 * - Safety: Anti-Freeze Protection for Calculus
 */

const Config = {
    maxDigits: 100,
    maxIter: 20000, 
    precision: 16, // Upgraded to 16-digit standard
    sound: true, 
    vib: true 
};

const State = { 
    input: "0", 
    memory: 0, 
    angleMode: "deg", 
    newInput: true, 
    vars: {} 
};

const UI = {
    res: document.getElementById('result'),
    hist: document.getElementById('history'),
    toast: document.getElementById('toast'),
    sidebar: document.getElementById('sidebar'),
    overlay: document.getElementById('overlay'),
    snd: document.getElementById('sound-toggle'),
    thm: document.getElementById('theme-toggle')
};

// ================= INIT =================
window.onload = () => {
    if (localStorage.getItem('theme') === 'light') {
        document.body.classList.add('light-mode');
        if (UI.thm) UI.thm.checked = true;
    }
    const m = localStorage.getItem('mem'); if (m) State.memory = parseFloat(m);
    
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').catch(() => {});
    }

    const p = new URLSearchParams(window.location.search);
    if (p.get('mode') === 'sci') handleNav('sci');
    render();
};

// ================= TOKENIZER =================
function tokenize(str) {
    const tokens = [];
    let i = 0;
    while (i < str.length) {
        let char = str[i];
        if (/\s/.test(char)) { i++; continue; }

        if (/[0-9.]/.test(char)) {
            let num = char; i++;
            while (i < str.length && /[0-9.]/.test(str[i])) num += str[i++];
            if (i < str.length && (str[i] === 'e' || str[i] === 'E')) {
                const next = str[i + 1];
                // Check for scientific notation 1.2e+5 or 1e-5
                if (next && (/[0-9]/.test(next) || ((next === '+' || next === '-') && /[0-9]/.test(str[i + 2])))) {
                    num += str[i++];
                    if (str[i] === '+' || str[i] === '-') num += str[i++];
                    while (i < str.length && /[0-9]/.test(str[i])) num += str[i++];
                }
            }
            tokens.push({ type: 'NUM', val: num });
            continue;
        }

        if (/[a-zA-Z_]/.test(char)) {
            let id = char; i++;
            while (i < str.length && /[a-zA-Z0-9_]/.test(str[i])) id += str[i++];
            tokens.push({ type: 'ID', val: id });
            continue;
        }

        if (/[+\-*/%^(),=]/.test(char)) {
            tokens.push({ type: 'OP', val: char });
            i++;
            continue;
        }
        throw new Error(`Invalid char: ${char}`);
    }
    return tokens;
}

// ================= PARSER =================
class Parser {
    constructor(tokens) { this.tokens = tokens; this.pos = 0; }
    peek() { return this.tokens[this.pos]; }
    consume() { return this.tokens[this.pos++]; }
    parse() {
        const res = this.parseExpression();
        if (this.pos < this.tokens.length) throw new Error("Unexpected token");
        return res;
    }
    parseExpression() { return this.parseAssign(); }
    
    parseAssign() {
        let node = this.parseAddSub();
        if (this.peek() && this.peek().val === '=') {
            this.consume();
            const right = this.parseExpression();
            node = { type: 'ASSIGN', left: node, right };
        }
        return node;
    }
    
    parseAddSub() {
        let left = this.parseTerm();
        while (this.peek() && (this.peek().val === '+' || this.peek().val === '-')) {
            const op = this.consume().val;
            const right = this.parseTerm();
            left = { type: 'BINARY', op, left, right };
        }
        return left;
    }
    
    parseTerm() {
        let left = this.parseFactor();
        while (true) {
            const t = this.peek();
            if (!t) break;
            if (['*', '/', '%', '^'].includes(t.val)) {
                const op = this.consume().val;
                const right = this.parseFactor();
                left = { type: 'BINARY', op, left, right };
            }
            // QUANTUM IMPLICIT MULTIPLICATION
            // Auto-insert * for cases like: 2x, 2sin(x), (2)(3)
            else if (t.type === 'NUM' || (t.type === 'ID' && !MathLib[t.val] && t.val !== 'x') || t.val === '(') {
                const right = this.parseFactor();
                left = { type: 'BINARY', op: '*', left, right };
            } else break;
        }
        return left;
    }
    
    parseFactor() {
        if (this.peek() && (this.peek().val === '-' || this.peek().val === '+')) {
            const op = this.consume().val;
            const expr = this.parseFactor();
            return { type: 'UNARY', op, expr };
        }
        return this.parsePower();
    }
    
    parsePower() {
        let left = this.parseAtom();
        if (this.peek() && this.peek().val === '^') {
            this.consume();
            const right = this.parseFactor();
            left = { type: 'BINARY', op: '^', left, right };
        }
        return left;
    }
    
    parseAtom() {
        const t = this.consume();
        if (!t) throw new Error("Incomplete");
        if (t.type === 'NUM') return { type: 'NUM', val: t.val };
        if (t.type === 'ID') {
            // Function Call
            if (MathLib[t.val] || t.val === 'integral' || t.val === 'deriv') {
                const funcName = t.val;
                const args = [];
                // Check for parens: sin(x)
                if (this.peek() && this.peek().val === '(') {
                    this.consume();
                    if (this.peek().val !== ')') {
                        while (true) {
                            args.push(this.parseExpression());
                            if (this.peek() && this.peek().val === ',') this.consume();
                            else break;
                        }
                    }
                    if (!this.peek() || this.peek().val !== ')') throw new Error("Missing )");
                    this.consume();
                } 
                // Command syntax: sin x
                else { 
                    args.push(this.parseFactor()); 
                }
                return { type: 'CALL', func: funcName, args };
            }
            return { type: 'VAR', name: t.val };
        }
        if (t.val === '(') {
            const expr = this.parseExpression();
            if (!this.peek() || this.peek().val !== ')') throw new Error("Missing )");
            this.consume();
            return expr;
        }
        throw new Error(`Syntax Error: ${t.val}`);
    }
}

// ================= MATH LIBRARY =================
const MathLib = {
    sin: x => State.angleMode === 'deg' ? Math.sin(x * Math.PI / 180) : Math.sin(x),
    cos: x => State.angleMode === 'deg' ? Math.cos(x * Math.PI / 180) : Math.cos(x),
    tan: x => State.angleMode === 'deg' ? Math.tan(x * Math.PI / 180) : Math.tan(x),
    ln: Math.log, log: Math.log10, sqrt: Math.sqrt, abs: Math.abs,
    exp: Math.exp, floor: Math.floor, ceil: Math.ceil,
    integral: (f, a, b, s) => adaptiveSimpson(f, a, b, s),
    deriv: (f, x, s) => fivePointStencil(f, x, s),
    fact: n => {
        if (n > 5000) throw new Error("Limit > 5000!");
        if (n < 0) throw new Error("Neg Factorial");
        let r = 1n; for (let i = 2n; i <= BigInt(n); i++) r *= i; return r;
    }
};

// ================= EVALUATOR =================
function evalAST(node, scope = {}) {
    if (node.type === 'NUM') return node.val.includes('.') || node.val.includes('e') ? parseFloat(node.val) : BigInt(node.val);
    if (node.type === 'VAR') {
        if (scope[node.name] !== undefined) return scope[node.name];
        if (node.name === 'PI') return Math.PI;
        if (node.name === 'E') return Math.E;
        if (node.name === 'x') return 0;
        throw new Error(`Unknown: ${node.name}`);
    }
    if (node.type === 'UNARY') {
        const val = evalAST(node.expr, scope);
        return node.op === '-' ? -val : val;
    }
    if (node.type === 'BINARY') {
        let l = evalAST(node.left, scope);
        let r = evalAST(node.right, scope);
        const bothBig = typeof l === 'bigint' && typeof r === 'bigint';
        
        if (bothBig) {
            if (node.op === '+') return l + r;
            if (node.op === '-') return l - r;
            if (node.op === '*') return l * r;
            if (node.op === '^') return r < 0n ? Number(l) ** Number(r) : l ** r;
            if (node.op === '%') return l % r;
        }
        
        l = Number(l); r = Number(r);
        switch (node.op) {
            case '+': return l + r;
            case '-': return l - r;
            case '*': return l * r;
            case '/': if (r === 0) throw new Error("Div by 0"); return l / r;
            case '%': return l % r;
            case '^': return Math.pow(l, r);
        }
    }
    if (node.type === 'CALL') {
        if (node.func === 'integral') {
            const a = evalAST(node.args[1], scope), b = evalAST(node.args[2], scope);
            return MathLib.integral(node.args[0], Number(a), Number(b), scope);
        }
        if (node.func === 'deriv') {
            const x = evalAST(node.args[1], scope);
            return MathLib.deriv(node.args[0], Number(x), scope);
        }
        const args = node.args.map(a => Number(evalAST(a, scope)));
        return MathLib[node.func](...args);
    }
    if (node.type === 'ASSIGN') {
        const val = evalAST(node.right, scope);
        scope[node.left.name] = val;
        return val;
    }
}

// ================= SAFETY KERNELS =================
function adaptiveSimpson(node, a, b, scope) {
    let depth = 0;
    const maxDepth = 20; // Recursion Guard
    const f = v => { 
        scope.x = v; return Number(evalAST(node, scope)); 
    };
    
    function recursive(a, b, eps, whole) {
        depth++;
        if(depth > maxDepth) return whole; // Emergency exit
        
        const c = (a + b) / 2;
        const left = (c - a) / 6 * (f(a) + 4 * f((a + c) / 2) + f(c));
        const right = (b - c) / 6 * (f(c) + 4 * f((c + b) / 2) + f(b));
        
        if (Math.abs(left + right - whole) <= 15 * eps) {
            depth--;
            return left + right + (left + right - whole) / 15;
        }
        const res = recursive(a, c, eps / 2, left) + recursive(c, b, eps / 2, right);
        depth--;
        return res;
    }
    
    // Initial Simpson
    const n = 10; 
    const h = (b-a)/n;
    let s = f(a) + f(b);
    for(let i=1; i<n; i++) s += (i%2===0?2:4)*f(a+i*h);
    const initial = (h/3)*s;
    
    return recursive(a, b, 1e-6, initial);
}

function fivePointStencil(node, x, scope) {
    const h = 0.001; 
    const f = v => { scope.x = v; return Number(evalAST(node, scope)); };
    return (-f(x + 2 * h) + 8 * f(x + h) - 8 * f(x - h) + f(x - 2 * h)) / (12 * h);
}

// ================= MAIN CONTROLLER =================
function calculate() {
    playFeedback();
    try {
        let expr = State.input.replace(/×/g, '*').replace(/÷/g, '/');
        // Auto-close parens
        const open = (expr.match(/\(/g) || []).length;
        const close = (expr.match(/\)/g) || []).length;
        if (open > close) expr += ')'.repeat(open - close);

        const tokens = tokenize(expr);
        const parser = new Parser(tokens);
        const ast = parser.parse();
        const res = evalAST(ast, State.vars);

        if (res === undefined || (typeof res === 'number' && isNaN(res))) throw new Error("NaN");

        let out = res.toString();
        // Precision Formatting (16 Digits)
        if (typeof res !== 'bigint') {
            if (Math.abs(res) < 1e15 && Math.abs(res) > 1e-9) {
                out = parseFloat(res.toPrecision(16)).toString();
            }
        }

        State.input = out;
        State.newInput = true;
        localStorage.setItem('last_result', out);
        UI.hist.innerText = expr + " =";
        render();
    } catch (e) {
        State.input = "Error"; 
        State.newInput = true; 
        render();
    }
}

// ================= RENDER LOGIC =================
function render() {
    let d = State.input;
    if (d.includes('Error')) { UI.res.innerText = d; return; }

    // BigInt & Massive Number Handling
    if (d.length > 12 && !d.includes('e')) {
        if (!d.includes('.')) {
            // Integer: Manually format to avoid Infinity
            const exp = d.length - 1;
            d = d[0] + '.' + d.slice(1, 6) + 'e+' + exp;
        } else {
            // Float: Standard scientific
            d = parseFloat(d).toExponential(5);
        }
    } else if (!d.includes('e')) {
        let p = d.split('.');
        p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        d = p.join('.');
    }

    UI.res.innerText = d;
    UI.res.style.fontSize = d.length > 16 ? "22px" : d.length > 11 ? "30px" : "36px";
}

// ================= INPUT HANDLERS =================
function appendNum(n) {
    playFeedback();
    if (State.newInput) { State.input = n === "." ? "0." : n; State.newInput = false; }
    else {
        // Dot check
        const parts = State.input.split(/[\+\-\*\/\^%]/);
        if (n === "." && parts[parts.length - 1].includes(".")) return;
        if (State.input.length >= Config.maxDigits) return;
        State.input = State.input === "0" && n !== '.' ? n : State.input + n;
    }
    render();
}

function appendOp(op) {
    playFeedback();
    if (op === '%') { State.input = (parseFloat(State.input) / 100).toString(); State.newInput = true; render(); return; }
    
    // Operator Replacement logic
    if (State.input === "Error") State.input = "0";
    const match = State.input.match(/([+\-*/%^]+)$/);
    if (match && !State.newInput) { 
        const ops = match[0];
        if (op === '-' && ops.slice(-1) !== '-') State.input += op;
        else State.input = State.input.slice(0, -ops.length) + op;
    } else {
        State.input += op;
    }
    State.newInput = false;
    render();
}

function appendFunc(f) {
    playFeedback();
    const last = State.input.slice(-1);
    // Implicit Mult for function calls
    if (State.input !== "0" && !State.newInput && /[0-9.)x]/.test(last)) State.input += "*";
    State.input += f; State.newInput = false; render();
}

function del() {
    playFeedback();
    // Smart Unlock
    if (State.newInput) State.newInput = false; 
    
    if (State.input.length > 1) State.input = State.input.slice(0, -1);
    else State.input = "0";
    render();
}

function clearCalc() { playFeedback(); State.input = "0"; UI.hist.innerText = ""; State.newInput = true; render(); }
function memAdd() { State.memory += parseFloat(State.input); localStorage.setItem('mem', State.memory); toast("M+"); }
function memSub() { State.memory -= parseFloat(State.input); localStorage.setItem('mem', State.memory); toast("M-"); }
function memRecall() { State.input = State.memory.toString(); State.newInput = false; render(); }
function toast(m) { UI.toast.innerText = m; UI.toast.classList.add('show'); setTimeout(() => UI.toast.classList.remove('show'), 2000); }
function setAngleMode(m) { State.angleMode = m; toast(m.toUpperCase()); }
function toggleTheme() { document.body.classList.toggle('light-mode'); localStorage.setItem('theme', document.body.classList.contains('light-mode') ? 'light' : 'dark'); }
function saveSoundPref() { Config.sound = UI.snd.checked; localStorage.setItem('sound', Config.sound ? 'on' : 'off'); }

let actx;
function playFeedback() {
    if (Config.vib && navigator.vibrate) navigator.vibrate(10);
    if (Config.sound) {
        if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
        if (actx.state === 'suspended') actx.resume();
        const o = actx.createOscillator(), g = actx.createGain();
        o.type = 'sine'; o.frequency.setValueAtTime(600, actx.currentTime); o.frequency.exponentialRampToValueAtTime(100, actx.currentTime + 0.05);
        g.gain.setValueAtTime(0.05, actx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + 0.05);
        o.connect(g); g.connect(actx.destination); o.start(); o.stop(actx.currentTime + 0.05);
    }
}

// ================= NAV =================
function openSidebar() { UI.sidebar.classList.add('open'); UI.overlay.classList.add('active'); }
function closeAll() { UI.sidebar.classList.remove('open'); UI.overlay.classList.remove('active'); document.querySelectorAll('.modal').forEach(m => m.classList.remove('active')); }
function handleNav(a) {
    closeAll();
    if (a === 'home') { switchTab('basic'); window.scrollTo(0, 0); }
    else if (a === 'sci') { switchTab('sci'); window.scrollTo(0, 0); }
    else if (a === 'settings') { setTimeout(() => { document.getElementById('modal-settings').classList.add('active'); UI.overlay.classList.add('active'); }, 200); }
    else if (a === 'signin') { setTimeout(() => { document.getElementById('modal-signin').classList.add('active'); UI.overlay.classList.add('active'); }, 200); }
}
function switchTab(m) {
    const bk = document.getElementById('basic-keys'), sk = document.getElementById('sci-keys'), tb = document.getElementById('tab-basic'), ts = document.getElementById('tab-sci');
    if (m === 'basic') { bk.classList.add('active'); sk.classList.remove('active'); tb.classList.add('active'); ts.classList.remove('active'); }
    else { bk.classList.remove('active'); sk.classList.add('active'); tb.classList.remove('active'); ts.classList.add('active'); }
}
