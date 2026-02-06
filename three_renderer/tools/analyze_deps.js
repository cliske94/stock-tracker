#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const metaPath = path.join(root, 'public', 'model_meta.json');
const outPath = path.join(root, 'public', 'model_meta_metrics.json');

if (!fs.existsSync(metaPath)) { console.error('model_meta.json missing'); process.exit(1); }
const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
const metrics = { generated: Date.now(), nodes: [] };

for (const n of meta.nodes || []) {
  const id = n.id;
  const repoPath = n.repo || n.path || n.name || null;
  let loc = 0; let imports = 0;
  if (repoPath && fs.existsSync(repoPath)) {
    try {
      // Aggregate lines of code under path (file or dir)
      const target = repoPath;
      const wcCmd = fs.lstatSync(target).isDirectory()
        ? `find ${target} -type f -not -path '*/.git/*' -exec cat {} + | wc -l`
        : `cat ${target} | wc -l`;
      loc = Number(execSync(wcCmd, { encoding: 'utf8', stdio:['pipe','pipe','ignore'] }).trim()) || 0;
      // crude import/count: look for 'require(' or 'import ' in files
      const grepCmd = fs.lstatSync(target).isDirectory()
        ? `grep -R --line-number -I -E "require\(|\bimport\b" ${target} | wc -l || true`
        : `grep -E "require\(|\bimport\b" ${target} | wc -l || true`;
      imports = Number(execSync(grepCmd, { encoding: 'utf8', stdio:['pipe','pipe','ignore'] }).trim()) || 0;
    } catch (e) {
      // ignore
    }
  }
  metrics.nodes.push({ id, repoPath: repoPath||null, loc, imports });
}

fs.writeFileSync(outPath, JSON.stringify(metrics, null, 2), 'utf8');
console.log('Wrote', outPath);
