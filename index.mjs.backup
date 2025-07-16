class SchemaRegistry {
    constructor() {
        this.schemas = new Map();
        this.typeValidators = new Map();
        this.initializeBasicTypes();
    }

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

    getBuiltInSchema(url) {
        const type = url.split('/').pop();
        const schemas = {
            'Organization': {
                id: url,
                name: 'Organization',
                properties: [
                    { name: 'name', type: 'https://schema.org/Text', cardinality: '0..1' },
                    { name: 'description', type: 'https://schema.org/Text', cardinality: '0..1' },
                    { name: 'employee', type: 'https://schema.org/Person', cardinality: '0..n' },
                    { name: 'url', type: 'https://schema.org/URL', cardinality: '0..1' }
                ]
            },
            'Person': {
                id: url,
                name: 'Person',
                properties: [
                    { name: 'name', type: 'https://schema.org/Text', cardinality: '0..1' },
                    { name: 'email', type: 'https://schema.org/Text', cardinality: '0..1' },
                    { name: 'contact', type: 'https://schema.org/Person', cardinality: '0..n' }
                ]
            },
            'Book': {
                id: url,
                name: 'Book',
                properties: [
                    { name: 'name', type: 'https://schema.org/Text', cardinality: '0..1' },
                    { name: 'author', type: 'https://schema.org/Person', cardinality: '0..1' }
                ]
            }
        };
        return schemas[type] || null;
    }

    async loadSchema(url) {
        if (this.schemas.has(url)) {
            return this.schemas.get(url);
        }

        // Check built-in schemas first
        if (url.includes('schema.org') || url.includes('organised.team')) {
            const builtInSchema = this.getBuiltInSchema(url);
            if (builtInSchema) {
                this.schemas.set(url, builtInSchema);
                return builtInSchema;
            }
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
            console.error(`Failed to load schema ${url}:`, error);
            return null;
        }
    }

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

        // Extract properties
        const propertyElements = schemaElement.querySelectorAll('[itemprop="property"][itemscope]');
        propertyElements.forEach(propElement => {
            const property = {
                name: this.extractProperty(propElement, 'name'),
                type: this.extractProperty(propElement, 'type') || propElement.getAttribute('itemtype'),
                cardinality: this.extractProperty(propElement, 'cardinality') || '1',
                required: this.extractProperty(propElement, 'required') === 'true',
                description: this.extractProperty(propElement, 'description')
            };
            schema.properties.push(property);
        });

        // Handle enumerated types
        const enumeratorElements = schemaElement.querySelectorAll('[itemprop="enumerator"]');
        if (enumeratorElements.length > 0) {
            schema.enumerators = Array.from(enumeratorElements).map(el => el.textContent.trim());
            // Register enumerated type validator
            this.typeValidators.set(url, (value) => schema.enumerators.includes(value));
        }

        return schema;
    }

    extractProperty(element, propName) {
        const propElement = element.querySelector(`[itemprop="${propName}"]`);
        return propElement ? propElement.textContent.trim() : null;
    }

    async validate(value, schemaUrl) {
        const schema = await this.loadSchema(schemaUrl);
        if (!schema) return { valid: false, errors: [`Schema ${schemaUrl} not found`] };

        const errors = [];
        const warnings = [];

        // Get all properties including inherited ones
        const allProperties = await this.getAllProperties(schema);

        // Check required properties
        for (const prop of allProperties) {
            const cardinality = prop.cardinality || '1';
            const propValue = value[prop.name];
            
            if (cardinality === '1' || cardinality === '1..n') {
                if (!propValue || (Array.isArray(propValue) && propValue.length === 0)) {
                    errors.push(`Required property '${prop.name}' is missing`);
                }
            }

            // Validate cardinality
            if (propValue !== undefined) {
                const isArray = Array.isArray(propValue);
                if ((cardinality === '1' || cardinality === '0..1') && isArray) {
                    errors.push(`Property '${prop.name}' should not be an array`);
                } else if ((cardinality === '0..n' || cardinality === '1..n') && !isArray && propValue !== null) {
                    warnings.push(`Property '${prop.name}' should be an array`);
                }

                // Validate type
                const valuesToValidate = isArray ? propValue : [propValue];
                for (const val of valuesToValidate) {
                    if (!await this.validateType(val, prop.type)) {
                        errors.push(`Property '${prop.name}' value '${val}' is not valid for type ${prop.type}`);
                    }
                }
            }
        }

        return { valid: errors.length === 0, errors, warnings };
    }

    async validateType(value, typeUrl) {
        // Check if we have a validator for this type
        if (this.typeValidators.has(typeUrl)) {
            return this.typeValidators.get(typeUrl)(value);
        }

        // Try to load the schema for complex types
        const schema = await this.loadSchema(typeUrl);
        if (schema) {
            // For complex types, validate as an object
            if (typeof value === 'object' && value !== null) {
                const result = await this.validate(value, typeUrl);
                return result.valid;
            }
        }

        // Default: accept any value
        return true;
    }

    async getAllProperties(schema) {
        const properties = [...schema.properties];
        
        // Add parent properties
        if (schema.parent) {
            const parentSchema = await this.loadSchema(schema.parent);
            if (parentSchema) {
                const parentProps = await this.getAllProperties(parentSchema);
                // Parent properties come first, can be overridden
                properties.unshift(...parentProps.filter(pp => 
                    !properties.some(p => p.name === pp.name)
                ));
            }
        }
        
        return properties;
    }
}

class MicrodataExtractor {
    constructor(schemaRegistry) {
        this.schemaRegistry = schemaRegistry;
        this.items = new Map();
        this.observers = new Map();
    }

    async extractFromElement(element) {
        const itemscope = element.hasAttribute('itemscope');
        if (!itemscope) return null;

        const item = {
            element,
            type: element.getAttribute('itemtype'),
            id: element.getAttribute('itemid') || element.id,
            properties: {}
        };

        // Load schema to understand property cardinalities
        const schema = await this.schemaRegistry.loadSchema(item.type);
        
        // Extract direct child properties only
        const allProps = element.querySelectorAll('[itemprop]');
        const directProps = Array.from(allProps).filter(prop => {
            // Check if this prop belongs directly to this item
            let parent = prop.parentElement;
            while (parent && parent !== element) {
                if (parent.hasAttribute('itemscope') && parent !== prop) {
                    return false; // This prop belongs to a nested item
                }
                parent = parent.parentElement;
            }
            return true; // Include if we reached the element
        });

        // Group properties by name first, but only take the first occurrence of each property
        const propGroups = {};
        directProps.forEach(prop => {
            const propName = prop.getAttribute('itemprop');
            if (!propGroups[propName]) {
                propGroups[propName] = [];
            }
            propGroups[propName].push(prop);
        });
        
        // For each property group, if it contains itemscope elements, only keep the first container
        for (const [propName, props] of Object.entries(propGroups)) {
            const itemscopeProps = props.filter(p => p.hasAttribute('itemscope'));
            console.log(`Property ${propName}: found ${itemscopeProps.length} itemscope elements`);
            
            if (itemscopeProps.length > 1) {
                // Find the first parent container that contains these items
                const containers = new Set();
                itemscopeProps.forEach(prop => {
                    let container = prop.parentElement;
                    while (container && container !== element) {
                        if (container.tagName === 'UL' || container.tagName === 'TBODY' || container.tagName === 'DIV') {
                            containers.add(container);
                            console.log(`Found container: ${container.tagName}.${container.className}`);
                            break;
                        }
                        container = container.parentElement;
                    }
                });
                
                console.log(`Found ${containers.size} containers for property ${propName}`);
                
                // Only keep items from the first container found
                if (containers.size > 1) {
                    const firstContainer = Array.from(containers)[0];
                    console.log(`Using first container: ${firstContainer.tagName}.${firstContainer.className}`);
                    
                    const originalCount = propGroups[propName].length;
                    propGroups[propName] = props.filter(p => {
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
                    
                    console.log(`Filtered ${propName} from ${originalCount} to ${propGroups[propName].length} elements`);
                }
            }
        }

        // Process each property group
        for (const [propName, propElements] of Object.entries(propGroups)) {
            // Check schema cardinality for this property
            let shouldBeArray = false;
            if (schema) {
                const property = schema.properties.find(p => p.name === propName);
                if (property) {
                    const cardinality = property.cardinality || '1';
                    shouldBeArray = cardinality === '0..n' || cardinality === '1..n';
                }
            }
            
            const values = [];
            for (const prop of propElements) {
                if (prop.hasAttribute('itemscope')) {
                    // This is a nested item
                    const nestedItem = await this.extractFromElement(prop);
                    values.push(nestedItem);
                } else {
                    // This is a simple property
                    const value = this.extractPropertyValue(prop);
                    values.push(value);
                }
            }
            
            // Set the property based on schema cardinality
            if (shouldBeArray) {
                item.properties[propName] = values;
            } else {
                item.properties[propName] = values.length > 0 ? values[0] : null;
            }
        }

        return item;
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

class MicrodataAPI {
    constructor() {
        this.registry = new SchemaRegistry();
        this.extractor = new MicrodataExtractor(this.registry);
        this.items = new Map();
        this.itemsWithoutId = [];
        this.templates = new Map();
        this.isUpdatingFromDOM = false; // Flag to prevent infinite loops
        this.initialize();
    }

    initialize() {
        const setup = async () => {
            console.log('MicrodataAPI: Initializing...');
            await this.refresh();
            this.observeChanges();
            console.log('MicrodataAPI: Found items:', Array.from(this.items.keys()));
        };

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', setup);
        } else {
            // DOM is already loaded, but we should still wait a tick for everything to be ready
            setTimeout(setup, 0);
        }
    }

    normalizeSchemaUrl(url) {
        // Convert http to https for schema.org URLs
        if (url && url.startsWith('http://schema.org/')) {
            return url.replace('http://', 'https://');
        }
        return url;
    }

    async refresh() {
        this.items.clear();
        this.itemsWithoutId = [];
        this.templates.clear();

        // Find all templates
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
        console.log('MicrodataAPI: Found templates:', Array.from(this.templates.keys()));

        // Extract all items
        const itemElements = document.querySelectorAll('[itemscope]');
        console.log('MicrodataAPI: Found itemscope elements:', itemElements.length);
        
        // Track top-level items without IDs
        const topLevelItemsWithoutId = [];
        
        for (const element of itemElements) {
            // Skip if this element is nested within another itemscope
            let parent = element.parentElement;
            let isNested = false;
            while (parent) {
                if (parent.hasAttribute('itemscope')) {
                    isNested = true;
                    break;
                }
                parent = parent.parentElement;
            }
            
            const item = await this.extractor.extractFromElement(element);
            console.log('MicrodataAPI: Extracted item:', JSON.stringify(item, (key, value) => {
                if (key === 'element') return `[Element ${value.tagName}#${value.id}]`;
                return value;
            }, 2));
            
            if (item) {
                const proxy = this.createLiveProxy(item);
                if (item.id) {
                    this.items.set(item.id, proxy);
                } else if (!isNested) {
                    // Only add top-level items without IDs to the numeric index
                    topLevelItemsWithoutId.push(proxy);
                }
            }
        }
        
        // Store items without IDs with numeric indices
        this.itemsWithoutId = topLevelItemsWithoutId;
        console.log(`MicrodataAPI: Found ${this.itemsWithoutId.length} top-level items without IDs`);
    }

    createLiveProxy(item) {
        const self = this;
        
        // Handle arrays of items (like employees)
        const createArrayProxy = (items, propName, parentElement) => {
            return new Proxy(items, {
                get(target, prop) {
                    // Handle toJSON for serialization
                    if (prop === 'toJSON') {
                        return () => {
                            return target.map(item => {
                                if (item && typeof item === 'object' && item.toJSON) {
                                    return item.toJSON();
                                } else if (item && typeof item === 'object' && item.properties) {
                                    // Create JSON-LD for items that don't have toJSON
                                    const result = {
                                        "@context": "https://schema.org"
                                    };
                                    if (item.type) {
                                        result["@type"] = item.type.split('/').pop();
                                    }
                                    if (item.id) {
                                        result["@id"] = item.id;
                                    }
                                    Object.assign(result, item.properties);
                                    return result;
                                }
                                return item;
                            });
                        };
                    }
                    
                    if (prop === 'push') {
                        return (...args) => {
                            console.log(`Array push called for ${propName} with data:`, args);
                            args.forEach(data => {
                                self.addItemFromData(data, item.type, propName, parentElement);
                            });
                            // Don't refresh immediately - let the next access trigger it
                            return target.length;
                        };
                    }
                    if (prop === 'pop') {
                        return () => {
                            // Find the last item in the array to determine its type
                            if (target.length === 0) return undefined;
                            
                            const lastItem = target[target.length - 1];
                            const itemType = lastItem._type || lastItem.type;
                            
                            console.log(`Pop called for ${propName}, item type: ${itemType}`);
                            console.log('Last item:', lastItem);
                            
                            if (itemType) {
                                // Find all templates with this type and remove last element from each location
                                const normalizedType = self.normalizeSchemaUrl(itemType);
                                const templates = self.templates.get(normalizedType) || self.templates.get(itemType) || [];
                                
                                console.log(`Found ${templates.length} templates for type ${itemType}`);
                                
                                templates.forEach(template => {
                                    const parent = template.parentElement;
                                    const elements = parent.querySelectorAll(`[itemprop="${propName}"][itemscope]`);
                                    console.log(`Found ${elements.length} elements in ${parent.tagName}.${parent.className}`);
                                    if (elements.length > 0) {
                                        console.log('Removing element:', elements[elements.length - 1]);
                                        elements[elements.length - 1].remove();
                                    }
                                });
                            }
                            
                            // Remove from the array and return the removed item
                            const removedItem = target.pop();
                            return removedItem;
                        };
                    }
                    if (prop === 'splice') {
                        return async (start, deleteCount, ...items) => {
                            // Get the item type from existing items or infer from property schema
                            let itemType;
                            if (target.length > 0) {
                                itemType = target[0]._type || target[0].type;
                            }
                            
                            // If we can't get it from existing items, try to get it from schema
                            if (!itemType) {
                                const parentSchema = await self.registry.loadSchema(item.type);
                                if (parentSchema) {
                                    const property = parentSchema.properties.find(p => p.name === propName);
                                    if (property) {
                                        itemType = property.type;
                                    }
                                }
                            }
                            
                            if (itemType) {
                                // Find all templates with this type and perform splice on each location
                                const normalizedType = self.normalizeSchemaUrl(itemType);
                                const templates = self.templates.get(normalizedType) || self.templates.get(itemType) || [];
                                
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
                                            self.addItemFromData(data, item.type, propName, parent, insertBefore);
                                        });
                                    }
                                });
                            }
                            
                            // Don't refresh immediately - let the next access trigger it
                            return target.splice(start, deleteCount, ...items);
                        };
                    }
                    
                    // Create live proxies for array items
                    if (typeof prop === 'number' && target[prop]) {
                        console.log(`Array access [${prop}]:`, target[prop]);
                        return self.createLiveProxy(target[prop]);
                    }
                    
                    // Handle numeric string indices
                    if (typeof prop === 'string' && /^\d+$/.test(prop) && target[prop]) {
                        console.log(`Array access ["${prop}"]:`, target[prop]);
                        return self.createLiveProxy(target[prop]);
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
                    return () => {
                        const result = {
                            "@context": "https://schema.org"
                        };
                        
                        // Add @type from itemtype
                        if (target.type) {
                            // Extract the type name from the URL
                            const typeName = target.type.split('/').pop();
                            result["@type"] = typeName;
                        }
                        
                        // Add @id if present
                        if (target.id) {
                            result["@id"] = target.id;
                        }
                        
                        // Add all properties
                        for (const key in target.properties) {
                            const value = target.properties[key];
                            if (Array.isArray(value)) {
                                result[key] = value.map(item => {
                                    if (item && typeof item === 'object' && item.toJSON) {
                                        return item.toJSON();
                                    } else if (item && typeof item === 'object' && item.properties) {
                                        // Manually create JSON-LD for nested items
                                        const nestedResult = {
                                            "@type": item.type ? item.type.split('/').pop() : undefined
                                        };
                                        if (item.id) nestedResult["@id"] = item.id;
                                        Object.assign(nestedResult, item.properties);
                                        return nestedResult;
                                    }
                                    return item;
                                });
                            } else if (value && typeof value === 'object' && value.toJSON) {
                                result[key] = value.toJSON();
                            } else if (value && typeof value === 'object' && value.properties) {
                                // Manually create JSON-LD for nested items
                                const nestedResult = {
                                    "@type": value.type ? value.type.split('/').pop() : undefined
                                };
                                if (value.id) nestedResult["@id"] = value.id;
                                Object.assign(nestedResult, value.properties);
                                result[key] = nestedResult;
                            } else {
                                result[key] = value;
                            }
                        }
                        return result;
                    };
                }
                
                const value = target.properties[prop];
                console.log(`Getting property ${prop} from item:`, value);
                
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
                
                console.log(`Setting property ${prop} to ${value} for item ${target.id}`);
                
                // Skip DOM updates if we're already updating from DOM (prevents infinite loop)
                if (self.isUpdatingFromDOM) {
                    console.log('Skipping DOM update - already updating from DOM');
                    return true;
                }
                
                // Update DOM for simple properties
                // For items without itemid, we need to update based on array position
                const itemId = target.id;
                if (itemId) {
                    // Find all elements with the same itemid or id
                    const sameItems = document.querySelectorAll(`[itemid="${itemId}"], [id="${itemId.replace('#', '')}"]`);
                    console.log(`Found ${sameItems.length} elements with itemid/id ${itemId}`);
                    
                    sameItems.forEach(itemElement => {
                        const propElements = itemElement.querySelectorAll(`[itemprop="${prop}"]:not([itemscope])`);
                        console.log(`Found ${propElements.length} property elements for ${prop} in`, itemElement);
                        propElements.forEach(el => {
                            if (el.hasAttribute('content')) {
                                el.setAttribute('content', value);
                            } else {
                                el.textContent = value;
                            }
                        });
                    });
                } else {
                    // For items without ID, update the original element
                    const propElements = target.element.querySelectorAll(`[itemprop="${prop}"]:not([itemscope])`);
                    console.log(`Found ${propElements.length} property elements for ${prop} in original element`);
                    propElements.forEach(el => {
                        if (el.hasAttribute('content')) {
                            el.setAttribute('content', value);
                        } else {
                            el.textContent = value;
                        }
                    });
                    
                    // Also try to find and update corresponding elements in other views
                    // by looking for the parent container and finding the same array index
                    self.updateCorrespondingElements(target, prop, value);
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

    async addItemFromData(data, parentType, propName, parentElement, insertBefore = null) {
        // Determine the expected type for this property
        const parentSchema = await this.registry.loadSchema(parentType);
        
        let itemType;
        if (parentSchema) {
            const property = parentSchema.properties.find(p => p.name === propName);
            if (property) {
                itemType = property.type;
            }
        }
        
        // If we couldn't determine the type from schema, try to infer from templates
        if (!itemType) {
            console.warn(`Could not determine type for ${propName} in ${parentType}, inferring from templates`);
            // Look for templates that are children of similar parent elements
            const templates = Array.from(this.templates.values()).flat();
            for (const template of templates) {
                const templateItem = template.content.querySelector('[itemscope]');
                if (templateItem && templateItem.getAttribute('itemprop') === propName) {
                    itemType = templateItem.getAttribute('itemtype');
                    break;
                }
            }
        }
        
        if (!itemType) {
            console.error(`Could not determine item type for property ${propName}`);
            return;
        }
        
        // Find all templates with this type (try both normalized and original)
        const normalizedType = this.normalizeSchemaUrl(itemType);
        let templates = this.templates.get(normalizedType) || this.templates.get(itemType) || [];
        
        console.log(`Looking for templates with type ${itemType} (normalized: ${normalizedType}), found:`, templates.length);
        console.log('All available template types:', Array.from(this.templates.keys()));
        
        if (templates.length === 0) {
            console.error(`No template found for type ${itemType}`);
            return;
        }

        // Clone and populate template for each location
        templates.forEach(template => {
            const clone = template.content.cloneNode(true);
            const itemElement = clone.querySelector('[itemscope]');
            
            if (itemElement) {
                console.log('Populating template element with data:', data);
                
                // Populate the clone with data
                Object.entries(data).forEach(([key, value]) => {
                    const propElements = itemElement.querySelectorAll(`[itemprop="${key}"]`);
                    console.log(`Found ${propElements.length} elements with itemprop="${key}"`);
                    propElements.forEach(el => {
                        if (el.hasAttribute('content')) {
                            el.setAttribute('content', value);
                        } else {
                            el.textContent = value;
                        }
                    });
                });
                
                // Insert into DOM
                const parent = template.parentElement;
                console.log('Inserting into parent:', parent.tagName, parent.className);
                if (insertBefore) {
                    parent.insertBefore(clone, insertBefore);
                } else {
                    parent.appendChild(clone);
                }
            }
        });
    }

    observeChanges() {
        const self = this;
        const observer = new MutationObserver((mutations) => {
            let shouldRefresh = false;
            let shouldUpdateProperties = false;
            const propertiesToUpdate = new Map(); // Map of element -> property name
            
            mutations.forEach(mutation => {
                // Check if microdata elements were added/removed
                if (mutation.type === 'childList') {
                    // Check if any added/removed nodes affect itemprop elements
                    const checkNodes = (nodes) => {
                        nodes.forEach(node => {
                            if (node.nodeType === 1) {
                                if (node.hasAttribute('itemscope') || node.querySelector?.('[itemscope]')) {
                                    shouldRefresh = true;
                                } else if (node.hasAttribute('itemprop')) {
                                    // An itemprop element was added/removed
                                    propertiesToUpdate.set(node, node.getAttribute('itemprop'));
                                    shouldUpdateProperties = true;
                                }
                            }
                        });
                    };
                    
                    checkNodes(mutation.addedNodes);
                    checkNodes(mutation.removedNodes);
                    
                    // Also check if the target has itemprop (for contenteditable)
                    if (mutation.target.hasAttribute('itemprop')) {
                        console.log('Content changed in itemprop element:', mutation.target);
                        propertiesToUpdate.set(mutation.target, mutation.target.getAttribute('itemprop'));
                        shouldUpdateProperties = true;
                    }
                }
                
                // Check for attribute changes
                if (mutation.type === 'attributes') {
                    if (['itemscope', 'itemtype', 'itemprop', 'itemid'].includes(mutation.attributeName)) {
                        shouldRefresh = true;
                    } else if (mutation.attributeName === 'content' && mutation.target.hasAttribute('itemprop')) {
                        // Content attribute changed on an itemprop element
                        propertiesToUpdate.set(mutation.target, mutation.target.getAttribute('itemprop'));
                        shouldUpdateProperties = true;
                    }
                }
                
                // Check for text content changes on itemprop elements
                if (mutation.type === 'characterData') {
                    let element = mutation.target.parentElement;
                    // Walk up to find the itemprop element
                    while (element && !element.hasAttribute('itemprop')) {
                        element = element.parentElement;
                    }
                    if (element) {
                        console.log('Text changed in itemprop element:', element);
                        propertiesToUpdate.set(element, element.getAttribute('itemprop'));
                        shouldUpdateProperties = true;
                    }
                }
            });
            
            if (shouldRefresh) {
                this.refresh();
            } else if (shouldUpdateProperties) {
                // Update specific properties without full refresh
                console.log('Updating properties from DOM:', propertiesToUpdate);
                this.updatePropertiesFromDOM(propertiesToUpdate);
            }
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['itemscope', 'itemtype', 'itemprop', 'itemid', 'content'],
            characterData: true, // Watch for text content changes
            characterDataOldValue: true
        });
    }

    updatePropertiesFromDOM(propertiesToUpdate) {
        console.log('updatePropertiesFromDOM called with:', propertiesToUpdate);
        
        // Set flag to prevent infinite loop
        this.isUpdatingFromDOM = true;
        
        try {
            // Find which items need updating based on the changed elements
            const itemsToUpdate = new Map(); // Map of item proxy -> properties to update
            
            for (const [element, propName] of propertiesToUpdate) {
                console.log(`Processing element for property ${propName}:`, element);
                
                // Find the parent itemscope element
                let itemElement = element;
                while (itemElement && !itemElement.hasAttribute('itemscope')) {
                    itemElement = itemElement.parentElement;
                }
                
                console.log('Found parent itemscope element:', itemElement);
                
                if (itemElement) {
                    // Find the corresponding item in our data structures
                    let foundItem = null;
                    
                    // Check items with IDs
                    console.log('Checking items with IDs:', this.items.size);
                    for (const [id, itemProxy] of this.items) {
                        // The proxy exposes _element as a getter
                        if (itemProxy._element === itemElement) {
                            foundItem = itemProxy;
                            console.log('Found item with ID:', id);
                            break;
                        }
                    }
                    
                    // Check items without IDs
                    if (!foundItem) {
                        console.log('Checking items without IDs:', this.itemsWithoutId.length);
                        for (let i = 0; i < this.itemsWithoutId.length; i++) {
                            const itemProxy = this.itemsWithoutId[i];
                            if (itemProxy._element === itemElement) {
                                foundItem = itemProxy;
                                console.log('Found item without ID at index', i);
                                break;
                            }
                        }
                    }
                    
                    if (foundItem) {
                        if (!itemsToUpdate.has(foundItem)) {
                            itemsToUpdate.set(foundItem, new Set());
                        }
                        itemsToUpdate.get(foundItem).add(propName);
                        console.log('Added to items to update');
                    } else {
                        console.log('Could not find item for element');
                    }
                }
            }
            
            console.log('Items to update:', itemsToUpdate.size);
            
            // Update the properties
            for (const [itemProxy, propNames] of itemsToUpdate) {
                console.log('Updating item with properties:', propNames);
                const itemElement = itemProxy._element;
                
                for (const propName of propNames) {
                    // Extract the new value from DOM
                    const propElements = itemElement.querySelectorAll(`[itemprop="${propName}"]:not([itemscope])`);
                    console.log(`Found ${propElements.length} property elements for ${propName}`);
                    if (propElements.length > 0) {
                        const newValue = this.extractor.extractPropertyValue(propElements[0]);
                        console.log(`Extracted new value: "${newValue}"`);
                        // Update the property value through the proxy
                        // This will trigger the proxy's set trap
                        try {
                            itemProxy[propName] = newValue;
                            console.log(`Updated property ${propName} to "${newValue}" from DOM change`);
                        } catch (e) {
                            console.error('Failed to update property:', e);
                        }
                    }
                }
            }
        } finally {
            // Always reset the flag
            this.isUpdatingFromDOM = false;
        }
    }

    updateCorrespondingElements(target, prop, value) {
        // Find the parent element that contains this item
        let parentElement = target.element.parentElement;
        while (parentElement && !parentElement.hasAttribute('itemscope')) {
            parentElement = parentElement.parentElement;
        }
        
        if (!parentElement) return;
        
        // Find all sibling elements with the same itemprop and itemscope
        const siblings = Array.from(parentElement.querySelectorAll(`[itemprop][itemscope][itemtype="${target.type}"]`));
        const elementIndex = siblings.indexOf(target.element);
        
        if (elementIndex === -1) {
            console.log('Element not found in siblings, trying different approach');
            // Try to find by position within the parent's employee items
            const allEmployees = Array.from(parentElement.querySelectorAll('[itemprop="employee"][itemscope]'));
            const employeeIndex = allEmployees.indexOf(target.element);
            if (employeeIndex !== -1) {
                console.log(`Found employee at index ${employeeIndex}`);
                this.updateAllEmployeeViews(employeeIndex, prop, value);
            }
            return;
        }
        
        console.log(`Updating corresponding elements at index ${elementIndex}`);
        
        // Find all templates with the same type
        const normalizedType = this.normalizeSchemaUrl(target.type);
        const templates = this.templates.get(normalizedType) || this.templates.get(target.type) || [];
        
        templates.forEach(template => {
            const parent = template.parentElement;
            const elements = parent.querySelectorAll(`[itemprop][itemscope][itemtype="${target.type}"]`);
            
            if (elements[elementIndex]) {
                const propElements = elements[elementIndex].querySelectorAll(`[itemprop="${prop}"]:not([itemscope])`);
                propElements.forEach(el => {
                    if (el.hasAttribute('content')) {
                        el.setAttribute('content', value);
                    } else {
                        el.textContent = value;
                    }
                });
            }
        });
    }

    updateAllEmployeeViews(employeeIndex, prop, value) {
        console.log(`Updating employee ${employeeIndex} property ${prop} to ${value} in all views`);
        
        // Find all templates that create employee elements
        const personTemplates = this.templates.get('https://schema.org/Person') || this.templates.get('http://schema.org/Person') || [];
        
        personTemplates.forEach(template => {
            const parent = template.parentElement;
            const employees = parent.querySelectorAll('[itemprop="employee"][itemscope]');
            
            if (employees[employeeIndex]) {
                const propElements = employees[employeeIndex].querySelectorAll(`[itemprop="${prop}"]:not([itemscope])`);
                console.log(`Found ${propElements.length} elements with itemprop="${prop}" in view`);
                propElements.forEach(el => {
                    console.log('Updating element:', el);
                    if (el.hasAttribute('content')) {
                        el.setAttribute('content', value);
                    } else {
                        el.textContent = value;
                    }
                });
            }
        });
    }

    get microdata() {
        const self = this;
        return new Proxy({}, {
            get(target, prop) {
                // Handle toJSON for serialization
                if (prop === 'toJSON') {
                    return () => {
                        // If we only have items without IDs, return an array
                        if (self.items.size === 0 && self.itemsWithoutId.length > 0) {
                            return self.itemsWithoutId.map(item => {
                                if (item && typeof item.toJSON === 'function') {
                                    return item.toJSON();
                                }
                                return item;
                            });
                        }
                        
                        // Otherwise return an object
                        const result = {};
                        
                        // Add items with IDs as properties
                        for (const [key, item] of self.items) {
                            if (item && typeof item.toJSON === 'function') {
                                // Use the key (without #) as the property name
                                const propKey = key.startsWith('#') ? key.substring(1) : key;
                                result[propKey] = item.toJSON();
                            }
                        }
                        
                        // Add items without IDs with numeric indices
                        for (let i = 0; i < self.itemsWithoutId.length; i++) {
                            const item = self.itemsWithoutId[i];
                            if (item && typeof item.toJSON === 'function') {
                                result[i] = item.toJSON();
                            }
                        }
                        
                        return result;
                    };
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
                        // First yield all items without IDs
                        for (const item of self.itemsWithoutId) {
                            yield item;
                        }
                        // Then yield all items with IDs
                        for (const [, item] of self.items) {
                            yield item;
                        }
                    };
                }
                
                // Handle forEach and other array methods
                if (prop === 'forEach') {
                    return function(callback, thisArg) {
                        let index = 0;
                        // First iterate items without IDs
                        for (const item of self.itemsWithoutId) {
                            callback.call(thisArg, item, index++, this);
                        }
                        // Then iterate items with IDs
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
                
                // Return undefined if not found
                return undefined;
            },
            
            ownKeys() {
                // Return numeric indices first, then string keys
                const keys = [];
                for (let i = 0; i < self.itemsWithoutId.length; i++) {
                    keys.push(String(i));
                }
                keys.push(...Array.from(self.items.keys()));
                return keys;
            },
            
            has(target, prop) {
                // Check numeric indices
                if (typeof prop === 'string' && /^\d+$/.test(prop)) {
                    const index = parseInt(prop, 10);
                    return index >= 0 && index < self.itemsWithoutId.length;
                }
                return self.items.has(prop) || self.items.has('#' + prop);
            }
        });
    }
}

// Initialize the API
const api = new MicrodataAPI();

// Create getter for window.microdata that returns the proxy
Object.defineProperty(window, 'microdata', {
    get() {
        const proxy = api.microdata;
        console.log('window.microdata accessed, items available:', Array.from(api.items.keys()));
        console.log('Full items map:', api.items);
        return proxy;
    },
    configurable: true
});

// Export for module usage
export { SchemaRegistry, MicrodataExtractor, MicrodataAPI };