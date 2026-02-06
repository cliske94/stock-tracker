const fs = require('fs');
const path = require('path');

// Scan the workspace for directories that match node ids/names and infer language.
// Writes an enriched model_meta_enriched.json next to model_meta.json.

const workspaceRoot = path.resolve(__dirname, '..', '..');
const metaPath = path.join(__dirname, '..', 'public', 'model_meta.json');
const outPath = path.join(__dirname, '..', 'public', 'model_meta_enriched.json');

function readJson(p){ return JSON.parse(fs.readFileSync(p,'utf8')); }

function detectLang(dir){
  const files = fs.readdirSync(dir).slice(0,200);
  const set = new Set(files);
  if(set.has('package.json')) return 'javascript';
  if(set.has('pom.xml') || set.has('build.gradle') || set.has('gradlew')) return 'java';
  if(set.has('Cargo.toml')) return 'rust';
  if(set.has('requirements.txt') || set.has('setup.py') || set.has('pyproject.toml')) return 'python';
  if(set.has('CMakeLists.txt') || files.some(f=>f.endsWith('.cpp')||f.endsWith('.h')||f.endsWith('.c'))) return 'cpp';
  if(set.has('go.mod')) return 'go';
  return null;
}

function scanDirs(root, maxDepth=3){
  const results = [];
  function walk(dir, depth){
    if(depth>maxDepth) return;
    let list;
    try { list = fs.readdirSync(dir, { withFileTypes: true }); } catch(e){ return; }
    for(const ent of list){
      if(ent.isDirectory()){
        const full = path.join(dir, ent.name);
        results.push(full);
        walk(full, depth+1);
      }
    }
  }
  walk(root, 0);
  return results;
}

function scorePathForNode(dir, node){
  const lname = node.id.toLowerCase();
  const lname2 = (node.name||'').toLowerCase();
  const d = dir.toLowerCase();
  let score = 0;
  if(d.includes('/'+lname+'/') || d.endsWith('/'+lname)) score += 100;
  if(d.includes(lname)) score += 50;
  if(lname2 && (d.includes(lname2) || d.includes(lname2.split(/[^a-z0-9]+/)[0]))) score += 30;
  // small bonus for common repo names
  if(d.includes('src')||d.includes('app')) score += 1;
  return score;
}

function findBestMatchForNode(node, dirs){
  let best = null, bestScore = 0;
  for(const d of dirs){
    const sc = scorePathForNode(d, node);
    if(sc > bestScore){ bestScore = sc; best = d; }
  }
  return bestScore>0? best : null;
}

function main(){
  if(!fs.existsSync(metaPath)) { console.error('meta not found', metaPath); process.exit(1); }
  const meta = readJson(metaPath);
  const dirs = scanDirs(workspaceRoot, 3);
  for(const n of meta.nodes){
    const match = findBestMatchForNode(n, dirs);
    if(match){
      const rel = path.relative(workspaceRoot, match) || '.';
      n.repo = rel;
      const lang = detectLang(match);
      if(lang) n.lang = lang;
    } else {
      n.repo = n.repo || n.id;
      n.lang = n.lang || 'unknown';
    }
  }
  fs.writeFileSync(outPath, JSON.stringify(meta, null, 2), 'utf8');
  console.log('Wrote', outPath);
}

if(require.main===module) main();
