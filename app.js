/*
 * الدعم العلمي AI — واجهة Be First لمدرسين الـ AI (عبدالجواد للكيمياء، الباشا للتاريخ).
 *
 * التضمين في منصة Be First (iframe أو لينك مباشر)، وبيانات الطالب بتتبعت في الرابط:
 *   https://aiservice.magacademy.co/befirst-ai/?student_id=123&student_name=محمد علي&grade_name=2 ثانوي
 *   (اختياري) &teacher=jawad|elbasha  → يفتح المحادثة على طول
 * أو من الصفحة الأم بـ postMessage:
 *   iframe.contentWindow.postMessage({ type: "befirst-ai:student", student_id, student_name, grade_name }, "*")
 *   ⚠️ لو متضمّن كـ iframe لازم allow="camera" عشان زرار التصوير يفتح الكاميرا جوه الصفحة:
 *   <iframe src="..." allow="camera" style="width:100%;height:100vh;border:0"></iframe>
 *
 * المحادثات السابقة هنا **ديمو** (متخزنة في متصفح الطالب + GET /v2/chat للتجربة). في الإنتاج،
 * تخزين وعرض واسترجاع محادثات كل طالب مسؤولية منصة Be First عندها (README القسم 5).
 *
 * 🔌 = نقطة ربط مع منصة Be First (دوّروا على العلامة دي). الشرح الكامل في README.md.
 */
(() => {
  const params = new URLSearchParams(location.search);
  // 🔌 سيرفر الـ AI (ثابت — ماتغيروهوش إلا لو اتفقنا على دومين تاني)
  const API = (params.get("api") || "https://aiservice.magacademy.co").replace(/\/$/, "");

  // 🔌 المدرسين: الاسم والصورة ومسار الـ AI بتاع كل واحد. مدرس جديد = سطر جديد هنا (بعد ما نجهّز له الـ AI عندنا)
  const TEACHERS = {
    jawad: {
      name: "م/محمد عبدالجواد",
      subject: "الكيمياء",
      photo: "img/jawad.jpg?v=2",
      thumb: "img/jawad-sm.jpg?v=2",
      endpoint: "/ask-by-question-id-chemistry-stream",
      greeting: "أهلاً بيك، أنا عبدالجواد AI. ابعتلي أي سؤال كيمياء — اكتبه أو صوّره — وهشرحهولك خطوة بخطوة.",
      suggestions: ["اشرحلي الرابطة التساهمية ببساطة", "إزاي أوزن معادلة كيميائية؟", "إيه الفرق بين الحمض والقاعدة؟"],
    },
    elbasha: {
      name: "م/أحمد الباشا",
      subject: "التاريخ",
      photo: "img/elbasha.jpg",
      thumb: "img/elbasha-sm.jpg",
      endpoint: "/ask-by-question-id-history-stream",
      greeting: "أهلاً بيك، أنا الباشا AI. اسألني في أي درس تاريخ أو ابعت صورة السؤال، ونذاكره سوا.",
      suggestions: ["لخصلي أسباب الحملة الفرنسية", "إيه أهم إنجازات محمد علي؟", "ذاكرلي الدرس ده في نقط"],
    },
  };

  // 🔌 بيانات الطالب — من الرابط (?student_id=&student_name=&grade_name=) أو من المنصة بـ postMessage تحت.
  //    student_id: مطلوب وثابت | student_name: الـ AI بينادي بالاسم الأول | grade_name: بيظبط مستوى الشرح
  const student = {
    student_id: params.get("student_id") || "",
    student_name: params.get("student_name") || "",
    grade_name: params.get("grade_name") || "",
    user_email: params.get("user_email") || "",
  };
  // 🔌 المنصة تقدر تبعت بيانات الطالب من غير ما تحطها في الرابط:
  //    iframe.contentWindow.postMessage({ type: "befirst-ai:student", student_id, student_name, grade_name }, "https://aiservice.magacademy.co")
  window.addEventListener("message", (e) => {
    const d = e.data;
    if (d && d.type === "befirst-ai:student") {
      for (const k of Object.keys(student)) if (d[k]) student[k] = String(d[k]);
      renderHomeCounts();
    }
  });

  // ── التخزين المحلي (كل قراءة/كتابة في try: المتصفح ممكن يمنعه) ──
  const sid = () => student.student_id || "guest";
  const K = {
    index: (t) => `bfai:${sid()}:${t}:chats`,
    chat: (t, id) => `bfai:${sid()}:${t}:c:${id}`,
    legacy: (t) => `bfai:${sid()}:${t}`,
  };
  const get = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } };
  const put = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
  const del = (k) => { try { localStorage.removeItem(k); } catch {} };

  const titleOf = (msgs) => {
    const q = msgs.find((m) => m.role === "user");
    if (!q) return "محادثة";
    const t = (q.text || "").trim();
    return t && t !== "جاوب على الصورة" ? t.slice(0, 60) : "صورة سؤال";
  };
  // الإصدار الأول كان بيحفظ محادثة واحدة لكل مدرس — بنحوّلها لأول عنصر في القايمة
  function migrate(t) {
    const old = get(K.legacy(t), null);
    if (old && old.notebook_id && Array.isArray(old.messages)) {
      const idx = get(K.index(t), []);
      if (!idx.some((c) => c.id === old.notebook_id)) {
        idx.unshift({ id: old.notebook_id, title: titleOf(old.messages), updated: Date.now(), n: old.messages.length });
        put(K.index(t), idx);
        put(K.chat(t, old.notebook_id), old.messages);
      }
    }
    if (old) del(K.legacy(t));
  }
  const listChats = (t) => get(K.index(t), []).sort((a, b) => b.updated - a.updated);
  function upsertChat(t, id, msgs) {
    if (!id) return;
    const idx = get(K.index(t), []).filter((c) => c.id !== id);
    idx.unshift({ id, title: titleOf(msgs), updated: Date.now(), n: msgs.length });
    put(K.index(t), idx.slice(0, 100));
    put(K.chat(t, id), msgs.slice(-80));
  }
  function removeChat(t, id) {
    put(K.index(t), get(K.index(t), []).filter((c) => c.id !== id));
    del(K.chat(t, id));
  }

  const $ = (id) => document.getElementById(id);
  const home = $("home"), chat = $("chat"), list = $("messages"), input = $("input");
  const fileInput = $("fileInput"), preview = $("preview"), previewImg = $("previewImg"), sendBtn = $("sendBtn");

  // المحادثة المفتوحة: { teacher, id (notebook_id أو null لمحادثة جديدة), messages: [{role, text, image, ts, reply_to}] }
  //   ts = timestamp الرسالة على السيرفر (هو الـ id بتاعها، وبيرجع في /v2/chat وفي SSE)
  //   reply_to = { ts, role: "user"|"assistant", excerpt, has_image } لو الرسالة ريبلاي على رسالة قديمة
  let conv = null;
  let pendingFile = null;
  let replyTarget = null; // ↩️ الرسالة اللي الطالب بيرد عليها دلوقتي (زي ريبلاي واتساب)
  let busy = false;

  // ═════════════ الشاشة الرئيسية ═════════════
  const grid = document.querySelector(".teachers");
  for (const [id, t] of Object.entries(TEACHERS)) {
    migrate(id);
    const b = document.createElement("button");
    b.className = "teacher";
    b.type = "button";
    b.innerHTML = `
      <span class="frame"><span class="arch"><img src="${t.photo}" alt="${t.name}"></span></span>
      <span class="plinth" aria-hidden="true"></span>
      <span class="t-name">${t.name}</span>
      <span class="subject">${t.subject}</span>
      <span class="start">ابدأ المحادثة</span>
      <span class="past" data-count="${id}"></span>`;
    b.addEventListener("click", () => { location.hash = id; });
    grid.appendChild(b);
  }
  const countText = (n) => (n === 1 ? "محادثة سابقة" : n === 2 ? "محادثتين سابقين" : n <= 10 ? `${n} محادثات سابقة` : `${n} محادثة سابقة`);
  function renderHomeCounts() {
    for (const id of Object.keys(TEACHERS)) {
      const n = listChats(id).length;
      const el = document.querySelector(`[data-count="${id}"]`);
      if (el) el.textContent = n ? countText(n) : "";
    }
  }
  renderHomeCounts();

  // ═════════════ التنقل: #jawad = آخر محادثة، #jawad/new = جديدة، #jawad/<id> = محادثة معينة ═════════════
  function route() {
    const [t, id] = location.hash.slice(1).split("/");
    if (!TEACHERS[t]) return showHome();
    openTeacher(t, id);
  }
  window.addEventListener("hashchange", route);
  $("backBtn").addEventListener("click", () => { location.hash = ""; });

  function showHome() {
    conv = null;
    closeDrawer();
    chat.hidden = true;
    home.hidden = false;
    renderHomeCounts();
    window.scrollTo(0, 0);
  }

  function openTeacher(t, id) {
    const T = TEACHERS[t];
    $("chatAvatar").src = T.thumb;
    $("chatAvatar").alt = T.name;
    $("chatName").textContent = T.name;
    $("chatSubject").innerHTML = `<span class="live" aria-hidden="true"></span>`;
    $("chatSubject").append(`مدرس ${T.subject} الذكي`);
    $("drawerSub").textContent = `مع ${T.name}`;
    home.hidden = true;
    chat.hidden = false;

    // نفس المحادثة مفتوحة أصلاً (مثلاً بعد ما الرابط اتحدّث في آخر الرد) — مفيش داعي نعيد الرسم
    if (conv && conv.teacher === t && id && conv.id === id) return;

    const chats = listChats(t);
    if (id === "new" || (!id && !chats.length)) {
      conv = { teacher: t, id: null, messages: [] };
    } else {
      const target = id || chats[0].id;
      conv = { teacher: t, id: target, messages: get(K.chat(t, target), []) };
      refreshFromServer(conv);
    }
    renderAll();
    renderHistory();
    closeDrawer();
    setTimeout(() => input.focus({ preventScroll: true }), 50);
  }

  // النسخة الكاملة من السيرفر (بالصور والرسومات) — المحلية بتتعرض الأول عشان مايبقاش فيه انتظار
  // 🔌 API: GET /v2/chat/:notebook_id — محتوى محادثة كاملة
  async function refreshFromServer(c) {
    try {
      const res = await fetch(`${API}/v2/chat/${encodeURIComponent(c.id)}`);
      if (!res.ok) return;
      const data = await res.json();
      const msgs = (data.chat || []).map((m) => {
        const imgs = Array.isArray(m.images) ? m.images : [];
        const meta = { ts: m.timestamp || null, reply_to: m.reply_to || null };
        if (m.role === "user") return { role: "user", text: m.text || "", image: m.image || imgs[0] || null, ...meta };
        let text = m.text || "";
        // شاتات قديمة: رابط الرسم محفوظ في images بس مش جوه النص (نفس فيكس mapStoredMessage في المنصة)
        if (!/<img\b/i.test(text) && imgs.length) text += imgs.map((src) => `\n<img src="${src}" alt="رسم توضيحي">`).join("");
        return { role: "bot", text, ...meta };
      });
      if (!msgs.length || conv !== c || busy) return;
      c.messages = msgs;
      upsertChat(c.teacher, c.id, msgs);
      renderAll();
      renderHistory();
    } catch {}
  }

  const startNew = () => { if (!busy && conv) location.hash = `${conv.teacher}/new`; };
  $("newChatBtn").addEventListener("click", startNew);
  $("drawerNew").addEventListener("click", startNew);

  // ═════════════ درج المحادثات السابقة ═════════════
  const drawer = $("drawer"), scrim = $("scrim");
  function openDrawer() { renderHistory(); drawer.classList.add("open"); drawer.setAttribute("aria-hidden", "false"); scrim.hidden = false; }
  function closeDrawer() { drawer.classList.remove("open"); drawer.setAttribute("aria-hidden", "true"); scrim.hidden = true; }
  $("historyBtn").addEventListener("click", openDrawer);
  $("drawerClose").addEventListener("click", closeDrawer);
  scrim.addEventListener("click", closeDrawer);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && drawer.classList.contains("open")) closeDrawer(); });

  function groupLabel(ts) {
    const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diff = Math.round((day(new Date()) - day(new Date(ts))) / 864e5);
    if (diff <= 0) return "النهارده";
    if (diff === 1) return "إمبارح";
    if (diff < 7) return "الأسبوع ده";
    if (diff < 30) return "الشهر ده";
    return "أقدم";
  }
  const timeLabel = (ts) => {
    const g = groupLabel(ts), d = new Date(ts);
    return g === "النهارده" || g === "إمبارح"
      ? d.toLocaleTimeString("ar-EG", { hour: "numeric", minute: "2-digit" })
      : d.toLocaleDateString("ar-EG", { day: "numeric", month: "short" });
  };

  function renderHistory() {
    if (!conv) return;
    const chats = listChats(conv.teacher);
    const badge = $("historyCount");
    badge.hidden = !chats.length;
    badge.textContent = chats.length > 99 ? "99+" : String(chats.length);

    const box = $("historyList");
    box.innerHTML = "";
    if (!chats.length) {
      box.innerHTML = `<p class="history-empty">لسه مفيش محادثات. أول سؤال هتسأله هيتحفظ هنا.</p>`;
      return;
    }
    let lastGroup = "";
    for (const c of chats) {
      const g = groupLabel(c.updated);
      if (g !== lastGroup) {
        const h = document.createElement("div");
        h.className = "history-group";
        h.textContent = g;
        box.appendChild(h);
        lastGroup = g;
      }
      const item = document.createElement("div");
      item.className = "history-item" + (conv.id === c.id ? " active" : "");
      const questions = Math.max(1, Math.round((c.n || 2) / 2));
      item.innerHTML = `
        <button class="history-open" type="button">
          <span class="history-title"></span>
          <span class="history-meta"><span>${timeLabel(c.updated)}</span><span>${questions === 1 ? "سؤال واحد" : questions + " أسئلة"}</span></span>
        </button>
        <button class="history-del" type="button" aria-label="امسح المحادثة دي" title="امسح">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12"/></svg>
        </button>`;
      item.querySelector(".history-title").textContent = c.title;
      item.querySelector(".history-open").addEventListener("click", () => {
        if (busy) return;
        if (conv.id === c.id) return closeDrawer();
        location.hash = `${conv.teacher}/${c.id}`;
      });
      item.querySelector(".history-del").addEventListener("click", () => {
        if (busy || !confirm("تمسح المحادثة دي من القايمة؟")) return;
        removeChat(conv.teacher, c.id);
        if (conv.id === c.id) startNew(); else renderHistory();
      });
      box.appendChild(item);
    }
  }

  // ═════════════ عرض الرسايل ═════════════
  const DIAGRAM_PLACEHOLDER = /\*\(جاري تحضير الرسم التوضيحي\.\.\.\)\*/g;
  // فورمات المنصة (formatMessage) + طبقة الأشكال الإضافية (enhanceMessage) + DOMPurify
  function toHtml(text, done) {
    let t = text || "";
    if (done && /<img\b/i.test(t)) t = t.replace(DIAGRAM_PLACEHOLDER, "");
    const html = window.formatMessage(window.enhanceMessage(t)) + (done ? "" : "<span class='streaming-cursor'></span>");
    return DOMPurify.sanitize(html, { ADD_ATTR: ["target", "download"] });
  }

  function row(role, m) {
    const r = document.createElement("div");
    r.className = `row ${role}`;
    if (m) { r._msg = m; if (m.ts) r.dataset.ts = m.ts; }
    if (role === "bot") {
      const a = document.createElement("img");
      a.className = "row-avatar";
      a.src = TEACHERS[conv.teacher].thumb;
      a.alt = "";
      r.appendChild(a);
    }
    const b = document.createElement("div");
    b.className = `msg ${role}`;
    r.appendChild(b);
    if (m) addReplyButton(r);
    list.appendChild(r);
    return b;
  }

  function fillBot(b, text, { done = true, error = false, onRetry = null, actions = true } = {}) {
    b.classList.toggle("error", error);
    if (error) {
      b.innerHTML = `<div class="err-text"></div>`;
      b.querySelector(".err-text").textContent = text;
      if (onRetry) {
        const r = document.createElement("button");
        r.className = "msg-action";
        r.type = "button";
        r.textContent = "↻ جرّب تاني";
        r.addEventListener("click", onRetry);
        b.appendChild(r);
      }
      return;
    }
    b.innerHTML = `<div class="custom-message-content">${toHtml(text, done)}</div>`;
    if (done && actions) {
      const bar = document.createElement("div");
      bar.className = "msg-actions";
      const copy = document.createElement("button");
      copy.className = "msg-action";
      copy.type = "button";
      copy.textContent = "نسخ";
      copy.addEventListener("click", async () => {
        const plain = b.querySelector(".custom-message-content").innerText;
        try { await navigator.clipboard.writeText(plain); copy.textContent = "اتنسخ ✓"; }
        catch { copy.textContent = "مش متاح"; }
        setTimeout(() => (copy.textContent = "نسخ"), 1600);
      });
      bar.appendChild(copy);
      b.appendChild(bar);
    }
  }

  function fillUser(b, m) {
    b.textContent = "";
    if (m.reply_to) b.appendChild(quoteEl(m.reply_to));
    const src = m.localImage || m.image;
    if (src) {
      const im = document.createElement("img");
      im.className = "attached";
      im.src = src;
      im.alt = "صورة السؤال";
      im.addEventListener("click", () => window.open(im.src, "_blank"));
      b.appendChild(im);
    } else if (m.hadImage) {
      b.insertAdjacentHTML("beforeend", `<span class="photo-note"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l2-2.5h6L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>صورة سؤال</span>`);
    }
    if (m.text && m.text !== "جاوب على الصورة") b.appendChild(document.createTextNode(m.text));
  }

  // محادثة جديدة فاضية = شاشة ترحيب (بورتريه المدرس + اقتراحات) بدل فقاعة صغيرة وفراغ تحتها
  function renderWelcome(T) {
    const w = document.createElement("div");
    w.className = "welcome";
    w.innerHTML = `
      <span class="frame welcome-frame"><span class="arch"><img src="${T.photo}" alt=""></span></span>
      <div class="welcome-name">${T.name}</div>
      <div class="welcome-sub">مدرس ${T.subject} الذكي</div>
      <p class="welcome-text"></p>
      <div class="suggestions welcome-suggestions"></div>`;
    w.querySelector(".welcome-text").textContent = T.greeting;
    const s = w.querySelector(".suggestions");
    for (const q of T.suggestions) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = q;
      b.addEventListener("click", () => { input.value = q; send(); });
      s.appendChild(b);
    }
    list.appendChild(w);
  }

  function renderAll() {
    list.innerHTML = "";
    const T = TEACHERS[conv.teacher];
    if (!conv.messages.length) return renderWelcome(T);
    fillBot(row("bot"), T.greeting, { actions: false });
    for (const m of conv.messages) {
      if (m.role === "user") fillUser(row("user", m), m);
      else fillBot(row("bot", m), m.text, { error: !!m.error });
    }
    scrollDown(true);
  }

  // ── النزول لآخر رسالة: تلقائي لو الطالب أصلاً تحت، وزرار لو طلع يقرا فوق ──
  const toBottom = $("toBottom");
  const nearBottom = () => list.scrollHeight - list.scrollTop - list.clientHeight < 120;
  const updateToBottom = () => { toBottom.hidden = nearBottom(); };
  const scrollDown = (force) => requestAnimationFrame(() => { if (force || nearBottom()) list.scrollTop = list.scrollHeight; updateToBottom(); });
  list.addEventListener("scroll", updateToBottom, { passive: true });
  // الشريط بيظهر وقت الاسكرول بس (وعلى الموبايل اللي مفيهوش hover) ويختفي بعد ثانية من الوقوف
  for (const el of [list, document.getElementById("historyList")]) {
    let t = 0;
    el.addEventListener("scroll", () => {
      el.classList.add("scrolling");
      clearTimeout(t);
      t = setTimeout(() => el.classList.remove("scrolling"), 900);
    }, { passive: true });
  }
  toBottom.addEventListener("click", () => list.scrollTo({ top: list.scrollHeight, behavior: "smooth" }));

  // ═════════════ الصور: معرض + كاميرا ═════════════
  function shrink(file, max = 1600) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        if (scale === 1 && file.size < 1.5e6) return resolve(file);
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        c.toBlob((b) => resolve(b ? new File([b], "question.jpg", { type: "image/jpeg" }) : file), "image/jpeg", 0.85);
      };
      img.onerror = () => resolve(file);
      img.src = URL.createObjectURL(file);
    });
  }
  async function attach(file) {
    if (!file) return;
    pendingFile = await shrink(file);
    previewImg.src = URL.createObjectURL(pendingFile);
    preview.hidden = false;
    updateSend();
  }
  for (const inp of [fileInput, $("captureInput")]) {
    inp.addEventListener("change", () => { const f = inp.files[0]; inp.value = ""; attach(f); });
  }
  $("removeImg").addEventListener("click", () => { pendingFile = null; preview.hidden = true; updateSend(); });

  // الكاميرا جوه الصفحة (الخلفية افتراضيًا)، ولو مش متاحة نفتح كاميرا الموبايل نفسها
  const cam = $("camera"), video = $("cameraVideo");
  let camStream = null, facing = "environment";
  async function startCamera() {
    stopCamera();
    camStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false,
    });
    video.srcObject = camStream;
  }
  function stopCamera() {
    if (camStream) camStream.getTracks().forEach((t) => t.stop());
    camStream = null;
    video.srcObject = null;
  }
  function closeCamera() { stopCamera(); cam.hidden = true; }
  $("cameraBtn").addEventListener("click", async () => {
    if (!navigator.mediaDevices?.getUserMedia) return $("captureInput").click();
    try { cam.hidden = false; await startCamera(); }
    catch { closeCamera(); $("captureInput").click(); } // رفض الإذن أو iframe من غير allow="camera"
  });
  $("cameraClose").addEventListener("click", closeCamera);
  $("cameraSwitch").addEventListener("click", async () => {
    facing = facing === "environment" ? "user" : "environment";
    try { await startCamera(); } catch { closeCamera(); }
  });
  $("cameraShot").addEventListener("click", () => {
    if (!video.videoWidth) return;
    const c = document.createElement("canvas");
    c.width = video.videoWidth;
    c.height = video.videoHeight;
    c.getContext("2d").drawImage(video, 0, 0);
    closeCamera();
    c.toBlob((b) => b && attach(new File([b], "question.jpg", { type: "image/jpeg" })), "image/jpeg", 0.9);
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !cam.hidden) closeCamera(); });
  window.addEventListener("hashchange", closeCamera);
  document.addEventListener("visibilitychange", () => { if (document.hidden && !cam.hidden) closeCamera(); });

  // ═════════════ الكتابة والإرسال ═════════════
  input.addEventListener("input", () => {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 160) + "px";
    updateSend();
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !matchMedia("(pointer: coarse)").matches) { e.preventDefault(); send(); }
  });
  $("composer").addEventListener("submit", (e) => { e.preventDefault(); send(); });
  const updateSend = () => { sendBtn.disabled = busy || (!input.value.trim() && !pendingFile); };
  updateSend();

  async function send(retry) {
    const text = retry ? retry.text : input.value.trim();
    const file = retry ? retry.file : pendingFile;
    const reply = retry ? retry.reply : replyTarget;
    let userMsg = retry ? retry.userMsg : null, userRow = retry ? retry.userRow : null;
    if (busy || (!text && !file) || !conv) return;
    const c = conv; // نثبّت المحادثة دي حتى لو الطالب فتح محادثة تانية أثناء الرد

    busy = true;
    if (!retry) {
      input.value = "";
      input.style.height = "auto";
      pendingFile = null;
      preview.hidden = true;
      // أول سؤال: شاشة الترحيب بتتحول لمحادثة عادية تبدأ بتحية المدرس
      if (list.querySelector(".welcome")) { list.innerHTML = ""; fillBot(row("bot"), TEACHERS[c.teacher].greeting, { actions: false }); }
      const m = { role: "user", text, hadImage: !!file, localImage: file ? URL.createObjectURL(file) : null, reply_to: replyTarget };
      c.messages.push(m);
      userMsg = m;
      const ub = row("user", m); // row() بيرجّع الفقاعة؛ الـ ts بيتحط على الـ row نفسه
      userRow = ub.parentElement;
      fillUser(ub, m);
      clearReply();
    }
    updateSend();

    const b = row("bot");
    b.innerHTML = `<span class="typing"><i></i><i></i><i></i></span>`;
    scrollDown(true);

    // 🔌 API: POST {endpoint} (multipart) — question + image + notebook_id + بيانات الطالب، والرد SSE:
    //    {"notebook_id"} أول event، بعده {"chunk"} أجزاء الرد، {"error"} لو فيه مشكلة، و[DONE] في الآخر
    const fd = new FormData();
    fd.append("question", text || "جاوب على الصورة");
    if (c.id) fd.append("notebook_id", c.id);
    for (const [k, v] of Object.entries(student)) if (v) fd.append(k, v);
    if (file) fd.append("image", file, file.name || "question.jpg");
    // 🔌 ريبلاي: بنبعت الـ ts بتاع الرسالة بس، والسيرفر بيجيب نصها وصورتها من نفس المحادثة بنفسه
    if (reply && reply.ts) fd.append("reply_to_ts", reply.ts);

    let answer = "", errorMsg = "", frame = 0, botTs = null;
    const paint = () => { frame = 0; if (conv === c) { fillBot(b, answer, { done: false }); scrollDown(); } };

    try {
      const res = await fetch(API + TEACHERS[c.teacher].endpoint, { method: "POST", body: fd });
      if (!res.ok || !res.body) throw new Error("http " + res.status);
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      outer: while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop();
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") break outer;
          let ev;
          try { ev = JSON.parse(payload); } catch { continue; }
          if (ev.notebook_id && !c.id) c.id = ev.notebook_id;
          // ids الرسايل على السيرفر: بيخلّوها قابلة للريبلاي فورًا من غير ريفريش
          if (ev.user_ts && userMsg) { userMsg.ts = ev.user_ts; if (ev.reply_to) userMsg.reply_to = ev.reply_to; setRowTs(userRow, ev.user_ts); }
          if (ev.bot_ts) botTs = ev.bot_ts;
          if (ev.error) errorMsg = ev.error;
          if (ev.chunk) { answer += ev.chunk; if (!frame) frame = requestAnimationFrame(paint); }
        }
      }
    } catch {
      errorMsg = "مش قادر أوصل للسيرفر دلوقتي. اتأكد من النت وجرب تاني.";
    }

    if (frame) cancelAnimationFrame(frame);
    if (answer.trim()) {
      const botMsg = { role: "bot", text: answer, ts: botTs };
      c.messages.push(botMsg);
      if (conv === c) { fillBot(b, answer); b.parentElement._msg = botMsg; setRowTs(b.parentElement, botTs); addReplyButton(b.parentElement); }
      // الرابط يشاور على المحادثة دي (من غير ما يعيد فتحها) عشان التحديث والرجوع يفتحوها هي
      if (conv === c && c.id && location.hash !== `#${c.teacher}/${c.id}`) history.replaceState(null, "", `#${c.teacher}/${c.id}`);
    } else {
      const msg = (errorMsg || "حصلت مشكلة ومقدرتش أرد. جرب تبعت السؤال تاني.").replace(/^❌\s*/, "");
      if (conv === c) fillBot(b, msg, { error: true, onRetry: () => { b.parentElement.remove(); send({ text, file, reply, userMsg, userRow }); } });
    }
    upsertChat(c.teacher, c.id, c.messages.map(({ localImage, ...m }) => m));
    busy = false;
    updateSend();
    if (conv === c) { renderHistory(); scrollDown(); }
  }

  // ═════════════ ↩️ الريبلاي على رسالة قديمة (زي واتساب) ═════════════
  // الطالب بيختار أي رسالة (سؤاله أو رد المدرس، نص أو صورة) ويكمل عليها، والمدرس يفتكر سياقها
  // من غير ما الطالب يبعت الصورة تاني أو ينسخ الكلام. السيرفر بيجيب الرسالة نفسها بالـ ts.
  const replyBar = $("replyBar");
  const who = (role) => (role === "user" ? "إنت" : `${TEACHERS[conv.teacher].name.replace(/^م\//, "")} AI`);
  const plain = (t) => String(t || "").replace(/<svg[\s\S]*?<\/svg>/gi, " ").replace(/<img\b[^>]*>/gi, " [رسم] ")
    .replace(/<[^>]+>/g, " ").replace(/\*\*|__|`|^\s*#+\s*/gm, "").replace(/\*\(جاري تحضير الرسم التوضيحي\.\.\.\)\*/g, "")
    .replace(/[🔹🔸💡📌✅❌⚠️🎯✨]/gu, "").replace(/\s+/g, " ").trim();
  const targetOf = (m) => ({
    ts: m.ts,
    role: m.role === "user" ? "user" : "assistant",
    excerpt: (m.role === "user" && m.text === "جاوب على الصورة" ? "" : plain(m.text)).slice(0, 160) || (m.image || m.localImage || m.hadImage ? "صورة" : ""),
    has_image: m.role === "user" && !!(m.image || m.localImage || m.hadImage),
    thumb: m.role === "user" ? (m.localImage || m.image || null) : null,
  });

  function quoteEl(q) {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "quote " + (q.role === "user" ? "q-user" : "q-bot");
    el.innerHTML = `<span class="q-who"></span><span class="q-text"></span>`;
    el.querySelector(".q-who").textContent = who(q.role);
    el.querySelector(".q-text").textContent = (q.has_image ? "📷 " : "") + (q.excerpt || "صورة");
    el.setAttribute("aria-label", `روح للرسالة الأصلية: ${q.excerpt || "صورة"}`);
    el.addEventListener("click", (e) => { e.stopPropagation(); jumpTo(q.ts); });
    return el;
  }
  function jumpTo(ts) {
    const target = ts && list.querySelector(`.row[data-ts="${CSS.escape(ts)}"]`);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    target.classList.remove("flash"); void target.offsetWidth; target.classList.add("flash");
  }
  function setRowTs(r, ts) {
    if (!r || !ts) return;
    r.dataset.ts = ts;
    const btn = r.querySelector(".reply-btn");
    if (btn) btn.hidden = false;
  }
  function addReplyButton(r) {
    if (!r || r.querySelector(".reply-btn")) return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "reply-btn";
    btn.setAttribute("aria-label", "رد على الرسالة دي");
    btn.title = "رد";
    btn.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 8V4L3 11l7 7v-4c5 0 8.5 1.6 11 5-1-5-4-10-11-11z"/></svg>`;
    btn.hidden = !r.dataset.ts;
    btn.addEventListener("click", () => r._msg && startReply(r._msg));
    r.appendChild(btn);
    enableSwipe(r);
  }
  function startReply(m) {
    if (!m || !m.ts) return;
    replyTarget = targetOf(m);
    replyBar.querySelector(".rb-who").textContent = `بترد على ${replyTarget.role === "user" ? "رسالتك" : who("assistant")}`;
    replyBar.querySelector(".rb-text").textContent = replyTarget.excerpt || "صورة";
    const th = replyBar.querySelector(".rb-thumb");
    th.hidden = !replyTarget.thumb;
    if (replyTarget.thumb) th.src = replyTarget.thumb;
    replyBar.classList.toggle("q-user", replyTarget.role === "user");
    replyBar.hidden = false;
    chat.classList.add("replying"); // بيرفع زرار "انزل لآخر رسالة" فوق الشريط
    input.focus({ preventScroll: true });
  }
  function clearReply() { replyTarget = null; replyBar.hidden = true; chat.classList.remove("replying"); }
  $("replyCancel").addEventListener("click", () => { clearReply(); input.focus({ preventScroll: true }); });
  replyBar.querySelector(".rb-body").addEventListener("click", () => replyTarget && jumpTo(replyTarget.ts));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !replyBar.hidden && drawer.getAttribute("aria-hidden") === "true" && cam.hidden) clearReply(); });
  window.addEventListener("hashchange", clearReply);

  // اسحب الرسالة ناحية الوسط على الموبايل = ريبلاي (نفس حركة واتساب)
  function enableSwipe(r) {
    const bubble = r.querySelector(".msg");
    if (!bubble) return;
    let x0 = 0, y0 = 0, dx = 0, active = false;
    // اتجاه السحب: رسايل الطالب يمين الشاشة (RTL) → اسحب شمال، رسايل المدرس شمال → اسحب يمين
    const dir = r.classList.contains("user") ? -1 : 1;
    bubble.addEventListener("touchstart", (e) => { if (!r.dataset.ts) return; const t = e.touches[0]; x0 = t.clientX; y0 = t.clientY; dx = 0; active = true; }, { passive: true });
    bubble.addEventListener("touchmove", (e) => {
      if (!active) return;
      const t = e.touches[0], mx = (t.clientX - x0) * dir, my = Math.abs(t.clientY - y0);
      if (my > 30 && my > Math.abs(mx)) { active = false; bubble.style.transform = ""; return; } // اسكرول عادي
      dx = Math.max(0, Math.min(80, mx));
      bubble.style.transform = `translateX(${dx * dir}px)`;
      r.classList.toggle("swipe-ready", dx > 56);
    }, { passive: true });
    const end = () => {
      if (!active) return;
      active = false;
      bubble.style.transition = "transform .2s var(--ease)";
      bubble.style.transform = "";
      setTimeout(() => (bubble.style.transition = ""), 220);
      if (dx > 56 && r._msg) { if (navigator.vibrate) navigator.vibrate(12); startReply(r._msg); }
      r.classList.remove("swipe-ready");
      dx = 0;
    };
    bubble.addEventListener("touchend", end);
    bubble.addEventListener("touchcancel", end);
  }

  route();
})();
