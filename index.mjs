/**
 * Microdata API - A vanilla JavaScript library for working with HTML Microdata
 * 
 * This library provides extraction, rendering, synchronization, and validation
 * of schema.org and other microdata within the DOM.
 */

// Import external html-template library
import { HTMLTemplate } from 'https://jamesaduncan.github.io/html-template/index.mjs';

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
        
        // Create handler object to maintain reference
        const handler = {
            get: (target, prop) => {
                // Handle special JSON-LD properties
                if (prop === '@type') {
                    const itemtype = target._element.getAttribute('itemtype');
                    if (!itemtype) return undefined;
                    
                    // Trim whitespace and extract the type from the URL (last part after /)
                    const trimmedType = itemtype.trim();
                    if (!trimmedType) return undefined;
                    
                    const parts = trimmedType.split('/');
                    return parts[parts.length - 1];
                }
                
                if (prop === '@context') {
                    const itemtype = target._element.getAttribute('itemtype');
                    if (!itemtype) return undefined;
                    
                    // Trim whitespace and extract the context (everything before the last /)
                    const trimmedType = itemtype.trim();
                    if (!trimmedType) return undefined;
                    
                    const lastSlash = trimmedType.lastIndexOf('/');
                    return lastSlash > 0 ? trimmedType.substring(0, lastSlash + 1) : undefined;
                }
                
                if (prop === '@id') {
                    // @id should just be the HTML id attribute value
                    return target._element.id || undefined;
                }
                
                // Handle methods and private properties
                if (typeof prop === 'string' && (prop.startsWith('_') || typeof target[prop] === 'function')) {
                    return target[prop];
                }
                
                // Handle Symbol properties (for iteration)
                if (typeof prop === 'symbol') {
                    return target[prop];
                }
                
                // Handle regular properties
                return target._getProperty(prop);
            },
            
            set: (target, prop, value) => {
                // Prevent setting special properties
                if (prop === '@type' || prop === '@context' || prop === '@id') {
                    return false;
                }
                
                // Handle private properties
                if (typeof prop === 'string' && prop.startsWith('_')) {
                    target[prop] = value;
                    return true;
                }
                
                // Set regular properties
                return target._setProperty(prop, value);
            },
            
            has: (target, prop) => {
                // Check for special properties
                if (prop === '@type' || prop === '@context' || prop === '@id') {
                    return true;
                }
                
                // Check for methods and private properties
                if (typeof prop === 'string' && (prop.startsWith('_') || typeof target[prop] === 'function')) {
                    return prop in target;
                }
                
                // Check for regular properties
                return target._hasProperty(prop);
            },
            
            ownKeys: (target) => {
                const keys = ['@type', '@context', '@id'];
                const propNames = target._getAllPropertyNames();
                return [...keys, ...propNames];
            },
            
            getOwnPropertyDescriptor: (target, prop) => {
                if (prop === '@type' || prop === '@context' || prop === '@id' || target._hasProperty(prop)) {
                    return {
                        enumerable: true,
                        configurable: true,
                        value: handler.get(target, prop)
                    };
                }
                return undefined;
            }
        };
        
        return new Proxy(this, handler);
    }
    
    _resolveItemref() {
        const refs = [];
        const itemref = this._element.getAttribute('itemref');
        
        if (!itemref) return refs;
        
        // Split by whitespace and resolve each ID, handling duplicates
        const ids = itemref.trim().split(/\s+/);
        const seen = new Set();
        
        for (const id of ids) {
            if (seen.has(id)) continue; // Skip duplicate IDs
            seen.add(id);
            
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
            // Check itemref elements themselves
            if (root !== this._element && root.hasAttribute('itemprop')) {
                const itemprops = root.getAttribute('itemprop').trim().split(/\s+/);
                itemprops.forEach(prop => names.add(prop));
            }
            
            // Search within elements
            const walker = document.createTreeWalker(
                root,
                NodeFilter.SHOW_ELEMENT,
                {
                    acceptNode: (node) => {
                        if (node.hasAttribute('itemprop')) {
                            return NodeFilter.FILTER_ACCEPT;
                        }
                        // Skip nested itemscopes
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
        
        // Handle form elements
        if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.tagName === 'SELECT') {
            return element.value;
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
        } else if (element.tagName === 'INPUT') {
            // Use setAttribute so MutationObserver can detect the change
            element.setAttribute('value', value);
            element.value = value; // Also set the property for immediate display
        } else if (element.tagName === 'TEXTAREA' || element.tagName === 'SELECT') {
            // For textarea and select, just set the value property
            element.value = value;
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
 * const specificPerson = document.microdata['person-123'];
 * 
 * // Use array methods
 * document.microdata.forEach(item => console.log(item.name));
 */
class MicrodataCollection extends Array {
    constructor() {
        super();
        
        return new Proxy(this, {
            get: (target, prop) => {
                // Try numeric/array access first
                if (prop in target || typeof prop === 'symbol') {
                    return target[prop];
                }
                
                // Try to find by element ID
                if (typeof prop === 'string') {
                    const item = target.find(item => {
                        if (item._element && item._element.id === prop) {
                            return true;
                        }
                        return false;
                    });
                    
                    if (item) {
                        return item;
                    }
                }
                
                return undefined;
            },
            
            has: (target, prop) => {
                // Check array properties and indices
                if (prop in target) {
                    return true;
                }
                
                // Check if we have an item with this ID
                if (typeof prop === 'string') {
                    return target.some(item => item._element && item._element.id === prop);
                }
                
                return false;
            },
            
            ownKeys: (target) => {
                // Get all properties including non-configurable ones
                const keys = Reflect.ownKeys(target);
                
                // Add IDs of items that have them
                for (const item of target) {
                    if (item._element && item._element.id) {
                        keys.push(item._element.id);
                    }
                }
                
                return keys;
            },
            
            getOwnPropertyDescriptor: (target, prop) => {
                // Handle numeric indices
                if (prop in target) {
                    return Object.getOwnPropertyDescriptor(target, prop);
                }
                
                // Handle named access by ID
                if (typeof prop === 'string') {
                    const hasItem = target.some(item => item._element && item._element.id === prop);
                    if (hasItem) {
                        return {
                            enumerable: true,
                            configurable: true,
                            value: target[prop]
                        };
                    }
                }
                
                return undefined;
            }
        });
    }
    
    _addItem(item) {
        this.push(item);
    }
    
    _removeItem(item) {
        const index = this.indexOf(item);
        if (index > -1) {
            this.splice(index, 1);
        }
    }
    
    _clear() {
        this.length = 0;
    }
    
    _isTopLevel(element) {
        // Check if this element is nested within another itemscope
        let parent = element.parentElement;
        while (parent && parent !== document.body) {
            if (parent.hasAttribute('itemscope')) {
                return false;
            }
            parent = parent.parentElement;
        }
        return true;
    }
}

// Global collection instance
const microdataCollection = new MicrodataCollection();

/**
 * MicrodataObserver - Monitors DOM changes and updates the global collection
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
            attributeFilter: ['itemscope', 'itemtype', 'itemid', 'itemref', 'itemprop', 'value'],
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
                // Handle attribute changes on itemscope elements
                if (mutation.target.hasAttribute('itemscope')) {
                    modifiedElements.add(mutation.target);
                }
            }
        }
        
        // Process removed elements
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
        
        // Note: Modified elements keep their existing MicrodataItem instance
        // The Proxy will reflect any changes automatically
    }
    
    _collectMicrodataElements(root, collection) {
        if (root.hasAttribute('itemscope')) {
            collection.add(root);
        }
        
        const items = root.querySelectorAll('[itemscope]');
        for (const item of items) {
            collection.add(item);
        }
    }
}

// Initialize observer
const observer = new MicrodataObserver(microdataCollection);

// Auto-start when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => observer.start());
} else {
    observer.start();
}

/**
 * Add microdata property to HTMLElement prototype
 * @memberof HTMLElement.prototype
 * @property {MicrodataItem|null} microdata - The MicrodataItem associated with this element
 */
Object.defineProperty(HTMLElement.prototype, 'microdata', {
    get() {
        if (!this.hasAttribute('itemscope')) {
            return null;
        }
        
        // Check if we already have an item for this element
        let item = observer.itemElementMap.get(this);
        if (item) {
            return item;
        }
        
        // Create new item
        item = new MicrodataItem(this);
        observer.itemElementMap.set(this, item);
        
        return item;
    },
    configurable: true,
    enumerable: false
});

/**
 * Add microdata collection to Document prototype
 * @memberof Document.prototype  
 * @property {MicrodataCollection} microdata - Collection of all top-level microdata items
 */
Object.defineProperty(Document.prototype, 'microdata', {
    get() {
        return microdataCollection;
    },
    configurable: true,
    enumerable: false
});

/**
 * Utility function to extract data from various object types
 * @param {MicrodataItem|HTMLFormElement|Element|Object} obj - Object to extract data from
 * @returns {Object} Extracted data as plain object
 * @private
 */
function extractMicrodataData(obj) {
    if (obj instanceof MicrodataItem) {
        const json = obj.toJSON();
        // @id is now just the element id, no manipulation needed
        return json;
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
                    if (selectedOptions.length > 0) {
                        data[name] = selectedOptions;
                    }
                    break;
                    
                case 'file':
                    // Skip file inputs for now
                    break;
                    
                default:
                    if (element.value) {
                        data[name] = element.value;
                    }
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
 * const isValid = personSchema.validate(myPersonObject);
 * 
 * // Create schema instance directly
 * const schema = new Schema('https://schema.org/Person');
 */
class Schema {
    constructor(url, data = null) {
        // Factory pattern - return appropriate subclass
        if (new.target === Schema) {
            if (url.includes('rustybeam.net/schema/')) {
                return new RustyBeamNetSchema(url, data);
            }
            return new SchemaOrgSchema(url, data);
        }
        
        this.url = url;
        this.data = data;
        this.loaded = false;
    }
    
    /**
     * Loads a schema from cache or network
     * @param {string} url - Schema URL
     * @returns {Promise<Schema>} Loaded schema instance
     * @static
     */
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
        const loadPromise = Schema._loadSchema(url)
            .then(data => {
                const schema = Schema._createSchemaInstance(url, data);
                schema.loaded = true;
                schemaCache.set(url, schema);
                schemaLoadingPromises.delete(url);
                return schema;
            })
            .catch(err => {
                schemaLoadingPromises.delete(url);
                throw err;
            });
        
        schemaLoadingPromises.set(url, loadPromise);
        return loadPromise;
    }
    
    /**
     * Manually cache a schema (useful for testing)
     * @param {Schema} schema - Schema instance to cache
     * @static
     */
    static cache(schema) {
        if (schema && schema.url) {
            schemaCache.set(schema.url, schema);
        }
    }
    
    static async _loadSchema(url) {
        try {
            const response = await fetch(url, {
                headers: {
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
                }
            });
            
            if (!response.ok) {
                throw new Error(`Failed to load schema: ${response.status} ${response.statusText}`);
            }
            
            const html = await response.text();
            
            // Parse HTML to extract schema
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            
            return Schema._extractSchemaFromDocument(doc);
        } catch (err) {
            throw new Error(`Failed to load schema from ${url}: ${err.message}`);
        }
    }
    
    static _extractSchemaFromDocument(doc) {
        // Different extraction logic for different schema providers
        
        // Look for microdata schemas in the document
        const schemaItem = doc.querySelector('[itemtype*="Schema"]');
        
        if (!schemaItem && doc.querySelector('[itemtype*="schema.org"]')) {
            // This is a schema.org definition page
            // Extract property definitions from the page structure
            const properties = {};
            
            // Schema.org uses a table format for properties
            const propRows = doc.querySelectorAll('table.definition-table tbody tr');
            for (const row of propRows) {
                const propName = row.querySelector('th.prop-nam code')?.textContent;
                const propTypes = Array.from(row.querySelectorAll('td.prop-ect a')).map(a => a.textContent);
                const propDesc = row.querySelector('td.prop-desc')?.textContent;
                
                if (propName) {
                    properties[propName] = {
                        name: propName,
                        types: propTypes,
                        description: propDesc
                    };
                }
            }
            
            return { properties };
        }
        
        if (schemaItem) {
            // Create a temporary MicrodataItem to extract the data
            const tempItem = new MicrodataItem(schemaItem);
            const data = tempItem.toJSON();
            
            // For RustyBeam.net schemas, properties might be separate items
            // Look for Property items that are children or siblings
            const propertyItems = doc.querySelectorAll('[itemtype*="/Property"]');
            if (propertyItems.length > 0 && (!data.properties || Object.keys(data.properties).length === 0)) {
                data.properties = {};
                
                for (const propItem of propertyItems) {
                    const propMicrodata = new MicrodataItem(propItem);
                    const propData = propMicrodata.toJSON();
                    if (propData.name) {
                        data.properties[propData.name] = propData;
                    }
                }
            }
            
            return data;
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
     * Clears the schema cache
     * @static
     */
    static clearCache() {
        schemaCache.clear();
    }
    
    /**
     * Instance method to load this schema
     * @returns {Promise<boolean>} Whether the schema loaded successfully
     */
    async load() {
        // To be overridden by subclasses
        throw new Error('load() must be implemented by subclass');
    }
    
    /**
     * Validates an object against the schema
     * @param {Object} obj - Object to validate
     * @returns {boolean|Object} False if validation fails, otherwise returns the validated microdata object
     */
    validate(obj) {
        throw new Error('validate() must be implemented by subclass');
    }
}

/**
 * Schema.org implementation
 * @class SchemaOrgSchema
 * @extends Schema
 * @private
 */
class SchemaOrgSchema extends Schema {
    constructor(url, data = null) {
        super();
        this.url = url;
        this.data = data || {};
        this.loaded = !!data;
    }
    
    async load() {
        // Schema.org schemas can't really be loaded, just mark as loaded
        this.loaded = true;
        return true;
    }
    
    validate(obj) {
        if (!this.loaded) {
            throw new Error('Schema must be loaded before validation');
        }
        
        const microdata = extractMicrodataData(obj);
        
        // Schema.org validation is typically permissive
        // Just check if object has @type that matches
        if (microdata['@type']) {
            const expectedType = this.url.split('/').pop();
            if (microdata['@type'] === expectedType) {
                return microdata;
            }
        }
        
        // Even without matching type, schema.org is permissive
        return microdata || false;
    }
    
    _extractData(element) {
        const data = {};
        
        // Look for property definitions
        const properties = element.querySelectorAll('[itemprop]');
        properties.forEach(prop => {
            const name = prop.getAttribute('itemprop');
            const value = prop.textContent || prop.getAttribute('content') || prop.getAttribute('href');
            
            if (data[name]) {
                // Convert to array if multiple values
                if (!Array.isArray(data[name])) {
                    data[name] = [data[name]];
                }
                data[name].push(value);
            } else {
                data[name] = value;
            }
        });
        
        return data;
    }
}

/**
 * RustyBeam.net schema implementation
 * @class RustyBeamNetSchema
 * @extends SchemaOrgSchema
 * @private
 */
class RustyBeamNetSchema extends SchemaOrgSchema {
    constructor(url, data = null) {
        super(url, data);
        // Extract properties - they might be at data.properties or directly in data
        if (data?.properties) {
            this.properties = data.properties;
        } else if (data) {
            // Extract properties from data object (excluding @type and @context)
            this.properties = {};
            for (const [key, value] of Object.entries(data)) {
                if (!key.startsWith('@') && typeof value === 'object' && value['@type'] === 'Property') {
                    this.properties[key] = value;
                }
            }
        } else {
            this.properties = {};
        }
    }
    
    async load() {
        // In a real implementation, this would fetch the schema from the URL
        // For now, just mark as loaded if we have data
        if (this.data && this.properties) {
            this.loaded = true;
            return true;
        }
        
        // Simulate loading for rustybeam.net schemas
        this.loaded = true;
        return true;
    }
    
    validate(obj) {
        if (!this.loaded) {
            throw new Error('Schema must be loaded before validation');
        }
        
        const microdata = extractMicrodataData(obj);
        
        // Check required properties based on cardinality
        let isValid = true;
        const errors = [];
        
        // Handle properties as either object or array
        if (Array.isArray(this.properties)) {
            // Properties provided as array (like in the test)
            for (const prop of this.properties) {
                const propName = prop.name;
                const cardinality = prop.cardinality || '0..*';
                const value = microdata[propName];
                
                if (!this._validateCardinality(value, cardinality)) {
                    isValid = false;
                    errors.push({
                        property: propName,
                        type: 'cardinality',
                        expected: cardinality,
                        actual: Array.isArray(value) ? value.length : value ? 1 : 0
                    });
                }
            }
        } else if (typeof this.properties === 'object') {
            // Properties provided as object
            for (const [propName, propDef] of Object.entries(this.properties)) {
                const cardinality = propDef.cardinality || '0..*';
                const value = microdata[propName];
                
                if (!this._validateCardinality(value, cardinality)) {
                    isValid = false;
                    errors.push({
                        property: propName,
                        type: 'cardinality',
                        expected: cardinality,
                        actual: Array.isArray(value) ? value.length : value ? 1 : 0
                    });
                }
            }
        }
        
        if (!isValid) {
            // Dispatch validation error event on the element being validated
            if (obj instanceof Element) {
                // For elements, dispatch on the element itself
                errors.forEach(error => {
                    const event = new CustomEvent('DOMSchemaInvalidData', {
                        bubbles: true,
                        detail: {
                            schema: this.url,
                            property: error.property,
                            type: error.type,
                            expected: error.expected,
                            actual: error.actual,
                            message: `Validation failed for property '${error.property}': expected ${error.expected}, got ${error.actual}`
                        }
                    });
                    obj.dispatchEvent(event);
                });
            } else {
                // For non-elements, dispatch on document
                const event = new CustomEvent('DOMSchemaInvalidData', {
                    bubbles: true,
                    detail: {
                        schema: this.url,
                        errors: errors,
                        data: microdata
                    }
                });
                document.dispatchEvent(event);
            }
        }
        
        // Return false if validation failed, otherwise return the microdata object
        return isValid ? microdata : false;
    }
    
    _validateCardinality(value, cardinality) {
        const count = Array.isArray(value) ? value.length : value !== undefined ? 1 : 0;
        
        switch (cardinality) {
            case '1':    // Exactly 1
            case '1..1':
                return count === 1;
            case '0..1': // 0 or 1
                return count <= 1;
            case '1..*': // 1 or more
                return count >= 1;
            case '*':    // 0 or more
            case '0..*':
            default:
                return true; // No restriction
        }
    }
}

// Global Microdata object for static methods
const Microdata = {
    /**
     * Validates an element against its declared schema
     * @param {HTMLElement} element - Element with itemtype to validate
     * @returns {Promise<boolean|Object>} False if validation fails, otherwise returns the validated microdata object
     */
    async validate(element) {
        if (!element.hasAttribute('itemtype')) {
            return false;
        }
        
        const itemtype = element.getAttribute('itemtype');
        const schema = await Schema.load(itemtype);
        
        return schema.validate(element);
    },
    
    /**
     * Fetches a document and extracts microdata
     * @param {string} url - URL to fetch
     * @returns {Promise<FetchedDocument|FetchedElement>} Document or element wrapper with microdata access
     */
    async fetch(url) {
        // Parse URL to check for fragment - resolve relative URLs against document base
        const urlObj = new URL(url, document.baseURI);
        const fragment = urlObj.hash ? urlObj.hash.slice(1) : null;
        
        // Check cache first
        const cacheKey = urlObj.href.split('#')[0]; // URL without fragment
        let doc = documentCache.get(cacheKey);
        
        if (!doc) {
            // Fetch the document
            const response = await fetch(cacheKey);
            if (!response.ok) {
                throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
            }
            
            const html = await response.text();
            const parser = new DOMParser();
            const parsedDoc = parser.parseFromString(html, 'text/html');
            
            doc = new FetchedDocument(parsedDoc);
            documentCache.set(cacheKey, doc);
        }
        
        // If fragment specified, find that specific element
        if (fragment) {
            const element = doc.document.getElementById(fragment);
            if (!element) {
                throw new Error(`Fragment #${fragment} not found in document`);
            }
            if (!element.hasAttribute('itemscope')) {
                throw new Error(`Element #${fragment} is not a microdata item (missing itemscope)`);
            }
            return new FetchedElement(element, doc.document);
        }
        
        return doc;
    },
    
    Schema,
    Template: null // Will be set after Template class is defined
};

// Add fetch method to MicrodataItem prototype
MicrodataItem.prototype.fetch = async function() {
    const element = this._element;
    
    // If this is an authoritative element (one we can directly access), return it
    if (element.id || element === document.getElementById(element.id)) {
        return element;
    }
    
    // Otherwise, we need an itemid to fetch from
    const itemid = element.getAttribute('itemid');
    if (!itemid) {
        throw new Error('Cannot fetch non-authoritative item without itemid');
    }
    
    // Parse the itemid URL
    let url;
    try {
        url = new URL(itemid, window.location.href);
    } catch (e) {
        throw new Error(`Invalid itemid URL: ${itemid}`);
    }
    
    // Fetch the document
    const result = await Microdata.fetch(url.href);
    
    // Find the element with matching itemid
    const elements = result.document.querySelectorAll(`[itemid="${itemid}"]`);
    for (const el of elements) {
        if (el.hasAttribute('itemscope')) {
            return el;
        }
    }
    
    throw new Error(`No microdata item found with itemid: ${itemid}`);
};

// Document cache for fetch operations
const documentCache = new Map();

// Add cache management
setInterval(() => {
    // Clear cache entries older than 15 minutes
    const now = Date.now();
    for (const [key, doc] of documentCache.entries()) {
        if (now - doc._fetchTime > 15 * 60 * 1000) {
            documentCache.delete(key);
        }
    }
}, 60 * 1000); // Check every minute

/**
 * Validate method for MicrodataItem
 */
MicrodataItem.prototype.validate = function() {
    const itemtype = this._element.getAttribute('itemtype');
    if (!itemtype) {
        // No schema to validate against - return the microdata as-is
        return extractMicrodataData(this);
    }
    
    // Trim whitespace from itemtype
    const trimmedType = itemtype.trim();
    if (!trimmedType) {
        // Empty itemtype after trimming - return the microdata as-is
        return extractMicrodataData(this);
    }
    
    // Get cached schema if available
    const schema = schemaCache.get(trimmedType);
    if (schema && schema.loaded) {
        return schema.validate(this._element);
    }
    
    // Schema not loaded yet - be permissive and return the microdata
    return extractMicrodataData(this);
};

/**
 * Form validation support
 */
HTMLFormElement.prototype.validate = function(schemaUrl) {
    if (!schemaUrl) {
        // Use HTML5 validation
        return this.checkValidity();
    }
    
    // Get cached schema if available
    const schema = schemaCache.get(schemaUrl);
    if (schema && schema.loaded) {
        return schema.validate(this);
    }
    
    // Schema not loaded - fall back to HTML5 validation
    return this.checkValidity();
};

// Add constraint validation message
const originalReportValidity = HTMLFormElement.prototype.reportValidity;
HTMLFormElement.prototype.reportValidity = function() {
    // First check schema validation if itemtype is present
    const itemtype = this.getAttribute('itemtype');
    if (itemtype) {
        const schema = schemaCache.get(itemtype);
        if (schema && schema.loaded) {
            const result = schema.validate(this);
            if (result === false) {
                // Schema validation failed
                const firstInvalid = this.querySelector(':invalid') || this.elements[0];
                if (firstInvalid && firstInvalid.setCustomValidity) {
                    firstInvalid.setCustomValidity('Schema validation failed');
                    firstInvalid.reportValidity();
                    return false;
                }
            }
        }
    }
    
    // Fall back to standard validation
    return originalReportValidity.call(this);
};

/**
 * Template - Wrapper around HTMLTemplate from external library
 * 
 * @class Template
 * @description Wraps the external HTMLTemplate library to maintain API compatibility
 *              while delegating actual template rendering to the external library.
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
        if (!element) {
            throw new Error('Template element is null or undefined - make sure the template exists in the DOM');
        }
        if (!(element instanceof HTMLTemplateElement)) {
            throw new Error(`Template requires an HTMLTemplateElement, got ${element.constructor.name}`);
        }
        
        // Check if HTMLTemplate is available
        if (typeof HTMLTemplate === 'undefined') {
            console.error('HTMLTemplate library not loaded. Using fallback implementation.');
            // Store element for fallback implementation
            this.element = element;
            this._htmlTemplate = null;
        } else {
            // Create HTMLTemplate instance from external library
            this._htmlTemplate = new HTMLTemplate(element);
            this.element = element;
        }
    }
    
    get schemas() {
        // Extract schemas from template for compatibility
        const schemas = new Set();
        
        // Check template element itself
        if (this.element.hasAttribute('itemscope') && this.element.hasAttribute('itemtype')) {
            const itemtype = this.element.getAttribute('itemtype');
            if (itemtype) {
                schemas.add(itemtype);
            }
        }
        
        // Check content
        const content = this.element.content;
        const schemaElements = content.querySelectorAll('[itemscope][itemtype]');
        schemaElements.forEach(el => {
            const itemtype = el.getAttribute('itemtype');
            if (itemtype) {
                schemas.add(itemtype);
            }
        });
        
        return Array.from(schemas);
    }
    
    validate(obj) {
        // For compatibility, always return true
        // A full implementation would validate against schemas
        return true;
    }
    
    render(obj) {
        if (!this._htmlTemplate) {
            throw new Error('HTMLTemplate library is required for rendering');
        }
        
        // Delegate to external HTMLTemplate library
        // Ensure single values are converted to arrays for array properties
        const data = this._normalizeData(obj);
        return this._htmlTemplate.render(data);
    }
    
    
    _extractData(obj) {
        return extractMicrodataData(obj);
    }
    
    _normalizeData(obj) {
        const data = extractMicrodataData(obj);
        
        // Check template for array properties
        const walker = document.createTreeWalker(
            this.element.content,
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
        
        const arrayProps = new Set();
        let node;
        while (node = walker.nextNode()) {
            const prop = node.getAttribute('itemprop');
            if (prop.endsWith('[]')) {
                arrayProps.add(prop.slice(0, -2));
            }
        }
        
        // Normalize data - convert single values to arrays where expected
        const normalized = { ...data };
        for (const prop of arrayProps) {
            if (normalized[prop] !== undefined && !Array.isArray(normalized[prop])) {
                normalized[prop] = [normalized[prop]];
            }
        }
        
        return normalized;
    }
    
    /**
     * Static method to render an object using an appropriate template
     * @param {Object} obj - Object to render (must have @type property)
     * @param {string} [templateSelector] - Optional template selector
     * @returns {HTMLElement} The rendered element
     * @throws {Error} If no suitable template is found
     * @static
     */
    static render(obj, templateSelector) {
        // Find appropriate template based on selector or object type
        let template = null;
        
        if (templateSelector) {
            // Use provided selector
            template = document.querySelector(templateSelector);
        } else if (obj && obj['@type']) {
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
                
                // Match by full URL or just the type name
                const objType = obj['@type'];
                const typeMatch = itemtype === objType || 
                                itemtype.endsWith('/' + objType) ||
                                (objType && itemtype.endsWith('/' + objType.split('/').pop()));
                                
                if (typeMatch) {
                    template = t;
                    break;
                }
            }
        }
        
        if (!template) {
            // Try to create a basic template if we have schema information
            if (obj && obj['@type']) {
                // Look for any Person template for schema.org/Person type
                const schemaType = obj['@type'].includes('/') ? obj['@type'] : 'https://schema.org/' + obj['@type'];
                const templates = document.querySelectorAll('template');
                for (const t of templates) {
                    const content = t.content;
                    const itemtypeEl = content.querySelector('[itemtype]');
                    if (itemtypeEl && itemtypeEl.getAttribute('itemtype') === schemaType) {
                        template = t;
                        break;
                    }
                }
            }
            
            if (!template) {
                console.warn('No matching template found for data:', obj);
                return null;
            }
        }
        
        const templateInstance = new Template(template);
        return templateInstance.render(obj);
    }
}

// Set Template on Microdata object
Microdata.Template = Template;

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
            const trimmedType = itemtype.trim();
            if (trimmedType) {
                itemtypes.add(trimmedType);
                if (!itemtypeElements.has(trimmedType)) {
                    itemtypeElements.set(trimmedType, []);
                }
                itemtypeElements.get(trimmedType).push(el);
            }
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
                
                // Dispatch error event on affected elements
                const elements = itemtypeElements.get(url) || [];
                elements.forEach(el => {
                    const event = new CustomEvent('DOMSchemaError', {
                        bubbles: true,
                        detail: {
                            schemaURL: url,
                            error: err,
                            message: err.message
                        }
                    });
                    el.dispatchEvent(event);
                });
                
                return null;
            })
    );
    
    // When all schemas are loaded/failed, dispatch summary event
    Promise.allSettled(promises).then(() => {
        const event = new CustomEvent('DOMSchemasLoaded', {
            bubbles: true,
            detail: {
                loaded: loadedSchemas,
                failed: failedSchemas,
                total: itemtypes.size
            }
        });
        document.dispatchEvent(event);
    });
}

// Auto-load schemas when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadAllSchemas);
} else {
    loadAllSchemas();
}

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
            attributeFilter: ['data-contains', 'id', 'value'],
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
            const item = itemElement.microdata;
            
            
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
                if (rendered) {
                    container.appendChild(rendered);
                    renderedItems.set(id, rendered);
                    
                    // Set up synchronization
                    this._setupSynchronization(itemElement, rendered);
                }
            }
        });
    }
    
    _renderItem(template, item) {
        try {
            const templateInstance = new Template(template);
            const rendered = templateInstance.render(item);
            
            if (!rendered) {
                console.warn('Template render returned null for item:', item);
                return null; // Return null to skip adding empty divs
            }
            
            // Set itemid if the item has an @id
            if (item['@id'] && rendered && rendered.hasAttribute && rendered.hasAttribute('itemscope')) {
                const itemid = document.baseURI + '#' + item['@id'];
                rendered.setAttribute('itemid', itemid);
            }
            
            return rendered;
        } catch (e) {
            console.error('Error rendering template:', e);
            return null; // Return null to skip adding empty divs
        }
    }
    
    _updateRenderedItem(element, item) {
        // Re-render the template with updated data
        const parent = element.parentElement;
        if (!parent) {
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
            if (mutation.type === 'attributes' && mutation.attributeName === 'value') {
                // Value attribute changed on an element
                const target = mutation.target;
                if (target.hasAttribute('itemprop')) {
                    const itemScope = target.closest('[itemscope][id]');
                    if (itemScope) {
                        modifiedItems.add(itemScope);
                    }
                }
            } else if (mutation.type === 'characterData') {
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
    constructor(document) {
        this.document = document;
        this._microdata = null;
        this._fetchTime = Date.now();
    }
    
    get microdata() {
        if (!this._microdata) {
            // Create microdata collection for this document
            this._microdata = new MicrodataCollection();
            
            // Scan for top-level items
            const items = this.document.querySelectorAll('[itemscope]');
            for (const element of items) {
                if (this._microdata._isTopLevel(element)) {
                    const item = new MicrodataItem(element);
                    this._microdata._addItem(item);
                }
            }
        }
        
        return this._microdata;
    }
    
    /**
     * DOM method delegation to the underlying document
     */
    getElementById(id) {
        const element = this.document.getElementById(id);
        if (element && element.hasAttribute('itemscope')) {
            // Add microdata property to the element
            Object.defineProperty(element, 'microdata', {
                get() {
                    return extractMicrodataData(new MicrodataItem(element));
                },
                configurable: true
            });
        }
        return element;
    }
    
    querySelector(selector) {
        const element = this.document.querySelector(selector);
        if (element && element.hasAttribute('itemscope')) {
            // Add microdata property to the element
            Object.defineProperty(element, 'microdata', {
                get() {
                    return extractMicrodataData(new MicrodataItem(element));
                },
                configurable: true
            });
        }
        return element;
    }
    
    querySelectorAll(selector) {
        const elements = Array.from(this.document.querySelectorAll(selector));
        elements.forEach(element => {
            if (element.hasAttribute('itemscope')) {
                // Add microdata property to the element
                Object.defineProperty(element, 'microdata', {
                    get() {
                        return extractMicrodataData(new MicrodataItem(element));
                    },
                    configurable: true
                });
            }
        });
        return elements;
    }
}

/**
 * FetchedElement - Wrapper for elements from fetched documents
 * 
 * @class FetchedElement
 * @description Provides microdata access to elements fetched via Microdata.fetch() with fragment.
 * @private
 */
class FetchedElement {
    constructor(element, document) {
        this._element = element;
        this._document = document;
        
        // Copy element properties
        this.id = element.id;
        this.tagName = element.tagName;
    }
    
    get microdata() {
        if (this._element.hasAttribute('itemscope')) {
            return extractMicrodataData(new MicrodataItem(this._element));
        }
        return null;
    }
    
    /**
     * DOM method delegation to the underlying element
     */
    querySelector(selector) {
        return this._element.querySelector(selector);
    }
    
    querySelectorAll(selector) {
        return Array.from(this._element.querySelectorAll(selector));
    }
    
    getAttribute(name) {
        return this._element.getAttribute(name);
    }
    
    hasAttribute(name) {
        return this._element.hasAttribute(name);
    }
}

// Start template synchronizer when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => templateSynchronizer.start());
} else {
    templateSynchronizer.start();
}

// Export main classes and objects
export { Microdata, MicrodataItem, MicrodataCollection, Schema, SchemaOrgSchema, RustyBeamNetSchema, Template };