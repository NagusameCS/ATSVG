# ⚡ ATSVG - All To SVG Converter

A powerful, privacy-focused tool that converts any visual file format to SVG. Available as a **web app**, **npm package**, and **CLI tool**. All processing happens locally - **no uploads, no servers, 100% private**.

🔗 **Live Demo**: [https://nagusame.github.io/ATSVG](https://nagusame.github.io/ATSVG)

[![npm version](https://img.shields.io/npm/v/atsvg.svg)](https://www.npmjs.com/package/atsvg)
![Status](https://img.shields.io/badge/Status-Active-brightgreen)
![License](https://img.shields.io/badge/License-MIT-blue)

## ✨ Features

### 📁 Supported Input Formats
- **Images**: PNG, JPEG, WebP, GIF, BMP, TIFF
- **Documents**: PDF (all pages), DOCX
- **More coming soon**: PPTX, and more!

### 🔄 Conversion Modes

#### Embed Mode
- Preserves original image quality
- Wraps image as base64 data URI inside SVG
- Best for photographs and complex images
- Supports PNG, JPEG, and WebP output formats
- Quality slider for lossy formats

#### Trace Mode (Vectorization)
- Converts raster images to true vector paths
- Perfect for logos, icons, and illustrations
- Multiple trace modes:
  - **Color**: Full color vectorization
  - **Grayscale**: Grayscale vector output
  - **Monochrome**: Black & white paths
  - **Posterize**: Limited color palette

### ⚙️ Customization Options

#### Background Controls
- Transparent background support
- Custom background color picker
- **Remove White Background**: Automatically detect and remove white backgrounds with adjustable tolerance

#### Size Controls
- Scale output (10% - 400%)
- Custom width/height
- Maintain aspect ratio option

#### Trace Settings
- Color count (2-64 colors)
- Threshold control for monochrome
- Blur radius for smoothing
- Path simplification level

#### Quality Settings
- Image format selection (PNG/JPEG/WebP)
- Quality slider for lossy formats
- SVG optimization toggle

#### PDF Options
- Select specific page number
- Convert all pages at once
- PDF rendering scale (1x-4x)

#### Advanced
- ViewBox attribute toggle
- Metadata preservation
- SVG output optimization

### 🎯 Additional Features
- **Batch Processing**: Convert multiple files at once
- **Live Preview**: See changes in real-time
- **Split View**: Compare original and converted side-by-side
- **Copy to Clipboard**: Quick copy SVG or code
- **Settings Persistence**: Your preferences are saved locally

## 🚀 Getting Started

### Use Online
Visit [https://nagusame.github.io/ATSVG](https://nagusame.github.io/ATSVG)

### Run Locally

1. Clone the repository:
```bash
git clone https://github.com/NagusameCS/ATSVG.git
cd ATSVG
```

2. Serve with any static file server:
```bash
# Using Python
python -m http.server 8000

# Using Node.js
npx serve

# Using PHP
php -S localhost:8000
```

3. Open `http://localhost:8000` in your browser

## 📦 NPM Package

### Installation

```bash
# Global installation (for CLI)
npm install -g atsvg

# Local installation (for API usage)
npm install atsvg
```

### CLI Usage

```bash
# Basic conversion
atsvg convert image.png -o output.svg

# Convert with tracing (vectorization)
atsvg convert logo.png -m trace -c 8

# Batch convert all PNGs in a directory
atsvg batch "*.png" -o ./svg-output

# Convert PDF (all pages)
atsvg convert document.pdf --pdf-all -o ./pages

# Remove white background
atsvg convert logo.png --remove-white --transparent

# Scale and resize
atsvg convert photo.jpg -s 50 -w 800

# Get file analysis and recommendations
atsvg analyze image.png

# Show all options
atsvg --help
atsvg convert --help
```

### CLI Options

| Option | Description | Default |
|--------|-------------|---------|
| `-o, --output <path>` | Output directory or file | `.` |
| `-m, --mode <mode>` | Conversion mode: `embed`, `trace` | `embed` |
| `-q, --quality <n>` | JPEG quality (1-100) | `92` |
| `-s, --scale <n>` | Scale percentage (1-500) | `100` |
| `-c, --colors <n>` | Colors for tracing (2-256) | `16` |
| `-t, --trace-mode <mode>` | `color`, `grayscale`, `monochrome`, `posterize` | `color` |
| `--transparent` | Enable transparent background | `false` |
| `--remove-white` | Remove white background | `false` |
| `--white-tolerance <n>` | White removal tolerance (0-255) | `20` |
| `--blur <n>` | Blur radius for tracing (0-5) | `0` |
| `--simplify <n>` | Path simplification (0.1-10) | `1` |
| `--threshold <n>` | Monochrome threshold (0-255) | `128` |
| `-w, --width <n>` | Output width in pixels | - |
| `-h, --height <n>` | Output height in pixels | - |
| `--no-aspect` | Don't maintain aspect ratio | - |
| `--viewbox` | Add viewBox attribute | `false` |
| `--pdf-page <n>` | PDF page to convert | `1` |
| `--pdf-all` | Convert all PDF pages | `false` |
| `--pdf-scale <n>` | PDF rendering scale (0.5-4) | `2` |
| `-f, --format <fmt>` | Embedded format: `png`, `jpeg`, `webp` | `png` |
| `--overwrite` | Overwrite existing files | `false` |
| `--silent` | Suppress output | `false` |
| `--dry-run` | Preview without converting | `false` |

### Programmatic API

```javascript
import { ATSVGConverter, createConverter } from 'atsvg';
import fs from 'fs/promises';

// Create converter instance
const converter = new ATSVGConverter({
    conversionMode: 'embed',
    jpegQuality: 92,
    addViewBox: true
});

// Convert a file
const buffer = await fs.readFile('image.png');
const result = await converter.convertBuffer(buffer, 'image.png', {
    scale: 100,
    transparentBg: true
});

// Write output
await fs.writeFile('output.svg', result.svg);
console.log(`Converted: ${result.width}x${result.height}`);

// Analyze a file
const info = await converter.analyzeBuffer(buffer, 'image.png');
console.log(info);
// { type: 'image', width: 800, height: 600, hasTransparency: true, ... }

// Convert with tracing
const traced = await converter.convertBuffer(buffer, 'logo.png', {
    conversionMode: 'trace',
    colorCount: 8,
    traceMode: 'color'
});

// Convert PDF (all pages)
const pdfBuffer = await fs.readFile('document.pdf');
const pages = await converter.convertBuffer(pdfBuffer, 'document.pdf', {
    allPages: true,
    pdfScale: 2
});

for (const page of pages) {
    await fs.writeFile(`page-${page.pageNumber}.svg`, page.svg);
}
```

### API Reference

#### `new ATSVGConverter(options?)`

Create a new converter instance with default options.

#### `converter.convertBuffer(buffer, filename, options?)`

Convert a file buffer to SVG. Returns a Promise with the result object.

**Options:**
- `conversionMode` - `'embed'` | `'trace'`
- `jpegQuality` - Number (1-100)
- `scale` - Number (percentage)
- `colorCount` - Number (for tracing)
- `traceMode` - `'color'` | `'grayscale'` | `'monochrome'` | `'posterize'`
- `transparentBg` - Boolean
- `removeWhiteBg` - Boolean
- `whiteToleranceValue` - Number (0-255)
- `blurRadius` - Number
- `pathSimplify` - Number
- `threshold` - Number (0-255)
- `outputWidth` - Number (pixels)
- `outputHeight` - Number (pixels)
- `maintainAspect` - Boolean
- `addViewBox` - Boolean
- `imageFormat` - `'png'` | `'jpeg'` | `'webp'`
- `pdfPage` - Number
- `pdfScale` - Number
- `allPages` - Boolean

#### `converter.analyzeBuffer(buffer, filename)`

Analyze a file and return metadata. Returns a Promise with file info.

### Self-Host
Simply upload all files to any static hosting service:
- GitHub Pages
- Netlify
- Vercel
- Any web server

## 🛠️ Technical Details

### Dependencies (loaded via CDN)
- **PDF.js** - PDF rendering
- **Mammoth.js** - DOCX parsing

### Browser Support
- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

### Privacy
All file processing happens entirely in your browser using JavaScript. Files are never uploaded to any server. The application works completely offline once loaded.

## 📖 How It Works

### Embed Mode
1. File is read as Data URL
2. Image is drawn to canvas
3. Canvas is exported as base64 (PNG/JPEG/WebP)
4. Base64 data is wrapped in SVG `<image>` tag

### Trace Mode
1. File is read and drawn to canvas
2. Image is preprocessed (blur, color mode)
3. Colors are quantized using median cut algorithm
4. Each color layer is separated
5. Edge detection finds contours
6. Paths are simplified using Ramer-Douglas-Peucker algorithm
7. SVG paths are generated

### PDF Conversion
1. PDF.js renders page to canvas
2. Canvas is processed using embed or trace mode
3. Multi-page PDFs can export all pages

### DOCX Conversion
1. Mammoth.js extracts HTML content
2. HTML is wrapped in SVG foreignObject
3. Preserves text and formatting

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [PDF.js](https://mozilla.github.io/pdf.js/) - Mozilla's PDF rendering library
- [Mammoth.js](https://github.com/mwilliamson/mammoth.js) - DOCX to HTML converter
- Inspired by various image tracing algorithms including Potrace

---

Made with ❤️ by [NagusameCS](https://github.com/NagusameCS)