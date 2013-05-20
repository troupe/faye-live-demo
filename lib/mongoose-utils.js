/*jshint globalstrict:true, trailing:false, unused:true, node:true */
"use strict";

exports.attachListenersToSchema = function (schema, options) {
  if(options.onCreate || options.onUpdate) {
    schema.pre('save', function (next) {
      var isNewInstance = this.isNew;

      this.post('save', function(postNext) {
        if(isNewInstance) {
          if(options.onCreate) options.onCreate(this, postNext);
        } else {
          if(options.onUpdate) options.onUpdate(this, postNext);
        }
      });

      next();
    });
  }

  if(options.onRemove) {
    schema.post('remove', function(model, numAffected) {
      options.onRemove(model, numAffected);
    });
  }

};
