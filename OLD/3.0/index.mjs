import { SelectorRequest } from "https://jamesaduncan.github.io/selector-request/index.mjs";

class Schema {
    url = "";
    properties = [];

    constructor( url ) {
        if (!url) throw new Error("no url provided");
    }

    validate( anObject ) {
        let valid = true;
        for ( let property of this.properties ) {

        }
        return valid;
    }
}

class SchemaPropertyDescriptor {
    name = "";
    required = false;
    many = false;    

    constructor(name, type, options = { required: false, many: false }) {
        if (!name) throw new Error("no name not provided");
        if (!type) throw new Error("no type provided");
        this.name     = name;
        this.type     = type;
        this.many     = options.many;
        this.required = options.required;
    }
}

{
    const schema = new Schema('Person');
    schema.properties.push(
        new SchemaPropertyDescriptor("Text", "https://schema.org/Text")
    )
    console.log( schema )
}


class SchemaProperty {
    #name; #value; #source;

    constructor( name, value, source ) {
        this.#name = name;
        this.#value = value;
        this.#source = source;
    }
    
    get value() {
        return this.#value;
    }

    set value( newValue ) {
        this.#source.innerText = newValue;
        this.#value = newValue;
    }

    get propertyName() {
        return this.#name;
    }

    matchesPropertyName( key ) {
        return this.#name === key;
    }
}

class SchemaObject {
    properties = [];

    constructor( options ) {

        if ( options['@id'] )
            this['@id'] = options['@id']
        else if ( options['element'] ) {
            this['@id'] = URLFor( options['element'] );
        } else {
            throw new Error('Need either an @id parameter, or an element parameter');
        }

        return new Proxy(this, {
            get(target, property, receiver) {
                if ( Reflect.has( target, property  ) ) return Reflect.get(target, property);
                const matching = target.properties.filter( (i) => i.matchesPropertyName( property ));
                console.log(`got properties that match ${property}:`, matching);
                // we really should return lists, if they are lists of things.
                if ( matching.length > 1 ) return matching;
                return matching[0];
            },
            set(target, property, value) {
                target.properties.filter( (i) => i.matchesPropertyName( property ) ).forEach( (el) => {
                    el.value = value;
                })
            },
            ownKeys(target) {
                return Array.from( new Set( target.properties.map( e => e.propertyName )) );
            },
            getOwnPropertyDescriptor(target, prop) {
                return {
                  enumerable: true,
                  configurable: true
                }
            }            
        })
    }

    get elements() {
        // this only works for local elements
        return SelectorRequest.fetch( this['@id'] );
    }

    elementPropertyDetails( anElement ) {
        const propertyName = anElement.getAttribute('itemprop');
        if (!propertyName) throw new Error('element has no itemprop attribute', element);
        if ( anElement.hasAttribute('itemscope') ) {
            return [ propertyName, ItemRegistry.get( URLFor( anElement ))];
        } else {
            const propertyValue = anElement.innerText;
            return [ propertyName, propertyValue ]
        }
    }

    addPropertyElement( anElement ) {
        const [ propertyName, propertyValue ] = this.elementPropertyDetails( anElement );        
        const propertyObject = new SchemaProperty( propertyName, propertyValue, anElement )
        this.properties.push( propertyObject );
    }
}

class _ItemRegistry extends Map {
    constructor() {
        super(...arguments)
    }

    get( anId ) {
        if ( anId instanceof Object ) {
            anId = anId.toString();
        }

        if (this.has( anId )) {
            return super.get( anId )
        } else {
            const so = new SchemaObject({ '@id': anId });
            this.set( anId, so )
            return so;
        }
    }
}

const ItemRegistry = new _ItemRegistry();

function URLFor( anElement ) {
    if (anElement.hasAttribute('id')) {
        return new URL(`#${anElement.id}`, anElement.baseURI)
    } else if ( anElement.hasAttribute('itemid') ) {
        return new URL( anElement.getAttribute('itemid'), anElement.baseURI )
    }
}

window.schemaElements = { ItemRegistry };

window.document.querySelectorAll('[itemprop]').forEach( (property) => {
    const container = property.closest('[itemscope][id]');
    const id = URLFor( container );
    const item = ItemRegistry.get( id );
    item.addPropertyElement( property );
});