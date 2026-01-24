<img width="1280" height="800" alt="Bachelor (Gunna, Turbo) with Better Lyrics Shaders" src="https://github.com/user-attachments/assets/b9894036-18e9-4afe-9cb0-4e11a44a2a55" />

# Better Lyrics Shaders

A browser extension that adds beautiful animated backgrounds to YouTube Music using [Kawarp](https://kawarp.boidu.dev) - creating fluid, warped visuals from album artwork. Built with Plasmo, React, and TypeScript.

> [!WARNING]
> Although optional, it is **highly recommended** to use this extension alongside [Better Lyrics](https://github.com/boidushya/better-lyrics).

## Download

<p float="left">
<a href="https://chromewebstore.google.com/detail/better-lyrics-shaders/mffpncjphfmkppebdoaehdlnagnlpfai" target="_blank"><img src="https://developer.chrome.com/static/docs/webstore/branding/image/iNEddTyWiMfLSwFD6qGq.png" alt="Chrome Web Store" height="60"/></a>
<a href="https://addons.mozilla.org/en-US/firefox/addon/better-lyrics-shaders/" target="_blank"><img src="https://blog.mozilla.org/addons/files/2020/04/get-the-addon-fx-apr-2020.svg" alt="Firefox Add-ons" height="60"/></a>
</p>

## Features

- **Fluid Animated Backgrounds**: Album artwork transforms into smooth, warped visuals using Kawarp
- **Animated Album Art**: Displays Apple Music-style animated album artwork when available
- **Audio Reactive**: Beat detection syncs effects with music for a pulsing, dynamic experience
- **Real-time Configuration**: Adjust settings and see changes instantly via the popup
- **Persistent Settings**: Configuration saved automatically across sessions
- **Multi-page Support**: Works on player pages, homepage, and search results
- **Cross-browser**: Supports Chrome, Firefox, Edge, Brave, Arc, and other Chromium browsers

## Installation

### From Web Stores

Use the download links above to install from Chrome Web Store or Firefox Add-ons.

### From Source

1. Clone the repository

   ```bash
   git clone https://github.com/better-lyrics/shaders
   cd shaders
   ```

2. Install dependencies

   ```bash
   bun install
   ```

3. Build the extension

   ```bash
   bun run build
   ```

4. Load in your browser
   - **Chrome/Edge/Brave/Arc**: Open `chrome://extensions/`, enable "Developer mode", click "Load unpacked", select `build/chrome-mv3-prod`
   - **Firefox**: Open `about:debugging#/runtime/this-firefox`, click "Load Temporary Add-on", select any file in `build/firefox-mv2-prod`

### Development

For development with hot reload:

```bash
bun run dev          # Chrome
bun run dev:firefox  # Firefox
bun run dev:edge     # Edge
```

## Usage

1. Go to [YouTube Music](https://music.youtube.com)
2. Play any song
3. Click the extension icon in your browser toolbar to open settings

## Configuration

All settings are accessible from the extension popup with real-time preview.

### Toggles

| Option               | Default | Description                                                 |
| -------------------- | ------- | ----------------------------------------------------------- |
| Enable Effects       | On      | Master toggle for the gradient effect                       |
| Audio Responsive     | On      | Beat detection syncs effects with music                     |
| Show on Browse Pages | Off     | Display effects on homepage/search (may impact performance) |
| Animated Album Art   | On      | Show animated album artwork when available                  |
| Show Logs            | Off     | Debug information in browser console                        |

### Visual Settings

| Option              | Default | Range  | Description                                  |
| ------------------- | ------- | ------ | -------------------------------------------- |
| Opacity             | 0.75    | 0-1    | Visibility of the effect layer               |
| Warp Intensity      | 1.0     | 0-3    | How much the album art gets distorted        |
| Blur Passes         | 8       | 1-16   | Softness of the background (more = dreamier) |
| Animation Speed     | 1.0     | 0-3    | Speed of the fluid effect                    |
| Transition Duration | 1000ms  | 0-3000 | Crossfade time when switching songs          |
| Saturation          | 1.5     | 0-3    | Color intensity boost                        |
| Dithering           | 0.008   | 0-0.05 | Subtle noise to prevent color banding        |

### Audio Reactive Settings

These settings appear when Audio Responsive is enabled:

| Option           | Default | Range | Description                                         |
| ---------------- | ------- | ----- | --------------------------------------------------- |
| Speed Multiplier | 4x      | 1-10  | Animation speed boost on beat                       |
| Scale Boost      | 2%      | 0-10  | Pulsing zoom effect on beats                        |
| Beat Threshold   | 0.75    | 0-1   | Beat detection sensitivity (lower = more sensitive) |

### Import/Export

Settings can be exported to JSON and imported on other devices or browsers.

## Building for Production

```bash
bun run build    # Build for all browsers (Chrome, Firefox, Edge)
bun run package  # Package for distribution
```

Build outputs:

- Chrome: `build/chrome-mv3-prod`
- Firefox: `build/firefox-mv2-prod`
- Edge: `build/edge-mv3-prod`

## Troubleshooting

### Effect not showing

- Ensure you're on [music.youtube.com](https://music.youtube.com) (not youtube.com)
- Check that the extension is enabled in settings
- Try refreshing the page
- Navigate to a player page (start playing a song)

### Audio reactive not working

- Check that "Audio Responsive" is enabled in settings
- Adjust "Beat Threshold" if detection is too sensitive or not sensitive enough

### Performance issues

- Disable "Show on Browse Pages" to limit effects to player page only
- The effect automatically pauses when the tab is not visible

### Animated album art not showing

- Not all songs have animated artwork available
- Ensure "Animated Album Art" is enabled in settings
- The feature queries an external API for availability

## Tech Stack

- [Plasmo](https://www.plasmo.com/) - Browser extension framework
- [Kawarp](https://kawarp.boidu.dev) - Fluid warped background effect
- React 18 + TypeScript
- Web Audio API for beat detection

## License

GPL-3.0 License. See [LICENSE](LICENSE) for details.

## Credits

Built with [Kawarp](https://kawarp.boidu.dev) and the [Plasmo](https://www.plasmo.com/) framework.
