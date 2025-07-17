/**
 * Schema Elements - Live Microdata API
 * 
 * A vanilla JavaScript library that provides a live, reactive API for HTML microdata.
 * Treats microdata embedded in HTML as a live data layer with automatic DOM synchronization.
 * 
 * Key features:
 * - Live data binding through document.microdata
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
 * const company = document.microdata.company;
 * 
 * // Modify data (DOM updates automatically)
 * company.name = "New Company Name";
 * 
 * // Array operations
 * company.employee.push({ name: "John Doe", email: "john@example.com" });
 * 
 * // Iterate over items
 * for (const item of document.microdata) {
 *   console.log(item);
 * }
 * 
 * // JSON-LD serialization
 * const jsonLD = JSON.stringify(document.microdata);
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
    // Cardinality constants
    static CARDINALITY = {
        ONE: '1',
        ZERO_OR_ONE: '0..1',
        ZERO_OR_MANY: '0..n',
        ONE_OR_MANY: '1..n'
    };
    
    static DEFAULT_CARDINALITY = SchemaRegistry.CARDINALITY.ZERO_OR_ONE;
    
    // Regex patterns for validation
    static REGEX_PATTERNS = {
        TIME: /^\d{2}:\d{2}(:\d{2})?$/,
        NUMERIC_INDEX: /^\d+$/
    };
    
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
        this.typeValidators.set('https://schema.org/Time', (value) => SchemaRegistry.REGEX_PATTERNS.TIME.test(value));
        
        // Dynamic enumeration validation - will be populated as schemas are loaded
        this.enumerationValidators = new Map();
        
        // Set up built-in enumeration validators as fallbacks
        this.setupBuiltinEnumerations();
    }

    /**
     * Set up built-in enumeration validators as fallbacks
     */
    setupBuiltinEnumerations() {
        // organised.team Cardinal enumeration
        this.registerEnumerationValidator('https://organised.team/Cardinal', 
            Object.values(SchemaRegistry.CARDINALITY));
    }

    /**
     * Check if a schema represents an enumeration type
     * @param {Object} schema - The schema to check
     * @returns {boolean} True if it's an enumeration
     */
    isEnumerationSchema(schema) {
        return schema && (
            schema.parent === 'https://schema.org/Enumeration' ||
            schema.parent === 'https://organised.team/Enumerated' ||
            this.schemas.get(schema.parent)?.parent === 'https://schema.org/Enumeration'
        );
    }

    /**
     * Extract enumeration values from a schema document
     * @param {Document} doc - The schema document
     * @param {string} enumerationType - The enumeration type URL
     * @returns {Array<string>} Array of valid enumeration values
     */
    extractEnumerationValues(doc, enumerationType) {
        const values = [];
        
        // Look for enumeration instances in the document
        const enumInstances = doc.querySelectorAll(`[itemscope][itemtype="${enumerationType}"]`);
        
        enumInstances.forEach(instance => {
            // Skip the main schema definition (it should have an itemprop="parent")
            const parentElement = instance.querySelector('[itemprop="parent"]');
            if (parentElement) {
                return; // This is the schema definition, not an enumeration value
            }
            
            // This is an enumeration value instance
            const nameElement = instance.querySelector('[itemprop="name"]');
            if (nameElement) {
                const value = nameElement.textContent.trim();
                if (value) {
                    values.push(value);
                }
            }
        });
        
        return values;
    }

    /**
     * Register enumeration validator for a type
     * @param {string} typeUrl - The enumeration type URL
     * @param {Array<string>} validValues - Array of valid enumeration values
     */
    registerEnumerationValidator(typeUrl, validValues) {
        this.enumerationValidators.set(typeUrl, new Set(validValues));
        
        // Also register as a type validator
        this.typeValidators.set(typeUrl, (value) => {
            return this.enumerationValidators.get(typeUrl)?.has(value) || false;
        });
    }

    /**
     * Get valid enumeration values for a type
     * @param {string} typeUrl - The enumeration type URL
     * @returns {Array<string>} Array of valid values, or empty array if not found
     */
    getEnumerationValues(typeUrl) {
        const values = this.enumerationValidators.get(typeUrl);
        return values ? Array.from(values) : [];
    }

    /**
     * Check if a type is an enumeration
     * @param {string} typeUrl - The type URL to check
     * @returns {boolean} True if it's a registered enumeration
     */
    isEnumerationType(typeUrl) {
        return this.enumerationValidators.has(typeUrl);
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
            
            // Check if this is an enumeration schema and register its values
            if (this.isEnumerationSchema(schema)) {
                const enumValues = this.extractEnumerationValues(doc, url);
                if (enumValues.length > 0) {
                    this.registerEnumerationValidator(url, enumValues);
                }
            }
            
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
                cardinality: this.extractProperty(propElement, 'cardinality') || SchemaRegistry.DEFAULT_CARDINALITY,
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
    // Container elements that group microdata items
    static CONTAINER_ELEMENTS = ['UL', 'TBODY', 'DIV'];
    
    constructor(registry) {
        this.registry = registry;
    }

    /**
     * Check if an element is a valid microdata element
     * @param {Element} element - The element to check
     * @returns {boolean} True if the element has itemscope
     */
    isValidMicrodataElement(element) {
        return element.hasAttribute('itemscope');
    }

    /**
     * Create a basic item object from an element
     * @param {Element} element - The element to create item from
     * @returns {Object} The item object with element, type, id, and properties
     */
    createItemFromElement(element) {
        const type = element.getAttribute('itemtype');
        const id = element.getAttribute('itemid') || 
                   (element.id ? `#${element.id}` : null);

        return {
            element,
            type: this.normalizeSchemaUrl(type),
            id,
            properties: {}
        };
    }

    /**
     * Load schema if type is available
     * @param {string} type - The item type URL
     * @returns {Promise<Object|null>} The schema or null
     */
    async loadSchemaIfAvailable(type) {
        return type ? await this.registry.loadSchema(type) : null;
    }

    /**
     * Group properties by their itemprop name
     * @param {Element} element - The element to extract properties from
     * @returns {Object} Properties grouped by name
     */
    groupPropertiesByName(element) {
        const props = element.querySelectorAll('[itemprop]');
        const propGroups = {};

        props.forEach(prop => {
            const propName = prop.getAttribute('itemprop');
            if (!propGroups[propName]) {
                propGroups[propName] = [];
            }
            propGroups[propName].push(prop);
        });

        return propGroups;
    }

    /**
     * Process property groups with deduplication and value extraction
     * @param {Object} propGroups - Properties grouped by name
     * @param {Object} item - The item to add properties to
     * @param {Element} element - The parent element
     * @param {Object} schema - The schema definition
     */
    async processPropertyGroups(propGroups, item, element, schema) {
        // Handle deduplication for array properties
        for (const [propName, props] of Object.entries(propGroups)) {
            const itemscopeProps = props.filter(p => p.hasAttribute('itemscope'));
            
            if (itemscopeProps.length > 1 && this.hasPropertiesInMultipleContainers(props)) {
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
    }

    /**
     * Ensure all schema-defined properties exist on the item
     * @param {Object} item - The item to add properties to
     * @param {Object} schema - The schema definition
     */
    ensureSchemaPropertiesExist(item, schema) {
        if (!schema) return;

        for (const schemaProp of schema.properties) {
            if (!(schemaProp.name in item.properties)) {
                const cardinality = schemaProp.cardinality || SchemaRegistry.DEFAULT_CARDINALITY;
                if (cardinality === SchemaRegistry.CARDINALITY.ZERO_OR_MANY || 
                    cardinality === SchemaRegistry.CARDINALITY.ONE_OR_MANY) {
                    item.properties[schemaProp.name] = [];
                } else {
                    item.properties[schemaProp.name] = null;
                }
            }
        }
    }

    async extractFromElement(element) {
        if (!this.isValidMicrodataElement(element)) {
            return null;
        }
        
        const item = this.createItemFromElement(element);
        const schema = await this.loadSchemaIfAvailable(item.type);
        
        const propGroups = this.groupPropertiesByName(element);
        await this.processPropertyGroups(propGroups, item, element, schema);
        this.ensureSchemaPropertiesExist(item, schema);
        
        return item;
    }

    /**
     * Check if properties are distributed across multiple container elements
     * @param {Array<Element>} props - Array of property elements
     * @returns {boolean} True if properties are in multiple containers
     */
    hasPropertiesInMultipleContainers(props) {
        const containers = new Set();
        props.forEach(prop => {
            if (prop.hasAttribute('itemscope')) {
                let container = prop.parentElement;
                while (container && container.tagName !== 'BODY') {
                    if (MicrodataExtractor.CONTAINER_ELEMENTS.includes(container.tagName)) {
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
                    if (MicrodataExtractor.CONTAINER_ELEMENTS.includes(container.tagName)) {
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
                    if (MicrodataExtractor.CONTAINER_ELEMENTS.includes(container.tagName)) {
                        return false;
                    }
                    container = container.parentElement;
                }
                return true;
            });
        }
        
        return props;
    }

    /**
     * Determine if a property should be treated as an array based on schema
     * @param {string} propName - The property name
     * @param {Object} schema - The schema definition
     * @returns {boolean} True if the property should be an array
     */
    shouldPropertyBeArray(propName, schema) {
        if (schema) {
            const property = schema.properties.find(p => p.name === propName);
            if (property) {
                const cardinality = property.cardinality || SchemaRegistry.CARDINALITY.ONE;
                return cardinality === SchemaRegistry.CARDINALITY.ZERO_OR_MANY || 
                       cardinality === SchemaRegistry.CARDINALITY.ONE_OR_MANY;
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
                propElements.forEach(el => self.updatePropertyElement(el, value));
                
                return true;
            }
        });
    }
}

/**
 * MicrodataAPI - Main API class for live microdata functionality
 * 
 * Provides the document.microdata interface with live data binding,
 * DOM synchronization, and reactive array operations.
 */
class MicrodataAPI {
    // DOM node type constants
    static NODE_TYPE = {
        ELEMENT: 1,
        TEXT: 3,
        COMMENT: 8,
        DOCUMENT: 9
    };
    
    // Internal tracking attribute
    static INTERNAL_ID_ATTR = 'data-microdata-internal-id';
    
    /**
     * Check if a property is a numeric index
     * @param {*} prop - The property to check
     * @returns {boolean} True if the property represents a numeric index
     */
    static isNumericIndex(prop) {
        return typeof prop === 'string' && SchemaRegistry.REGEX_PATTERNS.NUMERIC_INDEX.test(prop);
    }

    /**
     * Render a microdata item or JSON-LD object to a template
     * @param {HTMLTemplateElement} template - The template element to render to
     * @param {Object} data - The microdata item or JSON-LD object to render
     * @returns {DocumentFragment} The populated template content
     */
    static render(template, data) {
        if (!template || !template.content) {
            throw new Error('Invalid template element provided');
        }
        
        if (!data) {
            throw new Error('No data provided to render');
        }
        
        // Clone the template content
        const clone = template.content.cloneNode(true);
        const itemElement = clone.querySelector('[itemscope]');
        
        if (!itemElement) {
            throw new Error('Template must contain an element with itemscope attribute');
        }
        
        // Populate the template with data
        MicrodataAPI.populateTemplateElement(itemElement, data);
        
        return clone;
    }

    /**
     * Populate a template element with data from a microdata item or JSON-LD
     * @param {Element} element - The element to populate
     * @param {Object} data - The data to populate with
     */
    static populateTemplateElement(element, data) {
        // Get all potential property names from the template
        const propElements = element.querySelectorAll('[itemprop]');
        const propertyNames = new Set();
        
        propElements.forEach(el => {
            const propName = el.getAttribute('itemprop');
            if (propName) {
                propertyNames.add(propName);
            }
        });
        
        // For each property name, try to get the value from the data object
        propertyNames.forEach(propName => {
            let value;
            
            // Try to get value - works for both proxy objects and plain objects
            if (data.properties && data.properties[propName] !== undefined) {
                // Microdata proxy object with properties
                value = data.properties[propName];
            } else if (data[propName] !== undefined) {
                // Direct property access (works for proxy objects and JSON-LD)
                value = data[propName];
            } else {
                // Property not found
                return;
            }
            
            // Skip JSON-LD metadata
            if (['@context', '@type', '@id'].includes(propName)) {
                return;
            }
            
            // Find elements with this property (non-nested)
            const targetElements = element.querySelectorAll(`[itemprop="${propName}"]:not([itemscope])`);
            
            targetElements.forEach(targetElement => {
                if (Array.isArray(value)) {
                    // For array values, use the first value
                    MicrodataAPI.setElementValue(targetElement, value[0] || '');
                } else {
                    MicrodataAPI.setElementValue(targetElement, value);
                }
            });
            
            // Handle nested itemscope elements
            const nestedElements = element.querySelectorAll(`[itemprop="${propName}"][itemscope]`);
            nestedElements.forEach(nestedElement => {
                if (typeof value === 'object' && !Array.isArray(value)) {
                    MicrodataAPI.populateTemplateElement(nestedElement, value);
                }
            });
        });
    }

    /**
     * Set the value of an element appropriately based on its type
     * @param {Element} element - The element to set the value on
     * @param {*} value - The value to set
     */
    static setElementValue(element, value) {
        const stringValue = String(value || '');
        
        if (element.hasAttribute('content')) {
            element.setAttribute('content', stringValue);
        } else if (element.tagName === 'INPUT') {
            element.value = stringValue;
        } else if (element.tagName === 'A' && element.hasAttribute('href')) {
            element.href = stringValue;
            if (!element.textContent.trim()) {
                element.textContent = stringValue;
            }
        } else if (element.tagName === 'IMG' && element.hasAttribute('src')) {
            element.src = stringValue;
            element.alt = element.alt || stringValue;
        } else {
            element.textContent = stringValue;
        }
    }
    
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
        this.internalIdCounter = 0; // Counter for generating internal IDs
        this.elementToInternalId = new WeakMap(); // Track which elements belong to which internal ID
        this.internalIdToElements = new Map(); // Track all elements for each internal ID
        this.propertyTypeMap = new Map(); // Maps itemType:propertyName to property type for validation
        this.initialize();
    }

    /**
     * Initialize the API by setting up DOM observation and extraction
     */
    initialize() {
        const setup = async () => {
            await this.refresh();
            this.discoverEnumerations();
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
                propElements.forEach(el => this.updatePropertyElement(el, value));
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
                    propElements.forEach(el => this.updatePropertyElement(el, value));
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

    /**
     * Create a content signature for an item for deduplication
     * @param {Object} item - The item to create a signature for
     * @returns {string} A signature based on the item's properties
     */
    createItemSignature(item) {
        const props = [];
        for (const [key, value] of Object.entries(item.properties)) {
            if (typeof value === 'string' || typeof value === 'number') {
                props.push(`${key}:${value}`);
            }
        }
        return `${item.type}|${props.sort().join('|')}`;
    }

    async extractAllItems() {
        const itemElements = document.querySelectorAll('[itemscope]');
        const topLevelItemsWithoutId = [];
        const itemsBySignature = new Map(); // Track items by their content signature
        
        for (const element of itemElements) {
            if (this.isNestedItem(element)) continue;
            
            const item = await this.extractor.extractFromElement(element);
            
            if (item) {
                const proxy = this.createLiveProxy(item);
                
                if (item.id) {
                    this.items.set(item.id, proxy);
                } else {
                    // For items without IDs, check if we've seen this content before
                    const signature = this.createItemSignature(item);
                    
                    if (itemsBySignature.has(signature)) {
                        // This is a duplicate item in another view
                        const existingItem = itemsBySignature.get(signature);
                        const internalId = this.elementToInternalId.get(existingItem._element) || this.generateInternalId();
                        
                        // Register both elements with the same internal ID
                        if (!this.elementToInternalId.has(existingItem._element)) {
                            this.registerElementWithInternalId(existingItem._element, internalId);
                        }
                        this.registerElementWithInternalId(element, internalId);
                    } else {
                        // This is a new unique item
                        itemsBySignature.set(signature, proxy);
                        topLevelItemsWithoutId.push(proxy);
                        
                        // Generate and register internal ID
                        this.generateAndRegisterInternalId(element);
                    }
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
     * Create array proxy handler for reactive array operations
     * @param {Array} items - The array to proxy
     * @param {string} propName - The property name this array belongs to
     * @param {Object} parentItem - The parent item
     * @param {Element} parentElement - The parent DOM element
     * @returns {Object} Proxy handler object
     */
    createArrayProxyHandler(items, propName, parentItem, parentElement) {
        const self = this;
        
        return {
            get(target, prop) {
                // Handle toJSON for serialization
                if (prop === 'toJSON') {
                    return () => self.serializeArray(target);
                }
                
                // Array methods
                if (prop === 'push') {
                    return (...args) => self.handleArrayPush(target, args, parentItem, propName, parentElement);
                }
                if (prop === 'pop') {
                    return () => self.handleArrayPop(target, propName, parentItem);
                }
                if (prop === 'splice') {
                    return async (start, deleteCount, ...items) => 
                        self.handleArraySplice({ target, start, deleteCount, items, propName, parentItem, parentElement });
                }
                
                // Create live proxies for array items
                if (typeof prop === 'number' || MicrodataAPI.isNumericIndex(prop)) {
                    const index = Number(prop);
                    if (target[index]) {
                        return self.createLiveProxy(target[index]);
                    }
                }
                
                return target[prop];
            }
        };
    }

    /**
     * Create array proxy for reactive array operations
     * @param {Array} items - The array to proxy
     * @param {string} propName - The property name this array belongs to
     * @param {Object} parentItem - The parent item
     * @param {Element} parentElement - The parent DOM element
     * @returns {Proxy} Proxied array with reactive behavior
     */
    createArrayProxy(items, propName, parentItem, parentElement) {
        return new Proxy(items, this.createArrayProxyHandler(items, propName, parentItem, parentElement));
    }

    /**
     * Handle special proxy properties for items
     * @param {Object} target - The target item
     * @param {string} prop - The property being accessed
     * @returns {*} The property value or undefined if not a special property
     */
    handleSpecialProperties(target, prop) {
        if (prop === '_element') return target.element;
        if (prop === '_type') return target.type;
        if (prop === '_id') return target.id;
        if (prop === 'toJSON') return () => this.serializeItem(target);
        
        return undefined;
    }

    /**
     * Check if a value is a microdata item object
     * @param {*} value - The value to check
     * @returns {boolean} True if the value is a microdata item
     */
    isMicrodataItem(value) {
        return value && typeof value === 'object' && value.element;
    }

    /**
     * Check if a value is a microdata item with properties
     * @param {*} value - The value to check
     * @returns {boolean} True if the value is a microdata item with properties
     */
    isMicrodataItemWithProperties(value) {
        return value && typeof value === 'object' && value.properties;
    }

    /**
     * Get the appropriate proxy for a property value
     * @param {*} value - The property value
     * @param {string} propName - The property name
     * @param {Object} parentItem - The parent item
     * @returns {*} The value or a proxy if applicable
     */
    getProxiedValue(value, propName, parentItem) {
        // If it's an array, wrap in array proxy
        if (Array.isArray(value)) {
            return this.createArrayProxy(value, propName, parentItem, parentItem.element);
        }
        
        // If it's a nested item, wrap in proxy
        if (this.isMicrodataItem(value)) {
            return this.createLiveProxy(value);
        }
        
        return value;
    }

    /**
     * Create item proxy handler for reactive item operations
     * @param {Object} item - The item to proxy
     * @returns {Object} Proxy handler object
     */
    createItemProxyHandler(item) {
        const self = this;
        
        return {
            get(target, prop) {
                // Handle special properties
                const specialValue = self.handleSpecialProperties(target, prop);
                if (specialValue !== undefined) {
                    return specialValue;
                }
                
                const value = target.properties[prop];
                return self.getProxiedValue(value, prop, target);
            },
            
            set(target, prop, value) {
                // Validate the value before setting it
                const isValid = self.validatePropertyValue(target, prop, value);
                if (!isValid) {
                    throw new Error(`Invalid value "${value}" for property "${prop}"`);
                }
                
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
        };
    }

    /**
     * Create a live proxy object for an item with reactive behavior
     * @param {Object} item - The item to create a proxy for
     * @returns {Proxy} A proxy with live DOM synchronization
     */
    createLiveProxy(item) {
        return new Proxy(item, this.createItemProxyHandler(item));
    }

    serializeArray(items) {
        return items.map(item => {
            if (this.canSerializeToJson(item)) {
                return item.toJSON();
            } else if (item && typeof item === 'object' && item.properties) {
                return this.createJsonLd(item);
            }
            return item;
        });
    }

    /**
     * Check if an object can be JSON serialized
     * @param {*} obj - The object to check
     * @returns {boolean} True if the object has a toJSON method
     */
    canSerializeToJson(obj) {
        return obj && typeof obj === 'object' && typeof obj.toJSON === 'function';
    }

    /**
     * Serialize an object if possible, otherwise return it as-is
     * @param {*} obj - The object to serialize
     * @returns {*} The serialized object or the original value
     */
    serializeIfPossible(obj) {
        if (this.canSerializeToJson(obj)) {
            return obj.toJSON();
        }
        return obj;
    }

    serializeItem(item) {
        return this.createJsonLd(item);
    }

    /**
     * Extract context and type name from a type URL
     * @param {string} typeUrl - The full type URL
     * @returns {Object} Object with context and typeName properties
     */
    parseTypeUrl(typeUrl) {
        if (!typeUrl) {
            return { context: "https://schema.org", typeName: null };
        }
        
        const lastSlashIndex = typeUrl.lastIndexOf('/');
        if (lastSlashIndex <= 0) {
            return { context: "https://schema.org", typeName: typeUrl };
        }
        
        return {
            context: typeUrl.substring(0, lastSlashIndex),
            typeName: typeUrl.substring(lastSlashIndex + 1)
        };
    }

    createJsonLd(item) {
        const result = {};
        const { context, typeName } = this.parseTypeUrl(item.type);
        
        result["@context"] = context;
        
        if (typeName) {
            result["@type"] = typeName;
        }
        
        if (item.id) {
            result["@id"] = item.id;
        }
        
        // Add all properties
        for (const [key, value] of Object.entries(item.properties)) {
            if (Array.isArray(value)) {
                result[key] = this.serializeArray(value);
            } else if (this.canSerializeToJson(value)) {
                result[key] = value.toJSON();
            } else if (this.isMicrodataItemWithProperties(value)) {
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

    /**
     * Handle array splice operation with DOM updates
     * @param {Object} spliceOptions - The splice operation parameters
     * @param {Array} spliceOptions.target - The target array
     * @param {number} spliceOptions.start - The start index
     * @param {number} spliceOptions.deleteCount - Number of items to delete
     * @param {Array} spliceOptions.items - Items to insert
     * @param {string} spliceOptions.propName - The property name
     * @param {Object} spliceOptions.parentItem - The parent item
     * @param {Element} spliceOptions.parentElement - The parent DOM element
     */
    async handleArraySplice(spliceOptions) {
        const { target, start, deleteCount, items, propName, parentItem, parentElement } = spliceOptions;
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
                const elementToRemove = elements[elements.length - 1];
                // Clean up internal ID tracking before removing
                this.unregisterElement(elementToRemove);
                elementToRemove.remove();
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

    /**
     * Update a single property element with a value
     * @param {Element} element - The element to update
     * @param {*} value - The value to set
     */
    updatePropertyElement(element, value) {
        if (element.hasAttribute('content')) {
            element.setAttribute('content', value);
        } else {
            element.textContent = value;
        }
    }

    updatePropertyElements(container, prop, value) {
        const propElements = container.querySelectorAll(`[itemprop="${prop}"]:not([itemscope])`);
        propElements.forEach(el => this.updatePropertyElement(el, value));
    }

    async addItemFromData(data, parentType, propName, parentElement, insertBefore = null) {
        const itemType = await this.determineItemType(parentType, propName);
        
        if (!itemType) return;
        
        const templates = this.getTemplatesForType(itemType);
        
        if (templates.length === 0) return;

        // Generate a unique internal ID for this data item
        const internalId = this.generateInternalId();

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
                
                // Register the newly created element with the internal ID
                const insertedElement = parent.lastElementChild;
                if (insertedElement && insertedElement.hasAttribute('itemscope')) {
                    this.registerElementWithInternalId(insertedElement, internalId);
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
            propElements.forEach(el => this.updatePropertyElement(el, value));
        });
    }

    /**
     * Validate a property value against its type constraints
     * @param {Object} target - The target item
     * @param {string} prop - The property name
     * @param {*} value - The value to validate
     * @returns {boolean} True if the value is valid
     */
    validatePropertyValue(target, prop, value) {
        try {
            // Look up the property type from our mapping
            const mapKey = `${target.type}:${prop}`;
            const propertyType = this.propertyTypeMap.get(mapKey);
            
            if (propertyType) {
                // Check if we have a validator for this type
                const validator = this.registry.typeValidators.get(propertyType);
                if (validator) {
                    return validator(value);
                }
            }
            
            // No type mapping or validator found, allow the value
            return true;
        } catch (error) {
            console.warn(`Validation error for ${prop}:`, error);
            return true; // On error, allow the value (fail-open)
        }
    }

    /**
     * Discover and register enumeration schemas in the current document
     */
    discoverEnumerations() {
        // Find all itemscope elements that might be schema definitions
        const schemaElements = document.querySelectorAll('[itemscope][itemtype]');
        
        schemaElements.forEach(element => {
            const itemType = element.getAttribute('itemtype');
            
            // Check if this element defines an enumeration schema
            const parentElement = element.querySelector('[itemprop="parent"]');
            if (parentElement) {
                const parent = parentElement.textContent.trim() || parentElement.getAttribute('content');
                
                // If parent is Enumeration, this is an enumeration schema
                if (parent === 'https://schema.org/Enumeration' || 
                    parent === 'https://organised.team/Enumerated') {
                    
                    // Extract enumeration values from the document
                    const values = this.registry.extractEnumerationValues(document, itemType);
                    
                    if (values.length > 0) {
                        this.registry.registerEnumerationValidator(itemType, values);
                        console.log(`Discovered enumeration: ${itemType} with values:`, values);
                    }
                }
            }
            
            // Also check if this element defines properties with enumeration types
            const properties = element.querySelectorAll('[itemscope][itemtype="https://organised.team/Property"]');
            properties.forEach(propElement => {
                const propName = propElement.querySelector('[itemprop="name"]')?.textContent?.trim();
                const propType = propElement.querySelector('[itemprop="type"]')?.textContent?.trim();
                
                if (propName && propType) {
                    const mapKey = `${itemType}:${propName}`;
                    this.propertyTypeMap.set(mapKey, propType);
                    console.log(`Mapped property: ${mapKey} → ${propType}`);
                }
            });
        });
    }

    /**
     * Set up DOM observation to detect changes and update microdata
     */
    observeChanges() {
        const observer = new MutationObserver((mutations) => {
            const changes = this.determineRequiredChanges(mutations);
            
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

    /**
     * Determine what changes are needed based on DOM mutations
     * @param {Array<MutationRecord>} mutations - The DOM mutations
     * @returns {Object} Object with shouldRefresh and propertiesToUpdate
     */
    determineRequiredChanges(mutations) {
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
        
        const checkNodesForMicrodataChanges = (nodes) => {
            nodes.forEach(node => {
                if (node.nodeType === MicrodataAPI.NODE_TYPE.ELEMENT) {
                    if (node.hasAttribute('itemscope') || node.querySelector?.('[itemscope]')) {
                        shouldRefresh = true;
                    } else if (node.hasAttribute('itemprop')) {
                        propertiesToUpdate.set(node, node.getAttribute('itemprop'));
                    }
                }
            });
        };
        
        checkNodesForMicrodataChanges(mutation.addedNodes);
        checkNodesForMicrodataChanges(mutation.removedNodes);
        
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

    /**
     * Generate a unique internal ID for tracking elements
     * @returns {string} A unique internal ID
     */
    generateInternalId() {
        return `__microdata_internal_${++this.internalIdCounter}`;
    }

    /**
     * Generate and register a new internal ID for an element
     * @param {Element} element - The element to register
     * @returns {string} The generated internal ID
     */
    generateAndRegisterInternalId(element) {
        const internalId = this.generateInternalId();
        this.registerElementWithInternalId(element, internalId);
        return internalId;
    }

    /**
     * Register an element with an internal ID for tracking
     * @param {Element} element - The DOM element to track
     * @param {string} internalId - The internal ID to associate
     */
    registerElementWithInternalId(element, internalId) {
        // Store the ID on the element as a data attribute
        element.setAttribute(MicrodataAPI.INTERNAL_ID_ATTR, internalId);
        
        // Track in our maps
        this.elementToInternalId.set(element, internalId);
        
        if (!this.internalIdToElements.has(internalId)) {
            this.internalIdToElements.set(internalId, new Set());
        }
        this.internalIdToElements.get(internalId).add(element);
    }

    /**
     * Get all elements associated with an internal ID
     * @param {string} internalId - The internal ID
     * @returns {Set<Element>} Set of elements with this ID
     */
    getElementsWithInternalId(internalId) {
        return this.internalIdToElements.get(internalId) || new Set();
    }

    /**
     * Clean up tracking for removed elements
     * @param {Element} element - The element being removed
     */
    unregisterElement(element) {
        const internalId = this.elementToInternalId.get(element);
        if (internalId) {
            this.elementToInternalId.delete(element);
            const elements = this.internalIdToElements.get(internalId);
            if (elements) {
                elements.delete(element);
                if (elements.size === 0) {
                    this.internalIdToElements.delete(internalId);
                }
            }
        }
    }

    updateCorrespondingElements(target, prop, value) {
        // Get the internal ID from the element
        const internalId = this.elementToInternalId.get(target.element);
        
        if (!internalId) {
            // If no internal ID, this element wasn't created via our tracking system
            return;
        }
        
        // Get all elements with the same internal ID
        const correspondingElements = this.getElementsWithInternalId(internalId);
        
        // Update all corresponding elements
        correspondingElements.forEach(element => {
            if (element !== target.element) {
                this.updatePropertyElements(element, prop, value);
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
     * @returns {Proxy} The document.microdata proxy object
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
                if (MicrodataAPI.isNumericIndex(prop)) {
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
                if (MicrodataAPI.isNumericIndex(prop)) {
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
            return this.itemsWithoutId.map(item => this.serializeIfPossible(item));
        }
        
        // Otherwise return an object
        const result = {};
        
        // Add items with IDs as properties
        for (const [key, item] of this.items) {
            const serialized = this.serializeIfPossible(item);
            if (serialized !== item) { // Only add if it was actually serializable
                const propKey = key.startsWith('#') ? key.substring(1) : key;
                result[propKey] = serialized;
            }
        }
        
        // Add items without IDs with numeric indices
        for (let i = 0; i < this.itemsWithoutId.length; i++) {
            const serialized = this.serializeIfPossible(this.itemsWithoutId[i]);
            if (serialized !== this.itemsWithoutId[i]) { // Only add if it was actually serializable
                result[i] = serialized;
            }
        }
        
        return result;
    }
}

// Initialize the API
const api = new MicrodataAPI();

/**
 * Define document.microdata as a getter that returns the live microdata proxy
 * 
 * This provides the main entry point for accessing microdata:
 * - document.microdata.itemId - Access items by ID
 * - document.microdata[0] - Access items without ID by index
 * - document.microdata.forEach() - Iterate over all items
 * - for (const item of document.microdata) - Use iterator protocol
 * - JSON.stringify(document.microdata) - Serialize to JSON-LD
 */
Object.defineProperty(document, 'microdata', {
    get() {
        return api.microdata;
    },
    configurable: true
});

// Expose API to global scope for debugging and advanced usage
window.microdataAPI = api;

// Export for module usage
export { SchemaRegistry, MicrodataExtractor, MicrodataAPI };