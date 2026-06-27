import { globalExtractorRegistry } from '../Extractor.js';
import { typeScriptExtractor } from './TypeScript.js';
import { javaScriptExtractor } from './JavaScript.js';
import { javaExtractor } from './Java.js';
import { htmlExtractor } from './Html.js';
import { jspExtractor } from './Jsp.js';
import { sightlyExtractor } from './Sightly.js';

globalExtractorRegistry.register(
  typeScriptExtractor,
  javaScriptExtractor,
  javaExtractor,
  htmlExtractor,
  jspExtractor,
  sightlyExtractor,
);
