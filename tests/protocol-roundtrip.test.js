const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');

function appScript(file, marker) {
  const html = fs.readFileSync(path.join(root, file), 'utf8');
  const start = html.indexOf(marker);
  assert(start >= 0, `Missing script marker in ${file}`);
  const match = html.slice(start).match(/<script[^>]*>([\s\S]*?)<\/script>/i);
  assert(match, `Missing app script in ${file}`);
  return match[1];
}

function element(id) {
  return {
    id,
    style: {},
    className: '',
    classList: { add() {}, remove() {}, toggle() {} },
    children: [],
    value: id === 'chunk' ? '1000' : id === 'ecc' ? 'M' : id === 'mode' ? 'auto' : id === 'speed' ? '1200' : '',
    disabled: false,
    innerHTML: '',
    textContent: '',
    addEventListener() {},
    appendChild(child) { this.children.push(child); },
    scrollIntoView() {},
    pause() {},
    play() { return Promise.resolve(); },
    getContext() { return {}; }
  };
}

function context() {
  const elements = {};
  const document = {
    fullscreenElement: null,
    getElementById(id) { return elements[id] || (elements[id] = element(id)); },
    createElement(tag) { return element(tag); },
    addEventListener() {},
    body: element('body')
  };
  const ctx = {
    Uint8Array,
    DataView,
    Array,
    Math,
    Date,
    Promise,
    parseInt,
    isFinite,
    encodeURIComponent,
    decodeURIComponent,
    escape,
    unescape,
    setInterval() { return 1; },
    clearInterval() {},
    setTimeout() {},
    requestAnimationFrame() { return 1; },
    cancelAnimationFrame() {},
    addEventListener() {},
    atob(value) { return Buffer.from(value, 'base64').toString('binary'); },
    btoa(value) { return Buffer.from(value, 'binary').toString('base64'); },
    document,
    navigator: {},
    location: { href: 'https://getqrbeam.netlify.app' },
    URL: { createObjectURL() { return 'blob:test'; }, revokeObjectURL() {} },
    Blob: function Blob() {},
    FileReader: function FileReader() {},
    qrcode() {
      return { addData() {}, make() {}, createImgTag() { return ''; }, getModuleCount() { return 21; }, isDark() { return false; } };
    }
  };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  return vm.createContext(ctx);
}

function loadSender() {
  let source = appScript('sender/QR-Transfer.html', '<!-- ===================== APP ===================== -->');
  source = source.replace(/\}\)\(\);\s*$/, `
    globalThis.__senderTest = {
      sha256Hex: sha256Hex,
      textToBytes: textToBytes,
      makeFrames: function(bytes, name, size){
        payloadB64 = bytesToB64(bytes);
        origBytes = bytes.length;
        transferHash = sha256Hex(bytes);
        fileName = name;
        fileId = 'TEST1234';
        chunks = makeChunks(payloadB64, size);
        computeFramePadTarget();
        var frames = [];
        for(var i=0;i<chunks.length;i++){ frames.push(framePayload(i)); }
        return frames;
      }
    };
  })();`);
  const ctx = context();
  vm.runInContext(source, ctx, { filename: 'sender-app.js' });
  return ctx.__senderTest;
}

function loadReceiver() {
  let source = appScript('receiver/index.html', '<!-- ===================== RECEIVER APP ===================== -->');
  source = source.replace(/\}\)\(\);\s*$/, `
    globalThis.__receiverTest = {
      parseFrame: parseFrame,
      validFrame: validFrame,
      decodeName: decodeName,
      b64ToBytes: b64ToBytes,
      sha256Hex: sha256Hex
    };
  })();`);
  const ctx = context();
  vm.runInContext(source, ctx, { filename: 'receiver-app.js' });
  return ctx.__receiverTest;
}

const sender = loadSender();
const receiver = loadReceiver();

function expectedHash(bytes) {
  return crypto.createHash('sha256').update(Buffer.from(bytes)).digest('hex');
}

function roundTrip(label, bytes, name) {
  const frames = sender.makeFrames(bytes, name, 700);
  assert(frames.length > 1, `${label}: expected multiple pages`);
  assert(frames.every(frame => frame.length === frames[0].length), `${label}: padded frames changed size`);

  const shuffledWithDuplicates = frames.slice().reverse().concat([frames[0], frames[frames.length - 1]]);
  const pages = {};
  let metadata = null;
  shuffledWithDuplicates.forEach(text => {
    const frame = receiver.parseFrame(text);
    assert(receiver.validFrame(frame), `${label}: receiver rejected a sender frame`);
    metadata = metadata || frame;
    if(pages[frame.page] === undefined) pages[frame.page] = frame.data;
  });

  assert.strictEqual(Object.keys(pages).length, metadata.total, `${label}: page count mismatch`);
  const joined = Array.from({ length: metadata.total }, (_, i) => pages[i + 1]).join('');
  const rebuilt = receiver.b64ToBytes(joined);
  assert.deepStrictEqual(Buffer.from(rebuilt), Buffer.from(bytes), `${label}: rebuilt bytes differ`);
  assert.strictEqual(receiver.decodeName(metadata.name), name, `${label}: filename changed`);
  assert.strictEqual(receiver.sha256Hex(rebuilt), expectedHash(bytes), `${label}: receiver hash mismatch`);
  assert.strictEqual(sender.sha256Hex(bytes), expectedHash(bytes), `${label}: sender hash mismatch`);
}

const binary = Uint8Array.from({ length: 4096 }, (_, i) => (i * 73 + 19) & 255);
const pngLike = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10].concat(Array.from({ length: 2048 }, (_, i) => (i * 31) & 255)));
const utf8Text = sender.textToBytes('Lab data: \u0394 absorbance\n\u65e5\u672c\u8a9e \ud83d\ude00\n'.repeat(90));

roundTrip('binary', binary, 'instrument-export.bin');
roundTrip('PNG', pngLike, 'preview.png');
roundTrip('UTF-8', utf8Text, 'results-\u65e5\u672c\u8a9e-\ud83d\ude00.txt');

const smallData = Buffer.from('legacy').toString('base64');
const legacyName = Buffer.from('old.txt', 'utf8').toString('base64');
const legacyHash = expectedHash(Buffer.from('legacy'));
assert(receiver.validFrame(receiver.parseFrame(`QRT3|OLD12345|1|1|${legacyName}|6|${legacyHash}|${smallData}`)));
assert(receiver.validFrame(receiver.parseFrame(`QRT2|OLD12345|1|1|${legacyName}|${smallData}`)));
assert.strictEqual(receiver.parseFrame('QRT4|X|1|1|bmFtZQ==|1||5001|A'), null);

const tooMany = receiver.parseFrame(`QRT4|X|1|501|${legacyName}|6|${legacyHash}|${smallData.length}|${smallData}`);
assert.strictEqual(receiver.validFrame(tooMany), false);
const junkNumber = receiver.parseFrame(`QRT4|X|1oops|1|${legacyName}|6|${legacyHash}|${smallData.length}|${smallData}`);
assert.strictEqual(receiver.validFrame(junkNumber), false);

console.log('qrbeam protocol tests passed: binary, PNG, UTF-8, shuffled/duplicate pages, padding, limits, QRT3 and QRT2');
