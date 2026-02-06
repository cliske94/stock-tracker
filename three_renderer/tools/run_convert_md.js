const fs = require('fs');
const path = require('path');
const conv = require('../convert_mermaid.js');
const mdPath = path.join(__dirname, '..', 'mermaid-diagram.md');
const md = fs.readFileSync(mdPath,'utf8');
const m = md.match(/```mermaid([\s\S]*?)```/);
if(!m){ console.error('no mermaid in md'); process.exit(1); }
const mermaid = m[1].trim();
const outPath = path.join(__dirname, '..', 'public', 'model.obj');
conv.convertFromMermaidText(mermaid, outPath);
console.log('Wrote', outPath);
