import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: [
      { find: "@", replacement: fileURLToPath(new URL("./src", import.meta.url)) },
      // next-auth imports the extensionless "next/server", which only Next's own
      // bundler resolves. Point it at the real file so the auth test can load it.
      // Anchored, or "next/server.js" would rewrite to "next/server.js.js".
      {
        find: /^next\/server$/,
        replacement: fileURLToPath(new URL("./node_modules/next/server.js", import.meta.url)),
      },
    ],
  },
  // Dependencies are externalised by default, which skips the alias above.
  test: { server: { deps: { inline: ["next-auth", "@auth/core"] } } },
});
