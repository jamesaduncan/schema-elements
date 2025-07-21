# Microdata API Implementation Plan

This document outlines the complete implementation plan for the Microdata API as specified in SCHEMA-API.md. Each task is marked with a checkbox for tracking completion.

## Phase 1: Core Foundation ✅

### 1.1 MicrodataItem Class
- [x] Create MicrodataItem class using ES6 Proxy
- [x] Implement automatic JSON-LD structure (`@type`, `@context`, `@id`)
- [x] Add property getter that reads from DOM elements with matching itemprop
- [x] Add property setter that updates DOM elements with matching itemprop
- [x] Implement itemref resolution within same document
- [x] Add cycle detection for itemref with console.warn
- [x] Handle array properties based on multiple DOM elements
- [x] Extract @type from itemtype URL (last path segment)
- [x] Extract @context from itemtype URL (base URL)
- [x] Generate @id from element id or itemid attribute

### 1.2 MicrodataCollection Class
- [x] Create MicrodataCollection extending Array
- [x] Implement numeric indexing (`document.microdata[0]`)
- [x] Implement named access using Proxy (`document.microdata.johndoe`)
- [x] Override Symbol.iterator for proper iteration
- [x] Implement forEach, map, filter array methods
- [x] Support Object.keys() to list items with IDs
- [x] Filter to only include top-level items (not nested)
- [x] Maintain internal index of items by ID

### 1.3 DOM Integration
- [x] Add `microdata` getter to Document.prototype
- [x] Add `microdata` getter to Element.prototype for itemscope elements
- [x] Create global MutationObserver on document
- [x] Watch for additions/removals of itemscope elements
- [x] Watch for changes to itemprop elements
- [x] Watch for changes to itemtype, itemid, itemref attributes
- [x] Implement immediate DOM updates (no batching)
- [x] Initialize microdata collection on DOMContentLoaded

## Phase 2: Schema System ✅

### 2.1 Schema Factory Pattern
- [x] Create base Schema class with factory constructor
- [x] Implement async schema fetching in constructor
- [x] Create SchemaOrgSchema subclass
- [x] Create RustyBeamNetSchema subclass
- [x] Implement determineSchemaType() method
- [x] Parse fetched schema content to determine type
- [x] Default to SchemaOrgSchema on fetch error
- [x] Return appropriate subclass instance from constructor

### 2.2 Schema Loading and Caching
- [x] Create global schema cache Map
- [x] Implement schema URL normalization
- [x] Add cache check before fetching
- [x] Scan document for all itemtype attributes on load
- [x] Fetch all unique schemas in parallel
- [x] Store parsed schemas in cache
- [x] Fire DOMSchemasLoaded event when all complete
- [x] Fire DOMSchemaError event for each failed schema

### 2.3 SchemaOrgSchema Implementation
- [x] Parse schema.org schema format
- [x] Extract property names
- [x] Implement basic property existence validation
- [x] Default all properties to optional (0..n cardinality)
- [x] No value type validation

### 2.4 RustyBeamNetSchema Implementation
- [x] Parse rustybeam.net schema format
- [x] Extract property definitions with cardinality
- [x] Extract DataType references
- [x] Implement cardinality validation (1, 1..n, 0..n)
- [x] Fetch and cache referenced DataTypes
- [x] Implement regex pattern validation from DataTypes
- [x] Support nested complex type validation

### 2.5 Validation Implementation
- [x] Add validate() method to MicrodataItem
- [x] Check property existence against schema
- [x] Validate cardinality constraints
- [x] Validate values against DataType patterns
- [x] Return boolean result immediately (synchronous with loaded check)
- [x] Collect validation errors for debugging
- [x] Support validation without loaded schemas (returns true)

### 2.6 Validation Events
- [x] Fire DOMSchemaInvalidData on property set (during validation)
- [x] Include validation error details in event
- [x] Bubble event from itemprop element to itemscope to document
- [x] Continue DOM update even if validation fails

## Phase 3: Template System ✅

### 3.1 Template Class
- [x] Create Template class constructor accepting template element
- [x] Parse template for itemtype attributes
- [x] Extract schemas property listing found types
- [x] Implement validate() method for pre-render validation
- [x] Create render() method accepting data object
- [x] Support rendering plain objects
- [x] Support rendering MicrodataItem instances
- [x] Support rendering form elements
- [x] Support rendering DOM elements/fragments

### 3.2 Template Rendering Engine
- [x] Clone template content for rendering
- [x] Find all itemprop elements in template
- [x] Map data properties to itemprop elements
- [x] Handle text content for simple properties
- [x] Handle nested itemscope for complex properties
- [x] Implement array rendering for `itemprop="name[]"` syntax
- [x] Render single element for single values with array syntax
- [x] Render nothing for missing properties
- [x] Generate unique IDs for cloned elements

### 3.3 Auto-synchronization System
- [x] Scan for elements with `data-contains` attribute
- [x] Extract schema URL from attribute value
- [x] Find template element within container
- [x] Locate all authoritative items (with id) matching schema
- [x] Render template for each authoritative item
- [x] Set itemid on rendered items linking to source
- [x] Watch for new authoritative items via MutationObserver
- [x] Watch for removed authoritative items
- [x] Add/remove rendered items dynamically

### 3.4 Live Synchronization
- [x] Establish two-way binding between authoritative and rendered items
- [x] Update rendered items when authoritative items change
- [x] Update authoritative items when rendered items change
- [x] Prevent infinite update loops
- [x] Maintain synchronization through MutationObserver

## Phase 4: Form Support ✅

### 4.1 Form Data Extraction
- [x] Create form data extractor (in _extractData methods)
- [x] Map form input name attributes to properties
- [x] Handle text, password, email input types
- [x] Handle select elements
- [x] Handle textarea elements
- [x] Handle checkbox groups for arrays
- [x] Handle radio buttons
- [x] Extract values into plain object

### 4.2 Form Validation
- [x] Extend Schema.validate() to accept form elements
- [x] Extract data from form
- [x] Validate against schema
- [x] Support HTML5 form validation integration
- [x] Return validation result

### 4.3 Form Rendering
- [x] Extend Template.render() to accept form elements
- [x] Extract form data
- [x] Render to template
- [x] Maintain form state in rendered output

## Phase 5: Fetch API ✅

### 5.1 Microdata.fetch Implementation
- [x] Create static fetch method on Microdata class
- [x] Fetch HTML content from URL
- [x] Parse HTML into Document
- [x] Create document-like wrapper object
- [x] Add isolated microdata property
- [x] Support fragment identifiers (#id)
- [x] Extract specific element for fragments
- [x] Return element-like wrapper for fragments

### 5.2 Fetched Document Handling
- [x] Parse microdata in fetched document
- [x] Create separate MicrodataCollection
- [x] Ensure no cross-document itemref
- [x] Maintain isolation from main document
- [x] Support microdata operations on fetched content

## Phase 6: Event System ✅

### 6.1 Document Events
- [x] Implement DOMSchemasLoaded event
- [x] Fire when all schemas loaded on initial page load
- [x] Include loaded schemas in event detail
- [x] Implement DOMSchemaError event
- [x] Fire for each schema that fails to load
- [x] Include schema URL and error in event detail

### 6.2 Element Events
- [x] Implement DOMSchemaInvalidData event
- [x] Fire on itemprop element for invalid value
- [x] Bubble to itemscope element
- [x] Bubble to document
- [x] Include validation details in event
- [x] Implement DOMSchemaError on elements
- [x] Fire on itemtype element for schema load failure
- [x] Then fire on document

## Phase 7: Module Structure

### 7.1 ES Module Exports
- [x] Export Microdata as named export
- [x] Export Schema as named export
- [x] Export Template as named export
- [x] Export Microdata as default export
- [x] Set window.Microdata global
- [x] Set window.Microdata.Schema
- [x] Set window.Microdata.Template

### 7.2 Static Methods
- [x] Implement Microdata.fetch() static method
- [x] Implement Template.render() static shorthand
- [x] Add Schema.clearCache() for testing

## Phase 8: Edge Cases and Polish

### 8.1 Error Handling
- [x] Handle missing itemtype gracefully
- [x] Handle malformed schema URLs
- [x] Handle network errors in fetch
- [x] Provide helpful console warnings
- [x] Validate itemref ID existence

### 8.2 Performance Optimization
- [x] Optimize MutationObserver filters
- [x] Implement efficient DOM queries
- [x] Cache parsed schemas aggressively
- [x] Minimize DOM traversals
- [x] Batch schema fetches

### 8.3 Browser Compatibility
- [x] Ensure Proxy support
- [x] Ensure MutationObserver support
- [x] Test array method inheritance
- [x] Verify event bubbling behavior
- [x] Add any necessary polyfills

## Phase 9: Testing

### 9.1 Unit Tests
- [x] Test MicrodataItem property access
- [x] Test MicrodataCollection dual interface
- [x] Test Schema factory pattern
- [x] Test validation logic
- [x] Test template rendering
- [x] Test event firing

### 9.2 Integration Tests
- [x] Test live DOM synchronization
- [x] Test schema loading and caching
- [x] Test template auto-sync
- [x] Test form validation
- [x] Test fetch API
- [x] Test complex itemref scenarios

### 9.3 Example Files
- [x] Create basic microdata example
- [x] Create complex nested example
- [x] Create template sync example
- [x] Create form validation example
- [x] Create fetch API example
- [x] Update test.html with all examples

## Completion Checklist

- [x] All core functionality implemented
- [x] All events firing correctly
- [x] All edge cases handled
- [x] Performance optimized
- [x] Fully tested
- [x] Examples documented
- [x] Codebase documented
- [x] Codebase meets beautiful code standards in CLAUDE.md
- [x] Ready for production use
- [x] Fully documented explanation of the project and the API in README.md
        - [x] README.md completely rewritten.