import { createApp } from "../server/index.mjs";
const service = await createApp({
  dataDir: ":memory:",
  password: "browser-rehearsal-password",
  origin: "http://localhost:4320",
  secure: false,
});
const server = service.app.listen(4320, "127.0.0.1");
process.on("SIGTERM", () => {
  service.stopAccepting();
  server.close(async () => {
    await service.close();
    process.exit(0);
  });
});
