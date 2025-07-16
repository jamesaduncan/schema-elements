import { SelectorSubscriber } from "https://jamesaduncan.github.io/selector-subscriber/index.mjs";
import { SelectorRequest } from "https://jamesaduncan.github.io/selector-request/index.mjs";

function logger(message, ...args) {
    if (window.debug && window.debug.enabled) {
        console.debug(message, ...args);
    }
}

class SchemaElement {
    constructor(id, properties, element) {
        this.id = id;
        Object.assign(this, properties);
        Object.defineProperty(this, 'source', {
            enumerable: false,
            writable: false,
            value: element || null
        })
    }

    static extract(element) {
        const holdingObject = {};
        if (!element) return;
        element.querySelectorAll('[itemprop]').forEach((prop) => {
            const propname = prop.getAttribute('itemprop');
            let propval;
            if (prop.hasAttribute('itemtype')) {
                // if the property has an itemtype, we need to extract it as a SchemaElement
                const itemtype = prop.getAttribute('itemtype');
                if (SchemaElements.types[itemtype]) {
                    propval = SchemaElements.types[itemtype].extract(prop);
                } else {
                    propval = SchemaElement.extract(prop);
                }
            } else {
                propval = prop.innerHTML || prop.value || prop.getAttribute('value') || "";
            }

            if (holdingObject[propname]) {
                if (Array.isArray(holdingObject[propname])) holdingObject[propname].push(propval);
                else holdingObject[propname] = [holdingObject[propname], propval];
            } else {
                holdingObject[propname] = propval;
            }
        });
        const itemtype = element.getAttribute('itemtype');
        if (SchemaElements.types[itemtype]) {
            return new SchemaElements.types[itemtype](element.getAttribute('itemid'), holdingObject, element);
        }
        return new this(element.getAttribute('itemid'), holdingObject, element);
    }

    interpolate(t) {
        return t.replace(/\${([^}]+)}/g, (m, p) => p.split('.').reduce((a, f) => a ? a[f] : undefined, this));
    }

    render(aDestination) {
        if (!aDestination) {
            throw new Error("No destination provided for rendering SchemaElement.");
        }
        Object.keys(this).forEach((key) => {
            const elements = aDestination.querySelectorAll(`[itemprop="${key}"]`);
            elements.forEach((element) => {
                element.innerHTML = this[key];
            });
        });
        if (aDestination.hasAttribute) {
            if (!aDestination.hasAttribute('itemid')) { aDestination.setAttribute('itemid', this.id) }
            if (!aDestination.hasAttribute('itemscope')) { aDestination.setAttribute('itemscope', '') }
            if (!aDestination.hasAttribute('itemtype') && this.source) { aDestination.setAttribute('itemtype', this.source.getAttribute('itemtype')) }
        } else {
            aDestination.querySelector('[itemscope]').setAttribute('itemid', this.id);
            aDestination = aDestination.querySelector('[itemscope]');
        }

        // make sure we check all the attributes for interpolation
        aDestination.getAttributeNames().forEach((attrname) => {
            const attrvalue = aDestination.getAttribute(attrname);
            if (attrvalue && attrvalue.match(/\$\{/)) {
                aDestination.setAttribute(attrname, this.interpolate(aDestination.getAttribute(attrname)));
            }
        });
        aDestination.innerHTML = this.interpolate(aDestination.innerHTML);

        aDestination.schemaElement = this;
        return aDestination;
    }
}

class SchemaElements {
    static types = {};

    static registerType(url, constructorFunction) {
        if (!url || !constructorFunction) {
            throw new Error("URL and constructor function are required to register a type.");
        }
        this.types[url] = constructorFunction;
    }

    static synchronize() {
        const observationOptions = { characterData: true, subtree: true };
        const callback = function(mutationRecords, observer) {
            observer.disconnect();
            mutationRecords.forEach((mutation) => {
                try {
                    if (mutation.type === 'characterData') {
                        const node = mutation.target.parentNode.closest('[itemscope]');
                        const type = node.getAttribute('itemtype');
                        const typeConstructor = SchemaElements.types[type] || SchemaElement;
                        const item = typeConstructor.extract(node);

                        document.querySelectorAll(`[itemscope][itemtype="${type}"][itemid="${item.id}"]`).forEach((destination) => {
                            if (destination !== node) item.render(destination);
                        });

                    }
                } catch (e) {
                    console.error("Error processing mutation:", e);
                }
            });
            observer.observe(document, observationOptions);
        }

        const observer = new MutationObserver(callback);
        observer.observe(document, observationOptions);
    }

    static getItems() {
        const items = [];
        document.querySelectorAll('[itemscope][itemtype][itemid]').forEach((item) => {
            const itemType = item.getAttribute('itemtype');
            const holdingObject = {};
            item.querySelectorAll('[itemprop]').forEach((prop) => {
                const propname = prop.getAttribute('itemprop');
                const propval = prop.innerHTML || prop.value || prop.getAttribute('value') || "";
                holdingObject[propname] = propval;
            });
            if (this.types[itemType]) {
                // this item is expected to follow the protocol
                const object = new this.types[itemType](item.getAttribute('itemid'), holdingObject);
                items.push(object);
            } else {
                items.push(new SchemaElement(item.getAttribute('itemid'), holdingObject));
            }
        });
        return items;
    }
}

class holdingPen extends HTMLElement {}

customElements.define('temporary-holding-pen', holdingPen);

SelectorSubscriber.subscribe('[itemscope][itemtype]', async(element) => {
    if (element.children.length == 0 && window.expandEmptySchemaElements) {
        logger(`No children found for SchemaElement ${element.tagName.toLowerCase()} in element with itemtype: ${element.getAttribute('itemtype')}`);
        const items = await SelectorRequest.fetch(element.getAttribute('itemtype'));
        if (items && items.length > 0) {
            items.forEach((item) => {
                item = document.importNode(item, true);
                element.append(item);
            });
            logger(`SchemaElement items added`, items);
        } else {
            console.warn("No items found for SchemaElement extraction.");
        }
    }
});

SelectorSubscriber.subscribe('[data-source]', async(element) => {
    try {
        const holdingPen = document.createElement('temporary-holding-pen');
        document.body.append(holdingPen);
        if (element.hasAttribute('data-template')) {
            const items = await SelectorRequest.fetch(element.getAttribute('data-source'));
            if (element.hasAttribute('data-template')) {
                const templateElement = (await SelectorRequest.fetch(element.getAttribute('data-template')))[0];
                items.forEach((item) => {
                    item = document.importNode(item, true);
                    holdingPen.append(item);
                    const extractedItem = SchemaElement.extract(item);
                    element.append(extractedItem.render(templateElement.content.cloneNode(true)));
                });
            }
        } else {
            // we have no template, so we are going to look inside here. It's also only going to be ONE.
            const items = await SelectorRequest.fetch(element.getAttribute('data-source'));
            if (!items || items.length === 0) {
                console.warn("No items found for SchemaElement extraction.");
                return;
            }
            items.forEach((item) => {
                item = document.importNode(item, true);
                holdingPen.append(item);
                SchemaElement.extract(item).render(element);
            });
        }
        logger(`SelectorElements added`, holdingPen);
        holdingPen.remove();
    } catch (e) {
        console.error("Error in SchemaElement extraction:", e);
    }
});


export { SchemaElements, SchemaElement };