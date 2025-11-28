# Better Lyrics Shaders

A Chrome extension that adds customizable visual effects to YouTube Music, featuring mesh gradients (Paper Shaders) and warped album art (Kawarp). Built with Plasmo, React, and TypeScript.

> [!WARNING]
> Although optional, it is **highly recommended** to use this extension alongside [Better Lyrics](https://github.com/boidushya/better-lyrics).

## Features

- **Two Effect Modes**: Choose between mesh gradients (Paper Shaders) or warped album art (Kawarp)
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

### Effect Type
- **Mesh Gradient**: Animated color gradients with distortion and swirl effects
- **Kawarp**: Warped and blurred album art with smooth animations

### Mesh Gradient Settings
- 5 gradient colors with full HSL control
- Distortion, swirl, scale, and rotation controls
- Speed and opacity adjustments

### Kawarp Settings
- Warp intensity and blur passes
- Animation speed and saturation
- Dithering control for smoother visuals

### Audio Reactive
- Beat detection syncs effects with the music
- Configurable speed and scale multipliers

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

### Gradient not showing
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

Built with [Paper Shaders](https://github.com/paper-design/shaders), [Kawarp](https://kawarp.boidu.dev), and the [Plasmo](https://www.plasmo.com/) framework.
