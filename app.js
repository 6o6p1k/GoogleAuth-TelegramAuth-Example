var express = require('express');
var http = require('http');
var https = require('https');
var path = require('path');
var config = require('./config');
var favicon = require('static-favicon');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var routes = require('./middleware/routes');
var session = require('express-session');
var sessionStore = require('./middleware/libs/sessionStore');
var messageLog = require('./middleware/ioLog');
var ip = require('ip');
var fs = require('fs');

//SSL
var options = {
    key: fs.readFileSync('./ssl/server.key', 'utf8'),//privatekey.pem
    cert: fs.readFileSync('./ssl/server.crt', 'utf8'),//certificate.pem
};

var app = express();
// view engine setup:
app.set('port', config.get('port'));
//Engines:
app.engine('ejs', require('ejs-locals'));
app.set('views', __dirname + '/template');
app.set('view engine', 'ejs');


app.use(favicon());
//app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded());
app.use(cookieParser(""));

app.use(session({
    secret: config.get('session:secret'),
    resave: config.get('session:resave'),
    saveUninitialized: config.get('session:saveUninitialized'),
    key: config.get('session:key'),
    cookie: config.get('session:cookie'),
    store: sessionStore
}));
//
app.use(require('./middleware/loadUser'));
//PASSPORT
var passport = require('passport');
app.use(passport.initialize());
app.use(passport.session());
//
app.use(app.router);
//
//Routes
routes(app);
app.use(express.static(path.join(__dirname, 'public')));
//
//Error Handler middleware
require('./middleware/errorHandler')(app);
//

//Create Server
var server = http.createServer(app);
//var server = https.createServer(options,app);
server.listen(config.get('port'), function(){
    //clean global chat history after restar server
    cleanHistory();
    console.log('Express server listening on ip:',ip.address(),',port:',config.get('port'));
});
//socket
var io = require('./middleware/socket').serv(server)//(server);
app.set('io', io);

function cleanHistory() {
    messageLog.c('messages.txt',function (err) {
        if (err) console.log('messageLog.c err', err)
    });
}



