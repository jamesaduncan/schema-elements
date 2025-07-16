# Schema Elements - Live Microdata API

Schema Elements provides a live, reactive JavaScript API for HTML microdata. It treats microdata embedded in your HTML as a live data layer, automatically synchronizing between the DOM and JavaScript objects.

## Features

- **Live Data Binding**: Access and modify microdata through `window.microdata` with automatic DOM synchronization
- **Array Operations**: Full support for array methods (push, pop, splice) on collections
- **Multi-View Synchronization**: Automatically updates data across multiple views (lists, tables, cards)
- **Schema Validation**: Built-in support for Schema.org and organised.team schemas
- **Iterator Protocol**: Iterate over microdata items using for...of loops
- **DOM-to-Microdata Sync**: Changes to the DOM automatically update the microdata objects
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
<div id="company" itemscope itemtype="https://schema.org/Organization">
  <h1 itemprop="name">Acme Corporation</h1>
  <p itemprop="description">A leading provider of innovative solutions</p>
</div>
```

Access it via JavaScript:

```javascript
// Access by ID
const company = window.microdata.company;
console.log(company.name); // "Acme Corporation"
console.log(company.description); // "A leading provider of innovative solutions"

// Modify data - DOM updates automatically
company.name = "Acme Corp";
```

### Working with Arrays

For properties that can have multiple values:

```html
<div id="org" itemscope itemtype="https://schema.org/Organization">
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
const employees = window.microdata.org.employee;
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
const book = window.microdata[0];
console.log(book.name); // "The Great Gatsby"
```

### Iterator Protocol

Iterate over all microdata items:

```javascript
// Using for...of
for (const item of window.microdata) {
  console.log(item);
}

// Using forEach
window.microdata.forEach((item, key) => {
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
console.log(window.microdata.person.name); // "Click to edit"

// User edits the text in the browser...

// Value is automatically updated
console.log(window.microdata.person.name); // "New name"
```

### JSON-LD Serialization

The library automatically serializes microdata to JSON-LD format:

```javascript
// Serialize a single item
const person = window.microdata.person;
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
const org = window.microdata.company;
console.log(JSON.stringify(org, null, 2));
// Output:
// {
//   "@context": "https://schema.org",
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
const allData = JSON.stringify(window.microdata);
// Output when there are items with IDs:
// {
//   "company": {
//     "@context": "https://schema.org",
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
const usersData = JSON.stringify(window.microdata);
// Output:
// [
//   {
//     "@context": "https://schema.org",
//     "@type": "Credential",
//     "username": "user1@example.com",
//     "role": "admin"
//   },
//   {
//     "@context": "https://schema.org",
//     "@type": "Credential",
//     "username": "user2@example.com", 
//     "role": "user"
//   }
// ]
```

## Schema Support

### Built-in Schema.org Types

The library includes built-in support for common Schema.org types:

- Organization (with properties: name, description, employee, url)
- Person (with properties: name, email, contact)
- Book (with properties: name, author)

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

### window.microdata

The main entry point for accessing microdata.

#### Properties

- `window.microdata[id]` - Access item by ID
- `window.microdata[index]` - Access item by numeric index (for items without IDs)
- `window.microdata.length` - Total number of microdata items

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