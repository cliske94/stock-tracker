const fs = require('fs');
const path = require('path');

function parseMermaidText(mermaidText){
  const lines = mermaidText.split('\n');
  const nodes = {};
  const edges = [];
  const subgraphStack = [];
  const subgraphOrder = [];

  for (let rawLine of lines){
    const line = rawLine.trim();
    if(!line) continue;
    const subm = line.match(/^subgraph\s+(?:([A-Za-z0-9_]+)\s*)?(?:\"([^\"]+)\"|\["([^\"]+)\"]|(.+))/i);
    if(subm){
      const title = (subm[2]||subm[3]||subm[4]||('sub'+subgraphOrder.length)).trim();
      subgraphStack.push(title);
      if(!subgraphOrder.includes(title)) subgraphOrder.push(title);
      continue;
    }
    if(/^end$/i.test(line)){ subgraphStack.pop(); continue; }

    const nodem = line.match(/^([A-Za-z0-9_]+)\s*(?:\[|\(|\{)\s*([^\]\)\}]+)\s*(?:\]|\)|\})/);
    if(nodem){
      const id = nodem[1];
      const rawLabel = nodem[2].replace(/\\n/g,'\\n').trim();
      let type = null; let name = rawLabel;
      const tm = rawLabel.match(/^(Deployment|Service|DaemonSet|Daemon|Pod|ConfigMap|Ingress|StatefulSet|CronJob)[:]?\s*(.+)$/i);
      if(tm){ type = tm[1].replace(':','').trim(); name = tm[2].trim(); }
      nodes[id] = { id, label: rawLabel, type: type||null, name, subgraph: subgraphStack.length?subgraphStack[subgraphStack.length-1]:null };
      continue;
    }

    const edgem = line.match(/^([A-Za-z0-9_]+)\s*[-.]+>\s*(?:\|([^|]+)\|\s*)?([A-Za-z0-9_]+)/);
    if(edgem){ edges.push({ from: edgem[1], to: edgem[3], label: edgem[2]&&edgem[2].trim() }); continue; }
  }

  return { nodes, edges, subgraphOrder };
}

function layoutParsed(parsed){
  const nodesArr = Object.values(parsed.nodes);
  const columns = {};
  parsed.subgraphOrder.forEach(s => columns[s]=[]);
  const defaultCol = '_default_'; columns[defaultCol]=[];
  for(const n of nodesArr){ const col=n.subgraph||defaultCol; if(!columns[col]) columns[col]=[]; columns[col].push(n); }

  const spacingX = 4.0, spacingY = 3.0;
  const resultNodes = [];
  const colKeys = Object.keys(columns);
  for(let ci=0; ci<colKeys.length; ci++){
    const key = colKeys[ci];
    const col = columns[key];
    for(let ri=0; ri<col.length; ri++){
      const node = col[ri];
      const x = ci*spacingX;
      const y = -(ri*spacingY);
      let z = 0;
      if(node.type && /Service/i.test(node.type)) z = -1.2;
      if(node.type && /Deployment|DaemonSet|Pod|StatefulSet|CronJob/i.test(node.type)) z = 1.2;
      resultNodes.push(Object.assign({}, node, { position: [x,y,z] }));
    }
  }
  return { nodes: resultNodes, edges: parsed.edges, columns: colKeys };
}

function main(){
  const mdPath = path.join(__dirname, '..', 'mermaid-diagram.md');
  const outPath = path.join(__dirname, '..', 'public', 'model_meta.json');
  if(!fs.existsSync(mdPath)) { console.error('mermaid file not found:', mdPath); process.exit(1); }
  const md = fs.readFileSync(mdPath,'utf8');
  const m = md.match(/```mermaid([\s\S]*?)```/);
  if(!m){ console.error('no mermaid block in md'); process.exit(1); }
  const mermaid = m[1].trim();
  const parsed = parseMermaidText(mermaid);
  const laid = layoutParsed(parsed);
  fs.writeFileSync(outPath, JSON.stringify(laid, null, 2), 'utf8');
  console.log('Wrote', outPath);
}

if(require.main===module) main();
