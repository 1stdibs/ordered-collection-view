"use strict";
var jsdom = require("jsdom").jsdom;
global.document = jsdom(undefined, {});
global.window = document.defaultView;
global.Element = global.window.Element;
global.HTMLElement = global.window.HTMLElement;
global.CustomEvent = global.window.CustomEvent;
var Model = require('backbone-model').Model;
var Collection = require('backbone-collection').Collection;
var View = require('simple-view').View;
var CollectionView = require('..');
var sinon = require('sinon');
var slice = Array.prototype.slice;
var assert = require('assert');
var contains = require('contains');
var forEach = require('lodash.foreach');
describe('CollectionView', function () {
    var TestView;
    var testModels;
    var testCollection;
    var vc;
    var expectOrderSynchronicity;
    var sandbox;
    expectOrderSynchronicity = function () {
        assert.strictEqual(vc.el.childNodes.length, testCollection.length);
        slice.call(vc.el.childNodes).forEach(function (el, index) {
            assert.strictEqual(el[CollectionView.collectionViewElementKey].model.cid, testCollection.at(index).cid);
        });
    };
    beforeEach(function () {
        var i;
        sandbox = sinon.sandbox.create();
        testModels = [];
        for (i=0; i < 7; ++i) {
            var newModel = new Model({id: i, order: (10 + i * i * i) % 7});
            testModels.push(newModel);
        }
        TestView = View.extend({
            events: {
                click : sinon.spy()
            },
            initialize: function (options) {
                this.options = options;
                this.isTestView = true;
            }
        });
        testCollection = new Collection();
        testCollection.add(testModels[1]);
        testCollection.add(testModels[2]);
        testCollection.add(testModels[3]);
        vc = new CollectionView({
            construct: TestView,
            collection: testCollection
        });
    });
    afterEach(function () {
        sandbox.restore();
    });
    it('should create a collection if options.collection is null', function () {
        vc = new CollectionView();
        assert(vc.collection instanceof Collection);
    });
    it('should append collections existing views upon init', function () {
        assert.equal(vc.el.childNodes.length, testCollection.length);
    });
    it('should add views when models are added to the collection', function () {
        var originalChildrenCount = vc.el.childNodes.length;
        testCollection.add(testModels[4]);
        testCollection.add(testModels[5]);
        assert.strictEqual(vc.el.childNodes.length, originalChildrenCount + 2);
    });
    it('should not add a duplicate view when a model is added twice', function () {
        var originalChildrenCount = vc.el.childNodes.length;
        testCollection.add(testModels[4]);
        testCollection.add(testModels[5]);
        testCollection.add(testModels[6]);
        testCollection.add(testModels[6]);
        testCollection.add(testModels[6]);
        testCollection.add(testModels[6]);
        testCollection.add(testModels[5]);
        assert.strictEqual(vc.el.childNodes.length, originalChildrenCount + 3);
    });
    it("should remove the model's view's element when the model is removed using removeModel", function () {
        var removedAssociatedView = vc._viewsById[testModels[2].cid];
        var viewForModel = vc._viewsById[testModels[2].cid];
        assert(viewForModel);
        assert(contains(vc.el, viewForModel.el));
        vc.removeModel(testModels[2]);
        assert.notEqual(removedAssociatedView, undefined);
        assert(!contains(vc.el, removedAssociatedView.el));
        assert.strictEqual(vc._viewsById[testModels[2].cid], undefined);
    });
    it("should call remove on any views that are removed", function () {
        var removedAssociatedView = vc._viewsById[testModels[2].cid];
        assert(contains(vc.el, vc._viewsById[testModels[2].cid].el));
        sandbox.stub(removedAssociatedView, 'remove');
        vc.removeModel(testModels[2]);
        sinon.assert.called(removedAssociatedView.remove);
    });
    it("should remove the view associated with the model when the model is removed from the collection directly", function () {
        var removedView = vc._viewsById[testModels[2].cid];
        assert(contains(vc.el, removedView.el));
        testCollection.remove(testModels[2]);
        assert(!contains(vc.el, removedView.el));
    });
    it("should add a view associated with the model when the model is added from the collection directly", function () {
        assert.strictEqual(vc._viewsById[testModels[4].cid], undefined);
        testCollection.add(testModels[4]);
        assert.notStrictEqual(vc._viewsById[testModels[4].cid], undefined);
        assert(contains(vc.el, vc._viewsById[testModels[4].cid].el));
    });
    it("should automatically remove the model from the collection when the element associated with the view is removed from the dom", function () {
        var viewToRemove = vc._viewsById[testModels[2].cid];
        assert.equal(testCollection.get(viewToRemove.model), testModels[2]);
        viewToRemove.el.parentNode.removeChild(viewToRemove.el);
        vc.orderCollectionAccordingToDOM();
        assert.strictEqual(testCollection.get(viewToRemove.model), undefined);
    });
    it(("should automatically remove the element if it does not correspond to a model"), function () {
        var view = vc.el.childNodes[0][CollectionView.collectionViewElementKey];
        assert.strictEqual(testCollection.get(view.model), view.model);
        testCollection.remove(view.model);
        vc.orderDOMAccordingToCollection();
        assert(!slice.call(vc.el.childNodes).map(function (vcChildEl) {
            return contains(vcChildEl, view.el);
        }).reduce(function (m, contained) {
            return contained || m;
        }));
    });
    it("should reorder the elements when the models in the collection have been sorted", function () {
        testCollection.add(testModels);
        testCollection.comparator = "order";
        testCollection.sort();
        expectOrderSynchronicity();
    });
    it("should match the order of the collection when the DOM elements change", function () {
        var modelLengthBeforeShuffle;
        var numElementsBeforeShuffle;
        var childNode;
        testCollection.add(testModels);
        modelLengthBeforeShuffle = testCollection.length;
        numElementsBeforeShuffle = vc.el.childNodes.length;
        assert.equal(modelLengthBeforeShuffle, testModels.length);
        assert.equal(modelLengthBeforeShuffle, numElementsBeforeShuffle);
        childNode = vc.el.childNodes[0];
        childNode.parentNode.insertBefore(childNode, childNode.parentNode.lastChild);
        childNode = vc.el.childNodes[0];
        childNode.parentNode.insertBefore(childNode, childNode.parentNode.lastChild);
        childNode = vc.el.childNodes[0];
        childNode.parentNode.insertBefore(childNode, childNode.parentNode.lastChild);
        childNode = vc.el.childNodes[0];
        childNode.parentNode.insertBefore(childNode, childNode.parentNode.lastChild);
        var a = vc.el.childNodes[0];
        a.parentNode.removeChild(a);
        vc.orderCollectionAccordingToDOM();
        var numElementsAfterShuffle = vc.el.childNodes.length;
        var modelLengthAfterShuffle = testCollection.length;
        assert.equal(numElementsBeforeShuffle, numElementsAfterShuffle + 1);
        assert.equal(modelLengthAfterShuffle, numElementsAfterShuffle);
        assert.equal(modelLengthAfterShuffle + 1, numElementsBeforeShuffle);
        expectOrderSynchronicity();
    });
    it("should cache child views that retain event binding after coming back", function () {
        var testViewBefore;
        var testViewAfter;
        var testElBefore;
        var testElAfter;
        vc._cacheViews = true;
        testCollection.add(testModels[4]);
        vc.orderDOMAccordingToCollection();
        testViewBefore = vc._viewsById[testModels[4].cid];
        testElBefore = testViewBefore.el;
        testCollection.remove(testModels[4]);
        vc.orderDOMAccordingToCollection();
        testCollection.add(testModels[4]);
        vc.orderDOMAccordingToCollection();
        testViewAfter = vc._viewsById[testModels[4].cid];
        testElAfter = testViewAfter.el;
        assert.strictEqual(testViewBefore, testViewAfter);
        assert.strictEqual(testElBefore, testElAfter);
        testViewBefore.el.dispatchEvent(new CustomEvent('click', {bubbles: true}));
        sinon.assert.called(TestView.prototype.events.click);
    });
    it("should default the element type to 'div'", function () {
        assert.equal(vc.el.childNodes[0].tagName, 'DIV');
    });
    it("should create child elements of the type specified by options.subTagName", function () {
        var mvc = new CollectionView({
            subTagName: "SPAN",
            construct: TestView,
            collection: testCollection
        });
        assert.strictEqual(mvc.el.childNodes[0].tagName, 'SPAN');
    });
    it("should use constructOptions as the options for the view constructor", function () {
        var constructOptions = {
            foo: "bar"
        };
        var mvc = new CollectionView({
            subTagName: "SPAN",
            construct: TestView,
            constructOptions : constructOptions,
            collection: testCollection
        });
        mvc.add(testModels[1]);
        mvc.add(testModels[2]);
        assert.strictEqual(mvc._viewsById[testModels[1].cid].options.foo, constructOptions.foo);
        assert.strictEqual(mvc._viewsById[testModels[2].cid].options.foo, constructOptions.foo);
    });
    it("should use constructOptions (as function) as the options for the view constructor", function () {
        var mvc;
        var constructOptions = sinon.spy(function (model) {
            assert.strictEqual(this, mvc);
            return { modelID: model.cid };
        });
        mvc = new CollectionView({
            subTagName: "SPAN",
            construct: TestView,
            constructOptions : constructOptions,
            collection: new Collection()
        });
        mvc.add(testModels[1]);
        mvc.add(testModels[2]);
        sinon.assert.calledWith(constructOptions, testModels[1]);
        sinon.assert.calledWith(constructOptions, testModels[2]);
        assert.strictEqual(mvc._viewsById[testModels[1].cid].options.modelID, testModels[1].cid);
        assert.strictEqual(mvc._viewsById[testModels[2].cid].options.modelID, testModels[2].cid);
    });
    it("should use subTagClass as the class name for child elements if specified", function () {
        var subTagClass = "foo-class-testy-test";
        var mvc = new CollectionView({
            subTagName: "SPAN",
            construct: TestView,
            collection: new Collection(),
            subTagClass: subTagClass
        });
        mvc.add(testModels[1]);
        assert(mvc._viewsById[testModels[1].cid].el.matches('.' + subTagClass));
    });
    it("should maintain a consistent viewsById map across resets", function () {
        var testModelCopies = testModels.map(function (model) {
            return new Model(model.attributes);
        });
        vc.collection.reset(testModelCopies);
        forEach(vc._viewsById, function (view) {
            assert.strictEqual(vc.collection.get(view.model.id).cid, view.model.cid);
        });
    });
    it("should use the element in options.el when adding a model", function () {
        var model = new Model();
        var el = document.createElement('div');
        vc.add({model: model, el: el});
        assert.strictEqual(vc._viewsById[model.cid].el, el);
    });
    it("should infer the model from the view when passed as an options property", function () {
        var m = new Model();
        var v = new View({model: m});
        vc.add({view: v});
        assert.strictEqual(vc._viewsById[v.model.cid], v);
    });
});
