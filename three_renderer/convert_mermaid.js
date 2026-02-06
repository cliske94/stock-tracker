const fs = require('fs');
const path = require('path');

// Simple Mermaid -> OBJ converter.
// Finds the first <div class="mermaid">...</div> block in the given HTML file
// and extracts node identifiers like "HelpsiteDep[...]", "SpringDep[...]".
// For each node it emits a cube in a simple grid and writes a Wavefront OBJ.

function extractMermaidText(html) {
  const m = html.match(/<div[^>]*class=["']?mermaid["']?[^>]*>([\s\S]*?)<\/div>/i);
  if (!m) return null;
  return m[1].trim();
}

function parseMermaid(mermaidText) {
  const lines = mermaidText.split('\n');
  const nodes = {};
  const edges = [];
  const subgraphStack = [];
  const subgraphOrder = [];

  for (let rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    // subgraph start: subgraph ID["Title"] or subgraph Title
    const subm = line.match(/^subgraph\s+(?:([A-Za-z0-9_]+)\s*)?(?:\"([^\"]+)\"|\["([^"]+)\"]|([^\n]+))/i);
    if (subm) {
      const title = subm[2] || subm[3] || subm[4] || ('sub'+subgraphOrder.length);
      subgraphStack.push(title.trim());
      if (!subgraphOrder.includes(title)) subgraphOrder.push(title);
      continue;
    }
    if (/^end$/i.test(line)) { subgraphStack.pop(); continue; }

    // Node definition like: NodeId[Label] or NodeId("Label") or NodeId("Label\n(more)")
    const nodem = line.match(/^([A-Za-z0-9_]+)\s*(?:\[|\(|\{)\s*([^\]\)\}]+)\s*(?:\]|\)|\})/);
    if (nodem) {
      const id = nodem[1];
      const rawLabel = nodem[2].replace(/\\n/g,'\\n').trim();
      // try to infer type from label (e.g., 'Deployment: helpsite')
      let type = null; let name = rawLabel;
      const tm = rawLabel.match(/^(Deployment|Service|DaemonSet|Daemon|Pod|Deployment:|Service:|ConfigMap|Ingress|Deployment|StatefulSet|CronJob)[:]?\s*(.+)$/i);
      if (tm) { type = tm[1].replace(':','').trim(); name = tm[2].trim(); }
      // fallback detect 'Service: name' with brackets in some labels
      nodes[id] = { id, label: rawLabel, type: type || null, name: name, subgraph: subgraphStack.length?subgraphStack[subgraphStack.length-1]:null };
      continue;
    }

    // Edge parsing: A -->|label| B  or A --> B  or A -.-> B
    const edgem = line.match(/^([A-Za-z0-9_]+)\s*[-.]+>\s*(?:\|([^|]+)\|\s*)?([A-Za-z0-9_]+)/);
    if (edgem) {
      edges.push({ from: edgem[1], to: edgem[3], label: edgem[2] && edgem[2].trim() });
      continue;
    }
  }

  return { nodes, edges, subgraphOrder };
}

function cubeOBJ(offsetX, offsetY, offsetZ, size, indexStart) {
  const s = size/2;
  const vx = [
    [offsetX - s, offsetY - s, offsetZ - s],
    [offsetX + s, offsetY - s, offsetZ - s],
    [offsetX + s, offsetY + s, offsetZ - s],
    [offsetX - s, offsetY + s, offsetZ - s],
    [offsetX - s, offsetY - s, offsetZ + s],
    [offsetX + s, offsetY - s, offsetZ + s],
    [offsetX + s, offsetY + s, offsetZ + s],
    [offsetX - s, offsetY + s, offsetZ + s]
  ];
  const faces = [
    [1,2,3,4],
    [5,8,7,6],
    [1,5,6,2],
    [2,6,7,3],
    [3,7,8,4],
    [5,1,4,8]
  ];
  let out = '';
  for (const v of vx) out += `v ${v[0]} ${v[1]} ${v[2]}\n`;
  for (const f of faces) {
    const a = f.map(idx => idx + indexStart).join(' ');
    out += `f ${a}\n`;
  }
  return {obj: out, verts: vx.length};
}

function generateOBJFromParsed(parsed, outPath) {
  // Layout strategy:
  // - Each subgraph becomes a column (left to right according to appearance)
  // - Within a subgraph, nodes are stacked vertically
  // - Types (Control Plane / Nodes / Observability / Storage) may be given their own rows if their subgraph titles match
  const nodesArr = Object.values(parsed.nodes);
  const columns = {};
  parsed.subgraphOrder.forEach((s, i) => columns[s] = []);
  // nodes not in a subgraph go to a default column
  const defaultCol = '_default_';
  columns[defaultCol] = [];
  for (const n of nodesArr) {
    const col = n.subgraph || defaultCol;
    if (!columns[col]) columns[col] = [];
    columns[col].push(n);
  }

  const spacingX = 4.0;
  const spacingY = 3.0;
  let obj = '';
  let vertIndex = 0;
  const colKeys = Object.keys(columns);
  for (let ci = 0; ci < colKeys.length; ci++) {
    const key = colKeys[ci];
    const col = columns[key];
    for (let ri = 0; ri < col.length; ri++) {
      const node = col[ri];
      // positioning: x based on column, y based on row, z by type depth
      const x = ci * spacingX;
      const y = -(ri * spacingY);
      // push Deployments and Services slightly forward/back to create depth
      let z = 0;
      if (node.type && /Service/i.test(node.type)) z = -1.2;
      if (node.type && /Deployment|DaemonSet|Pod|StatefulSet|CronJob/i.test(node.type)) z = 1.2;
      const size = 1.6;
      const res = cubeOBJ(x, y, z, size, vertIndex);
      // write a group comment with id and metadata so the viewer can pick it up
      obj += `# ${node.id}\n`;
      if (node.type) obj += `# type:${node.type}\n`;
      if (node.name) obj += `# name:${node.name}\n`;
      if (node.subgraph) obj += `# subgraph:${node.subgraph}\n`;
      obj += res.obj + '\n';
      vertIndex += res.verts;
    }
  }
  fs.writeFileSync(outPath, obj, 'utf8');
  return outPath;
}

function convert(inputHtmlPath, outputObjPath) {
  if (!fs.existsSync(inputHtmlPath)) throw new Error('input file not found: ' + inputHtmlPath);
  const html = fs.readFileSync(inputHtmlPath, 'utf8');
  const mermaid = extractMermaidText(html);
  if (!mermaid) throw new Error('no mermaid block found in ' + inputHtmlPath);
  const parsed = parseMermaid(mermaid);
  generateOBJFromParsed(parsed, outputObjPath);
}

function convertFromHtmlString(html, outputObjPath) {
  const mermaid = extractMermaidText(html);
  if (!mermaid) throw new Error('no mermaid block found in provided html string');
  const parsed = parseMermaid(mermaid);
  generateOBJFromParsed(parsed, outputObjPath);
}

function convertFromMermaidText(mermaidText, outputObjPath) {
  if (!mermaidText || !mermaidText.trim()) throw new Error('empty mermaid text');
  const parsed = parseMermaid(mermaidText);
  generateOBJFromParsed(parsed, outputObjPath);
}

if (require.main === module) {
  const input = process.argv[2] || path.join(__dirname, '..', 'angular_ui', 'dist', 'index.html');
  const out = process.argv[3] || path.join(__dirname, 'public', 'model.obj');
  try {
    const html = fs.readFileSync(input, 'utf8');
    const m = html.match(/<div[^>]*class=["']?mermaid["']?[^>]*>([\s\S]*?)<\/div>/i);
    if (!m) throw new Error('no mermaid block found in ' + input);
    const mermaidText = m[1].trim();
    const parsed = parseMermaid(mermaidText);
    generateOBJFromParsed(parsed, out);
    console.log('Wrote', out);
  } catch (e) {
    console.error(e && e.message);
    process.exit(1);
  }
}

module.exports = { convert, convertFromHtmlString, convertFromMermaidText };

