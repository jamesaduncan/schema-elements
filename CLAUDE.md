# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Code should always be beautiful. Especially code that is about to be released.

## Beautiful code

Beautiful code, is well-factored code, and code-paths should not be duplicated.
Beautiful code has named methods and function that explain their purpose, and won't confused the reader by being misnamed.
Beautiful code doesn't have extra debugging information in it.

More importantly, and this is ** CRITICAL **, is that the code works as intended at all times.

## Project Overview

SchemaElements is a vanilla JavaScript library for working with HTML Microdata (schema.org) elements. It provides extraction, rendering, synchronization, and validation of schema data within the DOM without any external dependencies.

## API

<body id="example" itemscope itemtype="http://schema.org/Organization">
    <ul>
        <template itemtype="http://schema.org/Person">
            <li itemprop="employee" itemscope itemtype="http://schema.org/Person">
                <h1 itemprop="name"></h1>
                <addr itemprop="email"></addr>
            </li>
        </template>
        <li itemprop="employee" itemscope itemtype="http://schema.org/Person">
            <h1 itemprop="name">John Doe</h1>
            <addr itemprop="email">john@example.com</addr>
        </li>
        <li itemprop="employee" itemscope itemtype="http://schema.org/Person">
            <h1 itemprop="name">Jane Doe</h1>
            <addr itemprop="email">jane@example.com</addr>
        </li>
    </ul>
</body>

console.log( window.microdata.example.employee[0].name );
window.microdata.example.employee.push( { name: "Elizabeth Doe", email: "elizabeth@example.com" });


## Commands

Since this is a vanilla JavaScript library with no build tools:
- **Running**: Open HTML files directly in a browser
- **Testing**: Open http://127.0.0.1:8082/test.html
- **Development**: Edit `.mjs` files directly, no build step required

## Architecture

### Key Concepts
- **Microdata Attributes**: Uses HTML's `itemscope`, `itemtype`, `itemprop`, and `itemid` attributes
- **ES Modules**: All JavaScript files use `.mjs` extension for native ES module support
- **No Dependencies**: Pure vanilla JavaScript, except for author's own utilities (SelectorRequest, SelectorSubscriber)

### Core Classes (from v3.0)
- **Schema**: Validates objects against schema definitions
- **SchemaPropertyDescriptor**: Defines schema property constraints (name, type, required, many)
- **SchemaProperty**: Represents a single property with DOM synchronization
- **SchemaObject**: Proxy-based object providing dynamic property access
- **SchemaElement**: DOM element wrapper with schema capabilities
- **SchemaElements**: Main API for extracting and managing schema items

### Version Evolution
- **v1.0** (`OLD/index.mjs`): Basic schema extraction and rendering
- **v2.0** (`OLD/2.0/index.mjs`): Added validation and type registry
- **v3.0** (`OLD/3.0/index.mjs`): Current version with advanced schema system
- **Current** (`index.mjs`): Empty file - active development

### Key Features
1. **Data Extraction**: Extract schema data from HTML elements
2. **Template Rendering**: Use `data-source` and `data-template` attributes for dynamic content
3. **Synchronization**: Two-way binding between schema elements across the document
4. **Validation**: Validate objects against schema.org type definitions

### External Dependencies
- `https://jamesaduncan.github.io/selector-request/index.mjs` - URL-based element selection
- `https://jamesaduncan.github.io/selector-subscriber/index.mjs` - Used instead of querySelector when binding events to DOM elements, so that if new DOM elements dynamically appear, the event handlers automatically get added to them, too.

## Development Notes
- When modifying schema handling, test with `OLD/example.html` which demonstrates all features
- The library uses Proxy objects for dynamic property access - be aware of browser compatibility
- Schema validation is based on schema.org vocabulary
- Debug mode can be enabled with `window.debug = { enabled: true }`