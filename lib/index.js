/**
 * ATSVG - All-To-SVG Converter Library
 * Node.js implementation for converting various file formats to SVG
 * Uses Sharp for image processing (no native canvas dependency)
 */

import sharp from 'sharp';
import mammoth from 'mammoth';
import path from 'path';
import { fileURLToPath } from 'url';

// Get dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Simple image tracer - converts raster to vector paths
 * Pure JavaScript implementation
 */
class ImageTracer {
    constructor(options = {}) {
        this.options = {
            colorCount: options.colorCount || 16,
            threshold: options.threshold || 128,
            blurRadius: options.blurRadius || 0,
            pathSimplify: options.pathSimplify || 1,
            traceMode: options.traceMode || 'color'
        };
    }

    /**
     * Quantize colors using median cut algorithm
     */
    quantizeColors(pixels, numColors) {
        if (pixels.length === 0 || numColors < 1) {
            return [{ r: 128, g: 128, b: 128, count: 0 }];
        }

        // Build color buckets
        let buckets = [pixels.slice()];

        while (buckets.length < numColors) {
            // Find bucket with largest range
            let maxRange = 0;
            let maxBucketIdx = 0;
            let maxChannel = 'r';

            for (let i = 0; i < buckets.length; i++) {
                const bucket = buckets[i];
                if (bucket.length < 2) continue;

                for (const channel of ['r', 'g', 'b']) {
                    const values = bucket.map(p => p[channel]);
                    const min = Math.min(...values);
                    const max = Math.max(...values);
                    const range = max - min;

                    if (range > maxRange) {
                        maxRange = range;
                        maxBucketIdx = i;
                        maxChannel = channel;
                    }
                }
            }

            if (maxRange === 0) break;

            // Split the bucket
            const bucket = buckets[maxBucketIdx];
            bucket.sort((a, b) => a[maxChannel] - b[maxChannel]);
            const mid = Math.floor(bucket.length / 2);
            buckets.splice(maxBucketIdx, 1, bucket.slice(0, mid), bucket.slice(mid));
        }

        // Calculate average color for each bucket
        return buckets.map(bucket => {
            if (bucket.length === 0) return { r: 0, g: 0, b: 0, count: 0 };
            
            const sum = bucket.reduce((acc, p) => ({
                r: acc.r + p.r,
                g: acc.g + p.g,
                b: acc.b + p.b
            }), { r: 0, g: 0, b: 0 });

            return {
                r: Math.round(sum.r / bucket.length),
                g: Math.round(sum.g / bucket.length),
                b: Math.round(sum.b / bucket.length),
                count: bucket.length
            };
        }).filter(c => c.count > 0);
    }

    /**
     * Find color palette from image data
     */
    getPalette(data, width, height, numColors) {
        const pixels = [];
        
        for (let i = 0; i < data.length; i += 4) {
            const a = data[i + 3];
            if (a > 128) { // Only include non-transparent pixels
                pixels.push({
                    r: data[i],
                    g: data[i + 1],
                    b: data[i + 2]
                });
            }
        }

        return this.quantizeColors(pixels, numColors);
    }

    /**
     * Map each pixel to nearest palette color
     */
    mapToPalette(data, palette) {
        const indexed = new Int16Array(data.length / 4);
        
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];

            if (a < 128) {
                indexed[i / 4] = -1; // Transparent
                continue;
            }

            // Find nearest color
            let minDist = Infinity;
            let nearest = 0;

            for (let j = 0; j < palette.length; j++) {
                const c = palette[j];
                const dist = (r - c.r) ** 2 + (g - c.g) ** 2 + (b - c.b) ** 2;
                if (dist < minDist) {
                    minDist = dist;
                    nearest = j;
                }
            }

            indexed[i / 4] = nearest;
        }

        return indexed;
    }

    /**
     * Simplify path using Ramer-Douglas-Peucker algorithm
     */
    simplifyPath(path, tolerance) {
        if (path.length <= 2) return path;

        const sqTolerance = tolerance * tolerance;

        function getSqSegDist(p, p1, p2) {
            let x = p1.x;
            let y = p1.y;
            let dx = p2.x - x;
            let dy = p2.y - y;

            if (dx !== 0 || dy !== 0) {
                const t = ((p.x - x) * dx + (p.y - y) * dy) / (dx * dx + dy * dy);
                if (t > 1) {
                    x = p2.x;
                    y = p2.y;
                } else if (t > 0) {
                    x += dx * t;
                    y += dy * t;
                }
            }

            return (p.x - x) ** 2 + (p.y - y) ** 2;
        }

        function simplifyDPStep(points, first, last, sqTolerance, simplified) {
            let maxSqDist = sqTolerance;
            let index = 0;

            for (let i = first + 1; i < last; i++) {
                const sqDist = getSqSegDist(points[i], points[first], points[last]);
                if (sqDist > maxSqDist) {
                    index = i;
                    maxSqDist = sqDist;
                }
            }

            if (maxSqDist > sqTolerance) {
                if (index - first > 1) {
                    simplifyDPStep(points, first, index, sqTolerance, simplified);
                }
                simplified.push(points[index]);
                if (last - index > 1) {
                    simplifyDPStep(points, index, last, sqTolerance, simplified);
                }
            }
        }

        const last = path.length - 1;
        const simplified = [path[0]];
        simplifyDPStep(path, 0, last, sqTolerance, simplified);
        simplified.push(path[last]);

        return simplified;
    }

    /**
     * Convert to grayscale
     */
    toGrayscale(data) {
        const result = new Uint8ClampedArray(data.length);
        for (let i = 0; i < data.length; i += 4) {
            const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
            result[i] = gray;
            result[i + 1] = gray;
            result[i + 2] = gray;
            result[i + 3] = data[i + 3];
        }
        return result;
    }

    /**
     * Convert to monochrome
     */
    toMonochrome(data, threshold) {
        const result = new Uint8ClampedArray(data.length);
        for (let i = 0; i < data.length; i += 4) {
            const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            const val = gray > threshold ? 255 : 0;
            result[i] = val;
            result[i + 1] = val;
            result[i + 2] = val;
            result[i + 3] = data[i + 3];
        }
        return result;
    }

    /**
     * Create run-length encoded rectangles for a color
     */
    createColorRects(indexed, width, height, colorIdx) {
        const rects = [];
        
        for (let y = 0; y < height; y++) {
            let runStart = -1;
            
            for (let x = 0; x <= width; x++) {
                const idx = y * width + x;
                const isColor = x < width && indexed[idx] === colorIdx;
                
                if (isColor && runStart === -1) {
                    runStart = x;
                } else if (!isColor && runStart !== -1) {
                    rects.push({ x: runStart, y, w: x - runStart, h: 1 });
                    runStart = -1;
                }
            }
        }

        // Merge vertically adjacent rectangles
        return this.mergeRects(rects);
    }

    /**
     * Merge adjacent rectangles
     */
    mergeRects(rects) {
        if (rects.length === 0) return rects;
        
        // Sort by y, then x
        rects.sort((a, b) => a.y - b.y || a.x - b.x);
        
        const merged = [];
        let current = { ...rects[0] };
        
        for (let i = 1; i < rects.length; i++) {
            const rect = rects[i];
            
            // Can merge if same x and width, and adjacent y
            if (rect.x === current.x && rect.w === current.w && rect.y === current.y + current.h) {
                current.h += rect.h;
            } else {
                merged.push(current);
                current = { ...rect };
            }
        }
        
        merged.push(current);
        return merged;
    }

    /**
     * Main trace function - creates SVG from image data
     */
    trace(data, width, height, options = {}) {
        const opts = { ...this.options, ...options };
        let processedData = new Uint8ClampedArray(data);

        // Apply color mode
        if (opts.traceMode === 'grayscale') {
            processedData = this.toGrayscale(data);
        } else if (opts.traceMode === 'monochrome') {
            processedData = this.toMonochrome(data, opts.threshold);
        }

        // Get palette
        const numColors = opts.traceMode === 'monochrome' ? 2 : opts.colorCount;
        const palette = this.getPalette(processedData, width, height, numColors);

        // Map pixels to palette
        const indexed = this.mapToPalette(processedData, palette);

        // Generate SVG
        let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">\n`;
        svg += `  <title>Traced with ATSVG</title>\n`;

        // Generate optimized rectangles for each color
        for (let i = 0; i < palette.length; i++) {
            const color = palette[i];
            const colorStr = `rgb(${color.r},${color.g},${color.b})`;
            
            const rects = this.createColorRects(indexed, width, height, i);
            
            if (rects.length > 0) {
                svg += `  <g fill="${colorStr}" shape-rendering="crispEdges">\n`;
                
                // Convert to path for better compression
                if (rects.length > 100) {
                    // Use path for many rectangles
                    let pathData = '';
                    for (const rect of rects) {
                        pathData += `M${rect.x} ${rect.y}h${rect.w}v${rect.h}h${-rect.w}z`;
                    }
                    svg += `    <path d="${pathData}"/>\n`;
                } else {
                    // Use individual rects for few rectangles
                    for (const rect of rects) {
                        svg += `    <rect x="${rect.x}" y="${rect.y}" width="${rect.w}" height="${rect.h}"/>\n`;
                    }
                }
                
                svg += `  </g>\n`;
            }
        }

        svg += `</svg>`;

        return svg;
    }
}

/**
 * ATSVG Converter Class
 * Main class for converting files to SVG
 */
export class ATSVGConverter {
    constructor(options = {}) {
        this.options = {
            // Default options
            conversionMode: 'embed',
            jpegQuality: 92,
            scale: 100,
            colorCount: 16,
            traceMode: 'color',
            transparentBg: true,
            removeWhiteBg: false,
            whiteToleranceValue: 20,
            blurRadius: 0,
            pathSimplify: 1,
            threshold: 128,
            addViewBox: true,
            imageFormat: 'png',
            pdfScale: 2,
            ...options
        };

        this.supportedImageTypes = [
            '.png', '.jpg', '.jpeg', '.webp', '.gif', 
            '.bmp', '.tiff', '.tif', '.avif', '.heic', '.heif'
        ];
        this.supportedDocTypes = ['.pdf', '.docx'];
    }

    /**
     * Get file type from filename
     */
    getFileType(filename) {
        const ext = path.extname(filename).toLowerCase();
        
        if (this.supportedImageTypes.includes(ext)) {
            return 'image';
        }
        
        if (ext === '.pdf') {
            return 'pdf';
        }
        
        if (ext === '.docx') {
            return 'docx';
        }
        
        if (ext === '.doc') {
            return 'doc';
        }
        
        // Default to image and let Sharp handle it
        return 'image';
    }

    /**
     * Analyze a buffer and return file information
     */
    async analyzeBuffer(buffer, filename) {
        const fileType = this.getFileType(filename);
        const result = {
            type: fileType,
            filename,
            size: buffer.length
        };

        try {
            if (fileType === 'image') {
                const metadata = await sharp(buffer).metadata();
                result.width = metadata.width;
                result.height = metadata.height;
                result.format = metadata.format;
                result.hasTransparency = metadata.hasAlpha;
                result.channels = metadata.channels;
                
                // Analyze image complexity (simple heuristic)
                const stats = await sharp(buffer).stats();
                const colorVariance = stats.channels.reduce((sum, ch) => sum + ch.stdev, 0);
                result.isSimple = colorVariance < 50;
            } else if (fileType === 'pdf') {
                // Try to load PDF.js if available
                try {
                    const pdfjs = await import('pdfjs-dist');
                    const loadingTask = pdfjs.getDocument({ data: buffer });
                    const pdf = await loadingTask.promise;
                    result.pages = pdf.numPages;
                    
                    const page = await pdf.getPage(1);
                    const viewport = page.getViewport({ scale: 1 });
                    result.width = Math.round(viewport.width);
                    result.height = Math.round(viewport.height);
                } catch (e) {
                    result.pages = 'unknown (pdfjs-dist not available)';
                }
            }
        } catch (error) {
            result.error = error.message;
        }

        return result;
    }

    /**
     * Convert a buffer to SVG
     */
    async convertBuffer(buffer, filename, options = {}) {
        const opts = { ...this.options, ...options };
        const fileType = this.getFileType(filename);

        switch (fileType) {
            case 'image':
                return await this.convertImage(buffer, opts);
            case 'pdf':
                return await this.convertPDF(buffer, opts);
            case 'docx':
                return await this.convertDOCX(buffer, opts);
            case 'doc':
                throw new Error('DOC format is not supported. Please convert to DOCX first.');
            default:
                // Try as image
                return await this.convertImage(buffer, opts);
        }
    }

    /**
     * Convert image buffer to SVG
     */
    async convertImage(buffer, options = {}) {
        const opts = { ...this.options, ...options };
        
        // Process image with Sharp
        let image = sharp(buffer);
        const metadata = await image.metadata();
        
        let width = metadata.width;
        let height = metadata.height;

        // Apply scaling
        const scale = (opts.scale || 100) / 100;
        
        // Handle custom size
        if (opts.outputWidth || opts.outputHeight) {
            if (opts.maintainAspect !== false) {
                if (opts.outputWidth && !opts.outputHeight) {
                    height = Math.round((height / width) * opts.outputWidth);
                    width = opts.outputWidth;
                } else if (opts.outputHeight && !opts.outputWidth) {
                    width = Math.round((width / height) * opts.outputHeight);
                    height = opts.outputHeight;
                } else {
                    const aspectRatio = width / height;
                    if (opts.outputWidth / opts.outputHeight > aspectRatio) {
                        width = Math.round(opts.outputHeight * aspectRatio);
                        height = opts.outputHeight;
                    } else {
                        height = Math.round(opts.outputWidth / aspectRatio);
                        width = opts.outputWidth;
                    }
                }
            } else {
                width = opts.outputWidth || width;
                height = opts.outputHeight || height;
            }
        }

        // Apply scale
        width = Math.round(width * scale);
        height = Math.round(height * scale);

        // Resize image
        image = image.resize(width, height, {
            fit: 'fill',
            withoutEnlargement: false
        });

        // Handle background
        if (opts.removeWhiteBg) {
            image = await this.removeWhiteBackgroundSharp(image, opts.whiteToleranceValue);
        }

        if (opts.transparentBg) {
            image = image.ensureAlpha();
        } else if (opts.bgColor) {
            image = image.flatten({ background: opts.bgColor });
        }

        // Apply blur if tracing
        if (opts.conversionMode === 'trace' && opts.blurRadius > 0) {
            image = image.blur(opts.blurRadius);
        }

        const processedBuffer = await image.png().toBuffer();
        const processedMetadata = await sharp(processedBuffer).metadata();

        if (opts.conversionMode === 'trace') {
            const svg = await this.traceImage(processedBuffer, processedMetadata, opts);
            return {
                svg,
                width: processedMetadata.width,
                height: processedMetadata.height,
                originalSize: buffer.length
            };
        } else {
            const svg = await this.embedImage(processedBuffer, processedMetadata, opts);
            return {
                svg,
                width: processedMetadata.width,
                height: processedMetadata.height,
                originalSize: buffer.length
            };
        }
    }

    /**
     * Remove white background using Sharp
     */
    async removeWhiteBackgroundSharp(image, tolerance = 20) {
        const { data, info } = await image.raw().ensureAlpha().toBuffer({ resolveWithObject: true });
        const threshold = 255 - tolerance;
        
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            
            if (r >= threshold && g >= threshold && b >= threshold) {
                data[i + 3] = 0; // Make transparent
            }
        }

        return sharp(data, {
            raw: {
                width: info.width,
                height: info.height,
                channels: 4
            }
        });
    }

    /**
     * Embed image as base64 in SVG
     */
    async embedImage(buffer, metadata, options = {}) {
        const format = options.imageFormat || 'png';
        const quality = options.jpegQuality || 92;
        
        let processedBuffer;
        let mimeType;
        
        switch (format) {
            case 'jpeg':
                processedBuffer = await sharp(buffer).jpeg({ quality }).toBuffer();
                mimeType = 'image/jpeg';
                break;
            case 'webp':
                processedBuffer = await sharp(buffer).webp({ quality }).toBuffer();
                mimeType = 'image/webp';
                break;
            default:
                processedBuffer = buffer;
                mimeType = 'image/png';
        }

        const base64 = processedBuffer.toString('base64');
        const dataUrl = `data:${mimeType};base64,${base64}`;
        
        const width = metadata.width;
        const height = metadata.height;

        let svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"`;
        svg += ` width="${width}" height="${height}"`;
        
        if (options.addViewBox) {
            svg += ` viewBox="0 0 ${width} ${height}"`;
        }
        
        svg += `>\n`;
        svg += `  <title>Converted with ATSVG</title>\n`;
        svg += `  <image width="${width}" height="${height}" xlink:href="${dataUrl}"/>\n`;
        svg += `</svg>`;

        return svg;
    }

    /**
     * Trace image to vector SVG
     */
    async traceImage(buffer, metadata, options = {}) {
        // Get raw pixel data from Sharp
        const { data, info } = await sharp(buffer)
            .ensureAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true });

        const tracer = new ImageTracer(options);
        return tracer.trace(data, info.width, info.height, options);
    }

    /**
     * Convert PDF to SVG
     */
    async convertPDF(buffer, options = {}) {
        const pdfScale = options.pdfScale || 2;
        const pageNumber = options.pdfPage || 1;
        
        // Try to load PDF.js
        let pdfjs;
        try {
            pdfjs = await import('pdfjs-dist');
        } catch (e) {
            throw new Error('PDF support requires pdfjs-dist package. Install with: npm install pdfjs-dist');
        }

        const loadingTask = pdfjs.getDocument({ data: buffer });
        const pdf = await loadingTask.promise;
        
        if (options.allPages) {
            const results = [];
            for (let i = 1; i <= pdf.numPages; i++) {
                const result = await this.renderPDFPage(pdf, i, pdfScale, options);
                results.push({
                    ...result,
                    pageNumber: i,
                    totalPages: pdf.numPages
                });
            }
            return results;
        } else {
            if (pageNumber > pdf.numPages) {
                throw new Error(`Page ${pageNumber} does not exist. PDF has ${pdf.numPages} pages.`);
            }
            return await this.renderPDFPage(pdf, pageNumber, pdfScale, options);
        }
    }

    /**
     * Render a single PDF page to SVG
     */
    async renderPDFPage(pdf, pageNumber, scale, options) {
        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale });
        
        const width = Math.round(viewport.width);
        const height = Math.round(viewport.height);
        
        // Extract text content
        const textContent = await page.getTextContent();
        
        let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"`;
        if (options.addViewBox) {
            svg += ` viewBox="0 0 ${width} ${height}"`;
        }
        svg += `>\n`;
        svg += `  <title>PDF Page ${pageNumber} - Converted with ATSVG</title>\n`;
        svg += `  <rect width="100%" height="100%" fill="white"/>\n`;
        
        // Add text elements
        svg += `  <g font-family="Arial, sans-serif">\n`;
        for (const item of textContent.items) {
            if (item.str && item.str.trim()) {
                const x = item.transform[4] * scale;
                const y = height - (item.transform[5] * scale);
                const fontSize = Math.abs(item.transform[0] * scale) || 12;
                
                // Escape XML entities
                const text = item.str
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;');
                
                svg += `    <text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="${fontSize.toFixed(1)}">${text}</text>\n`;
            }
        }
        svg += `  </g>\n`;
        svg += `</svg>`;

        return {
            svg,
            width,
            height,
            originalSize: 0
        };
    }

    /**
     * Convert DOCX to SVG
     */
    async convertDOCX(buffer, options = {}) {
        // Extract HTML from DOCX
        const result = await mammoth.convertToHtml({ buffer });
        const html = result.value;
        
        // Create a simple SVG with foreign object containing the HTML
        const width = options.outputWidth || 800;
        const height = options.outputHeight || 1200;
        
        let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"`;
        
        if (options.addViewBox) {
            svg += ` viewBox="0 0 ${width} ${height}"`;
        }
        
        svg += `>
  <title>Converted with ATSVG</title>
  <foreignObject width="100%" height="100%">
    <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: Arial, sans-serif; padding: 20px; box-sizing: border-box; font-size: 14px; line-height: 1.6;">
      ${html}
    </div>
  </foreignObject>
</svg>`;

        return {
            svg,
            width,
            height,
            originalSize: buffer.length,
            warnings: result.messages
        };
    }
}

// Export default instance factory
export function createConverter(options = {}) {
    return new ATSVGConverter(options);
}

// Export for CommonJS compatibility
export default ATSVGConverter;
