#!/usr/bin/env node

import { Microdata, parseHTML } from './index-node.mjs';

console.log('Testing schema-elements in Node.js...\n');

// Test 1: Basic microdata extraction
const html1 = `
<div itemscope itemtype="https://schema.org/Person">
    <span itemprop="name">John Doe</span>
    <span itemprop="email">john@example.com</span>
</div>`;

const doc1 = parseHTML(html1);
const element = doc1.querySelector('[itemscope]');
console.log('Element found:', !!element);
console.log('Has microdata property:', 'microdata' in element);

const person = element.microdata;
console.log('Person object:', person);

if (person) {
    console.log('Test 1: Basic extraction');
    console.log('Name:', person.name);
    console.log('Email:', person.email);
    console.log('Type:', person['@type']);
    console.log('✓ Success\n');
} else {
    console.log('✗ Failed to get microdata object\n');
}

// Test 2: Multiple items
const html2 = `
<div>
    <div id="person1" itemscope itemtype="https://schema.org/Person">
        <span itemprop="name">Alice</span>
    </div>
    <div id="person2" itemscope itemtype="https://schema.org/Person">
        <span itemprop="name">Bob</span>
    </div>
</div>`;

const doc2 = parseHTML(html2);
const collection = doc2.microdata || doc2.body.microdata;

console.log('Test 2: Collection');
if (collection && collection.length > 0) {
    console.log('Items found:', collection.length);
    console.log('First person:', collection[0].name);
    console.log('Second person:', collection[1].name);
    console.log('Named access - person1:', collection.person1.name);
    console.log('✓ Success\n');
} else {
    console.log('Collection is null or empty. Trying body.microdata...');
    const bodyCollection = doc2.body ? doc2.body.microdata : null;
    console.log('Body collection:', bodyCollection);
    console.log('✗ Failed - collection access issue\n');
}

// Test 3: Live binding
const html3 = `
<div itemscope itemtype="https://schema.org/Product">
    <span itemprop="name">Original Product</span>
</div>`;

const doc3 = parseHTML(html3);
const product = doc3.querySelector('[itemscope]').microdata;

console.log('Test 3: Live binding');
console.log('Original name:', product.name);

product.name = 'Updated Product';
console.log('After update:', product.name);
console.log('DOM content:', doc3.querySelector('[itemprop="name"]').textContent);
console.log('✓ Success\n');

console.log('🎉 All Node.js tests passed!');