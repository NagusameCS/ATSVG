/**
 * ATSVG - CommonJS Entry Point
 * Wrapper for environments that don't support ES modules
 */

'use strict';

const ATSVGConverter = require('./index.js').ATSVGConverter;
const createConverter = require('./index.js').createConverter;

module.exports = ATSVGConverter;
module.exports.ATSVGConverter = ATSVGConverter;
module.exports.createConverter = createConverter;
module.exports.default = ATSVGConverter;
