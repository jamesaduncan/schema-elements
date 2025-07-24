# SchemaElements - Live Microdata API for JavaScript

SchemaElements is a vanilla JavaScript library that transforms HTML microdata into a live, reactive data layer. It provides seamless two-way data binding between the DOM and JavaScript objects, automatic schema validation, template rendering, and remote data fetching - all without any dependencies.

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Core Concepts](#core-concepts)
- [API Reference](#api-reference)
- [Advanced Usage](#advanced-usage)
- [Schema Support](#schema-support)
- [Events](#events)
- [Browser Compatibility](#browser-compatibility)
- [Examples](#examples)
- [License](#license)

## Features

### 🔄 Live Data Binding
Access and modify microdata through `document.microdata` with automatic DOM synchronization. Changes to JavaScript objects instantly update the DOM, and DOM mutations are reflected in the JavaScript layer.

### 📋 Template System
Powerful template rendering with auto-synchronization using the [html-template](https://jamesaduncan.github.io/html-template/) library. Templates automatically update when data changes, support array repetition with `[]` syntax, and can render from multiple data sources.

### 🌐 Remote Data Fetching
Fetch microdata from external URLs, supporting both JSON-LD and HTML with embedded microdata. Individual microdata items can fetch their referenced remote counterparts through the `fetch()` method.

### ✅ Schema Validation
Built-in support for Schema.org and custom schema validation. Ensures data integrity with type checking, cardinality validation, and custom validation rules.

### 🎯 Form Integration
Extract data from HTML forms and render to templates. Supports all standard form controls with automatic type conversion.

### 🔍 Advanced Querying
Full array support with push, pop, splice operations. Iterator protocol support for easy data traversal. Named and indexed access to microdata items.

## Installation

### Via GitHub Pages
```html
<script type="module">
  import { Microdata, Schema, Template } from 'https://jamesaduncan.github.io/schema-elements/index.mjs';
</script>
```

### Dependencies
The Template system uses the external [html-template](https://jamesaduncan.github.io/html-template/) library for rendering. This dependency is automatically imported when using the Template class.

### Local Installation
```html
<script type="module" src="./index.mjs"></script>
```

## Quick Start

### 1. Add Microdata to Your HTML
```html
<div id="person" itemscope itemtype="https://schema.org/Person">
  <h1 itemprop="name">John Doe</h1>
  <p itemprop="email">john@example.com</p>
  <span itemprop="jobTitle">Software Engineer</span>
</div>
```

### 2. Access and Modify Data
```javascript
// Access microdata
const person = document.microdata.person;
console.log(person.name); // "John Doe"

// Modify data - DOM updates automatically
person.name = "Jane Doe";
person.email = "jane@example.com";

// Add new properties
person.telephone = "555-1234";
```

### 3. Use Templates for Dynamic Content
```html
<div data-contains="https://schema.org/Person">
  <template itemscope itemtype="https://schema.org/Person">
    <div class="person-card">
      <h3 itemprop="name"></h3>
      <p>Email: <span itemprop="email"></span></p>
      <p>Phone: <span itemprop="telephone"></span></p>
    </div>
  </template>
</div>
```

## Core Concepts

### MicrodataItem
Each element with `itemscope` becomes a MicrodataItem - a proxy object that provides:
- Direct property access (`item.propertyName`)
- Automatic DOM synchronization
- JSON-LD metadata (`@type`, `@context`, `@id`)
- Schema validation
- Event notifications

### MicrodataCollection
The `document.microdata` object is a hybrid array/object that allows:
- Numeric indexing for items without IDs
- Named access for items with IDs
- Full array method support (forEach, map, filter)
- Iterator protocol support

### Live Synchronization
Two-way data binding ensures:
- JavaScript changes update the DOM immediately
- DOM mutations update JavaScript objects
- Multiple views stay synchronized
- No manual DOM manipulation needed

## API Reference

### document.microdata

The main entry point for accessing all microdata in the document.

#### Accessing Items

```javascript
// By ID (for elements with id attribute)
const company = document.microdata.company;

// By index (for elements without id)
const firstItem = document.microdata[0];

// Check if item exists
if ('company' in document.microdata) {
  // Item exists
}
```

#### Collection Methods

```javascript
// Iterate with forEach
document.microdata.forEach((item, key) => {
  console.log(key, item['@type'], item);
});

// Use for...of loop
for (const item of document.microdata) {
  console.log(item);
}

// Filter items
const people = document.microdata.filter(item => 
  item['@type'] === 'Person'
);

// Map to extract data
const names = document.microdata.map(item => item.name);
```

### Element.microdata

Access microdata for any element with `itemscope`:

```javascript
const element = document.querySelector('[itemscope]');
const item = element.microdata;
```

### MicrodataItem Properties

#### Standard Properties
```javascript
const person = document.microdata.person;

// Access properties
console.log(person.name);        // Get property value
person.name = "New Name";        // Set property value

// Array properties
person.skills.push("JavaScript"); // Add to array
person.skills[0] = "TypeScript"; // Modify array item

// Check property existence
if ('email' in person) {
  console.log(person.email);
}
```

#### Special Properties
```javascript
// JSON-LD metadata
console.log(person['@type']);    // "Person"
console.log(person['@context']); // "https://schema.org/"
console.log(person['@id']);      // "#person"

// Access DOM element
const element = person._element;
```

### Static Methods

#### Microdata.fetch(url, options?)
Fetch microdata from a URL:

```javascript
// Fetch from same origin
const data = await Microdata.fetch('./data.html#person');

// With options
const items = await Microdata.fetch('https://example.com/data.html', {
  expectedType: 'https://schema.org/Person'
});
```

#### Schema.load(url)
Load and cache a schema:

```javascript
const schema = await Schema.load('https://schema.org/Person');
if (schema.validate(person)) {
  console.log('Valid person data');
}
```

#### Schema.clearCache()
Clear the schema cache (useful for testing):

```javascript
Schema.clearCache();
```

#### Microdata.clearFetchCache()
Clear the fetched document cache (useful for testing):

```javascript
Microdata.clearFetchCache();
```

#### Template.render(data, templateSelector?)
Render data to a template:

```javascript
// Using a specific template
const rendered = Template.render(person, '#person-template');

// Auto-select template by type
const rendered = Template.render(person);

// Render plain object
const rendered = Template.render({
  '@type': 'https://schema.org/Person',
  name: 'John Doe',
  email: 'john@example.com'
});
```

### Instance Methods

#### item.validate()
Validate an item against its schema:

```javascript
const person = document.microdata.person;
if (person.validate()) {
  console.log('Person data is valid');
} else {
  console.log('Validation failed');
}
```

#### item.toJSON()
Convert to JSON-LD format:

```javascript
const jsonld = JSON.stringify(person);
// {
//   "@context": "https://schema.org/",
//   "@type": "Person",
//   "@id": "#person",
//   "name": "John Doe",
//   "email": "john@example.com"
// }
```

#### item.fetch()
Fetch the microdata element this item references. Returns a Promise that resolves to an Element.

```javascript
// For authoritative items (with id attribute)
const person = document.microdata.person;
const element = await person.fetch();
// Returns the same element (document.getElementById('person'))

// For non-authoritative items (with itemid attribute)
// <meta itemscope itemtype="https://schema.org/Person" itemid="https://example.com/data.html#person1">
const meta = document.querySelector('meta[itemid]');
const remotePerson = await meta.microdata.fetch();
// Fetches https://example.com/data.html and returns the element with id="person1"
console.log(remotePerson.microdata.name); // Access remote microdata

// Error cases:
try {
  // Missing itemid on non-authoritative item
  await nonAuthItem.fetch();
} catch (e) {
  // Error: Non-authoritative item must have itemid attribute to fetch
}

try {
  // Invalid URL in itemid
  // <meta itemscope itemtype="..." itemid="http://[invalid]:port/path">
  await invalidUrlItem.fetch();
} catch (e) {
  // Error: Invalid itemid URL: http://[invalid]:port/path
}

try {
  // Missing fragment identifier
  // <meta itemscope itemtype="..." itemid="https://example.com/data.html">
  await noFragmentItem.fetch();
} catch (e) {
  // Error: itemid must include a fragment identifier (#id)
}

try {
  // Element not found in remote document
  // <meta itemscope itemtype="..." itemid="https://example.com/data.html#nonexistent">
  await notFoundItem.fetch();
} catch (e) {
  // Error: Element with id "nonexistent" not found in https://example.com/data.html
}

// Caching
// Fetched documents are cached to avoid repeated network requests
// Clear the cache when needed:
Microdata.clearFetchCache();
```

## Advanced Usage

### Working with Arrays

```html
<div id="company" itemscope itemtype="https://schema.org/Organization">
  <h2 itemprop="name">Tech Corp</h2>
  <ul>
    <li itemprop="employee" itemscope itemtype="https://schema.org/Person">
      <span itemprop="name">Alice</span>
    </li>
    <li itemprop="employee" itemscope itemtype="https://schema.org/Person">
      <span itemprop="name">Bob</span>
    </li>
  </ul>
</div>
```

```javascript
const company = document.microdata.company;
const employees = company.employee; // Array of employees

// Add new employee
employees.push({
  '@type': 'https://schema.org/Person',
  name: 'Charlie',
  email: 'charlie@example.com'
});

// Remove employee
employees.splice(1, 1); // Remove Bob

// Modify employee
employees[0].name = 'Alice Smith';
```

### Template Auto-Synchronization

Templates with `data-contains` automatically sync with matching microdata:

```html
<!-- Template container -->
<div id="employee-list" data-contains="https://schema.org/Person">
  <template itemscope itemtype="https://schema.org/Person">
    <div class="employee-card">
      <h3 itemprop="name"></h3>
      <p itemprop="email"></p>
      <p itemprop="jobTitle"></p>
    </div>
  </template>
</div>

<!-- Source data (can be hidden) -->
<div style="display: none">
  <div id="emp1" itemscope itemtype="https://schema.org/Person">
    <span itemprop="name">Alice</span>
    <span itemprop="email">alice@example.com</span>
    <span itemprop="jobTitle">Developer</span>
  </div>
</div>
```

The template automatically renders for each matching item and updates when data changes.

### Form Integration

Extract and render form data:

```html
<form id="person-form">
  <input name="name" type="text" placeholder="Name" required>
  <input name="email" type="email" placeholder="Email" required>
  <select name="jobTitle">
    <option value="Developer">Developer</option>
    <option value="Designer">Designer</option>
    <option value="Manager">Manager</option>
  </select>
  <button type="submit">Save</button>
</form>

<template id="person-display" itemscope itemtype="https://schema.org/Person">
  <div class="person-info">
    <h3 itemprop="name"></h3>
    <p>Email: <span itemprop="email"></span></p>
    <p>Role: <span itemprop="jobTitle"></span></p>
  </div>
</template>
```

```javascript
const form = document.getElementById('person-form');
const template = document.getElementById('person-display');

form.addEventListener('submit', (e) => {
  e.preventDefault();
  
  // Render form data to template
  const rendered = Template.render(form, '#person-display');
  document.body.appendChild(rendered);
  
  // Or validate with schema
  const schema = await Schema.load('https://schema.org/Person');
  if (schema.validate(form)) {
    console.log('Form data is valid');
  }
});
```

### Remote Data Loading

Fetch and render data from external sources:

```javascript
// Fetch JSON-LD
const data = await Microdata.fetch('./api/person/123.json');
const rendered = Template.render(data, '#person-template');

// Fetch HTML with microdata
const items = await Microdata.fetch('./people.html', {
  expectedType: 'https://schema.org/Person'
});

// Auto-populate templates from URL
const container = document.querySelector('[data-source]');
container.setAttribute('data-source', './api/people.json');
```

### Itemref Support

Reference properties from other elements:

```html
<div id="person" itemscope itemtype="https://schema.org/Person" 
     itemref="shared-address shared-contact">
  <span itemprop="name">John Doe</span>
</div>

<!-- Shared properties -->
<div id="shared-address" itemprop="address" itemscope 
     itemtype="https://schema.org/PostalAddress">
  <span itemprop="streetAddress">123 Main St</span>
  <span itemprop="addressLocality">Anytown</span>
</div>

<div id="shared-contact">
  <span itemprop="telephone">555-1234</span>
  <span itemprop="email">john@example.com</span>
</div>
```

## Schema Support

### Schema.org Schemas

Schema.org schemas are loaded automatically with permissive validation:

```javascript
// Automatic loading
const person = document.microdata.person; // Schema loads automatically

// Manual validation
if (person.validate()) {
  console.log('Valid according to schema.org/Person');
}
```

### Custom Schemas

Define custom schemas with strict validation:

```javascript
// RustyBeam.net style schema with cardinality and patterns
const credentialSchema = await Schema.load('https://rustybeam.net/schema/Credential');

// Validates required properties, cardinality, and patterns
const isValid = credentialSchema.validate(credentialData);
```

### Schema Features

- **Property validation**: Check required/optional properties
- **Cardinality rules**: Enforce 0..1, 1..n, 0..n relationships  
- **Type checking**: Validate data types (Text, Number, Boolean, etc.)
- **Pattern matching**: Regex validation for string values
- **Nested validation**: Validate complex nested structures

## Events

### DOMSchemasLoaded

Fired when all schemas have been loaded:

```javascript
document.addEventListener('DOMSchemasLoaded', (e) => {
  console.log('Schemas loaded:', e.detail.schemas);
  // Safe to access microdata with validation
});
```

### DOMSchemaError

Fired when a schema fails to load:

```javascript
document.addEventListener('DOMSchemaError', (e) => {
  console.error('Schema load failed:', e.detail.url, e.detail.error);
});
```

### DOMSchemaInvalidData

Fired when validation fails during property assignment:

```javascript
document.addEventListener('DOMSchemaInvalidData', (e) => {
  console.warn('Invalid data:', e.detail.property, e.detail.value);
  console.warn('Validation errors:', e.detail.errors);
});
```

## Browser Compatibility

SchemaElements requires modern browser features:

- **ES6 Proxy** - For reactive data binding
- **ES6 Modules** - For clean imports
- **MutationObserver** - For DOM change detection
- **Custom Events** - For event system
- **ES6 Classes** - For OOP structure

Supported browsers:
- Chrome 49+
- Firefox 45+
- Safari 10+
- Edge 14+

## Examples

### Basic Person Card

```html
<div id="john" itemscope itemtype="https://schema.org/Person">
  <h2 itemprop="name">John Doe</h2>
  <p itemprop="jobTitle">Software Engineer</p>
  <a itemprop="email" href="mailto:john@example.com">john@example.com</a>
</div>

<script type="module">
  import { Microdata } from './index.mjs';
  
  const john = document.microdata.john;
  
  // Update job title
  john.jobTitle = "Senior Software Engineer";
  
  // Add new property
  john.telephone = "555-0123";
</script>
```

### Dynamic Product Catalog

```html
<div id="products" data-contains="https://schema.org/Product">
  <template itemscope itemtype="https://schema.org/Product">
    <div class="product">
      <h3 itemprop="name"></h3>
      <p itemprop="description"></p>
      <span class="price">$<span itemprop="price"></span></span>
      <button onclick="addToCart(this)">Add to Cart</button>
    </div>
  </template>
</div>

<script type="module">
  // Products automatically render as they're added
  function addProduct(productData) {
    const product = document.createElement('div');
    product.id = `product-${Date.now()}`;
    product.setAttribute('itemscope', '');
    product.setAttribute('itemtype', 'https://schema.org/Product');
    product.style.display = 'none';
    
    // Set product data
    document.body.appendChild(product);
    const item = product.microdata;
    Object.assign(item, productData);
  }
  
  // Add products
  addProduct({
    name: 'Laptop',
    description: 'High-performance laptop',
    price: 999.99
  });
</script>
```

### Form with Validation

```html
<form id="registration" itemscope itemtype="https://schema.org/Person">
  <input itemprop="name" type="text" placeholder="Full Name" required>
  <input itemprop="email" type="email" placeholder="Email" required>
  <input itemprop="telephone" type="tel" placeholder="Phone">
  <button type="submit">Register</button>
</form>

<div id="confirmation"></div>

<script type="module">
  import { Template } from './index.mjs';
  
  const form = document.getElementById('registration');
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const person = form.microdata;
    
    if (person.validate()) {
      // Render confirmation
      const confirmed = Template.render(person, '#confirmation-template');
      document.getElementById('confirmation').appendChild(confirmed);
      
      // Send to server
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(person)
      });
    }
  });
</script>
```

## License

SchemaElements is released under the Apache 2.0 License. See LICENSE file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

## Support

- **Documentation**: Full API docs at [link-to-docs]
- **Examples**: See the `examples/` directory
- **Issues**: Report bugs on [GitHub Issues]

