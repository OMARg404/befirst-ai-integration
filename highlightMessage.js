// تلوين ذكي لردود المدرسين — طبقة بتشتغل على الـ DOM *بعد* formatMessage (اللي منقول حرفيًا من المنصة
// ومش بنعدّل فيه). بتلوّن بالمعنى حسب المادة: صيغ كيميائية، أرقام بوحداتها، سنين وتواريخ، كلمات
// الإشارة (الإجابة/الخلاصة/لأن...)، حروف الاختيارات، المصطلحات بين «»، و✅/❌.
//
// أمان: بتشتغل على text nodes بس وبتبني العناصر بـ createElement/textContent — مفيش innerHTML، فمفيش
// أي HTML جديد ممكن يتحقن. بتتجاهل الكود والرسومات واللينكات وأي حاجة اتلوّنت قبل كده.
(() => {
  // كل رموز العناصر (عشان H2SO4 تتلوّن، و"Test" أو "OmGa" لأ)
  const ELEMENTS = new Set(("H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr " +
    "Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt " +
    "Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu").split(" "));
  const WORDLIKE = new Set(["In", "As", "Be", "He", "At", "No", "Am", "Pa", "Ho", "Es", "Po"]);
  // كلمات إنجليزي متكوّنة بالصدفة من رموز عناصر (O+K = "OK")
  const WORD_TOKENS = new Set(["OK", "ON", "BY", "HI", "IF", "OF", "US", "CV", "PC", "YES", "NOT", "CAN", "SCORE"]);
  const NORMAL = { "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9", "⁺": "+", "⁻": "−" };
  const SUP = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
  const CHARGE = /\^?(?:[0-9]*[+\-−]|[+\-−][0-9]+)$|[⁺⁻⁰¹²³⁴-⁹]+$/;
  const SUB = { 0: "₀", 1: "₁", 2: "₂", 3: "₃", 4: "₄", 5: "₅", 6: "₆", 7: "₇", 8: "₈", 9: "₉" };

  // صيغة مرشّحة: رموز عناصر + أرقام، وممكن مجموعة بين أقواس، وممكن شحنة في الآخر
  // المعامل في الأول (6H2O) جزء من الصيغة، بس بيفضل رقم عادي مش subscript
  const FORMULA = /(?<![A-Za-z0-9.])(?:\d{1,2}(?=[A-Z(]))?(?:\(?(?:[A-Z][a-z]?\d*)+\)?\d*){1,4}(?:\^?(?:[0-9]*[+\-−]|[+\-−][0-9]+)|[⁺⁻⁰¹²³⁴-⁹]+)?(?![A-Za-z0-9])/g;
  function isFormula(tok) {
    if (WORD_TOKENS.has(tok.toUpperCase()) && tok === tok.toUpperCase()) return false;
    const core = tok.replace(/^\d+/, "").replace(CHARGE, "");
    const symbols = core.replace(/[()\d]/g, "").match(/[A-Z][a-z]?/g);
    if (!symbols || symbols.join("") !== core.replace(/[()\d]/g, "")) return false;
    if (!symbols.every((s) => ELEMENTS.has(s))) return false;
    // عنصر واحد من غير رقم ولا شحنة: الرموز بحرفين (Zn، Cu، Fe) آمنة، إلا اللي ممكن تبقى كلمة
    // إنجليزي. والرموز بحرف واحد ("I"، "C") بنسيبها.
    if (symbols.length === 1 && !/\d/.test(core) && core === tok.replace(/^\d+/, "")) return symbols[0].length === 2 && !WORDLIKE.has(symbols[0]);
    return true;
  }

  // كلمات بتشاور على حاجة مهمة بس — كلمات زي "يعني/لأن/مثال" متكررة جدًا وتلوينها بيعمل زحمة عكس المطلوب
  const CUES = [
    "الإجابة الصحيحة", "الاجابة الصحيحة", "الإجابة النموذجية", "الخلاصة", "خد بالك", "خلي بالك", "ركّز", "ركز",
    "لاحظ", "ملحوظة", "ملاحظة", "مهم جدًا", "الكلمة المفتاح", "السبب", "النتيجة", "إذن",
  ];
  const AR_MONTHS = "يناير|فبراير|مارس|أبريل|ابريل|مايو|يونيو|يوليو|أغسطس|اغسطس|سبتمبر|أكتوبر|اكتوبر|نوفمبر|ديسمبر";
  // وحدة كاملة = أجزاء بينها / أو . أو · (M/s، g/mol، mol.L⁻¹.s⁻¹)، وكل جزء ممكن ليه أُس (cm³، s⁻¹، s^-1)
  const UNIT_ATOM = "mmol|kmol|mol|kg|mg|g|cm³|cm3|dm³|dm3|m³|mL|L|M|min|hr|h|s|kJ|kcal|cal|J|kPa|Pa|atm|mmHg|°C|K|nm|cm|m|" +
    "مول|جم|جرام|كجم|لتر|مل|ملل|ث|ثانية|دقيقة|ساعة|كلفن|ض\\.ج|جول|كيلوجول|درجة";
  const UNIT_EXP = "(?:⁻?[¹²³]|\\^-?\\d)?";
  const UNIT = `(?:${UNIT_ATOM})${UNIT_EXP}(?:\\s?[/.·∙]\\s?(?:${UNIT_ATOM})${UNIT_EXP}){0,3}`;
  const NUMBER = "[-−]?\\d+(?:[.,]\\d+)?(?:\\s?×\\s?10\\^?[⁻\\-−]?\\d+)?";
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // ترتيب البدائل مهم: الأطول/الأدق الأول
  function buildMatcher(subject) {
    const parts = [
      `(?<ok>✅[^\\n.؛،,❌]*)`,
      `(?<bad>❌[^\\n.؛،,✅]*)`,
      `(?<term>«[^»\\n]{1,60}»)`,
      `(?<opt>\\((?:أ|ب|ج|د|ه|a|b|c|d)\\))`,
      `(?<date>\\d{1,2}\\s+(?:${AR_MONTHS})(?:\\s+\\d{3,4}\\s*(?:م|هـ)?)?)`,
      `(?<year>(?<![\\d.])(?:1[0-9]|20)\\d{2}\\s?(?:م|هـ|ق\\.م)?(?![\\d.]))`,
      `(?<qty>(?<![\\w.])${NUMBER}\\s?${UNIT}(?![\\w\\u0621-\\u064A]))`,
      `(?<num>(?<![\\w.\\-−])[-−]?\\d+(?:[.,]\\d+)?%?(?![\\w]))`,
      `(?<cue>(?<![\\u0621-\\u064A])(?:${CUES.map(esc).join("|")})(?![\\u0621-\\u064A]))`,
      `(?<arrow>→|⟶|⇌|⇄)`,
    ];
    if (subject === "chemistry") {
      parts.splice(4, 0, `(?<orb>(?<![\\w])[1-7][spdf](?:[0-9]{1,2})?(?![\\w]))`, `(?<chem>${FORMULA.source})`); // 3d9 / 4s2 + الصيغ
    }
    if (subject !== "history") parts.splice(parts.findIndex((p) => p.startsWith("(?<year>")), 1); // السنين للتاريخ بس
    return new RegExp(parts.join("|"), "g");
  }
  const matchers = {};

  const SKIP = "code, pre, a, sub, sup, svg, .chat-html-frame, .chat-image-actions-wrap, [class^='hl-'], [class*=' hl-']";

  function chemNode(tok) {
    const bdi = document.createElement("bdi");
    bdi.dir = "ltr";
    bdi.className = "hl-chem";
    // أرقام الصيغة subscript، والشحنة superscript
    const charge = tok.match(CHARGE);
    const body = charge ? tok.slice(0, tok.length - charge[0].length) : tok;
    bdi.textContent = body.replace(/(?<=[A-Za-z)])(\d+)/g, (d) => d.split("").map((c) => SUB[c]).join(""));
    if (charge) {
      const sup = document.createElement("sup");
      // الشحنة بالشكل المعتاد في الكتب: الرقم الأول وبعده الإشارة (SO₄²⁻)
      // حروف الـ superscript (⁺⁻²) بتتحول لعادية جوه <sup> عشان تتعرض بنفس خط الصيغة
      const c = charge[0].replace("^", "").replace(/[⁰¹²³⁴-⁹⁺⁻]/g, (x) => NORMAL[x]).replace("-", "−");
      sup.textContent = /^[+−]\d/.test(c) ? c.slice(1) + c[0] : c;
      bdi.appendChild(sup);
    }
    return bdi;
  }

  // توزيع إلكتروني: 3d9 → 3d⁹
  function orbitalNode(tok) {
    const el = document.createElement("bdi");
    el.dir = "ltr";
    el.className = "hl-chem";
    el.textContent = tok.slice(0, 2) + tok.slice(2).split("").map((c) => SUP[c]).join("");
    return el;
  }

  function span(cls, text, ltr) {
    const el = document.createElement(ltr ? "bdi" : "span");
    if (ltr) el.dir = "ltr";
    el.className = cls;
    el.textContent = text;
    return el;
  }

  function highlightText(node, re) {
    const text = node.nodeValue;
    re.lastIndex = 0;
    let m, last = 0, frag = null;
    while ((m = re.exec(text))) {
      if (!m[0]) { re.lastIndex++; continue; }
      const g = m.groups;
      let el = null;
      if (g.orb !== undefined) el = orbitalNode(m[0]);
      else if (g.chem !== undefined) { if (isFormula(m[0])) el = chemNode(m[0]); }
      else if (g.ok !== undefined) el = span("hl-ok", m[0]);
      else if (g.bad !== undefined) el = span("hl-bad", m[0]);
      else if (g.term !== undefined) el = span("hl-term", m[0]);
      else if (g.opt !== undefined) el = span("hl-opt", m[0]);
      else if (g.date !== undefined || g.year !== undefined) el = span("hl-date", m[0]);
      else if (g.qty !== undefined) el = span("hl-num", m[0], /[a-zA-Z°]/.test(m[0]));
      else if (g.num !== undefined) el = span("hl-num", m[0]);
      else if (g.cue !== undefined) el = span("hl-cue", m[0]);
      else if (g.arrow !== undefined) el = span("hl-arrow", m[0]);
      if (!el) continue;
      frag = frag || document.createDocumentFragment();
      if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
      frag.appendChild(el);
      last = m.index + m[0].length;
    }
    if (!frag) return;
    if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
    node.parentNode.replaceChild(frag, node);
  }

  /**
   * @param {Element} root     الـ .custom-message-content بتاع رد المدرس
   * @param {string} subject   "chemistry" | "history" | ...
   */
  window.highlightMessage = function (root, subject) {
    if (!root) return;
    try { run(root, subject); } catch (e) { /* تلوين بس — لو فشل الرد يفضل يتعرض عادي */ }
  };
  function run(root, subject) {
    // تلوين الأرقام القديم في formatMessage كان لون واحد لكل رقم (حتى جوه "1919م" أو "2 مول") —
    // بنفكّه ونخلي التلوين هنا يقرر حسب المعنى (سنة/كمية بوحدة/رقم عادي)
    root.querySelectorAll(".chat-inline-number").forEach((s) => s.replaceWith(document.createTextNode(s.textContent)));
    root.normalize();
    const re = matchers[subject] || (matchers[subject] = buildMatcher(subject));
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (!n.nodeValue.trim() || n.parentElement.closest(SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const n of nodes) highlightText(n, re);
  }
})();
