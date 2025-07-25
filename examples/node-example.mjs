/**
 * Simple example of using schema-elements in the browser
 */

// This library is designed for browser usage
// For Node.js usage, see README-NODE.md

// Example HTML (would be in your HTML file)
const exampleHTML = `
<article itemscope itemtype="https://schema.org/BlogPosting">
    <h1 itemprop="headline">My First Blog Post</h1>
    <div itemprop="author" itemscope itemtype="https://schema.org/Person">
        <span itemprop="name">Jane Doe</span>
    </div>
    <time itemprop="datePublished" datetime="2024-01-01">January 1, 2024</time>
    <div itemprop="articleBody">
        <p>This is the content of my blog post...</p>
    </div>
</article>
`;

// In browser JavaScript:
// import { Microdata } from './index.mjs';

// Extract microdata from the DOM
// const article = document.querySelector('[itemtype*="BlogPosting"]').microdata;

// Access the data
// console.log('Article headline:', article.headline);
// console.log('Author name:', article.author.name);
// console.log('Date published:', article.datePublished);

// Convert to JSON
// console.log('\nAs JSON:');
// console.log(JSON.stringify(article, null, 2));

console.log('This example shows browser usage. See README-NODE.md for Node.js usage.');