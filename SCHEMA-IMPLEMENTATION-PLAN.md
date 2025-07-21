# Microdata API Implementation Plan

This document outlines the complete implementation plan for the Microdata API as specified in SCHEMA-API.md. Each task is marked with a checkbox for tracking completion.

## Phase 1: Core Foundation

### 1.1 MicrodataItem Class
- [ ] Create MicrodataItem class using ES6 Proxy
- [ ] Implement automatic JSON-LD structure (`@type`, `@context`, `@id`)
- [ ] Add property getter that reads from DOM elements with matching itemprop
- [ ] Add property setter that updates DOM elements with matching itemprop
- [ ] Implement itemref resolution within same document
- [ ] Add cycle detection for itemref with console.warn
- [ ] Handle array properties based on multiple DOM elements
- [ ] Extract @type from itemtype URL (last path segment)
- [ ] Extract @context from itemtype URL (base URL)
- [ ] Generate @id from element id or itemid attribute

### 1.2 MicrodataCollection Class
- [ ] Create MicrodataCollection extending Array
- [ ] Implement numeric indexing (`document.microdata[0]`)
- [ ] Implement named access using Proxy (`document.microdata.johndoe`)
- [ ] Override Symbol.iterator for proper iteration
- [ ] Implement forEach, map, filter array methods
- [ ] Support Object.keys() to list items with IDs
- [ ] Filter to only include top-level items (not nested)
- [ ] Maintain internal index of items by ID

### 1.3 DOM Integration
- [ ] Add `microdata` getter to Document.prototype
- [ ] Add `microdata` getter to Element.prototype for itemscope elements
- [ ] Create global MutationObserver on document
- [ ] Watch for additions/removals of itemscope elements
- [ ] Watch for changes to itemprop elements
- [ ] Watch for changes to itemtype, itemid, itemref attributes
- [ ] Implement immediate DOM updates (no batching)
- [ ] Initialize microdata collection on DOMContentLoaded

## Phase 2: Schema System

### 2.1 Schema Factory Pattern
- [ ] Create base Schema class with factory constructor
- [ ] Implement async schema fetching in constructor
- [ ] Create SchemaOrgSchema subclass
- [ ] Create RustyBeamNetSchema subclass
- [ ] Implement determineSchemaType() method
- [ ] Parse fetched schema content to determine type
- [ ] Default to SchemaOrgSchema on fetch error
- [ ] Return appropriate subclass instance from constructor

### 2.2 Schema Loading and Caching
- [ ] Create global schema cache Map
- [ ] Implement schema URL normalization
- [ ] Add cache check before fetching
- [ ] Scan document for all itemtype attributes on load
- [ ] Fetch all unique schemas in parallel
- [ ] Store parsed schemas in cache
- [ ] Fire DOMSchemasLoaded event when all complete
- [ ] Fire DOMSchemaError event for each failed schema

### 2.3 SchemaOrgSchema Implementation
- [ ] Parse schema.org schema format
- [ ] Extract property names
- [ ] Implement basic property existence validation
- [ ] Default all properties to optional (0..n cardinality)
- [ ] No value type validation

### 2.4 RustyBeamNetSchema Implementation
- [ ] Parse rustybeam.net schema format
- [ ] Extract property definitions with cardinality
- [ ] Extract DataType references
- [ ] Implement cardinality validation (1, 1..n, 0..n)
- [ ] Fetch and cache referenced DataTypes
- [ ] Implement regex pattern validation from DataTypes
- [ ] Support nested complex type validation

### 2.5 Validation Implementation
- [ ] Add validate() method to MicrodataItem
- [ ] Check property existence against schema
- [ ] Validate cardinality constraints
- [ ] Validate values against DataType patterns
- [ ] Return boolean result immediately
- [ ] Collect validation errors for debugging
- [ ] Support validation without loaded schemas (returns true)

### 2.6 Validation Events
- [ ] Fire DOMSchemaInvalidData on property set
- [ ] Include validation error details in event
- [ ] Bubble event from itemprop element to itemscope to document
- [ ] Continue DOM update even if validation fails

## Phase 3: Template System

### 3.1 Template Class
- [ ] Create Template class constructor accepting template element
- [ ] Parse template for itemtype attributes
- [ ] Extract schemas property listing found types
- [ ] Implement validate() method for pre-render validation
- [ ] Create render() method accepting data object
- [ ] Support rendering plain objects
- [ ] Support rendering MicrodataItem instances
- [ ] Support rendering form elements
- [ ] Support rendering DOM elements/fragments

### 3.2 Template Rendering Engine
- [ ] Clone template content for rendering
- [ ] Find all itemprop elements in template
- [ ] Map data properties to itemprop elements
- [ ] Handle text content for simple properties
- [ ] Handle nested itemscope for complex properties
- [ ] Implement array rendering for `itemprop="name[]"` syntax
- [ ] Render single element for single values with array syntax
- [ ] Render nothing for missing properties
- [ ] Generate unique IDs for cloned elements

### 3.3 Auto-synchronization System
- [ ] Scan for elements with `data-contains` attribute
- [ ] Extract schema URL from attribute value
- [ ] Find template element within container
- [ ] Locate all authoritative items (with id) matching schema
- [ ] Render template for each authoritative item
- [ ] Set itemid on rendered items linking to source
- [ ] Watch for new authoritative items via MutationObserver
- [ ] Watch for removed authoritative items
- [ ] Add/remove rendered items dynamically

### 3.4 Live Synchronization
- [ ] Establish two-way binding between authoritative and rendered items
- [ ] Update rendered items when authoritative items change
- [ ] Update authoritative items when rendered items change
- [ ] Prevent infinite update loops
- [ ] Maintain synchronization through MutationObserver

## Phase 4: Form Support

### 4.1 Form Data Extraction
- [ ] Create form data extractor
- [ ] Map form input name attributes to properties
- [ ] Handle text, password, email input types
- [ ] Handle select elements
- [ ] Handle textarea elements
- [ ] Handle checkbox groups for arrays
- [ ] Handle radio buttons
- [ ] Extract values into plain object

### 4.2 Form Validation
- [ ] Extend Schema.validate() to accept form elements
- [ ] Extract data from form
- [ ] Validate against schema
- [ ] Support HTML5 form validation integration
- [ ] Return validation result

### 4.3 Form Rendering
- [ ] Extend Template.render() to accept form elements
- [ ] Extract form data
- [ ] Render to template
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