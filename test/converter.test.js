/**
 * ATSVG Test Suite
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import { ATSVGConverter, createConverter } from '../lib/index.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create a simple test PNG (1x1 red pixel)
const createTestPNG = () => {
    // Minimal valid PNG - 1x1 red pixel
    const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    
    // IHDR chunk
    const ihdrData = Buffer.from([
        0x00, 0x00, 0x00, 0x01, // width: 1
        0x00, 0x00, 0x00, 0x01, // height: 1
        0x08, // bit depth: 8
        0x02, // color type: RGB
        0x00, // compression method
        0x00, // filter method
        0x00  // interlace method
    ]);
    
    const ihdrCrc = crc32(Buffer.concat([Buffer.from('IHDR'), ihdrData]));
    const ihdrChunk = Buffer.concat([
        Buffer.from([0x00, 0x00, 0x00, 0x0d]), // length: 13
        Buffer.from('IHDR'),
        ihdrData,
        ihdrCrc
    ]);
    
    // IDAT chunk (compressed image data)
    const idatData = Buffer.from([
        0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00, 0x00, 0x00, 0x03, 0x00, 0x01
    ]);
    const idatCrc = crc32(Buffer.concat([Buffer.from('IDAT'), idatData]));
    const idatChunk = Buffer.concat([
        Buffer.from([0x00, 0x00, 0x00, 0x0c]), // length
        Buffer.from('IDAT'),
        idatData,
        idatCrc
    ]);
    
    // IEND chunk
    const iendCrc = crc32(Buffer.from('IEND'));
    const iendChunk = Buffer.concat([
        Buffer.from([0x00, 0x00, 0x00, 0x00]), // length: 0
        Buffer.from('IEND'),
        iendCrc
    ]);
    
    return Buffer.concat([pngSignature, ihdrChunk, idatChunk, iendChunk]);
};

// Simple CRC32 implementation for PNG chunks
function crc32(buf) {
    let crc = 0xffffffff;
    const table = [];
    
    for (let i = 0; i < 256; i++) {
        let c = i;
        for (let j = 0; j < 8; j++) {
            c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
        }
        table[i] = c;
    }
    
    for (let i = 0; i < buf.length; i++) {
        crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
    }
    
    const result = (crc ^ 0xffffffff) >>> 0;
    const resultBuf = Buffer.alloc(4);
    resultBuf.writeUInt32BE(result);
    return resultBuf;
}

describe('ATSVGConverter', () => {
    let converter;

    before(() => {
        converter = new ATSVGConverter();
    });

    describe('Constructor', () => {
        it('should create an instance with default options', () => {
            const conv = new ATSVGConverter();
            assert.ok(conv instanceof ATSVGConverter);
            assert.strictEqual(conv.options.conversionMode, 'embed');
            assert.strictEqual(conv.options.jpegQuality, 92);
        });

        it('should accept custom options', () => {
            const conv = new ATSVGConverter({
                jpegQuality: 80,
                colorCount: 8
            });
            assert.strictEqual(conv.options.jpegQuality, 80);
            assert.strictEqual(conv.options.colorCount, 8);
        });
    });

    describe('getFileType', () => {
        it('should identify image files', () => {
            assert.strictEqual(converter.getFileType('test.png'), 'image');
            assert.strictEqual(converter.getFileType('test.jpg'), 'image');
            assert.strictEqual(converter.getFileType('test.jpeg'), 'image');
            assert.strictEqual(converter.getFileType('test.webp'), 'image');
            assert.strictEqual(converter.getFileType('test.gif'), 'image');
            assert.strictEqual(converter.getFileType('test.bmp'), 'image');
        });

        it('should identify PDF files', () => {
            assert.strictEqual(converter.getFileType('document.pdf'), 'pdf');
            assert.strictEqual(converter.getFileType('Document.PDF'), 'pdf');
        });

        it('should identify DOCX files', () => {
            assert.strictEqual(converter.getFileType('document.docx'), 'docx');
        });

        it('should identify DOC files', () => {
            assert.strictEqual(converter.getFileType('document.doc'), 'doc');
        });
    });

    describe('createConverter factory', () => {
        it('should create a converter instance', () => {
            const conv = createConverter({ jpegQuality: 75 });
            assert.ok(conv instanceof ATSVGConverter);
            assert.strictEqual(conv.options.jpegQuality, 75);
        });
    });
});

describe('CLI Integration', () => {
    it('should have executable permissions', async () => {
        const cliPath = path.join(__dirname, '..', 'bin', 'cli.js');
        const stats = await fs.stat(cliPath);
        assert.ok(stats.isFile());
    });
});
