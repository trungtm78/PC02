/**
 * Thay text trong một <w:p> ở mức RUN: chỉ thay đúng đoạn giá trị, giữ nguyên
 * định dạng (in đậm/nghiêng) của nhãn và của phần không đụng tới.
 *
 * Word hay xé một câu thành nhiều <w:r><w:t>; ta ghép text lại để so khớp, rồi
 * ánh xạ ngược khoảng cần thay về đúng các <w:t> tương ứng.
 */
import { decode, encode } from './docx.mjs';

/** Liệt kê các <w:t> trong đoạn kèm vị trí + offset text toàn đoạn. */
function scanTextNodes(pXml) {
  const nodes = [];
  const re = /<w:t(\s[^>]*)?>([\s\S]*?)<\/w:t>/g;
  let m;
  let acc = 0;
  while ((m = re.exec(pXml)) !== null) {
    const text = decode(m[2]);
    nodes.push({
      openEnd: m.index + m[0].indexOf('>') + 1, // sau '>' của <w:t...>
      closeStart: m.index + m[0].length - '</w:t>'.length,
      text,
      from: acc,
      to: acc + text.length,
    });
    acc += text.length;
  }
  return nodes;
}

export function paragraphText(pXml) {
  return scanTextNodes(pXml)
    .map((n) => n.text)
    .join('');
}

/**
 * Thay khoảng [start,end) của text-đã-ghép bằng `replacement`.
 * Giá trị mới nằm ở <w:t> chứa vị trí `start` (thừa hưởng định dạng của nó).
 */
function replaceRange(pXml, nodes, start, end, replacement) {
  const edits = [];
  let placed = false;
  for (const n of nodes) {
    if (n.to <= start || n.from >= end) continue; // ngoài khoảng
    const localStart = Math.max(0, start - n.from);
    const localEnd = Math.min(n.text.length, end - n.from);
    const before = n.text.slice(0, localStart);
    const after = n.text.slice(localEnd);
    const mid = placed ? '' : replacement;
    placed = true;
    edits.push({ from: n.openEnd, to: n.closeStart, text: encode(before + mid + after) });
  }
  // Áp từ cuối lên đầu để không lệch offset
  let out = pXml;
  for (const e of edits.reverse()) out = out.slice(0, e.from) + e.text + out.slice(e.to);
  return out;
}

/**
 * Rule:
 *  - { label: RegExp, to: '{bien}' }  → giữ nhãn khớp, thay TOÀN BỘ phần còn lại.
 *  - { find: string|RegExp, to: '{bien}', all?: boolean } → thay đúng chuỗi tìm được.
 *  - { whole: RegExp, to: '{bien}' } → cả đoạn khớp thì thay cả đoạn.
 */
export function applyRules(pXml, rules) {
  let out = pXml;
  for (const rule of rules) {
    let guard = 0;
    for (;;) {
      if (guard++ > 50) break;
      const nodes = scanTextNodes(out);
      const text = nodes.map((n) => n.text).join('');
      let start = -1;
      let end = -1;
      if (rule.label) {
        const m = rule.label.exec(text);
        rule.label.lastIndex = 0;
        if (!m) break;
        start = m.index + m[0].length;
        end = text.length;
        if (start >= end) break;
        // Giữ dấu kết câu cuối (./. hoặc .) nếu rule yêu cầu
        if (rule.keepTail) {
          const tail = new RegExp(`${rule.keepTail}\\s*$`).exec(text);
          if (tail) end = tail.index;
        }
      } else if (rule.whole) {
        const m = rule.whole.exec(text);
        rule.whole.lastIndex = 0;
        if (!m) break;
        start = m.index;
        end = m.index + m[0].length;
      } else if (rule.find) {
        if (typeof rule.find === 'string') {
          const idx = text.indexOf(rule.find);
          if (idx < 0) break;
          start = idx;
          end = idx + rule.find.length;
        } else {
          const m = rule.find.exec(text);
          rule.find.lastIndex = 0;
          if (!m) break;
          start = m.index;
          end = m.index + m[0].length;
        }
      } else break;

      if (text.slice(start, end) === rule.to) break; // đã thay rồi
      out = replaceRange(out, nodes, start, end, rule.to);
      if (!rule.all) break;
    }
  }
  return out;
}
