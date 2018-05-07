var log = require('./../libs/log')(module);
var config = require('./../../config');
var async = require('async');
var cookie = require('cookie');   // npm i cookie
var sessionStore = require('./../libs/sessionStore');
var HttpError = require('./../error/index').HttpError;
var User = require('./../models/user').User;
var messageLog = require('./../ioLog');
var rooms = {};
var globalChatUsers = {};


function loadSession(sid, callback) {
    // sessionStore callback is not quite async-style!
    sessionStore.load(sid, function(err, session) {
        if (arguments.length == 0) {
            // no arguments => no session
            return callback(null, null);
        } else {
            return callback(null, session);
        }
    });

}
function getConSid(a) {
    var ConSid = '';
    for (var i=0;i<a.length;i++) {
        if(a[i]==':') {
            for (var j=i+1;j<a.length;j++) {
                if(a[j] != '.') {
                    ConSid += a[j];
                    continue;
                }
                else {return ConSid;};
            }
        }
        else {continue;}
    }
}
function loadUser(session, callback) {

    if (!session.user) {
        console.log('Session %s is anonymous', session.id);
        return callback(null, null);
    }

    console.log('retrieving user ', session.user);

    User.findById(session.user, function(err, user) {
        if (err) return callback(err);

        if (!user) {
            return callback(null, null);
        }
        console.log('user found by Id result: ',user);
        callback(null, user);
    });
};
function getRandomIntAndCheckRooms() {
    var id = Math.floor(Math.random() * (99999 - 10000)) + 10000;
    if (!rooms[id]) return id;
    else getRandomIntAndCheckRooms();
}




var cR = function (id) {
        if (rooms[id]) {
            var objLength = Object.keys(rooms[id]).length;
            var roomClients = Object.keys(rooms[id]);
            console.log('cR id: ', id,'rooms: ', rooms,'cR id length: ',objLength);
            return {roomEnable: true,clientNum: objLength,clients: roomClients};
        }
        else {return {roomEnable: false,clientNum: false};};
};

var serv = function (server) {
    var io = require('socket.io').listen(server);
    //io.set('heartbeat interval', 5);
    //io.set('heartbeat timeout', 11);

    //io.set('origins', 'localhost:*');
    //io.set('logger', log);

    io.set('authorization', function (handshake, callback) {
        async.waterfall([
            function (callback) {
                // сделать handshakeData.cookies - объектом с cookie
                handshake.cookies = cookie.parse(handshake.headers.cookie || '');
                var sidCookie = handshake.cookies[config.get('session:key')];
                var sid = getConSid(sidCookie);
                loadSession(sid, callback);
            },
            function (session, callback) {
                if (!session) {
                    callback(new HttpError(401, 'No session'));
                }
                handshake.session = session;
                loadUser(session, callback);
            },
            function (user, callback) {
                if (!user) {
                    callback(new HttpError(403, 'Anonymous session may not connect'));
                }
                handshake.user = user;
                callback(null);
            }

        ], function (err) {
            if (!err) {
                return callback(null, true);
            }
            if (err instanceof HttpError) {
                return callback(null, false);
            }
            callback(err);
        });

    });

    io.sockets.on('session:reload', function (sid) {
        var clients = io.sockets.clients();
        clients.forEach(function (client) {
            if (client.handshake.session.id != sid) return;
            loadSession(sid, function (err, session) {
                if (err) {
                    client.emit('error', 'server error');
                    client.disconnect();
                    return;
                }
                if (!session) {
                    client.emit('logout');
                    client.disconnect();
                    return;
                }
                client.handshake.session = session;
            });
        });
    });

    io.sockets.on('connection', function (socket) {
        //Global Chat Events
        //get usernanme global chat
        var username = socket.request.user.username;
        //current socket user room id
        var userCertainrRoomId = socket.id;
        //global chat users obj
        globalChatUsers[username] = {
            sockedId:userCertainrRoomId
        };
        console.log('globalChatUsers: ',globalChatUsers);
        //res what user connected
        socket.broadcast.emit('join', username);
        //read global chat log
        messageLog.r('messages.txt',function (err,data) {
            if (err) {
                io.to(userCertainrRoomId).emit('log', err);
                console.log('messageLog.r err: ', err);
            }
            else io.to(userCertainrRoomId).emit('log', data);
        });
        //global chat message receiver
        socket.on('message', function (text, cb) {
            if (text.length == 0) return;
            if (text.length >= 60) {
                socket.broadcast.emit('message', 'Admin', 'to long message');
                return;
            }
            //append global chat log
            var messageLogData = username + '>' + text;
            messageLog.a('messages.txt',messageLogData, function (err) {
                if (err) {
                    io.to(userCertainrRoomId).emit('log', err);
                    console.log('messageLog.w err: ',err)
                }
            });

            socket.broadcast.emit('message', username, text);
            cb && cb();
        });
        // when the user disconnects perform this
        socket.on('disconnect', function () {
            socket.broadcast.emit('leave', username);
            // when the user disconnects from Global chat delete him from global obj user list
            delete globalChatUsers[username];
            //after sec, if only user don't make F5, clean global chat history
            setTimeout(function () {
                if (Object.keys(globalChatUsers).length == 0) {
                    messageLog.c('messages.txt',function (err) {
                        if (err) console.log('messageLog.c err', err)
                    });
                };
            },1000);
            // when the user disconnects from ROOM perform this
            if (socket.room) {
                var id = socket.room;
                var name = socket.username;

                console.log('disconnectRoom room id: ', id, 'user: ', name);
                // remove the username from global usernames list
                var tempName = 'temp_'+name;
                rooms[tempName] = rooms[id][name];
                delete rooms[id][name];
                // echo globally that this client has left
                //io.sockets.in(id).emit('leaveRoom', name + ' has disconnected from room');
                io.sockets.in(id).emit('disconnectRoom');
                socket.leave(socket.id);
                //after sec, if only user don't make F5, delete room from room Obj if no one users in room
                setTimeout(function () {
                    if (cR(id).clientNum == 0) {
                        delete rooms[id];
                        delete rooms[tempName];
                        messageLog.u(id + '_messages.txt',function (err) {
                            if (err) console.log('messageLog.u err: ', err)
                        });
                        console.log('delete rooms[id]: ',id);
                    };
                },1000);
            }
        });
        //ROOM emits
        //Create new room
        socket.on('createNewRoom', function (callback) {
            // create new room id
            var roomID = getRandomIntAndCheckRooms();
            rooms[roomID] = {};
            socket.broadcast.emit('message', 'SERVER', 'New room created, id is: ' + roomID);
            console.log('createNewRoom : ', roomID);
            callback(roomID);
            //after 30 sec, if no one user don't connect, delete room from room Obj
            setTimeout(function () {
                if (cR(roomID).clientNum == 0) {
                    delete rooms[roomID];
                    console.log('delete rooms[id] after 30 sec: ',roomID);
                };
            },30000);
        });
        // when the client emits 'connectRoomID', this listens and executes
        socket.on('connectRoomID', function (room) {
            //setup socket.room func
            function con() {
                // store the username in the socket session for this client
                socket.username = username;
                // store the room name in the socket session for this client
                socket.room = room;
                // send client to room ID
                socket.join(room);
                // echo to chat user connected to room id
                //socket.broadcast.emit('message', 'SERVER', username + ' have connected to room id: ' + room);
                // echo to room id that a person has connected to their room
                //io.sockets.in(room).emit('joinRoom', username + ' have connected to room id: ' + room);

            }

            console.log('connectRoomID request connection to room id : ', room,'username : ', username);
            //check its the same user from room
            var tempName = 'temp_'+username;
            if (rooms[tempName] && rooms[tempName].ready){
                rooms[room][username] = rooms[tempName];
                delete rooms[tempName];
                // Add usermane to certain room
                con();
                //read and send to certain user room chat log
                messageLog.r(room + '_messages.txt',function (err,data) {
                    if (err) {
                        io.to(userCertainrRoomId).emit('log', err);
                        console.log('messageLog.r err: ', err);
                    }
                    else io.to(userCertainrRoomId).emit('log', data);
                });
                if (cR(room).clientNum == 2) io.sockets.in(room).emit('connectRoom','hideReady');
            }
            else {
                //Adding to roomID
                rooms[room][username] = {
                    ready: false,
                    mass:[],
                    queue:undefined,
                    shootedCoor:[]
                };
                // Add usermane to room
                con();
                if (cR(room).clientNum == 2) io.sockets.in(room).emit('connectRoom');
            }
        });
        // when the client emits 'messageRoom', this listens and executes
        socket.on('messageRoom', function (text, cb) {
            var id = socket.room;
            var name = socket.username;
            console.log('messageRoom roomId: ', id, ', user: ', name, ', text: ', text);
            if (text.length == 0) return;
            if (text.length >= 60) {
                io.sockets.in(id).emit('messageRoom', 'Admin', 'to long message');
                return;
            };
            socket.broadcast.to(id).emit('messageRoom', name, text);
            cb && cb();
            //append room chat log
            var messageLogData = name + '>' + text;
            messageLog.a(id + '_messages.txt',messageLogData, function (err) {
                if (err) {
                    io.to(userCertainrRoomId).emit('log', err);
                    console.log('messageLog.w err: ',err)
                }
            });
        });
        //game core socket io module
        socket.on('gameCore', function (req, res) {
            var id = socket.room;
            var name = socket.username;
            var names = cR(id).clients;
            var FF = require('./../libs/gamecore').ff();
            //end game functional
            function gameOver(id,winnerName) {
                console.log('gameOver start');
                io.to(id).emit('messageRoom','SERVER','Game over ' + winnerName + ' win!');
                var messageLogData = 'SERVER> Game over ' + winnerName + ' win!';
                messageLog.a(id + '_messages.txt',messageLogData, function (err) {
                    if (err) {
                        io.to(userCertainrRoomId).emit('log', err);
                        console.log('messageLog.w err: ',err)
                    }
                });
                io.to(id).emit('messageRoom','SERVER','New field will send for you after 5 second. In the new game, the first one will shoot ' + winnerName);
                rooms[id][names[0]].ready = false;
                rooms[id][names[1]].ready = false;
                //change queue
                if (names[0] == winnerName) { //if requesting 0 in room
                    rooms[id][names[0]].queue = 1;
                    rooms[id][names[1]].queue = 0;
                }
                else {
                    rooms[id][names[0]].queue = 0;
                    rooms[id][names[1]].queue = 1;
                }
                setTimeout(function () {
                    var aB = require('./../libs/gamecore').ff();
                    var aP = require('./../libs/gamecore').ff();

                    socket.broadcast.to(id).emit('getArr', {arrBot:aB,arrPlayer:aP});
                    socket.emit('getArr', {arrBot:aP,arrPlayer:aB});
                    io.to(id).emit('startButtonOn','Configure you ships and pres Ready!');
                    console.log('gameOver end');
                },5000);
            }


            //req for new game, button "I give up"
            if (req == 'newGame') {
                io.to(id).emit('messageRoom','SERVER','The player ' + name + ' surrendered!');
                var messageLogData = 'SERVER> The player ' + name + ' surrendered!';
                messageLog.a(id + '_messages.txt',messageLogData, function (err) {
                    if (err) {
                        io.to(userCertainrRoomId).emit('log', err);
                        console.log('messageLog.w err: ',err)
                    }
                });
                console.log('newGame names: ',names);
                if (names[0] == name) gameOver(id,names[1])
                else gameOver(id,names[0])
            }
            //req for new fields
            if (req == 'FF') {
                console.log('req == FF rooms[id][name].ready: ',rooms[id][name].ready);
                if (rooms[id][name].ready) {
                    console.log('req reload');
                    res({arrPlayer:rooms[id][name].mass,arrBot:rooms[id][names[0]].mass});
                }
                else {
                    console.log('req == FF');
                    res({arrPlayer:FF,arrBot:FF});
                }
            }

            //req for exchange of fields between players
            if (req.mass) {
                console.log('req.mass');
                //set ready for req player
                rooms[id][name].ready = true;
                //set player war field array
                rooms[id][name].mass = req.mass;
                //reset array downed ship coordinates
                rooms[id][name].shootedCoor = [];
                //start exchange of fields between players if all players ready
                if (rooms[id][names[0]].ready && rooms[id][names[1]].ready) {
                    //if players play at 1st set queue first connected player in room set first queue in game
                    if (rooms[id][names[0]].queue == undefined || rooms[id][names[1]].queue == undefined) {
                        rooms[id][names[0]].queue = 1;
                        rooms[id][names[1]].queue = 0;
                    }
                    //start exchange
                    if (names[0] == name) { //if requesting 0 in room
                        socket.broadcast.to(id).emit('getArr', {arrBot:rooms[id][name].mass});//send to opponent field of requesting
                        res && res({arrBot:rooms[id][names[1]].mass});//send to requesting opponents field
                    }
                    else {
                        socket.broadcast.to(id).emit('getArr', {arrBot:rooms[id][name].mass});//send to opponent field of requesting
                        res && res({arrBot:rooms[id][names[0]].mass});//send to requesting opponents field
                    }
                }

            };
            //if req coordinates start >>>> game play shooting
            if (req.coor) {
                console.log('req.coor');
                var x = +req.coor[0];
                var y = +req.coor[1];
                console.log('req.coor x,y: ',x,y);
                //check for all players ready to play
                console.log('req.coor ready: ',rooms[id][names[0]].ready,';',rooms[id][names[1]].ready);
                if (rooms[id][names[0]].ready == false || rooms[id][names[1]].ready == false) {
                    socket.emit('messageRoom','SERVER','Not all players ready');
                    return;
                };
                //player try to play not in queue
                if (rooms[id][name].queue == 0) {
                    console.log('notInQueue');
                    socket.emit('messageRoom','SERVER','Not you queue, please wait');
                    return;
                }
                else {
                    //if player in queue game play set nickName for req to GameCore lib. If player number 0 he player
                    //else he bot in gameCore lib
                    console.log('req.coor inQueue');
                    var que;
                    var sCoor;
                    if(names[0] == name) {
                        que = 1;
                        sCoor = rooms[id][names[0]].shootedCoor;
                    }
                    else {
                        que = 0;
                        sCoor = rooms[id][names[1]].shootedCoor;
                    };
                }
                //next req & res to gameCore lib. GP it's callback from gameCore lib
                var GP = require('./../libs/gamecore').gp({
                    playerName:names[0],
                    botName:names[1],
                    arrPlayer:rooms[id][names[0]].mass,
                    arrBot:rooms[id][names[1]].mass,
                    result:que,
                    coor:[x,y],
                    sCoor:sCoor
                },function (GP) {
                    if (GP.arrPlayer) rooms[id][names[0]].mass = GP.arrPlayer;
                    if (GP.arrBot) rooms[id][names[1]].mass = GP.arrBot;
                    rooms[id][names[0]].queue = GP.Presult;
                    rooms[id][names[1]].queue = GP.Bresult;

                    if (GP.shootedCoor) rooms[id][name].shootedCoor = GP.shootedCoor;
                    console.log('GP GP.roomLogMess:',GP.roomLogMess);

                    messageLog.a(id + '_messages.txt', 'SERVER> ' + GP.roomLogMess, function (err) {
                        if (err) {
                            io.to(userCertainrRoomId).emit('log', err);
                            console.log('messageLog.w err: ', err)
                        }
                    });
                    //if req 0 in room
                    if (names[0] == name) {
                        socket.broadcast.to(id).emit('getArr', {arrPlayer:rooms[id][names[1]].mass});//send to opponent field of requesting
                        io.to(id).emit('messageRoom','SERVER',GP.roomLogMess);
                        res && res({arrBot:rooms[id][names[1]].mass});//send to requesting opponents field
                        //if GP.winnerName it's mean what game over and winner name = GP.winnerName
                        if (GP.winnerName) {
                            console.log('GP.winnerName',GP.winnerName);
                            gameOver(id,GP.winnerName);
                        }
                    }
                    else {
                        socket.broadcast.to(id).emit('getArr', {arrPlayer:rooms[id][names[0]].mass});//send to opponent field of requesting
                        io.to(id).emit('messageRoom','SERVER',GP.roomLogMess);
                        res && res({arrBot:rooms[id][names[0]].mass});//send to requesting opponents field
                        //if GP.winnerName it's mean what game over and winner name = GP.winnerName
                        if (GP.winnerName) {
                            console.log('GP.winnerName',GP.winnerName);
                            gameOver(id,GP.winnerName);
                        }
                    }

                });
            };
        });
    });
    return io;
};


module.exports = {serv:serv,cR:cR};