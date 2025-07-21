
## The Basics

Here are the basics of the API, microdata in a document is accessed through document.microdata, which is indexed both
as an Array (document.microdata[n], document.microdata.forEach( ... ), etc), and as an object
(document.microdata.johndoe, Object.keys( document.microdata )).

The microdata property's children always look and feel like JSON-LD objects.

```html
    <div id="johndoe" itemref="enc" itemscope itemtype="https://rustybeam.net/schema/Credential">
        <p>
            The users' username is <span itemprop="username">johndoe</username>. They
            have the following roles:
            <ul>
                <li itemprop="role">editor</li>
                <li itemprop="role">writer</li>
            </ul>
            The users' password is <span itemprop="password">seecret</span>.
        </p>
    </div>
    <p>
        Because we're writing this in the open, passwords aren't encrypted, and are just
        using <span id="enc" itemprop="encryption">plaintext</span>.
    </p>

    <script type="module" src="./index.mjs"></script>
    <script>
        console.log( document.microdata[0]['@type'] );        
        // 'Credential'
        console.log( document.microdata[0]['@context'] )
        // 'https://rustybeam.net/schema/'
        console.log( document.microdata[0].role )
        // [ 'editor', 'writer' ]
        console.log( document.microdata[0].username )
        // 'johndoe'
        console.log( document.microdata[0].password )
        // 'secret'
        console.log( document.microdata[0].encryption )
        // 'plaintext'

        console.log( document.microdata.itemid === document.getElementById('johndoe').baseURI + `#${document.getElementById('johndoe').id}`) )
        // true

        console.log( document.microdata[0] === document.microdata.johndoe )
        // true

        console.log( JSON.stringify( document.microdata[0] ) )
        // { "@type": "Credential", "@context": "https://rustybeam.net/schema/", "username": "johndoe", "role": ["editor", "writer"], "password": "secret", "encryption": "plaintext" }
    </script>
```

Elements in the DOM that have an itemscope and an itemtype property get a "microdata" property, that
returns the microdata object:

    ```javascript
        document.querySelector('[itemtype][itemscope]').microdata
    ```

## Complex types

Microdata isn't just key value or key list pairs. It can also have complex types:

```html
    <div id="ahost" itemscope itemtype="https://rustybeam.net/schema/HostConfig">
        <p>
            This is the host configuration for <span itemprop="hostname">rustybeam.net</span>.
        </p>
        <p>
            The root directory, where it keeps the documents that are accessible over the web
            are located at <span itemprop="hostRoot">/var/www/rustybeam.net</span>.
        </p>
        <p>
            It's plugin configuration is pretty straightforward:
            <ol>
                <li itemprop="plugin" itemscope itemtype="https://rustybeam.net/schema/FileHandlerPlugin">
                    The FileHandler library is located at <span itemprop="library">file:///usr/lib/rustybeam/plugins/librusty_beam_filehandler.so</span>
                </li>
                <li itemprop="plugin" itemscope itemtype="https://rustybeam.net/schema/ErrorHandlerPlugin">
                    The Error Handler library is located at <span itemprop="library">file:///usr/lib/rustybeam/plugins/librusty_beam_errorhandler.so</span>
                </li>
                <li itemprop="plugin" itemscope itemtype="https://rustybeam.net/schema/AccessLogPlugin">
                    The Access Log library is located at <span itemprop="library">file:///usr/lib/rustybeam/plugins/librusty_beam_access_log.so</span>. It stores
                    its logs at <span itemprop="logfile">/var/log/rustybeam.net/acess_log</span>. It logs in the Apache <span itemprop="format">combined</span> format.
                </li>
            </ol>
        </p>
    </div>
    <script type="module" src="./index.mjs"></script>
    <script>
        console.log( Array.isArray( document.microdata.ahost.plugin ) );
        // true

        console.log( document.microdata.ahost.plugin[0].library )
        // 'file:///usr/lib/rustybeam/plugins/librusty_beam_filehandler.so'
    </script>
```

## Live data

Microdata objects are "live", which is to say, if you update the DOM, the data in the object changes, and if you update the object, the DOM changes:

```javascript

    document.microdata.johndoe.password = 'new password';
    console.log( document.querySelector(`#johndoe [itemprop="password]`) )
    // '<span itemprop="password">new password</span>'

```


## Schema & Validation

Because Microdata objects have a schema, they can be validated.

```javascript
    import { Microdata } from "./index.mjs";

    const schema = new Microdata.Schema( "https://rustybeam.net/schema/Credential" );
    const ok = await schema.load(); // returns true or false, depending on if it is fetched and processed from the internet or not
    if ( ok ) {
        console.log( schema.validate( anObject ) );
        // true or false, depending on whether or not the object matches the https://rustybeam.net/schema/Credential schema
    }
```

## In-page microdata validation

When the page loads, any schema that the MicrodataAPI identifies in the document (because they are in the itemtype attribute of an element) are fetched in the
background automatically. Microdata objects from a page can also be validated:

    ```html
    <div id="johndoe" itemref="enc" itemscope itemtype="https://rustybeam.net/schema/Credential">
        <p>
            The users' username is <span itemprop="username">johndoe</username>. They
            have the following roles:
            <ul>
                <li itemprop="role">editor</li>
                <li itemprop="role">writer</li>
            </ul>
            The users' password is <span itemprop="password">seecret</span>.
        </p>
    </div>
    <p>
        Because we're writing this in the open, passwords aren't encrypted, and are just
        using <span id="enc">plaintext</span>.
    </p>
    <script type="module" src="./index.mjs"></script>
    <script>
        document.addEventListener('DOMSchemasLoaded', () => {
            console.log( document.microdata.johndoe.validate() )
            // true or false, depending on the state of the object
        })asdfasf
    </script>
    ```

## Forms & Validation

HTML Forms can be validated too:

    ```html
    <form>
        <label>Username:</label><input type="text" name="username" value="">
        <label>Password:</label><input type="password" name="password" value="">
        <button>Submit</button>
    </form>
    <script>
        import { Microdata } from './index.mjs';

        document.addEventListener('DOMSchemasLoaded', async () => {
            const schema = new Microdata.Schema( `https://rustybeam.net/schema/Credential` );
            const ok = await schema.load(); // returns true or false, depending on if it is fetched and processed from the internet or not
            if ( ok ) {
                console.log( schema.validate( document.forms[0] ) );
                // should be true
            }            
        })
    </script>
    ```

## More on Validatation

Microdata schemas have tradtionally centered around https://schema.org, however, those schemas have a few failings. The first is that they
are not described using a schema! The second is that they have no reference to cardinality of properties (1, 1..n, 0..n, etc). Finally, the
DataTypes are not in any way extensible. To remedy that, we've built a new set of schemas that provide a) core datatype validity and b) provide 
a machine readable (i.e. microdata schema based) schema description format.

Schemas for any type can be documented with the https://rustybeam.net/schema/Schema schema. Each property (i.e. itemprop) of a schema can either
be complex (referenced by another complex schema) or a basic datatype. Basic datatypes all follow the https://rustybeam.net/schema/DataType schema,
and provide a validation pattern.

That doesn't mean that only https://rustybeam.net/schema/Schema schemas can be used. It's _just_ that rustybeam.net schemas are currently the only schemas
we know of that express validation a way that can be consumed and turned into an automatic validator currently. Schemas defined by Schema.org can be used,
and just validate the properties of an object. Rustybeam.net schemas can validate the property values. Future schema definition methods may exist and the API can be extended
by subclassing the Microdata.Schema class.

### Schema Inheritance Tree


    ```javascript
    class Schema {} 
    class SchemaOrgSchema extends Schema {}
    class RustyBeamNetSchema extends Schema {}
    ```

    However, all schema instances are created using the Schema class:

    ```javascript
    
    const hostschema = new Schema('https://rustybeam.net/schema/HostConfig');
    const ok = hostschema.load();
    if ( ok ) {
        console.log( hostschema.constructor.name === 'RustyBeamNetSchema' );
        // true
    }

### DataTypes

DataTypes have the following microdata format:

```json
{
    "@type": "Schema",
    "@context": "https://rustybeam.net/schema/",
    "id": {
        "@type": "Property",
        "@context": "https://rustybeam.net/schema/",
        "name": "id",
        "type": "https://rustybeam.net/schema/URL",
        "cardinality": "1",
        "description": "The URL identifier for this data type"
    },
    "name": {
        "@type": "Property",
        "@context": "https://rustybeam.net/schema/",
        "name": "name",
        "type": "https://rustybeam.net/schema/Text",
        "cardinality": "1",
        "description": "The name of the data type"
    },
    "validationPattern": {
        "@type": "Property",
        "@context": "https://rustybeam.net/schema/",
        "name": "validationPattern",
        "type": "https://rustybeam.net/schema/Text",
        "cardinality": "0..1",
        "description": "Regular expression for validating values of this type"
    },
    "description": {
        "@type": "Property",
        "@context": "https://rustybeam.net/schema/",
        "name": "description",
        "type": "https://rustybeam.net/schema/Text",
        "cardinality": "0..1",
        "description": "Human-readable description of the data type"
    }
}
```

To validate a simple property value, a validator must test the property's value against the regular expression in the property's datatype's validationPattern property.
If there is no validationPattern, then the value is valid.

### Sub sets and supersets

If a microdata element is authoritative (that is, it has an id attribute), then 

## Templates and rendering

Microdata Objects can be rendered to templates:

    ```html
    <template id="person-template">
        <div class="card" itemscope itemtype="https://schema.org/Person">
            <h1 itemprop="name"></h1>
            <dl>
                <div>
                    <dt>Email Address</dt>
                    <dd><address itemprop="email"></address></dd>
                </div>
                <div>
                    <dt>Birthday</dt>
                    <dd itemprop="birthdate"></dd>
                </div>
            </dl>
        </div>
    </template>
    <script>
        import { Microdata } from './index.mjs';

        const person = { name: "John Doe", email: "johndoe@example.com", birthdate: "1979-05-27" }
        const template = new Microdata.Template( document.querySelector( '#person-template' ));

        // a template can report on which microdata schemas it renders:
        const schemas = template.schemas;
        console.log( schemas )
        // [Schema {} ],

        template.validate( person ) // validates the object we're trying to render against the schema
        const renderedTemplate = template.render( person )

        // OR (a shortform)

        const shortformTemplate = Microdata.Template.render( person )
    </script>
    ```

Forms can also be rendered:

    ```javascript
        import { Microdata } from './index.mjs';

        const template = new Microdata.Template( document.querySelector( '#person-template' ));

        template.validate( document.forms[0] )
        const renderedTemplate = template.render( document.forms[0] )

        // OR (a shortform, does the above basically in one step )

        const shortformTemplate = Microdata.Template.render( document.forms[0] )
    ```

HTML Fragments, elements or documents containing microdata can also be rendered:

    ```html
    <template id="person-template">
        <div class="card" itemscope itemtype="https://schema.org/Person">
            <h1 itemprop="name"></h1>
            <dl>
                <div>
                    <dt>Email Address</dt>
                    <dd><address itemprop="email"></address></dd>
                </div>
                <div>
                    <dt>Birthday</dt>
                    <dd itemprop="birthdate"></dd>
                </div>
            </dl>
        </div>
    </template>
    <script>
        import { Microdata } from './index.mjs';
        const element = document.querySelector('.selector-for-some-microdata')

        const template = new Microdata.Template( document.querySelector( '#person-template' ));
        template.validate( element )
        const renderedTemplate = template.render( element )
    </script>
    ```

## Authoritative data

If a microdata has an "id" attribute, it is considered "authoritative". It can then by "synchronised" to the rest of the page using templates.
For example, 

    ```html
    <table>
        <thead>
            <tr>
                <th>Username</th>
                <th>Password</th>
                <th>Roles</th>
                <th>Encryption</th>
            </tr>
        </thead>
        <tbody>
            <tr id="johndoe" itemscope itemtype="https://rustybeam.net/schema/Credential">
                <td itemprop="username">johndoe</td>
                <td itemprop="password">secret</td>
                <td>
                    <ul>
                        <li itemprop="role">administrator</li>
                        <li itemprop="role">editor</li>
                    </ul>
                </td>
                <td itemprop="encryption">plaintext</td>
            </tr>
            <tr id="janedoe" itemscope itemtype="https://rustybeam.net/schema/Credential">
                <td itemprop="username">janedoe</td>
                <td itemprop="password">sneaky</td>
                <td>
                    <ul>
                        <li itemprop="role">editor</li>
                    </ul>
                </td>
                <td itemprop="encryption">plaintext</td>
            </tr>
            <tr id="billdoe" itemscope itemtype="https://rustybeam.net/schema/Credential">
                <td itemprop="username">billdoe</td>
                <td itemprop="password">topsecret</td>
                <td>
                    <ul>
                        <li itemprop="role">writer</li>
                    </ul>
                </td>
                <td itemprop="encryption">plaintext</td>
            </tr>
        </tbody>
    </table>

    <section id="user-cards" data-contains="https://rustybeam.net/schema/Credential">
        <template>
            <div itemscope itemtype="https://rustybeam.net/schema/Credential">
                <p>
                    The users' username is <span itemprop="username"></span>. They
                    have the following roles:
                    <ul>
                        <li itemprop="role[]"></li>
                    </ul>
                </p>
            </div>
        </template>
    </section>
    ```

When the document loads, the Microdata System will transform the section#user-cards into:

    ```html
    <section id="user-cards" data-for-items="https://rustybeam.net/schema/Credential">
        <template>
            <div itemscope itemtype="https://rustybeam.net/schema/Credential" itemid="http://this.document.url/#johndoe">
                <p>
                    The users' username is <span itemprop="username">johndoe</span>. They
                    have the following roles:
                    <ul>
                        <li itemprop="role">administrator</li>
                        <li itemprop="role">editor</li>
                    </ul>
                </p>
            </div>
        </template>
        <div itemscope itemtype="https://rustybeam.net/schema/Credential" itemid="http://this.document.url/#janedoe">
            <p>
                The users' username is <span itemprop="username">janedoe</span>. They
                have the following roles:
                <ul>
                    <li itemprop="role">editor</li>
                </ul>
            </p>
        </div>
        <div itemscope itemtype="https://rustybeam.net/schema/Credential" itemid="http://this.document.url/#billdoe">
            <p>
                The users' username is <span itemprop="username">billdoe</span>. They
                have the following roles:
                <ul>
                    <li itemprop="role">writer</li>
                </ul>
            </p>
        </div>               
    </section>    
    ```

    More importantly, these microdata elements then become "live". Changing the value in one of the elements will
    change the original, and vice versa. If _additional_ authoritative items with the schema are added to the document,
    then more non-authoratative items are added. If authoritative items are removed from the document, then non-authoritative
    items that reference them are also removed.

## Fetch API

There are also some capabilities in the Microdata API to fetch microdata from remote sources:

    ```javascript
        import { Microdata } from './index.mjs';

        const newdoc = Microdata.fetch( "http://example.com/page.html" );
        console.log( newdoc.microdata ) // has a microdata property, just like document        
    ```

The Fetch API respects document fragments too:

    ```javascript
        import { Microdata } from './index.mjs';

        // just get the fragment of the document with the johndoe element
        let fragment = Microdata.fetch( "http://example.com/page.html#johndoe" );
        console.log( fragment.microdata) 
        // this is equivalent to:
        const newdoc = Microdata.fetch( "http://example.com/page.html" );
        fragment = newdoc.getElementById('johndoe')
        console.log( fragment.microdata );
    ```

Microdata is aware of the fetch API and can 

    ```html
    <meta itemscope itemtype="https://rustybeam.net/schema/HostConfig" itemid="https://example.com/#localhost">
    <script type="module">
        import { Microdata } from './index.mjs';
        
    
        // fetches the page at https://example.com/ and then returns page.getElementById('localhost');
        const microdataElement = await document.microdata[0].fetch();
        console.log( microdataElement.microdata.hostname ) // logs the hostname property from the fetched microdata item
    </script>
    ```

It's worth noting that this works because the meta tag there is not an authoritative source.

    ```html
    <div id="johndoe" itemref="enc" itemscope itemtype="https://rustybeam.net/schema/Credential">
        <p>
            The users' username is <span itemprop="username">johndoe</username>. They
            have the following roles:
            <ul>
                <li itemprop="role">editor</li>
                <li itemprop="role">writer</li>
            </ul>
            The users' password is <span itemprop="password">seecret</span>.
        </p>
    </div>
        <script type="module">
        import { Microdata } from './index.mjs';        
    
        // returns document.getElementById('johndoe') because it is an authoritative item. I can
        // then ask for the element's microdata property to get the microdata item.
        const microdataElement = await document.microdata[0].fetch();
        microdataElement.microdata.username = "paul"; // change username to paul
    </script>
    ```
