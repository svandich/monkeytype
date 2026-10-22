# Monkeytype Self Hosting

<!-- TOC ignore:true -->

## Table of contents

<!-- TOC -->

- [Monkeytype Self Hosting](#monkeytype-self-hosting)
  - [Table of contents](#table-of-contents)
  - [Prerequisites](#prerequisites)
  - [Quickstart](#quickstart)
    - [Hosting over the network (HTTPS)](#hosting-over-the-network-https)
  - [Security](#security)
  - [Account System](#account-system)
    - [Connect ProgCompJOlivaApi](#connect-progcompjolivaapi)
    - [Update backend configuration](#update-backend-configuration)
  - [Enable daily leaderboards](#enable-daily-leaderboards)
  - [Configuration files](#configuration-files)
    - [env file](#env-file)
    - [backend-configuration.json](#backend-configurationjson)

<!-- /TOC -->

## Prerequisites

- you need to have `docker` and `docker-compose-plugin` installed. Follow the [docker documentation](https://docs.docker.com/compose/install/) on how to do this.

## Quickstart

- create a new directory (e.g. `monkeytype`) and navigate into it.
- download the [docker-compose.yml](https://github.com/monkeytypegame/monkeytype/tree/master/docker/docker-compose.yml) file.
- create an `.env` file, you can copy the content from the [example.env](https://github.com/monkeytypegame/monkeytype/tree/master/docker/example.env).
- download the [backend-configuration.json](https://github.com/monkeytypegame/monkeytype/tree/master/docker/backend-configuration.json)
- run `docker compose up -d`
- after the command exits successfully you can access [http://localhost](http://localhost)

### Hosting over the network (HTTPS)

If you plan to access your self-hosted Monkeytype instance over a local network or the internet (not using `localhost`), **you must serve it over HTTPS**. Modern browsers restrict key web features, such as `crypto.randomUUID`, to secure contexts. Accessing the site via HTTP over a network will cause the frontend to crash with errors like `Uncaught TypeError: crypto.randomUUID is not a function`.

#### Enable HTTPS

Update the `.env` file and uncomment these lines and set the values based on your domain.

```
DOMAIN=mydomain.com
BASE_URL=https://mydomain.com
ACME_EMAIL=certmanager@mydomain.com
```

Update the `docker-compose.yml` and uncomment all lines marked with `# enable for HTTPS`.



#### Troubleshooting Frontend Connection Issues

If your reverse proxy is up but you see errors like `Looks like the server is experiencing unexpected down time` or network errors when fetching resources, your frontend is likely trying to communicate with the backend over unsecure HTTP, causing a **Mixed Content** block in the browser.

Ensure you configure the frontend to talk to your secure backend URL by following these rules in your `.env` file:

1. **Update the frontend and backend URL:** Set `DOMAIN` and `BASE_URL` correctly, usually `BASE_URL` is `https://DOMAIN`.
2. **Do not include a trailing slash:** Ensure the URL does not end with a `/` (e.g., use `https://yourdomain.com`, **not** `https://yourdomain.com/`). A trailing slash will cause `404 Not Found` errors due to double slashes in the API calls (like `//configuration`).
3. **Force container recreation:** Monkeytype is a Single Page Application (SPA), meaning environment variables are baked into the static JavaScript files during startup. If you change your `.env`, you must completely recreate the container for the changes to apply:

```bash
docker compose up -d --force-recreate
```

> [!TIP]
>     After updating your configuration and recreating the containers, clear your browser cache or perform a hard reload (Ctrl + F5) to make sure your browser isn't running an old cached version of the frontend.


## Security

Do not expose the Monkeytype backend directly to the internet. Instead, place it behind a reverse proxy and configure the backend to only accept connections from the reverse proxy.

The backend's built-in rate limiting is based on the authenticated user's `uid` or, for unauthenticated requests, the client's IP address.

To determine the client's IP address, the backend checks the following sources in order:

1. `CF-Connecting-IP` (when requests are proxied through Cloudflare)
2. `X-Forwarded-For`
3. The source IP address of the HTTP connection

We recommend the following configuration:

- If you are **not** using Cloudflare, remove any incoming `CF-Connecting-IP` header in your reverse proxy before forwarding requests.
- Configure your reverse proxy to set the `X-Forwarded-For` header to the client's IP address.
- Configure the backend to only accept connections from the reverse proxy to prevent clients from spoofing trusted headers.


Sources:
- [cloudflare documentation for cf-connecting-ip](https://developers.cloudflare.com/fundamentals/reference/http-headers/#cf-connecting-ip)
- [handling headers in traefik](https://doc.traefik.io/traefik/reference/routing-configuration/http/middlewares/headers)


## Account System

Accounts come from [ProgCompJOlivaApi](../../ProgCompJOlivaApi): users sign in with their ProgCompJOliva nickname and password, there is no separate monkeytype sign-up. A monkeytype profile is created automatically on the first sign-in (named after the nickname). Email and password changes, password resets and account management all happen in ProgCompJOliva.

Stop the running docker containers using `docker compose down` before making any changes.

### Connect ProgCompJOlivaApi

- the browser talks to ProgCompJOlivaApi directly (`POST /api/auth/login` and `/api/auth/refresh`), so it must be reachable from the frontend and allow its origin (CORS)
- the monkeytype backend verifies the ProgCompJOliva access tokens (ES256) with the API's **public** key, fetched from `${PROGCOMP_API_URL}/api/auth/jwks` and cached. No secret is shared: monkeytype can check tokens but can't create them
- update the `.env` file:
  ```
  PROGCOMP_API_URL=https://progcomp.joliva.cl:8443 # ProgCompJOlivaApi base url, reachable by the browser and the backend
  # only if you changed them in ProgCompJOlivaApi:
  # PROGCOMP_JWT_ISSUER=ProgCompJOlivaApi
  # PROGCOMP_JWT_AUDIENCE=ProgCompJOlivaClient
  # PROGCOMP_SITE_URL=https://progcomp.joliva.cl # user profiles link there
  ```
- to show typing stats on ProgCompJOliva, set the same random secret as `PROGCOMP_TYPING_TOKEN` here and as `Typing__IngestToken` on the API. After every completed test the backend pushes the user's leaderboard-eligible personal bests to `PUT /api/typing/users/{id}`
- to only let signed in users use the site, add `REQUIRE_LOGIN=true`. Signed out visitors are sent to the login page. This is only checked by the frontend, the backend API stays reachable without an account

### Update backend configuration

- `users.signUp` must be `true`, otherwise the login page is hidden
- update the `backend-configuration.json` file and add/modify
  ```json
  {
    "users": {
      "signUp": true,
      "profiles": {
        "enabled": true
      }
    }
  }
  ```

## Enable daily leaderboards

To enable daily leaderboards update the `backend-configuration.json` file and add/modify

```json
{
  "dailyLeaderboards": {
    "enabled": true,
    "maxResults": 250,
    "leaderboardExpirationTimeInDays": 1,
    "validModeRules": [
      {
        "language": "english",
        "mode": "time",
        "mode2": "15"
      },
      {
        "language": "english",
        "mode": "time",
        "mode2": "60"
      }
    ]
  }
}
```

- language is one of the supported language
- mode can be `time` or `words`
- mode2 can be `15`,`30`,`60` or `120` if you picked `mode=time` or `10`,`25`,`50` or `100` if you picked `mode=words`.

## Configuration files

### env file

All settings are described in the [example.env](https://github.com/monkeytypegame/monkeytype/tree/master/docker/example.env) file.

### backend-configuration.json

Configuration of the backend. Check the [default configuration](https://github.com/monkeytypegame/monkeytype/blob/master/backend/src/constants/base-configuration.ts#L8) for possible values.

> [!NOTE]
> Configuration changes are applied only on container startup. You must restart the container for your updates to take effect.
