# collection-view
CollectionView manages a list of DOM elements using a Backbone.Collection
 - call orderDOMAccordingToCollection to synchronize the child elements of your view with options.collection.
   - Models that are in options.collection that do not correspond to direct children of this.el are used to construct new views using options.construct and appended to this.el
   - Direct children of this.el that do not correspond to a model in options.collection are detached.
   - Direct children of in this.el are ordered according to the index of their corresponding model in this.collection.
       Re-ordering is performed in-place to minimize the commotion that the DOM is subjected to.
 - call orderCollectionAccordingToDOM to synchronize the elements in options.collection with the child elements of this.el.
   - Models in options.collection that are do not correspond to direct children of this.el are removed from options.collection.
   - Elements that are direct children of this.el, but do not correspond to a model in the collection are left alone.
   - The remaining models in the collection are sorted according to the order in which they appear relative to their siblings

options.collection - the collection that will be used to manage the list of elements in this.el
options.construct - optional - the constructor that will be used to build the views that are attached to this.el. Defaults to simple-view
options.constructOptions - optional - the options passed to options.construct when it is called. If it is a function, it is executed for each view that is constructed, with the current CollectionView as the context, and the model for the view as the first argument.
options.subTagName - the type of element that will be managed by the colleciton. Defaults to DIV
options.subTagClass - class(es) that will be added to the sub elements
options.deferInitialAdd - optional - defer appending the initial set of views to this.el until after this deferred has been resolved
options.progressive - optional - if true, will load items progressively as they are scrolled into view

##installation:
```sh
npm install --save collection-view
```

##usage:
```js
const collectionView = require('collection-view');
```
