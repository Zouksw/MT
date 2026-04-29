import { cookies } from "next/headers";

export const authProviderServer = {
  check: async () => {
    const cookieStore = await cookies();
    const auth = cookieStore.get("auth");

    if (auth) {
      return { authenticated: true, redirectTo: undefined, error: undefined };
    }

    return {
      authenticated: false,
      redirectTo: "/login",
      error: undefined,
    };
  },
};
