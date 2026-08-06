
/// <reference path="../pb_data/types.d.ts" />

// Serves the PocketBase admin dashboard at the API root. Primarily fetches
// the Hostinger-hosted build matching this server's PocketBase version (kept
// for parity with Horizons hosting); if that external fetch fails for any
// reason (CDN down, self-hosted network policy, version mismatch), it falls
// back to redirecting to PocketBase's own bundled admin UI at /_/ instead of
// returning a hard error, so the dashboard stays reachable either way.
routerAdd("GET", "/{$}", (e) => {
    try {
        const fileContent = $os.readFile(`${__hooks}/../.pocketbase-version`)
        const contentStr = Array.isArray(fileContent)
            ? String.fromCharCode.apply(null, fileContent)
            : fileContent
        const pbVersion = `v${contentStr.replace(/\n/g, '').trim()}`
        const externalUrl = `https://horizons-static-cdn.hostinger.com/pocketbase/__PB_VERSION__/ui/dist/index.html`.replace("__PB_VERSION__", pbVersion)

        const response = $http.send({
            url: externalUrl,
            method: "GET",
            timeout: 10,
        })

        if (response.statusCode < 200 || response.statusCode >= 300) {
            throw new Error(`external dashboard fetch returned status ${response.statusCode}`)
        }

        const htmlContent = Array.isArray(response.body)
            ? String.fromCharCode.apply(null, response.body)
            : response.body

        return e.html(response.statusCode, htmlContent)
    } catch (err) {
        console.log("external dashboard unavailable, falling back to built-in admin UI:", err)
        return e.redirect(302, "/_/")
    }
})
