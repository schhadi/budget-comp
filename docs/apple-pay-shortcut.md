# Building the shared Apple Pay shortcut, tap by tap

One-tap Apple Pay logging needs a single shortcut that everyone installs from an iCloud link. Apple
only lets shortcuts be shared from an iPhone (a file made anywhere else won't import), so whoever
runs the app builds it once on their phone, shares it, and sets `APPLE_PAY_SHORTCUT_URL`. After that,
Settings → Apple Pay auto-log shows the two-tap flow to every league member.

The shortcut holds **no secrets**. On its first run the app hands it a short-lived connect token; it
swaps that for a personal API key and keeps the key in `iCloud Drive › Shortcuts › Who Can Spend the
Less › key.txt` on that phone. Passing the shortcut on is safe.

Needs iOS 17 or later. Budget 20 minutes the first time. Exact wording differs a little between iOS
versions, so this guide names the **fields** you'll see rather than quoting every sentence.

---

## Before you start: six things about the editor

**1. Adding an action.** Tap the search field at the bottom of the editor (it says *Search Actions*
or *Search for apps and actions*), type the name, tap the result. **The new action always appears at
the very bottom of your shortcut**, under everything already there.

**2. Moving an action.** Touch and hold the action's grey card until it lifts, drag it, let go. This
guide only ever asks for one move: *drag it up so it sits just above the line that says **Otherwise***.
Once it's inside the If block it's indented a little to the right. If it lands in the wrong place,
drag it again.

**3. Putting a variable in a field.** Tap the field. A bar of variables appears above the keyboard.
On the left of that bar is **Select Variable** (a magic-wand icon). Tap it: the shortcut dims and
every earlier action shows a blue token underneath it, which is that action's output. Tap the token
you want. The bar also has ready-made chips such as **Shortcut Input**, **Clipboard** and **Current
Date**; swipe the bar left if you can't see one. Never type a variable's name as plain text.

**4. Tokens are blue pills.** Tapping one offers *Rename* and, for some, a list of properties. You
can rename any token to make the next steps easier to follow; this guide uses the default names:

| Action | Its output token is called |
| --- | --- |
| Get File from Folder | **File** |
| Text | **Text** |
| Get Device Details | **Device Details** |
| Get Contents of URL | **Contents of URL** |
| Get Dictionary Value | **Dictionary Value** |

When two actions have the same output name (there are two *Get Contents of URL*), Select Variable
shows a token under **each** of them, so you pick by position: the one under the action this guide
points to.

**5. Hidden options.** Many actions keep extra settings behind a small arrow (▸ or ⌄) on the right
of the card, sometimes labelled *Show More*. Tap it to expand.

**6. The "Receive input" bar.** The first time you pick **Shortcut Input**, a bar appears at the top
of the shortcut reading *Receive Any input from Share Sheet · If there's no input: Continue*. That's
expected. Leave it alone.

---

## Part 1: create and name it

1. Open **Shortcuts** → **Shortcuts** tab → **+** (top right). An empty editor opens.
2. Tap the name at the top (*New Shortcut* or similar) → **Rename** → type exactly
   **Who Can Spend the Less?** → Done. The name matters: the app's Connect button opens the shortcut
   by name, and it must match `APPLE_PAY_SHORTCUT_NAME` character for character, question mark
   included.
3. Replace `YOUR-DOMAIN` in the two URLs below with your deployed domain, for example
   `budget-comp.vercel.app`. No trailing slash.

---

## Part 2: the actions

The finished shortcut, so you can see where you're heading (indented lines are inside an If):

```
 1  Get File from Folder     Who Can Spend the Less/key.txt  (Error If Not Found: off)
 2  Text                     [Shortcut Input]
 3  If [Text] begins with wcsl_pair_
 4      Get Device Details   Device Name
 5      Get Contents of URL  POST …/api/ingest/apple-pay/pair   JSON token=[Text] device=[Device Details]
 6      Get Dictionary Value key      in [Contents of URL]
 7      Get Dictionary Value message  in [Contents of URL]
 8      Show Alert           [Dictionary Value from 7]
    Otherwise
    End If
 9  If [Dictionary Value from 6] has any value
10      Save File            [Dictionary Value from 6] → Who Can Spend the Less/key.txt  (overwrite)
11      Stop This Shortcut
    Otherwise
    End If
12  If [Text] begins with wcsl_pair_
13      Stop This Shortcut
    Otherwise
    End If
14  Get Contents of URL      POST …/api/ingest/apple-pay   header Authorization: Bearer [File]   JSON text=[Text]
15  Get Dictionary Value     message in [Contents of URL from 14]
16  Show Notification        [Dictionary Value from 15]
```

Three If blocks, none inside another, so every move is the same: *drag it up above Otherwise*.
Each Otherwise stays empty; that's fine.

### A. Read the saved key

**Action 1 · Get File from Folder** (search `get file`; pick **Get File from Folder**, not *Get File
of Type*)

- The folder is already **Shortcuts** (iCloud Drive). Leave it.
- In **File Path** type: `Who Can Spend the Less/key.txt`
- Expand the card (▸). Turn **Error If Not Found** **off**. Without this the shortcut would stop
  with an error on a phone that hasn't connected yet.

**Action 2 · Text** (search `text`; pick the plain **Text** action)

- Tap inside the empty box. On the variables bar tap the **Shortcut Input** chip (swipe the bar left
  if needed). The box now holds one blue token and nothing else.
- The *Receive Any input from Share Sheet* bar appears at the top of the shortcut. Leave it.

### B. If this is a connect link: pair the phone

**Action 3 · If** (search `if`)

- It arrives as three lines: **If**, **Otherwise**, **End If**.
- Tap the first field in the If line (it says *Input*) → **Select Variable** → tap the **Text**
  token under action 2.
- Tap **Condition** → choose **begins with**.
- A text field appears after it. Type: `wcsl_pair_` (that's w-c-s-l, then pair, with underscores).

Actions 4 to 8 each land at the bottom, below *End If*. **Drag each one up above the Otherwise of
this If** straight after adding it.

**Action 4 · Get Device Details** (search `device details`)

- Tap the detail it shows and choose **Device Name**.
- Drag it above Otherwise.

**Action 5 · Get Contents of URL** (search `contents of url`)

- In the **URL** field type: `https://YOUR-DOMAIN/api/ingest/apple-pay/pair`
- Expand the card (▸ / *Show More*).
- **Method** → **POST**.
- **Request Body** → **JSON**.
- Tap **Add new field** → **Text**. Key: `token`. Value: tap it → **Select Variable** → the **Text**
  token under action 2.
- Tap **Add new field** → **Text** again. Key: `device`. Value: **Select Variable** → the
  **Device Details** token under action 4.
- Leave **Headers** empty for this one.
- Drag it above Otherwise.

**Action 6 · Get Dictionary Value** (search `dictionary value`)

- It reads *Get **Value** for **Key** in **Dictionary***. Leave *Value* as it is.
- Tap **Key** and type: `key`
- Tap **Dictionary** → **Select Variable** → the **Contents of URL** token under action 5.
- Drag it above Otherwise.

**Action 7 · Get Dictionary Value** (same again)

- Key: `message`
- Dictionary: **Select Variable** → the **Contents of URL** token under action 5 (the same one).
- Drag it above Otherwise.

**Action 8 · Show Alert** (search `show alert`)

- Tap the message field → **Select Variable** → the **Dictionary Value** token under action 7.
- Expand the card. **Title**: `Who Can Spend the Less?` Turn **Show Cancel Button** **off**.
- Drag it above Otherwise.

Check: actions 4 to 8 are indented under the If, and *Otherwise* / *End If* sit below them.

### C. If we got a key: save it and stop

**Action 9 · If** (search `if`)

- It lands at the bottom, which is the right place this time. Don't move it.
- Input: **Select Variable** → the **Dictionary Value** token under action **6** (the one whose key
  is `key`, not the `message` one).
- Condition → **has any value**. No text field is needed.

**Action 10 · Save File** (search `save file`)

- The input field (the thing to save): **Select Variable** → the **Dictionary Value** token under
  action 6, same as the If.
- The folder is **Shortcuts**. Leave it.
- Expand the card. Turn **Ask Where To Save** **off**. Two fields appear:
  **Destination Path** (some versions call it **Subpath**): `Who Can Spend the Less/key.txt`, and
  **Overwrite If File Exists**: **on**.
- Drag it above the Otherwise of action 9.

**Action 11 · Stop This Shortcut** (search `stop`; on older versions it's *Exit Shortcut*)

- Nothing to set.
- Drag it above the Otherwise of action 9.

### D. A connect link that failed: stop here

**Action 12 · If** (search `if`)

- Lands at the bottom; leave it there.
- Input: **Select Variable** → the **Text** token under action 2.
- Condition → **begins with**, text: `wcsl_pair_` (identical to action 3).

**Action 13 · Stop This Shortcut**

- Drag it above the Otherwise of action 12.

Why this block exists: when the pairing in B failed (expired link, no network) there is no key, so
action 9 is skipped. Without action 12 the shortcut would carry on and try to log the connect token
as a payment.

### E. Otherwise it's a payment: send it

Actions 14 to 16 land at the bottom, which is where they belong. No dragging.

**Action 14 · Get Contents of URL**

- URL: `https://YOUR-DOMAIN/api/ingest/apple-pay`
- Expand. **Method** → **POST**.
- **Headers** → **Add new header**. Key: `Authorization`. Value: type `Bearer ` (capital B, then one
  space), then with the cursor after the space tap **Select Variable** → the **File** token under
  action 1. The value reads *Bearer* followed by a blue File pill.
- **Request Body** → **JSON** → **Add new field** → **Text**. Key: `text`. Value: **Select Variable**
  → the **Text** token under action 2.

**Action 15 · Get Dictionary Value**

- Key: `message`
- Dictionary: **Select Variable** → the **Contents of URL** token under action **14** (the lower
  one, not the one in block B).

**Action 16 · Show Notification** (search `show notification`)

- Message: **Select Variable** → the **Dictionary Value** token under action 15.

Tap **Done** (top right). Compare your shortcut with the picture at the top of Part 2.

### Why it looks like this

- Action 2 turns whatever came in into text so the Ifs can offer *begins with*.
- The app's Connect button runs the shortcut with `wcsl_pair_…` as input: block B pairs, block C
  saves the key. A Wallet automation runs it with the rendered Text action: all three Ifs are
  skipped and block E posts it. Run by hand with no input, it posts an empty text and the server
  replies "Connected as …, nothing was logged", which doubles as the connection test.
- The server always answers with a `message`, success or failure, so the shortcut never needs an
  error branch.
- The key is a plain text file; dropping the **File** token into the header pastes its contents.

---

## Part 3: first run

Tap the ▶ (play) button in the editor. iOS asks whether to allow the shortcut to contact your
domain: tap **Allow** (or *Always Allow*). You should get the notification
**"Not connected: no key was sent…"**. That's correct, nothing is paired yet.

If instead you get an error dialog, note which action it names and check that action against Part 2.

---

## Part 4: share it and switch it on

1. Settings → your name → **iCloud** → make sure **Shortcuts** is on (sharing needs iCloud sync).
2. In Shortcuts, open the shortcut in the editor and tap the **Share** button (the square with an
   arrow, top of the editor; on some versions it's under the ⌄ next to the name). Choose
   **Copy iCloud Link**, then **Copy Link**. (If you only see *Share as File*, iCloud sync isn't on
   yet.)
3. Paste the link in Safari to check it: you should see the shortcut's preview with an
   **Add Shortcut** / **Get Shortcut** button.
4. In Vercel → your project → **Settings → Environment Variables**, add:

   ```
   APPLE_PAY_SHORTCUT_URL=https://www.icloud.com/shortcuts/…
   APPLE_PAY_SHORTCUT_NAME=Who Can Spend the Less?
   APPLE_PAY_SHORTCUT_INPUT=text
   ```

5. Redeploy. Settings → Apple Pay auto-log now shows **Get the shortcut** / **Connect this iPhone**
   / the automation steps to everyone.

If you change the shortcut later, share it again and update the URL: iCloud links are snapshots,
and people have to re-add it.

---

## Part 5: test the whole thing on your own phone

1. In the app, Settings → Apple Pay auto-log → **Connect this iPhone**. Shortcuts opens, asks to
   allow the request the first time, and shows the alert **"Connected as …"**. Back in the app the
   page reads *Connected · <your phone's name>*.
2. Run the shortcut by hand (▶): notification **"Connected as …, nothing was logged"**. The key
   file is in place.
3. Build the automation exactly as the settings page describes, then tap to pay for something. The
   notification should read **"Logged £… at …"**, and the entry is on the Review tab.
4. Tap **Disconnect** in the app, run the shortcut by hand: the notification says the key isn't
   valid. Tap **Reconnect this iPhone** to fix it.

---

## Part 6 (optional): let people's automation pick the shortcut directly

With `APPLE_PAY_SHORTCUT_INPUT=text`, each person's automation needs a Text action with three
variables (Merchant, Amount, Card or Pass) before Run Shortcut. Those three picks are the longest
part of their setup. If the shared shortcut could read the Wallet transaction itself, the automation
would just select it, which is what `APPLE_PAY_SHORTCUT_INPUT=transaction` shows people.

The catch: a normal shortcut's editor can't pick transaction fields from Shortcut Input (only the
hidden shortcut inside a Wallet automation can), and reports differ on whether the amount survives
the hand-off. Ten minutes to find out:

1. Automation tab → **+** → **Wallet** (or **Transaction**) → **Run Immediately** → **Next** →
   **New Blank Automation**.
2. Add a **Get Contents of URL** to `https://YOUR-DOMAIN/api/ingest/apple-pay`, POST, JSON, with
   Text fields `merchant` = Shortcut Input ▸ **Merchant**, `amount` = Shortcut Input ▸ **Amount**,
   `card` = Shortcut Input ▸ **Card or Pass**, and `text` = Shortcut Input. Touch and hold the card
   → **Copy**. Then delete the automation.
3. In the shared shortcut, delete action 14 and paste the copied action in its place (touch and hold
   an action → **Paste**). Re-add the `Authorization` header (`Bearer ` + **File**). Check the three
   field tokens still say Merchant, Amount and Card or Pass.
4. Make a Wallet automation that chooses the shortcut directly, tap to pay, look at the entry on
   Review. Merchant, amount and card all right → share again, set
   `APPLE_PAY_SHORTCUT_INPUT=transaction`. Amount blank or merchant odd → leave it on `text`; the
   `text` field keeps the three-line automation working either way.

The server prefers explicit `merchant`/`amount`/`card` fields and falls back to parsing `text`, so
one shortcut serves both kinds of automation.

---

## Troubleshooting

| Symptom | What to do |
| --- | --- |
| An action landed below *End If* and won't go in | Touch and hold its card until it lifts, drag slowly upward, drop between the previous action and *Otherwise*. It should indent |
| Can't find **Select Variable** | Tap inside the field first so the keyboard opens; the bar sits directly above the keyboard. Swipe it left for more chips |
| Two tokens both say *Contents of URL* | Pick by position: tokens show under the action that produces them |
| *Receive Any input from Share Sheet* appeared at the top | Expected after using Shortcut Input. Leave it |
| Save File asks where to save when run | **Ask Where To Save** is still on in action 10 |
| First run shows an error about action 1 | **Error If Not Found** is still on |
| Tapping **Connect this iPhone** does nothing | Not on an iPhone, the shortcut isn't added yet, or its name differs from `APPLE_PAY_SHORTCUT_NAME` |
| "Shortcut not found" | Same: the name must match exactly, question mark included |
| Alert says the link expired or was already used | Links last 15 minutes and work once. Reload the page and tap again |
| Automation never fires | Settings → Mobile Data → **Wallet** must be on; it only fires for Apple Pay, not physical card taps; iOS sometimes drops one |
| Notification says "Not connected" | No key file on this phone: tap **Connect this iPhone** |
| Notification says the key isn't valid | Key was revoked or replaced (connected from another phone). Reconnect |
| Entry has no amount | The Text action in the automation is missing the Amount line, or iOS sent none. Fix it on Review |
