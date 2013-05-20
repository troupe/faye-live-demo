/*global Backbone:false, _:false */
var app = app || {};

(function () {
  'use strict';

  var fayeClient = new Faye.Client('/faye');

  function UpdateEventListener(outstandingId, models) {
    this._outstandingId = outstandingId;
    this._awaitCount = models.length;

    _.each(models, function(model) {
      this.listenToOnce(model, 'sync', this._onModelSync);
    }, this);
  }

  _.extend(UpdateEventListener.prototype, Backbone.Events, {
    _onModelSync: function(model) {
      if(model.id === this._outstandingId) {
        // Great, this is the model we're waiting for!
        this.trigger('found', model);
        this.stopListening();

      } else {
        this._awaitCount--;
        if(this._awaitCount === 0) {
          // All the models are done and we haven't found the id we received from the realtime stream
          this.stopListening();
          this.trigger('notfound');
        }
      }
    }
  });


  var LiveCollection = Backbone.Collection.extend({
    constructor: function(models, options) {
      _.bindAll(this, 'fayeEvent');
      Backbone.Collection.prototype.constructor.call(this, models, options);

      this.subscription = fayeClient.subscribe(this.url, this.fayeEvent);
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

    _createEvent: function(message) {
      // Does this id exist in the collection already?
      // If so, rather just do an update
      var id = message[this.model.prototype.idAttribute];
      if(this.get(id)) {
        return this._updateEvent(message);
      }


      // Look to see if this collection has any outstanding creates...
      var idAttribute = this.model.prototype.idAttribute;
      var unsaved = this.filter(function(model) {
        return !model.id;
      });

      // If there are unsaved items, monitor them and if one of them turns out to be the matching object
      // then simply update that
      if(unsaved.length) {
        var listener = new UpdateEventListener(id, unsaved);

        listener.once('found', function() {
          console.log('Ignoring this for now');
        });

        listener.once('notfound', function() {
          console.log('All the syncs have happened and we still havent found this object, so lets add it');
          this.add(message, { parse: true });
        }, this);

      } else {
        this.add(message, { parse: true });

      }
    },

    _updateEvent: function(message) {
      var id = message[this.model.prototype.idAttribute];

      var parsed = new this.model(message, { parse: true });

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

    _removeEvent: function(message) {
      console.log('DELETING ', message);
      var id = message[this.model.prototype.idAttribute];
      this.remove(id);
    }

  });

  // Create our global collection of **Todos**.
  app.LiveCollection = LiveCollection;
})();
