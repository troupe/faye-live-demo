/*global Backbone:false, _:false */
var app = app || {};

(function () {
  'use strict';

  var fayeClient = new Faye.Client('/faye');

  function UpdateEventListener(outstandingId, models) {
    this._outstandingId = outstandingId;
    this._awaitCount = models.length;

    _.each(models, function(model) {
      this.listenToOnce(model, 'sync error', this._onModelSync);
    }, this);
  }

  _.extend(UpdateEventListener.prototype, Backbone.Events, {
    _onModelSync: function(model) {
      if(model.id === this._outstandingId) {
        // Great, this is the model we're waiting for!
        this.trigger('found', model);
        this.stopListening();

      } else if(--this._awaitCount === 0) {
        // All the models are done and we haven't found the id we received from the realtime stream
        this.stopListening();
        this.trigger('notfound');
      }
    }
  });


  var LiveCollection = Backbone.Collection.extend({
    constructor: function(models, options) {
      Backbone.Collection.prototype.constructor.call(this, models, options);

      this.subscription = fayeClient.subscribe(this.url, this.fayeEvent, this);
    },

    fayeEvent: function(message) {
      var method = message.method;
      var body = message.body;

      switch(method) {
        case 'POST':
          this._createEvent(body);
          break;

        case 'PUT':
          this._updateEvent(body);
          break;

        case 'DELETE':
          this._removeEvent(body);
          break;

        default:
          console.log('Unknown realtime event', message);
      }
    },

    _createEvent: function(body) {
      console.log('live: Create event', body);

      // Does this id exist in the collection already?
      // If so, rather just do an update
      var id = this._getModelId(body);
      if(this.get(id)) {
        return this._updateEvent(body);
      }

      // Look to see if this collection has any outstanding creates...
      var idAttribute = this.model.prototype.idAttribute;
      var unsaved = this.filter(function(model) {
        return !model.id;
      });

      // If there are unsaved items, monitor them and if one of them turns out to be the matching object
      // then simply update that
      if(unsaved.length) {
        console.log('live: awaiting syncs of unsaved objects');

        var listener = new UpdateEventListener(id, unsaved);

        listener.once('notfound', function() {
          this.add(body, { parse: true });
        }, this);

      } else {
        console.log('live: adding immediately');

        this.add(body, { parse: true });

      }
    },

    _updateEvent: function(body) {
      console.log('live: Update event', body);

      var id = this._getModelId(body);

      var parsed = new this.model(body, { parse: true });

      // Try find an existing instance with the given ID
      var existingModel = this.get(id);

      // If it exists, update it
      if(existingModel) {
        existingModel.set(parsed.attributes);
      } else {
        // If it doesn't exist, add it
        this.add(parsed);
      }

    },

    _removeEvent: function(body) {
      console.log('live: Remove event', body);

      var id = this._getModelId(body);
      this.remove(id);
    },

    _getModelId: function(model) {
      return model[this.model.prototype.idAttribute];
    }

  });

  // Create our global collection of **Todos**.
  app.LiveCollection = LiveCollection;
})();
