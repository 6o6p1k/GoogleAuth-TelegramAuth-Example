var fs = require('fs');
var User = require('./../models/user').User;
var HttpError = require('./../error').HttpError;
var checkAuth = require('../checkAuth');
var checkAuthAdmin = require('../checkAuthAdmin');
var AuthError = require("../models/user.js").AuthError;
var checkRoom = require('../checkRoom');
var CryptoJS = require('crypto-js');
var config = require('../../config');
const telegramBotToken = config.get('telegramToken');
var passport = require('passport');
var GoogleStrategy = require('passport-google-oauth').OAuth2Strategy;
//check telegram hesh
function getDataString(user) {
    delete user.hash;
    var newArr =[];
    var arrKeys = Object.keys(user)//
    var arrVal = Object.values(user)
    for (var i=0;i<arrKeys.length;i++) {
        newArr[i] = arrKeys[i]+'='+arrVal[i];
    }
    var str = newArr.sort().join('\n');
    return str;
}

// Use the GoogleStrategy within Passport.
passport.serializeUser(function(user, done) {
    console.log('serializeUser: ',user);
    User.findOne({username:user.username}, function(err, user) {
        done(null, user._id);
    });
});
passport.deserializeUser(function(id, done) {
    console.log('deserializeUser id: ',id);
    User.findOne({googleId:id}, function(err, user) {
        done(err, user);
    });
});
passport.use(new GoogleStrategy({
        clientID: config.get('GoogleClientData:clientID') ,
        clientSecret: config.get('GoogleClientData:clientSecret'),
        callbackURL: config.get('GoogleClientData:callbackURL')
    }, function(accessToken, refreshToken, profile, done) {
    //console.log('profile contains all the personal data returned: ',profile);
    var id = profile.id;
    var eMail = profile.emails[0].value;
    console.log('profile id: ',id,',','eMail: ',eMail);
    User.findOne({googleId:id}, function(err, user) {
        if(user) {
            console.log('User.findOne by googleId: ',user);
            return done(null, user);
        } else {
            console.log('no user found by googleId');
            var username = profile.name.familyName;
            var password = id + username;
            console.log('profile contains personal data username: ',username,', id: ',id,', eMail: ',eMail);
            User.authorize({username:username,password:password,gId:id}, function(err, user) {
                if (err) {
                    if (err instanceof AuthError) {
                        return done(new HttpError(403, err.message));
                    } else {
                        return done(err);
                    }
                }
                return done(null, user);
            });
        }
    });

    }
));
//
module.exports = function(app) {
    //Route Telegram oAuth
    app.get('/auth/telegram/callback', function(req, res, next) {
        var user = req.query;
        console.log('/auth/telegram/callback req: ',user);
        var id = user.id;

        var username = user.username;
        var password = id+username;
        //check Telegtram oAuth
        var hash = user.hash;
        //var dataCheckString = 'auth_date='+user.auth_date+'\nfirst_name='+user.first_name+'\nid='+user.id+'\nphoto_url='+user.photo_url+'\nusername='+user.username;
        var secret_key = CryptoJS.SHA256(telegramBotToken);
        var dataCheckString = getDataString(user);
        var cipherText = CryptoJS.HmacSHA256(dataCheckString,secret_key).toString(CryptoJS.enc.Hex);
        console.log('hash: ',hash,'cipherText: ',cipherText);
        //check data, valid or not
        if (cipherText != hash) {
            console.log('hash verify false');
            return next(new HttpError(400, 'Data is NOT from Telegram'));

        } else console.log('hash verify true');
        //Check auth data they must be not older 15 min
        if (new Date(user.auth_date) + 900000 < new Date() ) {
            console.log('Data is outdated');
            return next(new HttpError(408, 'Telegram Data is outdated'));
        }
        //User.findOne searches for a user by TelegramId
        User.findOne({telegramId:id}, function(err, user) {
            if (user) {
                console.log('User.findOne by TelegramId: ',user);
                req.session.user = user._id;
                return res.render('chat',{user});
            } else {
                console.log('user not found');
                User.authorize({username:username,password:password,tId:id}, function(err, user) {
                    console.log('User.authorize new telegram user');
                    if (err) {
                        if (err instanceof AuthError) {
                            return next(new HttpError(403, err.message));
                        } else {
                            return next(err);
                        }
                    }
                    req.session.user = user._id;
                    res.render('chat',{user});
                });
            };
        });

    });

    // Route the GoogleStrategy.
    app.get('/auth/google',
        passport.authenticate('google', {scope: ['https://www.googleapis.com/auth/plus.login','https://www.googleapis.com/auth/userinfo.email']})
    );

    app.get('/auth/google/callback',
        passport.authenticate('google', { failureRedirect: '/login' }), function(req, res) {
            console.log('/auth/google/callback req: ');
            var id = req.user.googleId;
            User.findOne({googleId:id}, function(err, user) {
                req.session.user = user._id;
                res.render('chat.ejs',{user});
            });
    });


    app.get('/', function(req, res) {
            console.log("/");
            var forwardedIpsStr = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
            var IP = '';
            if (forwardedIpsStr) {
                IP  = forwardedIpsStr.split(',')[0];
                IP = IP.split(':')[3];
                console.log("connected user ip: ", IP);
            }
            res.render('frontpage.ejs');
        }
    );

    app.get('/login', function(req, res) {
            res.render('login.ejs');
        }
    );

    app.post('/login', function(req, res, next) {
        //console.log('app.post(/login: ',req);
        //console.log('/login username: ', req.body.username,' /login password: ',req.body.password);

        var username = req.body.username;
        var password = req.body.password;

        if(!username || !password) return;


        User.authorize({username:username,password:password}, function(err, user) {
            if (err) {
                if (err instanceof AuthError) {
                    return next(new HttpError(403, err.message));
                } else {
                    return next(err);
                }
            }
            req.session.user = user._id;
            res.send({});
        });
    });


    app.post('/logout', function(req, res) {
            console.log("/logout",req);
            req.session.destroy();
            res.redirect('/');
        }
    );
/*    app.post('/logoutRoom', function(req, res) {
            console.log("/logoutRoom");
            res.redirect('/chat');
        }
    );*/

    app.get('/chat', checkAuth, function(req, res) {
            console.log("/chat");
            res.render('chat.ejs');
        }
    );

/*    app.get('/game/:id', checkAuth, checkRoom, function(req, res) {
            console.log("/game");
            res.render('room');
        }
    );*/
    app.get('/users',checkAuthAdmin,function(req, res, next) {
        User.find({}, function (err, users) {
            if(err) return next(err);
            res.json(users);
        })
    });
    app.get('/userPage',checkAuth,function(req, res, next) {
        console.log("/userPage id: ",req.user._id,", name: ",req.user.username);
        var userName = req.user.username;
        User.findOne({username:userName}, function (err, user) {
            if(err) return next(err);
            console.log("/userPage User.findOne: ",user);
            res.render('userPage.ejs',{data: user});
            //res.json(user);
        })
    });
    app.post('/checkName',function (req, res, next) {
        //console.log('checkName user: ',req);
        var newUsername = req.body.newUsername;
        console.log('/checkName newUsername: ',newUsername);
        User.findOne({username:newUsername}, function (err, user) {
            console.log('/checkName user: ',user);
            if (!user) {
                res.send({});
            } else {
                res.send({user});
            }
        });
    });
    app.post('/changeUserData', function(req, res, next) {
        //Check old user password
        var oldUsername = req.body.oldUsername;
        User.findOne({username:req.user.username}, function (err, user) {
            console.log('/checkOldPass user: ',user);
            if (err) return next(new HttpError(403, "No username: ",req.user.username,"in database."));
            else {
                console.log('/checkOldPass user found by Id result: ',user);
                var userHash = user.hashedPassword;
                var passHash = CryptoJS.HmacSHA1(oldPassword,user.salt).toString(CryptoJS.enc.Hex);
                if(userHash !== passHash) return next(new HttpError(403, "You Old password is incorrect."));
            }
        });

        var newUsername = req.body.username;
        var newPassword = req.body.password;
        var oldPassword = req.body.oldPassword;
        console.log('/changeUserData, oldUsername: ',oldUsername,',','newUsername: ',newUsername,',','newPassword: ',newPassword,',','OldPassword: ',oldPassword);
        if(!newUsername || !newPassword || !oldUsername || !oldPassword) return next(new HttpError(403, "Not fool request for changing user data"));

        User.changeData({oldUsername:oldUsername,newUsername:newUsername,newPassword:newPassword}, function(err, user) {
            if (err) {
                if (err instanceof AuthError) {
                    return next(new HttpError(403, err.message));
                } else {
                    return next(err);
                }
            }
            req.session.user = user._id;
            res.send({});
        });
    });


};

