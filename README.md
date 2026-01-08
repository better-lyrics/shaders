<img width="1280" height="800" alt="Bachelor (Gunna, Turbo) with Better Lyrics Shaders" src="https://github.com/user-attachments/assets/b9894036-18e9-4afe-9cb0-4e11a44a2a55" />

# Better Lyrics Shaders

A browser extension that adds beautiful animated backgrounds to YouTube Music using [Kawarp](https://kawarp.boidu.dev) - creating fluid, warped visuals from album artwork. Built with Plasmo, React, and TypeScript.

> [!WARNING]
> Although optional, it is **highly recommended** to use this extension alongside [Better Lyrics](https://github.com/boidushya/better-lyrics).

## Features

- **Fluid Animated Backgrounds**: Album artwork transforms into smooth, warped visuals
- **Real-time Configuration**: Adjust settings and see changes instantly
- **Persistent Settings**: Your configuration is saved automatically
- **YouTube Music Integration**: Works on player pages, homepage, and search results
- **Audio Reactive**: Optional beat detection that makes effects respond to music

## Installation

### From Source

1. Clone the repository
   ```bash
   git clone https://github.com/boidushya/better-lyrics-shaders
   cd better-lyrics-shaders
   ```

2. Install dependencies
   ```bash
   bun install
   ```

3. Build the extension
   ```bash
   bun run build
   ```

4. Load in Chrome
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `build/chrome-mv3-prod` folder

### Development

For development with hot reload:

```bash
bun run dev
```

Then load the `build/chrome-mv3-dev` folder in Chrome.

## Usage

1. Go to [YouTube Music](https://music.youtube.com)
2. Play any song
3. Click the extension icon in Chrome toolbar to open settings

## Configuration

### Visual Settings
- **Opacity**: Control the visibility of the effect layer
- **Warp Intensity**: How much the album art gets distorted
- **Blur Passes**: Softness of the background (more = dreamier)
- **Animation Speed**: How fast the fluid effect animates
- **Transition Duration**: Crossfade time when switching songs
- **Saturation**: Color intensity boost
- **Dithering**: Subtle noise to prevent color banding

### Audio Reactive
- Beat detection syncs effects with the music
- Configurable speed and scale multipliers
- Adjustable beat sensitivity

## Building for Production

```bash
bun run build    # Build production version
bun run package  # Package for distribution
```

## Troubleshooting

### Extension not loading
- Make sure dependencies are installed: `bun install`
- Build the project: `bun run build`
- Load the correct folder (`build/chrome-mv3-prod`)

### Effect not showing
- Navigate to a YouTube Music player page
- Check that the extension is enabled
- Try refreshing the page

### Development issues
- Use `bun run dev` for hot reload
- Check browser console for errors
- Make sure you're loading `build/chrome-mv3-dev`

## License

MIT

## Credits

Built with [Kawarp](https://kawarp.boidu.dev) and the [Plasmo](https://www.plasmo.com/) framework.
