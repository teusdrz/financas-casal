// Remove artefatos de build antes de compilar novamente.
const fs = require("fs");
const path = require("path");
for (const dir of ["dist", path.join("public", "js")]) {
  fs.rmSync(path.join(__dirname, "..", dir), { recursive: true, force: true });
}
