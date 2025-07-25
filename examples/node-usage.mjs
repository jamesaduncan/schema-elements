#!/usr/bin/env node

/**
 * Example: Using schema-elements in Node.js
 */

import { parseHTML } from '../index-node.mjs';

// Example 1: Extract microdata from HTML
const html = `
<article itemscope itemtype="https://schema.org/BlogPosting">
    <h1 itemprop="headline">Understanding Microdata</h1>
    <div itemprop="author" itemscope itemtype="https://schema.org/Person">
        <span itemprop="name">Jane Smith</span>
    </div>
    <time itemprop="datePublished" datetime="2024-01-15">January 15, 2024</time>
    <div itemprop="articleBody">
        <p>Microdata provides a way to embed structured data in HTML...</p>
    </div>
</article>
`;

const doc = parseHTML(html);
const article = doc.querySelector('[itemtype*="BlogPosting"]').microdata;
console.log('Article Data:');
console.log('- Headline:', article.headline);
console.log('- Author:', article.author.name);
console.log('- Published:', article.datePublished);
console.log('- Type:', article['@type']);

// Convert to JSON-LD format
console.log('\nAs JSON-LD:');
console.log(JSON.stringify(article, null, 2));