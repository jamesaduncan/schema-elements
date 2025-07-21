/**
 * Microdata API - A vanilla JavaScript library for working with HTML Microdata
 * 
 * This library provides extraction, rendering, synchronization, and validation
 * of schema.org and other microdata within the DOM.
 */

/**
 * MicrodataItem - Represents a single microdata item with live DOM binding
 */
class MicrodataItem {
    constructor(element) {
        if (!element || !element.hasAttribute('itemscope')) {
            throw new Error('MicrodataItem requires an element with itemscope attribute');
        }
        
        this._element = element;
        this._itemrefElements = this._resolveItemref();
        
        return new Proxy(this, {
            get: (target, prop) => {
                // Handle special JSON-LD properties
                if (prop === '@type') {
                    return target._getType();
                }
                if (prop === '@context') {
                    return target._getContext();
                }
                if (prop === '@id') {
                    return target._getId();
                }
                
                // Handle internal properties and methods
                if (prop.startsWith('_') || typeof target[prop] === 'function') {
                    return target[prop];
                }
                
                // Handle microdata properties
                return target._getProperty(prop);
            },
            
            set: (target, prop, value) => {
                // Prevent setting special properties
                if (prop.startsWith('@') || prop.startsWith('_')) {
                    return false;
                }
                
                return target._setProperty(prop, value);
            },
            
            has: (target, prop) => {
                if (['@type', '@context', '@id'].includes(prop)) {
                    return true;
                }
                return target._hasProperty(prop);
            },
            
            ownKeys: (target) => {
                const keys = ['@type', '@context', '@id'];
                const props = target._getAllPropertyNames();
                return keys.concat(props);
            },
            
            getOwnPropertyDescriptor: (target, prop) => {
                if (prop.startsWith('_')) {
                    return undefined;
                }
                return {
                    enumerable: true,
                    configurable: true,
                    get: () => this[prop],
                    set: (value) => { this[prop] = value; }
                };
            }
        });
    }
    
    _getType() {
        const itemtype = this._element.getAttribute('itemtype');
        if (!itemtype) return undefined;
        
        // Extract the last segment of the URL as the type
        const url = new URL(itemtype);
        const pathParts = url.pathname.split('/').filter(Boolean);
        return pathParts[pathParts.length - 1] || undefined;
    }
    
    _getContext() {
        const itemtype = this._element.getAttribute('itemtype');
        if (!itemtype) return undefined;
        
        // Extract the base URL as context
        const url = new URL(itemtype);
        return url.origin + url.pathname.substring(0, url.pathname.lastIndexOf('/') + 1);
    }
    
    _getId() {
        // Check for itemid attribute first
        const itemid = this._element.getAttribute('itemid');
        if (itemid) return itemid;
        
        // Fall back to element id with document URL
        const id = this._element.getAttribute('id');
        if (id) {
            return `${this._element.baseURI}#${id}`;
        }
        
        return undefined;
    }
    
    _resolveItemref() {
        const itemref = this._element.getAttribute('itemref');
        if (!itemref) return [];
        
        const refs = [];
        const seenIds = new Set();
        
        for (const id of itemref.trim().split(/\s+/)) {
            if (seenIds.has(id)) {
                console.warn(`Circular itemref detected for id: ${id}`);
                continue;
            }
            
            seenIds.add(id);
            const element = document.getElementById(id);
            
            if (element) {
                refs.push(element);
            } else {
                console.warn(`itemref references non-existent id: ${id}`);
            }
        }
        
        return refs;
    }
    
    _getPropertyElements(name) {
        const elements = [];
        
        // Search within the item element and itemref elements
        const searchRoots = [this._element, ...this._itemrefElements];
        
        for (const root of searchRoots) {
            // For itemref elements, check if the element itself has the itemprop
            if (root !== this._element && root.hasAttribute('itemprop')) {
                const itemprops = root.getAttribute('itemprop').trim().split(/\s+/);
                if (itemprops.includes(name)) {
                    elements.push(root);
                }
            }
            
            // Search within the element (but not within nested itemscopes)
            const walker = document.createTreeWalker(
                root,
                NodeFilter.SHOW_ELEMENT,
                {
                    acceptNode: (node) => {
                        // Check if it has the itemprop we're looking for
                        if (node.hasAttribute('itemprop')) {
                            const itemprops = node.getAttribute('itemprop').trim().split(/\s+/);
                            if (itemprops.includes(name)) {
                                return NodeFilter.FILTER_ACCEPT;
                            }
                        }
                        
                        // Skip if we're inside a nested itemscope (unless it has our itemprop)
                        if (node !== root && node.hasAttribute('itemscope')) {
                            return NodeFilter.FILTER_REJECT;
                        }
                        
                        return NodeFilter.FILTER_SKIP;
                    }
                }
            );
            
            let node;
            while (node = walker.nextNode()) {
                elements.push(node);
            }
        }
        
        return elements;
    }
    
    _getProperty(name) {
        const elements = this._getPropertyElements(name);
        
        if (elements.length === 0) {
            return undefined;
        }
        
        if (elements.length === 1) {
            return this._extractValue(elements[0]);
        }
        
        // Multiple elements means array
        return elements.map(el => this._extractValue(el));
    }
    
    _setProperty(name, value) {
        const elements = this._getPropertyElements(name);
        
        if (Array.isArray(value)) {
            // Setting array value
            elements.forEach((el, index) => {
                if (index < value.length) {
                    this._setValue(el, value[index]);
                }
            });
            
            // TODO: Handle case where value.length > elements.length
            // This would require creating new elements
        } else {
            // Setting single value
            if (elements.length > 0) {
                this._setValue(elements[0], value);
                
                // Remove extra elements if setting single value
                for (let i = 1; i < elements.length; i++) {
                    elements[i].remove();
                }
            }
            // TODO: Handle case where no elements exist
            // This would require creating new elements
        }
        
        return true;
    }
    
    _hasProperty(name) {
        return this._getPropertyElements(name).length > 0;
    }
    
    _getAllPropertyNames() {
        const names = new Set();
        
        // Collect from main element and itemref elements
        const searchRoots = [this._element, ...this._itemrefElements];
        
        for (const root of searchRoots) {
            // Check if the root itself has itemprop (for itemref elements)
            if (root !== this._element && root.hasAttribute('itemprop')) {
                const itemprops = root.getAttribute('itemprop').trim().split(/\s+/);
                itemprops.forEach(prop => names.add(prop));
            }
            
            // Use TreeWalker to find all itemprop elements, excluding nested itemscopes
            const walker = document.createTreeWalker(
                root,
                NodeFilter.SHOW_ELEMENT,
                {
                    acceptNode: (node) => {
                        // Accept if it has itemprop
                        if (node.hasAttribute('itemprop')) {
                            return NodeFilter.FILTER_ACCEPT;
                        }
                        
                        // Skip if we're inside a nested itemscope (unless it has itemprop)
                        if (node !== root && node.hasAttribute('itemscope')) {
                            return NodeFilter.FILTER_REJECT;
                        }
                        
                        return NodeFilter.FILTER_SKIP;
                    }
                }
            );
            
            let node;
            while (node = walker.nextNode()) {
                const itemprops = node.getAttribute('itemprop').trim().split(/\s+/);
                itemprops.forEach(prop => names.add(prop));
            }
        }
        
        return Array.from(names);
    }
    
    _extractValue(element) {
        // Handle nested microdata items
        if (element.hasAttribute('itemscope')) {
            return new MicrodataItem(element);
        }
        
        // Handle various element types
        if (element.hasAttribute('content')) {
            return element.getAttribute('content');
        }
        
        if (element.tagName === 'A' && element.hasAttribute('href')) {
            return element.href;
        }
        
        if (element.tagName === 'IMG' && element.hasAttribute('src')) {
            return element.src;
        }
        
        if (element.tagName === 'TIME' && element.hasAttribute('datetime')) {
            return element.getAttribute('datetime');
        }
        
        // Default to text content
        return element.textContent.trim();
    }
    
    _setValue(element, value) {
        // Handle nested microdata items
        if (element.hasAttribute('itemscope')) {
            // Cannot directly set nested items
            console.warn('Cannot directly set value on nested itemscope element');
            return;
        }
        
        // Handle various element types
        if (element.hasAttribute('content')) {
            element.setAttribute('content', value);
        } else if (element.tagName === 'A' && element.hasAttribute('href')) {
            element.href = value;
        } else if (element.tagName === 'IMG' && element.hasAttribute('src')) {
            element.src = value;
        } else if (element.tagName === 'TIME' && element.hasAttribute('datetime')) {
            element.setAttribute('datetime', value);
        } else {
            // Default to text content
            element.textContent = value;
        }
    }
    
    validate() {
        // TODO: Implement validation once Schema class is ready
        return true;
    }
    
    toJSON() {
        const json = {
            '@type': this['@type'],
            '@context': this['@context']
        };
        
        const id = this['@id'];
        if (id) {
            json['@id'] = id;
        }
        
        // Add all properties
        const props = this._getAllPropertyNames();
        for (const prop of props) {
            const value = this._getProperty(prop);
            if (value !== undefined) {
                json[prop] = Array.isArray(value) 
                    ? value.map(v => v instanceof MicrodataItem ? v.toJSON() : v)
                    : value instanceof MicrodataItem ? value.toJSON() : value;
            }
        }
        
        return json;
    }
}

/**
 * MicrodataCollection - Collection that supports both array and object access
 */
class MicrodataCollection extends Array {
    constructor() {
        super();
        this._indexById = new Map();
        
        return new Proxy(this, {
            get: (target, prop) => {
                // Handle numeric indices and array methods
                if (!isNaN(prop) || prop in Array.prototype || prop === 'length') {
                    return target[prop];
                }
                
                // Handle internal properties
                if (prop.startsWith('_')) {
                    return target[prop];
                }
                
                // Handle named access
                if (target._indexById.has(prop)) {
                    return target._indexById.get(prop);
                }
                
                // Handle special methods
                if (typeof target[prop] === 'function') {
                    return target[prop];
                }
                
                return undefined;
            },
            
            has: (target, prop) => {
                return !isNaN(prop) || target._indexById.has(prop);
            },
            
            ownKeys: (target) => {
                // Include numeric indices and named keys
                const numericKeys = Array.from({ length: target.length }, (_, i) => String(i));
                const namedKeys = Array.from(target._indexById.keys());
                return [...numericKeys, 'length', ...namedKeys];
            },
            
            getOwnPropertyDescriptor: (target, prop) => {
                if (!isNaN(prop) || prop === 'length') {
                    return Object.getOwnPropertyDescriptor(target, prop);
                }
                
                if (target._indexById.has(prop)) {
                    return {
                        enumerable: true,
                        configurable: true,
                        get: () => target._indexById.get(prop)
                    };
                }
                
                return undefined;
            }
        });
    }
    
    _addItem(item) {
        // Only add top-level items (not nested within other itemscopes)
        if (this._isTopLevel(item._element)) {
            this.push(item);
            
            // Index by ID if available
            const id = item._element.getAttribute('id');
            if (id) {
                this._indexById.set(id, item);
            }
        }
    }
    
    _removeItem(item) {
        const index = this.indexOf(item);
        if (index !== -1) {
            this.splice(index, 1);
            
            // Remove from index
            const id = item._element.getAttribute('id');
            if (id) {
                this._indexById.delete(id);
            }
        }
    }
    
    _isTopLevel(element) {
        // Check if element is nested within another itemscope
        let parent = element.parentElement;
        while (parent) {
            if (parent.hasAttribute('itemscope')) {
                return false;
            }
            parent = parent.parentElement;
        }
        return true;
    }
    
    _refreshIndex() {
        this._indexById.clear();
        for (const item of this) {
            const id = item._element.getAttribute('id');
            if (id) {
                this._indexById.set(id, item);
            }
        }
    }
    
    // Support Object.keys() on the collection
    static keys(collection) {
        return Array.from(collection._indexById.keys());
    }
}

/**
 * MicrodataObserver - Handles DOM mutations and updates microdata collections
 */
class MicrodataObserver {
    constructor(collection) {
        this.collection = collection;
        this.observer = null;
        this.itemElementMap = new WeakMap();
    }
    
    start() {
        // Initial scan
        this._scanDocument();
        
        // Set up mutation observer
        this.observer = new MutationObserver((mutations) => {
            this._handleMutations(mutations);
        });
        
        this.observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['itemscope', 'itemtype', 'itemid', 'itemref', 'itemprop'],
            attributeOldValue: true
        });
    }
    
    stop() {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
    }
    
    _scanDocument() {
        // Find all top-level microdata items
        const items = document.querySelectorAll('[itemscope]');
        
        for (const element of items) {
            if (this.collection._isTopLevel(element)) {
                const item = new MicrodataItem(element);
                this.collection._addItem(item);
                this.itemElementMap.set(element, item);
            }
        }
    }
    
    _handleMutations(mutations) {
        const addedElements = new Set();
        const removedElements = new Set();
        const modifiedElements = new Set();
        
        for (const mutation of mutations) {
            if (mutation.type === 'childList') {
                // Handle added nodes
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        this._collectMicrodataElements(node, addedElements);
                    }
                }
                
                // Handle removed nodes
                for (const node of mutation.removedNodes) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        this._collectMicrodataElements(node, removedElements);
                    }
                }
            } else if (mutation.type === 'attributes') {
                if (mutation.target.hasAttribute('itemscope')) {
                    modifiedElements.add(mutation.target);
                }
            }
        }
        
        // Process removed elements first
        for (const element of removedElements) {
            const item = this.itemElementMap.get(element);
            if (item) {
                this.collection._removeItem(item);
                this.itemElementMap.delete(element);
            }
        }
        
        // Process added elements
        for (const element of addedElements) {
            if (this.collection._isTopLevel(element) && !this.itemElementMap.has(element)) {
                const item = new MicrodataItem(element);
                this.collection._addItem(item);
                this.itemElementMap.set(element, item);
            }
        }
        
        // Process modified elements
        for (const element of modifiedElements) {
            // Re-index if ID changed
            if (element.hasAttribute('id')) {
                this.collection._refreshIndex();
            }
        }
    }
    
    _collectMicrodataElements(root, set) {
        if (root.hasAttribute('itemscope')) {
            set.add(root);
        }
        
        const items = root.querySelectorAll('[itemscope]');
        for (const item of items) {
            set.add(item);
        }
    }
}

/**
 * Initialize microdata API on document
 */
function initializeMicrodataAPI() {
    if (typeof document === 'undefined') {
        return;
    }
    
    // Create the main collection
    const microdataCollection = new MicrodataCollection();
    
    // Set up the observer
    const observer = new MicrodataObserver(microdataCollection);
    
    // Add microdata property to document
    Object.defineProperty(document, 'microdata', {
        get() {
            return microdataCollection;
        },
        configurable: true
    });
    
    // Add microdata property to elements
    Object.defineProperty(Element.prototype, 'microdata', {
        get() {
            if (this.hasAttribute('itemscope')) {
                // Check if we already have a MicrodataItem for this element
                const existingItem = observer.itemElementMap.get(this);
                if (existingItem) {
                    return existingItem;
                }
                // Create a new one if not
                return new MicrodataItem(this);
            }
            return undefined;
        },
        configurable: true
    });
    
    // Start observing when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            observer.start();
        });
    } else {
        observer.start();
    }
}

// Initialize the API
initializeMicrodataAPI();

// Main Microdata namespace
const Microdata = {
    MicrodataItem,
    MicrodataCollection,
    
    // Schema classes will be defined below
    Schema: null, // Will be set after class definitions
    
    Template: class Template {
        constructor(element) {
            this.element = element;
            // TODO: Implement in Phase 3
        }
    },
    
    fetch: async function(url) {
        // TODO: Implement in Phase 5
        throw new Error('Microdata.fetch not yet implemented');
    }
};

/**
 * Schema Loading and Caching System
 */
const schemaCache = new Map();
const schemaLoadingPromises = new Map();

/**
 * Base Schema class - Factory that returns appropriate subclass
 */
class Schema {
    constructor(url) {
        // Factory pattern - create and return appropriate subclass
        // This is a synchronous factory that returns an unloaded schema
        
        // Determine schema type based on URL
        if (url.includes('rustybeam.net/schema/')) {
            return new RustyBeamNetSchema(url, {});
        }
        
        // Default to Schema.org
        return new SchemaOrgSchema(url, {});
    }
    
    static async load(url) {
        // Check cache first
        if (schemaCache.has(url)) {
            return schemaCache.get(url);
        }
        
        // Check if already loading
        if (schemaLoadingPromises.has(url)) {
            return schemaLoadingPromises.get(url);
        }
        
        // Start loading
        const loadingPromise = Schema._loadSchema(url);
        schemaLoadingPromises.set(url, loadingPromise);
        
        try {
            const schema = await loadingPromise;
            schemaCache.set(url, schema);
            schemaLoadingPromises.delete(url);
            return schema;
        } catch (error) {
            schemaLoadingPromises.delete(url);
            throw error;
        }
    }
    
    static async _loadSchema(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Failed to fetch schema: ${response.status}`);
            }
            
            const contentType = response.headers.get('content-type');
            let data;
            
            if (contentType && contentType.includes('application/json')) {
                data = await response.json();
            } else {
                // Try to parse as HTML and extract microdata
                const text = await response.text();
                const parser = new DOMParser();
                const doc = parser.parseFromString(text, 'text/html');
                data = Schema._extractMicrodataFromDocument(doc);
            }
            
            // Determine schema type and create appropriate instance
            return Schema._createSchemaInstance(url, data);
        } catch (error) {
            console.warn(`Failed to load schema from ${url}:`, error);
            
            // Fire error event
            const event = new CustomEvent('DOMSchemaError', {
                detail: { url, error },
                bubbles: true
            });
            
            // Find elements with this itemtype
            const elements = document.querySelectorAll(`[itemtype="${url}"]`);
            if (elements.length > 0) {
                elements[0].dispatchEvent(event);
            } else {
                document.dispatchEvent(event);
            }
            
            // Default to SchemaOrgSchema
            return new SchemaOrgSchema(url, {});
        }
    }
    
    static _extractMicrodataFromDocument(doc) {
        // Extract microdata from the document
        // This is a simplified version - would need full microdata parsing
        const items = doc.querySelectorAll('[itemscope]');
        if (items.length > 0) {
            // Return first schema definition found
            // In real implementation, would fully parse the microdata
            return {
                '@type': 'Schema',
                '@context': 'https://rustybeam.net/schema/',
                properties: []
            };
        }
        return {};
    }
    
    static _createSchemaInstance(url, data) {
        // Determine schema type based on URL or data structure
        if (url.includes('rustybeam.net/schema/') || 
            (data['@context'] && data['@context'].includes('rustybeam.net'))) {
            return new RustyBeamNetSchema(url, data);
        }
        
        // Default to Schema.org
        return new SchemaOrgSchema(url, data);
    }
    
    static clearCache() {
        schemaCache.clear();
        schemaLoadingPromises.clear();
    }
}

/**
 * Schema.org Schema - Basic property validation only
 */
class SchemaOrgSchema {
    constructor(url, data) {
        this.url = url;
        this.data = data;
        this.loaded = false;
        this.properties = this._extractProperties(data);
    }
    
    _extractProperties(data) {
        // For schema.org, extract property names from the schema
        const properties = new Set();
        
        // Simple extraction - in reality would parse schema.org format
        if (data.properties) {
            Object.keys(data.properties).forEach(prop => properties.add(prop));
        }
        
        return properties;
    }
    
    validate(obj) {
        if (!this.loaded) {
            throw new Error(`Schema ${this.url} must be loaded before validation. Call load() first.`);
        }
        
        // Extract data from object
        const data = this._extractData(obj);
        
        // Schema.org validation only checks property existence
        // All properties are optional by default
        for (const prop of Object.keys(data)) {
            if (prop.startsWith('@')) continue; // Skip JSON-LD properties
            
            // Just check if property is defined in schema (if we have schema data)
            if (this.properties.size > 0 && !this.properties.has(prop)) {
                console.warn(`Property ${prop} not defined in schema ${this.url}`);
            }
        }
        
        return true; // Schema.org schemas are permissive
    }
    
    _extractData(obj) {
        if (obj instanceof MicrodataItem) {
            return obj.toJSON();
        }
        
        if (obj instanceof HTMLFormElement) {
            // Extract form data
            const data = {};
            const formData = new FormData(obj);
            for (const [key, value] of formData.entries()) {
                if (data[key]) {
                    // Convert to array if multiple values
                    if (!Array.isArray(data[key])) {
                        data[key] = [data[key]];
                    }
                    data[key].push(value);
                } else {
                    data[key] = value;
                }
            }
            return data;
        }
        
        if (obj instanceof Element && obj.hasAttribute('itemscope')) {
            const item = new MicrodataItem(obj);
            return item.toJSON();
        }
        
        // Plain object
        return obj;
    }
    
    async load() {
        if (this.loaded) {
            return true;
        }
        
        try {
            const loadedSchema = await Schema.load(this.url);
            if (loadedSchema) {
                this.data = loadedSchema.data;
                this.properties = this._extractProperties(this.data);
                this.loaded = true;
                return true;
            }
        } catch (error) {
            console.warn(`Failed to load schema ${this.url}:`, error);
        }
        
        this.loaded = true; // Mark as loaded even on error
        return false;
    }
}

/**
 * RustyBeam.net Schema - Full validation with cardinality and patterns
 */
class RustyBeamNetSchema extends SchemaOrgSchema {
    constructor(url, data) {
        super(url, data);
        this.propertyDefinitions = new Map();
        this.dataTypes = new Map();
        this._parseSchemaData(data);
    }
    
    async load() {
        if (this.loaded) {
            return true;
        }
        
        const result = await super.load();
        if (result && this.data) {
            // Re-parse schema data after loading
            this._parseSchemaData(this.data);
            // Load all referenced DataTypes
            await this._loadDataTypes();
        }
        
        return result;
    }
    
    _parseSchemaData(data) {
        // Parse property definitions from rustybeam.net schema format
        if (data.properties && Array.isArray(data.properties)) {
            for (const prop of data.properties) {
                if (prop['@type'] === 'Property' && prop.name) {
                    this.propertyDefinitions.set(prop.name, {
                        name: prop.name,
                        type: prop.type,
                        cardinality: prop.cardinality || '0..n',
                        description: prop.description
                    });
                }
            }
        }
        
        // In real implementation, would also load referenced DataTypes
    }
    
    validate(obj) {
        if (!this.loaded) {
            throw new Error(`Schema ${this.url} must be loaded before validation. Call load() first.`);
        }
        
        const data = this._extractData(obj);
        let isValid = true;
        
        // Validate each property against schema
        for (const [propName, propDef] of this.propertyDefinitions) {
            const value = data[propName];
            
            // Check cardinality
            if (!this._validateCardinality(value, propDef.cardinality)) {
                console.warn(`Property ${propName} fails cardinality ${propDef.cardinality}`);
                isValid = false;
                
                // Fire validation event
                this._fireValidationError(obj, propName, 'cardinality', propDef.cardinality);
            }
            
            // Check data type (if we have the DataType loaded)
            if (value !== undefined && propDef.type) {
                const dataType = this.dataTypes.get(propDef.type);
                if (dataType && !this._validateDataType(value, dataType)) {
                    console.warn(`Property ${propName} fails type validation`);
                    isValid = false;
                    
                    this._fireValidationError(obj, propName, 'type', propDef.type);
                }
                // Note: If DataType is not loaded, we skip validation for it
            }
        }
        
        return isValid;
    }
    
    _validateCardinality(value, cardinality) {
        const count = value === undefined ? 0 : 
                     Array.isArray(value) ? value.length : 1;
        
        // Parse cardinality (e.g., "1", "0..1", "1..n", "0..n")
        if (cardinality === '1') {
            return count === 1;
        } else if (cardinality === '0..1') {
            return count <= 1;
        } else if (cardinality === '1..n') {
            return count >= 1;
        } else if (cardinality === '0..n' || !cardinality) {
            return true; // Any count is valid
        }
        
        // Try to parse numeric range
        const match = cardinality.match(/^(\d+)\.\.(\d+|\*)$/);
        if (match) {
            const min = parseInt(match[1]);
            const max = match[2] === '*' ? Infinity : parseInt(match[2]);
            return count >= min && count <= max;
        }
        
        return true; // Unknown format, be permissive
    }
    
    async _loadDataType(typeUrl) {
        if (this.dataTypes.has(typeUrl)) {
            return this.dataTypes.get(typeUrl);
        }
        
        try {
            // Load the DataType schema
            const schema = await Schema.load(typeUrl);
            if (schema && schema.data) {
                const dataType = {
                    url: typeUrl,
                    validationPattern: schema.data.validationPattern
                };
                this.dataTypes.set(typeUrl, dataType);
                return dataType;
            }
        } catch (error) {
            console.warn(`Failed to load DataType ${typeUrl}:`, error);
        }
        
        return null;
    }
    
    async _loadDataTypes() {
        // Load all referenced DataTypes during schema loading
        for (const [propName, propDef] of this.propertyDefinitions) {
            if (propDef.type) {
                await this._loadDataType(propDef.type);
            }
        }
    }
    
    _validateDataType(value, dataType) {
        if (!dataType.validationPattern) {
            return true; // No pattern means valid
        }
        
        const values = Array.isArray(value) ? value : [value];
        const pattern = new RegExp(dataType.validationPattern);
        
        return values.every(v => {
            const stringValue = String(v);
            return pattern.test(stringValue);
        });
    }
    
    _fireValidationError(obj, property, type, expected) {
        const event = new CustomEvent('DOMSchemaInvalidData', {
            detail: {
                property,
                type,
                expected,
                schema: this.url
            },
            bubbles: true
        });
        
        // Find the element with this itemprop
        if (obj instanceof Element) {
            const propElement = obj.querySelector(`[itemprop~="${property}"]`);
            if (propElement) {
                propElement.dispatchEvent(event);
                return;
            }
            obj.dispatchEvent(event);
        } else {
            document.dispatchEvent(event);
        }
    }
}

// Set the Schema class on Microdata
Microdata.Schema = Schema;

// Initialize schema loading on DOM ready
let schemasLoading = false;

function loadAllSchemas() {
    if (schemasLoading) return;
    schemasLoading = true;
    
    // Find all unique itemtype URLs
    const itemtypes = new Set();
    document.querySelectorAll('[itemtype]').forEach(el => {
        const itemtype = el.getAttribute('itemtype');
        if (itemtype) {
            itemtypes.add(itemtype);
        }
    });
    
    // Load all schemas
    const promises = Array.from(itemtypes).map(url => 
        Schema.load(url).catch(err => {
            console.warn(`Failed to load schema ${url}:`, err);
            return null;
        })
    );
    
    // Fire event when all loaded
    Promise.all(promises).then(() => {
        document.dispatchEvent(new Event('DOMSchemasLoaded'));
    });
}

// Load schemas when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadAllSchemas);
} else {
    loadAllSchemas();
}

// Update MicrodataItem validate method
MicrodataItem.prototype.validate = async function() {
    const itemtype = this._element.getAttribute('itemtype');
    if (!itemtype) {
        return true; // No schema to validate against
    }
    
    try {
        const schema = await Schema.load(itemtype);
        return schema.validate(this);
    } catch (error) {
        console.warn(`Failed to validate against schema ${itemtype}:`, error);
        return true; // Be permissive on error
    }
};

// Export for use
export { Microdata, MicrodataItem, MicrodataCollection, Schema, SchemaOrgSchema, RustyBeamNetSchema };
export default Microdata;

// Set up globals
if (typeof window !== 'undefined') {
    window.Microdata = Microdata;
    window.Microdata.Schema = Schema;
    window.Microdata.Template = Microdata.Template;
}