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
    
    // Placeholder for future additions
    Schema: class Schema {
        constructor(url) {
            this.url = url;
            // TODO: Implement in Phase 2
        }
    },
    
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

// Export for use
export { Microdata, MicrodataItem, MicrodataCollection };
export default Microdata;

// Set up globals
if (typeof window !== 'undefined') {
    window.Microdata = Microdata;
    window.Microdata.Schema = Microdata.Schema;
    window.Microdata.Template = Microdata.Template;
}