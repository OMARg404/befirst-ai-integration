// تلوين ذكي لردود المدرسين — طبقة على الـ DOM *بعد* formatMessage (المنقول حرفيًا من المنصة ومش بنعدّل فيه).
//
// بيفهم *شكل* الكلام بدل قوايم حالات:
//  1) أي كلام لاتيني/أرقام/رموز وسط العربي = حتة واحدة ("0.6 M/s"، "98 g/mol"، "0.5 × (6/5) = 0.6"،
//     "2H2 + O2 → 2H2O"، "VSEPR"). مابتتقسمش، وبتتعرض من الشمال لليمين صح جوه العربي.
//  2) الحتة دي بتتصنّف بشكلها: معادلة (سهم + صيغ) / صيغة أو توزيع إلكتروني (جدول العناصر) / رقم أو كمية أو
//     عملية حسابية (بتبدأ برقم أو فيها =) / حرف اختيار (A) / مصطلح إنجليزي.
//  3) العربي بيتفهم من تركيبه: عنوان صغير قبل ":" في أول السطر ("الخلاصة:"، "السبب:"، "س٦:")، حرف بين قوسين
//     (ب)، «مصطلح»، تاريخ بالشهر، و✅/❌.
// المعلومات الثابتة الوحيدة: جدول العناصر وأسماء الشهور — حقائق، مش حالات بنزوّدها بإيدينا.
//
// أمان: بيشتغل على text nodes بس وبيبني العناصر بـ createElement/textContent — مفيش innerHTML.
(() => {
  const ELEMENTS = new Set(("H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr " +
    "Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt " +
    "Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu").split(" "));
  // رمز عنصر لوحده بيتلوّن لو بحرفين (Zn، Cu) — إلا اللي هو كلمة إنجليزي عادية
  const WORDLIKE = new Set(["In", "As", "Be", "He", "At", "No", "Am", "Pa", "Ho", "Es", "Po"]);
  const SUB = { 0: "₀", 1: "₁", 2: "₂", 3: "₃", 4: "₄", 5: "₅", 6: "₆", 7: "₇", 8: "₈", 9: "₉" };
  const SUP = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹", "-": "⁻", "−": "⁻", "+": "⁺" };
  const NORMAL = { "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9", "⁺": "+", "⁻": "−" };
  const AR_MONTHS = "يناير|فبراير|مارس|أبريل|ابريل|مايو|يونيو|يوليو|أغسطس|اغسطس|سبتمبر|أكتوبر|اكتوبر|نوفمبر|ديسمبر";

  // ───── 1) الحتت اللاتينية (LTR) ─────
  const L = "A-Za-z0-9°%\\u0370-\\u03FF₀-₉⁰-⁹¹²³⁺⁻";              // حروف/أرقام/يوناني (Δ)/أرقام صغيرة
  const J = "+\\-−×÷·∙/^()\\[\\]=<>≈≤≥→⟶⇌⇄'’";                     // روابط جوه الحتة الواحدة
  // النقطة/الفاصلة جوه الحتة بس لو بعدها حرف أو رقم على طول (0.6، mol.L) — ". In" نهاية جملة
  const RUN = new RegExp(`[(\\[+\\-−]?[${L}](?:[${L}${J}]|[.,](?=[${L}])|\\s(?=[${L}(\\[+\\-−→⟶⇌⇄×÷=≈<>]))*`, "g");
  const ARROWS = /[→⟶⇌⇄]/;

  const CHARGE = /(?:\^?(?:[0-9]*[+\-−]|[+\-−][0-9]+)|[⁺⁻⁰¹²³⁴-⁹]+)$/;
  const STATE = /\((?:aq|s|l|g)\)$/;                                 // NaCl(aq)
  function formulaParts(tok) {
    const m = tok.match(/^(\d{0,2})(.*)$/);                          // المعامل في الأول (6H2O)
    let body = m[2], state = "", charge = "";
    const st = body.match(STATE); if (st) { state = st[0]; body = body.slice(0, -state.length); }
    const ch = body.match(CHARGE);
    // شحنة: بعد حرف أو قوس (Cu2+، Na+)، أو مكتوبة بـ ^ أو superscript حتى بعد رقم (SO4^-2، SO₄²⁻)
    // شحنة بأي شكل بيكتبه الطلاب والـ AI: Cu2+ / Na+ / SO4^-2 / SO4-2 / SO₄²⁻ (الصيغة نفسها بتتفحص بعدها)
    if (ch && /^[A-Z(\[]/.test(body.slice(0, -ch[0].length))) { charge = ch[0]; body = body.slice(0, -charge.length); }
    return { coef: m[1], body, charge, state };
  }
  function isFormula(tok) {
    const { body, charge } = formulaParts(tok);
    if (!/^[A-Z(\[]/.test(body)) return false;
    if (/^[IVXL]+$/.test(body)) return false;                       // أرقام لاتيني (حالة التأكسد III)
    const letters = body.replace(/[()\[\]\d]/g, "");
    const symbols = letters.match(/[A-Z][a-z]?/g);
    if (!symbols || symbols.join("") !== letters || !symbols.every((s) => ELEMENTS.has(s))) return false;
    // حرفين كابيتال من غير أرقام: جزيئات معروفة بس ("CO"/"NO" أه، "OK"/"CV" لأ)
    if (letters.length === 2 && !/\d/.test(body) && !charge && letters === letters.toUpperCase()) return /^(CO|NO|CN|OH|HF|HI|KI|KF|BN|SiC)$/.test(letters);
    if (!/\d/.test(body) && !charge && new Set(symbols).size < symbols.length) return false; // نفس العنصر مكرر من غير أرقام
    if (symbols.length === 1 && !/\d/.test(body) && !charge) return symbols[0].length === 2 && !WORDLIKE.has(symbols[0]);
    return true;
  }
  const isOrbital = (p) => /^[1-7][spdf]\d{0,2}$/.test(p);           // 3d10 / 4s2
  const isCore = (p) => /^\[[A-Z][a-z]?\]$/.test(p);                 // [Ar]

  const unwrap = (p) => p.replace(/^\((.+)\)$/, "$1");               // (Cr2+) → Cr2+
  const anyFormula = (p) => isFormula(p) || isFormula(unwrap(p));
  function classify(run, ctx) {
    const pieces = run.split(/\s+/).filter(Boolean);
    const chemish = (p) => anyFormula(p) || isOrbital(p) || isCore(p);
    if (ARROWS.test(run) && pieces.some(anyFormula)) return "eq";
    if (pieces.some(chemish) && pieces.every((p) => chemish(p) || /^[+\-−=]$/.test(p))) return "chem";
    if (/^\(?[A-E]\)$/.test(run)) return "opt";                      // (A)..(E) اختيارات — (s)/(p)/(O) لأ
    // سنة أو فترة من سنين (1863 - 1879) — للتاريخ، أو لو قبلها "سنة/عام" أو بعدها م/هـ
    const years = run.match(/\d+/g) || [];
    if (/^\d{4}(\s?[-–−]\s?\d{4})?$/.test(run) && years.every((y) => +y >= 1000 && +y <= 2099) &&
        (ctx.subject === "history" || /^\s?(م|هـ)/.test(ctx.after) || /(سنة|عام)\s*$/.test(ctx.before))) return "date";
    if (/^\d{1,3}$/.test(run) && ctx.listMarker) return "plain";      // ترقيم قايمة (1. / 2))
    if (/^[+\-−(]?[0-9]/.test(run) || (/\d/.test(run) && /[=×÷≈]/.test(run))) return "num";
    return "en";
  }

  // ───── رسم الحتت ─────
  const ltr = (cls) => { const e = document.createElement("bdi"); e.dir = "ltr"; e.className = cls; return e; };
  const txt = (t) => document.createTextNode(t);
  const supText = (t) => t.replace(/[⁰¹²³⁴-⁹⁺⁻]/g, (x) => NORMAL[x]).replace("^", "").replace("-", "−");
  function appendFormula(parent, tok) {
    const { coef, body, charge, state } = formulaParts(tok);
    if (coef) parent.appendChild(txt(coef));
    parent.appendChild(txt(body.replace(/(?<=[A-Za-z)\]])(\d+)/g, (d) => d.split("").map((c) => SUB[c]).join(""))));
    if (charge) {
      // الشحنة بالشكل المعتاد في الكتب: الرقم الأول وبعده الإشارة (SO₄²⁻)
      const c = supText(charge), sup = document.createElement("sup");
      sup.textContent = /^[+−]\d/.test(c) ? c.slice(1) + c[0] : c;
      parent.appendChild(sup);
    }
    if (state) { const s = document.createElement("small"); s.textContent = state; parent.appendChild(s); }
  }
  function renderRun(run, kind) {
    if (kind === "opt") { const s = document.createElement("span"); s.className = "hl-opt"; s.textContent = run; return s; }
    if (kind === "eq" || kind === "chem") {
      const el = ltr("hl-chem");
      run.split(/(\s+|[→⟶⇌⇄])/).forEach((p) => {
        if (!p) return;
        if (ARROWS.test(p)) { const a = document.createElement("span"); a.className = "hl-arrow"; a.textContent = p; el.appendChild(a); }
        else if (isOrbital(p)) el.appendChild(txt(p.slice(0, 2) + p.slice(2).split("").map((c) => SUP[c]).join("")));
        else if (isFormula(p)) appendFormula(el, p);
        else if (isFormula(unwrap(p))) { el.appendChild(txt("(")); appendFormula(el, unwrap(p)); el.appendChild(txt(")")); }
        else el.appendChild(txt(p));
      });
      return el;
    }
    if (kind === "plain") return txt(run);
    const el = ltr(kind === "num" ? "hl-num" : kind === "date" ? "hl-date" : "hl-en");
    // أُسس مكتوبة بـ ^ (10^-3، s^-1، m/s^2) تتعرض superscript، وأي صيغة جوه الحتة (B = FeSO4) بتتنسّق
    const shown = run.replace(/\^\(?([+\-−]?\d+)\)?/g, (_, e) => e.split("").map((c) => SUP[c] || c).join(""));
    shown.split(/(\s+)/).forEach((p) => {
      const inner = unwrap(p);
      if (p.trim() && anyFormula(p) && /\d|[a-z]/.test(inner)) {
        const c = document.createElement("span"); c.className = "hl-chem";
        if (inner !== p) c.appendChild(txt("(")); appendFormula(c, inner); if (inner !== p) c.appendChild(txt(")"));
        el.appendChild(c);
      } else el.appendChild(txt(p));
    });
    return el;
  }

  // ───── 3) العربي بتركيبه ─────
  const ARABIC = new RegExp([
    `(?<ok>✅[^\\n.؛،,❌]*)`,
    `(?<bad>❌[^\\n.؛،,✅]*)`,
    `(?<term>«[^»\\n]{1,60}»)`,
    `(?<opt>\\([\\u0621-\\u064A]\\))`,
    `(?<arnum>[٠-٩]+(?:[.,٫][٠-٩]+)?)`,
  ].join("|"), "g");
  const DATE = new RegExp(`[0-9٠-٩]{1,2}\\s+(?:${AR_MONTHS})(?:\\s+[0-9٠-٩]{3,4}(?:\\s?(?:م|هـ)(?![\\u0621-\\u064A]))?)?`, "g");
  // عنوان صغير قبل ":" في أول السطر — "الخلاصة:"، "السبب:"، "في سيناء:"، "س٦:"
  const LABEL = /^(\s*[•\-–*]?\s*)([؀-ۿ][؀-ۿ0-9٠-٩ ()]{0,28}?)\s?:/;
  const BLOCK = "p, li, blockquote, td, th, h1, h2, h3, .custom-message-content";
  function atBlockStart(node) {
    const block = node.parentElement.closest(BLOCK);
    if (!block) return false;
    const r = document.createRange();
    r.setStart(block, 0); r.setEnd(node, 0);
    return /^[\s•\-–*]*$/.test(r.toString());
  }

  const SKIP = "code, pre, a, sub, sup, small, svg, bdi, .chat-html-frame, .chat-image-actions-wrap, .chat-inline-math, [class^='hl-'], [class*=' hl-']";

  function span(cls, t) { const s = document.createElement("span"); s.className = cls; s.textContent = t; return s; }

  function highlightNode(node, subject) {
    const text = node.nodeValue;
    const frag = document.createDocumentFragment();
    let changed = false, pos = 0;

    // عنوان قبل ":" في أول السطر
    const blockStart = atBlockStart(node);
    if (blockStart) {
      const lm = text.match(LABEL);
      // عنوان = 4 كلمات بالكتير ومن غير فاصلة ("الخلاصة:"، "نتائج سياسية:")، مش جملة كلام عادية قبل ":"
      if (lm && !/^\s*$/.test(lm[2]) && !/[،,]/.test(lm[2]) && lm[2].trim().split(/\s+/).length <= 4) {
        frag.appendChild(txt(lm[1]));
        frag.appendChild(span("hl-cue", lm[2] + ":"));
        pos = lm[0].length; changed = true;
      }
    }

    let segStart = 0;
    const pushArabic = (seg, from) => {
      segStart = from;
      ARABIC.lastIndex = 0; let m, last = 0;
      while ((m = ARABIC.exec(seg))) {
        const g = m.groups;
        if (g.arnum !== undefined && blockStart && /^[\s•\-–*]*$/.test(text.slice(0, segStart + m.index)) && /^[.)\-–]/.test(seg.slice(m.index + m[0].length))) continue; // ١. ترقيم
        const cls = g.ok ? "hl-ok" : g.bad ? "hl-bad" : g.term ? "hl-term" : g.opt ? "hl-opt" : "hl-num";
        if (m.index > last) frag.appendChild(txt(seg.slice(last, m.index)));
        frag.appendChild(span(cls, m[0])); last = m.index + m[0].length; changed = true;
      }
      if (last < seg.length) frag.appendChild(txt(seg.slice(last)));
    };

    // التواريخ بالشهر (28 فبراير 1922) حتة واحدة — بتتلقط قبل الأرقام عشان ماتتقسمش
    const dates = [];
    DATE.lastIndex = 0; let dm;
    while ((dm = DATE.exec(text))) if (dm.index >= pos) dates.push([dm.index, dm.index + dm[0].length]);
    const dateAt = (i) => dates.find(([a, b]) => i >= a && i < b);

    RUN.lastIndex = pos;
    let m;
    while ((m = RUN.exec(text))) {
      const d = dateAt(m.index);
      if (d) {
        if (d[0] > pos) pushArabic(text.slice(pos, d[0]), pos);
        frag.appendChild(span("hl-date", text.slice(d[0], d[1])));
        pos = d[1]; RUN.lastIndex = pos; changed = true; continue;
      }
      let run = m[0], start = m.index;
      // الحتة مابتاخدش علامة الترقيم اللي في آخر الجملة ولا قوس مش مقفول
      run = run.replace(/[\s(\[.,'’:]+$/, "");
      while (run.endsWith(")") && (run.match(/\(/g) || []).length < (run.match(/\)/g) || []).length) run = run.slice(0, -1);
      if (run.startsWith("(") && !run.includes(")")) { run = run.slice(1); start += 1; }
      if (!run || !/[A-Za-z0-9Ͱ-Ͽ]/.test(run)) continue;
      if (start > pos) pushArabic(text.slice(pos, start), pos);
      const after = text.slice(start + run.length, start + run.length + 3);
      const listMarker = /^[.)\-–]/.test(after) && /^[\s•\-–*]*$/.test(text.slice(0, start)) && blockStart;
      const kind = classify(run, { subject, listMarker, before: text.slice(Math.max(0, start - 8), start), after });
      frag.appendChild(renderRun(run, kind));
      pos = start + run.length; RUN.lastIndex = pos; changed = true;
    }
    if (pos < text.length) pushArabic(text.slice(pos), pos);
    if (changed) node.parentNode.replaceChild(frag, node);
  }

  /**
   * @param {Element} root     الـ .custom-message-content بتاع رد المدرس
   * @param {string} subject   تلميح بس ("history" بيخلي أي سنة 1000-2099 تتلوّن تاريخ)
   */
  window.highlightMessage = function (root, subject) {
    if (!root) return;
    try { run(root, subject); } catch (e) { /* تلوين بس — لو فشل الرد يفضل يتعرض عادي */ }
  };
  function run(root, subject) {
    // تلوين الأرقام القديم في formatMessage كان بيقسم "0.6 M/s" — بنفكّه ونفهم الحتة كلها هنا
    root.querySelectorAll(".chat-inline-number").forEach((s) => s.replaceWith(txt(s.textContent)));
    // formatMessage بيحوّل s^2 لـ <sup>2</sup> منفصل — نرجّعه حرف ² عشان يبقى جزء من الوحدة (m/s²)
    root.querySelectorAll("sup").forEach((s) => { if (/^[+\-−]?\d{1,3}$/.test(s.textContent.trim())) s.replaceWith(txt(s.textContent.trim().split("").map((c) => SUP[c] || c).join(""))); });
    root.normalize();
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (!n.nodeValue.trim() || n.parentElement.closest(SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const n of nodes) highlightNode(n, subject);
  }
})();
