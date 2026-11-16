"use strict";

const fs = require("node:fs");
const path = require("node:path");

const lockPattern = /^\.party-mod-lock-(\d+)-[a-z0-9]+$/i;
const legacyPattern = /^\.party-mod-previous-(?:1\.1\.[234]|renderer)-[a-z0-9-]+$/i;
const legacyStages = new Set(["steam-1.1.2", "previous-originals"]);
const stagedFiles = new Set([
  "app.asar", "app.bundle.js", "simulation-worker.bundle.js", "Geoplanetical.exe",
  "previous-app.asar", "previous-app.bundle.js", "previous-simulation-worker.bundle.js", "previous-Geoplanetical.exe",
  "app.asar.party-mod-original", "simulation-worker.bundle.js.party-mod-original", "Geoplanetical.exe.party-mod-original",
]);

function processAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error.code === "ESRCH") return false;
    throw error;
  }
}

function transactionPaths(filePaths) {
  const resources = path.dirname(filePaths.archive);
  const game = path.dirname(resources);
  const stage = path.join(resources, ".party-mod-transaction");
  const live = new Set(Object.values(filePaths));
  const valid = file => live.has(file) || path.dirname(file) === stage && stagedFiles.has(path.basename(file));
  return { resources, game, stage, valid };
}

function cleanStage(stage, keepLegacy) {
  const entries = fs.readdirSync(stage, { withFileTypes: true });
  for (const entry of entries) {
    const known = stagedFiles.has(entry.name) || /^(moves(?:-prepared)?\.json|move-\d+|committed)$/.test(entry.name);
    if (entry.isFile() && known) continue;
    if (entry.isDirectory() && legacyStages.has(entry.name)) {
      for (const file of fs.readdirSync(path.join(stage, entry.name), { withFileTypes: true })) {
        if (!file.isFile() || !stagedFiles.has(file.name)) {
          throw new Error("Unexpected preserved installer file: " + path.join(stage, entry.name, file.name));
        }
      }
      continue;
    }
    throw new Error(`Unexpected file in installer transaction: ${path.join(stage, entry.name)}`);
  }
  if (keepLegacy) {
    const legacyName = entries.find(entry => entry.isDirectory() && legacyStages.has(entry.name))?.name;
    if (legacyName) {
      const destination = path.join(path.dirname(stage), keepLegacy);
      fs.renameSync(path.join(stage, legacyName), destination);
    }
  }
  const journal = path.join(stage, "moves.json");
  if (fs.existsSync(journal)) fs.unlinkSync(journal);
  for (const entry of entries) {
    if (entry.name === "moves.json" || (keepLegacy && legacyStages.has(entry.name))) continue;
    const file = path.join(stage, entry.name);
    if (entry.isDirectory()) fs.rmdirSync(file);
    else fs.unlinkSync(file);
  }
  fs.rmdirSync(stage);
}

function recoverTransaction({ stage, game, valid }) {
  if (!fs.existsSync(stage)) return;
  if (!fs.lstatSync(stage).isDirectory()) {
    throw new Error(`Unexpected installer transaction path: ${stage}`);
  }
  const journal = path.join(stage, "moves.json");
  if (!fs.existsSync(journal)) {
    cleanStage(stage, null);
    return;
  }
  const { moves, legacy } = JSON.parse(fs.readFileSync(journal, "utf8"));
  const isLegacyFile = file => legacy && legacyStages.has(path.basename(path.dirname(file))) && path.dirname(path.dirname(file)) === stage &&
    valid(path.join(stage, path.basename(file)));
  if ((legacy !== null && !legacyPattern.test(legacy)) || !Array.isArray(moves) || !moves.every(move =>
    Array.isArray(move) && move.length === 2 && move.every(file =>
      typeof file === "string" && !path.isAbsolute(file) && (
        valid(path.resolve(game, file)) || isLegacyFile(path.resolve(game, file))
      )))) {
    throw new Error(`Invalid installer recovery journal: ${journal}`);
  }
  if (fs.existsSync(path.join(stage, "committed"))) {
    cleanStage(stage, legacy);
    return;
  }

  // A marker is written before its move. On restart either the source or
  // destination exists. Undo attempted moves in reverse order.
  for (let index = moves.length - 1; index >= 0; index--) {
    const marker = path.join(stage, `move-${index}`);
    if (!fs.existsSync(marker)) continue;
    const [from, to] = moves[index].map(file => path.resolve(game, file));
    const original = fs.existsSync(from);
    const held = fs.existsSync(to);
    if (original === held) throw new Error(`Installer recovery needs attention for ${from} and ${to}`);
    if (held) fs.renameSync(to, from);
    fs.unlinkSync(marker);
  }
  cleanStage(stage, null);
}

function withInstallerTransaction(files, action) {
  const transaction = transactionPaths(files);
  const { resources, game, stage } = transaction;
  const lock = fs.mkdtempSync(path.join(resources, `.party-mod-lock-${process.pid}-`));
  try {
    for (const entry of fs.readdirSync(resources, { withFileTypes: true })) {
      const match = lockPattern.exec(entry.name);
      const candidate = path.join(resources, entry.name);
      if (!entry.isDirectory() || !match || candidate === lock) continue;
      if (processAlive(Number(match[1]))) throw new Error("Another PPO installer is running for this game folder.");
      try { fs.rmdirSync(candidate); }
      catch (error) { if (error.code !== "ENOENT") throw error; }
    }
    recoverTransaction(transaction);

    function commit(moves, legacy = null) {
      const journal = path.join(stage, "moves.json");
      const prepared = path.join(stage, "moves-prepared.json");
      try {
        const relative = moves.map(pair => pair.map(file => path.relative(game, file)));
        fs.writeFileSync(prepared, JSON.stringify({ moves: relative, legacy }), { flag: "wx", flush: true });
        fs.renameSync(prepared, journal);
        for (const [index, [from, to]] of moves.entries()) {
          if (!fs.existsSync(from) || fs.existsSync(to)) throw new Error(`Installer move could not start: ${from} -> ${to}`);
          fs.writeFileSync(path.join(stage, `move-${index}`), "", { flag: "wx", flush: true });
          fs.renameSync(from, to);
        }
        fs.writeFileSync(path.join(stage, "committed"), "", { flag: "wx", flush: true });
      } catch (error) {
        try { recoverTransaction(transaction); }
        catch (recoveryError) {
          throw new Error(`Installer interrupted: ${error.message}. Recovery files are in ${stage}. Retry after resolving: ${recoveryError.message}`,
            { cause: recoveryError });
        }
        throw error;
      }
      recoverTransaction(transaction);
    }

    try {
      return action(stage, commit);
    } catch (error) {
      if (fs.existsSync(stage) && !fs.existsSync(path.join(stage, "moves.json"))) cleanStage(stage, null);
      throw error;
    }
  } finally {
    fs.rmdirSync(lock);
  }
}

module.exports = { withInstallerTransaction };
