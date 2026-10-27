"use strict";
const fs = require("node:fs"),
  path = require("node:path"),
  { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const { connecterBD, sql } = require("../src/db");
(async () => {
  try {
    for (const file of [
      "app.js",
      "public/script.js",
      ...fs
        .readdirSync(path.join(root, "src"))
        .filter((f) => f.endsWith(".js"))
        .map((f) => "src/" + f),
    ]) {
      const r = spawnSync(
        process.execPath,
        ["--check", path.join(root, file)],
        { encoding: "utf8" },
      );
      if (r.status !== 0) throw Error(file + ": " + r.stderr);
    }
    const p = await connecterBD();
    const r = (
      await p
        .request()
        .query(
          "SELECT DB_NAME() base,OBJECT_ID('dbo.UnitesEquipement') unites,OBJECT_ID('dbo.EquipementsUnitaires','V') vue; SELECT COUNT(*) total FROM UnitesEquipement;",
        )
    ).recordsets;
    if (!r[0][0].unites || !r[0][0].vue)
      throw Error("Schéma unitaire manquant. Consulter INSTALLATION.md.");
    console.log(
      "Vérification réussie : syntaxe, connexion SQL, tables et vue unitaires. Base : " +
        r[0][0].base +
        " ; unités : " +
        r[1][0].total +
        ".",
    );
  } finally {
    await sql.close();
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
