const fs = require('fs');
const path = require('path');

// Read model_meta.json and emit an annotated glTF (JSON, embedded base64 buffer)
// Strategy: create a single box mesh (unit cube) buffer, then create multiple glTF nodes
// each referencing that mesh with a translation. Add node.name and extras with type/name.

function createBoxGeometry(){
  // unit cube centered at origin, size 1.0 (we'll scale in viewer if needed)
  const positions = [
    -0.5,-0.5,-0.5,  0.5,-0.5,-0.5,  0.5,0.5,-0.5, -0.5,0.5,-0.5,
    -0.5,-0.5,0.5,   0.5,-0.5,0.5,   0.5,0.5,0.5,  -0.5,0.5,0.5
  ];
  const indices = [
    0,1,2, 0,2,3, 4,7,6, 4,6,5,
    0,4,5, 0,5,1, 1,5,6, 1,6,2,
    2,6,7, 2,7,3, 3,7,4, 3,4,0
  ];
  return { positions: new Float32Array(positions), indices: new Uint16Array(indices) };
}

function toBase64(buffer){ return Buffer.from(buffer).toString('base64'); }

function writeGltf(metaPath, outPath){
  const meta = JSON.parse(fs.readFileSync(metaPath,'utf8'));
  const box = createBoxGeometry();

  const posBytes = Buffer.from(box.positions.buffer);
  const idxBytes = Buffer.from(box.indices.buffer);
  const posByteLength = posBytes.length;
  const idxByteLength = idxBytes.length;

  // align idx offset to 4
  const idxOffset = posByteLength;
  const totalByteLength = posByteLength + idxByteLength;

  const base64 = toBase64(Buffer.concat([posBytes, idxBytes]));
  const uri = 'data:application/octet-stream;base64,' + base64;

  // glTF JSON
  const gltf = {
    asset: { version: '2.0' },
    scenes: [{ nodes: [] }],
    nodes: [],
    meshes: [],
    buffers: [{ byteLength: totalByteLength, uri }],
    bufferViews: [],
    accessors: []
  };

  // bufferView for positions
  gltf.bufferViews.push({ buffer:0, byteOffset:0, byteLength: posByteLength, target: 34962 });
  // bufferView for indices
  gltf.bufferViews.push({ buffer:0, byteOffset: idxOffset, byteLength: idxByteLength, target: 34963 });

  // accessors
  const countPos = box.positions.length/3;
  gltf.accessors.push({ bufferView:0, byteOffset:0, componentType:5126, count: countPos, type:'VEC3', min:[-0.5,-0.5,-0.5], max:[0.5,0.5,0.5] });
  gltf.accessors.push({ bufferView:1, byteOffset:0, componentType:5123, count: box.indices.length, type:'SCALAR' });

  // one mesh using these accessors
  gltf.meshes.push({ primitives: [ { attributes: { POSITION: 0 }, indices: 1, mode: 4 } ] });

  // create nodes for each meta node
  let nodeIndex = 0;
  for(const n of meta.nodes){
    const [x,y,z] = n.position;
    const node = { name: n.id, mesh: 0, translation: [x, y, z], extras: { id: n.id, name: n.name, type: n.type, subgraph: n.subgraph } };
    gltf.nodes.push(node);
    gltf.scenes[0].nodes.push(nodeIndex++);
  }

  fs.writeFileSync(outPath, JSON.stringify(gltf, null, 2), 'utf8');
  console.log('Wrote', outPath);
}

if(require.main===module){
  const meta = path.join(__dirname, '..', 'public', 'model_meta.json');
  const out = path.join(__dirname, '..', 'public', 'model_annotated.gltf');
  writeGltf(meta, out);
}
