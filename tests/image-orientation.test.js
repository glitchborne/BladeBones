'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const context = vm.createContext({ console });
vm.runInContext(fs.readFileSync(path.join(root, 'js/utils.js'), 'utf8'), context, { filename: 'js/utils.js' });

function read(source) {
  return JSON.parse(vm.runInContext(`JSON.stringify(${source})`, context));
}

test('image pixels are mapped from canvas Y-down into BladeBones Y-up local space', () => {
  context.att = { w: 100, h: 60, pivotX: 0.25, pivotY: 0.25 };
  const tr = read('imageTextureToLocalTransform(att)');
  assert.deepEqual(tr, { a: 1, b: 0, c: 0, d: -1, e: -25, f: 45 });

  const map = (x, y) => ({ x: tr.a * x + tr.c * y + tr.e, y: tr.b * x + tr.d * y + tr.f });
  assert.deepEqual(map(0, 0), { x: -25, y: 45 });       // source top-left -> local top-left
  assert.deepEqual(map(100, 60), { x: 75, y: -15 });   // source bottom-right -> local bottom-right
});

test('mesh UV V is converted from BladeBones bottom-origin UVs to image top-origin pixels', () => {
  context.att = { w: 100, h: 60 };
  context.uvTop = { u: 0.2, v: 1 };
  context.uvBottom = { u: 0.2, v: 0 };
  assert.deepEqual(read('imageUVToSourcePoint(uvTop,att)'), { x: 20, y: 0 });
  assert.deepEqual(read('imageUVToSourcePoint(uvBottom,att)'), { x: 20, y: 60 });
});

test('viewport and PNG export both use the same orientation correction', () => {
  const viewport = fs.readFileSync(path.join(root, 'js/canvas-renderer.js'), 'utf8');
  const exporter = fs.readFileSync(path.join(root, 'js/render-export.js'), 'utf8');
  assert.match(viewport, /imageTextureToLocalTransform\(att\)/);
  assert.match(viewport, /imageUVToSourcePoint\(meshVertexUV\(v,att\),att\)/);
  assert.match(exporter, /imageTextureToLocalTransform\(att\)/);
  assert.match(exporter, /imageUVToSourcePoint\(renderExportMeshVertexUV\(v,att\),att\)/);
});
