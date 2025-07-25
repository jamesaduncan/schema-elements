/**
 * Node.js version of schema-elements with JSDOM support
 */

import { JSDOM } from 'jsdom';
import { readFileSync, writeFileSync, unlinkSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Global DOM for library initialization
const globalDom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url: 'http://localhost',
    pretendToBeVisual: true,
    resources: 'usable'
});

// Set up globals
const { window } = globalDom;
global.window = window;
global.document = window.document;
global.Document = window.Document;
global.Element = window.Element;
global.HTMLElement = window.HTMLElement;
global.HTMLTemplateElement = window.HTMLTemplateElement;
global.HTMLFormElement = window.HTMLFormElement;
global.HTMLBodyElement = window.HTMLBodyElement;
global.Node = window.Node;
global.NodeList = window.NodeList;
global.HTMLCollection = window.HTMLCollection;
global.Event = window.Event;
global.CustomEvent = window.CustomEvent;
global.MutationObserver = window.MutationObserver;
global.DOMParser = window.DOMParser;
global.NodeFilter = window.NodeFilter;

// Read and modify the main library file
const libPath = join(__dirname, 'index.mjs');
let libContent = readFileSync(libPath, 'utf8');

// Replace the HTTP import with local import
libContent = libContent.replace(
    `import { HTMLTemplate } from 'https://jamesaduncan.github.io/html-template/index.mjs';`,
    `import { HTMLTemplate } from './lib/html-template.mjs';`
);

// Write the modified content and import
const tempPath = join(__dirname, `index-node-temp-${Date.now()}.mjs`);
writeFileSync(tempPath, libContent);

const moduleUrl = pathToFileURL(tempPath).href;
const { Microdata, Schema, Template, MicrodataItem, MicrodataCollection } = await import(moduleUrl);

// Clean up temp file
unlinkSync(tempPath);

// Store reference to the JSDOM constructors that have microdata functionality
const MicrodataHTMLElement = global.HTMLElement;
const MicrodataDocument = global.Document;

// Helper for parsing HTML in Node.js
export function parseHTML(html) {
    // Create new JSDOM but copy the microdata-enhanced prototypes
    const newDom = new JSDOM(html, {
        url: 'http://localhost',
        pretendToBeVisual: true,
        resources: 'usable'
    });
    
    const newDoc = newDom.window.document;
    
    // Copy microdata property from the initialized prototype
    const microdataDescriptor = Object.getOwnPropertyDescriptor(MicrodataHTMLElement.prototype, 'microdata');
    if (microdataDescriptor) {
        Object.defineProperty(newDom.window.HTMLElement.prototype, 'microdata', microdataDescriptor);
    }
    
    // Also copy to Element prototype if it exists there
    const elementMicrodataDescriptor = Object.getOwnPropertyDescriptor(global.Element.prototype, 'microdata');
    if (elementMicrodataDescriptor) {
        Object.defineProperty(newDom.window.Element.prototype, 'microdata', elementMicrodataDescriptor);
    }
    
    // Copy document microdata property
    const docMicrodataDescriptor = Object.getOwnPropertyDescriptor(MicrodataDocument.prototype, 'microdata');
    if (docMicrodataDescriptor) {
        Object.defineProperty(newDom.window.Document.prototype, 'microdata', docMicrodataDescriptor);
    }
    
    // Also copy body microdata if it exists
    const bodyMicrodataDescriptor = Object.getOwnPropertyDescriptor(global.HTMLBodyElement?.prototype || {}, 'microdata');
    if (bodyMicrodataDescriptor && newDom.window.HTMLBodyElement) {
        Object.defineProperty(newDom.window.HTMLBodyElement.prototype, 'microdata', bodyMicrodataDescriptor);
    }
    
    // Ensure document.microdata works by directly defining it
    Object.defineProperty(newDoc, 'microdata', {
        get() {
            return this.body ? this.body.microdata : [];
        },
        configurable: true
    });
    
    return newDoc;
}

// Export main APIs
const dom = globalDom;
const document = global.document;

export {
    Microdata,
    Schema,
    Template,
    MicrodataItem,
    MicrodataCollection,
    dom,
    window,
    document
};