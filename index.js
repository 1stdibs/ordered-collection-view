"use strict";
var assign = require('lodash.assign');
var pick = require('lodash.pick');
var pluck = require('lodash.pluck');
var result = require('lodash.result');
var toArray = require('lodash.toarray')
var bindAll = require('lodash.bindall');
var compact = require('lodash.compact');
var View = require('simple-view').View;
var after = require('dom-insert').after;
var slice = Array.prototype.slice;
var Collection = require('backbone-collection').Collection;
var collectionViewElementKey = '--collection-view-element-key';

module.exports = View.extend({
    initialize: function (options) {
        options = options || {};
        this.el[collectionViewElementKey] = this;
        bindAll(this, 'add', 'removeModel', 'orderDOMAccordingToCollection');
        this._viewCache = [];
        this._cacheViews = options.cache;
        this._construct = options.construct || View;
        this._constructOptions = options.constructOptions || {};
        this._viewsById = {};
        this._subTagName = options.subTagName || "div";
        this._subTagClass = options.subTagClass || "";
        this._emptyMessage = options.emptyMessage;
        this.currentlyAdding = [];
        if (!this.collection) {
            this.collection = new Collection();
        }
        this.listenTo(this.collection, 'add', this.add);
        this.listenTo(this.collection, 'remove', this.removeModel);
        this.listenTo(this.collection, 'reset', function () {
            while (this.el.firstChild) {
                this.el.removeChild(this.el.firstChild);
            }
            this._viewCache = {};
            this._viewsById = {};
            this.orderDOMAccordingToCollection();
            if (this.collection.length) {
                this.collection.each(this.add);
            } else {
                this.showEmpty();
            }
        });
        this.listenTo(this.collection, 'sort', this.orderDOMAccordingToCollection);
        this.collection.forEach(this.add);
    },
    orderDOMAccordingToCollection: function () {
        // order dom with minimal movements in order to minimize jerkyness of moving elements around
        var firstModel = this.collection.at(0);
        var firstViewIsFake = false;
        var lastInserted;
        var firstView;
        var firstEl;
        if (!firstModel) {
            return; // collection is empty;
        }
        slice.call(this.el.childNodes).filter(function (child) { // remove any elements that can't be associated with views, or can't be mapped to a model through its view
            var elView = child[collectionViewElementKey];
            return !elView || !this.collection.get(elView.model);
        }.bind(this)).map(function (el) {
            el.parentNode.removeChild(el);
        });
        firstView = this._viewsById[firstModel.cid];
        if (!firstView) {
            firstViewIsFake = true;
            firstEl = document.createElement(this._subTagName);
            this.el.appendChild(firstEl);
        } else {
            firstEl = firstView.el;
        }
        lastInserted = firstEl; // first insert will be adjacent to itself
        this.el.appendChild(lastInserted);
        this.collection.models.forEach(function (model) {
            var viewToShuffle = this._viewsById[model.cid];
            var elToShuffle;
            if (!viewToShuffle) {
                return;
            }
            elToShuffle = viewToShuffle.el;
            after(lastInserted, elToShuffle);
            lastInserted = elToShuffle;
        }.bind(this));
        if (firstViewIsFake) {
            firstEl.parentNode.removeChild(firstEl);
        }
    },
    orderCollectionAccordingToDOM: function () {
        var oldComparator;
        // remove any models that don't correspond to elements in the view
        this.collection.models.filter(function (model) {
            var view = this._viewsById[model.cid];
            var curNode;
            if (!view) {
                return false; // awkward situation
            }
            curNode = view.el;
            while(curNode = curNode.parentNode) {
                if (curNode === this.el) {
                    return false;
                }
            }
            return true;
        }.bind(this)).forEach(this.collection.remove.bind(this.collection));
        // order the models according to the order of the elements in our view
        oldComparator = this.collection.comparator;
        this.collection.comparator = function (model) {
            var el = this._viewsById[model.cid].el;
            return slice.call(el.parentNode.childNodes).indexOf(el);
        }.bind(this);
        this.collection.sort();
        this.collection.comparator = oldComparator;
    },
    removeModel: function (model) {
        var view = this._viewsById[model.cid];
        if (!view) {
            return;
        }
        this.collection.remove(model);
        if (view.el.parentNode) {
            view.el.parentNode.removeChild(view.el);
        }
        view.remove();
        delete this._viewsById[model.cid];
    },
    viewAt: function (index) {
        var model = this.collection.at(index);
        return this._viewsById[model.cid];
    },
    add: function (thing) {
        var options = {};
        var newElement;
        var constructOptions;
        var oldView;
        if (this.currentlyAdding[thing.cid]) {
             // the call to this.collection.add at the end of this
             // function will trigger a call to thise very function
             // again. We can prevent double-handling by checking
             // currentlyAdding for the current model's cid and
             // bailing if it's present.
            return;
        }
        if (thing.el && thing.cid) { // assume it's a backbone view-like object
            options.view = thing;
            options.model = options.view.model;
        } else if (thing.set && thing.get && thing.cid) { // assume backbone-like model
            options.model = thing;
        } else if (thing instanceof Object) {
            options = thing;
        }
        options = assign({
            at: undefined, // TODO: test this
            model : options.view ? options.view.model : undefined, // required
            view : undefined, // required
            el: options.view ? options.view.el : undefined // override the constructed view's element when passing a model
        }, options);
        if (!options.model) {
            throw new Error("CollectionView's add method needs a model, either explicitly, or through a view");
        }
        if (this._cacheViews && undefined !== options.model.id && this._viewCache[options.model.id]) {
            // get view from cache
            options.view = this._viewCache[options.model.id];
            options.view.delegateEvents(); // this appears to be necessary only in practice, not in tests. Libations for anyone who can explain to me why. -TRH
            options.model = options.view.model;
        } else if (!options.view) {
            // we need to make a view
            if (options.el) {
                newElement = options.el;
            } else {
                newElement = document.createElement(this._subTagName);
            }
            if (this._subTagClass) {
                newElement.classList.add(this._subTagClass);
            }
            constructOptions = this._constructOptions;
            if ("function" === typeof constructOptions) {
                constructOptions = constructOptions.call(this, options.model);
            }
            options.view = new this._construct(assign({el : newElement, model : options.model}, constructOptions));
        }
        this.el.appendChild(options.view.el);
        oldView = this._viewsById[options.view.model.cid];
        if (oldView && oldView.el !== options.view.el) {
            oldView.el.parentNode.removeChild(oldView.el);
        }
        this._viewsById[options.view.model.cid] = options.view;
        options.view.el[collectionViewElementKey] = options.view;
        if (this._cacheViews && undefined !== options.view.model.id) {
            this._viewCache[options.view.model.id] = options.view;
        }
        this.currentlyAdding[options.model.cid] = options.model;
        this.collection.add(options.model, pick(options, 'at'));
        delete this.currentlyAdding[options.model.cid];
    },
    showEmpty: function () {
        if (this._emptyMessage) {
            this.el.innerHTML = result(this, '_emptyMessage');
        }
    }
});
['map', 'filter', 'each', 'invoke'].forEach(function (processor) {
    module.exports.prototype[processor] = function (f, context) {
        var views = toArray(pick(this._viewsById, pluck(this.collection.models, 'cid')));
        var innerArgs = [views].concat(Array.prototype.slice.call(arguments));
        return _[processor].apply(this, innerArgs);
    };
});
collectionViewElementKey = module.exports.collectionViewElementKey;