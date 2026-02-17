// StarUML Controller Regression Test Utilities
// Shared HTTP client, TestContext, and HTML reporter

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

const BASE_URL = 'http://localhost:12345';

// --- URL-encode IDs for path parameters ---
export function encId(id) {
  return encodeURIComponent(id);
}

// --- HTTP helpers ---
async function request(method, path, body) {
  const url = `${BASE_URL}${path}`;
  const opts = { method, headers: {} };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(url, opts);
  const json = await res.json();
  if (!res.ok) {
    const msg = json.message || json.error || JSON.stringify(json);
    throw new Error(`${method} ${path} → ${res.status}: ${msg}`);
  }
  return json;
}

export async function apiGet(path) { return request('GET', path); }
export async function apiPost(path, body) { return request('POST', path, body); }
export async function apiPut(path, body) { return request('PUT', path, body); }
export async function apiDelete(path) { return request('DELETE', path); }

// --- TestContext ---
export class TestContext {
  constructor(family, outputDir) {
    this.family = family;
    this.outputDir = outputDir;
    this.steps = [];       // { name, status, error?, duration, image? }
    this.startTime = null;
    this.snapshotPath = `/tmp/staruml_regression_snapshot_${family}.mdj`;
    this._exportCount = 0;
  }

  async checkServer() {
    const step = this._begin('Check server');
    try {
      const res = await apiGet('/api/status');
      if (!res.data?.version) throw new Error('No version in status response');
      step.status = 'pass';
    } catch (e) {
      step.status = 'fail';
      step.error = e.message;
      throw e;
    } finally {
      this._end(step);
    }
  }

  async saveSnapshot() {
    const step = this._begin('Save snapshot');
    try {
      await apiPost('/api/project/save', { path: this.snapshotPath });
      step.status = 'pass';
    } catch (e) {
      step.status = 'fail';
      step.error = e.message;
      throw e;
    } finally {
      this._end(step);
    }
  }

  async restoreSnapshot() {
    const step = this._begin('Restore snapshot');
    try {
      await apiPost('/api/project/open', { path: this.snapshotPath });
      step.status = 'pass';
    } catch (e) {
      step.status = 'fail';
      step.error = e.message;
    } finally {
      this._end(step);
    }
  }

  async exportDiagram(diagramId, label) {
    this._exportCount++;
    const imgName = this._exportCount === 1 ? 'diagram.png' : `diagram_${this._exportCount}.png`;
    const imgPath = join(this.outputDir, imgName);
    const step = this._begin(label || 'Export diagram');
    try {
      await new Promise(r => setTimeout(r, 600));
      await apiPost(`/api/diagrams/${encId(diagramId)}/export`, {
        path: imgPath,
        format: 'png',
      });
      if (!existsSync(imgPath)) throw new Error(`Image not found: ${imgPath}`);
      const buf = readFileSync(imgPath);
      step.image = buf.toString('base64');
      step.status = 'pass';
      return imgPath;
    } catch (e) {
      step.status = 'fail';
      step.error = e.message;
      throw e;
    } finally {
      this._end(step);
    }
  }

  async layoutDiagram(diagramId) {
    const step = this._begin('Layout diagram');
    try {
      await apiPost(`/api/diagrams/${encId(diagramId)}/layout`, {});
      step.status = 'pass';
    } catch (e) {
      step.status = 'fail';
      step.error = e.message;
      throw e;
    } finally {
      this._end(step);
    }
  }

  step(name) {
    const s = this._begin(name);
    return {
      pass: () => { s.status = 'pass'; this._end(s); },
      fail: (err) => { s.status = 'fail'; s.error = err; this._end(s); },
    };
  }

  _begin(name) {
    const s = { name, status: 'running', _start: Date.now() };
    this.steps.push(s);
    return s;
  }

  _end(s) {
    s.duration = Date.now() - s._start;
    delete s._start;
  }

  get passed() { return this.steps.every(s => s.status === 'pass'); }
  get summary() {
    const pass = this.steps.filter(s => s.status === 'pass').length;
    const fail = this.steps.filter(s => s.status === 'fail').length;
    return { pass, fail, total: this.steps.length };
  }

  generateHTML() {
    const sum = this.summary;
    const statusBadge = this.passed
      ? '<span style="background:#22c55e;color:#fff;padding:4px 12px;border-radius:4px;font-weight:bold">PASS</span>'
      : '<span style="background:#ef4444;color:#fff;padding:4px 12px;border-radius:4px;font-weight:bold">FAIL</span>';

    const rows = this.steps.map(s => {
      const bg = s.status === 'pass' ? '#f0fdf4' : '#fef2f2';
      const icon = s.status === 'pass' ? '&#10003;' : '&#10007;';
      const color = s.status === 'pass' ? '#16a34a' : '#dc2626';
      let detail = s.error ? `<div style="color:#dc2626;font-size:13px;margin-top:4px">${escapeHtml(s.error)}</div>` : '';
      if (s.image) {
        detail += `<div style="margin-top:8px"><img src="data:image/png;base64,${s.image}" style="max-width:100%;border:1px solid #ddd;border-radius:4px" /></div>`;
      }
      return `<tr style="background:${bg}">
        <td style="padding:8px;color:${color};font-weight:bold;width:30px;text-align:center">${icon}</td>
        <td style="padding:8px">${escapeHtml(s.name)} <span style="color:#999;font-size:12px">${s.duration ?? 0}ms</span>${detail}</td>
      </tr>`;
    }).join('\n');

    const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>${this.family} Regression Test</title>
<style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:900px;margin:40px auto;padding:0 20px}
table{width:100%;border-collapse:collapse;margin-top:16px}tr{border-bottom:1px solid #e5e7eb}</style>
</head><body>
<h1>${this.family} Regression Test</h1>
<p>${statusBadge} &nbsp; ${sum.pass}/${sum.total} steps passed</p>
<table>${rows}</table>
<p style="color:#999;font-size:12px;margin-top:24px">Generated: ${new Date().toISOString()}</p>
</body></html>`;

    const outPath = join(this.outputDir, 'results.html');
    writeFileSync(outPath, html, 'utf8');
    return outPath;
  }
}

// --- Run helper ---
export async function runTest(family, outputDir, testFn) {
  const ctx = new TestContext(family, outputDir);
  let testError = null;
  try {
    await ctx.checkServer();
    await ctx.saveSnapshot();
    try {
      await testFn(ctx);
    } catch (e) {
      testError = e;
    } finally {
      await ctx.restoreSnapshot();
    }
  } catch (e) {
    testError = e;
  }
  const htmlPath = ctx.generateHTML();
  const sum = ctx.summary;
  console.log(`[${family}] ${ctx.passed ? 'PASS' : 'FAIL'} (${sum.pass}/${sum.total}) → ${htmlPath}`);
  if (testError && ctx.steps.every(s => s.status !== 'fail')) {
    console.error(`[${family}] Uncaught error: ${testError.message}`);
  }
  return { family, passed: ctx.passed, summary: sum, htmlPath };
}

function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
