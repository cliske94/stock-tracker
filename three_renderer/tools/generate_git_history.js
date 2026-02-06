#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Reads public/model_meta.json and produces public/model_meta_time.json
const root = path.resolve(__dirname, '..');
const metaPath = path.join(root, 'public', 'model_meta.json');
const outPath = path.join(root, 'public', 'model_meta_time.json');

if (!fs.existsSync(metaPath)) {
  console.error('model_meta.json not found at', metaPath); process.exit(1);
}

const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
const nodeTimes = {};

for (const n of meta.nodes || []) {
  const id = n.id;
  nodeTimes[id] = { id, history: [] };
  // If repo path is available, try to collect commit timestamps
  const repoPath = n.repo || n.path || n.name || null;
  if (!repoPath) continue;
  try {
    // Limit to files/dirs that exist in the workspace
    // Use git to list commit timestamps touching files under repoPath
    const cmd = `git log --pretty=format:%ct -- ${repoPath}`;
    const out = execSync(cmd, { encoding: 'utf8', stdio: ['pipe','pipe','ignore'] });
    const times = out.split(/\r?\n/).filter(Boolean).map(t => Number(t));
    const counts = {};
    for (const ts of times) {
      counts[ts] = (counts[ts] || 0) + 1;
    }
    const history = Object.keys(counts).map(k => ({ ts: Number(k), weight: counts[k] }));
    // sort ascending
    history.sort((a,b)=>a.ts - b.ts);
    nodeTimes[id].history = history;
  } catch (e) {
    // ignore git failures; leave empty history
  }
}

fs.writeFileSync(outPath, JSON.stringify({ generated: Date.now(), nodes: Object.values(nodeTimes) }, null, 2), 'utf8');
console.log('Wrote', outPath);
