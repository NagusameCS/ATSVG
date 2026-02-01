/**
 * ATSVG Converter - Core conversion logic
 * Handles all file type conversions to SVG
 */

class ATSVGConverter {
    constructor() {
        this.supportedImageTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'image/bmp', 'image/tiff'];
        this.supportedDocTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
        
        // Initialize PDF.js worker
        if (typeof pdfjsLib !== 'undefined') {
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        }
    }

    /**
     * Get file type category
     */
    getFileType(file) {
        const type = file.type.toLowerCase();
        const name = file.name.toLowerCase();
        
        if (this.supportedImageTypes.includes(type) || 
            name.match(/\.(png|jpg|jpeg|webp|gif|bmp|tiff?)$/)) {
            return 'image';
        }
        
        if (type === 'application/pdf' || name.endsWith('.pdf')) {
            return 'pdf';
        }
        
        if (type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
            name.endsWith('.docx')) {
            return 'docx';
        }
        
        if (name.endsWith('.doc')) {
            return 'doc';
        }
        
        if (type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' || 
            name.endsWith('.pptx')) {
            return 'pptx';
        }
        
        // Try to handle as image
        if (type.startsWith('image/')) {
            return 'image';
        }
        
        return 'unknown';
    }

    /**
     * Main conversion method
     */
    async convert(file, options = {}) {
        const fileType = this.getFileType(file);
        
        switch (fileType) {
            case 'image':
                return await this.convertImage(file, options);
            case 'pdf':
                return await this.convertPDF(file, options);
            case 'docx':
                return await this.convertDOCX(file, options);
            case 'doc':
                throw new Error('DOC format is not supported. Please convert to DOCX first.');
            case 'pptx':
                return await this.convertPPTX(file, options);
            default:
                throw new Error(`Unsupported file type: ${file.type || file.name}`);
        }
    }

    /**
     * Convert image file to SVG
     */
    async convertImage(file, options = {}) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = async (e) => {
                try {
                    const img = new Image();
                    
                    img.onload = () => {
                        try {
                            const svg = this.imageToSVG(img, options);
                            resolve({
                                svg,
                                width: img.naturalWidth,
                                height: img.naturalHeight,
                                originalSize: file.size
                            });
                        } catch (err) {
                            reject(err);
                        }
                    };
                    
                    img.onerror = () => reject(new Error('Failed to load image'));
                    img.src = e.target.result;
                } catch (err) {
                    reject(err);
                }
            };
            
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(file);
        });
    }

    /**
     * Convert loaded image to SVG
     */
    imageToSVG(img, options = {}) {
        const mode = options.conversionMode || 'embed';
        
        // Create canvas for processing
        const canvas = document.createElement('canvas');
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;
        
        // Apply scaling
        const scale = (options.scale || 100) / 100;
        
        // Custom size
        if (options.customSize && (options.outputWidth || options.outputHeight)) {
            if (options.maintainAspect) {
                if (options.outputWidth && !options.outputHeight) {
                    height = (height / width) * options.outputWidth;
                    width = options.outputWidth;
                } else if (options.outputHeight && !options.outputWidth) {
                    width = (width / height) * options.outputHeight;
                    height = options.outputHeight;
                } else {
                    const aspectRatio = width / height;
                    if (options.outputWidth / options.outputHeight > aspectRatio) {
                        width = options.outputHeight * aspectRatio;
                        height = options.outputHeight;
                    } else {
                        height = options.outputWidth / aspectRatio;
                        width = options.outputWidth;
                    }
                }
            } else {
                width = options.outputWidth || width;
                height = options.outputHeight || height;
            }
        }
        
        canvas.width = Math.round(width * scale);
        canvas.height = Math.round(height * scale);
        
        const ctx = canvas.getContext('2d');
        
        // Handle background
        if (!options.transparentBg && options.bgColor) {
            ctx.fillStyle = options.bgColor;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        // Remove white background if requested
        if (options.removeWhiteBg) {
            this.removeWhiteBackground(ctx, canvas.width, canvas.height, options.whiteToleranceValue || 20);
        }
        
        if (mode === 'trace') {
            return this.traceToSVG(canvas, options);
        } else {
            return this.embedToSVG(canvas, options);
        }
    }

    /**
     * Remove white background from canvas
     */
    removeWhiteBackground(ctx, width, height, tolerance) {
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        const threshold = 255 - tolerance;
        
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            
            // Check if pixel is white-ish
            if (r >= threshold && g >= threshold && b >= threshold) {
                data[i + 3] = 0; // Make transparent
            }
        }
        
        ctx.putImageData(imageData, 0, 0);
    }

    /**
     * Embed image as base64 in SVG
     */
    embedToSVG(canvas, options = {}) {
        const format = options.imageFormat || 'png';
        const quality = (options.jpegQuality || 92) / 100;
        
        let mimeType = 'image/png';
        if (format === 'jpeg') mimeType = 'image/jpeg';
        if (format === 'webp') mimeType = 'image/webp';
        
        const dataUrl = canvas.toDataURL(mimeType, quality);
        const width = canvas.width;
        const height = canvas.height;
        
        let svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"`;
        svg += ` width="${width}" height="${height}"`;
        
        if (options.addViewBox) {
            svg += ` viewBox="0 0 ${width} ${height}"`;
        }
        
        svg += `>\n`;
        
        if (options.preserveMetadata) {
            svg += `  <desc>Converted with ATSVG</desc>\n`;
        }
        
        svg += `  <image width="${width}" height="${height}" xlink:href="${dataUrl}"/>\n`;
        svg += `</svg>`;
        
        return svg;
    }

    /**
     * Trace image to vector SVG
     */
    traceToSVG(canvas, options = {}) {
        const traceOptions = {
            numberofcolors: options.colorCount || 16,
            blurradius: options.blurRadius || 0,
            ltres: options.pathSimplify || 1,
            threshold: options.threshold || 128,
            scale: 1,
            viewbox: options.addViewBox,
            desc: options.preserveMetadata
        };
        
        // Set color mode
        switch (options.traceMode) {
            case 'grayscale':
                traceOptions.colorMode = 'grayscale';
                break;
            case 'monochrome':
                traceOptions.colorMode = 'monochrome';
                break;
            case 'posterize':
                traceOptions.colorMode = 'color';
                traceOptions.numberofcolors = Math.min(options.colorCount || 8, 8);
                break;
            default:
                traceOptions.colorMode = 'color';
        }
        
        return ImageTracer.traceCanvas(canvas, traceOptions);
    }

    /**
     * Convert PDF to SVG
     */
    async convertPDF(file, options = {}) {
        if (typeof pdfjsLib === 'undefined') {
            throw new Error('PDF.js library not loaded');
        }

        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        
        const pageNumber = options.pdfPage || 1;
        const pdfScale = options.pdfScale || 2;
        
        if (options.allPages) {
            // Convert all pages
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
            // Convert single page
            if (pageNumber > pdf.numPages) {
                throw new Error(`Page ${pageNumber} does not exist. PDF has ${pdf.numPages} pages.`);
            }
            
            const result = await this.renderPDFPage(pdf, pageNumber, pdfScale, options);
            return {
                ...result,
                pageNumber,
                totalPages: pdf.numPages,
                originalSize: file.size
            };
        }
    }

    /**
     * Render a single PDF page to SVG
     */
    async renderPDFPage(pdf, pageNumber, scale, options) {
        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale });
        
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        
        const ctx = canvas.getContext('2d');
        
        // White background for PDF
        ctx.fillStyle = options.transparentBg ? 'transparent' : (options.bgColor || '#ffffff');
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        await page.render({
            canvasContext: ctx,
            viewport: viewport
        }).promise;
        
        const svg = this.imageToSVG({ 
            naturalWidth: canvas.width, 
            naturalHeight: canvas.height,
            width: canvas.width,
            height: canvas.height
        }, {
            ...options,
            _canvas: canvas
        });
        
        // Use the canvas directly for embedding
        const mode = options.conversionMode || 'embed';
        let finalSvg;
        
        if (mode === 'trace') {
            finalSvg = this.traceToSVG(canvas, options);
        } else {
            finalSvg = this.embedToSVG(canvas, options);
        }
        
        return {
            svg: finalSvg,
            width: canvas.width,
            height: canvas.height
        };
    }

    /**
     * Convert DOCX to SVG
     */
    async convertDOCX(file, options = {}) {
        if (typeof mammoth === 'undefined') {
            throw new Error('Mammoth.js library not loaded');
        }

        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer });
        
        // Create an HTML element to render
        const container = document.createElement('div');
        container.innerHTML = result.value;
        container.style.cssText = `
            font-family: 'Times New Roman', serif;
            font-size: 12pt;
            line-height: 1.5;
            padding: 40px;
            background: ${options.transparentBg ? 'transparent' : (options.bgColor || '#ffffff')};
            color: #000000;
            width: 816px;
            min-height: 1056px;
        `;
        
        // Append to body temporarily for rendering
        document.body.appendChild(container);
        
        // Use html2canvas alternative - render to canvas
        const svg = await this.htmlToSVG(container, options);
        
        document.body.removeChild(container);
        
        return {
            svg,
            width: 816,
            height: container.offsetHeight,
            originalSize: file.size
        };
    }

    /**
     * Convert HTML element to SVG using foreignObject
     */
    async htmlToSVG(element, options = {}) {
        const width = element.offsetWidth || 816;
        const height = element.offsetHeight || 1056;
        
        // Clone the element's HTML
        const html = element.outerHTML;
        
        // Create SVG with foreignObject
        let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"`;
        
        if (options.addViewBox) {
            svg += ` viewBox="0 0 ${width} ${height}"`;
        }
        
        svg += `>
  <foreignObject width="100%" height="100%">
    <div xmlns="http://www.w3.org/1999/xhtml">
      ${html}
    </div>
  </foreignObject>
</svg>`;
        
        return svg;
    }

    /**
     * Convert PPTX to SVG (basic support)
     */
    async convertPPTX(file, options = {}) {
        // Basic PPTX support - extract as images
        throw new Error('PPTX conversion requires additional libraries. Please convert slides to images first.');
    }

    /**
     * Optimize SVG output
     */
    optimizeSVG(svg) {
        // Remove unnecessary whitespace
        svg = svg.replace(/>\s+</g, '><');
        
        // Remove comments
        svg = svg.replace(/<!--[\s\S]*?-->/g, '');
        
        // Remove empty groups
        svg = svg.replace(/<g>\s*<\/g>/g, '');
        
        // Simplify colors
        svg = svg.replace(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/g, (match, r, g, b) => {
            const hex = '#' + [r, g, b].map(x => {
                const hex = parseInt(x).toString(16);
                return hex.length === 1 ? '0' + hex : hex;
            }).join('');
            return hex;
        });
        
        return svg;
    }

    /**
     * Format file size for display
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ATSVGConverter;
}
