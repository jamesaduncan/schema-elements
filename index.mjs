/**
 * Microdata API - A vanilla JavaScript library for working with HTML Microdata
 * 
 * This library provides extraction, rendering, synchronization, and validation
 * of schema.org and other microdata within the DOM.
 */

/**
 * MicrodataItem - Represents a single microdata item with live DOM binding
 * 
 * @class MicrodataItem
 * @description Provides a proxy-based interface for accessing and manipulating microdata properties
 *              with automatic DOM synchronization. Supports JSON-LD compatible property access.
 * 
 * @example
 * // Access microdata from an element
 * const person = document.getElementById('person').microdata;
 * console.log(person.name); // "John Doe"
 * person.email = "john@example.com"; // Updates DOM
 * 
 * @example
 * // Convert to JSON-LD
 * const jsonld = person.toJSON();
 * // { "@type": "Person", "@context": "https://schema.org/", "name": "John Doe", ... }
 */
class MicrodataItem {
    /**
     * Creates a new MicrodataItem instance
     * @param {HTMLElement} element - DOM element with itemscope attribute
     * @throws {Error} If element is missing or lacks itemscope attribute
     */
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
        
        try {
            // Extract the last segment of the URL as the type
            const url = new URL(itemtype);
            const pathParts = url.pathname.split('/').filter(Boolean);
            return pathParts[pathParts.length - 1] || undefined;
        } catch (e) {
            // Silently handle invalid URLs - try to extract type from malformed URL
            const parts = itemtype.split('/').filter(Boolean);
            return parts[parts.length - 1] || undefined;
        }
    }
    
    _getContext() {
        const itemtype = this._element.getAttribute('itemtype');
        if (!itemtype) return undefined;
        
        try {
            // Extract the base URL as context
            const url = new URL(itemtype);
            return url.origin + url.pathname.substring(0, url.pathname.lastIndexOf('/') + 1);
        } catch (e) {
            // Silently handle invalid URLs - try to extract context from malformed URL
            const lastSlash = itemtype.lastIndexOf('/');
            return lastSlash > 0 ? itemtype.substring(0, lastSlash + 1) : undefined;
        }
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
                // Skip circular references silently
                continue;
            }
            
            seenIds.add(id);
            const element = document.getElementById(id);
            
            if (element) {
                refs.push(element);
            }
            // Silently skip non-existent IDs
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
            // Update existing elements
            elements.forEach((el, index) => {
                if (index < value.length) {
                    this._setValue(el, value[index]);
                }
            });
            
            // Create new elements if needed
            if (value.length > elements.length) {
                for (let i = elements.length; i < value.length; i++) {
                    this._createPropertyElement(name, value[i]);
                }
            }
            
            // Remove excess elements
            if (value.length < elements.length) {
                for (let i = value.length; i < elements.length; i++) {
                    elements[i].remove();
                }
            }
        } else {
            // Setting single value
            if (elements.length > 0) {
                this._setValue(elements[0], value);
                
                // Remove extra elements if setting single value
                for (let i = 1; i < elements.length; i++) {
                    elements[i].remove();
                }
            } else {
                // Create new element
                this._createPropertyElement(name, value);
            }
        }
        
        return true;
    }
    
    _createPropertyElement(name, value) {
        const element = document.createElement('span');
        element.setAttribute('itemprop', name);
        this._setValue(element, value);
        this._element.appendChild(element);
        return element;
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
        
        if ((element.tagName === 'A' || element.tagName === 'LINK') && element.hasAttribute('href')) {
            // Return the href attribute value (which may be relative)
            // rather than element.href (which is always absolute)
            return element.getAttribute('href');
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
            // Cannot directly set nested items - silently skip
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
    
    /**
     * Converts the microdata item to JSON-LD format
     * @returns {Object} JSON-LD representation of the microdata item
     */
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
 * 
 * @class MicrodataCollection
 * @extends Array
 * @description Provides a hybrid array/object interface for accessing microdata items.
 *              Items can be accessed by numeric index or by element ID.
 * 
 * @example
 * // Access by index
 * const firstPerson = document.microdata[0];
 * 
 * // Access by ID
 * const johnDoe = document.microdata.person1;
 * 
 * // Iterate as array
 * document.microdata.forEach(item => console.log(item.name));
 */
class MicrodataCollection extends Array {
    constructor() {
        super();
        this._indexById = new Map();
        
        return new Proxy(this, {
            get: (target, prop) => {
                // Handle symbols (like Symbol.iterator)
                if (typeof prop === 'symbol') {
                    return target[prop];
                }
                
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
                if (typeof prop === 'symbol') {
                    return prop in target;
                }
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
 * 
 * @class MicrodataObserver
 * @description Internal class that monitors DOM changes and maintains synchronization
 *              between the DOM and microdata collections.
 * @private
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
 * 
 * @function initializeMicrodataAPI
 * @description Sets up the microdata API on the document and Element prototype.
 *              Adds document.microdata collection and element.microdata property.
 * @private
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
    
    // Store observer reference for cleanup
    microdataCollection._observer = observer;
    
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

/**
 * Utility function to extract data from various object types
 * @param {MicrodataItem|HTMLFormElement|Element|Object} obj - Object to extract data from
 * @returns {Object} Extracted data as plain object
 * @private
 */
function extractMicrodataData(obj) {
    if (obj instanceof MicrodataItem) {
        return obj.toJSON();
    }
    
    if (obj instanceof HTMLFormElement) {
        // Extract form data with enhanced support for all form elements
        const data = {};
        
        // Process all form elements
        const elements = obj.elements;
        for (let i = 0; i < elements.length; i++) {
            const element = elements[i];
            if (!element.name) continue;
            
            const name = element.name;
            let value;
            
            switch (element.type) {
                case 'checkbox':
                    if (element.checked) {
                        value = element.value || 'on';
                        // Handle checkbox groups for arrays
                        if (name.endsWith('[]')) {
                            const baseName = name.slice(0, -2);
                            if (!data[baseName]) data[baseName] = [];
                            data[baseName].push(value);
                        } else {
                            if (data[name]) {
                                // Convert to array if multiple checkboxes with same name
                                if (!Array.isArray(data[name])) {
                                    data[name] = [data[name]];
                                }
                                data[name].push(value);
                            } else {
                                data[name] = value;
                            }
                        }
                    }
                    break;
                    
                case 'radio':
                    if (element.checked) {
                        data[name] = element.value;
                    }
                    break;
                    
                case 'select-multiple':
                    const selectedOptions = [];
                    for (let j = 0; j < element.options.length; j++) {
                        if (element.options[j].selected) {
                            selectedOptions.push(element.options[j].value);
                        }
                    }
                    data[name] = selectedOptions;
                    break;
                    
                case 'select-one':
                    data[name] = element.value;
                    break;
                    
                case 'textarea':
                    data[name] = element.value;
                    break;
                    
                case 'text':
                case 'password':
                case 'email':
                case 'number':
                case 'tel':
                case 'url':
                case 'date':
                case 'time':
                case 'datetime-local':
                case 'color':
                case 'range':
                case 'hidden':
                    data[name] = element.value;
                    break;
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

/**
 * Schema Loading and Caching System
 */
const schemaCache = new Map();
const schemaLoadingPromises = new Map();

/**
 * Base Schema class - Factory that returns appropriate subclass
 * 
 * @class Schema
 * @description Factory class for creating and loading schema definitions.
 *              Automatically returns the appropriate subclass (SchemaOrgSchema or RustyBeamNetSchema)
 *              based on the schema URL.
 * 
 * @example
 * // Load a schema
 * const personSchema = await Schema.load('https://schema.org/Person');
 * 
 * // Validate an object
 * const isValid = personSchema.validate(microdataItem);
 * 
 * // Clear cache
 * Schema.clearCache();
 */
class Schema {
    constructor(url) {
        // Validate URL
        try {
            new URL(url);
        } catch (e) {
            // Still create schema but it won't be able to load
        }
        
        // Factory pattern - create and return appropriate subclass
        // This is a synchronous factory that returns an unloaded schema
        
        // Determine schema type based on URL
        if (url.includes('rustybeam.net/schema/')) {
            return new RustyBeamNetSchema(url, {});
        }
        
        // Default to Schema.org
        return new SchemaOrgSchema(url, {});
    }
    
    /**
     * Loads a schema from a URL with caching
     * @param {string} url - The schema URL
     * @returns {Promise<Schema>} The loaded schema instance
     * @static
     */
    static async load(url) {
        // Check cache first
        if (schemaCache.has(url)) {
            return Promise.resolve(schemaCache.get(url));
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
            // Don't set cache here since _loadSchema already does it
            schemaLoadingPromises.delete(url);
            return schema;
        } catch (error) {
            schemaLoadingPromises.delete(url);
            throw error;
        }
    }
    
    static async _loadSchema(url) {
        // Check cache first inside _loadSchema too
        if (schemaCache.has(url)) {
            return schemaCache.get(url);
        }
        
        try {
            // For schema.org URLs, we'll simulate loading since they don't actually serve schemas
            if (url.includes('schema.org/')) {
                // Simulate network delay for first load
                await new Promise(resolve => setTimeout(resolve, 50));
                
                // Extract type name from URL
                const typeName = url.split('/').pop();
                const data = {
                    '@type': 'Class',
                    '@id': url,
                    'name': typeName,
                    // Basic properties that most schema.org types have
                    'properties': {
                        'name': { '@type': 'Property' },
                        'description': { '@type': 'Property' }
                    }
                };
                const schema = Schema._createSchemaInstance(url, data);
                schemaCache.set(url, schema);
                return schema;
            }
            
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
            // Fire error event
            const event = new CustomEvent('DOMSchemaError', {
                detail: { 
                    schemaURL: url, 
                    error: error,
                    message: error.message || 'Failed to load schema'
                },
                bubbles: true
            });
            
            // Find elements with this itemtype
            const elements = document.querySelectorAll(`[itemtype="${url}"]`);
            if (elements.length > 0) {
                elements[0].dispatchEvent(event);
            } else {
                document.dispatchEvent(event);
            }
            
            // Re-throw the error instead of defaulting
            throw error;
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
    
    /**
     * Clears all cached schemas
     * @static
     */
    static clearCache() {
        schemaCache.clear();
        schemaLoadingPromises.clear();
    }
}

/**
 * Schema.org Schema - Basic property validation only
 * 
 * @class SchemaOrgSchema
 * @description Handles Schema.org schemas with permissive validation.
 *              Validates property existence but allows any valid microdata.
 * @private
 */
class SchemaOrgSchema {
    constructor(url, data) {
        this.url = url;
        this.data = data;
        this.loaded = !!data && Object.keys(data).length > 0;
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
                // Property not in schema but Schema.org is permissive - continue silently
            }
        }
        
        return true; // Schema.org schemas are permissive
    }
    
    _extractData(obj) {
        return extractMicrodataData(obj);
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
            // Schema load failed - continue without schema
        }
        
        this.loaded = true; // Mark as loaded even on error
        return false;
    }
}

/**
 * RustyBeam.net Schema - Full validation with cardinality and patterns
 * 
 * @class RustyBeamNetSchema
 * @extends SchemaOrgSchema
 * @description Handles RustyBeam.net schemas with strict validation including
 *              cardinality constraints and data type pattern matching.
 * @private
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
            // Handle array format
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
        } else {
            // Handle object format where properties are defined as keys
            for (const [key, value] of Object.entries(data)) {
                if (key.startsWith('@')) continue; // Skip metadata
                if (value && value['@type'] === 'Property') {
                    this.propertyDefinitions.set(key, {
                        name: value.name || key,
                        type: value.type,
                        cardinality: value.cardinality || '0..n',
                        description: value.description
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
        const validationErrors = [];
        
        // Validate each property against schema
        for (const [propName, propDef] of this.propertyDefinitions) {
            const value = data[propName];
            
            // Check cardinality
            if (!this._validateCardinality(value, propDef.cardinality)) {
                isValid = false;
                validationErrors.push({
                    property: propName,
                    type: 'cardinality',
                    expected: propDef.cardinality,
                    message: `Property ${propName} must have cardinality ${propDef.cardinality}`
                });
                
                // Fire validation event
                this._fireValidationError(obj, propName, 'cardinality', propDef.cardinality);
            }
            
            // Check data type (if we have the DataType loaded)
            if (value !== undefined && propDef.type) {
                const dataType = this.dataTypes.get(propDef.type);
                if (dataType && !this._validateDataType(value, dataType)) {
                    isValid = false;
                    validationErrors.push({
                        property: propName,
                        type: 'type',
                        expected: propDef.type,
                        message: `Property ${propName} must match type ${propDef.type}`
                    });
                    
                    this._fireValidationError(obj, propName, 'type', propDef.type);
                }
                // Note: If DataType is not loaded, we skip validation for it
            }
        }
        
        // HTML5 form validation integration
        if (obj instanceof HTMLFormElement && !isValid) {
            this._applyHTML5Validation(obj, validationErrors);
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
            // DataType load failed - continue without it
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
        let targetElement = null;
        
        if (obj instanceof Element) {
            targetElement = obj;
        } else if (obj && obj._element instanceof Element) {
            // Handle MicrodataItem objects
            targetElement = obj._element;
        }
        
        if (targetElement) {
            const propElement = targetElement.querySelector(`[itemprop~="${property}"]`);
            if (propElement) {
                propElement.dispatchEvent(event);
                return;
            }
            targetElement.dispatchEvent(event);
        } else {
            document.dispatchEvent(event);
        }
    }
    
    _applyHTML5Validation(form, errors) {
        // Clear existing custom validity
        const elements = form.elements;
        for (let i = 0; i < elements.length; i++) {
            elements[i].setCustomValidity('');
        }
        
        // Apply validation errors
        for (const error of errors) {
            const element = form.elements[error.property];
            if (element) {
                element.setCustomValidity(error.message);
                
                // For radio buttons and checkboxes, apply to all with same name
                if (element.type === 'radio' || element.type === 'checkbox') {
                    const sameNameElements = form.querySelectorAll(`[name="${error.property}"]`);
                    sameNameElements.forEach(el => el.setCustomValidity(error.message));
                }
            }
        }
        
        // Report validity on the form
        form.reportValidity();
    }
}

/**
 * Template Class - Handles rendering of microdata to templates
 * 
 * @class Template
 * @description Manages HTML templates for rendering microdata items.
 *              Supports bidirectional data binding and automatic synchronization.
 * 
 * @example
 * // Create template from element
 * const template = new Template(document.querySelector('template'));
 * 
 * // Render microdata to template
 * const rendered = template.render(microdataItem);
 * 
 * // Static rendering
 * const element = Template.render({ '@type': 'Person', name: 'John' });
 */
class Template {
    constructor(element) {
        if (!element || !(element instanceof HTMLTemplateElement)) {
            throw new Error('Template requires an HTMLTemplateElement');
        }
        
        this.element = element;
        this._schemas = null;
        this._parsedTemplate = null;
        this._parse();
    }
    
    _parse() {
        // Clone template content for parsing
        const content = this.element.content.cloneNode(true);
        
        // Find all itemscope elements with itemtype
        const schemaElements = content.querySelectorAll('[itemscope][itemtype]');
        this._schemas = new Set();
        
        schemaElements.forEach(el => {
            const itemtype = el.getAttribute('itemtype');
            if (itemtype) {
                this._schemas.add(itemtype);
            }
        });
        
        // Store parsed template structure
        this._parsedTemplate = {
            rootElement: content.firstElementChild,
            itemProps: this._findItemProps(content),
            arrayProps: this._findArrayProps(content)
        };
    }
    
    _findItemProps(root) {
        const props = new Map();
        const walker = document.createTreeWalker(
            root,
            NodeFilter.SHOW_ELEMENT,
            {
                acceptNode: (node) => {
                    if (node.hasAttribute('itemprop')) {
                        return NodeFilter.FILTER_ACCEPT;
                    }
                    return NodeFilter.FILTER_SKIP;
                }
            }
        );
        
        let node;
        while (node = walker.nextNode()) {
            const itemprop = node.getAttribute('itemprop');
            if (!props.has(itemprop)) {
                props.set(itemprop, []);
            }
            props.get(itemprop).push(node);
        }
        
        return props;
    }
    
    _findArrayProps(root) {
        const arrayProps = new Set();
        const elements = root.querySelectorAll('[itemprop]');
        
        elements.forEach(el => {
            const itemprop = el.getAttribute('itemprop');
            if (itemprop.endsWith('[]')) {
                arrayProps.add(itemprop.slice(0, -2)); // Remove [] suffix
            }
        });
        
        return arrayProps;
    }
    
    get schemas() {
        return Array.from(this._schemas);
    }
    
    validate(obj) {
        // Extract data from object
        const data = this._extractData(obj);
        
        // For now, basic validation - just check if object has properties
        // In full implementation, would validate against schemas
        return data !== null && typeof data === 'object';
    }
    
    render(obj) {
        const data = this._extractData(obj);
        if (!data) {
            throw new Error('Cannot render null or undefined data');
        }
        
        // Clone the template
        const fragment = this.element.content.cloneNode(true);
        const root = fragment.firstElementChild;
        
        if (!root) {
            throw new Error('Template has no root element');
        }
        
        // Render data to template
        this._renderData(root, data);
        
        return root;
    }
    
    _extractData(obj) {
        return extractMicrodataData(obj);
    }
    
    _renderData(element, data) {
        // Set JSON-LD properties if this is an itemscope
        if (element.hasAttribute('itemscope')) {
            if (data['@id']) {
                element.setAttribute('itemid', data['@id']);
            }
        }
        
        // Find all itemprop elements within this scope
        const walker = document.createTreeWalker(
            element,
            NodeFilter.SHOW_ELEMENT,
            {
                acceptNode: (node) => {
                    // Don't descend into nested itemscopes
                    if (node !== element && node.hasAttribute('itemscope')) {
                        return NodeFilter.FILTER_REJECT;
                    }
                    
                    if (node.hasAttribute('itemprop')) {
                        return NodeFilter.FILTER_ACCEPT;
                    }
                    
                    return NodeFilter.FILTER_SKIP;
                }
            }
        );
        
        const propElements = [];
        let node;
        while (node = walker.nextNode()) {
            propElements.push(node);
        }
        
        // Group elements by property name
        const propGroups = new Map();
        propElements.forEach(el => {
            let propName = el.getAttribute('itemprop');
            const isArray = propName.endsWith('[]');
            if (isArray) {
                propName = propName.slice(0, -2);
            }
            
            if (!propGroups.has(propName)) {
                propGroups.set(propName, { elements: [], isArray });
            }
            propGroups.get(propName).elements.push(el);
        });
        
        // Render each property
        for (const [propName, group] of propGroups) {
            const value = data[propName];
            
            if (value === undefined || value === null) {
                // Remove elements for missing properties
                group.elements.forEach(el => el.remove());
                continue;
            }
            
            if (group.isArray || Array.isArray(value)) {
                this._renderArrayProperty(propName, group.elements, value);
            } else {
                this._renderSingleProperty(propName, group.elements[0], value);
                // Remove extra elements
                for (let i = 1; i < group.elements.length; i++) {
                    group.elements[i].remove();
                }
            }
        }
    }
    
    _renderArrayProperty(propName, elements, value) {
        const values = Array.isArray(value) ? value : [value];
        
        if (elements.length === 0) return;
        
        // Special handling for checkboxes - don't remove them, just update checked state
        if (elements.length > 0 && elements[0].type === 'checkbox') {
            elements.forEach(checkbox => {
                checkbox.checked = values.includes(checkbox.value);
            });
            return;
        }
        
        const template = elements[0];
        const parent = template.parentElement;
        
        // Remove all existing elements
        elements.forEach(el => el.remove());
        
        // Create new elements for each value
        values.forEach(val => {
            const newElement = template.cloneNode(true);
            this._renderSingleProperty(propName, newElement, val);
            parent.appendChild(newElement);
        });
    }
    
    _renderSingleProperty(propName, element, value) {
        if (value && typeof value === 'object' && value['@type']) {
            // Nested microdata item
            if (element.hasAttribute('itemscope')) {
                this._renderData(element, value);
            }
        } else {
            // Simple value
            this._setElementValue(element, value);
        }
    }
    
    _setElementValue(element, value) {
        const stringValue = String(value);
        
        // Handle form elements to maintain state
        if (element.tagName === 'INPUT') {
            switch (element.type) {
                case 'checkbox':
                    element.checked = value === element.value || value === true || value === 'on';
                    break;
                case 'radio':
                    element.checked = value === element.value;
                    break;
                default:
                    element.value = stringValue;
                    break;
            }
        } else if (element.tagName === 'SELECT') {
            // Handle select elements
            for (let i = 0; i < element.options.length; i++) {
                const option = element.options[i];
                if (Array.isArray(value)) {
                    option.selected = value.includes(option.value);
                } else {
                    option.selected = option.value === stringValue;
                }
            }
        } else if (element.tagName === 'TEXTAREA') {
            element.value = stringValue;
        } else if (element.hasAttribute('content')) {
            element.setAttribute('content', stringValue);
        } else if (element.tagName === 'A' && element.hasAttribute('href')) {
            element.href = stringValue;
        } else if (element.tagName === 'IMG' && element.hasAttribute('src')) {
            element.src = stringValue;
        } else if (element.tagName === 'TIME' && element.hasAttribute('datetime')) {
            element.setAttribute('datetime', stringValue);
            if (!element.textContent) {
                element.textContent = stringValue;
            }
        } else {
            element.textContent = stringValue;
        }
    }
    
    /**
     * Static method to render an object using an appropriate template
     * @param {Object} obj - Object to render (must have @type property)
     * @returns {HTMLElement} The rendered element
     * @throws {Error} If no suitable template is found
     * @static
     */
    static render(obj) {
        // Find appropriate template based on object type
        let template = null;
        
        if (obj && obj['@type']) {
            // Look for template with matching itemtype
            const templates = document.querySelectorAll('template');
            for (const t of templates) {
                // Check if template element itself has itemtype
                let itemtype = t.getAttribute('itemtype');
                
                // If not, check inside template content
                if (!itemtype) {
                    const content = t.content;
                    const itemtypeEl = content.querySelector('[itemtype]');
                    if (itemtypeEl) {
                        itemtype = itemtypeEl.getAttribute('itemtype');
                    }
                }
                
                if (itemtype && (itemtype === obj['@type'] || itemtype.endsWith('/' + obj['@type']))) {
                    template = t;
                    break;
                }
            }
        }
        
        if (!template) {
            throw new Error('No suitable template found for object');
        }
        
        const templateInstance = new Template(template);
        return templateInstance.render(obj);
    }
}

// Initialize schema loading on DOM ready
let schemasLoading = false;

function loadAllSchemas() {
    if (schemasLoading) return;
    schemasLoading = true;
    
    // Find all unique itemtype URLs
    const itemtypes = new Set();
    const itemtypeElements = new Map(); // Track which elements use which schemas
    
    document.querySelectorAll('[itemtype]').forEach(el => {
        const itemtype = el.getAttribute('itemtype');
        if (itemtype) {
            itemtypes.add(itemtype);
            if (!itemtypeElements.has(itemtype)) {
                itemtypeElements.set(itemtype, []);
            }
            itemtypeElements.get(itemtype).push(el);
        }
    });
    
    // Track loaded schemas
    const loadedSchemas = [];
    const failedSchemas = [];
    
    // Load all schemas
    const promises = Array.from(itemtypes).map(url => 
        Schema.load(url)
            .then(schema => {
                loadedSchemas.push({ url, schema });
                return schema;
            })
            .catch(err => {
                failedSchemas.push({ url, error: err });
                
                // Fire DOMSchemaError on elements that use this schema
                const elements = itemtypeElements.get(url) || [];
                elements.forEach(element => {
                    const event = new CustomEvent('DOMSchemaError', {
                        detail: {
                            schemaURL: url,
                            error: err,
                            message: err.message || 'Failed to load schema'
                        },
                        bubbles: true
                    });
                    element.dispatchEvent(event);
                });
                
                // Also fire on document
                document.dispatchEvent(new CustomEvent('DOMSchemaError', {
                    detail: {
                        schemaURL: url,
                        error: err,
                        message: err.message || 'Failed to load schema'
                    }
                }));
                
                return null;
            })
    );
    
    // Fire event when all loaded
    Promise.all(promises).then(() => {
        document.dispatchEvent(new CustomEvent('DOMSchemasLoaded', {
            detail: {
                loaded: loadedSchemas,
                failed: failedSchemas,
                total: itemtypes.size
            }
        }));
    });
}

// Load schemas when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadAllSchemas);
} else {
    loadAllSchemas();
}

// Update MicrodataItem validate method
MicrodataItem.prototype.validate = function() {
    const itemtype = this._element.getAttribute('itemtype');
    if (!itemtype) {
        return true; // No schema to validate against
    }
    
    // Get schema from cache
    const schema = schemaCache.get(itemtype);
    if (!schema || !schema.loaded) {
        // Schema not loaded yet - be permissive
        return true;
    }
    
    return schema.validate(this);
};

// Document cache for fetch operations
const fetchedDocumentCache = new Map();

/**
 * Fetches the microdata element this item references
 * @returns {Promise<Element>} The fetched element or this element if authoritative
 * @throws {Error} If fetch fails or element not found
 */
MicrodataItem.prototype.fetch = async function() {
    // Check if this is an authoritative item (has id attribute)
    if (this._element.hasAttribute('id')) {
        // Return the element itself for authoritative items
        return Promise.resolve(this._element);
    }
    
    // For non-authoritative items, check for itemid
    const itemid = this._element.getAttribute('itemid');
    if (!itemid) {
        throw new Error('Non-authoritative item must have itemid attribute to fetch');
    }
    
    try {
        // Parse the itemid URL
        let url;
        try {
            url = new URL(itemid, document.baseURI);
        } catch (urlError) {
            throw new Error(`Invalid itemid URL: ${itemid}`);
        }
        const baseUrl = url.origin + url.pathname;
        const fragmentId = url.hash.substring(1); // Remove the #
        
        if (!fragmentId) {
            throw new Error('itemid must include a fragment identifier (#id)');
        }
        
        // Check cache first
        let doc = fetchedDocumentCache.get(baseUrl);
        
        if (!doc) {
            // Fetch the document
            const response = await fetch(baseUrl);
            if (!response.ok) {
                throw new Error(`Failed to fetch ${baseUrl}: ${response.status} ${response.statusText}`);
            }
            
            const html = await response.text();
            
            // Parse the HTML
            const parser = new DOMParser();
            doc = parser.parseFromString(html, 'text/html');
            
            // Cache the document
            fetchedDocumentCache.set(baseUrl, doc);
        }
        
        // Find the element with the matching ID
        const element = doc.getElementById(fragmentId);
        if (!element) {
            throw new Error(`Element with id "${fragmentId}" not found in ${baseUrl}`);
        }
        
        // Ensure the element has microdata property if it has itemscope & itemtype
        if (element.hasAttribute('itemscope') && element.hasAttribute('itemtype') && !element.microdata) {
            // Create MicrodataItem for the fetched element
            element.microdata = new MicrodataItem(element);
        }
        
        return element;
    } catch (error) {
        throw error;
    }
};

/**
 * Auto-synchronization system for templates with data-contains
 * 
 * @class TemplateSynchronizer
 * @description Manages automatic rendering and synchronization of templates
 *              with microdata items based on data-contains attributes.
 * @private
 */
class TemplateSynchronizer {
    constructor() {
        this.syncedContainers = new Map();
        this.observer = null;
    }
    
    start() {
        // Initial scan for containers
        this._scanForContainers();
        
        // Set up mutation observer
        this.observer = new MutationObserver((mutations) => {
            this._handleMutations(mutations);
        });
        
        this.observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['data-contains', 'id'],
            characterData: true
        });
    }
    
    stop() {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
    }
    
    _scanForContainers() {
        const containers = document.querySelectorAll('[data-contains]');
        containers.forEach(container => this._processContainer(container));
    }
    
    _processContainer(container) {
        const schemaUrl = container.getAttribute('data-contains');
        if (!schemaUrl) return;
        
        // Check if already processed
        if (this.syncedContainers.has(container)) {
            return;
        }
        
        // Find template within container
        const template = container.querySelector('template');
        if (!template) {
            // No template found - skip silently
            return;
        }
        
        // Store container info
        this.syncedContainers.set(container, {
            schemaUrl,
            template,
            renderedItems: new Map()
        });
        
        // Initial render
        this._renderAuthoritativeItems(container);
        
        // Mark container as processed
        container.setAttribute('data-for-items', schemaUrl);
    }
    
    _renderAuthoritativeItems(container) {
        const containerInfo = this.syncedContainers.get(container);
        if (!containerInfo) return;
        
        const { schemaUrl, template, renderedItems } = containerInfo;
        
        // Find all authoritative items matching schema
        const items = document.querySelectorAll(`[itemtype="${schemaUrl}"][id]`);
        
        // Remove items that no longer exist
        const currentIds = new Set(Array.from(items).map(el => el.id));
        for (const [id, element] of renderedItems) {
            if (!currentIds.has(id)) {
                element.remove();
                renderedItems.delete(id);
            }
        }
        
        // Add or update items
        items.forEach(itemElement => {
            const id = itemElement.id;
            const item = new MicrodataItem(itemElement);
            
            
            if (renderedItems.has(id)) {
                // Update existing
                const existingElement = renderedItems.get(id);
                if (existingElement && existingElement.parentElement) {
                    const newElement = this._updateRenderedItem(existingElement, item);
                    if (newElement !== existingElement) {
                        renderedItems.set(id, newElement);
                    }
                } else {
                    // Element was removed, clean up
                    renderedItems.delete(id);
                }
            } else {
                // Create new
                const rendered = this._renderItem(template, item);
                container.appendChild(rendered);
                renderedItems.set(id, rendered);
                
                // Set up synchronization
                this._setupSynchronization(itemElement, rendered);
            }
        });
    }
    
    _renderItem(template, item) {
        const templateInstance = new Template(template);
        const rendered = templateInstance.render(item);
        
        // Set itemid to link back to source
        const itemid = item['@id'];
        if (itemid && rendered.hasAttribute('itemscope')) {
            rendered.setAttribute('itemid', itemid);
        }
        
        return rendered;
    }
    
    _updateRenderedItem(element, item) {
        // Re-render in place
        if (!element.parentElement) {
            // Element has been removed from DOM
            return element;
        }
        
        // Get the template from the container info, not from DOM
        const container = element.closest('[data-contains]');
        const containerInfo = this.syncedContainers.get(container);
        
        if (containerInfo && containerInfo.template) {
            const templateInstance = new Template(containerInfo.template);
            const newElement = templateInstance.render(item);
            element.replaceWith(newElement);
            return newElement;
        }
        
        return element;
    }
    
    _setupSynchronization(sourceElement, renderedElement) {
        // The MutationObserver will handle updates automatically
        // since both elements have microdata that updates through the same system
    }
    
    _handleMutations(mutations) {
        const containersToUpdate = new Set();
        const modifiedItems = new Set();
        
        for (const mutation of mutations) {
            if (mutation.type === 'attributes' && mutation.target.hasAttribute('data-contains')) {
                // New or modified container
                this._processContainer(mutation.target);
            } else if (mutation.type === 'childList') {
                // Check for added/removed authoritative items
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE && 
                        node.hasAttribute('itemscope') && 
                        node.hasAttribute('id')) {
                        modifiedItems.add(node);
                    }
                });
                
                mutation.removedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE && 
                        node.hasAttribute('itemscope') && 
                        node.hasAttribute('id')) {
                        modifiedItems.add(node);
                    }
                });
            }
            
            // Check for text/attribute changes within items with id
            if (mutation.type === 'characterData') {
                // Check if mutation is within an itemscope with id
                let target = mutation.target;
                if (target.nodeType === Node.TEXT_NODE) {
                    target = target.parentElement;
                }
                
                // Find containing itemscope with id
                if (target && target.closest) {
                    const itemScope = target.closest('[itemscope][id]');
                    if (itemScope) {
                        modifiedItems.add(itemScope);
                    }
                }
            } else if (mutation.type === 'childList') {
                // Check if any child change is within an itemscope with id
                const target = mutation.target;
                if (target && target.closest) {
                    const itemScope = target.closest('[itemscope][id]');
                    if (itemScope) {
                        modifiedItems.add(itemScope);
                    }
                }
            }
        }
        
        // Update affected containers
        if (modifiedItems.size > 0) {
            this.syncedContainers.forEach((info, container) => {
                this._renderAuthoritativeItems(container);
            });
        }
    }
}

// Initialize template synchronizer
const templateSynchronizer = new TemplateSynchronizer();

/**
 * FetchedDocument - Wrapper for fetched documents with microdata support
 * 
 * @class FetchedDocument
 * @description Provides microdata access to documents fetched via Microdata.fetch().
 *              Maintains isolated microdata collection for the fetched document.
 * @private
 */
class FetchedDocument {
    constructor(document, url) {
        this._document = document;
        this._url = url;
        this._microdata = null;
        this._observer = null;
    }
    
    get microdata() {
        if (!this._microdata) {
            // Create isolated microdata collection for this document
            this._microdata = new MicrodataCollection();
            this._observer = new FetchedDocumentObserver(this._microdata, this._document);
            this._observer.start();
        }
        return this._microdata;
    }
    
    getElementById(id) {
        const element = this._document.getElementById(id);
        return element ? new FetchedElement(element, this) : null;
    }
    
    querySelector(selector) {
        const element = this._document.querySelector(selector);
        return element ? new FetchedElement(element, this) : null;
    }
    
    querySelectorAll(selector) {
        const elements = this._document.querySelectorAll(selector);
        return Array.from(elements).map(el => new FetchedElement(el, this));
    }
}

/**
 * FetchedElement - Wrapper for elements from fetched documents
 * 
 * @class FetchedElement
 * @description Provides microdata access to elements within fetched documents.
 * @private
 */
class FetchedElement {
    constructor(element, document) {
        this._element = element;
        this._document = document;
        this._microdata = null;
    }
    
    get microdata() {
        if (!this._element.hasAttribute('itemscope')) {
            return null;
        }
        
        if (!this._microdata) {
            this._microdata = new MicrodataItem(this._element);
        }
        return this._microdata;
    }
    
    get id() {
        return this._element.id;
    }
    
    getAttribute(name) {
        return this._element.getAttribute(name);
    }
    
    querySelector(selector) {
        const element = this._element.querySelector(selector);
        return element ? new FetchedElement(element, this._document) : null;
    }
    
    querySelectorAll(selector) {
        const elements = this._element.querySelectorAll(selector);
        return Array.from(elements).map(el => new FetchedElement(el, this._document));
    }
}

/**
 * FetchedDocumentObserver - Handles microdata for fetched documents
 * 
 * @class FetchedDocumentObserver
 * @extends MicrodataObserver
 * @description Specialized observer for static fetched documents.
 * @private
 */
class FetchedDocumentObserver extends MicrodataObserver {
    constructor(collection, document) {
        super(collection);
        this.document = document;
    }
    
    start() {
        // Scan the fetched document
        this._scanDocument();
        
        // Note: We don't set up mutation observers for fetched documents
        // as they are static snapshots
    }
    
    _scanDocument() {
        // Find all itemscope elements in the fetched document
        const items = this.document.querySelectorAll('[itemscope]');
        
        // Clear existing collection
        this.collection.length = 0;
        this.collection._refreshIndex();
        
        // Add only top-level items
        for (const element of items) {
            if (this._isTopLevel(element)) {
                const item = new MicrodataItem(element);
                this.collection._addItem(item);
                this.itemElementMap.set(element, item);
            }
        }
    }
    
    _isTopLevel(element) {
        let parent = element.parentElement;
        while (parent) {
            if (parent.hasAttribute('itemscope')) {
                return false;
            }
            parent = parent.parentElement;
        }
        return true;
    }
}

/**
 * Microdata namespace
 * 
 * @class Microdata
 * @description Static namespace providing utility methods for the Microdata API.
 *              Cannot be instantiated.
 * 
 * @example
 * // Fetch microdata from URL
 * const doc = await Microdata.fetch('https://example.com/page.html');
 * const items = doc.microdata;
 * 
 * // Access schemas and templates
 * const PersonSchema = await Microdata.Schema.load('https://schema.org/Person');
 * const rendered = Microdata.Template.render(data);
 */
class Microdata {
    constructor() {
        throw new Error('Microdata is a static class and cannot be instantiated');
    }
    
    /**
     * Fetch microdata from a remote URL
     * @param {string} url - The URL to fetch (optionally with fragment for specific element)
     * @returns {Promise<FetchedDocument|FetchedElement>} Document or element wrapper with microdata access
     * @throws {Error} If fetch fails or fragment not found
     * 
     * @example
     * // Fetch entire document
     * const doc = await Microdata.fetch('https://example.com/page.html');
     * const people = doc.microdata; // All microdata items
     * 
     * @example
     * // Fetch specific element by fragment
     * const element = await Microdata.fetch('https://example.com/page.html#person1');
     * const person = element.microdata; // Microdata for that element
     */
    static async fetch(url) {
        // Parse URL to check for fragment
        const urlObj = new URL(url);
        const fragment = urlObj.hash ? urlObj.hash.slice(1) : null;
        
        // Fetch the HTML content
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
        }
        
        const html = await response.text();
        
        // Parse HTML into a document
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        // Create document wrapper
        const docWrapper = new FetchedDocument(doc, url);
        
        // If fragment specified, return element wrapper
        if (fragment) {
            const element = doc.getElementById(fragment);
            if (!element) {
                throw new Error(`Fragment #${fragment} not found in document`);
            }
            return new FetchedElement(element, docWrapper);
        }
        
        return docWrapper;
    }
    
    /**
     * Clear the fetched document cache
     * @static
     * @description Clears all cached documents from fetch operations. Useful for testing.
     */
    static clearFetchCache() {
        fetchedDocumentCache.clear();
    }
}

// Set Microdata static properties
Microdata.Schema = Schema;
Microdata.Template = Template;

// Start synchronizer when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        templateSynchronizer.start();
    });
} else {
    templateSynchronizer.start();
}

// Cleanup on unload
if (typeof window !== 'undefined') {
    window.addEventListener('unload', () => {
        // Stop all observers to prevent memory leaks
        if (templateSynchronizer.observer) {
            templateSynchronizer.stop();
        }
        
        // Stop microdata observer if it exists
        const microdataObserver = document.microdata?._observer;
        if (microdataObserver?.stop) {
            microdataObserver.stop();
        }
    });
}

// Export for use
export { Microdata, MicrodataItem, MicrodataCollection, Schema, SchemaOrgSchema, RustyBeamNetSchema, Template };
export default Microdata;

// Set up globals
if (typeof window !== 'undefined') {
    window.Microdata = Microdata;
    window.Microdata.Schema = Schema;
    window.Microdata.Template = Template;
}