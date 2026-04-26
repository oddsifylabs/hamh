/**
 * Worker Secrets Loader
 * Lightweight env wrapper for standalone HWMH workers.
 */
require('dotenv').config();

function has(key) {
  const v = process.env[key];
  return v !== undefined && v !== '' && v !== '***';
}

function get(key, def) {
  const v = process.env[key];
  if (v === undefined || v === '' || v === '***') return def;
  return v;
}

function getOrThrow(key) {
  const v = get(key);
  if (v === undefined) throw new Error(`Missing env var: ${key}`);
  return v;
}

module.exports = { has, get, getOrThrow };
