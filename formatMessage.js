// منقول حرفيًا من فورمات رسايل المنصة (omga_Project / ahmed_elbasha_project:
// src/StudentModule/Components/ChatPage/chatFormatter.js) عشان رسايل المدرسين تبان بنفس الشكل بالظبط.
// لو اتعدّل هناك، انسخه هنا تاني (الفرق الوحيد: من غير import/export — سكريبت عادي).
(() => {

// بتلف أي <img> موجودة جوه بلوك HTML بأزرار "تكبير" (بيفتح الصورة الأصلية
// في تاب جديد) و"تحميل" (رابط download حقيقي، من غير أي JS) — شغالة بمجرد
// HTML/CSS عادي عشان الصورة بتتحط جوه dangerouslySetInnerHTML مش React.
function wrapImagesWithActions(html) {
  return html.replace(
    /<img\s+([^>]*?)src=["']([^"']+)["']([^>]*?)>/gi,
    (_, before, src, after) =>
      `<div class="chat-image-actions-wrap">` +
      `<img ${before}src="${src}"${after}>` +
      `<div class="chat-image-actions">` +
      `<a class="chat-image-action" href="${src}" target="_blank" rel="noopener noreferrer" title="تكبير">⤢</a>` +
      `<a class="chat-image-action" href="${src}" download title="تحميل">⬇</a>` +
      `</div></div>`,
  );
}

// بتبني بلوك صورة كامل (frame + أزرار) — بتتستخدم برضو لو النص متحولش
// لصورة أصلاً بس رابط الصورة موجود في msg.images (شات قديم قبل تحسين
// الباك اند)، عشان الصورة ما تضيعش.
function buildImageFrame(src, alt = "رسم توضيحي") {
  return wrapImagesWithActions(
    `<div class="chat-html-frame"><img src="${src}" alt="${alt}"/></div>`,
  );
}

const formatMessage = (text = "") => {
  let formatted = text.trim();

  /* ================= حماية أي HTML Blocks ================= */
  const htmlPlaceholders = [];
  const HTML_TOKEN = (i) => `⟦HTML_${i}⟧`;

  formatted = formatted.replace(
    /<div[\s\S]*?<\/div>|<img[\s\S]*?>|<svg[\s\S]*?<\/svg>/gi,
    (match) => {
      const key = HTML_TOKEN(htmlPlaceholders.length);

      let processed = match;

      if (/<svg/i.test(match)) {
        processed = processed.replace(/<svg([^>]*?)>/i, (svgTag, attrs) => {
          let cleanedAttrs = attrs
            .replace(/\s+width\s*=\s*["'][^"']*["']/gi, "")
            .replace(/\s+height\s*=\s*["'][^"']*["']/gi, "");

          if (!/viewBox/i.test(cleanedAttrs)) {
            const wMatch = attrs.match(/width\s*=\s*["'](\d+)["']/i);
            const hMatch = attrs.match(/height\s*=\s*["'](\d+)["']/i);
            if (wMatch && hMatch) {
              cleanedAttrs += ` viewBox="0 0 ${wMatch[1]} ${hMatch[1]}"`;
            }
          }

          return `<svg${cleanedAttrs} style="width:100%;height:auto;display:block;">`;
        });
      }

      processed = wrapImagesWithActions(processed);

      const framed = `<div class="chat-html-frame">${processed}</div>`;
      htmlPlaceholders.push(framed);
      return key;
    },
  );

  /* ================= حماية الكود (``` و `) قبل أي تنسيق تاني =================
     لازم نشيل الكود بره الأول قبل الـ Bold/Italic، لأن لو فيه * جوا كود
     (زي 2*3 أو أي كود عادي)، الـ regex بتاع ** أو * هيتفاعل معاه ويبوظه
     قبل ما يوصل لسطر استخراج الكود أصلاً.
  ================================================================= */
  const codePlaceholders = [];
  const CODE_TOKEN = (i) => `⟦CODE_${i}⟧`;

  formatted = formatted.replace(/```([\s\S]+?)```/g, (_, code) => {
    const key = CODE_TOKEN(codePlaceholders.length);
    codePlaceholders.push(`<pre class="chat-code">${code}</pre>`);
    return key;
  });
  formatted = formatted.replace(/`([^`]+)`/g, (_, code) => {
    const key = CODE_TOKEN(codePlaceholders.length);
    codePlaceholders.push(`<code class="chat-inline-code">${code}</code>`);
    return key;
  });

  /* ================= حماية المعادلات بين $...$ ================= */
  const mathPlaceholders = [];
  const MATH_TOKEN = (i) => `⟦MATH_${i}⟧`;

  formatted = formatted.replace(/\$(.+?)\$/g, (_, expr) => {
    const key = MATH_TOKEN(mathPlaceholders.length);

    // نظف العلامات الحسابية جوا المعادلة نفسها
    const cleaned = expr
      .replace(/\\times/g, "×")
      .replace(/\\cdot/g, "·")
      .replace(/\\div/g, "÷")
      .replace(/\\pm/g, "±")
      .replace(/\\xrightarrow\{\\text\{([^}]+)\}\}/g, "→ $1")
      .replace(/\\xrightarrow\{([^}]+)\}/g, "→ $1")
      .replace(/\\rightarrow/g, "→")
      .replace(/\\left|\\right/g, "")
      .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "($1)/($2)")
      .replace(/\{([^}]+)\}/g, "$1");

    mathPlaceholders.push(`<span class="chat-inline-math">${cleaned}</span>`);

    return key;
  });

  /* علامات حسابية خارج الـ $ $ */
  formatted = formatted.replace(/\\times/g, "×");
  formatted = formatted.replace(/\\cdot/g, "·");
  formatted = formatted.replace(/\\div/g, "÷");
  formatted = formatted.replace(/\\pm/g, "±");

  /* ================= Headers ================= */
  formatted = formatted.replace(
    /^### (.+)$/gm,
    '<h3 class="chat-heading h3">$1</h3>',
  );
  formatted = formatted.replace(
    /^## (.+)$/gm,
    '<h2 class="chat-heading h2">$1</h2>',
  );
  formatted = formatted.replace(
    /^# (.+)$/gm,
    '<h1 class="chat-heading h1">$1</h1>',
  );

  /* ================= Bold / Italic ================= */
  formatted = formatted.replace(
    /\*\*\*(.+?)\*\*\*/g,
    "<strong><em>$1</em></strong>",
  );
  // سطر الإجابة — لو السطر كله bold وفيه كلمة إجابة/جواب يتحول لـ answer highlight
  formatted = formatted.replace(
    /^\*\*((?:الإجابة|الجواب|إجابة|الاجابة|الاجابه|الإجابه|Answer)[^*]*)\*\*$/gim,
    '<p class="chat-answer-highlight">$1</p>',
  );
  formatted = formatted.replace(
    /\*\*(.+?)\*\*/g,
    '<span class="chat-subtitle">$1</span>',
  );
  formatted = formatted.replace(
    /\*(.+?)\*/g,
    '<em class="chat-italic">$1</em>',
  );

  /* ================= Lists ================= */
  formatted = formatted.replace(/(^|\n)\*\s+/g, "$1• ");

  /* ================= Superscript ================= */
  formatted = formatted.replace(/([A-Za-z0-9\])])\^(\d+)/g, "$1<sup>$2</sup>");

  /* ================= Tips ================= */
  formatted = formatted.replace(
    /💡\s*(.+)/g,
    '<blockquote class="chat-tip-paragraph">$1</blockquote>',
  );

  /* ================= Answer Highlight ==text== ================= */
  formatted = formatted.replace(
    /==([^=]+)==/g,
    '<span class="chat-answer-highlight">$1</span>',
  );

  /* ================= Paragraph Wrapper ================= 
     بنتجاهل السطور الفاضية تماماً — بس نلف السطور اللي فيها محتوى
  */
  const lines = formatted.split("\n");
  const wrappedLines = lines.map((line) => {
    const trimmed = line.trim();

    // سطر فاضي — نرجعه فاضي من غير أي wrapper
    if (!trimmed) return "";

    // لو الـ line بيبدأ بـ HTML tag بالفعل — ملوش wrapper
    if (
      /^<(h[1-3]|p|pre|blockquote|div|ul|ol|li|table|thead|tbody|tr|td|th)[\s>]/i.test(trimmed) ||
      trimmed.startsWith("⟦HTML_") ||
      trimmed.startsWith("⟦MATH_") ||
      trimmed.startsWith("⟦CODE_")
    ) {
      return line;
    }

    // تحديد الـ class بناءً على المحتوى
    let cls = "chat-paragraph card-step";
    let txt = trimmed;

    // سطر الإجابة — يبدأ بـ "الإجابة" أو "الجواب" أو "Answer"
    if (/^(الإجابة|الجواب|إجابة|الاجابة|الاجابه|الإجابه|answer\s*:)/i.test(txt)) {
      cls = "chat-paragraph chat-answer-highlight";
    } else if (txt.startsWith("🔹")) {
      cls = "chat-paragraph chat-scientific";
      txt = txt.replace(/^🔹\s*/, "");
    } else if (txt.startsWith("🎭")) {
      cls = "chat-paragraph chat-funny";
      txt = txt.replace(/^🎭\s*/, "");
    } else if (txt.startsWith("💡")) {
      cls = "chat-paragraph chat-tip-paragraph";
      txt = txt.replace(/^💡\s*/, "");
    } else if (txt.startsWith("⚛️")) {
      cls = "chat-paragraph chat-math-card";
      txt = txt.replace(/^⚛️\s*/, "");
    } else if (/→|Δ|heat|catalyst/i.test(txt)) {
      cls = "chat-paragraph chat-math-card";
    }

    return `<p class="${cls}">${txt}</p>`;
  });

  // ندمج السطور مع إزالة الـ empty strings المتتالية
  formatted = wrappedLines
    .join("")
    .replace(/(<\/p>|<\/h[1-3]>|<\/pre>|<\/blockquote>)\s*(<p |<h)/g, "$1$2");

  /* ================= Highlight الشروط ================= */
  formatted = formatted.replace(
    /\((Δ|Heat|°C|Ni|Pt|MnO₂|catalyst|حرارة)\)/gi,
    '<span class="chat-inline-highlight-important">($1)</span>',
  );

  /* ================= Highlight Numbers ================= */
  formatted = formatted.replace(
    /\b\d+(\.\d+)?\b/g,
    '<span class="chat-inline-number">$&</span>',
  );

  /* ================= رجوع المعادلات ================= */
  mathPlaceholders.forEach((math, i) => {
    formatted = formatted.replace(MATH_TOKEN(i), math);
  });

  /* ================= رجوع HTML ================= */
  htmlPlaceholders.forEach((html, i) => {
    formatted = formatted.replace(HTML_TOKEN(i), html);
  });

  /* ================= رجوع الكود ================= */
  codePlaceholders.forEach((code, i) => {
    formatted = formatted.replace(CODE_TOKEN(i), code);
  });

  return formatted;
};

window.formatMessage = formatMessage;
window.buildImageFrame = buildImageFrame;
})();
