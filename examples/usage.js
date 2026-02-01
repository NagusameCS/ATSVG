/**
 * ATSVG Example Usage
 * 
 * This example demonstrates various ways to use the ATSVG library
 */

import { ATSVGConverter } from 'atsvg';
import fs from 'fs/promises';
import path from 'path';

async function main() {
    // Create converter with default options
    const converter = new ATSVGConverter({
        addViewBox: true,
        jpegQuality: 92
    });

    console.log('ATSVG Example\n');

    // Example 1: Convert PNG with embedding
    console.log('Example 1: Embed conversion');
    try {
        const pngBuffer = await fs.readFile('example.png');
        const result = await converter.convertBuffer(pngBuffer, 'example.png', {
            conversionMode: 'embed',
            transparentBg: true
        });
        await fs.writeFile('example-embed.svg', result.svg);
        console.log(`  ✓ Created example-embed.svg (${result.width}x${result.height})\n`);
    } catch (err) {
        console.log(`  ✗ ${err.message}\n`);
    }

    // Example 2: Convert with tracing
    console.log('Example 2: Trace conversion (vectorization)');
    try {
        const logoBuffer = await fs.readFile('logo.png');
        const result = await converter.convertBuffer(logoBuffer, 'logo.png', {
            conversionMode: 'trace',
            colorCount: 8,
            traceMode: 'color'
        });
        await fs.writeFile('logo-traced.svg', result.svg);
        console.log(`  ✓ Created logo-traced.svg\n`);
    } catch (err) {
        console.log(`  ✗ ${err.message}\n`);
    }

    // Example 3: Remove white background
    console.log('Example 3: Remove white background');
    try {
        const imageBuffer = await fs.readFile('photo.jpg');
        const result = await converter.convertBuffer(imageBuffer, 'photo.jpg', {
            removeWhiteBg: true,
            whiteToleranceValue: 30,
            transparentBg: true
        });
        await fs.writeFile('photo-no-bg.svg', result.svg);
        console.log(`  ✓ Created photo-no-bg.svg\n`);
    } catch (err) {
        console.log(`  ✗ ${err.message}\n`);
    }

    // Example 4: Resize and scale
    console.log('Example 4: Resize image');
    try {
        const imageBuffer = await fs.readFile('large-image.png');
        const result = await converter.convertBuffer(imageBuffer, 'large-image.png', {
            outputWidth: 400,
            maintainAspect: true,
            scale: 100
        });
        await fs.writeFile('resized.svg', result.svg);
        console.log(`  ✓ Created resized.svg (${result.width}x${result.height})\n`);
    } catch (err) {
        console.log(`  ✗ ${err.message}\n`);
    }

    // Example 5: Convert PDF
    console.log('Example 5: Convert PDF');
    try {
        const pdfBuffer = await fs.readFile('document.pdf');
        const results = await converter.convertBuffer(pdfBuffer, 'document.pdf', {
            allPages: true,
            pdfScale: 2
        });
        
        for (const page of results) {
            const outputPath = `document-page-${page.pageNumber}.svg`;
            await fs.writeFile(outputPath, page.svg);
            console.log(`  ✓ Created ${outputPath}`);
        }
        console.log('');
    } catch (err) {
        console.log(`  ✗ ${err.message}\n`);
    }

    // Example 6: Analyze file
    console.log('Example 6: Analyze file');
    try {
        const buffer = await fs.readFile('example.png');
        const info = await converter.analyzeBuffer(buffer, 'example.png');
        console.log('  File analysis:');
        console.log(`    Type: ${info.type}`);
        console.log(`    Dimensions: ${info.width}x${info.height}`);
        console.log(`    Has transparency: ${info.hasTransparency}`);
        console.log(`    Simple image: ${info.isSimple}`);
        console.log('');
    } catch (err) {
        console.log(`  ✗ ${err.message}\n`);
    }

    // Example 7: Batch processing
    console.log('Example 7: Batch processing');
    const files = ['image1.png', 'image2.jpg', 'image3.webp'];
    let converted = 0;
    
    for (const file of files) {
        try {
            const buffer = await fs.readFile(file);
            const result = await converter.convertBuffer(buffer, file);
            const outputPath = file.replace(/\.[^.]+$/, '.svg');
            await fs.writeFile(outputPath, result.svg);
            converted++;
        } catch (err) {
            // Skip files that don't exist
        }
    }
    console.log(`  ✓ Converted ${converted}/${files.length} files\n`);

    console.log('Done!');
}

main().catch(console.error);
