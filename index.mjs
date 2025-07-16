/**
 * Schema Elements - Live Microdata API
 * 
 * A vanilla JavaScript library that provides a live, reactive API for HTML microdata.
 * Treats microdata embedded in HTML as a live data layer with automatic DOM synchronization.
 * 
 * Key features:
 * - Live data binding through window.microdata
 * - Array operations (push, pop, splice) with DOM updates
 * - Multi-view synchronization across templates
 * - Schema validation with Schema.org and organised.team support
 * - JSON-LD serialization
 * - Iterator protocol support
 * - DOM-to-microdata synchronization
 * - Data source fetching (data-microdata-source attribute) for JSON-LD or HTML microdata
 * 
 * @example
 * // Access microdata
 * const company = window.microdata.company;
 * 
 * // Modify data (DOM updates automatically)
 * company.name = "New Company Name";
 * 
 * // Array operations
 * company.employee.push({ name: "John Doe", email: "john@example.com" });
 * 
 * // Iterate over items
 * for (const item of window.microdata) {
 *   console.log(item);
 * }
 * 
 * // JSON-LD serialization
 * const jsonLD = JSON.stringify(window.microdata);
 * 
 * // Data source fetching
 * // <div data-microdata-source="users.json"> will fetch and populate templates
 * // Supports both JSON-LD files and HTML documents with microdata
 */

/**
 * SchemaRegistry - Manages schema definitions and type validation
 * 
 * Handles loading schemas from URLs, validating data against schemas,
 * and providing type validators for basic data types. Always fetches
 * schemas from their URLs to ensure up-to-date definitions.
 */
class SchemaRegistry {
    constructor() {
        this.schemas = new Map();
        this.typeValidators = new Map();
        this.initializeBasicTypes();
    }

    /**
     * Initialize validators for basic schema.org and organised.team types
     */
    initializeBasicTypes() {
        // Basic schema.org types
        this.typeValidators.set('https://schema.org/Text', (value) => typeof value === 'string');
        this.typeValidators.set('https://schema.org/URL', (value) => {
            if (typeof value !== 'string') return false;
            try {
                new URL(value);
                return true;
            } catch {
                return value.startsWith('#') || value.startsWith('/');
            }
        });
        this.typeValidators.set('https://schema.org/Boolean', (value) => typeof value === 'boolean' || value === 'true' || value === 'false');
        this.typeValidators.set('https://schema.org/Number', (value) => !isNaN(Number(value)));
        this.typeValidators.set('https://schema.org/Integer', (value) => Number.isInteger(Number(value)));
        this.typeValidators.set('https://schema.org/Date', (value) => !isNaN(Date.parse(value)));
        this.typeValidators.set('https://schema.org/DateTime', (value) => !isNaN(Date.parse(value)));
        this.typeValidators.set('https://schema.org/Time', (value) => /^\d{2}:\d{2}(:\d{2})?$/.test(value));
        
        // organised.team Cardinal type
        this.typeValidators.set('https://organised.team/Cardinal', (value) => {
            return ['1', '0..1', '0..n', '1..n'].includes(value);
        });
    }


    /**
     * Load a schema from a URL
     * @param {string} url - The schema URL to load
     * @returns {Promise<Object|null>} The schema definition or null if not found
     */
    async loadSchema(url) {
        if (this.schemas.has(url)) {
            return this.schemas.get(url);
        }

        try {
            const response = await fetch(url);
            const html = await response.text();
            const doc = new DOMParser().parseFromString(html, 'text/html');
            const schema = this.parseSchemaFromDocument(doc, url);
            this.schemas.set(url, schema);
            
            // Load parent schema if exists
            if (schema.parent) {
                await this.loadSchema(schema.parent);
            }
            
            return schema;
        } catch (error) {
            return null;
        }
    }

    /**
     * Parse schema definition from an HTML document
     * @param {Document} doc - The HTML document containing schema definition
     * @param {string} url - The URL of the schema
     * @returns {Object} The parsed schema object
     */
    parseSchemaFromDocument(doc, url) {
        const schemaElements = doc.querySelectorAll('[itemscope][itemtype*="Schema"]');
        if (schemaElements.length === 0) return null;

        const schemaElement = schemaElements[0];
        const schema = {
            id: url,
            name: this.extractProperty(schemaElement, 'name'),
            description: this.extractProperty(schemaElement, 'description'),
            properties: [],
            parent: this.extractProperty(schemaElement, 'parent')
        };

        // Find all properties
        const propertyElements = doc.querySelectorAll('[itemscope][itemtype*="Property"]');
        propertyElements.forEach(propElement => {
            const property = {
                name: this.extractProperty(propElement, 'name'),
                type: this.extractProperty(propElement, 'type'),
                cardinality: this.extractProperty(propElement, 'cardinality') || '0..1',
                required: this.extractProperty(propElement, 'required') === 'true',
                description: this.extractProperty(propElement, 'description')
            };
            if (property.name) {
                schema.properties.push(property);
            }
        });

        return schema;
    }

    /**
     * Extract a property value from an element
     * @param {Element} element - The element to extract from
     * @param {string} propName - The property name to extract
     * @returns {string|null} The property value or null
     */
    extractProperty(element, propName) {
        const propElement = element.querySelector(`[itemprop="${propName}"]`);
        if (!propElement) return null;
        
        if (propElement.hasAttribute('content')) {
            return propElement.getAttribute('content');
        }
        return propElement.textContent.trim();
    }

    /**
     * Validate data against a schema
     * @param {Object} data - The data to validate
     * @param {string} schemaUrl - The URL of the schema to validate against
     * @returns {Promise<Object>} Validation result with valid, errors, and warnings
     */
    async validate(data, schemaUrl) {
        const schema = await this.loadSchema(schemaUrl);
        if (!schema) {
            return { valid: false, errors: [`Schema ${schemaUrl} not found`], warnings: [] };
        }

        const errors = [];
        const warnings = [];

        // Check required properties
        schema.properties.forEach(property => {
            if (property.required && !(property.name in data)) {
                errors.push(`Missing required property: ${property.name}`);
            }
        });

        // Validate existing properties
        for (const [key, value] of Object.entries(data)) {
            const property = schema.properties.find(p => p.name === key);
            if (!property) {
                warnings.push(`Unknown property: ${key}`);
                continue;
            }

            // Type validation
            if (property.type && !await this.validateType(value, property.type)) {
                errors.push(`Property ${key} has invalid type. Expected ${property.type}`);
            }
        }

        return { valid: errors.length === 0, errors, warnings };
    }

    /**
     * Validate a value against a type
     * @param {*} value - The value to validate
     * @param {string} typeUrl - The URL of the type to validate against
     * @returns {Promise<boolean>} True if valid, false otherwise
     */
    async validateType(value, typeUrl) {
        // Check if we have a validator for this type
        if (this.typeValidators.has(typeUrl)) {
            return this.typeValidators.get(typeUrl)(value);
        }

        // If it's a complex type, just check if it's an object
        return typeof value === 'object' && value !== null;
    }

    /**
     * Infer the item type for a property from schema or templates
     * @param {string} propName - The property name
     * @param {string} parentType - The parent item type URL
     * @returns {Promise<string|null>} The inferred type URL or null
     */
    async inferItemType(propName, parentType) {
        // First, try to get it from the parent schema
        if (parentType) {
            const parentSchema = await this.loadSchema(parentType);
            if (parentSchema) {
                const property = parentSchema.properties.find(p => p.name === propName);
                if (property) {
                    return property.type;
                }
            }
        }

        // If not found in schema, try to infer from templates
        const templates = document.querySelectorAll('template[itemtype]');
        for (const template of templates) {
            const templateItem = template.content.querySelector('[itemscope]');
            if (templateItem) {
                const props = Array.from(templateItem.querySelectorAll('[itemprop]'));
                const hasProp = props.some(p => p.getAttribute('itemprop') === propName);
                if (hasProp) {
                    return template.getAttribute('itemtype');
                }
            }
        }

        return null;
    }
}

class MicrodataExtractor {
    constructor(registry) {
        this.registry = registry;
    }

    async extractFromElement(element) {
        if (!element.hasAttribute('itemscope')) {
            return null;
        }

        const type = element.getAttribute('itemtype');
        const id = element.getAttribute('itemid') || 
                   (element.id ? `#${element.id}` : null);

        const item = {
            element,
            type: this.normalizeSchemaUrl(type),
            id,
            properties: {}
        };

        // Load schema if available
        const schema = type ? await this.registry.loadSchema(type) : null;

        // Extract properties
        const props = element.querySelectorAll('[itemprop]');
        const propGroups = {};

        // Group properties by name
        props.forEach(prop => {
            const propName = prop.getAttribute('itemprop');
            if (!propGroups[propName]) {
                propGroups[propName] = [];
            }
            propGroups[propName].push(prop);
        });

        // Handle deduplication for array properties
        for (const [propName, props] of Object.entries(propGroups)) {
            const itemscopeProps = props.filter(p => p.hasAttribute('itemscope'));
            
            if (itemscopeProps.length > 1 && this.shouldDeduplicate(props)) {
                propGroups[propName] = this.deduplicateProperties(propName, props, element);
            }
        }

        // Process each property group
        for (const [propName, propElements] of Object.entries(propGroups)) {
            const shouldBeArray = this.shouldPropertyBeArray(propName, schema);
            const values = await this.extractPropertyValues(propElements);
            
            if (shouldBeArray) {
                item.properties[propName] = values;
            } else {
                item.properties[propName] = values.length > 0 ? values[0] : null;
            }
        }

        // Ensure all schema-defined properties exist, even if empty
        if (schema) {
            for (const schemaProp of schema.properties) {
                if (!(schemaProp.name in item.properties)) {
                    const cardinality = schemaProp.cardinality || '0..1';
                    if (cardinality === '0..n' || cardinality === '1..n') {
                        item.properties[schemaProp.name] = [];
                    } else {
                        item.properties[schemaProp.name] = null;
                    }
                }
            }
        }

        return item;
    }

    shouldDeduplicate(props) {
        // Check if properties are in different container types
        const containers = new Set();
        props.forEach(prop => {
            if (prop.hasAttribute('itemscope')) {
                let container = prop.parentElement;
                while (container && container.tagName !== 'BODY') {
                    if (['UL', 'TBODY', 'DIV'].includes(container.tagName)) {
                        containers.add(container);
                        break;
                    }
                    container = container.parentElement;
                }
            }
        });
        return containers.size > 1;
    }

    deduplicateProperties(propName, props, element) {
        // Find all unique containers
        const containers = new Set();
        props.forEach(prop => {
            if (prop.hasAttribute('itemscope')) {
                let container = prop.parentElement;
                while (container && container !== element) {
                    if (['UL', 'TBODY', 'DIV'].includes(container.tagName)) {
                        containers.add(container);
                        break;
                    }
                    container = container.parentElement;
                }
            }
        });

        // Only keep items from the first container found
        if (containers.size > 1) {
            const firstContainer = Array.from(containers)[0];
            return props.filter(p => {
                if (!p.hasAttribute('itemscope')) return true;
                let container = p.parentElement;
                while (container && container !== element) {
                    if (container === firstContainer) return true;
                    if (container.tagName === 'UL' || container.tagName === 'TBODY' || container.tagName === 'DIV') {
                        return false;
                    }
                    container = container.parentElement;
                }
                return true;
            });
        }
        
        return props;
    }

    shouldPropertyBeArray(propName, schema) {
        if (schema) {
            const property = schema.properties.find(p => p.name === propName);
            if (property) {
                const cardinality = property.cardinality || '1';
                return cardinality === '0..n' || cardinality === '1..n';
            }
        }
        return false;
    }

    async extractPropertyValues(propElements) {
        const values = [];
        for (const prop of propElements) {
            if (prop.hasAttribute('itemscope')) {
                const nestedItem = await this.extractFromElement(prop);
                values.push(nestedItem);
            } else {
                const value = this.extractPropertyValue(prop);
                values.push(value);
            }
        }
        return values;
    }

    extractPropertyValue(element) {
        // Check for special attributes first
        if (element.hasAttribute('content')) {
            return element.getAttribute('content');
        }
        if (element.hasAttribute('datetime')) {
            return element.getAttribute('datetime');
        }
        if (element.tagName === 'A' && element.hasAttribute('href')) {
            return element.getAttribute('href');
        }
        if (element.tagName === 'IMG' && element.hasAttribute('src')) {
            return element.getAttribute('src');
        }
        
        return element.textContent.trim();
    }

    normalizeSchemaUrl(url) {
        if (url && url.startsWith('http://schema.org/')) {
            return url.replace('http://', 'https://');
        }
        return url;
    }

    createProxy(item) {
        const self = this;
        
        return new Proxy(item.properties, {
            get(target, prop) {
                if (prop === '_element') return item.element;
                if (prop === '_type') return item.type;
                if (prop === '_id') return item.id;
                
                return target[prop];
            },
            
            set(target, prop, value) {
                target[prop] = value;
                
                // Update DOM
                const propElements = item.element.querySelectorAll(`[itemprop="${prop}"]:not([itemscope])`);
                propElements.forEach(el => {
                    if (el.hasAttribute('content')) {
                        el.setAttribute('content', value);
                    } else {
                        el.textContent = value;
                    }
                });
                
                return true;
            }
        });
    }
}

/**
 * MicrodataAPI - Main API class for live microdata functionality
 * 
 * Provides the window.microdata interface with live data binding,
 * DOM synchronization, and reactive array operations.
 */
class MicrodataAPI {
    /**
     * Initialize the microdata API
     */
    constructor() {
        this.registry = new SchemaRegistry();
        this.extractor = new MicrodataExtractor(this.registry);
        this.items = new Map(); // Items with IDs
        this.itemsWithoutId = []; // Items without IDs (accessed by numeric index)
        this.templates = new Map(); // Templates for rendering new items
        this.isUpdatingFromDOM = false; // Flag to prevent infinite loops
        this.initialize();
    }

    /**
     * Initialize the API by setting up DOM observation and extraction
     */
    initialize() {
        const setup = async () => {
            await this.refresh();
            this.observeChanges();
        };

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', setup);
        } else {
            setTimeout(setup, 0);
        }
    }

    normalizeSchemaUrl(url) {
        if (url && url.startsWith('http://schema.org/')) {
            return url.replace('http://', 'https://');
        }
        return url;
    }

    /**
     * Refresh the microdata by re-extracting all items from the DOM
     */
    async refresh() {
        this.items.clear();
        this.itemsWithoutId = [];
        this.templates.clear();

        // Process data-microdata-source elements first
        await this.processDataSources();

        // Find all templates
        this.collectTemplates();

        // Extract all items
        await this.extractAllItems();
    }

    /**
     * Process all elements with data-microdata-source attributes
     */
    async processDataSources() {
        const dataSourceElements = document.querySelectorAll('[data-microdata-source]');
        
        for (const element of dataSourceElements) {
            const dataSourceUrl = element.getAttribute('data-microdata-source');
            if (dataSourceUrl) {
                await this.applyDataSource(element, dataSourceUrl);
            }
        }
    }

    /**
     * Apply data from a data source to an element
     * @param {Element} element - The element to apply data to
     * @param {string} url - The URL to fetch data from
     */
    async applyDataSource(element, url) {
        try {
            const response = await fetch(url);
            const contentType = response.headers.get('content-type') || '';
            
            if (contentType.includes('application/json') || url.endsWith('.json')) {
                // Handle JSON-LD data
                const jsonData = await response.json();
                await this.applyJsonLdData(element, jsonData);
            } else {
                // Handle HTML data with microdata
                const html = await response.text();
                await this.applyHtmlData(element, html);
            }
        } catch (error) {
            // Silently fail if data source can't be loaded
        }
    }

    /**
     * Apply JSON-LD data to an element
     * @param {Element} element - The element to apply data to
     * @param {Array|Object} data - The JSON-LD data
     */
    async applyJsonLdData(element, data) {
        const items = Array.isArray(data) ? data : [data];
        
        for (const item of items) {
            if (item['@type']) {
                const itemType = this.resolveJsonLdType(item['@type'], item['@context']);
                await this.createItemFromJsonLd(element, item, itemType);
            }
        }
    }

    /**
     * Apply HTML microdata to an element
     * @param {Element} element - The element to apply data to
     * @param {string} html - The HTML content with microdata
     */
    async applyHtmlData(element, html) {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const microdataElements = doc.querySelectorAll('[itemscope]');
        
        for (const microdataElement of microdataElements) {
            const extractedItem = await this.extractor.extractFromElement(microdataElement);
            if (extractedItem) {
                await this.createItemFromExtracted(element, extractedItem);
            }
        }
    }

    /**
     * Resolve JSON-LD type to full URL
     * @param {string} type - The type (short or full URL)
     * @param {string} context - The @context URL
     * @returns {string} The resolved type URL
     */
    resolveJsonLdType(type, context) {
        if (type.startsWith('http')) {
            return type;
        }
        
        if (context) {
            return context.endsWith('/') ? context + type : context + '/' + type;
        }
        
        return 'https://schema.org/' + type;
    }

    /**
     * Create an item from JSON-LD data
     * @param {Element} container - The container element
     * @param {Object} jsonLdItem - The JSON-LD item
     * @param {string} itemType - The resolved item type URL
     */
    async createItemFromJsonLd(container, jsonLdItem, itemType) {
        const template = this.findTemplateForType(container, itemType);
        if (!template) return;

        const clone = template.content.cloneNode(true);
        const itemElement = clone.querySelector('[itemscope]');
        
        if (itemElement) {
            // Apply properties from JSON-LD
            for (const [key, value] of Object.entries(jsonLdItem)) {
                if (key.startsWith('@')) continue; // Skip JSON-LD metadata
                
                const propElements = itemElement.querySelectorAll(`[itemprop="${key}"]`);
                propElements.forEach(el => {
                    if (el.hasAttribute('content')) {
                        el.setAttribute('content', value);
                    } else {
                        el.textContent = value;
                    }
                });
            }
            
            // Insert into DOM
            const insertionPoint = this.findInsertionPoint(container, template);
            if (insertionPoint) {
                insertionPoint.appendChild(clone);
            }
        }
    }

    /**
     * Create an item from extracted microdata
     * @param {Element} container - The container element
     * @param {Object} extractedItem - The extracted item
     */
    async createItemFromExtracted(container, extractedItem) {
        const template = this.findTemplateForType(container, extractedItem.type);
        if (!template) return;

        const clone = template.content.cloneNode(true);
        const itemElement = clone.querySelector('[itemscope]');
        
        if (itemElement) {
            // Apply properties from extracted item
            for (const [key, value] of Object.entries(extractedItem.properties)) {
                if (typeof value === 'string') {
                    const propElements = itemElement.querySelectorAll(`[itemprop="${key}"]`);
                    propElements.forEach(el => {
                        if (el.hasAttribute('content')) {
                            el.setAttribute('content', value);
                        } else {
                            el.textContent = value;
                        }
                    });
                }
            }
            
            // Insert into DOM
            const insertionPoint = this.findInsertionPoint(container, template);
            if (insertionPoint) {
                insertionPoint.appendChild(clone);
            }
        }
    }

    /**
     * Find a template for a given type within a container
     * @param {Element} container - The container element
     * @param {string} itemType - The item type URL
     * @returns {Element|null} The template element or null
     */
    findTemplateForType(container, itemType) {
        const normalizedType = this.normalizeSchemaUrl(itemType);
        
        // Try various variations of the type URL
        const typeVariations = [
            itemType,
            normalizedType,
            itemType + '/',
            normalizedType + '/',
            itemType.replace(/\/$/, ''),
            normalizedType.replace(/\/$/, '')
        ];
        
        // Only look for templates within the container (children only)
        let template = null;
        for (const typeVar of typeVariations) {
            template = container.querySelector(`template[itemtype="${typeVar}"]`);
            if (template) break;
        }
        
        return template;
    }

    /**
     * Find the insertion point for new items
     * @param {Element} container - The container element
     * @param {Element} template - The template element
     * @returns {Element|null} The insertion point or null
     */
    findInsertionPoint(container, template) {
        // If template is within the container, use its parent
        if (container.contains(template)) {
            return template.parentElement;
        }
        
        // Otherwise, use the container itself
        return container;
    }

    collectTemplates() {
        document.querySelectorAll('template[itemtype]').forEach(template => {
            const type = template.getAttribute('itemtype');
            const normalizedType = this.normalizeSchemaUrl(type);
            
            if (!this.templates.has(normalizedType)) {
                this.templates.set(normalizedType, []);
            }
            this.templates.get(normalizedType).push(template);
            
            // Also store under the original type for backward compatibility
            if (type !== normalizedType) {
                if (!this.templates.has(type)) {
                    this.templates.set(type, []);
                }
                this.templates.get(type).push(template);
            }
        });
    }

    async extractAllItems() {
        const itemElements = document.querySelectorAll('[itemscope]');
        const topLevelItemsWithoutId = [];
        
        for (const element of itemElements) {
            if (this.isNestedItem(element)) continue;
            
            const item = await this.extractor.extractFromElement(element);
            
            if (item) {
                const proxy = this.createLiveProxy(item);
                if (item.id) {
                    this.items.set(item.id, proxy);
                } else {
                    topLevelItemsWithoutId.push(proxy);
                }
            }
        }
        
        this.itemsWithoutId = topLevelItemsWithoutId;
    }

    isNestedItem(element) {
        let parent = element.parentElement;
        while (parent) {
            if (parent.hasAttribute('itemscope')) {
                return true;
            }
            parent = parent.parentElement;
        }
        return false;
    }

    /**
     * Create a live proxy object for an item with reactive behavior
     * @param {Object} item - The item to create a proxy for
     * @returns {Proxy} A proxy with live DOM synchronization
     */
    createLiveProxy(item) {
        const self = this;
        
        const createArrayProxy = (items, propName, parentElement) => {
            return new Proxy(items, {
                get(target, prop) {
                    // Handle toJSON for serialization
                    if (prop === 'toJSON') {
                        return () => self.serializeArray(target);
                    }
                    
                    // Array methods
                    if (prop === 'push') {
                        return (...args) => self.handleArrayPush(target, args, item, propName, parentElement);
                    }
                    if (prop === 'pop') {
                        return () => self.handleArrayPop(target, propName, item);
                    }
                    if (prop === 'splice') {
                        return async (start, deleteCount, ...items) => 
                            self.handleArraySplice(target, start, deleteCount, items, propName, item, parentElement);
                    }
                    
                    // Create live proxies for array items
                    if (typeof prop === 'number' || (typeof prop === 'string' && /^\d+$/.test(prop))) {
                        const index = Number(prop);
                        if (target[index]) {
                            return self.createLiveProxy(target[index]);
                        }
                    }
                    
                    return target[prop];
                }
            });
        };
        
        return new Proxy(item, {
            get(target, prop) {
                // Handle special properties
                if (prop === '_element') return target.element;
                if (prop === '_type') return target.type;
                if (prop === '_id') return target.id;
                
                // Handle toJSON for serialization
                if (prop === 'toJSON') {
                    return () => self.serializeItem(target);
                }
                
                const value = target.properties[prop];
                
                // If it's an array, wrap in array proxy
                if (Array.isArray(value)) {
                    return createArrayProxy(value, prop, target.element);
                }
                
                // If it's a nested item, wrap in proxy
                if (value && typeof value === 'object' && value.element) {
                    return self.createLiveProxy(value);
                }
                
                return value;
            },
            
            set(target, prop, value) {
                target.properties[prop] = value;
                
                // Skip DOM updates if we're already updating from DOM
                if (!self.isUpdatingFromDOM) {
                    self.updateDOMProperty(target, prop, value);
                }
                
                return true;
            },
            
            ownKeys(target) {
                return Object.keys(target.properties);
            },
            
            has(target, prop) {
                return prop in target.properties;
            }
        });
    }

    serializeArray(items) {
        return items.map(item => {
            if (item && typeof item === 'object' && item.toJSON) {
                return item.toJSON();
            } else if (item && typeof item === 'object' && item.properties) {
                return this.createJsonLd(item);
            }
            return item;
        });
    }

    serializeItem(item) {
        return this.createJsonLd(item);
    }

    createJsonLd(item) {
        const result = {
            "@context": "https://schema.org"
        };
        
        if (item.type) {
            const typeName = item.type.split('/').pop();
            result["@type"] = typeName;
        }
        
        if (item.id) {
            result["@id"] = item.id;
        }
        
        // Add all properties
        for (const [key, value] of Object.entries(item.properties)) {
            if (Array.isArray(value)) {
                result[key] = this.serializeArray(value);
            } else if (value && typeof value === 'object' && value.toJSON) {
                result[key] = value.toJSON();
            } else if (value && typeof value === 'object' && value.properties) {
                result[key] = this.createJsonLd(value);
            } else {
                result[key] = value;
            }
        }
        
        return result;
    }

    handleArrayPush(target, args, item, propName, parentElement) {
        args.forEach(data => {
            this.addItemFromData(data, item.type, propName, parentElement);
        });
        return target.length;
    }

    handleArrayPop(target, propName, item) {
        if (target.length === 0) return undefined;
        
        const lastItem = target[target.length - 1];
        const itemType = lastItem._type || lastItem.type;
        
        if (itemType) {
            this.removeLastItemFromDOM(itemType, propName);
        }
        
        return target.pop();
    }

    async handleArraySplice(target, start, deleteCount, items, propName, parentItem, parentElement) {
        let itemType = this.getItemTypeForArray(target, propName, parentItem);
        
        if (!itemType) {
            const parentSchema = await this.registry.loadSchema(parentItem.type);
            if (parentSchema) {
                const property = parentSchema.properties.find(p => p.name === propName);
                if (property) {
                    itemType = property.type;
                }
            }
        }
        
        if (itemType) {
            this.updateDOMForSplice(itemType, propName, start, deleteCount, items, parentElement);
        }
        
        return target.splice(start, deleteCount, ...items);
    }

    getItemTypeForArray(array, propName, parentItem) {
        if (array.length > 0) {
            return array[0]._type || array[0].type;
        }
        return null;
    }

    removeLastItemFromDOM(itemType, propName) {
        const normalizedType = this.normalizeSchemaUrl(itemType);
        const templates = this.templates.get(normalizedType) || this.templates.get(itemType) || [];
        
        templates.forEach(template => {
            const parent = template.parentElement;
            const elements = parent.querySelectorAll(`[itemprop="${propName}"][itemscope]`);
            if (elements.length > 0) {
                elements[elements.length - 1].remove();
            }
        });
    }

    updateDOMForSplice(itemType, propName, start, deleteCount, items, parentElement) {
        const normalizedType = this.normalizeSchemaUrl(itemType);
        const templates = this.templates.get(normalizedType) || this.templates.get(itemType) || [];
        
        templates.forEach(template => {
            const parent = template.parentElement;
            const elements = Array.from(parent.querySelectorAll(`[itemprop="${propName}"][itemscope]`));
            
            // Remove elements
            for (let i = start; i < start + deleteCount && i < elements.length; i++) {
                elements[i].remove();
            }
            
            // Add new items
            if (items.length > 0) {
                const insertBefore = elements[start + deleteCount] || null;
                items.forEach(data => {
                    this.addItemFromData(data, parentElement.type, propName, parent, insertBefore);
                });
            }
        });
    }

    updateDOMProperty(target, prop, value) {
        const itemId = target.id;
        
        if (itemId) {
            // Find all elements with the same itemid or id
            const sameItems = document.querySelectorAll(`[itemid="${itemId}"], [id="${itemId.replace('#', '')}"]`);
            
            sameItems.forEach(itemElement => {
                this.updatePropertyElements(itemElement, prop, value);
            });
        } else {
            // For items without ID, update the original element
            this.updatePropertyElements(target.element, prop, value);
            
            // Also try to find and update corresponding elements in other views
            this.updateCorrespondingElements(target, prop, value);
        }
    }

    updatePropertyElements(container, prop, value) {
        const propElements = container.querySelectorAll(`[itemprop="${prop}"]:not([itemscope])`);
        propElements.forEach(el => {
            if (el.hasAttribute('content')) {
                el.setAttribute('content', value);
            } else {
                el.textContent = value;
            }
        });
    }

    async addItemFromData(data, parentType, propName, parentElement, insertBefore = null) {
        const itemType = await this.determineItemType(parentType, propName);
        
        if (!itemType) return;
        
        const templates = this.getTemplatesForType(itemType);
        
        if (templates.length === 0) return;

        // Clone and populate template for each location
        templates.forEach(template => {
            const clone = template.content.cloneNode(true);
            const itemElement = clone.querySelector('[itemscope]');
            
            if (itemElement) {
                this.populateElement(itemElement, data);
                
                const parent = template.parentElement;
                if (insertBefore) {
                    parent.insertBefore(clone, insertBefore);
                } else {
                    parent.appendChild(clone);
                }
            }
        });
    }

    async determineItemType(parentType, propName) {
        const parentSchema = await this.registry.loadSchema(parentType);
        
        if (parentSchema) {
            const property = parentSchema.properties.find(p => p.name === propName);
            if (property) {
                return property.type;
            }
        }
        
        // Try to infer from templates
        return this.inferItemTypeFromTemplates(propName);
    }

    inferItemTypeFromTemplates(propName) {
        const templates = Array.from(this.templates.values()).flat();
        for (const template of templates) {
            const templateItem = template.content.querySelector('[itemscope]');
            if (templateItem && templateItem.getAttribute('itemprop') === propName) {
                return templateItem.getAttribute('itemtype');
            }
        }
        return null;
    }

    getTemplatesForType(itemType) {
        const normalizedType = this.normalizeSchemaUrl(itemType);
        return this.templates.get(normalizedType) || this.templates.get(itemType) || [];
    }

    populateElement(element, data) {
        Object.entries(data).forEach(([key, value]) => {
            const propElements = element.querySelectorAll(`[itemprop="${key}"]`);
            propElements.forEach(el => {
                if (el.hasAttribute('content')) {
                    el.setAttribute('content', value);
                } else {
                    el.textContent = value;
                }
            });
        });
    }

    /**
     * Set up DOM observation to detect changes and update microdata
     */
    observeChanges() {
        const observer = new MutationObserver((mutations) => {
            const changes = this.analyzeMutations(mutations);
            
            if (changes.shouldRefresh) {
                this.refresh();
            } else if (changes.propertiesToUpdate.size > 0) {
                this.updatePropertiesFromDOM(changes.propertiesToUpdate);
            }
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['itemscope', 'itemtype', 'itemprop', 'itemid', 'content'],
            characterData: true,
            characterDataOldValue: true
        });
    }

    analyzeMutations(mutations) {
        let shouldRefresh = false;
        const propertiesToUpdate = new Map();
        
        mutations.forEach(mutation => {
            if (mutation.type === 'childList') {
                const result = this.analyzeChildListMutation(mutation);
                shouldRefresh = shouldRefresh || result.shouldRefresh;
                result.propertiesToUpdate.forEach((prop, el) => propertiesToUpdate.set(el, prop));
            } else if (mutation.type === 'attributes') {
                shouldRefresh = shouldRefresh || this.analyzeAttributeMutation(mutation, propertiesToUpdate);
            } else if (mutation.type === 'characterData') {
                this.analyzeCharacterDataMutation(mutation, propertiesToUpdate);
            }
        });
        
        return { shouldRefresh, propertiesToUpdate };
    }

    analyzeChildListMutation(mutation) {
        let shouldRefresh = false;
        const propertiesToUpdate = new Map();
        
        const checkNodes = (nodes) => {
            nodes.forEach(node => {
                if (node.nodeType === 1) {
                    if (node.hasAttribute('itemscope') || node.querySelector?.('[itemscope]')) {
                        shouldRefresh = true;
                    } else if (node.hasAttribute('itemprop')) {
                        propertiesToUpdate.set(node, node.getAttribute('itemprop'));
                    }
                }
            });
        };
        
        checkNodes(mutation.addedNodes);
        checkNodes(mutation.removedNodes);
        
        if (mutation.target.hasAttribute('itemprop')) {
            propertiesToUpdate.set(mutation.target, mutation.target.getAttribute('itemprop'));
        }
        
        return { shouldRefresh, propertiesToUpdate };
    }

    analyzeAttributeMutation(mutation, propertiesToUpdate) {
        if (['itemscope', 'itemtype', 'itemprop', 'itemid'].includes(mutation.attributeName)) {
            return true;
        } else if (mutation.attributeName === 'content' && mutation.target.hasAttribute('itemprop')) {
            propertiesToUpdate.set(mutation.target, mutation.target.getAttribute('itemprop'));
        }
        return false;
    }

    analyzeCharacterDataMutation(mutation, propertiesToUpdate) {
        let element = mutation.target.parentElement;
        while (element && !element.hasAttribute('itemprop')) {
            element = element.parentElement;
        }
        if (element) {
            propertiesToUpdate.set(element, element.getAttribute('itemprop'));
        }
    }

    updatePropertiesFromDOM(propertiesToUpdate) {
        this.isUpdatingFromDOM = true;
        
        try {
            const itemsToUpdate = this.findItemsToUpdate(propertiesToUpdate);
            
            for (const [itemProxy, propNames] of itemsToUpdate) {
                const itemElement = itemProxy._element;
                
                for (const propName of propNames) {
                    const propElements = itemElement.querySelectorAll(`[itemprop="${propName}"]:not([itemscope])`);
                    if (propElements.length > 0) {
                        const newValue = this.extractor.extractPropertyValue(propElements[0]);
                        itemProxy[propName] = newValue;
                    }
                }
            }
        } finally {
            this.isUpdatingFromDOM = false;
        }
    }

    findItemsToUpdate(propertiesToUpdate) {
        const itemsToUpdate = new Map();
        
        for (const [element, propName] of propertiesToUpdate) {
            const itemElement = this.findParentItemElement(element);
            
            if (itemElement) {
                const foundItem = this.findItemByElement(itemElement);
                
                if (foundItem) {
                    if (!itemsToUpdate.has(foundItem)) {
                        itemsToUpdate.set(foundItem, new Set());
                    }
                    itemsToUpdate.get(foundItem).add(propName);
                }
            }
        }
        
        return itemsToUpdate;
    }

    findParentItemElement(element) {
        let current = element;
        while (current && !current.hasAttribute('itemscope')) {
            current = current.parentElement;
        }
        return current;
    }

    findItemByElement(itemElement) {
        // Check items with IDs
        for (const [id, itemProxy] of this.items) {
            if (itemProxy._element === itemElement) {
                return itemProxy;
            }
        }
        
        // Check items without IDs
        for (const itemProxy of this.itemsWithoutId) {
            if (itemProxy._element === itemElement) {
                return itemProxy;
            }
        }
        
        return null;
    }

    updateCorrespondingElements(target, prop, value) {
        const parentElement = this.findParentWithItemscope(target.element);
        
        if (!parentElement) return;
        
        const siblings = Array.from(parentElement.querySelectorAll(`[itemprop][itemscope][itemtype="${target.type}"]`));
        const elementIndex = siblings.indexOf(target.element);
        
        if (elementIndex === -1) return;
        
        // Find all other containers with similar structure
        const allContainers = document.querySelectorAll(`[itemscope][itemtype="${parentElement.getAttribute('itemtype')}"]`);
        
        allContainers.forEach(container => {
            if (container === parentElement) return;
            
            const correspondingSiblings = container.querySelectorAll(`[itemprop][itemscope][itemtype="${target.type}"]`);
            if (correspondingSiblings[elementIndex]) {
                this.updatePropertyElements(correspondingSiblings[elementIndex], prop, value);
            }
        });
    }

    findParentWithItemscope(element) {
        let parent = element.parentElement;
        while (parent && !parent.hasAttribute('itemscope')) {
            parent = parent.parentElement;
        }
        return parent;
    }

    /**
     * Get the main microdata proxy object that provides access to all items
     * @returns {Proxy} The window.microdata proxy object
     */
    get microdata() {
        const self = this;
        return new Proxy({}, {
            get(target, prop) {
                // Handle toJSON for serialization
                if (prop === 'toJSON') {
                    return () => self.serializeAll();
                }
                
                // Handle numeric indices for items without IDs
                if (typeof prop === 'string' && /^\d+$/.test(prop)) {
                    const index = parseInt(prop, 10);
                    if (index >= 0 && index < self.itemsWithoutId.length) {
                        return self.itemsWithoutId[index];
                    }
                }
                
                // Handle Symbol.iterator to make it iterable
                if (prop === Symbol.iterator) {
                    return function* () {
                        for (const item of self.itemsWithoutId) {
                            yield item;
                        }
                        for (const [, item] of self.items) {
                            yield item;
                        }
                    };
                }
                
                // Handle forEach and other array methods
                if (prop === 'forEach') {
                    return function(callback, thisArg) {
                        let index = 0;
                        for (const item of self.itemsWithoutId) {
                            callback.call(thisArg, item, index++, this);
                        }
                        for (const [key, item] of self.items) {
                            callback.call(thisArg, item, key, this);
                        }
                    };
                }
                
                // Handle length property
                if (prop === 'length') {
                    return self.itemsWithoutId.length + self.items.size;
                }
                
                // Try ID first
                if (self.items.has(prop)) {
                    return self.items.get(prop);
                }
                
                // Try #id
                if (self.items.has('#' + prop)) {
                    return self.items.get('#' + prop);
                }
                
                return undefined;
            },
            
            ownKeys() {
                const keys = [];
                for (let i = 0; i < self.itemsWithoutId.length; i++) {
                    keys.push(String(i));
                }
                keys.push(...Array.from(self.items.keys()));
                return keys;
            },
            
            has(target, prop) {
                if (typeof prop === 'string' && /^\d+$/.test(prop)) {
                    const index = parseInt(prop, 10);
                    return index >= 0 && index < self.itemsWithoutId.length;
                }
                return self.items.has(prop) || self.items.has('#' + prop);
            }
        });
    }

    serializeAll() {
        // If we only have items without IDs, return an array
        if (this.items.size === 0 && this.itemsWithoutId.length > 0) {
            return this.itemsWithoutId.map(item => {
                if (item && typeof item.toJSON === 'function') {
                    return item.toJSON();
                }
                return item;
            });
        }
        
        // Otherwise return an object
        const result = {};
        
        // Add items with IDs as properties
        for (const [key, item] of this.items) {
            if (item && typeof item.toJSON === 'function') {
                const propKey = key.startsWith('#') ? key.substring(1) : key;
                result[propKey] = item.toJSON();
            }
        }
        
        // Add items without IDs with numeric indices
        for (let i = 0; i < this.itemsWithoutId.length; i++) {
            const item = this.itemsWithoutId[i];
            if (item && typeof item.toJSON === 'function') {
                result[i] = item.toJSON();
            }
        }
        
        return result;
    }
}

// Initialize the API
const api = new MicrodataAPI();

/**
 * Define window.microdata as a getter that returns the live microdata proxy
 * 
 * This provides the main entry point for accessing microdata:
 * - window.microdata.itemId - Access items by ID
 * - window.microdata[0] - Access items without ID by index
 * - window.microdata.forEach() - Iterate over all items
 * - for (const item of window.microdata) - Use iterator protocol
 * - JSON.stringify(window.microdata) - Serialize to JSON-LD
 */
Object.defineProperty(window, 'microdata', {
    get() {
        return api.microdata;
    },
    configurable: true
});

// Export for module usage
export { SchemaRegistry, MicrodataExtractor, MicrodataAPI };