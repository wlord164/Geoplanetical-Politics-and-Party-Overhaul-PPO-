"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { execFileSync } = require("node:child_process");
const { version, patchRenderer, patchWorker, sha256 } = require("./patch.cjs");
const { withInstallerTransaction } = require("./installer-transaction.cjs");
// Windows Steam build 26709373, depot 940231 manifest 43069630429240561.
const currentStock = {
  version: "1.1.4",
  archive: "3546fb0a84f279a4dfdb0dac55bedb53849a2e88073887e8a121e4c6ce6ad2bd",
  payload: "1350bfc579b9578e92591deffe774654c83c237ebc211bd05a37aec8bd779138",
  executable: "44ffa2b19e8eb63ca64aa09dd7a1cdd766194ba20faa8444a99ad2b7f5462134",
  worker: "b6c6f5385c43515d9c10dfd920f98ba76da45fdba83575ab3d62c064e41a21f0",
  renderer: "a6192a73e70c0eab556629f4917a6a74b8ef582bf8bc339bc58420bfb30103d9",
};
const previousStock = [{
  version: "1.1.3",
  archive: "be810dd717afc249fc1b46ec349440d4732f4ce2aa3b58f77d3fcfd6972efd48",
  payload: "fdeda8a30d6d51fa831e4ba07f52ace98575631be1d00e4d78a23581d6d3015b",
  executable: "6c0f558ebc1674d309480e5f268280583424a920f8556a756e01c3136c41b675",
  worker: "c38f7da0de30b5df6818e6884ff1b2763154351016b10163b3369533564a6fda",
}, {
  version: "1.1.2",
  archive: "519dda4117db8ef49eb77a66ed2a9ee9c5a53225fa91847868654f586109e34a",
  payload: "e45165ccaea35062b9697aff48f9c67258dc53002708d75dad7d2ccff1fee05c",
  executable: "a53d56e974d6a8b8a3669fdf3de5a4278b250a51fbd43a1561f2ac1cb269daf6",
  worker: "20a49734f11daa32d905dc9e07c7704d9d0aa73ab8dcc0902f6e81ce7e1be0bd",
}];

// Steam can leave a verified PPO renderer on disk after replacing the three
// stock files. The stock ASAR uses its own packed renderer.
const previousRenderers = new Set([
  "1cb5a52eb49d2b80be339f133bc91ab92b3616e5390433d1ffe51af14d7697c6", // Simulation Stability Update
  "e7730587c368f404b33ae83ea748103226b34c9283c520b6345b7816887f8f63", // Private Congress spacing candidate
  "a24180e1b1e516c21c24e1fc1abd804d1a9ae4f29f18cc2995a5ece7be3774e6", // Verified Far-Right Currents release
  "3e96283cc48f22f390d0a39fcbad3bf99ba71188a62ed7ec8aed1f1563e4057f", // Verified membership-backed Ideology Overhaul release
  "0dd9e36becea39be7ae6484b70d6f7cb8cf3b20844dd48a221ccad80c903e878", // Verified Congress Expansion release
  "05d674a36921246a72a33c3694d3b9f0b7193f54b007110a4dc24dac968f2487", // Verified Party Leadership and Ideology update
  "2470d35f3979d0e705e366bd4d8bc27ef7578031940d0712eab73c4148ea08fe", // Verified Congress Layout candidate
  "b56bbd651da2a14b39d6f19914ddd787aa9218d25e7308374db6a824a200e199", // Verified Congress Portraits and Ideology candidate
  "978a8ab5bf5aaaa81e73d07411ae8d07b57fdf0becf69ceae539f2b3b205fca3", // Verified Faction Leadership and Ideology candidate
  "e322fc6833a7a33baa2b2e66833f10bbe2d6dc2faeb8f6a652b74803d4791727", // Verified Domestic Politics and Stability Update
  "c677564d90f8e53e9d403f612551baf9876ea39dd7824d98fbd5e76e4b5e8242", // Verified Congress and Staff Follow-up
  "ed73f6046a28984d7d21120d5073be42e3b06a028668ada15625c250aa296474", // Verified Domestic Politics UI follow-up
  "0b6b5321aa82ef5d657f4661d32442fa72f6c750d935031daa0d4f0f86d4c763", // Verified Domestic Politics candidate
  "7dba7ed6092b02ee1b1486c0502f6a61ad8fc8a73c39f8a729cc831274d83b5a", // Historical Conflicts Cleanup
  "506e1ea8625fe13742147a3bd621e0b9bd7a07c8ff94568f5f8a02128ee48d54", // Private War Interface test build
  "555fac76f011886992925a4118f8010cb24cdb568d4a54000b64279ce63e2186", // Campaign Rules Correction
  "57575cd948e816253c33085bc8da3e6161125e082b3dc42063e20502d472759f", // Follow-up Hotfix
  "94dd70ed5c0fced7c3c6b638ddb49f0504e58844c07a9d189665c937b82bb704", // Stabilization Hotfix
  "0142e701c8cff93f53a23cd118aa24576442776c6758624f29830e0bb41ce18c", // Political Control Borders
  "6386fd28e39c05ba82f64f6ec0af82f6f5a32174e25b28aea1b3a5bccdfd8b47", // Worldwide Historical Conflicts and Ideology Update (68514dd)
  "1d9395a019387e945ae30326bba1824dc1609da9a7dca1a136113bf5fa7a6876", // Historical map update installed before territorial governments
  "f3e873fecca56166cde1e66f48aca11690cf5609c43201547a0e367a2d4c01de", // Territorial Governments update
  "428293592321e1d3f39c7adfe9580878bba83567e48db677377bf26863ce630d", // Campaign Rules update
  "2242ae52a3bdc2ed80c22aed5771d77855bd5e54e8a4f99f193565cc661d3853", // Regional Map Layout update
  "c51fb033f44075802ec35eafe78bcce2d69941aadfa3a5cf0b9391ab9ab2bc02", // Party Ideology Overhaul (262ae3a)
]);
const backups = { archive: "backupArchive", worker: "backupWorker", executable: "backupExecutable" };

function steamGamePath() {
  const output = execFileSync("reg.exe", ["query", "HKLM\\SOFTWARE\\WOW6432Node\\Valve\\Steam", "/v", "InstallPath"], { encoding: "utf8" });
  const steam = output.match(/InstallPath\s+REG_\w+\s+(.+)/i)?.[1].trim();
  if (!steam) throw new Error("Steam installation not found. Pass the Geoplanetical folder as an argument.");
  const steamApps = path.join(steam, "steamapps");
  const libraryConfig = path.join(steamApps, "libraryfolders.vdf");
  const config = fs.existsSync(libraryConfig) ? fs.readFileSync(libraryConfig, "utf8") : "";
  const libraries = [steam, ...Array.from(config.matchAll(/"path"\s+"([^"\r\n]+)"/g), match => match[1].replaceAll("\\\\", "\\"))];
  const games = new Map();
  for (const library of libraries) {
    const apps = path.join(library, "steamapps");
    const manifest = path.join(apps, "appmanifest_940230.acf");
    if (!fs.existsSync(manifest)) continue;
    const folder = fs.readFileSync(manifest, "utf8").match(/"installdir"\s+"([^"\r\n]+)"/)?.[1];
    if (!folder || folder === "." || folder === ".." || path.basename(folder) !== folder) continue;
    const game = path.join(apps, "common", folder);
    if (fs.existsSync(path.join(game, "Geoplanetical.exe")) ||
        fs.existsSync(path.join(game, "resources", ".party-mod-transaction", "moves.json"))) {
      games.set(game.toLowerCase(), game);
    }
  }
  if (games.size === 1) return games.values().next().value;
  throw new Error(games.size ? "More than one Steam installation was found. Pass the Geoplanetical folder as an argument."
    : "Geoplanetical was not found in a Steam library. Pass the Geoplanetical folder as an argument.");
}

function openArchive(file) {
  const fd = fs.openSync(file, "r");
  try {
    const prefix = Buffer.alloc(16);
    if (fs.readSync(fd, prefix, 0, prefix.length, 0) !== prefix.length || prefix.readUInt32LE(0) !== 4) throw new Error("Invalid game archive");
    const length = prefix.readUInt32LE(12);
    const offset = 8 + prefix.readUInt32LE(4);
    if (length > 32 * 1024 * 1024 || offset < 16 + length) throw new Error("Invalid game archive header");
    const json = Buffer.alloc(length);
    if (fs.readSync(fd, json, 0, json.length, 16) !== json.length) throw new Error("Truncated game archive header");
    return { json: JSON.parse(json), length, offset, hash: sha256(json) };
  } finally { fs.closeSync(fd); }
}

function readEntry(file, archive, entry) {
  if (!entry || entry.unpacked || !/^\d+$/.test(entry.offset) || entry.size > 32 * 1024 * 1024) throw new Error("Unsupported game archive entry");
  const fd = fs.openSync(file, "r");
  try {
    const bytes = Buffer.alloc(entry.size);
    if (fs.readSync(fd, bytes, 0, bytes.length, archive.offset + Number(entry.offset)) !== bytes.length) throw new Error("Truncated game archive entry");
    return bytes;
  } finally { fs.closeSync(fd); }
}

function updateEntry(entry, bytes) {
  const blockSize = entry.integrity.blockSize;
  const blocks = [];
  for (let offset = 0; offset < bytes.length; offset += blockSize) blocks.push(sha256(bytes.subarray(offset, offset + blockSize)));
  delete entry.offset;
  entry.size = bytes.length;
  entry.unpacked = true;
  entry.integrity = { algorithm: "SHA256", hash: sha256(bytes), blockSize, blocks };
}

function updateArchiveDigest(bytes, originalHash, newHash) {
  if (sha256(bytes) !== currentStock.executable) throw new Error(`Unsupported Geoplanetical executable. This mod targets ${version}.`);
  const resource = JSON.stringify([{ file: "resources\\app.asar", alg: "SHA256", value: originalHash }]);
  const index = bytes.indexOf(resource);
  if (index < 0 || bytes.indexOf(resource, index + resource.length) >= 0) throw new Error("The expected Electron archive integrity resource was not found");
  bytes.write(newHash, index + resource.indexOf(originalHash), "ascii");
  return bytes;
}

function patchedArchiveHeader(header, renderer, worker) {
  const entries = header.json.files.renderer.files;
  updateEntry(entries["app.bundle.js"], renderer);
  updateEntry(entries["simulation-worker.bundle.js"], worker);
  const json = Buffer.from(JSON.stringify(header.json));
  const bytes = Buffer.alloc(Math.max(header.length, json.length), 0x20);
  json.copy(bytes);
  return bytes;
}

function writePatchedArchive(original, target, headerBytes) {
  const header = openArchive(original);
  if (headerBytes.length === header.length) {
    fs.copyFileSync(original, target, fs.constants.COPYFILE_EXCL);
    const fd = fs.openSync(target, "r+");
    try {
      if (fs.writeSync(fd, headerBytes, 0, headerBytes.length, 16) !== headerBytes.length)
        throw new Error("Could not finish the game archive");
      fs.fsyncSync(fd);
    } finally { fs.closeSync(fd); }
    return;
  }
  // ASAR entry offsets are relative to the payload. Only the header pickle
  // grows, so every packaged file can be copied at its existing offset.
  const aligned = Math.ceil(headerBytes.length / 4) * 4;
  const prefix = Buffer.alloc(16);
  prefix.writeUInt32LE(4, 0);
  prefix.writeUInt32LE(aligned + 8, 4);
  prefix.writeUInt32LE(aligned + 4, 8);
  prefix.writeUInt32LE(headerBytes.length, 12);
  const input = fs.openSync(original, "r");
  try {
    const output = fs.openSync(target, "wx");
    try {
      fs.writeFileSync(output, prefix);
      fs.writeFileSync(output, headerBytes);
      fs.writeFileSync(output, Buffer.alloc(aligned - headerBytes.length));
      const chunk = Buffer.allocUnsafe(16 * 1024 * 1024);
      const size = fs.fstatSync(input).size;
      for (let offset = header.offset; offset < size;) {
        const count = fs.readSync(input, chunk, 0, Math.min(size - offset, chunk.length), offset);
        if (!count) throw new Error("The original game archive was truncated while copying");
        fs.writeFileSync(output, chunk.subarray(0, count));
        offset += count;
      }
      fs.fsyncSync(output);
    } finally { fs.closeSync(output); }
  } finally { fs.closeSync(input); }
}

function getFiles(game) {
  game = path.resolve(game);
  const resources = path.join(game, "resources");
  const renderer = path.join(resources, "app.asar.unpacked", "renderer");
  const archive = path.join(resources, "app.asar");
  const worker = path.join(renderer, "simulation-worker.bundle.js");
  const executable = path.join(game, "Geoplanetical.exe");
  return { archive, worker, executable, renderer: path.join(renderer, "app.bundle.js"),
    backupArchive: archive + ".party-mod-original", backupWorker: worker + ".party-mod-original",
    backupExecutable: executable + ".party-mod-original" };
}

function verifyArchivePayload(file, { offset }, expected = currentStock.payload) {
  const hash = createHash("sha256");
  const chunk = Buffer.allocUnsafe(16 * 1024 * 1024);
  const fd = fs.openSync(file, "r");
  try {
    let position = offset;
    for (let count; (count = fs.readSync(fd, chunk, 0, chunk.length, position)); position += count) {
      hash.update(chunk.subarray(0, count));
    }
  } finally {
    fs.closeSync(fd);
  }
  if (hash.digest("hex") !== expected) {
    throw new Error(`Archive data failed integrity verification: ${path.basename(file)}. Use Steam Verify Integrity before retrying.`);
  }
}

function buildRenderer(archive, header) {
  const entry = header.json.files.renderer.files["app.bundle.js"];
  const original = readEntry(archive, header, entry);
  if (sha256(original) !== currentStock.renderer) throw new Error(`Unsupported Geoplanetical renderer. This mod targets ${version}.`);
  return patchRenderer(original);
}

function buildPatch(archive, worker, executable) {
  const header = openArchive(archive);
  if (header.hash !== currentStock.archive) {
    throw new Error(`The original game archive must be from Geoplanetical ${version}, Steam build 26709373.`);
  }
  verifyArchivePayload(archive, header);
  const rendererBytes = buildRenderer(archive, header);
  const workerBytes = patchWorker(fs.readFileSync(worker));
  const headerBytes = patchedArchiveHeader(header, rendererBytes, workerBytes);
  const executableBytes = updateArchiveDigest(fs.readFileSync(executable), header.hash, sha256(headerBytes));
  return { archive: headerBytes, worker: workerBytes, renderer: rendererBytes, executable: executableBytes };
}

function fileIdentity(file) {
  const stat = fs.lstatSync(file, { bigint: true, throwIfNoEntry: false });
  if (!stat) return null;
  if (!stat.isFile()) throw new Error(`Expected an ordinary game file at ${file}`);
  return [stat.dev, stat.ino, stat.size, stat.mtimeNs, stat.ctimeNs].join(":");
}

function readState(files) {
  const identities = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, fileIdentity(file)]));
  const headers = Object.fromEntries(["archive", "backupArchive"].map(key => [key,
    identities[key] === null ? null : openArchive(files[key]),
  ]));
  const hashes = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, identities[key] === null ? null
    : headers[key]?.hash ?? sha256(fs.readFileSync(file))
  ]));
  return { identities, headers, hashes };
}

function stockRuntime(hashes) {
  return Object.keys(backups).every(key => hashes[key] === currentStock[key]);
}

function verifyBackups(files, state) {
  const existing = Object.entries(backups).filter(([, key]) => state.hashes[key] !== null);
  if (!existing.length) return { existing, stock: null };
  const stock = [currentStock, ...previousStock].find(profile =>
    existing.every(([key, backupKey]) => state.hashes[backupKey] === profile[key]));
  if (!stock) throw new Error("PPO original backups contain unknown files or files from different Steam builds.");
  if (state.headers.backupArchive) verifyArchivePayload(files.backupArchive, state.headers.backupArchive, stock.payload);
  return { existing, stock };
}

function verifyStockRenderer(files, state, patchedRenderer) {
  const hash = state.hashes.renderer;
  if (hash === null || previousRenderers.has(hash)) return;
  if (hash !== sha256(patchedRenderer ?? buildRenderer(files.archive, state.headers.archive))) {
    throw new Error("An unrecognized detached renderer is present. PPO did not replace any files.");
  }
}

function verifyPatchedRuntime(files, state) {
  if (!state.headers.backupArchive || state.headers.backupArchive.hash !== currentStock.archive ||
      state.hashes.backupWorker !== currentStock.worker || state.hashes.backupExecutable !== currentStock.executable) {
    throw new Error(`The active files are not verified Geoplanetical ${version}, Steam build 26709373. Run Steam Verify Integrity before retrying.`);
  }
  const patch = buildPatch(files.backupArchive, files.backupWorker, files.backupExecutable);
  if (!Object.entries(patch).every(([key, bytes]) => state.hashes[key] === sha256(bytes))) {
    throw new Error("The active game files are mixed or differ from this PPO build. Run Steam Verify Integrity before retrying.");
  }
  verifyArchivePayload(files.archive, state.headers.archive);
}

function preserveStockLeftovers(files, staged, backupState, detachedRenderer) {
  const names = backupState.existing.map(([, backupKey]) => files[backupKey]);
  if (detachedRenderer) names.push(files.renderer);
  if (!names.length) return { moves: [], legacy: null };
  const previous = backupState.stock?.version ?? "renderer";
  const legacy = `.party-mod-previous-${previous}-${Date.now()}-${process.pid}`;
  const shelf = path.join(staged, "previous-originals");
  fs.mkdirSync(shelf);
  return { moves: names.map(file => [file, path.join(shelf, path.basename(file))]), legacy };
}

function runTransaction(files, action, checkRunning) {
  return withInstallerTransaction(files, (staged, commit) => {
    const state = readState(files);
    return action(files, state, staged, (moves, legacy) => {
      checkRunning?.();
      for (const [key, file] of Object.entries(files)) {
        if (fileIdentity(file) !== state.identities[key]) {
          throw new Error(`A game file changed during preparation: ${path.basename(file)}. Retry after the Steam update finishes.`);
        }
      }
      commit(moves, legacy);
    });
  });
}

function install(files, checkRunning) {
  return runTransaction(files, installPatch, checkRunning);
}

function installPatch(files, state, staged, commit) {
  if (!stockRuntime(state.hashes)) {
    verifyPatchedRuntime(files, state);
    return;
  }

  const prior = verifyBackups(files, state);
  const patch = buildPatch(files.archive, files.worker, files.executable);
  verifyStockRenderer(files, state, patch.renderer);

  fs.mkdirSync(staged);
  const { moves, legacy } = preserveStockLeftovers(files, staged, prior, state.hashes.renderer !== null);
  const replacements = {
    renderer: path.join(staged, "app.bundle.js"),
    worker: path.join(staged, "simulation-worker.bundle.js"),
    archive: path.join(staged, "app.asar"),
    executable: path.join(staged, "Geoplanetical.exe"),
  };
  writePatchedArchive(files.archive, replacements.archive, patch.archive);
  const header = openArchive(replacements.archive);
  if (header.hash !== sha256(patch.archive)) throw new Error("The staged archive failed verification");
  verifyArchivePayload(replacements.archive, header);
  for (const key of ["renderer", "worker", "executable"]) {
    fs.writeFileSync(replacements[key], patch[key], { flag: "wx", flush: true });
  }
  for (const [key, backupKey] of Object.entries(backups)) moves.push([files[key], files[backupKey]]);
  for (const [key, stagedFile] of Object.entries(replacements)) moves.push([stagedFile, files[key]]);
  commit(moves, legacy);
}

function restore(files, checkRunning) {
  return runTransaction(files, restorePatch, checkRunning);
}

function restorePatch(files, state, staged, commit) {
  if (stockRuntime(state.hashes)) {
    const prior = verifyBackups(files, state);
    verifyArchivePayload(files.archive, state.headers.archive);
    verifyStockRenderer(files, state);
    const detachedRenderer = state.hashes.renderer !== null;
    if (!prior.existing.length && !detachedRenderer) return;
    fs.mkdirSync(staged);
    const { moves, legacy } = preserveStockLeftovers(files, staged, prior, detachedRenderer);
    commit(moves, legacy);
    return;
  }

  verifyPatchedRuntime(files, state);
  fs.mkdirSync(staged);
  const moves = ["renderer", "worker", "archive", "executable"].map(key =>
    [files[key], path.join(staged, "previous-" + path.basename(files[key]))]);
  for (const [key, backupKey] of Object.entries(backups)) moves.push([files[backupKey], files[key]]);
  commit(moves);
}

function assertGameClosed() {
  const tasks = execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command",
    "[bool](Get-Process -Name Geoplanetical -ErrorAction SilentlyContinue)"], { encoding: "utf8" }).trim();
  if (tasks === "True") throw new Error("Close Geoplanetical before continuing.");
  if (tasks !== "False") throw new Error("Unable to verify that Geoplanetical is closed.");
}

if (require.main === module) try {
  const action = process.argv[2];
  if (!["install", "restore"].includes(action)) throw new Error("Use install or restore, followed optionally by the Geoplanetical folder.");
  assertGameClosed();
  const game = path.resolve(process.argv[3] || steamGamePath());
  const files = getFiles(game);
  if (!fs.existsSync(files.executable) && !fs.existsSync(path.join(path.dirname(files.archive), ".party-mod-transaction", "moves.json"))) {
    throw new Error("Geoplanetical.exe was not found in the selected folder.");
  }
  if (action === "install") {
    install(files, assertGameClosed);
    console.log(`Politics and Party Overhaul (PPO) installed for Geoplanetical ${version}. Launch Geoplanetical from Steam.`);
  } else {
    restore(files, assertGameClosed);
    console.log("Original Geoplanetical files restored.");
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}

module.exports = { getFiles, install, restore };
