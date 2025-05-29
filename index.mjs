import { SelectorRequest } from "https://jamesaduncan.github.io/selector-request/index.mjs";


class SchemaItem {
    constructor( id, properties ) {
        this.id = id;
        Object.assign(this, properties);
    }

    static extract( element ) {
        const holdingObject = {};
        element.querySelectorAll('[itemprop]').forEach( (prop) => {
            const propname = prop.getAttribute('itemprop');
            const propval  = prop.innerHTML || prop.value || prop.getAttribute('value') || "";
            holdingObject[ propname ] = propval;
        });
        return new this( element.getAttribute('itemid'), holdingObject );
    }

    render( aDestination ) {
        if ( !aDestination ) {
            throw new Error("No destination provided for rendering SchemaItem.");
        }
        Object.keys(this).forEach( (key) => {
            const elements = aDestination.querySelectorAll(`[itemprop="${key}"]`);
            elements.forEach( (element) => {
                element.innerHTML = this[key];
            });
        });
        if ( aDestination.hasAttribute ) {
            if ( !aDestination.hasAttribute('itemid') ) { aDestination.setAttribute('itemid', this.id )}
        } else {
            aDestination.querySelector('[itemscope]').setAttribute('itemid', this.id);
            aDestination = aDestination.querySelector('[itemscope]');
        }

        return aDestination;
    }
}

class SchemaItems {
    static types = {};

    static registerType( url, constructorFunction ) {
        if (!url || !constructorFunction ) {
            throw new Error("URL and constructor function are required to register a type.");
        }
        types[ url ] = constructorFunction;
    }

    static synchronize() {
        const observationOptions = { characterData: true, subtree: true };
        const callback = function( mutationRecords, observer ) {
            observer.disconnect();
            mutationRecords.forEach( (mutation) => {
                try {
                    if ( mutation.type === 'characterData') {
                        const node = mutation.target.parentNode.closest('[itemscope]');
                        const type = node.getAttribute('itemtype');
                        const typeConstructor = SchemaItems.types[ type ] || SchemaItem;
                        const item = typeConstructor.extract(node);

                        document.querySelectorAll(`[itemscope][itemtype="${type}"][itemid="${item.id}"]`).forEach( (destination) => {
                            if (destination !== node) item.render( destination );
                        });

                    }
                } catch(e) {
                    console.error("Error processing mutation:", e);
                }
            });
            observer.observe( document, observationOptions );
        }

        const observer = new MutationObserver( callback );
        observer.observe( document, observationOptions );
    }

    static getItems() {
        const items = [];
        document.querySelectorAll('[itemscope][itemtype][itemid]').forEach( (item) => {
            const itemType = item.getAttribute('itemtype');
            const holdingObject = {};
            item.querySelectorAll('[itemprop]').forEach( (prop) => {
                const propname = prop.getAttribute('itemprop');
                const propval  = prop.innerHTML || prop.value || prop.getAttribute('value') || "";
                holdingObject[ propname ] = propval;
            });
            if ( this.types[ itemType ]) {
                // this item is expected to follow the protocol
                const object = new this.types[ itemType ]( item.getAttribute('itemid'), holdingObject );                
                items.push(object);
            } else {
                items.push(new SchemaItem( item.getAttribute('itemid'), holdingObject ));
            }            
        });
        return items;
    }
}


document.querySelectorAll('[data-source]').forEach( async ( element ) => {
    const items = await SelectorRequest.fetch( element.getAttribute('data-source') );
    if ( element.hasAttribute('data-template') ) {
        const templateElement = (await SelectorRequest.fetch( element.getAttribute('data-template') ))[0];
        items.forEach( (item) => {
            element.append( SchemaItem.extract( item ).render( templateElement.content.cloneNode(true) ) );
        });
    } else {
        element.append(...items);
    }

})

window.SchemaItems = SchemaItems

export { SchemaItems };

