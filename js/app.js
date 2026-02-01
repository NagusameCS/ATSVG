/**
 * ATSVG Application - Main UI Controller
 */

document.addEventListener('DOMContentLoaded', () => {
    const app = new ATSVGApp();
    app.init();
});

class ATSVGApp {
    constructor() {
        this.converter = new ATSVGConverter();
        this.currentFile = null;
        this.currentSVG = null;
        this.batchFiles = [];
        this.batchResults = [];
        
        // DOM Elements
        this.elements = {
            dropZone: document.getElementById('dropZone'),
            fileInput: document.getElementById('fileInput'),
            settingsPanel: document.getElementById('settingsPanel'),
            settingsContent: document.getElementById('settingsContent'),
            toggleSettings: document.getElementById('toggleSettings'),
            previewArea: document.getElementById('previewArea'),
            originalPreview: document.getElementById('originalPreview'),
            convertedPreview: document.getElementById('convertedPreview'),
            originalImage: document.getElementById('originalImage'),
            svgOutput: document.getElementById('svgOutput'),
            previewContainer: document.getElementById('previewContainer'),
            batchArea: document.getElementById('batchArea'),
            batchList: document.getElementById('batchList'),
            batchCount: document.getElementById('batchCount'),
            progressArea: document.getElementById('progressArea'),
            progressFill: document.getElementById('progressFill'),
            progressText: document.getElementById('progressText'),
            
            // Info
            originalSize: document.getElementById('originalSize'),
            svgSize: document.getElementById('svgSize'),
            dimensions: document.getElementById('dimensions'),
            
            // Buttons
            copyBtn: document.getElementById('copyBtn'),
            copySvgCodeBtn: document.getElementById('copySvgCodeBtn'),
            downloadBtn: document.getElementById('downloadBtn'),
            downloadAllBtn: document.getElementById('downloadAllBtn'),
            convertAllBtn: document.getElementById('convertAllBtn'),
            clearBatchBtn: document.getElementById('clearBatchBtn'),
            
            // Settings
            traceOptions: document.getElementById('traceOptions'),
            embedOptions: document.getElementById('embedOptions'),
            docOptions: document.getElementById('docOptions'),
            bgColorRow: document.getElementById('bgColorRow'),
            sizeInputs: document.getElementById('sizeInputs'),
            whiteTolerance: document.getElementById('whiteTolerance'),
            jpegQualityRow: document.getElementById('jpegQualityRow'),
        };
    }

    init() {
        this.setupEventListeners();
        this.setupSettingsListeners();
        this.loadSettings();
    }

    setupEventListeners() {
        // Drop zone
        this.elements.dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.elements.dropZone.classList.add('drag-over');
        });

        this.elements.dropZone.addEventListener('dragleave', () => {
            this.elements.dropZone.classList.remove('drag-over');
        });

        this.elements.dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            this.elements.dropZone.classList.remove('drag-over');
            this.handleFiles(e.dataTransfer.files);
        });

        this.elements.fileInput.addEventListener('change', (e) => {
            this.handleFiles(e.target.files);
        });

        // Settings toggle
        this.elements.toggleSettings.addEventListener('click', () => {
            this.elements.settingsContent.classList.toggle('collapsed');
            this.elements.toggleSettings.classList.toggle('collapsed');
        });

        // Preview tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                const tab = btn.dataset.tab;
                this.elements.previewContainer.className = 'preview-container';
                
                if (tab === 'original') {
                    this.elements.previewContainer.classList.add('original-only');
                } else if (tab === 'converted') {
                    this.elements.previewContainer.classList.add('converted-only');
                }
            });
        });

        // Action buttons
        this.elements.copyBtn.addEventListener('click', () => this.copySVGToClipboard());
        this.elements.copySvgCodeBtn.addEventListener('click', () => this.copySVGCode());
        this.elements.downloadBtn.addEventListener('click', () => this.downloadSVG());
        this.elements.downloadAllBtn.addEventListener('click', () => this.downloadAllSVGs());
        this.elements.convertAllBtn.addEventListener('click', () => this.convertBatch());
        this.elements.clearBatchBtn.addEventListener('click', () => this.clearBatch());
    }

    setupSettingsListeners() {
        // Conversion mode toggle
        document.querySelectorAll('input[name="conversionMode"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                const isTrace = e.target.value === 'trace';
                this.elements.traceOptions.style.display = isTrace ? 'block' : 'none';
                this.elements.embedOptions.style.display = isTrace ? 'none' : 'block';
                this.updatePreview();
            });
        });

        // Slider value displays
        const sliders = [
            { id: 'colorCount', display: 'colorCountValue' },
            { id: 'threshold', display: 'thresholdValue' },
            { id: 'blurRadius', display: 'blurRadiusValue' },
            { id: 'pathSimplify', display: 'pathSimplifyValue' },
            { id: 'scale', display: 'scaleValue' },
            { id: 'jpegQuality', display: 'jpegQualityValue' },
            { id: 'pdfScale', display: 'pdfScaleValue' },
            { id: 'whiteToleranceValue', display: 'whiteToleranceDisplay' },
        ];

        sliders.forEach(({ id, display }) => {
            const slider = document.getElementById(id);
            const displayEl = document.getElementById(display);
            if (slider && displayEl) {
                slider.addEventListener('input', () => {
                    displayEl.textContent = slider.value;
                    this.debouncePreview();
                });
            }
        });

        // Transparent background toggle
        document.getElementById('transparentBg').addEventListener('change', (e) => {
            this.elements.bgColorRow.style.display = e.target.checked ? 'none' : 'block';
            this.debouncePreview();
        });

        // Custom size toggle
        document.getElementById('customSize').addEventListener('change', (e) => {
            this.elements.sizeInputs.style.display = e.target.checked ? 'block' : 'none';
        });

        // Remove white background toggle
        document.getElementById('removeWhiteBg').addEventListener('change', (e) => {
            this.elements.whiteTolerance.style.display = e.target.checked ? 'block' : 'none';
            this.debouncePreview();
        });

        // Image format toggle
        document.getElementById('imageFormat').addEventListener('change', (e) => {
            this.elements.jpegQualityRow.style.display = 
                (e.target.value === 'jpeg' || e.target.value === 'webp') ? 'block' : 'none';
            this.debouncePreview();
        });

        // All setting changes trigger preview update
        document.querySelectorAll('.setting-group input, .setting-group select').forEach(el => {
            el.addEventListener('change', () => this.debouncePreview());
        });
    }

    debouncePreview() {
        if (this.previewTimeout) {
            clearTimeout(this.previewTimeout);
        }
        this.previewTimeout = setTimeout(() => this.updatePreview(), 300);
    }

    async handleFiles(files) {
        if (files.length === 0) return;

        if (files.length === 1) {
            // Single file
            this.currentFile = files[0];
            await this.processFile(files[0]);
        } else {
            // Multiple files - batch mode
            this.batchFiles = Array.from(files);
            this.showBatchUI();
        }
    }

    async processFile(file) {
        this.showProgress('Preparing conversion...');
        
        try {
            // Show original preview
            await this.showOriginalPreview(file);
            
            // Convert
            this.showProgress('Converting to SVG...');
            const result = await this.converter.convert(file, this.getSettings());
            
            // Handle array result (multiple pages)
            if (Array.isArray(result)) {
                this.batchResults = result;
                this.currentSVG = result[0].svg;
                this.showConvertedPreview(result[0]);
                this.elements.downloadAllBtn.style.display = 'inline-flex';
            } else {
                this.currentSVG = result.svg;
                
                // Optimize if requested
                if (this.getSettings().optimizeSvg) {
                    this.currentSVG = this.converter.optimizeSVG(this.currentSVG);
                }
                
                this.showConvertedPreview(result);
                this.elements.downloadAllBtn.style.display = 'none';
            }
            
            this.hideProgress();
            this.elements.previewArea.style.display = 'block';
            
            // Check for document-specific options
            const fileType = this.converter.getFileType(file);
            this.elements.docOptions.style.display = 
                (fileType === 'pdf' || fileType === 'docx') ? 'block' : 'none';
                
        } catch (error) {
            this.hideProgress();
            this.showToast(error.message, 'error');
            console.error('Conversion error:', error);
        }
    }

    async showOriginalPreview(file) {
        return new Promise((resolve, reject) => {
            if (file.type.startsWith('image/') || file.name.match(/\.(png|jpg|jpeg|webp|gif|bmp|tiff?)$/i)) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    this.elements.originalImage.src = e.target.result;
                    resolve();
                };
                reader.onerror = reject;
                reader.readAsDataURL(file);
            } else {
                // For non-image files, show placeholder
                this.elements.originalImage.src = 'data:image/svg+xml,' + encodeURIComponent(
                    `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
                        <rect fill="#1e293b" width="200" height="200"/>
                        <text x="100" y="90" text-anchor="middle" fill="#94a3b8" font-size="48">📄</text>
                        <text x="100" y="130" text-anchor="middle" fill="#94a3b8" font-size="14">${file.name.split('.').pop().toUpperCase()}</text>
                    </svg>`
                );
                resolve();
            }
        });
    }

    showConvertedPreview(result) {
        this.elements.svgOutput.innerHTML = result.svg;
        
        // Update info
        this.elements.originalSize.textContent = this.converter.formatFileSize(result.originalSize || 0);
        this.elements.svgSize.textContent = this.converter.formatFileSize(new Blob([result.svg]).size);
        this.elements.dimensions.textContent = `${result.width} × ${result.height}px`;
    }

    async updatePreview() {
        if (!this.currentFile) return;
        
        try {
            const result = await this.converter.convert(this.currentFile, this.getSettings());
            
            if (Array.isArray(result)) {
                this.batchResults = result;
                this.currentSVG = result[0].svg;
                this.showConvertedPreview(result[0]);
            } else {
                this.currentSVG = result.svg;
                
                if (this.getSettings().optimizeSvg) {
                    this.currentSVG = this.converter.optimizeSVG(this.currentSVG);
                }
                
                this.showConvertedPreview(result);
            }
        } catch (error) {
            console.error('Preview update error:', error);
        }
    }

    getSettings() {
        return {
            // Conversion mode
            conversionMode: document.querySelector('input[name="conversionMode"]:checked')?.value || 'embed',
            
            // Trace options
            traceMode: document.getElementById('traceMode')?.value || 'color',
            colorCount: parseInt(document.getElementById('colorCount')?.value || 16),
            threshold: parseInt(document.getElementById('threshold')?.value || 128),
            blurRadius: parseInt(document.getElementById('blurRadius')?.value || 0),
            pathSimplify: parseFloat(document.getElementById('pathSimplify')?.value || 1),
            
            // Background
            transparentBg: document.getElementById('transparentBg')?.checked ?? true,
            bgColor: document.getElementById('bgColor')?.value || '#ffffff',
            removeWhiteBg: document.getElementById('removeWhiteBg')?.checked ?? false,
            whiteToleranceValue: parseInt(document.getElementById('whiteToleranceValue')?.value || 20),
            
            // Size
            customSize: document.getElementById('customSize')?.checked ?? false,
            outputWidth: parseInt(document.getElementById('outputWidth')?.value) || null,
            outputHeight: parseInt(document.getElementById('outputHeight')?.value) || null,
            maintainAspect: document.getElementById('maintainAspect')?.checked ?? true,
            scale: parseInt(document.getElementById('scale')?.value || 100),
            
            // Embed options
            imageFormat: document.getElementById('imageFormat')?.value || 'png',
            jpegQuality: parseInt(document.getElementById('jpegQuality')?.value || 92),
            
            // Document options
            pdfPage: parseInt(document.getElementById('pdfPage')?.value || 1),
            allPages: document.getElementById('allPages')?.checked ?? false,
            pdfScale: parseFloat(document.getElementById('pdfScale')?.value || 2),
            
            // Advanced
            optimizeSvg: document.getElementById('optimizeSvg')?.checked ?? true,
            preserveMetadata: document.getElementById('preserveMetadata')?.checked ?? false,
            addViewBox: document.getElementById('addViewBox')?.checked ?? true,
        };
    }

    saveSettings() {
        try {
            localStorage.setItem('atsvg-settings', JSON.stringify(this.getSettings()));
        } catch (e) {
            console.warn('Could not save settings:', e);
        }
    }

    loadSettings() {
        try {
            const saved = localStorage.getItem('atsvg-settings');
            if (saved) {
                const settings = JSON.parse(saved);
                // Apply saved settings to form elements
                Object.entries(settings).forEach(([key, value]) => {
                    const el = document.getElementById(key);
                    if (el) {
                        if (el.type === 'checkbox') {
                            el.checked = value;
                        } else if (el.type === 'radio') {
                            document.querySelector(`input[name="${key}"][value="${value}"]`)?.click();
                        } else {
                            el.value = value;
                        }
                    }
                });
            }
        } catch (e) {
            console.warn('Could not load settings:', e);
        }
    }

    showBatchUI() {
        this.elements.batchArea.style.display = 'block';
        this.elements.batchCount.textContent = `${this.batchFiles.length} files`;
        
        this.elements.batchList.innerHTML = this.batchFiles.map((file, index) => `
            <div class="batch-item" data-index="${index}">
                <span class="batch-item-name">${file.name}</span>
                <span class="batch-item-status pending">Pending</span>
                <button class="batch-item-remove" data-index="${index}">×</button>
            </div>
        `).join('');
        
        // Add remove listeners
        this.elements.batchList.querySelectorAll('.batch-item-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                this.batchFiles.splice(index, 1);
                if (this.batchFiles.length === 0) {
                    this.clearBatch();
                } else {
                    this.showBatchUI();
                }
            });
        });
    }

    async convertBatch() {
        this.batchResults = [];
        const settings = this.getSettings();
        
        for (let i = 0; i < this.batchFiles.length; i++) {
            const file = this.batchFiles[i];
            const item = this.elements.batchList.querySelector(`[data-index="${i}"]`);
            const status = item?.querySelector('.batch-item-status');
            
            if (status) {
                status.textContent = 'Converting...';
                status.className = 'batch-item-status converting';
            }
            
            this.showProgress(`Converting ${i + 1}/${this.batchFiles.length}...`, (i / this.batchFiles.length) * 100);
            
            try {
                const result = await this.converter.convert(file, settings);
                this.batchResults.push({
                    file,
                    result: Array.isArray(result) ? result : [result],
                    success: true
                });
                
                if (status) {
                    status.textContent = 'Done';
                    status.className = 'batch-item-status done';
                }
            } catch (error) {
                this.batchResults.push({
                    file,
                    error: error.message,
                    success: false
                });
                
                if (status) {
                    status.textContent = 'Error';
                    status.className = 'batch-item-status error';
                }
            }
        }
        
        this.hideProgress();
        this.elements.downloadAllBtn.style.display = 'inline-flex';
        this.showToast(`Converted ${this.batchResults.filter(r => r.success).length}/${this.batchFiles.length} files`, 'success');
    }

    clearBatch() {
        this.batchFiles = [];
        this.batchResults = [];
        this.elements.batchArea.style.display = 'none';
        this.elements.batchList.innerHTML = '';
    }

    async copySVGToClipboard() {
        if (!this.currentSVG) return;
        
        try {
            // Create a blob and copy as image
            const blob = new Blob([this.currentSVG], { type: 'image/svg+xml' });
            await navigator.clipboard.write([
                new ClipboardItem({ 'image/svg+xml': blob })
            ]);
            this.showToast('SVG copied to clipboard!', 'success');
        } catch (e) {
            // Fallback to text
            try {
                await navigator.clipboard.writeText(this.currentSVG);
                this.showToast('SVG code copied to clipboard!', 'success');
            } catch (e2) {
                this.showToast('Failed to copy to clipboard', 'error');
            }
        }
    }

    async copySVGCode() {
        if (!this.currentSVG) return;
        
        try {
            await navigator.clipboard.writeText(this.currentSVG);
            this.showToast('SVG code copied to clipboard!', 'success');
        } catch (e) {
            this.showToast('Failed to copy to clipboard', 'error');
        }
    }

    downloadSVG() {
        if (!this.currentSVG || !this.currentFile) return;
        
        const fileName = this.currentFile.name.replace(/\.[^/.]+$/, '') + '.svg';
        this.downloadFile(this.currentSVG, fileName, 'image/svg+xml');
    }

    downloadAllSVGs() {
        if (this.batchResults.length > 0) {
            // Batch mode
            this.batchResults.forEach((item, index) => {
                if (item.success) {
                    item.result.forEach((result, pageIndex) => {
                        const baseName = item.file.name.replace(/\.[^/.]+$/, '');
                        const pageSuffix = item.result.length > 1 ? `-page${pageIndex + 1}` : '';
                        const fileName = `${baseName}${pageSuffix}.svg`;
                        
                        setTimeout(() => {
                            this.downloadFile(result.svg, fileName, 'image/svg+xml');
                        }, index * 100 + pageIndex * 50);
                    });
                }
            });
        } else if (this.batchResults.length === 0 && Array.isArray(this.currentSVG)) {
            // Multiple pages from single file
            this.batchResults.forEach((result, index) => {
                const baseName = this.currentFile.name.replace(/\.[^/.]+$/, '');
                const fileName = `${baseName}-page${index + 1}.svg`;
                
                setTimeout(() => {
                    this.downloadFile(result.svg, fileName, 'image/svg+xml');
                }, index * 100);
            });
        }
    }

    downloadFile(content, fileName, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    showProgress(text, percentage = null) {
        this.elements.progressArea.style.display = 'block';
        this.elements.progressText.textContent = text;
        
        if (percentage !== null) {
            this.elements.progressFill.style.width = `${percentage}%`;
        } else {
            // Indeterminate progress
            this.elements.progressFill.style.width = '100%';
            this.elements.progressFill.style.animation = 'pulse 1.5s infinite';
        }
    }

    hideProgress() {
        this.elements.progressArea.style.display = 'none';
        this.elements.progressFill.style.animation = '';
    }

    showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }
}
