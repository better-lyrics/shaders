# Better Lyrics Shaders

A Chrome extension built with Plasmo and React that adds beautiful, customizable grain gradient effects to YouTube Music lyrics using the Paper Shaders library.

> [!WARNING]
> Although optional, it is **highly recommended** to use this extension alongside [Better Lyrics](https://github.com/boidushya/better-lyrics).

## ✨ Features

- 🎨 **Beautiful Grain Gradients**: Professional shader-based effects using Paper Shaders
- ⚡ **React-powered**: Modern React components with TypeScript
- 🔧 **Real-time Configuration**: Live preview while adjusting settings
- 💾 **Persistent Settings**: Configuration saved automatically
- 🎵 **Lyrics Integration**: Automatically detects YouTube Music lyrics and player page
- 🚀 **Modern Architecture**: Built with Plasmo framework for optimal performance

## 🛠️ Installation & Development

### Setup

1. **Clone/Create the project directory**
   ```bash
   mkdir better-lyrics-shader
   cd better-lyrics-shader
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Build the extension**
   ```bash
   npm run build
   # or
   yarn build
   ```

4. **Load in Chrome**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `build/chrome-mv3-prod` folder
   - The extension will appear in your extensions list

### Development Mode

For development with hot reload:

```bash
npm run dev
# or
yarn dev
```

Then load the `build/chrome-mv3-dev` folder in Chrome.

## 🎮 Usage

1. **Navigate to YouTube Music** (https://music.youtube.com)
2. **Go to any song's player page** (the extension activates on lyrics and player pages)
3. **Click the Better Lyrics Shaders icon** in Chrome toolbar to open settings

## ⚙️ Configuration Options

### Colors
- **5 Gradient Colors**: Full HSL color control
- Tweak controls for gradient
- Use color pickers or enter HSL values directly
- Real-time preview of color changes

## 🚀 Building for Production

```bash
# Build production version
npm run build

# Package for distribution
npm run package
```

The packaged extension will be in the `build` directory.

## 🛠️ Troubleshooting

### Extension Not Loading
- Ensure all dependencies are installed: `npm install`
- Build the project: `npm run build`
- Load the correct build folder (`build/chrome-mv3-prod`)

### Effect Not Showing
- Navigate to a YouTube Music player page (not just the homepage)
- Check that the effect is enabled in the popup
- Try refreshing the page after changing settings

### Development Issues
- Use `npm run dev` for hot reload during development
- Check the browser console for any error messages
- Ensure you're loading the dev build folder (`build/chrome-mv3-dev`)

## 📜 License

This project uses:
- Paper Shaders library (with proper attribution)
- Plasmo framework (MIT license)
- React (MIT license)

## 🙏 Attribution

Built with [Paper Shaders](https://github.com/paper-design/shaders) by paper-design. 
Powered by [Plasmo](https://www.plasmo.com/) framework.
