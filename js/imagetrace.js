/**
 * ImageTracer - Image to SVG Vectorization Library
 * Based on potrace algorithm with color tracing support
 */

const ImageTracer = (function() {
    'use strict';

    // Default options
    const defaultOptions = {
        // Tracing
        colorsampling: 2,      // 0: disabled, 1: random, 2: deterministic
        numberofcolors: 16,    // Number of colors to use
        mincolorratio: 0,      // Color areas smaller than this will be ignored
        colorquantcycles: 3,   // Color quantization cycles
        
        // Paths
        pathomit: 8,           // Paths shorter than this will be omitted
        ltres: 1,              // Straight line tolerance
        qtres: 1,              // Quadratic spline tolerance
        rightangleenhance: true, // Enhance right angle corners
        
        // SVG rendering
        strokewidth: 1,        // Stroke width
        linefilter: false,     // Filter out lines
        scale: 1,              // Output scale
        roundcoords: 1,        // Round coordinates to decimals
        viewbox: false,        // Use viewbox
        desc: false,           // Add description
        
        // Blur
        blurradius: 0,         // Blur radius
        blurdelta: 20,         // Blur delta
        
        // Color mode
        colorMode: 'color',    // 'color', 'grayscale', 'monochrome'
        threshold: 128,        // Threshold for monochrome
    };

    // Color quantization using median cut
    function quantize(imgd, options) {
        const pixels = [];
        const data = imgd.data;
        
        for (let i = 0; i < data.length; i += 4) {
            const a = data[i + 3];
            if (a > 0) {
                pixels.push({
                    r: data[i],
                    g: data[i + 1],
                    b: data[i + 2],
                    a: a
                });
            }
        }
        
        if (pixels.length === 0) {
            return [{ r: 0, g: 0, b: 0, a: 0 }];
        }
        
        return medianCut(pixels, options.numberofcolors);
    }

    function medianCut(pixels, numColors) {
        if (pixels.length === 0 || numColors < 1) {
            return [{ r: 128, g: 128, b: 128, a: 255 }];
        }

        let boxes = [pixels];
        
        while (boxes.length < numColors && boxes.length < pixels.length) {
            let maxRange = 0;
            let maxBox = 0;
            let maxChannel = 'r';
            
            for (let i = 0; i < boxes.length; i++) {
                const box = boxes[i];
                if (box.length < 2) continue;
                
                for (const channel of ['r', 'g', 'b']) {
                    const values = box.map(p => p[channel]);
                    const range = Math.max(...values) - Math.min(...values);
                    if (range > maxRange) {
                        maxRange = range;
                        maxBox = i;
                        maxChannel = channel;
                    }
                }
            }
            
            if (maxRange === 0) break;
            
            const box = boxes[maxBox];
            box.sort((a, b) => a[maxChannel] - b[maxChannel]);
            const mid = Math.floor(box.length / 2);
            
            boxes.splice(maxBox, 1, box.slice(0, mid), box.slice(mid));
        }
        
        return boxes.map(box => {
            if (box.length === 0) return { r: 128, g: 128, b: 128, a: 255 };
            const avg = { r: 0, g: 0, b: 0, a: 0 };
            for (const p of box) {
                avg.r += p.r;
                avg.g += p.g;
                avg.b += p.b;
                avg.a += p.a;
            }
            return {
                r: Math.round(avg.r / box.length),
                g: Math.round(avg.g / box.length),
                b: Math.round(avg.b / box.length),
                a: Math.round(avg.a / box.length)
            };
        });
    }

    // Create indexed image based on palette
    function createIndexedImage(imgd, palette, options) {
        const indexed = new Int32Array(imgd.width * imgd.height);
        const data = imgd.data;
        
        for (let i = 0; i < indexed.length; i++) {
            const idx = i * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            const a = data[idx + 3];
            
            if (a < 128) {
                indexed[i] = -1; // Transparent
                continue;
            }
            
            // Find closest color in palette
            let minDist = Infinity;
            let colorIdx = 0;
            
            for (let j = 0; j < palette.length; j++) {
                const p = palette[j];
                const dr = r - p.r;
                const dg = g - p.g;
                const db = b - p.b;
                const dist = dr * dr + dg * dg + db * db;
                
                if (dist < minDist) {
                    minDist = dist;
                    colorIdx = j;
                }
            }
            
            indexed[i] = colorIdx;
        }
        
        return { array: indexed, width: imgd.width, height: imgd.height };
    }

    // Layer separation - create binary image for each color
    function layerSeparation(indexed, palette) {
        const layers = [];
        
        for (let colorIdx = 0; colorIdx < palette.length; colorIdx++) {
            const layer = new Int8Array(indexed.width * indexed.height);
            let hasPixels = false;
            
            for (let i = 0; i < indexed.array.length; i++) {
                if (indexed.array[i] === colorIdx) {
                    layer[i] = 1;
                    hasPixels = true;
                }
            }
            
            if (hasPixels) {
                layers.push({
                    array: layer,
                    width: indexed.width,
                    height: indexed.height,
                    color: palette[colorIdx]
                });
            }
        }
        
        return layers;
    }

    // Edge detection and path tracing
    function tracePaths(layer, options) {
        const paths = [];
        const w = layer.width;
        const h = layer.height;
        const visited = new Int8Array(w * h);
        
        // Direction vectors: right, down, left, up
        const dx = [1, 0, -1, 0];
        const dy = [0, 1, 0, -1];
        
        function getPixel(x, y) {
            if (x < 0 || x >= w || y < 0 || y >= h) return 0;
            return layer.array[y * w + x];
        }
        
        function isEdge(x, y) {
            if (!getPixel(x, y)) return false;
            return !getPixel(x - 1, y) || !getPixel(x + 1, y) || 
                   !getPixel(x, y - 1) || !getPixel(x, y + 1);
        }
        
        // Find contours using marching squares
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                if (getPixel(x, y) && !visited[y * w + x] && isEdge(x, y)) {
                    const path = [];
                    let cx = x, cy = y;
                    let dir = 0;
                    let startX = x, startY = y;
                    let steps = 0;
                    const maxSteps = w * h * 4;
                    
                    do {
                        path.push({ x: cx, y: cy });
                        visited[cy * w + cx] = 1;
                        
                        // Try to find next edge pixel
                        let found = false;
                        for (let i = 0; i < 4; i++) {
                            const newDir = (dir + 3 + i) % 4; // Turn right first
                            const nx = cx + dx[newDir];
                            const ny = cy + dy[newDir];
                            
                            if (getPixel(nx, ny) && isEdge(nx, ny)) {
                                cx = nx;
                                cy = ny;
                                dir = newDir;
                                found = true;
                                break;
                            }
                        }
                        
                        if (!found) break;
                        steps++;
                    } while ((cx !== startX || cy !== startY) && steps < maxSteps);
                    
                    if (path.length >= options.pathomit) {
                        paths.push(path);
                    }
                }
            }
        }
        
        return paths;
    }

    // Simplify path using Ramer-Douglas-Peucker algorithm
    function simplifyPath(points, tolerance) {
        if (points.length <= 2) return points;
        
        let maxDist = 0;
        let maxIdx = 0;
        
        const start = points[0];
        const end = points[points.length - 1];
        
        for (let i = 1; i < points.length - 1; i++) {
            const dist = perpendicularDistance(points[i], start, end);
            if (dist > maxDist) {
                maxDist = dist;
                maxIdx = i;
            }
        }
        
        if (maxDist > tolerance) {
            const left = simplifyPath(points.slice(0, maxIdx + 1), tolerance);
            const right = simplifyPath(points.slice(maxIdx), tolerance);
            return left.slice(0, -1).concat(right);
        }
        
        return [start, end];
    }

    function perpendicularDistance(point, lineStart, lineEnd) {
        const dx = lineEnd.x - lineStart.x;
        const dy = lineEnd.y - lineStart.y;
        
        if (dx === 0 && dy === 0) {
            return Math.sqrt(
                (point.x - lineStart.x) ** 2 + 
                (point.y - lineStart.y) ** 2
            );
        }
        
        const t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / 
                  (dx * dx + dy * dy);
        
        const nearestX = lineStart.x + t * dx;
        const nearestY = lineStart.y + t * dy;
        
        return Math.sqrt(
            (point.x - nearestX) ** 2 + 
            (point.y - nearestY) ** 2
        );
    }

    // Convert path to SVG path string
    function pathToSvg(path, options) {
        if (path.length === 0) return '';
        
        const simplified = simplifyPath(path, options.ltres);
        if (simplified.length < 2) return '';
        
        const scale = options.scale;
        const round = options.roundcoords;
        
        function r(val) {
            return (val * scale).toFixed(round);
        }
        
        let d = `M ${r(simplified[0].x)} ${r(simplified[0].y)}`;
        
        for (let i = 1; i < simplified.length; i++) {
            d += ` L ${r(simplified[i].x)} ${r(simplified[i].y)}`;
        }
        
        d += ' Z';
        return d;
    }

    // Generate SVG from traced layers
    function generateSvg(layers, width, height, options) {
        const scale = options.scale;
        const w = Math.round(width * scale);
        const h = Math.round(height * scale);
        
        let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"`;
        
        if (options.viewbox) {
            svg += ` viewBox="0 0 ${w} ${h}"`;
        }
        
        svg += '>\n';
        
        if (options.desc) {
            svg += `<desc>Created with ATSVG</desc>\n`;
        }
        
        for (const layer of layers) {
            const paths = tracePaths(layer, options);
            const color = layer.color;
            const fill = `rgba(${color.r},${color.g},${color.b},${color.a / 255})`;
            
            for (const path of paths) {
                const d = pathToSvg(path, options);
                if (d) {
                    svg += `<path fill="${fill}" d="${d}"/>\n`;
                }
            }
        }
        
        svg += '</svg>';
        return svg;
    }

    // Apply grayscale conversion
    function toGrayscale(imgd) {
        const data = imgd.data;
        for (let i = 0; i < data.length; i += 4) {
            const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
            data[i] = gray;
            data[i + 1] = gray;
            data[i + 2] = gray;
        }
        return imgd;
    }

    // Apply monochrome conversion
    function toMonochrome(imgd, threshold) {
        const data = imgd.data;
        for (let i = 0; i < data.length; i += 4) {
            const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            const val = gray >= threshold ? 255 : 0;
            data[i] = val;
            data[i + 1] = val;
            data[i + 2] = val;
        }
        return imgd;
    }

    // Apply blur
    function blur(imgd, radius) {
        if (radius < 1) return imgd;
        
        const w = imgd.width;
        const h = imgd.height;
        const data = imgd.data;
        const output = new Uint8ClampedArray(data);
        
        const size = radius * 2 + 1;
        const kernel = [];
        let sum = 0;
        
        for (let i = 0; i < size; i++) {
            const x = i - radius;
            const val = Math.exp(-(x * x) / (2 * radius * radius));
            kernel.push(val);
            sum += val;
        }
        
        for (let i = 0; i < kernel.length; i++) {
            kernel[i] /= sum;
        }
        
        // Horizontal pass
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                let r = 0, g = 0, b = 0, a = 0;
                
                for (let k = 0; k < size; k++) {
                    const px = Math.min(w - 1, Math.max(0, x + k - radius));
                    const idx = (y * w + px) * 4;
                    r += data[idx] * kernel[k];
                    g += data[idx + 1] * kernel[k];
                    b += data[idx + 2] * kernel[k];
                    a += data[idx + 3] * kernel[k];
                }
                
                const idx = (y * w + x) * 4;
                output[idx] = r;
                output[idx + 1] = g;
                output[idx + 2] = b;
                output[idx + 3] = a;
            }
        }
        
        // Vertical pass
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                let r = 0, g = 0, b = 0, a = 0;
                
                for (let k = 0; k < size; k++) {
                    const py = Math.min(h - 1, Math.max(0, y + k - radius));
                    const idx = (py * w + x) * 4;
                    r += output[idx] * kernel[k];
                    g += output[idx + 1] * kernel[k];
                    b += output[idx + 2] * kernel[k];
                    a += output[idx + 3] * kernel[k];
                }
                
                const idx = (y * w + x) * 4;
                data[idx] = r;
                data[idx + 1] = g;
                data[idx + 2] = b;
                data[idx + 3] = a;
            }
        }
        
        return imgd;
    }

    // Main tracing function
    function trace(imgd, options = {}) {
        const opts = { ...defaultOptions, ...options };
        
        // Apply preprocessing
        if (opts.blurradius > 0) {
            blur(imgd, opts.blurradius);
        }
        
        if (opts.colorMode === 'grayscale') {
            toGrayscale(imgd);
        } else if (opts.colorMode === 'monochrome') {
            toMonochrome(imgd, opts.threshold);
            opts.numberofcolors = 2;
        }
        
        // Quantize colors
        const palette = quantize(imgd, opts);
        
        // Create indexed image
        const indexed = createIndexedImage(imgd, palette, opts);
        
        // Separate layers
        const layers = layerSeparation(indexed, palette);
        
        // Generate SVG
        return generateSvg(layers, imgd.width, imgd.height, opts);
    }

    // Trace from image element
    function traceImage(img, options = {}) {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        
        const imgd = ctx.getImageData(0, 0, canvas.width, canvas.height);
        return trace(imgd, options);
    }

    // Trace from canvas
    function traceCanvas(canvas, options = {}) {
        const ctx = canvas.getContext('2d');
        const imgd = ctx.getImageData(0, 0, canvas.width, canvas.height);
        return trace(imgd, options);
    }

    return {
        trace,
        traceImage,
        traceCanvas,
        defaultOptions
    };
})();

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ImageTracer;
}
