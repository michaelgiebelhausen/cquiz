import { existsSync, writeFileSync, readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
if (existsSync(".env")) {
  console.log(
    "Existing .env preserved. Configure the private settings there or in the instructor workspace.",
  );
} else {
  const content = readFileSync(".env.example", "utf8").replace(
    "ADMIN_PASSWORD=\n",
    `ADMIN_PASSWORD=${randomBytes(24).toString("base64url")}\n`,
  );
  writeFileSync(".env", content, { mode: 0o600 });
  console.log(
    "Private .env created with a generated instructor password. The password is in .env; it is not printed or committed.",
  );
}
