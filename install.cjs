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
}, {
  archive: "ddceb5d5b42ce9b9904c31d5d2978a8224835b6007c01929be9e61b8ad640816",
  worker: "1eedfbdcabbd6e41024b16058275eefb01586fa9c1cecf21f2b66889074a34cc",
  renderer: "a326fcd09745064c24d87e8ae181f6360863e356c1b8ee2e1047bf40d1cf9a42",
  executable: "3c60623bb520cadeea788cf5de863edecbff1091bb9ab3a2e7164475eda2621e",
}, {
  archive: "c72b574379b2e6ad78593ee37af6c2708213befc3cbd40fdfa02fe6c5222a0b0",
  worker: "4fe95038751c5da9f99d0c408648b1911f07c0f473763470e1700eed864756f6",
  renderer: "30c2f38674e30208af05cc3bb89cc9be42d8cceb7c6362c688042b6ae7d8399e",
  executable: "9d11eef148967be41ffb93e45282a06fe238d399f359ff465ba75ab8c941899e",
}, {
  archive: "b15443670eae9c4f69c75d0d61419cebea1abbe06d04b85773232389fcfccd8a",
  worker: "4fe95038751c5da9f99d0c408648b1911f07c0f473763470e1700eed864756f6",
  renderer: "103b85f7821d40e8c99b2a85358eb6bcbae01fee9c45a0ed52655b5384b2c4ac",
  executable: "de38a70efdb0c939014dacaec03c95bdc1ba46c337666ea2a0450620eefbbe34",
}, {
  archive: "68e7fe31c8b3dd763584b68e913702421b837880bf57301ebf9699a7cddb4a76",
  worker: "ce8a74e7ab374bc404a51fe98d1751310d7e581cc71c20dc1ab4360ed89add18",
  renderer: "d4cbd8fc70a788c1cd8e15ab87005dba6afcdc5054c96f2b41da3fda83f4b5f4",
  executable: "18abe385fa320fd9495595921926695ce8ffe315af549d6e2f6307a125c79930",
}, {
  archive: "d6c516e4a64eb056c2bae6410a570828377006e6734815d96257cd5ea18d5009",
  worker: "27569d1c7633977db168f71c21f9803022306832d321bc2b8cd0b8b7a7bff71d",
  renderer: "d4cbd8fc70a788c1cd8e15ab87005dba6afcdc5054c96f2b41da3fda83f4b5f4",
  executable: "3b81e217663a73edd90a37e6160d577468acca570d680431eabe0055f6b04a73",
}, {
  archive: "745646fef583f3104ff78332d92b212dd7780fb948970ffad4009c6d5c3ccce4",
  worker: "8dd41855cfcc13b739a7a2a293796c27fde4983035848762359d9c6b33be68dd",
  renderer: "a7299b6059f0349223366d24b728909c7363950b8dc28a92915e76673771a6bd",
  executable: "5981fb8da736a4ed1861ed904a7aaece777973dfe461dd826709849fbfd27d2b",
}, {
  archive: "75670b2f499c9373fc8b3893943e581acba53fe4b809a211ed7a35bc0f6270b7",
  worker: "8dd41855cfcc13b739a7a2a293796c27fde4983035848762359d9c6b33be68dd",
  renderer: "18d74a7bec03d59c30467f36c1bdfe7012c1ea86b1c06dccc3f47a88a3a77944",
  executable: "a92299e62e14caa362b680aafc0ebaedcc49f51f73a0d3b70d9ad199886b7ce6",
}, {
  archive: "c6b0b5747b39c18a0edb7296f8a6287b486449e8593caaf425b5dc6fc566b42d",
  worker: "8dd41855cfcc13b739a7a2a293796c27fde4983035848762359d9c6b33be68dd",
  renderer: "a5174ec4e6c36796fac56234e792531c3ef4b4c540d429c0ec9adce02aae1ac8",
  executable: "c02eaada8a70bd9252dea7f0f0cbff52c2bb9ef7482c0ca7c669d01bea4f86df",
}, {
  archive: "f252b2d88dcdea4642c755a9ea2966f83603512b81629874d3b8023bbff064d1",
  worker: "6932ee0555206dafe1fb33d78e43d85210a1bb6f9ebe8ac0025f677849a8aec5",
  renderer: "03c4add77abec6c9bb673cd2dc5a1122af48c4f592b19f81313cf58046f842d7",
  executable: "701188ad744326924febb0d02c562efc8fd5842e96f755c7230f2a45a104a170",
}, {
  archive: "88b33513832f7585c910032813c93b3bb36b3ae5ce148c71d3f5cc298a0c294a",
  worker: "5f399238bc4841679735c1c6273689539ecc91f532896317b1c4a32ee57f5e6e",
  renderer: "c2a1c70ebcd5a10403714d1702e9824de3e3371a7535180bbff2b86a4c0092cc",
  executable: "b0500e44a68b319cfe23061d02a915b79777aec5ad38a333266fccba7c4b44da",
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
