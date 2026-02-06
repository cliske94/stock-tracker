const fs = require('fs');
const path = require('path');

function parseOBJ(objText) {
  const lines = objText.split(/\r?\n/);
  const verts = [];
  const tris = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    if (t.startsWith('v ')) {
      const parts = t.split(/\s+/).slice(1).map(Number);
      verts.push(parts);
    } else if (t.startsWith('f ')) {
      const parts = t.split(/\s+/).slice(1).map(p => {
        const idx = p.split('/')[0];
        return parseInt(idx,10) - 1;
      });
      if (parts.length === 3) tris.push(parts);
      else if (parts.length === 4) {
        tris.push([parts[0], parts[1], parts[2]]);
        tris.push([parts[0], parts[2], parts[3]]);
      } else if (parts.length > 4) {
        // fan triangulate
        for (let i=1;i<parts.length-1;i++) tris.push([parts[0], parts[i], parts[i+1]]);
      }
    }
  }
  return {verts, tris};
}

function buildGLTF(verts, tris) {
  // build binary buffers (positions float32 and indices uint16/uint32)
  const positionCount = verts.length;
  const positions = new Float32Array(positionCount * 3);
  for (let i=0;i<positionCount;i++) {
    positions[i*3+0] = verts[i][0];
    positions[i*3+1] = verts[i][1];
    positions[i*3+2] = verts[i][2];
  }
  const indexCount = tris.length * 3;
  const useUint32 = positionCount > 65535 || indexCount > 65535;
  const IndicesArray = useUint32 ? Uint32Array : Uint16Array;
  const indices = new IndicesArray(indexCount);
  for (let i=0;i<tris.length;i++) {
    indices[i*3+0] = tris[i][0];
    indices[i*3+1] = tris[i][1];
    indices[i*3+2] = tris[i][2];
  }

  // Create buffer blob: positions then indices, align to 4 bytes per glTF requirements
  const posBuffer = Buffer.from(positions.buffer);
  const idxBuffer = Buffer.from(indices.buffer);
  function pad4(buf) { const pad = (4 - (buf.length % 4)) % 4; if (pad===0) return buf; return Buffer.concat([buf, Buffer.alloc(pad)]); }
  const posP = pad4(posBuffer);
  const idxP = pad4(idxBuffer);
  const totalBuffer = Buffer.concat([posP, idxP]);

  const positionBufferView = 0;
  const indexBufferView = 1;

  const gltf = {
    asset: { version: '2.0' },
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1, mode: 4 }] }],
    buffers: [{ byteLength: totalBuffer.length, uri: 'data:application/octet-stream;base64,' + totalBuffer.toString('base64') }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: posP.length, target: 34962 },
      { buffer: 0, byteOffset: posP.length, byteLength: idxP.length, target: 34963 }
    ],
    accessors: [
      { bufferView: positionBufferView, byteOffset: 0, componentType: 5126, count: positionCount, type: 'VEC3', max: calcMax(positions), min: calcMin(positions) },
      { bufferView: indexBufferView, byteOffset: 0, componentType: useUint32 ? 5125 : 5123, count: indexCount, type: 'SCALAR' }
    ]
  };

  return JSON.stringify(gltf, null, 2);
}

function calcMax(floatArray) {
  const a = new Float32Array(floatArray);
  let mx = -Infinity, my=-Infinity, mz=-Infinity;
  for (let i=0;i<a.length;i+=3) { mx = Math.max(mx, a[i]); my = Math.max(my, a[i+1]); mz = Math.max(mz, a[i+2]); }
  return [mx,my,mz];
}
function calcMin(floatArray) {
  const a = new Float32Array(floatArray);
  let mx = Infinity, my=Infinity, mz=Infinity;
  for (let i=0;i<a.length;i+=3) { mx = Math.min(mx, a[i]); my = Math.min(my, a[i+1]); mz = Math.min(mz, a[i+2]); }
  return [mx,my,mz];

}

function convert(inputPath, outputPath) {
  const txt = fs.readFileSync(inputPath, 'utf8');
  const {verts, tris} = parseOBJ(txt);
  if (verts.length===0 || tris.length===0) throw new Error('no geometry parsed');
  const gltf = buildGLTF(verts, tris);
  fs.writeFileSync(outputPath, gltf, 'utf8');
  return outputPath;
}

if (require.main===module) {
  const input = process.argv[2] || path.join(__dirname, '..', 'public', 'model.obj');
  const out = process.argv[3] || path.join(__dirname, '..', 'public', 'model.gltf');
  try {
    const r = convert(input, out);
    console.log('Wrote', r);
  } catch (e) {
    console.error(e && e.message);
    process.exit(1);
  }
}

module.exports = { convert };
