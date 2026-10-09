# The shared Apple Pay shortcut

One-tap Apple Pay logging needs a single shortcut that everyone installs from an iCloud link. Apple
only lets shortcuts be shared from an iPhone (a `.shortcut` file made anywhere else won't import), so
whoever runs the app builds it once on their phone, shares it, and sets `APPLE_PAY_SHORTCUT_URL`.
After that, Settings → Apple Pay auto-log shows the two-tap flow to every league member.

The shortcut holds **no secrets**. On its first run the app hands it a short-lived connect token; it
swaps that for a personal API key and keeps the key in `iCloud Drive › Shortcuts › Who Can Spend the
Less › key.txt` on that phone. Sharing the shortcut on is safe.

Time to build: about ten minutes. iOS 17 or later.

## 1. Build it

Shortcuts app → **Shortcuts** tab → **+**. Tap the title and rename it exactly
**Who Can Spend the Less?** (or whatever you'll put in `APPLE_PAY_SHORTCUT_NAME`; the connect link
opens it by name).

Replace `https://YOUR-DOMAIN` below with the deployed URL (no trailing slash). Add these actions in
order. Names in bold are the action or option names as they appear in the search box; *italics* are
magic variables, picked by tapping the field → **Select Variable** or by tapping the previous action's
output chip.

| # | Action | Settings |
| --- | --- | --- |
| 1 | **Get File** | File Path `Who Can Spend the Less/key.txt`. Turn **Error If Not Found** off. Output = *Key File* |
| 2 | **Text** | Contents: just the variable *Shortcut Input*. Output = *Input Text* |
| 3 | **If** | *Input Text* **begins with** `wcsl_pair_` |
| 4 | **Get Device Details** | **Device Name**. Output = *Device Name* |
| 5 | **Get Contents of URL** | URL `https://YOUR-DOMAIN/api/ingest/apple-pay/pair`. Expand ▸ Method **POST**, Request Body **JSON**, two Text fields: `token` = *Input Text*, `device` = *Device Name*. Output = *Pair Response* |
| 6 | **Get Dictionary Value** | **Value** for key `key` in *Pair Response*. Output = *Key* |
| 7 | **If** | *Key* **has any value** |
| 8 | **Save File** | Input *Key*. Turn **Ask Where To Save** off, Destination Path `Who Can Spend the Less/key.txt`, **Overwrite If File Exists** on |
| 9 | **Get Dictionary Value** | key `message` in *Pair Response* |
| 10 | **Show Alert** | Title `Connected`, message = the value from step 9. Turn **Show Cancel Button** off |
| 11 | **Otherwise** | (of the If from step 7) |
| 12 | **Get Dictionary Value** | key `error` in *Pair Response* |
| 13 | **Show Alert** | Title `Couldn't connect`, message = the value from step 12 |
| 14 | **End If** | |
| 15 | **Otherwise** | (of the If from step 3) |
| 16 | **If** | *Key File* **does not have any value** |
| 17 | **Show Notification** | `Not connected. In the app open Settings → Apple Pay auto-log and tap Connect this iPhone.` |
| 18 | **Stop This Shortcut** | |
| 19 | **End If** | |
| 20 | **Get Contents of URL** | URL `https://YOUR-DOMAIN/api/ingest/apple-pay`. Expand ▸ Method **POST**. Headers: one, key `Authorization`, value `Bearer ` then *Key File* (there's a space after Bearer). Request Body **JSON**, one Text field: `text` = *Input Text*. Output = *Response* |
| 21 | **Get Dictionary Value** | key `message` in *Response* |
| 22 | **Show Notification** | message = the value from step 21 |
| 23 | **End If** | |

Steps 4–13 sit inside the first If; 16–22 inside its Otherwise. Shortcuts indents them for you.

### Why it looks like this

* Step 2 turns whatever came in into text so the If in step 3 offers *begins with*.
* A connect link from the app runs the shortcut with `wcsl_pair_…` as input (top branch). A Wallet
  automation runs it with the rendered Text action (bottom branch). Run by hand with no input it
  posts an empty text and the server answers "Connected as …", which is the connection test.
* The key is a text file, so inserting *Key File* into the header pastes its contents.

## 2. Share it and switch it on

Shortcuts tab → long-press the shortcut → **Share** → **Copy iCloud Link** (iCloud sync for Shortcuts
must be on under Settings → Apple Account → iCloud). Then in Vercel → Project → Settings →
Environment Variables:

```
APPLE_PAY_SHORTCUT_URL=https://www.icloud.com/shortcuts/…
APPLE_PAY_SHORTCUT_NAME=Who Can Spend the Less?
APPLE_PAY_SHORTCUT_INPUT=text
```

Redeploy. Settings → Apple Pay auto-log now shows **Get the shortcut** / **Connect this iPhone** /
the automation steps to everyone.

If you change the shortcut later, share it again and update the URL: iCloud links are snapshots,
and people have to re-add it.

## 3. Test it on your own phone

1. Run the shortcut once by hand from the Shortcuts app. iOS asks to allow each network request the
   first time; allow them. Expect the notification "Not connected…".
2. In the app, Settings → Apple Pay auto-log → **Connect this iPhone**. Shortcuts opens and shows the
   **Connected** alert; back in the app the page now says Connected with your phone's name.
3. Run the shortcut by hand again: "Connected as …, nothing was logged". The key file is in place.
4. Set up the automation exactly as the page describes, then tap to pay for something. The
   notification should read "Logged £… at …", and the entry is on Review.
5. Tap **Disconnect**, run the shortcut by hand: "Not connected…" again. Reconnect.

## 4. Optional: let the automation call the shortcut directly

With `APPLE_PAY_SHORTCUT_INPUT=text`, each person's automation needs a **Text** action with three
variables (Merchant, Amount, Card or Pass) before **Run Shortcut**. Those three picks are the longest
part of their setup. A shortcut that reads the Wallet transaction itself would let the automation
simply select it, which is what `APPLE_PAY_SHORTCUT_INPUT=transaction` shows people.

The catch is that a normal shortcut's editor can't pick transaction fields from *Shortcut Input*
(only the hidden shortcut inside a Wallet automation can), and reports differ on whether the amount
survives the hand-off. Worth ten minutes to find out on your phone:

1. Automation tab → **+** → **Wallet** (or **Transaction**) → **Run Immediately** → **Next** →
   **New Blank Automation**.
2. Add a **Get Contents of URL** action to `https://YOUR-DOMAIN/api/ingest/apple-pay`, POST, JSON,
   with fields `merchant` = *Shortcut Input* ▸ **Merchant**, `amount` = *Shortcut Input* ▸ **Amount**,
   `card` = *Shortcut Input* ▸ **Card or Pass**, and `text` = *Shortcut Input*. Long-press the action →
   **Copy**. Delete the automation.
3. In the shared shortcut, delete step 20 and paste the copied action in its place. Add the
   `Authorization` header back (`Bearer ` + *Key File*). Check the three field tokens still say
   Merchant, Amount and Card or Pass after pasting.
4. Make a Wallet automation that chooses this shortcut directly, tap to pay, and look at the entry on
   Review. Merchant, amount and card all right → share the shortcut again and set
   `APPLE_PAY_SHORTCUT_INPUT=transaction`. Amount blank or merchant odd → leave it on `text`; the
   `text` field keeps the three-line automation working either way.

The server prefers explicit `merchant`/`amount`/`card` fields and falls back to parsing `text`, so
one shortcut serves both kinds of automation.

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| Tapping **Connect this iPhone** does nothing | Not on an iPhone, or the shortcut isn't added yet, or its name differs from `APPLE_PAY_SHORTCUT_NAME` |
| "Shortcut not found" | Same: the name in the connect link must match the installed shortcut exactly, question mark included |
| Alert says the link expired or was already used | Links last 15 minutes and work once. Reload the page and tap again |
| Automation never fires | Settings → Mobile Data → Wallet must be on; the trigger only fires for Apple Pay, not physical card taps; iOS sometimes drops a transaction, Apple knows |
| Notification says "Not connected" | The key file is missing on this phone: tap **Connect this iPhone** |
| 401 in the notification | Key was revoked or replaced (e.g. connected from another phone). Reconnect |
| Entry has no amount | The Text action in the automation is missing the Amount line, or iOS sent none. Fix on Review |
