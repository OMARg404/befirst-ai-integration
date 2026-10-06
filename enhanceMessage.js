/*
 * طبقة فوق formatMessage (فورمات المنصة) للأشكال اللي الـ AI بيطلّعها فعلاً ومش متغطية هناك.
 * اتبنت من تحليل ردود حقيقية (11,549 رد كيمياء + 142 رد تاريخ):
 *  - قوايم متداخلة "*   **الأسباب:**" وتحتها "    *   **سياسياً:**" (تاريخ، ~47% من الردود)
 *    formatMessage بيحوّل "*" اللي في أول السطر بس، فالمتداخل كان بيظهر بنجمة خام.
 *  - قوايم "-" ومرقّمة "1."، جداول Markdown "| a | b |"، وجداول HTML خام متقسمة على كذا سطر.
 * بتحوّل الأشكال دي لـ HTML في سطر واحد قبل formatMessage — عشان هو بيسيب أي سطر بيبدأ
 * بـ <ul>/<ol>/<table> زي ما هو، وبيكمّل يطبّق الـ bold والأرقام جواه عادي.
 */
(() => {
  const LIST_RE = /^(\s*)([*\-•]|\d+[.)])\s+(.+)$/;
  const TABLE_ROW_RE = /^\s*\|.*\|\s*$/;
  const TABLE_SEP_RE = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

  function buildList(items) {
    // items: [{indent, ordered, text}] — بنبني التداخل حسب المسافة في أول السطر
    let html = "";
    const stack = []; // [{indent, tag}]
    for (const it of items) {
      while (stack.length && it.indent < stack[stack.length - 1].indent) {
        html += `</li></${stack.pop().tag}>`;
      }
      let top = stack[stack.length - 1];
      const tagWanted = it.ordered ? "ol" : "ul";
      // نفس المستوى بس نوع مختلف (بنود "-" بعدها "1.") → قايمة جديدة مش نفس القايمة
      if (top && it.indent === top.indent && top.tag !== tagWanted) {
        html += `</li></${stack.pop().tag}>`;
        top = stack[stack.length - 1];
      }
      if (!top || it.indent > top.indent) {
        const tag = it.ordered ? "ol" : "ul";
        html += `<${tag} class="chat-list">`;
        stack.push({ indent: it.indent, tag });
      } else {
        html += "</li>";
      }
      html += `<li>${it.text}`;
    }
    while (stack.length) html += `</li></${stack.pop().tag}>`;
    return html;
  }

  function buildTable(rows) {
    const cells = (r) => r.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
    let head = null, body = rows;
    if (rows.length > 1 && TABLE_SEP_RE.test(rows[1])) { head = cells(rows[0]); body = rows.slice(2); }
    // من غير <div> حوالين الجدول: formatMessage بيحط أي <div> في إطار أبيض بتاع الرسومات
    let html = '<table class="chat-table">';
    if (head) html += "<thead><tr>" + head.map((c) => `<th>${c}</th>`).join("") + "</tr></thead>";
    html += "<tbody>" + body.map((r) => "<tr>" + cells(r).map((c) => `<td>${c}</td>`).join("") + "</tr>").join("") + "</tbody>";
    return html + "</table>";
  }

  function enhanceMessage(text = "") {
    // جداول HTML خام متقسمة على سطور → سطر واحد (وإلا كل <tr> بيتلف في <p> لوحده)
    text = text.replace(/<table[\s\S]*?<\/table>/gi, (t) =>
      t.replace(/\n\s*/g, "").replace(/<table(?![^>]*class=)/i, '<table class="chat-table"'));

    const lines = text.split("\n");
    const out = [];
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];

      if (TABLE_ROW_RE.test(line)) {
        const rows = [];
        while (i < lines.length && TABLE_ROW_RE.test(lines[i])) rows.push(lines[i++]);
        out.push(rows.length >= 2 ? buildTable(rows) : rows[0]);
        continue;
      }

      const m = line.match(LIST_RE);
      // LIST_RE بتشترط مسافة بعد العلامة، فـ "**كلام عريض**" مش بتتحسب بند
      if (m) {
        const items = [];
        while (i < lines.length) {
          const mm = lines[i].match(LIST_RE);
          if (mm) {
            items.push({ indent: mm[1].replace(/\t/g, "    ").length, ordered: /\d/.test(mm[2]), text: mm[3] });
            i++;
          } else if (!lines[i].trim() && i + 1 < lines.length && LIST_RE.test(lines[i + 1])) {
            i++; // سطر فاضي بين بنود نفس القايمة
          } else break;
        }
        out.push(items.length ? buildList(items) : line);
        continue;
      }

      out.push(line);
      i++;
    }
    return out.join("\n");
  }

  window.enhanceMessage = enhanceMessage;
})();
