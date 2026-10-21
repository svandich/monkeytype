import { envConfig } from "virtual:env-config";
import * as PageController from "./page-controller";
import * as PageTransition from "../legacy-states/page-transition";
import { isAuthAvailable } from "../progcomp-auth";
import { isAuthenticated } from "../states/core";
import { navigationEvent, type NavigateOptions } from "../events/navigation";
import { authEvent } from "../events/auth";
import { isTestRestarting, isResultCalculating } from "../states/test";

//source: https://www.youtube.com/watch?v=OstALBk-jTc
// https://www.youtube.com/watch?v=OstALBk-jTc

function pathToRegex(path: string): RegExp {
  return new RegExp(`^${path.replace(/\//g, "\\/").replace(/:\w+/g, "(.+)")}$`);
}

function getParams(match: {
  route: Route;
  result: RegExpMatchArray;
}): Record<string, string> {
  const values = match.result.slice(1);
  const keys = Array.from(match.route.path.matchAll(/:(\w+)/g)).map(
    (result) => result[1],
  );

  const a = keys.map((key, index) => [key, values[index]]);
  return Object.fromEntries(a) as Record<string, string>;
}

function isLoginRequired(): boolean {
  return envConfig.requireLogin === "true";
}

/** sends the user to the login page, coming back to the current page once signed in */
async function navigateToLogin(options: NavigateOptions): Promise<void> {
  const current = location.pathname + location.search + location.hash;
  const url =
    current === "/"
      ? "/login"
      : `/login?redirect=${encodeURIComponent(current)}`;
  await navigate(url, options);
}

function getLoginRedirect(): string | undefined {
  const redirect = new URLSearchParams(location.search).get("redirect");
  if (redirect === null || !redirect.startsWith("/")) return undefined;
  // only allow pages on this site, "//host" or "/\host" would leave it
  if (new URL(redirect, location.origin).origin !== location.origin) {
    return undefined;
  }
  return redirect;
}

type Route = {
  path: string;
  load: (
    params: Record<string, string>,
    navigateOptions: NavigateOptions,
  ) => Promise<void>;
};

const route404: Route = {
  path: "404",
  load: async (_params, options) => {
    await PageController.change("404", options);
  },
};

const routes: Route[] = [
  {
    path: "/",
    load: async (_params, options) => {
      await PageController.change("test", options);
    },
  },
  {
    path: "/verify",
    load: async (_params, options) => {
      await PageController.change("test", options);
    },
  },
  {
    path: "/leaderboards",
    load: async (_params, options) => {
      await PageController.change("leaderboards", options);
    },
  },
  {
    path: "/about",
    load: async (_params, options) => {
      await PageController.change("about", options);
    },
  },
  {
    path: "/settings",
    load: async (_params, options) => {
      await PageController.change("settings", options);
    },
  },
  {
    path: "/login",
    load: async (_params, options) => {
      // with login required there is nowhere else to go, so stay on the login page
      if (!isAuthAvailable() && !isLoginRequired()) {
        await navigate("/", options);
        return;
      }
      if (isAuthenticated()) {
        await navigate(getLoginRedirect() ?? "/account", options);
        return;
      }
      await PageController.change("login", options);
    },
  },
  {
    path: "/account",
    load: async (_params, options) => {
      if (!isAuthAvailable()) {
        await navigate("/", options);
        return;
      }
      if (!isAuthenticated()) {
        await navigateToLogin(options);
        return;
      }
      await PageController.change("account", options);
    },
  },
  {
    path: "/account-settings",
    load: async (_params, options) => {
      if (!isAuthAvailable()) {
        await navigate("/", options);
        return;
      }
      if (!isAuthenticated()) {
        await navigateToLogin(options);
        return;
      }
      await PageController.change("accountSettings", options);
    },
  },
  {
    path: "/profile",
    load: async (_params, options) => {
      await PageController.change("profileSearch", options);
    },
  },
  {
    path: "/profile/:uidOrName",
    load: async (params, options) => {
      await PageController.change("profile", {
        ...options,
        force: true,
        params: {
          uidOrName: params["uidOrName"] as string,
        },
        data: options.data,
      });
    },
  },
  {
    path: "/friends",
    load: async (_params, options) => {
      if (!isAuthAvailable()) {
        await navigate("/", options);
        return;
      }
      if (!isAuthenticated()) {
        await navigateToLogin(options);
        return;
      }

      await PageController.change("friends", options);
    },
  },
];

export async function navigate(
  url = window.location.pathname +
    window.location.search +
    window.location.hash,
  options = {} as NavigateOptions,
): Promise<void> {
  if (
    !options.force &&
    (isTestRestarting() || isResultCalculating() || PageTransition.get())
  ) {
    console.debug(
      `navigate: ${url} ignored, page is busy (testRestarting: ${isTestRestarting()}, resultCalculating: ${isResultCalculating()}, pageTransition: ${PageTransition.get()})`,
    );
    return;
  }

  url = url.replace(/\/$/, "");
  if (url === "") url = "/";

  // only push to history if we're navigating to a different URL
  const currentUrl = new URL(window.location.href);
  const targetUrl = new URL(url, window.location.origin);

  if (
    currentUrl.pathname + currentUrl.search + currentUrl.hash !==
    targetUrl.pathname + targetUrl.search + targetUrl.hash
  ) {
    history.pushState(null, "", url);
  }

  await router(options);
}

async function router(options = {} as NavigateOptions): Promise<void> {
  if (
    isLoginRequired() &&
    !isAuthenticated() &&
    location.pathname !== "/login"
  ) {
    await navigateToLogin(options);
    return;
  }

  const matches = routes.map((r) => {
    return {
      route: r,
      result: location.pathname.match(pathToRegex(r.path)),
    };
  });

  const match = matches.find((m) => m.result !== null) as {
    route: Route;
    result: RegExpMatchArray;
  };

  if (match === undefined) {
    await route404.load(
      {},
      {
        force: true,
      },
    );
    return;
  }

  await match.route.load(getParams(match), options);
}

window.addEventListener("popstate", () => {
  void router();
});

document.addEventListener("DOMContentLoaded", () => {
  document.body.addEventListener("click", (e) => {
    const target = e?.target as HTMLLinkElement;
    if (target.matches("[router-link]") && target?.href) {
      e.preventDefault();
      void navigate(target.href);
    }
  });
});

navigationEvent.subscribe(({ url, options }) => {
  void navigate(url, options);
});

authEvent.subscribe((event) => {
  if (event.type === "authStateChanged") {
    let keyframes = [
      {
        percentage: 90,
        durationMs: 1000,
        text: "Downloading user data...",
      },
    ];

    //undefined means navigate to whatever the current window.location.pathname is
    void navigate(undefined, {
      force: true,
      loadingOptions: {
        loadingMode: () => {
          if (event.data.isUserSignedIn) {
            return "sync";
          } else {
            return "none";
          }
        },
        loadingPromise: async () => {
          await event.data.loadPromise;
        },
        style: "bar",
        keyframes: keyframes,
      },
    }).finally(() => {
      document.body.classList.remove("loading");
    });
  }
});
