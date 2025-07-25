# Using schema-elements in Node.js

schema-elements now supports Node.js environments through the `index-node.mjs` module.

## Installation

```bash
npm install schema-elements
```

## Usage

```javascript
import { parseHTML } from 'schema-elements/index-node.mjs';

// Parse HTML containing microdata
const html = `
<div itemscope itemtype="https://schema.org/Person">
    <span itemprop="name">John Doe</span>
    <span itemprop="email">john@example.com</span>
</div>`;

// Create a document with microdata support
const doc = parseHTML(html);

// Extract microdata
const person = doc.querySelector('[itemscope]').microdata;

console.log(person.name);    // "John Doe"
console.log(person.email);   // "john@example.com"
console.log(person['@type']); // "Person"
```

## Features

- ✅ Full microdata extraction
- ✅ Live DOM binding (changes to microdata update the DOM)
- ✅ JSON-LD compatible output
- ✅ Schema validation support
- ✅ Template rendering

## Example

See `examples/node-usage.mjs` for a complete working example:

```bash
node examples/node-usage.mjs
```

## Requirements

- Node.js 14+ (ES modules support)
- JSDOM is automatically included as a dependency

## How It Works

The Node.js version:
1. Uses JSDOM to provide a DOM environment
2. Downloads and caches the HTMLTemplate dependency locally
3. Extends JSDOM elements with microdata functionality
4. Provides a `parseHTML()` helper to create microdata-enabled documents

## Known Limitations

- The `document.microdata` collection property is not yet working in parsed documents (use element.microdata instead)
- Performance may be slower than native browser usage due to JSDOM overhead