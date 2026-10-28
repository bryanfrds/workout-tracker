import "server-only";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

/**
 * Google sign-in. The session lives in a signed cookie, so signing in needs no
 * database — the workouts themselves still live on the phone until syncing lands.
 */
export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  session: { strategy: "jwt" },
});
