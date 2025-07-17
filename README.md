# Schema Elements - Live Microdata API

Schema Elements provides a live, reactive JavaScript API for HTML microdata. It treats microdata embedded in your HTML as a live data layer, automatically synchronizing between the DOM and JavaScript objects.

## Features

- **Live Data Binding**: Access and modify microdata through `document.microdata` with automatic DOM synchronization
- **Array Operations**: Full support for array methods (push, pop, splice) on collections
- **Multi-View Synchronization**: Automatically updates data across multiple views (lists, tables, cards)
- **Template Rendering**: Render microdata, JSON-LD, forms, or URL content to HTML templates
- **Apply to DOM**: Apply rendered microdata to existing DOM elements while preserving structure
- **Direct Data Fetching**: Fetch microdata directly from URLs without requiring templates
- **Array Repetition**: Use `[]` syntax in templates to automatically repeat elements for arrays
- **URL Fetching**: Fetch and render data from JSON-LD or HTML URLs
- **Form Integration**: Extract data from HTML forms and render to templates
- **Schema Validation**: Built-in support for Schema.org and organised.team schemas with dynamic enumeration validation
- **Iterator Protocol**: Iterate over microdata items using for...of loops
- **DOM-to-Microdata Sync**: Changes to the DOM automatically update the microdata objects
- **Data Source Fetching**: Populate templates from external JSON-LD or HTML microdata files
- **JSON Serialization**: Easy conversion of microdata to JSON format

## Installation

Include the module in your HTML:

```html
<script type="module" src="http://jamesaduncan.github.io/schema-elements/index.mjs"></script>
```

## Basic Usage

### Accessing Microdata

Given this HTML with microdata:

```html
<div id="company" itemscope itemtype="https://organised.team/Organization">
  <h1 itemprop="name">Acme Corporation</h1>
  <p itemprop="description">A leading provider of innovative solutions</p>
</div>
```

Access it via JavaScript:

```javascript
// Access by ID
const company = document.microdata.company;
console.log(company.name); // "Acme Corporation"
console.log(company.description); // "A leading provider of innovative solutions"

// Modify data - DOM updates automatically
company.name = "Acme Corp";
```

### Working with Arrays

For properties that can have multiple values:

```html
<div id="org" itemscope itemtype="https://organised.team/Organization">
  <h2 itemprop="name">Tech Company</h2>
  <ul>
    <li itemprop="employee" itemscope itemtype="https://schema.org/Person">
      <span itemprop="name">John Doe</span>
      <span itemprop="email">john@example.com</span>
    </li>
    <li itemprop="employee" itemscope itemtype="https://schema.org/Person">
      <span itemprop="name">Jane Smith</span>
      <span itemprop="email">jane@example.com</span>
    </li>
  </ul>
</div>
```

```javascript
// Access employees array
const employees = document.microdata.org.employee;
console.log(employees.length); // 2

// Add new employee - DOM updates automatically
employees.push({
  name: "Bob Wilson",
  email: "bob@example.com"
});

// Remove last employee
employees.pop();

// Modify specific employee
employees[0].name = "John A. Doe";
```

### Multi-View Synchronization

Define templates for different views that automatically sync:

```html
<!-- List view template -->
<ul>
  <template itemtype="https://schema.org/Person">
    <li itemprop="employee" itemscope itemtype="https://schema.org/Person">
      <span itemprop="name"></span> - <span itemprop="email"></span>
    </li>
  </template>
</ul>

<!-- Table view template -->
<table>
  <template itemtype="https://schema.org/Person">
    <tr itemprop="employee" itemscope itemtype="https://schema.org/Person">
      <td itemprop="name"></td>
      <td itemprop="email"></td>
    </tr>
  </template>
</table>

<!-- Card view template -->
<div class="cards">
  <template itemtype="https://schema.org/Person">
    <div itemprop="employee" itemscope itemtype="https://schema.org/Person" class="card">
      <h3 itemprop="name"></h3>
      <p itemprop="email"></p>
    </div>
  </template>
</div>
```

When you modify the data, all views update automatically.

### Items Without IDs

Items without an ID are accessible by numeric index:

```html
<div itemscope itemtype="https://schema.org/Book">
  <h2 itemprop="name">The Great Gatsby</h2>
  <span itemprop="author">F. Scott Fitzgerald</span>
</div>
```

```javascript
// Access by index
const book = document.microdata[0];
console.log(book.name); // "The Great Gatsby"
```

### Iterator Protocol

Iterate over all microdata items:

```javascript
// Using for...of
for (const item of document.microdata) {
  console.log(item);
}

// Using forEach
document.microdata.forEach((item, key) => {
  console.log(key, item);
});
```

### DOM-to-Microdata Synchronization

Changes to the DOM automatically update the microdata:

```html
<div id="person" itemscope itemtype="https://schema.org/Person">
  <span itemprop="name" contenteditable="true">Click to edit</span>
</div>
```

```javascript
// Initial value
console.log(document.microdata.person.name); // "Click to edit"

// User edits the text in the browser...

// Value is automatically updated
console.log(document.microdata.person.name); // "New name"
```

### Data Source Fetching

You can populate templates from external data sources using the `data-microdata-source` attribute:

```html
<!-- Fetch from JSON-LD file -->
<div data-microdata-source="users.json">
  <template itemtype="https://schema.org/Person">
    <div itemscope itemtype="https://schema.org/Person">
      <span itemprop="name"></span>
      <span itemprop="email"></span>
    </div>
  </template>
</div>

<!-- Fetch from HTML with microdata -->
<div data-microdata-source="people.html">
  <template itemtype="https://schema.org/Person">
    <li itemscope itemtype="https://schema.org/Person">
      <span itemprop="name"></span>
    </li>
  </template>
</div>
```

**JSON-LD Data Source (users.json):**
```json
[
  {
    "@context": "https://schema.org",
    "@type": "Person",
    "name": "John Doe",
    "email": "john@example.com"
  },
  {
    "@context": "https://schema.org", 
    "@type": "Person",
    "name": "Jane Smith",
    "email": "jane@example.com"
  }
]
```

**HTML Data Source (people.html):**
```html
<div itemscope itemtype="https://schema.org/Person">
  <span itemprop="name">Bob Wilson</span>
  <span itemprop="email">bob@example.com</span>
</div>
```

The library will automatically:
- Fetch the data source when the page loads
- Parse JSON-LD or extract microdata from HTML
- Populate the appropriate templates based on item types
- Insert the populated items into the DOM

### JSON-LD Serialization

The library automatically serializes microdata to JSON-LD format:

```javascript
// Serialize a single item
const person = document.microdata.person;
console.log(JSON.stringify(person, null, 2));
// Output:
// {
//   "@context": "https://schema.org",
//   "@type": "Person",
//   "@id": "#person",
//   "name": "John Doe",
//   "email": "john@example.com"
// }

// Serialize an organization with employees
const org = document.microdata.company;
console.log(JSON.stringify(org, null, 2));
// Output:
// {
//   "@context": "https://organised.team",
//   "@type": "Organization",
//   "@id": "#company",
//   "name": "Acme Corp",
//   "employee": [
//     {
//       "@context": "https://schema.org",
//       "@type": "Person",
//       "name": "Jane Smith",
//       "email": "jane@example.com"
//     }
//   ]
// }

// Serialize all microdata (mixed items)
const allData = JSON.stringify(document.microdata);
// Output when there are items with IDs:
// {
//   "company": {
//     "@context": "https://organised.team",
//     "@type": "Organization",
//     "@id": "#company",
//     "name": "Acme Corp",
//     "employee": [...]
//   },
//   "person": {
//     "@context": "https://schema.org",
//     "@type": "Person", 
//     "@id": "#person",
//     "name": "John Doe",
//     "email": "john@example.com"
//   }
// }

// When only items without IDs exist, returns an array:
const usersData = JSON.stringify(document.microdata);
// Output:
// [
//   {
//     "@context": "https://rustybeam.net/schema",
//     "@type": "Credential",
//     "username": "user1@example.com",
//     "role": "admin"
//   },
//   {
//     "@context": "https://rustybeam.net/schema",
//     "@type": "Credential",
//     "username": "user2@example.com", 
//     "role": "user"
//   }
// ]
```

## Schema Support

### Schema Validation

The library validates data against schema definitions, ensuring:

- Correct property types (Text, URL, Boolean, Number, etc.)
- Proper cardinality (0..1, 0..n, 1..n)
- Required properties are present

### Custom Schemas

You can extend the schema registry with custom schemas:

```javascript
import { SchemaRegistry } from './index.mjs';

const registry = new SchemaRegistry();
await registry.loadSchema('https://example.com/MySchema');
```

## API Reference

### document.microdata

The main entry point for accessing microdata.

#### Properties

- `document.microdata[id]` - Access item by ID
- `document.microdata[index]` - Access item by numeric index (for items without IDs)
- `document.microdata.length` - Total number of microdata items

#### Methods

- `forEach(callback)` - Iterate over all items
- `[Symbol.iterator]` - Makes microdata iterable with for...of

### Item Properties

Each microdata item is a proxy object with:

- Direct property access: `item.propertyName`
- Special properties:
  - `_element` - The underlying DOM element
  - `_type` - The item's type (from itemtype)
  - `_id` - The item's ID (from itemid or id attribute)

### Array Methods

For properties with multiple values:

- `push(...items)` - Add items to the end
- `pop()` - Remove and return the last item
- `splice(start, deleteCount, ...items)` - Add/remove items at any position
- Standard array properties: `length`, numeric indices

### Template Rendering

The library provides static methods for rendering microdata items, JSON-LD objects, form data, or URL content to HTML templates, and for applying microdata to existing DOM elements.

#### MicrodataAPI.render(template, data)

Renders microdata items, JSON-LD objects, form data, or URL content to a template element.

**Parameters:**
- `template` (HTMLTemplateElement) - The template element to render to
- `data` (Object|HTMLFormElement|string) - Either a microdata proxy object, JSON-LD object, HTML form element, or URL string

**Returns:**
- `DocumentFragment` - The populated template content ready to insert into the DOM (for synchronous calls)
- `Promise<DocumentFragment>` - Promise resolving to populated template content (for URL calls)

**Example Usage:**

```javascript
import { MicrodataAPI } from './index.mjs';

// Get a template element
const template = document.querySelector('template#person-card');

// Render existing microdata item
const rendered1 = MicrodataAPI.render(template, document.microdata.person1);
document.body.appendChild(rendered1);

// Render JSON-LD object
const jsonData = {
  "@context": "https://schema.org",
  "@type": "Person",
  "name": "John Doe",
  "email": "john@example.com",
  "jobTitle": "Software Developer"
};
const rendered2 = MicrodataAPI.render(template, jsonData);
document.body.appendChild(rendered2);

// Render form data to template
const form = document.querySelector('#person-form');
const rendered3 = MicrodataAPI.render(template, form);
document.body.appendChild(rendered3);

// Render from URL (returns Promise)
const rendered4 = await MicrodataAPI.render(template, './data.json');
document.body.appendChild(rendered4);

// Render from HTML URL
const rendered5 = await MicrodataAPI.render(template, './data.html');
document.body.appendChild(rendered5);
```

**Template Structure:**

Templates must contain an element with `itemscope` and appropriate `itemprop` attributes:

```html
<template id="person-card">
  <div class="card" itemscope itemtype="https://schema.org/Person">
    <h3 itemprop="name"></h3>
    <p>Email: <span itemprop="email"></span></p>
    <p>Job: <span itemprop="jobTitle"></span></p>
  </div>
</template>
```

**Smart Element Handling:**

The render method intelligently populates different element types:
- Elements with `content` attribute: Sets the `content` attribute value
- Input elements: Sets the `value` property
- Link elements (`<a>`): Sets `href` and optionally text content
- Image elements (`<img>`): Sets `src` and `alt` attributes
- Other elements: Sets `textContent`

**Nested Objects:**

The method supports nested microdata structures:

```html
<template id="book-template">
  <div itemscope itemtype="https://schema.org/Book">
    <h3 itemprop="name"></h3>
    <div itemprop="author" itemscope itemtype="https://schema.org/Person">
      <span>by <span itemprop="name"></span></span>
    </div>
  </div>
</template>
```

**Array Properties:**

For properties that contain arrays, the first array element is used for template population.

**Form Rendering:**

The `render` method can extract data from HTML forms and render it to templates. Form element `name` attributes are mapped to `itemprop` properties in the template.

```html
<!-- Form with various input types -->
<form id="person-form">
  <input type="hidden" name="@context" value="https://schema.org">
  <input type="hidden" name="@type" value="Person">
  
  <input type="text" name="name" value="John Doe">
  <input type="email" name="email" value="john@example.com">
  <input type="number" name="age" value="30">
  
  <!-- Checkboxes create arrays for multiple values -->
  <input type="checkbox" name="skills" value="JavaScript" checked>
  <input type="checkbox" name="skills" value="Python" checked>
  
  <!-- Radio buttons return single values -->
  <input type="radio" name="contactMethod" value="email" checked>
  <input type="radio" name="contactMethod" value="phone">
  
  <!-- Select elements -->
  <select name="department">
    <option value="Engineering" selected>Engineering</option>
    <option value="Design">Design</option>
  </select>
  
  <!-- Multi-select creates arrays -->
  <select name="languages" multiple>
    <option value="English" selected>English</option>
    <option value="Spanish" selected>Spanish</option>
  </select>
  
  <textarea name="bio">Software developer with 5+ years experience.</textarea>
</form>
```

```javascript
// Render form data to template
const form = document.querySelector('#person-form');
const template = document.querySelector('#person-template');
const rendered = MicrodataAPI.render(template, form);
document.body.appendChild(rendered);
```

**Form Element Support:**

- **Text inputs** (`text`, `email`, `url`, `hidden`, etc.): Uses `value` property
- **Number inputs**: Converts strings to numbers automatically
- **Checkboxes**: Creates arrays for multiple checked values with same name
- **Radio buttons**: Returns single selected value
- **Select elements**: Handles both single and multi-select (arrays for multiple)
- **Textarea**: Uses `value` property
- **File inputs**: Currently skipped (not processed)

**JSON-LD Metadata:**

Forms can include JSON-LD metadata using hidden inputs:

```html
<input type="hidden" name="@context" value="https://schema.org">
<input type="hidden" name="@type" value="Person">
```

If not provided, the method will attempt to infer the type from the template's `itemtype` attribute.

**URL Rendering:**

The `render` method can fetch data from URLs and render it to templates. It supports both JSON-LD and HTML with microdata.

```javascript
// Render from JSON-LD URL
const rendered = await MicrodataAPI.render(template, './person.json');

// Render from HTML URL (extracts matching microdata)
const rendered = await MicrodataAPI.render(template, './person.html');

// Render from relative path
const rendered = await MicrodataAPI.render(template, '/api/person/123');
```

**URL Processing:**
- **JSON files** (`application/json`, `application/ld+json`): Parsed as JSON-LD
- **HTML files** (`text/html`): Microdata is extracted from elements matching the template's `itemtype`
- **Relative URLs**: Resolved using `document.baseURI`
- **Error handling**: Network errors and missing data result in Promise rejection

**Array Repetition:**

Templates can use the `[]` syntax to automatically repeat elements for array values:

```html
<template id="person-template">
  <div itemscope itemtype="https://schema.org/Person">
    <h3 itemprop="name"></h3>
    <p><strong>Skills:</strong></p>
    <ul>
      <li itemprop="skills[]"></li>
    </ul>
  </div>
</template>
```

When rendered with data like `{"name": "John", "skills": ["HTML", "CSS", "JavaScript"]}`, this creates:

```html
<div itemscope itemtype="https://schema.org/Person">
  <h3 itemprop="name">John</h3>
  <p><strong>Skills:</strong></p>
  <ul>
    <li itemprop="skills">HTML</li>
    <li itemprop="skills">CSS</li>
    <li itemprop="skills">JavaScript</li>
  </ul>
</div>
```

The `[]` syntax works with any property that contains an array, automatically creating the correct number of elements.

#### MicrodataAPI.apply(target, source)

Applies microdata from a rendered template, element, or data object to existing DOM elements.

**Parameters:**
- `target` (Element) - The DOM element to apply microdata to
- `source` (DocumentFragment|Element|Object) - The source of microdata

**Returns:**
- `void` - Modifies the target element in place

**Example Usage:**

```javascript
// Apply from rendered template
const rendered = MicrodataAPI.render(template, data);
MicrodataAPI.apply(document.querySelector('nav'), rendered);

// Apply from data object directly
const data = { name: "John Doe", email: "john@example.com" };
MicrodataAPI.apply(document.querySelector('nav'), data);

// Apply from existing element
const sourceElement = document.querySelector('#person-card');
MicrodataAPI.apply(document.querySelector('nav'), sourceElement);
```

**Use Cases:**
- Populating navigation elements with user data
- Updating existing DOM elements without replacing them
- Applying template-rendered data to persistent page elements
- Maintaining DOM structure while updating content

**Example - Populating Navigation:**

```html
<!-- Target element (preserves structure) -->
<nav itemscope itemtype="https://schema.org/Person">
    <div itemprop="name">[Name will appear here]</div>
    <menu>
        <li><a href="/">← Home</a></li>
        <li><a href="/demos/">← Demos</a></li>
    </menu>
</nav>

<!-- After applying data -->
<nav itemscope itemtype="https://schema.org/Person">
    <div itemprop="name">John Doe</div>
    <menu>
        <li><a href="/">← Home</a></li>
        <li><a href="/demos/">← Demos</a></li>
    </menu>
</nav>
```

The `apply` method preserves the existing DOM structure while populating microdata properties, making it perfect for updating persistent page elements like navigation, headers, or sidebars.

#### MicrodataAPI.fetch(url, expectedType?)

Fetches microdata directly from a URL without requiring a template. This method is useful for retrieving data that will be processed or applied to existing DOM elements.

**Parameters:**
- `url` (string) - The URL to fetch microdata from
- `expectedType` (string, optional) - Optional expected itemtype to filter results

**Returns:**
- `Promise<Object|Array<Object>>` - Promise resolving to microdata object(s)

**Example Usage:**

```javascript
import { MicrodataAPI } from './index.mjs';

// Fetch all microdata from a URL
const allData = await MicrodataAPI.fetch('./data.json');

// Fetch specific type of microdata
const personData = await MicrodataAPI.fetch('./people.html', 'https://schema.org/Person');

// Use with apply() method
const userData = await MicrodataAPI.fetch('./user-profile.json');
MicrodataAPI.apply(document.querySelector('#user-nav'), userData);

// Combined fetch and apply pattern
MicrodataAPI.apply(
    document.querySelector('#destination'),
    await MicrodataAPI.fetch('./source.html')
);
```

**Data Source Support:**
- **JSON files** (`application/json`, `application/ld+json`): Parsed as JSON-LD
- **HTML files** (`text/html`): Microdata is extracted from elements
- **Mixed content**: Attempts JSON parsing first, then HTML extraction
- **Type filtering**: When `expectedType` is provided, only matching items are returned

**Return Value Handling:**
- Single matching item: Returns the object directly
- Multiple matching items: Returns an array of objects
- No matching items: Throws an error

**Error Handling:**
- Network errors (404, 500, etc.) result in Promise rejection
- Missing or invalid microdata results in descriptive error messages
- Type mismatches (when `expectedType` is specified) throw errors

**Use Cases:**
- Direct data fetching without template rendering
- Data preprocessing before applying to DOM
- Combining with `apply()` for streamlined data flow
- Type-specific data retrieval from mixed content sources

The `fetch()` method complements the existing `render()` and `apply()` methods, providing a complete toolkit for working with microdata from various sources.

## How It Works

1. **Initialization**: On page load, the library scans for all elements with `itemscope` attributes
2. **Extraction**: Microdata is extracted respecting schema cardinality rules
3. **Proxy Creation**: Each item is wrapped in a Proxy for reactive behavior
4. **Template Discovery**: Templates are found by their `itemtype` attribute
5. **Mutation Observer**: DOM changes are monitored and synced to the data model
6. **Bidirectional Sync**: Changes to either DOM or JavaScript objects are synchronized

## Browser Compatibility

This library requires modern browser features:
- ES6 Proxy
- ES6 Modules
- MutationObserver
- ES6 Iterators/Generators

## License

This project is licensed under the GNU General Public License v3.0.

## Contributing

Contributions are welcome! Please submit issues and pull requests on GitHub.