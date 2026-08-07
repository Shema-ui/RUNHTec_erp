// Translates the small subset of PocketBase's filter syntax actually used
// by the frontend (field = 'value', &&, ||, parentheses, !=) into a
// parameterized SQL WHERE fragment. This is intentionally narrow — it
// covers exactly what apps/web/src sends today, not PocketBase's full
// filter language (no relation dot-access, no ~/?= operators, since the
// frontend never sends those; see the grep audit that drove this design).

function tokenize(filter) {
  const tokens = [];
  const re = /\s*(&&|\|\||!=|>=|<=|=|>|<|\(|\)|'(?:[^'\\]|\\.)*'|[A-Za-z_][A-Za-z0-9_.]*|-?\d+(\.\d+)?|true|false)\s*/y;
  let pos = 0;
  while (pos < filter.length) {
    re.lastIndex = pos;
    const m = re.exec(filter);
    if (!m || m.index !== pos) {
      throw new Error(`Unable to parse filter near: ${filter.slice(pos, pos + 20)}`);
    }
    tokens.push(m[1]);
    pos = re.lastIndex;
  }
  return tokens;
}

function parseFilter(filter, allowedFields) {
  if (!filter || !filter.trim()) return { sql: '1=1', params: [] };

  const tokens = tokenize(filter);
  let i = 0;

  function peek() { return tokens[i]; }
  function next() { return tokens[i++]; }

  function parseValue(raw) {
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    if (raw.startsWith("'") && raw.endsWith("'")) {
      return raw.slice(1, -1).replace(/\\'/g, "'");
    }
    if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
    throw new Error(`Invalid filter value: ${raw}`);
  }

  function parseComparison() {
    if (peek() === '(') {
      next();
      const inner = parseOr();
      if (next() !== ')') throw new Error('Expected closing parenthesis in filter');
      return inner;
    }
    const field = next();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(field)) {
      throw new Error(`Invalid filter field: ${field}`);
    }
    if (allowedFields && !allowedFields.includes(field)) {
      throw new Error(`Filter references unknown field: ${field}`);
    }
    const op = next();
    const valueToken = next();
    const value = parseValue(valueToken);
    const sqlOp = { '=': '=', '!=': '!=', '>': '>', '<': '<', '>=': '>=', '<=': '<=' }[op];
    if (!sqlOp) throw new Error(`Unsupported filter operator: ${op}`);
    return { sql: `\`${field}\` ${sqlOp} ?`, params: [value] };
  }

  function parseAnd() {
    let left = parseComparison();
    while (peek() === '&&') {
      next();
      const right = parseComparison();
      left = { sql: `(${left.sql} AND ${right.sql})`, params: [...left.params, ...right.params] };
    }
    return left;
  }

  function parseOr() {
    let left = parseAnd();
    while (peek() === '||') {
      next();
      const right = parseAnd();
      left = { sql: `(${left.sql} OR ${right.sql})`, params: [...left.params, ...right.params] };
    }
    return left;
  }

  const result = parseOr();
  if (i !== tokens.length) throw new Error(`Unexpected trailing filter content near: ${tokens.slice(i).join(' ')}`);
  return result;
}

module.exports = { parseFilter };
