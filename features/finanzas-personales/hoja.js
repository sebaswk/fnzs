(() => {
  "use strict";
  const host = typeof window !== "undefined" ? window : globalThis;

  const DEFAULT_ROWS = 40;
  const DEFAULT_COLS = 12;
  const MAX_ROWS = 1000;
  const MAX_COLS = 60;
  const DEFAULT_WIDTH = 112;
  const MIN_WIDTH = 48;
  const MAX_WIDTH = 640;
  const HEAD_WIDTH = 46;
  const UNDO_LIMIT = 100;
  const CHAR_PX = 8;
  const CHAR_PAD = 16;
  const ZOOM_MIN = 0.5;
  const ZOOM_MAX = 2;
  const ZOOM_STEPS = [0.5, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2];

  const ERR = {
    div0: "#¡DIV/0!",
    value: "#¡VALOR!",
    ref: "#¡REF!",
    name: "#¿NOMBRE?",
    num: "#¡NUM!",
    na: "#N/D",
    circ: "#¡CIRC!",
    syntax: "#¡ERROR!"
  };

  const ERR_HELP = {
    [ERR.div0]: "Estás dividiendo entre cero o entre una celda vacía.",
    [ERR.value]: "La fórmula usa un texto donde esperaba un número.",
    [ERR.ref]: "La fórmula apunta a una celda u hoja que ya no existe.",
    [ERR.name]: "No reconozco esa función. Revisa cómo está escrita.",
    [ERR.num]: "El resultado no es un número válido, por ejemplo la raíz de un negativo.",
    [ERR.na]: "No hay un valor disponible.",
    [ERR.circ]: "La fórmula depende de sí misma. Revisa que no incluya su propia celda.",
    [ERR.syntax]: "La fórmula está incompleta o mal escrita. Revisa paréntesis y separadores."
  };

  const ERR_ALIASES = {
    "#DIV/0!": ERR.div0,
    "#¡DIV/0!": ERR.div0,
    "#VALUE!": ERR.value,
    "#VALOR!": ERR.value,
    "#¡VALOR!": ERR.value,
    "#REF!": ERR.ref,
    "#¡REF!": ERR.ref,
    "#NAME?": ERR.name,
    "#NOMBRE?": ERR.name,
    "#¿NOMBRE?": ERR.name,
    "#NUM!": ERR.num,
    "#¡NUM!": ERR.num,
    "#N/A": ERR.na,
    "#N/D": ERR.na,
    "#CIRC!": ERR.circ,
    "#¡CIRC!": ERR.circ,
    "#ERROR!": ERR.syntax,
    "#¡ERROR!": ERR.syntax
  };
  const ERROR_CODES = Object.keys(ERR_ALIASES).sort((a, b) => b.length - a.length);

  const BOOL_WORDS = { TRUE: true, FALSE: false, VERDADERO: true, FALSO: false };

  const FN_ALIASES = {
    SUMA: "SUM", SUM: "SUM",
    PROMEDIO: "AVERAGE", AVERAGE: "AVERAGE",
    MIN: "MIN", MAX: "MAX",
    CONTAR: "COUNT", COUNT: "COUNT",
    CONTARA: "COUNTA", COUNTA: "COUNTA",
    PRODUCTO: "PRODUCT", PRODUCT: "PRODUCT",
    REDONDEAR: "ROUND", ROUND: "ROUND",
    "REDONDEAR.MAS": "ROUNDUP", ROUNDUP: "ROUNDUP",
    "REDONDEAR.MENOS": "ROUNDDOWN", ROUNDDOWN: "ROUNDDOWN",
    ABS: "ABS",
    RAIZ: "SQRT", SQRT: "SQRT",
    POTENCIA: "POWER", POWER: "POWER",
    RESIDUO: "MOD", MOD: "MOD",
    ENTERO: "INT", INT: "INT",
    SI: "IF", IF: "IF",
    Y: "AND", AND: "AND",
    O: "OR", OR: "OR",
    NO: "NOT", NOT: "NOT",
    "SI.ERROR": "IFERROR", IFERROR: "IFERROR",
    "SUMAR.SI": "SUMIF", SUMIF: "SUMIF",
    "CONTAR.SI": "COUNTIF", COUNTIF: "COUNTIF",
    "PROMEDIO.SI": "AVERAGEIF", AVERAGEIF: "AVERAGEIF",
    CONCATENAR: "CONCAT", CONCAT: "CONCAT", CONCATENATE: "CONCAT"
  };

  const HELP_FUNCTIONS = [
    ["SUMA", "Suma un rango: =SUMA(B2:B10)"],
    ["PROMEDIO", "Promedio: =PROMEDIO(B2:B10)"],
    ["MIN / MAX", "El menor o el mayor valor"],
    ["CONTAR / CONTARA", "Cuántos números / cuántas celdas con algo"],
    ["SI", "Elige según una condición: =SI(B2>0;\"Sí\";\"No\")"],
    ["SUMAR.SI", "Suma lo que cumpla algo: =SUMAR.SI(A2:A9;\"Mercado\";B2:B9)"],
    ["CONTAR.SI", "Cuenta lo que cumpla algo: =CONTAR.SI(B2:B9;\">0\")"],
    ["PROMEDIO.SI", "Promedio de lo que cumpla algo"],
    ["REDONDEAR", "Redondea: =REDONDEAR(B2;0)"],
    ["SI.ERROR", "Muestra otra cosa si hay error: =SI.ERROR(B2/C2;0)"],
    ["PRODUCTO, POTENCIA, RAIZ, ABS, ENTERO, RESIDUO", "Operaciones matemáticas"],
    ["Y, O, NO", "Combinan condiciones"],
    ["CONCATENAR", "Une textos: =CONCATENAR(A2;\" \";B2)"]
  ];

  const FORMATS = [
    { id: "", label: "Automático", sample: "1.500" },
    { id: "money", label: "Moneda", sample: "$ 1.500" },
    { id: "pct", label: "Porcentaje", sample: "15%" },
    { id: "num", label: "Número con decimales", sample: "1.500,00" },
    { id: "text", label: "Texto", sample: "Abc" }
  ];

  const FILLS = [
    { id: "", label: "Sin color" },
    { id: "green", label: "Verde" },
    { id: "blue", label: "Azul" },
    { id: "amber", label: "Amarillo" },
    { id: "coral", label: "Rojo" },
    { id: "violet", label: "Morado" },
    { id: "slate", label: "Gris" }
  ];
  const FILL_IDS = new Set(FILLS.map((fill) => fill.id).filter(Boolean));
  const ALIGNS = new Set(["left", "center", "right"]);
  const FORMAT_IDS = new Set(FORMATS.map((fmt) => fmt.id).filter(Boolean));

  class SheetError {
    constructor(code) {
      this.code = code;
    }
  }

  const isErr = (value) => value instanceof SheetError;
  const isRange = (value) => Boolean(value && value.range === true);

  function uid() {
    return `h-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function colName(index) {
    let n = index + 1;
    let out = "";
    while (n > 0) {
      const m = (n - 1) % 26;
      out = String.fromCharCode(65 + m) + out;
      n = Math.floor((n - 1) / 26);
    }
    return out;
  }

  function colIndex(letters) {
    let n = 0;
    for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
    return n - 1;
  }

  function cellKey(r, c) {
    return `${r}:${c}`;
  }

  function addr(r, c) {
    return `${colName(c)}${r + 1}`;
  }

  function round15(value) {
    if (!Number.isFinite(value) || value === 0) return value;
    return Number(value.toPrecision(15));
  }

  function sameName(a, b) {
    return String(a).toLowerCase() === String(b).toLowerCase();
  }

  function isFormula(raw) {
    return typeof raw === "string" && raw.length > 1 && raw[0] === "=";
  }

  /* ---------- Números escritos a mano ---------- */

  function parseInputNumber(input) {
    if (typeof input === "number") return Number.isFinite(input) ? { value: input, kind: "" } : null;
    let s = String(input == null ? "" : input).trim();
    if (!s) return null;
    let kind = "";
    let negative = false;
    if (/^\(.*\)$/.test(s)) {
      negative = true;
      s = s.slice(1, -1).trim();
    }
    if (s[0] === "-" || s[0] === "−") {
      negative = !negative;
      s = s.slice(1).trim();
    } else if (s[0] === "+") {
      s = s.slice(1).trim();
    }
    if (s.endsWith("%")) {
      kind = "pct";
      s = s.slice(0, -1).trim();
    }
    if (s[0] === "$") {
      if (!kind) kind = "money";
      s = s.slice(1).trim();
      if (s[0] === "-") {
        negative = !negative;
        s = s.slice(1).trim();
      }
    }
    s = s.replace(/[\s\u00a0]/g, "");
    if (!s || !/^[0-9.,]+([eE][+-]?\d+)?$/.test(s)) return null;
    const dots = (s.match(/\./g) || []).length;
    const commas = (s.match(/,/g) || []).length;
    let normalized;
    if (dots && commas) {
      if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
        if (commas > 1 || !/^[1-9]\d{0,2}(\.\d{3})+,\d*$/.test(s)) return null;
        normalized = s.replace(/\./g, "").replace(",", ".");
      } else {
        if (dots > 1 || !/^[1-9]\d{0,2}(,\d{3})+\.\d*$/.test(s)) return null;
        normalized = s.replace(/,/g, "");
      }
    } else if (commas) {
      if (commas === 1) normalized = s.replace(",", ".");
      else if (/^[1-9]\d{0,2}(,\d{3})+$/.test(s)) normalized = s.replace(/,/g, "");
      else return null;
    } else if (dots) {
      if (dots > 1) {
        if (!/^[1-9]\d{0,2}(\.\d{3})+$/.test(s)) return null;
        normalized = s.replace(/\./g, "");
      } else if (/^[1-9]\d{0,2}\.\d{3}$/.test(s)) {
        normalized = s.replace(".", "");
      } else {
        normalized = s;
      }
    } else {
      normalized = s;
    }
    if (!/^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(normalized)) return null;
    let value = Number(normalized);
    if (!Number.isFinite(value)) return null;
    if (negative) value = -value;
    if (kind === "pct") value = round15(value / 100);
    return { value, kind };
  }

  function literalValue(raw) {
    if (raw[0] === "'") return raw.slice(1);
    const parsed = parseInputNumber(raw);
    if (parsed) return parsed.value;
    const upper = raw.trim().toUpperCase();
    if (Object.prototype.hasOwnProperty.call(BOOL_WORDS, upper)) return BOOL_WORDS[upper];
    return raw;
  }

  /* ---------- Fórmulas: lectura ---------- */

  const NAME_START = "A-Za-zÀ-ÖØ-öø-ÿ_";
  const NAME_BODY = "A-Za-z0-9À-ÖØ-öø-ÿ_.";
  const SHEET_RE = new RegExp(`^([${NAME_START}][${NAME_BODY}]*)!`);
  const IDENT_RE = new RegExp(`^[${NAME_START}][${NAME_BODY}]*`);
  const PLAIN_SHEET_RE = new RegExp(`^[${NAME_START}][${NAME_BODY}]*$`);
  const CELL_RE = /^(\$?)([A-Za-z]{1,3})(\$?)([0-9]{1,7})(?![A-Za-z0-9_(.!])/;
  const COLS_RE = /^(\$?)([A-Za-z]{1,3}):(\$?)([A-Za-z]{1,3})(?![A-Za-z0-9_(.!])/;

  function syntaxError() {
    return new SheetError(ERR.syntax);
  }

  function matchError(src, index) {
    const rest = src.slice(index).toUpperCase();
    for (const code of ERROR_CODES) {
      if (rest.startsWith(code.toUpperCase())) return code;
    }
    return null;
  }

  function hasTopSemicolon(src) {
    let inStr = false;
    let inQuote = false;
    for (const ch of src) {
      if (ch === "\"" && !inQuote) inStr = !inStr;
      else if (ch === "'" && !inStr) inQuote = !inQuote;
      else if (ch === ";" && !inStr && !inQuote) return true;
    }
    return false;
  }

  const ENGLISH_FN_RE = /(^|[^A-Za-z0-9_.])(SUM|AVERAGE|COUNTA?|PRODUCT|ROUND(UP|DOWN)?|SQRT|POWER|MOD|INT|IF|AND|OR|NOT|IFERROR|SUMIF|COUNTIF|AVERAGEIF|CONCAT(ENATE)?)\s*\(/i;

  function commaSeparates(src) {
    const bare = src.replace(/"(?:[^"]|"")*"?/g, "\"\"").replace(/'(?:[^']|'')*'?/g, "''");
    return /\d\.\d/.test(bare) || /,\s/.test(bare) || /[A-Za-z_$)"'][0-9]*\s*,/.test(bare) || ENGLISH_FN_RE.test(bare);
  }

  function tokenize(src) {
    const tokens = [];
    const semicolons = hasTopSemicolon(src);
    const englishArgs = !semicolons && commaSeparates(src);
    const parens = [];
    let i = 0;
    while (i < src.length) {
      const ch = src[i];
      if (/\s/.test(ch)) {
        i += 1;
        continue;
      }
      const start = i;

      if (ch === "\"") {
        let j = i + 1;
        let out = "";
        for (;;) {
          if (j >= src.length) throw syntaxError();
          if (src[j] === "\"") {
            if (src[j + 1] === "\"") {
              out += "\"";
              j += 2;
              continue;
            }
            break;
          }
          out += src[j];
          j += 1;
        }
        tokens.push({ type: "str", value: out, start, end: j + 1 });
        i = j + 1;
        continue;
      }

      if (ch === "#") {
        const code = matchError(src, i);
        if (!code) throw syntaxError();
        tokens.push({ type: "err", value: ERR_ALIASES[code], start, end: i + code.length });
        i += code.length;
        continue;
      }

      let sheet = null;
      let j = i;
      if (ch === "'") {
        let k = i + 1;
        let name = "";
        for (;;) {
          if (k >= src.length) throw syntaxError();
          if (src[k] === "'") {
            if (src[k + 1] === "'") {
              name += "'";
              k += 2;
              continue;
            }
            break;
          }
          name += src[k];
          k += 1;
        }
        if (src[k + 1] !== "!") throw syntaxError();
        sheet = name;
        j = k + 2;
      } else {
        const m = SHEET_RE.exec(src.slice(i));
        if (m) {
          sheet = m[1];
          j = i + m[0].length;
        }
      }

      const rest = src.slice(j);
      let m = CELL_RE.exec(rest);
      if (m) {
        tokens.push({
          type: "ref",
          sheet,
          absC: Boolean(m[1]),
          c: colIndex(m[2]),
          absR: Boolean(m[3]),
          r: Number(m[4]) - 1,
          start,
          end: j + m[0].length
        });
        i = j + m[0].length;
        continue;
      }
      m = COLS_RE.exec(rest);
      if (m) {
        tokens.push({
          type: "cols",
          sheet,
          absC1: Boolean(m[1]),
          c1: colIndex(m[2]),
          absC2: Boolean(m[3]),
          c2: colIndex(m[4]),
          start,
          end: j + m[0].length
        });
        i = j + m[0].length;
        continue;
      }
      if (sheet !== null) {
        const code = rest[0] === "#" ? matchError(src, j) : null;
        if (code && ERR_ALIASES[code] === ERR.ref) {
          tokens.push({ type: "err", value: ERR.ref, start, end: j + code.length });
          i = j + code.length;
          continue;
        }
        throw syntaxError();
      }

      if (/[0-9]/.test(ch) || (ch === "." && /[0-9]/.test(src[i + 1] || ""))) {
        let k = i;
        let text = "";
        while (k < src.length && /[0-9]/.test(src[k])) {
          text += src[k];
          k += 1;
        }
        const commaDecimal = !englishArgs || parens[parens.length - 1] !== "fn";
        if (src[k] === ".") {
          text += ".";
          k += 1;
          while (k < src.length && /[0-9]/.test(src[k])) {
            text += src[k];
            k += 1;
          }
        } else if (src[k] === "," && commaDecimal && /[0-9]/.test(src[k + 1] || "")) {
          text += ".";
          k += 1;
          while (k < src.length && /[0-9]/.test(src[k])) {
            text += src[k];
            k += 1;
          }
        }
        if (/[eE]/.test(src[k] || "") && /[0-9]/.test(src[k + 1] === "+" || src[k + 1] === "-" ? (src[k + 2] || "") : (src[k + 1] || ""))) {
          text += "e";
          k += 1;
          if (src[k] === "+" || src[k] === "-") {
            text += src[k];
            k += 1;
          }
          while (k < src.length && /[0-9]/.test(src[k])) {
            text += src[k];
            k += 1;
          }
        }
        const value = Number(text);
        if (!Number.isFinite(value)) throw syntaxError();
        tokens.push({ type: "num", value, start, end: k });
        i = k;
        continue;
      }

      m = IDENT_RE.exec(src.slice(i));
      if (m) {
        const word = m[0];
        const upper = word.toUpperCase();
        let k = i + word.length;
        while (k < src.length && /\s/.test(src[k])) k += 1;
        const isCall = src[k] === "(";
        if (!isCall && Object.prototype.hasOwnProperty.call(BOOL_WORDS, upper)) {
          tokens.push({ type: "bool", value: BOOL_WORDS[upper], start, end: i + word.length });
        } else {
          tokens.push({ type: "ident", value: word, start, end: i + word.length });
        }
        i += word.length;
        continue;
      }

      const two = src.slice(i, i + 2);
      if (two === "<=" || two === ">=" || two === "<>") {
        tokens.push({ type: "op", value: two, start, end: i + 2 });
        i += 2;
        continue;
      }
      if ("+-*/^&=<>%".includes(ch)) {
        tokens.push({ type: "op", value: ch, start, end: i + 1 });
        i += 1;
        continue;
      }
      if (ch === "(") {
        const prev = tokens[tokens.length - 1];
        parens.push(prev && prev.type === "ident" ? "fn" : "group");
        tokens.push({ type: "lp", start, end: i + 1 });
        i += 1;
        continue;
      }
      if (ch === ")") {
        parens.pop();
        tokens.push({ type: "rp", start, end: i + 1 });
        i += 1;
        continue;
      }
      if (ch === "," || ch === ";") {
        tokens.push({ type: "sep", start, end: i + 1 });
        i += 1;
        continue;
      }
      if (ch === ":") {
        tokens.push({ type: "colon", start, end: i + 1 });
        i += 1;
        continue;
      }
      throw syntaxError();
    }
    return tokens;
  }

  function parseFormula(src) {
    const tokens = tokenize(src);
    let pos = 0;
    const peek = () => tokens[pos];
    const next = () => tokens[pos++];
    const isOp = (tok, ops) => Boolean(tok && tok.type === "op" && ops.includes(tok.value));

    function comparison() {
      let node = concat();
      while (isOp(peek(), ["=", "<>", "<", ">", "<=", ">="])) {
        const op = next().value;
        node = { t: "bin", op, a: node, b: concat() };
      }
      return node;
    }

    function concat() {
      let node = additive();
      while (isOp(peek(), ["&"])) {
        next();
        node = { t: "bin", op: "&", a: node, b: additive() };
      }
      return node;
    }

    function additive() {
      let node = term();
      while (isOp(peek(), ["+", "-"])) {
        const op = next().value;
        node = { t: "bin", op, a: node, b: term() };
      }
      return node;
    }

    function term() {
      let node = power();
      while (isOp(peek(), ["*", "/"])) {
        const op = next().value;
        node = { t: "bin", op, a: node, b: power() };
      }
      return node;
    }

    function power() {
      let node = unary();
      while (isOp(peek(), ["^"])) {
        next();
        node = { t: "bin", op: "^", a: node, b: unary() };
      }
      return node;
    }

    function unary() {
      if (isOp(peek(), ["-"])) {
        next();
        return { t: "neg", a: unary() };
      }
      if (isOp(peek(), ["+"])) {
        next();
        return unary();
      }
      return postfix();
    }

    function postfix() {
      let node = primary();
      while (isOp(peek(), ["%"])) {
        next();
        node = { t: "pct", a: node };
      }
      return node;
    }

    function primary() {
      const tok = next();
      if (!tok) throw syntaxError();
      switch (tok.type) {
        case "num":
        case "str":
        case "bool":
          return { t: "lit", v: tok.value };
        case "err":
          return { t: "err", v: tok.value };
        case "cols":
          return {
            t: "range",
            sheet: tok.sheet,
            r1: 0,
            c1: Math.min(tok.c1, tok.c2),
            r2: Infinity,
            c2: Math.max(tok.c1, tok.c2)
          };
        case "ref": {
          const colon = peek();
          if (colon && colon.type === "colon") {
            const other = tokens[pos + 1];
            if (other && other.type === "ref" && (other.sheet === null || (tok.sheet !== null && sameName(other.sheet, tok.sheet)))) {
              pos += 2;
              return {
                t: "range",
                sheet: tok.sheet,
                r1: Math.min(tok.r, other.r),
                c1: Math.min(tok.c, other.c),
                r2: Math.max(tok.r, other.r),
                c2: Math.max(tok.c, other.c)
              };
            }
            throw syntaxError();
          }
          return { t: "ref", sheet: tok.sheet, r: tok.r, c: tok.c };
        }
        case "ident": {
          const open = peek();
          if (!open || open.type !== "lp") return { t: "name", v: tok.value };
          next();
          const args = [];
          if (peek() && peek().type === "rp") {
            next();
            return { t: "fn", name: tok.value, args };
          }
          for (;;) {
            const ahead = peek();
            if (ahead && (ahead.type === "sep" || ahead.type === "rp")) args.push(null);
            else args.push(comparison());
            const sep = next();
            if (!sep) throw syntaxError();
            if (sep.type === "rp") break;
            if (sep.type !== "sep") throw syntaxError();
          }
          return { t: "fn", name: tok.value, args };
        }
        case "lp": {
          const node = comparison();
          const close = next();
          if (!close || close.type !== "rp") throw syntaxError();
          return node;
        }
        default:
          throw syntaxError();
      }
    }

    if (!tokens.length) throw syntaxError();
    const ast = comparison();
    if (pos < tokens.length) throw syntaxError();
    return ast;
  }

  const astCache = new Map();

  function getAst(src) {
    if (astCache.has(src)) return astCache.get(src);
    let ast;
    try {
      ast = parseFormula(src);
    } catch (error) {
      ast = { t: "err", v: isErr(error) ? error.code : ERR.syntax };
    }
    if (astCache.size > 3000) astCache.clear();
    astCache.set(src, ast);
    return ast;
  }

  /* ---------- Fórmulas: cálculo ---------- */

  function fnKey(name) {
    const key = String(name).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
    return FN_ALIASES[key] || null;
  }

  function plainNumber(value) {
    return round15(value).toLocaleString("es-CO", { useGrouping: false, maximumFractionDigits: 10 });
  }

  function toNum(value) {
    if (isErr(value)) throw value;
    if (value == null || value === "") return 0;
    if (typeof value === "number") return value;
    if (typeof value === "boolean") return value ? 1 : 0;
    const parsed = parseInputNumber(value);
    if (parsed) return parsed.value;
    throw new SheetError(ERR.value);
  }

  function toText(value) {
    if (isErr(value)) throw value;
    if (value == null) return "";
    if (typeof value === "boolean") return value ? "VERDADERO" : "FALSO";
    if (typeof value === "number") return plainNumber(value);
    return String(value);
  }

  function toBool(value) {
    if (isErr(value)) throw value;
    if (value == null || value === "") return false;
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    const upper = String(value).trim().toUpperCase();
    if (upper === "VERDADERO" || upper === "TRUE") return true;
    if (upper === "FALSO" || upper === "FALSE") return false;
    throw new SheetError(ERR.value);
  }

  function typeRank(value) {
    if (typeof value === "number") return 0;
    if (typeof value === "string") return 1;
    return 2;
  }

  function compareValues(a, b) {
    if (isErr(a)) throw a;
    if (isErr(b)) throw b;
    let x = a;
    let y = b;
    if (x == null) x = typeof y === "string" ? "" : typeof y === "boolean" ? false : 0;
    if (y == null) y = typeof x === "string" ? "" : typeof x === "boolean" ? false : 0;
    const rx = typeRank(x);
    const ry = typeRank(y);
    if (rx !== ry) return rx < ry ? -1 : 1;
    if (rx === 0) {
      const p = round15(x);
      const q = round15(y);
      return p === q ? 0 : p < q ? -1 : 1;
    }
    if (rx === 1) {
      const p = x.toLowerCase();
      const q = y.toLowerCase();
      if (p === q) return 0;
      return p.localeCompare(q, "es") < 0 ? -1 : 1;
    }
    return x === y ? 0 : x ? 1 : -1;
  }

  function compareOp(op, a, b) {
    const d = compareValues(a, b);
    switch (op) {
      case "=": return d === 0;
      case "<>": return d !== 0;
      case "<": return d < 0;
      case ">": return d > 0;
      case "<=": return d <= 0;
      default: return d >= 0;
    }
  }

  function wildcard(text) {
    const pattern = text
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/\*/g, ".*")
      .replace(/\?/g, ".");
    return new RegExp(`^${pattern}$`, "i");
  }

  function makeCriteria(crit) {
    if (isErr(crit)) throw crit;
    if (typeof crit === "number") {
      const target = round15(crit);
      return (v) => typeof v === "number" && round15(v) === target;
    }
    if (typeof crit === "boolean") return (v) => v === crit;
    if (crit == null) return (v) => v == null || v === "";
    const m = /^(<=|>=|<>|<|>|=)?([\s\S]*)$/.exec(String(crit));
    const op = m[1] || "=";
    const operand = m[2];
    if (operand === "") {
      if (op === "=") return (v) => v == null || v === "";
      if (op === "<>") return (v) => !(v == null || v === "");
    }
    const parsed = parseInputNumber(operand);
    if (parsed) {
      const target = round15(parsed.value);
      return (v) => {
        if (typeof v !== "number") return op === "<>";
        const x = round15(v);
        switch (op) {
          case "=": return x === target;
          case "<>": return x !== target;
          case "<": return x < target;
          case ">": return x > target;
          case "<=": return x <= target;
          default: return x >= target;
        }
      };
    }
    const lower = operand.toLowerCase();
    const pattern = /[*?]/.test(operand) ? wildcard(operand) : null;
    return (v) => {
      if (typeof v !== "string") return op === "<>";
      if (op === "=") return pattern ? pattern.test(v) : v.toLowerCase() === lower;
      if (op === "<>") return pattern ? !pattern.test(v) : v.toLowerCase() !== lower;
      const d = v.toLowerCase().localeCompare(lower, "es");
      if (op === "<") return d < 0;
      if (op === ">") return d > 0;
      if (op === "<=") return d <= 0;
      return d >= 0;
    };
  }

  function createEvaluator(model) {
    const byName = new Map();
    model.sheets.forEach((sheet) => byName.set(sheet.name.toLowerCase(), sheet));
    const cache = new Map();
    const computing = new Set();

    function sheetFor(name, current) {
      if (name == null) return current;
      return byName.get(String(name).toLowerCase()) || null;
    }

    function cell(sheet, r, c) {
      const key = `${sheet.id}|${r}:${c}`;
      if (cache.has(key)) return cache.get(key);
      if (computing.has(key)) return new SheetError(ERR.circ);
      const data = sheet.cells[cellKey(r, c)];
      let value = null;
      if (data && data.v != null && data.v !== "") {
        const raw = String(data.v);
        if (data.f === "text") value = raw;
        else if (isFormula(raw)) {
          computing.add(key);
          try {
            value = finish(evaluate(getAst(raw.slice(1)), sheet));
          } finally {
            computing.delete(key);
          }
        } else {
          value = literalValue(raw);
        }
      }
      cache.set(key, value);
      return value;
    }

    function finish(value) {
      if (isRange(value)) {
        if (value.r1 === value.r2 && value.c1 === value.c2) return cell(value.sheet, value.r1, value.c1);
        return new SheetError(ERR.value);
      }
      if (typeof value === "number" && !Number.isFinite(value)) return new SheetError(ERR.num);
      return value;
    }

    function evaluate(node, sheet) {
      try {
        return evalNode(node, sheet);
      } catch (error) {
        if (isErr(error)) return error;
        return new SheetError(ERR.syntax);
      }
    }

    function scalar(value) {
      if (isRange(value)) {
        if (value.r1 === value.r2 && value.c1 === value.c2) return scalar(cell(value.sheet, value.r1, value.c1));
        throw new SheetError(ERR.value);
      }
      if (isErr(value)) throw value;
      return value;
    }

    function rangeOf(node, sheet) {
      if (node && node.t === "ref") {
        const target = sheetFor(node.sheet, sheet);
        if (!target) throw new SheetError(ERR.ref);
        return { range: true, sheet: target, r1: node.r, c1: node.c, r2: node.r, c2: node.c };
      }
      const value = node ? evalNode(node, sheet) : null;
      if (isRange(value)) return value;
      if (isErr(value)) throw value;
      throw new SheetError(ERR.value);
    }

    function evalNode(node, sheet) {
      switch (node.t) {
        case "lit":
          return node.v;
        case "err":
          throw new SheetError(node.v);
        case "name":
          throw new SheetError(ERR.name);
        case "ref": {
          const target = sheetFor(node.sheet, sheet);
          if (!target) throw new SheetError(ERR.ref);
          return cell(target, node.r, node.c);
        }
        case "range": {
          const target = sheetFor(node.sheet, sheet);
          if (!target) throw new SheetError(ERR.ref);
          return {
            range: true,
            sheet: target,
            r1: node.r1,
            c1: node.c1,
            r2: Math.min(node.r2, target.rows - 1),
            c2: Math.min(node.c2, target.cols - 1)
          };
        }
        case "neg":
          return -toNum(scalar(evalNode(node.a, sheet)));
        case "pct":
          return toNum(scalar(evalNode(node.a, sheet))) / 100;
        case "bin": {
          const a = scalar(evalNode(node.a, sheet));
          const b = scalar(evalNode(node.b, sheet));
          return binary(node.op, a, b);
        }
        case "fn": {
          const key = fnKey(node.name);
          const impl = key && FUNCS[key];
          if (!impl) throw new SheetError(ERR.name);
          return impl(node.args, sheet);
        }
        default:
          throw new SheetError(ERR.syntax);
      }
    }

    function binary(op, a, b) {
      switch (op) {
        case "+": return toNum(a) + toNum(b);
        case "-": return toNum(a) - toNum(b);
        case "*": return toNum(a) * toNum(b);
        case "/": {
          const n = toNum(a);
          const d = toNum(b);
          if (d === 0) throw new SheetError(ERR.div0);
          return n / d;
        }
        case "^": {
          const result = Math.pow(toNum(a), toNum(b));
          if (!Number.isFinite(result)) throw new SheetError(ERR.num);
          return result;
        }
        case "&":
          return toText(a) + toText(b);
        default:
          return compareOp(op, a, b);
      }
    }

    function forEachValue(args, sheet, fn) {
      args.forEach((node) => {
        if (node === null) {
          fn(null, false);
          return;
        }
        if (node.t === "ref") {
          fn(evalNode(node, sheet), true);
          return;
        }
        const value = evalNode(node, sheet);
        if (isRange(value)) {
          for (let r = value.r1; r <= value.r2; r += 1) {
            for (let c = value.c1; c <= value.c2; c += 1) fn(cell(value.sheet, r, c), true);
          }
          return;
        }
        fn(value, false);
      });
    }

    function numbers(args, sheet) {
      const out = [];
      forEachValue(args, sheet, (value, fromRange) => {
        if (isErr(value)) throw value;
        if (fromRange) {
          if (typeof value === "number") out.push(value);
          return;
        }
        out.push(toNum(value));
      });
      return out;
    }

    function arg(args, index, sheet) {
      const node = args[index];
      if (node == null) return null;
      return scalar(evalNode(node, sheet));
    }

    function needArgs(args, min, max) {
      if (args.length < min || args.length > max) throw new SheetError(ERR.value);
    }

    function roundWith(args, sheet, mode) {
      needArgs(args, 1, 2);
      const x = toNum(arg(args, 0, sheet));
      const digits = args.length > 1 ? Math.trunc(toNum(arg(args, 1, sheet))) : 0;
      const sign = x < 0 ? -1 : 1;
      const abs = Math.abs(x);
      const apply = mode === "up" ? Math.ceil : mode === "down" ? Math.floor : Math.round;
      let result;
      if (digits >= 0) {
        const f = 10 ** digits;
        result = apply(round15(abs * f)) / f;
      } else {
        const f = 10 ** -digits;
        result = apply(round15(abs / f)) * f;
      }
      return round15(sign * result);
    }

    function conditional(args, sheet, mode) {
      needArgs(args, 2, mode === "count" ? 2 : 3);
      const source = rangeOf(args[0], sheet);
      const test = makeCriteria(arg(args, 1, sheet));
      const target = mode !== "count" && args[2] ? rangeOf(args[2], sheet) : source;
      let sum = 0;
      let count = 0;
      for (let r = source.r1; r <= source.r2; r += 1) {
        for (let c = source.c1; c <= source.c2; c += 1) {
          if (!test(cell(source.sheet, r, c))) continue;
          if (mode === "count") {
            count += 1;
            continue;
          }
          const value = cell(target.sheet, target.r1 + (r - source.r1), target.c1 + (c - source.c1));
          if (isErr(value)) throw value;
          if (typeof value === "number") {
            sum += value;
            count += 1;
          }
        }
      }
      if (mode === "count") return count;
      if (mode === "avg") {
        if (!count) throw new SheetError(ERR.div0);
        return sum / count;
      }
      return sum;
    }

    function logical(args, sheet, mode) {
      if (!args.length) throw new SheetError(ERR.value);
      const seen = [];
      forEachValue(args, sheet, (value, fromRange) => {
        if (isErr(value)) throw value;
        if (fromRange) {
          if (typeof value === "boolean") seen.push(value);
          else if (typeof value === "number") seen.push(value !== 0);
          return;
        }
        seen.push(toBool(value));
      });
      if (!seen.length) throw new SheetError(ERR.value);
      return mode === "and" ? seen.every(Boolean) : seen.some(Boolean);
    }

    const FUNCS = {
      SUM: (args, sheet) => numbers(args, sheet).reduce((acc, n) => acc + n, 0),
      AVERAGE: (args, sheet) => {
        const list = numbers(args, sheet);
        if (!list.length) throw new SheetError(ERR.div0);
        return list.reduce((acc, n) => acc + n, 0) / list.length;
      },
      MIN: (args, sheet) => {
        const list = numbers(args, sheet);
        return list.length ? Math.min(...list) : 0;
      },
      MAX: (args, sheet) => {
        const list = numbers(args, sheet);
        return list.length ? Math.max(...list) : 0;
      },
      COUNT: (args, sheet) => {
        let count = 0;
        forEachValue(args, sheet, (value, fromRange) => {
          if (typeof value === "number") count += 1;
          else if (!fromRange && (typeof value === "boolean" || (typeof value === "string" && parseInputNumber(value)))) count += 1;
        });
        return count;
      },
      COUNTA: (args, sheet) => {
        let count = 0;
        forEachValue(args, sheet, (value) => {
          if (value !== null && value !== "") count += 1;
        });
        return count;
      },
      PRODUCT: (args, sheet) => {
        const list = numbers(args, sheet);
        return list.length ? list.reduce((acc, n) => acc * n, 1) : 0;
      },
      ROUND: (args, sheet) => roundWith(args, sheet, "round"),
      ROUNDUP: (args, sheet) => roundWith(args, sheet, "up"),
      ROUNDDOWN: (args, sheet) => roundWith(args, sheet, "down"),
      ABS: (args, sheet) => {
        needArgs(args, 1, 1);
        return Math.abs(toNum(arg(args, 0, sheet)));
      },
      SQRT: (args, sheet) => {
        needArgs(args, 1, 1);
        const x = toNum(arg(args, 0, sheet));
        if (x < 0) throw new SheetError(ERR.num);
        return Math.sqrt(x);
      },
      POWER: (args, sheet) => {
        needArgs(args, 2, 2);
        const result = Math.pow(toNum(arg(args, 0, sheet)), toNum(arg(args, 1, sheet)));
        if (!Number.isFinite(result)) throw new SheetError(ERR.num);
        return result;
      },
      MOD: (args, sheet) => {
        needArgs(args, 2, 2);
        const a = toNum(arg(args, 0, sheet));
        const b = toNum(arg(args, 1, sheet));
        if (b === 0) throw new SheetError(ERR.div0);
        return round15(a - b * Math.floor(a / b));
      },
      INT: (args, sheet) => {
        needArgs(args, 1, 1);
        return Math.floor(toNum(arg(args, 0, sheet)));
      },
      IF: (args, sheet) => {
        needArgs(args, 1, 3);
        const cond = toBool(arg(args, 0, sheet));
        const branch = cond ? 1 : 2;
        if (args.length <= branch) return cond;
        const node = args[branch];
        if (node === null) return 0;
        return evalNode(node, sheet);
      },
      AND: (args, sheet) => logical(args, sheet, "and"),
      OR: (args, sheet) => logical(args, sheet, "or"),
      NOT: (args, sheet) => {
        needArgs(args, 1, 1);
        return !toBool(arg(args, 0, sheet));
      },
      IFERROR: (args, sheet) => {
        needArgs(args, 2, 2);
        let value;
        try {
          value = arg(args, 0, sheet);
        } catch (error) {
          if (!isErr(error)) throw error;
          value = error;
        }
        if (isErr(value)) {
          if (args[1] === null) return 0;
          return evalNode(args[1], sheet);
        }
        return value == null ? 0 : value;
      },
      SUMIF: (args, sheet) => conditional(args, sheet, "sum"),
      COUNTIF: (args, sheet) => conditional(args, sheet, "count"),
      AVERAGEIF: (args, sheet) => conditional(args, sheet, "avg"),
      CONCAT: (args, sheet) => {
        let out = "";
        forEachValue(args, sheet, (value) => {
          out += toText(value);
        });
        return out;
      }
    };

    return {
      cell,
      sheetByName: (name) => byName.get(String(name).toLowerCase()) || null
    };
  }

  /* ---------- Fórmulas: reescritura de referencias ---------- */

  function quoteSheet(name) {
    if (PLAIN_SHEET_RE.test(name) && !/^[A-Za-z]{1,3}\d+$/.test(name) && !Object.prototype.hasOwnProperty.call(BOOL_WORDS, name.toUpperCase())) return name;
    return `'${name.replace(/'/g, "''")}'`;
  }

  function refText(sheetName, r, c, absR, absC) {
    const prefix = sheetName != null ? `${quoteSheet(sheetName)}!` : "";
    return `${prefix}${absC ? "$" : ""}${colName(c)}${absR ? "$" : ""}${r + 1}`;
  }

  function colText(c, abs) {
    return `${abs ? "$" : ""}${colName(c)}`;
  }

  function rewriteFormula(raw, visit) {
    if (!isFormula(raw)) return raw;
    const src = raw.slice(1);
    let tokens;
    try {
      tokens = tokenize(src);
    } catch {
      return raw;
    }
    let out = "";
    let last = 0;
    let changed = false;
    for (let i = 0; i < tokens.length; i += 1) {
      const tok = tokens[i];
      let group = null;
      if (tok.type === "ref") {
        const colon = tokens[i + 1];
        const other = tokens[i + 2];
        if (colon && colon.type === "colon" && other && other.type === "ref" && (other.sheet === null || (tok.sheet !== null && sameName(other.sheet, tok.sheet)))) {
          group = { kind: "range", a: tok, b: other, sheet: tok.sheet, start: tok.start, end: other.end };
          i += 2;
        } else {
          group = { kind: "cell", a: tok, sheet: tok.sheet, start: tok.start, end: tok.end };
        }
      } else if (tok.type === "cols") {
        group = { kind: "cols", a: tok, sheet: tok.sheet, start: tok.start, end: tok.end };
      }
      if (!group) continue;
      const replacement = visit(group);
      if (replacement == null) continue;
      out += src.slice(last, group.start) + replacement;
      last = group.end;
      changed = true;
    }
    if (!changed) return raw;
    return `=${out}${src.slice(last)}`;
  }

  function groupText(group, sheetName, parts) {
    const prefix = sheetName != null ? `${quoteSheet(sheetName)}!` : "";
    if (group.kind === "cell") {
      return `${prefix}${colText(parts.c1, group.a.absC)}${group.a.absR ? "$" : ""}${parts.r1 + 1}`;
    }
    if (group.kind === "range") {
      return `${prefix}${colText(parts.c1, group.a.absC)}${group.a.absR ? "$" : ""}${parts.r1 + 1}:${colText(parts.c2, group.b.absC)}${group.b.absR ? "$" : ""}${parts.r2 + 1}`;
    }
    return `${prefix}${colText(parts.c1, group.a.absC1)}:${colText(parts.c2, group.a.absC2)}`;
  }

  function groupParts(group) {
    if (group.kind === "cell") return { r1: group.a.r, c1: group.a.c, r2: group.a.r, c2: group.a.c };
    if (group.kind === "range") return { r1: group.a.r, c1: group.a.c, r2: group.b.r, c2: group.b.c };
    return { r1: null, c1: group.a.c1, r2: null, c2: group.a.c2 };
  }

  function shiftFormula(raw, dr, dc) {
    return rewriteFormula(raw, (group) => {
      const p = groupParts(group);
      const next = { ...p };
      if (group.kind === "cols") {
        if (!group.a.absC1) next.c1 = p.c1 + dc;
        if (!group.a.absC2) next.c2 = p.c2 + dc;
        if (next.c1 < 0 || next.c2 < 0) return ERR.ref;
      } else {
        const second = group.kind === "range" ? group.b : group.a;
        if (!group.a.absR) next.r1 = p.r1 + dr;
        if (!group.a.absC) next.c1 = p.c1 + dc;
        if (!second.absR) next.r2 = p.r2 + dr;
        if (!second.absC) next.c2 = p.c2 + dc;
        if (next.r1 < 0 || next.c1 < 0 || next.r2 < 0 || next.c2 < 0) return ERR.ref;
      }
      if (next.r1 === p.r1 && next.c1 === p.c1 && next.r2 === p.r2 && next.c2 === p.c2) return null;
      return groupText(group, group.sheet, next);
    });
  }

  function remapIndex(p, axisOp) {
    const { at, count, remove } = axisOp;
    if (!remove) return p >= at ? p + count : p;
    if (p >= at && p < at + count) return null;
    return p >= at + count ? p - count : p;
  }

  function remapSpan(lo, hi, axisOp) {
    const { at, count, remove } = axisOp;
    if (!remove) return [lo >= at ? lo + count : lo, hi >= at ? hi + count : hi];
    const end = at + count;
    if (lo >= at && hi < end) return null;
    const newLo = lo < at ? lo : lo >= end ? lo - count : at;
    const newHi = hi < at ? hi : hi >= end ? hi - count : at - 1;
    return [newLo, newHi];
  }

  function structuralRewrite(raw, owner, target, model, axis, axisOp) {
    return rewriteFormula(raw, (group) => {
      const refSheet = group.sheet == null ? owner : model.sheets.find((s) => sameName(s.name, group.sheet));
      if (refSheet !== target) return null;
      const p = groupParts(group);
      if (group.kind === "cols") {
        if (axis !== "col") return null;
        const span = remapSpan(Math.min(p.c1, p.c2), Math.max(p.c1, p.c2), axisOp);
        if (!span) return ERR.ref;
        const flipped = p.c1 > p.c2;
        const next = { c1: flipped ? span[1] : span[0], c2: flipped ? span[0] : span[1] };
        if (next.c1 === p.c1 && next.c2 === p.c2) return null;
        return groupText(group, group.sheet, next);
      }
      const next = { ...p };
      if (group.kind === "cell") {
        if (axis === "row") next.r1 = next.r2 = remapIndex(p.r1, axisOp);
        else next.c1 = next.c2 = remapIndex(p.c1, axisOp);
        if (next.r1 === null || next.c1 === null) return ERR.ref;
      } else {
        const lo = axis === "row" ? Math.min(p.r1, p.r2) : Math.min(p.c1, p.c2);
        const hi = axis === "row" ? Math.max(p.r1, p.r2) : Math.max(p.c1, p.c2);
        const span = remapSpan(lo, hi, axisOp);
        if (!span) return ERR.ref;
        const flipped = axis === "row" ? p.r1 > p.r2 : p.c1 > p.c2;
        const first = flipped ? span[1] : span[0];
        const second = flipped ? span[0] : span[1];
        if (axis === "row") {
          next.r1 = first;
          next.r2 = second;
        } else {
          next.c1 = first;
          next.c2 = second;
        }
      }
      if (next.r1 === p.r1 && next.c1 === p.c1 && next.r2 === p.r2 && next.c2 === p.c2) return null;
      return groupText(group, group.sheet, next);
    });
  }

  function renameRewrite(raw, oldName, newName) {
    return rewriteFormula(raw, (group) => {
      if (group.sheet == null || !sameName(group.sheet, oldName)) return null;
      return groupText(group, newName, groupParts(group));
    });
  }

  function dropSheetRewrite(raw, name) {
    return rewriteFormula(raw, (group) => {
      if (group.sheet == null || !sameName(group.sheet, name)) return null;
      return ERR.ref;
    });
  }

  function prettifyFormula(raw) {
    if (!isFormula(raw)) return raw;
    const src = raw.slice(1);
    let tokens;
    try {
      tokens = tokenize(src);
    } catch {
      return raw;
    }
    let out = "";
    let last = 0;
    let depth = 0;
    tokens.forEach((tok, index) => {
      let text = null;
      if (tok.type === "ident" && tokens[index + 1] && tokens[index + 1].type === "lp") text = tok.value.toUpperCase();
      else if (tok.type === "bool") text = src.slice(tok.start, tok.end).toUpperCase();
      else if (tok.type === "ref" || tok.type === "cols") {
        const original = src.slice(tok.start, tok.end);
        const bang = original.lastIndexOf("!");
        text = bang >= 0 ? original.slice(0, bang + 1) + original.slice(bang + 1).toUpperCase() : original.toUpperCase();
      }
      if (tok.type === "lp") depth += 1;
      if (tok.type === "rp") depth -= 1;
      if (text === null) return;
      out += src.slice(last, tok.start) + text;
      last = tok.end;
    });
    out += src.slice(last);
    if (depth > 0) out += ")".repeat(depth);
    return `=${out}`;
  }

  /* ---------- Formato de lo que se ve ---------- */

  const NF = {
    general: new Intl.NumberFormat("es-CO", { maximumFractionDigits: 6 }),
    money0: new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0, maximumFractionDigits: 0 }),
    money2: new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    num2: new Intl.NumberFormat("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    pct: new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 })
  };

  function formatNumber(value, fmt) {
    const x = round15(value);
    if (fmt === "money") {
      const cents = Math.abs(x - Math.round(x)) > 1e-9;
      return (cents ? NF.money2 : NF.money0).format(x);
    }
    if (fmt === "pct") return `${NF.pct.format(round15(x * 100))}%`;
    if (fmt === "num") return NF.num2.format(x);
    const abs = Math.abs(x);
    if (abs !== 0 && (abs < 1e-6 || abs >= 1e15)) return x.toExponential(3).replace(".", ",");
    return NF.general.format(x);
  }

  function display(value, data) {
    if (value == null || value === "") return { text: "", kind: "" };
    if (isErr(value)) return { text: value.code, kind: "err" };
    if (typeof value === "boolean") return { text: value ? "VERDADERO" : "FALSO", kind: "bool" };
    if (typeof value === "number") return { text: formatNumber(value, data && data.f), kind: "num" };
    return { text: String(value), kind: "text" };
  }

  /* ---------- Modelo ---------- */

  function cleanSheetName(name) {
    return String(name == null ? "" : name).replace(/['!]/g, "").replace(/\s+/g, " ").trim().slice(0, 31);
  }

  function uniqueName(base, taken, skip) {
    const used = new Set(taken.filter((name) => name !== skip).map((name) => name.toLowerCase()));
    const clean = cleanSheetName(base) || "Hoja";
    if (!used.has(clean.toLowerCase())) return clean;
    let n = 2;
    while (used.has(`${clean} (${n})`.toLowerCase())) n += 1;
    return `${clean} (${n})`;
  }

  function nextSheetName(taken) {
    const used = new Set(taken.map((name) => name.toLowerCase()));
    let n = taken.length + 1;
    while (used.has(`hoja${n}`)) n += 1;
    return `Hoja${n}`;
  }

  function blankSheet(name) {
    return { id: uid(), name, rows: DEFAULT_ROWS, cols: DEFAULT_COLS, cells: {}, widths: {}, merges: [] };
  }

  function rangesOverlap(a, b) {
    return a.r1 <= b.r2 && a.r2 >= b.r1 && a.c1 <= b.c2 && a.c2 >= b.c1;
  }

  function normalizeMerges(list) {
    const out = [];
    (Array.isArray(list) ? list : []).forEach((raw) => {
      if (!raw || typeof raw !== "object") return;
      const nums = [raw.r1, raw.c1, raw.r2, raw.c2].map(Number);
      if (!nums.every((n) => Number.isInteger(n) && n >= 0)) return;
      const merge = {
        r1: Math.min(nums[0], nums[2]),
        c1: Math.min(nums[1], nums[3]),
        r2: Math.min(Math.max(nums[0], nums[2]), MAX_ROWS - 1),
        c2: Math.min(Math.max(nums[1], nums[3]), MAX_COLS - 1)
      };
      if (merge.r1 > merge.r2 || merge.c1 > merge.c2) return;
      if (merge.r1 === merge.r2 && merge.c1 === merge.c2) return;
      if (out.some((other) => rangesOverlap(other, merge))) return;
      out.push(merge);
    });
    return out;
  }

  function normalizeCell(raw) {
    if (!raw || typeof raw !== "object") return null;
    const cell = {};
    if (raw.v != null && raw.v !== "") cell.v = String(raw.v);
    if (raw.b) cell.b = 1;
    if (FORMAT_IDS.has(raw.f)) cell.f = raw.f;
    if (ALIGNS.has(raw.a)) cell.a = raw.a;
    if (FILL_IDS.has(raw.bg)) cell.bg = raw.bg;
    return Object.keys(cell).length ? cell : null;
  }

  function normalizeSheet(raw, index, taken) {
    const source = raw && typeof raw === "object" ? raw : {};
    const cells = {};
    let maxR = -1;
    let maxC = -1;
    if (source.cells && typeof source.cells === "object") {
      Object.entries(source.cells).forEach(([key, value]) => {
        const m = /^(\d+):(\d+)$/.exec(key);
        if (!m) return;
        const r = Number(m[1]);
        const c = Number(m[2]);
        if (r >= MAX_ROWS || c >= MAX_COLS) return;
        const cell = normalizeCell(value);
        if (!cell) return;
        cells[cellKey(r, c)] = cell;
        maxR = Math.max(maxR, r);
        maxC = Math.max(maxC, c);
      });
    }
    const widths = {};
    if (source.widths && typeof source.widths === "object") {
      Object.entries(source.widths).forEach(([key, value]) => {
        const c = Number(key);
        const w = Number(value);
        if (Number.isInteger(c) && c >= 0 && c < MAX_COLS && Number.isFinite(w)) widths[c] = clamp(Math.round(w), MIN_WIDTH, MAX_WIDTH);
      });
    }
    const merges = normalizeMerges(source.merges);
    merges.forEach((merge) => {
      maxR = Math.max(maxR, merge.r2);
      maxC = Math.max(maxC, merge.c2);
    });
    const name = uniqueName(cleanSheetName(source.name) || `Hoja${index + 1}`, taken);
    taken.push(name);
    return {
      id: typeof source.id === "string" && source.id ? source.id : uid(),
      name,
      rows: clamp(Math.max(Number(source.rows) || DEFAULT_ROWS, maxR + 1), 1, MAX_ROWS),
      cols: clamp(Math.max(Number(source.cols) || DEFAULT_COLS, maxC + 1), 1, MAX_COLS),
      cells,
      widths,
      merges
    };
  }

  function sheetBuilder(name) {
    const sheet = blankSheet(name);
    let maxR = 0;
    let maxC = 0;
    return {
      sheet,
      set(r, c, v, extra) {
        const cell = { ...(extra || {}) };
        if (v != null && v !== "") cell.v = String(v);
        if (Object.keys(cell).length) sheet.cells[cellKey(r, c)] = cell;
        maxR = Math.max(maxR, r);
        maxC = Math.max(maxC, c);
      },
      width(c, w) {
        sheet.widths[c] = w;
      },
      done() {
        sheet.rows = Math.max(DEFAULT_ROWS, maxR + 6);
        sheet.cols = Math.max(DEFAULT_COLS, maxC + 3);
        return sheet;
      }
    };
  }

  const HEAD = { b: 1, bg: "slate" };

  function migrateLegacy(source) {
    const sheets = [];
    const taken = [];
    const add = (builder) => {
      const sheet = builder.done();
      sheet.name = uniqueName(sheet.name, taken);
      taken.push(sheet.name);
      sheets.push(sheet);
    };

    const valueRows = Array.isArray(source.rows) ? source.rows : [];
    const salary = Number(source.salary) || 0;
    if (salary || valueRows.length) {
      const b = sheetBuilder("Tabla de valores");
      b.width(0, 200);
      b.width(1, 150);
      b.width(2, 120);
      b.set(0, 0, "Concepto", HEAD);
      b.set(0, 1, "Valor", { ...HEAD, a: "right" });
      b.set(0, 2, "Porcentaje", { ...HEAD, a: "right" });
      b.set(1, 0, "Salario", { b: 1 });
      b.set(1, 1, salary || "", { f: "money" });
      const rows = valueRows.length ? valueRows : [{ concept: "", amount: 0 }];
      rows.forEach((row, i) => {
        const r = i + 2;
        b.set(r, 0, row.concept || "");
        b.set(r, 1, Number(row.amount) ? String(Number(row.amount)) : "", { f: "money" });
        b.set(r, 2, `=SI.ERROR(B${r + 1}/$B$2;0)`, { f: "pct" });
      });
      const first = 3;
      const last = rows.length + 2;
      const savingRow = rows.length + 2;
      b.set(savingRow, 0, "Ahorro", { b: 1 });
      b.set(savingRow, 1, `=SUMA(B${first}:B${last})-B2`, { f: "money", b: 1 });
      b.set(savingRow + 1, 0, "TOTAL", { b: 1, bg: "green" });
      b.set(savingRow + 1, 1, `=SUMA(B${first}:B${last})`, { f: "money", b: 1, bg: "green" });
      b.set(savingRow + 1, 2, "", { bg: "green" });
      add(b);
    }

    const investRows = Array.isArray(source.investments) ? source.investments : [];
    if (investRows.length) {
      const b = sheetBuilder("Inversiones");
      b.width(0, 160);
      b.width(1, 150);
      b.set(0, 0, "Mes", HEAD);
      b.set(0, 1, "Valor", { ...HEAD, a: "right" });
      b.set(0, 2, "Día", HEAD);
      investRows.forEach((row, i) => {
        b.set(i + 1, 0, row.month || "");
        b.set(i + 1, 1, Number(row.amount) ? String(Number(row.amount)) : "", { f: "money" });
        b.set(i + 1, 2, row.day || "", { f: "text" });
      });
      const totalRow = investRows.length + 1;
      b.set(totalRow, 0, "TOTAL", { b: 1, bg: "green" });
      b.set(totalRow, 1, `=SUMA(B2:B${totalRow})`, { f: "money", b: 1, bg: "green" });
      b.set(totalRow, 2, "", { bg: "green" });
      add(b);
    }

    const tables = Array.isArray(source.tables) ? source.tables : [];
    tables.forEach((table) => {
      if (!table || typeof table !== "object") return;
      const columns = Array.isArray(table.columns) && table.columns.length ? table.columns : [{ id: "c", name: "Columna" }];
      const rows = Array.isArray(table.rows) ? table.rows : [];
      const b = sheetBuilder(table.name || (table.kind === "note" ? "Notas" : "Tabla"));
      columns.forEach((col, c) => {
        b.width(c, col.numeric ? 140 : 160);
        b.set(0, c, col.name || "Columna", col.numeric ? { ...HEAD, a: "right" } : HEAD);
      });
      rows.forEach((row, i) => {
        columns.forEach((col, c) => {
          const raw = row && row.cells ? row.cells[col.id] : "";
          if (col.numeric) {
            const n = Number(raw);
            b.set(i + 1, c, Number.isFinite(n) && n ? String(n) : "", { f: "money" });
          } else {
            b.set(i + 1, c, raw == null ? "" : String(raw), /^\d/.test(String(raw || "")) ? { f: "text" } : null);
          }
        });
      });
      const firstData = 2;
      const lastData = rows.length + 1;
      const hasRows = rows.length > 0;
      const rowTotal = Boolean(table.rowTotal);
      const numericCols = columns.map((col, c) => (col.numeric ? c : -1)).filter((c) => c >= 0);
      const totalCol = columns.length;
      if (rowTotal) {
        b.width(totalCol, 140);
        b.set(0, totalCol, "Total", { ...HEAD, a: "right" });
        rows.forEach((_, i) => {
          const r = i + 2;
          const formula = numericCols.length ? `=${numericCols.map((c) => `${colName(c)}${r}`).join("+")}` : "=0";
          b.set(i + 1, totalCol, formula, { f: "money", b: 1 });
        });
      }
      const total = table.total && columns.findIndex((col) => col.id === table.total.columnId);
      const wantsTotal = (typeof total === "number" && total >= 0) || (rowTotal && table.sumRowTotals);
      if (wantsTotal && hasRows) {
        const r = rows.length + 1;
        const lastCol = rowTotal ? totalCol : columns.length - 1;
        for (let c = 0; c <= lastCol; c += 1) b.set(r, c, "", { bg: "green" });
        if (typeof total === "number" && total >= 0) {
          const L = colName(total);
          const formula = table.total.op === "sub"
            ? (rows.length > 1 ? `=${L}${firstData}-SUMA(${L}${firstData + 1}:${L}${lastData})` : `=${L}${firstData}`)
            : `=SUMA(${L}${firstData}:${L}${lastData})`;
          b.set(r, total, formula, { f: "money", b: 1, bg: "green" });
        }
        if (rowTotal && table.sumRowTotals) {
          const L = colName(totalCol);
          b.set(r, totalCol, `=SUMA(${L}${firstData}:${L}${lastData})`, { f: "money", b: 1, bg: "green" });
        }
        const labelCol = total === 0 ? (columns.length > 1 ? 1 : -1) : 0;
        if (labelCol >= 0 && labelCol !== total) b.set(r, labelCol, "TOTAL", { b: 1, bg: "green" });
      }
      add(b);
    });
    return sheets;
  }

  function normalize(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    let sheets;
    if (Array.isArray(source.sheets) && source.sheets.length) {
      const taken = [];
      sheets = source.sheets.map((sheet, index) => normalizeSheet(sheet, index, taken));
    } else {
      sheets = migrateLegacy(source);
    }
    if (!sheets.length) sheets = [blankSheet("Hoja1")];
    const active = sheets.some((sheet) => sheet.id === source.active) ? source.active : sheets[0].id;
    return { version: 2, active, sheets };
  }

  /* ---------- Operaciones sobre la hoja ---------- */

  function moveCells(sheet, axis, axisOp) {
    const next = {};
    Object.entries(sheet.cells).forEach(([key, cell]) => {
      const [r, c] = key.split(":").map(Number);
      if (axis === "row") {
        const nr = remapIndex(r, axisOp);
        if (nr === null || nr >= MAX_ROWS) return;
        next[cellKey(nr, c)] = cell;
      } else {
        const nc = remapIndex(c, axisOp);
        if (nc === null || nc >= MAX_COLS) return;
        next[cellKey(r, nc)] = cell;
      }
    });
    sheet.cells = next;
    if (Array.isArray(sheet.merges) && sheet.merges.length) {
      const limit = axis === "row" ? MAX_ROWS - 1 : MAX_COLS - 1;
      sheet.merges = sheet.merges.map((merge) => {
        const span = axis === "row" ? remapSpan(merge.r1, merge.r2, axisOp) : remapSpan(merge.c1, merge.c2, axisOp);
        if (!span || span[0] > span[1] || span[0] > limit) return null;
        const hi = Math.min(span[1], limit);
        const moved = axis === "row" ? { ...merge, r1: span[0], r2: hi } : { ...merge, c1: span[0], c2: hi };
        return moved.r1 === moved.r2 && moved.c1 === moved.c2 ? null : moved;
      }).filter(Boolean);
    }
    if (axis === "col") {
      const widths = {};
      Object.entries(sheet.widths || {}).forEach(([key, w]) => {
        const nc = remapIndex(Number(key), axisOp);
        if (nc !== null && nc < MAX_COLS) widths[nc] = w;
      });
      sheet.widths = widths;
    }
  }

  function applyStructure(model, sheet, axis, at, count, remove) {
    const axisOp = { at, count, remove };
    model.sheets.forEach((owner) => {
      Object.values(owner.cells).forEach((cell) => {
        if (isFormula(cell.v)) cell.v = structuralRewrite(cell.v, owner, sheet, model, axis, axisOp);
      });
    });
    moveCells(sheet, axis, axisOp);
    if (axis === "row") sheet.rows = clamp(sheet.rows + (remove ? -count : count), 1, MAX_ROWS);
    else sheet.cols = clamp(sheet.cols + (remove ? -count : count), 1, MAX_COLS);
  }

  function renameSheet(model, sheet, newName) {
    const oldName = sheet.name;
    model.sheets.forEach((owner) => {
      Object.values(owner.cells).forEach((cell) => {
        if (isFormula(cell.v)) cell.v = renameRewrite(cell.v, oldName, newName);
      });
    });
    sheet.name = newName;
  }

  function removeSheet(model, sheet) {
    model.sheets.forEach((owner) => {
      if (owner === sheet) return;
      Object.values(owner.cells).forEach((cell) => {
        if (isFormula(cell.v)) cell.v = dropSheetRewrite(cell.v, sheet.name);
      });
    });
    model.sheets = model.sheets.filter((item) => item !== sheet);
  }

  /* ---------- Portapapeles ---------- */

  function tsvField(text) {
    return /[\t\n"]/.test(text) ? `"${text.replace(/"/g, "\"\"")}"` : text;
  }

  function parseTsv(input, delimiter = "\t") {
    let text = String(input).replace(/\r\n?/g, "\n");
    if (text.endsWith("\n")) text = text.slice(0, -1);
    const rows = [];
    let row = [];
    let field = "";
    let quoted = false;
    for (let i = 0; i < text.length; i += 1) {
      const ch = text[i];
      if (quoted) {
        if (ch === "\"") {
          if (text[i + 1] === "\"") {
            field += "\"";
            i += 1;
          } else {
            quoted = false;
          }
        } else {
          field += ch;
        }
        continue;
      }
      if (ch === "\"" && field === "") {
        quoted = true;
        continue;
      }
      if (ch === delimiter) {
        row.push(field);
        field = "";
        continue;
      }
      if (ch === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
        continue;
      }
      field += ch;
    }
    row.push(field);
    rows.push(row);
    return rows;
  }

  function csvDelimiter(text) {
    const firstLine = String(text).split(/\r?\n/).find((line) => line.trim()) || "";
    const counts = { ";": 0, ",": 0, "\t": 0 };
    let quoted = false;
    for (const ch of firstLine) {
      if (ch === "\"") quoted = !quoted;
      else if (!quoted && ch in counts) counts[ch] += 1;
    }
    const best = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
    return counts[best] ? best : ";";
  }

  function csvField(value, data) {
    let text;
    if (value == null) text = "";
    else if (isErr(value)) text = value.code;
    else if (typeof value === "boolean") text = value ? "VERDADERO" : "FALSO";
    else if (typeof value === "number") text = data && data.f === "pct" ? formatNumber(value, "pct") : plainNumber(value);
    else text = String(value);
    return /[;"\n\r]/.test(text) || /^\s|\s$/.test(text) ? `"${text.replace(/"/g, "\"\"")}"` : text;
  }

  /* ---------- Interfaz ---------- */

  const SVG = (body, extra = "") => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${extra}>${body}</svg>`;
  const ICONS = {
    undo: SVG("<path d=\"M9 14 4 9l5-5\"/><path d=\"M4 9h10.5a5.5 5.5 0 0 1 0 11H11\"/>"),
    redo: SVG("<path d=\"m15 14 5-5-5-5\"/><path d=\"M20 9H9.5a5.5 5.5 0 0 0 0 11H13\"/>"),
    bold: SVG("<path d=\"M7 5h6a3.5 3.5 0 0 1 0 7H7z\"/><path d=\"M7 12h7a3.5 3.5 0 0 1 0 7H7z\"/>", " stroke-width=\"2.3\""),
    left: SVG("<path d=\"M4 6h16M4 10h10M4 14h16M4 18h10\"/>"),
    center: SVG("<path d=\"M4 6h16M7 10h10M4 14h16M7 18h10\"/>"),
    right: SVG("<path d=\"M4 6h16M10 10h10M4 14h16M10 18h10\"/>"),
    fill: SVG("<path d=\"m19 11-8-8-8.5 8.5a2.1 2.1 0 0 0 0 3L7 19a2.1 2.1 0 0 0 3 0z\"/><path d=\"m5 2 5 5\"/><path d=\"M2 13h15\"/><path d=\"M22 20a2 2 0 1 1-4 0c0-1.6 1.7-2.4 2-4 .3 1.6 2 2.4 2 4z\"/>"),
    merge: SVG("<rect x=\"3\" y=\"5\" width=\"18\" height=\"14\" rx=\"2\"/><path d=\"M3 12h6M21 12h-6\"/><path d=\"m7 9.5 2.5 2.5L7 14.5M17 9.5 14.5 12l2.5 2.5\"/>"),
    grid: SVG("<rect x=\"3\" y=\"4\" width=\"18\" height=\"16\" rx=\"2\"/><path d=\"M3 10h18M3 15h18M9 4v16\"/>"),
    upload: SVG("<path d=\"M12 15V3\"/><path d=\"m7 8 5-5 5 5\"/><path d=\"M5 21h14\"/>"),
    zoom: SVG("<circle cx=\"11\" cy=\"11\" r=\"6.5\"/><path d=\"m20 20-4.4-4.4\"/>"),
    minus: SVG("<path d=\"M5 12h14\"/>", " stroke-width=\"2\""),
    download: SVG("<path d=\"M12 3v12\"/><path d=\"m7 10 5 5 5-5\"/><path d=\"M5 21h14\"/>"),
    help: SVG("<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M9.6 9.2a2.5 2.5 0 0 1 4.8.8c0 1.7-2.4 2.2-2.4 3.6\"/><path d=\"M12 17h.01\"/>"),
    chevron: SVG("<path d=\"m6 9 6 6 6-6\"/>", " class=\"sheet-chevron\""),
    plus: SVG("<path d=\"M12 5v14M5 12h14\"/>", " stroke-width=\"2\""),
    more: SVG("<circle cx=\"5\" cy=\"12\" r=\"1\"/><circle cx=\"12\" cy=\"12\" r=\"1\"/><circle cx=\"19\" cy=\"12\" r=\"1\"/>", " stroke-width=\"2.4\"")
  };

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || "");
  const MOD = isMac ? "⌘" : "Ctrl";

  function create(container, options) {
    const opts = options || {};
    let model = opts.model && Array.isArray(opts.model.sheets) && opts.model.sheets.length ? opts.model : normalize(opts.model);
    const notify = () => {
      if (opts.onChange) opts.onChange(model);
    };
    const toast = (message, type) => {
      if (opts.toast) opts.toast(message, type);
    };

    let undoStack = [];
    let redoStack = [];
    let sel = { r: 0, c: 0, r2: 0, c2: 0 };
    const selBySheet = new Map();
    let editing = null;
    let pointing = null;
    let clip = null;
    let drag = null;
    let touchStart = null;
    let evaluator = null;
    let tds = [];
    let colEls = [];
    let colHeads = [];
    let rowHeads = [];
    let gridDims = "";
    let menuEl = null;
    let mergeMap = new Map();
    let zoom = clamp(Number(opts.zoom) || 1, ZOOM_MIN, ZOOM_MAX);
    let headColEl = null;
    const px = (w) => Math.round(w * zoom);

    const current = () => model.sheets.find((sheet) => sheet.id === model.active) || model.sheets[0];
    const widthOf = (sheet, c) => (sheet.widths && sheet.widths[c]) || DEFAULT_WIDTH;
    const mergeAt = (r, c) => mergeMap.get(cellKey(r, c)) || null;
    const isCovered = (r, c) => {
      const merge = mergeAt(r, c);
      return Boolean(merge) && (merge.r1 !== r || merge.c1 !== c);
    };

    function rebuildMerges() {
      mergeMap = new Map();
      (current().merges || []).forEach((merge) => {
        for (let r = merge.r1; r <= merge.r2; r += 1) {
          for (let c = merge.c1; c <= merge.c2; c += 1) mergeMap.set(cellKey(r, c), merge);
        }
      });
    }

    function expand(r1, c1, r2, c2) {
      const list = current().merges || [];
      const range = { r1, c1, r2, c2 };
      let changed = list.length > 0;
      while (changed) {
        changed = false;
        list.forEach((merge) => {
          if (!rangesOverlap(merge, range)) return;
          if (merge.r1 < range.r1) { range.r1 = merge.r1; changed = true; }
          if (merge.c1 < range.c1) { range.c1 = merge.c1; changed = true; }
          if (merge.r2 > range.r2) { range.r2 = merge.r2; changed = true; }
          if (merge.c2 > range.c2) { range.c2 = merge.c2; changed = true; }
        });
      }
      return range;
    }

    const norm = () => expand(
      Math.min(sel.r, sel.r2),
      Math.min(sel.c, sel.c2),
      Math.max(sel.r, sel.r2),
      Math.max(sel.c, sel.c2)
    );

    function isSingle() {
      const range = norm();
      const own = mergeAt(sel.r, sel.c);
      if (own) return own.r1 === range.r1 && own.c1 === range.c1 && own.r2 === range.r2 && own.c2 === range.c2;
      return range.r1 === range.r2 && range.c1 === range.c2;
    }

    function snapActive() {
      const own = mergeAt(sel.r, sel.c);
      if (!own || (own.r1 === sel.r && own.c1 === sel.c)) return;
      const collapsed = sel.r === sel.r2 && sel.c === sel.c2;
      sel.r = own.r1;
      sel.c = own.c1;
      if (collapsed) {
        sel.r2 = sel.r;
        sel.c2 = sel.c;
      }
    }

    /* Estructura */
    const root = el("div", "sheet");
    const bar = el("div", "sheet-bar");
    bar.setAttribute("role", "toolbar");
    bar.setAttribute("aria-label", "Herramientas de la hoja");

    function tool(icon, title, run, label) {
      const button = el("button", "sheet-tool");
      button.type = "button";
      button.title = title;
      button.setAttribute("aria-label", title);
      button.innerHTML = icon + (label ? `<span>${label}</span>` : "");
      button.addEventListener("mousedown", (event) => event.preventDefault());
      button.addEventListener("click", () => run(button));
      return button;
    }

    const sep = () => el("span", "sheet-sep");
    const btnUndo = tool(ICONS.undo, `Deshacer (${MOD}+Z)`, () => undo());
    const btnRedo = tool(ICONS.redo, `Rehacer (${MOD}+Y)`, () => redo());
    const btnBold = tool(ICONS.bold, `Negrita (${MOD}+B)`, () => toggleBold());
    const btnFormat = tool("", "Formato del número", (button) => openFormatMenu(button));
    btnFormat.classList.add("sheet-tool-menu", "sheet-format");
    const btnLeft = tool(ICONS.left, "Alinear a la izquierda", () => setAlign("left"));
    const btnCenter = tool(ICONS.center, "Centrar", () => setAlign("center"));
    const btnRight = tool(ICONS.right, "Alinear a la derecha", () => setAlign("right"));
    const btnFill = tool(`${ICONS.fill}<i class="sheet-fill-swatch"></i>${ICONS.chevron}`, "Color de fondo", (button) => openFillMenu(button));
    btnFill.classList.add("sheet-tool-menu");
    const btnMerge = tool(ICONS.merge, "Combinar celdas", () => toggleMerge(), "Combinar");
    const btnGrid = tool(`${ICONS.grid}`, "Insertar o eliminar filas y columnas", (button) => openGridMenu(button), "Filas y columnas");
    btnGrid.classList.add("sheet-tool-menu");
    btnGrid.insertAdjacentHTML("beforeend", ICONS.chevron);
    const spacer = el("span", "sheet-spacer");
    const btnImport = tool(ICONS.upload, "Cargar un archivo CSV en una hoja nueva", () => fileInput.click(), "Cargar CSV");
    const btnCsv = tool(ICONS.download, "Descargar esta hoja como CSV (se abre en Excel)", () => exportCsv(), "Descargar CSV");
    const fileInput = el("input");
    fileInput.type = "file";
    fileInput.accept = ".csv,.tsv,.txt,text/csv,text/plain";
    fileInput.hidden = true;
    fileInput.addEventListener("change", () => {
      const file = fileInput.files && fileInput.files[0];
      fileInput.value = "";
      if (file) importCsv(file);
    });
    const btnHelp = tool(ICONS.help, "Cómo usar la hoja", () => toggleHelp(), "Ayuda");
    bar.append(btnUndo, btnRedo, sep(), btnBold, btnFormat, sep(), btnLeft, btnCenter, btnRight, btnFill, sep(), btnMerge, btnGrid, spacer, btnImport, btnCsv, btnHelp, fileInput);

    const help = el("div", "sheet-help");
    help.hidden = true;
    help.innerHTML = `
      <div class="sheet-help-grid">
        <section>
          <h4>Lo básico</h4>
          <p>Haz clic en una celda y escribe. <b>Enter</b> guarda y baja; <b>Tab</b> guarda y pasa a la derecha. Doble clic o <b>F2</b> para corregir.</p>
          <p>Puedes escribir <b>1.500.000</b>, <b>$1.500.000</b>, <b>12,5</b> o <b>15%</b>.</p>
          <p>Selecciona varias celdas y usa <b>Combinar</b> para unirlas en una sola, por ejemplo para un título. Vuelve a tocarlo para separarlas.</p>
        </section>
        <section>
          <h4>Fórmulas</h4>
          <p>Empiezan con <b>=</b>. Por ejemplo <code>=B2+B3</code>, <code>=B2*12</code> o <code>=SUMA(B2:B10)</code>. Mientras escribes una fórmula, haz clic en otra celda para usarla.</p>
          <p>Para usar otra hoja: <code>=Hoja2!B3</code>.</p>
        </section>
        <section>
          <h4>Atajos</h4>
          <p><b>${MOD}+C</b> / <b>${MOD}+V</b> copiar y pegar, también desde Excel o Google Sheets · <b>${MOD}+Z</b> deshacer · <b>${MOD}+B</b> negrita · <b>Supr</b> borrar · <b>${MOD}+D</b> copiar hacia abajo · <b>Shift + flechas</b> seleccionar.</p>
          <p>Clic derecho sobre una celda o encabezado para insertar o eliminar filas y columnas, o para darles un ancho exacto con <b>Ancho de la columna…</b></p>
          <p>Usa la lupa de abajo a la derecha para ver la hoja más grande o más pequeña. También funciona con <b>Ctrl + rueda del mouse</b> o pellizcando en el trackpad.</p>
          <p><b>Cargar CSV</b> abre un archivo en una hoja nueva para seguir editándolo.</p>
        </section>
      </div>
      <h4>Funciones disponibles</h4>
      <ul class="sheet-help-fns">${HELP_FUNCTIONS.map(([name, text]) => `<li><b>${name}</b><span>${text.replace(/</g, "&lt;")}</span></li>`).join("")}</ul>
      <p class="sheet-help-note">Separa los datos de una función con <b>;</b> y usa la coma para decimales: <code>=REDONDEAR(B2;2)</code>. También funcionan los nombres en inglés con coma: <code>=ROUND(B2,2)</code>.</p>`;

    const fbar = el("div", "sheet-formula");
    const refBox = el("div", "sheet-ref", "A1");
    const fxLabel = el("span", "sheet-fx", "fx");
    const fxInput = el("input", "sheet-fx-input");
    fxInput.type = "text";
    fxInput.spellcheck = false;
    fxInput.autocomplete = "off";
    fxInput.setAttribute("aria-label", "Contenido de la celda");
    fxInput.placeholder = "Escribe un valor o una fórmula que empiece con =";
    fbar.append(refBox, fxLabel, fxInput);

    const viewport = el("div", "sheet-viewport");
    const canvas = el("div", "sheet-canvas");
    const table = el("table", "sheet-grid");
    const colgroup = el("colgroup");
    const thead = el("thead");
    const tbody = el("tbody");
    table.append(colgroup, thead, tbody);
    const selBox = el("div", "sheet-sel");
    const activeBox = el("div", "sheet-active");
    const clipBox = el("div", "sheet-clip");
    const pointBox = el("div", "sheet-point");
    const editor = el("textarea", "sheet-editor");
    editor.rows = 1;
    editor.spellcheck = false;
    editor.setAttribute("autocomplete", "off");
    editor.setAttribute("autocapitalize", "off");
    editor.setAttribute("autocorrect", "off");
    editor.setAttribute("wrap", "off");
    editor.setAttribute("aria-label", "Celda");
    clipBox.hidden = true;
    pointBox.hidden = true;
    canvas.append(table, selBox, activeBox, clipBox, pointBox, editor);
    viewport.appendChild(canvas);

    const foot = el("div", "sheet-foot");
    const tabsBox = el("div", "sheet-tabs");
    tabsBox.setAttribute("role", "tablist");
    tabsBox.setAttribute("aria-label", "Hojas");
    const status = el("div", "sheet-status");
    status.setAttribute("aria-live", "polite");
    const zoomBox = el("div", "sheet-zoom");
    const zoomOut = el("button", "sheet-zoom-btn");
    zoomOut.type = "button";
    zoomOut.innerHTML = ICONS.minus;
    zoomOut.title = "Alejar";
    zoomOut.setAttribute("aria-label", "Alejar la hoja");
    const zoomRange = el("input", "sheet-zoom-range");
    zoomRange.type = "range";
    zoomRange.min = String(ZOOM_MIN * 100);
    zoomRange.max = String(ZOOM_MAX * 100);
    zoomRange.step = "5";
    zoomRange.setAttribute("aria-label", "Zoom de la hoja");
    const zoomIn = el("button", "sheet-zoom-btn");
    zoomIn.type = "button";
    zoomIn.innerHTML = ICONS.plus;
    zoomIn.title = "Acercar";
    zoomIn.setAttribute("aria-label", "Acercar la hoja");
    const zoomValue = el("button", "sheet-zoom-value");
    zoomValue.type = "button";
    zoomValue.title = "Elegir el zoom de la hoja";
    [zoomOut, zoomIn, zoomValue].forEach((button) => button.addEventListener("mousedown", (event) => event.preventDefault()));
    zoomBox.append(zoomOut, zoomRange, zoomIn, zoomValue);
    foot.append(tabsBox, status, zoomBox);

    root.append(bar, help, fbar, viewport, foot);
    container.replaceChildren(root);

    /* Dibujo */
    function buildGrid() {
      const sheet = current();
      colgroup.replaceChildren();
      thead.replaceChildren();
      tbody.replaceChildren();
      colEls = [];
      colHeads = [];
      rowHeads = [];
      tds = [];
      headColEl = el("col");
      colgroup.appendChild(headColEl);
      for (let c = 0; c < sheet.cols; c += 1) {
        const col = el("col");
        colgroup.appendChild(col);
        colEls.push(col);
      }
      applyWidths();
      const hr = el("tr");
      const corner = el("th", "sheet-corner");
      corner.title = "Seleccionar todo";
      hr.appendChild(corner);
      for (let c = 0; c < sheet.cols; c += 1) {
        const th = el("th", "sheet-colhead", colName(c));
        th.dataset.c = String(c);
        const handle = el("span", "sheet-resize");
        handle.dataset.c = String(c);
        handle.title = "Arrastra para cambiar el ancho · doble clic para ajustarlo";
        th.appendChild(handle);
        hr.appendChild(th);
        colHeads.push(th);
      }
      thead.appendChild(hr);
      const frag = document.createDocumentFragment();
      for (let r = 0; r < sheet.rows; r += 1) {
        const tr = el("tr");
        const th = el("th", "sheet-rowhead", String(r + 1));
        th.dataset.r = String(r);
        tr.appendChild(th);
        rowHeads.push(th);
        const row = [];
        for (let c = 0; c < sheet.cols; c += 1) {
          const td = el("td", "sheet-cell");
          td.dataset.r = String(r);
          td.dataset.c = String(c);
          tr.appendChild(td);
          row.push(td);
        }
        tds.push(row);
        frag.appendChild(tr);
      }
      tbody.appendChild(frag);
      gridDims = dimsKey();
    }

    function applyWidths(override) {
      const sheet = current();
      if (headColEl) headColEl.style.width = `${px(HEAD_WIDTH)}px`;
      let total = px(HEAD_WIDTH);
      colEls.forEach((col, c) => {
        const w = px(override && override.c === c ? override.w : widthOf(sheet, c));
        col.style.width = `${w}px`;
        total += w;
      });
      table.style.width = `${total}px`;
    }

    function paintZoom() {
      const pct = Math.round(zoom * 100);
      root.style.setProperty("--sheet-zoom", String(zoom));
      zoomValue.innerHTML = `${ICONS.zoom}<span>${pct}%</span>`;
      zoomRange.value = String(pct);
      zoomOut.disabled = zoom <= ZOOM_MIN + 0.001;
      zoomIn.disabled = zoom >= ZOOM_MAX - 0.001;
    }

    function setZoom(next) {
      const value = clamp(Math.round(next * 100) / 100, ZOOM_MIN, ZOOM_MAX);
      if (Math.abs(value - zoom) < 0.001) {
        paintZoom();
        return;
      }
      const ratio = value / zoom;
      const cx = viewport.scrollLeft + viewport.clientWidth / 2;
      const cy = viewport.scrollTop + viewport.clientHeight / 2;
      zoom = value;
      paintZoom();
      applyWidths();
      paintSelection();
      if (editing) placeEditor();
      viewport.scrollLeft = Math.max(0, cx * ratio - viewport.clientWidth / 2);
      viewport.scrollTop = Math.max(0, cy * ratio - viewport.clientHeight / 2);
      if (opts.onZoom) opts.onZoom(zoom);
    }

    function stepZoom(direction) {
      const next = direction > 0
        ? ZOOM_STEPS.find((step) => step > zoom + 0.001)
        : ZOOM_STEPS.slice().reverse().find((step) => step < zoom - 0.001);
      setZoom(next == null ? (direction > 0 ? ZOOM_MAX : ZOOM_MIN) : next);
    }

    function openZoomMenu() {
      openMenu(ZOOM_STEPS.slice().reverse().map((step) => ({
        label: `${Math.round(step * 100)}%`,
        active: Math.abs(step - zoom) < 0.001,
        run: () => setZoom(step)
      })), { anchor: zoomValue });
    }

    zoomOut.addEventListener("click", () => stepZoom(-1));
    zoomIn.addEventListener("click", () => stepZoom(1));
    zoomValue.addEventListener("click", () => openZoomMenu());
    zoomRange.addEventListener("input", () => setZoom(Number(zoomRange.value) / 100));

    let pendingZoom = null;
    viewport.addEventListener("wheel", (event) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      const base = pendingZoom == null ? zoom : pendingZoom;
      pendingZoom = clamp(base * Math.exp(-event.deltaY * 0.01), ZOOM_MIN, ZOOM_MAX);
      const run = () => {
        if (pendingZoom == null) return;
        const target = pendingZoom;
        pendingZoom = null;
        setZoom(target);
      };
      if (typeof requestAnimationFrame === "function") requestAnimationFrame(run);
      else run();
    }, { passive: false });

    function dimsKey() {
      const sheet = current();
      return `${sheet.id}|${sheet.rows}|${sheet.cols}|${JSON.stringify(sheet.widths || {})}`;
    }

    function paintCells() {
      const sheet = current();
      rebuildMerges();
      evaluator = createEvaluator(model);
      for (let r = 0; r < sheet.rows; r += 1) {
        for (let c = 0; c < sheet.cols; c += 1) paintCell(sheet, r, c);
      }
    }

    function paintCell(sheet, r, c) {
      const td = tds[r] && tds[r][c];
      if (!td) return;
      const data = sheet.cells[cellKey(r, c)];
      const value = data ? evaluator.cell(sheet, r, c) : null;
      const shown = display(value, data);
      if (td.textContent !== shown.text) td.textContent = shown.text;
      let cls = "sheet-cell";
      if (shown.kind) cls += ` is-${shown.kind}`;
      if (data) {
        if (data.b) cls += " is-bold";
        if (data.a) cls += ` al-${data.a}`;
        if (data.bg) cls += ` fill-${data.bg}`;
      }
      const merge = mergeMap.get(cellKey(r, c));
      let hide = false;
      let rowSpan = 1;
      let colSpan = 1;
      if (merge) {
        if (merge.r1 === r && merge.c1 === c) {
          rowSpan = merge.r2 - merge.r1 + 1;
          colSpan = merge.c2 - merge.c1 + 1;
          cls += " is-merged";
        } else {
          hide = true;
        }
      }
      if (td.className !== cls) td.className = cls;
      if (td.hidden !== hide) td.hidden = hide;
      if (td.rowSpan !== rowSpan) td.rowSpan = rowSpan;
      if (td.colSpan !== colSpan) td.colSpan = colSpan;
      const title = shown.kind === "err" ? ERR_HELP[shown.text] || "" : (shown.text.length > 16 ? shown.text : "");
      if (td.title !== title) td.title = title;
    }

    function rectOf(r1, c1, r2, c2) {
      const range = expand(Math.min(r1, r2), Math.min(c1, c2), Math.max(r1, r2), Math.max(c1, c2));
      const end = mergeAt(range.r2, range.c2);
      const a = tds[range.r1] && tds[range.r1][range.c1];
      const b = end ? tds[end.r1] && tds[end.r1][end.c1] : tds[range.r2] && tds[range.r2][range.c2];
      if (!a || !b) return null;
      return {
        left: a.offsetLeft,
        top: a.offsetTop,
        width: b.offsetLeft + b.offsetWidth - a.offsetLeft,
        height: b.offsetTop + b.offsetHeight - a.offsetTop
      };
    }

    function place(box, rect) {
      if (!rect) {
        box.hidden = true;
        return;
      }
      box.hidden = false;
      box.style.left = `${rect.left}px`;
      box.style.top = `${rect.top}px`;
      box.style.width = `${rect.width}px`;
      box.style.height = `${rect.height}px`;
    }

    function paintSelection() {
      const sheet = current();
      sel.r = clamp(sel.r, 0, sheet.rows - 1);
      sel.c = clamp(sel.c, 0, sheet.cols - 1);
      sel.r2 = clamp(sel.r2, 0, sheet.rows - 1);
      sel.c2 = clamp(sel.c2, 0, sheet.cols - 1);
      snapActive();
      const { r1, c1, r2, c2 } = norm();
      const multi = !isSingle();
      place(selBox, multi ? rectOf(r1, c1, r2, c2) : null);
      place(activeBox, rectOf(sel.r, sel.c, sel.r, sel.c));
      const fullCols = r1 === 0 && r2 === sheet.rows - 1;
      const fullRows = c1 === 0 && c2 === sheet.cols - 1;
      colHeads.forEach((th, c) => {
        th.classList.toggle("is-hl", c >= c1 && c <= c2);
        th.classList.toggle("is-full", fullCols && c >= c1 && c <= c2);
      });
      rowHeads.forEach((th, r) => {
        th.classList.toggle("is-hl", r >= r1 && r <= r2);
        th.classList.toggle("is-full", fullRows && r >= r1 && r <= r2);
      });
      refBox.textContent = multi ? `${addr(r1, c1)}:${addr(r2, c2)}` : addr(sel.r, sel.c);
      const data = sheet.cells[cellKey(sel.r, sel.c)] || {};
      if (!editing) fxInput.value = data.v == null ? "" : String(data.v);
      if (editing) placeEditor();
      else placeCapture();
      paintClip();
      paintToolbar(data);
      paintStatus();
    }

    function paintClip() {
      if (!clip || clip.sheetId !== current().id) {
        clipBox.hidden = true;
        return;
      }
      const sheet = current();
      const r2 = Math.min(clip.r2, sheet.rows - 1);
      const c2 = Math.min(clip.c2, sheet.cols - 1);
      if (clip.r1 > r2 || clip.c1 > c2) {
        clipBox.hidden = true;
        return;
      }
      place(clipBox, rectOf(clip.r1, clip.c1, r2, c2));
    }

    function paintToolbar(data) {
      const merged = isSingle() && Boolean(mergeAt(sel.r, sel.c));
      if (btnMerge.classList.contains("is-on") !== merged || !btnMerge.dataset.ready) {
        btnMerge.dataset.ready = "1";
        btnMerge.classList.toggle("is-on", merged);
        const label = merged ? "Separar celdas" : "Combinar celdas";
        btnMerge.title = label;
        btnMerge.setAttribute("aria-label", label);
        btnMerge.innerHTML = `${ICONS.merge}<span>${merged ? "Separar" : "Combinar"}</span>`;
      }
      btnUndo.disabled = !undoStack.length;
      btnRedo.disabled = !redoStack.length;
      btnBold.classList.toggle("is-on", Boolean(data.b));
      const align = data.a || "";
      btnLeft.classList.toggle("is-on", align === "left");
      btnCenter.classList.toggle("is-on", align === "center");
      btnRight.classList.toggle("is-on", align === "right");
      const fmt = FORMATS.find((item) => item.id === (data.f || "")) || FORMATS[0];
      btnFormat.innerHTML = `<span>${fmt.label}</span>${ICONS.chevron}`;
      const swatch = btnFill.querySelector(".sheet-fill-swatch");
      if (swatch) swatch.className = `sheet-fill-swatch${data.bg ? ` fill-${data.bg}` : ""}`;
    }

    function paintStatus() {
      const sheet = current();
      const { r1, c1, r2, c2 } = norm();
      const multi = !isSingle();
      if (multi) {
        let sum = 0;
        let count = 0;
        let filled = 0;
        for (let r = r1; r <= r2; r += 1) {
          for (let c = c1; c <= c2; c += 1) {
            if (!sheet.cells[cellKey(r, c)]) continue;
            const value = evaluator.cell(sheet, r, c);
            if (value !== null && value !== "") filled += 1;
            if (typeof value === "number") {
              sum += value;
              count += 1;
            }
          }
        }
        if (count) {
          status.innerHTML = `<span>Suma <b>${formatNumber(sum)}</b></span><span>Promedio <b>${formatNumber(sum / count)}</b></span><span>Recuento <b>${filled}</b></span>`;
          return;
        }
        status.innerHTML = `<span>Recuento <b>${filled}</b></span>`;
        return;
      }
      const value = sheet.cells[cellKey(sel.r, sel.c)] ? evaluator.cell(sheet, sel.r, sel.c) : null;
      if (isErr(value)) {
        status.innerHTML = "";
        status.appendChild(el("span", "sheet-status-err", `${value.code} · ${ERR_HELP[value.code] || ""}`));
        return;
      }
      status.innerHTML = "<span class=\"sheet-status-hint\">Escribe un número, un texto o una fórmula que empiece con =</span>";
    }

    function placeCapture() {
      const td = tds[sel.r] && tds[sel.r][sel.c];
      if (!td) return;
      editor.style.left = `${td.offsetLeft}px`;
      editor.style.top = `${td.offsetTop}px`;
      editor.style.width = `${td.offsetWidth}px`;
      editor.style.height = `${td.offsetHeight}px`;
    }

    let measureCtx = null;
    function textWidth(text, bold) {
      if (!measureCtx) {
        const canvasEl = document.createElement("canvas");
        measureCtx = canvasEl.getContext("2d");
      }
      if (!measureCtx) return text.length * 8;
      const family = getComputedStyle(root).fontFamily || "sans-serif";
      measureCtx.font = `${bold ? 700 : 500} 13.5px ${family}`;
      return measureCtx.measureText(text).width;
    }

    function placeEditor() {
      if (!editing) return;
      const td = tds[editing.r] && tds[editing.r][editing.c];
      if (!td) return;
      editor.style.left = `${td.offsetLeft}px`;
      editor.style.top = `${td.offsetTop}px`;
      editor.style.height = `${td.offsetHeight}px`;
      const room = canvas.offsetWidth - td.offsetLeft - 4;
      const wanted = Math.ceil((textWidth(editor.value || "") + 28) * zoom);
      editor.style.width = `${Math.max(td.offsetWidth, Math.min(wanted, Math.max(room, td.offsetWidth)))}px`;
    }

    function ensureVisible(row, col) {
      const own = mergeAt(row, col);
      const r = own ? own.r1 : row;
      const c = own ? own.c1 : col;
      const td = tds[r] && tds[r][c];
      if (!td) return;
      const headH = thead.offsetHeight;
      const headW = rowHeads[0] ? rowHeads[0].offsetWidth : HEAD_WIDTH;
      const top = td.offsetTop;
      const bottom = top + td.offsetHeight;
      const left = td.offsetLeft;
      const right = left + td.offsetWidth;
      if (top - headH < viewport.scrollTop) viewport.scrollTop = Math.max(0, top - headH);
      else if (bottom > viewport.scrollTop + viewport.clientHeight) viewport.scrollTop = bottom - viewport.clientHeight;
      if (left - headW < viewport.scrollLeft) viewport.scrollLeft = Math.max(0, left - headW);
      else if (right > viewport.scrollLeft + viewport.clientWidth) viewport.scrollLeft = right - viewport.clientWidth;
    }

    function renderTabs() {
      tabsBox.replaceChildren();
      model.sheets.forEach((sheet) => {
        const active = sheet.id === model.active;
        const tab = el("button", `sheet-tab${active ? " is-active" : ""}`, sheet.name);
        tab.type = "button";
        tab.setAttribute("role", "tab");
        tab.setAttribute("aria-selected", String(active));
        tab.title = "Doble clic para cambiar el nombre";
        tab.addEventListener("mousedown", (event) => {
          if (editing) event.preventDefault();
        });
        tab.addEventListener("click", () => switchSheet(sheet.id));
        tab.addEventListener("dblclick", () => startRename(sheet, tab));
        tab.addEventListener("contextmenu", (event) => {
          event.preventDefault();
          switchSheet(sheet.id);
          openMenu(tabItems(sheet), { x: event.clientX, y: event.clientY });
        });
        tabsBox.appendChild(tab);
        if (active) {
          const more = el("button", "sheet-tab-more");
          more.type = "button";
          more.innerHTML = ICONS.more;
          more.title = "Opciones de la hoja";
          more.setAttribute("aria-label", `Opciones de ${sheet.name}`);
          more.addEventListener("mousedown", (event) => event.preventDefault());
          more.addEventListener("click", () => openMenu(tabItems(sheet), { anchor: more }));
          tabsBox.appendChild(more);
        }
      });
      const add = el("button", "sheet-tab-add");
      add.type = "button";
      add.innerHTML = ICONS.plus;
      add.title = "Nueva hoja";
      add.setAttribute("aria-label", "Nueva hoja");
      add.addEventListener("mousedown", (event) => event.preventDefault());
      add.addEventListener("click", () => addSheet());
      tabsBox.appendChild(add);
    }

    function fullRender() {
      buildGrid();
      paintCells();
      renderTabs();
      paintSelection();
    }

    /* Cambios con deshacer */
    function serialize() {
      return JSON.stringify({ sheets: model.sheets, active: model.active });
    }

    function mutate(fn) {
      const before = serialize();
      const selBefore = { ...sel };
      const result = fn(current());
      if (result === false) return false;
      const after = serialize();
      if (after === before) {
        paintSelection();
        return false;
      }
      undoStack.push({ state: before, sel: selBefore });
      if (undoStack.length > UNDO_LIMIT) undoStack.shift();
      redoStack = [];
      afterChange();
      return true;
    }

    function afterChange() {
      if (dimsKey() !== gridDims) buildGrid();
      paintCells();
      renderTabs();
      paintSelection();
      notify();
    }

    function restore(entry) {
      const data = JSON.parse(entry.state);
      model.sheets = data.sheets;
      model.active = data.active;
      sel = { ...entry.sel };
      clip = null;
      buildGrid();
      afterChange();
      ensureVisible(sel.r, sel.c);
    }

    function undo() {
      if (editing) cancelEdit();
      const entry = undoStack.pop();
      if (!entry) return;
      redoStack.push({ state: serialize(), sel: { ...sel } });
      restore(entry);
    }

    function redo() {
      if (editing) cancelEdit();
      const entry = redoStack.pop();
      if (!entry) return;
      undoStack.push({ state: serialize(), sel: { ...sel } });
      restore(entry);
    }

    function storeCell(sheet, key, cell) {
      const clean = normalizeCell(cell);
      if (clean) sheet.cells[key] = clean;
      else delete sheet.cells[key];
    }

    function writeRaw(sheet, r, c, raw) {
      const key = cellKey(r, c);
      const cell = { ...(sheet.cells[key] || {}) };
      let value = raw == null ? "" : String(raw);
      if (cell.f !== "text" && value && value[0] !== "=" && value[0] !== "'") {
        const parsed = parseInputNumber(value);
        if (parsed && parsed.kind && !cell.f) cell.f = parsed.kind;
      }
      if (isFormula(value) && cell.f !== "text") value = prettifyFormula(value);
      cell.v = value;
      storeCell(sheet, key, cell);
    }

    function forEachSelected(fn) {
      const sheet = current();
      const { r1, c1, r2, c2 } = norm();
      for (let r = r1; r <= r2; r += 1) {
        for (let c = c1; c <= c2; c += 1) fn(sheet, r, c, cellKey(r, c));
      }
    }

    /* Selección */
    function select(r, c, extend) {
      const sheet = current();
      let rr = clamp(r, 0, sheet.rows - 1);
      let cc = clamp(c, 0, sheet.cols - 1);
      if (extend) {
        sel.r2 = rr;
        sel.c2 = cc;
      } else {
        const own = mergeAt(rr, cc);
        if (own) {
          rr = own.r1;
          cc = own.c1;
        }
        sel = { r: rr, c: cc, r2: rr, c2: cc };
      }
      paintSelection();
      ensureVisible(rr, cc);
    }

    function grow(rows, cols) {
      const sheet = current();
      let changed = false;
      if (rows > sheet.rows && sheet.rows < MAX_ROWS) {
        sheet.rows = Math.min(MAX_ROWS, rows);
        changed = true;
      }
      if (cols > sheet.cols && sheet.cols < MAX_COLS) {
        sheet.cols = Math.min(MAX_COLS, cols);
        changed = true;
      }
      if (changed) {
        buildGrid();
        paintCells();
        notify();
      }
    }

    function move(dr, dc, extend) {
      let fromR = extend ? sel.r2 : sel.r;
      let fromC = extend ? sel.c2 : sel.c;
      const own = extend ? null : mergeAt(fromR, fromC);
      if (own) {
        if (dr > 0) fromR = own.r2;
        if (dc > 0) fromC = own.c2;
      }
      const r = Math.max(0, fromR + dr);
      const c = Math.max(0, fromC + dc);
      grow(r + 1, c + 1);
      select(r, c, extend);
    }

    function hasValue(sheet, r, c) {
      const cell = sheet.cells[cellKey(r, c)];
      return Boolean(cell && cell.v != null && cell.v !== "");
    }

    function jump(dr, dc, extend) {
      const sheet = current();
      let r = extend ? sel.r2 : sel.r;
      let c = extend ? sel.c2 : sel.c;
      const inside = (rr, cc) => rr >= 0 && cc >= 0 && rr < sheet.rows && cc < sheet.cols;
      if (!inside(r + dr, c + dc)) {
        select(r, c, extend);
        return;
      }
      if (hasValue(sheet, r, c) && hasValue(sheet, r + dr, c + dc)) {
        while (inside(r + dr, c + dc) && hasValue(sheet, r + dr, c + dc)) {
          r += dr;
          c += dc;
        }
      } else {
        r += dr;
        c += dc;
        while (inside(r + dr, c + dc) && !hasValue(sheet, r, c)) {
          r += dr;
          c += dc;
        }
      }
      select(r, c, extend);
    }

    function lastUsed() {
      const sheet = current();
      let maxR = 0;
      let maxC = 0;
      Object.keys(sheet.cells).forEach((key) => {
        const [r, c] = key.split(":").map(Number);
        if (hasValue(sheet, r, c)) {
          maxR = Math.max(maxR, r);
          maxC = Math.max(maxC, c);
        }
      });
      return { r: maxR, c: maxC };
    }

    function selectAll() {
      const sheet = current();
      sel = { r: 0, c: 0, r2: sheet.rows - 1, c2: sheet.cols - 1 };
      paintSelection();
    }

    function focusCapture() {
      if (document.activeElement !== editor) editor.focus({ preventScroll: true });
    }

    /* Edición */
    function editTarget() {
      return editing && editing.source === "bar" ? fxInput : editor;
    }

    function startEdit(initial, mode) {
      const sheet = current();
      snapActive();
      const data = sheet.cells[cellKey(sel.r, sel.c)];
      const original = data && data.v != null ? String(data.v) : "";
      sel.r2 = sel.r;
      sel.c2 = sel.c;
      editing = { mode, source: "cell", original, r: sel.r, c: sel.c };
      editor.value = initial == null ? original : initial;
      fxInput.value = editor.value;
      root.classList.add("is-editing");
      paintSelection();
      ensureVisible(sel.r, sel.c);
      editor.focus({ preventScroll: true });
      const end = editor.value.length;
      editor.setSelectionRange(end, end);
    }

    function endEdit() {
      editing = null;
      pointing = null;
      pointBox.hidden = true;
      root.classList.remove("is-editing");
      editor.value = "";
    }

    function commitEdit(dir) {
      if (!editing) return;
      const input = editTarget();
      const value = input.value.replace(/\r?\n/g, " ");
      const { r, c, original, source } = editing;
      endEdit();
      if (value !== original) {
        mutate((sheet) => writeRaw(sheet, r, c, value));
      } else {
        paintSelection();
      }
      if (source === "bar") focusCapture();
      if (dir) move(dir[0], dir[1], false);
    }

    function cancelEdit() {
      if (!editing) return;
      const source = editing.source;
      endEdit();
      paintSelection();
      if (source === "bar") focusCapture();
    }

    function canPoint() {
      if (!editing) return false;
      const input = editTarget();
      const value = input.value;
      if (value[0] !== "=") return false;
      const caret = input.selectionStart;
      if (pointing && pointing.input === input && pointing.end === caret) return true;
      const before = value.slice(0, caret).replace(/\s+$/, "");
      return /[=(+\-*/^&,;<>:]$/.test(before);
    }

    function pointTo(r1, c1, r2, c2) {
      const input = editTarget();
      const lo = { r: Math.min(r1, r2), c: Math.min(c1, c2) };
      const hi = { r: Math.max(r1, r2), c: Math.max(c1, c2) };
      const text = lo.r === hi.r && lo.c === hi.c ? addr(lo.r, lo.c) : `${addr(lo.r, lo.c)}:${addr(hi.r, hi.c)}`;
      const value = input.value;
      input.value = value.slice(0, pointing.start) + text + value.slice(pointing.end);
      pointing.end = pointing.start + text.length;
      input.setSelectionRange(pointing.end, pointing.end);
      if (input === editor) fxInput.value = editor.value;
      else editor.value = fxInput.value;
      place(pointBox, rectOf(lo.r, lo.c, hi.r, hi.c));
      placeEditor();
    }

    function startPointing(r, c) {
      const input = editTarget();
      const caret = input.selectionStart;
      if (!(pointing && pointing.input === input && pointing.end === caret)) {
        pointing = { input, start: caret, end: caret };
      }
      pointing.anchor = { r, c };
      pointTo(r, c, r, c);
      drag = { mode: "point" };
    }

    /* Formatos */
    function toggleBold() {
      if (editing) commitEdit(null);
      const sheet = current();
      const active = sheet.cells[cellKey(sel.r, sel.c)];
      const on = !(active && active.b);
      mutate(() => forEachSelected((s, r, c, key) => {
        const cell = { ...(s.cells[key] || {}) };
        if (on) cell.b = 1;
        else delete cell.b;
        storeCell(s, key, cell);
      }));
    }

    function setFormat(fmt) {
      if (editing) commitEdit(null);
      mutate(() => forEachSelected((s, r, c, key) => {
        const cell = { ...(s.cells[key] || {}) };
        if (fmt) cell.f = fmt;
        else delete cell.f;
        storeCell(s, key, cell);
      }));
    }

    function setAlign(align) {
      if (editing) commitEdit(null);
      const sheet = current();
      const active = sheet.cells[cellKey(sel.r, sel.c)];
      const next = active && active.a === align ? "" : align;
      mutate(() => forEachSelected((s, r, c, key) => {
        const cell = { ...(s.cells[key] || {}) };
        if (next) cell.a = next;
        else delete cell.a;
        storeCell(s, key, cell);
      }));
    }

    function setFill(fill) {
      if (editing) commitEdit(null);
      mutate(() => forEachSelected((s, r, c, key) => {
        const cell = { ...(s.cells[key] || {}) };
        if (fill) cell.bg = fill;
        else delete cell.bg;
        storeCell(s, key, cell);
      }));
    }

    function clearSelection() {
      mutate(() => forEachSelected((s, r, c, key) => {
        const cell = s.cells[key];
        if (!cell) return;
        const next = { ...cell };
        delete next.v;
        storeCell(s, key, next);
      }));
    }

    function fillDown() {
      const { r1, c1, r2, c2 } = norm();
      if (r2 <= r1) {
        if (r1 === 0) return;
        mutate((s) => {
          for (let c = c1; c <= c2; c += 1) copyCell(s, r1 - 1, c, r1, c);
        });
        return;
      }
      mutate((s) => {
        for (let c = c1; c <= c2; c += 1) {
          for (let r = r1 + 1; r <= r2; r += 1) copyCell(s, r1, c, r, c);
        }
      });
    }

    function copyCell(sheet, fr, fc, tr, tc) {
      if (isCovered(tr, tc)) return;
      const source = sheet.cells[cellKey(fr, fc)];
      const key = cellKey(tr, tc);
      if (!source) {
        delete sheet.cells[key];
        return;
      }
      const cell = { ...source };
      if (isFormula(cell.v)) cell.v = shiftFormula(cell.v, tr - fr, tc - fc);
      sheet.cells[key] = cell;
    }

    /* Combinar celdas */
    function toggleMerge() {
      if (editing) commitEdit(null);
      const range = norm();
      const own = mergeAt(sel.r, sel.c);
      if (own && isSingle()) {
        mutate((s) => {
          s.merges = (s.merges || []).filter((m) => !(m.r1 === own.r1 && m.c1 === own.c1 && m.r2 === own.r2 && m.c2 === own.c2));
        });
        sel = { r: own.r1, c: own.c1, r2: own.r2, c2: own.c2 };
        paintSelection();
        return;
      }
      const { r1, c1, r2, c2 } = range;
      if (r1 === r2 && c1 === c2) {
        toast("Selecciona dos o más celdas para combinarlas.");
        return;
      }
      if ((r2 - r1 + 1) * (c2 - c1 + 1) > 5000) {
        toast("Ese rango es muy grande para combinarlo. Elige menos celdas.", "error");
        return;
      }
      let lost = false;
      mutate((s) => {
        const anchorKey = cellKey(r1, c1);
        const anchor = { ...(s.cells[anchorKey] || {}) };
        const filled = (cell) => Boolean(cell && cell.v != null && cell.v !== "");
        for (let r = r1; r <= r2; r += 1) {
          for (let c = c1; c <= c2; c += 1) {
            if (r === r1 && c === c1) continue;
            const key = cellKey(r, c);
            const cell = s.cells[key];
            if (filled(cell)) {
              if (!filled(anchor)) {
                anchor.v = isFormula(cell.v) ? shiftFormula(cell.v, r1 - r, c1 - c) : cell.v;
                if (cell.f && !anchor.f) anchor.f = cell.f;
                if (cell.b && !anchor.b) anchor.b = 1;
              } else {
                lost = true;
              }
            }
            delete s.cells[key];
          }
        }
        if (!anchor.a) anchor.a = "center";
        storeCell(s, anchorKey, anchor);
        s.merges = (s.merges || []).filter((m) => !rangesOverlap(m, range));
        s.merges.push({ r1, c1, r2, c2 });
      });
      sel = { r: r1, c: c1, r2: r1, c2: c1 };
      paintSelection();
      if (lost) toast("Combinamos las celdas. Solo se conservó el primer valor.");
    }

    /* Filas y columnas */
    function insertRows(at, count) {
      const sheet = current();
      if (sheet.rows + count > MAX_ROWS) {
        toast(`La hoja admite hasta ${MAX_ROWS} filas.`, "error");
        return;
      }
      mutate((s) => applyStructure(model, s, "row", at, count, false));
      sel = { r: at, c: 0, r2: at + count - 1, c2: current().cols - 1 };
      paintSelection();
    }

    function deleteRows(at, count) {
      const sheet = current();
      if (count >= sheet.rows) {
        selectAll();
        clearSelection();
        return;
      }
      mutate((s) => applyStructure(model, s, "row", at, count, true));
      select(Math.min(at, current().rows - 1), sel.c);
    }

    function insertCols(at, count) {
      const sheet = current();
      if (sheet.cols + count > MAX_COLS) {
        toast(`La hoja admite hasta ${MAX_COLS} columnas.`, "error");
        return;
      }
      mutate((s) => applyStructure(model, s, "col", at, count, false));
      sel = { r: 0, c: at, r2: current().rows - 1, c2: at + count - 1 };
      paintSelection();
    }

    function deleteCols(at, count) {
      const sheet = current();
      if (count >= sheet.cols) {
        selectAll();
        clearSelection();
        return;
      }
      mutate((s) => applyStructure(model, s, "col", at, count, true));
      select(sel.r, Math.min(at, current().cols - 1));
    }

    function autofit(cols) {
      const sheet = current();
      const ev = createEvaluator(model);
      mutate((s) => {
        cols.forEach((c) => {
          let widest = textWidth(colName(c));
          for (let r = 0; r < s.rows; r += 1) {
            const data = s.cells[cellKey(r, c)];
            if (!data) continue;
            const own = mergeAt(r, c);
            if (own && own.c1 !== own.c2) continue;
            const shown = display(ev.cell(sheet, r, c), data);
            if (shown.text) widest = Math.max(widest, textWidth(shown.text, data.b));
          }
          if (!s.widths) s.widths = {};
          s.widths[c] = clamp(Math.ceil(widest + 26), MIN_WIDTH, MAX_WIDTH);
        });
      });
    }

    function selectedCols() {
      const { c1, c2 } = norm();
      const list = [];
      for (let c = c1; c <= c2; c += 1) list.push(c);
      return list;
    }

    /* Hojas */
    function switchSheet(id) {
      if (id === model.active) return;
      if (editing) commitEdit(null);
      selBySheet.set(model.active, { ...sel });
      model.active = id;
      sel = selBySheet.get(id) || { r: 0, c: 0, r2: 0, c2: 0 };
      fullRender();
      viewport.scrollTop = 0;
      viewport.scrollLeft = 0;
      ensureVisible(sel.r, sel.c);
      notify();
    }

    function addSheet() {
      if (editing) commitEdit(null);
      selBySheet.set(model.active, { ...sel });
      mutate(() => {
        const sheet = blankSheet(nextSheetName(model.sheets.map((s) => s.name)));
        model.sheets.push(sheet);
        model.active = sheet.id;
      });
      sel = { r: 0, c: 0, r2: 0, c2: 0 };
      paintSelection();
    }

    function duplicateSheet(sheet) {
      mutate(() => {
        const copy = JSON.parse(JSON.stringify(sheet));
        copy.id = uid();
        copy.name = uniqueName(`${sheet.name} (copia)`, model.sheets.map((s) => s.name));
        const index = model.sheets.indexOf(sheet);
        model.sheets.splice(index + 1, 0, copy);
        model.active = copy.id;
      });
    }

    function deleteSheet(sheet) {
      if (model.sheets.length <= 1) {
        toast("Debe quedar al menos una hoja.", "error");
        return;
      }
      const index = model.sheets.indexOf(sheet);
      mutate(() => {
        removeSheet(model, sheet);
        const next = model.sheets[Math.max(0, index - 1)];
        model.active = next.id;
      });
      sel = selBySheet.get(model.active) || { r: 0, c: 0, r2: 0, c2: 0 };
      paintSelection();
      toast(`Eliminaste «${sheet.name}». Puedes deshacerlo con ${MOD}+Z.`);
    }

    function startRename(sheet, tab) {
      if (editing) commitEdit(null);
      const input = el("input", "sheet-tab-input");
      input.value = sheet.name;
      input.maxLength = 31;
      input.setAttribute("aria-label", "Nombre de la hoja");
      tab.replaceWith(input);
      input.focus();
      input.select();
      let done = false;
      const finish = (save) => {
        if (done) return;
        done = true;
        const name = cleanSheetName(input.value);
        if (save && name && name !== sheet.name) {
          const taken = model.sheets.some((other) => other !== sheet && sameName(other.name, name));
          if (taken) toast("Ya tienes una hoja con ese nombre.", "error");
          else mutate(() => renameSheet(model, sheet, name));
        } else if (save && !name) {
          toast("El nombre no puede quedar vacío.", "error");
        }
        renderTabs();
        focusCapture();
      };
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          finish(true);
        } else if (event.key === "Escape") {
          event.preventDefault();
          finish(false);
        }
      });
      input.addEventListener("blur", () => finish(true));
    }

    /* Portapapeles */
    function buildClip(cut) {
      const sheet = current();
      const { r1, c1, r2, c2 } = norm();
      const cells = [];
      const lines = [];
      for (let r = r1; r <= r2; r += 1) {
        const row = [];
        const texts = [];
        for (let c = c1; c <= c2; c += 1) {
          const data = sheet.cells[cellKey(r, c)];
          row.push(data ? { ...data } : null);
          texts.push(tsvField(data ? display(evaluator.cell(sheet, r, c), data).text : ""));
        }
        cells.push(row);
        lines.push(texts.join("\t"));
      }
      return { sheetId: sheet.id, r1, c1, r2, c2, cells, text: lines.join("\n"), cut };
    }

    function prepareCopy(cut) {
      clip = buildClip(cut);
      editor.value = clip.text || " ";
      editor.select();
      setTimeout(() => {
        if (!editing) editor.value = "";
      }, 0);
      paintClip();
    }

    function writeClipboard(text) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).catch(() => {});
      }
    }

    function pasteText(text) {
      const normalized = String(text).replace(/\r\n?/g, "\n").replace(/\n$/, "");
      if (clip && normalized === clip.text) {
        pasteInternal();
        return;
      }
      const grid = parseTsv(text);
      if (!grid.length || (grid.length === 1 && grid[0].length === 1 && grid[0][0] === "")) return;
      const { r1, c1, r2, c2 } = norm();
      const single = grid.length === 1 && grid[0].length === 1;
      const width = Math.max(...grid.map((row) => row.length));
      const height = single ? r2 - r1 + 1 : grid.length;
      const span = single ? c2 - c1 + 1 : width;
      grow(r1 + height, c1 + span);
      const sheet = current();
      mutate((s) => {
        for (let i = 0; i < height; i += 1) {
          for (let j = 0; j < span; j += 1) {
            const r = r1 + i;
            const c = c1 + j;
            if (r >= s.rows || c >= s.cols || isCovered(r, c)) continue;
            const raw = single ? grid[0][0] : (grid[i][j] == null ? "" : grid[i][j]);
            writeRaw(s, r, c, String(raw).replace(/\n/g, " "));
          }
        }
      });
      sel = { r: r1, c: c1, r2: Math.min(r1 + height - 1, sheet.rows - 1), c2: Math.min(c1 + span - 1, sheet.cols - 1) };
      paintSelection();
    }

    function pasteInternal() {
      const source = clip;
      if (!source) return;
      const { r1, c1, r2, c2 } = norm();
      const h = source.cells.length;
      const w = source.cells[0].length;
      const selH = r2 - r1 + 1;
      const selW = c2 - c1 + 1;
      const tile = (selH > h || selW > w) && selH % h === 0 && selW % w === 0;
      const height = tile ? selH : h;
      const width = tile ? selW : w;
      grow(r1 + height, c1 + width);
      mutate((s) => {
        const from = model.sheets.find((item) => item.id === source.sheetId);
        if (source.cut && from) {
          for (let r = source.r1; r <= source.r2; r += 1) {
            for (let c = source.c1; c <= source.c2; c += 1) delete from.cells[cellKey(r, c)];
          }
        }
        for (let i = 0; i < height; i += 1) {
          for (let j = 0; j < width; j += 1) {
            const r = r1 + i;
            const c = c1 + j;
            if (r >= s.rows || c >= s.cols || isCovered(r, c)) continue;
            const data = source.cells[i % h][j % w];
            const key = cellKey(r, c);
            if (!data) {
              delete s.cells[key];
              continue;
            }
            const cell = { ...data };
            if (!source.cut && isFormula(cell.v)) {
              cell.v = shiftFormula(cell.v, r - (source.r1 + (i % h)), c - (source.c1 + (j % w)));
            }
            s.cells[key] = cell;
          }
        }
      });
      if (source.cut) clip = null;
      const sheet = current();
      sel = { r: r1, c: c1, r2: Math.min(r1 + height - 1, sheet.rows - 1), c2: Math.min(c1 + width - 1, sheet.cols - 1) };
      paintSelection();
    }

    function menuPaste() {
      if (clip) {
        pasteInternal();
        return;
      }
      if (navigator.clipboard && navigator.clipboard.readText) {
        navigator.clipboard.readText().then(pasteText).catch(() => {
          toast(`Para pegar usa ${MOD}+V.`);
        });
        return;
      }
      toast(`Para pegar usa ${MOD}+V.`);
    }

    /* Exportar */
    function exportCsv() {
      if (editing) commitEdit(null);
      const sheet = current();
      const ev = createEvaluator(model);
      let maxR = -1;
      let maxC = -1;
      Object.keys(sheet.cells).forEach((key) => {
        const [r, c] = key.split(":").map(Number);
        if (!hasValue(sheet, r, c)) return;
        maxR = Math.max(maxR, r);
        maxC = Math.max(maxC, c);
      });
      if (maxR < 0) {
        toast("Esta hoja está vacía.", "error");
        return;
      }
      const lines = [];
      for (let r = 0; r <= maxR; r += 1) {
        const cells = [];
        for (let c = 0; c <= maxC; c += 1) {
          const data = sheet.cells[cellKey(r, c)];
          cells.push(data ? csvField(ev.cell(sheet, r, c), data) : "");
        }
        lines.push(cells.join(";"));
      }
      const blob = new Blob([`\ufeff${lines.join("\r\n")}`], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${sheet.name.replace(/[\\/:*?"<>|]/g, "").trim() || "hoja"}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast("Descargamos la hoja. Puedes abrirla con Excel o Google Sheets.");
    }

    function readFileText(file, done) {
      const read = (encoding, next) => {
        const reader = new FileReader();
        reader.onload = () => next(String(reader.result || ""));
        reader.onerror = () => toast("No pudimos leer ese archivo.", "error");
        reader.readAsText(file, encoding);
      };
      read("utf-8", (text) => {
        if (text.includes("\ufffd")) read("windows-1252", done);
        else done(text);
      });
    }

    function importCsv(file) {
      if (editing) commitEdit(null);
      if (file.size > 5 * 1024 * 1024) {
        toast("Ese archivo es muy grande. Elige uno de menos de 5 MB.", "error");
        return;
      }
      readFileText(file, (raw) => {
        const text = raw.replace(/^\ufeff/, "");
        const grid = parseTsv(text, csvDelimiter(text));
        while (grid.length && grid[grid.length - 1].every((value) => value === "")) grid.pop();
        if (!grid.length) {
          toast("Ese archivo no tiene datos.", "error");
          return;
        }
        const width = Math.max(...grid.map((row) => row.length));
        const rows = Math.min(grid.length, MAX_ROWS);
        const cols = Math.min(width, MAX_COLS);
        const name = uniqueName(
          cleanSheetName(file.name.replace(/\.[^.]+$/, "")) || "CSV",
          model.sheets.map((s) => s.name)
        );
        selBySheet.set(model.active, { ...sel });
        mutate(() => {
          const sheet = blankSheet(name);
          sheet.rows = clamp(Math.max(DEFAULT_ROWS, rows + 5), 1, MAX_ROWS);
          sheet.cols = clamp(Math.max(DEFAULT_COLS, cols + 1), 1, MAX_COLS);
          const widest = [];
          for (let r = 0; r < rows; r += 1) {
            for (let c = 0; c < cols; c += 1) {
              const value = String(grid[r][c] == null ? "" : grid[r][c]).replace(/\n/g, " ");
              if (!value) continue;
              writeRaw(sheet, r, c, value);
              widest[c] = Math.max(widest[c] || 0, textWidth(value));
            }
          }
          widest.forEach((w, c) => {
            const fit = clamp(Math.ceil(w + 26), MIN_WIDTH, MAX_WIDTH);
            if (fit > DEFAULT_WIDTH) sheet.widths[c] = Math.min(fit, 320);
          });
          model.sheets.push(sheet);
          model.active = sheet.id;
        });
        sel = { r: 0, c: 0, r2: 0, c2: 0 };
        viewport.scrollTop = 0;
        viewport.scrollLeft = 0;
        paintSelection();
        const cut = grid.length > MAX_ROWS || width > MAX_COLS;
        toast(cut
          ? `Cargamos «${name}», pero solo caben ${MAX_ROWS} filas y ${MAX_COLS} columnas.`
          : `Cargamos «${name}» en una hoja nueva.`);
      });
    }

    function toggleHelp() {
      help.hidden = !help.hidden;
      btnHelp.classList.toggle("is-on", !help.hidden);
      paintSelection();
    }

    /* Menús */
    function closeMenu() {
      if (!menuEl) return;
      menuEl.remove();
      menuEl = null;
      document.removeEventListener("pointerdown", outsideMenu, true);
      window.removeEventListener("resize", closeMenu);
      viewport.removeEventListener("scroll", closeMenu);
    }

    function outsideMenu(event) {
      if (menuEl && !menuEl.contains(event.target)) closeMenu();
    }

    function openMenu(items, where) {
      closeMenu();
      menuEl = el("div", "sheet-menu");
      menuEl.setAttribute("role", "menu");
      items.forEach((item) => {
        if (item === "sep") {
          menuEl.appendChild(el("div", "sheet-menu-sep"));
          return;
        }
        const button = el("button", `sheet-menu-item${item.active ? " is-active" : ""}`);
        button.type = "button";
        button.setAttribute("role", "menuitem");
        button.disabled = Boolean(item.disabled);
        if (item.fill !== undefined) {
          button.appendChild(el("i", `sheet-menu-swatch${item.fill ? ` fill-${item.fill}` : " is-none"}`));
        }
        button.appendChild(el("span", "sheet-menu-label", item.label));
        if (item.hint) button.appendChild(el("span", "sheet-menu-hint", item.hint));
        button.addEventListener("mousedown", (event) => event.preventDefault());
        button.addEventListener("click", () => {
          closeMenu();
          item.run();
        });
        menuEl.appendChild(button);
      });
      document.body.appendChild(menuEl);
      const mw = menuEl.offsetWidth;
      const mh = menuEl.offsetHeight;
      let x;
      let y;
      if (where.anchor) {
        const rect = where.anchor.getBoundingClientRect();
        x = rect.left;
        y = rect.bottom + 6;
        if (y + mh > window.innerHeight - 8) y = rect.top - mh - 6;
      } else {
        x = where.x;
        y = where.y;
        if (y + mh > window.innerHeight - 8) y = where.y - mh;
      }
      x = clamp(x, 8, Math.max(8, window.innerWidth - mw - 8));
      y = clamp(y, 8, Math.max(8, window.innerHeight - mh - 8));
      menuEl.style.left = `${x}px`;
      menuEl.style.top = `${y}px`;
      setTimeout(() => {
        if (!menuEl) return;
        document.addEventListener("pointerdown", outsideMenu, true);
        window.addEventListener("resize", closeMenu);
        viewport.addEventListener("scroll", closeMenu);
      }, 0);
      const first = menuEl.querySelector("button:not(:disabled)");
      if (first && where.keyboard) first.focus();
    }

    function openFormatMenu(anchor) {
      if (editing) commitEdit(null);
      const data = current().cells[cellKey(sel.r, sel.c)] || {};
      openMenu(FORMATS.map((fmt) => ({
        label: fmt.label,
        hint: fmt.sample,
        active: (data.f || "") === fmt.id,
        run: () => setFormat(fmt.id)
      })), { anchor });
    }

    function openFillMenu(anchor) {
      if (editing) commitEdit(null);
      const data = current().cells[cellKey(sel.r, sel.c)] || {};
      openMenu(FILLS.map((fill) => ({
        label: fill.label,
        fill: fill.id,
        active: (data.bg || "") === fill.id,
        run: () => setFill(fill.id)
      })), { anchor });
    }

    function gridItems() {
      const { r1, c1, r2, c2 } = norm();
      const rows = r2 - r1 + 1;
      const cols = c2 - c1 + 1;
      const rowWord = rows === 1 ? "fila" : `${rows} filas`;
      const colWord = cols === 1 ? "columna" : `${cols} columnas`;
      return [
        { label: `Insertar ${rowWord} arriba`, run: () => insertRows(r1, rows) },
        { label: `Insertar ${rowWord} abajo`, run: () => insertRows(r2 + 1, rows) },
        { label: `Insertar ${colWord} a la izquierda`, run: () => insertCols(c1, cols) },
        { label: `Insertar ${colWord} a la derecha`, run: () => insertCols(c2 + 1, cols) },
        "sep",
        { label: `Eliminar ${rowWord}`, run: () => deleteRows(r1, rows) },
        { label: `Eliminar ${colWord}`, run: () => deleteCols(c1, cols) },
        "sep",
        { label: cols === 1 ? "Ajustar ancho de la columna" : "Ajustar ancho de las columnas", run: () => autofit(selectedCols()) },
        { label: cols === 1 ? "Ancho de la columna…" : "Ancho de las columnas…", run: () => openWidthDialog(selectedCols()) }
      ];
    }

    const widthToChars = (w) => Math.round(((w - CHAR_PAD) / CHAR_PX) * 10) / 10;
    const charsToWidth = (chars) => clamp(Math.round(chars * CHAR_PX + CHAR_PAD), MIN_WIDTH, MAX_WIDTH);

    function openWidthDialog(cols) {
      if (editing) commitEdit(null);
      closeMenu();
      const sheet = current();
      const values = [...new Set(cols.map((c) => widthToChars(widthOf(sheet, c))))];
      const form = el("form", "sheet-menu sheet-width");
      form.setAttribute("role", "dialog");
      form.setAttribute("aria-label", "Ancho de columna");
      const inputId = `sheet-width-${uid()}`;
      const title = el("label", "sheet-width-title", cols.length === 1
        ? `Ancho de la columna ${colName(cols[0])}`
        : `Ancho de las columnas ${colName(cols[0])} a ${colName(cols[cols.length - 1])}`);
      title.htmlFor = inputId;
      const input = el("input", "sheet-width-input");
      input.id = inputId;
      input.type = "number";
      input.min = String(widthToChars(MIN_WIDTH));
      input.max = String(widthToChars(MAX_WIDTH));
      input.step = "0.5";
      input.inputMode = "decimal";
      input.value = values.length === 1 ? String(values[0]) : "";
      input.placeholder = values.length === 1 ? "" : "Varios";
      const hint = el("p", "sheet-width-hint", `Es la cantidad de caracteres que caben. Una columna normal mide ${widthToChars(DEFAULT_WIDTH)}.`);
      const actions = el("div", "sheet-width-actions");
      const cancel = el("button", "sheet-width-btn", "Cancelar");
      cancel.type = "button";
      const apply = el("button", "sheet-width-btn is-primary", "Aplicar");
      apply.type = "submit";
      actions.append(cancel, apply);
      form.append(title, input, hint, actions);
      const done = () => {
        closeMenu();
        focusCapture();
      };
      cancel.addEventListener("click", done);
      form.addEventListener("keydown", (event) => {
        event.stopPropagation();
        if (event.key === "Escape") {
          event.preventDefault();
          done();
        }
      });
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        const chars = Number(String(input.value).replace(",", "."));
        if (!Number.isFinite(chars) || chars <= 0) {
          input.classList.add("is-invalid");
          input.focus();
          return;
        }
        const width = charsToWidth(chars);
        mutate((s) => {
          if (!s.widths) s.widths = {};
          cols.forEach((c) => {
            if (width === DEFAULT_WIDTH) delete s.widths[c];
            else s.widths[c] = width;
          });
        });
        done();
      });
      menuEl = form;
      document.body.appendChild(form);
      const head = colHeads[cols[0]];
      const rect = (head || viewport).getBoundingClientRect();
      const x = clamp(rect.left, 8, Math.max(8, window.innerWidth - form.offsetWidth - 8));
      let y = rect.bottom + 6;
      if (y + form.offsetHeight > window.innerHeight - 8) y = Math.max(8, rect.top - form.offsetHeight - 6);
      form.style.left = `${x}px`;
      form.style.top = `${y}px`;
      setTimeout(() => {
        if (menuEl !== form) return;
        document.addEventListener("pointerdown", outsideMenu, true);
        window.addEventListener("resize", closeMenu);
        viewport.addEventListener("scroll", closeMenu);
      }, 0);
      input.focus();
      input.select();
    }

    function openGridMenu(anchor) {
      if (editing) commitEdit(null);
      openMenu(gridItems(), { anchor });
    }

    function mergeMenuItem() {
      const merged = isSingle() && Boolean(mergeAt(sel.r, sel.c));
      return {
        label: merged ? "Separar celdas" : "Combinar celdas",
        disabled: !merged && isSingle(),
        run: () => toggleMerge()
      };
    }

    function contextItems() {
      return [
        { label: "Cortar", hint: `${MOD}+X`, run: () => { clip = buildClip(true); writeClipboard(clip.text); paintClip(); } },
        { label: "Copiar", hint: `${MOD}+C`, run: () => { clip = buildClip(false); writeClipboard(clip.text); paintClip(); } },
        { label: "Pegar", hint: `${MOD}+V`, run: () => menuPaste() },
        { label: "Borrar contenido", hint: "Supr", run: () => clearSelection() },
        "sep",
        mergeMenuItem(),
        "sep",
        ...gridItems()
      ];
    }

    function tabItems(sheet) {
      return [
        { label: "Cambiar nombre", run: () => {
          const tab = tabsBox.querySelector(".sheet-tab.is-active");
          if (tab) startRename(sheet, tab);
        } },
        { label: "Duplicar hoja", run: () => duplicateSheet(sheet) },
        { label: "Eliminar hoja", disabled: model.sheets.length <= 1, run: () => deleteSheet(sheet) }
      ];
    }

    /* Ratón y toque */
    function hitInfo(target) {
      if (!(target instanceof Element)) return {};
      return {
        cell: target.closest("td.sheet-cell"),
        rowHead: target.closest("th.sheet-rowhead"),
        colHead: target.closest("th.sheet-colhead"),
        corner: target.closest("th.sheet-corner")
      };
    }

    function press(info, event, touch) {
      const sheet = current();
      if (info.cell && editing && !touch && canPoint()) {
        startPointing(Number(info.cell.dataset.r), Number(info.cell.dataset.c));
        return;
      }
      if (editing) commitEdit(null);
      if (info.corner) {
        selectAll();
        if (!touch) focusCapture();
        return;
      }
      if (info.colHead) {
        const c = Number(info.colHead.dataset.c);
        if (event.shiftKey) {
          sel.r = 0;
          sel.r2 = sheet.rows - 1;
          sel.c2 = c;
        } else {
          sel = { r: 0, c, r2: sheet.rows - 1, c2: c };
        }
        paintSelection();
        if (!touch) {
          drag = { mode: "cols" };
          focusCapture();
        }
        return;
      }
      if (info.rowHead) {
        const r = Number(info.rowHead.dataset.r);
        if (event.shiftKey) {
          sel.c = 0;
          sel.c2 = sheet.cols - 1;
          sel.r2 = r;
        } else {
          sel = { r, c: 0, r2: r, c2: sheet.cols - 1 };
        }
        paintSelection();
        if (!touch) {
          drag = { mode: "rows" };
          focusCapture();
        }
        return;
      }
      if (info.cell) {
        const r = Number(info.cell.dataset.r);
        const c = Number(info.cell.dataset.c);
        if (touch) {
          const single = sel.r === sel.r2 && sel.c === sel.c2;
          if (single && sel.r === r && sel.c === c) {
            startEdit(null, "full");
            return;
          }
          select(r, c, false);
          return;
        }
        select(r, c, event.shiftKey);
        drag = { mode: "cells" };
        focusCapture();
      }
    }

    function dragTo(event) {
      if (!drag) return;
      const target = document.elementFromPoint(event.clientX, event.clientY);
      const box = viewport.getBoundingClientRect();
      if (event.clientY > box.bottom - 12) viewport.scrollTop += 18;
      else if (event.clientY < box.top + thead.offsetHeight) viewport.scrollTop -= 18;
      if (event.clientX > box.right - 12) viewport.scrollLeft += 18;
      else if (event.clientX < box.left + HEAD_WIDTH) viewport.scrollLeft -= 18;
      const info = hitInfo(target);
      if (drag.mode === "point") {
        if (!info.cell || !pointing) return;
        pointTo(pointing.anchor.r, pointing.anchor.c, Number(info.cell.dataset.r), Number(info.cell.dataset.c));
        return;
      }
      if (drag.mode === "cells" && info.cell) {
        const r = Number(info.cell.dataset.r);
        const c = Number(info.cell.dataset.c);
        if (r !== sel.r2 || c !== sel.c2) {
          sel.r2 = r;
          sel.c2 = c;
          paintSelection();
        }
      } else if (drag.mode === "cols") {
        const head = info.colHead || info.cell;
        if (head) {
          sel.c2 = Number(head.dataset.c);
          paintSelection();
        }
      } else if (drag.mode === "rows") {
        const head = info.rowHead || info.cell;
        if (head) {
          sel.r2 = Number(head.dataset.r);
          paintSelection();
        }
      }
    }

    function startResize(event, c) {
      event.preventDefault();
      event.stopPropagation();
      if (editing) commitEdit(null);
      const sheet = current();
      const startX = event.clientX;
      const startW = widthOf(sheet, c);
      let width = startW;
      root.classList.add("is-resizing");
      const onMove = (ev) => {
        width = clamp(Math.round(startW + (ev.clientX - startX) / zoom), MIN_WIDTH, MAX_WIDTH);
        applyWidths({ c, w: width });
        paintSelection();
      };
      const onUp = () => {
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        document.removeEventListener("pointercancel", onUp);
        root.classList.remove("is-resizing");
        if (width !== startW) {
          mutate((s) => {
            if (!s.widths) s.widths = {};
            s.widths[c] = width;
          });
        }
      };
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
      document.addEventListener("pointercancel", onUp);
    }

    table.addEventListener("pointerdown", (event) => {
      if (event.target instanceof Element && event.target.classList.contains("sheet-resize")) {
        startResize(event, Number(event.target.dataset.c));
        return;
      }
      closeMenu();
      const info = hitInfo(event.target);
      if (event.pointerType === "touch" || event.pointerType === "pen") {
        touchStart = { x: event.clientX, y: event.clientY, info };
        return;
      }
      if (event.button !== 0) return;
      event.preventDefault();
      press(info, event, false);
    });

    table.addEventListener("pointerup", (event) => {
      if (!touchStart || (event.pointerType !== "touch" && event.pointerType !== "pen")) return;
      const moved = Math.hypot(event.clientX - touchStart.x, event.clientY - touchStart.y);
      const info = touchStart.info;
      touchStart = null;
      if (moved > 10) return;
      press(info, event, true);
    });

    table.addEventListener("pointercancel", () => {
      touchStart = null;
    });

    document.addEventListener("pointermove", (event) => {
      if (drag && event.buttons) dragTo(event);
    });

    document.addEventListener("pointerup", () => {
      drag = null;
    });

    table.addEventListener("dblclick", (event) => {
      if (!(event.target instanceof Element)) return;
      if (event.target.classList.contains("sheet-resize")) {
        const c = Number(event.target.dataset.c);
        const { c1, c2 } = norm();
        autofit(c >= c1 && c <= c2 ? selectedCols() : [c]);
        return;
      }
      const cellEl = event.target.closest("td.sheet-cell");
      if (!cellEl || editing) return;
      select(Number(cellEl.dataset.r), Number(cellEl.dataset.c), false);
      startEdit(null, "full");
    });

    table.addEventListener("contextmenu", (event) => {
      const info = hitInfo(event.target);
      if (!info.cell && !info.rowHead && !info.colHead) return;
      event.preventDefault();
      if (editing) commitEdit(null);
      const sheet = current();
      const { r1, c1, r2, c2 } = norm();
      if (info.cell) {
        const r = Number(info.cell.dataset.r);
        const c = Number(info.cell.dataset.c);
        if (r < r1 || r > r2 || c < c1 || c > c2) select(r, c, false);
      } else if (info.rowHead) {
        const r = Number(info.rowHead.dataset.r);
        if (r < r1 || r > r2 || c1 !== 0 || c2 !== sheet.cols - 1) {
          sel = { r, c: 0, r2: r, c2: sheet.cols - 1 };
          paintSelection();
        }
      } else if (info.colHead) {
        const c = Number(info.colHead.dataset.c);
        if (c < c1 || c > c2 || r1 !== 0 || r2 !== sheet.rows - 1) {
          sel = { r: 0, c, r2: sheet.rows - 1, c2: c };
          paintSelection();
        }
      }
      if (!touchStart) focusCapture();
      openMenu(contextItems(), { x: event.clientX, y: event.clientY });
    });

    /* Teclado */
    function navKey(event) {
      const mod = (event.ctrlKey || event.metaKey) && !(event.ctrlKey && event.altKey);
      const key = event.key;
      if (mod) {
        const lower = key.toLowerCase();
        if (lower === "z") {
          event.preventDefault();
          if (event.shiftKey) redo();
          else undo();
          return;
        }
        if (lower === "y") {
          event.preventDefault();
          redo();
          return;
        }
        if (lower === "b") {
          event.preventDefault();
          toggleBold();
          return;
        }
        if (lower === "a") {
          event.preventDefault();
          selectAll();
          return;
        }
        if (lower === "d") {
          event.preventDefault();
          fillDown();
          return;
        }
        if (lower === "c" || lower === "x") {
          prepareCopy(lower === "x");
          return;
        }
        if (key === "ArrowUp" || key === "ArrowDown" || key === "ArrowLeft" || key === "ArrowRight") {
          event.preventDefault();
          const dir = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[key];
          jump(dir[0], dir[1], event.shiftKey);
          return;
        }
        if (key === "Home") {
          event.preventDefault();
          select(0, 0, event.shiftKey);
          return;
        }
        if (key === "End") {
          event.preventDefault();
          const last = lastUsed();
          select(last.r, last.c, event.shiftKey);
        }
        return;
      }
      switch (key) {
        case "ArrowUp":
          event.preventDefault();
          move(-1, 0, event.shiftKey);
          return;
        case "ArrowDown":
          event.preventDefault();
          move(1, 0, event.shiftKey);
          return;
        case "ArrowLeft":
          event.preventDefault();
          move(0, -1, event.shiftKey);
          return;
        case "ArrowRight":
          event.preventDefault();
          move(0, 1, event.shiftKey);
          return;
        case "Enter":
          event.preventDefault();
          move(event.shiftKey ? -1 : 1, 0, false);
          return;
        case "Tab":
          event.preventDefault();
          move(0, event.shiftKey ? -1 : 1, false);
          return;
        case "Delete":
        case "Backspace":
          event.preventDefault();
          clearSelection();
          return;
        case "F2":
          event.preventDefault();
          startEdit(null, "full");
          return;
        case "Escape":
          if (clip) {
            clip = null;
            paintClip();
          }
          return;
        case "Home":
          event.preventDefault();
          select(sel.r, 0, event.shiftKey);
          return;
        case "PageDown":
          event.preventDefault();
          move(10, 0, event.shiftKey);
          return;
        case "PageUp":
          event.preventDefault();
          move(-10, 0, event.shiftKey);
          return;
        default:
          break;
      }
      if (key.length === 1) startEdit("", "quick");
    }

    function editKey(event) {
      const key = event.key;
      if (key === "Enter") {
        event.preventDefault();
        commitEdit([event.shiftKey ? -1 : 1, 0]);
        return;
      }
      if (key === "Tab") {
        event.preventDefault();
        commitEdit([0, event.shiftKey ? -1 : 1]);
        return;
      }
      if (key === "Escape") {
        event.preventDefault();
        cancelEdit();
        return;
      }
      if (key === "F2") {
        event.preventDefault();
        editing.mode = editing.mode === "quick" ? "full" : "quick";
        return;
      }
      const arrows = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
      if (arrows[key] && editing.mode === "quick" && editing.source === "cell" && !event.shiftKey && editor.value[0] !== "=") {
        event.preventDefault();
        commitEdit(arrows[key]);
      }
    }

    editor.addEventListener("keydown", (event) => {
      if (event.isComposing || event.keyCode === 229) return;
      if (editing) editKey(event);
      else navKey(event);
    });

    editor.addEventListener("input", () => {
      if (!editing) {
        if (!editor.value) return;
        const typed = editor.value;
        startEdit(typed, "quick");
      }
      pointing = null;
      pointBox.hidden = true;
      fxInput.value = editor.value;
      placeEditor();
    });

    editor.addEventListener("copy", (event) => {
      if (editing || !clip || !event.clipboardData) return;
      event.preventDefault();
      event.clipboardData.setData("text/plain", clip.text);
    });

    editor.addEventListener("cut", (event) => {
      if (editing || !clip || !event.clipboardData) return;
      event.preventDefault();
      event.clipboardData.setData("text/plain", clip.text);
    });

    editor.addEventListener("paste", (event) => {
      if (editing) return;
      event.preventDefault();
      const text = event.clipboardData ? event.clipboardData.getData("text/plain") : "";
      if (text) pasteText(text);
    });

    editor.addEventListener("blur", () => {
      if (editing && editing.source === "cell") commitEdit(null);
    });

    fxInput.addEventListener("focus", () => {
      if (editing) return;
      const sheet = current();
      const data = sheet.cells[cellKey(sel.r, sel.c)];
      sel.r2 = sel.r;
      sel.c2 = sel.c;
      editing = { mode: "full", source: "bar", original: data && data.v != null ? String(data.v) : "", r: sel.r, c: sel.c };
      root.classList.add("is-editing-bar");
      paintSelection();
    });

    fxInput.addEventListener("input", () => {
      pointing = null;
      pointBox.hidden = true;
    });

    fxInput.addEventListener("keydown", (event) => {
      if (!editing || editing.source !== "bar") return;
      if (event.key === "Enter") {
        event.preventDefault();
        root.classList.remove("is-editing-bar");
        commitEdit([1, 0]);
      } else if (event.key === "Tab") {
        event.preventDefault();
        root.classList.remove("is-editing-bar");
        commitEdit([0, event.shiftKey ? -1 : 1]);
      } else if (event.key === "Escape") {
        event.preventDefault();
        root.classList.remove("is-editing-bar");
        cancelEdit();
      }
    });

    fxInput.addEventListener("blur", () => {
      root.classList.remove("is-editing-bar");
      if (editing && editing.source === "bar") commitEdit(null);
    });

    root.addEventListener("focusin", () => root.classList.add("is-focused"));
    root.addEventListener("focusout", (event) => {
      if (!root.contains(event.relatedTarget)) root.classList.remove("is-focused");
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && menuEl) closeMenu();
    });

    if (typeof ResizeObserver !== "undefined") {
      let lastWidth = 0;
      new ResizeObserver(() => {
        const width = viewport.clientWidth;
        if (width && width !== lastWidth) {
          lastWidth = width;
          paintSelection();
        }
      }).observe(viewport);
    }

    paintZoom();
    fullRender();

    return {
      element: root,
      setModel(next) {
        if (editing) endEdit();
        closeMenu();
        model = next && Array.isArray(next.sheets) && next.sheets.length ? next : normalize(next);
        undoStack = [];
        redoStack = [];
        clip = null;
        selBySheet.clear();
        sel = { r: 0, c: 0, r2: 0, c2: 0 };
        viewport.scrollTop = 0;
        viewport.scrollLeft = 0;
        fullRender();
      },
      refresh() {
        paintSelection();
      }
    };
  }

  host.NorteSheet = {
    create,
    normalize,
    engine: {
      parseInputNumber,
      tokenize,
      parseFormula,
      createEvaluator,
      formatNumber,
      display,
      shiftFormula,
      prettifyFormula,
      applyStructure,
      renameSheet,
      removeSheet,
      parseTsv,
      colName,
      colIndex,
      ERR
    }
  };
})();
