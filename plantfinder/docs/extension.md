# Chrome extension

## Load it (unpacked)
1. `cd plantfinder && pnpm install && pnpm --filter @plantfinder/extension build`
2. Chrome → `chrome://extensions` → enable **Developer mode** → **Load unpacked** → choose
   `plantfinder/apps/extension/build`.
3. Start the server (`pnpm start`, or `PF_DATA_MODE=fixture pnpm start` for the offline demo).
4. Optional: extension **Options** → server address (default `http://localhost:8787`).

## What it does
| Entry point | Action |
|---|---|
| Toolbar popup | Search by name with city, radius and max price; top offers with price and link; "all results" opens the web app |
| Popup → "הצמח בעמוד הזה" | Reads the active tab **title** (activeTab), resolves it to a plant, searches |
| Right-click an image | Opens an identification page: the image URL goes to the server, which fetches it safely and asks Pl@ntNet. You confirm a candidate before searching. Without a server key it explains this and offers a name search |
| Right-click selected text | Opens the web app searching for that text |
| Right-click a page | Resolves the page title to a plant and opens the web app |

## Permissions (least privilege)
| Permission | Why |
|---|---|
| `contextMenus` | The three right-click entries |
| `storage` | Server address and the popup's last city and price |
| `activeTab` | The current tab's title, only after you click the extension or a menu item |

There are **no host permissions and no content scripts**: the extension never reads page content, and the
API accepts its requests via CORS. The build (`apps/extension/build.mjs`) fails if these rules are broken,
or if a key or an unsafe DOM construct appears in the code.

## Limits
- `data:` and `blob:` images cannot be identified from the context menu (the server needs a web URL).
  Save the image and use "חיפוש לפי תמונה" in the web app instead.
- Photo identification requires `PLANTNET_API_KEY` on the server.
- Tested in Chromium 1243 (Playwright, headless) via `pnpm test:e2e`; not yet tested in branded Chrome on Windows or macOS.
