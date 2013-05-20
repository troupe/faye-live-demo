/* jshint node:true */
'use strict';

var express = require('express');
var mongoose = require('mongoose');
var baucis = require('baucis');
var http = require('http');
var faye = require('faye');
var mongooseUtils = require('./lib/mongoose-utils');
var Schema = mongoose.Schema;


// This method will send realtime notifications to the faye clients
function notifyClients(method, model, url) {
	bayeux.getClient().publish(url, {
		method: method,
		body: model.toJSON()
	});
}


// The mongoose schema used by the Todo list demo
var todoSchema = new Schema({
    title: String,
    completed: Boolean
});

// Attach events to the mongoose schema. Since the default mongoose middleware makes it difficult to
// distinguish between a create and an update event, we use a small utility that helps us to do that.
mongooseUtils.attachListenersToSchema(todoSchema, {
	onCreate: function(model, next) {
		notifyClients('POST', model, '/api/todos');
		next();
  },

  onUpdate: function(model, next) {
		notifyClients('PUT', model, '/api/todos');
		next();
  },

  onRemove: function(model) {
		notifyClients('DELETE', model, '/api/todos');
  }
});

// Create a mongoose model
var Todo = mongoose.model('todo', todoSchema);

// Connect to Mongo
mongoose.connect(process.env.MONGO_URL || 'mongodb://localhost/todo');



var app = express();
var server = http.createServer(app);
app.use(express.static('public'));

baucis.rest({
	singular: 'todo',
	plural: 'todos',
	del: function(req, res, next) {
		// Baucis' delete doesn't invoke the middleware (as it's using Model.remove())
		// So we'll override the default delete method with out own that does involk the middleware
		// on deletion.
		Todo.findById(req.params.id, function(err, todo) {
			if(err) return next(401);
			if(!todo) return next(404);

			todo.remove(function(err) {
				if(err) return next(401);
				res.send(200);
			});
		});
	}
});
app.use('/api/', baucis());


var bayeux = new faye.NodeAdapter({mount: '/faye', timeout: 45});
bayeux.attach(server);


server.listen(3000);
