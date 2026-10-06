/*
 * الطريقة (ب) في README: تكلموا الـ API مباشرة من الكود بتاعكم وتبنوا الشات بنفسكم.
 * JavaScript عادي (من غير مكتبات) — شغال في المتصفح وفي أي framework (Vue/React/...).
 *
 *   const r = await askTeacher({
 *     teacher: "jawad",
 *     question: "إيه الفرق بين الحمض والقاعدة؟",
 *     image: fileFromInput,             // اختياري (File / Blob)
 *     notebookId: savedNotebookId,      // فاضي في أول سؤال، وبعد كده نفس القيمة اللي رجعت
 *     student: { student_id: "48213", student_name: "محمد علي", grade_name: "2 ثانوي" },
 *     onChunk: (fullTextSoFar) => { el.innerHTML = renderAnswer(fullTextSoFar); },
 *   });
 *   // r = { notebookId, text, error }
 */

const AI_API = "https://aiservice.magacademy.co";

// 🔌 المدرسين المتاحين ومسار كل واحد
export const AI_TEACHERS = {
  jawad:   { name: "م/محمد عبدالجواد", subject: "الكيمياء", endpoint: "/ask-by-question-id-chemistry-stream" },
  elbasha: { name: "م/أحمد الباشا",    subject: "التاريخ",  endpoint: "/ask-by-question-id-history-stream" },
};

/** يبعت سؤال ويقرا الرد streaming. */
export async function askTeacher({ teacher, question, image, notebookId, student = {}, onChunk, signal }) {
  const fd = new FormData();
  fd.append("question", question && question.trim() ? question.trim() : "جاوب على الصورة");
  if (notebookId) fd.append("notebook_id", notebookId);                       // 🔌 نفس المحادثة
  for (const k of ["student_id", "student_name", "grade_name", "user_email"]) {
    if (student[k]) fd.append(k, String(student[k]));                          // 🔌 بيانات الطالب
  }
  if (image) fd.append("image", image, image.name || "question.jpg");          // 🔌 صورة السؤال (≤ 10MB)

  let text = "", error = "", id = notebookId || null;
  try {
    const res = await fetch(AI_API + AI_TEACHERS[teacher].endpoint, { method: "POST", body: fd, signal });
    if (!res.ok || !res.body) throw new Error("HTTP " + res.status);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    read: while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const payload = line.slice(6).trim();
        if (payload === "[DONE]") break read;
        let ev;
        try { ev = JSON.parse(payload); } catch { continue; }
        if (ev.notebook_id) id = ev.notebook_id;             // أول event: احفظوه مع المحادثة
        if (ev.error) error = ev.error.replace(/^❌\s*/, "");
        if (ev.chunk) { text += ev.chunk; onChunk && onChunk(text); }
      }
    }
  } catch (e) {
    if (e.name === "AbortError") throw e;
    error = "مش قادر أوصل للسيرفر دلوقتي. جرب تاني.";
  }
  if (!text.trim() && !error) error = "حصلت مشكلة ومقدرتش أرد. جرب تاني.";
  return { notebookId: id, text, error: text.trim() ? "" : error };
}

/**
 * للتجربة والدعم الفني بس — ماتبنوش عليه. تخزين وعرض واسترجاع محادثات الطلاب مسؤوليتكم
 * (README القسم 5): خزّنوا كل سؤال ورد عندكم واعرضوا منها.
 */
export async function loadChat(notebookId) {
  const res = await fetch(`${AI_API}/v2/chat/${encodeURIComponent(notebookId)}`);
  if (!res.ok) return null;
  const data = await res.json();
  return (data.chat || []).map((m) => {
    const images = Array.isArray(m.images) ? m.images : [];
    if (m.role === "user") return { role: "user", text: m.text || "", image: m.image || images[0] || null };
    let text = m.text || "";
    // ردود قديمة: رابط الرسم في images بس مش جوه النص
    if (!/<img\b/i.test(text) && images.length) text += images.map((src) => `\n<img src="${src}" alt="رسم توضيحي">`).join("");
    return { role: "assistant", text };
  });
}

/**
 * يحوّل رد المدرس لـ HTML بنفس شكل منصتنا.
 * محتاج: formatMessage.js + enhanceMessage.js + chatFormatter.css (من الفولدر ده) + DOMPurify.
 * اعرضوا الناتج جوه: <div class="custom-message-content">...</div>
 */
export function renderAnswer(text, { done = true } = {}) {
  let t = text || "";
  // أثناء الرد بيظهر "(جاري تحضير الرسم التوضيحي...)" — بنشيله لما الصورة نفسها توصل
  if (done && /<img\b/i.test(t)) t = t.replace(/\*\(جاري تحضير الرسم التوضيحي\.\.\.\)\*/g, "");
  return window.DOMPurify.sanitize(window.formatMessage(window.enhanceMessage(t)), { ADD_ATTR: ["target", "download"] });
}
