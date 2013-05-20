/* jshint node:true */
'use strict';

var express = require('express');
var mongoose = require('mongoose');
var baucis = require('baucis');

var Schema = mongoose.Schema;

var todoSchema = new Schema({
    title: String,
    completed: Boolean
});

var Todo = mongoose.model('todo', todoSchema);

var uri = 'mongodb://localhost/todo';
mongoose.connect(uri);

baucis.rest({
	singular: 'todo',
	plural: 'todos'
});


var app = express();

app.use('/api/', baucis());
app.use(express.static('public'));

app.listen(3000);