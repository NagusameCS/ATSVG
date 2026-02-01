#!/usr/bin/env node

/**
 * ATSVG CLI - Command Line Interface
 * Convert any visual file to SVG from the command line
 */

import { program } from 'commander';
import { glob } from 'glob';
import fs from 'fs/promises';
import path from 'path';
import ora from 'ora';
import pc from 'picocolors';
import { ATSVGConverter } from '../lib/index.js';

const VERSION = '1.0.0';

// ASCII Art Banner
const banner = `
   ___  ______________   ______
  / _ |/_  __/ __/ | / / ____/
 / __ | / / _\\ \\| |/ / / __  
/_/ |_|/_/ /___/|___/_/  \\___/
                              
${pc.dim('All-To-SVG Converter v' + VERSION)}
`;

program
    .name('atsvg')
    .description('Convert any visual file type to SVG')
    .version(VERSION)
    .addHelpText('before', banner);

// Main convert command
program
    .command('convert <input...>')
    .alias('c')
    .description('Convert file(s) to SVG')
    .option('-o, --output <path>', 'Output directory or file path', '.')
    .option('-m, --mode <mode>', 'Conversion mode: embed, trace', 'embed')
    .option('-q, --quality <number>', 'JPEG quality (1-100)', '92')
    .option('-s, --scale <number>', 'Scale percentage (1-500)', '100')
    .option('-c, --colors <number>', 'Number of colors for tracing (2-256)', '16')
    .option('-t, --trace-mode <mode>', 'Trace mode: color, grayscale, monochrome, posterize', 'color')
    .option('--transparent', 'Enable transparent background', false)
    .option('--remove-white', 'Remove white background', false)
    .option('--white-tolerance <number>', 'White background removal tolerance (0-255)', '20')
    .option('--blur <number>', 'Blur radius for tracing (0-5)', '0')
    .option('--simplify <number>', 'Path simplification (0.1-10)', '1')
    .option('--threshold <number>', 'Threshold for monochrome (0-255)', '128')
    .option('-w, --width <number>', 'Output width in pixels')
    .option('-h, --height <number>', 'Output height in pixels')
    .option('--no-aspect', 'Do not maintain aspect ratio when resizing')
    .option('--viewbox', 'Add viewBox attribute to SVG', false)
    .option('--pdf-page <number>', 'PDF page to convert (default: 1)', '1')
    .option('--pdf-all', 'Convert all PDF pages', false)
    .option('--pdf-scale <number>', 'PDF rendering scale (0.5-4)', '2')
    .option('-f, --format <format>', 'Embedded image format: png, jpeg, webp', 'png')
    .option('--overwrite', 'Overwrite existing files', false)
    .option('--silent', 'Suppress output messages', false)
    .option('--dry-run', 'Show what would be converted without actually converting', false)
    .action(async (inputs, opts) => {
        await convertFiles(inputs, opts);
    });

// Batch convert command with glob support
program
    .command('batch <pattern>')
    .alias('b')
    .description('Batch convert files matching a glob pattern')
    .option('-o, --output <path>', 'Output directory', '.')
    .option('-m, --mode <mode>', 'Conversion mode: embed, trace', 'embed')
    .option('-q, --quality <number>', 'JPEG quality (1-100)', '92')
    .option('-s, --scale <number>', 'Scale percentage (1-500)', '100')
    .option('-c, --colors <number>', 'Number of colors for tracing (2-256)', '16')
    .option('-t, --trace-mode <mode>', 'Trace mode: color, grayscale, monochrome, posterize', 'color')
    .option('--transparent', 'Enable transparent background', false)
    .option('--remove-white', 'Remove white background', false)
    .option('--recursive', 'Search directories recursively', false)
    .option('--overwrite', 'Overwrite existing files', false)
    .option('--silent', 'Suppress output messages', false)
    .option('--concurrency <number>', 'Number of concurrent conversions', '4')
    .action(async (pattern, opts) => {
        const files = await glob(pattern, {
            nodir: true,
            absolute: true,
            dot: false
        });

        if (files.length === 0) {
            console.log(pc.yellow('No files matched the pattern: ' + pattern));
            return;
        }

        console.log(pc.cyan(`Found ${files.length} file(s) matching pattern`));
        await convertFiles(files, opts);
    });

// Info command to show supported formats
program
    .command('info')
    .alias('i')
    .description('Show supported formats and options')
    .action(() => {
        console.log(banner);
        console.log(pc.bold('\nSupported Input Formats:\n'));
        console.log(pc.green('  Images:   ') + 'PNG, JPEG, JPG, WebP, GIF, BMP, TIFF, AVIF, HEIC');
        console.log(pc.green('  Documents:') + ' PDF, DOCX');
        console.log(pc.green('  Other:    ') + 'Any format supported by Sharp\n');
        
        console.log(pc.bold('Conversion Modes:\n'));
        console.log(pc.cyan('  embed') + '     - Embeds the image as base64 in the SVG (default)');
        console.log(pc.cyan('  trace') + '     - Traces the image to create true vector paths\n');
        
        console.log(pc.bold('Trace Modes:\n'));
        console.log(pc.cyan('  color') + '     - Full color tracing');
        console.log(pc.cyan('  grayscale') + ' - Grayscale tracing');
        console.log(pc.cyan('  monochrome') + '- Black and white tracing');
        console.log(pc.cyan('  posterize') + ' - Limited color palette\n');
        
        console.log(pc.bold('Examples:\n'));
        console.log(pc.dim('  # Convert a single file'));
        console.log('  $ atsvg convert image.png -o output.svg\n');
        console.log(pc.dim('  # Convert with tracing'));
        console.log('  $ atsvg convert image.png -m trace -c 8\n');
        console.log(pc.dim('  # Batch convert all PNGs'));
        console.log('  $ atsvg batch "*.png" -o ./svg-output\n');
        console.log(pc.dim('  # Convert PDF (all pages)'));
        console.log('  $ atsvg convert document.pdf --pdf-all -o ./pages\n');
        console.log(pc.dim('  # Remove white background'));
        console.log('  $ atsvg convert logo.png --remove-white --transparent\n');
    });

// Analyze command
program
    .command('analyze <input>')
    .alias('a')
    .description('Analyze a file and show conversion recommendations')
    .action(async (input) => {
        const spinner = ora('Analyzing file...').start();
        
        try {
            const converter = new ATSVGConverter();
            const absolutePath = path.resolve(input);
            const stats = await fs.stat(absolutePath);
            const buffer = await fs.readFile(absolutePath);
            const info = await converter.analyzeBuffer(buffer, path.basename(input));
            
            spinner.stop();
            console.log(pc.bold('\nFile Analysis:\n'));
            console.log(pc.cyan('  File:       ') + path.basename(input));
            console.log(pc.cyan('  Size:       ') + formatBytes(stats.size));
            console.log(pc.cyan('  Type:       ') + info.type);
            
            if (info.width && info.height) {
                console.log(pc.cyan('  Dimensions: ') + `${info.width} × ${info.height} pixels`);
            }
            
            if (info.pages) {
                console.log(pc.cyan('  Pages:      ') + info.pages);
            }
            
            console.log(pc.bold('\nRecommendations:\n'));
            
            if (info.type === 'image') {
                if (info.hasTransparency) {
                    console.log(pc.green('  ✓ ') + 'Image has transparency - use PNG format for embedding');
                }
                if (info.isSimple) {
                    console.log(pc.green('  ✓ ') + 'Simple image detected - tracing recommended');
                    console.log(pc.dim('    atsvg convert ' + input + ' -m trace'));
                } else {
                    console.log(pc.yellow('  ⚠ ') + 'Complex image - embedding recommended for quality');
                    console.log(pc.dim('    atsvg convert ' + input + ' -m embed'));
                }
            } else if (info.type === 'pdf') {
                console.log(pc.green('  ✓ ') + 'Use --pdf-scale 2 or higher for better quality');
                if (info.pages > 1) {
                    console.log(pc.green('  ✓ ') + 'Multiple pages - use --pdf-all to convert all');
                }
            }
            
            console.log('');
        } catch (error) {
            spinner.fail(pc.red('Analysis failed: ' + error.message));
            process.exit(1);
        }
    });

// Main conversion function
async function convertFiles(inputs, opts) {
    const converter = new ATSVGConverter();
    const spinner = ora();
    let successCount = 0;
    let failCount = 0;
    
    // Parse options
    const options = {
        conversionMode: opts.mode || 'embed',
        jpegQuality: parseInt(opts.quality) || 92,
        scale: parseInt(opts.scale) || 100,
        colorCount: parseInt(opts.colors) || 16,
        traceMode: opts.traceMode || 'color',
        transparentBg: opts.transparent || false,
        removeWhiteBg: opts.removeWhite || false,
        whiteToleranceValue: parseInt(opts.whiteTolerance) || 20,
        blurRadius: parseFloat(opts.blur) || 0,
        pathSimplify: parseFloat(opts.simplify) || 1,
        threshold: parseInt(opts.threshold) || 128,
        outputWidth: opts.width ? parseInt(opts.width) : null,
        outputHeight: opts.height ? parseInt(opts.height) : null,
        maintainAspect: opts.aspect !== false,
        addViewBox: opts.viewbox || false,
        imageFormat: opts.format || 'png',
        pdfPage: parseInt(opts.pdfPage) || 1,
        pdfScale: parseFloat(opts.pdfScale) || 2,
        allPages: opts.pdfAll || false
    };

    if (!opts.silent) {
        console.log(banner);
        console.log(pc.cyan(`Converting ${inputs.length} file(s)...\n`));
    }

    for (const input of inputs) {
        const absolutePath = path.resolve(input);
        const baseName = path.basename(input, path.extname(input));
        
        // Determine output path
        let outputPath;
        if (inputs.length === 1 && opts.output && !opts.output.endsWith('/') && opts.output !== '.') {
            // Single file with specific output name
            outputPath = path.resolve(opts.output);
            if (!outputPath.endsWith('.svg')) {
                outputPath += '.svg';
            }
        } else {
            // Multiple files or directory output
            const outputDir = path.resolve(opts.output || '.');
            outputPath = path.join(outputDir, baseName + '.svg');
        }

        if (opts.dryRun) {
            console.log(pc.dim(`Would convert: ${input} → ${outputPath}`));
            continue;
        }

        if (!opts.silent) {
            spinner.start(`Converting ${pc.cyan(path.basename(input))}...`);
        }

        try {
            // Check if input exists
            await fs.access(absolutePath);
            
            // Check if output exists and overwrite is disabled
            if (!opts.overwrite) {
                try {
                    await fs.access(outputPath);
                    throw new Error(`Output file already exists: ${outputPath}. Use --overwrite to replace.`);
                } catch (e) {
                    if (e.code !== 'ENOENT') throw e;
                }
            }

            // Read file and convert
            const buffer = await fs.readFile(absolutePath);
            const result = await converter.convertBuffer(buffer, path.basename(input), options);
            
            // Handle multi-page results (PDF)
            if (Array.isArray(result)) {
                const outputDir = path.dirname(outputPath);
                await fs.mkdir(outputDir, { recursive: true });
                
                for (const pageResult of result) {
                    const pageOutputPath = path.join(
                        outputDir,
                        `${baseName}_page${pageResult.pageNumber}.svg`
                    );
                    await fs.writeFile(pageOutputPath, pageResult.svg, 'utf-8');
                }
                
                if (!opts.silent) {
                    spinner.succeed(
                        `Converted ${pc.cyan(path.basename(input))} → ${pc.green(result.length + ' pages')}`
                    );
                }
            } else {
                // Ensure output directory exists
                await fs.mkdir(path.dirname(outputPath), { recursive: true });
                
                // Write SVG
                await fs.writeFile(outputPath, result.svg, 'utf-8');
                
                if (!opts.silent) {
                    const savedBytes = result.originalSize ? 
                        ` (${formatBytes(result.originalSize)} → ${formatBytes(result.svg.length)})` : '';
                    spinner.succeed(
                        `Converted ${pc.cyan(path.basename(input))} → ${pc.green(path.basename(outputPath))}${pc.dim(savedBytes)}`
                    );
                }
            }
            
            successCount++;
        } catch (error) {
            failCount++;
            if (!opts.silent) {
                spinner.fail(`Failed to convert ${pc.cyan(path.basename(input))}: ${pc.red(error.message)}`);
            }
        }
    }

    if (!opts.silent && inputs.length > 1) {
        console.log('');
        console.log(pc.bold('Summary:'));
        console.log(pc.green(`  ✓ ${successCount} succeeded`));
        if (failCount > 0) {
            console.log(pc.red(`  ✗ ${failCount} failed`));
        }
    }

    if (failCount > 0) {
        process.exit(1);
    }
}

// Utility function for formatting bytes
function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Run the CLI
program.parse();
