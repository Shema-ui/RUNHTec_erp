const crypto = require('crypto');

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

function genId(length = 15) {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

module.exports = { genId };
