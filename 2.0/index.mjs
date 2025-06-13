import { SelectorRequest } from "https://jamesaduncan.github.io/selector-request/index.mjs";

function interpolate(t, context) {
    if (!t) return t;
    else return t.replace(/\${([^}]+)}/g, (m, p) => p.split('.').reduce((a, f) => a ? a[f] : undefined, context));
}


class SchemaType {
    url;
    isa = [];

    validate(aThing) {
        throw new Error("validate method must be implemented in subclasses of SchemaType.");
    }
}

class Schema {
    url;
    properties = new SchemaPropertyList();
    isa = [];

    constructor(aURL) {
        this.url = aURL
    }

    validate(aThing) {
        if (!aThing || typeof aThing !== 'object') {
            console.log(`Invalid thing for schema validation: ${aThing}`);
            return false;
        }
        if (this.isa.length > 0) {
            return this.isa.some((type) => {
                const typeConstructor = TypeRegistry.types[type];
                return typeConstructor && typeConstructor.validate(aThing);
            });
        }
        return Object.keys(this.properties).every((key) => {
            const property = this.properties[key];
            if (property.cardinality === 1) {
                if (aThing[key])
                    return property.validate(aThing[key]);
                else {
                    console.log(`Property ${key} is missing in the thing.`);
                }
            } else if (property.cardinality > 1) {
                return Array.isArray(aThing[key]) && aThing[key].every(item => property.type.validate(item));
            }
            return true; // For cardinality 0, we assume it's optional
        });
    }
}

Schema.Number = class SchemaNumber extends SchemaType {
    static url = 'http://schema.org/Number';

    static validate(aThing) {
        return typeof aThing === 'number' && !isNaN(aThing);
    }
}

Schema.Text = class SchemaText extends SchemaType {
    static url = 'http://schema.org/Text';

    static validate(aThing) {
        return typeof aThing === 'string' || aThing instanceof String;
    }
}

Schema.Boolean = class SchemaBoolean extends SchemaType {
    static url = 'http://schema.org/Boolean';

    validate(aThing) {
        return typeof aThing === 'boolean';
    }
}

Schema.DateTime = class SchemaDateTime extends SchemaType {
    static url = 'https://schema.org/DateTime';

    validate(aThing) {
        if (typeof aThing === 'string' || aThing instanceof String) {
            const date = new Date(aThing);
            return !isNaN(date.getTime());
        }
        return false;
    }
}

Schema.Date = class SchemaDate extends SchemaType {
    static url = 'https://schema.org/Date';

    validate(aThing) {
        if (typeof aThing === 'string' || aThing instanceof String) {
            const date = new Date(aThing);
            return !isNaN(date.getTime()) && date.getFullYear() > 0;
        }
        return false;
    }
}

Schema.Time = class SchemaTime extends SchemaType {
    static url = 'https://schema.org/Time';

    validate(aThing) {
        if (typeof aThing === 'string' || aThing instanceof String) {
            const timeParts = aThing.split(':');
            if (timeParts.length !== 3) return false; // Expecting HH:MM:SS format
            const [hours, minutes, seconds] = timeParts.map(Number);
            return (!isNaN(hours) && hours >= 0 && hours < 24 &&
                !isNaN(minutes) && minutes >= 0 && minutes < 60 &&
                !isNaN(seconds) && seconds >= 0 && seconds < 60
            );
        }
        return false;
    }
}

Schema.Integer = class SchemaInteger extends SchemaType {
    static url = 'http://schema.org/Integer';

    validate(aThing) {
        return typeof aThing === 'number' && Number.isInteger(aThing);
    }
}

Schema.URL = class SchemaURL extends SchemaType {
    static url = 'https://schema.org/URL';

    validate(aThing) {
        if (typeof aThing === 'string' || aThing instanceof String) {
            try {
                new URL(aThing);
                return true;
            } catch (e) {
                return false;
            }
        }
        return false;
    }
}

class SchemaPropertyList {
    add(aProperty) {
        if (!(aProperty instanceof SchemaProperty)) {
            throw new Error("SchemaPropertyList can only add SchemaProperty instances.");
        }
        this[aProperty.name] = aProperty;
    }
}

class SchemaProperty {
    name;
    cardinality = 1;
    type;

    constructor(aURL, aName) {
        if (!aURL || !aName) {
            throw new Error("SchemaProperty requires a URL and a name.");
        }
        this.type = aURL;
        this.name = aName;
    }

    validate(aValue) {
        const registryType = TypeRegistry.types[this.type];
        if (registryType) {
            return registryType.validate(aValue);
        } else {
            console.log(`Unknown type url: ${this.type}`);
        }
    }
}

class TypeRegistry {
    static types = {
        'https://schema.org/Number': Schema.Number,
        'https://schema.org/Integer': Schema.Integer,
        'https://schema.org/Text': Schema.Text,
        'https://schema.org/Boolean': Schema.Boolean,
        'https://schema.org/Time': Schema.Time,
        'https://schema.org/Date': Schema.Date,
        'https://schema.org/DateTime': Schema.DateTime,
        'https://schema.org/URL': Schema.URL
    };

    static schemaParser = {
        'schema.org': (url, dom) => {
            const newSchema = new Schema(url);
            const propertyRows = dom.querySelectorAll('table.definition-table:first-of-type tbody tr:not([class="supertype"]');
            propertyRows.forEach((row) => {
                const propname = row.querySelector('.prop-nam a');
                const propval = row.querySelectorAll('.prop-ect a');
                let typeurl = propval[0].getAttribute('href');
                if (!typeurl.startsWith('http')) {
                    const baseURL = new URL(url);
                    typeurl = new URL(typeurl, baseURL);
                }
                newSchema.properties.add(new SchemaProperty(typeurl.toString(), propname.innerText));
            });
            return newSchema;
        }
    }

    static async registerType(url) {
        if (!url) {
            throw new Error("URL and type constructor are required to register a type.");
        }

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch type definition from ${url}: ${response.statusText}`);
        }

        // get domain from url
        const urlObj = new URL(url);
        const html = (new DOMParser()).parseFromString(await response.text(), "text/html");
        const base = html.createElement('base');
        base.setAttribute('href', url);
        html.head.appendChild(base);

        TypeRegistry.types[url] = this.schemaParser[urlObj.hostname](url, html);
        return TypeRegistry.types[url];
    }

    static async validate(url, aThing) {
        this.types[url] = this.types[url] || await this.registerType(url);
        return await this.types[url].validate(aThing);
    }
}


//const s = new Schema('https://schema.org/Thing');
TypeRegistry.registerType('https://schema.org/Thing');

/**
 * SchemaElements is a module for extracting and rendering schema data from DOM elements.
 * It provides functionality to handle schema elements, references, and data extraction.
 *
 * @module SchemaElements
 */

/**
 * SchemaElementReference represents a reference to a schema element.
 * It contains a source element that holds the schema data and a destination element where the schema data will be rendered.
 * It can resolve the reference to fetch the referenced DOM element.
 * @class SchemaElementReference
 */
class SchemaElementReference {
    /**
     * @constructor(source, destination)
     * @description Creates a new SchemaElementReference instance.
     * @param {*} source 
     * @param {*} references 
     */
    constructor(source, references) {
        if (!source) throw new Error("Source element is required to create SchemaElementReference.");
        if (!references) throw new Error("Destination element is required to create SchemaElementReference.");
        this.source = source; // The source element that contains the schema data
        this.references = references; // The destination element where the schema data will be rendered
    }

    static fromDOMElement(element) {
        return new this(element, element.getAttribute('itemid'));
    }

    /**
     * @method resolve()
     * @description Resolves the reference to fetch schema data from the destination element.
     * @returns {Promise<SchemaElementData[]>} A promise that resolves to an array of SchemaElementData objects.
     */
    async resolve() {
        const items = await SelectorRequest.fetch(this.references);
        return items.map((item) => SchemaElementData.fromDOMElement(item));
    }

    /**
     * @property {string} url
     * @description Returns the full URL of the destination element.
     */
    get url() {
        return SelectorRequest.urlFor(this.references);
    }

    /**
     * @method apply()
     * @abstract Resolves the reference, and then applies to schema data found at the reference to the source element.
     * @returns {Promise<SchemaElementData[]>}
     */
    async apply() {
        const items = await this.resolve();
        items.forEach((item) => {
            item.apply(this.source);
        });
        return items;
    }
}

class SchemaElementDataMulti extends Array {
    constructor(...args) {
        super(...args);
    }


    inScopeOf(...scope) {
        const subset = new Set(scope);
        return Object.values(this).filter((aThing) => {
            return aThing.scope.isSupersetOf(subset);
        })
    }


    add(aProperty, aValue) {
        if (this[aProperty]) {
            if (Array.isArray(this[aProperty])) {
                this[aProperty].push(aValue);
            } else {
                this[aProperty] = [this[aProperty], aValue];
            }
        } else {
            this[aProperty] = aValue;
        }
    }
}

class SchemaElementData {
    constructor(properties, source) {
        Object.assign(this, properties);
        Object.defineProperty(this, 'source', {
            enumerable: false,
            writable: false,
            value: source || null
        });
        if (!window.document.schemaElements) {
            window.document.schemaElements = [this];
        } else {
            window.document.schemaElements.push(this);
        }
    }

    add(aProperty, aValue) {
        if (!this[aProperty]) {
            this[aProperty] = aValue;
        } else if (Array.isArray(this[aProperty])) {
            this[aProperty].push(aValue);
        } else {
            this[aProperty] = new SchemaElementDataMulti(this[aProperty], aValue);
        }
    }

    get scope() {
        if (this.source && this.source.hasAttribute('scope')) {
            return new Set(this.source.getAttribute('scope').split(/\s+/).map((s) => {
                return new URL(s.trim(), this.source.baseURI).toString();
            }));
        } else {
            return [];
        }
    }

    get url() {
        return `${this.source.baseURI}#${this.id}`;
    }

    apply(destination) {
        if (!destination) {
            throw new Error("No destination provided for applying SchemaElementData.");
        }

        if (destination.matches && destination.matches(`[itemprop]`)) {
            const key = destination.getAttribute('itemprop');
            destination.innerHTML = this[key];
            //return;
        }

        Object.keys(this).forEach((key) => {
            const elements = destination.querySelectorAll(`[itemprop="${key}"]`);
            elements.forEach((element) => {
                element.innerHTML = this[key];
            });
        });

        if (destination.hasAttribute) {
            if (!destination.hasAttribute('itemid')) { destination.setAttribute('itemid', this.id) }
            if (!destination.hasAttribute('itemscope')) { destination.setAttribute('itemscope', '') }
            if (!destination.hasAttribute('itemtype') && this.source) { destination.setAttribute('itemtype', this.source.getAttribute('itemtype')) }
        }

        if (destination.getAttributeNames) {
            destination.getAttributeNames().forEach((attrname) => {
                const attrvalue = destination.getAttribute(attrname);
                if (attrvalue && attrvalue.match(/\$\{/)) {
                    destination.setAttribute(attrname, interpolate(destination.getAttribute(attrname), this));
                }
            });
        }

        destination.innerHTML = interpolate(destination.innerHTML, this);

        destination.schemaElementData = this;
        return destination;
    }


    static fromDOMElement(element) {
        const schemaProperties = new SchemaElementData({}, element);
        element.querySelectorAll('[itemprop]').forEach((propElement) => {
            const propName = propElement.getAttribute('itemprop');
            let value;
            if (propElement.matches('[itemscope][itemtype][id]')) {
                value = SchemaElementData.fromDOMElement(propElement)
            } else if (propElement.matches('[itemscope][itemtype][itemid]')) {
                value = new SchemaElementReference(propElement, propElement.getAttribute('itemid'));
            } else {
                if (propElement.closest('[itemscope]') != element) {
                    return;
                }
                value = propElement.innerText || propElement.value || propElement.getAttribute('value') || "";
            }
            schemaProperties.add(propName, value);
        });
        schemaProperties.id = element.getAttribute('id');
        return schemaProperties;
    }
}

class SchemaElements {
    static items(root) {
        if (!root) { throw new Error("root element is required to extract schema items") }
        if (root.matches('[itemscope][itemtype][id]')) {
            return [SchemaElementData.fromDOMElement(root)];
        } else {
            // this is a suitable proxy for depth-first
            const items = Array.from(root.querySelectorAll('[itemscope][itemtype][id]')).reverse();
            return items.map(item => {
                return SchemaElementData.fromDOMElement(item);
            });
        }
    }

    static references(root) {
        if (!root) { throw new Error("root element is required to extract schema items") }
        if (root.matches('[itemscope][itemtype][itemid]')) {
            return [SchemaElementReference.fromDOMElement(root)];
        } else {
            // this is a suitable proxy for depth-first
            const items = Array.from(root.querySelectorAll('[itemscope][itemtype][itemid]')).reverse();
            return items.map(item => {
                return SchemaElementReference.fromDOMElement(item);
            });
        }
    }

    static apply(root) {
        if (root.matches('[itemscope][itemtype][itemid]')) {
            return SchemaElementData.fromDOMElement(root);
        } else {
            // this is a suitable proxy for depth-first
            const items = Array.from(root.querySelectorAll('[itemscope][itemtype][id]')).reverse();
            return items.map(item => {
                return SchemaElementData.fromDOMElement(item);
            });
        }
    }
}

SchemaElements.SchemaElementReference = SchemaElementReference
SchemaElements.SchemaElementData = SchemaElementData;
Schema.Registry = TypeRegistry;

SchemaElements.Schema = Schema;
window.SchemaElements = SchemaElements;

export { SchemaElements, SchemaElementData, SchemaElementReference, Schema };