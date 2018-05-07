
var mongoose = require('mongoose');
var config = require('../../config');
mongoose.Promise = require('bluebird');

mongoose.connect(config.get('mongoose:url'), config.get('mongoose.options'));

module.exports = mongoose;