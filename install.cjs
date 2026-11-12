"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { version, patchRenderer, patchWorker, sha256 } = require("./patch.cjs");
const executableHash = "a53d56e974d6a8b8a3669fdf3de5a4278b250a51fbd43a1561f2ac1cb269daf6";
const previousPatches = [{
  archive: "5fb54c5fe31f02cb69f7777bc0ac52ecfc4b1170d799956973ddcb120644d791",
  worker: "63deec24022266047700503888430087ef8e2d785eead7df6970a43f1038c3f6",
  renderer: "1bab71a38a94bf9dad3ce66307ee8fe49f4ce2db327ea697bc2eef4dc2267293",
  executable: "e4c127efc03f0b0ce988f18b3c86ede3c4ec305bc397a3fc0330453df2296931",
}, {
  archive: "5b172cff3cfb66136909aedcffb32a700c4483455ab321548223f1d590cd4fe0",
  worker: "fb7789524c90b138a8de9f04c56978ba2c612362d96d35b91da432243043b69f",
  renderer: "e137884166f5a46f355f9e43d0908a1999c3fb8fe2f1676f8b861c1f03f66c4b",
  executable: "b6b5694d024be59b68c3b2522c8ddce0761cf6aab9e17925eab1ac341d7f34ff",
}, {
  archive: "81204010a66a1af440e996bb1264339c32b3e851759e381e319062225fec4099",
  worker: "24bc50ddaac5fbc3d942ab14f236d305cf46143a12ea21afb85530613db7c821",
  renderer: "cfd9c9aed92b53d5759ea69b32949e55a601dc80d4236cd8f94ac69b77016296",
  executable: "a47117b0a4376d12bc23c7f19dcee4f359f415457cd41e69421b685cc5713f8a",
}, {
  archive: "8a583b16adf089a0acdcfbeab269f14ebc0061508f747101c612ac5de3c21dec",
  worker: "c849a82ed3fdef3faf23e496e91ce9a4bb2972ffab089eee46c95ee3b9fe7c43",
  renderer: "cfd9c9aed92b53d5759ea69b32949e55a601dc80d4236cd8f94ac69b77016296",
  executable: "e320db04927c77ec7973c41f9d9ffad52b12a19f78aaca28958b9bcb1cc36750",
}, {
  archive: "213eb3099dcc78c8607467d688caf551ec9fde256bfc7df54f8441d2370aae94",
  worker: "82b8d628d47da2e75981030229b105280294eaac6d7e0063f6d2a455075428a4",
  renderer: "45f0225d6ec7892b0d226712e1470a97a1fc1c0bed0b89fd16816722c08ace5b",
  executable: "d866dfcb13f3502c3a1f8fdb97faddbad1fac3bdd813f37fb1b282df83ab400b",
}, {
  archive: "908a346a7ffa281f417bd1217c44eeb22f9695c3c685eb5f0bc25a9e4876e820",
  worker: "abaa0f03ef7cd4fb76f814894e104f8ef558a520debdb90b1ac58887051e2e68",
  renderer: "ef3f30bcaa22fb1d4faebf5b3fa5cb007433e89a1ee4d8e818909d8cedb6927a",
  executable: "4f71bfdfc5626d8fadd35ac30bec0a0525e1d1d3947c0be0e3978a09b8631a33",
}, {
  archive: "d1895c7ea431abcfe0f839ac5636c89fff79f3f3e2a6cdc49677450babdd7056",
  worker: "c606b829330658bf73cf127f00cfe530ea41e1efbd83047fcf4ded4b30563a95",
  renderer: "0f92adf27b2c5f19ce1884d4f4aa621f471e6dca27b6a5a8b6e02f4d801fe463",
  executable: "d2ac87d2437100c1f689c09a7ea30b319077ef46b5155fe49495b0e08a1eb32d",
}, {
  archive: "0dfd257fa99cd279b61b3bd5c070b99f87e390b6f3092336a9d5ad31ffb33934",
  worker: "ac2e32b48f6b3f215a6ea3bfd700c7fac7cf44d6045134ee3c2021c4201e9f41",
  renderer: "bf77d657fd6161c068c4aa54152e71e286b7df28305fceb2368c782f24124254",
  executable: "6cee55e23b24a90aba1471c2f38a54ffeb49fb3e786cc98d9848d557d4f3bc44",
}, {
  archive: "5851cc67fb766161c12018abb3b2ffb97fd3f15d533c3ab9af298ed975c4ea20",
  worker: "c7af40d2016e5b0fd4b714af9fc01ef898d3d99de27ff735ef02b638da9e5441",
  renderer: "9adeb33853c5a0067279df607b3170c628b8081c90d74a0d8103430bdceed1d8",
  executable: "727205d09bbf686870243ef61164bc173bc08b72d6deb8041df48ba6d40debd4",
}];

function steamGamePath() {
  const output = execFileSync("reg.exe", ["query", "HKLM\\SOFTWARE\\WOW6432Node\\Valve\\Steam", "/v", "InstallPath"], { encoding: "utf8" });
  const steam = output.match(/InstallPath\s+REG_\w+\s+(.+)/i)?.[1].trim();
  if (!steam) throw new Error("Steam installation not found. Pass the Geoplanetical folder as an argument.");
  const steamApps = path.join(steam, "steamapps");
  const config = fs.readFileSync(path.join(steamApps, "libraryfolders.vdf"), "utf8");
  const libraries = [steam, ...Array.from(config.matchAll(/"path"\s+"([^"\r\n]+)"/g), match => match[1].replaceAll("\\\\", "\\"))];
  for (const library of libraries) {
    const game = path.join(library, "steamapps", "common", "Geoplanetical");
    if (fs.existsSync(path.join(game, "Geoplanetical.exe"))) return game;
  }
  throw new Error("Geoplanetical was not found in a Steam library.");
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
  if (sha256(bytes) !== executableHash) throw new Error(`Unsupported Geoplanetical executable. This mod targets ${version}.`);
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
  if (json.length > header.length) throw new Error("The updated archive header does not fit this build");
  const bytes = Buffer.alloc(header.length, 0x20);
  json.copy(bytes);
  return bytes;
}

function getFiles(game) {
  const resources = path.join(game, "resources");
  const renderer = path.join(resources, "app.asar.unpacked", "renderer");
  const archive = path.join(resources, "app.asar");
  const worker = path.join(renderer, "simulation-worker.bundle.js");
  const executable = path.join(game, "Geoplanetical.exe");
  return { archive, worker, executable, renderer: path.join(renderer, "app.bundle.js"),
    backupArchive: archive + ".party-mod-original", backupWorker: worker + ".party-mod-original",
    backupExecutable: executable + ".party-mod-original" };
}

function buildPatch(archive, worker, executable) {
  const header = openArchive(archive);
  const entries = header.json.files.renderer.files;
  const rendererBytes = patchRenderer(readEntry(archive, header, entries["app.bundle.js"]));
  const workerBytes = patchWorker(fs.readFileSync(worker));
  const headerBytes = patchedArchiveHeader(header, rendererBytes, workerBytes);
  const executableBytes = updateArchiveDigest(fs.readFileSync(executable), header.hash, sha256(headerBytes));
  return { archive: headerBytes, worker: workerBytes, renderer: rendererBytes, executable: executableBytes };
}

function installedHashes(files, allowMissing = false) {
  return Object.fromEntries(Object.keys(previousPatches[0]).map(key => {
    const file = files[key];
    const hash = fs.existsSync(file) ? (key === "archive" ? openArchive(file).hash : sha256(fs.readFileSync(file))) : null;
    if (!hash && !allowMissing) throw new Error(`The active ${key} file is missing. Run Restore Original Game before updating.`);
    return [key, hash];
  }));
}

function matchesPatch(installed, known) {
  return Object.entries(installed).every(([key, hash]) => hash === null || hash === known[key]);
}

function patchHashes(patch) {
  return Object.fromEntries(Object.entries(patch).map(([key, bytes]) => [key, sha256(bytes)]));
}

function install(files) {
  const { archive, worker, renderer, executable, backupArchive, backupWorker, backupExecutable } = files;
  const backups = [[archive, backupArchive], [worker, backupWorker], [executable, backupExecutable]];
  const upgrading = backups.some(([, backup]) => fs.existsSync(backup));
  if (upgrading && !backups.every(([, backup]) => fs.existsSync(backup))) throw new Error("Some original game backups are missing. Restore the Steam files before updating.");
  if (!upgrading && fs.existsSync(renderer)) throw new Error("Another patch has added a renderer file. Restore the original game before installing.");
  const originalArchive = upgrading ? backupArchive : archive;
  const patch = buildPatch(originalArchive, upgrading ? backupWorker : worker, upgrading ? backupExecutable : executable);
  if (upgrading) {
    const current = installedHashes(files);
    if (matchesPatch(current, patchHashes(patch))) return;
    if (!previousPatches.some(previous => matchesPatch(current, previous))) throw new Error("The existing patch differs from the supported releases. No game files were replaced.");
  }
  const staged = fs.mkdtempSync(path.join(path.dirname(archive), ".party-mod-"));
  const newArchive = path.join(staged, "app.asar");
  const newWorker = path.join(staged, "simulation-worker.bundle.js");
  const newRenderer = path.join(staged, "app.bundle.js");
  const newExecutable = path.join(staged, "Geoplanetical.exe");
  const installed = [];
  const moved = [];
  let committed = false;
  try {
    fs.copyFileSync(originalArchive, newArchive, fs.constants.COPYFILE_EXCL);
    const fd = fs.openSync(newArchive, "r+");
    try {
      if (fs.writeSync(fd, patch.archive, 0, patch.archive.length, 16) !== patch.archive.length) throw new Error("Could not finish the game archive");
    } finally { fs.closeSync(fd); }
    fs.writeFileSync(newWorker, patch.worker, { flag: "wx" });
    fs.writeFileSync(newRenderer, patch.renderer, { flag: "wx" });
    fs.writeFileSync(newExecutable, patch.executable, { flag: "wx" });
    if (openArchive(newArchive).hash !== sha256(patch.archive)) throw new Error("The staged archive failed verification");
    const replacements = upgrading ? [archive, worker, renderer, executable].map(file => [file, path.join(staged, "previous-" + path.basename(file))]) : backups;
    for (const [file, saved] of replacements) {
      fs.renameSync(file, saved);
      moved.push([file, saved]);
    }
    for (const [source, destination] of [[newRenderer, renderer], [newWorker, worker], [newArchive, archive], [newExecutable, executable]]) {
      fs.renameSync(source, destination);
      installed.push(destination);
    }
    committed = true;
  } catch (error) {
    for (const file of installed.reverse()) fs.unlinkSync(file);
    for (const [file, saved] of moved.reverse()) fs.renameSync(saved, file);
    throw error;
  } finally {
    for (const file of [newArchive, newWorker, newRenderer, newExecutable]) if (fs.existsSync(file)) fs.unlinkSync(file);
    if (committed && upgrading) for (const [, saved] of moved) fs.unlinkSync(saved);
    if (!fs.readdirSync(staged).length) fs.rmdirSync(staged);
  }
}

function restore(files) {
  const { archive, worker, renderer, executable, backupArchive, backupWorker, backupExecutable } = files;
  if (![backupArchive, backupWorker, backupExecutable].every(file => fs.existsSync(file))) throw new Error("The three original backup files are required for a restore.");
  const patch = buildPatch(backupArchive, backupWorker, backupExecutable);
  const current = installedHashes(files, true);
  if (!matchesPatch(current, patchHashes(patch)) && !previousPatches.some(previous => matchesPatch(current, previous))) {
    throw new Error("The active game files changed since installation. Keep the updated files and use Steam Verify Integrity if needed.");
  }
  const staged = fs.mkdtempSync(path.join(path.dirname(archive), ".party-mod-restore-"));
  const moved = [];
  const restored = [];
  try {
    for (const file of [renderer, worker, archive, executable]) {
      if (!fs.existsSync(file)) continue;
      const held = path.join(staged, path.basename(file));
      fs.renameSync(file, held);
      moved.push([held, file]);
    }
    for (const [backup, target] of [[backupWorker, worker], [backupArchive, archive], [backupExecutable, executable]]) {
      fs.renameSync(backup, target);
      restored.push([target, backup]);
    }
  } catch (error) {
    for (const [target, backup] of restored.reverse()) fs.renameSync(target, backup);
    for (const [held, file] of moved.reverse()) fs.renameSync(held, file);
    throw error;
  } finally {
    for (const [held] of moved) if (fs.existsSync(held)) fs.unlinkSync(held);
    fs.rmdirSync(staged);
  }
}

if (require.main === module) try {
  const action = process.argv[2];
  if (!["install", "restore"].includes(action)) throw new Error("Use install or restore, followed optionally by the Geoplanetical folder.");
  const tasks = execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command",
    "[bool](Get-Process -Name Geoplanetical -ErrorAction SilentlyContinue)"], { encoding: "utf8" }).trim();
  if (tasks === "True") throw new Error("Close Geoplanetical before continuing.");
  if (tasks !== "False") throw new Error("Unable to verify that Geoplanetical is closed.");
  const game = path.resolve(process.argv[3] || steamGamePath());
  if (!fs.existsSync(path.join(game, "Geoplanetical.exe"))) throw new Error("Geoplanetical.exe was not found in the selected folder.");
  const files = getFiles(game);
  if (action === "install") {
    install(files);
    console.log(`Politics and Party Overhaul (PPO) installed for Geoplanetical ${version}. Launch Geoplanetical from Steam.`);
  } else {
    restore(files);
    console.log("Original Geoplanetical files restored.");
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}

module.exports = { getFiles, install, restore };
