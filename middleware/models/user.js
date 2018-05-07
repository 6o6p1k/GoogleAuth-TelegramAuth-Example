
var crypto = require('crypto');
var mongoose = require(".././libs/mongoose");
var async = require("async");
var util = require('util');
var schema = mongoose.Schema;


var Chatschema = new schema({
    username: {
        type: String,
        unique: true,
        required: true
    },
    hashedPassword: {
        type: String,
        required: true
    },
    salt: {
        type: String,
        required: true
    },
    created: {
        type: Date,
        default: Date.now
    },
    googleId:{
        type: String,
        required: false
    },
    telegramId:{
        type: String,
        required: false
    }
});


Chatschema.methods.encryptPassword = function (password) {
    var pass = crypto.createHmac('sha1', this.salt).update(password).digest('hex');
    //console.log(pass);
    return pass;
};

Chatschema.virtual('password')
    .set(function (password) {
        //console.log(password);
        this._plainPassword = password;
        this.salt = Math.random() + '';
        this.hashedPassword = this.encryptPassword(password);
    })
    .get(function () {
        return this._plainPassword;
    });

Chatschema.methods.checkPassword = function (password) {
    return this.encryptPassword(password) === this.hashedPassword;
};

Chatschema.statics.authorize = function(paramAuth, callback) {
    var User = this;
    if (paramAuth.tId) {
        console.log('paramAuth Telegram: ',paramAuth);
        var user = new User({
            username: paramAuth.username,
            password: paramAuth.password,
            telegramId:paramAuth.tId
        });
        user.save(function(err) {
            if (err) return callback(err);
            callback(null, user);
        });
    }
    if (paramAuth.gId) {
        console.log('paramAuth Google: ',paramAuth);
        var user = new User({
            username: paramAuth.username,
            password: paramAuth.password,
            googleId:paramAuth.gId
        });
        user.save(function(err) {
            console.log('paramAuth.gId err:',err);
            if (err) return callback(err);
            callback(null, user);
        });
    } else {
        async.waterfall([
            function(callback) {
                User.findOne({username: paramAuth.username}, callback);
            },
            function(user, callback) {
                console.log('async.waterfall user:',user);
                if (user) {
                    if (user.checkPassword(paramAuth.password)) {
                        callback(null, user);
                    } else {
                        callback(new AuthError("Password is incorrect"));
                    }
                } else {
                    var user = new User({username: paramAuth.username, password: paramAuth.password});
                    user.save(function(err) {
                        if (err) return callback(err);
                        callback(null, user);
                    });
                }
            }
        ], callback);
    }
};

Chatschema.statics.changeData = function(paramAuth, callback) {
    var User = this;
    async.waterfall([
        function(callback) {
            User.findOne({username: paramAuth.oldUsername}, callback);
        },
        function(user, callback) {
            if (user) {
                user.username = paramAuth.newUsername;
                user.password = paramAuth.newPassword;
                user.save(function(err) {
                    if (err) return callback(err);
                    callback(null, user);
                })
            } else {
                callback(new AuthError("Old Username is incorrect"));
            }
        }
    ], callback);
};

exports.User = mongoose.model('User', Chatschema);


function AuthError(message) {
    Error.apply(this, arguments);
    Error.captureStackTrace(this, AuthError);

    this.message = message;
}

util.inherits(AuthError, Error);

AuthError.prototype.name = 'AuthError';

exports.AuthError = AuthError;
