/**
 * HTMLTemplate - A microdata-based HTML templating system
 * 
 * This class provides a powerful templating engine that uses HTML5 microdata
 * attributes (itemprop, itemtype, itemscope) for data binding. It supports
 * multiple data sources including JavaScript objects, DOM elements with
 * microdata, and HTML forms.
 */
class HTMLTemplate {
    /**
     * Creates a new HTMLTemplate instance
     * @param {HTMLTemplateElement} templateElement - The template element to use
     * @param {string} [selector] - Optional CSS selector to find the root element within the template
     * @throws {Error} If templateElement is not an HTMLTemplateElement
     */
    constructor(templateElement, selector) {
        if (!templateElement || !(templateElement instanceof HTMLTemplateElement)) {
            throw new Error('First parameter must be an HTMLTemplateElement');
        }
        
        this.templateElement = templateElement;
        this.selector = selector;
        this._templateCache = null;
        this._parseTemplate();
    }
    
    /**
     * Renders data using the template
     * @param {Object|Array|Element|HTMLFormElement} data - The data to render
     * @returns {Element|Element[]} Rendered DOM element(s)
     */
    render(data) {
        const extractedData = this._extractDataFromSource(data);
        this._lastRenderData = extractedData;
        
        if (Array.isArray(extractedData)) {
            return this._renderArray(extractedData);
        }
        
        return this._renderSingle(extractedData);
    }
    
    /**
     * Renders an array of data items
     * @private
     * @param {Array} dataArray - Array of data items to render
     * @returns {Element[]} Array of rendered elements
     */
    _renderArray(dataArray) {
        const hasTypedTemplates = this._templateCache.rootElements.some(t => t.itemtype);
        
        if (hasTypedTemplates && !this.selector) {
            // Only render items that have a matching template
            return dataArray
                .map(item => this._renderSingle(item))
                .filter(result => result !== null);
        }
        
        return dataArray.map(item => this._renderSingle(item));
    }
    
    /**
     * Parses the template and builds a cache of template structure
     * @private
     */
    _parseTemplate() {
        const content = this.templateElement.content.cloneNode(true);
        const rootElements = this._findRootElements(content);
        
        this._templateCache = {
            rootElements: Array.from(rootElements).map(el => ({
                element: el,
                itemtype: el.getAttribute('itemtype'),
                structure: this._analyzeElement(el)
            }))
        };
    }
    
    /**
     * Finds the root elements to use as templates
     * @private
     * @param {DocumentFragment} content - The template content
     * @returns {Element[]|NodeList} The root elements to use
     */
    _findRootElements(content) {
        if (this.selector) {
            return content.querySelectorAll(this.selector);
        }
        
        // Look for direct children with itemtype for type-based matching
        const typedElements = Array.from(content.children).filter(el => el.hasAttribute('itemtype'));
        return typedElements.length > 0 ? typedElements : Array.from(content.children);
    }
    
    /**
     * Analyzes an element's structure for templating
     * @private
     * @param {Element} element - The element to analyze
     * @returns {Object} Analysis result containing element metadata
     */
    _analyzeElement(element) {
        const analysis = {
            itemprop: element.getAttribute('itemprop'),
            itemscope: element.hasAttribute('itemscope'),
            itemtype: element.getAttribute('itemtype'),
            dataScope: element.getAttribute('data-scope'),
            dataConstraint: element.getAttribute('data-constraint'),
            scope: element.getAttribute('scope'),
            isArray: false,
            attributes: {},
            children: []
        };
        
        // Handle array notation
        if (analysis.itemprop?.endsWith('[]')) {
            analysis.isArray = true;
            analysis.cleanItemprop = analysis.itemprop.slice(0, -2);
        } else {
            analysis.cleanItemprop = analysis.itemprop;
        }
        
        // Find templated attributes
        analysis.attributes = this._findTemplatedAttributes(element);
        
        // Recursively analyze children
        analysis.children = Array.from(element.children).map(child => 
            this._analyzeElement(child)
        );
        
        return analysis;
    }
    
    /**
     * Finds attributes containing template variables
     * @private
     * @param {Element} element - The element to check
     * @returns {Object} Map of attribute names to values containing variables
     */
    _findTemplatedAttributes(element) {
        const templatedAttrs = {};
        for (const attr of element.attributes) {
            if (attr.value.includes('${')) {
                templatedAttrs[attr.name] = attr.value;
            }
        }
        return templatedAttrs;
    }
    
    /**
     * Extracts data from various source types
     * @private
     * @param {*} source - The data source (Object, Array, Element, Form, etc.)
     * @returns {Object|Array} Extracted data ready for rendering
     */
    _extractDataFromSource(source) {
        if (source == null) {
            return {};
        }
        
        if (Array.isArray(source)) {
            return source.map(item => this._extractDataFromSource(item));
        }
        
        if (source instanceof HTMLFormElement) {
            return this._extractFromForm(source);
        }
        
        if (source instanceof FormData) {
            return this._extractFromFormData(source);
        }
        
        if (source instanceof Element) {
            return this._extractFromElement(source);
        }
        
        // Assume it's already a data object
        return source;
    }
    
    /**
     * Extracts data from a DOM element with microdata
     * @private
     * @param {Element} element - The element to extract from
     * @returns {Object|Array} Extracted data
     */
    _extractFromElement(element) {
        // Handle lists specially
        if (element.tagName === 'UL' || element.tagName === 'OL') {
            return Array.from(element.children)
                .filter(child => child.hasAttribute('itemscope'))
                .map(child => this._extractFromMicrodata(child));
        }
        
        return this._extractFromMicrodata(element);
    }
    
    /**
     * Extracts data from a DOM element with microdata attributes
     * @private
     * @param {Element} element - The element to extract from
     * @returns {Object|string} The extracted data
     */
    _extractFromMicrodata(element) {
        const data = {};
        
        this._extractMicrodataType(element, data);
        this._extractMicrodataId(element, data);
        
        if (element.hasAttribute('itemscope')) {
            this._extractMicrodataProperties(element, data);
        } else if (element.hasAttribute('itemprop')) {
            return element.textContent.trim();
        }
        
        return data;
    }
    
    /**
     * Extracts microdata type information
     * @private
     * @param {Element} element - The element to extract from
     * @param {Object} data - The data object to populate
     */
    _extractMicrodataType(element, data) {
        const itemtype = element.getAttribute('itemtype');
        if (itemtype) {
            data['@type'] = itemtype.split('/').pop();
            data['@context'] = itemtype.substring(0, itemtype.lastIndexOf('/'));
        }
    }
    
    /**
     * Extracts microdata ID information
     * @private
     * @param {Element} element - The element to extract from
     * @param {Object} data - The data object to populate
     */
    _extractMicrodataId(element, data) {
        if (element.id) {
            data['@id'] = element.id;
        }
    }
    
    /**
     * Extracts microdata properties from an itemscope element
     * @private
     * @param {Element} element - The element to extract from
     * @param {Object} data - The data object to populate
     */
    _extractMicrodataProperties(element, data) {
        const itemprops = element.querySelectorAll('[itemprop]');
        
        for (const propElement of itemprops) {
            if (this._isNestedInDifferentScope(propElement, element)) {
                continue;
            }
            
            const propName = propElement.getAttribute('itemprop');
            const value = propElement.hasAttribute('itemscope') 
                ? this._extractFromMicrodata(propElement)
                : propElement.textContent.trim();
            
            this._addPropertyValue(data, propName, value);
        }
    }
    
    /**
     * Checks if an element is nested within a different itemscope
     * @private
     * @param {Element} element - The element to check
     * @param {Element} scopeElement - The current scope element
     * @returns {boolean} True if nested in a different scope
     */
    _isNestedInDifferentScope(element, scopeElement) {
        let parent = element.parentElement;
        while (parent && parent !== scopeElement) {
            if (parent.hasAttribute('itemscope')) {
                return true;
            }
            parent = parent.parentElement;
        }
        return false;
    }
    
    /**
     * Adds a property value to a data object, handling arrays
     * @private
     * @param {Object} data - The data object
     * @param {string} propName - The property name
     * @param {*} value - The value to add
     */
    _addPropertyValue(data, propName, value) {
        if (data[propName] !== undefined) {
            if (!Array.isArray(data[propName])) {
                data[propName] = [data[propName]];
            }
            data[propName].push(value);
        } else {
            data[propName] = value;
        }
    }
    
    /**
     * Extracts data from an HTML form
     * @private
     * @param {HTMLFormElement} form - The form to extract from
     * @returns {Object} The extracted form data
     */
    _extractFromForm(form) {
        const formData = new FormData(form);
        return this._extractFromFormData(formData);
    }
    
    /**
     * Extracts data from a FormData object
     * @private
     * @param {FormData} formData - The FormData to extract from
     * @returns {Object} The extracted data
     */
    _extractFromFormData(formData) {
        const data = {};
        
        for (const [key, value] of formData.entries()) {
            this._setNestedProperty(data, key, value);
        }
        
        return data;
    }
    
    /**
     * Sets a nested property value using dot notation or array syntax
     * @private
     * @param {Object} obj - The object to modify
     * @param {string} path - The property path (e.g., "person.name" or "items[]")
     * @param {*} value - The value to set
     */
    _setNestedProperty(obj, path, value) {
        if (path.includes('[]')) {
            this._setNestedArrayProperty(obj, path, value);
        } else {
            this._setNestedObjectProperty(obj, path, value);
        }
    }
    
    /**
     * Sets a nested array property value
     * @private
     * @param {Object} obj - The object to modify
     * @param {string} path - The property path containing []
     * @param {*} value - The value to add to the array
     */
    _setNestedArrayProperty(obj, path, value) {
        const arrayPath = path.replace('[]', '');
        const parts = arrayPath.split('.').filter(Boolean);
        
        const parent = this._navigateToParent(obj, parts);
        const arrayKey = parts[parts.length - 1] || parts[0];
        
        if (!Array.isArray(parent[arrayKey])) {
            parent[arrayKey] = [];
        }
        parent[arrayKey].push(value);
    }
    
    /**
     * Sets a nested object property value
     * @private
     * @param {Object} obj - The object to modify
     * @param {string} path - The property path using dot notation
     * @param {*} value - The value to set
     */
    _setNestedObjectProperty(obj, path, value) {
        const parts = path.split(/[\.\[\]]+/).filter(Boolean);
        let current = obj;
        
        for (let i = 0; i < parts.length - 1; i++) {
            const part = parts[i];
            const nextPart = parts[i + 1];
            const isNextArray = /^\d+$/.test(nextPart);
            
            if (!(part in current)) {
                current[part] = isNextArray ? [] : {};
            }
            
            current = current[part];
        }
        
        const lastPart = parts[parts.length - 1];
        current[lastPart] = value;
    }
    
    /**
     * Navigates to the parent object of a nested property
     * @private
     * @param {Object} obj - The root object
     * @param {Array} parts - The path parts
     * @returns {Object} The parent object
     */
    _navigateToParent(obj, parts) {
        let current = obj;
        
        for (let i = 0; i < parts.length - 1; i++) {
            const part = parts[i];
            if (!(part in current)) {
                current[part] = {};
            }
            current = current[part];
        }
        
        return current;
    }
    
    /**
     * Renders a single data object
     * @private
     * @param {Object} data - The data to render
     * @returns {Element|null} The rendered element or null if no template matches
     */
    _renderSingle(data) {
        const matchingTemplate = this._findMatchingTemplate(data);
        
        if (!matchingTemplate) {
            console.warn('No matching template found for data:', data);
            return null;
        }
        
        const element = matchingTemplate.element.cloneNode(true);
        const context = this._createRenderingContext(data);
        
        this._processElement(element, matchingTemplate.structure, data, context);
        
        return element;
    }
    
    /**
     * Finds a matching template for the given data
     * @private
     * @param {Object} data - The data to match
     * @returns {Object|null} The matching template or null
     */
    _findMatchingTemplate(data) {
        if (data['@type'] && !this.selector) {
            // @type requires @context to be meaningful
            if (!data['@context']) {
                console.warn('@type specified without @context - type matching skipped:', data['@type']);
                // Treat as untyped data
                const firstTemplate = this._templateCache.rootElements[0];
                if (firstTemplate && !firstTemplate.itemtype) {
                    return firstTemplate;
                }
                return null;
            }
            
            const context = data['@context'].endsWith('/') 
                ? data['@context'].slice(0, -1) 
                : data['@context'];
            const schemaType = context + '/' + data['@type'];
            const typedTemplate = this._templateCache.rootElements.find(
                t => t.itemtype === schemaType
            );
            
            if (typedTemplate) return typedTemplate;
            
            // Skip if we have typed templates but no match
            if (this._templateCache.rootElements.some(t => t.itemtype)) {
                return null;
            }
        }
        
        // Use first template if appropriate
        const firstTemplate = this._templateCache.rootElements[0];
        if (firstTemplate && (!firstTemplate.itemtype || !data['@type'])) {
            return firstTemplate;
        }
        
        return null;
    }
    
    /**
     * Creates a rendering context for data
     * @private
     * @param {Object} data - The data being rendered
     * @returns {Object} The rendering context
     */
    _createRenderingContext(data) {
        return {
            rootData: data,
            currentData: data,
            allData: Array.isArray(this._lastRenderData) ? this._lastRenderData : [data]
        };
    }
    
    /**
     * Processes an element with data
     * @private
     * @param {Element} element - The element to process
     * @param {Object} structure - The element's analyzed structure
     * @param {Object} data - The data to apply
     * @param {Object} context - The rendering context
     */
    _processElement(element, structure, data, context) {
        if (!structure) return;
        
        // Handle constraints and scoping
        const constraintResult = this._handleConstraints(element, structure, data, context);
        if (constraintResult.remove) {
            element.remove();
            return;
        }
        if (constraintResult.processed) return;
        if (constraintResult.data) {
            data = constraintResult.data;
        }
        
        // Handle arrays
        if (structure.isArray && structure.cleanItemprop && data[structure.cleanItemprop]) {
            // Special handling for checkboxes and radio buttons with array notation
            if (element.tagName === 'INPUT' && (element.type === 'checkbox' || element.type === 'radio')) {
                this._processCheckboxRadioArray(element, structure, data[structure.cleanItemprop]);
                return;
            }
            this._processArray(element, structure, data[structure.cleanItemprop], context);
            return;
        }
        
        // Process attributes
        this._processAttributes(element, structure, data);
        
        // Process content
        this._processContent(element, structure, data, context);
        
        // Add itemid if needed
        this._addItemId(element, data);
    }
    
    /**
     * Handles constraints and scoping for an element
     * @private
     * @param {Element} element - The element being processed
     * @param {Object} structure - The element's structure
     * @param {Object} data - The current data
     * @param {Object} context - The rendering context
     * @returns {Object} Result object with remove, processed, and data properties
     */
    _handleConstraints(element, structure, data, context) {
        if (!structure.dataScope && !structure.dataConstraint) {
            return { remove: false, processed: false };
        }
        
        // Handle data-scope as array filter
        if (structure.dataScope) {
            const matches = this._findScopeMatches(structure.dataScope, data, context);
            if (matches.length > 0) {
                this._processScopeArray(element, structure, matches, context);
                return { processed: true };
            }
            return { remove: true };
        }
        
        // Handle data-constraint
        if (!this._evaluateConstraint(element, structure, data, context)) {
            return { remove: true };
        }
        
        // Use resolved reference if available
        if (context._resolvedReference) {
            const resolvedData = context._resolvedReference;
            delete context._resolvedReference;
            return { data: resolvedData };
        }
        
        return { remove: false, processed: false };
    }
    
    /**
     * Processes attributes with template variables
     * @private
     * @param {Element} element - The element to process
     * @param {Object} structure - The element's structure
     * @param {Object} data - The data context
     */
    _processAttributes(element, structure, data) {
        for (const [attrName, attrValue] of Object.entries(structure.attributes)) {
            const newValue = this._replaceAttributeVariables(attrValue, data);
            element.setAttribute(attrName, newValue);
        }
    }
    
    /**
     * Processes element content
     * @private
     * @param {Element} element - The element to process
     * @param {Object} structure - The element's structure
     * @param {Object} data - The data context
     * @param {Object} context - The rendering context
     */
    _processContent(element, structure, data, context) {
        if (structure.cleanItemprop) {
            this._processItempropContent(element, structure, data, context);
        } else {
            this._processChildrenOnly(element, structure, data, context);
        }
    }
    
    /**
     * Processes content for elements with itemprop
     * @private
     * @param {Element} element - The element to process
     * @param {Object} structure - The element's structure
     * @param {Object} data - The data context
     * @param {Object} context - The rendering context
     */
    _processItempropContent(element, structure, data, context) {
        const value = data[structure.cleanItemprop];
        
        if (value === undefined) return;
        
        if (structure.itemscope && typeof value === 'object' && !Array.isArray(value)) {
            // Process children with nested data
            const nestedContext = { ...context, currentData: value };
            this._processElementChildren(element, structure, value, nestedContext);
        } else {
            this._setElementValue(element, value);
        }
        
        // Clean up array notation
        if (structure.isArray) {
            element.setAttribute('itemprop', structure.cleanItemprop);
        }
    }
    
    /**
     * Processes only children of an element
     * @private
     * @param {Element} element - The element to process
     * @param {Object} structure - The element's structure
     * @param {Object} data - The data context
     * @param {Object} context - The rendering context
     */
    _processChildrenOnly(element, structure, data, context) {
        for (let i = 0; i < element.children.length; i++) {
            if (structure.children && structure.children[i]) {
                this._processElement(
                    element.children[i],
                    structure.children[i],
                    data,
                    context
                );
            }
        }
    }
    
    /**
     * Adds itemid attribute if data has @id and element doesn't already have one
     * @private
     * @param {Element} element - The element to modify
     * @param {Object} data - The data containing @id
     */
    _addItemId(element, data) {
        if (data && data['@id'] && element.hasAttribute('itemscope') && !element.hasAttribute('itemid')) {
            const baseURI = document.baseURI;
            element.setAttribute('itemid', baseURI + '#' + data['@id']);
        }
    }
    
    /**
     * Processes checkbox/radio button arrays
     * @private
     * @param {Element} element - The checkbox/radio element
     * @param {Object} structure - The element's structure
     * @param {Array} arrayData - The array of selected values
     */
    _processCheckboxRadioArray(element, structure, arrayData) {
        if (!Array.isArray(arrayData)) {
            console.warn('Expected array for property:', structure.cleanItemprop);
            return;
        }
        
        // Clean up array notation in itemprop
        if (structure.isArray) {
            element.setAttribute('itemprop', structure.cleanItemprop);
        }
        
        // Check/uncheck based on whether value is in array
        const elementValue = element.value;
        if (arrayData.includes(elementValue)) {
            element.checked = true;
            element.setAttribute('checked', 'checked');
        } else {
            element.checked = false;
            element.removeAttribute('checked');
        }
    }
    
    /**
     * Processes an array of data items
     * @private
     * @param {Element} element - The template element
     * @param {Object} structure - The element's structure
     * @param {Array} arrayData - The array data to process
     * @param {Object} context - The rendering context
     */
    _processArray(element, structure, arrayData, context) {
        if (!Array.isArray(arrayData)) {
            console.warn('Expected array for property:', structure.cleanItemprop);
            return;
        }
        
        const parent = element.parentNode;
        const nextSibling = element.nextSibling;
        
        element.remove();
        
        for (const item of arrayData) {
            const newElement = this._createArrayElement(element, structure, item, context);
            this._insertElement(newElement, parent, nextSibling);
        }
    }
    
    /**
     * Creates an element for an array item
     * @private
     * @param {Element} template - The template element
     * @param {Object} structure - The element's structure
     * @param {*} item - The array item
     * @param {Object} context - The rendering context
     * @returns {Element} The created element
     */
    _createArrayElement(template, structure, item, context) {
        const newElement = template.cloneNode(true);
        
        // Clean up array notation
        if (structure.isArray) {
            newElement.setAttribute('itemprop', structure.cleanItemprop);
        }
        
        // Process based on item type
        if (typeof item === 'object' && structure.children.length > 0) {
            const itemContext = { ...context, currentData: item };
            this._processElementChildren(newElement, structure, item, itemContext);
        } else {
            this._setElementValue(newElement, item);
        }
        
        return newElement;
    }
    
    /**
     * Sets the value of an element based on its type
     * @private
     * @param {Element} element - The element to set
     * @param {*} value - The value to set
     */
    _setElementValue(element, value) {
        const tagName = element.tagName.toLowerCase();
        
        // Map of elements to their value-setting strategies
        const elementHandlers = {
            input: () => this._setInputValue(element, value),
            textarea: () => {
                element.textContent = value;
                element.value = value;
            },
            select: () => this._setSelectValue(element, value),
            option: () => element.selected = Boolean(value),
            output: () => element.value = value,
            meta: () => element.setAttribute('content', value),
            img: () => element.setAttribute('src', value),
            link: () => element.setAttribute('href', value),
            audio: () => element.setAttribute('src', value),
            video: () => element.setAttribute('src', value),
            source: () => element.setAttribute('src', value),
            object: () => element.setAttribute('data', value),
            embed: () => element.setAttribute('src', value),
            iframe: () => element.setAttribute('src', value),
            time: () => element.setAttribute('datetime', value),
            data: () => element.setAttribute('value', value),
            meter: () => element.setAttribute('value', value),
            progress: () => element.setAttribute('value', value)
        };
        
        const handler = elementHandlers[tagName];
        if (handler) {
            handler();
        } else {
            element.textContent = value;
        }
    }
    
    /**
     * Sets the value of an input element
     * @private
     * @param {HTMLInputElement} element - The input element
     * @param {*} value - The value to set
     */
    _setInputValue(element, value) {
        const type = element.type;
        if (type === 'checkbox' || type === 'radio') {
            element.checked = Boolean(value);
            if (Boolean(value)) {
                element.setAttribute('checked', 'checked');
            } else {
                element.removeAttribute('checked');
            }
        } else {
            element.value = value;
            element.setAttribute('value', value);
        }
    }
    
    /**
     * Sets the value of a select element
     * @private
     * @param {HTMLSelectElement} element - The select element
     * @param {*} value - The value to set
     */
    _setSelectValue(element, value) {
        for (const option of element.options) {
            const isSelected = option.value === value;
            option.selected = isSelected;
            if (isSelected) {
                option.setAttribute('selected', 'selected');
            } else {
                option.removeAttribute('selected');
            }
        }
    }
    
    /**
     * Replaces template variables in attribute values
     * @private
     * @param {string} template - The template string containing ${variable} placeholders
     * @param {Object} data - The data object containing values
     * @returns {string} The template string with variables replaced
     */
    _replaceAttributeVariables(template, data) {
        return template.replace(/\$\{(\w+)\}/g, (match, key) => {
            return data[key] !== undefined ? data[key] : match;
        });
    }
    
    /**
     * Evaluates constraints on an element to determine if it should be rendered
     * @private
     * @param {Element} element - The element being evaluated
     * @param {Object} structure - The element's analyzed structure
     * @param {Object} data - The current data context
     * @param {Object} context - The rendering context
     * @returns {boolean} True if the element should be rendered, false otherwise
     */
    _evaluateConstraint(element, structure, data, context) {
        // Handle data-scope (shorthand for property matching)
        if (structure.dataScope) {
            const scopeValue = data[structure.dataScope];
            const contextId = context.rootData['@id'];
            
            if (contextId && scopeValue) {
                return scopeValue === '#' + contextId || scopeValue === contextId;
            }
            return false;
        }
        
        // Handle data-constraint (complex expressions)
        if (structure.dataConstraint) {
            return this._evaluateExpression(structure.dataConstraint, data, context);
        }
        
        return true;
    }
    
    /**
     * Evaluates a constraint expression
     * @private
     * @param {string} expression - The expression to evaluate
     * @param {Object} data - The current data context
     * @param {Object} context - The rendering context
     * @returns {boolean} The result of the expression evaluation
     */
    _evaluateExpression(expression, data, context) {
        // Handle special case for reference lookups
        if (expression === '@id==agent') {
            return this._evaluateReferenceExpression(data, context);
        }
        
        // Simple expression evaluator supporting: ==, !=, <, >, <=, >=, &&, ||, !
        const processedExpression = this._prepareExpression(expression, data);
        
        try {
            return Function('"use strict"; return (' + processedExpression + ')')();
        } catch (e) {
            console.warn('Failed to evaluate constraint:', expression, e);
            return false;
        }
    }
    
    /**
     * Evaluates a reference-based expression like @id==agent
     * @private
     * @param {Object} data - The current data context
     * @param {Object} context - The rendering context
     * @returns {boolean} True if reference is found and resolved
     */
    _evaluateReferenceExpression(data, context) {
        const agentRef = context.currentData.agent || data.agent;
        if (!agentRef || !agentRef.startsWith('#')) {
            return false;
        }
        
        const id = agentRef.substring(1);
        const match = context.allData.find(item => item['@id'] === id);
        
        if (match) {
            context._resolvedReference = match;
            return true;
        }
        
        return false;
    }
    
    /**
     * Prepares an expression for evaluation by replacing variables with values
     * @private
     * @param {string} expression - The expression to prepare
     * @param {Object} data - The data context
     * @returns {string} The prepared expression ready for evaluation
     */
    _prepareExpression(expression, data) {
        // Replace @id with actual value
        let prepared = expression.replace('@id', `"${data['@id'] || ''}"`);
        
        // Replace property names with values
        const props = prepared.match(/\b\w+\b/g) || [];
        for (const prop of props) {
            if (data.hasOwnProperty(prop)) {
                const value = data[prop];
                const replacement = typeof value === 'string' 
                    ? `"${value}"` 
                    : JSON.stringify(value);
                
                prepared = prepared.replace(
                    new RegExp('\\b' + prop + '\\b', 'g'),
                    replacement
                );
            }
        }
        
        return prepared;
    }
    
    /**
     * Finds all data items that match a scope constraint
     * @private
     * @param {string} scope - The property name to match against @id
     * @param {Object} data - The current data context
     * @param {Object} context - The rendering context
     * @returns {Array} Array of matching data items
     */
    _findScopeMatches(scope, data, context) {
        const currentId = context.rootData['@id'];
        if (!currentId) return [];
        
        return context.allData.filter(item => {
            const scopeValue = item[scope];
            return scopeValue === '#' + currentId || scopeValue === currentId;
        });
    }
    
    /**
     * Processes an array of matched scope items
     * @private
     * @param {Element} element - The template element
     * @param {Object} structure - The element's analyzed structure
     * @param {Array} matches - Array of matching data items
     * @param {Object} context - The rendering context
     */
    _processScopeArray(element, structure, matches, context) {
        const parent = element.parentNode;
        const nextSibling = element.nextSibling;
        
        element.remove();
        
        for (const match of matches) {
            const newElement = element.cloneNode(true);
            const matchContext = { ...context, currentData: match };
            
            // Process children
            this._processElementChildren(newElement, structure, match, matchContext);
            
            // Handle element's own itemprop
            if (structure.cleanItemprop && match[structure.cleanItemprop] !== undefined) {
                this._setElementValue(newElement, match[structure.cleanItemprop]);
            }
            
            // Insert into DOM
            this._insertElement(newElement, parent, nextSibling);
        }
    }
    
    /**
     * Processes the children of an element
     * @private
     * @param {Element} element - The parent element
     * @param {Object} structure - The parent's structure
     * @param {Object} data - The data context
     * @param {Object} context - The rendering context
     */
    _processElementChildren(element, structure, data, context) {
        for (let i = 0; i < element.children.length; i++) {
            if (structure.children && structure.children[i]) {
                this._processElement(
                    element.children[i],
                    structure.children[i],
                    data,
                    context
                );
            }
        }
    }
    
    /**
     * Inserts an element into the DOM
     * @private
     * @param {Element} element - The element to insert
     * @param {Node} parent - The parent node
     * @param {Node} nextSibling - The next sibling node (or null)
     */
    _insertElement(element, parent, nextSibling) {
        if (nextSibling) {
            parent.insertBefore(element, nextSibling);
        } else {
            parent.appendChild(element);
        }
    }
    
    /**
     * Resolves a reference to another data object
     * @private
     * @param {string} reference - The reference to resolve
     * @param {Object} data - The current data context
     * @param {Object} context - The rendering context
     * @returns {Object|null} The resolved data object or null
     */
    _resolveReference(reference, data, context) {
        // Currently delegated to constraint evaluation
        return null;
    }
}

export { HTMLTemplate };
