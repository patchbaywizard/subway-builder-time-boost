# Time Boost for Subway Builder

**Five extra speed levels beyond the game's native ultrafast setting, with a live readout of how fast your simulation is actually running.**

![Time Boost controls showing Boost 1 through Boost 5, Reset, and an actual speed of 2.81 game hours per real second](images/time-boost.png)

The screenshot shows a real gameplay reading, not a promised speed. **2.81 hr/s** means 2.81 in-game hours passed per real second during the measurement window.

## What it does

- Adds **Boost 1–5** and **Reset** buttons to the bottom bar.
- Extends the default **`[` / `]`** speed shortcuts beyond native ultrafast.
- Displays **Actual … hr/s**, measured from advancing game time over three-second windows.
- Keeps pause under your control: selecting a boost does not unpause the game.

## Installation

1. Download **`time-boost-1.7.1.zip`** from the [Releases page](https://github.com/patchbaywizard/subway-builder-time-boost/releases/latest). Use this release asset rather than GitHub's automatically generated source archive.
2. Extract it. Place the entire **`time-boost`** folder inside your Subway Builder mods folder:

   | Platform | Mods folder |
   | --- | --- |
   | macOS | `~/Library/Application Support/metro-maker4/mods/` |
   | Windows | `%APPDATA%\metro-maker4\mods\` |
   | Linux | `~/.config/metro-maker4/mods/` |

3. Check that the resulting structure is `mods/time-boost/manifest.json` and `mods/time-boost/index.js`. Avoid nesting another `time-boost` folder inside it.
4. Restart Subway Builder, open **Settings → Mods**, and enable **Time Boost**.
5. Load a city. The controls appear in the bottom bar.

Already installed? Quit the game, replace the old `time-boost` folder with the extracted folder, then reopen the game.

## Controls

| Control | Action |
| --- | --- |
| **Boost 1–5** | Select an extra simulation level directly. |
| **`]`** | Increase native speed; after ultrafast, step through Boost 1 → 2 → 3 → 4 → 5. Stops at Boost 5. |
| **`[`** | Step down through boost levels, return to native ultrafast, then continue through native speeds. |
| **Reset** | Restore the original ultrafast rate and update batch settings. |
| **Actual … hr/s** | Show measured game hours per real second. Wait a few seconds after changing levels for a fresh reading. |

The native ultrafast indicator remains selected while a boost is active. Selecting a slower native speed clears the boost. Starting or loading a game, or returning to the menu, also clears it.

Bracket shortcuts are ignored while typing in text fields, during text composition, in dialogs, or with modifier keys. The extension uses the default literal brackets; remapped shortcuts are not extended.

## Choosing a level

Start with a lower boost and step up while watching **Actual hr/s**. **A higher level is a larger simulation request, not a guaranteed increase in measured speed.** Busy networks, CPU load, and the game's simulation overhead can limit throughput. If a higher level reads slower, step back down.

The mod advances the game's normal simulation. It does not jump the clock or skip train and passenger simulation to achieve a displayed number. The speed readout reports elapsed game time rather than the requested speed.

## Compatibility and limitations

- Developed against the mod API in **Subway Builder 1.7.1**. Gameplay controls and measured speeds have been observed on macOS.
- Uses platform-independent mod APIs, but **Windows and Linux have not been tested**.
- Does not add entries to the native **View** menu; the current public mod API does not expose that integration.
- Other mods that change ultrafast speed or simulation batch settings may conflict with Time Boost.
- No dependencies or build step are needed to play. No application files or save files are patched.

## Removal

Click **Reset**, disable **Time Boost** in Settings → Mods, and restart the game. You can then delete its folder.

## Development

From the repository root, run:

```sh
node --test tests/time-boost.test.cjs
python3 scripts/package.py
```

The automated tests use an API mock. They cover rate changes, bounded batching, bracket stepping, pause preservation, restoration, reload, and measured throughput; they are not cross-platform or live-game performance tests.

The release ZIP includes the mod, this guide, and the screenshot. The packaging script also writes a SHA-256 checksum.

[Official mod installation guide](https://www.subwaybuilder.com/docs/getting-started) · [Speed rule API](https://www.subwaybuilder.com/docs/api-reference/constants) · [UI API](https://www.subwaybuilder.com/docs/api-reference/ui)

An independent community mod by **Patchbay Wizard**. Not an official Subway Builder release.
