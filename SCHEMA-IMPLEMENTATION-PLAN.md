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
- [ ] Handle select elements
- [ ] Handle textarea elements
- [ ] Handle checkbox groups for arrays
- [ ] Handle radio buttons
- [x] Extract values into plain object

### 4.2 Form Validation
- [x] Extend Schema.validate() to accept form elements
- [x] Extract data from form
- [x] Validate against schema
- [ ] Support HTML5 form validation integration
- [x] Return validation result

### 4.3 Form Rendering
- [x] Extend Template.render() to accept form elements
- [x] Extract form data
- [x] Render to template
- [ ] Maintain form state in rendered output

## Phase 5: Fetch API

### 5.1 Microdata.fetch Implementation
- [ ] Create static fetch method on Microdata class
- [ ] Fetch HTML content from URL
- [ ] Parse HTML into Document
- [ ] Create document-like wrapper object
- [ ] Add isolated microdata property
- [ ] Support fragment identifiers (#id)
- [ ] Extract specific element for fragments
- [ ] Return element-like wrapper for fragments

### 5.2 Fetched Document Handling
- [ ] Parse microdata in fetched document
- [ ] Create separate MicrodataCollection
- [ ] Ensure no cross-document itemref
- [ ] Maintain isolation from main document
- [ ] Support microdata operations on fetched content

## Phase 6: Event System

### 6.1 Document Events
- [ ] Implement DOMSchemasLoaded event
- [ ] Fire when all schemas loaded on initial page load
- [ ] Include loaded schemas in event detail
- [ ] Implement DOMSchemaError event
- [ ] Fire for each schema that fails to load
- [ ] Include schema URL and error in event detail

### 6.2 Element Events
- [ ] Implement DOMSchemaInvalidData event
- [ ] Fire on itemprop element for invalid value
- [ ] Bubble to itemscope element
- [ ] Bubble to document
- [ ] Include validation details in event
- [ ] Implement DOMSchemaError on elements
- [ ] Fire on itemtype element for schema load failure
- [ ] Then fire on document

## Phase 7: Module Structure

### 7.1 ES Module Exports
- [ ] Export Microdata as named export
- [ ] Export Schema as named export
- [ ] Export Template as named export
- [ ] Export Microdata as default export
- [ ] Set window.Microdata global
- [ ] Set window.Microdata.Schema
- [ ] Set window.Microdata.Template

### 7.2 Static Methods
- [ ] Implement Microdata.fetch() static method
- [ ] Implement Template.render() static shorthand
- [ ] Add Schema.clearCache() for testing

## Phase 8: Edge Cases and Polish

### 8.1 Error Handling
- [ ] Handle missing itemtype gracefully
- [ ] Handle malformed schema URLs
- [ ] Handle network errors in fetch
- [ ] Provide helpful console warnings
- [ ] Validate itemref ID existence

### 8.2 Performance Optimization
- [ ] Optimize MutationObserver filters
- [ ] Implement efficient DOM queries
- [ ] Cache parsed schemas aggressively
- [ ] Minimize DOM traversals
- [ ] Batch schema fetches

### 8.3 Browser Compatibility
- [ ] Ensure Proxy support
- [ ] Ensure MutationObserver support
- [ ] Test array method inheritance
- [ ] Verify event bubbling behavior
- [ ] Add any necessary polyfills

## Phase 9: Testing

### 9.1 Unit Tests
- [ ] Test MicrodataItem property access
- [ ] Test MicrodataCollection dual interface
- [ ] Test Schema factory pattern
- [ ] Test validation logic
- [ ] Test template rendering
- [ ] Test event firing

### 9.2 Integration Tests
- [ ] Test live DOM synchronization
- [ ] Test schema loading and caching
- [ ] Test template auto-sync
- [ ] Test form validation
- [ ] Test fetch API
- [ ] Test complex itemref scenarios

### 9.3 Example Files
- [ ] Create basic microdata example
- [ ] Create complex nested example
- [ ] Create template sync example
- [ ] Create form validation example
- [ ] Create fetch API example
- [ ] Update test.html with all examples

## Completion Checklist

- [ ] All core functionality implemented
- [ ] All events firing correctly
- [ ] All edge cases handled
- [ ] Performance optimized
- [ ] Fully tested
- [ ] Examples documented
- [ ] Ready for production use